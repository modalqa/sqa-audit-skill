# Quality Validation and Reporting

### Phase 3: Independently validate every candidate

Give every unique candidate to a fresh verifier that did not review its unit: `general` for Module A candidates that claim nondeterminism and the suite can run offline in the sandbox, `research` otherwise. The verifier receives the candidate record, the module's `Core discipline` and `Validation rules` blocks, `architecture.md`, and the repository. It does not receive the reviewer's prose.

The verifier tries to disprove the candidate:

1. Re-read every location and the code under test it depends on. Is the line real and does it do what the record says?
2. Look for a preventing control: framework auto-wait, retrying assertion, fixture isolation, `forbidOnly`, schema validation in a shared helper, a test at another level covering the condition, a contract test elsewhere in the repository.
3. Re-derive the verdict effect. Can this test really pass while the behavior is broken, fail while it is correct, or change verdict between identical runs?
4. For a coverage gap, search all test levels again for the condition. For contract drift, re-diff the mock or assertion against the contract and DTO.
5. Optionally, within the sandbox, repeat a single affected test a bounded number of times, or run an existing local schema validator against a mock fixture. Record the command, limits, and result; promote only an allowlisted result file.

It returns exactly one JSON object: a schema-shaped `confirmed`, `needs_validation`, or `rejected` record. A prose-wrapped or malformed result is discarded and re-run with a fresh verifier when the budget permits. The parent updates the linked ledger unit with the decision.

### Phase 4: Write and validate run files

The parent writes, sorted by fingerprint, all independently decided records to `<output-dir>/quality-findings.json`, and the merged matrix to `<output-dir>/traceability-matrix.json` when Module B ran. Read `quality-report-schema.json` immediately before writing; records use `additionalProperties: false`.

- `confirmed` carries `root_cause`, `consequence`, `evidence`, `remediation`, `severity`, and `confidence`.
- `needs_validation` carries `claimed_root_cause`, `blockers`, and `validation_plan`, and never severity.
- `rejected` carries `claimed_root_cause` and `reason`.
- Every record carries `module`, a `rule` whose prefix matches the module, an ISO/IEC 25010:2023 `quality_characteristic` (except `rejected`), and repository-relative `locations`. A `qa` record cites its `test_basis`.

Run:

```sh
node <skill-dir>/validate-quality-run.cjs <output-dir>
```

The validator checks the schema; sorted, unique fingerprints; rule/module agreement; safe paths; that every finding is linked from a ledger unit of the same module; ledger state contracts; and matrix rules (coverage claims link test cases, high-risk gaps link a `qa` finding). It warns, rather than fails, on a candidate still awaiting validation in an incomplete run. Fix every error before continuing. Validator success proves format and consistency only.

### Phase 5: Verify the final records with fresh eyes

Launch one fresh `research` verifier per `confirmed` and `needs_validation` record (in `quick`, Phase 3 and 5 merge). For `confirmed`, it checks every location, the preventing-control search, the consequence, the severity against the anchors in `SKILL.md` and the protected requirement's risk level, and whether the remediation enforces the invariant. For `needs_validation`, it checks that every blocker is decisive and the plan is exact.

It returns `{"decision":"verified","fingerprint":"..."}` or `{"decision":"replace","reason":"...","record":{...}}`. A replacement that strengthens the verdict or materially changes the root cause, consequence, or severity goes to another fresh verifier before it applies. Rerun the validator after every applied replacement. Set `run_status: "complete"` only when every ledger candidate has a final decision and every retained record passed Phase 5.

### Phase 6: Produce reports from final records

Derive prose only from `quality-findings.json`, `traceability-matrix.json`, `quality-ledger.json`, `test-health.json`, and bookkeeping. Prose never changes a verdict, severity, or blocker.

#### `QUALITY-REPORT.md`

1. **Run summary** — profile, modules, scope, source ref, test basis used, budget spent versus planned, execution statement, prior-run use, and any partial-coverage disclosure.
2. **Test Automation Health Score** — `health_score` from `test-health.json` (0–100, or "n/a" with no test files), the formula (each rule weight point costs 5 points in its file, floored at 0; the suite score is the mean across scanned test files), rule counts, and the per-rule reviewer rejection rate from bookkeeping. State that it is a static heuristic, not a measured flake rate.
3. **Flakiness Risk Index** — the top entries of `flakiness_risk_index` (file, risk level, rules, lines), each marked with its validation outcome: confirmed fingerprint, rejected, or not reviewed.
4. **Confirmed findings table** — severity, module, rule, ISO/IEC 25010 characteristic, title, and one-line consequence. Then each finding: locations, consequence, protected requirement or flow, evidence, and smallest fix.
5. **Coverage Gap Warnings** — from the matrix: per requirement, risk level and condition counts by status, then each `partial` or `uncovered` condition with its technique and linked finding. Include a traceability summary: requirements traced, conditions covered/partial/uncovered/not testable.
6. **Contract Mismatch Alerts** — every `seit` finding, grouped by operation, with contract and test or mock locations.
7. **Needs validation** — separate table with blocker and plan, no severity.
8. **Hardening notes and positive patterns.**
9. **Coverage statement** — ledger counts by status, deferred and out-of-scope units, the final critic result.

#### `UNIFIED-REPORT.md` (combined mode only)

Write at the combined output root after both workflows reach a terminal state. It reads `security/findings.json`, `security/REPORT.md`, and the quality files; it changes no verdict or severity in either.

1. **Run summary** — both run states, profiles, budgets, and source ref. If either workflow is incomplete, say so first.
2. **Security Vulnerabilities** — the confirmed security table (severity, title, boundary, observed result) and, per finding, a category label and a pointer to its reproduction and remediation in `security/FINDINGS-DETAIL.md`. Use a CWE or OWASP Top 10 category only when the record's root cause clearly matches one, and mark it as the reporter's classification. Never invent a CVE identifier; a CVE applies only to a published advisory the record itself cites.
3. **Quality and Test Health** — the health score, the top of the flakiness risk index, coverage gap warnings, and contract mismatch alerts, summarized from `QUALITY-REPORT.md`.
4. **Cross-links** — security findings whose vulnerable path has no test (a `qa` gap or no test location for the sink), and `SDET-INLINE-SECRET` locations that the security workflow should treat as leads. List these as links between existing records only; neither side gains a new finding here.
5. **Needs validation** — both workflows' leads in two separate tables.
6. **Coverage limits** — both coverage statements.
