import { resolveProjectWingIntranetUrl } from "@project-wing/shared";

export function getIntranetPortalUrl() {
  const hostname =
    typeof window === "undefined" ? undefined : window.location.hostname;
  return resolveTmsApplicationUrl(
    process.env.NEXT_PUBLIC_INTRANET_URL,
    resolveProjectWingIntranetUrl({
      hostname: hostname === "10.0.2.2" ? "localhost" : hostname,
      domainSuffix: process.env.NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX,
    }),
    hostname
  );
}

export function getEmpApplicationUrl() {
  const hostname =
    typeof window === "undefined" ? "localhost" : window.location.hostname;
  const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(hostname);
  const fallback = local
    ? "http://localhost:3001/"
    : `https://emp.${hostname.split(".").slice(1).join(".")}/`;
  return resolveTmsApplicationUrl(
    process.env.NEXT_PUBLIC_EMP_URL,
    fallback,
    hostname
  );
}

export function resolveTmsApplicationUrl(
  configured: string | undefined,
  fallback: string,
  hostname?: string
) {
  let url: URL;
  try {
    url = new URL(configured || fallback);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
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
