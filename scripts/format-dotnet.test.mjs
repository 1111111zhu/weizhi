import assert from "node:assert/strict";
import test from "node:test";

import { resolveDotnetFormatTargets } from "./format-dotnet.mjs";

test("groups Desktop Agent .NET files by their owning project", () => {
  assert.deepEqual(
    resolveDotnetFormatTargets([
      "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/Program.cs",
      "apps/desktop-agent/manager/ProjectWing.AgentManager/Program.cs",
    ]),
    [
      {
        directory:
          "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime",
        project: "ProjectWing.DesktopAgent.Runtime.csproj",
        files: ["Program.cs"],
      },
      {
        directory: "apps/desktop-agent/manager/ProjectWing.AgentManager",
        project: "ProjectWing.AgentManager.csproj",
        files: ["Program.cs"],
      },
    ]
  );
});

test("ignores files outside Desktop Agent .NET projects", () => {
  assert.deepEqual(
    resolveDotnetFormatTargets([
      "apps/emp/src/app/page.tsx",
      "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/README.md",
    ]),
    []
  );
});
