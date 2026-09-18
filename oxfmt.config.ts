import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

const tailwindV4Stylesheets = [
  ["apps/cmp/**/*.{js,jsx,ts,tsx}", "./apps/cmp/src/app/styles.css"],
  ["apps/emp/**/*.{js,jsx,ts,tsx}", "./apps/emp/src/styles.css"],
  ["apps/intranet/**/*.{js,jsx,ts,tsx}", "./apps/intranet/src/app/styles.css"],
  ["apps/tms/**/*.{js,jsx,ts,tsx}", "./apps/tms/src/styles.css"],
  [
    "apps/ui-showroom/**/*.{js,jsx,ts,tsx}",
    "./apps/ui-showroom/styles/globals.css",
  ],
] as const;

export default defineConfig({
  ...ultracite,
  overrides: tailwindV4Stylesheets.map(([files, stylesheet]) => ({
    files: [files],
    options: {
      sortTailwindcss: {
        stylesheet,
      },
    },
  })),
  sortTailwindcss: true,
});
