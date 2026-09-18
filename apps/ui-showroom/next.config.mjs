import path from "node:path";

import { createMDX } from "fumadocs-mdx/next";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const { LINK } = await jiti.import("./constants/links");
const { ROUTES } = await jiti.import("./constants/routes");
const tracingRoot = path.resolve(process.cwd(), "../..");
const basePath = process.env.NEXT_PUBLIC_SHOWROOM_BASE_PATH ?? "";
const publicRoute = (route) => `${basePath}${route}` || "/";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Android Emulator's host-loopback alias; development resources only.
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.2.2"],
  basePath,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  headers() {
    const link = [
      `<${publicRoute(ROUTES.API_CATALOG)}>; rel="api-catalog"`,
      `<${publicRoute(ROUTES.OPENAPI)}>; rel="service-desc"`,
      `<${publicRoute(ROUTES.DOCS)}>; rel="service-doc"`,
      `<${LINK.SHADCN_MCP_DOCS}>; rel="service-doc"; title="shadcn MCP server"`,
      `<${publicRoute(ROUTES.AGENT_SKILLS_INDEX)}>; rel="describedby"`,
    ].join(", ");

    return [{ headers: [{ key: "Link", value: link }], source: ROUTES.HOME }];
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatars.githubusercontent.com",
        protocol: "https",
      },
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  output: "standalone",
  outputFileTracingRoot: tracingRoot,
  outputFileTracingIncludes: {
    "/*": [
      "./registry/**/*",
      "../../docs/ui-provenance.generated.json",
      "../emp/public/pdfjs/standard_fonts/LiberationSans-*.ttf",
    ],
  },
  redirects() {
    return [
      {
        destination: `${ROUTES.DOCS}.md`,
        permanent: true,
        source: `${ROUTES.DOCS}.mdx`,
      },
      {
        destination: `${ROUTES.DOCS}/:path*.md`,
        permanent: true,
        source: `${ROUTES.DOCS}/:path*.mdx`,
      },
    ];
  },
  transpilePackages: [
    "@project-wing/document-viewer",
    "@project-wing/pdf-template-designer",
    "@project-wing/ui",
  ],
  turbopack: {
    root: tracingRoot,
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
