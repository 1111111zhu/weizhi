import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL(
  "../../.github/workflows/desktop-agent-native.yml",
  import.meta.url
);
const stablePublisherPath = new URL(
  "publish-release-via-ghcr.sh",
  import.meta.url
);
const ossPublisherPath = new URL(
  "publish-installer-to-oss.mjs",
  import.meta.url
);
const releaseDockerfilePath = new URL(
  "../../deploy/docker/Dockerfile.desktop-agent-release",
  import.meta.url
);

test("stable releases do not retain large GitHub artifacts", async () => {
  const [workflow, stablePublisher] = await Promise.all([
    readFile(workflowPath, "utf-8"),
    readFile(stablePublisherPath, "utf-8"),
  ]);

  assert.doesNotMatch(workflow, /actions\/upload-artifact@/);
  assert.match(workflow, /Create GitHub Release notes/);
  assert.match(workflow, /publish-release-via-ghcr\.sh notes/);
  assert.doesNotMatch(stablePublisher, /gh release upload/);
  assert.match(stablePublisher, /remove_release_assets "\$release_tag"/);
});

test("preview installers remain scoped to prereleases", async () => {
  const workflow = await readFile(workflowPath, "utf-8");
  const previewUploads = workflow.match(
    /Upload (?:Windows|macOS) preview assets to GitHub Release/g
  );

  assert.equal(previewUploads, null);
  assert.match(workflow, /Publish GitHub preview release/);
  assert.match(workflow, /pull windows release-assets\/windows/);
  assert.match(workflow, /pull macos release-assets\/macos/);
});

test("release bundles are cached per source commit", async () => {
  const workflow = await readFile(workflowPath, "utf-8");

  assert.match(
    workflow,
    /prefix=\$\{\{ steps\.version\.outputs\.release-version \}\}-\$\{GITHUB_SHA\}/
  );
  assert.match(
    workflow,
    /asset-tag-prefix: \$\{\{ steps\.asset-key\.outputs\.prefix \}\}/
  );
  assert.doesNotMatch(
    workflow,
    /DESKTOP_AGENT_ASSET_TAG_PREFIX: \$\{\{ needs\.prepare\.outputs\.release-version \}\}/
  );
});

test("release verification installs native script dependencies", async () => {
  const workflow = await readFile(workflowPath, "utf-8");

  assert.match(
    workflow,
    /pnpm --filter @project-wing\/desktop-agent-desktop\.\.\. \\\n+\s+--filter @project-wing\/desktop-agent\.\.\./
  );
});

test("stable relay persists multipart checkpoints and reconnects WARP", async () => {
  const workflow = await readFile(workflowPath, "utf-8");

  assert.match(
    workflow,
    /checkpoint_dir="\$\{HOME\}\/\.cache\/projectwing-oss-checkpoints\/desktop-agent-oss-checkpoints"/
  );
  assert.match(
    workflow,
    /--volume "\$\{checkpoint_dir\}:\/root\/\.cache\/projectwing-oss-checkpoints"/
  );
  assert.match(workflow, /for relay_attempt in 1 2 3/);
  assert.match(workflow, /scripts\/ci\/ensure-warp-proxy\.sh/);
  assert.match(
    workflow,
    /PROJECTWING_WARP_CHECK_URL: \$\{\{ secrets\.OSS_ENDPOINT \}\}/
  );
});

test("stable releases use plain version tags and publish the update feed to OSS", async () => {
  const [workflow, stablePublisher, ossPublisher, releaseDockerfile] =
    await Promise.all([
      readFile(workflowPath, "utf-8"),
      readFile(stablePublisherPath, "utf-8"),
      readFile(ossPublisherPath, "utf-8"),
      readFile(releaseDockerfilePath, "utf-8"),
    ]);

  assert.match(
    stablePublisher,
    /release_tag="desktop-agent-v\$\{RELEASE_VERSION\}"/
  );
  assert.doesNotMatch(stablePublisher, /RELEASE_VERSION\}-stable/);
  assert.match(
    workflow,
    /Upload Windows and macOS release assets from Utopia to OSS/
  );
  assert.match(
    workflow,
    /DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION:.*0\.2\.10/
  );
  assert.match(workflow, /DESKTOP_AGENT_WINDOWS_SIGNATURE_POLICY: "optional"/);
  assert.match(ossPublisher, /objectKey\(prefix, `updates\/\$\{name\}`\)/);
  assert.doesNotMatch(ossPublisher, /stage_release_assets/);
  assert.doesNotMatch(ossPublisher, /args\.(?:installer|platform)/);
  assert.doesNotMatch(releaseDockerfile, /verify-windows-signing-report\.mjs/);

  const stagedSources = [
    ...stablePublisher.matchAll(
      /cp scripts\/desktop-agent\/([^\s]+) "\$relay_context\//g
    ),
  ].map((match) => match[1]);
  const dockerSources = [
    ...releaseDockerfile.matchAll(/^COPY ([^\s]+) \/release\/$/gm),
  ].map((match) => match[1]);
  assert.deepEqual(dockerSources.sort(), stagedSources.sort());
});
