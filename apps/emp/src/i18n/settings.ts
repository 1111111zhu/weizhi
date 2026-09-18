export const locales = ["zh-CN", "en-US"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-CN";
export const localeCookieName = "NEXT_LOCALE";

const localeSet = new Set<string>(locales);

export function isLocale(value: string): value is Locale {
  return localeSet.has(value);
}

export function normalizeLocale(value?: string | null): Locale | null {
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

export function getPreferredLocale(acceptLanguage?: string | null): Locale {
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

      return {
        tag,
        weight: q ? Number(q.slice(2)) : 1,
      };
    })
    .filter((candidate) => candidate.tag)
    .sort((a, b) => b.weight - a.weight);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate.tag);
    if (locale) {
      return locale;
    }
  }

  return defaultLocale;
}

export function getPathnameLocale(pathname: string): Locale | null {
  const segment = pathname.split("/").find(Boolean);
  return segment && isLocale(segment) ? segment : null;
}

export function stripPathnameLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] && isLocale(parts[0])) {
    const stripped = `/${parts.slice(1).join("/")}`;
    return stripped === "/" ? "/" : stripped.replace(/\/$/, "");
  }

  return pathname || "/";
}

export function localizedPath(pathname: string, locale: Locale): string {
  const [path, query = ""] = pathname.split("?");
  const stripped = stripPathnameLocale(path || "/");
  const normalizedPath = stripped === "/" ? "" : stripped;
  return `/${locale}${normalizedPath}${query ? `?${query}` : ""}`;
}
