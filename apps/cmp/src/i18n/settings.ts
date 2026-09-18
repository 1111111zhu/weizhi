export const locales = ["zh-CN", "en-US"] as const;

export type CmpLocale = (typeof locales)[number];
export const defaultLocale: CmpLocale = "zh-CN";
export const localeCookieName = "NEXT_LOCALE";

const localeSet = new Set<string>(locales);

export function isLocale(value: string): value is CmpLocale {
  return localeSet.has(value);
}

export function normalizeLocale(value?: string | null): CmpLocale | null {
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

export function getPreferredLocale(acceptLanguage?: string | null): CmpLocale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      return { tag, weight: q ? Number(q.slice(2)) : 1 };
    })
    .filter((candidate) => candidate.tag)
    .sort((left, right) => right.weight - left.weight);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate.tag);
    if (locale) {
      return locale;
    }
  }
  return defaultLocale;
}

export function localizedPath(pathname: string, locale: CmpLocale) {
  const [path, query = ""] = pathname.split("?");
  const parts = (path || "/").split("/").filter(Boolean);
  if (isLocale(parts[0] ?? "")) {
    parts.shift();
  }
  const normalizedPath = parts.length > 0 ? `/${parts.join("/")}` : "";
  return `/${locale}${normalizedPath}${query ? `?${query}` : ""}`;
}
