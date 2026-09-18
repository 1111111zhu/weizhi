import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import {
  findTextAnchorRect,
  getDocxFieldSourceCoverGeometry,
  resolveDocxFieldGeometry,
} from "./project-confirmation-docx-fields";

function rect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe(resolveDocxFieldGeometry, () => {
  afterEach(() => vi.restoreAllMocks());

  it("expands a source field by a small cover padding without moving its content box", () => {
    expect(
      getDocxFieldSourceCoverGeometry({
        height: 20,
        left: 100,
        top: 50,
        width: 160,
      })
    ).toStrictEqual({
      height: 24,
      left: 98,
      top: 48,
      width: 164,
    });
  });

  it("maps a rendered table cell to page-wrapper coordinates at the current scale", () => {
    const pageElement = document.createElement("div");
    const cell = document.createElement("div");

    cell.dataset.docxTableCell = "true";
    cell.dataset.docxTableIndex = "6";
    cell.dataset.docxRowIndex = "2";
    cell.dataset.docxCellIndex = "3";
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      value: () => rect(100, 50, 1000, 1400),
    });
    Object.defineProperty(cell, "getBoundingClientRect", {
      value: () => rect(300, 250, 200, 40),
    });
    pageElement.append(cell);

    expect(
      resolveDocxFieldGeometry(
        pageElement,
        {
          cellIndex: 3,
          kind: "table-cell",
          rowIndex: 2,
          tableIndex: 6,
        },
        2
      )
    ).toStrictEqual({
      height: 20,
      left: 100,
      top: 100,
      width: 100,
    });
  });

  it("uses the matching text range inside a rendered table paragraph", () => {
    const pageElement = document.createElement("div");
    const paragraph = document.createElement("div");

    paragraph.dataset.docxParagraphKind = "table-cell";
    paragraph.dataset.docxTableIndex = "14";
    paragraph.dataset.docxRowIndex = "6";
    paragraph.dataset.docxCellIndex = "0";
    paragraph.dataset.docxParagraphIndex = "0";
    paragraph.append(
      "Please use account number ",
      document.createTextNode("____"),
      "."
    );
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      value: () => rect(100, 50, 1000, 1400),
    });
    pageElement.append(paragraph);

    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      rect(340, 290, 80, 20),
    ] as unknown as DOMRectList);

    expect(
      resolveDocxFieldGeometry(
        pageElement,
        {
          after: "account number ",
          before: ".",
          cellIndex: 0,
          kind: "table-text",
          paragraphIndex: 0,
          rowIndex: 6,
          tableIndex: 14,
        },
        2
      )
    ).toStrictEqual({
      height: 10,
      left: 120,
      top: 120,
      width: 40,
    });
  });

  it("does not use the whole paragraph for a before-only field after a label", () => {
    const pageElement = document.createElement("div");
    const paragraph = document.createElement("div");
    const prefix = document.createTextNode("To the auditor: ");
    const field = document.createTextNode("____________");
    const suffix = document.createTextNode(",");

    paragraph.dataset.docxParagraphKind = "table-cell";
    paragraph.dataset.docxTableIndex = "15";
    paragraph.dataset.docxRowIndex = "4";
    paragraph.dataset.docxCellIndex = "0";
    paragraph.dataset.docxParagraphIndex = "1";
    paragraph.append(prefix, field, suffix);
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      value: () => rect(100, 50, 1000, 1400),
    });
    pageElement.append(paragraph);

    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      rect(340, 290, 80, 20),
    ] as unknown as DOMRectList);
    const setStart = vi.spyOn(Range.prototype, "setStart");
    const setEnd = vi.spyOn(Range.prototype, "setEnd");

    resolveDocxFieldGeometry(
      pageElement,
      {
        before: ",",
        cellIndex: 0,
        kind: "table-text",
        paragraphIndex: 1,
        rowIndex: 4,
        tableIndex: 15,
      },
      2
    );

    expect(setStart).toHaveBeenCalledWith(prefix, "To the auditor:".length);
    expect(setEnd).toHaveBeenCalledWith(field, field.length);
  });

  it("maps a top-level rendered paragraph by its stable document node index", () => {
    const pageElement = document.createElement("div");
    const paragraph = document.createElement("div");

    paragraph.dataset.docxParagraphKind = "paragraph";
    paragraph.dataset.docxParagraphNodeIndex = "12";
    Object.defineProperty(pageElement, "getBoundingClientRect", {
      value: () => rect(100, 50, 1000, 1400),
    });
    Object.defineProperty(paragraph, "getBoundingClientRect", {
      value: () => rect(220, 350, 600, 30),
    });
    pageElement.append(paragraph);

    expect(
      resolveDocxFieldGeometry(
        pageElement,
        { kind: "paragraph", nodeIndex: 12 },
        2
      )
    ).toStrictEqual({
      height: 15,
      left: 60,
      top: 150,
      width: 300,
    });
  });

  it("returns every occurrence of a rendered page text marker relative to the page surface", () => {
    const pageElement = document.createElement("div");
    const pageSurfaceElement = document.createElement("div");

    pageSurfaceElement.dataset.docxPageSurface = "true";
    pageSurfaceElement.append(
      document.createTextNode("[Recipient "),
      document.createTextNode("Name] and "),
      document.createTextNode("[Recipient Name]")
    );
    Object.defineProperty(pageSurfaceElement, "getBoundingClientRect", {
      value: () => rect(100, 50, 1000, 1400),
    });
    pageElement.append(pageSurfaceElement);

    vi.spyOn(Range.prototype, "getBoundingClientRect")
      .mockReturnValueOnce(rect(340, 290, 120, 20))
      .mockReturnValueOnce(rect(540, 390, 120, 20));

    expect(findTextAnchorRect(pageElement, "[Recipient Name]")).toStrictEqual([
      { height: 20, left: 240, top: 240, width: 120 },
      { height: 20, left: 440, top: 340, width: 120 },
    ]);
  });
});
