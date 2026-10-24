# SDET Automation Health (Module A)

#### When to use this file

Reach for this file for any UI, mobile, or API automation suite: Playwright, Cypress, Selenium/WebDriver, WebdriverIO, Appium, Puppeteer, TestCafe, Detox, Espresso/XCUITest, pytest, Jest/Vitest/Mocha, JUnit/TestNG, NUnit/xUnit, Go `testing`, RSpec. It covers synchronization, locator strategy, assertion design, isolation, test automation architecture, and reliability controls.

`analyze-test-health.cjs` gives this module its leads. Use [QA-COVERAGE-TRACEABILITY.md](QA-COVERAGE-TRACEABILITY.md) for what the tests should cover and [SEIT-API-CONTRACT.md](SEIT-API-CONTRACT.md) for API schema and mock fidelity.

## Core discipline (include in every agent prompt for this module)

```
- A candidate names the test, the defect, and its effect on the verdict: false pass, false fail,
  nondeterministic verdict, or a maintenance cost the source shows is already being paid.
- Read the code under test far enough to know whether the awaited state is asynchronous, which element
  a locator resolves to, and what the assertion actually proves.
- Framework auto-waiting, retrying assertions, fixture isolation, and configured retries are real
  controls. Check them before claiming nondeterminism.
- A scanner hit is a lead. Confirm or reject each assigned hit and record the reason either way.
- Use `confirmed` only with a complete source trace, plus a sandboxed repeat run when the claim is
  nondeterminism and the suite can run offline. Otherwise use `needs_validation` with the exact blocker.
- Never copy fixture secrets or personal data into a result; cite file and line.
```

## Synchronization classes (subagent_type: `general`)

**SDET-HARD-WAIT — fixed-duration wait as synchronization**
`waitForTimeout`, `cy.wait(<ms>)`, `Thread.sleep`, `time.sleep`, `browser.pause`, `Task.Delay`, or a `setTimeout` promise stands between an action and an assertion or interaction that depends on asynchronous state. Confirm that the awaited state is asynchronous and that nothing else synchronizes on it. A sleep that only throttles a polling loop with its own condition, or waits for a documented fixed delay under test, is not a finding.

**SDET-NON-RETRYING-ASSERTION — one-shot read asserted as final state**
`expect(await locator.textContent()).toBe(...)`, `isVisible()` checks, or `getAttribute` reads asserted once while the UI is still settling. The fix is a retrying web-first assertion (`await expect(locator).toHaveText(...)`) or an explicit condition wait.

**SDET-RACE-ON-NAVIGATION — action before the page or response is ready**
Clicks that trigger navigation or requests without waiting for the URL, response, or resulting element. Includes `Promise.all` misuse and missing `waitForResponse` for assertions on network-driven state.

**SDET-FORCED-ACTION — actionability checks bypassed**
`{ force: true }`, JavaScript-dispatched clicks, or `executeScript` clicks that let the test act on an element a user could not reach. This can produce a false pass when the element is covered or disabled.

## Locator classes (subagent_type: `general`)

**SDET-BRITTLE-XPATH — absolute or positional XPath**
`/html/body/...` or chains of indexed steps couple the test to layout. Confirm that a stable alternative exists or should exist (role, label, `data-testid`) and that the markup is likely to change: generated, frequently edited, or changed by the diff under review.

**SDET-BRITTLE-CSS — structure-coupled or generated-class selectors**
Three or more child combinators, `:nth-child`, or CSS-in-JS hashed class names. Short structural selectors scoped inside a stable container are acceptable.

**SDET-AMBIGUOUS-LOCATOR — locator that can match more than one element**
`first()`, `nth(0)`, or text selectors that silently choose among several matches. This can produce false passes on the wrong element.

## Assertion and isolation classes (subagent_type: `general`)

**SDET-NO-ASSERTION — test that cannot fail on behavior**
A test with no assertion, an assertion only on a mock it configured, `expect(true)`, an assertion inside a callback that never runs, or a `try/catch` that swallows the failure. This is the most severe automation class because it reports pass for any behavior.

**SDET-FOCUSED-TEST — committed `.only`, `fit`, `fdescribe`**
In a CI-gating suite, a focused test silently disables every other test in the file or the run. Confirm whether CI uses `--forbid-only` or an equivalent; if it does, severity drops to informational.

**SDET-SKIPPED-TEST — disabled test without an owner or exit condition**
`skip`, `xit`, `@Disabled`, `@pytest.mark.skip`. A finding only when the skipped test is the sole coverage of a requirement condition; link it to Module B.

**SDET-SHARED-STATE — order-dependent tests**
Tests that rely on state created by an earlier test, module-level mutable data, shared accounts, or unreset databases or storage. Confirm with the runner's parallel or shuffle settings.

**SDET-NONDETERMINISTIC-DATA — uncontrolled time, randomness, or locale**
Assertions that depend on the current date, time zone, locale, unseeded randomness, or ordering of unordered collections.

**SDET-INLINE-SECRET — credential-shaped literal in test source**
Report the location only. State whether it looks like a dummy value. If it may be real, the remediation is to rotate it and load it from the test environment; this is also a security lead for the security workflow in combined mode.

## Architecture and reliability classes (subagent_type: `research`)

**SDET-MISSING-ABSTRACTION — no page object, screen object, fixture, or helper layer**
The same locator or flow is duplicated across many specs, so one UI change requires many edits. Count the duplicates and name the abstraction (page object, component object, fixture, keyword) that would own them. This is a maintainability finding only when the duplication is substantial and the source shows churn.

**SDET-RETRY-MASKING — retries hide flakiness**
High retry counts, `retryTimes`, rerun plugins, or quarantine lists without reporting of first-attempt failures. A retry policy is a legitimate mitigation; the defect is retrying without surfacing flaky passes. Conversely, a CI-gating E2E suite with known nondeterminism sources and no retry or flake reporting is a reliability gap.

**SDET-HARDCODED-URL — environment coupled into tests**
Absolute URLs, ports, or environment names instead of the configured base URL, which ties the suite to one environment and can point tests at a shared environment.

**SDET-TIMEOUT-POLICY — global timeouts that hide slowness or cause false fails**
Very large global timeouts that hide performance regressions, or timeouts below the system's documented latency.

## Framework-specific checks

- **Playwright**: prefer `getByRole`/`getByLabel`/`getByTestId`; web-first `expect`; `forbidOnly: !!process.env.CI`; `trace: 'on-first-retry'`; per-test isolation through fixtures.
- **Cypress**: `cy.wait('@alias')` rather than `cy.wait(ms)`; no assigning `cy` command results to variables; `cy.session` for login; `data-cy`/`data-testid` selectors.
- **Selenium/WebDriver/Appium**: explicit `WebDriverWait` with expected conditions; no mixing implicit and explicit waits; accessibility IDs on mobile.
- **pytest/JUnit/Jest/Go**: fixture scope matches isolation needs; parametrized boundary cases; no network in unit tests; `t.Parallel` or `pytest-xdist` safety for shared state.

## Universal moves (apply across the above)

1. For each hit, read the line, the code under test it waits on or locates, and the assertion that follows.
2. Check the suite's configuration for auto-wait, retry, forbid-only, and isolation settings before judging.
3. When the suite can run offline in the sandbox, repeat only the affected test with the runner's repeat option (for example `--repeat-each`) up to a small bound, and stop at the first differing verdict.
4. Group hits with the same root cause (one helper's sleep used by many specs) into one candidate.

## Validation rules (apply before reporting ANY finding here)

1. Cite the test location, the code under test it depends on, and the control that should synchronize, isolate, or assert.
2. State the verdict effect: false pass, false fail, or nondeterministic, and the requirement or flow the test protects.
3. For nondeterminism, show the asynchronous dependency in source; a local repeat result strengthens but is not required for `confirmed` when the race is source-evident and no control prevents it.
4. For maintainability classes, show concrete duplication or churn; do not report style preferences.
5. Use `needs_validation` when the decisive fact is CI behavior, flake history, or environment data outside the repository.
