import { describe, expect, it } from "vitest";

import {
  canAccessAdmin,
  canAccessAllConfirmations,
  getUserScopedQueryKey,
  requiresProjectDeclaration,
  requiresSystemDeclaration,
} from "./access-control";

describe("access control helpers", () => {
  it("keeps declarations and privileged routes scoped to the signed-in user", () => {
    expect(requiresProjectDeclaration({ accepted: false })).toBeTruthy();
    expect(
      requiresSystemDeclaration({ declarationAccepted: false })
    ).toBeTruthy();
    expect(canAccessAdmin({ globalRole: "SUPER_ADMIN" })).toBeTruthy();
    expect(
      canAccessAllConfirmations({ globalRole: "CONFIRMATION_OFFICER" })
    ).toBeTruthy();
    expect(getUserScopedQueryKey("inbox", { id: "user-1" })).toStrictEqual([
      "inbox",
      "user-1",
    ]);
  });
});
