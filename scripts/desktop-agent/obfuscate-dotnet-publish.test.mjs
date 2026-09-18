import assert from "node:assert/strict";
import test from "node:test";

import { createObfuscarConfiguration } from "./obfuscate-dotnet-publish.mjs";

test("preserves external contracts while obfuscating Desktop Agent internals", () => {
  const configuration = createObfuscarConfiguration({
    inputAssembly: "/tmp/publish/ProjectWing.AgentManager.dll",
    inputPath: "/tmp/publish",
    outputPath: "/tmp/publish/.project-wing-obfuscated",
  });

  assert.match(configuration, /KeepPublicApi" value="true"/);
  assert.match(configuration, /HidePrivateApi" value="true"/);
  assert.match(configuration, /RenameProperties" value="false"/);
  assert.match(configuration, /ProjectWing\.AgentManager\.dll/);
});
