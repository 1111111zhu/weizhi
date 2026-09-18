"use client";

import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
  resolveSafeNextPath,
} from "@project-wing/shared";
import { Auth, useProjectWingTheme } from "@project-wing/ui";
import type { DevelopmentAccount } from "@project-wing/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "../../../api/client";
import type { CurrentUser } from "../../../api/client";
import { previewUsers } from "../../../api/preview-data";
import { useCmpI18n } from "../../../i18n/client";
import { localeCookieName } from "../../../i18n/settings";

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const LOGIN_EMAIL_KEY = "project-wing-cmp-login-email";
const mockDevelopmentAccounts: DevelopmentAccount[] =
  process.env.NEXT_PUBLIC_API_MODE === "mock"
    ? previewUsers.map(({ email, globalRole, name }) => ({
        email,
        name,
        password: DEVELOPMENT_ACCOUNT_PASSWORD,
        role: globalRole,
      }))
    : [];
const cmpAuthAdapter = {
  login: ({
    email,
    password,
    rememberMe,
  }: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => api.login({ email, password, rememberMe }),
  impersonateDevelopmentAccount: (email: string) =>
    api.impersonateDevelopmentAccount(email),
  loginWithOtp: ({ email, otp }: { email: string; otp: string }) =>
    api.loginWithOtp({ email, otp }),
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
  }) => api.resetPasswordWithOtp({ email, otp, password }),
  restoreIntranetEntry: () => api.restoreIntranetEntry(),
  verifyPasswordResetOtp: ({ email, otp }: { email: string; otp: string }) =>
    api.verifyPasswordResetOtp({ email, otp }),
};

export function LoginClient() {
  const router = useRouter();
  const { locale } = useCmpI18n();
  const { flavor, fontSize, setFlavor, setFontSize } = useProjectWingTheme();
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >(mockDevelopmentAccounts);

  useEffect(() => {
    void api
      .listDevelopmentAccounts()
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
      adapter={cmpAuthAdapter}
      brandLines={["Engagement", "Management", "Portal"]}
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
      onAuthenticated={(user: CurrentUser) => {
        void api.updatePreferredLocale(locale).catch(() => undefined);
        const searchParams = new URLSearchParams(window.location.search);
        const next = resolveSafeNextPath(
          searchParams.get("next") ?? searchParams.get("redirect")
        );
        router.replace(
          next === "/"
            ? buildApplicationHomePath("cmp", locale, user.globalRole)
            : next
        );
      }}
    />
  );
}
