import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

export const FRONTEND_APPS = [
  "emp",
  "cmp",
  "tms",
  "ib",
  "intranet",
  "ui-showroom",
];

const PRODUCT_SOURCE_ROOTS = FRONTEND_APPS.filter(
  (app) => app !== "ui-showroom"
).map((app) => `apps/${app}/src`);
const SHOWROOM_ROOT = "apps/ui-showroom";

export const SOURCE_ROOTS = [...PRODUCT_SOURCE_ROOTS, SHOWROOM_ROOT];
export const PACKAGE_PATHS = FRONTEND_APPS.map(
  (app) => `apps/${app}/package.json`
).filter((packagePath) => existsSync(resolve(REPO_ROOT, packagePath)));

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const SHOWROOM_GENERATED_DIRECTORIES = new Set([
  ".next",
  ".source",
  "node_modules",
  "public",
  "r",
  "registry",
]);
const SHOWROOM_GENERATED_DATA_PATHS = new Set([
  "apps/ui-showroom/lib/registry-base-colors.ts",
  "apps/ui-showroom/lib/registry-colors.ts",
]);
const SHOWROOM_GENERATED_COLOR_PART_PATTERN =
  /^apps\/ui-showroom\/lib\/registry-(?:base-)?colors-(?:\d+|v4-\d+|oklch-\d+)\.ts$/;

const VENDORED_REGISTRY_COMPONENT_DIRECTORIES = [
  "apps/emp/src/components/extend/",
  "apps/emp/src/components/reui/",
  "apps/cmp/src/components/reui/",
  "apps/ui-showroom/registry/new-york/",
];

const VENDORED_REGISTRY_COMPONENT_PATHS = new Set([
  "apps/emp/src/components/motion/button/base.tsx",
  "apps/emp/src/components/motion/expandable-action-bar.tsx",
  "apps/emp/src/components/motion/popover.tsx",
  "apps/emp/src/components/motion/popover-position.ts",
  "apps/cmp/src/components/motion/expandable-action-bar.tsx",
  "apps/tms/src/components/motion/expandable-action-bar.tsx",
]);

export function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function isVendoredRegistryComponent(filePath) {
  const file = normalizePath(filePath);
  return (
    VENDORED_REGISTRY_COMPONENT_PATHS.has(file) ||
    VENDORED_REGISTRY_COMPONENT_DIRECTORIES.some((directory) =>
      file.startsWith(directory)
    )
  );
}

function isShowroomPath(file) {
  return file.startsWith(`${SHOWROOM_ROOT}/`);
}

function isShowroomGeneratedPath(file) {
  if (!isShowroomPath(file)) return false;
  const relativePath = file.slice(`${SHOWROOM_ROOT}/`.length);
  return relativePath
    .split("/")
    .some((segment) => SHOWROOM_GENERATED_DIRECTORIES.has(segment));
}

function isShowroomGeneratedDataPath(file) {
  return (
    SHOWROOM_GENERATED_DATA_PATHS.has(file) ||
    SHOWROOM_GENERATED_COLOR_PART_PATTERN.test(file)
  );
}

function isShowroomUiWrapper(file) {
  return (
    file.startsWith(`${SHOWROOM_ROOT}/components/ui/`) ||
    file.startsWith(`${SHOWROOM_ROOT}/registry/new-york/`)
  );
}

function isAppUiWrapper(file) {
  return FRONTEND_APPS.some((app) =>
    file.startsWith(`apps/${app}/src/components/ui/`)
  );
}

function isUiWrapper(file) {
  return isAppUiWrapper(file) || isShowroomUiWrapper(file);
}

function isSupportedSourceFile(file) {
  return (
    SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension)) &&
    !file.endsWith(".d.ts") &&
    !TEST_FILE_PATTERN.test(file)
  );
}

export function shouldSkipDirectory(filePath) {
  return isShowroomGeneratedPath(normalizePath(filePath));
}

export function shouldScanI18nPath(filePath) {
  const file = normalizePath(filePath);
  return (
    isSupportedSourceFile(file) &&
    !isShowroomGeneratedPath(file) &&
    !isShowroomGeneratedDataPath(file) &&
    !isVendoredRegistryComponent(file)
  );
}

export function shouldScanPath(filePath) {
  const file = normalizePath(filePath);
  const isSourcePath = SOURCE_ROOTS.some((sourceRoot) =>
    file.startsWith(`${sourceRoot}/`)
  );

  return (
    isSourcePath &&
    isSupportedSourceFile(file) &&
    !isShowroomGeneratedPath(file) &&
    !isShowroomGeneratedDataPath(file) &&
    !isVendoredRegistryComponent(file) &&
    !isAppUiWrapper(file) &&
    !isShowroomUiWrapper(file)
  );
}

export function shouldScanUiWrapperImports(filePath) {
  const file = normalizePath(filePath);
  return (
    isSupportedSourceFile(file) &&
    isUiWrapper(file) &&
    !isShowroomGeneratedPath(file) &&
    !isVendoredRegistryComponent(file)
  );
}
