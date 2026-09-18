import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    execArgv: ["--disable-warning=ExperimentalWarning"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
