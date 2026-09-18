#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import {
  BASELINE_PATH,
  buildBaselineStructure,
  diffBaselinesMonotonic,
  diffFindingsAgainstBaseline,
  loadBaselineFromGit,
  saveBaseline,
} from "./baseline-engine.mjs";
import { scanAllFiles } from "./boundary-auditor.mjs";
import { provenanceOptions, runProvenance } from "./provenance-command.mjs";
import { validateRegistryFile } from "./registry-validator.mjs";

const { resolve } = nodePath;
const __dirname = import.meta.dirname;
const REPO_ROOT = resolve(__dirname, "../..");

function updateAuditBaseline(findings) {
  const newBaseline = buildBaselineStructure(findings);
  saveBaseline(BASELINE_PATH, newBaseline);
  const legacyPath = resolve(REPO_ROOT, "scripts/ui-stack-baseline.json");
  saveBaseline(legacyPath, newBaseline);
  console.log(
    `Updated baseline at ${BASELINE_PATH} with ${findings.length} findings.`
  );
  return { success: true, findings };
}

function loadAuditBaseline() {
  if (existsSync(BASELINE_PATH)) {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  }
  const legacyPath = resolve(REPO_ROOT, "scripts/ui-stack-baseline.json");
  return existsSync(legacyPath)
    ? JSON.parse(readFileSync(legacyPath, "utf-8"))
    : null;
}

function printAuditFailures(failures) {
  console.error(
    `\n❌ Design-First boundary guardrails failed with ${failures.length} unexpected finding(s):\n`
  );
  for (const failure of failures) {
    console.error(
      `  • [${failure.rule}] ${failure.file} (count: ${failure.count}, allowed: ${failure.allowed})`
    );
    console.error(`    Fingerprint: ${failure.fingerprint}`);
  }
  console.error(
    "\nRun with --update-baseline if this debt was explicitly accepted and reviewed.\n"
  );
}

export async function runAudit(options = {}) {
  const {
    rootDir = REPO_ROOT,
    updateBaseline = false,
    stagedFiles = null,
    jsonOutput = false,
  } = options;
  const findings = scanAllFiles(rootDir, stagedFiles);
  if (updateBaseline) return updateAuditBaseline(findings);
  const baseline = loadAuditBaseline();
  const { failures, isClean } = diffFindingsAgainstBaseline(findings, baseline);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        { isClean, failures, findingsCount: findings.length },
        null,
        2
      )
    );
    return { success: isClean, failures, findings };
  }
  if (!isClean) {
    printAuditFailures(failures);
    return { success: false, failures, findings };
  }
  console.log("Design-First boundary guardrails passed.");
  return { success: true, failures: [], findings };
}

export async function runValidateRegistry(options = {}) {
  const {
    registryPath = resolve(REPO_ROOT, "docs/design-system.registry.json"),
    projectRoot = REPO_ROOT,
    requireReady = false,
    requireApproved = false,
  } = options;

  const report = validateRegistryFile(registryPath, {
    projectRoot,
    requireReady,
    requireApproved,
  });

  if (!report.isValid) {
    console.error(
      `\n❌ Design-First registry validation failed with ${report.errors.length} error(s):\n`
    );
    for (const error of report.errors) {
      console.error(`  • ${error}`);
    }
    return { success: false, errors: report.errors };
  }

  console.log("Design-First registry validation passed.");
  return { success: true, errors: [] };
}

export async function runMonotonicCheck(options = {}) {
  const { baseRef = "HEAD" } = options;

  let currentBaseline = null;
  if (existsSync(BASELINE_PATH)) {
    currentBaseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  }

  if (!currentBaseline) {
    console.error(`❌ Current baseline not found at ${BASELINE_PATH}`);
    return { success: false };
  }

  const baseBaseline = loadBaselineFromGit(baseRef);
  if (!baseBaseline) {
    console.log(
      `ℹ️  No baseline found on base ref '${baseRef}'. Skipping monotonic diff.`
    );
    return { success: true };
  }

  const { growth, isMonotonic } = diffBaselinesMonotonic(
    currentBaseline,
    baseBaseline
  );

  if (!isMonotonic) {
    console.error(
      `\n❌ Monotonic UI debt baseline check failed. Found ${growth.length} increased or new debt entries:\n`
    );
    for (const item of growth) {
      console.error(
        `  • [${item.rule}] ${item.file}: current ${item.currentCount} > base ${item.baseCount}`
      );
      console.error(`    Fingerprint: ${item.fingerprint}`);
    }
    return { success: false, growth };
  }

  console.log("Monotonic UI debt baseline check passed.");
  return { success: true, growth: [] };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "validate-registry") {
    const requireReady = args.includes("--require-ready");
    const requireApproved = args.includes("--require-approved");
    const customPathArg = args.find(
      (a) => a.endsWith(".json") && !a.startsWith("--")
    );
    const registryPath = customPathArg
      ? resolve(process.cwd(), customPathArg)
      : undefined;

    const result = await runValidateRegistry({
      registryPath,
      requireReady,
      requireApproved,
    });
    process.exit(result.success ? 0 : 1);
  }

  if (command === "baseline") {
    const baseRefIndex = args.indexOf("--base-ref");
    const baseRef = baseRefIndex !== -1 ? args[baseRefIndex + 1] : "HEAD";
    const result = await runMonotonicCheck({ baseRef });
    process.exit(result.success ? 0 : 1);
  }

  if (command === "provenance") {
    const result = runProvenance(provenanceOptions(args));
    process.exit(result.success ? 0 : 1);
  }

  const updateBaseline = args.includes("--update-baseline");
  const jsonOutput = args.includes("--json");

  const result = await runAudit({
    updateBaseline,
    jsonOutput,
  });

  process.exit(result.success ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(2);
  });
}
