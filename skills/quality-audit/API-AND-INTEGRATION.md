# API and Integration Testing (module `api`)

#### When to use this file

Use this file when the application exposes an API (REST, GraphQL, gRPC, webhooks, message consumers) or depends on other services, databases, or third-party APIs. It finds defects where the implementation does not conform to its contract, or where integration behavior (errors, retries, timeouts, partial failure) is wrong.

Mock and fixture drift in the existing test suite belongs to [TESTWARE-HEALTH.md](TESTWARE-HEALTH.md). Business rules behind an endpoint belong to [FUNCTIONAL-TESTING.md](FUNCTIONAL-TESTING.md).

## Core discipline (include in every agent prompt for this module)

```
- Identify the authoritative contract for each operation: OpenAPI/Swagger, AsyncAPI, GraphQL SDL,
  protobuf, JSON Schema, Pact, or documented examples. If the contract and the implementation disagree,
  that disagreement is the defect; state which side the documentation or consumers rely on.
- Compare the implementation, not the tests, with the contract: routes, methods, parameters, request
  validation, response status codes, body schema, headers, content types, pagination, and error format.
- Verify behavior locally by starting the service in the sandbox on loopback with dummy data, or on an
  authorized staging origin under STAGING-TESTING.md. Never call third-party or production APIs; replace
  them with local stubs.
- For integrations, read how each outbound call handles timeout, error status, malformed response,
  retry, and partial failure, and what the user or caller sees as a result.
- The regression test is an API or contract test in the repository's framework that asserts the
  contract (status and schema), not only the status code.
```

## Contract conformance classes (subagent_type: `general`)

**API-STATUS-CODE — status code differs from the contract**
Success or error statuses that the contract does not declare for the operation (200 instead of 201, 500 instead of 400 or 404, 200 with an error body).

**API-RESPONSE-SCHEMA — response body differs from the contract**
Missing required fields, extra undocumented fields in strict schemas, wrong types, wrong nullability, enum values outside the declared set, and date or number formats that differ.

**API-REQUEST-VALIDATION — request constraints not enforced or over-enforced**
Required parameters, formats, lengths, and ranges in the contract that the handler does not enforce, or enforces differently.

**API-ERROR-SHAPE — error responses differ from the documented error format**
Plain strings, stack traces, framework default pages, or inconsistent error objects across endpoints.

**API-UNDOCUMENTED-OPERATION — implemented route absent from the contract, or the reverse**
Routes in the code with no contract entry, and contract operations with no implementation.

**API-COMPATIBILITY-BREAK — change breaks existing consumers**
For a diff under review: renamed or removed fields, changed types, new required request fields, or changed semantics without versioning.

**API-PAGINATION-CONSISTENCY — paging, sorting, and filtering parameters behave differently from the contract**

## Integration behavior classes (subagent_type: `general`)

**API-DEPENDENCY-FAILURE — wrong behavior when a dependency fails**
Timeouts, 5xx responses, connection errors, and malformed responses from databases, queues, and external APIs that crash the request, hang, return success, or leave inconsistent state.

**API-RETRY-IDEMPOTENCY — unsafe retries**
Retries of non-idempotent operations without idempotency keys, retry storms without backoff, and duplicate processing of redelivered messages or webhooks.

**API-TIMEOUT-POLICY — missing or inconsistent timeouts**
Outbound calls without timeouts, or timeouts longer than the caller's, which cause cascading hangs.

**API-MESSAGE-CONTRACT — event or message payloads differ from the declared schema**
Producers and consumers that disagree on fields, versions, or ordering guarantees.

## Universal moves (apply across the above)

1. Build an operation table: operation, contract location, handler location, request validation, response construction, error paths, and existing tests.
2. For each operation, derive conditions for the success response, each declared error, and each constrained field, and add them to the matrix as `api_contract` requirements.
3. Start the service locally in the sandbox with dummy data and local stubs, and send one request per condition. When the service cannot start locally and staging is authorized, use staging read-only.
4. Validate responses against the contract schema with a validator already available locally; do not install one.

## Validation rules (apply before reporting ANY finding here)

1. Cite the contract location (`test_basis`) and the implementation location (`locations`).
2. State the operation, the exact field, status, or header in dispute, and the observed response shape.
3. Severity follows the operation's risk and consumer reach: payments, authentication, data deletion, and public partner APIs rank above internal read-only operations.
4. If the contract itself is stale and consumers rely on the implementation, report the contract mismatch and ask the owner which side is authoritative (`needs_validation`).
