# Functional Testing (module `functional`)

#### When to use this file

Use this file for any application feature: business rules, calculations, validation, workflows, state machines, data handling, and user-facing behavior in web, mobile, CLI, library, or service code. It finds defects where the product does not do what its test basis, documentation, or code contracts say.

Use [TRACEABILITY.md](TRACEABILITY.md) for the matrix, [API-AND-INTEGRATION.md](API-AND-INTEGRATION.md) for contract conformance, and [NON-FUNCTIONAL.md](NON-FUNCTIONAL.md) for reliability, performance, and compatibility.

## Core discipline (include in every agent prompt for this module)

```
- A defect candidate names the test condition, the oracle, the triggering input or state, the code path,
  the expected result, and the actual result. No oracle, no defect.
- Read the implementation end to end: entry point, parsing and validation, business rule, persistence,
  side effects, and output. Compare sibling paths that should behave the same.
- Framework validation, database constraints, middleware, and shared helpers are real controls. Check them
  before claiming that an input is accepted.
- Prefer the narrowest evidence: source for a deterministic logic error; a sandboxed harness or existing
  test for anything that depends on runtime behavior; authorized staging only when the decisive behavior
  depends on deployment.
- Write the regression test in the repository's existing framework, style, and test level. It must fail on
  the current code for the reported reason and pass once the fix is applied.
- Use `needs_validation` when the oracle is ambiguous or the decisive fact is unobservable.
```

## Input and validation classes (subagent_type: `general`)

**FUNC-BOUNDARY — off-by-one and limit errors**
`<` vs `<=`, inclusive vs exclusive ranges, minimum and maximum lengths, counts, amounts, dates, and pagination limits. Test the boundary, just inside, and just outside.

**FUNC-VALIDATION-MISSING — input the basis forbids is accepted**
Required fields, formats, ranges, enums, and cross-field rules (end after start, total equals sum) not enforced on every entry path, including import, batch, admin, and API paths that bypass the UI.

**FUNC-VALIDATION-OVERSTRICT — valid input is rejected**
Legitimate names, addresses, Unicode, time zones, currencies, leading zeros, or optional fields that the code rejects or mangles.

**FUNC-NULL-EMPTY — absent, empty, or zero values mishandled**
Null, undefined, empty string, empty list, zero, and missing optional fields that crash, display wrongly, or are treated as a valid value.

## Logic and calculation classes (subagent_type: `general`)

**FUNC-CALCULATION — wrong arithmetic or business formula**
Rounding mode, floating-point money, currency precision, tax, discount stacking order, proration, unit conversion, and aggregate totals that do not match the stated rule.

**FUNC-DECISION-LOGIC — wrong branch for a combination of conditions**
Build a decision table from the basis. Check every rule, especially combinations the code's conditionals collapse or reorder.

**FUNC-STATE-TRANSITION — invalid or missing transitions**
Build a state-transition table. Check invalid transitions, repeated transitions (double submit, retried webhook), cancel or rollback from each state, and terminal states that can be left.

**FUNC-DATE-TIME — time zone, DST, calendar, and clock errors**
Server vs user time zone, DST gaps and overlaps, month ends, leap days, week starts, expiry at exact boundaries, and comparisons between naive and aware timestamps.

**FUNC-I18N — locale-dependent behavior**
Number and date formatting and parsing, sorting and case-folding, pluralization, right-to-left text, and missing translations that break flows.

## Data and side-effect classes (subagent_type: `general`)

**FUNC-DATA-INTEGRITY — partial writes and inconsistent state**
Multi-step updates without a transaction, missing rollback on failure, duplicates from missing idempotency, orphaned records, and denormalized copies that diverge.

**FUNC-SIDE-EFFECT — wrong, missing, or repeated side effects**
Emails, notifications, events, webhooks, and audit records that are sent twice, not sent, sent before commit, or sent with wrong data.

**FUNC-ERROR-HANDLING — failures handled wrongly**
Swallowed exceptions, generic errors that hide the cause, success reported after failure, misleading user messages, and error paths that leave state half-changed.

**FUNC-SEARCH-FILTER-SORT — wrong results from queries**
Filters that drop or include wrong records, unstable or wrong sort order, pagination that skips or repeats items, and case or accent sensitivity that contradicts the basis.

## Flow and UI classes (subagent_type: `general`)

**FUNC-WORKFLOW — end-to-end flow breaks**
Scenario tests for each main use case: preconditions, main flow, alternative flows, and exception flows from the basis.

**FUNC-UI-BEHAVIOR — UI state contradicts the domain**
Displayed values, enabled or disabled actions, navigation, and form state that disagree with the underlying data or rules. Verify with a component test or a sandboxed browser run.

**FUNC-BASIS-DEFECT — the requirement itself is not testable** (`needs_validation` only)
Contradictory, ambiguous, or unmeasurable acceptance criteria. Ask the owner one precise question.

## Universal moves (apply across the above)

1. Start from the matrix conditions assigned to the unit, then apply the classes above to find conditions the basis implies but the matrix lacks.
2. For each candidate, find the strongest control that could prevent it before calling it a defect.
3. Reproduce with the smallest harness: call the function, render the component, or send one request to a locally started service.
4. Write the regression test at the lowest level that detects the defect (component before API before E2E).

## Validation rules (apply before reporting ANY finding here)

1. Cite the oracle, the test basis location when the oracle is a requirement or documentation, and the implementation location.
2. Give exact input, expected result, and actual result. The actual result comes from source logic or a bounded run, never from assumption.
3. Severity follows the anchors in `SKILL.md` and the requirement's risk level.
4. The regression test follows repository conventions, uses only dummy data, and reads any credential from the environment.
