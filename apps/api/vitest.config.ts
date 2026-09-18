import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const defaultMaxWorkers = 2;
const defaultTestTimeoutMs = 5000;

export default defineConfig({
  resolve: {
    alias: {
      "@project-wing/shared": fileURLToPath(
        new URL("../../packages/shared/src", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.spec.ts"],
    setupFiles: ["vitest.setup.ts"],
    maxWorkers: Math.trunc(
      Number(
        process.env.PROJECTWING_VITEST_MAX_WORKERS ?? `${defaultMaxWorkers}`
      )
    ),
    testTimeout: Math.trunc(
      Number(
        process.env.PROJECTWING_VITEST_TIMEOUT_MS ?? `${defaultTestTimeoutMs}`
      )
    ),
  },
});
