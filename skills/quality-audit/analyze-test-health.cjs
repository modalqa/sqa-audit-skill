#!/usr/bin/env node

/**
 * Deterministic static scan of test-automation source for flakiness and
 * maintainability anti-patterns (Module A lead generation).
 * Usage: node analyze-test-health.cjs <target-root> [--out <new-file.json>]
 *
 * Hits are leads, not findings. The scanner never executes target code, never
 * follows symlinks, and never copies source text into its output, so secrets
 * or personal data in fixtures cannot leak into audit artifacts.
 */

const fs = require("node:fs");
const path = require("node:path");

const LIMITS = Object.freeze({
  walkedEntries: 200000,
  testFiles: 5000,
  fileBytes: 1024 * 1024,
  lineLength: 2000,
  hits: 20000,
  manifestBytes: 512 * 1024,
});
const SKIP_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "bower_components",
  "vendor",
  "dist",
  "build",
  "out",
  "coverage",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".gradle",
  ".idea",
  ".next",
  ".nuxt",
  "playwright-report",
  "test-results",
  "allure-results",
]);
const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
  ".py", ".java", ".kt", ".cs", ".go", ".rb",
]);
const TEST_FILE_PATTERNS = [
  /\.(?:spec|test|e2e|cy)\.[cm]?[jt]sx?$/i,
  /(?:^|\/)test_[^/]+\.py$/i,
  /_test\.(?:py|go)$/i,
  /(?:Test|Tests|IT|Spec)\.(?:java|kt|cs)$/,
  /_spec\.rb$/i,
];
const TEST_DIRECTORY = /(?:^|\/)(?:tests?|__tests__|e2e|cypress|integration|specs?|playwright|wdio|acceptance|ui-tests|api-tests)(?:\/|$)/i;
const COMMENT_LINE = /^\s*(?:\/\/|#|\*|\/\*|<!--)/;

// Flakiness weight feeds the per-file risk index; health weight feeds the score.
// Each rule's ISO/IEC 25010:2023 characteristic is the product-quality property of
// the test suite (as a work product) that the anti-pattern degrades.
const RULES = [
  {
    id: "SDET-FOCUSED-TEST",
    title: "Focused test committed (.only / fit / fdescribe)",
    characteristic: "functional_suitability",
    health: 10,
    flakiness: 0,
    patterns: [/\b(?:it|test|describe|context|suite)\.only\s*\(/, /\b(?:fit|fdescribe)\s*\(/],
  },
  {
    id: "SDET-HARD-WAIT",
    title: "Fixed-duration wait used for synchronization",
    characteristic: "reliability",
    health: 3,
    flakiness: 3,
    patterns: [
      /\bwaitForTimeout\s*\(/,
      /\bcy\.wait\s*\(\s*\d/,
      /\bThread\.sleep\s*\(/,
      /\btime\.sleep\s*\(/,
      /\btime\.Sleep\s*\(/,
      /\bbrowser\.pause\s*\(/,
      /\bdriver\.sleep\s*\(/,
      /\bTask\.Delay\s*\(\s*\d/,
      /\bpage\.waitFor\s*\(\s*\d/,
      /new\s+Promise\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*setTimeout\s*\(/,
      /\bsleep\s*\(\s*\d/,
    ],
  },
  {
    id: "SDET-NON-RETRYING-ASSERTION",
    title: "Assertion on a one-shot DOM read instead of a retrying (web-first) assertion",
    characteristic: "reliability",
    health: 2,
    flakiness: 2,
    patterns: [
      /expect\s*\(\s*await\s+[^;]*\.(?:textContent|innerText|innerHTML|isVisible|isHidden|isEnabled|isChecked|getAttribute|inputValue|count)\s*\(/,
    ],
  },
  {
    id: "SDET-BRITTLE-XPATH",
    title: "Absolute or positional XPath selector",
    characteristic: "maintainability",
    health: 2,
    flakiness: 2,
    patterns: [/["'`]\/html(?:\/|\[)/, /["'`](?:xpath=)?\/\/?[A-Za-z*]+\[\d+\](?:\/[A-Za-z*]+(?:\[\d+\])?){2,}/],
  },
  {
    id: "SDET-BRITTLE-CSS",
    title: "Structure-coupled or generated-class CSS selector",
    characteristic: "maintainability",
    health: 1,
    flakiness: 1,
    selectorCheck: true,
  },
  {
    id: "SDET-FORCED-ACTION",
    title: "Actionability checks bypassed with force",
    characteristic: "reliability",
    health: 1,
    flakiness: 1,
    patterns: [/\{\s*force\s*:\s*true\b/],
  },
  {
    id: "SDET-HARDCODED-URL",
    title: "Absolute URL in navigation instead of configured base URL",
    characteristic: "flexibility",
    health: 1,
    flakiness: 1,
    patterns: [/\b(?:goto|visit|navigate|get|open)\s*\(\s*["'`]https?:\/\//],
  },
  {
    id: "SDET-RETRY-MASKING",
    title: "High automatic retry count or rerun marker can hide flakiness",
    characteristic: "reliability",
    health: 1,
    flakiness: 1,
    patterns: [/\bretries\s*:\s*(?:[3-9]|\d{2,})\b/, /\bjest\.retryTimes\s*\(/, /@pytest\.mark\.flaky\b/, /--reruns(?:=|\s+)\d/],
  },
  {
    id: "SDET-SKIPPED-TEST",
    title: "Disabled test",
    characteristic: "functional_suitability",
    health: 1,
    flakiness: 0,
    patterns: [
      /\b(?:it|test|describe|context)\.skip\s*\(/,
      /\b(?:xit|xdescribe|xtest)\s*\(/,
      /@pytest\.mark\.skip\b/,
      /@(?:Disabled|Ignore)\b/,
      /\bt\.Skip(?:f|Now)?\s*\(/,
    ],
  },
  {
    id: "SDET-INLINE-SECRET",
    title: "Credential-shaped literal in test source",
    characteristic: "security",
    health: 2,
    flakiness: 0,
    patterns: [/\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i],
  },
];
const TEST_DECLARATION = /\b(?:it|test|specify|scenario)\s*\(|\bdef\s+test_\w*\s*\(|@Test\b|\bfunc\s+Test\w*\s*\(|\[(?:Test|Fact|Theory|TestMethod)\]/;
const ASSERTION = /\b(?:expect|assert\w*|should|verify|then)\b|\.should\s*\(|\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail)\b|\brequire\.\w+\s*\(|\bassertThat\b|\bAssert\.\w+|\bstatus\s*\(\s*\d{3}\s*\)/;
const SELECTOR_CALL = /\b(?:locator|querySelector(?:All)?|\$\$?|cy\.get|find_element|find_elements|findElement|findElements|By\.cssSelector|By\.css|By\.CSS_SELECTOR|css_selector)\s*\(\s*(?:By\.CSS_SELECTOR\s*,\s*)?["'`]([^"'`]{1,500})["'`]/g;
const GENERATED_CLASS = /\.(?:css|sc|jss|emotion|makeStyles)-[A-Za-z0-9]{5,}\b|\.[A-Za-z]+_[A-Za-z0-9]{5}_[0-9]+\b|\.Mui[A-Za-z]+-root-\d+\b/;

const FRAMEWORK_FILES = [
  [/^playwright\.config\.[cm]?[jt]s$/, "playwright"],
  [/^cypress\.config\.[cm]?[jt]s$|^cypress\.json$/, "cypress"],
  [/^wdio\.conf\.[cm]?[jt]s$/, "webdriverio"],
  [/^jest\.config\.[cm]?[jt]s(?:on)?$/, "jest"],
  [/^vitest\.config\.[cm]?[jt]s$/, "vitest"],
  [/^\.mocharc(?:\.[a-z]+)?$/, "mocha"],
  [/^pytest\.ini$|^conftest\.py$/, "pytest"],
  [/^karate-config\.js$/, "karate"],
  [/\.postman_collection\.json$/, "postman"],
  [/^(?:openapi|swagger)\.(?:ya?ml|json)$/i, "openapi-spec"],
];
const FRAMEWORK_DEPENDENCIES = new Map([
  ["@playwright/test", "playwright"],
  ["playwright", "playwright"],
  ["cypress", "cypress"],
  ["webdriverio", "webdriverio"],
  ["@wdio/cli", "webdriverio"],
  ["selenium-webdriver", "selenium"],
  ["appium", "appium"],
  ["jest", "jest"],
  ["vitest", "vitest"],
  ["mocha", "mocha"],
  ["supertest", "supertest"],
  ["k6", "k6"],
  ["@pact-foundation/pact", "pact"],
  ["msw", "msw"],
  ["nock", "nock"],
]);

class UsageError extends Error {}

function toPosix(relative) {
  return relative.split(path.sep).join("/");
}

function isTestFile(relative) {
  const extension = path.extname(relative).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(extension)) return false;
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(relative)) || TEST_DIRECTORY.test(path.posix.dirname(relative) + "/");
}

function isBrittleCssSelector(selector) {
  if (/^\s*(?:\/|xpath=|text=|role=|data-testid=|internal:)/.test(selector)) return false;
  if (/\[data-(?:testid|test-id|test|cy|qa)\b/.test(selector)) return false;
  const combinators = (selector.match(/\s>\s|>/g) || []).length;
  return combinators >= 3 || /:nth-(?:child|of-type)\(/.test(selector) || GENERATED_CLASS.test(selector);
}

function readBoundedFile(absolute, maxBytes) {
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  } catch {
    return null;
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const buffer = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < stat.size) {
      const count = fs.readSync(descriptor, buffer, offset, stat.size - offset, null);
      if (count === 0) break;
      offset += count;
    }
    return buffer.subarray(0, offset).toString("utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function walk(root, state) {
  const stack = [""];
  while (stack.length > 0) {
    const relativeDirectory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, relativeDirectory), { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => (left.name < right.name ? 1 : left.name > right.name ? -1 : 0));
    for (const entry of entries) {
      if (++state.walked > LIMITS.walkedEntries) {
        state.truncated = true;
        return;
      }
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      // Dirent types come from lstat semantics: symlinks are neither files nor directories here.
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) stack.push(relative);
      } else if (entry.isFile()) {
        state.filesSeen++;
        for (const [pattern, framework] of FRAMEWORK_FILES) {
          if (pattern.test(entry.name)) state.frameworks.add(framework);
        }
        if (entry.name === "package.json") state.manifests.push(relative);
        if (isTestFile(relative)) {
          if (state.testFiles.length >= LIMITS.testFiles) {
            state.truncated = true;
          } else {
            state.testFiles.push(relative);
          }
        }
      }
    }
  }
}

function detectManifestFrameworks(root, state) {
  for (const manifest of state.manifests) {
    const contents = readBoundedFile(path.join(root, manifest), LIMITS.manifestBytes);
    if (contents === null) continue;
    let parsed;
    try {
      parsed = JSON.parse(contents);
    } catch {
      continue;
    }
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const dependencies = parsed && typeof parsed[field] === "object" && parsed[field] !== null ? parsed[field] : {};
      for (const name of Object.keys(dependencies)) {
        if (FRAMEWORK_DEPENDENCIES.has(name)) state.frameworks.add(FRAMEWORK_DEPENDENCIES.get(name));
      }
    }
  }
}

function scanFile(root, relative, state) {
  const contents = readBoundedFile(path.join(root, relative), LIMITS.fileBytes);
  if (contents === null) {
    state.skippedFiles.push({ file: relative, reason: "unreadable, not a regular file, or over size limit" });
    return null;
  }
  const lines = contents.split(/\r?\n/);
  const fileHits = [];
  let firstTestLine = 0;
  let hasAssertion = false;

  const record = (rule, lineNumber) => {
    if (state.hits.length >= LIMITS.hits) {
      state.truncated = true;
      return;
    }
    const hit = {
      rule_id: rule.id,
      module: "sdet",
      file: relative,
      line: lineNumber,
      title: rule.title,
      quality_characteristic: rule.characteristic,
      health_weight: rule.health,
      flakiness_weight: rule.flakiness,
    };
    state.hits.push(hit);
    fileHits.push(hit);
  };

  lines.forEach((line, index) => {
    if (line.length > LIMITS.lineLength || COMMENT_LINE.test(line)) return;
    const lineNumber = index + 1;
    if (!firstTestLine && TEST_DECLARATION.test(line)) firstTestLine = lineNumber;
    if (!hasAssertion && ASSERTION.test(line)) hasAssertion = true;
    for (const rule of RULES) {
      if (rule.selectorCheck) {
        for (const match of line.matchAll(SELECTOR_CALL)) {
          if (isBrittleCssSelector(match[1])) {
            record(rule, lineNumber);
            break;
          }
        }
      } else if (rule.patterns.some((pattern) => pattern.test(line))) {
        record(rule, lineNumber);
      }
    }
  });

  if (firstTestLine && !hasAssertion) {
    record({
      id: "SDET-NO-ASSERTION",
      title: "Test file declares tests but contains no recognizable assertion",
      characteristic: "functional_suitability",
      health: 5,
      flakiness: 0,
    }, firstTestLine);
  }
  return { declaresTests: firstTestLine > 0, hits: fileHits };
}

function riskLevel(score) {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  if (score > 0) return "low";
  return "none";
}

function analyze(root) {
  const state = {
    walked: 0,
    filesSeen: 0,
    truncated: false,
    testFiles: [],
    manifests: [],
    frameworks: new Set(),
    hits: [],
    skippedFiles: [],
  };
  walk(root, state);
  detectManifestFrameworks(root, state);
  state.testFiles.sort();

  const perFile = [];
  for (const relative of state.testFiles) {
    const result = scanFile(root, relative, state);
    if (result) perFile.push({ file: relative, ...result });
  }

  // Each health-weight point costs a file 5 points, floored at 0; the suite score
  // is the mean across scanned test files, so one bad file cannot zero a large suite.
  const fileScores = perFile.map(({ hits }) => {
    const penalty = hits.reduce((sum, hit) => sum + hit.health_weight, 0);
    return Math.max(0, 100 - 5 * penalty);
  });
  const healthScore = fileScores.length === 0
    ? null
    : Math.round(fileScores.reduce((sum, score) => sum + score, 0) / fileScores.length);

  const flakinessRiskIndex = perFile
    .map(({ file, hits }) => {
      const riskScore = hits.reduce((sum, hit) => sum + hit.flakiness_weight, 0);
      const rules = {};
      const lines = [];
      for (const hit of hits) {
        if (hit.flakiness_weight === 0) continue;
        rules[hit.rule_id] = (rules[hit.rule_id] || 0) + 1;
        lines.push(hit.line);
      }
      return { file, risk_score: riskScore, risk_level: riskLevel(riskScore), rules, lines };
    })
    .filter((entry) => entry.risk_score > 0)
    .sort((left, right) => right.risk_score - left.risk_score || (left.file < right.file ? -1 : 1));

  const ruleCounts = {};
  for (const hit of state.hits) ruleCounts[hit.rule_id] = (ruleCounts[hit.rule_id] || 0) + 1;

  return {
    tool: "analyze-test-health",
    schema_version: 1,
    note: "Static leads only. A hit becomes a finding only after independent validation; scores are heuristic signals, not measured flake rates.",
    files_seen: state.filesSeen,
    test_files_scanned: perFile.length,
    test_files_declaring_tests: perFile.filter((entry) => entry.declaresTests).length,
    frameworks_detected: [...state.frameworks].sort(),
    health_score: healthScore,
    rule_counts: Object.fromEntries(Object.entries(ruleCounts).sort(([left], [right]) => (left < right ? -1 : 1))),
    flakiness_risk_index: flakinessRiskIndex,
    hits: state.hits,
    skipped_files: state.skippedFiles,
    truncated: state.truncated,
  };
}

function parseArguments(argv) {
  const options = { target: null, out: null };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--out") {
      options.out = argv[++index];
      if (!options.out) throw new UsageError("--out requires a path");
    } else if (argument.startsWith("-")) {
      throw new UsageError(`unknown option ${JSON.stringify(argument)}`);
    } else if (options.target === null) {
      options.target = argument;
    } else {
      throw new UsageError("only one target root is accepted");
    }
  }
  if (!options.target) throw new UsageError("missing target root");
  return options;
}

function run(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(`${error.message}\nUsage: node analyze-test-health.cjs <target-root> [--out <new-file.json>]`);
    return 1;
  }

  let root;
  try {
    root = fs.realpathSync(options.target);
    if (!fs.statSync(root).isDirectory()) throw new Error();
  } catch {
    console.error("Target root must be an existing directory");
    return 1;
  }

  const report = analyze(root);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    try {
      // Exclusive create: never overwrite or follow an existing path.
      fs.writeFileSync(options.out, output, { flag: "wx" });
    } catch (error) {
      console.error(`Failed to write report: ${error.code === "EEXIST" ? "output path already exists" : "output path is not writable"}`);
      return 1;
    }
    console.error(`Wrote ${report.hits.length} hit(s) across ${report.test_files_scanned} test file(s); health score ${report.health_score ?? "n/a"}`);
  } else {
    process.stdout.write(output);
  }
  return 0;
}

module.exports = {
  LIMITS,
  RULES,
  analyze,
  isBrittleCssSelector,
  isTestFile,
  riskLevel,
};

if (require.main === module) process.exit(run(process.argv.slice(2)));
