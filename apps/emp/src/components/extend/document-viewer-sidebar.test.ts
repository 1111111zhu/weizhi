// @vitest-environment jsdom

import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import {
  DocumentViewerThumbnailSidebar,
  getDocumentViewerContentWidth,
  getDocumentViewerHorizontalPadding,
} from "./document-viewer-sidebar";

describe("document viewer responsive sizing", () => {
  it("scales margins with the preview pane and caps them", () => {
    expect(getDocumentViewerHorizontalPadding(200)).toBe(8);
    expect(getDocumentViewerHorizontalPadding(600)).toBe(18);
    expect(getDocumentViewerHorizontalPadding(2000)).toBe(32);
  });

  it("subtracts an inline thumbnail sidebar and responsive margins", () => {
    expect(
      getDocumentViewerContentWidth({
        shellWidth: 1000,
        sidebarInline: true,
        sidebarVisible: true,
        sidebarWidth: 160,
      })
    ).toBeCloseTo(789.6);
  });

  it("uses a distinct muted surface and edge shadow without leaving either behind when closed", () => {
    const { container, rerender } = render(
      React.createElement(
        DocumentViewerThumbnailSidebar,
        { inline: true, open: true },
        React.createElement("span", null, "Page 1")
      )
    );

    expect(
      container.querySelector("[data-document-thumbnail-sidebar]")
    ).toHaveClass("border-border/60", "bg-muted/55", "shadow-md", "z-20");

    rerender(
      React.createElement(
        DocumentViewerThumbnailSidebar,
        { inline: true, open: false },
        React.createElement("span", null, "Page 1")
      )
    );

    expect(
      container.querySelector("[data-document-thumbnail-sidebar]")
    ).toHaveClass("border-r-0", "shadow-none");
  });
});
