export const locales = ["zh-CN", "en-US"] as const;
export type IbLocale = (typeof locales)[number];
export const defaultLocale: IbLocale = "zh-CN";
export const localeCookieName = "NEXT_LOCALE";

const localeSet = new Set<string>(locales);

export function isLocale(value: string): value is IbLocale {
  return localeSet.has(value);
}

export function normalizeLocale(value?: string | null): IbLocale | null {
  if (!value) {
    return null;
  }
  if (isLocale(value)) {
    return value;
  }
  const language = value.split("-")[0]?.toLowerCase();
  if (language === "zh") {
    return "zh-CN";
  }
  if (language === "en") {
    return "en-US";
  }
  return null;
}

export function getPreferredLocale(acceptLanguage?: string | null): IbLocale {
  if (!acceptLanguage) {
    return defaultLocale;
  }
  for (const candidate of acceptLanguage.split(",")) {
    const locale = normalizeLocale(candidate.split(";")[0]?.trim());
    if (locale) {
      return locale;
    }
  }
  return defaultLocale;
}
