# LESSONS.md

Purpose: running log of mistakes, root causes, and the rule adopted so they do not recur. Read in PREFLIGHT, appended in POSTFLIGHT.

Last updated: 2026-08-27

Entry format: date, what happened, why, durable takeaway.

---

## 2026-08-27: Governance setup ran without a stated target

**What happened.** master_prompt.docx specified the governance layer in full but never said what the codebase would build. ARCHITECTURE.md and CONVENTIONS.md cannot be written without a target, so setup stopped and asked before writing those two files.

**Why.** The prompt was written as a reusable template for any greenfield repo. The project-specific context lived in the folder structure and in Pat's head, not in the document.

**Takeaway.** A reusable prompt still needs a project brief attached to it. When a governing instruction is silent on scope, ask before producing anything that encodes an assumed scope. This is the rule PREFLIGHT step 7 exists to enforce, and it applied on the first task in the repo.

---

## 2026-08-27: A stack was chosen before the sharing requirement surfaced

**What happened.** ADR-0003 accepted Python and FastAPI. One turn later Pat said the tool should be shareable with fellow students, which makes a locally run server the wrong center of gravity. ADR-0008 superseded ADR-0003 before any code existed.

**Why.** The stack question was asked before the distribution question. Distribution constrains architecture more tightly than language preference does, and it was asked second.

**Takeaway.** Ask who runs the software and how before asking what it is written in. On this project the cost was one ADR. Had the domain layer already been written in Python, it would have been a rewrite.

---

## 2026-08-27: The governing rule was taken from a secondary source

**What happened.** The two-specialty cap was encoded from `Finance Concentrations.pdf`, which says only "Two concentrations are the maximum number of academic specialties one can earn." Pat then supplied the official Fuqua program page, which states the allowed combinations as "2 concentrations, 2 certificates, 1 concentration + 1 certificate." Two certificates is valid and was in neither the source PDF's phrasing nor the premise this repo started from.

**Why.** The 16 PDFs are printed copies of individual requirement pages. None of them is the authoritative statement of the combination rule, and a rule inferred from a passing mention inside one concentration's page was treated as the rule.

**Takeaway.** A cross-cutting rule found inside a single pathway document is a lead, not a source. Find the page whose subject is that rule. Every cross-cutting rule in the catalog now carries the URL and retrieval date it came from, and rules sourced from a passing mention are marked as such until confirmed.

---

## 2026-08-27: A configuration flag was designed around an unanswered question

**What happened.** ADR-0014 made course double-counting a configurable flag with a conservative default, and specified an allocation solver for the off case, because no source document stated the rule. Pat answered the question directly in the next message: courses count toward every pathway they appear on. ADR-0018 superseded ADR-0014 and deleted the solver from the design.

**Why.** The question was answerable by asking, and building a flag was chosen over waiting for an answer.

**Takeaway.** Configurability is not a substitute for an answer. When an unknown is cheap to ask about and expensive to abstract over, ask. Flagging the unknown was right; designing a solver around it before hearing back was not.

---

## 2026-08-28: A suffix test silently dropped a course

**What happened.** The extraction parser rejected prose by testing `title.endswith(("the", "and", "of", "a"))`. `endswith("a")` matches any title ending in a word that ends in "a", so GLHLTH 671, Global Health and Health Systems in Africa, was dropped. It surfaced only because the catalog builder reported one course with no title. Fixed by comparing the final word rather than the final characters.

**Why.** A filter written to reject a class of input was tested against inputs it was meant to reject and never against inputs it was meant to keep.

**Takeaway.** A rejection rule needs tests from both sides. When a filter can produce silent omissions, add a completeness check that fails loudly: the "no title found" report is what caught this, and it stays in the tool.

---

## 2026-08-28: Two test failures were wrong tests, not wrong code

**What happened.** Two of the first twenty rule tests failed. Both were fixtures where the course list I wrote actually did satisfy the requirement: the Decision Sciences case allowed a valid 6/9/3 split, and the Operations case fell short of the methods minimum because SOCENT 895 counts as 3 credits rather than 6. The engine was right both times.

**Why.** The fixtures were written from a mental model of the requirement rather than by working the arithmetic through.

**Takeaway.** For a rule with numeric thresholds, compute the expected totals explicitly and put them in a comment in the test. Both corrected tests now show the arithmetic, which makes a future failure legible instead of ambiguous.

---

## 2026-08-28: Module-scope initialization order broke the page silently

**What happened.** `app/ui/main.js` called `init()` near the top of the module, before the `const fetchJson = ...` arrow it depends on was initialized. The page loaded, rendered its static shell, and did nothing else. Nothing in the Node test suite touches the UI, so this was invisible until the page was opened in a real browser.

**Why.** Rule logic is covered by tests and UI wiring is not, by design (TESTING.md). That trade is defensible, but it means UI defects can only be caught by loading the page.

**Takeaway.** Every UI change gets loaded in a browser with the console open before it is called done. Silent failure is the normal failure mode for module initialization order, so "the page looks fine" is not evidence. `init()` now runs at the end of the module with a `.catch` that reports startup failure to the user instead of only to the console.

---

## 2026-08-28: The verification pass found parser gaps, not catalog errors

**What happened.** The catalog audit compared all 18 pathway records against the 16 source documents. The requirement structures were correct: every group minimum, total, and constraint matched what the documents state. What it did find was two defects in the extraction parser and one gap in the engine.

The parser could not read a cross-listed line. `PUBPOL 559S/LAW 585 — Philanthropy, Voluntarism & Not-For-Profit Management` was dropped whole, because the pattern expected a separator immediately after the course number and found a slash. The catalog had the course anyway, but only because the title had been supplied by hand in the curated override table. Nothing would have revealed the omission if that course had not happened to need a curated title.

The engine gap: the Finance Certificate's intermediate qualification was recorded in the catalog and read by nothing. Data with no consumer looks like a feature until someone checks.

**Why.** The catalog was authored by reading the source text directly, and the parser output was used mainly to supply titles. That made the catalog robust to parser bugs and made parser bugs invisible. Two independent paths to the same data hid the failure of one of them.

**Takeaway.** When a hand-authored artifact and a generated one cover the same ground, the hand-authored one masks defects in the generator. Check the generator against the source on its own terms, not through the artifact. `tools/extraction/verify.py` now does that mechanically after every catalog change, and a fixture of real source lines guards the parser from both sides.

Second takeaway: every field in a data file should have a consumer or a comment saying why it does not yet. Search the code for each new catalog key before considering the record done.

---

## 2026-08-28: A new feature found a modelling error the tests had agreed with

**What happened.** Building the recommender surfaced that the HSM certificate could not be completed by any sequence of courses. Group constraints were being checked against the courses that allocation assigned, and allocation stops at a group's minimum, so the industry-context elective could sit in the plan unassigned while its own constraint reported failure. Nothing the student did could fix it.

**Why.** The existing constraint tests all used plans where the constrained courses happened to be the ones allocation picked, so they passed while the semantics were wrong. The tests encoded the same misunderstanding as the code, which is what tests written alongside an implementation tend to do.

**Takeaway.** A test written from the same mental model as the code cannot falsify that model. The check that found this was a different kind: an end-to-end property asking whether every pathway is reachable at all. Properties that must hold across the whole catalog are worth more than another example per rule, and there is now one asserting that following the tool's own advice completes the pathway it was given for.

---

## 2026-08-28: An all-or-nothing rule gave the search nothing to climb

**What happened.** Adding the HSM core requirement made that certificate unreachable again, for the second time and a different reason. The recommender scores a candidate course by how much it improves the evaluation, and `requiresCore` was binary: it stayed false until all fourteen core courses were present. Adding the first core course improved nothing the search could measure, so no core course was ever chosen, so the requirement was never met.

**Why.** Constraints were modelled as satisfied or not, which is all an evaluator needs. A search needs a gradient. The two consumers wanted different shapes from the same data and only one of them was considered when the shape was chosen.

**Takeaway.** Any rule a search has to satisfy needs partial credit, not just a verdict. Constraint results now carry a `progress` value from 0 to 1 alongside `satisfied`, defaulting to the binary value, and both the recommender and the progress percentage read it. When adding a constraint type, ask what a partially-complete version of it looks like; if the answer is "there isn't one", say so deliberately rather than by omission.
