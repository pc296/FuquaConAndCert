"""Build data/catalog/courses.json from the pathway catalog and the extraction draft.

Every course id referenced by data/catalog/pathways.json gets a record. Titles come
from the extraction draft where they agree; where the source documents disagree, or
where one course code covers several distinct courses, the curated tables below win.
Both tables are reviewed data (ADR-0004): edit them deliberately, not casually.

Usage:
    python tools/extraction/build_courses.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG = REPO_ROOT / "data" / "catalog"
DRAFT = REPO_ROOT / "data" / "raw" / "courses_draft.json"
CORE = CATALOG / "core.json"
ALIASES_FILE = CATALOG / "aliases.json"

FUQUA_AREAS = {
    "ACCOUNTG", "DECISION", "ENRGYENV", "FINANCE", "FUQINTRD", "HLTHMGMT",
    "MANAGEMT", "MARKETNG", "MGMTCOM", "MGRECON", "OPERATNS", "SOCENT", "STRATEGY",
}

# Curated titles. Keys are course ids. These override the extraction draft, either
# because the source documents disagree or because the id is a disambiguated variant
# of a shared special-topics course number.
TITLES = {
    "ACCOUNTG 894::sustainability-reporting": "Special Topics: Business Sustainability Reporting & Analysis",
    "DECISION 894::modern-ai": "Modern AI for Managers",
    "DECISION 894::tech-analytics": "Transforming Tech Analytics with Machine Intelligence",
    "OPERATNS 894::sustainable-ops": "Sustainable Operations",
    "ENERGY 790-1::clean-energy": "Clean Energy in Emerging Economies",
    "ENERGY 790-1::emerging-tech": "Emerging Energy Technologies: From Lab to Market",
    "MANAGEMT 754::energy-env": "Mentored Study with an Energy and/or Environment Focus",
    "HLTHMGMT 898::new-ventures": "New Ventures Clinic: Healthcare",
    "HLTHMGMT 898::design-1": "Design in Healthcare 1: Discover",
    "HLTHMGMT 898::design-2": "Design in Healthcare 2: Design",
    "HLTHMGMT 898::design-3": "Design in Healthcare 3: Deploy",
    "HLTHMGMT 898::health-law": "Health Law and Policy",
    "ACCOUNTG 598": "Valuation and Fundamental Analysis",
    "ENERGY 631": "Energy Technology and Its Impact on the Environment",
    "ENRGYENV 625": "Energy, Markets, & Innovation",
    "ENRGYENV 628": "EDGE Seminar on Energy & Environment - Energy Focus",
    "ENRGYENV 629": "EDGE Seminar on Energy & Environment - Environment Focus",
    "ENRGYENV 895": "Fuqua Client Consulting Practicum: EDGE Project, Energy and/or Environment",
    "FINANCE 651": "Entrepreneurial Finance and Venture Capital",
    "FINANCE 653": "Fixed Income Securities and Risk Management",
    "FINANCE 654": "Advanced Corporate Finance",
    "FINANCE 656": "Global Asset Allocation & Stock Selection",
    "FINANCE 660": "Private Capital Markets",
    "FINANCE 894": "Private Equity Buyout Lab",
    "FINANCE 898": "Entrepreneurship Through Acquisition",
    "HLTHMGMT 714": "Health Care Provider Strategy",
    "HLTHMGMT 716": "Health Care Systems and Policy",
    "MANAGEMT 748": "Diversity & Talent Management",
    "MANAGEMT 749": "Ethics in Management",
    "MANAGEMT 762": "Advanced Seminar in Social Entrepreneurship",
    "MANAGEMT 894": "Women and Leadership",
    "MANAGEMT 895": "Fuqua Client Consulting Practicum",
    "MANAGEMT 896": "Entrepreneurship Planning Practicum",
    "MANAGEMT 898": "Impact Investing / FCCP Foundations (CASE i3)",
    "MARKETNG 802": "Marketing of Innovations",
    "MARKETNG 809": "Value Creation in MarTech",
    "MARKETNG 898": "Value Creation in MarTech",
    "OPERATNS 828": "Value Chain Innovation in Business Processes",
    "STRATEGY 838": "Entrepreneurial Strategy for Innovation-Based Ventures",
    "STRATEGY 840": "Business Strategy by Firms Based in Developing Countries",
    "STRATEGY 845": "Entrepreneurial Execution & Planning",
    "STRATEGY 848": "New Ventures Discovery",
    "STRATEGY 849": "New Ventures Development 1",
    "STRATEGY 850": "New Ventures Development 2",
    "STRATEGY 851": "New Ventures Delivery 1",
    "STRATEGY 852": "New Ventures Delivery 2",
    "PUBPOL 559S": "Philanthropy, Voluntarism & Not-For-Profit Management",
    "HLTHMGMT 705": "Seminars in Health Care, Part One",
    "HLTHMGMT 706": "Seminars in Health Care, Part Two",
    "HLTHMGMT 710": "Health Institutions, Systems and Policy (HSM Bootcamp)",
    "MARKETNG 895": "Fuqua Client Consulting Practicum (Marketing)",
    "STRATEGY 895": "Fuqua Client Consulting Practicum (Strategy)",
    "SOCENT 895": "Fuqua Client Consulting Practicum (Social Entrepreneurship)",
    "HLTHMGMT 895": "Fuqua Client Consulting Practicum (Health Sector Management)",
    "HLTHMGMT 896": "Duke University Hospital Experiential Learning Program",
    "MANAGEMT 754": "Mentored Study in Entrepreneurship",
    "ENERGY 590.01": "ESG Investing",
    "ENERGY 590.05": "Economics of Modern Power Systems",
    "ENERGY 590.50": "Intro to Solar Project Development",
    "PUBPOL 790.01": "Economic Development and Environmental Conservation",
    "I&E 590": "New Ventures: Climate",
    "I&E 720": "Design in Healthcare",
    "ENERGY 727": "Energy Law",
    "MGMTCOM 570": "Effective Advocacy",
    "MGRECON 787": "Behavioral Economics",
    "ENRGYENV 626": "Modeling and Analysis for Environmental Management",
}

# Credits where the source states something other than 3.
CREDITS = {
    "ACCOUNTG 894::sustainability-reporting": 1.5,
    "DECISION 894::modern-ai": 1.5,
    "DECISION 894::tech-analytics": 1.5,
    "OPERATNS 894::sustainable-ops": 1.5,
    "ENRGYENV 628": 1.5,
    "ENRGYENV 629": 1.5,
    "ENRGYENV 895": 6,
    "ENERGY 520": 1.5,
    "ENERGY 579": 1.5,
    "ENERGY 635": 1.5,
    "ENERGY 790-1::emerging-tech": 1.5,
    "ENVIRON 592": 1.5,
    "ENVIRON 801": 1,
    "LAW 520": 2,
}

# Courses whose credit value the student sets, because the source gives a range.
VARIABLE_CREDITS = {"MANAGEMT 754::energy-env": [1, 2, 3]}

# Courses that may be counted more than once.
REPEATABLE = {"ENRGYENV 628": 2, "ENRGYENV 629": 2}

# Practicum courses. Relevant to the Social Entrepreneurship one-practicum limit and
# to the FCCP subject-prefix warning that appears in several documents.
PRACTICUM = {
    "ENRGYENV 895", "MANAGEMT 895", "MANAGEMT 896", "MANAGEMT 898", "MARKETNG 895",
    "SOCENT 895", "STRATEGY 895", "HLTHMGMT 895", "HLTHMGMT 896", "FINANCE 894",
}

# Courses counted at a credit value different from their catalog credits within a
# specific pathway. Operations Management states this explicitly for SOCENT 895.
COUNTED_CREDITS = {"operations-management": {"SOCENT 895": 3}}


def area_of(course_id: str) -> str:
    return re.split(r"\s", course_id, 1)[0]


def collect_ids(pathways: dict) -> set[str]:
    ids: set[str] = set()
    for pathway in pathways["pathways"]:
        for group in pathway["groups"]:
            ids.update(group["courses"])
            for constraint in group.get("constraints", []):
                ids.update(constraint.get("subset", []))
    return ids


def main() -> None:
    pathways = json.loads((CATALOG / "pathways.json").read_text(encoding="utf8"))
    alias_data = json.loads(ALIASES_FILE.read_text(encoding="utf8"))
    alias_codes = {k: v["codes"] for k, v in alias_data["aliases"].items()}
    # Alternate code -> canonical id, so a course listed under two prefixes across
    # two source documents becomes one record instead of two.
    canonical = {code: cid for cid, codes in alias_codes.items() for code in codes}
    draft = json.loads(DRAFT.read_text(encoding="utf8")) if DRAFT.exists() else {}

    courses = {}
    missing_titles = []
    merged = []
    for course_id in sorted(collect_ids(pathways)):
        if course_id in canonical:
            # A pathway cites this course under an alternate code. Keep the pathway
            # file faithful to its source document and fold the record here.
            merged.append(f"{course_id} -> {canonical[course_id]}")
            continue
        base = course_id.split("::")[0]
        title = TITLES.get(course_id)
        if title is None:
            titles = draft.get(base, {}).get("titles", [])
            title = titles[0] if titles else None
        if title is None:
            missing_titles.append(course_id)
            title = base
        area = area_of(base)
        record = {
            "id": course_id,
            "code": base,
            "title": title,
            "area": area,
            "credits": CREDITS.get(course_id, 3),
            "isFuqua": area in FUQUA_AREAS,
        }
        if course_id in VARIABLE_CREDITS:
            record["variableCredits"] = VARIABLE_CREDITS[course_id]
        if course_id in REPEATABLE:
            record["maxTimes"] = REPEATABLE[course_id]
        if course_id in PRACTICUM:
            record["isPracticum"] = True
        aliases = alias_codes.get(course_id) or alias_codes.get(base)
        if aliases:
            record["aliases"] = [a for a in aliases if a != base]
        courses[course_id] = record

    # Core courses are hand-maintained in core.json rather than extracted, because
    # no source document lists them. They carry no credits by design: nothing counts
    # them toward a pathway, so a wrong value could only mislead (ADR-0029).
    core = json.loads(CORE.read_text(encoding="utf8"))
    for record in core["courses"]:
        if record["id"] in courses:
            raise SystemExit(
                f"{record['id']} is both a core course and a pathway elective. "
                "One of the two is wrong; resolve it before rebuilding."
            )
        courses[record["id"]] = {
            "id": record["id"],
            "code": record["code"],
            "title": record["title"],
            "area": record["area"],
            "credits": None,
            "isFuqua": True,
            "isCore": True,
        }

    out = {
        "schemaVersion": 1,
        "retrieved": pathways["retrieved"],
        "coreRetrieved": core["retrieved"],
        "countedCredits": COUNTED_CREDITS,
        "courses": [courses[k] for k in sorted(courses)],
    }
    (CATALOG / "courses.json").write_text(json.dumps(out, indent=2), encoding="utf8")

    print(f"courses written: {len(courses)} ({len(core['courses'])} core)")
    if merged:
        print(f"alias merges: {len(merged)} -> {', '.join(merged)}")
    print(f"non-Fuqua: {sum(1 for c in courses.values() if not c['isFuqua'])}")
    if missing_titles:
        print(f"NO TITLE FOUND for {len(missing_titles)}: {missing_titles}")


if __name__ == "__main__":
    main()
