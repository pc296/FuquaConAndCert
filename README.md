# Fuqua ConCert

A course planner for the Duke Fuqua Daytime MBA. Enter the courses you have taken and plan to take across the eight quarters of the program, and see which concentrations and certificates they apply to, laid out as a Pathway Map.

**Unofficial.** This is a planning aid, not a degree audit. The Fuqua registrar is the authority on what you have earned. Requirements are transcribed from FuquaWorld pages retrieved in August 2026 and may be out of date.

The repository is `FuquaConAndCert`; the tool is called Fuqua ConCert. The names differ for historical reasons.

## Where it lives

Published at **https://pc296.github.io/FuquaConAndCert/**. There is no build step and no workflow, so every push publishes.

## Running it

The app is a static site with no build step, but browsers block ES modules over `file://`, so it needs an HTTP origin:

```
npm run serve      # or: node tools/serve.js
```

Then open http://localhost:8080. Published to GitHub Pages, no server step is needed.

## What it does

- Tracks progress on all 18 pathways at once: 16 concentrations and 2 certificates.
- A course counts toward every pathway it appears on. Inside a single pathway, each course is allocated to one group, because several pathways have deliberately overlapping group lists.
- Warns when a declared set would exceed the two-specialty limit. Dual Finance counts as two and fills the allowance alone.
- Knows the 15 Daytime MBA core courses, so imported transcripts parse cleanly. Core courses count toward no concentration; only the HSM certificate requires them.
- Handles the conditional rules in the source documents: the Energy Finance overflow clause, the Leadership and Ethics outside-Management minimum, the Social Entrepreneurship practicum and non-Fuqua credit limits, the Operations practicum credit adjustment, repeatable and variable-credit courses, and the Finance Certificate GPA threshold.
- Import transcript reads the term headings in the file, so courses land in the term they were taken and coursework from before the program goes to the Pre-Fuqua bucket. Duke records semesters rather than Fuqua's 6-week terms, so Fall 1 versus Fall 2 is yours to set on each row before adding.
- Import transcript takes either a transcript PDF or a Fuqua ConCert backup file and works out which it was given. Transcripts route through a confirmation screen, so nothing enters your plan unreviewed. Scanned PDFs are refused with an explanation rather than silently returning nothing; paste the text instead.
- Your plan is stored in this browser only. Report prints a progress summary; Backup writes a JSON file for restoring the plan later.

## Layout

```
index.html            entry point, served from the repo root
app/rules/            pure ES modules: evaluation, allocation, the specialty cap
app/ui/               DOM and SVG, no requirement logic
app/storage/          localStorage plus export and import
data/catalog/         18 pathways, 163 courses (15 core), aliases, reviewed data
data/layout/          hand-authored Pathway Map coordinates
tools/extraction/     Python, developer-only, reads ../Source_docs
tests/rules/          node --test
tests/extraction/     pytest
app/fonts/            vendored Merriweather and Open Sans, SIL OFL
app/vendor/pdfjs/     vendored pdf.js, Apache 2.0, loaded on demand only
tests/ui/             node --test, asset and structural integrity
```

## Tests

```
npm test              # rule engine, node --test
npm run test:extraction   # parser golden-file tests, pytest
npm run verify        # cross-check the catalog against the source documents
```

## For contributors

Read `GOVERNANCE.md` first. It indexes every governing file and states the working rule: read `PREFLIGHT.md` before any task, complete `POSTFLIGHT.md` before calling anything done.

ADR-0003, ADR-0014, and ADR-0017 in `DECISIONS.md` are superseded. Do not follow them.

## Known gaps

- Prerequisites and which years a course is offered are mentioned throughout the sources and listed reliably in none of them.

- Whether two certificates is an allowed combination is contradicted by Fuqua's own page; the app follows Pat's rule, one certificate maximum (ADR-0025).
- Scanned transcript PDFs cannot be read. OCR is deliberately out of scope (ADR-0033).
- Stages 2 to 4 are unbuilt: grades beyond the Finance Certificate, MEM and dual-degree coursework, and user-added substitutions (ADR-0013).
