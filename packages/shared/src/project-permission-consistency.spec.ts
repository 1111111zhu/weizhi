import { describe, expect, it } from "vitest";

import {
  GLOBAL_ROLES,
  ProjectRoleSchema,
  PROJECT_PERMISSION_ACTIONS,
  canProjectMemberPerformAction,
  isProjectPermissionSubjectConsistent,
  getAssignableProjectRolesForGlobalRole,
} from "./index.js";

describe("current project permission eligibility", () => {
  it("preserves legacy operation capabilities through the common action engine", () => {
    expect(
      canProjectMemberPerformAction(
        { globalRole: "STAFF", projectRole: "PREPARER" },
        "legacyPreparer"
      )
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "STAFF", projectRole: "PREPARER" },
        "legacyReviewer"
      )
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "TAX_EXPERT", projectRole: "TAX_REVIEWER" },
        "legacyReviewer"
      )
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "STAFF", projectRole: "PREPARER" },
        "reviewSignoff"
      )
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "SUPER_ADMIN", projectRole: "PARTNER" },
        "reviewSignoff"
      )
    ).toBeTruthy();
  });

  it("allows every system administrator action independently of business membership", () => {
    for (const projectRole of ProjectRoleSchema.options) {
      for (const action of PROJECT_PERMISSION_ACTIONS) {
        expect(
          canProjectMemberPerformAction(
            {
              globalRole: "SUPER_ADMIN",
              projectRole,
              authorizationSuspended: true,
            },
            action
          )
        ).toBeTruthy();
      }
    }
  });

  it("denies all actions for every ordinary grade/role mismatch, even when a PIC marker remains", () => {
    for (const globalRole of GLOBAL_ROLES) {
      if (globalRole === "SUPER_ADMIN") continue;
      for (const projectRole of ProjectRoleSchema.options) {
        if (
          getAssignableProjectRolesForGlobalRole(globalRole).includes(
            projectRole
          )
        ) {
          continue;
        }
        for (const inChargeRole of [
          null,
          "PARTNER_IN_CHARGE",
          "MANAGER_IN_CHARGE",
        ] as const) {
          const subject = { globalRole, projectRole, inChargeRole };
          expect(isProjectPermissionSubjectConsistent(subject)).toBeFalsy();
          for (const action of PROJECT_PERMISSION_ACTIONS) {
            expect(canProjectMemberPerformAction(subject, action)).toBeFalsy();
          }
        }
      }
    }
  });

  it("requires eligible leadership grades and compatible project duties", () => {
    expect(
      isProjectPermissionSubjectConsistent({
        globalRole: "PARTNER",
        projectRole: "EQCR",
        inChargeRole: "PARTNER_IN_CHARGE",
      })
    ).toBeFalsy();
    expect(
      isProjectPermissionSubjectConsistent({
        globalRole: "STAFF",
        projectRole: "PREPARER",
        inChargeRole: "MANAGER_IN_CHARGE",
      })
    ).toBeFalsy();
    expect(
      isProjectPermissionSubjectConsistent({
        globalRole: "PRINCIPAL",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      })
    ).toBeTruthy();
    expect(
      isProjectPermissionSubjectConsistent({
        globalRole: "MANAGER",
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      })
    ).toBeTruthy();
    expect(
      isProjectPermissionSubjectConsistent({
        globalRole: "SENIOR_MANAGER",
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      })
    ).toBeTruthy();
  });

  it("retains existing action decisions for valid ordinary memberships", () => {
    expect(
      canProjectMemberPerformAction(
        { globalRole: "STAFF", projectRole: "PREPARER" },
        "inviteProjectMembers"
      )
    ).toBeTruthy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "STAFF", projectRole: "PREPARER" },
        "removeProjectMembers"
      )
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(
        { globalRole: "PARTNER", projectRole: "PARTNER" },
        "deleteProject"
      )
    ).toBeFalsy();
    expect(
      canProjectMemberPerformAction(
        {
          globalRole: "PARTNER",
          projectRole: "PARTNER",
          inChargeRole: "PARTNER_IN_CHARGE",
        },
        "deleteProject"
      )
    ).toBeTruthy();
  });
});
