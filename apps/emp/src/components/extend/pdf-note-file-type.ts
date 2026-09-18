type PdfNoteFileType = {
  kind: "image" | "document" | "spreadsheet" | "presentation" | "file";
  mimeType: string;
  preview: boolean;
};

const types: Record<string, PdfNoteFileType> = {
  pdf: { kind: "document", mimeType: "application/pdf", preview: true },
  docx: {
    kind: "document",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    preview: true,
  },
  xlsx: {
    kind: "spreadsheet",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    preview: true,
  },
  csv: { kind: "spreadsheet", mimeType: "text/csv", preview: true },
  pptx: {
    kind: "presentation",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    preview: true,
  },
};
const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
};

/** Legacy review `images` includes arbitrary uploads. A storage category is not a file type. */
export function getPdfNoteFileType(fileName: string): PdfNoteFileType {
  const extension =
    /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1].toLowerCase() ?? "";
  if (Object.hasOwn(imageTypes, extension)) {
    return { kind: "image", mimeType: imageTypes[extension], preview: true };
  }
  if (Object.hasOwn(types, extension)) {
    return types[extension];
  }
  return { kind: "file", mimeType: "application/octet-stream", preview: false };
}
