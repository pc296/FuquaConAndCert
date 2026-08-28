# DECISIONS.md

Purpose: append-only Architecture Decision Record log. Past entries are never edited. Supersede them with a new entry.

Last updated: 2026-08-27

Entry format: ID, date, status (proposed / accepted / superseded), context, decision, alternatives considered, consequences.

---

## ADR-0001: Repo root at Work_folder

Date: 2026-08-27
Status: accepted

**Context.** The connected folder holds `master_prompt.docx`, `Source_docs/` with 16 requirement PDFs, and an empty `Work_folder/`. The repo needed a root.

**Decision.** Repo root is `Concentrations_and_Certificates/Work_folder`. `Source_docs/` stays outside the repo as read-only input.

**Alternatives.** Root at the connected folder level, which would put the source PDFs and the prompt document inside version control. A new sibling folder, which adds a level for no gain.

**Consequences.** Source documents are not versioned with the code, so their retrieval dates must be recorded in the extracted data instead. Paths from the repo to sources are relative and go up one level.

---

## ADR-0002: Governance files at repo root, not /docs

Date: 2026-08-27
Status: accepted

**Context.** master_prompt allowed either location.

**Decision.** Governance files sit at the repo root.

**Alternatives.** A `/docs` folder, which is tidier once the repo has many files.

**Consequences.** The repo root has nine markdown files in it, which is visually noisy. Accepted because GOVERNANCE.md and PREFLIGHT.md are read at the start of every session and being unavoidable is the point. Revisit if the root becomes hard to scan.

---

## ADR-0003: Python and FastAPI with a plain frontend

Date: 2026-08-27
Status: accepted

**Context.** The work splits into PDF parsing, rule evaluation, and a visual map. Pat selected this stack.

**Decision.** Python 3.11 or later with FastAPI on the backend. Frontend is vanilla HTML, CSS, and ES modules with no framework and no build step.

**Alternatives.** Node with React and Vite. A split stack with Python extraction and a React frontend. Both add a second toolchain to maintain for a single-user local app.

**Consequences.** PDF and rule work stays in the language with the better libraries for it. The skill map has to be built with the DOM, SVG, or canvas directly, which is more work than a chart library would be. No build step means no dependency install for the frontend and the app runs offline.

**Unverified.** Whether Python 3.11+ is installed on the Windows machine where Pat will run this has not been checked. The Linux sandbox reachable from the assistant session has Python 3.10, which is a different machine and does not settle the question.

---

## ADR-0004: Catalog is reviewed data, not live parser output

Date: 2026-08-27
Status: accepted

**Context.** The source documents contain conditional rules, footnotes, and substitution clauses. A parser that runs at request time would turn every parse defect into a wrong answer in the UI.

**Decision.** Extraction is an offline developer tool. Its output is written to `data/catalog/`, reviewed by a human, and committed. The running app reads the committed catalog and never parses PDFs.

**Alternatives.** Parse on startup, which is simpler and always current but unreviewable. Hand-write the catalog with no extraction, which is accurate but tedious across 16 documents and hard to refresh.

**Consequences.** Refreshing requirements is a deliberate step with a reviewable diff. The catalog can drift from the live Fuqua pages, so the app must display the retrieval date of its data. Extraction quality problems surface at review time rather than at user time.

---

## ADR-0005: PDF extraction library

Date: 2026-08-27
Status: proposed

**Context.** The documents are text-based web page prints with indentation that carries meaning. `pdftotext -layout` reads them cleanly in a first look. pdfplumber gives programmatic access to layout position, which may matter for grouping courses under section headers.

**Decision.** Not made. Candidates are pdfplumber, pypdf, and shelling out to `pdftotext -layout`.

**Alternatives.** As above.

**Consequences.** Blocks the first extraction work. Resolve by trying the leading candidate against two structurally different documents, for example Energy Finance and Health Sector Management, before committing.

---

## ADR-0006: Skill map rendering approach

Date: 2026-08-27
Status: proposed

**Context.** The requested interface is an RPG-style skill tree across 16 concentrations and certificates, several with overlapping courses. Layout is the hard part, not drawing.

**Decision.** Not made. Options are hand-authored SVG with a fixed layout per concentration, computed layout from the requirement graph, or canvas.

**Alternatives.** As above. A no-build-step frontend rules out most graph layout libraries unless a single file is vendored into the repo, which would need its own ADR.

**Consequences.** Blocks frontend work beyond the quarter grid. Worth prototyping one concentration before deciding, since a fixed hand-authored layout may look better and cost less than a generic graph layout.

---

## ADR-0007: Plan storage in SQLite

Date: 2026-08-27
Status: proposed

**Context.** The app needs to persist one user's course plan across sessions. Data volume is trivial, roughly 20 to 25 courses.

**Decision.** Not made. SQLite via the standard library is the leading option. A single JSON file is the simpler alternative and may be enough.

**Alternatives.** As above.

**Consequences.** Low stakes either way. Decide before the first persistence code. JSON is easier to inspect and back up. SQLite is easier if plan versioning or scenario comparison gets added later.

---

## ADR-0008: Static-first architecture, superseding ADR-0003

Date: 2026-08-27
Status: accepted
Supersedes: ADR-0003

**Context.** ADR-0003 chose Python and FastAPI. Pat then stated the app is for personal use now and to be shared with fellow students later, and delegated the choice. A FastAPI app requires each user to install Python 3.13, create a virtual environment, install dependencies, and run a server. Most students will not complete that. Pivoting later would mean rewriting the rule engine in another language after it is already written and tested.

**Decision.** Split by lifecycle rather than by layer. Python remains the language for extraction, which runs offline on Pat's machine as a developer tool and produces reviewed catalog JSON. The shipped application is a static site: HTML, CSS, and ES modules, with the rule engine in JavaScript. No server, no backend, no build step. Deployed to GitHub Pages from the repo root.

**Alternatives.** Keep FastAPI and share the repo, which limits the audience to students comfortable with a terminal. Host the app, which makes Pat the operator of a service holding other students' academic records. Package a Windows executable, which adds build complexity and antivirus friction.

**Consequences.** Rule logic lives in JavaScript, not in Python, which reverses the boundary ADR-0003 set. ARCHITECTURE.md, CONVENTIONS.md, and TESTING.md are revised accordingly. The Python domain layer described in ADR-0003 is not built. Sharing becomes a URL. No user data reaches any server, which removes the operator responsibility entirely. Extraction cannot be run by anyone who clones the repo, since `Source_docs/` sits outside it per ADR-0001; the committed catalog is what they get.

**Note.** This reverses a stack choice Pat made explicitly. It stands only until Pat says otherwise.

---

## ADR-0009: pdfplumber for extraction, resolving ADR-0005

Date: 2026-08-27
Status: accepted
Resolves: ADR-0005

**Context.** `pdftotext -layout` was tested against Energy Finance and Health Sector Management and produced clean, readable output with indentation preserved. It requires the poppler binary, which is not present on a default Windows install. pdfplumber is pip-installable, cross-platform, needs no external binary, and exposes layout coordinates.

**Decision.** pdfplumber, run from Python on Pat's machine.

**Alternatives.** `pdftotext -layout`, rejected on the Windows dependency. pypdf, rejected because it does not preserve the column layout these documents rely on.

**Consequences.** One Python dependency for the extraction tool. Extraction output is compared against the `pdftotext` output already seen during discovery as an informal cross-check on the first two documents.

---

## ADR-0010: Hand-authored SVG layout for the skill map, resolving ADR-0006

Date: 2026-08-27
Status: accepted
Resolves: ADR-0006

**Context.** The requested interface is an RPG-style talent tree across 16 specialties. A generic graph layout algorithm would need a vendored library, and computed layouts of small graphs tend to look arbitrary. The set of specialties is fixed and changes about once a year.

**Decision.** SVG rendered with plain DOM calls. Node positions per specialty are authored by hand and stored as coordinates in a layout JSON file alongside the catalog. No layout library.

**Alternatives.** A computed force or tree layout, which is less work per specialty and worse looking. Canvas, which complicates accessibility and hit testing for no gain at this scale.

**Consequences.** Adding a specialty means authoring its layout, roughly 20 minutes of work. Layout data is separate from requirement data, so a catalog refresh does not disturb the visual design. SVG nodes are real DOM elements, so keyboard focus and screen reader labels are available.

---

## ADR-0011: localStorage with JSON export and import, resolving ADR-0007

Date: 2026-08-27
Status: accepted
Resolves: ADR-0007

**Context.** ADR-0008 removes the server, which removes server-side storage as an option. Pat delegated the choice. localStorage alone is easy to lose, since clearing browser data wipes the plan with no warning.

**Decision.** localStorage as the working store, with explicit Export Plan and Import Plan buttons that write and read a plain JSON file. The exported file is the backup and the sharing format.

**Alternatives.** localStorage alone, rejected because silent data loss on a multi-year plan is unacceptable. IndexedDB, rejected as more machinery for the same guarantees at this data size.

**Consequences.** The user owns a portable file they can back up, keep in a folder, or send to an advisor. The export schema becomes a compatibility surface and needs a version field from the first release. No academic data leaves the user's browser unless they deliberately export it.

---

## ADR-0012: Manual and paste entry, no OCR and no AI in the input path

Date: 2026-08-27
Status: accepted

**Context.** Pat asked for an input method that needs no API key and no AI functionality. Local OCR via Tesseract.js is the only key-free image route; it reads multi-column transcript tables poorly, and a misread course code is worse than no extraction because it looks correct. Fuqua transcripts and schedules are text-based PDFs, so their text can be selected and copied directly.

**Decision.** Two input paths, both routed through a confirmation screen before anything is saved: search-and-click entry from the catalog, and a paste box that parses pasted transcript or schedule text for course codes. No image upload in v1.

**Alternatives.** Tesseract.js image OCR, rejected on accuracy and on bundle size in a no-build-step app. A vision model API, ruled out by Pat.

**Consequences.** Paste from a PDF gives near-perfect fidelity at a fraction of the complexity of OCR, so the practical loss versus image upload is small. The confirmation screen is built in v1 regardless, so an image path could be added later behind it without rework.

---

## ADR-0013: All four rule complexities in the data model, staged in implementation

Date: 2026-08-27
Status: accepted

**Context.** Pat selected all four: double-counting, grades and GPA, MEM and dual-degree courses, and substitutions with approval. Building all four at once is a large v1 and delays anything usable.

**Decision.** The data model accommodates all four from the start, so none requires a schema migration later. Implementation is staged: stage 1 covers course entry, credit and group evaluation, and the two-specialty cap; stage 2 adds grades and the Finance Certificate GPA rule; stage 3 adds non-Fuqua and MEM courses with the 6-credit cap seen in Social Entrepreneurship; stage 4 adds user-added substitutions marked pending approval.

**Alternatives.** Build all four before shipping anything, rejected because it delays feedback on the map itself, which is the part most likely to need redesign.

**Consequences.** Grade fields exist in the schema from day one but are optional and unused until stage 2. A plan file written in stage 1 remains readable in stage 4.

---

## ADR-0014: Double-counting is a configurable rule pending confirmation

Date: 2026-08-27
Status: accepted

**Context.** None of the 16 source documents states whether one course may count toward two specialties at once. This determines whether the map is 16 independent trees or one graph with contention between branches, which is the difference between an additive display and an allocation problem.

**Decision.** The rule engine takes double-counting as a configuration flag rather than hardcoding either behavior. Default is off, meaning each course is allocated to one specialty, because that is the conservative reading and it will not overstate progress. The UI states which mode is active and that the rule is unconfirmed.

**Alternatives.** Assume double-counting is allowed, rejected because it would show students progress they may not have. Block the feature until confirmed, rejected because it stops all rule work on an unanswered question.

**Consequences.** The allocation solver needed for the off case is the harder of the two, so building it first means the on case is a simplification rather than a rewrite. Confirm the actual rule with Fuqua advising and log the answer as a new ADR.

---

## ADR-0015: Site served from repo root for zero-config GitHub Pages

Date: 2026-08-27
Status: accepted

**Context.** GitHub Pages deploys from a branch root or a `/docs` folder without configuration. Governance files already sit at the repo root per ADR-0002, and naming an application folder `/docs` alongside them would be confusing.

**Decision.** `index.html` at the repo root, application modules under `app/`, catalog data under `data/`. Pages deploys from the main branch root with no workflow file.

**Alternatives.** A GitHub Actions Pages workflow, which allows a cleaner tree at the cost of CI configuration. `/docs` as the site root, rejected on naming.

**Consequences.** The repo root holds nine governance files plus `index.html`. Publishing is a push, with no build and no deploy step to break.

---

## ADR-0016: Tool name is Fuqua ConCert

Date: 2026-08-27
Status: accepted

**Context.** Pat named the tool.

**Decision.** The tool is called **Fuqua ConCert**, with that exact capitalization: capital F, capital C on Con, capital C on Cert, one word with no space inside ConCert. The repo remains `pc296/FuquaConAndCert`.

**Alternatives.** None considered. This is Pat's call.

**Consequences.** The name appears in the page title, the header, the export file metadata, and the README. Do not lowercase or hyphenate it. The repo name and the product name differ, which is worth a line in the README so it does not read as a mistake.

---

## ADR-0017: The cap is two specialties in any combination

Date: 2026-08-27
Status: accepted

**Context.** The initial premise was a maximum of 2 concentrations, or 1 concentration plus 1 certificate. `Finance Concentrations.pdf` states only "Two concentrations are the maximum number of academic specialties one can earn." The official Fuqua page states the allowed combinations directly: "2 concentrations, 2 certificates, 1 concentration + 1 certificate."

**Decision.** The rule is a cap of two academic specialties, in any combination of concentrations and certificates. Two certificates is a valid combination and was missing from the premise this repo started with.

**Alternatives.** Encode the three combinations as an explicit allowlist, rejected because it is the same rule expressed less clearly and would need editing if a third certificate is ever added.

**Consequences.** The cap check is a count, not a category rule. Since only two certificates exist today, "2 certificates" means Finance plus HSM. The Dual Finance Concentration still counts as 2 by itself per `Finance Concentrations.pdf` and consumes the cap alone, so it stays a special case in the data rather than a special case in the code: each specialty record carries how many slots it consumes.

**Source.** https://www.fuqua.duke.edu/programs/daytime-mba/concentrations-certificates retrieved 2026-08-27.

---

## ADR-0018: Courses count toward every pathway they appear on, superseding ADR-0014

Date: 2026-08-27
Status: accepted
Supersedes: ADR-0014

**Context.** ADR-0014 made double-counting a configuration flag defaulting to off, because no source document stated the rule. Pat has since specified the behavior directly.

**Decision.** A course counts toward every instance of its occurrence across every concentration and certificate pathway, simultaneously. No allocation, no contention, no solver.

**Alternatives.** The configurable flag from ADR-0014, now unnecessary. Retained as dead complexity it would be a cost with no benefit.

**Consequences.** The rule engine is substantially simpler than ADR-0014 anticipated. Each pathway is evaluated independently against the full course list, which means evaluation is 18 independent passes and is trivially parallel and trivially testable. The skill map becomes an additive display rather than an allocation problem, so a course node lights up on every branch it belongs to at once, which is closer to the RPG talent tree the tool is meant to resemble. This is Pat's stated rule rather than a rule found in a source document, so if advising contradicts it later, the change is contained to the evaluation function.

---

## ADR-0019: MSTeM second majors are out of scope

Date: 2026-08-27
Status: accepted

**Context.** `Health Sector Management Certificate.pdf` names the MSTeM second major as a third category of academic specialty. Pat has ruled it out.

**Decision.** Fuqua ConCert models concentrations and certificates only. MSTeM is not represented.

**Consequences.** A student pursuing MSTeM will see a cap calculation that does not account for it. If that changes, the specialty record already carries a slot count per ADR-0017, so adding MSTeM is data plus a layout, not a code change.

---

## ADR-0020: 16 source documents yield 18 pathways

Date: 2026-08-27
Status: accepted

**Context.** `Source_docs/` holds 16 PDFs. The Fuqua page names 16 concentrations and 2 certificates. The gap is `Finance Concentrations.pdf`, which contains Finance (Corporate), Finance (Investment), and Dual Finance in a single document.

**Decision.** Extraction maps documents to pathways many-to-one where needed. The catalog is keyed by pathway, not by source file, and each pathway record names the file and page section it came from.

**Consequences.** Extraction cannot assume one file equals one pathway, and the Finance document needs section-aware splitting that the others do not. This is the known case; a second one may surface during extraction and would be handled the same way.

---

## ADR-0021: Certificates are capped at one, superseding ADR-0017

Date: 2026-08-28
Status: accepted
Supersedes: ADR-0017

**Context.** ADR-0017 read the cap as two specialties in any combination, based on the Fuqua program page listing "2 concentrations, 2 certificates, 1 concentration + 1 certificate" under Combinations Allowed. Pat states that two certificates is not allowed. The same page also says "if you plan to work toward a certificate, you may pursue no more than one concentration," which constrains concentrations but does not by itself forbid two certificates. The page therefore appears to contradict itself, or the list is stale.

**Decision.** The cap is two specialties, with certificates limited to one. Pat's rule wins over the page. Both the slot cap and the certificate cap live in `combinationRule` in `data/catalog/pathways.json`, with both citations recorded beside them, so changing this is one data edit and no code change.

**Alternatives.** Follow the page and allow two certificates, rejected because Pat is closer to the source. Block the feature pending confirmation, rejected because the cap is needed now and the disagreement affects exactly one combination, Finance plus HSM.

**Consequences.** A student pursuing both certificates sees a warning the page suggests they might not deserve. Confirm with advising and log the answer as a new ADR either way. This is the second cross-cutting rule this project has had to correct, which is why it now lives in data rather than in code.

---

## ADR-0022: Within-pathway allocation by exact search with a node budget

Date: 2026-08-28
Status: accepted

**Context.** ADR-0018 settled that a course counts toward every pathway it appears on. It does not settle what happens inside one pathway, where a course can appear in two groups. Strategy's third group explicitly accepts surplus from its first, so counting one course in both groups would award the concentration for four courses instead of six.

**Decision.** Within a pathway, each course is allocated to at most one group. `app/rules/allocate.js` searches exactly, most-constrained course first, with memoization and a 200,000-node budget. If the budget is exhausted it returns the best assignment found and sets `approximate: true`, which the UI surfaces rather than hides.

**Alternatives.** Greedy assignment, rejected because it silently understates progress on pathways with overlapping groups. Max-flow, which would be exact for credit groups but awkward where course-count and credit groups mix inside one pathway, as they do in Energy Finance.

**Consequences.** Results are proven, not estimated, for every pathway in the current catalog. The approximate flag exists so a future catalog with much larger groups degrades visibly rather than quietly.

---

## ADR-0023: Shared course numbers get composite ids

Date: 2026-08-28
Status: accepted

**Context.** Extraction found that several course numbers cover different courses: DECISION 894 is both Modern AI for Managers and Transforming Tech Analytics, ENERGY 790-1 is two different courses, HLTHMGMT 898 is five. A course code is therefore not a unique key.

**Decision.** Course ids are the code by default and `CODE::slug` where a code covers several courses. The original code is preserved in the `code` field and is what the UI displays.

**Consequences.** Pasted text that contains a shared number cannot be resolved automatically, so the confirmation screen offers every course using that number, marked ambiguous and unticked by default. The student picks.

---

## ADR-0024: Local use requires a static server; Duke fonts are not yet vendored

Date: 2026-08-28
Status: accepted

**Context.** Two gaps surfaced during the build. First, browsers block ES modules and fetch over `file://`, so opening `index.html` by double-clicking does not work; the app needs an HTTP origin. Second, vendoring Merriweather and Open Sans means committing font binaries, which was not done in this pass.

**Decision.** Ship `tools/serve.js` and `npm run serve` for local use, and rely on the GitHub Pages URL as the normal way to open the app. Use a font stack of Merriweather and Open Sans with Georgia and a system sans as fallbacks until the files are vendored.

**Alternatives.** Convert to classic scripts with data inlined as JavaScript so `file://` works, rejected because it costs the module structure that makes the rule engine testable under `node --test`. Load fonts from the Google CDN, rejected because it breaks offline use and adds a third-party request.

**Consequences.** Anyone who clones the repo needs Node or Python to run it locally, which is fine because the shared artifact is the Pages URL. Typography currently falls back to Georgia and the system sans on most machines, which is on-brand but not the intended pairing. Vendoring the two font families is a small follow-up.

---

## ADR-0025: The one-certificate rule is settled

Date: 2026-08-28
Status: accepted
Supersedes: ADR-0021

**Context.** ADR-0021 adopted a one-certificate cap but recorded it as unresolved and flagged it for advising, because the Fuqua program page lists "2 certificates" under Combinations Allowed. Pat has confirmed the rule as final for this build.

**Decision.** Two specialties maximum, at most one of which may be a certificate. This is settled. The catalog note no longer asks anyone to confirm it, and the contradicting line on the Fuqua page is treated as stale or erroneous rather than as an open question.

**Consequences.** Finance Certificate plus HSM Certificate is rejected, and the app says so plainly rather than hedging. The rule still lives in `combinationRule` in the catalog, so a future correction is one data edit. The citation to the contradicting page stays recorded, because a future reader who finds that page deserves to know it was seen and set aside deliberately.

---

## ADR-0026: Duke fonts vendored, closing the gap in ADR-0024

Date: 2026-08-28
Status: accepted
Supersedes: the typography half of ADR-0024

**Context.** ADR-0024 declared Merriweather and Open Sans in the font stack but left the files unvendored, so most machines rendered the Georgia and system-sans fallbacks. Both families are on Google Fonts under the SIL Open Font License 1.1, which permits redistribution.

**Decision.** Vendor the Latin-subset woff2 files into `app/fonts/`, taken from the `@fontsource` packages that repackage the Google Fonts releases. Five faces: Merriweather 400 and 700, Open Sans 400, 600, and 700. Both licences are committed alongside them. `@font-face` rules use `font-display: swap`.

**Alternatives.** Link the Google Fonts CDN, rejected because it breaks offline use, adds a third-party request on every load, and the artifact is meant to be self-contained. Ship the full Unicode range, rejected as unnecessary weight for an app whose content is English course titles.

**Consequences.** 176 KB added to the repo, cached after first load. The app now renders in the intended Duke pairing with no network dependency. Adding a weight means adding a file and a rule, deliberately. The fallback stack stays in place for the moment before the fonts load and for anyone who blocks font downloads.

**Note.** The font files were obtained through the npm package manager in the same way pdfplumber was obtained through pip, and only the woff2 binaries and licences were copied into the repo. No package manifest, lockfile, or `node_modules` enters the tree, which keeps the no-dependency rule in CONVENTIONS.md intact: these are assets, not a runtime dependency.

---

## ADR-0027: The recommender uses the evaluator as its oracle

Date: 2026-08-28
Status: accepted

**Context.** Showing a student the shortest remaining route to a pathway needs a search over candidate courses. The search could reason about requirements directly, which would be fast, or call the existing evaluator on each candidate, which is slower.

**Decision.** `app/rules/recommend.js` performs a greedy search that adds one course at a time, scoring candidates by calling `evaluatePathway`. It never interprets a requirement itself.

**Alternatives.** A direct solver over the group structure, rejected because it would duplicate the requirement semantics in a second place. Two implementations of the same rules drift, and the drift shows up as advice that contradicts the progress bars.

**Consequences.** The recommendation can never disagree with the progress display, because both come from the same function. Ranking all 18 pathways costs about 120 ms, which is fine on demand and is why the ranking panel is opened deliberately rather than computed on every render. Greedy is not provably minimal; the tests assert that from an empty plan it reaches every pathway in exactly the number of courses the source documents require, which is the property that matters.

---

## ADR-0028: Minimum constraints count what is held, maximum constraints count what must be used

Date: 2026-08-28
Status: accepted

**Context.** Group constraints were evaluated against the courses allocation happened to assign. Allocation stops once a group's minimum is met, so a qualifying course could sit unassigned while its constraint read as failed. The HSM certificate exposed this: four breadth electives filled the group numerically, the industry-context constraint failed, and no additional course could fix it, because allocation would not assign a fifth course to a group that already had four. The recommender found it by being unable to complete the pathway at all.

**Decision.** Minimum constraints (`minOutsideArea`, `minFromSubset`, `minFromArea`) are evaluated over every planned course eligible for the group, because they ask whether the student HAS enough qualifying courses. Maximum constraints (`maxPracticum`) are evaluated over the fewest restricted courses any valid selection would be forced to include, because they ask whether the student must OVERUSE something. A group's `satisfied` now requires its constraints as well as its count.

**Alternatives.** A repair pass that swaps unassigned courses into a group to fix a failing constraint, rejected as more machinery for the same answer. Leaving constraints on allocation output, rejected because it was producing wrong results.

**Consequences.** A group showing four of four with a failed constraint now reads as unsatisfied rather than complete, which is honest. Progress percentage weights the count at 70 percent and constraint satisfaction at 30 percent, so a student can see a constrained group moving. Every pathway is now reachable from an empty plan, which was not true before.

---

## ADR-0029: Core courses are a separate hand-maintained catalog with no credits

Date: 2026-08-28
Status: accepted

**Context.** Every requirement document defines its coursework as electives "beyond the required core", and the HSM certificate requires completing the core outright, but none of the 16 documents lists the core. Pasted transcripts reported every core course as unrecognized. The core had to be assembled from Fuqua's exemption page, curriculum page, program format page, and the Duke bulletin, then confirmed by Pat.

**Decision.** `data/catalog/core.json` holds 14 core courses, hand-maintained rather than extracted, each carrying the confidence with which it was established. They merge into `courses.json` with `isCore: true` and `credits: null`. They belong to no group in any pathway, so they can never count toward a concentration. HSM gains a `requiresCore` pathway constraint. The build fails loudly if a course appears in both the core list and a pathway elective list.

**Alternatives.** Model credits with an assumed value of 3, rejected on Pat's decision and on merit: nothing counts core credits, so a wrong value could only mislead. Fold core courses into the ordinary catalog with a flag, rejected because their provenance is different and deserves its own file with its own sources.

**Consequences.** Transcripts parse cleanly. HSM is checkable for the first time. Quarter credit totals exclude core courses and show a separate core count, which is honest rather than convenient. The count question is not fully closed: see the `openQuestion` field in `core.json`.

**Unresolved.** The curriculum page says 13 mandated core classes; the program format page says first-year students complete approximately 14, and its own term breakdown totals 14 in first year alone. This list holds 14 in total, of which 13 are first year. If the program format page is right, one first-year core course is missing. The leading candidate is FUQINTRD 692, Leading Business in a Complex World, because the program format page describes summer orientation as three courses "that emphasize leading and managing in an uncertain world", which nearly quotes that title. Not added without confirmation.

---

## ADR-0030: Placement is display metadata; semesters and the Pre-Fuqua bucket

Date: 2026-08-28
Status: accepted

**Context.** Three placement needs arrived together: non-Fuqua Duke courses run on the university semester calendar and span two Fuqua terms; Pat wants a Pre-Fuqua Dual Degree Coursework bucket for courses taken before Fuqua that go toward requirements; and the plan panel needed to reflect both without complicating the rules.

**Decision.** Placement lives in `app/ui/placement.js`, a pure module, and is display metadata only: evaluation never reads it. Quarter 0 is the Pre-Fuqua bucket. Fuqua courses place by term (quarters 1 to 8). Non-Fuqua courses place by semester, stored as the semester's starting quarter (1, 3, 5, 7) and snapped there automatically from any term choice; the span is implied by `isFuqua` and rendered as a semester band. Per Pat: Pre-Fuqua courses count toward concentrations exactly like any other course, the bucket accepts only catalog courses, and there is no free-form entry and no approval marking.

**Alternatives.** A `span` field on plan entries, rejected as redundant with `isFuqua`. Free-form course entry for the Pre-Fuqua bucket, proposed and rejected by Pat as defeating the catalog's guardrails. Making evaluation placement-aware, rejected because no requirement in the sources depends on when a course is taken.

**Consequences.** The plan file format is unchanged and old exports import cleanly; quarter 0 and semester-start storage are both valid quarters under the existing schema. A test asserts that an all-Pre-Fuqua plan evaluates identically to a normally placed one, which pins the display-only property down.

---

## ADR-0031: Progress report via a print-styled window

Date: 2026-08-28
Status: accepted

**Context.** Pat wants a report export rather than raw JSON. The app has no build step and no dependencies, so generating .docx or .pdf in the browser would mean vendoring a document library.

**Decision.** `app/ui/report.js` builds a complete standalone HTML document (declared specialties and cap status, core progress, per-pathway table, requirement detail for declared and completed pathways, the placement-aware course plan, and the unofficial-aid disclaimer). The app opens it in a new window, which calls the browser's print dialog; saving as PDF is the browser's native path. The JSON export remains, renamed Backup, because Import depends on it and it is the only defense against cleared browser storage.

**Alternatives.** In-browser .docx generation, rejected on the dependency. A hidden print stylesheet over the app itself, rejected because a report and a working UI want different structure, and the separate document survives being saved on its own.

**Consequences.** Zero dependencies. The report inherits nothing from the app stylesheet, so it renders predictably in print. Pop-up blockers can suppress the window; the app says so instead of failing silently.

---

## ADR-0032: Institutional design language, and the Pathway Map rename

Date: 2026-08-28
Status: accepted

**Context.** Pat's assessment was that the interface "reads too much like a Claude dashboard and too little like Duke-brand, professional, custom." The specific tells were identifiable: every block was a rounded card with a soft drop shadow nested inside another card, almost everything carried a colored left-edge stripe, separation came from boxes rather than rules, Merriweather appeared only in the wordmark so the page was functionally all sans-serif, five accent colors were in play with no rule about what each meant, and numbers were set in proportional figures so credits and percentages did not align.

**Decision.** Rebuild the stylesheet around institutional tokens rather than patch it. Flat surfaces with no `box-shadow` anywhere. Near-square corners (2px). Hairline rules and whitespace carry structure. Merriweather carries headings, pathway names, group labels, and the map's percentages, not just the wordmark. `font-variant-numeric: tabular-nums` on every number. Panels take a 2px navy top rule instead of a shadow. Progress is a 3px rule that fills, not a rounded capsule.

Accent colors carry exactly one meaning each and are not reused decoratively: Eno for complete, Persimmon for in progress, Copper for blocked or over limit, Dandelion for emphasis on the navy ground only, Duke Royal for anything interactive. Prussian, Shale, and Magnolia are dropped from the palette.

Separately, "Skill Map" becomes "Pathway Map" throughout the interface and the living documents. This aligns the UI with CONVENTIONS.md, where *pathway* is already the umbrella domain term for a concentration or certificate. DECISIONS.md and CHANGELOG.md keep the original wording, because both are append-only records of what was decided at the time.

**Alternatives.** Refine the existing card treatment, rejected by Pat as too small a change. A bolder direction with a full-bleed masthead band and data tables replacing the option lists, offered and not chosen.

**Consequences.** `app/styles/main.css` was rewritten below the `@font-face` block. Markup changed in a few places to match: the group count has its own class, the semester band gained a description line, and the legend swatches distinguish by border weight as well as color, since two of the four share a fill.

---

## ADR-0033: pdf.js vendored and imported dynamically for transcript import

Date: 2026-08-28
Status: accepted

**Context.** Pat asked to import a transcript PDF rather than paste its text. ADR-0012 ruled out OCR and vision models in the input path. Reading a text-based PDF is neither: the characters are already data in the file, and extracting them is deterministic parsing, closer to what `pdfplumber` does offline than to anything model-shaped. So the capability fits the constraint, but it needs a library, and CONVENTIONS.md forbids dependencies without an ADR.

**Decision.** Vendor two minified build files from `pdfjs-dist` 4.10.38 into `app/vendor/pdfjs/`: `pdf.min.mjs` (345 KB) and `pdf.worker.min.mjs` (1.34 MB), with the Apache 2.0 licence and a VERSION note beside them. No package manifest, lockfile, or `node_modules` enters the tree, matching how the Duke fonts were vendored under ADR-0026.

`app/ui/pdf-import.js` loads pdf.js through a dynamic `import()` on first use, so the 1.7 MB downloads only when someone actually selects a PDF and costs nothing on an ordinary page load. Extracted text is handed to the existing `parsePaste` and lands in the same confirmation screen: extraction proposes, the student confirms.

A PDF with pages but almost no selectable text is a scan. Rather than return an empty result that reads as "no courses found," it throws with an explanation naming the likely cause and saying plainly that OCR is deliberately out of scope because misread course codes look correct.

**Alternatives.** Improve the paste flow instead, offered and not chosen. A server-side extractor, ruled out by ADR-0008's no-server architecture. Bundling pdf.js statically, rejected because it would put 1.7 MB on every page load for the majority who never import a PDF.

**Consequences.** The repository grows by 1.7 MB, roughly ten times the vendored fonts, and it is the first runtime dependency in the application. Upgrading means replacing two files and updating VERSION.txt. Scanned transcripts remain unsupported by design. A test asserts the import stays dynamic, because a future refactor that made it static would silently impose the download on everyone.
