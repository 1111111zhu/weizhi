import path from "node:path";

import type { NextConfig } from "next";

const tracingRoot =
  process.env.NEXT_TURBO_ROOT ?? path.resolve(process.cwd(), "../..");
const forceWebpack = process.env.NEXT_FORCE_WEBPACK === "1";
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.2.2"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: !forceWebpack,
  env: {
    NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  },
  output: "standalone",
  outputFileTracingRoot: tracingRoot,
  experimental: {
    useTypeScriptCli: true,
    ...(forceWebpack ? {} : { turbopackRustReactCompiler: true }),
  },
  typescript: {
    tsconfigPath: "tsconfig.next.json",
  },
  redirects() {
    return Promise.resolve([
      {
        source: "/:locale/tasks",
        destination: "/:locale/dashboard",
        permanent: false,
      },
    ]);
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    root: tracingRoot,
    resolveAlias: {
      "./cmp-aml.js": "../../packages/shared/src/cmp-aml.ts",
      "./cmp-hong-kong-holidays.js":
        "../../packages/shared/src/cmp-hong-kong-holidays.ts",
      "./confirmation-information-library.js":
        "../../packages/shared/src/confirmation-information-library.ts",
      "./confirmation-template-design.js":
        "../../packages/shared/src/confirmation-template-design.ts",
      "./cmp-entity-graph.js": "../../packages/shared/src/cmp-entity-graph.ts",
      "./cmp-ownership-inference.js":
        "../../packages/shared/src/cmp-ownership-inference.ts",
      "./auth-client-error.js":
        "../../packages/shared/src/auth-client-error.ts",
      "./auth-client-errors.js":
        "../../packages/shared/src/auth-client-errors.ts",
      "./desktop.js": "../../packages/shared/src/desktop.ts",
      "./auth-navigation.js": "../../packages/shared/src/auth-navigation.ts",
      "./email-otp-client-error.js":
        "../../packages/shared/src/email-otp-client-error.ts",
      "./login-form.js": "../../packages/shared/src/login-form.ts",
      "./smart-form-v2.js": "../../packages/shared/src/smart-form-v2.ts",
      "./smart-form-v2-compiler.js":
        "../../packages/shared/src/smart-form-v2-compiler.ts",
      "./smart-form-v2-compile-error.js":
        "../../packages/shared/src/smart-form-v2-compile-error.ts",
      "./smart-form-v2-components.js":
        "../../packages/shared/src/smart-form-v2-components.ts",
      "./smart-form-v2-fixtures.js":
        "../../packages/shared/src/smart-form-v2-fixtures.ts",
      "./smart-form-v2-validation.js":
        "../../packages/shared/src/smart-form-v2-validation.ts",
    },
  },
  transpilePackages: ["@project-wing/shared", "@project-wing/ui"],
};

export default nextConfig;
