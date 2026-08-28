# CONVENTIONS.md

Purpose: single source of truth for how code in Fuqua ConCert is written.

Last updated: 2026-08-28

The stack is split by lifecycle per ADR-0008: Python for offline extraction, JavaScript for the shipped application. Rules below are grouped accordingly.

## Application: JavaScript

- ES modules, native. No framework, no bundler, no transpiler, no build step, no CDN.
- Target is current Chrome, Edge, Firefox, and Safari. No polyfills, no legacy syntax support.
- `const` by default. `let` only when reassignment is real. Never `var`.
- No dependencies without an ADR. The bar is high, since every dependency has to be vendored into the repo by hand. Anything over a few hundred KB is loaded through a dynamic `import()` so it does not land on every page load; pdf.js is the precedent (ADR-0033).
- JSDoc type annotations on exported functions in `app/rules/`. The rule engine is where a wrong type produces a wrong graduation plan, so it is worth the annotation cost. Elsewhere JSDoc is optional.
- Formatting: 2-space indent, semicolons, single quotes, 100-column lines. Enforced by reading, not tooling, unless a formatter is added by ADR.

## Extraction: Python

- Python 3.13. Confirmed installed on Pat's machine.
- `ruff format` and `ruff check` run clean. Line length 100.
- Type hints on every function signature. `mypy` strict on `tools/extraction/`.
- Dependencies in `pyproject.toml`. Currently pdfplumber and pytest.

## Naming

- JavaScript: `camelCase` for functions and variables, `PascalCase` for classes, `UPPER_SNAKE` for constants. Python: `snake_case`, `PascalCase`, `UPPER_SNAKE`.
- Domain terms match the source documents and do not get synonyms. `concentration`, `certificate`, `pathway`, `requirementGroup`, `elective`, `credit`, `slot`.
- **Pathway** is the umbrella term for a concentration or a certificate. Use it when the code does not care which. Use `concentration` or `certificate` only when the distinction is real, because it usually is not: the cap counts slots, not categories (ADR-0017).
- Course codes are stored exactly as they appear in the source, for example `FINANCE 646`, with a normalized form alongside for matching. Never overwrite the original string.
- Booleans read as assertions: `isSatisfied`, `hasPrerequisite`. Not `satisfiedFlag`.
- The product name is **Fuqua ConCert** and its capitalization is fixed (ADR-0016). Never lowercase it, never hyphenate it. In identifiers use `fuquaConcert` or `fuqua_concert`, since identifiers cannot carry the branding anyway.

## Layout

```
Work_folder/                        repo root, GitHub Pages source
  GOVERNANCE.md ... CHANGELOG.md    governance
  index.html                        the app entry point
  app/
    rules/        pure ES modules, no DOM, no I/O
    ui/           DOM and SVG
    storage/      localStorage, export and import
    styles/       CSS
    fonts/        vendored Merriweather and Open Sans
    vendor/       vendored third-party builds, currently pdf.js (ADR-0033)
  data/
    catalog/      18 pathway records, courses, core list and aliases; human-reviewed
    layout/       hand-authored SVG coordinates per pathway
  tools/
    extraction/   Python, developer-only
  tests/
    rules/        node --test
    ui/           node --test, asset and structural integrity
    extraction/   pytest
    fixtures/     text excerpts, never live PDFs
```

## Error handling

- Fail loudly at boundaries, not silently in the middle. Extraction that cannot parse a section raises with the file name and the offending text, and does not emit a partial record.
- No bare `except:` in Python. No empty `catch` in JavaScript.
- `rules` functions throw on invalid input rather than returning null. Null means absent, never failed.
- Unknown or unparseable requirement data surfaces to the user as unknown. It is never silently treated as satisfied or unsatisfied. A student making enrollment decisions on a false green node is the worst outcome this tool can produce.
- A failed localStorage read never loses the user's plan. Catch, warn, and offer import rather than starting from empty.

## Commits

Conventional Commits: `type(scope): subject`.

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `data`.
- Scopes match components: `rules`, `ui`, `storage`, `extraction`, `catalog`, `layout`, `governance`.
- Subject in imperative mood, under 72 characters, no trailing period.
- Example: `feat(rules): evaluate choose-n-of-m requirement groups`

## Always

- Preflight before work, postflight after.
- New logic ships with tests.
- Record the source filename and section on every extracted pathway record.
- Keep rule logic in `app/rules/`, where it runs under `node --test` without a browser.
- Ship the "unofficial planning aid, the registrar is the authority" notice in every visible build.
- Ask when a requirement document is ambiguous.

## Never

- Never write to `Source_docs/`.
- Never put requirement logic in `app/ui/` or in extraction.
- Never add a runtime dependency or a build step without an ADR.
- Never hand-edit `data/catalog/` without stating the correction and its reason in the commit body. The catalog is reviewed data, and an unexplained edit is indistinguishable from a mistake.
- Never infer a requirement the source document does not state.
- Never treat a shared course number as evidence that two courses are the same. This catalog has unrelated courses sharing a number and a whole family, the 895 practicums, that the sources call distinct on purpose (ADR-0037).
- Never commit a plan file, an export, or anything else derived from a real transcript.
- Never mark a task done with a failing postflight gate.
- Never verify a UI change against a hand-picked subset of staged files. Stage everything the browser loads, or a screenshot may be showing older code than the tests (LESSONS 2026-08-28).
