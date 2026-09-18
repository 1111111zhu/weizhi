export type AttachmentKind = "DOC" | "FILE" | "PDF" | "PPT" | "XLS";

export function getAttachmentKind(fileName: string): AttachmentKind {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    return "PDF";
  }
  if (extension === "doc" || extension === "docx") {
    return "DOC";
  }
  if (extension === "xls" || extension === "xlsx") {
    return "XLS";
  }
  if (extension === "ppt" || extension === "pptx") {
    return "PPT";
  }
  return "FILE";
}

export function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
