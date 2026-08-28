# CHANGELOG.md

Purpose: human-readable, reverse-chronological record of every meaningful change to Fuqua ConCert. Keep a Changelog style. Updated in POSTFLIGHT for any code change.

Last updated: 2026-08-28

Categories: Added, Changed, Fixed, Removed. Newest at the top. Entries describe the change and its effect, not the files touched.

## [Unreleased]

Nothing yet.

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
