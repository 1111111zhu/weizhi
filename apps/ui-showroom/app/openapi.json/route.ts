import { buildOpenApiDocument } from "@/lib/agent-discovery/openapi-document";
import { requestPublicBaseUrl } from "@/lib/agent-discovery/request-origin";

export const GET = (request: Request) => {
  const baseUrl = requestPublicBaseUrl(request);
  const doc = buildOpenApiDocument(baseUrl);

  return Response.json(doc, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
};
