import { GLOBAL_ROLE_METADATA } from "@project-wing/shared";
import type { GlobalRole } from "@project-wing/shared";

/** Isolated showroom identity, not the signed-in production account. */
export const mobileAccountFixture: {
  name: string;
  email: string;
  globalRole: GlobalRole;
} = {
  name: "Alex Chen",
  email: "alex.chen@example.test",
  globalRole: "MANAGER",
};

export function mobileAccountRank(globalRole?: GlobalRole | null): string {
  return globalRole ? (GLOBAL_ROLE_METADATA[globalRole]?.label ?? "—") : "—";
}
