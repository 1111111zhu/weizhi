import { resolveProjectWingIntranetUrl } from "@project-wing/shared";

export function getIntranetPortalUrl() {
  return resolveCmpIntranetUrl(
    typeof window === "undefined" ? undefined : window.location.hostname,
    process.env.NEXT_PUBLIC_INTRANET_URL
  );
}

export function resolveCmpIntranetUrl(hostname?: string, configured?: string) {
  const fallback = resolveProjectWingIntranetUrl({
    hostname: hostname === "10.0.2.2" ? "localhost" : hostname,
    domainSuffix: process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX,
  });
  let url: URL;
  try {
    url = new URL(configured || fallback);
    if (!["http:", "https:"].includes(url.protocol)) {
      url = new URL(fallback);
    }
  } catch {
    url = new URL(fallback);
  }
  if (
    hostname === "10.0.2.2" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    url.hostname = hostname;
  }
  return url.toString();
}
