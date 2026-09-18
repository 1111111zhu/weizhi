export const ROUTES = {
  AGENT_SKILLS_INDEX: "/.well-known/agent-skills/index.json",
  AGENT_SKILLS_SITE_SKILL: "/.well-known/agent-skills/site-skill.md",
  API_CATALOG: "/.well-known/api-catalog",
  API_STATUS: "/api/status",
  BLOCKS: "/blocks",
  COMPONENTS: "/components",
  DOCS: "/docs",
  DOCS_COMPONENTS: "/docs/components",
  DOCS_INSTALLATION: "/docs/installation",
  FOUNDATIONS: "/foundations",
  REVIEW: "/review",
  SPECIMENS: "/specimens",
  THEMES: "/themes",
  HOME: "/",
  LLMS: "/llms.txt",
  LLMS_FULL: "/llms-full.txt",
  LLMS_MD: "/llms.md",
  MANIFEST: "/manifest.webmanifest",
  MCP: "/mcp",
  OG: "/og",
  OPENAPI: "/openapi.json",
  REGISTRY: "/r/registry.json",
  ROBOTS: "/robots.txt",
  RSS: "/rss.xml",
  SITEMAP: "/sitemap.xml",
  SPONSOR: "/sponsor",
} as const;

export const normalizeShowroomBasePath = (value?: string): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
};

export const SHOWROOM_BASE_PATH = normalizeShowroomBasePath(
  process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH
);

export const withShowroomBasePath = (route: string): string => {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  if (!SHOWROOM_BASE_PATH || normalizedRoute === SHOWROOM_BASE_PATH) {
    return normalizedRoute;
  }
  if (normalizedRoute.startsWith(`${SHOWROOM_BASE_PATH}/`)) {
    return normalizedRoute;
  }
  return `${SHOWROOM_BASE_PATH}${normalizedRoute}`;
};

export const withoutShowroomBasePath = (route: string): string => {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  if (!SHOWROOM_BASE_PATH) {
    return normalizedRoute;
  }
  if (normalizedRoute === SHOWROOM_BASE_PATH) {
    return ROUTES.HOME;
  }
  return normalizedRoute.startsWith(`${SHOWROOM_BASE_PATH}/`)
    ? normalizedRoute.slice(SHOWROOM_BASE_PATH.length)
    : normalizedRoute;
};
