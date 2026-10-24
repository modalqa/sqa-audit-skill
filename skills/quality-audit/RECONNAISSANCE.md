# Quality Reconnaissance

### Phase 1: Map the test architecture and plan coverage

The parent initializes `run-metadata.json`, applies the budget gate in `SKILL.md`, and runs the deterministic scan before launching any agent:

```sh
node <skill-dir>/analyze-test-health.cjs <target> --out <output-dir>/test-health.json
```

The scanner reads source only, skips dependency and build directories, never follows symlinks, and never copies source text into its output. Its hits are leads for Module A; its `frameworks_detected` list seeds the agents below. If it reports `truncated: true`, say so in `architecture.md` and scope the run.

Then launch these `research` agents in parallel. They return structured facts to the parent and do not write files.

**Agent 1a: Test architecture and automation stack**

```text
Read the target at <target>. Do not use network access and do not run tests. Return:
1. Test levels present (component/unit, integration, contract, system/E2E, acceptance, performance)
   and the repository-relative directories and frameworks for each.
2. The test automation architecture: runners, page objects or screen objects, fixtures, helpers,
   keyword or BDD layers, test data builders, and shared configuration (base URL, timeouts, retries).
3. Which suites gate CI, from local CI configuration files, with the exact job and command.
4. Retry, rerun, quarantine, and timeout settings with file:line.
5. Exact offline commands that would run each suite locally, the dependencies they need, and whether
   those dependencies are present. Do not run them.
6. Facts outside the repository that limit the audit (CI dashboards, flake history, test management tools).
Return only source facts with repository-relative file:line references.
```

**Agent 1b: Test basis inventory**

```text
Read the target at <target> and the user-supplied test basis <test-basis-paths>. Return:
1. Every test basis source: PRD, user stories, acceptance criteria, README feature descriptions,
   ADRs, API contracts, and the diff under review if one was named.
2. For each source, the testable requirements it states, each with file:line, a one-line summary,
   and a proposed risk level (critical/high/medium/low) with the business or user impact that justifies it.
3. Requirements that are ambiguous, contradictory, or untestable as written, with the exact gap.
Do not invent requirements the sources do not state. Return only facts with file:line references.
```

**Agent 1c: Contracts, clients, and mocks**

```text
Read the target at <target>. Return:
1. API contracts: OpenAPI/Swagger, AsyncAPI, GraphQL schema, protobuf, JSON Schema, Pact files,
   and their version markers.
2. Server route and DTO definitions that implement those contracts, with file:line.
3. API and integration tests (SuperTest, Playwright request, REST Assured, requests/httpx, Postman/Newman
   collections, k6, Karate, Pact) and the operations each one exercises.
4. Mocks, stubs, fixtures, recorded responses, and mock servers (MSW, nock, WireMock, Prism, responses,
   unittest.mock, Mockito) and the operation or DTO each one imitates.
5. Whether tests validate response bodies against a schema, and how.
Return only source facts with repository-relative file:line references.
```

Add a focused agent only when a large monorepo or several independent suites make one agent's answer shallow, and repeat the budget gate for it.

## Synthesis

The parent writes `architecture.md` with:

1. Test levels, frameworks, CI-gating suites, retry and timeout policy.
2. The test basis inventory and the requirement list with proposed risk levels.
3. The contract inventory with linked tests and mocks.
4. The `test-health.json` summary: health score, top flakiness risk files, rule counts.
5. Known limits: missing toolchains, external facts, truncated scans.

## Ledger seeding

Write `quality-ledger.json` as `{ "units": [...] }`, sorted by `unit_id`. Each unit is one reviewable assignment:

- **`sdet/<suite-slug>`** — one per test suite directory or CI-gating suite. In `deep`, split per framework or per feature folder. Starting paths are the suite directory plus its shared fixtures and page objects. Seed one unit for every file in the flakiness risk index with `risk_level: "high"` that no suite unit already owns.
- **`qa/<requirement-area-slug>`** — one per feature area in the test basis. In `quick`, one unit per test basis source.
- **`seit/<contract-slug>`** — one per contract file, or per service when a contract is absent but API tests exist. A service with API tests and no contract gets a unit whose scope is "contract absent; compare tests with route and DTO definitions."

Unit IDs are lowercase, match `^(?:sdet|qa|seit)/[a-z0-9][a-z0-9._/-]*$`, and derive only from repository paths or test basis IDs, never from waves or agents. Every unit starts `planned` with `agent_id: null`, empty evidence, and `reason: null`. Modules not selected for the run get no units; areas outside the scope get `out_of_scope` with a reason. Run the validator once the ledger exists; an empty `quality-findings.json` (`[]`) is valid at this point:

```sh
node <skill-dir>/validate-quality-run.cjs <output-dir>
```

Prioritize units for assignment in this order: (1) CI-gating suites and critical-risk requirements; (2) high-risk flakiness files and contracts with active consumers; (3) changed source and prior-run gaps; (4) the rest. Ties break lexicographically by `unit_id`.

## Prior runs

If prior quality runs exist, read their ledgers and findings first. Carry a prior `confirmed` record only when its locations and test basis are unchanged, and re-verify it in this run. Prior `needs_validation`, `blocked`, and `deferred` units are current work. A prior `rejected` record suppresses only the same unchanged claim. Never treat a prior `quick` or scoped run as coverage of what it did not review.
