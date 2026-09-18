#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildEvidence } from "./provenance-inventory-evidence.mjs";
import {
  outputState,
  serializeProvenanceInventory,
  validateProvenanceInventory,
} from "./provenance-output.mjs";
export {
  serializeProvenanceInventory,
  validateProvenanceInventory,
} from "./provenance-output.mjs";
import {
  deepSort,
  loadConfig,
  normalizeConfig,
  sortStrings,
} from "./provenance-utils.mjs";
export function loadProvenanceConfig(rootDir, configPath) {
  return loadConfig(rootDir ?? process.cwd(), configPath);
}
function optionsConfig(options) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const config = options.config
    ? normalizeConfig(options.config)
    : loadProvenanceConfig(rootDir, options.configPath);
  assertConfiguredRootsExist(rootDir, config);
  return { rootDir, config };
}
function assertConfiguredRootsExist(rootDir, config) {
  const roots = [
    ...config.implementationRoots.map((entry) => entry.path),
    ...config.consumerRoots,
    ...config.tokenRoots,
  ];
  const missing = sortStrings(roots).filter(
    (rootPath) => !existsSync(resolve(rootDir, rootPath))
  );
  if (missing.length) {
    throw new Error(`Provenance roots do not exist: ${missing.join(", ")}`);
  }
}
function buildSummary(evidence) {
  const {
    files,
    implementationFiles,
    implementations,
    families,
    dependencies,
    tokens,
    consumers,
    unresolvedImports,
  } = evidence;
  return {
    files: files.length,
    implementationFiles: implementationFiles.length,
    implementations: implementations.length,
    families: families.length,
    dependencies: dependencies.length,
    consumers: consumers.length,
    unresolvedImports: unresolvedImports.length,
    tokenDefinitions: tokens.definitions.length,
    tokenConflicts: tokens.conflicts.length,
  };
}

function publicFileRecord({
  implementationExports: _implementationExports,
  styles: _styles,
  ...file
}) {
  return file;
}

function inventoryRecord({ options, config, evidence }) {
  const {
    files,
    implementations,
    families,
    consumers,
    tokens,
    dependencies,
    unresolvedImports,
  } = evidence;
  return deepSort({
    schemaVersion: config.schemaVersion ?? 1,
    disposition: "unreviewed",
    lifecycle: "unreviewed",
    sourceRevision:
      options.sourceRevision === undefined
        ? null
        : String(options.sourceRevision),
    implementationRoots: config.implementationRoots,
    consumerRoots: config.consumerRoots,
    tokenRoots: config.tokenRoots,
    manifestPaths: config.manifestPaths,
    files: files.map(publicFileRecord),
    implementations,
    families,
    consumers,
    tokens,
    dependencies,
    unresolvedImports,
    summary: buildSummary(evidence),
  });
}

export function buildProvenanceInventory(options = {}) {
  const { rootDir, config } = optionsConfig(options);
  const evidence = buildEvidence(rootDir, config);
  return inventoryRecord({ options, config, evidence });
}
export function writeProvenanceInventory(options = {}) {
  const { rootDir, config } = optionsConfig(options);
  const inventory = options.inventory ?? buildProvenanceInventory(options);
  const outputPath = resolve(
    rootDir,
    options.outputPath ??
      config.outputPath ??
      "design-first.provenance.inventory.json"
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  const serialized = serializeProvenanceInventory(inventory);
  writeFileSync(outputPath, serialized, "utf8");
  return { outputPath, inventory, serialized };
}
export function checkProvenanceInventory(options = {}) {
  const { rootDir, config } = optionsConfig(options);
  const inventory = options.inventory ?? buildProvenanceInventory(options);
  const serialized = serializeProvenanceInventory(inventory);
  const outputPath = resolve(
    rootDir,
    options.outputPath ??
      config.outputPath ??
      "design-first.provenance.inventory.json"
  );
  const validation = validateProvenanceInventory(inventory);
  const state = outputState(outputPath, serialized);
  return {
    ...validation,
    valid: validation.valid && !state.drift,
    ok: validation.ok && !state.drift,
    isValid: validation.isValid && !state.drift,
    ...state,
    outputPath,
    inventory,
  };
}
function cli() {
  if (!process.argv[1]?.endsWith("provenance-inventory.mjs")) return;
  const rootIndex = process.argv.indexOf("--root");
  const rootDir = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
  const result = process.argv.includes("--write")
    ? writeProvenanceInventory({ rootDir })
    : checkProvenanceInventory({ rootDir });
  if (!result.valid && !result.ok) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else if (process.argv.includes("--write")) console.log(result.outputPath);
}
cli();
