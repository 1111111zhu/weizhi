import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ROUTES, withoutShowroomBasePath } from "@/constants/routes";
import { docsContentRoute, homeContentRoute } from "@/lib/docs";

const { rewrite: rewriteDocs } = rewritePath(
  `${ROUTES.DOCS}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${ROUTES.DOCS}{/*path}.md`,
  `${docsContentRoute}{/*path}/content.md`
);

const rewriteResponse = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url);
};

const proxy = (request: NextRequest) => {
  const pathname = withoutShowroomBasePath(request.nextUrl.pathname);
  if (
    pathname === ROUTES.HOME &&
    (request.method === "GET" || request.method === "HEAD") &&
    isMarkdownPreferred(request)
  ) {
    return rewriteResponse(request, homeContentRoute);
  }

  const result = rewriteSuffix(pathname);
  if (result) {
    return rewriteResponse(request, result);
  }

  if (isMarkdownPreferred(request)) {
    const result2 = rewriteDocs(pathname);

    if (result2) {
      return rewriteResponse(request, result2);
    }
  }

  return NextResponse.next();
};

export default proxy;
