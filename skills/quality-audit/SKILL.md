---
name: quality-audit
description: Test-quality guidance and audits for automation suites, requirement coverage, and API contract tests (QA, SDET, SEIT). Use for flaky-test and automation anti-pattern review, requirement-to-test traceability, OpenAPI contract and mock drift checks, or a combined quality and security audit. Run the complete workflow only for explicit test-quality audit requests, combined audits, or requested report artifacts.
---

# Quality Audit

Find defects in a test suite that change what its results mean: a false pass, a false fail, a nondeterministic verdict, a missed regression, or a stale contract assumption. Give owners the source evidence, the consequence, a priority, and the smallest effective fix. This is a source-first workflow. A static pattern hit without a concrete consequence for test results is not a confirmed finding.

The workflow mirrors the `security-audit` skill: deterministic coverage, isolated reviewers, independent validation, schema-checked records, and reports derived only from verified records. It follows the test process, documentation, and technique vocabulary of ISO/IEC/IEEE 29119, the ISO/IEC 25010:2023 product quality model, and ISTQB CTFL v4.0 and CTAL-TAE v2.0 terminology. [STANDARDS.md](STANDARDS.md) maps each artifact to those references.

## Operating modes

This skill is guidance by default. Loading it does not authorize the complete audit workflow or file creation.

- **Guidance mode**: For a question about flaky tests, selector strategy, coverage of one feature, or one contract test, use only the relevant module. Do not create an output directory or write audit artifacts. You may run `analyze-test-health.cjs` to stdout as a lead source.
- **Full quality audit mode**: Use the complete workflow when the user explicitly asks to audit test quality, test automation health, test coverage against requirements, or API contract tests, or requests report artifacts. Run all six phases and write the files defined below.
- **Combined audit mode**: Use when the user asks for a quality *and* security audit, a "unified" or "dual" audit, or an SQA audit. Run the `security-audit` skill's full workflow unchanged, run this skill's full workflow, then write `UNIFIED-REPORT.md` as defined in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md). If the `security-audit` skill is not installed beside this one, say so and run only the quality workflow.

If the request could mean either guidance or a full audit, ask one focused question before creating files.

## Platform terminology

This skill is agent-neutral:

- **Parent** is the agent that coordinates the run and owns shared state.
- **Task tool** is the platform's delegation or sub-agent mechanism.
- **`research` agent** is a delegated agent for focused source exploration and factual verification.
- **`general` agent** is a delegated agent for broad investigation and bounded local execution.

Use equivalent platform capabilities while preserving role, write-isolation, prompt, and independence boundaries.

## Execution safety

Source inspection and `analyze-test-health.cjs` are read-only and never execute target code. Running the target's tests is optional evidence, not the default. Run target-controlled builds, tests, browsers, emulators, or mock servers only inside an OS-enforced sandbox with no external network (isolated loopback only), an empty allowlisted environment, a read-only target and toolchain, writes confined to the agent's `scratch/`, and explicit CPU, memory, process, disk, and wall-clock limits. If any control is unavailable, do not execute: keep the lead as `needs_validation` with that blocker.

Never run a suite against a deployed environment, a shared test environment, real accounts, paid APIs, or production data. Do not install or fetch dependencies or browsers. Repeat-run flakiness checks stop at the smallest repeat count that shows a nondeterministic verdict. Use dummy data. Never copy secrets, tokens, or personal data from fixtures into any artifact; cite the file and line instead. A credential-shaped literal in test source is reported by location only, with a note that the owner must rotate it if it is real.

When the security workflow runs in combined mode, its own execution-safety and artifact-promotion rules apply to it unchanged.

## Full audit setup

Resolve these values before reconnaissance:

- **Skill directory**: the absolute directory containing this `SKILL.md`.
- **Target**: the absolute repository root under review.
- **Repo name**: a stable repository identifier from the directory or local Git remote.
- **Output directory**: a new writable directory outside the target, defaulting to `~/quality-audit-skill/<repo-name>/run-<N>`, where `<N>` is the next unused integer. In combined mode, default to `~/sqa-audit/<repo-name>/run-<N>` with `security/` and `quality/` subdirectories; each workflow treats its subdirectory as its output directory. Use a directory inside the target only when the user explicitly selects it and the parent verifies that version control ignores it.
- **Source ref**: the reviewed commit and whether the worktree is dirty.
- **Test basis**: requirement sources for Module B (PRD, user stories, acceptance criteria, README, issue text the user pasted, or the diff under review). If none exists, Module B runs on the diff and README only and says so.

### Write isolation

The parent is the only writer of shared run files:

- `run-metadata.json`
- `test-health.json` (written once by `analyze-test-health.cjs --out`)
- `architecture.md`
- `quality-ledger.json`
- `traceability-matrix.json`
- `quality-findings.json`
- `QUALITY-REPORT.md`
- `UNIFIED-REPORT.md` (combined mode, at the combined output root)

Each reviewer or verifier receives a unique root under `<output-dir>/agents/<agent-id>/` with separate `scratch/` and `artifacts/` directories. Agent IDs match `^[a-z0-9][a-z0-9_-]{0,63}$`. Agents write only to their `scratch/`; only trusted parent-side code promotes an allowlisted regular file into `artifacts/`, using the no-follow, bounded-size promotion procedure in the `security-audit` skill's `SKILL.md`. Agents never edit target source, shared run files, or another agent's directory.

Before delegation, write `run-metadata.json` with at least `run_id`, `repo`, `target`, `source_ref`, `profile`, `modules` (subset of `sdet`, `qa`, `seit`), `scope_paths`, `test_basis_paths`, `budget` (null if unset), `execution_policy: "sandboxed-source-and-local-only"`, `combined_with_security` (boolean), and `run_status: "in_progress"`.

### Profiles, scope, and budget

- **`quick`** — one reviewer wave, one final coverage critic, one verifier per candidate for both validation and record verification. Ledger units are coarse: one per module per test suite or contract.
- **`standard`** — the workflow as written.
- **`deep`** — units split per suite directory, requirement area, and contract; critic waves until a clean pass; validation and final verification are separate agents.

A scoped run seeds units only for in-scope paths and records the rest `out_of_scope`. A budget is a maximum number of agent invocations. Reserve one final critic and at least one verifier before assigning reviewers. In combined mode, split the user's budget between the two workflows before either starts and record both shares; never let one workflow consume the other's reserve. Profiles change breadth, never the evidence bar.

## Core principles

### Require a consequence for test results

Every candidate names the test or suite, the defect in it, and the concrete effect on its verdict: it can pass while the behavior is broken, fail while the behavior is correct, change verdict between identical runs, miss a regression in a named requirement, or assert against a contract the system no longer has. A missing best practice with no such effect is a hardening note.

### Static hits are leads

`analyze-test-health.cjs` produces deterministic leads, the health score, and the flakiness risk index. A hit becomes a finding only after a reviewer traces the consequence and a fresh verifier fails to disprove it. Record every scanner hit that a reviewer rejected, so the false-positive rate is measurable per rule.

### Respect source visibility

CI configuration, retry policy, test environment data, feature flags, and deployed API versions are real context. If a decisive fact is outside the repository, use `needs_validation` with the exact missing fact and a safe owner-observed plan.

### Separate priority from certainty

Only `confirmed` records get severity. Calibrate with these anchors:

- **critical** — the gating suite can no longer fail for a release-blocking behavior: a committed focused test that disables the rest of a CI-gating suite, or contract tests for a critical API that cannot detect any response change.
- **high** — a test gating a critical or high-risk flow passes while the flow is broken (no assertion, swallowed failure, mock contradicting the current contract, schema never validated), or a critical-risk requirement has no test condition covered.
- **medium** — a demonstrable nondeterminism source in a CI-gating test, partial coverage of a high-risk requirement, or a stale mock on a non-critical path.
- **low** — a maintainability defect with a concrete cost: a brittle selector on markup the diff shows changing, duplicated locators across many specs without a page object or fixture.
- **informational** — a confirmed observation with minimal effect on verdicts.

Overall severity reflects the risk level of the requirement or flow the test protects (ISTQB risk-based testing), not the size of the code smell.

### Recommend the smallest effective fix

Name the invariant the test must enforce (deterministic synchronization, a web-first assertion, a stable locator, schema validation, a covered boundary) and the narrowest change that enforces it. The audit describes fixes and missing test cases; it does not modify target source.

## Full audit workflow

1. **Reconnaissance** — run `analyze-test-health.cjs`, map test architecture, frameworks, test basis, contracts, and mocks, and seed `quality-ledger.json` with [RECONNAISSANCE.md](RECONNAISSANCE.md).
2. **Module review waves** — follow [REVIEW-WAVES.md](REVIEW-WAVES.md) to assign isolated reviewers per ledger unit with the selected module blocks from [SDET-AUTOMATION-HEALTH.md](SDET-AUTOMATION-HEALTH.md), [QA-COVERAGE-TRACEABILITY.md](QA-COVERAGE-TRACEABILITY.md), and [SEIT-API-CONTRACT.md](SEIT-API-CONTRACT.md), followed by coverage critics.
3. **Candidate validation** — give every unique candidate to a fresh verifier that tries to disprove it.
4. **Structured output** — write `quality-findings.json` and `traceability-matrix.json`, then run `node <skill-dir>/validate-quality-run.cjs <output-dir>`.
5. **Independent record verification** — fresh agents verify final records; material replacements get another independent verifier.
6. **Reporting** — derive `QUALITY-REPORT.md` (and `UNIFIED-REPORT.md` in combined mode) from verified records, the ledger, and `test-health.json`.

Phases 3–6 are defined in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md). In combined mode, the security workflow's Phase 1 and this workflow's Phase 1 may run in parallel; each later phase stays inside its own workflow; only `UNIFIED-REPORT.md` reads both.

Do not end the run before one of two terminal states: (a) all reports are written and the validator passes, or (b) `run_status: "incomplete"` is recorded with its exact reason and the gap is disclosed in the report.

## Anti-patterns

1. Reporting every `sleep` or XPath as a finding without showing the effect on the verdict.
2. Inventing requirements that the test basis does not state, then reporting them as coverage gaps.
3. Counting a test as coverage because its name matches, without reading what it asserts.
4. Treating line or branch coverage percentages as requirement coverage.
5. Running the suite against a shared or deployed environment to "prove" flakiness.
6. Presenting the health score or flakiness index as a measured flake rate.
7. Assigning severity to `needs_validation` records.
8. Copying fixture secrets or personal data into findings or reports.
9. Writing the report before independent verification or letting prose and JSON disagree.
10. Changing a security verdict or severity in the unified report.
