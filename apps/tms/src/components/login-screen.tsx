"use client";

import { buildLocalizedLoginPath } from "@project-wing/shared";
import { Auth } from "@project-wing/ui";
import type { DevelopmentAccount } from "@project-wing/ui";
import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme-provider";
import { localeCookieName } from "@/i18n/settings";
import {
  impersonateDevelopmentAccount,
  listDevelopmentAccounts,
  login,
  loginWithOtp,
  me,
  requestLoginOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from "@/lib/api";
import type { User } from "@/lib/api";

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const LOGIN_EMAIL_KEY = "project-wing-tms-login-email";
const tmsAuthAdapter = {
  impersonateDevelopmentAccount,
  login: ({
    email,
    password,
    rememberMe,
  }: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => login(email, password, rememberMe),
  loginWithOtp: ({ email, otp }: { email: string; otp: string }) =>
    loginWithOtp(email, otp),
  requestLoginOtp: async (email: string) => {
    await requestLoginOtp(email);
  },
  requestPasswordResetOtp: async (email: string) => {
    await requestPasswordResetOtp(email);
  },
  resetPasswordWithOtp: ({
    email,
    otp,
    password,
  }: {
    email: string;
    otp: string;
    password: string;
  }) => resetPasswordWithOtp(email, otp, password),
  restoreIntranetEntry: () => me(),
  verifyPasswordResetOtp: ({ email, otp }: { email: string; otp: string }) =>
    verifyPasswordResetOtp(email, otp),
};

export function LoginScreen({
  locale = "en-US",
  onAuthenticated,
}: {
  locale?: "zh-CN" | "en-US";
  onAuthenticated: (user: User, options: { autoLogin: boolean }) => void;
}) {
  const { flavor, fontSize, setFlavor, setFontSize } = useTheme();
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);

  useEffect(() => {
    void listDevelopmentAccounts()
      .then((accounts) =>
        setDevelopmentAccounts(
          accounts.map((account) => ({
            ...account,
            password: DEVELOPMENT_ACCOUNT_PASSWORD,
          }))
        )
      )
      .catch(() => setDevelopmentAccounts([]));
  }, []);
  return (
    <Auth
      adapter={tmsAuthAdapter}
      brandLines={["Timesheet", "Management", "System"]}
      controls={{
        isDark: flavor === "mocha",
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
        onToggleTheme: () => setFlavor(flavor === "latte" ? "mocha" : "latte"),
      }}
      developmentAccounts={developmentAccounts}
      locale={locale}
      storageKey={LOGIN_EMAIL_KEY}
      onAuthenticated={(user, autoLogin) =>
        onAuthenticated(user, { autoLogin })
      }
    />
  );
}
