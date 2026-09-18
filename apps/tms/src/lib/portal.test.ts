import { describe, expect, it } from "vitest";

import { resolveTmsApplicationUrl } from "./portal";

describe("TMS application links", () => {
  it("keeps the configured local service port", () => {
    expect(
      resolveTmsApplicationUrl(
        "http://127.0.0.1:3057/",
        "http://localhost:3007/",
        "127.0.0.1"
      )
    ).toBe("http://127.0.0.1:3057/");
  });

  it("uses Android's host alias for a configured loopback service", () => {
    expect(
      resolveTmsApplicationUrl(
        "http://127.0.0.1:3048/",
        "http://localhost:3001/",
        "10.0.2.2"
      )
    ).toBe("http://10.0.2.2:3048/");
  });

  it("preserves production links and rejects non-http overrides", () => {
    expect(
      resolveTmsApplicationUrl(
        undefined,
        "https://intranet.wzcpa.hk/",
        "tms.wzcpa.hk"
      )
    ).toBe("https://intranet.wzcpa.hk/");
    expect(
      resolveTmsApplicationUrl(
        "file:///not-an-application",
        "https://intranet.wzcpa.hk/",
        "tms.wzcpa.hk"
      )
    ).toBe("https://intranet.wzcpa.hk/");
  });
});
