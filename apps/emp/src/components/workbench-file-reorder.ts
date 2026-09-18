export type AttachmentInsertionPosition = "before" | "after";

export function changesAttachmentOrder({
  attachmentIds,
  sourceAttachmentId,
  targetAttachmentId,
  position,
}: {
  attachmentIds: string[];
  sourceAttachmentId: string;
  targetAttachmentId: string;
  position: AttachmentInsertionPosition;
}) {
  const sourceIndex = attachmentIds.indexOf(sourceAttachmentId);
  const targetIndex = attachmentIds.indexOf(targetAttachmentId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return false;
  }
  if (position === "before") {
    return sourceIndex !== targetIndex - 1;
  }
  return sourceIndex !== targetIndex + 1;
}
