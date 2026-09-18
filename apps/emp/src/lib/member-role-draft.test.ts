import { describe, expect, it } from "vitest";

import { resolveMemberRoleDraft } from "./member-role-draft";

describe(resolveMemberRoleDraft, () => {
  it("keeps the current role when it is still assignable", () => {
    expect(resolveMemberRoleDraft("PREPARER", ["PREPARER"])).toBe("PREPARER");
  });

  it("defaults to the first assignable role when the current project role conflicts with the global grade", () => {
    expect(resolveMemberRoleDraft("PARTNER", ["PREPARER"])).toBe("PREPARER");
  });
});
