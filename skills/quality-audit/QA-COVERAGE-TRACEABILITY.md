# QA Coverage and Traceability (Module B)

#### When to use this file

Reach for this file when the question is whether the tests cover what the product is supposed to do: a PRD, user story, acceptance criteria, README feature list, API contract, or a code change under review. It produces `traceability-matrix.json`, a bidirectional mapping between the test basis and test cases in the sense of ISO/IEC/IEEE 29119-3, and coverage-gap findings.

Use [SDET-AUTOMATION-HEALTH.md](SDET-AUTOMATION-HEALTH.md) to judge whether a linked test can actually fail, and [SEIT-API-CONTRACT.md](SEIT-API-CONTRACT.md) for operation-level contract coverage.

## Core discipline (include in every agent prompt for this module)

```
- Work only from requirements the test basis states. Quote nothing; cite basis file and line.
  An ambiguous or untestable requirement is a needs_validation finding about the basis, not a guessed gap.
- Derive test conditions with named techniques: equivalence partitioning, boundary value analysis,
  decision tables, state transitions, scenario (use-case) testing, error guessing. Each requirement gets
  at least one happy-path, one edge-case, and one negative condition where the interface accepts them.
- A test case covers a condition only if it drives the relevant input and asserts the relevant outcome.
  A matching test name or a mention of the feature is not coverage.
- Line or branch coverage figures are not requirement coverage. Use them only to locate untested code.
- Set each requirement's risk level from business and user impact (ISTQB risk-based testing), and say why.
- Return `confirmed` gaps only when the basis is unambiguous and you searched every test level for
  the condition. Return `needs_validation` when coverage may exist outside the repository (manual
  test management, another repo) or the basis is unclear.
```

## Coverage classes (subagent_type: `research`)

**QA-UNCOVERED-CONDITION — a stated condition has no test case**
No test at any level drives the condition and asserts its outcome. Search unit, integration, contract, and E2E levels before concluding.

**QA-PARTIAL-COVERAGE — test exists but misses the decisive part**
The test drives the input but asserts only status, not the outcome; covers one partition but not the boundary; or covers the happy path while the negative condition stated in the basis is untested.

**QA-MISSING-NEGATIVE — error and rejection paths untested**
Validation errors, authorization denials, limits, timeouts, and failure handling that the basis states but no test exercises.

**QA-MISSING-BOUNDARY — boundary values untested**
Minimum, maximum, just-inside, and just-outside values for stated limits (amounts, lengths, counts, dates, rates).

**QA-STATE-TRANSITION-GAP — lifecycle transitions untested**
Invalid transitions, repeated transitions, and cancellation or rollback paths of a stated state machine.

**QA-CHANGE-UNTESTED — changed behavior without changed tests**
For a diff under review: behavior the diff adds or changes with no added or updated test asserting it.

**QA-BASIS-DEFECT — the requirement itself is not testable**
Contradictory, ambiguous, or unmeasurable acceptance criteria. Report with `needs_validation` and a question for the product owner; this is static testing of the basis, not a code gap.

**QA-ORPHAN-TEST — test traced to no requirement** *(informational)*
Tests whose purpose matches no stated requirement. Report in aggregate as a hardening note, never as a defect, since the basis may be incomplete.

## Building the matrix

The parent merges reviewer results into `traceability-matrix.json`:

```json
{
  "test_basis": [{ "basis_id": "PRD-REFUNDS", "path": "docs/prd/refunds.md", "kind": "prd" }],
  "requirements": [
    {
      "requirement_id": "REQ-REFUND-1",
      "basis_id": "PRD-REFUNDS",
      "line": 18,
      "summary": "A refund cannot exceed the captured amount.",
      "risk_level": "high",
      "test_conditions": [
        {
          "condition_id": "REQ-REFUND-1.N1",
          "kind": "negative",
          "technique": "boundary_value_analysis",
          "summary": "Refund at captured amount + 0.01 is rejected.",
          "status": "uncovered",
          "test_cases": [],
          "gap_fingerprint": "qa-refund-over-captured-amount-uncovered",
          "note": null
        }
      ]
    }
  ]
}
```

- `status` is `covered`, `partial`, `uncovered`, or `not_testable`. `covered` and `partial` link at least one test case; `uncovered` and `not_testable` link none; `not_testable` needs a `note`.
- Every `partial` or `uncovered` condition on a `critical` or `high` risk requirement links a `qa` finding by `gap_fingerprint`. Lower-risk gaps may link one.
- Requirement and condition IDs derive from the basis (story key, section number, or a stable slug), never from the run.
- A user-pasted basis that is not a file in the target (Jira text, chat) is saved by the parent as `<output-dir>/basis/<basis-id>.md` and cited by that path.

## Universal moves (apply across the above)

1. List requirements first, then derive conditions per technique, then search for tests. Do not start from the tests.
2. For each candidate test, read the arrange, act, and assert steps; record exactly which condition it proves.
3. Check every test level; an E2E gap covered by an integration test is covered.
4. Record coverage by a disabled or assertion-free test as `partial` and link the Module A finding.

## Validation rules (apply before reporting ANY finding here)

1. Cite the basis location (`test_basis`) and the closest existing test (`locations`) or the suite searched.
2. State the regression the gap allows: which behavior could break with every test still passing.
3. Severity follows the requirement's risk level and the gap's size; an uncovered negative condition on a critical requirement is high or critical.
4. Never invent a requirement or upgrade an implied expectation into a stated one.
