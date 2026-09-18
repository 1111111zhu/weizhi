export type AuditLogSource = {
  ipAddress?: string;
  userAgent?: string;
};

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
  header?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

export function auditLogSourceFromRequest(
  request?: RequestLike | null
): AuditLogSource {
  const ipAddress =
    normalizeIp(readHeader(request, "x-forwarded-for")) ??
    normalizeIp(readHeader(request, "x-real-ip")) ??
    normalizeIp(request?.ip) ??
    normalizeIp(request?.socket?.remoteAddress);
  const userAgent = normalizeHeader(readHeader(request, "user-agent"));

  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

function readHeader(request: RequestLike | null | undefined, name: string) {
  const value = request?.header?.(name);
  if (value) {
    return value;
  }
  const header = request?.headers?.[name.toLowerCase()];
  return Array.isArray(header) ? header[0] : header;
}

function normalizeIp(value: string | undefined) {
  const first = normalizeHeader(value)?.split(",")[0]?.trim();
  if (!first) {
    return;
  }
  return first.startsWith("::ffff:") ? first.slice(7) : first;
}

function normalizeHeader(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
