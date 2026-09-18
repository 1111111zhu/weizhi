import "server-only";
import { cookies } from "next/headers";

import {
  INTRANET_MOCK_IDENTITY_COOKIE,
  getIntranetMockIdentity,
  isIntranetMockMode,
} from "./mock-identity";

type AccountMeResponse = {
  email?: string;
  globalRole?: string;
  id?: string;
  name?: string;
};

export type IntranetCurrentAccount = {
  email: string;
  globalRole: string;
  id: string;
  name: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function getCurrentAccount(): Promise<IntranetCurrentAccount | null> {
  const cookieStore = await cookies();
  if (isIntranetMockMode()) {
    return (
      getIntranetMockIdentity(
        cookieStore.get(INTRANET_MOCK_IDENTITY_COOKIE)?.value ?? ""
      ) ?? null
    );
  }
  const previewRole = process.env.INTRANET_PREVIEW_GLOBAL_ROLE;
  if (
    process.env.PROJECTWING_ENVIRONMENT !== "production" &&
    (previewRole === "SUPER_ADMIN" || previewRole === "PARTNER")
  ) {
    return {
      email:
        previewRole === "PARTNER"
          ? "partner@projectwing.local"
          : "admin@projectwing.local",
      globalRole: previewRole,
      id: previewRole === "PARTNER" ? "preview-partner" : "preview-admin",
      name:
        previewRole === "PARTNER"
          ? "Project Wing Partner"
          : "Project Wing Admin",
    };
  }

  try {
    const cookieHeader = cookieStore.toString();
    const response = await fetch(`${apiBaseUrl}/account/me`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });

    if (!response.ok) {
      return null;
    }

    const account = (await response.json()) as AccountMeResponse;
    if (!account.globalRole || !account.email || !account.id) {
      return null;
    }

    return {
      email: account.email,
      globalRole: account.globalRole,
      id: account.id,
      name: account.name?.trim() || account.email,
    };
  } catch {
    return null;
  }
}

export async function getCurrentGlobalRole(): Promise<string | null> {
  const account = await getCurrentAccount();
  return account?.globalRole ?? null;
}
