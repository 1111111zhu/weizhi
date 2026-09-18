import type { MetadataRoute } from "next";

import { ROUTES, withShowroomBasePath } from "@/constants/routes";
import { SITE, META_THEME_COLORS } from "@/constants/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: META_THEME_COLORS.light,
    description: SITE.DESCRIPTION.LONG,
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: withShowroomBasePath("/android-chrome-192x192.png"),
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: withShowroomBasePath("/android-chrome-512x512.png"),
        type: "image/png",
      },
    ],
    name: SITE.NAME,
    short_name: SITE.NAME,
    start_url: withShowroomBasePath(ROUTES.HOME),
    theme_color: META_THEME_COLORS.light,
  };
}
