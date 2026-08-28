# TESTING.md

Purpose: the test strategy for Fuqua ConCert, and the definition of verified.

Last updated: 2026-08-28

## Frameworks and commands

Two suites, matching the two languages in ADR-0008.

**Rules and application** — `node --test`, Node 22 standard library. No dependencies, no config, no build.

```
npm test            # node --test tests/rules/*.test.js
```

Pass the glob, not the directory. `node --test tests/rules` tries to load the path as a module in this Node build and fails with MODULE_NOT_FOUND.

**Extraction** — pytest.

```
npm run test:extraction      # python -m pytest tests/extraction -q
```

**Catalog verification** — a standing mechanical check, not a test, run after any catalog or extraction change:

```
npm run verify               # python tools/extraction/verify.py
```

It cross-checks every catalog course against the document it came from, flags courses listed in a document but missing from its pathways, compares stated credits against the catalog, and checks that group minimums can add up to the stated totals. It cannot tell whether a requirement was understood correctly. A clean report is necessary, not sufficient.

Both run offline. No test reaches the network. No test opens a browser.

## Boundaries

**Rules** (`tests/rules/`): the bulk of the suite. `app/rules/` is pure ES modules with no DOM and no I/O, so it imports directly into `node --test`. Given a course list and a pathway record, assert satisfied groups, remaining requirements, credits counted, and status. Fast, deterministic, no fixtures beyond plain objects.

**Extraction** (`tests/extraction/`): golden-file tests. A committed text excerpt in `tests/fixtures/` goes in, an expected pathway record comes out. Never test against the live PDFs in `Source_docs/`, because those are outside the repo and can change, which would make the suite non-deterministic and unrunnable for anyone who clones. Each fixture carries the source filename in a comment.

**UI**: no automated tests in v1. The UI holds no requirement logic by design (ARCHITECTURE.md boundaries), so the logic worth testing is not in it. Manual verification against a written checklist, and revisit this if UI defects start recurring.

**Storage**: round-trip tests for export and import, including a plan written at an older schema version. The plan file is a compatibility surface from the first release (ADR-0011) and breaking it silently would destroy a student's multi-year plan.

## Required cases

Every conditional rule in the source documents gets an explicit test:

- The 18-credit minimum stated across concentrations.
- Choose-N-of-M groups.
- The Energy Finance overflow clause: taking all three section 1 finance courses lets the third count toward section 2.
- Courses that may be taken more than once, for example the 1.5-credit EDGE seminar.
- Variable-credit courses such as independent study at 1, 2, or 3 credits.
- The Social Entrepreneurship cap of 6 credits of non-Fuqua coursework.
- The Entrepreneurship rule that a practicum must match the discipline: Marketing 895 does not satisfy a requirement for Strategy 895.
- The Finance Certificate 3.75 GPA threshold and its intermediate qualifying state, once grades land in stage 2 (ADR-0013).
- The specialty cap as a slot count: two ordinary pathways fit, Dual Finance alone fills the cap, two certificates is valid (ADR-0017).
- A course counting toward every pathway it appears on at once (ADR-0018). Assert this positively with a course present on three pathways, since a regression here would silently understate progress.

## Coverage expectations

- `app/rules/`: every rule type has a satisfied case, an unsatisfied case, and at least one edge case. Treat a branch gap here as a defect.
- `tools/extraction/`: at least one golden-file test per distinct requirement pattern across the 18 pathways, not one per document.
- No repo-wide coverage percentage target. A number invites tests written to move the number. The rule is that new logic ships with tests, and review asks whether the test would actually fail if the logic were wrong.

## What verified means

1. The relevant suite passes locally and the actual output is pasted, not summarized.
2. New behavior has a test that fails without the change. If you did not watch it fail first, you have not verified it.
3. Lint and format run clean on any Python touched.
4. For extraction or catalog changes, a human has read the resulting data diff.

Item 4 carries the most weight. Passing tests establish that the parser did what the parser was written to do. Only reading the diff establishes that the requirement was transcribed correctly from the PDF. The failure mode this project has to avoid is not a crash, it is a confidently wrong requirement that a student plans two years of coursework around.
