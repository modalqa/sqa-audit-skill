const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const schema = require("./quality-report-schema.json");
const { collectSchemaErrors, isSafeRelativeSourcePath, validateRun } = require("./validate-quality-run.cjs");

const validatorPath = path.join(__dirname, "validate-quality-run.cjs");
const CLI_TIMEOUT_MS = 5000;

function location(file = "src/refunds/service.ts", line = 42, description = "The refund amount is compared with <= against the order total instead of the captured amount.") {
  return { file, line, description };
}

function testCase() {
  return {
    title: "Refund above the captured amount is rejected",
    preconditions: ["An order with total 100.00 and captured amount 60.00 exists."],
    steps: ["Request a refund of 60.01 for the order."],
    expected_result: "The request is rejected with a validation error and no refund is recorded.",
  };
}

function confirmedFunctional() {
  return {
    verdict: "confirmed",
    fingerprint: "func-refund-limit-uses-order-total",
    module: "functional",
    rule: "FUNC-BOUNDARY",
    quality_characteristic: "functional_suitability",
    title: "Refund limit checks the order total instead of the captured amount",
    description: "A partially captured order accepts refunds above the captured amount.",
    root_cause: "validateRefund compares the amount with order.total rather than order.capturedAmount.",
    oracle: { kind: "requirement", description: "The PRD states a refund cannot exceed the captured amount." },
    test_basis: [location("docs/prd/refunds.md", 18, "A refund cannot exceed the captured amount.")],
    locations: [location()],
    reproduction: {
      method: "local",
      environment: "Local sandbox, Node 24, in-memory repository fixture.",
      preconditions: ["Order fixture with total 100.00 and captured amount 60.00."],
      steps: ["Call refundService.refund(order.id, 60.01)."],
      input: ["amount=60.01"],
      expected_result: "ValidationError is thrown.",
      actual_result: "A refund of 60.01 is recorded.",
      artifact: "agents/func-verifier-1/artifacts/refund-limit.txt",
    },
    impact: "Merchants can refund money that was never captured, creating a direct financial loss.",
    remediation: { strategy: "Compare the requested amount with capturedAmount minus prior refunds." },
    regression_test: {
      level: "component",
      test_case: testCase(),
      script: {
        framework: "vitest",
        language: "typescript",
        file: "src/refunds/service.refund-limit.test.ts",
        code: "it('rejects refunds above the captured amount', async () => {\n  await expect(service.refund(order.id, 60.01)).rejects.toThrow(ValidationError);\n});",
      },
      verified_failing: true,
    },
    severity: "high",
    confidence: "high",
  };
}

function needsValidationApi() {
  return {
    verdict: "needs_validation",
    fingerprint: "api-orders-404-shape",
    module: "api",
    rule: "API-ERROR-SHAPE",
    quality_characteristic: "compatibility",
    title: "Order lookup may return an error body that differs from the contract",
    description: "The handler returns a plain string on 404 while the contract declares an Error object.",
    claimed_root_cause: "getOrder sends res.status(404).send('not found').",
    test_basis: [location("api/openapi.yaml", 120, "404 response uses the Error schema.")],
    locations: [location("src/api/orders.ts", 33, "The 404 branch sends a plain string.")],
    blockers: ["A global error middleware may rewrite the body; its registration order depends on deployment config."],
    validation_plan: "Request a missing order on the authorized staging origin and compare the body shape with the Error schema.",
    proposed_test_case: testCase(),
  };
}

function covered(unitId, module, agentId = "func-reviewer-1") {
  return {
    unit_id: unitId,
    module,
    scope: "Refund flows",
    starting_paths: ["src/refunds"],
    status: "covered",
    agent_id: agentId,
    reviewed_paths: ["src/refunds/service.ts"],
    checks: [{ agent_id: agentId, check: "Refund amount boundaries", method: "source", result: "Checked against the PRD." }],
    result_fingerprints: [],
    unresolved: [],
    reason: null,
  };
}

function candidate(unitId, module, fingerprints) {
  return { ...covered(unitId, module), status: "candidate", result_fingerprints: fingerprints };
}

function condition(overrides) {
  return {
    condition_id: "C1",
    kind: "happy_path",
    technique: "equivalence_partitioning",
    summary: "A valid partial refund succeeds.",
    implementation: [location("src/refunds/service.ts", 30, "refund records the amount.")],
    verdict: "pass",
    verification_method: "source",
    existing_tests: [location("src/refunds/service.test.ts", 10, "Partial refund test.")],
    defect_fingerprint: null,
    note: null,
    ...overrides,
  };
}

function matrix() {
  return {
    test_basis: [{ basis_id: "PRD-REFUNDS", path: "docs/prd/refunds.md", kind: "prd" }],
    requirements: [
      {
        requirement_id: "REQ-REFUND-1",
        basis_id: "PRD-REFUNDS",
        line: 18,
        summary: "A refund cannot exceed the captured amount.",
        risk_level: "high",
        test_conditions: [
          condition(),
          condition({
            condition_id: "C2",
            kind: "negative",
            technique: "boundary_value_analysis",
            summary: "A refund at captured amount + 0.01 is rejected.",
            verdict: "fail",
            verification_method: "local",
            existing_tests: [],
            defect_fingerprint: "func-refund-limit-uses-order-total",
          }),
        ],
      },
    ],
  };
}

function validRun() {
  return {
    findings: [needsValidationApi(), confirmedFunctional()],
    ledger: {
      units: [
        candidate("api/orders", "api", ["api-orders-404-shape"]),
        candidate("functional/refunds", "functional", ["func-refund-limit-uses-order-total"]),
      ],
    },
    matrix: matrix(),
  };
}

function errorsOf(run) {
  return validateRun(run, schema).errors;
}

test("the shipped schema uses only interpreted keywords", () => {
  assert.deepEqual(collectSchemaErrors(schema), []);
});

test("accepts a consistent run and reports untested high-risk conditions as coverage gaps", () => {
  const result = validateRun(validRun(), schema);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, ["coverage gap: REQ-REFUND-1/C2 (high risk) has no existing test"]);
});

test("requires a regression test and reproduction on confirmed findings", () => {
  const run = validRun();
  delete run.findings[1].regression_test;
  delete run.findings[1].reproduction.expected_result;
  const errors = errorsOf(run).join("\n");
  assert.match(errors, /missing required field "regression_test"/);
  assert.match(errors, /missing required field "expected_result"/);
});

test("requires a proposed test case and forbids severity on needs_validation", () => {
  const run = validRun();
  run.findings[0].severity = "high";
  delete run.findings[0].proposed_test_case;
  const errors = errorsOf(run).join("\n");
  assert.match(errors, /unexpected field "severity"/);
  assert.match(errors, /missing required field "proposed_test_case"/);
});

test("rejects a rule prefix that does not match its module", () => {
  const run = validRun();
  run.findings[1].rule = "API-BOUNDARY";
  assert.match(errorsOf(run).join("\n"), /must start with "FUNC-"/);
});

test("rejects unsorted fingerprints", () => {
  const run = validRun();
  run.findings.reverse();
  assert.match(errorsOf(run).join("\n"), /sorted by fingerprint/);
});

test("rejects unsafe paths, including the regression script path", () => {
  for (const value of ["/etc/passwd", "../x", "a/./b", "C:\\x", "~/x", " a"]) {
    assert.equal(isSafeRelativeSourcePath(value), false, value);
  }
  const run = validRun();
  run.findings[1].regression_test.script.file = "../outside.test.ts";
  assert.match(errorsOf(run).join("\n"), /script\.file: must be a safe repository-relative path/);
});

test("requires a requirement oracle to cite its test basis", () => {
  const run = validRun();
  run.findings[1].test_basis = [];
  assert.match(errorsOf(run).join("\n"), /requirement oracle must cite its test basis/);
  run.findings[1].oracle.kind = "code_contract";
  assert.deepEqual(errorsOf(run), []);
});

test("requires local and staging reproductions to link a promoted artifact", () => {
  const run = validRun();
  run.findings[1].reproduction.method = "staging";
  run.findings[1].reproduction.artifact = null;
  assert.match(errorsOf(run).join("\n"), /staging reproduction must link a promoted file/);
});

test("rejects verified_failing without an executed reproduction", () => {
  const run = validRun();
  run.findings[1].reproduction.method = "source";
  run.findings[1].reproduction.artifact = null;
  assert.match(errorsOf(run).join("\n"), /verified_failing: requires a local or staging reproduction/);
});

test("rejects credentials embedded in a regression script", () => {
  const run = validRun();
  run.findings[1].regression_test.script.code = "const password = 'Hunter2Hunter2';\nit('x', () => {});";
  assert.match(errorsOf(run).join("\n"), /credential-shaped literal/);
});

test("requires every finding to be linked from a ledger unit of the same module", () => {
  const run = validRun();
  run.ledger.units[1] = covered("functional/refunds", "functional");
  assert.match(errorsOf(run).join("\n"), /not linked from any ledger unit/);
});

test("warns instead of failing for a candidate awaiting validation", () => {
  const run = validRun();
  run.findings = [run.findings[0]];
  run.matrix.requirements[0].test_conditions[1] = condition({ condition_id: "C2", verdict: "needs_validation", note: "Validation pending." });
  run.ledger.units[1].unresolved = ["Validation budget exhausted before this candidate."];
  const result = validateRun(run, schema);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /awaits validation/);
});

test("enforces ledger state contracts and module-scoped unit IDs", () => {
  const run = validRun();
  run.ledger.units.push({ ...covered("nonfunctional/search", "nonfunctional"), status: "deferred" });
  run.ledger.units.push(covered("functional/x", "api"));
  const errors = errorsOf(run).join("\n");
  assert.match(errors, /deferred unit needs a reason/);
  assert.match(errors, /must start with "api\/"/);
});

test("requires a fail verdict to link a confirmed application finding", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[1].defect_fingerprint = "api-orders-404-shape";
  assert.match(errorsOf(run).join("\n"), /fail verdict must link a confirmed finding/);
  run.matrix.requirements[0].test_conditions[1].defect_fingerprint = null;
  assert.match(errorsOf(run).join("\n"), /fail verdict must link a confirmed finding/);
});

test("requires a pass verdict to cite its implementation and carry no defect", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[0].implementation = [];
  run.matrix.requirements[0].test_conditions[0].defect_fingerprint = "func-refund-limit-uses-order-total";
  const errors = errorsOf(run).join("\n");
  assert.match(errors, /pass verdict must cite the implementation/);
  assert.match(errors, /pass verdict has no defect/);
});

test("ties a null verification method to the not_testable verdict", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[0] = condition({ verdict: "not_testable", implementation: [], verification_method: "source", note: "Needs hardware." });
  assert.match(errorsOf(run).join("\n"), /null exactly when the verdict is not_testable/);
});

test("rejects a matrix link to a testware finding", () => {
  const run = validRun();
  run.findings[1].module = "testware";
  run.findings[1].rule = "SDET-HARD-WAIT";
  run.ledger.units[1] = candidate("testware/refunds", "testware", ["func-refund-limit-uses-order-total"]);
  assert.match(errorsOf(run).join("\n"), /application finding/);
});

test("requires the matrix once a functional unit was reviewed", () => {
  const run = validRun();
  delete run.matrix;
  assert.match(errorsOf(run).join("\n"), /traceability-matrix\.json: required/);
});

function writeRun(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quality-run-"));
  fs.writeFileSync(path.join(directory, "quality-findings.json"), JSON.stringify(run.findings));
  fs.writeFileSync(path.join(directory, "quality-ledger.json"), JSON.stringify(run.ledger));
  if (run.matrix) fs.writeFileSync(path.join(directory, "traceability-matrix.json"), JSON.stringify(run.matrix));
  return directory;
}

test("CLI passes a valid run directory and prints coverage-gap warnings", () => {
  const result = spawnSync(process.execPath, [validatorPath, writeRun(validRun())], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS: 2 finding\(s\), 2 ledger unit\(s\), 1 requirement\(s\) traced/);
  assert.match(result.stderr, /WARN: coverage gap/);
});

test("CLI fails on a missing findings file and on a symlinked input", () => {
  const directory = writeRun(validRun());
  const target = path.join(directory, "quality-findings.json");
  fs.renameSync(target, path.join(directory, "real.json"));
  let result = spawnSync(process.execPath, [validatorPath, directory], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /quality-findings\.json is missing/);
  fs.symlinkSync(path.join(directory, "real.json"), target);
  result = spawnSync(process.execPath, [validatorPath, directory], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not be a symlink/);
});

test("CLI escapes terminal control characters in diagnostics", () => {
  const run = validRun();
  run.findings[1].rule = "\u001b[31mBAD";
  const result = spawnSync(process.execPath, [validatorPath, writeRun(run)], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("\u001b"), false);
});
