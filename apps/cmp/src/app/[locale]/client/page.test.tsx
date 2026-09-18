// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const suspended = new Promise<never>(() => {});

vi.mock("../clients/page-client", () => ({
  CmpClientsClient: () => {
    throw suspended;
  },
}));

import Page, { instant } from "./page";

describe("CMP client route", () => {
  it("keeps the client list behind a loading boundary", () => {
    const html = renderToString(<Page />);

    expect(html).toContain("cmp-client-route-fallback");
  });

  it("does not claim instant validation for the client-data list", () => {
    expect(instant).toBe(false);
  });
});
