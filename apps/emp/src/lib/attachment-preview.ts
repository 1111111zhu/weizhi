export const ATTACHMENT_PREVIEW_KINDS = [
  "archive",
  "csv",
  "docx",
  "email",
  "image",
  "media",
  "pdf",
  "pptx",
  "text",
  "xlsx",
] as const;

export type AttachmentPreviewKind = (typeof ATTACHMENT_PREVIEW_KINDS)[number];

export type AttachmentPreviewFamily =
  | "archive"
  | "asset"
  | "document"
  | "email"
  | "media"
  | "spreadsheet"
  | "text";

export type AttachmentPreviewCapabilities = Readonly<{
  copy: boolean;
  download: boolean;
  pagination: boolean;
  search: boolean;
  sheetTabs: boolean;
  thumbnails: boolean;
  zoom: boolean;
}>;

const CAPABILITIES_BY_FAMILY: Record<
  AttachmentPreviewFamily,
  AttachmentPreviewCapabilities
> = {
  archive: {
    copy: false,
    download: true,
    pagination: false,
    search: true,
    sheetTabs: false,
    thumbnails: false,
    zoom: false,
  },
  asset: {
    copy: true,
    download: true,
    pagination: false,
    search: false,
    sheetTabs: false,
    thumbnails: false,
    zoom: true,
  },
  document: {
    copy: false,
    download: true,
    pagination: true,
    search: true,
    sheetTabs: false,
    thumbnails: true,
    zoom: true,
  },
  email: {
    copy: true,
    download: true,
    pagination: false,
    search: true,
    sheetTabs: false,
    thumbnails: false,
    zoom: false,
  },
  media: {
    copy: true,
    download: true,
    pagination: false,
    search: false,
    sheetTabs: false,
    thumbnails: false,
    zoom: false,
  },
  spreadsheet: {
    copy: true,
    download: true,
    pagination: false,
    search: true,
    sheetTabs: true,
    thumbnails: false,
    zoom: true,
  },
  text: {
    copy: true,
    download: true,
    pagination: false,
    search: true,
    sheetTabs: false,
    thumbnails: false,
    zoom: true,
  },
};
const FAMILY_BY_KIND: Record<AttachmentPreviewKind, AttachmentPreviewFamily> = {
  archive: "archive",
  csv: "spreadsheet",
  docx: "document",
  email: "email",
  image: "asset",
  media: "media",
  pdf: "document",
  pptx: "document",
  text: "text",
  xlsx: "spreadsheet",
};

export function getAttachmentPreviewFamily(kind: AttachmentPreviewKind) {
  return FAMILY_BY_KIND[kind];
}

export function getAttachmentPreviewCapabilities(kind: AttachmentPreviewKind) {
  return CAPABILITIES_BY_FAMILY[getAttachmentPreviewFamily(kind)];
}
