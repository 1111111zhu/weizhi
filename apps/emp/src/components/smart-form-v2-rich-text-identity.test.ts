import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
  editorJsonToSmartFormDocument,
  smartFormDocumentToEditorJson,
} from "./smart-form-v2-editor";

const paragraph = (id: string, text: string): JSONContent => ({
  type: "paragraph",
  attrs: { smartFormNodeId: id },
  content: text ? [{ type: "text", text }] : [],
});
function ids(node: JSONContent): string[] {
  const id = node.attrs?.smartFormNodeId;
  return [
    ...(typeof id === "string" ? [id] : []),
    ...(node.content ?? []).flatMap(ids),
  ];
}

describe("SmartForm rich-text identities", () => {
  it("keeps a large pasted sequence stable across subsequent edits", () => {
    const json: JSONContent = {
      type: "doc",
      content: Array.from({ length: 100 }, (_, index) =>
        paragraph("copied", `Evidence ${index} / 核对`)
      ),
    };
    const next = editorJsonToSmartFormDocument(json, "field");
    const beforeIds = ids(smartFormDocumentToEditorJson(next));
    expect(new Set(beforeIds).size).toBe(100);
    const edited = structuredClone(json);
    if (!edited.content) {
      throw new Error("Missing pasted content");
    }
    edited.content[50] = paragraph("copied", "Evidence 50 / 核对 completed");
    const after = editorJsonToSmartFormDocument(edited, "field", next);
    expect(ids(smartFormDocumentToEditorJson(after))).toStrictEqual(beforeIds);
    expect(after.content).toHaveLength(100);
  });

  it("gives a split paragraph a unique stable ID without changing text or marks", () => {
    const original = editorJsonToSmartFormDocument(
      { type: "doc", content: [paragraph("original", "First")] },
      "field"
    );
    const json: JSONContent = {
      type: "doc",
      content: [
        paragraph("original", "First"),
        {
          ...paragraph("original", "Second"),
          content: [
            { type: "text", text: "Second", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const before = JSON.stringify(json);
    const next = editorJsonToSmartFormDocument(json, "field", original);
    const nextIds = ids(smartFormDocumentToEditorJson(next));
    expect(nextIds[0]).toBe("original");
    expect(new Set(nextIds).size).toBe(nextIds.length);
    expect(editorJsonToSmartFormDocument(json, "field", next)).toStrictEqual(
      next
    );
    expect(
      smartFormDocumentToEditorJson(next).content?.[1].content
    ).toStrictEqual(json.content?.[1].content);
    expect(JSON.stringify(json)).toBe(before);
  });

  it("keeps the existing ID on unchanged content when a copied-ID paragraph is inserted before it", () => {
    const original = editorJsonToSmartFormDocument(
      {
        type: "doc",
        content: [
          paragraph("existing", "Keep this evidence"),
          paragraph("following", "Next evidence"),
        ],
      },
      "field"
    );
    const next = editorJsonToSmartFormDocument(
      {
        type: "doc",
        content: [
          paragraph("existing", ""),
          paragraph("existing", "Keep this evidence"),
          paragraph("following", "Next evidence"),
        ],
      },
      "field",
      original
    );
    expect(next.content[1].id).toBe("existing");
    expect(next.content[2].id).toBe("following");
    expect(next.content[0].id).not.toBe("existing");
  });

  it("deduplicates nested list items and paragraphs and preserves their IDs on subsequent edits", () => {
    const item: JSONContent = {
      type: "listItem",
      attrs: { smartFormNodeId: "item" },
      content: [paragraph("paragraph", "Evidence")],
    };
    const originalJson: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          attrs: { smartFormNodeId: "list" },
          content: [item],
        },
      ],
    };
    const original = editorJsonToSmartFormDocument(originalJson, "field");
    const splitJson: JSONContent = {
      type: "doc",
      content: [
        {
          ...originalJson.content?.[0],
          content: [structuredClone(item), structuredClone(item)],
        },
      ],
    };
    const next = editorJsonToSmartFormDocument(splitJson, "field", original);
    const nextIds = ids(smartFormDocumentToEditorJson(next));
    expect(nextIds).toHaveLength(5);
    expect(new Set(nextIds).size).toBe(5);
    expect(nextIds.slice(0, 3)).toStrictEqual(["list", "item", "paragraph"]);
    expect(
      editorJsonToSmartFormDocument(splitJson, "field", next)
    ).toStrictEqual(next);
  });
});
