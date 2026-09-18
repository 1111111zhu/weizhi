import { ROUTES, SHOWROOM_BASE_PATH } from "@/constants/routes";

export const FALLBACK_SITE_ORIGIN = "http://localhost:3008" as const;

const appendBasePath = (origin: string): string => {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  if (!SHOWROOM_BASE_PATH) {
    return normalizedOrigin;
  }

  const pathname = new URL(normalizedOrigin).pathname.replace(/\/+$/, "");
  if (
    pathname === SHOWROOM_BASE_PATH ||
    pathname.startsWith(`${SHOWROOM_BASE_PATH}/`)
  ) {
    return normalizedOrigin;
  }
  return `${normalizedOrigin}${SHOWROOM_BASE_PATH}`;
};

const getBaseUrl = () => {
  if (process.env.NODE_ENV !== "production") {
    return appendBasePath(FALLBACK_SITE_ORIGIN);
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return appendBasePath(
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    );
  }

  const domainSuffix =
    process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX ?? "superfx.cn";
  const origin =
    process.env.PROJECTWING_SHOWROOM_URL ??
    process.env.SITE_URL ??
    `https://showroom.${domainSuffix}`;
  return appendBasePath(origin);
};

const baseUrl = getBaseUrl();

export const SITE = {
  AUTHOR: {
    NAME: "Project Wing",
    TWITTER: "@projectwing",
  },
  DESCRIPTION: {
    LONG: "Design system and component showroom for Project Wing.",
    SHORT: "Project Wing UI Showroom",
  },
  KEYWORDS: [
    "shadcn",
    "shadcn registry",
    "component registry",
    "shadcn components",
    "next.js",
    "tailwindcss",
    "project wing",
  ] as const,
  NAME: "Showroom",
  OG_IMAGE: `${baseUrl}/og`,
  REGISTRY: `${baseUrl}${ROUTES.REGISTRY}`,
  REGISTRY_ITEMS: `${baseUrl}/r`,
  URL: baseUrl,
};

export const META_THEME_COLORS = {
  dark: "rgb(9 9 11)",
  light: "rgb(255 255 255)",
};

export const UTM_PARAMS = {
  utm_source: new URL(baseUrl).hostname,
};
