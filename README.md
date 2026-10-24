# sqa-audit-skill

Coding-agent skills for software quality assurance audits: test-automation health, requirement coverage, API contract fidelity, and security. Run them separately or together as one combined SQA audit.

| Skill | Purpose |
|-------|---------|
| [`quality-audit`](skills/quality-audit/SKILL.md) | Test-quality audit: SDET automation health, QA requirement traceability, and SEIT API contract and mock fidelity |
| [`security-audit`](skills/security-audit/SKILL.md) | Source-first security audit: trust boundaries, vulnerability hunting, and independently verified findings |

Both skills use the same audit discipline: a deterministic coverage ledger, isolated reviewers, a fresh verifier for every candidate, schema-validated records, and reports derived only from verified records.

## How it works

```
1. Reconnaissance      map the repo, stack, test frameworks, test basis, and contracts
2. Audit waves         security hunting  |  quality review (SDET, QA, SEIT)
3. Validation          a fresh agent tries to disprove every candidate
4. Structured output   findings JSON checked by zero-dependency validators
5. Verification        fresh agents re-check every final record
6. Reporting           REPORT.md, QUALITY-REPORT.md, and UNIFIED-REPORT.md in combined mode
```

Ask for a combined audit ("SQA audit", "unified quality and security audit") and `quality-audit` runs the `security-audit` workflow unchanged, then its own workflow. It writes `UNIFIED-REPORT.md` from the two validated record sets without changing either side's verdicts or severities.

## quality-audit

Audits a test suite for defects that change what its results mean: false passes, false fails, nondeterministic verdicts, missed regressions, and stale contract assumptions.

### Modules

- **Module A — SDET automation health.** Hard waits, one-shot assertions, brittle XPath/CSS locators, forced actions, focused or skipped tests, assertion-free tests, shared state, retry masking, and missing page-object or fixture layers. Framework notes cover Playwright, Cypress, Selenium/WebDriver, Appium, pytest, Jest/Vitest, JUnit, and Go.
- **Module B — QA coverage and traceability.** Derives test conditions from the test basis (PRD, user story, acceptance criteria, README, or diff) with named test design techniques. It maps them to test cases in `traceability-matrix.json` and reports uncovered, partial, negative, boundary, and state-transition gaps.
- **Module C — SEIT API contract and mocking.** Compares API tests and mocks with OpenAPI/AsyncAPI/GraphQL/protobuf/Pact contracts and DTOs. It reports untested operations, status-only assertions with no schema validation, assertions that contradict the contract, and stale mocks or fixtures.

### Outputs

`QUALITY-REPORT.md` contains:

- **Test Automation Health Score (0–100)**
- **Flakiness Risk Index**, by file with line numbers
- **Coverage Gap Warnings**, from the traceability matrix
- **Contract Mismatch Alerts**

Each section is backed by `quality-findings.json`, `traceability-matrix.json`, `quality-ledger.json`, and `test-health.json`.

The health score and flakiness index come from a deterministic static scan. They are heuristic signals, not measured flake rates. A reviewer confirms or rejects every scanner hit, so the report shows the per-rule false-positive rate.

### Standards alignment

Every finding carries an ISO/IEC 25010:2023 quality characteristic. Terminology and artifacts follow ISO/IEC/IEEE 29119 (parts 1–5) and ISTQB CTFL v4.0 / CTAL-TAE v2.0. See [STANDARDS.md](skills/quality-audit/STANDARDS.md) for the mapping and verification notes.

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
| `*.test.cjs` | Scanner and validator tests |

## security-audit

Finds vulnerabilities that cross a real trust boundary and gives owners source evidence, a safe local reproduction, a priority, and the smallest effective fix. The verdicts are distinct:

- `confirmed` has a complete source trace and a bounded observed result.
- `needs_validation` names the exact unresolved fact and has no severity.
- `rejected` records a disproved candidate.

Repeated runs are additive: prior ledgers and findings target gaps and revalidate changed source.

| File | Purpose |
|------|---------|
| `SKILL.md` | Setup, core principles, platform terminology, workflow overview, and anti-patterns |
| `RECONNAISSANCE.md` | Phase 1 reconnaissance prompts and synthesis |
| `HUNTING.md` | Phase 2 orchestration, hunting methodology, and validation rules |
| `ATTACK-CLASSES.md` | Core, wildcard, and obvious-things attack prompts |
| `MEMORY-SAFETY-AND-BINARY.md`, `AI-AND-LLM.md`, `WEB-PROTOCOL-AND-AUTH.md`, `CLIENT-SIDE.md`, `SUPPLY-CHAIN-AND-RELEASE.md`, `CLOUD-AND-DEPLOYMENT.md`, `PROTOCOLS-RPC-AND-MESSAGING.md`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `DESKTOP-MOBILE-AND-LOCAL-IPC.md` | Domain companion hunting classes |
| `VALIDATION-AND-REPORTING.md` | Phases 3–6 validation, structured output, verification, and reporting |
| `report-schema.json` | Schema for `findings.json` |
| `validate-findings.cjs`, `validate-coverage-ledger.cjs` | Zero-dependency validators, with tests |

## Installation

Install with the [Skills CLI](https://skills.sh):

```bash
npx skills add https://github.com/modalqa/sqa-audit-skill --skill quality-audit
npx skills add https://github.com/modalqa/sqa-audit-skill --skill security-audit
```

Install both for combined mode. Add `--global` for a user-level installation, and run `npx skills --help` for agent-selection and non-interactive options.

## Usage

Start your coding agent in the repository you want to audit, then ask:

```
audit the test automation health of this repo
check our e2e tests against docs/prd/checkout.md and the OpenAPI spec
security audit this codebase
run a combined quality and security audit, output to ~/audits/my-project
```

Questions and focused reviews use guidance mode and write no files. Explicit audit requests or requests for report artifacts run the full workflow. Default output directories are outside the target:

- `~/quality-audit-skill/<repo-name>/run-<N>`
- `~/security-audit-skill/<repo-name>/run-<N>`
- `~/sqa-audit/<repo-name>/run-<N>` for combined runs

The scanner also runs standalone:

```bash
node skills/quality-audit/analyze-test-health.cjs <repo> --out health.json
```

## Requirements

- A coding agent whose model supports tool use and parallel sub-agents
- Node.js 22 or later for the zero-dependency scanner and validators
- An OS-enforced sandbox for any target-controlled build, test run, browser, emulator, or mock server. The sandbox must have no external network, an allowlisted environment, resource limits, and writes confined to scratch paths. Without one, the workflows keep leads as `needs_validation` instead of executing target code.

## Design principles

- **Confirm only demonstrated consequences.** A security finding needs a crossed boundary. A quality finding needs an effect on test verdicts. Everything else is a `needs_validation` lead or a hardening note.
- **Adversarial validation.** The agent that checks a finding is never the agent that found it.
- **Severity follows impact and risk.** It reflects demonstrated impact and the risk level of the protected requirement, not deviation from a checklist.
- **Static hits are leads.** Pattern matches, scores, and indexes guide review; they are never findings on their own.
- **No secrets or personal data in artifacts.** Findings cite file and line instead of copying values.

## Development

```bash
node --test 'skills/**/*.test.cjs'
```

CI tests on Node.js 22, 24, and 26 and runs CodeQL (`security-extended`) and a secret scan over the full git history. Dependabot keeps GitHub Actions current.

## Contributing and support

Open an issue or pull request at [github.com/modalqa/sqa-audit-skill](https://github.com/modalqa/sqa-audit-skill/issues).

## Acknowledgements

`security-audit` and the shared audit structure originate from [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill), used under the MIT License.

## License

MIT. See [LICENSE](LICENSE).
