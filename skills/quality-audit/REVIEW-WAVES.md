# Module Review Waves

### Phase 2: Run coverage-led review waves

The parent assigns `planned` ledger units to reviewers: `general` agents for Module A (they may need a sandboxed repeat run), and `research` agents for Modules B and C. One reviewer may own closely related units of one module; no unit may be silently dropped because of an agent-count limit. A unit the budget cannot reach becomes `deferred` with reason `budget_cannot_reserve_critic_and_validation`.

Before launch, the parent sets each assigned unit to `in_progress` with a canonical `agent_id` and creates that agent's `scratch/` and parent-owned `artifacts/`.

## Required reviewer prompt

Every reviewer prompt contains, in order:

1. A two-sentence role preamble: the reviewer finds test-quality defects with a concrete effect on test verdicts in its assigned units, and returns exactly one JSON object matching the result contract at the end of the prompt.
2. `architecture.md` verbatim.
3. Assigned unit IDs, scopes, and starting paths.
4. The selected module's `Core discipline` block, the chosen class subsections, `Universal moves`, and `Validation rules`, copied verbatim. Do not send file or class names alone.
5. For Module A units: the `test-health.json` hits whose files fall inside the unit, as rule ID, file, and line only.
6. For Module B units: the requirement list for the unit's area from `architecture.md`, with basis file and line.
7. For Module C units: the operation table rows for the unit's contract.
8. The execution-safety paragraph from `SKILL.md`, the agent's scratch path, and the promotion allowlist for any local check.
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
        { "agent_id": "canonical owner", "check": "what was checked", "method": "source|local", "result": "what it established" }
      ],
      "candidate_fingerprints": [],
      "unresolved": []
    }
  ],
  "candidates": [],
  "scanner_hits": [
    { "rule_id": "SDET-HARD-WAIT", "file": "repo/relative/path", "line": 1, "decision": "candidate|rejected", "reason": "..." }
  ],
  "matrix_rows": [],
  "hardening": ["concrete non-finding note"],
  "uncovered": [
    { "module": "sdet|qa|seit", "scope": "...", "starting_paths": ["repo/relative/path"], "reason": "why this needs its own unit" }
  ]
}
```

- Each `candidates` entry is a schema-shaped `confirmed` or `needs_validation` record with `proposed_verdict` in place of `verdict`.
- Module A reviewers decide every assigned scanner hit in `scanner_hits`. The parent keeps these decisions so the report can state the per-rule false-positive rate.
- Module B reviewers return `matrix_rows`: complete `requirements` entries for their area, in the matrix shape from [QA-COVERAGE-TRACEABILITY.md](QA-COVERAGE-TRACEABILITY.md).
- Every assigned unit appears exactly once. `covered` has paths and checks and no fingerprints or unresolved facts; `candidate` links fingerprints; `blocked` has unresolved facts and no fingerprints.
- Fingerprints are source-derived, match `^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$`, and contain no line, wave, agent, severity, or verdict.

## Parent consolidation

The parent validates each unit result and updates only that ledger unit: owner, reviewed paths, checks, fingerprints, and unresolved facts. A malformed result leaves the unit `planned` for reassignment. Consolidate candidates by fingerprint, then by root cause: one helper's hard wait used by twenty specs is one candidate listing the helper and the most important call sites. Merge `matrix_rows` by `requirement_id`. Retain `hardening` and `scanner_hits` in parent bookkeeping (`<output-dir>/bookkeeping.json`). Run `validate-quality-run.cjs` after every ledger update; an invalid ledger cannot drive another assignment.

## Coverage critics

After each wave, a fresh `research` critic receives `architecture.md`, the ledger, the merged matrix, and `test-health.json`, and returns:

```json
{ "missing_units": [{ "module": "...", "scope": "...", "starting_paths": ["..."], "reason": "..." }], "reassign_ids": [], "stop": false }
```

It checks for: high-risk flakiness files with no unit; CI-gating suites not reviewed; requirements with no conditions or with conditions missing a negative or boundary case; contract operations missing from the operation table; mocks with no linked operation; and units closed without paths or checks. It proposes coverage, not findings.

The parent adds accepted units and repeats waves until a critic accepts no work (`standard`), or until a separate final-clean critic also accepts none (`deep`). A `quick` run has one wave and one critic; accepted work becomes `deferred` with reason `quick_profile_final_critic`. Never treat an agent or wave cap as complete coverage.
