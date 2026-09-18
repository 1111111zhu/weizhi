import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeI18nStaticCopy } from "../i18n-static-copy.mjs";
import {
  PACKAGE_PATHS,
  SOURCE_ROOTS,
  normalizePath,
  shouldScanI18nPath,
  shouldScanPath,
  shouldScanUiWrapperImports,
  shouldSkipDirectory,
} from "./boundary-path-policy.mjs";
import {
  analyzeNativeControls,
  analyzePackageFile,
  analyzeSourceFile,
  analyzeUiWrapperImports,
} from "./boundary-source-analysis.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(__dirname, "../..");

function readDirSafe(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function collectSourceFiles(directory, rootDir) {
  return collectFiles(directory, rootDir, shouldScanPath);
}

export function collectI18nSourceFiles(directory, rootDir) {
  return collectFiles(directory, rootDir, shouldScanI18nPath);
}

export function collectUiWrapperImportFiles(directory, rootDir) {
  return collectFiles(directory, rootDir, shouldScanUiWrapperImports);
}

function collectFiles(directory, rootDir, includeFile) {
  return readDirSafe(directory).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    const file = normalizePath(relative(rootDir, entryPath));
    if (entry.isDirectory()) {
      return shouldSkipDirectory(file)
        ? []
        : collectFiles(entryPath, rootDir, includeFile);
    }
    return includeFile(file) ? [file] : [];
  });
}

function readFindings(files, rootDir, analyze) {
  return files.flatMap((file) => {
    const fullPath = join(rootDir, file);
    return existsSync(fullPath)
      ? analyze(file, readFileSync(fullPath, "utf8"))
      : [];
  });
}

function collectScanFiles(rootDir, fileList) {
  if (Array.isArray(fileList)) {
    return {
      sourceFiles: fileList.filter(shouldScanPath),
      i18nFiles: fileList.filter(shouldScanI18nPath),
      uiWrapperImportFiles: fileList.filter(shouldScanUiWrapperImports),
    };
  }
  return {
    sourceFiles: SOURCE_ROOTS.flatMap((sourceRoot) =>
      collectSourceFiles(join(rootDir, sourceRoot), rootDir)
    ),
    i18nFiles: SOURCE_ROOTS.flatMap((sourceRoot) =>
      collectI18nSourceFiles(join(rootDir, sourceRoot), rootDir)
    ),
    uiWrapperImportFiles: SOURCE_ROOTS.flatMap((sourceRoot) =>
      collectUiWrapperImportFiles(join(rootDir, sourceRoot), rootDir)
    ),
  };
}

function collectPackageFindings(rootDir) {
  return PACKAGE_PATHS.flatMap((packagePath) => {
    const fullPath = join(rootDir, packagePath);
    if (!existsSync(fullPath)) return [];
    const manifest = JSON.parse(readFileSync(fullPath, "utf8"));
    return analyzePackageFile(packagePath, manifest);
  });
}

export function scanAllFiles(rootDir, fileList = null) {
  const resolvedRoot = rootDir ?? REPO_ROOT;
  const { sourceFiles, i18nFiles, uiWrapperImportFiles } = collectScanFiles(
    resolvedRoot,
    fileList
  );
  return [
    ...readFindings(sourceFiles, resolvedRoot, analyzeSourceFile),
    ...readFindings(
      uiWrapperImportFiles,
      resolvedRoot,
      analyzeUiWrapperImports
    ),
    ...readFindings(i18nFiles, resolvedRoot, analyzeI18nStaticCopy),
    ...readFindings(sourceFiles, resolvedRoot, analyzeNativeControls),
    ...collectPackageFindings(resolvedRoot),
  ];
}
