const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { analyze, isBrittleCssSelector, isTestFile, riskLevel } = require("./analyze-test-health.cjs");

const analyzerPath = path.join(__dirname, "analyze-test-health.cjs");
const CLI_TIMEOUT_MS = 10000;

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "test-health-"));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents);
  }
  return root;
}

function rulesAt(report, file) {
  return report.hits.filter((hit) => hit.file === file).map((hit) => `${hit.rule_id}:${hit.line}`);
}

test("classifies test files by name and directory", () => {
  assert.equal(isTestFile("src/login.spec.ts"), true);
  assert.equal(isTestFile("tests/test_login.py"), true);
  assert.equal(isTestFile("pkg/auth_test.go"), true);
  assert.equal(isTestFile("src/test/java/LoginTest.java"), true);
  assert.equal(isTestFile("e2e/helpers/page.ts"), true);
  assert.equal(isTestFile("src/login.ts"), false);
  assert.equal(isTestFile("tests/fixtures/users.json"), false);
});

test("flags hard waits but not condition-based waits", () => {
  const root = fixture({
    "e2e/login.spec.ts": [
      "test('login', async ({ page }) => {",
      "  await page.waitForTimeout(3000);",
      "  await page.waitForSelector('[data-testid=menu]');",
      "  cy.wait('@getUser');",
      "  cy.wait(500);",
      "  await expect(page.getByRole('heading')).toBeVisible();",
      "});",
    ].join("\n"),
  });
  const report = analyze(root);
  assert.deepEqual(rulesAt(report, "e2e/login.spec.ts"), ["SDET-HARD-WAIT:2", "SDET-HARD-WAIT:5"]);
});

test("flags focused tests, skipped tests, and one-shot assertions", () => {
  const root = fixture({
    "tests/cart.spec.js": [
      "describe.only('cart', () => {",
      "  it.skip('removes', () => {});",
      "  it('totals', async () => {",
      "    expect(await page.locator('#total').textContent()).toBe('10');",
      "  });",
      "});",
    ].join("\n"),
  });
  const report = analyze(root);
  assert.deepEqual(rulesAt(report, "tests/cart.spec.js"), [
    "SDET-FOCUSED-TEST:1",
    "SDET-SKIPPED-TEST:2",
    "SDET-NON-RETRYING-ASSERTION:4",
  ]);
});

test("judges selectors by structure coupling and stable test attributes", () => {
  assert.equal(isBrittleCssSelector("div > ul > li > a"), true);
  assert.equal(isBrittleCssSelector("ul li:nth-child(3)"), true);
  assert.equal(isBrittleCssSelector(".css-1x2y3z4 button"), true);
  assert.equal(isBrittleCssSelector("[data-testid=submit]"), false);
  assert.equal(isBrittleCssSelector("form > button"), false);
  assert.equal(isBrittleCssSelector("role=button"), false);
});

test("flags absolute XPath and ignores commented-out code", () => {
  const root = fixture({
    "tests/nav.spec.ts": [
      "test('nav', async ({ page }) => {",
      "  await page.locator('/html/body/div[2]/nav/a').click();",
      "  // await page.locator('/html/body/div[3]').click();",
      "  await expect(page).toHaveURL(/home/);",
      "});",
    ].join("\n"),
  });
  assert.deepEqual(rulesAt(analyze(root), "tests/nav.spec.ts"), ["SDET-BRITTLE-XPATH:2"]);
});

test("flags a test file without any assertion at its first test", () => {
  const root = fixture({
    "tests/test_smoke.py": "import requests\n\ndef test_home():\n    requests.get('http://localhost/')\n",
    "tests/test_ok.py": "def test_home(client):\n    assert client.get('/').status_code == 200\n",
  });
  const report = analyze(root);
  assert.deepEqual(rulesAt(report, "tests/test_smoke.py"), ["SDET-HARDCODED-URL:4", "SDET-NO-ASSERTION:3"]);
  assert.deepEqual(rulesAt(report, "tests/test_ok.py"), []);
});

test("never copies source text into the report", () => {
  const secret = "s3cr3t-Value-That-Must-Not-Leak";
  const root = fixture({ "tests/auth.spec.ts": `const password = "${secret}";\ntest('x', () => { expect(1).toBe(1); });\n` });
  const report = analyze(root);
  assert.deepEqual(rulesAt(report, "tests/auth.spec.ts"), ["SDET-INLINE-SECRET:1"]);
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test("skips dependency directories and symlinks", () => {
  const root = fixture({
    "node_modules/pkg/a.spec.js": "it.only('x', () => {})\n",
    "real/b.spec.js": "it('x', () => { expect(1).toBe(1); })\n",
  });
  fs.symlinkSync(path.join(root, "real"), path.join(root, "linked"));
  const report = analyze(root);
  assert.deepEqual(report.hits, []);
  assert.equal(report.test_files_scanned, 1);
});

test("computes the health score and flakiness risk index deterministically", () => {
  const root = fixture({
    "tests/a.spec.ts": "test('a', async () => {\n  await page.waitForTimeout(1);\n  await page.waitForTimeout(2);\n  expect(1).toBe(1);\n});\n",
    "tests/b.spec.ts": "test('b', () => { expect(1).toBe(1); });\n",
  });
  const report = analyze(root);
  // a: two hard waits = 6 health points -> 70; b: 100; mean 85.
  assert.equal(report.health_score, 85);
  assert.deepEqual(report.flakiness_risk_index, [
    { file: "tests/a.spec.ts", risk_score: 6, risk_level: "high", rules: { "SDET-HARD-WAIT": 2 }, lines: [2, 3] },
  ]);
  assert.deepEqual(analyze(root), report);
  assert.equal(riskLevel(0), "none");
  assert.equal(riskLevel(3), "medium");
});

test("reports a null score when no test files exist", () => {
  const report = analyze(fixture({ "src/index.js": "module.exports = 1;\n" }));
  assert.equal(report.health_score, null);
  assert.equal(report.test_files_scanned, 0);
});

test("detects frameworks from config files and manifests", () => {
  const root = fixture({
    "playwright.config.ts": "export default {};\n",
    "package.json": JSON.stringify({ devDependencies: { supertest: "^7.0.0", msw: "^2.0.0" } }),
    "api/openapi.yaml": "openapi: 3.1.0\n",
  });
  assert.deepEqual(analyze(root).frameworks_detected, ["msw", "openapi-spec", "playwright", "supertest"]);
});

test("CLI writes with exclusive create and refuses to overwrite", () => {
  const root = fixture({ "tests/a.spec.ts": "test('a', () => { expect(1).toBe(1); });\n" });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "test-health-out-")), "health.json");
  const first = spawnSync(process.execPath, [analyzerPath, root, "--out", out], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(fs.readFileSync(out, "utf8")).test_files_scanned, 1);
  const second = spawnSync(process.execPath, [analyzerPath, root, "--out", out], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(second.status, 1);
  assert.match(second.stderr, /already exists/);
});

test("CLI rejects a missing target", () => {
  const result = spawnSync(process.execPath, [analyzerPath], { encoding: "utf8", timeout: CLI_TIMEOUT_MS });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage/);
});
