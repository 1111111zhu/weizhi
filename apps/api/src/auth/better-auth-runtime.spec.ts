import { resolveProjectWingAuthRuntimeConfig } from "./better-auth-runtime";

describe(resolveProjectWingAuthRuntimeConfig, () => {
  it("requires a non-placeholder secret", () => {
    expect(() =>
      resolveProjectWingAuthRuntimeConfig({
        BETTER_AUTH_URL: "https://auth.superfx.cn",
        BETTER_AUTH_SECRET: "replace-with-a-long-random-secret",
      })
    ).toThrow("BETTER_AUTH_SECRET");
  });

  it("builds a secure cross-subdomain configuration from explicit settings", () => {
    expect(
      resolveProjectWingAuthRuntimeConfig({
        BETTER_AUTH_URL: "https://auth.superfx.cn/",
        BETTER_AUTH_SECRET:
          "a-secure-secret-with-at-least-thirty-two-characters",
        BETTER_AUTH_COOKIE_DOMAIN: ".superfx.cn",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://emp.superfx.cn, https://cmp.superfx.cn",
      })
    ).toStrictEqual({
      baseURL: "https://auth.superfx.cn",
      cookieDomain: ".superfx.cn",
      environment: "restricted",
      secret: "a-secure-secret-with-at-least-thirty-two-characters",
      trustedOrigins: ["https://emp.superfx.cn", "https://cmp.superfx.cn"],
      useSecureCookies: true,
    });
  });

  it("trusts local ProjectWing applications during local development", () => {
    expect(
      resolveProjectWingAuthRuntimeConfig({
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET:
          "a-secure-secret-with-at-least-thirty-two-characters",
        FRONTEND_URL: "http://localhost:3001",
        PROJECTWING_ENVIRONMENT: "development",
      }).trustedOrigins
    ).toStrictEqual([
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3005",
      "http://localhost:3007",
    ]);
  });

  it("requires an explicit development environment", () => {
    const baseEnvironment = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-secure-secret-with-at-least-thirty-two-characters",
    };

    expect(
      resolveProjectWingAuthRuntimeConfig({
        ...baseEnvironment,
        PROJECTWING_ENVIRONMENT: "development",
      }).environment
    ).toBe("development");
    expect(
      resolveProjectWingAuthRuntimeConfig(baseEnvironment).environment
    ).toBe("restricted");
  });
});
