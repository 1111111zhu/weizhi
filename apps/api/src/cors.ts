const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3007",
  "http://localhost:5173",
];
const LOCALHOST_ORIGIN_PATTERN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

function parseOrigins(value?: string | null) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

export function resolveCorsOrigins(
  frontendUrl?: string | null,
  frontendUrls?: string | null
) {
  return [
    ...new Set([
      ...parseOrigins(frontendUrl),
      ...parseOrigins(frontendUrls),
      ...DEFAULT_CORS_ORIGINS,
    ]),
  ];
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
  projectWingEnvironment?: string | null
) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return (
    projectWingEnvironment !== "production" &&
    LOCALHOST_ORIGIN_PATTERN.test(origin)
  );
}
