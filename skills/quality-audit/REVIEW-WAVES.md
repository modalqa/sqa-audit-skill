# Review Waves

### Phase 2: Run coverage-led review waves

The parent assigns `planned` ledger units to reviewers: `general` agents when a unit may need sandboxed execution or authorized staging checks, `research` agents for source-only units. One reviewer may own closely related units of one module; no unit may be silently dropped because of an agent-count limit. A unit the budget cannot reach becomes `deferred` with reason `budget_cannot_reserve_critic_and_validation`.

Before launch, the parent sets each assigned unit to `in_progress` with a canonical `agent_id` and creates that agent's `scratch/` and parent-owned `artifacts/`.

## Required reviewer prompt

Every reviewer prompt contains, in order:

1. A two-sentence role preamble: the reviewer verifies the application against the assigned test conditions and finds defects with an oracle and an observed or source-evident failure, and returns exactly one JSON object matching the result contract at the end of the prompt.
2. `architecture.md` verbatim.
3. Assigned unit IDs, scopes, and starting paths.
4. The `Core discipline` block from [TRACEABILITY.md](TRACEABILITY.md) (for `functional` and `api` units), then the selected module's `Core discipline` block, chosen class subsections, `Universal moves`, and `Validation rules`, copied verbatim. Do not send file or class names alone.
5. The unit's current matrix rows from `traceability-matrix.json`.
6. For `testware` units: the `test-health.json` hits whose files fall inside the unit, as rule ID, file, and line only.
7. The execution-safety section from `SKILL.md`, the agent's scratch path, and the promotion allowlist. For a staging assignment, the full rules block from [STAGING-TESTING.md](STAGING-TESTING.md), the allowed origins, write permission, credential variable names, and this agent's request allowance.
8. The test conventions section of `architecture.md`, so regression scripts match the repository.
9. The structured result contract below and the `confirmed` and `needs_validation` branches of `quality-report-schema.json` (the `findings` section and its `definitions`) copied verbatim.

## Structured reviewer result

Return exactly one JSON object, with no surrounding prose:

```json
{
  "units": [
    {
      "unit_id": "one assigned ID",
      "disposition": "covered|candidate|blocked",
      "reviewed_paths": ["repo/relative/path"],
      "checks": [
        { "agent_id": "canonical owner", "check": "what was checked", "method": "source|local|staging", "result": "what it established" }
      ],
      "candidate_fingerprints": [],
      "unresolved": []
    }
  ],
  "candidates": [],
  "matrix_rows": [],
  "scanner_hits": [],
  "staging_requests_used": 0,
  "hardening": ["concrete non-finding note"],
  "uncovered": [
    { "module": "functional|api|nonfunctional|testware", "scope": "...", "starting_paths": ["repo/relative/path"], "reason": "why this needs its own unit" }
  ]
}
```

- Each `candidates` entry is a schema-shaped `confirmed` or `needs_validation` record with `proposed_verdict` in place of `verdict`. Confirmed candidates include the regression test case and script.
- `matrix_rows` are complete `requirements` entries for the unit's area in the matrix format from [TRACEABILITY.md](TRACEABILITY.md), with every condition's verdict, implementation, existing tests, and linked fingerprint.
- `testware` reviewers decide every assigned scanner hit in `scanner_hits` as `{ "rule_id", "file", "line", "decision": "candidate|rejected", "reason" }`, so the report can state the per-rule false-positive rate.
- Every assigned unit appears exactly once. `covered` has paths and checks and no fingerprints or unresolved facts; `candidate` links fingerprints; `blocked` has unresolved facts and no fingerprints.
- Fingerprints are source-derived, match `^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$`, and contain no line, wave, agent, severity, or verdict.

## Parent consolidation

The parent validates each unit result and updates only that ledger unit: owner, reviewed paths, checks, fingerprints (as `result_fingerprints`), and unresolved facts. A malformed result leaves the unit `planned` for reassignment. Consolidate candidates by fingerprint, then by root cause: one shared helper defect reached from several features is one candidate. Merge `matrix_rows` by `requirement_id`, replacing placeholder rows. Add `staging_requests_used` to the run total and stop assigning staging work when the limit is reached. Retain `hardening` and `scanner_hits` in `<output-dir>/bookkeeping.json`. Run `validate-quality-run.cjs` after every ledger update; an invalid ledger cannot drive another assignment.

## Coverage critics

After each wave, a fresh `research` critic receives `architecture.md`, the ledger, the merged matrix, and (if present) `test-health.json`, and returns:

```json
{ "missing_units": [{ "module": "...", "scope": "...", "starting_paths": ["..."], "reason": "..." }], "reassign_ids": [], "stop": false }
```

It checks for: requirements with no conditions, or conditions missing a negative or boundary case; conditions still at placeholder verdicts; main use cases or entry points with no unit; contract operations with no matrix row; integrations with no failure-path check; stated non-functional requirements with no unit; and units closed without paths or checks. It proposes coverage, not findings.

The parent adds accepted units and repeats waves until a critic accepts no work (`standard`), or until a separate final-clean critic also accepts none (`deep`). A `quick` run has one wave and one critic; accepted work becomes `deferred` with reason `quick_profile_final_critic`. Never treat an agent or wave cap as complete coverage.
