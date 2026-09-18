#!/usr/bin/env node

export {
  FRONTEND_APPS,
  PACKAGE_PATHS,
  SOURCE_ROOTS,
  isVendoredRegistryComponent,
  normalizePath,
  shouldScanI18nPath,
  shouldScanPath,
  shouldScanUiWrapperImports,
} from "./boundary-path-policy.mjs";
export {
  createFinding,
  createFindingFingerprint,
} from "./boundary-finding.mjs";
export {
  RESTRICTED_UI_DEPENDENCIES,
  RESTRICTED_UI_IMPORTS,
  analyzeNativeControls,
  analyzePackageFile,
  analyzeSourceFile,
  analyzeUiWrapperImports,
} from "./boundary-source-analysis.mjs";
export {
  collectI18nSourceFiles,
  collectSourceFiles,
  collectUiWrapperImportFiles,
  scanAllFiles,
} from "./boundary-scanner.mjs";
