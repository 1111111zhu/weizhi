import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const APP_ROOT = path.dirname(import.meta.dirname);
const REPO_ROOT = path.dirname(path.dirname(APP_ROOT));
const OUTPUT_PATH = path.join(APP_ROOT, "public/r");
const OUTPUT_PARENT = path.dirname(OUTPUT_PATH);
const require = createRequire(import.meta.url);
const SHADCN_CLI = require.resolve("shadcn");
const OXFMT_BIN = path.join(
  REPO_ROOT,
  "node_modules/.bin",
  process.platform === "win32" ? "oxfmt.cmd" : "oxfmt"
);

const readExpectedFiles = async () => {
  const source = await readFile(path.join(APP_ROOT, "registry.json"), "utf-8");
  const registry = JSON.parse(source);
  return [
    "registry.json",
    ...registry.items.map((item) => `${item.name}.json`),
  ].toSorted();
};

const assertExactOutput = async (directory) => {
  const expected = await readExpectedFiles();
  const entries = await readdir(directory);
  const actual = entries.toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Registry output mismatch. Expected ${expected.join(", ")}; received ${actual.join(", ")}.`
    );
  }
};

const replaceGeneratedRegistry = async (temporaryPath) => {
  const expectedOutputPath = path.join(APP_ROOT, "public", "r");
  if (path.resolve(OUTPUT_PATH) !== path.resolve(expectedOutputPath)) {
    throw new Error("Refusing to replace an unexpected registry path.");
  }
  await rm(OUTPUT_PATH, { force: true, recursive: true });
  await rename(temporaryPath, OUTPUT_PATH);
};

const temporaryPath = await mkdtemp(
  path.join(OUTPUT_PARENT, ".registry-build-")
);

try {
  execFileSync(
    process.execPath,
    [SHADCN_CLI, "build", "registry.json", "--output", temporaryPath],
    { cwd: APP_ROOT, stdio: "inherit" }
  );
  execFileSync(
    OXFMT_BIN,
    ["--config", path.join(REPO_ROOT, "oxfmt.config.ts"), temporaryPath],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );
  await assertExactOutput(temporaryPath);
  await replaceGeneratedRegistry(temporaryPath);
} finally {
  await rm(temporaryPath, { force: true, recursive: true });
}
