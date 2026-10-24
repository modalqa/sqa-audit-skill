# Requirement Traceability and Verification

#### When to use this file

Every full run uses this file. It defines how requirements become test conditions, how each condition is verified against the implementation, and the `traceability-matrix.json` format. The matrix is the bidirectional traceability record of ISO/IEC/IEEE 29119-3: from each requirement to its conditions, to the code that implements them, to the verdict, to any defect, and to the existing tests that protect it.

## Core discipline (include in every functional and api reviewer prompt)

```
- Work only from requirements the test basis states, plus oracles derivable from contracts, documentation,
  code contracts (types, docstrings, assertions), and consistency between sibling paths. Cite file and line;
  do not quote long passages. Never invent a requirement.
- Derive test conditions with named techniques: equivalence partitioning, boundary value analysis,
  decision tables, state transitions, scenario (use-case) testing, classification trees, pairwise,
  syntax testing, error guessing. Each requirement gets at least one happy-path, one edge-case, and one
  negative condition where the interface accepts them.
- Verify each condition against the implementation, not against existing tests. Follow the input through
  validation, business logic, persistence, and the response or UI output.
- Record existing tests that exercise each condition separately. A test protects a condition only if it
  drives the relevant input and asserts the relevant outcome; a matching name is not enough.
- Set each requirement's risk level from business and user impact (ISTQB risk-based testing), and say why.
```

## Verdicts

| Verdict | Meaning | Requires |
|---|---|---|
| `pass` | The implementation satisfies the condition | Implementation locations; no defect |
| `fail` | The implementation violates the condition | Implementation locations; a linked `confirmed` finding |
| `not_implemented` | No code implements the condition | No implementation locations; a linked `confirmed` finding |
| `needs_validation` | A decisive fact is outside source and unobserved | A linked `needs_validation` finding, or a `note` naming the blocker |
| `not_testable` | The condition cannot be verified as written | A `note`; `verification_method: null` |

`verification_method` records how the verdict was reached: `source`, `local`, or `staging`. A condition whose verdict is anything but `not_testable` and that has no `existing_tests` is a **coverage gap**: the behavior is unprotected against regression. The validator lists coverage gaps on high- and critical-risk requirements as warnings, and the report lists them as Coverage Gap Warnings.

## Matrix format

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
          "summary": "A refund at captured amount + 0.01 is rejected.",
          "implementation": [{ "file": "src/refunds/service.ts", "line": 42, "description": "Compares with order.total." }],
          "verdict": "fail",
          "verification_method": "local",
          "existing_tests": [],
          "defect_fingerprint": "func-refund-limit-uses-order-total",
          "note": null
        }
      ]
    }
  ]
}
```

- `kind` of a test basis entry is `prd`, `user_story`, `acceptance_criteria`, `readme`, `api_contract`, `documentation`, `code_change`, or `other`.
- Requirement and condition IDs derive from the basis (story key, section number, or a stable slug), never from the run.
- A finding whose oracle is a requirement, contract, or documentation cites the same basis location in its `test_basis`.
- The `api` module adds one requirement per contract operation (basis kind `api_contract`), with conditions for the success response, each documented error response, and validation of each constrained field.

## Universal moves

1. List requirements first, then derive conditions per technique, then trace the implementation. Do not start from the code or the tests.
2. For each condition, read the full path: entry point, validation, business rule, persistence, and output. Check sibling paths (batch, import, admin, retry) that reach the same effect.
3. Search all test levels for existing tests and record them, whatever the verdict.
4. Report a basis that is ambiguous, contradictory, or untestable as `not_testable` with a note and, when it matters, a `FUNC-BASIS-DEFECT` needs-validation finding asking the owner a precise question.
