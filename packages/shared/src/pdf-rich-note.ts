import { z } from "zod";

import { SmartFormV2RichTextDocumentSchema } from "./smart-form-v2.js";
import type {
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  SmartFormV2RichTextInline,
} from "./smart-form-v2.js";

const reviewResourceSchema = z
  .object({ id: z.string().max(500).optional(), label: z.string().max(2000) })
  .strict();
const pdfReviewNoteSchema = z
  .object({
    version: z.literal(1),
    target: z.string().max(4000).optional(),
    questions: z
      .array(
        z
          .object({
            id: z.string().max(500),
            status: z.string().max(100),
            assignedTo: z.string().max(1000).optional(),
            messages: z
              .array(
                z
                  .object({
                    id: z.string().max(500),
                    kind: z.string().max(100),
                    author: z.string().max(1000),
                    date: z.string().max(200),
                    body: z.string().max(200_000),
                    images: z.array(reviewResourceSchema).max(100),
                    references: z.array(reviewResourceSchema).max(100),
                  })
                  .strict()
              )
              .max(1000),
          })
          .strict()
      )
      .max(1000),
  })
  .strict();
export type PdfReviewNote = z.infer<typeof pdfReviewNoteSchema>;
export function readPdfReviewNote(custom: unknown): PdfReviewNote | null {
  try {
    if (
      !custom ||
      typeof custom !== "object" ||
      !("projectWingReview" in custom)
    ) {
      return null;
    }
    const parsed = pdfReviewNoteSchema.safeParse(custom.projectWingReview);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Optional, versioned annotation metadata. Contents remains the portable fallback. */
export function readPdfRichNote(
  custom: unknown
): SmartFormV2RichTextDocument | null {
  try {
    if (
      !custom ||
      typeof custom !== "object" ||
      !("projectWingNote" in custom)
    ) {
      return null;
    }
    const note = custom.projectWingNote;
    if (
      !note ||
      typeof note !== "object" ||
      !("version" in note) ||
      note.version !== 1 ||
      !("document" in note)
    ) {
      return null;
    }
    // PDFs are untrusted: bound depth/node count before the recursive schema.
    const pending: { value: unknown; depth: number }[] = [
      { value: note.document, depth: 0 },
    ];
    let count = 0;
    while (pending.length) {
      const item = pending.pop();
      count += 1;
      if (!item || count > 10_000 || item.depth > 32) {
        return null;
      }
      if (item.value && typeof item.value === "object") {
        for (const value of Object.values(item.value)) {
          pending.push({ value, depth: item.depth + 1 });
        }
      } else if (
        typeof item.value === "string" &&
        item.value.length > 100_000
      ) {
        return null;
      }
    }
    const parsed = SmartFormV2RichTextDocumentSchema.safeParse(note.document);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function pdfNotePlainText(
  document: SmartFormV2RichTextDocument
): string {
  const inline = (items: SmartFormV2RichTextInline[]) =>
    items
      .map((item) => {
        if (item.type === "hardBreak") {
          return "\n";
        }
        if (item.type === "entityReference") {
          return item.labelSnapshot ?? item.entityId;
        }
        const link = item.marks?.find((mark) => mark.type === "link");
        return link && link.href !== item.text
          ? `${item.text} (${link.href})`
          : item.text;
      })
      .join("");
  const block = (item: SmartFormV2RichTextBlock): string => {
    switch (item.type) {
      case "paragraph":
      case "heading": {
        return inline(item.content);
      }
      case "embed": {
        return item.labelSnapshot ?? item.entityId;
      }
      case "bulletList":
      case "orderedList": {
        return item.items
          .map(
            (entry, index) =>
              `${item.type === "orderedList" ? `${index + 1}.` : "•"} ${entry.content.map(block).join("\n").replaceAll("\n", "\n  ")}`
          )
          .join("\n");
      }
      case "blockquote": {
        return item.content.map(block).join("\n");
      }
      case "table": {
        return item.rows
          .map((row) =>
            row.cells
              .map((cell) => cell.content.map(block).join("\n"))
              .join("\t")
          )
          .join("\n");
      }
      default: {
        return "";
      }
    }
  };
  return document.content.map(block).join("\n\n").trim();
}

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** PDF /RC uses a restricted XHTML subset, not arbitrary HTML or remote assets. */
export function pdfNoteRichContent(
  document: SmartFormV2RichTextDocument
): string {
  const inline = (items: SmartFormV2RichTextInline[]) =>
    items
      .map((item) => {
        if (item.type === "hardBreak") {
          return "<br/>";
        }
        if (item.type === "entityReference") {
          return xml(item.labelSnapshot ?? item.entityId);
        }
        const styles = (item.marks ?? []).flatMap((mark) => {
          switch (mark.type) {
            case "bold": {
              return ["font-weight:bold"];
            }
            case "italic": {
              return ["font-style:italic"];
            }
            case "underline": {
              return ["text-decoration:underline"];
            }
            case "strike": {
              return ["text-decoration:line-through"];
            }
            case "code": {
              return ["font-family:Courier"];
            }
            default: {
              return [];
            }
          }
        });
        const link = item.marks?.find((mark) => mark.type === "link");
        const value = xml(
          item.text + (link && link.href !== item.text ? ` (${link.href})` : "")
        );
        return styles.length
          ? `<span style="${styles.join(";")}">${value}</span>`
          : value;
      })
      .join("");
  const block = (item: SmartFormV2RichTextBlock): string => {
    switch (item.type) {
      case "paragraph": {
        return `<p>${inline(item.content)}</p>`;
      }
      case "heading": {
        return `<p style="font-weight:bold">${inline(item.content)}</p>`;
      }
      case "embed": {
        return `<p>${xml(item.labelSnapshot ?? item.entityId)}</p>`;
      }
      case "bulletList":
      case "orderedList": {
        return item.items
          .map(
            (entry, index) =>
              `<p>${item.type === "orderedList" ? `${index + 1}.` : "•"} ${entry.content
                .map(block)
                .join("")
                .replaceAll(/<\/?p(?:\s[^>]*)?>/g, " ")}</p>`
          )
          .join("");
      }
      case "blockquote": {
        return item.content.map(block).join("");
      }
      case "table": {
        return item.rows
          .map(
            (row) =>
              `<p>${row.cells.map((cell) => xml(pdfNotePlainText({ type: "doc", version: 1, content: cell.content }))).join(" | ")}</p>`
          )
          .join("");
      }
      default: {
        return "";
      }
    }
  };
  return `<body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:APIVersion="Acrobat:11.0.0" xfa:spec="2.0.2" style="font-size:10pt;text-align:left;color:#000000">${document.content.map(block).join("")}</body>`;
}
