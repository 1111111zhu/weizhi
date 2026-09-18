import { SetMetadata } from "@nestjs/common";
import type { GlobalRole } from "@prisma/client";

export const GLOBAL_ROLES_KEY = "global_roles";
export const RequireGlobalRoles = (...roles: GlobalRole[]) =>
  SetMetadata(GLOBAL_ROLES_KEY, roles);
