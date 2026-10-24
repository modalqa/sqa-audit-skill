# sqa-audit-skill

This repository holds two coding-agent skills that can run separately or together:

| Skill | Purpose |
|-------|---------|
| [`security-audit`](skills/security-audit/SKILL.md) | The original Cloudflare security audit workflow, unchanged |
| [`quality-audit`](skills/quality-audit/SKILL.md) | Test-quality audit: SDET automation health, QA requirement traceability, and SEIT API contract and mock fidelity |

Ask for a combined quality and security audit ("SQA audit", "unified audit") and the `quality-audit` skill runs both workflows, each with its own evidence rules, then derives `UNIFIED-REPORT.md` from the two validated record sets without changing either side's verdicts. See [quality-audit](#quality-audit) below.

## security-audit

A coding-agent skill that turns your agent into a security auditor. It orchestrates isolated agents through reconnaissance, coverage-led hunting, candidate validation, structured output, independent record verification, and target-neutral reporting.

This is the skill that seeded Cloudflare's vulnerability discovery harness, described in [Build your own vulnerability harness](https://blog.cloudflare.com/build-your-own-vulnerability-harness). The harness grew into a multi-stage, fleet-wide system; this skill is the single-repo starting point it evolved from.

## What it does

The skill runs a structured audit in six phases:

1. **Reconnaissance** -- map architecture, trust boundaries, input surfaces, prior evidence, and deterministic coverage in `architecture.md` and `coverage-ledger.json`.
2. **Coverage-led hunting** -- assign isolated hunters from ledger units, record their checks, and use coverage critics to find gaps.
3. **Candidate validation** -- give every unique candidate to a fresh verifier that tries to disprove it.
4. **Structured output** -- write `confirmed`, `needs_validation`, and `rejected` records to `findings.json` and validate them against `report-schema.json`.
5. **Independent record verification** -- fresh agents verify final source claims. Material replacements receive another independent verifier.
6. **Target-neutral reporting** -- derive `REPORT.md`, `FINDINGS-DETAIL.md`, and `NEEDS-VALIDATION.md` from the verified records and coverage ledger.

The parent runs `validate-coverage-ledger.cjs` after creating the ledger and after each later ledger update. It runs `validate-findings.cjs` in Phase 4 and again after every Phase 5 replacement.

The verdicts are distinct: `confirmed` has a complete source trace and bounded observed result, `needs_validation` has an exact unresolved fact and no severity, and `rejected` records a disproved candidate.

Multiple runs against the same repo are additive. The skill uses prior ledgers and findings to target gaps, revalidate changed source, and carry forward current-source evidence without treating stale or unresolved work as covered.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Setup, core principles, platform terminology, workflow overview, and audit anti-patterns |
| `RECONNAISSANCE.md` | Phase 1 reconnaissance prompts and synthesis instructions |
| `HUNTING.md` | Phase 2 orchestration, hunting methodology, and validation rules |
| `ATTACK-CLASSES.md` | Core, wildcard, and obvious-things attack prompts |
| `MEMORY-SAFETY-AND-BINARY.md` | Memory-safety, binary, and kernel hunting classes for native targets |
| `AI-AND-LLM.md` | Prompt-injection, agent/tool, and output-handling hunting classes for LLM-backed targets |
| `WEB-PROTOCOL-AND-AUTH.md` | HTTP request-framing, cache, and authentication-protocol hunting classes for HTTP-protocol and auth targets |
| `CLIENT-SIDE.md` | DOM-injection, messaging-trust, UI-redress, and prototype-pollution hunting classes for client-side/browser targets |
| `SUPPLY-CHAIN-AND-RELEASE.md` | Dependency, CI, release, signing, update, plugin, and extension hunting classes |
| `CLOUD-AND-DEPLOYMENT.md` | IAM, infrastructure-as-code, container, serverless, ingress, and runtime-configuration hunting classes |
| `PROTOCOLS-RPC-AND-MESSAGING.md` | RPC, serialization, queue, broker, webhook, and streaming-protocol hunting classes |
| `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` | Shared resource, quota, queue, worker, and operator-spend hunting classes |
| `DATA-ISOLATION-AND-LIFECYCLE.md` | Tenant isolation, cache, search, export, backup, migration, deletion, and restore hunting classes |
| `DESKTOP-MOBILE-AND-LOCAL-IPC.md` | Native app, deep-link, webview, exported-component, helper, daemon, and local-IPC hunting classes |
| `VALIDATION-AND-REPORTING.md` | Phases 3–6 candidate validation, structured output, record verification, and reporting |
| `report-schema.json` | JSON schema for all three `findings.json` verdicts |
| `validate-findings.cjs` | Zero-dependency validator for `findings.json` in Phases 4 and 5 |
| `validate-findings.test.cjs` | Findings-validator tests and producer-compatible fixture checks |
| `validate-coverage-ledger.cjs` | Zero-dependency validator for `coverage-ledger.json` in Phases 1–5 |
| `validate-coverage-ledger.test.cjs` | Coverage-ledger validator tests |

## Installation

Install the skill with the [Skills CLI](https://skills.sh):

```bash
npx skills add https://github.com/cloudflare/security-audit-skill \
  --skill security-audit
```

Use `--global` for a user-level installation:

```bash
npx skills add https://github.com/cloudflare/security-audit-skill \
  --skill security-audit \
  --global
```

Run `npx skills --help` for agent-selection and non-interactive options.

## Usage

Start your coding agent in (or pointed at) the codebase you want to audit, then ask it to do a security audit:

```
security audit this codebase
```

```
find security vulnerabilities in ./src
```

```
do a security review, output to ~/audits/my-project
```

The skill activates automatically when the request matches its trigger (security audit, find vulnerabilities, pen-test the code, etc.). A direct codebase audit or pen-test request uses full audit mode. Security questions and focused vulnerability work use guidance mode unless you request report artifacts. In full audit mode, an unspecified output directory defaults to `~/security-audit-skill/<repo-name>/run-<N>`. The workflow writes inside the target repository only when you explicitly select a directory that version control ignores.

## Requirements

- A coding agent with a model that supports tool use and parallel sub-agents
- Node.js for the zero-dependency findings and coverage-ledger validators
- An OS-enforced sandbox for target-controlled builds, tests, processes, browsers, emulators, fuzzers, and fixtures. It must disable external networking, use a sanitized allowlisted environment, enforce resource limits, and allow writes only to assigned scratch paths. Without these controls, the workflow keeps the lead as `needs_validation` instead of executing target code.

## Design principles

- **Only confirm established boundary failures.** Keep a source-grounded blocked lead as `needs_validation` with its exact unresolved fact.
- **Adversarial validation.** The agent that checks a finding is never the agent that found it.
- **Severity requires impact.** Likelihood x impact, not deviation from a checklist.
- **Defense-in-depth gaps are not vulnerabilities.** If Layer A prevents the attack, the absence of Layer B is a hardening note.
- **Multiple runs improve coverage.** In our test runs, a single run found roughly half of the vulnerabilities that repeated runs found in total.

## quality-audit

The `quality-audit` skill audits a test suite for defects that change what its results mean: false passes, false fails, nondeterministic verdicts, missed regressions, and stale contract assumptions. It follows the same structure as `security-audit`: deterministic coverage ledger, isolated reviewers, a fresh verifier per candidate, schema-checked records, and reports derived only from verified records.

### Modules

- **Module A — SDET automation health.** Hard waits, one-shot assertions, brittle XPath/CSS locators, forced actions, focused or skipped tests, assertion-free tests, shared state, retry masking, and missing page-object or fixture layers. Framework notes cover Playwright, Cypress, Selenium/WebDriver, Appium, pytest, Jest/Vitest, JUnit, and Go.
- **Module B — QA coverage and traceability.** Derives test conditions from the test basis (PRD, user story, acceptance criteria, README, or diff) with named techniques, then maps them to test cases in `traceability-matrix.json` and reports uncovered, partial, negative, boundary, and state-transition gaps.
- **Module C — SEIT API contract and mocking.** Compares API tests and mocks with OpenAPI/AsyncAPI/GraphQL/protobuf/Pact contracts and DTOs: untested operations, status-only assertions with no schema validation, assertions that contradict the contract, and stale mocks or fixtures.

### Outputs

`QUALITY-REPORT.md` contains the **Test Automation Health Score (0–100)**, the **Flakiness Risk Index**, **Coverage Gap Warnings**, and **Contract Mismatch Alerts**. Each item is backed by `quality-findings.json`, `traceability-matrix.json`, `quality-ledger.json`, and `test-health.json`. Findings carry an ISO/IEC 25010:2023 quality characteristic, and the vocabulary follows ISO/IEC/IEEE 29119 and ISTQB CTFL v4.0 / CTAL-TAE v2.0; see [STANDARDS.md](skills/quality-audit/STANDARDS.md).

The health score and flakiness index come from a deterministic static scan. They are heuristic signals, not measured flake rates, and every scanner hit is confirmed or rejected by a reviewer so the per-rule false-positive rate appears in the report.

### Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Modes (guidance, full, combined), safety, setup, severity anchors, workflow, anti-patterns |
| `RECONNAISSANCE.md` | Phase 1: scanner run, test architecture, test basis and contract inventory, ledger seeding |
| `REVIEW-WAVES.md` | Phase 2: reviewer prompt, structured result, consolidation, coverage critics |
| `SDET-AUTOMATION-HEALTH.md` | Module A classes and validation rules |
| `QA-COVERAGE-TRACEABILITY.md` | Module B classes, matrix format, and validation rules |
| `SEIT-API-CONTRACT.md` | Module C classes and validation rules |
| `VALIDATION-AND-REPORTING.md` | Phases 3–6, `QUALITY-REPORT.md`, and `UNIFIED-REPORT.md` |
| `STANDARDS.md` | ISO/IEC/IEEE 29119, ISO/IEC 25010:2023, and ISTQB alignment |
| `quality-report-schema.json` | Schema for findings, ledger, and traceability matrix |
| `analyze-test-health.cjs` | Zero-dependency static scanner for Module A leads, health score, and flakiness index |
| `validate-quality-run.cjs` | Zero-dependency validator for a run directory, with cross-file checks |
| `*.test.cjs` | Tests for the scanner and validator |

### Installation and usage

```bash
npx skills add https://github.com/modalqa/sqa-audit-skill --skill quality-audit
npx skills add https://github.com/modalqa/sqa-audit-skill --skill security-audit   # needed for combined mode
```

```
audit the test automation health of this repo
check our e2e tests against docs/prd/checkout.md and the OpenAPI spec
run a combined quality and security audit of this codebase
```

The scanner can also run standalone:

```bash
node skills/quality-audit/analyze-test-health.cjs <repo> --out health.json
```

### Development

```bash
node --test 'skills/**/*.test.cjs'
```

CI runs the tests on the supported Node.js LTS lines and runs CodeQL on every push and pull request.

## Contact

Questions, feedback, or comparing notes on AI-driven security tooling: security-ai-research@cloudflare.com

## License

MIT -- see [LICENSE](LICENSE).
