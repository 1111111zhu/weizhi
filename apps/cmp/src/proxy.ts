import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  defaultLocale,
  getPreferredLocale,
  localeCookieName,
  normalizeLocale,
} from "./i18n/settings";

const PUBLIC_FILE = /\.(.*)$/;
const SINGULAR_CMP_ROUTES = new Map([
  ["clients", "client"],
  ["engagements", "engagement"],
]);

function canonicalizeRouteSegments(segments: string[], routeIndex: number) {
  const route = segments[routeIndex];
  const canonicalRoute = route ? SINGULAR_CMP_ROUTES.get(route) : undefined;
  if (!canonicalRoute) {
    return segments;
  }

  const canonicalSegments = [...segments];
  canonicalSegments[routeIndex] = canonicalRoute;
  return canonicalSegments;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const [firstSegment] = segments;
  const pathLocale = normalizeLocale(firstSegment);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (firstSegment === "cmp") {
    return NextResponse.next();
  }

  const locale =
    pathLocale ??
    normalizeLocale(request.cookies.get(localeCookieName)?.value) ??
    getPreferredLocale(request.headers.get("accept-language")) ??
    defaultLocale;
  const routeIndex = pathLocale ? 1 : 0;
  const canonicalSegments = canonicalizeRouteSegments(segments, routeIndex);

  if (pathLocale) {
    if (canonicalSegments !== segments) {
      const url = request.nextUrl.clone();
      url.pathname = `/${canonicalSegments.join("/")}`;
      return NextResponse.redirect(url);
    }
    const headers = new Headers(request.headers);
    headers.set("x-project-wing-locale", pathLocale);
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${canonicalSegments.length > 0 ? `/${canonicalSegments.join("/")}` : ""}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
