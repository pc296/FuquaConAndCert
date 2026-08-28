"""Cross-check the reviewed catalog against the source documents.

Mechanical checks only. It cannot tell whether a requirement was UNDERSTOOD
correctly, only whether the course lists and totals are consistent with the text
they came from. A clean report is necessary, not sufficient (TESTING.md).

Usage:
    python tools/extraction/verify.py
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG = REPO_ROOT / "data" / "catalog"
TEXT_DIR = REPO_ROOT / "data" / "raw" / "text"
ALIASES_FILE = CATALOG / "aliases.json"

# Case-tolerant on the area: the sources write "Management 754" in prose and
# "MANAGEMT 754" in lists, and both refer to the same course.
CODE_RE = re.compile(r"\b([A-Za-z][A-Za-z&]{2,9})\s+(\d{3}[A-Za-z]?(?:[.\-]\d{1,2})?)\b")
CREDIT_LINE_RE = re.compile(
    r"\b([A-Z][A-Z&]{2,9})\s+(\d{3}[A-Za-z]?(?:[.\-]\d{1,2})?)\b[^\n(]*\((\d+(?:\.\d+)?)\s*(?:cr|credits?)",
    re.I,
)

BASE = lambda cid: cid.split("::")[0]


def codes_in(text: str) -> set[str]:
    return {f"{m.group(1).upper()} {m.group(2)}" for m in CODE_RE.finditer(text)}


def list_codes_in(text: str) -> set[str]:
    """Codes that begin a line, i.e. actual list entries rather than prose.

    The documents share a boilerplate paragraph about FCCP numbering that mentions
    "Strategy 895" and "Marketing 895" in a sentence; those are examples, not
    requirements, and counting them produced sixteen false omissions.
    """
    out = set()
    for line in text.splitlines():
        m = CODE_RE.match(line.strip())
        if m:
            out.add(f"{m.group(1).upper()} {m.group(2)}")
    return out


def alias_map(courses: dict) -> dict[str, str]:
    """Alternate code -> canonical code, so spelling variants stop reading as errors."""
    out: dict[str, str] = {}
    for course in courses["courses"]:
        for alias in course.get("aliases", []):
            out[alias.upper()] = course["code"]
    return out


def main() -> None:
    pathways = json.loads((CATALOG / "pathways.json").read_text(encoding="utf8"))
    courses = json.loads((CATALOG / "courses.json").read_text(encoding="utf8"))
    by_id = {c["id"]: c for c in courses["courses"]}

    text_by_doc = {p.stem: p.read_text(encoding="utf8") for p in TEXT_DIR.glob("*.txt")}
    aliases = alias_map(courses)
    codes_by_doc = {}
    for name, body in text_by_doc.items():
        found = codes_in(body)
        # Fold documented spelling variants onto their canonical code.
        codes_by_doc[name] = {aliases.get(c.upper(), c) for c in found} | {
            c for c in found if c.upper() not in aliases
        }

    findings: list[tuple[str, str, str]] = []  # (severity, pathway, message)
    add = lambda sev, pid, msg: findings.append((sev, pid, msg))

    catalog_codes_by_doc = defaultdict(set)
    for pathway in pathways["pathways"]:
        doc = Path(pathway["source"]).stem
        for group in pathway["groups"]:
            for cid in group["courses"]:
                base = BASE(cid)
                catalog_codes_by_doc[doc].add(aliases.get(base.upper(), base))

    for pathway in pathways["pathways"]:
        pid = pathway["id"]
        doc = Path(pathway["source"]).stem
        source_codes = codes_by_doc.get(doc)
        if source_codes is None:
            add("ERROR", pid, f"no extracted text for source {doc}")
            continue

        seen_in_pathway = defaultdict(list)
        for group in pathway["groups"]:
            for cid in group["courses"]:
                seen_in_pathway[cid].append(group["id"])
                base = BASE(cid)
                if aliases.get(base.upper(), base) not in source_codes:
                    add("ERROR", pid, f"{cid} is in group '{group['id']}' but not in {doc}")

            dupes = [c for c in set(group["courses"]) if group["courses"].count(c) > 1]
            for c in dupes:
                add("WARN", pid, f"{c} listed twice in group '{group['id']}'")

        # Group minimums that cannot add up to the stated pathway total.
        course_mins = sum(g.get("min", len(g["courses"])) for g in pathway["groups"]
                          if g["type"] in ("courses", "all"))
        credit_mins = sum(g.get("min", 0) for g in pathway["groups"] if g["type"] == "credits")
        if pathway.get("minCourses") and course_mins > pathway["minCourses"]:
            add("ERROR", pid,
                f"group course minimums total {course_mins} but pathway minCourses is {pathway['minCourses']}")
        if pathway.get("minCredits") and credit_mins > pathway["minCredits"]:
            add("ERROR", pid,
                f"group credit minimums total {credit_mins} but pathway minCredits is {pathway['minCredits']}")

        # Is the pathway satisfiable at all with the courses it lists?
        if pathway.get("minCourses"):
            distinct = len({BASE(c) for g in pathway["groups"] for c in g["courses"]})
            if distinct < pathway["minCourses"]:
                add("ERROR", pid, f"only {distinct} distinct courses listed for a {pathway['minCourses']}-course requirement")

    # Courses listed in a document but absent from every pathway built from it.
    for doc, body in text_by_doc.items():
        if doc not in catalog_codes_by_doc:
            continue
        listed = {aliases.get(c, c) for c in list_codes_in(body)}
        omitted = sorted(
            c for c in listed - catalog_codes_by_doc[doc] if c.upper() not in aliases
        )
        for code in omitted:
            add("REVIEW", doc, f"{code} appears in the document but in no pathway record")

    # Credits stated in the source versus credits in the catalog.
    for doc, text in text_by_doc.items():
        for m in CREDIT_LINE_RE.finditer(text):
            code, stated = f"{m.group(1)} {m.group(2)}", float(m.group(3))
            matches = [c for c in by_id.values() if c["code"] == code]
            for course in matches:
                if len(matches) == 1 and abs(course["credits"] - stated) > 1e-9:
                    add("REVIEW", doc,
                        f"{code} is {stated} credits in {doc} but {course['credits']} in the catalog")

    # Standing check for cross-listings: one course filed under two subject
    # prefixes. This is how ENERGY 520 and ENVIRON 520 sat in the catalog as two
    # separate courses, so a student's single course counted toward only one of the
    # two pathways that list it (ADR-0037). Detection is automatic; accepting an
    # alias stays a human edit to aliases.json.
    alias_data = json.loads(ALIASES_FILE.read_text(encoding="utf8"))
    known = {c for v in alias_data["aliases"].values() for c in v["codes"]}
    known |= set(alias_data["aliases"])
    protected = set(alias_data["distinctFamilies"])

    def normalize_title(t: str) -> str:
        t = t.lower().replace("&", "and").replace("-", " ")
        t = re.sub(r"[^a-z0-9 ]", "", t)
        t = re.sub(r"\b(i|1)\b", "1", t)
        return " ".join(t.split())

    by_number = defaultdict(list)
    for course in by_id.values():
        area, _, number = course["code"].partition(" ")
        by_number[number].append((area, course))

    for number, entries in sorted(by_number.items()):
        if number in protected:
            continue  # deliberately distinct courses that share a number
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                (area_a, a), (area_b, b) = entries[i], entries[j]
                if area_a == area_b or a["code"] in known or b["code"] in known:
                    continue
                score = SequenceMatcher(
                    None, normalize_title(a["title"]), normalize_title(b["title"])
                ).ratio()
                if score >= 0.75:
                    add("REVIEW", "cross-listing",
                        f"{a['code']} and {b['code']} share a number and their titles match "
                        f"{score:.0%}. Same course? If so add an alias in aliases.json.")

    order = {"ERROR": 0, "WARN": 1, "REVIEW": 2}
    findings.sort(key=lambda f: (order[f[0]], f[1], f[2]))
    for sev, where, msg in findings:
        print(f"{sev:6} {where:34} {msg}")
    counts = defaultdict(int)
    for sev, _, _ in findings:
        counts[sev] += 1
    print(f"\nERROR {counts['ERROR']}  WARN {counts['WARN']}  REVIEW {counts['REVIEW']}")


if __name__ == "__main__":
    main()
