// @vitest-environment jsdom

import type { DocModel } from "@extend-ai/react-docx";
import { describe, expect, it } from "vitest";

import {
  createDocxParagraphAnchorResolver,
  getDocxDocumentCanvasWidth,
  getDocxPageOverlayHost,
  getDocxViewportPanScroll,
  shouldSyncDocxPageOverlayHosts,
} from "./docx-viewer";

const BODY_SOURCE_XML =
  '<w:p w14:paraId="AAAABBBB"><w:r><w:t>Hello &amp; goodbye</w:t></w:r><w:r><w:t>!</w:t></w:r></w:p>';
const DIRECT_TABLE_SOURCE_XML = "<w:p><w:r><w:t>Direct</w:t></w:r></w:p>";
const NESTED_TABLE_SOURCE_XML =
  '<w:p w14:paraId="CCCCDDDD"><w:r><w:t>Nested</w:t></w:r></w:p>';
const AFTER_NESTED_TABLE_SOURCE_XML = "<w:p><w:r><w:t>After</w:t></w:r></w:p>";

const model = {
  nodes: [
    {
      type: "paragraph",
      children: [{ type: "text", text: "Hello & goodbye!" }],
      sourceXml: BODY_SOURCE_XML,
    },
    {
      type: "table",
      rows: [
        {
          type: "table-row",
          cells: [
            {
              type: "table-cell",
              nodes: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Direct" }],
                  sourceXml: DIRECT_TABLE_SOURCE_XML,
                },
                {
                  type: "table",
                  rows: [
                    {
                      type: "table-row",
                      cells: [
                        {
                          type: "table-cell",
                          nodes: [
                            {
                              type: "paragraph",
                              children: [{ type: "text", text: "Nested" }],
                              sourceXml: NESTED_TABLE_SOURCE_XML,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "After" }],
                  sourceXml: AFTER_NESTED_TABLE_SOURCE_XML,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
} satisfies Pick<DocModel, "nodes">;

function createParagraphHost(dataset: Record<string, string>) {
  const element = document.createElement("div");
  Object.assign(element.dataset, dataset);
  return element;
}

describe("DOCX paragraph anchor resolver", () => {
  it("preserves source paraId casing and emits the canonical w:t text stream", async () => {
    const sourceXml =
      '<w:p w14:paraId="a1b2c3d4"><w:r><w:t>A&amp;</w:t><w:tab/><w:instrText>ignored</w:instrText><w:br/><w:t>B</w:t></w:r></w:p>';
    const lowercaseParaIdModel = {
      nodes: [
        {
          type: "paragraph",
          children: [{ type: "text", text: "A&B" }],
          sourceXml,
        },
      ],
    } satisfies Pick<DocModel, "nodes">;
    const resolveParagraphAnchor =
      createDocxParagraphAnchorResolver(lowercaseParaIdModel);

    await expect(
      resolveParagraphAnchor(
        createParagraphHost({
          docxParagraphKind: "paragraph",
          docxParagraphNodeIndex: "0",
        })
      )
    ).resolves.toEqual(
      expect.objectContaining({
        paragraphId: "a1b2c3d4",
        paragraphText: "A&B",
      })
    );
  });

  it("resolves stable body and table anchors in recursive document order", async () => {
    const resolveParagraphAnchor = createDocxParagraphAnchorResolver(model);
    const bodyParagraph = createParagraphHost({
      docxParagraphKind: "paragraph",
      docxParagraphNodeIndex: "0",
    });
    const tableParagraphAfterNestedTable = createParagraphHost({
      docxCellIndex: "0",
      docxParagraphIndex: "1",
      docxParagraphKind: "table-cell",
      docxRowIndex: "0",
      docxTableIndex: "1",
    });

    await expect(resolveParagraphAnchor(bodyParagraph)).resolves.toEqual({
      paragraphId: "AAAABBBB",
      paragraphOrdinal: 0,
      paragraphText: "Hello & goodbye!",
      part: "word/document.xml",
      sourceXmlSha256:
        "b0cc36f27185f60ced90352ac19e1e0b6163ccb47c34404e78fa388cca768cca",
    });
    await expect(
      resolveParagraphAnchor(tableParagraphAfterNestedTable)
    ).resolves.toEqual({
      paragraphOrdinal: 3,
      paragraphText: "After",
      part: "word/document.xml",
      sourceXmlSha256:
        "f7b554f2388d5f1ce4177aa6f6faffe4716c17d1211a1e6ccea49e28bfd5497a",
    });
  });
});

describe("DOCX viewport panning", () => {
  it("anchors page overlays to the paper surface instead of the wider page wrapper", () => {
    const wrapper = document.createElement("div");
    const surface = document.createElement("div");

    expect(getDocxPageOverlayHost(wrapper, surface)).toBe(surface);
    expect(getDocxPageOverlayHost(wrapper, null)).toBe(wrapper);
  });

  it("ignores mutations created inside a page overlay host", () => {
    const page = document.createElement("div");
    page.dataset.docxPageWrapper = "true";
    const overlay = document.createElement("div");
    page.append(overlay);
    const outside = document.createElement("div");

    expect(shouldSyncDocxPageOverlayHosts([{ target: overlay }])).toBe(false);
    expect(shouldSyncDocxPageOverlayHosts([{ target: outside }])).toBe(true);
  });

  it("allocates enough canvas width for a zoomed page", () => {
    expect(
      getDocxDocumentCanvasWidth({
        minimumWidth: 803,
        pageWidth: 794,
        zoomScale: 125,
      })
    ).toBeCloseTo(992.5, 5);
  });

  it("converts a drag into opposite-direction viewport scrolling", () => {
    expect(
      getDocxViewportPanScroll({
        currentClientX: 260,
        currentClientY: 180,
        startClientX: 200,
        startClientY: 120,
        startScrollLeft: 240,
        startScrollTop: 360,
      })
    ).toEqual({ left: 180, top: 300 });
  });
});
