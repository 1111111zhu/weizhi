import { ApiBadRequestException } from "../common/api-error";
import type {
  DesktopMasterUploadCompleteInput,
  DesktopMasterUploadPrepareInput,
} from "./workflow.service";

export function parseDesktopUploadPrepareInput(
  lockSessionId: string,
  body: unknown
): DesktopMasterUploadPrepareInput {
  const value = asBodyRecord(body);
  const projectId = stringBody(value.projectId);
  const attachmentId = stringBody(value.attachmentId);
  const grantSecret = stringBody(value.grantSecret);
  const localContentHash = stringBody(value.localContentHash);
  const localContentCrc64 = decimalStringBody(value.localContentCrc64);
  const idempotencyKey = stringBody(value.idempotencyKey);
  const fileName = stringBody(value.fileName);
  const mimeType = stringBody(value.mimeType);
  const baseVersion = positiveIntegerBody(value.baseVersion);
  const fileSize = nonnegativeIntegerBody(value.fileSize);
  if (
    !projectId ||
    !attachmentId ||
    !grantSecret ||
    !localContentHash ||
    !idempotencyKey ||
    !fileName ||
    !mimeType ||
    !baseVersion ||
    fileSize === undefined
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload preparation request is invalid."
    );
  }
  return {
    projectId,
    attachmentId,
    lockSessionId,
    grantSecret,
    localContentHash,
    localContentCrc64,
    idempotencyKey,
    fileName,
    mimeType,
    baseVersion,
    fileSize,
    uploadAttemptId: uploadAttemptIdBody(value.uploadAttemptId),
    resumeUploadId: stringBody(value.resumeUploadId),
  };
}

export function parseDesktopUploadCompleteInput(
  lockSessionId: string,
  body: unknown
): DesktopMasterUploadCompleteInput {
  const prepared = parseDesktopUploadPrepareInput(lockSessionId, body);
  const value = asBodyRecord(body);
  const objectKey = stringBody(value.objectKey);
  const uploadId = stringBody(value.uploadId);
  const rawParts = Array.isArray(value.parts) ? value.parts : [];
  const parts = rawParts.flatMap((part) => {
    const item = asBodyRecord(part);
    const partNumber = positiveIntegerBody(item.partNumber);
    const etag = stringBody(item.etag);
    return partNumber && etag ? [{ partNumber, etag }] : [];
  });
  if (
    !objectKey ||
    !uploadId ||
    parts.length === 0 ||
    parts.length !== rawParts.length
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop multipart completion request is invalid."
    );
  }
  return { ...prepared, objectKey, uploadId, parts };
}

export function parseDirectCommitMetadata(body: unknown) {
  const value = asBodyRecord(body);
  const objectKey = stringBody(value.objectKey);
  if (!objectKey) {
    return {};
  }
  const fileName = stringBody(value.fileName);
  const mimeType = stringBody(value.mimeType);
  const fileSize = nonnegativeIntegerBody(value.fileSize);
  const uploadAttemptId = uploadAttemptIdBody(value.uploadAttemptId);
  const localContentCrc64 = decimalStringBody(value.localContentCrc64);
  return {
    objectKey,
    fileName,
    mimeType,
    fileSize,
    uploadAttemptId,
    localContentCrc64,
  };
}

export function asBodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function stringBody(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function decimalStringBody(value: unknown) {
  const decimal = stringBody(value);
  if (decimal && !/^\d+$/.test(decimal)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload CRC64 is invalid."
    );
  }
  return decimal;
}

function uploadAttemptIdBody(value: unknown) {
  const uploadAttemptId = stringBody(value);
  if (uploadAttemptId && !/^[a-zA-Z0-9_-]{1,64}$/.test(uploadAttemptId)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Desktop upload attempt identity is invalid."
    );
  }
  return uploadAttemptId;
}

export function positiveIntegerBody(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonnegativeIntegerBody(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
