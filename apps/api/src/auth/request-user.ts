import type { GlobalRole } from "@prisma/client";

export type RequestUser = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
};
