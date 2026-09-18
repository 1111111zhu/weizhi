// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../views/workspace", () => ({
  WorkspacePage: () => <div data-testid="workspace-content" />,
}));

import Page, { instant } from "./page";

describe("engagement project route", () => {
  it("keeps the project workspace behind its loading boundary", () => {
    const html = renderToString(
      <Page params={Promise.resolve({ projectId: "project-1" })} />
    );

    expect(html).toContain("engagement-route-fallback");
  });

  it("does not claim instant validation for the client-data workspace", () => {
    expect(instant).toBe(false);
  });
});
