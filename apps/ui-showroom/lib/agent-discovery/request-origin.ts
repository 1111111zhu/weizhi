import { SHOWROOM_BASE_PATH } from "@/constants/routes";

export const requestOrigin = (request: Request): string => {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const proto =
      forwardedProto ?? (url.protocol === "http:" ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }

  return url.origin;
};

export const requestPublicBaseUrl = (request: Request): string => {
  const origin = requestOrigin(request).replace(/\/+$/, "");
  return `${origin}${SHOWROOM_BASE_PATH}`;
};
