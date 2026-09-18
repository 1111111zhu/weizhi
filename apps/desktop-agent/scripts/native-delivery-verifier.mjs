import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import {
  assertFileContains,
  repositoryRoot,
} from "./native-verifier-support.mjs";
import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

export async function verifyDeliveryContract() {
  await assertFileContains(
    ".github/workflows/desktop-agent-native.yml",
    [
      "name: Desktop Agent",
      "publish-release-via-ghcr.sh relay",
      "publish-release-via-ghcr.sh notes",
      'DESKTOP_AGENT_WINDOWS_SIGNATURE_POLICY: "optional"',
    ],
    false
  );
  await assertFileContains("scripts/desktop-agent/publish-relay-to-oss.sh", [
    "releases.win.json",
    "releases.osx.json",
    "com.superfx.projectwing.desktop-agent-win-Setup.exe",
    "com.superfx.projectwing.desktop-agent-osx-Setup.pkg",
    "publish-macos-to-oss.mjs",
    "--velopack-bundle",
  ]);
  await verifyRelayContext();
  await verifyVeloPackPublisher();
}

async function verifyRelayContext() {
  const [releaseScript, dockerfile] = await Promise.all([
    readFile(
      join(repositoryRoot, "scripts/desktop-agent/publish-release-via-ghcr.sh"),
      "utf-8"
    ),
    readFile(
      join(repositoryRoot, "deploy/docker/Dockerfile.desktop-agent-release"),
      "utf-8"
    ),
  ]);
  const stagedSources = [
    ...releaseScript.matchAll(
      /cp scripts\/desktop-agent\/([^\s]+) "\$relay_context\//g
    ),
  ].map((match) => match[1]);
  const dockerSources = [
    ...dockerfile.matchAll(/^COPY ([^\s]+) \/release\/$/gm),
  ].map((match) => match[1]);
  assertEqual(
    JSON.stringify(dockerSources.sort()),
    JSON.stringify(stagedSources.sort())
  );
  assertEqual(dockerfile.includes("verify-windows-signing-report.mjs"), false);
}

async function verifyVeloPackPublisher() {
  const publisher = await readFile(
    join(repositoryRoot, "scripts/desktop-agent/publish-installer-to-oss.mjs"),
    "utf-8"
  );
  assertEqual(publisher.includes("--velopack-bundle"), true);
  assertEqual(publisher.includes("stage_release_assets"), false);
  assertEqual(publisher.includes("args.installer"), false);
  assertEqual(publisher.includes("args.platform"), false);
}
