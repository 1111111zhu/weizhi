import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import {
  clearDocumentSearchHighlight,
  highlightDocumentSearchText,
} from "./document-text-highlight";

const HIGHLIGHT_STYLE_ID = "project-document-search-highlight-style";

describe("document text highlight", () => {
  afterEach(() => {
    clearDocumentSearchHighlight();
    document.querySelector(`#${HIGHLIGHT_STYLE_ID}`)?.remove();
    document.body.replaceChildren();
  });

  it("installs the highlight style at runtime and registers the range", () => {
    const set = vi.fn();
    Object.defineProperty(CSS, "highlights", {
      configurable: true,
      value: { delete: vi.fn(), set },
    });
    Object.defineProperty(window, "Highlight", {
      configurable: true,
      value: class TestHighlight {
        readonly range: Range;

        constructor(range: Range) {
          this.range = range;
        }
      },
    });
    const element = document.createElement("p");
    element.textContent = "Project Wing";
    document.body.append(element);

    highlightDocumentSearchText(element, 0, 7);

    expect(set).toHaveBeenCalledWith(
      "project-document-search",
      expect.anything()
    );
  });
});
