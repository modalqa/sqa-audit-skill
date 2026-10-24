#!/usr/bin/env node

/**
 * Validates a quality-audit run directory: quality-findings.json,
 * quality-ledger.json, and (when Module B ran) traceability-matrix.json.
 * Usage: node validate-quality-run.cjs <output-dir>
 *
 * This is a dependency-free interpreter for the JSON Schema keywords used by
 * quality-report-schema.json, plus cross-file checks that are clearer in code.
 * It is deliberately self-contained so the skill installs without its sibling.
 */

const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const LIMITS = Object.freeze({
  inputBytes: 5 * 1024 * 1024,
  nestingDepth: 64,
  arrayItems: 10000,
  validationErrors: 100,
});
const FILES = Object.freeze({
  findings: "quality-findings.json",
  ledger: "quality-ledger.json",
  matrix: "traceability-matrix.json",
});
const SUPPORTED_TYPES = new Set(["object", "array", "string", "integer", "number", "boolean", "null"]);
const SUPPORTED_KEYWORDS = new Set([
  "$comment",
  "$ref",
  "additionalProperties",
  "const",
  "description",
  "enum",
  "items",
  "minimum",
  "minItems",
  "minLength",
  "oneOf",
  "pattern",
  "properties",
  "required",
  "type",
  "uniqueItems",
  "visibleContent",
]);
const RULE_PREFIX = new Map([["sdet", "SDET-"], ["qa", "QA-"], ["seit", "SEIT-"]]);
const AGENT_ARTIFACT = /^agents\/([a-z0-9][a-z0-9_-]{0,63})\/artifacts\/[^/].*$/;
const VISIBLE_CONTENT = /[^\p{White_Space}\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u;
const PATH_FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;
const UNSAFE_DIAGNOSTIC_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const MAX_DIAGNOSTIC_STRING_LENGTH = 256;

class SafeInputError extends Error {}

function escapeUnsafeDiagnosticCharacters(value) {
  return String(value).replace(UNSAFE_DIAGNOSTIC_CHARACTER, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0xffff
      ? `\\u${codePoint.toString(16).padStart(4, "0")}`
      : `\\u{${codePoint.toString(16)}}`;
  });
}

function safeQuote(value) {
  if (typeof value === "string") {
    const clipped = value.length > MAX_DIAGNOSTIC_STRING_LENGTH ? `${value.slice(0, MAX_DIAGNOSTIC_STRING_LENGTH)}...` : value;
    return escapeUnsafeDiagnosticCharacters(JSON.stringify(clipped));
  }
  if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return String(value);
  return `"<${Array.isArray(value) ? "array" : typeof value}>"`;
}

function createErrorList() {
  const errors = [];
  Object.defineProperty(errors, "push", {
    value(...messages) {
      const remaining = LIMITS.validationErrors - this.length;
      if (remaining > 0) Array.prototype.push.apply(this, messages.slice(0, remaining).map(escapeUnsafeDiagnosticCharacters));
      return this.length;
    },
  });
  return errors;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function typeMatches(value, expected) {
  const actual = typeOf(value);
  return actual === expected || (expected === "number" && actual === "integer");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function propertyPath(base, key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;
}

function resolveReference(schema, root) {
  if (!hasOwn(schema, "$ref")) return schema;
  const name = schema.$ref.slice(1);
  return root.definitions[name];
}

function collectSchemaErrors(root) {
  const errors = [];
  if (!root || typeof root !== "object" || !root.definitions) return ["schema: missing definitions"];
  const visit = (schema, location) => {
    if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
      errors.push(`${location}: schema must be an object`);
      return;
    }
    for (const key of Object.keys(schema)) {
      if (!SUPPORTED_KEYWORDS.has(key)) errors.push(`${location}: unsupported keyword ${JSON.stringify(key)}`);
    }
    if (hasOwn(schema, "$ref") && (typeof schema.$ref !== "string" || !schema.$ref.startsWith("#") || !hasOwn(root.definitions, schema.$ref.slice(1)))) {
      errors.push(`${location}: unresolved $ref`);
    }
    if (hasOwn(schema, "type")) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (types.length === 0 || !types.every((type) => SUPPORTED_TYPES.has(type))) errors.push(`${location}: unsupported type`);
    }
    if (hasOwn(schema, "pattern")) {
      try {
        new RegExp(schema.pattern, "u");
      } catch {
        errors.push(`${location}: invalid pattern`);
      }
    }
    if (hasOwn(schema, "properties")) {
      for (const [key, child] of Object.entries(schema.properties)) visit(child, `${location}.properties.${key}`);
    }
    if (hasOwn(schema, "items")) visit(schema.items, `${location}.items`);
    if (hasOwn(schema, "oneOf")) schema.oneOf.forEach((branch, index) => visit(branch, `${location}.oneOf[${index}]`));
  };
  for (const key of ["findings", "ledger", "matrix"]) visit(root[key], `schema.${key}`);
  for (const [key, definition] of Object.entries(root.definitions)) visit(definition, `schema.definitions.${key}`);
  return errors;
}

function validate(value, rawSchema, p, errors, root) {
  if (errors.length >= LIMITS.validationErrors) return;
  const schema = resolveReference(rawSchema, root);

  if (hasOwn(schema, "oneOf")) {
    const results = schema.oneOf.map((branch) => {
      const branchErrors = createErrorList();
      validate(value, branch, p, branchErrors, root);
      return branchErrors;
    });
    const passing = results.filter((branchErrors) => branchErrors.length === 0).length;
    if (passing !== 1) {
      errors.push(`${p}: must match exactly one schema in oneOf; matched ${passing}`);
      // Surface the errors of the branch whose const discriminator matches, so the message is actionable.
      if (passing === 0 && typeOf(value) === "object") {
        const index = schema.oneOf.findIndex((branch) => branch.properties && branch.properties.verdict &&
          branch.properties.verdict.const === value.verdict);
        if (index !== -1) errors.push(...results[index]);
      }
    }
    return;
  }

  if (hasOwn(schema, "type")) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(`${p}: expected ${types.join("|")}, got ${typeOf(value)}`);
      return;
    }
  }
  if (hasOwn(schema, "const") && canonical(value) !== canonical(schema.const)) {
    errors.push(`${p}: must equal ${safeQuote(schema.const)}, got ${safeQuote(value)}`);
  }
  if (hasOwn(schema, "enum") && !schema.enum.some((allowed) => canonical(allowed) === canonical(value))) {
    errors.push(`${p}: invalid value ${safeQuote(value)} (expected one of ${schema.enum.map(safeQuote).join(", ")})`);
  }

  if (typeOf(value) === "object") {
    for (const field of schema.required || []) {
      if (!hasOwn(value, field)) errors.push(`${p}: missing required field ${safeQuote(field)}`);
    }
    for (const key of Object.keys(value)) {
      if (schema.properties && hasOwn(schema.properties, key)) {
        validate(value[key], schema.properties[key], propertyPath(p, key), errors, root);
      } else if (schema.additionalProperties === false) {
        errors.push(`${p}: unexpected field ${safeQuote(key)}`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (value.length > LIMITS.arrayItems) {
      errors.push(`${p}: exceeds ${LIMITS.arrayItems} item array limit`);
      return;
    }
    if (hasOwn(schema, "minItems") && value.length < schema.minItems) {
      errors.push(`${p}: must have at least ${schema.minItems} item(s), got ${value.length}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      value.forEach((item, index) => {
        const key = canonical(item);
        if (seen.has(key)) errors.push(`${p}: items must be unique; duplicate at index ${index}`);
        seen.add(key);
      });
    }
    if (hasOwn(schema, "items")) value.forEach((item, index) => validate(item, schema.items, `${p}[${index}]`, errors, root));
  }

  if (typeof value === "string") {
    if (hasOwn(schema, "minLength") && [...value].length < schema.minLength) {
      errors.push(`${p}: must have at least ${schema.minLength} character(s)`);
    }
    if (schema.visibleContent === true && !VISIBLE_CONTENT.test(value)) {
      errors.push(`${p}: must contain a visible character`);
    }
    if (hasOwn(schema, "pattern") && !new RegExp(schema.pattern, "u").test(value)) {
      errors.push(`${p}: must match pattern ${JSON.stringify(schema.pattern)}`);
    }
  }

  if (typeof value === "number" && hasOwn(schema, "minimum") && value < schema.minimum) {
    errors.push(`${p}: must be at least ${schema.minimum}, got ${value}`);
  }
}

function isSafeRelativeSourcePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || PATH_FORBIDDEN_CHARACTER.test(value)) return false;
  if (value.includes("\\") || value.includes(":") || value.startsWith("~")) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function checkPath(value, p, errors) {
  if (!isSafeRelativeSourcePath(value)) errors.push(`${p}: must be a safe repository-relative path, got ${safeQuote(value)}`);
}

function collectFindingSemanticErrors(findings, errors) {
  const seen = new Set();
  let previous = null;
  findings.forEach((finding, index) => {
    const p = `$findings[${index}]`;
    if (seen.has(finding.fingerprint)) errors.push(`${p}: duplicate fingerprint ${safeQuote(finding.fingerprint)}`);
    seen.add(finding.fingerprint);
    if (previous !== null && finding.fingerprint < previous) errors.push(`${p}: findings must be sorted by fingerprint`);
    previous = finding.fingerprint;

    const prefix = RULE_PREFIX.get(finding.module);
    if (prefix && !finding.rule.startsWith(prefix)) errors.push(`${p}.rule: must start with ${safeQuote(prefix)} for module ${safeQuote(finding.module)}`);

    finding.locations.forEach((location, locationIndex) => checkPath(location.file, `${p}.locations[${locationIndex}].file`, errors));
    (finding.test_basis || []).forEach((location, locationIndex) => checkPath(location.file, `${p}.test_basis[${locationIndex}].file`, errors));
    if (finding.module === "qa" && finding.verdict !== "rejected" && finding.test_basis.length === 0) {
      errors.push(`${p}.test_basis: a qa finding must cite the requirement or specification it traces to`);
    }
    if (finding.remediation && finding.remediation.code_changes) {
      finding.remediation.code_changes.forEach((change, changeIndex) => checkPath(change.file, `${p}.remediation.code_changes[${changeIndex}].file`, errors));
    }
    if (finding.evidence) {
      const { method, artifact } = finding.evidence;
      if (method === "source" && artifact !== null) errors.push(`${p}.evidence.artifact: a source check must use null`);
      if (method === "local" && (typeof artifact !== "string" || !AGENT_ARTIFACT.test(artifact) || !isSafeRelativeSourcePath(artifact))) {
        errors.push(`${p}.evidence.artifact: a local check must link a promoted file under agents/<agent-id>/artifacts/`);
      }
    }
  });
}

function collectLedgerSemanticErrors(ledger, errors) {
  const seen = new Set();
  ledger.units.forEach((unit, index) => {
    const p = `$ledger.units[${index}]`;
    if (seen.has(unit.unit_id)) errors.push(`${p}: duplicate unit_id ${safeQuote(unit.unit_id)}`);
    seen.add(unit.unit_id);
    if (!unit.unit_id.startsWith(`${unit.module}/`)) errors.push(`${p}.unit_id: must start with ${safeQuote(`${unit.module}/`)}`);
    unit.starting_paths.forEach((value, pathIndex) => checkPath(value, `${p}.starting_paths[${pathIndex}]`, errors));
    unit.reviewed_paths.forEach((value, pathIndex) => checkPath(value, `${p}.reviewed_paths[${pathIndex}]`, errors));

    const hasEvidence = unit.reviewed_paths.length > 0 || unit.checks.length > 0;
    const hasFingerprints = unit.result_fingerprints.length > 0;
    const hasUnresolved = unit.unresolved.length > 0;
    switch (unit.status) {
      case "planned":
        if (unit.agent_id !== null || hasEvidence || hasFingerprints || hasUnresolved) errors.push(`${p}: a planned unit has no owner or evidence`);
        break;
      case "in_progress":
        if (unit.agent_id === null) errors.push(`${p}: an in_progress unit needs an agent_id`);
        break;
      case "covered":
      case "candidate":
      case "blocked":
        if (unit.agent_id === null || unit.reviewed_paths.length === 0 || unit.checks.length === 0) {
          errors.push(`${p}: a ${unit.status} unit needs an agent_id, reviewed_paths, and checks`);
        }
        if (unit.status === "covered" && (hasFingerprints || hasUnresolved)) errors.push(`${p}: a covered unit has no fingerprints or unresolved facts`);
        if (unit.status === "candidate" && !hasFingerprints) errors.push(`${p}: a candidate unit needs result_fingerprints`);
        if (unit.status === "blocked" && (!hasUnresolved || hasFingerprints)) errors.push(`${p}: a blocked unit needs unresolved facts and no fingerprints`);
        break;
      default:
        if (unit.reason === null) errors.push(`${p}: a ${unit.status} unit needs a reason`);
        if (unit.agent_id !== null || hasEvidence || hasFingerprints) errors.push(`${p}: a ${unit.status} unit carries no owner or evidence`);
    }
  });
}

function collectMatrixSemanticErrors(matrix, findingsByFingerprint, errors) {
  const basisIds = new Set();
  matrix.test_basis.forEach((basis, index) => {
    const p = `$matrix.test_basis[${index}]`;
    if (basisIds.has(basis.basis_id)) errors.push(`${p}: duplicate basis_id ${safeQuote(basis.basis_id)}`);
    basisIds.add(basis.basis_id);
    checkPath(basis.path, `${p}.path`, errors);
  });

  const requirementIds = new Set();
  matrix.requirements.forEach((requirement, index) => {
    const p = `$matrix.requirements[${index}]`;
    if (requirementIds.has(requirement.requirement_id)) errors.push(`${p}: duplicate requirement_id ${safeQuote(requirement.requirement_id)}`);
    requirementIds.add(requirement.requirement_id);
    if (!basisIds.has(requirement.basis_id)) errors.push(`${p}.basis_id: unknown basis ${safeQuote(requirement.basis_id)}`);

    const conditionIds = new Set();
    const elevated = requirement.risk_level === "critical" || requirement.risk_level === "high";
    requirement.test_conditions.forEach((condition, conditionIndex) => {
      const c = `${p}.test_conditions[${conditionIndex}]`;
      if (conditionIds.has(condition.condition_id)) errors.push(`${c}: duplicate condition_id ${safeQuote(condition.condition_id)}`);
      conditionIds.add(condition.condition_id);
      condition.test_cases.forEach((testCase, caseIndex) => checkPath(testCase.file, `${c}.test_cases[${caseIndex}].file`, errors));

      const linked = condition.test_cases.length > 0;
      if ((condition.status === "covered" || condition.status === "partial") && !linked) {
        errors.push(`${c}: a ${condition.status} condition must link at least one test case`);
      }
      if ((condition.status === "uncovered" || condition.status === "not_testable") && linked) {
        errors.push(`${c}: an ${condition.status} condition links no test case`);
      }
      if (condition.status === "not_testable" && condition.note === null) errors.push(`${c}.note: explain why the condition is not testable`);
      if (condition.status === "covered" && condition.gap_fingerprint !== null) errors.push(`${c}.gap_fingerprint: a covered condition has no gap`);
      if ((condition.status === "uncovered" || condition.status === "partial") && elevated && condition.gap_fingerprint === null) {
        errors.push(`${c}.gap_fingerprint: a ${condition.status} condition on a ${requirement.risk_level}-risk requirement must link a qa finding`);
      }
      if (condition.gap_fingerprint !== null) {
        const finding = findingsByFingerprint.get(condition.gap_fingerprint);
        if (!finding || finding.verdict === "rejected" || finding.module !== "qa") {
          errors.push(`${c}.gap_fingerprint: must reference a confirmed or needs_validation qa finding`);
        }
      }
    });
  });
}

function collectCrossFileErrors(findings, ledger, errors, warnings) {
  const unitsByFingerprint = new Map();
  for (const unit of ledger.units) {
    for (const fingerprint of unit.result_fingerprints) {
      if (!unitsByFingerprint.has(fingerprint)) unitsByFingerprint.set(fingerprint, []);
      unitsByFingerprint.get(fingerprint).push(unit);
    }
  }
  const findingFingerprints = new Set(findings.map((finding) => finding.fingerprint));
  findings.forEach((finding, index) => {
    const units = unitsByFingerprint.get(finding.fingerprint) || [];
    if (units.length === 0) errors.push(`$findings[${index}]: fingerprint is not linked from any ledger unit`);
    if (units.some((unit) => unit.module !== finding.module)) errors.push(`$findings[${index}]: module differs from its linked ledger unit`);
  });
  for (const unit of ledger.units) {
    for (const fingerprint of unit.result_fingerprints) {
      if (findingFingerprints.has(fingerprint)) continue;
      if (unit.unresolved.length > 0) {
        warnings.push(`unit ${unit.unit_id}: candidate ${fingerprint} awaits validation; the run is incomplete`);
      } else {
        errors.push(`$ledger unit ${safeQuote(unit.unit_id)}: fingerprint ${safeQuote(fingerprint)} has no finding and no unresolved reason`);
      }
    }
  }
}

function validateRun({ findings, ledger, matrix }, schema) {
  const errors = createErrorList();
  const warnings = [];
  const schemaErrors = collectSchemaErrors(schema);
  if (schemaErrors.length > 0) return { errors: schemaErrors, warnings };

  validate(findings, schema.findings, "$findings", errors, schema);
  validate(ledger, schema.ledger, "$ledger", errors, schema);
  if (matrix !== undefined) validate(matrix, schema.matrix, "$matrix", errors, schema);
  // Semantic checks assume well-formed documents; report structural errors first.
  if (errors.length > 0) return { errors, warnings };

  collectFindingSemanticErrors(findings, errors);
  collectLedgerSemanticErrors(ledger, errors);
  collectCrossFileErrors(findings, ledger, errors, warnings);

  const qaUnitsReviewed = ledger.units.some((unit) => unit.module === "qa" && ["covered", "candidate", "blocked"].includes(unit.status));
  if (matrix === undefined && qaUnitsReviewed) {
    errors.push(`${FILES.matrix}: required when a qa ledger unit was reviewed`);
  } else if (matrix !== undefined) {
    collectMatrixSemanticErrors(matrix, new Map(findings.map((finding) => [finding.fingerprint, finding])), errors);
  }
  return { errors, warnings };
}

function readFileWithinLimit(file) {
  const noFollow = fs.constants.O_NOFOLLOW;
  const nonBlock = fs.constants.O_NONBLOCK;
  if (!Number.isInteger(noFollow) || noFollow === 0 || !Number.isInteger(nonBlock) || nonBlock === 0) {
    throw new SafeInputError("OS no-follow and nonblocking input protection is unavailable");
  }
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | noFollow | nonBlock);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    if (error && (error.code === "ELOOP" || error.code === "EMLINK")) throw new SafeInputError("input must not be a symlink");
    throw new SafeInputError("input could not be opened");
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new SafeInputError("input must be a regular file");
    if (stat.size > LIMITS.inputBytes) throw new SafeInputError(`input exceeds ${LIMITS.inputBytes} byte limit`);
    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytesRead = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      bytesRead += count;
      if (bytesRead > LIMITS.inputBytes) throw new SafeInputError(`input exceeds ${LIMITS.inputBytes} byte limit`);
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    try {
      return UTF8_DECODER.decode(Buffer.concat(chunks, bytesRead));
    } catch {
      throw new SafeInputError("input is not valid UTF-8");
    }
  } finally {
    fs.closeSync(descriptor);
  }
}

function enforceNestingDepth(contents) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of contents) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "\"") inString = false;
    } else if (character === "\"") {
      inString = true;
    } else if (character === "[" || character === "{") {
      if (++depth > LIMITS.nestingDepth) throw new SafeInputError(`input exceeds ${LIMITS.nestingDepth} level nesting depth limit`);
    } else if (character === "]" || character === "}") {
      depth--;
    }
  }
}

function loadJson(directory, name, required) {
  const contents = readFileWithinLimit(path.join(directory, name));
  if (contents === null) {
    if (required) throw new SafeInputError(`${name} is missing`);
    return undefined;
  }
  enforceNestingDepth(contents);
  try {
    return JSON.parse(contents);
  } catch {
    throw new SafeInputError(`${name} has invalid JSON syntax`);
  }
}

function run(directory) {
  if (!directory) {
    console.error("Usage: node validate-quality-run.cjs <output-dir>");
    return 1;
  }
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(path.join(__dirname, "quality-report-schema.json"), "utf8"));
  } catch {
    console.error("Failed to load quality-report-schema.json");
    return 1;
  }

  let documents;
  try {
    documents = {
      findings: loadJson(directory, FILES.findings, true),
      ledger: loadJson(directory, FILES.ledger, true),
      matrix: loadJson(directory, FILES.matrix, false),
    };
  } catch (error) {
    const reason = error instanceof SafeInputError ? error.message : "input could not be read safely";
    console.error(`Failed to read run files: ${reason}`);
    return 1;
  }

  let result;
  try {
    result = validateRun(documents, schema);
  } catch {
    console.error("Failed to validate run: unexpected validation error");
    return 1;
  }
  for (const message of result.warnings) console.error("WARN:", escapeUnsafeDiagnosticCharacters(message));
  for (const message of result.errors) console.error("ERROR:", message);
  if (result.errors.length > 0) {
    const cap = result.errors.length === LIMITS.validationErrors ? `; output capped at ${LIMITS.validationErrors}` : "";
    console.error(`FAIL: ${result.errors.length} validation error(s)${cap}`);
    return 1;
  }
  const matrixNote = documents.matrix === undefined ? "no traceability matrix" : `${documents.matrix.requirements.length} requirement(s) traced`;
  console.log(`PASS: ${documents.findings.length} finding(s), ${documents.ledger.units.length} ledger unit(s), ${matrixNote}`);
  return 0;
}

module.exports = {
  FILES,
  LIMITS,
  collectSchemaErrors,
  isSafeRelativeSourcePath,
  validateRun,
};

if (require.main === module) process.exit(run(process.argv[2]));
