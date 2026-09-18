// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const suspended = new Promise<never>(() => {});

vi.mock("../../../../views/confirmations", () => ({
  ConfirmationsPage: () => {
    throw suspended;
  },
}));

import Page, { instant } from "./page";

describe("confirmations route", () => {
  it("keeps the client page inside a suspense boundary for instant navigation", () => {
    const html = renderToString(<Page />);

    expect(html).toContain("confirmations-route-fallback");
  });

  it("does not claim instant validation for this client-data route", () => {
    expect(instant).toBe(false);
  });
});
