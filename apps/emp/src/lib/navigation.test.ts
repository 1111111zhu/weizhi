import { describe, expect, it } from "vitest";

import {
  newWorkspaceProjectPath,
  workspaceMembersPath,
  workspaceProjectPath,
} from "./navigation";

describe("workspace-first navigation", () => {
  it("builds project paths underneath a workspace", () => {
    expect(workspaceProjectPath("workspace-1", "project-1")).toBe(
      "/workspaces/workspace-1/projects/project-1"
    );
    expect(workspaceMembersPath("workspace-1", "project-1")).toBe(
      "/workspaces/workspace-1/projects/project-1/members"
    );
    expect(newWorkspaceProjectPath("workspace-1")).toBe(
      "/workspaces/workspace-1/projects/new"
    );
  });
});
