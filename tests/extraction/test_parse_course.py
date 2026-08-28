"""Golden-file tests for the course-line parser.

The parser has a filter that rejects prose. A filter needs tests from both sides:
one of these lines is here because an earlier version of that filter silently
dropped it (LESSONS.md, 2026-08-28).
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "tools" / "extraction"))

from extract import parse_course  # noqa: E402

FIXTURE = REPO_ROOT / "tests" / "fixtures" / "course_lines.txt"


def fixture_lines() -> list[str]:
    return [
        line.strip()
        for line in FIXTURE.read_text(encoding="utf8").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def test_every_fixture_line_parses():
    """No real course line may be silently dropped."""
    for line in fixture_lines():
        assert parse_course(line) is not None, f"dropped: {line}"


def test_title_ending_in_a_word_ending_in_a_is_kept():
    """The regression that started this test file."""
    parsed = parse_course("GLHLTH 671 — Global Health and Health Systems in Africa")
    assert parsed == ("GLHLTH 671", "Global Health and Health Systems in Africa", None, [])


def test_cross_listed_course_keeps_its_other_code():
    code, title, _, alts = parse_course(
        "PUBPOL 559S/LAW 585 — Philanthropy, Voluntarism & Not-For-Profit Management"
    )
    assert code == "PUBPOL 559S"
    assert alts == ["LAW 585"]
    assert title.startswith("Philanthropy")


def test_credits_are_pulled_out_of_the_title():
    code, title, credits, _ = parse_course("ENERGY 590.01 - ESG Investing (3 credits)")
    assert (code, credits) == ("ENERGY 590.01", 3.0)
    assert "credits" not in title

    _, _, half, _ = parse_course("DECISION 894 – AI for Managers (1.5 cr)")
    assert half == 1.5


def test_prose_is_still_rejected():
    prose = [
        "In an increasingly resource-constrained world, energy and",
        "Students should note that electives might have pre-requisite requirements.",
        "The concentration requires students to take a total of",
        "8/18/26, 2:02 PM",
    ]
    for line in prose:
        assert parse_course(line) is None, f"kept prose: {line}"


def test_em_dash_en_dash_and_hyphen_separators_all_work():
    for sep in ["—", "–", "-"]:
        parsed = parse_course(f"FINANCE 646 {sep} Corporate Finance")
        assert parsed is not None and parsed[0] == "FINANCE 646"
