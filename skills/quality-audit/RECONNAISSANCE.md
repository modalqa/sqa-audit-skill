# Quality Reconnaissance

### Phase 1: Map the product and plan coverage

The parent initializes `run-metadata.json`, applies the budget gate in `SKILL.md`, and, when staging is requested, completes the authorization gate in [STAGING-TESTING.md](STAGING-TESTING.md). Reconnaissance reads the repository only. It does not run the application or contact staging.

If the `testware` module is selected, the parent also runs the deterministic scanner once:

```sh
node <skill-dir>/analyze-test-health.cjs <target> --out <output-dir>/test-health.json
```

Launch these `research` agents in parallel. They return structured facts to the parent and do not write files.

**Agent 1a: Product, features, and architecture**

```text
Read the target at <target>. Do not use network access and do not run anything. Return:
1. Product type, users and roles, and the main use cases, each with the code areas that implement it.
2. Languages, frameworks, runtimes, data stores, and external integrations (with the client code for each).
3. Entry points: routes, pages/screens, CLI commands, jobs, consumers, and public library functions.
4. Domain rules visible in code: state machines, calculations, validation schemas, limits, and constants.
5. Exact offline commands to build without installing anything, start the app on loopback with local data, and run the
   existing tests, plus missing dependencies or services that prevent local execution. Do not run them.
6. Supported platforms stated by the project (browserslist, engines, minimum SDK, accessibility level).
Return only source facts with repository-relative file:line references.
```

**Agent 1b: Test basis and requirements**

```text
Read the target at <target> and the test basis <test-basis-paths>. Return:
1. Every test basis source: PRD, user stories, acceptance criteria, README feature descriptions, ADRs,
   API contracts, user documentation, and the diff under review if one was named.
2. For each source, the testable requirements it states (functional and non-functional), each with
   file:line, a one-line summary, and a proposed risk level (critical/high/medium/low) with the business
   or user impact that justifies it.
3. Requirements that are ambiguous, contradictory, or untestable as written, with the exact gap.
Do not invent requirements. Return only facts with file:line references.
```

**Agent 1c: Contracts, integrations, and existing tests**

```text
Read the target at <target>. Return:
1. API contracts (OpenAPI/Swagger, AsyncAPI, GraphQL schema, protobuf, JSON Schema, Pact) and the handler
   implementing each operation, with file:line.
2. Outbound integrations: client code, timeout and retry settings, and error handling for each.
3. Existing tests by level (component, integration, API, E2E), framework, directory, naming and fixture
   conventions, and the CI jobs that run them. Future regression scripts must follow these conventions.
Return only source facts with repository-relative file:line references.
```

Add a focused agent only when a large monorepo makes one agent's answer shallow, and repeat the budget gate for it.

## Synthesis

The parent writes `architecture.md` with:

1. Product summary, roles, main use cases, and entry points.
2. The requirement list with proposed risk levels, and basis defects.
3. The operation table for contracts and the integration list.
4. How to run the app and tests locally, what blocks local execution, and the staging authorization (origins and write permission only, never credentials).
5. Test conventions for regression scripts: framework, directory, naming, fixtures, and helpers.
6. If `testware` is selected, the `test-health.json` summary.

The parent also writes the initial `traceability-matrix.json` with every requirement and its derived test conditions, each with verdict `needs_validation`, `verification_method: "source"`, empty `implementation` and `existing_tests`, and note `"not yet verified"`. Reviewers replace these rows.

## Ledger seeding

Write `quality-ledger.json` as `{ "units": [...] }`, sorted by `unit_id`:

- **`functional/<feature-slug>`** — one per feature area or use case. In `deep`, one per requirement group or state machine.
- **`api/<contract-or-service-slug>`** — one per contract file, or per service when a contract is absent but the service exposes or consumes an API.
- **`nonfunctional/<characteristic>-<area-slug>`** — one per characteristic with stated requirements or a high-risk area (data-heavy queries, concurrency-sensitive writes, UI flows that need accessibility review).
- **`testware/<suite-slug>`** — only when the module is selected: one per test suite directory, plus one per high-risk file in the flakiness index that no suite unit owns.

Unit IDs are lowercase, match `^(?:functional|api|nonfunctional|testware)/[a-z0-9][a-z0-9._/-]*$`, and derive only from repository paths or requirement IDs. Every unit starts `planned` with `agent_id: null`, empty evidence, and `reason: null`. Unselected modules get no units; out-of-scope areas get `out_of_scope` with a reason. Write `quality-findings.json` as `[]` and run the validator:

```sh
node <skill-dir>/validate-quality-run.cjs <output-dir>
```

Prioritize assignment by: (1) critical- and high-risk requirements and main use cases; (2) money, data-integrity, and externally consumed API surfaces; (3) changed source and prior-run gaps; (4) the rest. Ties break lexicographically by `unit_id`.

## Prior runs

If prior quality runs exist, read their ledgers, matrices, and findings first. Carry a prior `confirmed` record only when its locations and test basis are unchanged, and re-verify it. A prior `pass` verdict on changed implementation becomes current work. Prior `needs_validation`, `blocked`, and `deferred` units are current work. A prior `rejected` record suppresses only the same unchanged claim.
