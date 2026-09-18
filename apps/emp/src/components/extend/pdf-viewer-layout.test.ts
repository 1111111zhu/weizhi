import { describe, expect, it } from "vitest";

import { snapFieldGeometry } from "../confirmations/confirmation-template-workbench";
import {
  isPdfViewerPageLayoutReady,
  pdfGeometryToTextBlocks,
  shouldApplyPdfViewerZoomPreference,
  shouldStartPdfViewerPan,
} from "./pdf-viewer";

describe(pdfGeometryToTextBlocks, () => {
  it("keeps each text line as an alignment target inside a multiline PDF object", () => {
    const blocks = pdfGeometryToTextBlocks(
      {
        runs: [
          {
            charStart: 0,
            rect: { x: 40, y: 100, width: 200, height: 132 },
            glyphs: [100, 140, 180, 220].flatMap((y) => [
              { x: 40, y, width: 10, height: 12, flags: 0 },
              { x: 50, y, width: 10, height: 12, flags: 0 },
            ]),
          },
        ],
      },
      800,
      1000
    );

    expect(blocks).toEqual(
      [100, 140, 180, 220].map((y) => ({
        x: 0.05,
        y: y / 1000,
        width: 0.025,
        height: 0.012,
      }))
    );
    for (const scale of [0.75, 1, 2]) {
      const snapped = snapFieldGeometry(
        { x: 0.4, y: 0.142, width: 0.15, height: 0.012 },
        blocks,
        "move",
        [],
        { x: 5 / (800 * scale), y: 5 / (1000 * scale) }
      );
      expect(snapped.y).toBeCloseTo(0.14);
      expect(snapped.guides.some((guide) => guide.axis === "horizontal")).toBe(
        true
      );
    }
  });

  it("ignores empty glyphs and keeps differently sized glyphs on their shared row", () => {
    const blocks = pdfGeometryToTextBlocks(
      {
        runs: [
          {
            charStart: 0,
            rect: { x: 0, y: 0, width: 80, height: 112 },
            glyphs: [
              { x: 0, y: 0, width: 80, height: 112, flags: 2 },
              { x: 40, y: 100, width: 10, height: 12, flags: 0 },
              { x: 50, y: 103, width: 8, height: 9, flags: 0 },
            ],
          },
        ],
      },
      800,
      1000
    );
    expect(blocks).toEqual([
      { x: 0.05, y: 0.1, width: 18 / 800, height: 0.012 },
    ]);
  });
});

describe(isPdfViewerPageLayoutReady, () => {
  it("requires a layout for the active document with at least one page", () => {
    expect(
      isPdfViewerPageLayoutReady("doc-1", {
        docId: "doc-1",
        layout: { items: [] },
      })
    ).toBeFalsy();
    expect(
      isPdfViewerPageLayoutReady("doc-1", {
        docId: "doc-2",
        layout: { items: [{ pageLayouts: [{}] }] },
      })
    ).toBeFalsy();
    expect(
      isPdfViewerPageLayoutReady("doc-1", {
        docId: "doc-1",
        layout: { items: [{ pageLayouts: [{}] }] },
      })
    ).toBeTruthy();
  });
});

describe(shouldStartPdfViewerPan, () => {
  it("starts primary-button panning without requiring precomputed overflow", () => {
    expect(
      shouldStartPdfViewerPan({
        button: 0,
        interactionMode: "pan",
        targetTagName: "CANVAS",
      })
    ).toBeTruthy();
    expect(
      shouldStartPdfViewerPan({
        button: 0,
        interactionMode: "select",
        targetTagName: "CANVAS",
      })
    ).toBeFalsy();
    expect(
      shouldStartPdfViewerPan({
        button: 0,
        interactionMode: "pan",
        targetTagName: "BUTTON",
      })
    ).toBeFalsy();
  });
});

describe(shouldApplyPdfViewerZoomPreference, () => {
  it("reapplies zoom when fit-width is toggled after the document loads", () => {
    const current = {
      autoFitWidth: false,
      defaultZoom: 1,
      documentId: "doc-1",
    };

    expect(
      shouldApplyPdfViewerZoomPreference(current, {
        ...current,
        autoFitWidth: true,
      })
    ).toBeTruthy();
    expect(shouldApplyPdfViewerZoomPreference(current, current)).toBeFalsy();
  });

  it("applies the preference again for a new document", () => {
    expect(
      shouldApplyPdfViewerZoomPreference(
        {
          autoFitWidth: true,
          defaultZoom: 1,
          documentId: "doc-1",
        },
        {
          autoFitWidth: true,
          defaultZoom: 1,
          documentId: "doc-2",
        }
      )
    ).toBeTruthy();
  });
});
