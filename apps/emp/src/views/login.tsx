"use client";

import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "@project-wing/shared";
import { Auth } from "@project-wing/ui";
import type { DevelopmentAccount } from "@project-wing/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type {
  DevelopmentAccount as ApiDevelopmentAccount,
  User,
} from "../api/client";
import { pairDesktopAgentWithBetterAuth } from "../api/desktop-agent";
import { useTheme } from "../components/theme-provider";
import { useI18n } from "../i18n/client";
import { localeCookieName } from "../i18n/settings";

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const LOGIN_EMAIL_KEY = "project-wing-emp-login-email";
function toDevelopmentAccounts(
  accounts: ApiDevelopmentAccount[]
): DevelopmentAccount[] {
  return accounts.map(({ email, name, role }) => ({
    email,
    name,
    password: DEVELOPMENT_ACCOUNT_PASSWORD,
    role,
  }));
}

const empAuthAdapter = {
  impersonateDevelopmentAccount: (email: string) =>
    api.impersonateDevelopmentAccount(email),
  login: ({
    email,
    password,
    rememberMe,
  }: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => api.login(email, password, rememberMe),
  loginWithOtp: ({ email, otp }: { email: string; otp: string }) =>
    api.loginWithOtp(email, otp),
  requestLoginOtp: async (email: string) => {
    await api.requestLoginOtp(email);
  },
  requestPasswordResetOtp: async (email: string) => {
    await api.requestPasswordResetOtp(email);
  },
  resetPasswordWithOtp: ({
    email,
    otp,
    password,
  }: {
    email: string;
    otp: string;
    password: string;
  }) => api.resetPasswordWithOtp(email, otp, password),
  restoreIntranetEntry: () => api.restoreIntranetEntry(),
  verifyPasswordResetOtp: ({ email, otp }: { email: string; otp: string }) =>
    api.verifyPasswordResetOtp(email, otp),
};

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dictionary: _unused_dictionary, locale } = useI18n();
  const { fontSize, resolvedTheme, setFontSize, setTheme } = useTheme();
  const nextPath = resolveSafeNextPath(
    searchParams.get("next") ?? searchParams.get("redirect"),
    buildApplicationHomePath("emp", locale)
  );
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);

  useEffect(() => {
    void api
      .listDevelopmentAccounts()
      .then((accounts) =>
        setDevelopmentAccounts(toDevelopmentAccounts(accounts))
      )
      .catch(() => setDevelopmentAccounts([]));
  }, []);

  return (
    <Auth
      adapter={empAuthAdapter}
      controls={{
        isDark: resolvedTheme === "dark",
        fontSize,
        onToggleLocale: () => {
          const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
          document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
          window.location.replace(buildLocalizedLoginPath(nextLocale));
        },
        onToggleFontSize: () =>
          setFontSize(
            fontSize === "sm" ? "md" : fontSize === "md" ? "lg" : "sm"
          ),
        onToggleTheme: () =>
          setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      }}
      developmentAccounts={developmentAccounts}
      locale={locale}
      storageKey={LOGIN_EMAIL_KEY}
      onAuthenticated={async (_user: User) => {
        await pairDesktopAgentWithBetterAuth().catch(() => {});
        void api.updatePreferredLocale(locale).catch(() => {});
        router.replace(nextPath);
      }}
    />
  );
}
