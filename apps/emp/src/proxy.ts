import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  defaultLocale,
  getPathnameLocale,
  getPreferredLocale,
  localeCookieName,
  normalizeLocale,
} from "./i18n/settings";

const PUBLIC_FILE = /\.(.*)$/;

export function getLegacyWorkspacesRedirectPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const locale = normalizeLocale(segments[0]);

  if (!locale || segments[1] !== "workspaces") {
    return null;
  }

  if (segments.length === 2 || segments.length === 3) {
    return `/${locale}/engagement`;
  }

  if (segments[3] !== "projects") {
    return null;
  }

  if (segments[4] === "new" && segments.length === 5) {
    return `/${locale}/engagement/new`;
  }

  if (segments[4] && segments.length === 5) {
    return `/${locale}/engagement/${segments[4]}`;
  }

  if (segments[4] && segments[5] === "members" && segments.length === 6) {
    return `/${locale}/engagement/${segments[4]}/members`;
  }

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [firstSegment, ...remainingSegments] = pathname
    .split("/")
    .filter(Boolean);
  const normalizedPathLocale = normalizeLocale(firstSegment);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (getPathnameLocale(pathname)) {
    const legacyWorkspacePath = getLegacyWorkspacesRedirectPath(pathname);
    if (legacyWorkspacePath) {
      const url = request.nextUrl.clone();
      url.pathname = legacyWorkspacePath;
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (normalizedPathLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${normalizedPathLocale}/${remainingSegments.join("/")}`;
    return NextResponse.redirect(url);
  }

  const cookieLocale = normalizeLocale(
    request.cookies.get(localeCookieName)?.value
  );
  const acceptLanguageLocale = getPreferredLocale(
    request.headers.get("accept-language")
  );
  const locale = cookieLocale ?? acceptLanguageLocale ?? defaultLocale;
  const url = request.nextUrl.clone();

  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
