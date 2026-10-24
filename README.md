# sqa-audit-skill

Coding-agent skills that QA-test and security-audit an application's own codebase. They find functional, API, non-functional, and security defects, and for every quality defect they give a reproduction plus a ready-to-commit regression test. Run them separately or together as one combined SQA audit.

| Skill | Purpose |
|-------|---------|
| [`quality-audit`](skills/quality-audit/SKILL.md) | QA testing of the application: requirement verification, functional defects, API contract conformance, and non-functional checks, with regression tests for every defect |
| [`security-audit`](skills/security-audit/SKILL.md) | Source-first security audit: trust boundaries, vulnerability hunting, and independently verified findings |

Both skills use the same discipline: a deterministic coverage ledger, isolated reviewers, a fresh verifier for every candidate, schema-validated records, and reports derived only from verified records.

## How it works

```
1. Reconnaissance      map the product, requirements, contracts, run commands, and existing tests
2. Review waves        security hunting  |  QA verification (functional, api, nonfunctional)
3. Validation          a fresh agent tries to disprove every candidate and runs the regression test
4. Structured output   findings JSON and traceability matrix checked by zero-dependency validators
5. Verification        fresh agents re-check every final record
6. Reporting           QUALITY-REPORT.md, regression-tests/, REPORT.md, and UNIFIED-REPORT.md
```

Ask for a combined audit ("SQA audit", "unified quality and security audit") and `quality-audit` runs the `security-audit` workflow unchanged, then its own workflow. It writes `UNIFIED-REPORT.md` from the two validated record sets without changing either side's verdicts or severities.

## quality-audit

Tests the application in the repository the way a QA engineer would. It derives test conditions from the test basis (PRD, user stories, acceptance criteria, README, API contracts, documentation, or a diff), verifies the implementation against each condition, and reports defects with an oracle, a reproduction, an impact, a fix, and a regression test.

### Modules

| Module | Finds | Default |
|---|---|---|
| `functional` | Boundary and validation errors, wrong calculations, decision-logic and state-transition defects, date/time and locale bugs, data-integrity and side-effect problems, broken workflows | on |
| `api` | Implementation vs. OpenAPI/GraphQL/protobuf/Pact contract: status codes, response schema, request validation, error format, undocumented operations, compatibility breaks; dependency-failure, retry, and timeout behavior | on when the app has an API |
| `nonfunctional` | Performance efficiency (N+1, unbounded work), reliability (leaks, races, recoverability), compatibility, flexibility, and interaction capability (WCAG 2.2 AA accessibility) | on |
| `testware` | Health of the existing test suite: flakiness, automation anti-patterns, mock drift. Produces the Test Automation Health Score and Flakiness Risk Index | off, on request |

### Evidence and execution

Evidence comes from source review first, then sandboxed local runs (no external network, limited resources, writes confined to scratch), and, only when you name it, an authorized **staging or dev environment**. Staging checks follow strict rules ([STAGING-TESTING.md](skills/quality-audit/STAGING-TESTING.md)):

- exact-origin allowlist
- read-only unless you allow writes
- request and rate limits
- no load or exploit traffic
- credentials from environment variables only
- no response data or personal information stored

Production is never tested.

### Outputs

| File | Content |
|------|---------|
| `QUALITY-REPORT.md` | Defect summary, defect reports, requirement verification, Coverage Gap Warnings, Contract Mismatch Alerts, non-functional findings, needs-validation leads, and the coverage statement. With `testware`, also the health score and flakiness index |
| `regression-tests/` | One script per confirmed defect, in the repository's own test framework, with a README of what each script covers |
| `quality-findings.json` | Verified records: `confirmed`, `needs_validation`, and `rejected` |
| `traceability-matrix.json` | Requirement → test condition → implementation → verdict → defect → existing tests |
| `quality-ledger.json` | What was reviewed, by whom, and with what result |

Every finding carries an ISO/IEC 25010:2023 quality characteristic. The process, documents, and terminology follow ISO/IEC/IEEE 29119 and ISTQB CTFL v4.0 / CTAL-TAE v2.0; see [STANDARDS.md](skills/quality-audit/STANDARDS.md).

### Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Modes, modules, execution safety, setup, severity anchors, workflow, anti-patterns |
| `RECONNAISSANCE.md` | Phase 1: product, requirements, contracts, run commands, test conventions, ledger seeding |
| `REVIEW-WAVES.md` | Phase 2: reviewer prompt, structured result, consolidation, coverage critics |
| `TRACEABILITY.md` | Test conditions, verdicts, and the traceability matrix format |
| `FUNCTIONAL-TESTING.md` | `functional` module classes and validation rules |
| `API-AND-INTEGRATION.md` | `api` module classes and validation rules |
| `NON-FUNCTIONAL.md` | `nonfunctional` module classes and validation rules |
| `TESTWARE-HEALTH.md` | Optional `testware` module classes and validation rules |
| `STAGING-TESTING.md` | Authorization gate and rules for staging checks |
| `VALIDATION-AND-REPORTING.md` | Phases 3–6, `regression-tests/`, `QUALITY-REPORT.md`, and `UNIFIED-REPORT.md` |
| `STANDARDS.md` | ISO/IEC/IEEE 29119, ISO/IEC 25010:2023, ISTQB, and WCAG alignment |
| `quality-report-schema.json` | Schema for findings, ledger, and traceability matrix |
| `validate-quality-run.cjs` | Zero-dependency validator for a run directory, with cross-file checks |
| `analyze-test-health.cjs` | Zero-dependency static scanner for the `testware` module |
| `*.test.cjs` | Validator and scanner tests |

## security-audit

Finds vulnerabilities that cross a real trust boundary and gives owners source evidence, a safe local reproduction, a priority, and the smallest effective fix. It works from source and a local sandbox only and never contacts deployed environments, including staging. The verdicts are:

- `confirmed`: a complete source trace and a bounded observed result.
- `needs_validation`: names the exact unresolved fact and carries no severity.
- `rejected`: records a disproved candidate.

Repeated runs are additive.

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

Open your coding agent (Claude Code, Cursor, or another agent with skills support) in the repository you want to test, then type a prompt. The skill activates from the wording of the request; you do not call it by name.

### Modes

| Mode | Triggered by | What happens |
|------|--------------|--------------|
| Guidance | A question about one function, endpoint, flow, or requirement | Answers in chat. No output directory, no files |
| Full audit | "QA audit", "test this app against the PRD", "find bugs in this repo", or asking for a report | Runs all six phases and writes reports and regression tests outside the repo |
| Combined | "combined", "unified", or "SQA" audit | Runs the security and quality workflows, then writes `UNIFIED-REPORT.md` |

If a request could mean either guidance or a full audit, the agent asks one question before creating files.

### Example prompts: full QA audit

```text
Run a QA audit of this repository and find functional bugs.
```

```text
Test this app against docs/prd/checkout.md and give me a regression test for every bug you find.
```

```text
QA audit the refunds feature only, deep profile, output to ~/audits/shop-api.
```

### Example prompts: requirement verification

```text
Verify the implementation against these acceptance criteria and build a traceability matrix: <paste story>
```

```text
Which requirements in docs/prd/onboarding.md are not implemented or implemented incorrectly?
```

```text
Check whether the changes in this branch compared to main behave as described in the PR description, and list untested behavior.
```

### Example prompts: API and integration

```text
Check that our API implementation matches api/openapi.yaml: status codes, response schemas, and error format.
```

```text
What happens in the order service when the payment provider times out or returns 500? Report any wrong behavior.
```

### Example prompts: non-functional

```text
Find performance problems in the reporting module, such as N+1 queries and unbounded memory use.
```

```text
Review the signup and checkout pages for WCAG 2.2 AA accessibility defects.
```

### Example prompts: with staging

```text
Run a QA audit and confirm bugs against our staging environment https://staging.example.test.
It is not production and I am authorized to test it. Read-only. Test account credentials are in
the env vars QA_USER and QA_PASSWORD.
```

The agent asks for any missing confirmation (non-production, authorization, write permission) before sending a request.

### Example prompts: existing test suite (optional testware module)

```text
Also audit our Playwright suite for flaky tests and give me the test automation health score.
```

```text
Which of our Cypress specs have the highest flakiness risk, and why?
```

### Example prompts: combined audit

```text
Run a combined quality and security audit of this codebase.
```

```text
Do a unified SQA audit of this repo, quick profile, output to ~/audits/my-project.
```

### Example prompts: guidance mode (no files written)

```text
Is there a bug in calculateDiscount in src/pricing.ts? Check it against the README rules.
```

```text
Write a regression test for the date bug in src/billing/invoice.ts.
```

### Controlling a run

| Option | Example wording | Effect |
|--------|-----------------|--------|
| Profile | "quick audit", "deep audit" | `quick` is one review wave for a fast first look. `standard` is the default. `deep` splits units further and repeats critic waves until clean |
| Scope | "only the refunds feature", "only ./src/api" | Tests only the named features or paths. Everything else is recorded as out of scope |
| Modules | "only functional and api", "include testware" | Selects modules. `testware` runs only when asked |
| Test basis | "against docs/prd/x.md", or paste the story | Sets the requirements to verify |
| Staging | "confirm against https://staging…, read-only" | Allows checks on that exact origin under the staging rules |
| Budget | "use at most 20 agents" | Caps agent invocations. Critic and validation reserves are set aside first |
| Output | "output to ~/audits/x" | Sets the output directory, which must be outside the repo unless git ignores it |

Default output directories:

- `~/quality-audit-skill/<repo-name>/run-<N>`
- `~/security-audit-skill/<repo-name>/run-<N>`
- `~/sqa-audit/<repo-name>/run-<N>` for combined runs, with `security/` and `quality/` subdirectories

### Running the tools directly

```bash
# Validate a finished quality run directory
node skills/quality-audit/validate-quality-run.cjs ~/quality-audit-skill/my-repo/run-1

# Static scan of an existing test suite: health score, flakiness risk index, rule hits
node skills/quality-audit/analyze-test-health.cjs /path/to/repo --out health.json
```

### Tips

- Name the test basis explicitly. Without a PRD, story, or contract, the agent can verify only documentation, contracts, and code consistency.
- Make the app runnable offline: a documented local start command with seed data lets the agent confirm bugs and verify that regression tests fail.
- Start a large repository with a `quick` audit, then run `standard` or `deep` on the riskiest features.
- Repeated runs are additive. A later run reuses earlier results to target remaining gaps, so run it again after fixes.

## Requirements

- A coding agent whose model supports tool use and parallel sub-agents
- Node.js 22 or later for the zero-dependency validators and scanner
- An OS-enforced sandbox for any build, test run, app start, browser, or emulator, with no external network, an allowlisted environment, resource limits, and writes confined to scratch paths. Without one, the workflows keep leads as `needs_validation` instead of executing target code.

## Design principles

- **Confirm only demonstrated failures.** A quality defect needs an oracle and an observed or source-evident failure. A security finding needs a crossed boundary. Everything else is a `needs_validation` lead or a hardening note.
- **Every defect comes with a regression test.** The test is written in the repository's own framework and conventions and, where execution is possible, is verified to fail on the current code.
- **Adversarial validation.** The agent that checks a finding is never the agent that found it.
- **Severity follows impact and risk.** It reflects demonstrated impact and the risk level of the affected requirement. Priority is left to the owners.
- **No secrets or personal data in artifacts.** Findings cite file and line or describe data shape instead of copying values.

## Development

```bash
node --test 'skills/**/*.test.cjs'
```

## Contributing and support

Open an issue or pull request at [github.com/modalqa/sqa-audit-skill](https://github.com/modalqa/sqa-audit-skill/issues).

## Acknowledgements

`security-audit` and the shared audit structure originate from [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill), used under the MIT License.

## License

MIT. See [LICENSE](LICENSE).
