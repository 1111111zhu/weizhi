import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

const root = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = join(
  root,
  "../../scripts/desktop-agent/build-macos-runtime.sh"
);
const syntax = spawnSync("bash", ["-n", scriptPath], { encoding: "utf-8" });
assertEqual(syntax.status, 0);

const script = await readFile(scriptPath, "utf-8");
for (const required of [
  `version="\${1:-0.2.1}"`,
  "osx-arm64",
  "osx-x64",
  "osx-universal",
  "PROJECT_WING_DESKTOP_RELEASE_ROOT",
  "macos-runtime-launchers",
  "--self-contained true",
  "-p:PublishSingleFile=false",
  "-p:PublishTrimmed=true",
  "-p:SuppressTrimAnalysisWarnings=true",
  `"\${payload_root}/managed"`,
  "managed-runtime-layout",
  "report-package-size.mjs",
  "ProjectWing.AgentManager",
  "ProjectWing.DesktopAgent.Runtime",
  '"payloadKind": "background-runtime"',
]) {
  assertEqual(script.includes(required), true);
}
for (const excluded of [
  "ProjectWing.ExcelWatcher",
  "node_modules",
  "dist/index.js",
]) {
  assertEqual(script.includes(excluded), false);
}

console.log("macOS background runtime packaging script verification passed.");
