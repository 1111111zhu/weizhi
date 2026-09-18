import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProvenanceInventory,
  checkProvenanceInventory,
  validateProvenanceInventory,
  writeProvenanceInventory,
} from "./provenance-inventory.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

export function runProvenance(options = {}) {
  const {
    rootDir = REPO_ROOT,
    configPath,
    outputPath,
    sourceRevision,
    mode = "inspect",
    jsonOutput = false,
  } = options;
  const sharedOptions = {
    rootDir,
    configPath,
    outputPath,
    sourceRevision,
  };

  if (mode === "write") {
    const result = writeProvenanceInventory(sharedOptions);
    const report = validateProvenanceInventory(result.inventory);
    printProvenanceResult(report, result.inventory, jsonOutput);
    if (!jsonOutput) console.log(`Wrote ${result.outputPath}`);
    return { success: report.isValid, ...result, ...report };
  }

  if (mode === "check") {
    const report = checkProvenanceInventory(sharedOptions);
    printProvenanceResult(report, report.inventory, jsonOutput);
    return { success: report.isValid, ...report };
  }

  const inventory = buildProvenanceInventory(sharedOptions);
  const report = validateProvenanceInventory(inventory);
  printProvenanceResult(report, inventory, jsonOutput);
  return { success: report.isValid, inventory, ...report };
}

function printProvenanceResult(report, inventory, jsonOutput) {
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          isValid: report.isValid,
          drift: report.drift ?? null,
          errors: report.errors,
          warnings: report.warnings,
          summary: inventory.summary,
        },
        null,
        2
      )
    );
    return;
  }
  const label = report.isValid ? "passed" : "failed";
  console.log(`Design-First provenance ${label}.`);
  console.log(JSON.stringify(inventory.summary, null, 2));
  for (const error of report.errors ?? []) console.error(`  • ${error}`);
  for (const warning of report.warnings ?? []) console.warn(`  • ${warning}`);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function provenanceOptions(args) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write && check) throw new Error("Use only one of --write or --check.");
  return {
    mode: write ? "write" : check ? "check" : "inspect",
    configPath: optionValue(args, "--config"),
    outputPath: optionValue(args, "--output"),
    sourceRevision: optionValue(args, "--source-revision"),
    jsonOutput: args.includes("--json"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = runProvenance(provenanceOptions(process.argv.slice(2)));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(error);
    process.exit(2);
  }
}
