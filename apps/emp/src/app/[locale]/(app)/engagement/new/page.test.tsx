import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("../../../../../views/new-project", () => ({
  NewProjectPage: ({ folderId }: { folderId?: string }) => (
    <span data-folder-id={folderId ?? "default"}>New project</span>
  ),
}));

describe("new project route", () => {
  it("passes the requested desktop folder into a fresh project form", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          attempt: "new-attempt",
          folderId: "folder-client",
        }),
      })
    );
    expect(markup).toContain('data-folder-id="folder-client"');
  });

  it("uses the first folder when a repeated query parameter is supplied", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ folderId: ["folder-a", "folder-b"] }),
      })
    );
    expect(markup).toContain('data-folder-id="folder-a"');
  });
});
