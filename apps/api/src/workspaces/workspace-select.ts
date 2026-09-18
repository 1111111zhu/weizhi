import type { Prisma } from "@prisma/client";

export const workspaceMemberUserSelect = {
  id: true,
  name: true,
  email: true,
  globalRole: true,
  status: true,
} satisfies Prisma.UserSelect;
