"use client";

import {
  buildApplicationHomePath,
  buildLocalizedLoginPath,
} from "@project-wing/shared";
import { Auth, useProjectWingTheme } from "@project-wing/ui";
import type { DevelopmentAccount } from "@project-wing/ui";
import { useEffect, useState } from "react";

import type { IntranetLanguage } from "@/i18n/dictionaries";
import { localeCookieName } from "@/i18n/settings";
import {
  intranetAuthAdapter,
  listIntranetDevelopmentAccounts,
} from "@/lib/auth-client";
import type { IntranetDevelopmentAccount } from "@/lib/auth-client";

const DEVELOPMENT_ACCOUNT_PASSWORD = "DANGEROUS";
const LOGIN_EMAIL_KEY = "project-wing-intranet-login-email";

function toDevelopmentAccounts(
  accounts: IntranetDevelopmentAccount[]
): DevelopmentAccount[] {
  return accounts.map(({ email, name, role }) => ({
    email,
    name,
    password: DEVELOPMENT_ACCOUNT_PASSWORD,
    role,
  }));
}

export function IntranetLoginPage({ locale }: { locale: IntranetLanguage }) {
  const { flavor, fontSize, setFlavor, setFontSize } = useProjectWingTheme();
  const [developmentAccounts, setDevelopmentAccounts] = useState<
    DevelopmentAccount[]
  >([]);

  useEffect(() => {
    void listIntranetDevelopmentAccounts()
      .then((accounts) =>
        setDevelopmentAccounts(toDevelopmentAccounts(accounts))
      )
      .catch(() => setDevelopmentAccounts([]));
  }, []);

  const switchLocale = () => {
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    window.location.replace(buildLocalizedLoginPath(nextLocale));
  };

  return (
    <Auth
      adapter={intranetAuthAdapter}
      brandHideText
      controls={{
        isDark: flavor === "mocha",
        fontSize,
        onToggleLocale: switchLocale,
        onToggleFontSize: () =>
          setFontSize(
            fontSize === "sm" ? "md" : fontSize === "md" ? "lg" : "sm"
          ),
        onToggleTheme: () => setFlavor(flavor === "latte" ? "mocha" : "latte"),
      }}
      developmentAccounts={developmentAccounts}
      locale={locale}
      storageKey={LOGIN_EMAIL_KEY}
      onAuthenticated={() =>
        window.location.replace(buildApplicationHomePath("intranet", locale))
      }
    />
  );
}
