# CHANGELOG.md

Purpose: human-readable, reverse-chronological record of every meaningful change to Fuqua ConCert. Keep a Changelog style. Updated in POSTFLIGHT for any code change.

Last updated: 2026-08-27

Categories: Added, Changed, Fixed, Removed. Newest at the top. Entries describe the change and its effect, not the files touched.

## [Unreleased]

### Changed

- 2026-08-27: Architecture moved from a local Python and FastAPI server to a static site with the rule engine in JavaScript, so the tool can be shared as a URL rather than as a repository someone has to install. Python is retained for offline PDF extraction. ADR-0008 supersedes ADR-0003.
- 2026-08-27: Course double-counting resolved as always allowed. A course counts toward every pathway it appears on, simultaneously. This removes the allocation solver from the design. ADR-0018 supersedes ADR-0014.
- 2026-08-27: The specialty cap corrected to two specialties in any combination, including two certificates, per the official Fuqua program page. The earlier reading came from a passing mention inside a single concentration document. ADR-0017.
- 2026-08-27: Tool named Fuqua ConCert. ADR-0016.

### Added

- 2026-08-27: Governance layer at the repo root. GOVERNANCE.md, PREFLIGHT.md, POSTFLIGHT.md, ARCHITECTURE.md, CONVENTIONS.md, DECISIONS.md, TESTING.md, LESSONS.md, and this file. No application code yet.
- 2026-08-27: ADR-0001 through ADR-0020 recorded. All open ADRs resolved; none remain in proposed status.

### Removed

- 2026-08-27: MSTeM second majors dropped from scope. ADR-0019.
