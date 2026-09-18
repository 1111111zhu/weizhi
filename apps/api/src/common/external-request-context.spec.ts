import { externalRequestContextFromRequest } from "./external-request-context";

describe(externalRequestContextFromRequest, () => {
  it("uses forwarded proto with the public host behind a TLS proxy", () => {
    const context = externalRequestContextFromRequest({
      protocol: "http",
      get: (name: string) =>
        ({
          host: "wing.superfx.cn",
          "x-forwarded-proto": "https",
          "x-forwarded-prefix": "/api",
        })[name.toLowerCase()],
    });

    expect(context).toStrictEqual({
      protocol: "https",
      host: "wing.superfx.cn",
      pathPrefix: "/api",
    });
  });

  it("uses the first forwarded value when proxies append a chain", () => {
    const context = externalRequestContextFromRequest({
      protocol: "http",
      headers: {
        host: "internal:3000",
        "x-forwarded-host": "wing.superfx.cn, proxy.internal",
        "x-forwarded-proto": "https, http",
        "x-forwarded-prefix": "api, /ignored",
      },
    });

    expect(context).toStrictEqual({
      protocol: "https",
      host: "wing.superfx.cn",
      pathPrefix: "/api",
    });
  });

  it("falls back to the direct request fields for local development", () => {
    const context = externalRequestContextFromRequest({
      protocol: "http",
      get: (name: string) => ({ host: "localhost:3000" })[name.toLowerCase()],
    });

    expect(context).toStrictEqual({
      protocol: "http",
      host: "localhost:3000",
    });
  });
});
