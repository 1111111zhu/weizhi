import { randomUUID } from "node:crypto";

import type { OnModuleInit } from "@nestjs/common";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { backgroundJobsEnabled } from "../common/background-jobs";
import { PrismaService } from "../prisma/prisma.service";
import { PREVIEW_JOB_MAX_ATTEMPTS } from "./attachment-preview.constants";
import {
  isConvertibleOfficeAttachment,
  isPdfAttachment,
} from "./document-conversion.service";
import { PdfRasterPreviewService } from "./pdf-raster-preview.service";
import {
  SpreadsheetPreviewCacheService,
  isSpreadsheetPreviewAttachment,
} from "./spreadsheet-preview-cache.service";

const PREVIEW_JOB_INTERVAL_MS = 500;
const PREVIEW_JOB_LEASE_MS = 15 * 60_000;

@Injectable()
export class AttachmentPreviewWorkerService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentPreviewWorkerService.name);
  private running = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(PdfRasterPreviewService)
    private readonly rasterPreview: PdfRasterPreviewService,
    @Inject(SpreadsheetPreviewCacheService)
    @Optional()
    private readonly spreadsheetPreview?: SpreadsheetPreviewCacheService
  ) {}

  onModuleInit() {
    if (!backgroundJobsEnabled()) {
      this.logger.log(
        "Attachment preview worker is disabled by the background-jobs maintenance switch"
      );
      return;
    }
    queueMicrotask(() => this.scheduleNext());
  }

  @Interval(PREVIEW_JOB_INTERVAL_MS)
  processScheduledPreview() {
    if (!backgroundJobsEnabled()) {
      return;
    }
    this.scheduleNext();
  }

  private scheduleNext() {
    void this.processNext()
      .then((processed) => {
        if (processed) {
          queueMicrotask(() => this.scheduleNext());
        }
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Preview worker failed";
        this.logger.error(`Preview worker scheduling failed: ${message}`);
      });
  }

  async processNext() {
    if (this.running) {
      return false;
    }
    this.running = true;
    try {
      const now = new Date();
      const attachment = await this.prisma.attachment.findFirst({
        where: {
          deletedAt: null,
          previewAttemptCount: { lt: PREVIEW_JOB_MAX_ATTEMPTS },
          OR: [
            {
              previewStatus: "QUEUED",
              OR: [
                { previewNextAttemptAt: null },
                { previewNextAttemptAt: { lte: now } },
              ],
            },
            {
              previewStatus: "PROCESSING",
              previewLeaseExpiresAt: { lt: now },
            },
            {
              previewStatus: "FAILED",
              previewNextAttemptAt: { lte: now },
            },
          ],
        },
        orderBy: [
          { previewNextAttemptAt: "asc" },
          { lastModifiedAt: "desc" },
          { updatedAt: "desc" },
        ],
      });
      if (!attachment) {
        return false;
      }

      if (!supportsPreviewCache(attachment)) {
        await this.prisma.attachment.updateMany({
          where: { id: attachment.id, version: attachment.version },
          data: {
            previewStatus: "UNSUPPORTED",
            previewVersion: attachment.version,
            previewError: null,
            previewLeaseToken: null,
            previewLeaseExpiresAt: null,
            previewNextAttemptAt: null,
            previewUpdatedAt: now,
          },
        });
        return true;
      }

      const leaseToken = randomUUID();
      const leaseExpiresAt = new Date(now.getTime() + PREVIEW_JOB_LEASE_MS);
      const claimed = await this.prisma.attachment.updateMany({
        where: {
          id: attachment.id,
          version: attachment.version,
          previewAttemptCount: { lt: PREVIEW_JOB_MAX_ATTEMPTS },
          OR: [
            { previewStatus: "QUEUED" },
            {
              previewStatus: "PROCESSING",
              previewLeaseExpiresAt: { lt: now },
            },
            {
              previewStatus: "FAILED",
              previewNextAttemptAt: { lte: now },
            },
          ],
        },
        data: {
          previewStatus: "PROCESSING",
          previewLeaseToken: leaseToken,
          previewLeaseExpiresAt: leaseExpiresAt,
          previewError: null,
          previewAttemptCount: { increment: 1 },
          previewUpdatedAt: now,
        },
      });
      if (claimed.count !== 1) {
        return true;
      }

      try {
        if (attachment.previewAttemptCount === 0) {
          await this.rasterPreview.clearAttachmentPreviewCache(attachment);
          if (isSpreadsheetPreviewAttachment(attachment)) {
            await this.spreadsheetPreview?.clearAttachmentPreviewCache(
              attachment
            );
          }
        }
        if (isSpreadsheetPreviewAttachment(attachment)) {
          if (!this.spreadsheetPreview) {
            throw new Error("Spreadsheet preview worker is not configured.");
          }
          await this.spreadsheetPreview.warmAttachmentPreview(attachment);
        } else {
          await this.rasterPreview.warmAttachmentRasterPreview(attachment);
        }
        await this.prisma.attachment.updateMany({
          where: {
            id: attachment.id,
            version: attachment.version,
            previewLeaseToken: leaseToken,
          },
          data: {
            previewStatus: "READY",
            previewVersion: attachment.version,
            previewError: null,
            previewLeaseToken: null,
            previewLeaseExpiresAt: null,
            previewNextAttemptAt: null,
            previewUpdatedAt: new Date(),
          },
        });
      } catch (error) {
        const attempt = attachment.previewAttemptCount + 1;
        const terminal = attempt >= PREVIEW_JOB_MAX_ATTEMPTS;
        const retryDelayMs = Math.min(60_000, 2000 * 2 ** (attempt - 1));
        const message =
          error instanceof Error ? error.message : "Preview generation failed";
        await this.prisma.attachment.updateMany({
          where: {
            id: attachment.id,
            version: attachment.version,
            previewLeaseToken: leaseToken,
          },
          data: {
            previewStatus: "FAILED",
            previewError: message.slice(0, 4000),
            previewLeaseToken: null,
            previewLeaseExpiresAt: null,
            previewNextAttemptAt: terminal
              ? null
              : new Date(Date.now() + retryDelayMs),
            previewUpdatedAt: new Date(),
          },
        });
        this.logger.warn(
          `Preview generation failed for attachment ${attachment.id} v${attachment.version}: ${message}`
        );
      }
      return true;
    } finally {
      this.running = false;
    }
  }
}

export function queueAttachmentPreviewData() {
  return {
    previewStatus: "QUEUED",
    previewVersion: null,
    previewError: null,
    previewAttemptCount: 0,
    previewNextAttemptAt: null,
    previewLeaseToken: null,
    previewLeaseExpiresAt: null,
    previewUpdatedAt: new Date(),
  } as const;
}

export function attachmentPreviewDataForFile(attachment: {
  fileName: string;
  originalName?: string | null;
  mimeType: string;
}) {
  return supportsPreviewCache(attachment)
    ? queueAttachmentPreviewData()
    : ({
        previewStatus: "UNSUPPORTED",
        previewVersion: null,
        previewError: null,
        previewAttemptCount: 0,
        previewNextAttemptAt: null,
        previewLeaseToken: null,
        previewLeaseExpiresAt: null,
        previewUpdatedAt: new Date(),
      } as const);
}

export function attachmentPreviewDataForCommittedFile(
  previous: {
    fileName: string;
    originalName?: string | null;
    mimeType: string;
    version: number;
    contentHash?: string | null;
    previewStatus?: string | null;
    previewVersion?: number | null;
    previewUpdatedAt?: Date | null;
  },
  next: {
    fileName: string;
    originalName?: string | null;
    mimeType: string;
    version: number;
    contentHash?: string | null;
  }
) {
  const previousHash = previous.contentHash?.trim().toLowerCase();
  const nextHash = next.contentHash?.trim().toLowerCase();
  const canReuseReadyCache =
    Boolean(previousHash) &&
    previousHash === nextHash &&
    previous.previewStatus === "READY" &&
    previous.previewVersion === previous.version &&
    supportsPreviewCache(previous) &&
    supportsPreviewCache(next);

  if (!canReuseReadyCache) {
    return attachmentPreviewDataForFile(next);
  }

  return {
    previewStatus: "READY",
    previewVersion: next.version,
    previewError: null,
    previewAttemptCount: 0,
    previewNextAttemptAt: null,
    previewLeaseToken: null,
    previewLeaseExpiresAt: null,
    previewUpdatedAt: previous.previewUpdatedAt ?? new Date(),
  } as const;
}

function supportsPreviewCache(attachment: {
  fileName: string;
  originalName?: string | null;
  mimeType: string;
}) {
  return (
    isPdfAttachment({ ...attachment, id: "", fileUrl: "", version: 0 }) ||
    isConvertibleOfficeAttachment(attachment) ||
    isSpreadsheetPreviewAttachment(attachment)
  );
}
