# Quality Validation and Reporting

### Phase 3: Independently validate every candidate

Give every unique candidate to a fresh verifier that did not review its unit: `general` when the candidate can be reproduced in the sandbox or on authorized staging, `research` otherwise. The verifier receives the candidate record, the module's `Core discipline` and `Validation rules` blocks, the relevant matrix rows, `architecture.md`, and the repository. It does not receive the reviewer's prose.

The verifier tries to disprove the candidate:

1. Re-read every location. Is the code path real, and does it produce the stated actual result for the stated input?
2. Re-check the oracle. Does the test basis, contract, or code contract really require the expected result? Is there a later requirement, flag, or configuration that changes it?
3. Look for a preventing control: framework validation, database constraints, middleware, a shared helper, or a caller that never passes the triggering input.
4. When sandboxed execution is available, run the proposed regression test against a disposable copy of the current source. It must fail for the reported reason. Record the command, limits, and result, and set `verified_failing` accordingly. If the test fails for another reason, fix the test or reject the candidate.
5. When the decisive behavior depends on deployment and staging is authorized, perform the minimum staging check under [STAGING-TESTING.md](STAGING-TESTING.md).

It returns exactly one JSON object: a schema-shaped `confirmed`, `needs_validation`, or `rejected` record. A prose-wrapped or malformed result is discarded and re-run with a fresh verifier when the budget permits. The parent updates the linked ledger unit and the matrix condition with the decision.

### Phase 4: Write and validate run files

The parent writes all independently decided records, sorted by fingerprint, to `<output-dir>/quality-findings.json`, and the final matrix to `<output-dir>/traceability-matrix.json`. Read `quality-report-schema.json` immediately before writing; records use `additionalProperties: false`.

- `confirmed` carries `root_cause`, `oracle`, `reproduction` (method, environment, preconditions, steps, input, expected and actual result, artifact), `impact`, `remediation`, `regression_test` (level, test case, script, `verified_failing`), `severity`, and `confidence`.
- `needs_validation` carries `claimed_root_cause`, `blockers`, `validation_plan`, and `proposed_test_case`, and never severity.
- `rejected` carries `claimed_root_cause` and `reason`.
- Every record carries `module`, a `rule` whose prefix matches the module, an ISO/IEC 25010:2023 `quality_characteristic` (except `rejected`), and repository-relative `locations`.

Run:

```sh
node <skill-dir>/validate-quality-run.cjs <output-dir>
```

The validator checks:

- the schema;
- sorted, unique fingerprints and rule/module agreement;
- safe paths, including regression script paths;
- that requirement, contract, and documentation oracles cite their test basis;
- that local and staging reproductions link promoted artifacts, and that `verified_failing` is not claimed for a source-only reproduction;
- that regression scripts contain no credential-shaped literals;
- that every finding is linked from a ledger unit of the same module, and ledger state contracts;
- matrix verdict rules (`fail` and `not_implemented` link a confirmed application finding, `pass` cites its implementation).

It warns on a candidate still awaiting validation in an incomplete run and lists untested high-risk conditions as coverage gaps. Fix every error before continuing. Validator success proves format and consistency only.

### Phase 5: Verify the final records with fresh eyes

Launch one fresh `research` verifier per `confirmed` and `needs_validation` record (in `quick`, Phases 3 and 5 merge). For `confirmed`, it checks every location, the oracle and test basis, the reproduction, the impact, the severity against the anchors in `SKILL.md` and the requirement's risk level, whether the remediation enforces the invariant, and whether the regression test detects the defect, follows repository conventions, and contains no real data or credentials. For `needs_validation`, it checks that every blocker is decisive and that the plan and proposed test case are exact.

It returns `{"decision":"verified","fingerprint":"..."}` or `{"decision":"replace","reason":"...","record":{...}}`. A replacement that strengthens the verdict or materially changes the root cause, reproduction, impact, or severity goes to another fresh verifier before it applies. Rerun the validator after every applied replacement. Set `run_status: "complete"` only when every ledger candidate has a final decision and every retained record passed Phase 5.

### Phase 6: Produce reports from final records

Derive everything only from `quality-findings.json`, `traceability-matrix.json`, `quality-ledger.json`, bookkeeping, and (for `testware`) `test-health.json`. Prose never changes a verdict, severity, or blocker.

#### `regression-tests/`

For each `confirmed` record, the parent writes `regression_test.script.code` to `<output-dir>/regression-tests/<script.file>`, creating each file exclusively. Write `regression-tests/README.md` listing each script with its fingerprint, test level, framework, whether it was verified failing, and the environment variables it reads. Owners copy these into the repository; the audit never writes into the target.

#### `QUALITY-REPORT.md`

The structure follows the test completion report of ISO/IEC/IEEE 29119-3.

1. **Run summary** — profile, modules, scope, source ref, test basis used, execution policy (source and local, or with authorized staging and the requests used), budget spent versus planned, prior-run use, and any partial-coverage disclosure.
2. **Quality summary** — confirmed defects by severity and module, requirement verification results (conditions by verdict), and the three highest risks in one paragraph.
3. **Defect summary table** — severity, module, rule, ISO/IEC 25010 characteristic, title, and one-line impact.
4. **Defect reports** — for each confirmed record: locations, oracle and test basis, environment, preconditions, steps, input, expected and actual result, impact, smallest fix, and the regression test case with a link to its script in `regression-tests/` and whether it was verified failing.
5. **Requirement verification** — per requirement: risk level and conditions by verdict, then every `fail`, `not_implemented`, and `needs_validation` condition with its technique and linked finding.
6. **Coverage Gap Warnings** — conditions with no existing test, ordered by requirement risk level. Each lists the recommended test from the linked finding or a short test idea.
7. **Contract Mismatch Alerts** — every `api` finding, grouped by operation, with contract and implementation locations.
8. **Non-functional findings** — every `nonfunctional` finding, grouped by characteristic.
9. **Needs validation** — separate table with blocker, plan, and proposed test case; no severity.
10. **Testware health** (only if the module ran) — Test Automation Health Score with its formula (each rule weight point costs 5 points in its file, floored at 0; the suite score is the mean across scanned test files), the top of the Flakiness Risk Index with each entry's validation outcome, `testware` findings, and per-rule reviewer rejection rates. State that the score describes the test suite, not the application, and is a static heuristic rather than a measured flake rate.
11. **Hardening notes and positive patterns.**
12. **Coverage statement** — ledger counts by status, deferred and out-of-scope units, the final critic result, and residual risk.

#### `UNIFIED-REPORT.md` (combined mode only)

Write at the combined output root after both workflows reach a terminal state. It reads `security/findings.json`, `security/REPORT.md`, and the quality files, and changes no verdict or severity in either.

1. **Run summary** — both run states, profiles, budgets, execution policies, and source ref. If either workflow is incomplete, say so first.
2. **Security Vulnerabilities** — the confirmed security table (severity, title, boundary, observed result) and, per finding, a category label and a pointer to its reproduction and remediation in `security/FINDINGS-DETAIL.md`. Use a CWE or OWASP Top 10 category only when the record's root cause clearly matches one, and mark it as the reporter's classification. Never invent a CVE identifier; a CVE applies only to a published advisory the record itself cites.
3. **Quality Defects** — the defect summary table, requirement verification results, Coverage Gap Warnings, Contract Mismatch Alerts, and non-functional findings, summarized from `QUALITY-REPORT.md`.
4. **Cross-links** — security findings whose affected flow also has a quality defect or a coverage gap, and quality observations that were handed to the security workflow as leads. These are links between existing records only; neither side gains a new finding here.
5. **Needs validation** — both workflows' leads in two separate tables.
6. **Coverage limits** — both coverage statements.
