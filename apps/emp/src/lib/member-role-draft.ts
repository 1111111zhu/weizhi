import type { ProjectRole } from "@project-wing/shared";

export function resolveMemberRoleDraft(
  currentRole: ProjectRole,
  allowedRoles: ProjectRole[]
) {
  return allowedRoles.includes(currentRole)
    ? currentRole
    : (allowedRoles[0] ?? currentRole);
}
