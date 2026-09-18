import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const packageScriptPath = new URL(
  "../../scripts/package-velopack.mjs",
  import.meta.url
);

describe("Windows VeloPack packaging", () => {
  it("writes the authoritative release version into Electron metadata", async () => {
    const configuration = await readFile(
      new URL("../../electron-builder.config.mjs", import.meta.url),
      "utf-8"
    );
    expect(configuration).toMatch(
      /extraMetadata:[\s\S]*?version: process.env.PROJECT_WING_DESKTOP_VERSION/
    );
  });

  it("replaces legacy Run startup with an installer-managed shortcut", async () => {
    const packageScript = await readFile(packageScriptPath, "utf-8");

    expect(packageScript).toMatch(
      /"--shortcuts",\s*"Desktop,StartMenuRoot,Startup"/
    );
  });
});
