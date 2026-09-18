import type { Email, Attachment as PostalMimeAttachment } from "postal-mime";

export type DocumentAssetPreviewKind = "email" | "image" | "media" | "text";

export type DocumentEmailAttachment = {
  content: ArrayBuffer | Uint8Array | string;
  fileName: string;
  mimeType: string;
};

export type DocumentEmailPreview = {
  attachments: DocumentEmailAttachment[];
  cc: string;
  date: string;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
};

const EMAIL_EXTENSIONS = /\.(eml|msg)$/i;
const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const MEDIA_EXTENSIONS = /\.(aac|flac|m4a|mov|mp3|mp4|ogg|wav|webm)$/i;
const TEXT_EXTENSIONS =
  /\.(cjs|css|html?|js|json|log|md|markdown|mdx|sql|ts|tsx|txt|xml|yaml|yml)$/i;

export function getDocumentAssetPreviewKind(
  fileName: string,
  mimeType: string
): DocumentAssetPreviewKind | null {
  const normalizedMimeType = mimeType.toLowerCase();
  if (
    EMAIL_EXTENSIONS.test(fileName) ||
    normalizedMimeType === "message/rfc822" ||
    normalizedMimeType === "application/vnd.ms-outlook"
  ) {
    return "email";
  }
  if (
    normalizedMimeType.startsWith("image/") ||
    IMAGE_EXTENSIONS.test(fileName)
  ) {
    return "image";
  }
  if (
    normalizedMimeType.startsWith("audio/") ||
    normalizedMimeType.startsWith("video/") ||
    MEDIA_EXTENSIONS.test(fileName)
  ) {
    return "media";
  }
  if (
    normalizedMimeType.startsWith("text/") ||
    TEXT_EXTENSIONS.test(fileName)
  ) {
    return "text";
  }
  return null;
}

function formatAddress(value: unknown): string {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(formatAddress).filter(Boolean).join(", ");
  }
  if (typeof value !== "object") {
    return String(value);
  }
  const record = value as {
    address?: string;
    name?: string;
    group?: unknown[];
  };
  if (record.group) {
    return record.group.map(formatAddress).filter(Boolean).join(", ");
  }
  if (record.name && record.address) {
    return `${record.name} <${record.address}>`;
  }
  return record.address ?? record.name ?? "";
}

function normalizeAttachment(
  attachment: PostalMimeAttachment,
  index: number
): DocumentEmailAttachment {
  return {
    content: attachment.content,
    fileName: attachment.filename || `attachment-${index + 1}`,
    mimeType: attachment.mimeType || "application/octet-stream",
  };
}

function normalizePostalMimeEmail(email: Email): DocumentEmailPreview {
  return {
    attachments: email.attachments.map(normalizeAttachment),
    cc: formatAddress(email.cc),
    date: email.date ?? "",
    from: formatAddress(email.from),
    html: email.html ?? "",
    subject: email.subject ?? "(no subject)",
    text: email.text ?? "",
    to: formatAddress(email.to),
  };
}

async function parseEml(blob: Blob): Promise<DocumentEmailPreview> {
  const { default: PostalMime } = await import("postal-mime");
  const email = await PostalMime.parse(blob, {
    attachmentEncoding: "arraybuffer",
  });
  return normalizePostalMimeEmail(email);
}

async function parseMsg(blob: Blob): Promise<DocumentEmailPreview> {
  const { default: MsgReader } = await import("@kenjiuno/msgreader");
  const reader = new MsgReader(await blob.arrayBuffer());
  const data = reader.getFileData();
  return {
    attachments: (data.attachments ?? []).map((attachment, index) => {
      const file = reader.getAttachment(attachment);
      return {
        content: file.content,
        fileName: file.fileName || `attachment-${index + 1}`,
        mimeType: "application/octet-stream",
      };
    }),
    cc: (data.recipients ?? [])
      .filter((recipient) => recipient.recipType === "cc")
      .map((recipient) => recipient.email ?? recipient.name ?? "")
      .filter(Boolean)
      .join(", "),
    date: data.clientSubmitTime ?? data.creationTime ?? "",
    from: data.senderEmail ?? data.senderName ?? "",
    html: "",
    subject: data.subject ?? "(no subject)",
    text: data.body ?? "",
    to: (data.recipients ?? [])
      .filter((recipient) => recipient.recipType !== "cc")
      .map((recipient) => recipient.email ?? recipient.name ?? "")
      .filter(Boolean)
      .join(", "),
  };
}

export async function parseDocumentEmail(
  blob: Blob,
  fileName: string
): Promise<DocumentEmailPreview> {
  await Promise.resolve();
  return fileName.toLowerCase().endsWith(".msg")
    ? parseMsg(blob)
    : parseEml(blob);
}

export function emailAttachmentBlob(attachment: DocumentEmailAttachment) {
  if (typeof attachment.content === "string") {
    return new Blob([attachment.content], { type: attachment.mimeType });
  }
  if (attachment.content instanceof Uint8Array) {
    const bytes = new Uint8Array(attachment.content);
    return new Blob([bytes.buffer as ArrayBuffer], {
      type: attachment.mimeType,
    });
  }
  return new Blob([attachment.content], { type: attachment.mimeType });
}
