import { spawnSync } from "node:child_process";
import pathModule from "node:path";

import { repositoryRoot } from "./native-verifier-support.mjs";
import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

export function verifyNativeScriptSyntax() {
  if (process.platform !== "win32") {
    for (const relativePath of [
      "scripts/desktop-agent/build-macos-runtime.sh",
      "scripts/desktop-agent/build-macos-app.sh",
      "scripts/desktop-agent/macos-package-scripts/postinstall",
      "scripts/desktop-agent/macos-runtime-launchers/ProjectWing.AgentManager",
      "scripts/desktop-agent/macos-runtime-launchers/ProjectWing.DesktopAgent.Runtime",
    ]) {
      const result = spawnSync("bash", [
        "-n",
        join(repositoryRoot, relativePath),
      ]);
      assertEqual(result.status, 0);
    }
  }
  const scaffold = join(
    repositoryRoot,
    "scripts/desktop-agent/scaffold-native-hosts.mjs"
  );
  assertEqual(spawnSync(process.execPath, ["--check", scaffold]).status, 0);
  const publisher = join(
    repositoryRoot,
    "scripts/desktop-agent/publish-installer-to-oss.mjs"
  );
  assertEqual(spawnSync(process.execPath, ["--check", publisher]).status, 0);
}
