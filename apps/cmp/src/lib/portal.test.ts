import { describe, expect, it } from "vitest";

import { resolveCmpIntranetUrl } from "./portal";

describe("CMP portal navigation", () => {
  it("retains an explicit local application port", () => {
    expect(
      resolveCmpIntranetUrl("127.0.0.1", "http://127.0.0.1:3057/zh-CN")
    ).toBe("http://127.0.0.1:3057/zh-CN");
  });

  it("maps loopback URLs to the Android host alias", () => {
    expect(resolveCmpIntranetUrl("10.0.2.2", "http://127.0.0.1:3057/")).toBe(
      "http://10.0.2.2:3057/"
    );
  });

  it("preserves production fallbacks and rejects non-web overrides", () => {
    expect(resolveCmpIntranetUrl("cmp.wzcpa.hk")).toBe(
      "https://intranet.wzcpa.hk/"
    );
    expect(resolveCmpIntranetUrl("localhost", "file:///not-an-app")).toBe(
      "http://localhost:3007/"
    );
  });
});
