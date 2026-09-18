import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const desktopAgentBuildLabel =
  process.env.PROJECT_WING_DESKTOP_BUILD_LABEL ?? createBuildLabel();
const productionBuildOptions = {
  cssMinify: "esbuild" as const,
  minify: "esbuild" as const,
  sourcemap: false,
};

function createBuildLabel() {
  const version = process.env.PROJECT_WING_DESKTOP_VERSION;
  if (version) {
    return version;
  }
  const timestamp = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 14);
  return `dev-local.${timestamp}`;
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: productionBuildOptions,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      ...productionBuildOptions,
      rollupOptions: {
        external: ["electron"],
        output: {
          entryFileNames: "[name].js",
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    build: productionBuildOptions,
    define: {
      __PROJECT_WING_DESKTOP_BUILD_LABEL__: JSON.stringify(
        desktopAgentBuildLabel
      ),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve("src/renderer"),
      },
      dedupe: ["react", "react-dom"],
    },
  },
});
