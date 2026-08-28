# POSTFLIGHT.md

Purpose: the verification gate run after code changes and before declaring anything done.

Last updated: 2026-08-27

A task is not done until every item below is either satisfied or explicitly marked not applicable with a reason.

## Gate

1. **Tests written and passing.** Per TESTING.md. Paste the actual result, not a claim that tests pass. New logic without tests does not ship.
2. **Conventions followed.** Formatter and linter run clean. Naming, layout, and error handling match CONVENTIONS.md.
3. **CHANGELOG.md updated.** Add the change under `[Unreleased]` in the right category (Added / Changed / Fixed / Removed). Every meaningful change, not just releases.
4. **DECISIONS.md updated.** Every non-trivial technical choice made during the task gets an ADR. If you chose between two reasonable options, that is non-trivial. Append only, never edit a past entry.
5. **LESSONS.md updated.** If anything went wrong, took two attempts, or surprised you, log it: what happened, why, and the durable takeaway. An empty lessons log after a hard task usually means the log was skipped.
6. **ARCHITECTURE.md updated.** If you added, removed, renamed, or re-scoped a component, or changed how data moves between them, the map changes with it.
7. **Source data integrity.** Nothing wrote to `Source_docs/`. Extracted data files carry the source filename and retrieval date they came from.

## Reporting

State the gate result in one block:

```
TESTS: <command run, result>
CONVENTIONS: <lint/format result>
CHANGELOG: <entry added, or n/a + reason>
DECISIONS: <ADR ids added, or none>
LESSONS: <entry added, or none>
ARCHITECTURE: <updated, or unchanged>
```

If any item fails, the task stays open. Do not report done with a failing gate and a note about fixing it later.
