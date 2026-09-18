import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import { assertEqual } from "./runtime-test-support.mjs";

const { dirname, join } = pathModule;

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), "project-wing-bundles-"));

try {
  const windowsSize = await buildBundle(
    "apps/desktop-agent-windows",
    "windows"
  );
  const macosSize = await buildBundle("apps/desktop-agent-macos", "macos");
  console.log(
    `Desktop Agent native bundle verification passed (Windows ${windowsSize} bytes, macOS ${macosSize} bytes).`
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

async function buildBundle(relativeAppRoot, platform) {
  const appRoot = join(repositoryRoot, relativeAppRoot);
  const reactNativeRoot = dirname(
    require.resolve("react-native/package.json", { paths: [appRoot] })
  );
  const metro = require(require.resolve("metro", { paths: [reactNativeRoot] }));
  const config = require(join(appRoot, "metro.config.js"));
  const outputBase = join(temporaryRoot, `desktop-agent-${platform}.bundle`);
  const output = `${outputBase}.js`;
  await metro.runBuild(
    { ...config, maxWorkers: 2 },
    {
      entry: join(appRoot, "index.js"),
      out: outputBase,
      platform,
      dev: false,
      minify: true,
    }
  );
  const contents = await readFile(output, "utf-8");
  assertEqual(contents.includes("Project Wing Desktop Agent"), true);
  assertEqual(/node_modules[/\\]zod|from ["']zod/.test(contents), false);
  const { size: bundleSize } = await stat(output);
  assertEqual(bundleSize > 100_000, true);
  return bundleSize;
}
