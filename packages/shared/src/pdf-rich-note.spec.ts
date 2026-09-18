import { describe, expect, it } from "vitest";

import {
  pdfNotePlainText,
  pdfNoteRichContent,
  readPdfRichNote,
  readPdfReviewNote,
} from "./pdf-rich-note";
import type { SmartFormV2RichTextDocument } from "./smart-form-v2";

const document: SmartFormV2RichTextDocument = {
  type: "doc",
  version: 1,
  content: [
    {
      type: "heading",
      id: "title",
      level: 2,
      content: [{ type: "text", text: "Notes <&>" }],
    },
    {
      type: "paragraph",
      id: "body",
      content: [
        { type: "text", text: "Important", marks: [{ type: "bold" }] },
        { type: "hardBreak" },
        {
          type: "text",
          text: "Source",
          marks: [{ type: "link", href: "https://example.com/a" }],
        },
      ],
    },
    {
      type: "orderedList",
      id: "list",
      items: [
        {
          id: "item",
          content: [
            {
              type: "paragraph",
              id: "item-text",
              content: [{ type: "text", text: "First" }],
            },
          ],
        },
      ],
    },
    {
      type: "embed",
      id: "image",
      entityType: "image",
      entityId: "attachment-image",
      labelSnapshot: "Evidence.png",
    },
  ],
};

describe("PDF rich note compatibility", () => {
  it("keeps a large document-level discussion structured", () => {
    const questions = Array.from({ length: 500 }, (_, i) => ({
      id: `q${i}`,
      status: "OPEN",
      messages: [
        {
          id: `m${i}`,
          kind: "QUESTION",
          author: "Reviewer",
          date: "2026-09-09",
          body: `Question ${i}`,
          images: [],
          references: [],
        },
      ],
    }));
    const note = readPdfReviewNote({
      projectWingReview: { version: 1, questions },
    });
    expect(note?.questions).toHaveLength(500);
    expect(note?.questions[499].messages[0].body).toBe("Question 499");
  });
  it("preserves source data and readable fallback layout", () => {
    const before = JSON.stringify(document);
    expect(pdfNotePlainText(document)).toBe(
      "Notes <&>\n\nImportant\nSource (https://example.com/a)\n\n1. First\n\nEvidence.png"
    );
    expect(
      readPdfRichNote({ projectWingNote: { version: 1, document } })
    ).toStrictEqual(document);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("writes escaped standard rich text without remote image HTML", () => {
    const rich = pdfNoteRichContent(document);
    expect(rich).toContain("Notes &lt;&amp;&gt;");
    expect(rich).toContain('style="font-weight:bold">Important');
    expect(rich).toContain("<br/>");
    expect(rich).not.toContain("<img");
    expect(rich).toContain("Evidence.png");
  });

  it.each([
    null,
    {},
    { projectWingNote: { version: 2, document } },
    {
      projectWingNote: {
        version: 1,
        document: { ...document, content: [{ type: "script" }] },
      },
    },
  ])("falls back for unknown or malformed metadata", (value) => {
    expect(readPdfRichNote(value)).toBeNull();
  });

  it("rejects executable links and pathological nesting", () => {
    expect(
      readPdfRichNote({
        projectWingNote: {
          version: 1,
          document: {
            ...document,
            content: [
              {
                type: "paragraph",
                id: "bad",
                content: [
                  {
                    type: "text",
                    text: "Run",
                    // eslint-disable-next-line no-script-url -- Malicious PDF metadata regression.
                    marks: [{ type: "link", href: "javascript:alert(1)" }],
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBeNull();
    const cycle: Record<string, unknown> = {};
    cycle.child = cycle;
    expect(
      readPdfRichNote({ projectWingNote: { version: 1, document: cycle } })
    ).toBeNull();
  });
});
