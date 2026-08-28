# CHANGELOG.md

Purpose: human-readable, reverse-chronological record of every meaningful change to Fuqua ConCert. Keep a Changelog style. Updated in POSTFLIGHT for any code change.

Last updated: 2026-08-28

Categories: Added, Changed, Fixed, Removed. Newest at the top. Entries describe the change and its effect, not the files touched.

## [Unreleased]

Nothing yet.

## [0.4.0] - 2026-08-28

The degree-level planner: what a combination of specialties costs together, and whether it fits. Tagged `v0.4.0`.

### Added

- 2026-08-28: **Degree Plan.** A panel spanning the page that answers what a whole combination costs rather than one pathway at a time. Pick one or two specialties and it reports the joint cost, what the same pair would cost pursued separately, how many courses count toward both, whether it fits in the seats you have left, and the route to finish, with one-click adds that land in the next term with room. Up to three combinations side by side. Management and DEI cost seven courses together against twelve apart; that number was not obtainable anywhere in the app before. ADR-0038.
- 2026-08-28: A "you are in" control beside the program start year, seeded from today's date, and elective capacity per term with a one-click prefill of Fuqua's typical load. A term left blank counts as zero seats and is named as uncounted, so a verdict is never confident about data nobody supplied. ADR-0039.

- 2026-08-28: Summer and Winter terms. Each year now runs Summer, Fall 1, Fall 2, Winter, Spring 1, Spring 2, so the August orientation block has somewhere to sit instead of landing in Fall 1. Optional terms render only when they hold a course. ADR-0035.
- 2026-08-28: A program start year stored with the plan. It drives the calendar labels, so terms read "Fall 2026" rather than "Year 1 Fall", and it anchors the transcript mapping. Inferred from the earliest term in the Fuqua record on import, and overridable.
- 2026-08-28: Cross-listing aliases as reviewed catalog data in `data/catalog/aliases.json`, with a standing `verify.py` check that flags any course number appearing under two subject prefixes with matching titles. ENERGY 635 and ENERGY 711 now match the ENVIRON spellings Duke's registrar uses, and ENVIRON 520 folded into ENERGY 520 so one course counts toward both Energy & Environment and Social Entrepreneurship. ADR-0037.
- 2026-08-28: The confirmation screen carries a placement dropdown on every row, so an imported transcript is sorted in one pass before anything is saved.

### Changed

- 2026-08-28: Plan format 2. Entries store a term id such as `y1-fall-2` instead of an integer quarter. Backups written through v0.3.0 still import; a test asserts placements and grades survive the migration. ADR-0035.

### Fixed

- 2026-08-28: `currentTermFrom` returned a Fall term for every month from January to June, because its season test checked `month <= 10` before it ever reached Spring. It seeds the current-term control, which drives the remaining capacity and therefore the fit verdict, so a wrong month was a wrong answer to "does this fit". Now a case per month, with the two 6-week boundaries that fall mid-month handled as mid-month.
- 2026-08-28: The Add buttons in the pathway detail panel stopped working when terms became string ids. Add in a requirement group's option list threw and did nothing; Add on a shortest-way step silently placed the course in the Pre-Fuqua bucket. Every Add now routes through one placement helper, `addCourse` refuses a term id it does not recognise instead of guessing, and three tests guard the class of defect.
- 2026-08-28: Transcript import put every course in Year 1 Fall 1. The parser matched course codes and discarded the term headings around them, and the confirmation screen then added everything with the term hardcoded. Courses now land in the term their heading names, and coursework from before the program goes to the Pre-Fuqua bucket. Duke records semesters rather than Fuqua's 6-week terms, so Fall 1 versus Fall 2 remains the student's call, made explicit rather than guessed. ADR-0036.
- 2026-08-28: Suggestions for unmatched codes proposed any course sharing the number, which offered HLTHMGMT 710 Health Institutions as a match for ENVIRON 710 Applied Statistical Modeling. A suggestion now requires the observed title to agree, and a code with no title beside it gets none.
- 2026-08-28: TESTING.md required a test asserting that two certificates is valid, citing the superseded ADR-0017, while the code and its test correctly reject it. The specification contradicted both the implementation and its own suite.
- 2026-08-28: Stale course counts in README.md and ARCHITECTURE.md, and ARCHITECTURE.md stating the superseded any-combination cap rule.

## [0.3.0] - 2026-08-28

Readable plan chips, institutional design language, transcript PDF import. Tagged `v0.3.0`.

### Added

- 2026-08-28: Transcript PDF import. Upload the PDF and its text layer is read in the browser and routed through the existing confirmation screen. pdf.js is vendored and loaded only when a PDF is actually selected, so its 1.7 MB never lands on an ordinary page load. Scanned PDFs are refused with an explanation rather than returning an empty result. ADR-0033.
- 2026-08-28: `tests/ui/` asserts structural integrity that fails silently in a browser: balanced stylesheet braces, closed `@font-face` blocks pointing at files that exist, the vendored pdf.js build present, and pdf.js kept behind a dynamic import.

### Changed

- 2026-08-28: Institutional design language replacing the card-and-shadow treatment. Flat surfaces, no shadows anywhere, near-square corners, hairline rules and whitespace for structure, Merriweather carrying headings and data, tabular figures so numbers align, and one meaning per accent color. ADR-0032.
- 2026-08-28: "Skill Map" renamed "Pathway Map" throughout the interface and living documents, aligning it with `pathway`, the domain term in CONVENTIONS.md.
- 2026-08-28: The import controls are now a labelled pair, PDF upload alongside paste, rather than a bare paste box.

### Fixed

- 2026-08-28: Transcript import was unreachable in practice. The prominent button labelled "Import" restored a JSON backup while PDF import sat in a collapsed section below it, so anyone looking to import a transcript hit the wrong picker. There is now one control, "Import transcript", accepting both a transcript PDF and a backup file and dispatching on which it receives. ADR-0034.
- 2026-08-28: Course names were invisible in the plan column. Code, title, two selects and a delete control on one line left the title 0 to 2 pixels wide, and the semester band overflowed its box by 12 pixels. Chips are now two rows: the record on the first line, controls on the second. Titles get roughly 200 pixels and wrap instead of vanishing.

## [0.2.0] - 2026-08-28

Placement, alternatives, report, aesthetics. Tagged `v0.2.0`.

### Added

- 2026-08-28: FUQINTRD 692, Leading Business in a Complex World, confirmed by Pat as the 15th core course, closing the 13-versus-14 count question: 15 total, 14 in first year.
- 2026-08-28: Pre-Fuqua Dual Degree Coursework bucket. Catalog courses only; they count toward concentrations exactly like any other course. ADR-0030.
- 2026-08-28: Non-Fuqua courses place by semester and render as a band spanning both Fuqua terms, snapped automatically from any term choice. ADR-0030.
- 2026-08-28: Every requirement group expands to its full option list with counting / in plan / available status and one-click adds; every shortest-way step lists the courses that fill the same slot equally well, verified equivalent by the evaluator itself.
- 2026-08-28: Printable progress report from the Report button, via a print-styled window; the JSON export is renamed Backup. ADR-0031.

### Changed

- 2026-08-28: Aesthetic pass. Base text to 16px, wordmark enlarged 25 percent, Duke-royal underlined section headers, larger map labels with a glow on completed nodes, hover and keyboard-focus states, and stronger detail-panel hierarchy.
- 2026-08-28: Source identifiers removed from the pathway detail panels, per Pat. The masthead notice and retrieval date remain.
- 2026-08-28: The allocator prefers direct group eligibility over overflow on ties, so partial states read the way the source documents do.

## [0.1.0] - 2026-08-28

First working version. Governance, catalog, rule engine, recommender, and interface. Tagged `v0.1.0`.

### Added

- 2026-08-28: The 14 Daytime MBA core courses, assembled from Fuqua's exemption, curriculum and program format pages and the Duke bulletin, and confirmed by Pat. Pasted transcripts now parse core courses instead of reporting them as unrecognized. Core courses count toward no concentration and carry no credits by design. The HSM certificate's "complete the core" requirement is now checked.
- 2026-08-28: Recommendations. Each pathway shows the shortest remaining route to finishing it, with one-click adds and a note when a course also counts toward something else you have declared. A ranking panel orders all 18 by how few courses each still needs.
- 2026-08-28: Merriweather and Open Sans vendored as Latin-subset woff2 files, so the app renders in the Duke pairing offline with no third-party request. 176 KB, SIL Open Font License.
- 2026-08-28: `.nojekyll` so GitHub Pages serves the tree as-is.
- 2026-08-28: Catalog verification pass over all 18 pathways against the 16 source documents. Requirement structures confirmed correct; the audit's findings were in the tooling, not the data. `tools/extraction/verify.py` now runs as a standing check via `npm run verify`.
- 2026-08-28: Course aliases, so cross-listings and source spelling variants resolve to one course: PUBPOL 559S also matches LAW 585, and MARKETING 807, MANAGEMENT 754, ENERGY 590-05, and ACCT 597 resolve to their canonical codes.
- 2026-08-28: The Finance Certificate's intermediate qualification is now evaluated and shown. It was recorded in the catalog and read by nothing.
- 2026-08-28: pytest golden-file tests for the extraction parser, built from a fixture of real source lines.
- 2026-08-28: Extraction tooling. `tools/extraction/extract.py` reads the 16 source PDFs with pdfplumber and emits a draft course list plus per-document text; `build_courses.py` turns the draft and the pathway catalog into `data/catalog/courses.json`. 139 courses parsed, 36 title conflicts reported for review.
- 2026-08-28: Requirement catalog for all 18 pathways, hand-authored from the source text and reviewed against it. 149 course records.
- 2026-08-28: Rule engine. Per-pathway evaluation, within-pathway allocation, group and pathway constraints, GPA handling for the Finance Certificate, and the specialty cap check. 30 tests, all passing.
- 2026-08-28: Interface. Eight-quarter planner, paste-with-confirmation course entry, the skill map as an SVG constellation of 18 pathway nodes with progress rings, and a per-pathway detail panel showing what each one still needs.
- 2026-08-28: Plan storage in localStorage with export and import of a versioned JSON file.
- 2026-08-28: `tools/serve.js` for local use, since browsers block ES modules over `file://`.

### Fixed

- 2026-08-28: Constraint results now carry partial progress rather than only a verdict. Without it the recommender could not see that adding one of fourteen core courses was progress, and the HSM certificate was unreachable for a second time.
- 2026-08-28: The HSM certificate could not be completed by any sequence of courses. Group constraints were evaluated against allocated courses, and allocation stops at a group's minimum, so a qualifying course could sit unassigned while its constraint reported failure. Minimum constraints now count what the student holds; maximum constraints count what a valid selection would be forced to use. A group with a failing constraint no longer displays as satisfied.
- 2026-08-28: Extraction dropped cross-listed course lines entirely. `PUBPOL 559S/LAW 585 — Philanthropy...` parsed as prose because a slash followed the course number. Alternate codes are now captured and reported.
- 2026-08-28: `npm test` invoked `node --test tests/rules`, which this Node build treats as a module path rather than a directory and fails on. Now passes the glob.
- 2026-08-28: Extraction dropped any course whose title ended in a word ending in "a", because the prose filter used a character-suffix test. GLHLTH 671 was the casualty.
- 2026-08-28: The page failed silently on load because `init()` ran before the helper it calls was initialized. Startup errors are now reported to the user rather than only to the console.

### Changed

- 2026-08-28: Certificates capped at one rather than two, per Pat. The Fuqua program page says otherwise and the disagreement is recorded in the catalog beside both citations. ADR-0021 supersedes ADR-0017.
- 2026-08-27: Architecture moved from a local Python and FastAPI server to a static site with the rule engine in JavaScript, so the tool can be shared as a URL rather than as a repository someone has to install. Python is retained for offline PDF extraction. ADR-0008 supersedes ADR-0003.
- 2026-08-27: Course double-counting resolved as always allowed. A course counts toward every pathway it appears on, simultaneously. This removes the allocation solver from the design. ADR-0018 supersedes ADR-0014.
- 2026-08-27: The specialty cap corrected to two specialties in any combination, including two certificates, per the official Fuqua program page. The earlier reading came from a passing mention inside a single concentration document. ADR-0017.
- 2026-08-27: Tool named Fuqua ConCert. ADR-0016.

### Added

- 2026-08-27: Governance layer at the repo root. GOVERNANCE.md, PREFLIGHT.md, POSTFLIGHT.md, ARCHITECTURE.md, CONVENTIONS.md, DECISIONS.md, TESTING.md, LESSONS.md, and this file. No application code yet.
- 2026-08-27: ADR-0001 through ADR-0020 recorded. All open ADRs resolved; none remain in proposed status.

### Removed

- 2026-08-27: MSTeM second majors dropped from scope. ADR-0019.
