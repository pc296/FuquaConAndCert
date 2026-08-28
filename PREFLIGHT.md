# PREFLIGHT.md

Purpose: the checklist to run before touching code. Work does not start until every box is answered.

Last updated: 2026-08-27

## Checklist

1. **Restate the task in one line.** Write it down. If you cannot state it in one line, it is not scoped yet. Split it or ask.
2. **Identify affected components.** Open ARCHITECTURE.md and name the components this touches and the boundaries it crosses. If the task requires a component that does not exist yet, say so now, because that is a structure change and ARCHITECTURE.md will need updating in POSTFLIGHT.
3. **Check CONVENTIONS.md.** Read the sections that apply to what you are about to write (language rules, layout, naming, error handling). Do not read the whole file every time.
4. **Check LESSONS.md.** Scan for prior mistakes in this area. If one applies, state which rule you are following because of it.
5. **Check DECISIONS.md.** Confirm whether a relevant choice is already recorded. If the task depends on an ADR still marked `proposed`, stop and resolve it first.
6. **Confirm the test plan.** Per TESTING.md, name the tests that will prove this works before you write the code. New logic ships with tests. If the task genuinely needs no test, write down why.
7. **Flag ambiguity and stop.** List anything under-specified: unclear requirements, unclear source data, two reasonable interpretations. Ask Pat rather than picking one. Assuming is the failure mode this repo is built to prevent.

## Domain-specific checks

This project reads academic requirement documents and evaluates plans against them. Before any task that touches extraction or rule logic:

- Confirm which source PDF and which version of it the task depends on. `Source_docs/` files carry retrieval dates in their footers and the underlying pages change.
- Confirm whether the requirement being encoded has exceptions or footnotes. Several concentrations have conditional rules, for example the Energy Finance rule where a third course from section 1 can count toward section 2.
- Never infer a requirement that the source document does not state. If the source is unclear, record it as unclear and surface it in the UI rather than guessing.

## Output of preflight

A short written block in your response, before any code:

```
TASK: <one line>
COMPONENTS: <from ARCHITECTURE.md>
CONVENTIONS: <rules that apply>
LESSONS: <prior mistakes that apply, or none>
DECISIONS: <relevant ADRs, or none>
TESTS: <what will prove this works>
AMBIGUITIES: <list, or none>
```
