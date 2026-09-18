import { createHash } from "node:crypto";

import { isProjectPermissionSubjectConsistent } from "@project-wing/shared";
import type {
  GlobalRoleInput,
  InChargeRole,
  ProjectRole,
  ProjectAuthorizationImpact,
} from "@project-wing/shared";

export function projectAuthorizationImpact(
  nextGrade: GlobalRoleInput,
  members: {
    id: string;
    projectId: string;
    projectRole: ProjectRole;
    inChargeRole: InChargeRole | null;
    authorizationSuspendedAt?: Date | null;
    updatedAt: Date;
    project: { projectCode: string; name: string };
  }[],
  currentGrade?: GlobalRoleInput
): ProjectAuthorizationImpact {
  const affected = members
    .filter(
      (member) =>
        !member.authorizationSuspendedAt &&
        (!isProjectPermissionSubjectConsistent({
          globalRole: nextGrade,
          projectRole: member.projectRole,
          inChargeRole: member.inChargeRole,
        }) ||
          (currentGrade &&
            !isProjectPermissionSubjectConsistent({
              globalRole: currentGrade,
              projectRole: member.projectRole,
              inChargeRole: member.inChargeRole,
            })))
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    token: createHash("sha256")
      .update(
        JSON.stringify([
          currentGrade,
          nextGrade,
          affected.map((member) => [
            member.id,
            member.projectRole,
            member.inChargeRole,
            member.updatedAt,
          ]),
        ])
      )
      .digest("hex"),
    projects: affected.map((member) => ({
      memberId: member.id,
      projectId: member.projectId,
      projectCode: member.project.projectCode,
      projectName: member.project.name,
    })),
  };
}
