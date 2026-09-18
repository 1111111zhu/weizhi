import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { SHOWROOM_BASE_PATH } from "@/constants/routes";
import { SITE } from "@/constants/site";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const absoluteUrl = (path: string) => {
  if (/^https?:\/\//u.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const route =
    SHOWROOM_BASE_PATH &&
    (normalizedPath === SHOWROOM_BASE_PATH ||
      normalizedPath.startsWith(`${SHOWROOM_BASE_PATH}/`))
      ? normalizedPath.slice(SHOWROOM_BASE_PATH.length) || "/"
      : normalizedPath;
  return `${SITE.URL}${route}`;
};

export const registryItemUrl = (name: string) =>
  `${SITE.REGISTRY_ITEMS}/${name}.json`;

export const formatLabelFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
