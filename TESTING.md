# TESTING.md

Purpose: the test strategy for Fuqua ConCert, and the definition of verified.

Last updated: 2026-08-28

## Frameworks and commands

Two suites, matching the two languages in ADR-0008.

**Rules and application** — `node --test`, Node 22 standard library. No dependencies, no config, no build.

```
npm test            # node --test tests/rules/*.test.js tests/ui/*.test.js
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

**UI** (`tests/ui/`): no behavioural tests, because the UI holds no requirement logic by design. What it does test is structural integrity that fails silently in a browser: that the stylesheet's braces balance, that every `@font-face` is closed and points at a file that exists, that the vendored pdf.js build is present, and that pdf.js stays behind a dynamic import. A malformed CSS rule once disabled the entire stylesheet with no error and no failed request (LESSONS 2026-08-28); these assertions catch that class of defect in under a second.

Behaviour is still verified by loading the page in a real browser with the console open. Stage every file the browser loads before doing so, or the screenshot may show older code than the test suite ran against.

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
- The specialty cap as a slot count: two ordinary pathways fit, Dual Finance alone fills the cap, and two certificates is rejected because certificates are capped at one (ADR-0025, which superseded ADR-0017 and then ADR-0021).
- A course listed under different subject prefixes by two source documents resolving to one course, so it counts on every pathway that lists it under any of its names (ADR-0037).
- A transcript's term headings placing courses in different terms, coursework before the program start landing in the Pre-Fuqua bucket, and a v0.3.0 backup migrating without loss (ADR-0035, ADR-0036).
- A course counting toward every pathway it appears on at once (ADR-0018). Assert this positively with a course present on three pathways, since a regression here would silently understate progress.

## Coverage expectations

- `app/rules/`: every rule type has a satisfied case, an unsatisfied case, and at least one edge case. Treat a branch gap here as a defect.
- `tools/extraction/`: at least one golden-file test per distinct requirement pattern across the 18 pathways, not one per document.
- No repo-wide coverage percentage target. A number invites tests written to move the number. The rule is that new logic ships with tests, and review asks whether the test would actually fail if the logic were wrong.

## Whole-catalog properties

Per-rule examples are necessary and not sufficient: a test written from the same mental model as the code cannot falsify that model, which is how the constraint-allocation defect in ADR-0028 survived a passing suite. Keep these properties, which must hold for every pathway:

- Every pathway is reachable from an empty plan.
- Following the tool's own recommendation completes the pathway it was given for.
- From an empty plan, the recommended course count equals the number the source document states.
- Every pathway evaluates without throwing, with a percentage between 0 and 100.

## Degree-level planning

- The joint cost of a pair that shares courses must be strictly less than the sum of the two separate costs. If those are ever equal for a sharing pair, the panel is selling a saving that is not there.
- `alreadyComplete` and `reachable` must never be conflated: a route existing is not the same as being finished. Assert they differ for a plan mid-flight.
- The header's term count and the verdict's term count are computed from the same data a few pixels apart and must agree. A term that is full is *known*, not unknown.
- Seats are counted net of courses already placed. A test must show a term with capacity 3 and two courses placed offering one seat, not three.

## What verified means

1. The relevant suite passes locally and the actual output is pasted, not summarized.
2. New behavior has a test that fails without the change. If you did not watch it fail first, you have not verified it.
3. Lint and format run clean on any Python touched.
4. For extraction or catalog changes, a human has read the resulting data diff.

Item 4 carries the most weight. Passing tests establish that the parser did what the parser was written to do. Only reading the diff establishes that the requirement was transcribed correctly from the PDF. The failure mode this project has to avoid is not a crash, it is a confidently wrong requirement that a student plans two years of coursework around.
