import { LINK } from "@/constants/links";
import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { requestPublicBaseUrl } from "@/lib/agent-discovery/request-origin";
import { homeContentRoute } from "@/lib/docs";

const PROFILE = "https://www.rfc-editor.org/info/rfc9727";

const catalogLinkset = (origin: string) => {
  const base = origin.replace(/\/$/, "");

  return {
    linkset: [
      {
        anchor: `${base}/`,
        "api-catalog": [
          {
            href: `${base}${ROUTES.API_CATALOG}`,
            type: `application/linkset+json; profile="${PROFILE}"`,
          },
        ],
        describedby: [
          {
            href: `${base}${ROUTES.AGENT_SKILLS_INDEX}`,
            type: "application/json",
          },
          {
            href: `${base}${ROUTES.AGENT_SKILLS_SITE_SKILL}`,
            type: "text/markdown",
          },
        ],
        "service-desc": [
          { href: `${base}${ROUTES.OPENAPI}`, type: "application/json" },
        ],
        "service-doc": [
          { href: `${base}${ROUTES.DOCS}`, type: "text/html" },
          { href: `${base}${ROUTES.LLMS}`, type: "text/plain" },
          { href: `${base}${ROUTES.LLMS_FULL}`, type: "text/plain" },
          { href: `${base}${homeContentRoute}`, type: "text/markdown" },
          { href: LINK.SHADCN_MCP_DOCS, type: "text/html" },
        ],
        status: [
          { href: `${base}${ROUTES.API_STATUS}`, type: "application/json" },
        ],
      },
      {
        anchor: `${base}${ROUTES.REGISTRY}`,
        "service-desc": [
          { href: `${base}${ROUTES.OPENAPI}`, type: "application/json" },
        ],
        "service-doc": [{ href: `${base}${ROUTES.DOCS}`, type: "text/html" }],
        status: [
          { href: `${base}${ROUTES.API_STATUS}`, type: "application/json" },
        ],
      },
    ],
  };
};

export const GET = (request: Request) => {
  const baseUrl = requestPublicBaseUrl(request);
  const body = JSON.stringify(catalogLinkset(baseUrl));

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": `application/linkset+json; profile="${PROFILE}"`,
    },
  });
};

export const HEAD = () => {
  const profile = `application/linkset+json; profile="${PROFILE}"`;

  return new Response(null, {
    headers: {
      "Content-Type": profile,
      Link: `<${withShowroomBasePath(ROUTES.API_CATALOG)}>; rel="api-catalog"`,
    },
  });
};
