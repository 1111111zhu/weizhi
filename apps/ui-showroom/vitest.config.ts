import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  oxc: { jsx: { importSource: "react", runtime: "automatic" } },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/.next*/**", ".source/**"],
  },
});
