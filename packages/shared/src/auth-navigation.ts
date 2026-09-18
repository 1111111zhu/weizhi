export type AuthLocale = "zh-CN" | "en-US";

export type AuthApplication = "emp" | "cmp" | "tms" | "intranet";

const DEFAULT_NEXT_PATH = "/";

export function resolveSafeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH
) {
  const candidate = value?.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\p{Cc}\u007F]/u.test(candidate)
  ) {
    return fallback;
  }
  return candidate;
}

export function buildLocalizedLoginPath(
  locale: AuthLocale,
  nextPath?: string | null
) {
  const next = resolveSafeNextPath(nextPath);
  return next === "/"
    ? `/${locale}/login`
    : `/${locale}/login?next=${encodeURIComponent(next)}`;
}

export function buildApplicationHomePath(
  application: AuthApplication,
  locale: AuthLocale,
  globalRole?: string | null
) {
  if (application === "emp") {
    return `/${locale}/engagement`;
  }
  if (application === "cmp") {
    return `/${locale}/${globalRole === "SUPER_ADMIN" ? "dashboard" : "client"}`;
  }
  if (application === "tms") {
    return `/${locale}/timesheet`;
  }
  return `/${locale}`;
}
