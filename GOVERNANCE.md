# GOVERNANCE.md

Purpose: master index of the governing files for **Fuqua ConCert**. Re-read this file at the start of every work session.

Last updated: 2026-08-27

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

## Reading order for a new session

GOVERNANCE.md, then PREFLIGHT.md, then whichever of ARCHITECTURE.md and CONVENTIONS.md the task touches. Read DECISIONS.md by search, not front to back. Note that ADR-0003 and ADR-0014 are superseded and must not be followed.
