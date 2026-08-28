# Fuqua ConCert

A course planner for the Duke Fuqua Daytime MBA. Enter the courses you have taken and plan to take across the eight quarters of the program, and see which concentrations and certificates they apply to, laid out as a skill map.

**Unofficial.** This is a planning aid, not a degree audit. The Fuqua registrar is the authority on what you have earned. Requirements are transcribed from FuquaWorld pages retrieved in August 2026 and may be out of date.

The repository is `FuquaConAndCert`; the tool is called Fuqua ConCert. The names differ for historical reasons.

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
- Handles the conditional rules in the source documents: the Energy Finance overflow clause, the Leadership and Ethics outside-Management minimum, the Social Entrepreneurship practicum and non-Fuqua credit limits, the Operations practicum credit adjustment, repeatable and variable-credit courses, and the Finance Certificate GPA threshold.
- Your plan is stored in this browser only. Export writes a JSON file, which is the backup and the sharing format.

## Layout

```
index.html            entry point, served from the repo root
app/rules/            pure ES modules: evaluation, allocation, the specialty cap
app/ui/               DOM and SVG, no requirement logic
app/storage/          localStorage plus export and import
data/catalog/         18 pathways, 149 courses, reviewed data
data/layout/          hand-authored skill map coordinates
tools/extraction/     Python, developer-only, reads ../Source_docs
tests/rules/          node --test
```

## Tests

```
npm test              # node --test tests/rules/*.test.js
```

## For contributors

Read `GOVERNANCE.md` first. It indexes every governing file and states the working rule: read `PREFLIGHT.md` before any task, complete `POSTFLIGHT.md` before calling anything done.

ADR-0003, ADR-0014, and ADR-0017 in `DECISIONS.md` are superseded. Do not follow them.

## Known gaps

- Merriweather and Open Sans are declared but not vendored, so most machines render the Georgia and system-sans fallbacks (ADR-0024).
- Whether two certificates is an allowed combination is unresolved; the app follows the stricter reading (ADR-0021).
- Stages 2 to 4 are unbuilt: grades beyond the Finance Certificate, MEM and dual-degree coursework, and user-added substitutions (ADR-0013).
