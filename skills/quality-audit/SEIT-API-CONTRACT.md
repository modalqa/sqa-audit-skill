# SEIT API Contract and Integration Mocking (Module C)

#### When to use this file

Reach for this file when a service exposes or consumes an API with a machine-readable contract (OpenAPI/Swagger, AsyncAPI, GraphQL SDL, protobuf, JSON Schema, Pact), or when integration tests use mocks, stubs, or recorded responses. It covers contract fidelity of tests, response-schema validation, and mock drift.

Use [QA-COVERAGE-TRACEABILITY.md](QA-COVERAGE-TRACEABILITY.md) when the contract is the test basis for requirement coverage, and [SDET-AUTOMATION-HEALTH.md](SDET-AUTOMATION-HEALTH.md) for flakiness in API tests.

## Core discipline (include in every agent prompt for this module)

```
- Identify which artifact is authoritative for each operation: the contract file, the server's
  route and DTO definitions, or a consumer pact. If they disagree with each other, that disagreement
  is the finding, and the tests cannot be judged against an unsettled contract.
- A mismatch candidate names the operation, the field or status, the contract location, the test or
  mock location, and how the mismatch lets a test pass against behavior the real system no longer has
  (or fail against behavior it does have).
- Schema validation libraries, generated clients, typed DTOs, and contract-test frameworks are real
  controls. Check whether they run in the test before claiming a field is unvalidated.
- Never call a deployed API to compare. Compare files. Run a local mock server or contract verifier
  only inside the sandbox, offline, against repository fixtures.
- Use `needs_validation` when the authoritative contract lives outside the repository or the
  deployed version is decisive.
```

## Contract fidelity classes (subagent_type: `research`)

**SEIT-UNTESTED-OPERATION — contract operation without an API test**
An operation or response code in the contract that no API, contract, or integration test calls. Prioritize write operations, auth-protected operations, and documented error responses.

**SEIT-UNDOCUMENTED-ENDPOINT — tested or implemented route absent from the contract**
Tests or server routes for operations the contract does not describe. Either the contract is stale or the route is unintended; both make contract-based testing unreliable.

**SEIT-STATUS-ONLY-ASSERTION — response body never validated**
API tests assert the status code (and perhaps one field) but never validate the body against the contract schema. A breaking field rename or type change passes every test. The fix is schema validation (Ajv, `jest-openapi`, `chai-openapi-response-validator`, Schemathesis, `openapi-core`, REST Assured `matchesJsonSchema`, Pact) or typed deserialization that fails on mismatch.

**SEIT-ASSERTION-CONTRADICTS-CONTRACT — test expects what the contract forbids**
Expected status, field name, type, enum value, nullability, or required-ness in a test differs from the contract. Show both locations.

**SEIT-UNVERIFIED-CONSUMER-CONTRACT — consumer tests without provider verification**
Consumer-side pacts or recorded expectations exist but no provider verification runs in the repository's CI, so the provider can break them silently.

## Mock and fixture drift classes (subagent_type: `research`)

**SEIT-STALE-MOCK — mock data no longer matches the contract or DTO**
A mock, stub, MSW handler, nock interceptor, WireMock mapping, or recorded response returns fields, types, enums, or status codes that the current contract or DTO does not have, or omits newly required fields. Tests then pass against a system that no longer exists. Compare each mock's operation with the contract and the server or client DTO in the same repository; cite the contract and DTO version or last-changed location.

**SEIT-MOCK-OVER-SPECIFICATION — mock accepts anything**
A mock that matches any request body or ignores the request entirely, so a client sending a malformed request still passes.

**SEIT-FIXTURE-SCHEMA-DRIFT — seed data inconsistent with the database schema**
Test fixtures or factories whose fields no longer match migrations or ORM models, hidden by lenient loaders.

## Universal moves (apply across the above)

1. Build an operation table: operation ID or method+path, contract location, server handler, tests that call it, and mocks that imitate it.
2. For each mock, diff its fields and status codes against the contract response schema for that operation, then against the DTO.
3. For each API test, find where the response body is validated, if anywhere.
4. When a contract linter or validator is already a local dependency, it may run in the sandbox against repository files only.

## Validation rules (apply before reporting ANY finding here)

1. Cite the contract or DTO location (`test_basis`) and the test or mock location (`locations`).
2. State the operation, the exact field or status in dispute, and the verdict effect.
3. Severity follows the operation's risk: auth, payment, data-deletion, and public partner operations rank above internal read-only ones.
4. If the contract and implementation disagree, report that first; do not judge tests against either side until the owner decides which is authoritative (`needs_validation`).
