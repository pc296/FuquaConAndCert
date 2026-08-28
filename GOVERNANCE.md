# GOVERNANCE.md

Purpose: master index of the governing files for **Fuqua ConCert**. Re-read this file at the start of every work session.

Last updated: 2026-08-28

## The standing rule

**Before any task, read PREFLIGHT.md. After any task, complete POSTFLIGHT.md.**

A task is not done until POSTFLIGHT passes. This applies to any non-trivial change. Trivial means a typo fix or a comment, and nothing else.

## Where these files live

Project: **Fuqua ConCert**, a course planner for the Duke Fuqua full-time MBA. Repo: `pc296/FuquaConAndCert`. Repo root on disk: `Concentrations_and_Certificates/Work_folder`. Governance files sit at the repo root rather than in `/docs`, because GOVERNANCE.md and PREFLIGHT.md are read at the start of every session and a root-level file is harder to forget. `Source_docs/` sits outside the repo and is treated as read-only input.

## Index

| File | What it is for | When to read | When to update |
| --- | --- | --- | --- |
| GOVERNANCE.md | This index and the standing rules | Start of every session | When a governing file is added, removed, or renamed |
| PREFLIGHT.md | Checklist run before touching code | Before every non-trivial task | When the pre-work process changes |
| POSTFLIGHT.md | Verification gate run before declaring done | After every code change | When the definition of done changes |
| ARCHITECTURE.md | Living map of components, data flow, boundaries, dependencies | During PREFLIGHT, to identify affected components | In POSTFLIGHT, whenever structure changes |
| CONVENTIONS.md | How we write code: language, formatting, naming, layout, errors, commits | During PREFLIGHT, for rules touching the area you are changing | When a convention is added or changed, with an ADR if the change is non-trivial |
| DECISIONS.md | Append-only ADR log | During PREFLIGHT, when a choice may already have been made | In POSTFLIGHT, for every non-trivial technical choice |
| TESTING.md | Test strategy, how to run tests, what verified means | During PREFLIGHT, to confirm the test plan | When the test approach changes |
| LESSONS.md | Mistakes, root causes, and the rule adopted so they do not recur | During PREFLIGHT, for prior mistakes in the area you are touching | In POSTFLIGHT, whenever something went wrong or a non-obvious insight surfaced |
| CHANGELOG.md | Reverse-chronological record of meaningful changes | When you need the recent history of a component | In POSTFLIGHT, for every code change |

## Standing rules

1. Preflight before work, postflight after. No exceptions for non-trivial changes.
2. Every non-trivial decision goes in DECISIONS.md. Every meaningful change goes in CHANGELOG.md. Every mistake goes in LESSONS.md.
3. If something is ambiguous or under-specified, stop and ask Pat rather than assuming.
4. Keep these files current. Stale governance is worse than none.
5. DECISIONS.md is append-only. Past entries are never edited. Supersede them with a new entry.
6. `Source_docs/` is read-only. Nothing in the repo writes to it.

## Open questions

Tracked in DECISIONS.md. Anything marked `proposed` is unresolved and blocks code that depends on it. As of 2026-08-27 there are none: ADR-0001 through ADR-0020 are all accepted or superseded.

## Where the project stands

Last save point: **v0.2.0**, tagged 2026-08-28. Everything below is built, tested, and committed.

- 18 pathways and 164 courses in `data/catalog/`, verified against the 16 source documents. 15 of those courses are the Daytime MBA core (ADR-0029; FUQINTRD 692 confirmed by Pat).
- Rule engine with within-pathway allocation, group and pathway constraints, the two-specialty cap, Finance Certificate GPA and intermediate qualification, and the HSM core requirement.
- Recommender: shortest route to each pathway, and a ranking of all 18.
- Interface: semester-aware planner with a Pre-Fuqua Dual Degree bucket (ADR-0030), paste-with-confirmation entry, SVG Pathway Map, per-pathway detail with expandable option lists, step alternatives on the shortest-way list, a print-styled progress report (ADR-0031), and transcript PDF import (ADR-0033). Institutional design language throughout (ADR-0032).
- 56 tests (50 rules, 6 UI integrity), 6 extraction tests, and `npm run verify` clean.

Checks to run before believing any of that again:

```
npm test                 # rule engine
npm run test:extraction  # parser golden files
npm run verify           # catalog against the source documents
npm run serve            # then open http://localhost:8080
```

Open questions, in the order they matter:

1. Fuqua's program format page claims 17 concentrations; 16 are named on the concentrations page and 16 documents exist.
2. The Marketing concentration's narrative calls MARKETNG 796 required while listing it inside the choose-four elective set. Treated as one of the four.
3. Prerequisites and course offering years are mentioned throughout the sources and listed reliably in none of them, so the planner cannot warn that a course is not offered in the quarter you placed it.

Stages 2 to 4 of ADR-0013 that remain unbuilt: grades beyond the Finance Certificate, MEM and dual-degree coursework, and user-added substitutions.

## Reading order for a new session

GOVERNANCE.md, then PREFLIGHT.md, then whichever of ARCHITECTURE.md and CONVENTIONS.md the task touches. Read DECISIONS.md by search, not front to back. Note that ADR-0003 and ADR-0014 are superseded and must not be followed.
