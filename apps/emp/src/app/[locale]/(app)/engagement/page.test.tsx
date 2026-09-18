// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const suspended = new Promise<never>(() => {});

vi.mock("../../../../views/projects", () => ({
  ProjectsPage: () => {
    throw suspended;
  },
}));

import Page, { instant } from "./page";

describe("engagement list route", () => {
  it("keeps the project list behind a loading boundary", () => {
    const html = renderToString(<Page />);

    expect(html).toContain("engagement-list-route-fallback");
  });

  it("does not claim instant validation for the client-data list", () => {
    expect(instant).toBe(false);
  });
});
