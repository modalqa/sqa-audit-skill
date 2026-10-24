# Non-Functional Testing (module `nonfunctional`)

#### When to use this file

Use this file for quality characteristics other than functional suitability and security, as defined by ISO/IEC 25010:2023: performance efficiency, reliability, compatibility, interaction capability (usability and accessibility), and flexibility (portability and configuration). Security belongs to the `security-audit` skill.

These checks are source-first. This workflow never runs load, stress, or soak tests. A performance finding rests on an algorithmic or query-pattern defect visible in source, optionally confirmed by a single bounded local timing.

## Core discipline (include in every agent prompt for this module)

```
- A non-functional candidate needs an oracle too: a stated requirement (latency, size limit, supported
  browsers, accessibility level), a documented platform constraint, or a defect whose effect is
  unambiguous (unbounded growth, quadratic work on user-controlled size, a lost write).
- Show the code path and the input size, condition, or environment that triggers it, and the concrete effect
  on users: slowness at realistic data volumes, crashes, data loss, inaccessible controls, or broken
  behavior on a supported platform.
- Never generate load against any environment. A single sandboxed timing or memory measurement at a
  realistic size is the maximum execution.
- A missing best practice with no user-visible effect is a hardening note, not a finding.
```

## Performance efficiency classes (subagent_type: `research`)

**NFR-N-PLUS-ONE — query or call per item in a loop**
Database queries, API calls, or file reads inside loops over user-sized collections, including ORM lazy loading in templates and serializers.

**NFR-UNBOUNDED-WORK — work or memory that grows without a limit**
Unpaginated queries, loading whole tables or files into memory, unbounded caches, and quadratic algorithms on user-controlled sizes.

**NFR-MISSING-INDEX — queries filtering or sorting on unindexed columns**
Compare migrations or schema definitions with query predicates on large tables.

**NFR-BLOCKING-IO — synchronous I/O on a request or UI thread**
Blocking calls in async handlers, the browser main thread, or mobile UI threads.

## Reliability classes (subagent_type: `research`)

**NFR-RESOURCE-LEAK — resources not released**
Connections, file handles, listeners, timers, and subscriptions not closed on every path, including errors.

**NFR-CONCURRENCY — race conditions and lost updates**
Read-modify-write without locking or versioning, check-then-act races, and shared mutable state across requests or workers.

**NFR-RECOVERABILITY — failure leaves the system unrecoverable**
Jobs that cannot resume, missing dead-letter handling, and startup that fails permanently on a transient dependency error.

**NFR-FAULT-TOLERANCE — one failure takes down unrelated features**
Missing isolation between components, unhandled promise rejections or panics that stop the process.

## Compatibility and flexibility classes (subagent_type: `research`)

**NFR-PLATFORM-SUPPORT — breaks on a supported platform**
Browser APIs, OS paths, runtime versions, or device features used without fallback on platforms the project states it supports (browserslist, engines, minimum SDK).

**NFR-CONFIGURATION — environment coupling**
Hardcoded hosts, paths, ports, and environment-specific values that break deployment to another supported environment.

**NFR-DATA-MIGRATION — migrations that fail or lose data on existing data**
Non-reversible or non-idempotent migrations, NOT NULL additions without defaults, and type changes that truncate.

## Interaction capability classes (subagent_type: `general`)

**NFR-ACCESSIBILITY — controls not operable or perceivable**
Missing accessible names, labels, roles, focus management, keyboard operability, and contrast, judged against WCAG 2.2 level AA unless the basis states another level. Verify with an accessibility checker already available locally or a sandboxed browser run.

**NFR-USER-ERROR-PROTECTION — destructive actions without confirmation or undo**
Where the basis or platform conventions expect protection.

**NFR-FEEDBACK — missing loading, empty, and error states**
Flows that leave users without feedback on long operations or failures.

## Universal moves (apply across the above)

1. Look for stated non-functional requirements in the basis first; derive the rest only from unambiguous effects.
2. Estimate realistic data volumes from fixtures, seed data, documentation, or limits in code, and state the estimate.
3. Confirm with one bounded local measurement when it changes the conclusion.

## Validation rules (apply before reporting ANY finding here)

1. Cite the oracle and the code path, and state the trigger size or condition.
2. Severity follows user-visible effect at realistic scale, not theoretical worst case.
3. The regression test is a bounded check: a query-count assertion, a complexity guard at a fixed size, an accessibility assertion, or a concurrency test with a deterministic schedule.
