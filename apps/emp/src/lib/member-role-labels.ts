import {
  IN_CHARGE_ROLE_LABELS,
  PROJECT_ROLE_LABELS,
  isProjectPermissionSubjectConsistent,
} from "@project-wing/shared";
import type {
  GlobalRole,
  GlobalRoleInput,
  InChargeRole,
  ProjectRole,
} from "@project-wing/shared";

export const firmRankLabels: Record<GlobalRole, string> = {
  SUPER_ADMIN: "System administrator",
  HR: "Human resources",
  CONFIRMATION_OFFICER: "Confirmation officer",
  PARTNER: "Partner",
  PRINCIPAL: "Principal",
  MANAGER: "Manager",
  SENIOR: "Senior",
  STAFF: "Staff",
  ASSISTANT: "Assistant",
  EQCR: "N/A",
  TAX_EXPERT: "N/A",
};

export function getFirmRankLabel(globalRole: GlobalRoleInput) {
  return firmRankLabels[
    globalRole === "SENIOR_MANAGER" ? "MANAGER" : globalRole
  ];
}

export function getRoleInEngagementLabel({
  globalRole,
  projectRole,
  inChargeRole,
}: {
  globalRole: GlobalRoleInput;
  projectRole: ProjectRole;
  inChargeRole?: InChargeRole | null;
}) {
  if (inChargeRole) {
    return IN_CHARGE_ROLE_LABELS[inChargeRole];
  }
  if (projectRole === "PARTNER") {
    return "Partner";
  }
  if (projectRole === "EQCR") {
    return "Engagement Quality Reviewer";
  }
  if (projectRole === "TAX_REVIEWER") {
    return "Expert";
  }
  if (
    globalRole === "PRINCIPAL" ||
    globalRole === "SENIOR_MANAGER" ||
    globalRole === "MANAGER" ||
    globalRole === "SENIOR" ||
    globalRole === "STAFF" ||
    globalRole === "ASSISTANT"
  ) {
    return getFirmRankLabel(globalRole);
  }
  return PROJECT_ROLE_LABELS[projectRole];
}

export function getInvitationRoleLabel(
  globalRole: GlobalRoleInput,
  projectRole: ProjectRole
) {
  return getRoleInEngagementLabel({ globalRole, projectRole });
}

export function getProjectMemberMentionOptions(
  members: {
    projectRole: ProjectRole;
    inChargeRole?: InChargeRole | null;
    authorizationSuspendedAt?: string | null;
    roleConsistent?: boolean;
    user: {
      id: string;
      name: string;
      globalRole: GlobalRoleInput;
      status?: string;
    };
  }[],
  currentUserId: string | null | undefined,
  currentUserLabel: string
) {
  return members
    .filter(
      (member) =>
        member.user.status !== "DISABLED" &&
        !member.authorizationSuspendedAt &&
        member.roleConsistent !== false &&
        isProjectPermissionSubjectConsistent({
          globalRole: member.user.globalRole,
          projectRole: member.projectRole,
          inChargeRole: member.inChargeRole,
        })
    )
    .map((member) => ({
      id: member.user.id,
      label: member.user.name,
      description:
        member.user.id === currentUserId
          ? currentUserLabel
          : getFirmRankLabel(member.user.globalRole),
    }));
}
