---
name: quality-audit
description: QA testing of an application's own codebase. Finds functional, API/integration, and non-functional defects against requirements, contracts, and documentation, and gives each defect a reproduction plus a recommended regression test case and script. Use for QA review, requirement verification, bug hunting, API contract conformance, or a combined quality and security (SQA) audit. Run the complete workflow only for explicit QA/quality audit requests, combined audits, or requested report artifacts.
---

# Quality Audit

Test the application in the repository the way a QA engineer would. Derive test conditions from the test basis, verify the implementation against each one, and find defects that make the product behave differently from what it is supposed to do. For every confirmed defect, give owners the evidence, a reproduction, the impact, a priority, the smallest effective fix, and a regression test case with a ready-to-commit test script.

This is a source-first workflow. Static analysis establishes the code path. Sandboxed local execution and, only when the user authorizes it, checks against a named staging environment establish the observed failure. A suspicion without an oracle (a stated or derivable expected result) is not a defect.

The workflow mirrors the `security-audit` skill: deterministic coverage, isolated reviewers, independent validation, schema-checked records, and reports derived only from verified records. It follows ISO/IEC/IEEE 29119 for process, documentation, and techniques, the ISO/IEC 25010:2023 product quality model, and ISTQB CTFL v4.0 and CTAL-TAE v2.0 terminology. [STANDARDS.md](STANDARDS.md) maps each artifact to those references.

## Modules

| Module | Rule prefix | File | Default |
|---|---|---|---|
| `functional` — requirement verification and functional defects | `FUNC-` | [FUNCTIONAL-TESTING.md](FUNCTIONAL-TESTING.md) | on |
| `api` — API contract conformance and integration behavior | `API-` | [API-AND-INTEGRATION.md](API-AND-INTEGRATION.md) | on when the app exposes or consumes an API |
| `nonfunctional` — reliability, performance efficiency, compatibility, interaction capability, flexibility | `NFR-` | [NON-FUNCTIONAL.md](NON-FUNCTIONAL.md) | on |
| `testware` — health of the existing test suite (flakiness, anti-patterns, mock drift) | `SDET-` | [TESTWARE-HEALTH.md](TESTWARE-HEALTH.md) | off; runs only when asked |

[TRACEABILITY.md](TRACEABILITY.md) defines the requirement → test condition → implementation → verdict matrix that ties the modules together.

## Operating modes

This skill is guidance by default. Loading it does not authorize the complete workflow or file creation.

- **Guidance mode**: For a question about one function, endpoint, flow, or requirement, use only the relevant module. Do not create an output directory or write audit artifacts.
- **Full quality audit mode**: Use the complete workflow when the user explicitly asks for a QA audit, quality audit, requirement verification of the codebase, or bug hunt across the repository, or requests report artifacts. Run all six phases and write the files defined below.
- **Combined audit mode**: Use when the user asks for a quality *and* security audit, a "unified" or "dual" audit, or an SQA audit. Run the `security-audit` skill's full workflow unchanged, run this workflow, then write `UNIFIED-REPORT.md` as defined in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md). If `security-audit` is not installed beside this skill, say so and run only this workflow.

If the request could mean either guidance or a full audit, ask one focused question before creating files.

## Platform terminology

This skill is agent-neutral:

- **Parent** is the agent that coordinates the run and owns shared state.
- **Task tool** is the platform's delegation or sub-agent mechanism.
- **`research` agent** is a delegated agent for focused source exploration and factual verification.
- **`general` agent** is a delegated agent for broad investigation and bounded local or staging execution.

Use equivalent platform capabilities while preserving role, write-isolation, prompt, and independence boundaries.

## Execution safety

Evidence comes from three places, in this order of preference:

1. **Source** — reading code, configuration, and documentation. Always allowed.
2. **Local sandbox** — running the application's code, existing tests, a minimal harness, or a proposed regression test on a disposable copy. Allowed only inside an OS-enforced sandbox with no external network (isolated loopback only), an empty allowlisted environment, a read-only target and toolchain, writes confined to the agent's `scratch/`, and explicit CPU, memory, process, disk, and wall-clock limits. Do not install or fetch dependencies. If a control is unavailable, do not execute; keep the lead as `needs_validation` with that blocker.
3. **Authorized staging** — black-box checks against a staging or development environment, only when the user names its exact origin in this run and confirms it is not production. Follow every rule in [STAGING-TESTING.md](STAGING-TESTING.md): origin allowlist, read-only unless writes are explicitly allowed, rate and request limits, no load or exploit traffic, credentials from environment variables only, and no recording of response data that may contain personal information.

Never test production, real customer accounts, other users' data, paid third-party APIs, or any host the user did not name. Never copy secrets, tokens, or personal data into any artifact; cite the file and line, or describe the field shape, instead. Stop at the smallest observation that shows the failure.

In combined mode, the `security-audit` workflow keeps its own source-and-local-only rules; staging access applies only to this workflow. A security-relevant observation made during staging checks is handed to the security workflow as a lead, not exploited.

## Full audit setup

Resolve these values before reconnaissance:

- **Skill directory**: the absolute directory containing this `SKILL.md`.
- **Target**: the absolute repository root under test.
- **Repo name**: a stable repository identifier from the directory or local Git remote.
- **Output directory**: a new writable directory outside the target, defaulting to `~/quality-audit-skill/<repo-name>/run-<N>`. In combined mode, default to `~/sqa-audit/<repo-name>/run-<N>` with `security/` and `quality/` subdirectories. Use a directory inside the target only when the user explicitly selects it and the parent verifies that version control ignores it.
- **Source ref**: the reviewed commit and whether the worktree is dirty.
- **Test basis**: requirement sources (PRD, user stories, acceptance criteria, README, API contracts, documentation, issue text the user pasted, or the diff under review). Save pasted text as `<output-dir>/basis/<basis-id>.md`. If no basis exists, derive oracles from documentation, contracts, and code consistency, and say so in the report.
- **Staging** (optional): the exact allowed origins, whether writes are allowed, the test-account environment variable names, and the user's confirmation that the environment is non-production and that they are authorized to test it.

### Write isolation

The parent is the only writer of shared run files:

- `run-metadata.json`
- `architecture.md`
- `quality-ledger.json`
- `traceability-matrix.json`
- `quality-findings.json`
- `test-health.json` (testware module only, written once by `analyze-test-health.cjs --out`)
- `regression-tests/` (materialized from confirmed records in Phase 6)
- `QUALITY-REPORT.md`
- `UNIFIED-REPORT.md` (combined mode, at the combined output root)

Each reviewer or verifier receives a unique root under `<output-dir>/agents/<agent-id>/` with separate `scratch/` and `artifacts/` directories. Agent IDs match `^[a-z0-9][a-z0-9_-]{0,63}$`. Agents and target processes write only to `scratch/`. Only trusted parent-side code promotes an allowlisted regular file into `artifacts/`, using the no-follow, bounded-size promotion procedure in the `security-audit` skill's `SKILL.md`. Agents never edit target source, shared run files, or another agent's directory.

Before delegation, write `run-metadata.json` with at least `run_id`, `repo`, `target`, `source_ref`, `profile`, `modules`, `scope_paths`, `test_basis_paths`, `budget` (null if unset), `execution_policy` (`"source-and-local"` or `"source-local-and-authorized-staging"`), `staging` (null, or `allowed_origins`, `writes_allowed`, `credential_env_vars`, `request_limit`, `user_confirmed_non_production`), `combined_with_security`, and `run_status: "in_progress"`.

### Profiles, scope, and budget

- **`quick`** — one reviewer wave, one final coverage critic, one verifier per candidate for both validation and record verification. One ledger unit per module per feature area.
- **`standard`** — the workflow as written.
- **`deep`** — units split per feature, endpoint group, and lifecycle; critic waves until a clean pass; validation and final verification are separate agents.

A scoped run seeds units only for in-scope paths or features and records the rest `out_of_scope`. A budget is a maximum number of agent invocations; reserve one final critic and at least one verifier before assigning reviewers. In combined mode, split the user's budget between the two workflows before either starts. Profiles change breadth, never the evidence bar.

## Core principles

### Require an oracle and a failure

Every candidate names the test condition, the oracle that defines the expected result (requirement, contract, documentation, code contract such as a type or docstring, consistency between sibling paths, or a well-established domain rule), the input or state that triggers it, and the actual result. "This looks wrong" without an oracle is a question for the owner (`needs_validation`), not a defect.

### Use bounded evidence

Source review establishes the path. A sandboxed run of an existing test, a minimal harness, or the proposed regression test establishes the failure. Staging checks establish behavior that depends on deployment. Prefer the proposed regression test as the reproduction: when it runs and fails for the reported reason, set `verified_failing: true`.

### Respect source visibility

Feature flags, configuration, data, and integrations outside the repository are real context. If a decisive fact is outside source and no authorized staging check can observe it, use `needs_validation` with the exact missing fact and a safe plan.

### Separate severity, priority, and certainty

Only `confirmed` records get severity. Severity is the defect's impact (ISTQB); priority is the business's decision and belongs to the owner. Calibrate severity with these anchors:

- **critical** — data loss or corruption, wrong monetary or legal calculation, a core user flow unusable for all users, or a crash or hang of a shared service on ordinary input.
- **high** — a main function produces a wrong result or is unusable for a significant user group with no reasonable workaround, or a high-risk requirement is not implemented.
- **medium** — a function fails on edge inputs, a less common path, or with a workaround available; an API response violates its contract on a non-critical operation.
- **low** — minor functional deviation, misleading message, or cosmetic inconsistency with a concrete user effect.
- **informational** — a confirmed deviation with negligible effect.

Severity reflects the risk level of the requirement or flow affected, not the size of the code change.

### Recommend the smallest effective fix and a regression test

Name the invariant the code must enforce and the narrowest change that enforces it. Every confirmed defect carries a regression test case (preconditions, steps, expected result) and a script in the repository's existing test framework and conventions, at the lowest test level that can detect the defect. Scripts read credentials from environment variables and contain no real data. The audit describes fixes and tests; it does not modify target source.

## Full audit workflow

1. **Reconnaissance** — map the product, features, test basis, architecture, run commands, existing tests, and contracts, and seed `quality-ledger.json` with [RECONNAISSANCE.md](RECONNAISSANCE.md).
2. **Review waves** — follow [REVIEW-WAVES.md](REVIEW-WAVES.md) to assign isolated reviewers per ledger unit with the selected module blocks, followed by coverage critics.
3. **Candidate validation** — give every unique candidate to a fresh verifier that tries to disprove it and, where allowed, runs the proposed regression test.
4. **Structured output** — write `quality-findings.json` and `traceability-matrix.json`, then run `node <skill-dir>/validate-quality-run.cjs <output-dir>`.
5. **Independent record verification** — fresh agents verify final records; material replacements get another independent verifier.
6. **Reporting** — materialize `regression-tests/` and derive `QUALITY-REPORT.md` (and `UNIFIED-REPORT.md` in combined mode) from verified records.

Phases 3–6 are defined in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md). In combined mode, both workflows' Phase 1 may run in parallel; each later phase stays inside its own workflow; only `UNIFIED-REPORT.md` reads both.

Do not end the run before one of two terminal states: (a) all reports are written and the validator passes, or (b) `run_status: "incomplete"` is recorded with its exact reason and the gap is disclosed in the report.

## Anti-patterns

1. Reporting a defect without an oracle, or inventing requirements the test basis does not state.
2. Treating a style preference or missing best practice as a functional defect.
3. Claiming a failure the source path or a bounded run did not show.
4. Testing a host the user did not name, production, or real accounts; sending load or exploit traffic to staging.
5. Recording response bodies, personal data, or secrets in artifacts.
6. Writing regression scripts that do not follow the repository's framework and conventions, or that hard-code credentials.
7. Confusing severity with priority, or assigning severity to `needs_validation` records.
8. Treating the testware health score as a measure of application quality.
9. Writing the report before independent verification or letting prose and JSON disagree.
10. Changing a security verdict or severity in the unified report.
