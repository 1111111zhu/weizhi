import { describe, expect, it } from "vitest";

import { getLegacyWorkspacesRedirectPath } from "./proxy";

describe(getLegacyWorkspacesRedirectPath, () => {
  it("redirects legacy workspace entry pages to the project desktop", () => {
    expect(getLegacyWorkspacesRedirectPath("/en-US/workspaces")).toBe(
      "/en-US/engagement"
    );
    expect(
      getLegacyWorkspacesRedirectPath("/zh-CN/workspaces/workspace-1")
    ).toBe("/zh-CN/engagement");
  });

  it("redirects legacy project routes to project-first routes", () => {
    expect(
      getLegacyWorkspacesRedirectPath(
        "/en-US/workspaces/workspace-1/projects/new"
      )
    ).toBe("/en-US/engagement/new");
    expect(
      getLegacyWorkspacesRedirectPath(
        "/en-US/workspaces/workspace-1/projects/project-1"
      )
    ).toBe("/en-US/engagement/project-1");
    expect(
      getLegacyWorkspacesRedirectPath(
        "/en-US/workspaces/workspace-1/projects/project-1/members"
      )
    ).toBe("/en-US/engagement/project-1/members");
  });

  it("ignores non-localized and non-workspace paths", () => {
    expect(getLegacyWorkspacesRedirectPath("/workspaces")).toBeNull();
    expect(getLegacyWorkspacesRedirectPath("/en-US/projects")).toBeNull();
  });
});
