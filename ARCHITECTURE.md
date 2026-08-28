# ARCHITECTURE.md

Purpose: living map of Fuqua ConCert. Components, responsibilities, data flow, boundaries, and external dependencies.

Last updated: 2026-08-27

## Status

Greenfield. Nothing below is built. This describes intended design and will change once extraction meets the real PDFs. Update it in POSTFLIGHT whenever structure changes.

Superseded design note: ADR-0003 originally specified Python and FastAPI. ADR-0008 replaced that with a static-first split. Do not follow ADR-0003.

## What the system does

**Fuqua ConCert** is a planner for the Duke Fuqua full-time MBA. A student enters the courses they have taken and plan to take across the eight quarters of the program. The tool evaluates that course list against all 18 concentration and certificate pathways at once and renders the result as an RPG-style skill map: branches per pathway, nodes per requirement group, filling in as courses satisfy them.

A student may earn at most two academic specialties in any combination of concentrations and certificates (ADR-0017). The tool tracks progress on all 18 regardless, and warns when the declared set exceeds two rather than blocking exploration.

A course counts toward every pathway it appears on, simultaneously (ADR-0018). There is no allocation problem to solve.

## High-level shape

```
Source_docs/*.pdf          read-only input, outside the repo, 16 files
        |
        |  [1] extraction  (Python, offline, developer-only, run on demand)
        v
data/catalog/*.json        18 pathway records, committed, human-reviewed
data/layout/*.json         hand-authored SVG node coordinates per pathway
        |
        |  loaded by the browser at page load, static fetch
        v
   [2] rules        pure ES modules, no DOM, no I/O
        |
        v
   [3] ui           DOM and SVG: quarter grid, skill map, confirm screen
        |
        v
   [4] storage      localStorage, plus JSON export and import
```

There is no server. The shipped artifact is a static site.

## Components

**[1] extraction** (Python, `tools/extraction/`)
Turns the source PDFs into pathway records. Runs on Pat's machine only, never in the browser, never at request time. Owns PDF text extraction via pdfplumber (ADR-0009), section splitting, course code and credit parsing, and mapping 16 documents onto 18 pathways (ADR-0020). Output is reviewed by a human before commit (ADR-0004). Does not own rule evaluation.

**[2] rules** (JavaScript, `app/rules/`)
Pure ES modules. No DOM access, no fetch, no localStorage. Given a course list and a pathway record, returns satisfied groups, remaining requirements, credits counted, and status. Evaluation runs 18 independent passes, one per pathway, with no shared state between them. Also owns the specialty cap check, which is a slot count rather than a category rule (ADR-0017). This is the layer that gets the heaviest test coverage, and it is importable by `node --test` without a browser.

**[3] ui** (JavaScript, `app/ui/`)
Owns the quarter grid where courses are placed across eight quarters, the skill map rendered as SVG from hand-authored layout coordinates (ADR-0010), and the confirmation screen that every input path routes through before anything is saved (ADR-0012). Contains no requirement logic. If the UI needs to know whether something is satisfied, it calls `rules`.

**[4] storage** (JavaScript, `app/storage/`)
localStorage as the working store, with explicit export and import of a versioned plan JSON (ADR-0011). Owns the plan schema and its version field. The export file is both the backup and the sharing format.

## Data flow

1. Pat runs extraction against `../Source_docs/`, reviews the diff, commits `data/catalog/`.
2. A user opens the site. The browser fetches catalog and layout JSON.
3. The user enters courses by catalog search or by pasting transcript text. Both land in the confirmation screen. Nothing is saved until confirmed.
4. On every plan change, `rules` re-evaluates all 18 pathways and `ui` re-renders the map.
5. `storage` writes the plan to localStorage. The user can export it to a file at any time.

## Boundaries

- `Source_docs/` is read-only. Extraction reads it. Nothing writes to it.
- `rules` never imports from `ui` or `storage`. The dependency direction is one way and is not negotiable.
- No requirement logic in `ui`. No DOM in `rules`.
- Catalog and layout data are committed and reviewable as text. Plan data is the user's and never leaves their browser unless they export it.
- Python and JavaScript never call each other at runtime. The only interface between them is committed JSON.

## External dependencies

- Extraction: Python 3.13 with pdfplumber. Pat's machine only.
- Application: none. No framework, no bundler, no build step, no CDN. Fonts are vendored into the repo so the app works offline.
- Tests: `node --test` from Node 22, standard library only. pytest for extraction.

## Deployment

GitHub Pages from the main branch root of `pc296/FuquaConAndCert` (ADR-0015). `index.html` at the repo root, modules under `app/`, data under `data/`. Publishing is a push. There is no build and no deploy step to break.

## Design language

Duke brand. Primary colors Duke Navy Blue `#012169` and Duke Royal Blue `#00539B`; the brand guide requires at least one primary blue in any project and prohibits altering their opacity or saturation. Secondary accents from the Duke palette carry state and category coding on the map: Persimmon `#E89923`, Eno `#339898`, Copper `#C84E00`. Neutrals Hatteras `#E2E6ED` and Whisper Gray `#F3F2F1`. Typography is the Duke pairing Merriweather for headings with Open Sans for body, both vendored locally rather than loaded from the Google CDN.

Unverified: this is the Duke University brand guide. Fuqua may maintain a school-level variant that differs. Not checked.

## Known risks

- Requirement text is irregular across the 18 pathways. Expect per-pathway quirks rather than one clean grammar. Known cases: the Energy Finance overflow clause, the Entrepreneurship rule that a practicum must match the discipline, the Social Entrepreneurship 6-credit cap on non-Fuqua courses, and the Finance Certificate GPA threshold.
- The Finance Certificate requires a 3.75 GPA across 10 courses and has an intermediate qualifying state. It cannot be evaluated from course selections alone, which is why grades are in the schema from stage 1 (ADR-0013).
- Double-counting behavior comes from Pat, not from a source document (ADR-0018). If advising contradicts it, the change is contained to the evaluation function.
- Duke branding on a tool that is not a registrar product invites students to treat its output as authoritative. The UI carries a visible line stating it is an unofficial planning aid and that the registrar is the authority. This is a requirement, not a nicety, and it ships in the first prototype.
