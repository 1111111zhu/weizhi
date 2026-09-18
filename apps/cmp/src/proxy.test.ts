import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

describe("cMP route canonicalization", () => {
  it.each([
    ["/en-US/clients", "/en-US/client"],
    ["/zh-CN/clients/client-1/edit", "/zh-CN/client/client-1/edit"],
    ["/en-US/engagements", "/en-US/engagement"],
    [
      "/en-US/engagements/new?clientId=client-1",
      "/en-US/engagement/new?clientId=client-1",
    ],
  ])("redirects %s to %s", (source, destination) => {
    const response = proxy(new NextRequest(`http://localhost${source}`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `http://localhost${destination}`
    );
  });

  it("localizes and canonicalizes a legacy route in one redirect", () => {
    const response = proxy(
      new NextRequest("http://localhost/engagements", {
        headers: { "accept-language": "en-US" },
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/en-US/engagement"
    );
  });

  it("leaves canonical localized routes in place", () => {
    const response = proxy(
      new NextRequest("http://localhost/en-US/engagement")
    );

    expect(response.headers.get("location")).toBeNull();
  });
});
