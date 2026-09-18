export type IntranetMockIdentity = {
  email: string;
  globalRole: string;
  id: string;
  name: string;
};

export const INTRANET_MOCK_IDENTITIES: readonly IntranetMockIdentity[] = [
  {
    email: "admin@projectwing.local",
    globalRole: "SUPER_ADMIN",
    id: "mock-admin",
    name: "Project Wing Admin",
  },
  {
    email: "partner@projectwing.local",
    globalRole: "PARTNER",
    id: "mock-partner",
    name: "Project Wing Partner",
  },
  {
    email: "manager@projectwing.local",
    globalRole: "MANAGER",
    id: "mock-manager",
    name: "Project Wing Manager",
  },
  {
    email: "staff@projectwing.local",
    globalRole: "STAFF",
    id: "mock-staff",
    name: "Project Wing Staff",
  },
] as const;

export const INTRANET_MOCK_IDENTITY_COOKIE = "project-wing-intranet-mock-user";

export function getIntranetMockIdentity(email: string) {
  return INTRANET_MOCK_IDENTITIES.find((account) => account.email === email);
}

export function isIntranetMockMode() {
  return process.env.NEXT_PUBLIC_API_MODE?.toLowerCase() === "mock";
}
