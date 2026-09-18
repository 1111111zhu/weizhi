import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { create as createFont } from "@pdf-lib/fontkit";
import type {
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
  ConfirmationTemplateFontFamily,
  ConfirmationTemplateTextStyle,
} from "@project-wing/shared";
import {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
  isConfirmationCustomTemplateCode,
} from "@project-wing/shared";
import JSZip from "jszip";
import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont } from "pdf-lib";

import { ApiBadRequestException } from "../common/api-error";
import { StorageService } from "../storage/storage.service";
import { DocumentConversionService } from "../workflow/document-conversion.service";
import type { DocumentPreviewPdf } from "../workflow/document-conversion.service";
import type { ConfirmationDerivedSnapshot } from "./confirmation-derived-data.service";
import { getDefaultConfirmationTemplateDesign } from "./confirmation-template-design-defaults";
import {
  CONFIRMATION_BASE_INFORMATION_BINDINGS,
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS,
} from "./confirmation-template-library.service";
import type {
  ConfirmationTemplateDesignFieldBinding,
  ConfirmationTemplateDesignFieldSourceRange,
} from "./confirmation-template-library.service";

export type ConfirmationDocumentProject = {
  id: string;
  name: string;
  projectCode: string;
  reportDate?: Date | string | null;
};

export type ConfirmationDocumentRecord = {
  id: string;
  projectId: string;
  type: string;
  confirmationCode?: string | null;
  auditPeriod?: string | null;
  counterpartyName: string;
  draftTemplateCode?: string | null;
  draftPayload?: unknown;
  draftUpdatedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  project?: ConfirmationDocumentProject | null;
  responsibleUser?: { name: string } | null;
};

export type ConfirmationRenderContext = {
  confirmation: ConfirmationDocumentRecord;
  derivedSnapshot?: ConfirmationDerivedSnapshot;
};

export type RenderedConfirmationArtifact = {
  docx: Buffer;
  pdf: Buffer;
  docxFileName: string;
  pdfFileName: string;
};

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME_TYPE = "application/pdf";
const TEMPLATE_CODES: ConfirmationDraftTemplateCode[] = [
  "PRC_BANK_TEMPLATE_1",
  "PRC_BANK_TEMPLATE_2",
  "SHINEWING_ENG_BANK",
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
];
const TEMPLATE_FILES: Record<ConfirmationDraftTemplateCode, string> = {
  PRC_BANK_TEMPLATE_1: "prc-bank-confirmation-template-1.docx",
  PRC_BANK_TEMPLATE_2: "prc-bank-confirmation-template-2.docx",
  SHINEWING_ENG_BANK: "shinewing-eng-bank-confirmation.docx",
  STANDARD_FINANCIAL_INSTITUTION:
    "standard-financial-institution-pdf-twin.docx",
  BANK_CONFIRMATION_HK_STANDARD_ENGLISH:
    "bank-confirmation-hk-standard-english.docx",
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_1:
    "securities-confirmation-english-type-1.docx",
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_2:
    "securities-confirmation-english-type-2.docx",
};
const CONFIRMATION_DOCUMENT_RENDERER_CACHE_VERSION = "confirmation-docx-v13";
const MAX_DYNAMIC_TEMPLATE_SOURCE_RANGE_TEXT_LENGTH = 10_000;
type PdfFontVariant = "bold" | "boldItalic" | "italic" | "regular";
const PDF_FONT_PATHS: Record<
  ConfirmationTemplateFontFamily,
  Record<PdfFontVariant, readonly string[]>
> = {
  "Noto Sans SC": {
    regular: [
      "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf",
      "/usr/share/opentype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ],
    bold: [
      "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf",
      "/usr/share/opentype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    ],
    italic: [
      "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf",
      "/usr/share/opentype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf",
      "/usr/share/opentype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    ],
  },
  "Noto Sans": {
    regular: [
      "C:\\Windows\\Fonts\\NotoSans-Regular.ttf",
      "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ],
    bold: [
      "C:\\Windows\\Fonts\\NotoSans-Bold.ttf",
      "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    ],
    italic: [
      "C:\\Windows\\Fonts\\NotoSans-Italic.ttf",
      "/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\NotoSans-BoldItalic.ttf",
      "/usr/share/fonts/truetype/noto/NotoSans-BoldItalic.ttf",
    ],
  },
  "Liberation Sans": {
    regular: [
      "C:\\Windows\\Fonts\\LiberationSans-Regular.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ],
    bold: [
      "C:\\Windows\\Fonts\\LiberationSans-Bold.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    italic: [
      "C:\\Windows\\Fonts\\LiberationSans-Italic.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\LiberationSans-BoldItalic.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-BoldItalic.ttf",
    ],
  },
  "Liberation Serif": {
    regular: [
      "C:\\Windows\\Fonts\\LiberationSerif-Regular.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    ],
    bold: [
      "C:\\Windows\\Fonts\\LiberationSerif-Bold.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
    ],
    italic: [
      "C:\\Windows\\Fonts\\LiberationSerif-Italic.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Italic.ttf",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\LiberationSerif-BoldItalic.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-BoldItalic.ttf",
    ],
  },
  Arial: {
    regular: [
      "C:\\Windows\\Fonts\\arial.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ],
    bold: [
      "C:\\Windows\\Fonts\\arialbd.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ],
    italic: [
      "C:\\Windows\\Fonts\\ariali.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\arialbi.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-BoldItalic.ttf",
    ],
  },
  "Microsoft YaHei": {
    regular: [
      "C:\\Windows\\Fonts\\msyh.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/truetype/arphic/ukai.ttc",
    ],
    bold: [
      "C:\\Windows\\Fonts\\msyhbd.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/truetype/arphic/ukai.ttc",
    ],
    italic: [
      "C:\\Windows\\Fonts\\msyhl.ttc",
      "C:\\Windows\\Fonts\\msyh.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
      "/usr/share/fonts/truetype/arphic/ukai.ttc",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\msyhbd.ttc",
      "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
      "/usr/share/fonts/truetype/arphic/ukai.ttc",
    ],
  },
  "Times New Roman": {
    regular: [
      "C:\\Windows\\Fonts\\times.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    ],
    bold: [
      "C:\\Windows\\Fonts\\timesbd.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf",
    ],
    italic: [
      "C:\\Windows\\Fonts\\timesi.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-Italic.ttf",
    ],
    boldItalic: [
      "C:\\Windows\\Fonts\\timesbi.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSerif-BoldItalic.ttf",
    ],
  },
};
const pdfLibFontkit = {
  create(fontData: Uint8Array) {
    const parsed = createFont(fontData);
    const collection = parsed as unknown as {
      fonts?: ReturnType<typeof createFont>[];
    };
    return collection.fonts?.[0] ?? parsed;
  },
};
const TEMPLATE_FIELD_BINDINGS = new Set<ConfirmationTemplateDesignFieldBinding>(
  [
    "accountNumber",
    "auditorAddress",
    "auditorName",
    "authorizationAccount",
    "bankName",
    "clientName",
    "micEmail",
    "micNameAndInitial",
    "officeDate",
    "recipientAddress",
    "recipientName",
    "referenceCode",
    "picName",
    "micName",
    "reportDate",
    "salutation",
    "yearEndDate",
  ]
);
const BASE_INFORMATION_FIELD_BINDINGS = new Set<ConfirmationTemplateDesignFieldBinding>(
  CONFIRMATION_BASE_INFORMATION_BINDINGS
);
const INFORMATION_LIBRARY_FIELD_BINDINGS = new Set<ConfirmationTemplateDesignFieldBinding>(
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS
);

export type ConfirmationStoredFile = {
  fileName: string;
  mimeType: string;
  body: Buffer;
};

export type ConfirmationPreviewPdf = DocumentPreviewPdf & {
  body: Buffer;
};

@Injectable()
export class ConfirmationDocumentService {
  private readonly logger = new Logger(ConfirmationDocumentService.name);

  private readonly previewRequests = new Map<
    string,
    Promise<ConfirmationPreviewPdf>
  >();

  constructor(
    private readonly storage: StorageService,
    private readonly documentConversion: DocumentConversionService
  ) {}

  async getStoredFile(
    objectKey: string,
    fileName: string,
    mimeType: string
  ): Promise<ConfirmationStoredFile> {
    return {
      fileName,
      mimeType,
      body: await this.storage.getObjectBuffer(objectKey),
    };
  }

  async getStoredPdf(objectKey: string, fileName: string) {
    await Promise.resolve();
    return this.getStoredFile(objectKey, fileName, "application/pdf");
  }

  async renderPreviewPdf(
    input: ConfirmationRenderContext | ConfirmationDocumentRecord
  ): Promise<ConfirmationPreviewPdf> {
    const context = "confirmation" in input ? input : { confirmation: input };
    const { confirmation } = context;
    const draftPayload = normalizeDraftPayload(confirmation.draftPayload);
    const templateCode = normalizeTemplateCode(confirmation.draftTemplateCode);
    if (!draftPayload || !templateCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请先保存函证正文后再预览正式文件"
      );
    }

    const cacheKey = buildPreviewCacheKey(
      confirmation,
      draftPayload,
      context.derivedSnapshot
    );
    const authoritativePayload = applyDerivedSnapshotForRendering(
      draftPayload,
      context.derivedSnapshot,
      templateCode
    );
    const fileBaseName = buildDocumentBaseName(
      confirmation,
      authoritativePayload
    );
    const pdfFileName = `${fileBaseName}.pdf`;
    const cacheDirectory = [
      "confirmation-preview-cache",
      confirmation.projectId,
      confirmation.id,
      cacheKey,
    ].join("/");
    const pdfObjectKey = `${cacheDirectory}/${sanitizeObjectSegment(pdfFileName)}`;
    const pending = this.previewRequests.get(pdfObjectKey);
    if (pending) {
      return pending;
    }
    const request = (async () => {
      const cached = await this.readPreviewCache(pdfObjectKey, () =>
        this.storage.getObjectBuffer(pdfObjectKey)
      );
      if (cached) {
        return {
          fileName: pdfFileName,
          mimeType: "application/pdf",
          body: cached,
        } as ConfirmationPreviewPdf;
      }
      const renderedPdf = shouldUseCanonicalDynamicTemplatePdf(
        templateCode,
        authoritativePayload
      )
        ? await renderDynamicTemplatePdf({
            documentConversion: this.documentConversion,
            storage: this.storage,
            confirmation,
            draftPayload: authoritativePayload,
            templateCode,
          })
        : await this.documentConversion.convertOfficeBufferToPdf({
            fileName: `${fileBaseName}.docx`,
            mimeType: DOCX_MIME_TYPE,
            body: await renderConfirmationDocx({
              storage: this.storage,
              confirmation,
              draftPayload: authoritativePayload,
              templateCode,
            }),
          });
      await this.writePreviewCache(
        pdfObjectKey,
        renderedPdf,
        "application/pdf"
      );
      return {
        fileName: pdfFileName,
        mimeType: "application/pdf",
        body: renderedPdf,
      } as ConfirmationPreviewPdf;
    })();
    this.previewRequests.set(pdfObjectKey, request);
    try {
      return await request;
    } finally {
      this.previewRequests.delete(pdfObjectKey);
    }
  }

  async renderPreviewDocx(
    input: ConfirmationRenderContext | ConfirmationDocumentRecord
  ): Promise<ConfirmationStoredFile> {
    const context = "confirmation" in input ? input : { confirmation: input };
    const { confirmation } = context;
    const draftPayload = normalizeDraftPayload(confirmation.draftPayload);
    const templateCode = normalizeTemplateCode(confirmation.draftTemplateCode);
    if (!draftPayload || !templateCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请先保存函证正文后再预览正式文件"
      );
    }

    const authoritativePayload = applyDerivedSnapshotForRendering(
      draftPayload,
      context.derivedSnapshot,
      templateCode
    );
    const fileName = `${buildDocumentBaseName(confirmation, authoritativePayload)}.docx`;
    const cacheKey = buildPreviewCacheKey(
      confirmation,
      draftPayload,
      context.derivedSnapshot
    );
    const cacheDirectory = [
      "confirmation-preview-cache",
      confirmation.projectId,
      confirmation.id,
      cacheKey,
    ].join("/");
    const docxObjectKey = `${cacheDirectory}/${sanitizeObjectSegment(fileName)}`;
    const cachedDocx = await this.readPreviewCache(docxObjectKey, () =>
      this.storage.getCacheObjectBuffer(docxObjectKey)
    );
    if (cachedDocx !== null) {
      return { fileName, mimeType: DOCX_MIME_TYPE, body: cachedDocx };
    }
    const body = shouldUseCanonicalDynamicTemplatePdf(
      templateCode,
      authoritativePayload
    )
      ? await this.documentConversion.convertPdfBufferToDocx({
          fileName: `${fileName.slice(0, -5)}.pdf`,
          mimeType: PDF_MIME_TYPE,
          preserveLayout: true,
          body: await renderDynamicTemplatePdf({
            documentConversion: this.documentConversion,
            storage: this.storage,
            confirmation,
            draftPayload: authoritativePayload,
            templateCode,
          }),
        })
      : isOverlayEditableTemplate(templateCode)
        ? await renderManagedOverlayPreviewDocx({
            storage: this.storage,
            draftPayload: authoritativePayload,
            templateCode,
          })
        : await renderConfirmationDocx({
            storage: this.storage,
            confirmation,
            draftPayload: authoritativePayload,
            templateCode,
          });
    await this.writePreviewCache(docxObjectKey, body, DOCX_MIME_TYPE);
    return { fileName, mimeType: DOCX_MIME_TYPE, body };
  }

  private async readPreviewCache(
    objectKey: string,
    read: () => Promise<Buffer | null>
  ) {
    try {
      return await read();
    } catch (error) {
      if (!isObjectNotFoundError(error)) {
        this.logger.warn(
          `Confirmation preview cache read failed: ${objectKey}`,
          error instanceof Error ? error.stack : undefined
        );
      }
      return null;
    }
  }

  private async writePreviewCache(
    objectKey: string,
    body: Buffer,
    mimeType: string
  ) {
    try {
      await this.storage.putCacheObject(objectKey, body, mimeType);
    } catch (error) {
      this.logger.warn(
        `Confirmation preview cache write failed: ${objectKey}`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async renderFilledDocx(
    input: ConfirmationRenderContext | ConfirmationDocumentRecord
  ): Promise<ConfirmationStoredFile> {
    const context = "confirmation" in input ? input : { confirmation: input };
    const { confirmation } = context;
    const draftPayload = normalizeDraftPayload(confirmation.draftPayload);
    const templateCode = normalizeTemplateCode(confirmation.draftTemplateCode);
    if (!draftPayload || !templateCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请先保存函证正文后再下载正式文件"
      );
    }

    const authoritativePayload = applyDerivedSnapshotForRendering(
      draftPayload,
      context.derivedSnapshot,
      templateCode
    );
    const fileName = `${buildDocumentBaseName(confirmation, authoritativePayload)}.docx`;
    const body =
      shouldUseCanonicalDynamicTemplatePdf(
        templateCode,
        authoritativePayload
      ) && !canDirectlyRenderEditableDocx(templateCode, authoritativePayload)
        ? await this.documentConversion.convertPdfBufferToDocx({
            fileName: `${fileName.slice(0, -5)}.pdf`,
            mimeType: PDF_MIME_TYPE,
            preserveLayout: true,
            body: await renderDynamicTemplatePdf({
              documentConversion: this.documentConversion,
              storage: this.storage,
              confirmation,
              draftPayload: authoritativePayload,
              templateCode,
            }),
          })
        : await renderConfirmationDocx({
            storage: this.storage,
            confirmation,
            draftPayload: authoritativePayload,
            templateCode,
          });
    return { fileName, mimeType: DOCX_MIME_TYPE, body };
  }

  async renderArtifactFiles(
    context: ConfirmationRenderContext
  ): Promise<RenderedConfirmationArtifact> {
    const draftPayload = normalizeDraftPayload(
      context.confirmation.draftPayload
    );
    const templateCode = normalizeTemplateCode(
      context.confirmation.draftTemplateCode
    );
    if (!draftPayload || !templateCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请先保存函证正文后再生成正式文件"
      );
    }

    const authoritativePayload = applyDerivedSnapshotForRendering(
      draftPayload,
      context.derivedSnapshot,
      templateCode
    );
    const docxFileName = `${buildDocumentBaseName(
      context.confirmation,
      authoritativePayload
    )}.docx`;
    const pdfFileName = `${docxFileName.slice(0, -5)}.pdf`;
    const pdf = shouldUseCanonicalDynamicTemplatePdf(
      templateCode,
      authoritativePayload
    )
      ? await renderDynamicTemplatePdf({
          documentConversion: this.documentConversion,
          storage: this.storage,
          confirmation: context.confirmation,
          draftPayload: authoritativePayload,
          templateCode,
        })
      : null;
    const docx =
      pdf && !canDirectlyRenderEditableDocx(templateCode, authoritativePayload)
        ? await this.documentConversion.convertPdfBufferToDocx({
            fileName: pdfFileName,
            mimeType: PDF_MIME_TYPE,
            preserveLayout: true,
            body: pdf,
          })
        : await renderConfirmationDocx({
            storage: this.storage,
            confirmation: context.confirmation,
            draftPayload: authoritativePayload,
            templateCode,
          });
    const renderedPdf =
      pdf ??
      (await this.documentConversion.convertOfficeBufferToPdf({
        fileName: docxFileName,
        mimeType: DOCX_MIME_TYPE,
        body: docx,
      }));
    return { docx, pdf: renderedPdf, docxFileName, pdfFileName };
  }
}

function canDirectlyRenderEditableDocx(
  templateCode: ConfirmationDraftTemplateCode,
  draftPayload: ConfirmationDraftPayload
) {
  if (isPdfCustomTemplate(templateCode, draftPayload)) {
    return false;
  }

  const fields = parseDynamicTemplateFields(
    (draftPayload as Record<string, unknown>).templateDesignSchema
  );
  return !fields?.some((field) => field.sourceRanges?.length);
}

export function applyDerivedSnapshotForRendering(
  draftPayload: ConfirmationDraftPayload,
  derivedSnapshot: ConfirmationDerivedSnapshot | undefined,
  templateCode?: ConfirmationDraftTemplateCode
): ConfirmationDraftPayload {
  if (!derivedSnapshot) {
    return draftPayload;
  }
  return {
    ...draftPayload,
    clientCode: derivedSnapshot.clientCode,
    clientName:
      templateCode === "STANDARD_FINANCIAL_INSTITUTION"
        ? derivedSnapshot.clientName
        : draftPayload.clientName?.trim() || derivedSnapshot.clientName,
    customerName:
      templateCode === "STANDARD_FINANCIAL_INSTITUTION"
        ? derivedSnapshot.clientName
        : draftPayload.customerName?.trim() ||
          draftPayload.clientName?.trim() ||
          derivedSnapshot.clientName,
    projectCode: derivedSnapshot.projectCode,
    projectName: derivedSnapshot.projectName,
    picName:
      templateCode === "STANDARD_FINANCIAL_INSTITUTION"
        ? derivedSnapshot.picName
        : draftPayload.picName?.trim() || derivedSnapshot.picName,
    fiscalYear: `${derivedSnapshot.fiscalYear}年度`,
    balanceSheetDate: derivedSnapshot.balanceSheetDate,
    reportDate:
      (templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
        templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
        (templateCode !== undefined && isSecuritiesTemplate(templateCode))) &&
      draftPayload.reportDate?.trim()
        ? draftPayload.reportDate.trim()
        : derivedSnapshot.balanceSheetDate,
    contactUserId: derivedSnapshot.contactUserId,
    contactName: derivedSnapshot.contactName,
    contactEmail: derivedSnapshot.contactEmail,
    confirmationCode: derivedSnapshot.confirmationCode,
    replyContact: derivedSnapshot.contactName,
    replyEmail: derivedSnapshot.contactEmail,
  } as ConfirmationDraftPayload;
}

function normalizeTemplateCode(
  value: string | null | undefined
): ConfirmationDraftTemplateCode | null {
  return TEMPLATE_CODES.includes(value as ConfirmationDraftTemplateCode) ||
    isConfirmationCustomTemplateCode(value)
    ? (value as ConfirmationDraftTemplateCode)
    : null;
}

function normalizeDraftPayload(
  value: unknown
): ConfirmationDraftPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as ConfirmationDraftPayload;
}

function buildPreviewCacheKey(
  confirmation: ConfirmationDocumentRecord,
  draftPayload: ConfirmationDraftPayload,
  derivedSnapshot: ConfirmationDerivedSnapshot | undefined
) {
  const hash = createHash("sha256");
  hash.update(CONFIRMATION_DOCUMENT_RENDERER_CACHE_VERSION);
  hash.update(confirmation.id);
  hash.update(String(confirmation.updatedAt ?? ""));
  hash.update(String(confirmation.draftUpdatedAt ?? ""));
  hash.update(String(confirmation.draftTemplateCode ?? ""));
  hash.update(JSON.stringify(draftPayload));
  hash.update(JSON.stringify(derivedSnapshot ?? null));
  if (hasUnfilledCurrentDateField(draftPayload)) {
    hash.update(`current-date:${formatDateInputValue(new Date())}`);
  }
  return `${CONFIRMATION_DOCUMENT_RENDERER_CACHE_VERSION}-${hash.digest("hex").slice(0, 16)}`;
}

function hasUnfilledCurrentDateField(draftPayload: ConfirmationDraftPayload) {
  const payload = draftPayload as Record<string, unknown>;
  const fields = parseDynamicTemplateFields(payload.templateDesignSchema);
  if (!fields?.length) {
    return false;
  }
  const fieldValues = isRecord(payload.templateFieldValues)
    ? payload.templateFieldValues
    : {};
  return fields.some(
    (field) =>
      field.kind === "DATE" &&
      field.defaultValueSource?.source === "SYSTEM" &&
      !Object.hasOwn(fieldValues, field.id)
  );
}

function buildDocumentBaseName(
  confirmation: ConfirmationDocumentRecord,
  draftPayload: ConfirmationDraftPayload
) {
  const counterparty =
    draftPayload.bankName?.trim() ||
    draftPayload.recipientName?.trim() ||
    confirmation.counterpartyName ||
    "counterparty";
  const code =
    confirmation.confirmationCode?.trim() ||
    draftPayload.projectCode?.trim() ||
    confirmation.project?.projectCode ||
    "confirmation";
  return sanitizeFileName(`${code}-${counterparty}-confirmation`);
}

function isPdfCustomTemplate(
  templateCode: ConfirmationDraftTemplateCode,
  draftPayload: ConfirmationDraftPayload
) {
  if (!isConfirmationCustomTemplateCode(templateCode)) {
    return false;
  }
  const source = isRecord(
    (draftPayload as Record<string, unknown>).templateLibrarySource
  )
    ? ((draftPayload as Record<string, unknown>)
        .templateLibrarySource as Record<string, unknown>)
    : null;
  return (
    source?.mimeType === PDF_MIME_TYPE ||
    (typeof source?.fileName === "string" &&
      source.fileName.toLowerCase().endsWith(".pdf"))
  );
}

function shouldUseCanonicalDynamicTemplatePdf(
  templateCode: ConfirmationDraftTemplateCode,
  draftPayload: ConfirmationDraftPayload
) {
  if (isConfirmationCustomTemplateCode(templateCode)) {
    return true;
  }
  if (!supportsDynamicTemplateFields(templateCode)) {
    return false;
  }
  const fields = parseDynamicTemplateFields(
    (draftPayload as Record<string, unknown>).templateDesignSchema
  );
  return Boolean(fields?.length);
}

async function renderDynamicTemplatePdf(input: {
  confirmation: ConfirmationDocumentRecord;
  documentConversion: DocumentConversionService;
  draftPayload: ConfirmationDraftPayload;
  storage: StorageService;
  templateCode: ConfirmationDraftTemplateCode;
}) {
  let sourcePdf: Buffer;
  if (isConfirmationCustomTemplateCode(input.templateCode)) {
    const source = await loadTemplateBody(
      input.storage,
      input.templateCode,
      input.draftPayload
    );
    sourcePdf = isPdfCustomTemplate(input.templateCode, input.draftPayload)
      ? source
      : await input.documentConversion.convertOfficeBufferToPdf({
          fileName: getCustomTemplateSourceFileName(input.draftPayload),
          mimeType: DOCX_MIME_TYPE,
          body: await renderConfirmationDocx(
            {
              confirmation: input.confirmation,
              draftPayload: input.draftPayload,
              storage: input.storage,
              templateCode: input.templateCode,
            },
            { materializeDynamicFields: false }
          ),
        });
  } else {
    sourcePdf = await input.documentConversion.convertOfficeBufferToPdf({
      fileName: TEMPLATE_FILES[input.templateCode],
      mimeType: DOCX_MIME_TYPE,
      body: await renderConfirmationDocx(
        {
          confirmation: input.confirmation,
          draftPayload: input.draftPayload,
          storage: input.storage,
          templateCode: input.templateCode,
        },
        { materializeDynamicFields: false }
      ),
    });
  }
  return renderDynamicTemplateFieldsOnPdf({
    draftPayload: input.draftPayload,
    source: sourcePdf,
    templateCode: input.templateCode,
  });
}

function getCustomTemplateSourceFileName(
  draftPayload: ConfirmationDraftPayload
) {
  const source = isRecord(
    (draftPayload as Record<string, unknown>).templateLibrarySource
  )
    ? ((draftPayload as Record<string, unknown>)
        .templateLibrarySource as Record<string, unknown>)
    : null;
  const fileName =
    typeof source?.fileName === "string" ? source.fileName.trim() : "";
  return fileName.toLowerCase().endsWith(".docx")
    ? fileName
    : "confirmation-template.docx";
}

export async function renderDynamicTemplateFieldsOnPdf(input: {
  draftPayload: ConfirmationDraftPayload;
  source: Buffer;
  templateCode: ConfirmationDraftTemplateCode;
}) {
  const document = await PDFDocument.load(input.source);
  const fields = parseDynamicTemplateFields(
    (input.draftPayload as Record<string, unknown>).templateDesignSchema
  );
  if (!fields?.length) {
    return input.source;
  }
  if (!supportsDynamicTemplateFields(input.templateCode)) {
    throwInvalidDynamicTemplate(
      `dynamic fields are not supported for ${input.templateCode}`
    );
  }

  const payload = input.draftPayload as Record<string, unknown>;
  if (
    payload.templateFieldValues !== undefined &&
    !isRecord(payload.templateFieldValues)
  ) {
    throwInvalidDynamicTemplate("field values must be an object");
  }
  const fieldValues = payload.templateFieldValues ?? {};
  const fontCache = new Map<string, EmbeddedPdfFont>();

  for (const field of fields) {
    const page = document.getPages()[field.page - 1];
    if (!page) {
      throwInvalidDynamicTemplate(
        `dynamic field "${field.id}" page ${field.page} cannot be rendered`
      );
    }
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = field.x * pageWidth;
    const width = field.width * pageWidth;
    const height = field.height * pageHeight;
    const y = pageHeight - (field.y + field.height) * pageHeight;
    const textStyle = {
      ...DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE,
      ...field.textStyle,
    };
    const backgroundColor =
      field.kind === "MASK" ||
      (isConfirmationCustomTemplateCode(input.templateCode) &&
        textStyle.backgroundColor === "transparent")
        ? "#FFFFFF"
        : textStyle.backgroundColor;
    if (backgroundColor && backgroundColor !== "transparent") {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: pdfRgbFromHex(backgroundColor),
        borderWidth: 0,
      });
    }
    if (field.kind === "MASK") {
      continue;
    }

    const value = resolveDynamicTemplateFieldValue(
      field,
      fieldValues
    );
    if (!value) {
      continue;
    }

    const formattedValue = formatDynamicTemplateFieldValue(field, value);
    const displayText =
      field.kind === "MULTILINE" || field.kind === "STATIC_TEXT"
        ? formattedValue.trim()
        : normalizeTemplateFieldDisplayText(formattedValue);
    const renderFontFamily = getTemplateFieldRenderFontFamily(
      textStyle,
      displayText
    );
    const fontKey = `${renderFontFamily}-${textStyle.bold ? "bold" : "regular"}-${textStyle.italic ? "italic" : "normal"}`;
    let font = fontCache.get(fontKey);
    if (!font) {
      font = await embedPdfFont(
        document,
        { ...textStyle, fontFamily: renderFontFamily },
        displayText
      );
      fontCache.set(fontKey, font);
    }
    const text = font.supportsUnicode ? displayText : toPdfText(displayText);
    const maxWidth = Math.max(4, width - 4);
    const isMultiline = field.kind === "MULTILINE";
    const lines = isMultiline
      ? wrapPdfMultilineText(font.font, text, textStyle.fontSize, maxWidth)
      : field.kind === "STATIC_TEXT"
        ? text.split(/\r?\n/gu)
        : [text];
    const lineHeightLimit = Math.max(4, (height - 2) / lines.length);
    const fontSize = isMultiline
      ? textStyle.fontSize
      : Math.min(
          ...lines.map((line) =>
            fitPdfFontSize(
              font.font,
              line,
              textStyle.fontSize,
              maxWidth,
              lineHeightLimit
            )
          )
        );
    if (isMultiline && lines.length * fontSize > height - 2) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `多行字段“${field.id}”内容超出填写框，请增大填写框或减少内容。`
      );
    }
    lines.forEach((line, lineIndex) => {
      const clippedText = clipPdfTextToWidth(
        font.font,
        line,
        fontSize,
        maxWidth
      );
      if (!clippedText) {
        return;
      }
      const textWidth = font.font.widthOfTextAtSize(clippedText, fontSize);
      const textX =
        field.textAlign === "center"
          ? x + Math.max(2, (width - textWidth) / 2)
          : field.textAlign === "right"
            ? x + Math.max(2, width - textWidth - 2)
            : x + 2;
      const textY = y + Math.max(1, height - fontSize * (lineIndex + 1) - 2);
      const color = pdfRgbFromHex(textStyle.textColor ?? "#000000");
      page.drawText(clippedText, {
        x: textX,
        y: textY,
        size: fontSize,
        font: font.font,
        color,
        ySkew: degrees(font.syntheticItalic ? 12 : 0),
      });
      if (textStyle.underline) {
        const underlineY = textY - fontSize * 0.1;
        page.drawLine({
          start: { x: textX, y: underlineY },
          end: { x: textX + textWidth, y: underlineY },
          thickness: Math.max(0.5, fontSize / 16),
          color,
        });
      }
    });
  }

  return Buffer.from(await document.save());
}

type EmbeddedPdfFont = {
  font: PDFFont;
  supportsUnicode: boolean;
  syntheticItalic?: boolean;
};

async function embedPdfFont(
  document: PDFDocument,
  textStyle: ConfirmationTemplateTextStyle | undefined,
  text: string
): Promise<EmbeddedPdfFont> {
  const unicodeFontPath = findPdfUnicodeFontPath(textStyle, text);
  if (unicodeFontPath) {
    document.registerFontkit(pdfLibFontkit);
    const fontBytes = await readFile(unicodeFontPath);
    const sourceFont = pdfLibFontkit.create(fontBytes);
    return {
      syntheticItalic: Boolean(textStyle?.italic && !sourceFont.italicAngle),
      font: await document.embedFont(fontBytes, {
        subset: true,
      }),
      supportsUnicode: true,
    };
  }
  if (textStyle?.bold && textStyle.italic) {
    return {
      font: await document.embedFont(StandardFonts.HelveticaBoldOblique),
      supportsUnicode: false,
    };
  }
  if (textStyle?.bold) {
    return {
      font: await document.embedFont(StandardFonts.HelveticaBold),
      supportsUnicode: false,
    };
  }
  if (textStyle?.italic) {
    return {
      font: await document.embedFont(StandardFonts.HelveticaOblique),
      supportsUnicode: false,
    };
  }
  return {
    font: await document.embedFont(StandardFonts.Helvetica),
    supportsUnicode: false,
  };
}

function findPdfUnicodeFontPath(
  textStyle: ConfirmationTemplateTextStyle | undefined,
  text: string
) {
  const style = textStyle ?? DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE;
  const variant: PdfFontVariant = style.bold
    ? style.italic
      ? "boldItalic"
      : "bold"
    : style.italic
      ? "italic"
      : "regular";
  const family = containsCjkText(text)
    ? DEFAULT_CONFIRMATION_TEMPLATE_TEXT_STYLE.fontFamily
    : style.fontFamily;
  const candidates = PDF_FONT_PATHS[family][variant];
  return candidates.find((path) => existsSync(path));
}

function containsCjkText(text: string) {
  return /[\u2E80-\u2FFF\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/u.test(text);
}

function wrapPdfMultilineText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number
) {
  return text.split(/\r?\n/gu).flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) {
        const space = line.lastIndexOf(" ");
        if (space >= 0) {
          lines.push(line.slice(0, space + 1));
          line = line.slice(space + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }
      line += character;
    }
    lines.push(line);
    return lines;
  });
}

function fitPdfFontSize(
  font: PDFFont,
  text: string,
  initialSize: number,
  maxWidth: number,
  maxHeight: number
) {
  let size = initialSize;
  while (
    size > 4 &&
    (font.widthOfTextAtSize(text, size) > maxWidth ||
      font.heightAtSize(size, { descender: false }) > maxHeight)
  ) {
    size = Math.max(4, size - 0.5);
  }
  return size;
}

function clipPdfTextToWidth(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }
  let clipped = "";
  for (const character of text) {
    const next = `${clipped}${character}`;
    if (font.widthOfTextAtSize(next, size) > maxWidth) {
      break;
    }
    clipped = next;
  }
  return clipped;
}

function normalizeTemplateFieldDisplayText(value: string) {
  return value.replaceAll(/\s+/gu, " ").trim();
}

function pdfRgbFromHex(value: string) {
  const normalized = value.replace(/^#/u, "");
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255
  );
}

function getTemplateFieldRenderFontFamily(
  textStyle: ConfirmationTemplateTextStyle,
  text: string
): ConfirmationTemplateFontFamily {
  return containsCjkText(text) ? "Noto Sans SC" : textStyle.fontFamily;
}

function toPdfText(value: string) {
  let normalized = "";
  for (const character of value) {
    normalized += (character.codePointAt(0) ?? 0) <= 0xff ? character : "?";
  }
  return normalized;
}

async function renderConfirmationDocx(
  input: {
    confirmation: ConfirmationDocumentRecord;
    draftPayload: ConfirmationDraftPayload;
    storage: StorageService;
    templateCode: ConfirmationDraftTemplateCode;
  },
  options: { materializeDynamicFields?: boolean } = {}
) {
  const zip = await JSZip.loadAsync(
    await loadTemplateBody(
      input.storage,
      input.templateCode,
      input.draftPayload
    )
  );
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "函证模板文件缺少 Word 正文内容"
    );
  }

  const values = buildTemplateValues(input);
  const xml = await document.async("string");
  const sourceXml = removeDynamicTemplateSourceText(
    xml,
    input.draftPayload,
    input.templateCode
  );
  const patchedXml = isConfirmationCustomTemplateCode(input.templateCode)
    ? sourceXml
    : patchTemplateDocumentXml(sourceXml, input.templateCode, values);
  zip.file(
    "word/document.xml",
    options.materializeDynamicFields === false
      ? patchedXml
      : materializeDynamicTemplateFields(
          patchedXml,
          input.draftPayload,
          input.templateCode
        )
  );
  await stripTemplateHighlightingFromPackage(zip);
  await sanitizeTemplatePackageMetadata(zip);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function renderManagedOverlayPreviewDocx(input: {
  draftPayload: ConfirmationDraftPayload;
  storage: StorageService;
  templateCode: ConfirmationDraftTemplateCode;
}) {
  const templateBody = await loadTemplateBody(
    input.storage,
    input.templateCode,
    input.draftPayload
  );
  const fields = parseDynamicTemplateFields(
    (input.draftPayload as Record<string, unknown>).templateDesignSchema
  );
  if (
    !getDynamicTemplateSourceFields(fields, input.templateCode).some(
      (field) =>
        field.sourceRanges?.length ||
        getLegacyManagedSourceText(field, input.templateCode)
    )
  ) {
    return templateBody;
  }

  const zip = await JSZip.loadAsync(templateBody);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "函证模板文件缺少 Word 正文内容"
    );
  }

  const xml = await document.async("string");
  zip.file(
    "word/document.xml",
    removeDynamicTemplateSourceText(xml, input.draftPayload, input.templateCode)
  );
  await stripTemplateHighlightingFromPackage(zip);
  await sanitizeTemplatePackageMetadata(zip);
  return zip.generateAsync({ type: "nodebuffer" });
}

function getDynamicTemplateSourceFields(
  fields: DynamicTemplateField[] | null,
  templateCode: ConfirmationDraftTemplateCode
) {
  if (!fields) {
    return [];
  }
  return [
    ...(getDefaultConfirmationTemplateDesign(templateCode)?.fields ?? []),
    ...fields,
  ] as DynamicTemplateField[];
}

export type ConfirmationTemplateValues = {
  accountNumber: string;
  auditPeriodText: string;
  auditorAddress: string;
  auditorName: string;
  authorizationAccount: string;
  bankDisplayName: string;
  bankName: string;
  clientCode: string;
  clientName: string;
  companyHandlerName: string;
  companyHandlerPhone: string;
  companyHandlerTitle: string;
  companySignatureDateText: string;
  counterpartyAddress: string;
  customerName: string;
  englishReportDate: string;
  officeDate: string;
  micEmail: string;
  micName: string;
  micNameAndInitial: string;
  projectCode: string;
  recipientAddress: string;
  recipientName: string;
  receivingSupplement: string;
  referenceCode: string;
  replyAddress: string;
  replyContact: string;
  replyEmail: string;
  replyFax: string;
  replyPhone: string;
  replyPostalCode: string;
  reportDateText: string;
  picName: string;
  salutation: string;
  yearEndDate: string;
};

function buildTemplateValues({
  confirmation,
  draftPayload,
  templateCode,
}: {
  confirmation: ConfirmationDocumentRecord;
  draftPayload: ConfirmationDraftPayload;
  templateCode: ConfirmationDraftTemplateCode;
}): ConfirmationTemplateValues {
  const clientName =
    draftPayload.clientName?.trim() || confirmation.project?.name || "-";
  const projectCode =
    draftPayload.projectCode?.trim() ||
    confirmation.confirmationCode?.trim() ||
    confirmation.project?.projectCode ||
    "-";
  const clientCode = getDraftString(draftPayload, "clientCode") || projectCode;
  const fiscalYear =
    getDraftString(draftPayload, "fiscalYear") ||
    confirmation.auditPeriod?.trim() ||
    "";
  const reportDateSource =
    templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
    isSecuritiesTemplate(templateCode)
      ? draftPayload.reportDate?.trim() ||
        getDraftString(draftPayload, "balanceSheetDate") ||
        confirmation.project?.reportDate ||
        ""
      : getDraftString(draftPayload, "balanceSheetDate") ||
        draftPayload.reportDate?.trim() ||
        confirmation.project?.reportDate ||
        "";
  const bankName =
    draftPayload.bankName?.trim() || confirmation.counterpartyName || "-";
  const bankBranch = draftPayload.bankBranch?.trim();
  const picName =
    draftPayload.picName?.trim() || confirmation.responsibleUser?.name || "-";
  const draftReferenceCode = getDraftString(draftPayload, "referenceCode");
  return {
    accountNumber: getDraftString(draftPayload, "accountNumber"),
    auditPeriodText:
      fiscalYear ||
      (reportDateSource
        ? `截至${formatChineseDate(reportDateSource)}止年度（或期间）`
        : "相关年度（或期间）"),
    authorizationAccount:
      draftPayload.authorizationAccount?.trim() || "__________",
    auditorAddress: getDraftString(draftPayload, "auditorAddress"),
    auditorName: getDraftString(draftPayload, "auditorName"),
    bankDisplayName: bankBranch ? `${bankName}${bankBranch}` : bankName,
    bankName,
    clientCode,
    clientName,
    companyHandlerName: getDraftString(draftPayload, "companyHandlerName"),
    companyHandlerPhone: getDraftString(draftPayload, "companyHandlerPhone"),
    companyHandlerTitle: getDraftString(draftPayload, "companyHandlerTitle"),
    companySignatureDateText: formatChineseDate(
      getDraftString(draftPayload, "companySignatureDate")
    ),
    counterpartyAddress: draftPayload.counterpartyAddress?.trim() || "",
    customerName: getDraftString(draftPayload, "customerName") || clientName,
    englishReportDate: formatEnglishDate(reportDateSource),
    officeDate: formatEnglishDate(getDraftString(draftPayload, "officeDate")),
    micEmail: getDraftString(draftPayload, "micEmail"),
    micName: getDraftString(draftPayload, "micName"),
    micNameAndInitial:
      getDraftString(draftPayload, "micNameAndInitial") ||
      getDraftString(draftPayload, "micName"),
    projectCode,
    recipientAddress: getDraftString(draftPayload, "recipientAddress"),
    recipientName:
      getDraftString(draftPayload, "recipientName") ||
      confirmation.counterpartyName ||
      "",
    receivingSupplement: getDraftString(draftPayload, "receivingSupplement"),
    referenceCode:
      isManagedEnglishTemplate(templateCode) &&
      isProjectIdentityReference(
        draftReferenceCode,
        draftPayload,
        clientCode,
        projectCode,
        confirmation.project?.projectCode,
        picName,
        confirmation.responsibleUser?.name
      )
        ? ""
        : draftReferenceCode ||
          (isManagedEnglishTemplate(templateCode)
            ? ""
            : [clientCode, picName].filter(Boolean).join("/")),
    replyAddress: getDraftString(draftPayload, "replyAddress"),
    replyContact: getDraftString(draftPayload, "replyContact"),
    replyEmail: getDraftString(draftPayload, "replyEmail"),
    replyFax: getDraftString(draftPayload, "replyFax"),
    replyPhone: getDraftString(draftPayload, "replyPhone"),
    replyPostalCode: getDraftString(draftPayload, "replyPostalCode"),
    reportDateText: formatChineseDate(reportDateSource),
    picName,
    salutation: getDraftString(draftPayload, "salutation") || "Sir/Madam",
    yearEndDate: formatEnglishDate(
      getDraftString(draftPayload, "yearEndDate") || reportDateSource
    ),
  };
}

function isProjectIdentityReference(
  referenceCode: string,
  draftPayload: ConfirmationDraftPayload,
  clientCode: string,
  projectCode: string,
  projectRecordCode: string | null | undefined,
  picName: string,
  responsibleUserName: string | null | undefined
) {
  if (!referenceCode) {
    return false;
  }

  const codeCandidates = [
    getDraftString(draftPayload, "clientCode"),
    getDraftString(draftPayload, "projectCode"),
    clientCode,
    projectCode,
    projectRecordCode?.trim() ?? "",
  ].filter((value) => value && value !== "-");
  const picCandidates = [
    getDraftString(draftPayload, "picName"),
    picName,
    responsibleUserName?.trim() ?? "",
  ].filter((value) => value && value !== "-");

  return codeCandidates.some((code) =>
    picCandidates.some((pic) => `${code}/${pic}` === referenceCode)
  );
}

function patchTemplateDocumentXml(
  xml: string,
  templateCode: ConfirmationDraftTemplateCode,
  values: ConfirmationTemplateValues
) {
  const withoutInstructions =
    isEnglishBankTemplate(templateCode) || isSecuritiesTemplate(templateCode)
      ? xml
      : removePrcInstructionBlocks(xml, templateCode);
  const withValues = isSecuritiesTemplate(templateCode)
    ? replaceSecuritiesTemplateContentControls(
        withoutInstructions,
        templateCode,
        values
      )
    : templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
        templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      ? replaceStandardTemplateContentControls(
          withoutInstructions,
          values,
          templateCode
        )
      : replaceParagraphText(withoutInstructions, (text) =>
          getParagraphReplacement(text, templateCode, values)
        );
  return stripTemplateHighlighting(
    replaceEnglishTemplateText(withValues, templateCode, values)
  );
}

type DynamicTemplateField = {
  baseInformationBinding?: ConfirmationTemplateDesignFieldBinding;
  defaultChecked?: boolean;
  defaultValueSource?:
    | {
        binding: ConfirmationTemplateDesignFieldBinding;
        source: "BASE_INFORMATION" | "INFORMATION_LIBRARY";
      }
    | { source: "CUSTOM"; value: string }
    | { source: "SYSTEM"; value: "CURRENT_DATE" };
  informationLibraryBinding?: ConfirmationTemplateDesignFieldBinding;
  binding?: ConfirmationTemplateDesignFieldBinding;
  id: string;
  kind:
    | "TEXT"
    | "MULTILINE"
    | "NUMBER"
    | "DATE"
    | "CHECKBOX"
    | "SELECT"
    | "RADIO"
    | "STATIC_TEXT"
    | "MASK";
  options: string[];
  page: number;
  placeholder?: string;
  required?: boolean;
  textStyle?: ConfirmationTemplateTextStyle;
  textAlign?: "left" | "center" | "right";
  x: number;
  y: number;
  width: number;
  height: number;
  sourceRanges?: ConfirmationTemplateDesignFieldSourceRange[];
};

const TO_THE_MANAGER_SOURCE_CENTER = {
  page: 1,
  x: 0.282,
  y: 0.147,
};

function removeDynamicTemplateSourceText(
  xml: string,
  draftPayload: ConfirmationDraftPayload,
  templateCode: ConfirmationDraftTemplateCode
) {
  const fields = parseDynamicTemplateFields(
    (draftPayload as Record<string, unknown>).templateDesignSchema
  );
  if (!fields) {
    return xml;
  }
  assertManagedSourceFieldsAreAnchored(fields, templateCode);
  const sourceFields = getDynamicTemplateSourceFields(fields, templateCode);
  const paragraphs = findXmlElementRanges(xml, "w:p").sort(
    (left, right) => left.start - right.start
  );
  const sourceRangesByParagraph = new Map<
    number,
    ConfirmationTemplateDesignFieldSourceRange[]
  >();
  for (const field of sourceFields) {
    for (const range of getDynamicTemplateSourceRanges(
      xml,
      paragraphs,
      field,
      templateCode
    )) {
      const paragraphOrdinal = resolveSourceRangeParagraphOrdinal(
        xml,
        paragraphs,
        range
      );
      const current = sourceRangesByParagraph.get(paragraphOrdinal) ?? [];
      current.push(range);
      sourceRangesByParagraph.set(paragraphOrdinal, current);
    }
  }
  if (sourceRangesByParagraph.size === 0) {
    return xml;
  }

  let result = xml;
  for (const [paragraphOrdinal, ranges] of [
    ...sourceRangesByParagraph.entries(),
  ].sort(([left], [right]) => right - left)) {
    const paragraph = paragraphs[paragraphOrdinal];
    if (!paragraph) {
      throwInvalidDynamicTemplate(
        `source paragraph ${paragraphOrdinal} cannot be resolved`
      );
    }
    const paragraphXml = result.slice(paragraph.start, paragraph.end);
    const replacement = replaceWordParagraphTextRanges(
      paragraphXml,
      mergeSourceRanges(ranges)
    );
    result = `${result.slice(0, paragraph.start)}${replacement}${result.slice(paragraph.end)}`;
  }
  return result;
}

function getDynamicTemplateSourceRanges(
  xml: string,
  paragraphs: XmlElementRange[],
  field: DynamicTemplateField,
  templateCode: ConfirmationDraftTemplateCode
) {
  if (field.sourceRanges?.length) {
    return field.sourceRanges;
  }
  return getLegacyManagedSourceTexts(field, templateCode).flatMap(
    (sourceText) => {
      const occurrence = getLegacyManagedSourceOccurrence(
        field,
        templateCode,
        sourceText
      );
      const location = findLegacyManagedSourceLocation(
        xml,
        paragraphs,
        sourceText,
        occurrence
      );
      const paragraphOrdinal = location?.paragraphOrdinal ?? -1;
      const paragraph = paragraphs[paragraphOrdinal];
      if (!paragraph) {
        if (isBuiltInManagedField(field, templateCode)) {
          return [];
        }
        throwInvalidDynamicTemplate(
          `managed source text "${sourceText}" cannot be resolved`
        );
      }
      const paragraphXml = xml.slice(paragraph.start, paragraph.end);
      const start = location?.start ?? -1;
      if (start < 0) {
        if (isBuiltInManagedField(field, templateCode)) {
          return [];
        }
        throwInvalidDynamicTemplate(
          `managed source text "${sourceText}" cannot be resolved`
        );
      }

      const paragraphId = getWordParagraphId(paragraphXml);
      return [
        {
          end: start + sourceText.length,
          ...(paragraphId ? { paragraphId } : {}),
          paragraphOrdinal,
          paragraphXmlSha256: createHash("sha256")
            .update(paragraphXml)
            .digest("hex"),
          part: "word/document.xml" as const,
          sourceText,
          start,
        },
      ];
    }
  );
}

function isBuiltInManagedField(
  field: DynamicTemplateField,
  templateCode: ConfirmationDraftTemplateCode
) {
  return Boolean(
    getDefaultConfirmationTemplateDesign(templateCode)?.fields.some(
      (defaultField) => defaultField.id === field.id
    )
  );
}

function findLegacyManagedSourceLocation(
  xml: string,
  paragraphs: XmlElementRange[],
  sourceText: string,
  occurrence: number
) {
  let seen = 0;
  for (const [paragraphOrdinal, paragraph] of paragraphs.entries()) {
    const paragraphText = getWordParagraphText(
      xml.slice(paragraph.start, paragraph.end)
    );
    let searchStart = 0;
    while (searchStart <= paragraphText.length - sourceText.length) {
      const start = paragraphText.indexOf(sourceText, searchStart);
      if (start === -1) {
        break;
      }
      if (seen === occurrence) {
        return { paragraphOrdinal, start };
      }
      seen += 1;
      searchStart = start + sourceText.length;
    }
  }
  return null;
}

function getLegacyManagedSourceTexts(
  field: DynamicTemplateField,
  templateCode: ConfirmationDraftTemplateCode
) {
  if (
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" ||
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
  ) {
    const sourceTextsByFieldId: Record<string, string[]> = {
      "confirmation-securities-reference": ["Ref:"],
      "confirmation-securities-date": ["Date:"],
      "confirmation-securities-recipient-name": ["[Recipient Name]"],
      "confirmation-securities-recipient-address": ["[Recipient Address]"],
      "confirmation-securities-auditor-name-intro": ["[Auditor Name]"],
      "confirmation-securities-year-end-date": ["[Year end date]"],
      "confirmation-securities-auditor-name-reply": ["[Auditor Name]"],
      "confirmation-securities-auditor-address": ["[Auditor Address]"],
      "confirmation-securities-mic-name": ["[MIC Name]"],
      "confirmation-securities-client-name": ["[Client Name]"],
      "confirmation-securities-client-name-intro": ["[Client’s Name]"],
      "confirmation-securities-auditor-name": ["[Auditor Name]"],
      "confirmation-securities-auditor-address-type-2": ["[Auditor Address]"],
      "confirmation-securities-mic-email": ["[MIC Email]"],
      "confirmation-securities-mic-name-and-initial": [
        "[MIC Name and Initial]",
      ],
      "confirmation-securities-year-end-date-type-2": ["[Year end date]"],
      "confirmation-securities-client-name-closing": ["[Client’s Name]"],
    };
    return sourceTextsByFieldId[field.id] ?? [];
  }
  if (
    templateCode !== "STANDARD_FINANCIAL_INSTITUTION" &&
    templateCode !== "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
  ) {
    return [];
  }
  const placeholder = normalizeText(field.placeholder ?? "")
    .replaceAll(/[()]/g, "")
    .replaceAll(/[‘’]/g, "'")
    .toLocaleLowerCase();
  switch (placeholder) {
    case "to the manager": {
      return ["(To The Manager)"];
    }
    case "bank office":
    case "name of bank": {
      return ["(Name of bank)", "Office"];
    }
    case "date": {
      return ["Date", "(Date)"];
    }
    case "ref":
    case "reference": {
      return ["Ref", "(Reference)"];
    }
    case "custer's name":
    case "customer's name": {
      return ["(Customer’s Name)"];
    }
    default: {
      return [];
    }
  }
}

function getLegacyManagedSourceOccurrence(
  field: DynamicTemplateField,
  templateCode: ConfirmationDraftTemplateCode,
  sourceText: string
) {
  if (
    sourceText === "[Auditor Name]" &&
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" &&
    field.id === "confirmation-securities-auditor-name-reply"
  ) {
    return 1;
  }
  if (
    sourceText === "[Client’s Name]" &&
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2" &&
    field.id === "confirmation-securities-client-name-closing"
  ) {
    return 1;
  }
  return 0;
}

function getLegacyManagedSourceText(
  field: DynamicTemplateField,
  templateCode: ConfirmationDraftTemplateCode
) {
  return getLegacyManagedSourceTexts(field, templateCode)[0];
}

function assertManagedSourceFieldsAreAnchored(
  fields: DynamicTemplateField[],
  templateCode: ConfirmationDraftTemplateCode
) {
  if (
    templateCode !== "STANDARD_FINANCIAL_INSTITUTION" &&
    templateCode !== "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
  ) {
    return;
  }

  for (const field of fields) {
    if (
      field.sourceRanges?.length ||
      getLegacyManagedSourceText(field, templateCode)
    ) {
      continue;
    }
    const normalizedPlaceholder = normalizeText(field.placeholder ?? "")
      .replaceAll(/^\(|\)$/g, "")
      .toLocaleLowerCase();
    const coversSourceCenter =
      field.page === TO_THE_MANAGER_SOURCE_CENTER.page &&
      field.x <= TO_THE_MANAGER_SOURCE_CENTER.x &&
      field.x + field.width >= TO_THE_MANAGER_SOURCE_CENTER.x &&
      field.y <= TO_THE_MANAGER_SOURCE_CENTER.y &&
      field.y + field.height >= TO_THE_MANAGER_SOURCE_CENTER.y;
    if (coversSourceCenter || normalizedPlaceholder === "to the manager") {
      throwInvalidDynamicTemplate(
        `dynamic field "${field.id}" overlaps the managed To The Manager source and must declare sourceRanges`
      );
    }
  }
}

function resolveSourceRangeParagraphOrdinal(
  xml: string,
  paragraphs: XmlElementRange[],
  range: ConfirmationTemplateDesignFieldSourceRange
) {
  if (range.part !== "word/document.xml") {
    throwInvalidDynamicTemplate("source range must target word/document.xml");
  }
  const paragraph = paragraphs[range.paragraphOrdinal];
  if (!paragraph) {
    throwInvalidDynamicTemplate(
      `source paragraph ${range.paragraphOrdinal} cannot be resolved`
    );
  }
  const paragraphXml = xml.slice(paragraph.start, paragraph.end);
  const actualHash = createHash("sha256").update(paragraphXml).digest("hex");
  if (actualHash !== range.paragraphXmlSha256) {
    throwInvalidDynamicTemplate(
      "source paragraph no longer matches its saved anchor"
    );
  }
  const actualParagraphId = getWordParagraphId(paragraphXml);
  if (
    range.paragraphId !== undefined &&
    range.paragraphId.toUpperCase() !== actualParagraphId
  ) {
    throwInvalidDynamicTemplate(
      "source paragraph no longer matches its saved anchor"
    );
  }
  const paragraphText = getWordParagraphText(paragraphXml);
  if (
    range.end > paragraphText.length ||
    paragraphText.slice(range.start, range.end) !== range.sourceText
  ) {
    throwInvalidDynamicTemplate(
      "source text no longer matches its saved anchor"
    );
  }
  return range.paragraphOrdinal;
}

function getWordParagraphText(paragraphXml: string) {
  return Array.from(
    paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => unescapeXml(match[1] ?? "")
  ).join("");
}

function getWordParagraphId(paragraphXml: string) {
  return paragraphXml
    .match(/\bw14:paraId\s*=\s*["']([\dA-Fa-f]{8})["']/)?.[1]
    ?.toUpperCase();
}

function mergeSourceRanges(
  ranges: ConfirmationTemplateDesignFieldSourceRange[]
) {
  const sorted = [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end
  );
  const merged: { end: number; start: number }[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ end: range.end, start: range.start });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

function replaceWordParagraphTextRanges(
  paragraphXml: string,
  ranges: { end: number; start: number }[]
) {
  let offset = 0;
  return paragraphXml.replaceAll(
    /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,
    (_match, openTag: string, encodedText: string, closeTag: string) => {
      const text = unescapeXml(encodedText);
      const textStart = offset;
      const textEnd = textStart + text.length;
      offset = textEnd;
      if (
        !ranges.some((range) => range.start < textEnd && range.end > textStart)
      ) {
        return `${openTag}${encodedText}${closeTag}`;
      }
      let replacement = "";
      for (let index = 0; index < text.length; index += 1) {
        replacement += ranges.some(
          (range) =>
            textStart + index >= range.start && textStart + index < range.end
        )
          ? "\u00A0"
          : text[index];
      }
      return `${openTag}${escapeXml(replacement)}${closeTag}`;
    }
  );
}

function materializeDynamicTemplateFields(
  xml: string,
  draftPayload: ConfirmationDraftPayload,
  templateCode: ConfirmationDraftTemplateCode
) {
  const payload = draftPayload as Record<string, unknown>;
  const fields = parseDynamicTemplateFields(payload.templateDesignSchema);
  if (!fields) {
    return xml;
  }
  if (fields.length === 0) {
    return xml;
  }
  if (!supportsDynamicTemplateFields(templateCode)) {
    throwInvalidDynamicTemplate(
      `dynamic fields are not supported for ${templateCode}`
    );
  }

  const pageSize = getDocumentPageSize(xml);
  const pageAnchors = getPageAnchorParagraphs(xml);
  if (
    payload.templateFieldValues !== undefined &&
    !isRecord(payload.templateFieldValues)
  ) {
    throwInvalidDynamicTemplate("field values must be an object");
  }
  const fieldValues = payload.templateFieldValues ?? {};
  const overlaysByAnchor = new Map<number, string[]>();

  for (const [fieldIndex, field] of fields.entries()) {
    const anchor = pageAnchors[field.page - 1];
    if (!anchor) {
      throwInvalidDynamicTemplate(
        `dynamic field "${field.id}" page ${field.page} cannot be anchored`
      );
    }
    const value = resolveDynamicTemplateFieldValue(
      field,
      fieldValues
    );
    const overlay = buildDynamicTemplateShape(
      field,
      value,
      pageSize,
      fieldIndex,
      isConfirmationCustomTemplateCode(templateCode)
    );
    const current = overlaysByAnchor.get(anchor.end) ?? [];
    current.push(overlay);
    overlaysByAnchor.set(anchor.end, current);
  }

  let result = xml;
  for (const [paragraphEnd, overlays] of [...overlaysByAnchor].sort(
    ([left], [right]) => right - left
  )) {
    const insertAt = paragraphEnd - "</w:p>".length;
    result = `${result.slice(0, insertAt)}${overlays.join("")}${result.slice(insertAt)}`;
  }
  return result;
}

function resolveDynamicTemplateFieldValue(
  field: DynamicTemplateField,
  fieldValues: Record<string, unknown>
) {
  if (field.kind === "STATIC_TEXT") {
    return field.placeholder?.trim() ?? "";
  }
  const defaultValue =
    field.defaultValueSource?.source === "SYSTEM"
      ? formatDateInputValue(new Date())
      : field.defaultValueSource?.source === "CUSTOM"
        ? field.defaultValueSource.value
        : undefined;
  const rawValue = Object.hasOwn(fieldValues, field.id)
    ? fieldValues[field.id]
    : (defaultValue ??
      (field.kind === "CHECKBOX"
        ? field.defaultChecked === true
          ? "true"
          : "false"
        : undefined));
  if (
    field.kind !== "MASK" &&
    rawValue !== undefined &&
    typeof rawValue !== "string"
  ) {
    throwInvalidDynamicTemplate(`field "${field.id}" value must be a string`);
  }
  const value =
    field.kind === "MASK" || typeof rawValue !== "string"
      ? ""
      : rawValue.trim();
  if (
    (field.kind === "SELECT" || field.kind === "RADIO") &&
    value &&
    !field.options.includes(value)
  ) {
    throwInvalidDynamicTemplate(
      `${field.kind} field "${field.id}" value must match one of its options`
    );
  }
  if (
    field.kind === "NUMBER" &&
    value &&
    !/^-?(?:\d+|\d*\.\d+)$/u.test(value)
  ) {
    throwInvalidDynamicTemplate(`NUMBER field "${field.id}" value is invalid`);
  }
  if (
    field.kind === "DATE" &&
    value &&
    (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(value)))
  ) {
    throwInvalidDynamicTemplate(`DATE field "${field.id}" value is invalid`);
  }
  if (
    field.kind === "CHECKBOX" &&
    value &&
    value !== "true" &&
    value !== "false"
  ) {
    throwInvalidDynamicTemplate(
      `CHECKBOX field "${field.id}" value must be true or false`
    );
  }
  return value;
}

function formatDateInputValue(value: Date) {
  const localTime = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000
  );
  return localTime.toISOString().slice(0, 10);
}

function supportsDynamicTemplateFields(
  templateCode: ConfirmationDraftTemplateCode
) {
  return (
    isConfirmationCustomTemplateCode(templateCode) ||
    templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
    isSecuritiesTemplate(templateCode)
  );
}

function parseDynamicTemplateFields(
  design: unknown
): DynamicTemplateField[] | null {
  if (design === undefined || design === null) {
    return null;
  }
  if (
    !isRecord(design) ||
    design.version !== 1 ||
    !Array.isArray(design.fields)
  ) {
    throwInvalidDynamicTemplate(
      "design schema must use version 1 and contain a fields array"
    );
  }

  const fieldIds = new Set<string>();
  return design.fields.map((value, index) => {
    if (!isRecord(value)) {
      throwInvalidDynamicTemplate(`dynamic field at index ${index} is invalid`);
    }
    const {
      binding,
      baseInformationBinding,
      defaultChecked,
      defaultValueSource,
      informationLibraryBinding,
      id,
      kind,
      name,
      page,
      placeholder,
      required,
      sourceRanges,
      textAlign,
      textStyle,
      x,
      y,
      width,
      height,
    } = value;
    const normalizedId = typeof id === "string" ? id.trim() : "";
    if (
      !normalizedId ||
      (kind !== "TEXT" &&
        kind !== "MULTILINE" &&
        kind !== "NUMBER" &&
        kind !== "DATE" &&
        kind !== "CHECKBOX" &&
        kind !== "SELECT" &&
        kind !== "RADIO" &&
        kind !== "STATIC_TEXT" &&
        kind !== "MASK") ||
      (kind !== "MASK" && (typeof name !== "string" || !name.trim())) ||
      (placeholder !== undefined && typeof placeholder !== "string") ||
      typeof page !== "number" ||
      !Number.isInteger(page) ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      ![x, y, width, height].every(Number.isFinite) ||
      page < 1 ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1 ||
      (textAlign !== undefined &&
        textAlign !== "left" &&
        textAlign !== "center" &&
        textAlign !== "right") ||
      (defaultChecked !== undefined &&
        (kind !== "CHECKBOX" || typeof defaultChecked !== "boolean")) ||
      (required !== undefined &&
        (kind !== "CHECKBOX" || typeof required !== "boolean"))
    ) {
      throwInvalidDynamicTemplate(
        `dynamic field ${normalizedId ? `"${normalizedId}"` : `at index ${index}`} is invalid`
      );
    }
    if (fieldIds.has(normalizedId)) {
      throwInvalidDynamicTemplate(
        `dynamic field "${normalizedId}" is duplicated`
      );
    }
    fieldIds.add(normalizedId);

    if (
      value.options !== undefined &&
      (!Array.isArray(value.options) ||
        !value.options.every((option) => typeof option === "string"))
    ) {
      throwInvalidDynamicTemplate(
        `dynamic field "${normalizedId}" options are invalid`
      );
    }
    const options = Array.isArray(value.options)
      ? value.options.map((option) => option.trim())
      : [];
    if (
      (kind === "SELECT" || kind === "RADIO") &&
      (options.length === 0 ||
        options.some((option) => !option) ||
        new Set(options).size !== options.length)
    ) {
      throwInvalidDynamicTemplate(
        `${kind} field "${normalizedId}" options are invalid`
      );
    }
    if (kind !== "SELECT" && kind !== "RADIO" && options.length > 0) {
      throwInvalidDynamicTemplate(
        `${kind} field "${normalizedId}" cannot define options`
      );
    }
    const normalizedBinding = parseDynamicTemplateFieldBinding(
      baseInformationBinding ?? binding,
      kind,
      baseInformationBinding === undefined
        ? TEMPLATE_FIELD_BINDINGS
        : BASE_INFORMATION_FIELD_BINDINGS
    );
    const normalizedInformationLibraryBinding =
      parseDynamicTemplateFieldBinding(
        informationLibraryBinding,
        kind,
        INFORMATION_LIBRARY_FIELD_BINDINGS
      );
    const normalizedDefaultValueSource = parseDynamicTemplateDefaultValueSource(
      defaultValueSource,
      kind
    );
    if (
      normalizedDefaultValueSource?.source === "CUSTOM" &&
      !isValidDynamicCustomDefaultFillValue(
        kind,
        normalizedDefaultValueSource.value,
        options
      )
    ) {
      throwInvalidDynamicTemplate(
        `dynamic field "${normalizedId}" custom default fill is invalid`
      );
    }
    const normalizedSourceRanges =
      parseDynamicTemplateSourceRanges(sourceRanges);
    const normalizedTextStyle = parseDynamicTemplateFieldTextStyle(
      textStyle,
      kind
    );
    if (
      normalizedBinding === null ||
      normalizedInformationLibraryBinding === null ||
      normalizedDefaultValueSource === null ||
      ((normalizedDefaultValueSource?.source === "BASE_INFORMATION" ||
        normalizedDefaultValueSource?.source === "INFORMATION_LIBRARY") &&
        (binding !== undefined ||
          baseInformationBinding !== undefined ||
          informationLibraryBinding !== undefined)) ||
      normalizedSourceRanges === null
    ) {
      throwInvalidDynamicTemplate(
        `dynamic field "${normalizedId}" has invalid binding or source ranges`
      );
    }
    if (normalizedTextStyle === null) {
      throwInvalidDynamicTemplate(
        `dynamic field "${normalizedId}" has invalid text style`
      );
    }
    return {
      ...(normalizedBinding
        ? { baseInformationBinding: normalizedBinding }
        : {}),
      ...(normalizedInformationLibraryBinding
        ? { informationLibraryBinding: normalizedInformationLibraryBinding }
        : {}),
      ...(normalizedDefaultValueSource
        ? { defaultValueSource: normalizedDefaultValueSource }
        : {}),
      id: normalizedId,
      ...(kind === "CHECKBOX" && typeof defaultChecked === "boolean"
        ? { defaultChecked }
        : {}),
      kind,
      options,
      page,
      x,
      y,
      width,
      height,
      ...(typeof placeholder === "string"
        ? { placeholder: placeholder.trim() }
        : {}),
      ...(kind === "CHECKBOX" && typeof required === "boolean"
        ? { required }
        : {}),
      ...(normalizedTextStyle ? { textStyle: normalizedTextStyle } : {}),
      ...(textAlign ? { textAlign } : {}),
      ...(normalizedSourceRanges?.length
        ? { sourceRanges: normalizedSourceRanges }
        : {}),
    };
  });
}

function parseDynamicTemplateFieldTextStyle(
  value: unknown,
  kind: unknown
): ConfirmationTemplateTextStyle | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    kind === "MASK" ||
    !isRecord(value) ||
    !["bold", "fontFamily", "fontSize", "italic", "underline"].every((key) =>
      Object.hasOwn(value, key)
    ) ||
    !Object.keys(value).every((key) =>
      [
        "backgroundColor",
        "bold",
        "fontFamily",
        "fontSize",
        "italic",
        "textColor",
        "underline",
      ].includes(key)
    ) ||
    typeof value.bold !== "boolean" ||
    typeof value.italic !== "boolean" ||
    typeof value.underline !== "boolean" ||
    !CONFIRMATION_TEMPLATE_FONT_FAMILIES.includes(
      value.fontFamily as (typeof CONFIRMATION_TEMPLATE_FONT_FAMILIES)[number]
    ) ||
    !CONFIRMATION_TEMPLATE_FONT_SIZES.includes(
      value.fontSize as (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number]
    ) ||
    (value.textColor !== undefined &&
      (typeof value.textColor !== "string" ||
        !/^#[0-9A-Fa-f]{6}$/u.test(value.textColor))) ||
    (value.backgroundColor !== undefined &&
      (typeof value.backgroundColor !== "string" ||
        (value.backgroundColor !== "transparent" &&
          !/^#[0-9A-Fa-f]{6}$/u.test(value.backgroundColor))))
  ) {
    return null;
  }
  return {
    ...(value.backgroundColor
      ? { backgroundColor: value.backgroundColor }
      : {}),
    bold: value.bold,
    fontFamily: value.fontFamily as ConfirmationTemplateTextStyle["fontFamily"],
    fontSize: value.fontSize as ConfirmationTemplateTextStyle["fontSize"],
    italic: value.italic,
    ...(value.textColor ? { textColor: value.textColor } : {}),
    underline: value.underline,
  };
}

function parseDynamicTemplateFieldBinding(
  value: unknown,
  kind: unknown,
  bindings: ReadonlySet<ConfirmationTemplateDesignFieldBinding> =
    TEMPLATE_FIELD_BINDINGS
): ConfirmationTemplateDesignFieldBinding | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    typeof value !== "string" ||
    !(bindings.has(value as ConfirmationTemplateDesignFieldBinding) || (bindings !== INFORMATION_LIBRARY_FIELD_BINDINGS && /^custom:[a-zA-Z0-9-]{1,80}$/.test(value)))
  ) {
    return null;
  }
  return value as ConfirmationTemplateDesignFieldBinding;
}

function parseDynamicTemplateDefaultValueSource(
  value: unknown,
  kind: unknown
): DynamicTemplateField["defaultValueSource"] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    kind !== "STATIC_TEXT" &&
    kind !== "MASK" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "CUSTOM" &&
    typeof value.value === "string" &&
    value.value.length <= 10_000
  ) {
    return { source: "CUSTOM", value: value.value };
  }
  if (
    kind === "DATE" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "SYSTEM" &&
    value.value === "CURRENT_DATE"
  ) {
    return { source: "SYSTEM", value: "CURRENT_DATE" };
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    (value.source !== "BASE_INFORMATION" &&
      value.source !== "INFORMATION_LIBRARY")
  ) {
    return null;
  }
  const binding = parseDynamicTemplateFieldBinding(
    value.binding,
    kind,
    value.source === "BASE_INFORMATION"
      ? BASE_INFORMATION_FIELD_BINDINGS
      : INFORMATION_LIBRARY_FIELD_BINDINGS
  );
  if (!binding) {
    return null;
  }
  return { binding, source: value.source };
}

function isValidDynamicCustomDefaultFillValue(
  kind: unknown,
  value: string,
  options: string[]
) {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  if (kind === "NUMBER") {
    return /^-?(?:\d+|\d*\.\d+)$/u.test(normalized);
  }
  if (kind === "DATE") {
    return (
      /^\d{4}-\d{2}-\d{2}$/u.test(normalized) &&
      !Number.isNaN(Date.parse(normalized))
    );
  }
  if (kind === "RADIO" || kind === "SELECT") {
    return options.includes(normalized);
  }
  if (kind === "CHECKBOX") {
    return normalized === "true" || normalized === "false";
  }
  return kind === "TEXT" || kind === "MULTILINE";
}

function parseDynamicTemplateSourceRanges(
  value: unknown
): ConfirmationTemplateDesignFieldSourceRange[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 200) {
    return null;
  }

  const ranges: ConfirmationTemplateDesignFieldSourceRange[] = [];
  for (const range of value) {
    const expectedKeys =
      isRecord(range) && range.paragraphId === undefined
        ? [
            "part",
            "paragraphOrdinal",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ]
        : [
            "part",
            "paragraphOrdinal",
            "paragraphId",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ];
    if (
      !isRecord(range) ||
      Object.keys(range).length !== expectedKeys.length ||
      !expectedKeys.every((key) => Object.hasOwn(range, key)) ||
      range.part !== "word/document.xml" ||
      typeof range.paragraphOrdinal !== "number" ||
      !Number.isSafeInteger(range.paragraphOrdinal) ||
      range.paragraphOrdinal < 0 ||
      (range.paragraphId !== undefined &&
        (typeof range.paragraphId !== "string" || !range.paragraphId.trim())) ||
      typeof range.paragraphXmlSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(range.paragraphXmlSha256) ||
      typeof range.sourceText !== "string" ||
      typeof range.start !== "number" ||
      typeof range.end !== "number" ||
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      !range.sourceText ||
      range.sourceText.length > MAX_DYNAMIC_TEMPLATE_SOURCE_RANGE_TEXT_LENGTH ||
      range.end - range.start !== range.sourceText.length
    ) {
      return null;
    }
    ranges.push({
      end: range.end,
      ...(typeof range.paragraphId === "string"
        ? { paragraphId: range.paragraphId }
        : {}),
      paragraphOrdinal: range.paragraphOrdinal,
      paragraphXmlSha256: range.paragraphXmlSha256,
      part: "word/document.xml",
      sourceText: range.sourceText,
      start: range.start,
    });
  }
  return ranges;
}

function throwInvalidDynamicTemplate(message: string): never {
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    `Invalid dynamic confirmation template: ${message}`
  );
}

function getDocumentPageSize(xml: string) {
  const pageSize = xml.match(/<w:pgSz\b[^>]*>/)?.[0] ?? "";
  const width = Number(pageSize.match(/\bw:w="(\d+)"/)?.[1] ?? 11_906);
  const height = Number(pageSize.match(/\bw:h="(\d+)"/)?.[1] ?? 16_838);
  return { heightPoints: height / 20, widthPoints: width / 20 };
}

function getPageAnchorParagraphs(xml: string) {
  const paragraphs = findXmlElementRanges(xml, "w:p").sort(
    (left, right) => left.start - right.start
  );
  if (paragraphs.length === 0) {
    return [];
  }
  const anchors = [paragraphs[0]];
  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const paragraph = paragraphs[index];
    if (
      /<w:br\b[^>]*w:type="page"[^>]*\/?>/.test(
        xml.slice(paragraph.start, paragraph.end)
      )
    ) {
      anchors.push(paragraphs[index + 1]);
    }
  }
  return anchors;
}

function buildDynamicTemplateShape(
  field: DynamicTemplateField,
  value: string,
  pageSize: { heightPoints: number; widthPoints: number },
  fieldIndex: number,
  coverSourceText: boolean
) {
  const id = `PW_DYNAMIC_${field.id.replaceAll(/[^A-Za-z0-9_.-]/g, "_")}`;
  const left = formatPoints(field.x * pageSize.widthPoints);
  const top = formatPoints(field.y * pageSize.heightPoints);
  const widthPoints = field.width * pageSize.widthPoints;
  const width = formatPoints(widthPoints);
  const height = formatPoints(field.height * pageSize.heightPoints);
  const zIndex = (field.kind === "MASK" ? 900 : 1000) + fieldIndex;
  const style = [
    "position:absolute",
    `margin-left:${left}pt`,
    `margin-top:${top}pt`,
    `width:${width}pt`,
    `height:${height}pt`,
    `z-index:${zIndex}`,
    "mso-position-horizontal-relative:page",
    "mso-position-vertical-relative:page",
    "mso-wrap-style:front",
  ].join(";");
  const displayValue = formatDynamicTemplateFieldValue(field, value);
  const wordText = displayValue
    .split(/\r?\n/gu)
    .map((line) => escapeXml(line))
    .join('</w:t><w:br/><w:t xml:space="preserve">');
  const textBox =
    field.kind === "MASK"
      ? ""
      : `<v:textbox inset="1pt,0.5pt,1pt,0.5pt" style="mso-fit-shape-to-text:f"><w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="${field.textAlign ?? "left"}"/></w:pPr><w:r><w:rPr>${buildDynamicTemplateRunProperties(field.textStyle, field.kind === "MULTILINE" ? undefined : widthPoints, displayValue)}</w:rPr><w:t xml:space="preserve">${wordText}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
  const backgroundColor =
    field.kind === "MASK"
      ? "#FFFFFF"
      : field.textStyle?.backgroundColor === undefined ||
          field.textStyle.backgroundColor === "transparent"
        ? coverSourceText
          ? "#FFFFFF"
          : "transparent"
        : field.textStyle.backgroundColor;
  const fillAttributes =
    backgroundColor === "transparent"
      ? 'filled="f"'
      : `fillcolor="${escapeXml(backgroundColor)}"`;
  const fill =
    backgroundColor === "transparent"
      ? ""
      : `<v:fill color="${escapeXml(backgroundColor)}" opacity="1"/>`;
  return `<w:r><w:pict><v:rect id="${escapeXml(id)}" style="${style}" ${fillAttributes} stroked="f" o:allowincell="f">${fill}<w10:wrap type="front"/>${textBox}</v:rect></w:pict></w:r>`;
}

function formatDynamicTemplateFieldValue(
  field: DynamicTemplateField,
  value: string
) {
  if (field.kind === "CHECKBOX") {
    return value === "true" ? "☒" : "☐";
  }
  if (field.kind === "RADIO") {
    return value ? `◉ ${value}` : "";
  }
  return value;
}

function buildDynamicTemplateRunProperties(
  textStyle?: ConfirmationTemplateTextStyle,
  fitWidthPoints?: number,
  displayValue = ""
) {
  const baseFontSize = textStyle?.fontSize ?? 9;
  const fontSize = fitWordTextFontSize(
    displayValue,
    baseFontSize,
    fitWidthPoints
  );
  if (!textStyle) {
    return `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="${fontSize * 2}"/><w:szCs w:val="${fontSize * 2}"/>`;
  }
  return [
    `<w:rFonts w:ascii="${escapeXml(textStyle.fontFamily)}" w:hAnsi="${escapeXml(textStyle.fontFamily)}" w:eastAsia="${escapeXml(textStyle.fontFamily)}"/>`,
    `<w:sz w:val="${fontSize * 2}"/><w:szCs w:val="${fontSize * 2}"/>`,
    textStyle.bold ? "<w:b/>" : "",
    textStyle.italic ? "<w:i/>" : "",
    textStyle.underline ? '<w:u w:val="single"/>' : "",
    textStyle.textColor
      ? `<w:color w:val="${escapeXml(textStyle.textColor.replace(/^#/u, ""))}"/>`
      : "",
    textStyle.backgroundColor && textStyle.backgroundColor !== "transparent"
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${escapeXml(textStyle.backgroundColor.replace(/^#/u, ""))}"/>`
      : "",
  ].join("");
}

function fitWordTextFontSize(
  value: string,
  baseFontSize: number,
  widthPoints?: number
) {
  if (!value || !widthPoints || widthPoints <= 4) {
    return baseFontSize;
  }
  const estimatedWidth = Math.max(
    ...value.split(/\r?\n/gu).map(
      (line) =>
        [...line].reduce(
          (total, character) =>
            total + ((character.codePointAt(0) ?? 0) <= 0xff ? 0.55 : 1),
          0
        ) * baseFontSize
    )
  );
  if (estimatedWidth <= widthPoints - 4) {
    return baseFontSize;
  }
  return Math.max(
    6,
    Math.floor(
      ((baseFontSize * Math.max(1, widthPoints - 8)) / (estimatedWidth * 1.1)) *
        2
    ) / 2
  );
}

function formatPoints(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

function replaceEnglishTemplateText(
  xml: string,
  templateCode: ConfirmationDraftTemplateCode,
  values: ConfirmationTemplateValues
) {
  if (!isManagedEnglishTemplate(templateCode)) {
    return xml;
  }

  return replaceParagraphText(xml, (text) => {
    const normalized = normalizeText(text);
    if (isStaticEnglishSalutation(normalized)) {
      return formatEnglishSalutation(values.salutation);
    }
    if (
      (templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
        templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH") &&
      normalized === "(To The Manager)"
    ) {
      return getTemplateTextOrBlank(values.recipientName);
    }
    return null;
  });
}

function isManagedEnglishTemplate(templateCode: ConfirmationDraftTemplateCode) {
  return (
    templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
    isSecuritiesTemplate(templateCode)
  );
}

function isStaticEnglishSalutation(text: string) {
  return /^Dear\s+(?:Sir(?:s)?\s*\/\s*Madam|Sirs?|Madam),?$/iu.test(text);
}

function formatEnglishSalutation(value: string) {
  let normalized = value
    .trim()
    .replace(/^Dear\s+/iu, "")
    .replace(/[,:，。]+$/u, "")
    .trim();
  if (/^sirs?\s*\/\s*madam$/iu.test(normalized)) {
    normalized = "Sir/Madam";
  } else if (/^sir$/iu.test(normalized)) {
    normalized = "Sir";
  } else if (/^madam$/iu.test(normalized)) {
    normalized = "Madam";
  }
  return `Dear ${normalized || "____________"},`;
}

const STANDARD_TEMPLATE_CONTENT_CONTROL_VALUES: Record<
  string,
  (values: ConfirmationTemplateValues) => string
> = {
  PW_AUDITOR_ADDRESS: (values: ConfirmationTemplateValues) =>
    appendTerminalPunctuation(
      getTemplateTextOrBlank(values.auditorAddress),
      "."
    ),
  PW_AUDITOR_NAME: (values: ConfirmationTemplateValues) =>
    appendTerminalPunctuation(getTemplateTextOrBlank(values.auditorName), ","),
  PW_AUTHORIZATION_ACCOUNT: (values: ConfirmationTemplateValues) =>
    `You are hereby authorised to debit any charge for this service to our account number ${values.authorizationAccount.trim() || "__________"}.`,
  PW_BANK_NAME: (values: ConfirmationTemplateValues) => values.bankName,
  PW_CUSTOMER_NAME: (values: ConfirmationTemplateValues) => values.customerName,
  PW_OFFICE_DATE: (values: ConfirmationTemplateValues) => values.officeDate,
  PW_REFERENCE_CODE: (values: ConfirmationTemplateValues) =>
    values.referenceCode,
  PW_REPORT_DATE: (values: ConfirmationTemplateValues) =>
    ` ${values.englishReportDate || "the reporting date"}.`,
};

function appendTerminalPunctuation(value: string, punctuation: "," | ".") {
  const terminalCharacters = punctuation === "," ? /[,，]+$/u : /[.,，。]+$/u;
  const normalized = value.trimEnd().replace(terminalCharacters, "");
  return `${normalized || "____________"}${punctuation}`;
}

const HK_STANDARD_TEMPLATE_CONTENT_CONTROL_VALUES: Record<
  string,
  (values: ConfirmationTemplateValues) => string
> = {
  ...STANDARD_TEMPLATE_CONTENT_CONTROL_VALUES,
  PW_AUDITOR_ADDRESS: (values: ConfirmationTemplateValues) =>
    getTemplateTextOrBlank(
      stripTerminalPunctuation(values.auditorAddress, ".")
    ),
  PW_AUDITOR_NAME: (values: ConfirmationTemplateValues) =>
    getTemplateTextOrBlank(stripTerminalPunctuation(values.auditorName, ",")),
  PW_AUTHORIZATION_ACCOUNT: (values: ConfirmationTemplateValues) =>
    values.authorizationAccount.trim() || "__________",
};

function stripTerminalPunctuation(value: string, punctuation: "," | ".") {
  const terminalCharacters = punctuation === "," ? /[,，]+$/u : /[.。]+$/u;
  return value.trimEnd().replace(terminalCharacters, "");
}

type StandardTemplateCode = Extract<
  ConfirmationDraftTemplateCode,
  "STANDARD_FINANCIAL_INSTITUTION" | "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
>;

type XmlElementRange = {
  start: number;
  end: number;
};

export function replaceStandardTemplateContentControls(
  xml: string,
  values: ConfirmationTemplateValues,
  templateCode: StandardTemplateCode = "STANDARD_FINANCIAL_INSTITUTION"
) {
  const controlValues =
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      ? HK_STANDARD_TEMPLATE_CONTENT_CONTROL_VALUES
      : STANDARD_TEMPLATE_CONTENT_CONTROL_VALUES;
  const controlsByTag = new Map<string, XmlElementRange>();
  const allControlRanges = findXmlElementRanges(xml, "w:sdt");
  for (const range of allControlRanges) {
    const control = xml.slice(range.start, range.end);
    const properties = getDirectContentControlProperties(control);
    if (!properties) {
      continue;
    }
    const tag = getDirectContentControlTag(properties);
    if (!tag?.startsWith("PW_")) {
      continue;
    }
    if (!controlValues[tag]) {
      throwInvalidStandardTemplate(`未知 OOXML 占位符：${tag}`);
    }
    if (controlsByTag.has(tag)) {
      throwInvalidStandardTemplate(`重复 OOXML 占位符：${tag}`);
    }
    if (
      allControlRanges.some(
        (candidate) =>
          candidate.start < range.start && candidate.end > range.end
      )
    ) {
      throwInvalidStandardTemplate(`占位符不允许嵌套内容控件：${tag}`);
    }
    controlsByTag.set(tag, range);
  }

  const missingTags = Object.keys(controlValues).filter(
    (tag) => !controlsByTag.has(tag)
  );
  if (missingTags.length > 0) {
    throwInvalidStandardTemplate(
      `缺少 OOXML 占位符：${missingTags.join(", ")}`
    );
  }

  let patched = xml;
  const replacements = [...controlsByTag.entries()]
    .map(([tag, range]) => {
      const control = xml.slice(range.start, range.end);
      const { contentStart, contentEnd } = getDirectContentControlContentRange(
        control,
        tag
      );
      const content = control.slice(contentStart, contentEnd);
      if (findXmlElementRanges(content, "w:sdt").length > 0) {
        throwInvalidStandardTemplate(`占位符不允许嵌套内容控件：${tag}`);
      }
      const paragraphCount = (content.match(/<w:p\b/g) ?? []).length;
      const isInlineControl = paragraphCount === 0;
      if (paragraphCount > 1 || (isInlineControl && !/<w:r\b/.test(content))) {
        throwInvalidStandardTemplate(`占位符内容结构无效：${tag}`);
      }
      const replacement = controlValues[tag](values);
      return {
        // The source remains an OOXML template, but the rendered document no
        // Longer needs editable controls. Unwrapping them also avoids a
        // LibreOffice bug that clips long inline control values.
        start: range.start,
        end: range.end,
        value: isInlineControl
          ? rebuildInlineContentWithText(content, replacement)
          : replaceParagraphText(content, () => replacement),
      };
    })
    .sort((left, right) => right.start - left.start);

  for (const replacement of replacements) {
    patched =
      patched.slice(0, replacement.start) +
      replacement.value +
      patched.slice(replacement.end);
  }
  return replaceParagraphText(patched, (text) =>
    text === "(Name of bank)" || text === "(Customer’s Name)" ? "" : null
  );
}

type SecuritiesTemplateCode = Extract<
  ConfirmationDraftTemplateCode,
  | "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1"
  | "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
>;

const SECURITIES_TEMPLATE_CONTENT_CONTROL_VALUES: Record<
  string,
  (values: ConfirmationTemplateValues) => string
> = {
  PW_ACCOUNT_NUMBER: (values) => values.accountNumber,
  PW_AUDITOR_ADDRESS: (values) => values.auditorAddress,
  PW_AUDITOR_NAME: (values) => values.auditorName,
  PW_CLIENT_NAME: (values) => values.clientName,
  PW_MIC_EMAIL: (values) => values.micEmail,
  PW_MIC_NAME: (values) => values.micName,
  PW_MIC_NAME_AND_INITIAL: (values) => values.micNameAndInitial,
  PW_OFFICE_DATE: (values) => values.officeDate,
  PW_RECIPIENT_ADDRESS: (values) => values.recipientAddress,
  PW_RECIPIENT_NAME: (values) => values.recipientName,
  PW_REFERENCE_CODE: (values) => values.referenceCode,
  PW_SALUTATION: (values) =>
    values.salutation
      .trim()
      .replace(/^Dear\s+/iu, "")
      .replace(/[,:，。]+$/u, "")
      .trim() || "____________",
  PW_YEAR_END_DATE: (values) => values.yearEndDate,
};
const SECURITIES_TEMPLATE_TAG_COUNTS: Record<
  SecuritiesTemplateCode,
  Record<string, number>
> = {
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_1: {
    PW_ACCOUNT_NUMBER: 1,
    PW_AUDITOR_ADDRESS: 1,
    PW_AUDITOR_NAME: 2,
    PW_CLIENT_NAME: 1,
    PW_MIC_NAME: 1,
    PW_OFFICE_DATE: 1,
    PW_RECIPIENT_ADDRESS: 1,
    PW_RECIPIENT_NAME: 1,
    PW_REFERENCE_CODE: 1,
    PW_SALUTATION: 1,
    PW_YEAR_END_DATE: 1,
  },
  SECURITIES_CONFIRMATION_ENGLISH_TYPE_2: {
    PW_AUDITOR_ADDRESS: 1,
    PW_AUDITOR_NAME: 1,
    PW_CLIENT_NAME: 2,
    PW_MIC_EMAIL: 1,
    PW_MIC_NAME_AND_INITIAL: 1,
    PW_OFFICE_DATE: 1,
    PW_RECIPIENT_ADDRESS: 1,
    PW_RECIPIENT_NAME: 1,
    PW_REFERENCE_CODE: 1,
    PW_SALUTATION: 1,
    PW_YEAR_END_DATE: 1,
  },
};

function replaceSecuritiesTemplateContentControls(
  xml: string,
  templateCode: SecuritiesTemplateCode,
  values: ConfirmationTemplateValues
) {
  const expectedCounts = SECURITIES_TEMPLATE_TAG_COUNTS[templateCode];
  const allControlRanges = findXmlElementRanges(xml, "w:sdt");
  const managedControls: { range: XmlElementRange; tag: string }[] = [];

  for (const range of allControlRanges) {
    const control = xml.slice(range.start, range.end);
    const properties = getDirectContentControlProperties(control);
    if (!properties) {
      continue;
    }
    const tag = getDirectContentControlTag(properties);
    if (!tag?.startsWith("PW_")) {
      continue;
    }
    if (
      !expectedCounts[tag] ||
      !SECURITIES_TEMPLATE_CONTENT_CONTROL_VALUES[tag]
    ) {
      throwInvalidSecuritiesTemplate(templateCode, `未知 OOXML 占位符：${tag}`);
    }
    if (
      allControlRanges.some(
        (candidate) =>
          candidate.start < range.start && candidate.end > range.end
      )
    ) {
      throwInvalidSecuritiesTemplate(
        templateCode,
        `占位符不允许嵌套内容控件：${tag}`
      );
    }
    managedControls.push({ range, tag });
  }

  for (const [tag, expectedCount] of Object.entries(expectedCounts)) {
    const actualCount = managedControls.filter(
      (control) => control.tag === tag
    ).length;
    if (actualCount !== expectedCount) {
      throwInvalidSecuritiesTemplate(
        templateCode,
        `OOXML 占位符数量错误：${tag} (${actualCount}/${expectedCount})`
      );
    }
  }

  let patched = xml;
  const replacements = managedControls
    .map(({ range, tag }) => {
      const control = xml.slice(range.start, range.end);
      const { contentStart, contentEnd } = getDirectContentControlContentRange(
        control,
        tag
      );
      const content = control.slice(contentStart, contentEnd);
      if (
        findXmlElementRanges(content, "w:sdt").length > 0 ||
        /<w:p\b/.test(content) ||
        !/<w:r\b/.test(content)
      ) {
        throwInvalidSecuritiesTemplate(
          templateCode,
          `占位符内容结构无效：${tag}`
        );
      }
      return {
        start: range.start,
        end: range.end,
        value: rebuildInlineContentWithText(
          content,
          SECURITIES_TEMPLATE_CONTENT_CONTROL_VALUES[tag](values)
        ),
      };
    })
    .sort((left, right) => right.start - left.start);

  for (const replacement of replacements) {
    patched =
      patched.slice(0, replacement.start) +
      replacement.value +
      patched.slice(replacement.end);
  }
  return patched;
}

function throwInvalidSecuritiesTemplate(
  templateCode: SecuritiesTemplateCode,
  reason: string
): never {
  throw new ApiBadRequestException(
    "BAD_REQUEST",
    `证券函证模板无效（${templateCode}）：${reason}`
  );
}

function getDirectContentControlContentRange(control: string, tag: string) {
  const controlOpenEnd = control.indexOf(">");
  if (controlOpenEnd === -1) {
    throwInvalidStandardTemplate(`占位符起始节点损坏：${tag}`);
  }
  const afterControlOpen = control.slice(controlOpenEnd + 1);
  const properties = afterControlOpen.match(
    /^\s*<w:sdtPr\b[^>]*>[\s\S]*?<\/w:sdtPr>/
  );
  if (!properties) {
    throwInvalidStandardTemplate(`占位符缺少直接属性节点：${tag}`);
  }
  const afterPropertiesStart = controlOpenEnd + 1 + properties[0].length;
  const afterProperties = control.slice(afterPropertiesStart);
  const contentOpen = afterProperties.match(/^\s*<w:sdtContent\b[^>]*>/);
  if (!contentOpen) {
    throwInvalidStandardTemplate(`占位符缺少直接内容节点：${tag}`);
  }
  const contentStart = afterPropertiesStart + contentOpen[0].length;
  const contentClose = "</w:sdtContent>";
  const contentEnd = control.lastIndexOf(contentClose);
  if (contentEnd < contentStart) {
    throwInvalidStandardTemplate(`占位符内容节点未闭合：${tag}`);
  }
  const tail = control.slice(contentEnd + contentClose.length);
  if (!/^\s*<\/w:sdt>$/.test(tail)) {
    throwInvalidStandardTemplate(`占位符内容节点不是直接子节点：${tag}`);
  }
  return { contentStart, contentEnd };
}

function findXmlElementRanges(xml: string, qualifiedName: string) {
  const escapedName = qualifiedName.replaceAll(
    /[.*+?^${}()|[\]\\]/g,
    String.raw`\$&`
  );
  const token = new RegExp(`<(/?)${escapedName}(?:\\s[^>]*)?>`, "g");
  const stack: number[] = [];
  const ranges: XmlElementRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(xml))) {
    if (!match[1]) {
      if (!match[0].endsWith("/>")) {
        stack.push(match.index);
      }
      continue;
    }
    const start = stack.pop();
    if (start === undefined) {
      throwInvalidStandardTemplate(
        `OOXML 结构损坏：意外的 </${qualifiedName}>`
      );
    }
    ranges.push({ start, end: match.index + match[0].length });
  }
  if (stack.length > 0) {
    throwInvalidStandardTemplate(`OOXML 结构损坏：${qualifiedName} 未闭合`);
  }
  return ranges;
}

function getDirectContentControlProperties(control: string) {
  const openEnd = control.indexOf(">");
  if (openEnd === -1) {
    return null;
  }
  const afterOpen = control.slice(openEnd + 1);
  const propertiesOpen = afterOpen.match(/^\s*<w:sdtPr\b[^>]*>/);
  if (!propertiesOpen) {
    return null;
  }
  const propertiesCloseIndex = afterOpen.indexOf(
    "</w:sdtPr>",
    propertiesOpen[0].length
  );
  if (propertiesCloseIndex === -1) {
    throwInvalidStandardTemplate("OOXML 内容控件属性未闭合");
  }
  return afterOpen.slice(0, propertiesCloseIndex + "</w:sdtPr>".length);
}

function getDirectContentControlTag(properties: string) {
  const propertiesOpenEnd = properties.indexOf(">");
  const propertiesCloseStart = properties.lastIndexOf("</w:sdtPr>");
  if (propertiesOpenEnd === -1 || propertiesCloseStart < propertiesOpenEnd) {
    throwInvalidStandardTemplate("OOXML 内容控件属性节点损坏");
  }
  const body = properties.slice(propertiesOpenEnd + 1, propertiesCloseStart);
  const directTagValues: string[] = [];
  let depth = 0;
  const token = /<(\/?)([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    const closing = Boolean(match[1]);
    const { 2: name } = match;
    const selfClosing = match[0].endsWith("/>");
    if (closing) {
      depth -= 1;
      if (depth < 0) {
        throwInvalidStandardTemplate("OOXML 内容控件属性子节点损坏");
      }
      continue;
    }
    if (depth === 0 && name === "w:tag") {
      const value = match[0].match(/\bw:val="([^"]+)"/)?.[1];
      if (!value || !selfClosing) {
        throwInvalidStandardTemplate("OOXML 占位符 tag 格式无效");
      }
      directTagValues.push(value);
    }
    if (!selfClosing) {
      depth += 1;
    }
  }
  if (depth !== 0) {
    throwInvalidStandardTemplate("OOXML 内容控件属性子节点未闭合");
  }

  const managedTagValues = Array.from(
    body.matchAll(/<w:tag\b[^>]*\bw:val="(PW_[^"]+)"[^>]*\/>/g),
    (tagMatch) => tagMatch[1]
  );
  const directManagedTags = directTagValues.filter((tag) =>
    tag.startsWith("PW_")
  );
  if (
    managedTagValues.length > 0 &&
    (managedTagValues.length !== 1 ||
      directManagedTags.length !== 1 ||
      directTagValues.length !== 1)
  ) {
    throwInvalidStandardTemplate(
      "OOXML 占位符 tag 必须是唯一的 w:sdtPr 直接子节点"
    );
  }
  return directTagValues.length === 1 ? directTagValues[0] : null;
}

function throwInvalidStandardTemplate(reason: string): never {
  throw new ApiBadRequestException(
    "BAD_REQUEST",
    `标准金融机构函证模板无效：${reason}`
  );
}

function getParagraphReplacement(
  text: string,
  templateCode: ConfirmationDraftTemplateCode,
  values: ConfirmationTemplateValues
) {
  const normalized = normalizeText(text);
  if (normalized.includes("Client code/PIC/MIC/AIC")) {
    return isEnglishBankTemplate(templateCode)
      ? `Ref ${values.referenceCode}`
      : `参考编号 : ${values.referenceCode}`;
  }

  if (isEnglishBankTemplate(templateCode)) {
    if (normalized.includes("OfficeDate")) {
      return values.officeDate ? `Office Date ${values.officeDate}` : null;
    }
    if (normalized.includes("(Customer") && normalized.includes("s Name)")) {
      return `A/C ${values.customerName}`;
    }
    if (normalized.includes("For the purpose of our annual audit")) {
      return `For the purpose of our annual audit please complete the attached form to show the following information relating to our affairs with your bank as at the close of business on ${values.englishReportDate || "the reporting date"}. For each item, please state any factors which may limit the completeness of your reply; if there is nothing to report, state "none".`;
    }
    if (
      normalized.includes("authorized to return this request") &&
      normalized.includes("auditors")
    ) {
      return `You are hereby authorized to return this request after completion and together with any remarks you may have to our auditors, ${getTemplateTextOrBlank(values.auditorName)} of ${getTemplateTextOrBlank(values.auditorAddress)}.`;
    }
    if (normalized.includes("authorized to debit any charge")) {
      return `You are hereby authorized to debit any charge for this service to our account number ${values.authorizationAccount}.`;
    }
    return null;
  }

  if (normalized.includes("以下简称") && normalized.includes("函证收件人")) {
    return `${values.bankDisplayName}（以下简称“贵行”，即“函证收件人”）：`;
  }
  if (
    normalized.includes("财务报表进行审计") &&
    normalized.includes("本公司聘请")
  ) {
    if (templateCode === "PRC_BANK_TEMPLATE_2") {
      return `本公司聘请的${getTemplateTextOrBlank(values.auditorName)}正在对本公司${values.auditPeriodText}的财务报表进行审计，按照[香港审计准则 / 国际审计准则]的要求，应当询证截至${values.reportDateText || "____年____月____日"}（即“函证基准日”）本公司与贵行相关的信息。请填写下列第1-14项及附表中的表格，并[签字和盖章]或[签发电子签名]。`;
    }
    return `本公司聘请的${getTemplateTextOrBlank(values.auditorName)}正在对本公司${values.auditPeriodText}的财务报表进行审计，按照[香港审计准则 / 国际审计准则]的要求，应当询证本公司与贵行相关的信息。下列第1-14项及附表信息出自本公司的记录：`;
  }
  if (
    normalized.includes("谨授权贵行将回函") &&
    normalized.includes("地址及联系方式")
  ) {
    return `本公司谨授权贵行将回函直接寄至${getTemplateTextOrBlank(values.auditorName)}，地址及联系方式如下：`;
  }
  if (
    normalized.includes("即“函证基准日”") &&
    normalized.includes("列示如下")
  ) {
    return `截至${values.reportDateText || "____年____月____日"}（即“函证基准日”），本公司与贵行相关的信息列示如下：`;
  }
  if (normalized.startsWith("回函地址")) {
    return `回函地址：${values.replyAddress}`;
  }
  if (normalized.startsWith("联系人")) {
    return `联系人：${values.replyContact}    电话：${values.replyPhone}   传真：${values.replyFax}`;
  }
  if (normalized.startsWith("邮编")) {
    return `邮编：${values.replyPostalCode}`;
  }
  if (normalized.includes("电子邮箱")) {
    return values.replyEmail ? `[电子邮箱: ${values.replyEmail}]` : null;
  }
  if (normalized.includes("支取办理本询证函回函服务的费用")) {
    return `本公司谨授权贵行可从本公司[${values.authorizationAccount}]账户支取办理本询证函回函服务的费用。`;
  }
  if (
    templateCode === "PRC_BANK_TEMPLATE_2" &&
    normalized.includes("補充其他受理信息")
  ) {
    return values.receivingSupplement
      ? `[補充其他受理信息（如适用）: ${values.receivingSupplement}]`
      : null;
  }
  if (templateCode === "PRC_BANK_TEMPLATE_2") {
    const compact = normalized.replaceAll(/\s+/g, "");
    if (compact === "年月日" && values.companySignatureDateText) {
      return values.companySignatureDateText;
    }
    if (compact.startsWith("公司经办人")) {
      return values.companyHandlerName
        ? `公司经办人：${values.companyHandlerName}`
        : null;
    }
    if (compact.startsWith("职务")) {
      return values.companyHandlerTitle
        ? `职  务：${values.companyHandlerTitle}`
        : null;
    }
    if (compact.startsWith("电话")) {
      return values.companyHandlerPhone
        ? `电  话：${values.companyHandlerPhone}`
        : null;
    }
  }
  return null;
}

function isEnglishBankTemplate(templateCode: ConfirmationDraftTemplateCode) {
  return (
    templateCode === "SHINEWING_ENG_BANK" ||
    templateCode === "STANDARD_FINANCIAL_INSTITUTION" ||
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
  );
}

function isSecuritiesTemplate(
  templateCode: ConfirmationDraftTemplateCode
): templateCode is SecuritiesTemplateCode {
  return (
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" ||
    templateCode === "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2"
  );
}

function isOverlayEditableTemplate(
  templateCode: ConfirmationDraftTemplateCode
) {
  return (
    isConfirmationCustomTemplateCode(templateCode) ||
    templateCode === "BANK_CONFIRMATION_HK_STANDARD_ENGLISH" ||
    isSecuritiesTemplate(templateCode)
  );
}

function resolveTemplatePath(code: ConfirmationDraftTemplateCode) {
  const fileName = TEMPLATE_FILES[code];
  const candidates = [
    pathModule.join(process.cwd(), "apps/api/confirmation-templates", fileName),
    pathModule.join(process.cwd(), "confirmation-templates", fileName),
    pathModule.join(process.cwd(), "apps/api/confirmation-templates", fileName),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      `函证模板文件不存在：${fileName}`
    );
  }
  return found;
}

async function loadTemplateBody(
  storage: StorageService,
  code: ConfirmationDraftTemplateCode,
  draftPayload: ConfirmationDraftPayload
) {
  await Promise.resolve();
  if (!isConfirmationCustomTemplateCode(code)) {
    return readFile(resolveTemplatePath(code));
  }
  const source = isRecord(
    (draftPayload as Record<string, unknown>).templateLibrarySource
  )
    ? ((draftPayload as Record<string, unknown>)
        .templateLibrarySource as Record<string, unknown>)
    : null;
  const objectKey =
    typeof source?.objectKey === "string" ? source.objectKey : "";
  if (!objectKey) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "自定义函证模板来源已丢失，请重新选择模板"
    );
  }
  return storage.getObjectBuffer(objectKey);
}

function removeFirstInstructionTable(xml: string) {
  let removed = false;
  return xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/, (tableXml) => {
    if (removed || !extractWordText(tableXml).includes("使用说明")) {
      return tableXml;
    }
    removed = true;
    return "";
  });
}

function removePrcInstructionBlocks(
  xml: string,
  templateCode: ConfirmationDraftTemplateCode
) {
  const bodyOpen = xml.match(/<w:body\b[^>]*>/);
  if (!bodyOpen || bodyOpen.index === undefined) {
    return removeFirstInstructionTable(xml);
  }

  const title =
    templateCode === "PRC_BANK_TEMPLATE_1"
      ? "银行询证函（格式一）"
      : "银行询证函（格式二）";
  const bodyContentStart = bodyOpen.index + bodyOpen[0].length;
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphRegex.exec(xml))) {
    const paragraphText = normalizeText(extractWordText(paragraphMatch[0]));
    if (paragraphText === title) {
      return removeLeadingPageBreaks(
        xml.slice(0, bodyContentStart) + xml.slice(paragraphMatch.index)
      );
    }
  }

  return removeFirstInstructionTable(xml);
}

async function stripTemplateHighlightingFromPackage(zip: JSZip) {
  const wordXmlFiles = Object.entries(zip.files).filter(
    ([name, entry]) =>
      !entry.dir && name.startsWith("word/") && name.endsWith(".xml")
  );

  await Promise.all(
    wordXmlFiles.map(async ([name, entry]) => {
      const xml = await entry.async("string");
      const stripped = stripTemplateHighlighting(xml);
      if (stripped !== xml) {
        zip.file(name, stripped);
      }
    })
  );
}

async function sanitizeTemplatePackageMetadata(zip: JSZip) {
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith("customXml/")) {
      zip.remove(name);
    }
  }

  await patchPackageXml(zip, "docProps/core.xml", (xml) =>
    xml
      .replaceAll(
        /<dc:creator\b[^>]*>[\s\S]*?<\/dc:creator>/g,
        "<dc:creator>Project Wing</dc:creator>"
      )
      .replaceAll(
        /<cp:lastModifiedBy\b[^>]*>[\s\S]*?<\/cp:lastModifiedBy>/g,
        "<cp:lastModifiedBy>Project Wing</cp:lastModifiedBy>"
      )
  );
  await patchPackageXml(zip, "docProps/app.xml", (xml) =>
    xml
      .replaceAll(/<Manager\b[^>]*>[\s\S]*?<\/Manager>/g, "<Manager></Manager>")
      .replaceAll(/<Company\b[^>]*>[\s\S]*?<\/Company>/g, "<Company></Company>")
  );
  await patchPackageXml(zip, "[Content_Types].xml", (xml) =>
    xml.replaceAll(/<Override\b(?=[^>]*PartName="\/customXml\/)[^>]*\/>/g, "")
  );

  const relationshipFiles = Object.entries(zip.files).filter(
    ([name, entry]) => !entry.dir && name.endsWith(".rels")
  );
  await Promise.all(
    relationshipFiles.map(([name]) =>
      patchPackageXml(zip, name, (xml) =>
        xml.replaceAll(
          /<Relationship\b(?=[^>]*(?:Type|Target)="[^"]*customXml[^"]*")[^>]*\/>/gi,
          ""
        )
      )
    )
  );
}

async function patchPackageXml(
  zip: JSZip,
  name: string,
  patch: (xml: string) => string
) {
  const entry = zip.file(name);
  if (!entry) {
    return;
  }
  zip.file(name, patch(await entry.async("string")));
}

function removeLeadingPageBreaks(xml: string) {
  const bodyOpen = xml.match(/<w:body\b[^>]*>/);
  if (!bodyOpen || bodyOpen.index === undefined) {
    return xml;
  }

  const bodyContentStart = bodyOpen.index + bodyOpen[0].length;
  const firstTextIndex = xml.indexOf("<w:t", bodyContentStart);
  if (firstTextIndex === -1) {
    return xml;
  }

  const prefix = xml.slice(0, firstTextIndex);
  const cleanedPrefix = prefix
    .replaceAll(/<w:lastRenderedPageBreak\s*\/>/g, "")
    .replaceAll(/<w:br\b[^>]*w:type="page"[^>]*\/>/g, "");
  return cleanedPrefix + xml.slice(firstTextIndex);
}

function replaceParagraphText(
  xml: string,
  replacementForText: (text: string) => string | null
) {
  return xml.replaceAll(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const replacement = replacementForText(extractWordText(paragraphXml));
    if (replacement === null) {
      return paragraphXml;
    }
    return rebuildParagraphWithText(paragraphXml, replacement);
  });
}

function stripTemplateHighlighting(xml: string) {
  return xml
    .replaceAll(/<w:highlight\b[^>]*\/>/g, "")
    .replaceAll(
      /<w:shd\b(?=[^>]*(?:w:fill|fill)="(?:FFFF00|ffff00|yellow|YELLOW)")[^>]*\/>/g,
      ""
    );
}

function rebuildParagraphWithText(paragraphXml: string, replacement: string) {
  const openTag = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] ?? "<w:p>";
  const paragraphProperties = paragraphXml.match(
    /<w:pPr\b[\s\S]*?<\/w:pPr>/
  )?.[0];
  const runProperties = paragraphXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0];
  return `${openTag}${paragraphProperties ?? ""}<w:r>${runProperties ?? ""}<w:t xml:space="preserve">${escapeXml(replacement)}</w:t></w:r></w:p>`;
}

function rebuildInlineContentWithText(contentXml: string, replacement: string) {
  const runOpen = contentXml.match(/<w:r\b[^>]*>/)?.[0] ?? "<w:r>";
  const runProperties = contentXml.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0];
  return `${runOpen}${runProperties ?? ""}<w:t xml:space="preserve">${escapeXml(replacement)}</w:t></w:r>`;
}

function extractWordText(xml: string) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => unescapeXml(match[1] ?? ""))
    .join("");
}

function normalizeText(value: string) {
  return value.replaceAll(/\s+/g, " ").trim();
}

function formatChineseDate(value: Date | string | null | undefined) {
  const parts = parseDateParts(value);
  if (!parts) {
    return value ? String(value) : "";
  }
  return `${parts.year}年${parts.month.padStart(2, "0")}月${parts.day.padStart(2, "0")}日`;
}

function formatEnglishDate(value: Date | string | null | undefined) {
  const parts = parseDateParts(value);
  if (!parts) {
    return value ? String(value) : "";
  }
  const date = new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  );
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseDateParts(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return {
      day: String(value.getUTCDate()),
      month: String(value.getUTCMonth() + 1),
      year: String(value.getUTCFullYear()),
    };
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) {
    return null;
  }
  return {
    day: match[3],
    month: match[2],
    year: match[1],
  };
}

function getDraftString(draftPayload: ConfirmationDraftPayload, key: string) {
  const value = (draftPayload as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isObjectNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return (
    candidate.code === "NoSuchKey" ||
    candidate.code === "ENOENT" ||
    candidate.name === "NoSuchKeyError" ||
    candidate.status === 404 ||
    candidate.statusCode === 404
  );
}

function getTemplateTextOrBlank(value: string, blank = "____________") {
  return value.trim() || blank;
}

function sanitizeFileName(fileName: string) {
  return fileName.replaceAll(/[<>:"/\\|?*\p{Cc}]/gu, "_").slice(0, 120);
}

function sanitizeObjectSegment(value: string) {
  return sanitizeFileName(value).replaceAll(/\s+/g, "_");
}

function escapeXml(value: string) {
  return value
    .replaceAll(/[\p{Cc}]/gu, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function unescapeXml(value: string) {
  return value.replaceAll(
    /&(?:amp|apos|gt|lt|quot|#\d+|#x[\dA-Fa-f]+);/g,
    (entity) => {
      switch (entity) {
        case "&amp;": {
          return "&";
        }
        case "&apos;": {
          return "'";
        }
        case "&gt;": {
          return ">";
        }
        case "&lt;": {
          return "<";
        }
        case "&quot;": {
          return '"';
        }
        default: {
          const radix = entity.startsWith("&#x") ? 16 : 10;
          const digits = entity.slice(radix === 16 ? 3 : 2, -1);
          const codePoint = Number.parseInt(digits, radix);
          return Number.isSafeInteger(codePoint) && codePoint <= 0x10_ff_ff
            ? String.fromCodePoint(codePoint)
            : entity;
        }
      }
    }
  );
}
