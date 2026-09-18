import type { ProjectWingAuthRuntimeConfig } from "./better-auth-options";

const MINIMUM_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET = /replace-with|change.?me|example|your[-_ ]?secret/i;
const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3007",
];

type AuthEnvironment = Record<string, string | undefined>;

export function resolveProjectWingAuthRuntimeConfig(
  environment: AuthEnvironment = process.env
): ProjectWingAuthRuntimeConfig {
  const secret = requireSecret(environment.BETTER_AUTH_SECRET);
  const baseURL = normalizeBaseURL(environment.BETTER_AUTH_URL);
  const trustedOrigins = resolveTrustedOrigins(environment, baseURL);
  const cookieDomain =
    environment.BETTER_AUTH_COOKIE_DOMAIN?.trim() || undefined;

  return {
    baseURL,
    cookieDomain,
    environment:
      environment.PROJECTWING_ENVIRONMENT === "development"
        ? "development"
        : "restricted",
    secret,
    trustedOrigins,
    useSecureCookies: baseURL.startsWith("https://"),
  };
}

function requireSecret(secret: string | undefined) {
  if (
    !secret ||
    secret.length < MINIMUM_SECRET_LENGTH ||
    PLACEHOLDER_SECRET.test(secret)
  ) {
    throw new Error(
      "BETTER_AUTH_SECRET must be a non-placeholder value of at least 32 characters"
    );
  }
  return secret;
}

function normalizeBaseURL(value: string | undefined) {
  if (!value) {
    throw new Error("BETTER_AUTH_URL must be configured");
  }
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute URL");
  }
}

function resolveTrustedOrigins(environment: AuthEnvironment, baseURL: string) {
  const configuredOrigins =
    environment.BETTER_AUTH_TRUSTED_ORIGINS ??
    environment.FRONTEND_URLS ??
    environment.FRONTEND_URL;
  const origins = configuredOrigins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const resolvedOrigins = origins?.length ? origins : [baseURL];

  if (
    environment.PROJECTWING_ENVIRONMENT === "development" &&
    new URL(baseURL).hostname === "localhost"
  ) {
    return [...new Set([...resolvedOrigins, ...LOCAL_DEVELOPMENT_ORIGINS])];
  }

  return resolvedOrigins;
}
