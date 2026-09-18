export type ExternalRequestContext = {
  protocol: string;
  host: string;
  pathPrefix?: string;
};

type RequestLike = {
  protocol?: string;
  get?: (name: string) => string | undefined;
  header?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

export function externalRequestContextFromRequest(
  request?: RequestLike | null,
  fallbackHost = "localhost:3000"
): ExternalRequestContext {
  const protocol =
    normalizeProtocol(
      firstHeaderValue(readHeader(request, "x-forwarded-proto"))
    ) ??
    normalizeProtocol(request?.protocol) ??
    "http";
  const host =
    normalizeHost(firstHeaderValue(readHeader(request, "x-forwarded-host"))) ??
    normalizeHost(readHeader(request, "host")) ??
    fallbackHost;
  const pathPrefix = normalizePathPrefix(
    firstHeaderValue(readHeader(request, "x-forwarded-prefix"))
  );

  return { protocol, host, ...(pathPrefix ? { pathPrefix } : {}) };
}

function readHeader(request: RequestLike | null | undefined, name: string) {
  const lowerName = name.toLowerCase();
  const getterValue = request?.get?.(name) ?? request?.get?.(lowerName);
  if (getterValue) {
    return getterValue;
  }
  const headerValue = request?.header?.(name) ?? request?.header?.(lowerName);
  if (headerValue) {
    return headerValue;
  }
  const raw = request?.headers?.[lowerName];
  return Array.isArray(raw) ? raw[0] : raw;
}

function firstHeaderValue(value: string | undefined) {
  return value?.split(",")[0]?.trim();
}

function normalizeProtocol(value: string | undefined) {
  const normalized = value?.trim().replace(/:$/, "").toLowerCase();
  return normalized === "http" || normalized === "https"
    ? normalized
    : undefined;
}

function normalizeHost(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizePathPrefix(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return;
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}
