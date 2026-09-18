import { describe, expect, it } from "vitest";

import { resolveProjectWingIntranetUrl } from "./index";

describe("project Wing portal URLs", () => {
  it("keeps deployed portal navigation inside the active cookie domain", () => {
    expect(resolveProjectWingIntranetUrl({ hostname: "cmp.wzcpa.hk" })).toBe(
      "https://intranet.wzcpa.hk/"
    );
    expect(resolveProjectWingIntranetUrl({ hostname: "tms.superfx.cn" })).toBe(
      "https://intranet.superfx.cn/"
    );
  });

  it("keeps local navigation on the local Intranet server", () => {
    expect(resolveProjectWingIntranetUrl({ hostname: "127.0.0.1" })).toBe(
      "http://localhost:3007/"
    );
  });

  it("uses the local Intranet server when SSR has no deployment context", () => {
    expect(resolveProjectWingIntranetUrl()).toBe("http://localhost:3007/");
  });

  it("uses the deployment suffix during SSR", () => {
    expect(resolveProjectWingIntranetUrl({ domainSuffix: "wzcpa.hk" })).toBe(
      "https://intranet.wzcpa.hk/"
    );
    expect(resolveProjectWingIntranetUrl({ domainSuffix: "superfx.cn" })).toBe(
      "https://intranet.superfx.cn/"
    );
  });
});
