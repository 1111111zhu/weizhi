import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
      "@project-wing/shared": fileURLToPath(
        new URL("../../packages/shared/src", import.meta.url)
      ),
      "@project-wing/ui": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url)
      ),
    },
  },
  oxc: {
    jsx: {
      importSource: "react",
      runtime: "automatic",
    },
  },
});
