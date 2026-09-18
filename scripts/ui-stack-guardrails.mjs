#!/usr/bin/env node

import {
  buildBaselineStructure,
  diffFindingsAgainstBaseline,
} from "./design-first/baseline-engine.mjs";
import { runAudit } from "./design-first/cli.mjs";

export {
  FRONTEND_APPS,
  PACKAGE_PATHS,
  RESTRICTED_UI_DEPENDENCIES,
  RESTRICTED_UI_IMPORTS,
  SOURCE_ROOTS,
  analyzeNativeControls,
  analyzePackageFile,
  analyzeSourceFile,
  createFinding,
  createFindingFingerprint,
  isVendoredRegistryComponent,
  normalizePath,
  scanAllFiles,
  shouldScanPath,
} from "./design-first/boundary-auditor.mjs";

export function createFindingBaseline(findings) {
  return buildBaselineStructure(findings);
}

export function diffAgainstBaseline(findings, baseline) {
  return diffFindingsAgainstBaseline(findings, baseline);
}

export function shouldRunDecorativeTitleGate() {
  return false;
}

if (process.argv[1] === import.meta.filename) {
  const updateBaseline = process.argv.includes("--update-baseline");
  const jsonOutput = process.argv.includes("--json");
  const result = await runAudit({ updateBaseline, jsonOutput });
  process.exit(result.success ? 0 : 1);
}
