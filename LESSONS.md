# LESSONS.md

Purpose: running log of mistakes, root causes, and the rule adopted so they do not recur. Read in PREFLIGHT, appended in POSTFLIGHT.

Last updated: 2026-08-28

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

---

## 2026-08-28: Numerically equal assignments can still be wrong to show

**What happened.** With only FINANCE 646 and 647 planned, the Energy Finance detail showed 647 counting as an elective through the overflow clause while the core group it belongs to sat half-filled. The allocator was maximizing total demand filled, and both assignments fill the same amount, so it reported whichever it found first. Completion semantics were unaffected; the display was misleading.

**Why.** The allocator's objective captured how much was satisfied but not which reading of the sources an assignment implies. Overflow is a fallback clause in the documents, and trying it on equal footing with direct eligibility produced answers that were arithmetically right and semantically backwards.

**Takeaway.** When a solver has ties, the tie-break is a product decision, not a free choice. Direct eligibility now ranks ahead of overflow, and a test pins the two-course case. When output of a search is shown to users, check what it looks like in partial states, not only whether the terminal states are correct.

---

## 2026-08-28: An unterminated CSS rule silently disabled the entire stylesheet

**What happened.** Rewriting `main.css` meant preserving the `@font-face` block and replacing everything after it. The block was extracted with `head -47`, one line short of its closing brace. The last `@font-face` rule was left open, so the CSS parser swallowed the entire rest of the file as part of it. The page loaded, fetched the stylesheet successfully, threw no error, logged nothing, and rendered completely unstyled. Measurements taken at that moment were meaningless and looked plausible: an unstyled title reported 513px of width, which read as "the fix worked" rather than "no CSS is applied."

**Why.** CSS fails silently by design. There is no error event for a malformed rule, and a 200 response for the stylesheet says nothing about whether it parsed. The check I ran measured element widths, which cannot distinguish "styled correctly" from "not styled at all."

**Takeaway.** Structural integrity of an asset deserves a test that does not need a browser. `tests/ui/assets.test.js` now asserts the stylesheet's braces balance, that all five `@font-face` blocks are closed, and that each references a font file that exists. That test would have caught this in under a second. More generally: when a verification step produces a number, ask what that number would look like if the thing under test were entirely absent. If the answer is "plausible," the check is not a check.

---

## 2026-08-28: Browser verification ran against a stale copy for an entire phase

**What happened.** The Energy Finance detail showed FINANCE 647 counted as an elective while its core group sat at 1 of 2, exactly the defect fixed in phase 2 by the allocator tie-break. Running the same plan through the engine directly gave the correct 2 of 2. The rules were right; the browser was loading an older `allocate.js`. Files reach the browser by being staged individually into the container, and `allocate.js` was edited in phase 2 but never included in the staging list for that phase's verification. Every screenshot since had been taken against pre-fix allocation logic.

**Why.** Staging was done by naming the files I remembered changing. That is a manual list maintained by memory, and it silently diverges from the truth the moment an edit is forgotten. Nothing surfaces the divergence: the app runs fine, just as an older version.

**Takeaway.** Never hand-pick the verification payload. Stage every file the browser loads, every time, or diff mtimes between the working tree and the staged copy before trusting a screenshot. A visual check against unknown code is worse than no check, because it produces confidence. The corrected finding here is also reassuring in the other direction: the engine and its tests were right the whole time, and the discrepancy was in the harness.

---

## 2026-08-28: A shipped feature that nobody could find is not shipped

**What happened.** Transcript PDF import was built, tested, deployed, and verified live. Pat then reported that the upload tool would not accept PDFs and asked why he could not see the work. He was right about what he saw. The button labelled "Import", sitting at the top of the plan panel, restores a JSON backup; the PDF control sat inside a collapsed disclosure below it. Nothing was broken and nothing was missing. The obvious control did the wrong thing.

**Why.** Every check I ran asked whether the feature existed and worked. I queried the live DOM for `#pdf-file` and confirmed its `accept` attribute, drove it with a synthetic transcript, and watched it succeed. Not one check asked whether a person looking for it would arrive at it. Having decided where to put the control, I was the worst possible judge of whether it could be found, and my verification inherited that blind spot completely.

**Takeaway.** Automated verification answers "does it work", never "is it discoverable". For any user-facing entry point, name the single most obvious thing a person would click for that goal, and confirm that clicking it does that thing. If it does something else, the design is wrong regardless of test results. Where two controls could plausibly serve the same intent, prefer collapsing them into one that dispatches on input over labelling the difference; the interface then cannot be misread. See ADR-0034.

---

## 2026-08-28: I built the false positive I had just documented as the reason for human review

**What happened.** Writing ADR-0037 I argued explicitly that cross-listings must never be accepted on title similarity, citing the FCCP practicums as proof that a shared number means nothing. In the same session I wrote a suggestion helper that proposed a course whenever exactly one other course shared its number, with no title check at all. Running Pat's real transcript, it offered `HLTHMGMT 710 Health Institutions, Systems and Policy` as a match for his `ENVIRON 710 Applied Statistical Modeling`. Unrelated courses, presented to a student as a plausible match.

**Why.** The reasoning about false positives was applied to the mechanism I was thinking about, the automated detector, and not to the one I wrote afterwards. The two do the same job in different places, and only one inherited the caution. Writing the argument down did not make me apply it, because I had filed it against a component rather than against a category of decision.

**Takeaway.** A safeguard belongs to the decision, not to the component it was first written for. When an ADR says a class of inference is unsafe, grep for every place that inference happens before considering it done. Concretely: suggestions now require the observed title to overlap the candidate's, and a code with no title beside it gets no suggestion at all, on the principle that a wrong course offered as plausible is worse than no hint. It also cost nothing to fix, because a real transcript was run through the finished feature. Synthetic fixtures would not have produced ENVIRON 710.

---

## 2026-08-28: Two of three Add buttons were dead and my verification used the third

**What happened.** Changing `addCourse(courseId, quarter)` to take a term id broke both Add buttons in the detail panel. `renderGroupOptions` still called `normalizeQuarter`, a helper renamed in the same change, so clicking Add in a requirement group's option list threw a ReferenceError and did nothing. `renderNextUp` still passed the integer `1`, which is no longer a term id, so the shortest-way Add silently placed courses in the Pre-Fuqua bucket instead of Fall 1. I ran a browser check after the change, exercised the plan panel's Add course button, watched it work, and reported the phase done. Pat found both within minutes of using it.

**Why.** Two compounding mistakes. I updated the call sites I could see from the function I was editing rather than searching for all of them, which a grep for `addCourse(` would have settled in seconds. Then I verified the entry point I had just written instead of the ones that call into it. An undefined reference inside a click handler is invisible until somebody clicks, so nothing in the page load, the test suite, or the screenshot could have shown it.

**Takeaway.** When a function's signature changes, the change is not finished until every call site has been enumerated mechanically, not recalled. And a UI check must exercise every control that reaches the changed code, not the most convenient one; "I clicked a button and it worked" is evidence about that button alone.

Three checks now exist, and each was proven to fail when its defect is reintroduced: every named import must exist in the module it names, no `addCourse` call may pass a bare number, and identifiers removed by ADR-0035 must not appear in the UI. `addCourse` also throws on an invalid term id now, because silently placing a course somewhere other than where the button said is indistinguishable to a user from the button being broken.

---

## 2026-08-28: One field carrying two meanings printed "already complete" over a list of five courses still needed

**What happened.** `jointRemaining` returned `complete: true` to mean "a full route to finishing was found". The Degree Plan read it as "you are finished", so both scenario cards showed *Already complete. Nothing further is needed here.* immediately above a list of five courses they said were still required, and suppressed the fit verdict entirely. Every unit test passed. The bug existed only in the sentence a person reads.

**Why.** The field was named for what the search concluded, not for what a caller would ask it. `complete` and `reachable` were assigned the same value on the success path, which should have been the tell: two names for one fact means neither name is the right one. I wrote the consumer from the name rather than the definition, which is exactly what a name is for.

**Takeaway.** When two returned fields are always equal, one of them is wrong. A boolean whose meaning needs a sentence of explanation at the call site should be split until it does not: `reachable` (a route exists) and `alreadyComplete` (the route is empty) are now separate, and a test asserts they differ for a plan mid-flight. More generally, unit tests verify arithmetic; only rendering the screen verifies that the arithmetic was asked the right question. This was caught by a screenshot, not by 107 passing tests.

**Related, from the same screenshot.** The panel's header and its verdict printed different counts of the same terms, because a term whose seats were full was filed as a term whose capacity was unknown. Two numbers describing one thing must be computed from one predicate; the fix was to make "known but zero" and "unknown" distinct everywhere, and to assert in a test that the two lines agree. See ADR-0039.
