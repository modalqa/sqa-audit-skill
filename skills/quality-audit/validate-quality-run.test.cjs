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

function location(file = "e2e/checkout.spec.ts", line = 12) {
  return { file, line, description: "The test sleeps instead of waiting for the order summary." };
}

function confirmedSdet() {
  return {
    verdict: "confirmed",
    fingerprint: "e2e-checkout-hard-wait-before-summary",
    module: "sdet",
    rule: "SDET-HARD-WAIT",
    quality_characteristic: "reliability",
    title: "Checkout test races the order summary with a fixed wait",
    description: "The checkout test asserts the summary after a 2 s sleep while the summary loads asynchronously.",
    root_cause: "page.waitForTimeout(2000) is the only synchronization before a one-shot textContent assertion.",
    consequence: "The test fails nondeterministically when the summary request takes longer than 2 s.",
    test_basis: [],
    locations: [location()],
    evidence: { method: "source", result: "The summary is rendered after an async fetch in src/checkout/summary.tsx:40.", artifact: null },
    remediation: { strategy: "Replace the sleep and the one-shot read with await expect(summary).toHaveText(...)." },
    severity: "medium",
    confidence: "high",
  };
}

function needsValidationQa() {
  return {
    verdict: "needs_validation",
    fingerprint: "qa-refund-over-limit-uncovered",
    module: "qa",
    rule: "QA-UNCOVERED-CONDITION",
    quality_characteristic: "functional_suitability",
    title: "Refund above the order total has no negative test",
    description: "No test exercises a refund amount above the captured order total.",
    claimed_root_cause: "The refund suite covers only valid amounts.",
    test_basis: [location("docs/prd/refunds.md", 18)],
    locations: [location("tests/refunds.test.ts", 1)],
    blockers: ["The PRD does not state whether partial refunds may exceed shipping-only totals."],
    validation_plan: "Ask the product owner to confirm the upper bound, then add a boundary test at total and total + 0.01.",
  };
}

function covered(unitId, module, agentId = "sdet-hunter-1") {
  return {
    unit_id: unitId,
    module,
    scope: "Checkout E2E suite",
    starting_paths: ["e2e"],
    status: "covered",
    agent_id: agentId,
    reviewed_paths: ["e2e/cart.spec.ts"],
    checks: [{ agent_id: agentId, check: "Synchronization before assertions", method: "source", result: "Uses web-first assertions." }],
    result_fingerprints: [],
    unresolved: [],
    reason: null,
  };
}

function candidate(unitId, module, fingerprints) {
  return { ...covered(unitId, module), status: "candidate", result_fingerprints: fingerprints };
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
          {
            condition_id: "TC-1",
            kind: "happy_path",
            technique: "equivalence_partitioning",
            summary: "Refund of a valid partial amount succeeds.",
            status: "covered",
            test_cases: [location("tests/refunds.test.ts", 10)],
            gap_fingerprint: null,
            note: null,
          },
          {
            condition_id: "TC-2",
            kind: "negative",
            technique: "boundary_value_analysis",
            summary: "Refund at total + 0.01 is rejected.",
            status: "uncovered",
            test_cases: [],
            gap_fingerprint: "qa-refund-over-limit-uncovered",
            note: null,
          },
        ],
      },
    ],
  };
}

function validRun() {
  return {
    findings: [confirmedSdet(), needsValidationQa()],
    ledger: {
      units: [
        candidate("qa/refunds", "qa", ["qa-refund-over-limit-uncovered"]),
        candidate("sdet/e2e-checkout", "sdet", ["e2e-checkout-hard-wait-before-summary"]),
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

test("accepts a consistent run", () => {
  assert.deepEqual(validateRun(validRun(), schema), { errors: [], warnings: [] });
});

test("rejects severity on needs_validation and missing consequence on confirmed", () => {
  const run = validRun();
  run.findings[1].severity = "high";
  delete run.findings[0].consequence;
  const errors = errorsOf(run).join("\n");
  assert.match(errors, /missing required field "consequence"/);
  assert.match(errors, /unexpected field "severity"/);
});

test("rejects a rule prefix that does not match its module", () => {
  const run = validRun();
  run.findings[0].rule = "QA-HARD-WAIT";
  assert.match(errorsOf(run).join("\n"), /must start with "SDET-"/);
});

test("rejects unsorted or duplicate fingerprints", () => {
  const run = validRun();
  run.findings.reverse();
  assert.match(errorsOf(run).join("\n"), /sorted by fingerprint/);
});

test("rejects unsafe paths", () => {
  for (const value of ["/etc/passwd", "../x", "a/./b", "C:\\x", "~/x", " a"]) {
    assert.equal(isSafeRelativeSourcePath(value), false, value);
  }
  const run = validRun();
  run.findings[0].locations[0].file = "../outside.ts";
  assert.match(errorsOf(run).join("\n"), /safe repository-relative path/);
});

test("requires local evidence to link a promoted agent artifact", () => {
  const run = validRun();
  run.findings[0].evidence = { method: "local", result: "Failed 3 of 20 repeats.", artifact: "scratch/out.txt" };
  assert.match(errorsOf(run).join("\n"), /promoted file under agents/);
  run.findings[0].evidence.artifact = "agents/sdet-verifier-1/artifacts/repeat.txt";
  assert.deepEqual(errorsOf(run), []);
});

test("requires a qa finding to cite its test basis", () => {
  const run = validRun();
  run.findings[1].test_basis = [];
  assert.match(errorsOf(run).join("\n"), /must cite the requirement/);
});

test("requires every finding to be linked from a ledger unit of the same module", () => {
  const run = validRun();
  run.ledger.units[1] = covered("sdet/e2e-checkout", "sdet");
  assert.match(errorsOf(run).join("\n"), /not linked from any ledger unit/);
});

test("warns instead of failing for a candidate awaiting validation", () => {
  const run = validRun();
  run.findings = [run.findings[1]];
  run.ledger.units[1].unresolved = ["Validation budget exhausted before this candidate."];
  const result = validateRun(run, schema);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /awaits validation/);
});

test("enforces ledger state contracts", () => {
  const run = validRun();
  run.ledger.units.push({ ...covered("seit/orders-api", "seit"), status: "deferred" });
  assert.match(errorsOf(run).join("\n"), /deferred unit needs a reason/);
});

test("requires a gap fingerprint for uncovered high-risk conditions", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[1].gap_fingerprint = null;
  assert.match(errorsOf(run).join("\n"), /must link a qa finding/);
});

test("rejects a gap fingerprint that points at a non-qa or rejected finding", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[1].gap_fingerprint = "e2e-checkout-hard-wait-before-summary";
  assert.match(errorsOf(run).join("\n"), /confirmed or needs_validation qa finding/);
});

test("rejects coverage claims without linked test cases", () => {
  const run = validRun();
  run.matrix.requirements[0].test_conditions[0].test_cases = [];
  assert.match(errorsOf(run).join("\n"), /must link at least one test case/);
});

test("requires the matrix once a qa unit was reviewed", () => {
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

test("CLI passes a valid run directory", () => {
  const result = spawnSync(process.execPath, [validatorPath, writeRun(validRun())], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS: 2 finding\(s\), 2 ledger unit\(s\), 1 requirement\(s\) traced/);
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
  run.findings[0].rule = "\u001b[31mBAD";
  const result = spawnSync(process.execPath, [validatorPath, writeRun(run)], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes("\u001b"), false);
});
