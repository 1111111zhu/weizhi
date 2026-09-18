import { canProjectMemberPerformAction } from "@project-wing/shared";
import type {
  GlobalRole,
  InChargeRole,
  ProjectPermissionAction,
  ProjectRole,
} from "@project-wing/shared";

export type ProjectMemberPermissionSubject = {
  id: string;
  projectRole: ProjectRole;
  inChargeRole?: InChargeRole | null;
  authorizationSuspendedAt?: string | null;
  user: {
    id: string;
    globalRole: GlobalRole;
  };
};

type MemberManagementAction = "update-role" | "remove";

export function canManageProjectMembers(
  actor?: ProjectMemberPermissionSubject | null
) {
  return canPerformProjectAction(actor, "inviteProjectMembers");
}

export function canManageProjectMember(
  actor: ProjectMemberPermissionSubject | undefined | null,
  target: ProjectMemberPermissionSubject,
  action: MemberManagementAction
) {
  if (!canPerformProjectAction(actor, "removeProjectMembers") || !actor) {
    return false;
  }
  if (target.inChargeRole) {
    return false;
  }
  if (actor.user.id === target.user.id) {
    return false;
  }
  if (action === "update-role" && target.projectRole === "PARTNER") {
    return false;
  }
  if (
    action === "remove" &&
    actor.user.globalRole !== "PARTNER" &&
    target.projectRole === "PARTNER"
  ) {
    return false;
  }
  return true;
}

export function canArchiveProject(
  actor?: ProjectMemberPermissionSubject | null
) {
  return canPerformProjectAction(actor, "archiveProject");
}

export function canPerformProjectAction(
  actor: ProjectMemberPermissionSubject | undefined | null,
  action: ProjectPermissionAction
) {
  return actor
    ? canProjectMemberPerformAction(
        {
          authorizationSuspended: Boolean(actor.authorizationSuspendedAt),
          globalRole: actor.user.globalRole,
          projectRole: actor.projectRole,
          inChargeRole: actor.inChargeRole,
        },
        action
      )
    : false;
}
