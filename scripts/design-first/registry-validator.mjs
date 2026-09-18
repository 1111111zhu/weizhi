#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import nodePath from "node:path";

import {
  readProvenanceHash,
  validateRegistryApproval,
} from "./registry-approval.mjs";

const { dirname, join, relative, resolve } = nodePath;
const __dirname = import.meta.dirname;
const REPO_ROOT = resolve(__dirname, "../..");
const ASSETS_DIR = resolve(REPO_ROOT, ".design-first/assets");
const BASELINE_PATH = resolve(ASSETS_DIR, "minimum-component-baseline.json");

const COMPONENT_STATUSES = new Set([
  "planned",
  "experimental",
  "ready",
  "deprecated",
]);
const LAYERS = new Set([
  "foundation",
  "primitive",
  "pattern",
  "layout",
  "archetype",
]);
const EXCEPTION_STATUSES = new Set(["proposed", "approved", "rejected"]);
const TEST_KINDS = [
  "interaction",
  "keyboard",
  "accessibility",
  "visual",
  "responsive",
];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SCRIPT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];

const EXPORT_DECLARATION_RE =
  /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum|namespace)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
const EXPORT_CLAUSE_RE =
  /\bexport\s*\{([^}]+)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
const EXPORT_STAR_RE = /\bexport\s*\*\s*from\s*['"]([^'"]+)['"]/g;

export class ValidationReport {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  error(message) {
    this.errors.push(message);
  }

  warning(message) {
    this.warnings.push(message);
  }

  get isValid() {
    return this.errors.length === 0;
  }
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(`Failed to read/parse JSON at ${path}: ${error.message}`);
  }
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoDateTime(value) {
  if (!isNonemptyString(value)) return false;
  if (!value.includes("T")) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function requireObject(value, path, report) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    report.error(`${path} must be an object`);
    return {};
  }
  return value;
}

function requireArray(value, path, report) {
  if (!Array.isArray(value)) {
    report.error(`${path} must be an array`);
    return [];
  }
  return value;
}

function requireKeys(obj, keys, path, report) {
  for (const key of keys) {
    if (!(key in obj)) {
      report.error(`${path}.${key} is required`);
    }
  }
}

function rejectExtraKeys(obj, keys, path, report) {
  const allowed = new Set(keys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      report.error(`${path}.${key} is not allowed`);
    }
  }
}

function resolveScriptModule(sourceFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(sourceFile), specifier);
  const candidates = [
    base,
    ...SCRIPT_EXTENSIONS.map((ext) => base + ext),
    ...SCRIPT_EXTENSIONS.map((ext) => join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function clauseExportNames(clause) {
  const names = new Set();
  for (const raw of clause.split(",")) {
    let item = raw.trim().replace(/\s+/g, " ");
    item = item.replace(/^type\s+/, "");
    if (!item) continue;
    const parts = item.split(/\s+as\s+/);
    const exported = parts[parts.length - 1].trim();
    if (IDENTIFIER_PATTERN.test(exported)) {
      names.add(exported);
    }
  }
  return names;
}

export function collectPublicExports(entryPath, visited = new Set()) {
  const resolved = resolve(entryPath);
  if (
    visited.has(resolved) ||
    !existsSync(resolved) ||
    !statSync(resolved).isFile()
  ) {
    return new Set();
  }
  visited.add(resolved);
  const text = readFileSync(resolved, "utf-8");
  const exports = new Set();

  for (const match of text.matchAll(EXPORT_DECLARATION_RE)) {
    exports.add(match[1]);
  }
  for (const match of text.matchAll(EXPORT_CLAUSE_RE)) {
    const specifier = match[2];
    if (!specifier || resolveScriptModule(resolved, specifier)) {
      for (const name of clauseExportNames(match[1])) {
        exports.add(name);
      }
    }
  }
  for (const match of text.matchAll(EXPORT_STAR_RE)) {
    const target = resolveScriptModule(resolved, match[1]);
    if (target) {
      for (const name of collectPublicExports(target, visited)) {
        exports.add(name);
      }
    }
  }
  return exports;
}

export function validateComponentShape(raw, index, report) {
  const path = `components[${index}]`;
  const component = requireObject(raw, path, report);
  const keys = [
    "id",
    "name",
    "layer",
    "category",
    "status",
    "publicExport",
    "sourcePath",
    "showroomPath",
    "showroomSource",
    "requiredStates",
    "coveredStates",
    "tests",
    "replacement",
    "notes",
  ];
  requireKeys(component, keys, path, report);
  rejectExtraKeys(component, keys, path, report);

  const componentId = component.id;
  if (!isNonemptyString(componentId) || !ID_PATTERN.test(componentId)) {
    report.error(`${path}.id must be lower-case hyphen-case`);
  }
  if (!isNonemptyString(component.name)) {
    report.error(`${path}.name must be a non-empty string`);
  }
  if (!LAYERS.has(component.layer)) {
    report.error(
      `${path}.layer must be one of ${Array.from(LAYERS).sort().join(", ")}`
    );
  }
  if (!isNonemptyString(component.category)) {
    report.error(`${path}.category must be a non-empty string`);
  }
  if (!COMPONENT_STATUSES.has(component.status)) {
    report.error(
      `${path}.status must be one of ${Array.from(COMPONENT_STATUSES).sort().join(", ")}`
    );
  }

  for (const field of ["requiredStates", "coveredStates"]) {
    const states = requireArray(component[field], `${path}.${field}`, report);
    if (new Set(states).size !== states.length) {
      report.error(`${path}.${field} must not contain duplicates`);
    }
    if (states.some((state) => !isNonemptyString(state))) {
      report.error(`${path}.${field} must contain non-empty strings`);
    }
  }

  const tests = requireObject(component.tests, `${path}.tests`, report);
  requireKeys(tests, TEST_KINDS, `${path}.tests`, report);
  rejectExtraKeys(tests, TEST_KINDS, `${path}.tests`, report);
  for (const kind of TEST_KINDS) {
    const paths = requireArray(tests[kind], `${path}.tests.${kind}`, report);
    if (paths.some((testPath) => !isNonemptyString(testPath))) {
      report.error(`${path}.tests.${kind} must contain non-empty paths`);
    }
  }

  return component;
}

export function validateReadyComponent(
  component,
  projectRoot,
  publicExports,
  report
) {
  const componentId = component.id ?? "<unknown>";
  const prefix = `Ready component '${componentId}'`;

  for (const field of [
    "publicExport",
    "sourcePath",
    "showroomPath",
    "showroomSource",
  ]) {
    if (!isNonemptyString(component[field])) {
      report.error(`${prefix} requires ${field}`);
    }
  }

  const publicExport = component.publicExport;
  if (
    isNonemptyString(publicExport) &&
    !IDENTIFIER_PATTERN.test(publicExport)
  ) {
    report.error(`${prefix} publicExport must be a named identifier`);
  }
  if (
    publicExports &&
    isNonemptyString(publicExport) &&
    !publicExports.has(publicExport)
  ) {
    report.error(
      `${prefix} is not exported by project.publicEntry: ${publicExport}`
    );
  }

  const requiredStates = new Set(component.requiredStates || []);
  const coveredStates = new Set(component.coveredStates || []);
  const missingStates = Array.from(requiredStates).filter(
    (s) => !coveredStates.has(s)
  );
  if (missingStates.length > 0) {
    report.error(
      `${prefix} is missing covered states: ${missingStates.sort().join(", ")}`
    );
  }

  const tests =
    typeof component.tests === "object" && component.tests !== null
      ? component.tests
      : {};
  for (const kind of TEST_KINDS) {
    if (!Array.isArray(tests[kind]) || tests[kind].length === 0) {
      report.error(`${prefix} requires at least one ${kind} test path`);
    }
  }

  if (projectRoot) {
    const pathTuples = [];
    for (const field of ["sourcePath", "showroomSource"]) {
      if (isNonemptyString(component[field])) {
        pathTuples.push([field, component[field]]);
      }
    }
    for (const kind of TEST_KINDS) {
      const testPaths = Array.isArray(tests[kind]) ? tests[kind] : [];
      for (const testPath of testPaths) {
        pathTuples.push([`tests.${kind}`, testPath]);
      }
    }

    for (const [field, relPath] of pathTuples) {
      const candidate = resolve(projectRoot, relPath);
      if (relative(projectRoot, candidate).startsWith("..")) {
        report.error(`${prefix} ${field} escapes project root: ${relPath}`);
        continue;
      }
      if (!existsSync(candidate)) {
        report.error(`${prefix} ${field} does not exist: ${relPath}`);
      } else if (!statSync(candidate).isFile()) {
        report.error(`${prefix} ${field} must identify a file: ${relPath}`);
      } else if (statSync(candidate).size === 0) {
        report.error(`${prefix} ${field} is empty: ${relPath}`);
      }
    }

    const sourcePath = component.sourcePath;
    if (isNonemptyString(sourcePath) && isNonemptyString(publicExport)) {
      const source = resolve(projectRoot, sourcePath);
      if (existsSync(source) && statSync(source).isFile()) {
        const text = readFileSync(source, "utf-8");
        const pattern = new RegExp(`\\b${publicExport}\\b`);
        if (!pattern.test(text)) {
          report.error(
            `${prefix} sourcePath does not contain publicExport '${publicExport}'`
          );
        }
      }
    }

    const showroomSource = component.showroomSource;
    if (isNonemptyString(showroomSource) && isNonemptyString(publicExport)) {
      const showroom = resolve(projectRoot, showroomSource);
      if (existsSync(showroom) && statSync(showroom).isFile()) {
        const text = readFileSync(showroom, "utf-8");
        const pattern = new RegExp(`\\b${publicExport}\\b`);
        if (!pattern.test(text)) {
          report.error(
            `${prefix} showroomSource does not reference publicExport '${publicExport}'`
          );
        }
      }
    }
  }
}

export function validateRegistryData(registry, options = {}) {
  const report = new ValidationReport();
  const {
    projectRoot = REPO_ROOT,
    requireReady = false,
    requireApproved = false,
    expectedProvenanceHash = null,
    baseline = existsSync(BASELINE_PATH)
      ? loadJson(BASELINE_PATH).capabilities
      : [],
  } = options;

  const topKeys = [
    "$schema",
    "schemaVersion",
    "project",
    "approval",
    "components",
    "exceptions",
  ];
  requireKeys(
    registry,
    ["schemaVersion", "project", "approval", "components", "exceptions"],
    "registry",
    report
  );
  rejectExtraKeys(registry, topKeys, "registry", report);
  if (registry.schemaVersion !== 1) {
    report.error("schemaVersion must equal 1");
  }

  const project = requireObject(registry.project, "project", report);
  const projectKeys = [
    "name",
    "scale",
    "archetype",
    "designSystemRoot",
    "publicEntry",
    "showroomRoot",
  ];
  requireKeys(project, projectKeys, "project", report);
  rejectExtraKeys(project, projectKeys, "project", report);
  for (const key of [
    "name",
    "archetype",
    "designSystemRoot",
    "publicEntry",
    "showroomRoot",
  ]) {
    if (!isNonemptyString(project[key])) {
      report.error(`project.${key} must be a non-empty string`);
    }
  }
  if (project.scale !== "compact" && project.scale !== "long-lived") {
    report.error("project.scale must be compact or long-lived");
  }

  const approval = requireObject(registry.approval, "approval", report);
  const approvalKeys = ["status", "approvedBy", "approvedAt", "provenanceHash"];
  requireKeys(approval, approvalKeys, "approval", report);
  rejectExtraKeys(approval, approvalKeys, "approval", report);
  validateRegistryApproval(approval, expectedProvenanceHash, report);
  if (requireApproved && approval.status !== "approved") {
    report.error("Registry is not approved");
  }

  const exceptions = requireArray(registry.exceptions, "exceptions", report);
  const approvedExceptions = new Set();
  const exceptionRequired = [
    "capabilityId",
    "status",
    "reason",
    "futureCost",
    "disposition",
    "approvedBy",
    "approvedAt",
  ];
  const seenExceptions = new Set();
  for (let i = 0; i < exceptions.length; i += 1) {
    const p = `exceptions[${i}]`;
    const item = requireObject(exceptions[i], p, report);
    requireKeys(item, exceptionRequired, p, report);
    rejectExtraKeys(item, exceptionRequired, p, report);
    const capId = item.capabilityId;
    if (!isNonemptyString(capId) || !ID_PATTERN.test(capId)) {
      report.error(`${p}.capabilityId must be lower-case hyphen-case`);
      continue;
    }
    if (seenExceptions.has(capId)) {
      report.error(`Duplicate exception for capability: ${capId}`);
    }
    seenExceptions.add(capId);
    if (!EXCEPTION_STATUSES.has(item.status)) {
      report.error(
        `${p}.status must be one of ${Array.from(EXCEPTION_STATUSES).sort().join(", ")}`
      );
    }
    if (item.status === "approved") {
      if (
        !isNonemptyString(item.approvedBy) ||
        !isNonemptyString(item.approvedAt)
      ) {
        report.error(`${p} is approved but lacks approvedBy or approvedAt`);
      } else if (!isValidIsoDateTime(item.approvedAt)) {
        report.error(`${p}.approvedAt must be an ISO 8601 date-time`);
      } else {
        approvedExceptions.add(capId);
      }
    }
  }

  const rawComponents = requireArray(registry.components, "components", report);
  const components = new Map();
  for (let i = 0; i < rawComponents.length; i += 1) {
    const comp = validateComponentShape(rawComponents[i], i, report);
    if (comp.id) {
      if (components.has(comp.id)) {
        report.error(`Duplicate component id: ${comp.id}`);
      }
      components.set(comp.id, comp);
    }
  }

  if (project.scale === "long-lived" && Array.isArray(baseline)) {
    for (const expected of baseline) {
      const comp = components.get(expected.id);
      if (!comp) {
        if (!approvedExceptions.has(expected.id)) {
          report.error(`Missing mandatory baseline capability: ${expected.id}`);
        }
        continue;
      }
      if (comp.layer !== expected.layer) {
        report.error(
          `Baseline capability '${expected.id}' has layer '${comp.layer}'; expected '${expected.layer}'`
        );
      }
      if (comp.category !== expected.category) {
        report.error(
          `Baseline capability '${expected.id}' has category '${comp.category}'; expected '${expected.category}'`
        );
      }
    }
  }

  let publicExports = null;
  if (projectRoot && isNonemptyString(project.publicEntry)) {
    const entryPath = resolve(projectRoot, project.publicEntry);
    if (existsSync(entryPath)) {
      publicExports = collectPublicExports(entryPath);
    }
  }

  for (const component of components.values()) {
    if (component.status === "ready" || requireReady) {
      validateReadyComponent(component, projectRoot, publicExports, report);
    }
  }

  return report;
}

export function validateRegistryFile(registryPath, options = {}) {
  const registry = loadJson(registryPath);
  const projectRoot = options.projectRoot ?? REPO_ROOT;
  const expectedProvenanceHash =
    options.expectedProvenanceHash ?? readProvenanceHash(projectRoot);
  return validateRegistryData(registry, {
    ...options,
    expectedProvenanceHash,
  });
}
