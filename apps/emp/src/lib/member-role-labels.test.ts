import { describe, it, expect } from "vitest";

import {
  getProjectMemberMentionOptions,
  getRoleInEngagementLabel,
} from "./member-role-labels";

describe("member identity labels", () => {
  it("uses the same business identity in mentions as the member directory", () => {
    const options = getProjectMemberMentionOptions(
      [
        {
          projectRole: "REVIEWER",
          user: { id: "m", name: "Manager", globalRole: "MANAGER" },
        },
        {
          projectRole: "PREPARER",
          user: { id: "s", name: "Staff", globalRole: "STAFF" },
        },
        {
          projectRole: "REVIEWER",
          user: {
            id: "old",
            name: "Legacy manager",
            globalRole: "SENIOR_MANAGER",
          },
        },
        {
          projectRole: "PARTNER",
          inChargeRole: "PARTNER_IN_CHARGE",
          user: { id: "p", name: "PIC", globalRole: "PARTNER" },
        },
      ],
      "s",
      "Current user"
    );
    expect(options.map((option) => option.description)).toStrictEqual([
      "Manager",
      "Current user",
      "Manager",
      "Partner",
    ]);
    expect(
      getRoleInEngagementLabel({ globalRole: "STAFF", projectRole: "PREPARER" })
    ).toBe("Staff");
  });

  it("does not offer disabled, suspended or inconsistent recipients", () => {
    expect(
      getProjectMemberMentionOptions(
        [
          {
            projectRole: "PREPARER",
            authorizationSuspendedAt: "2026-09-10",
            user: { id: "a", name: "A", globalRole: "STAFF" },
          },
          {
            projectRole: "PARTNER",
            roleConsistent: false,
            user: { id: "b", name: "B", globalRole: "STAFF" },
          },
          {
            projectRole: "PREPARER",
            user: {
              id: "c",
              name: "C",
              globalRole: "STAFF",
              status: "DISABLED",
            },
          },
        ],
        undefined,
        "Current user"
      )
    ).toHaveLength(0);
  });
});
