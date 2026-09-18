"use client";

import {
  requestEmailPasswordResetOtp,
  requestEmailSignInOtp,
  resetPasswordWithEmailOtp,
  signInWithBetterAuth,
  signInWithEmailOtp,
  verifyEmailPasswordResetOtp,
} from "@project-wing/shared";
import type { AuthAdapter } from "@project-wing/ui";

import type { IntranetCurrentAccount } from "./current-user";
import { INTRANET_MOCK_IDENTITIES, isIntranetMockMode } from "./mock-identity";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? apiBaseUrl;

async function getCurrentAccount() {
  const response = await fetch(`${apiBaseUrl}/account/me`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to read current account.");
  }
  return response.json() as Promise<IntranetCurrentAccount>;
}

async function impersonateMockAccount(email: string) {
  const response = await fetch("/api/mock/identity", {
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Mock identity is not available.");
  }
  return response.json() as Promise<IntranetCurrentAccount>;
}

async function requestAuth(path: string, init?: RequestInit) {
  const response = await fetch(`${authBaseUrl}/auth${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error("Authentication request failed.");
  }
  return response;
}

export const intranetAuthAdapter: AuthAdapter<IntranetCurrentAccount> = {
  impersonateDevelopmentAccount: async (email) => {
    if (isIntranetMockMode()) {
      return impersonateMockAccount(email);
    }
    await requestAuth("/development/impersonate", {
      body: JSON.stringify({ email }),
      method: "POST",
    });
    return getCurrentAccount();
  },
  login: async ({ email, password, rememberMe }) => {
    await signInWithBetterAuth({
      baseURL: authBaseUrl,
      email,
      password,
      rememberMe,
    });
    return getCurrentAccount();
  },
  loginWithOtp: async ({ email, otp }) => {
    await signInWithEmailOtp({ baseURL: authBaseUrl, email, otp });
    return getCurrentAccount();
  },
  requestLoginOtp: (email) =>
    requestEmailSignInOtp({ baseURL: authBaseUrl, email }),
  requestPasswordResetOtp: (email) =>
    requestEmailPasswordResetOtp({ baseURL: authBaseUrl, email }),
  resetPasswordWithOtp: ({ email, otp, password }) =>
    resetPasswordWithEmailOtp({ baseURL: authBaseUrl, email, otp, password }),
  restoreIntranetEntry: async () => {
    try {
      return await getCurrentAccount();
    } catch {
      return null;
    }
  },
  verifyPasswordResetOtp: ({ email, otp }) =>
    verifyEmailPasswordResetOtp({ baseURL: authBaseUrl, email, otp }),
};

export type IntranetDevelopmentAccount = {
  email: string;
  name: string;
  role: string;
};

export async function listIntranetDevelopmentAccounts() {
  if (isIntranetMockMode()) {
    return INTRANET_MOCK_IDENTITIES.map(({ email, globalRole, name }) => ({
      email,
      name,
      role: globalRole,
    }));
  }
  const response = await requestAuth("/development/accounts");
  const body = (await response.json()) as {
    accounts: {
      email: string;
      globalRole: string;
      name: string;
    }[];
  };
  return body.accounts.map(({ email, globalRole, name }) => ({
    email,
    name,
    role: globalRole,
  }));
}
