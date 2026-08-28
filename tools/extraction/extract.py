"""Extract course listings from the Fuqua requirement PDFs into a draft catalog.

Developer tool. Runs offline against ../Source_docs. Output is a DRAFT that a
human reviews before it is committed to data/catalog (ADR-0004).

Usage:
    python tools/extraction/extract.py
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT.parent / "Source_docs"
RAW_DIR = REPO_ROOT / "data" / "raw"

# A course line looks like: "FINANCE 646 - Corporate Finance (3 credits)".
# Separators vary across documents: hyphen, en dash, em dash.
COURSE_RE = re.compile(
    r"^(?P<area>[A-Z][A-Z&]{2,9})\s+(?P<number>\d{3}[A-Za-z]?(?:[.\-]\d{1,2})?)\s*"
    r"[-–—:]\s*(?P<title>.+?)\s*$"
)
CREDIT_RE = re.compile(r"\((?P<credits>\d+(?:\.\d+)?)\s*(?:cr|credits?)\b[^)]*\)", re.I)

# Footer and header noise in these printed web pages.
NOISE_RE = re.compile(r"^(https?://|\d+/\d+$|\d{1,2}/\d{1,2}/\d{2},)")


@dataclass
class DraftCourse:
    code: str
    titles: list[str] = field(default_factory=list)
    credits: list[float] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)


def read_lines(pdf_path: Path) -> list[str]:
    """Return the text lines of a PDF, layout preserved, noise dropped."""
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text(layout=True) or ""
            for raw in text.splitlines():
                line = raw.strip()
                if not line or NOISE_RE.match(line):
                    continue
                lines.append(line)
    return lines


def parse_course(line: str) -> tuple[str, str, float | None] | None:
    """Parse one course line into (code, title, credits) or None if it is prose."""
    match = COURSE_RE.match(line)
    if not match:
        return None
    title = match.group("title")
    credits: float | None = None
    credit_match = CREDIT_RE.search(title)
    if credit_match:
        credits = float(credit_match.group("credits"))
        title = CREDIT_RE.sub("", title).strip()
    # Reject prose that happens to start with a capitalized token pair. Compare the
    # final WORD, not the final characters: a suffix test on "a" also rejects any
    # title ending in "Africa", which is how GLHLTH 671 was silently dropped.
    last_word = title.rstrip(" .*+-\u2013").split()[-1].lower() if title.split() else ""
    if len(title) < 3 or last_word in {"the", "and", "of", "a", "or"}:
        return None
    code = f"{match.group('area')} {match.group('number')}"
    return code, title.strip(" .*+–-"), credits


def main() -> None:
    if not SOURCE_DIR.is_dir():
        raise SystemExit(f"Source directory not found: {SOURCE_DIR}")

    drafts: dict[str, DraftCourse] = {}
    per_document: dict[str, list[str]] = {}

    for pdf_path in sorted(SOURCE_DIR.glob("*.pdf")):
        lines = read_lines(pdf_path)
        per_document[pdf_path.name] = lines
        for line in lines:
            parsed = parse_course(line)
            if parsed is None:
                continue
            code, title, credits = parsed
            draft = drafts.setdefault(code, DraftCourse(code=code))
            if title not in draft.titles:
                draft.titles.append(title)
            if credits is not None and credits not in draft.credits:
                draft.credits.append(credits)
            if pdf_path.name not in draft.sources:
                draft.sources.append(pdf_path.name)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / "courses_draft.json").write_text(
        json.dumps(
            {
                code: {
                    "titles": d.titles,
                    "creditsSeen": sorted(d.credits),
                    "sources": d.sources,
                }
                for code, d in sorted(drafts.items())
            },
            indent=2,
        ),
        encoding="utf8",
    )
    (RAW_DIR / "text").mkdir(exist_ok=True)
    for name, lines in per_document.items():
        (RAW_DIR / "text" / f"{Path(name).stem}.txt").write_text(
            "\n".join(lines), encoding="utf8"
        )

    conflicts = {c: d.titles for c, d in drafts.items() if len(d.titles) > 1}
    print(f"courses: {len(drafts)}")
    print(f"documents: {len(per_document)}")
    print(f"title conflicts needing review: {len(conflicts)}")
    for code in sorted(conflicts)[:15]:
        print(f"  {code}: {conflicts[code]}")


if __name__ == "__main__":
    main()
