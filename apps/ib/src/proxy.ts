import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  defaultLocale,
  getPreferredLocale,
  localeCookieName,
  normalizeLocale,
} from "./i18n/settings";

const PUBLIC_FILE = /\.(.*)$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/").find(Boolean);
  const pathLocale = normalizeLocale(firstSegment);
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (pathLocale) {
    const headers = new Headers(request.headers);
    headers.set("x-project-wing-locale", pathLocale);
    return NextResponse.next({ request: { headers } });
  }

  const locale =
    normalizeLocale(request.cookies.get(localeCookieName)?.value) ??
    getPreferredLocale(request.headers.get("accept-language")) ??
    defaultLocale;
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
