import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("shared included minutes are checked before hosted builders and provider fallbacks", async () => {
  const workflow = await read(".github/workflows/desktop-agent-native.yml");

  assert.match(workflow, /GH_BILLING_READ_TOKEN/);
  assert.match(workflow, /github-hosted-available == 'true'/);
  assert.match(workflow, /WINDOWS_HOSTED_INCLUDED_MINUTES: "50"/);
  assert.match(workflow, /MACOS_HOSTED_INCLUDED_MINUTES: "334"/);
  assert.match(workflow, /GH_BILLING_REQUIRED_INCLUDED_MINUTES/);
  assert.doesNotMatch(workflow, /HOSTED_CREDIT_CENTS|REQUIRED_CREDIT_USD/);
  assert.match(workflow, /windows-assets-available != 'true'/);
  assert.match(workflow, /macos-assets-available != 'true'/);
  assert.ok(
    workflow.indexOf("github-windows:") < workflow.indexOf("azure-windows:")
  );
  assert.ok(
    workflow.indexOf("github-macos:") < workflow.indexOf("codemagic-macos:")
  );
  assert.ok(
    workflow.indexOf("codemagic-macos:") < workflow.indexOf("azure-macos:")
  );
  assert.match(
    workflow,
    /needs: \[prepare, verify, github-macos, codemagic-macos\]/
  );
});

test("all builders persist complete bundles in GHCR without Actions artifacts", async () => {
  const [workflow, windows, macos, codemagic] = await Promise.all([
    read(".github/workflows/desktop-agent-native.yml"),
    read("azure-pipelines-windows.yml"),
    read("azure-pipelines-macos.yml"),
    read("codemagic.yaml"),
  ]);

  for (const source of [workflow, windows, macos, codemagic]) {
    assert.doesNotMatch(source, /actions\/upload-artifact@|\n\s+- publish:/);
  }
  assert.match(windows, /transfer-release-asset\.mjs push windows/);
  assert.match(macos, /transfer-release-asset\.mjs.*\n\s+push macos/s);
  assert.match(codemagic, /transfer-release-asset\.mjs.*\n\s+push macos/s);
  assert.match(macos, /@project-wing\/desktop-agent-desktop/);
  assert.match(codemagic, /@project-wing\/desktop-agent-desktop/);
  assert.doesNotMatch(macos, /\^0\\\.2/);
  assert.doesNotMatch(codemagic, /\^0\\\.2/);
});

test("release publication requires both cached platforms", async () => {
  const [workflow, relay] = await Promise.all([
    read(".github/workflows/desktop-agent-native.yml"),
    read("scripts/desktop-agent/publish-relay-to-oss.sh"),
  ]);

  assert.match(workflow, /exists windows/);
  assert.match(workflow, /exists macos/);
  assert.match(
    workflow,
    /windows-builder: \$\{\{ steps\.builders\.outputs\.windows \}\}/
  );
  assert.match(
    workflow,
    /macos-builder: \$\{\{ steps\.builders\.outputs\.macos \}\}/
  );
  assert.match(
    workflow,
    /publish:\n[\s\S]*?needs: \[prepare, release-assets\]/
  );
  assert.doesNotMatch(
    workflow,
    /publish:\n[\s\S]*?needs: \[[^\n]*github-windows/
  );
  assert.match(relay, /desktop-agent\/windows/);
  assert.match(relay, /desktop-agent\/macos/);
  assert.match(relay, /publish-macos-to-oss\.mjs/);
});

test("macOS packaging loads the repository Electron Builder contract", async () => {
  const packager = await read(
    "apps/desktop-agent-desktop/scripts/package-macos.mjs"
  );

  assert.match(packager, /"--config"/);
  assert.match(packager, /electron-builder\.config\.mjs/);
  assert.match(packager, /resolveMacosAppBundle/);
  assert.doesNotMatch(packager, /"ProjectWingDesktopAgent\.app"/);
});

function read(path) {
  return readFile(new URL(path, root), "utf-8");
}
