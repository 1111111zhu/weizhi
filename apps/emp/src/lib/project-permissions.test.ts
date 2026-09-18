import { describe, expect, it } from "vitest";

import {
  canArchiveProject,
  canManageProjectMember,
  canManageProjectMembers,
  canPerformProjectAction,
} from "./project-permissions";
import type { ProjectMemberPermissionSubject } from "./project-permissions";

const manager: ProjectMemberPermissionSubject = {
  id: "manager-member-1",
  projectRole: "REVIEWER",
  user: { id: "manager-1", globalRole: "MANAGER" },
};
const seniorManager: ProjectMemberPermissionSubject = {
  id: "senior-manager-member-1",
  projectRole: "REVIEWER",
  user: { id: "manager-1", globalRole: "MANAGER" },
};
const principal: ProjectMemberPermissionSubject = {
  id: "principal-member-1",
  projectRole: "REVIEWER",
  user: { id: "principal-1", globalRole: "PRINCIPAL" },
};
const partner: ProjectMemberPermissionSubject = {
  id: "partner-member-1",
  projectRole: "PARTNER",
  inChargeRole: "PARTNER_IN_CHARGE",
  user: { id: "partner-1", globalRole: "PARTNER" },
};
const invitedPartner: ProjectMemberPermissionSubject = {
  id: "invited-partner-member-1",
  projectRole: "PARTNER",
  inChargeRole: null,
  user: { id: "invited-partner-1", globalRole: "PARTNER" },
};
const staff: ProjectMemberPermissionSubject = {
  id: "staff-member-1",
  projectRole: "PREPARER",
  user: { id: "staff-1", globalRole: "STAFF" },
};
const taxExpert: ProjectMemberPermissionSubject = {
  id: "tax-member-1",
  projectRole: "TAX_REVIEWER",
  user: { id: "tax-1", globalRole: "TAX_EXPERT" },
};
const eqr: ProjectMemberPermissionSubject = {
  id: "eqr-member-1",
  projectRole: "EQCR",
  user: { id: "eqr-1", globalRole: "PARTNER" },
};

describe("project permissions", () => {
  it("does not expose actions from obsolete or inconsistent grants", () => {
    expect(
      canManageProjectMembers({ ...manager, projectRole: "PREPARER" })
    ).toBeFalsy();
    expect(
      canManageProjectMember(
        { ...staff, projectRole: "PARTNER" },
        manager,
        "remove"
      )
    ).toBeFalsy();
    expect(
      canPerformProjectAction(
        { ...staff, inChargeRole: "PARTNER_IN_CHARGE" },
        "deleteProject"
      )
    ).toBeFalsy();
  });

  it("allows engagement members to invite according to the project matrix", () => {
    expect(canManageProjectMembers(partner)).toBeTruthy();
    expect(canManageProjectMembers(principal)).toBeTruthy();
    expect(canManageProjectMembers(seniorManager)).toBeTruthy();
    expect(canManageProjectMembers(manager)).toBeTruthy();
    expect(canManageProjectMembers(staff)).toBeTruthy();
    expect(canManageProjectMembers(eqr)).toBeFalsy();
    expect(canManageProjectMembers(taxExpert)).toBeFalsy();
    expect(canManageProjectMembers()).toBeFalsy();
  });

  it("uses the removal action for member role changes and removals", () => {
    expect(canManageProjectMember(manager, staff, "update-role")).toBeTruthy();
    expect(canManageProjectMember(manager, staff, "remove")).toBeTruthy();
    expect(canManageProjectMember(staff, manager, "update-role")).toBeFalsy();
    expect(canManageProjectMember(staff, manager, "remove")).toBeFalsy();
    expect(canManageProjectMember(manager, partner, "update-role")).toBeFalsy();
    expect(canManageProjectMember(manager, partner, "remove")).toBeFalsy();
    expect(
      canManageProjectMember(seniorManager, partner, "remove")
    ).toBeFalsy();
    expect(canManageProjectMember(principal, partner, "remove")).toBeFalsy();
  });

  it("separates partner in charge actions from ordinary partner actions", () => {
    expect(canManageProjectMember(partner, partner, "update-role")).toBeFalsy();
    expect(canArchiveProject(partner)).toBeTruthy();
    expect(canArchiveProject(invitedPartner)).toBeTruthy();
    expect(canArchiveProject(manager)).toBeTruthy();
    expect(canArchiveProject(principal)).toBeTruthy();
    expect(
      canPerformProjectAction(invitedPartner, "deleteProject")
    ).toBeFalsy();
    expect(canArchiveProject(taxExpert)).toBeFalsy();
  });

  it("maps hidden/disabled workspace actions from the shared matrix", () => {
    expect(canPerformProjectAction(eqr, "viewRecycleBin")).toBeFalsy();
    expect(canPerformProjectAction(eqr, "modifyIndex")).toBeFalsy();
    expect(canPerformProjectAction(staff, "viewTemporaryFiles")).toBeTruthy();
    expect(
      canPerformProjectAction(taxExpert, "uploadWorkingPapers")
    ).toBeFalsy();
  });
});
