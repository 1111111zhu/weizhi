import { createHash, randomUUID } from "node:crypto";
import pathModule from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type {
  AttachmentFileKind,
  Prisma,
  ZipMasterOperationType,
  ZipMasterSessionState,
} from "@prisma/client";
import {
  ZipMasterOperationSchema,
  isDesktopAgentOpenSupportedFileName,
  isZipMasterSupportedFileName,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { backgroundJobsEnabled } from "../common/background-jobs";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { StorageService } from "../storage/storage.service";
import type { DownloadObject } from "../storage/storage.service";
import type {
  DesktopMasterOpenRequestContext,
  UploadedWorkflowFile,
} from "./workflow.service";
import {
  applyZipOperationsToEntryTree,
  buildZipEntryTree,
  readZipEntryFile,
  readZipEntryFileWithOperations,
  rebuildZipWithOperations,
  validateZipEntryPath,
} from "./zip-archive";
import type {
  ZipEntryNode,
  ZipEntryTreeOperation,
  ZipOperation,
} from "./zip-archive";

const OPEN_ZIP_SESSION_STATES = [
  "OPEN",
  "DIRTY",
  "CLOSING_WAITING_ENTRIES",
  "CHECKING_IN",
  "RELEASING",
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "RECOVERABLE",
  "LOCK_REVOKED",
  "BASE_VERSION_CONFLICT",
  "DRAFT_EXPIRED",
] as const;
const MUTABLE_ZIP_SESSION_STATES = ["OPEN", "DIRTY", "CHECKIN_FAILED"] as const;
const ENTRY_PARENT_ACTIVE_STATES = [
  ...MUTABLE_ZIP_SESSION_STATES,
  "CLOSING_WAITING_ENTRIES",
] as const;
const CLOSABLE_ZIP_SESSION_STATES = [
  "OPEN",
  "DIRTY",
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "BASE_VERSION_CONFLICT",
] as const;
const OPEN_ZIP_ENTRY_SESSION_STATES = [
  "OPEN",
  "CHECKING_IN",
  "RELEASING",
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "RECOVERABLE",
] as const;
const MUTABLE_ZIP_ENTRY_SESSION_STATES = [
  "OPEN",
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
] as const;
const ZIP_ENTRY_AGENT_ATTACHMENT_ID_PREFIX = "zip-entry:";

type ZipMasterAttachment = {
  id: string;
  projectId: string;
  workingPaperId?: string | null;
  fileKind: AttachmentFileKind;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  headVersionId?: string | null;
  workDate?: Date | null;
  uploadedBy: string;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  lockSessionId?: string | null;
  lockHeartbeatAt?: Date | null;
  lockRevokedAt?: Date | null;
  lockReleaseReason?: string | null;
  deletedAt?: Date | null;
  lockHolder?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type ZipMasterSession = {
  id: string;
  projectId: string;
  attachmentId: string;
  userId: string;
  lockSessionId: string;
  baseVersion: number;
  baseHash: string;
  state: string;
  dirty: boolean;
  closeResponseJson?: unknown;
  entryTreeJson?: unknown;
  lastError?: string | null;
  closedAt?: Date | null;
};

type ZipMasterOperationRecord = {
  id: string;
  sessionId: string;
  sequence: number;
  type: ZipMasterOperationType;
  entryPath: string;
  targetPath?: string | null;
  objectKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

type ZipEntryMasterSession = {
  id: string;
  projectId: string;
  attachmentId: string;
  zipMasterSessionId: string;
  userId: string;
  entryPath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  lockSessionId: string;
  secretHash: string;
  baseHash: string;
  baseContentObjectKey?: string | null;
  baseOperationSequence: number;
  state: ZipMasterSessionState;
  closeResponseJson?: unknown;
  lastError?: string | null;
  closedAt?: Date | null;
};

type ZipEntryMasterStatus = {
  status: "MASTER";
  masterState: string;
};

type ZipEntryNodeWithMasterStatus = ZipEntryNode & {
  status?: "MASTER";
  masterState?: string;
  children?: ZipEntryNodeWithMasterStatus[];
};

export type ZipMasterOperationInput = {
  type: ZipMasterOperationType;
  entryPath: string;
  targetPath?: string;
  objectKey?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export type ZipEntryMasterCheckInInput = {
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  grantSecret: string;
  baseVersion: number;
  localContentHash: string;
  idempotencyKey: string;
  objectKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadAttemptId?: string;
};

export type ZipEntryMasterUploadPrepareInput = ZipEntryMasterCheckInInput & {
  fileName: string;
  fileSize: number;
  mimeType: string;
  resumeUploadId?: string;
};

export type ZipEntryMasterUploadCompleteInput =
  ZipEntryMasterUploadPrepareInput & {
    objectKey: string;
    uploadId: string;
    parts: { partNumber: number; etag: string }[];
  };

type ZipEntryMasterReleaseInput = {
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  grantSecret: string;
  reason: "UNCHANGED_RELEASE" | "CHECKED_IN" | "RECOVERY_ENDED";
};

type ZipEntryMasterHeartbeatInput = Omit<ZipEntryMasterReleaseInput, "reason">;

type StoredZipOperationData = {
  type: ZipMasterOperationType;
  entryPath: string;
  targetPath?: string;
  objectKey?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

type PreparedZipOperation = {
  data: StoredZipOperationData;
  draftFile?: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
  };
};

type ZipEntryDownloadObject =
  | DownloadObject
  | {
      fileName: string;
      mimeType: string;
      buffer: Buffer;
    };

type AttachmentVersionWriter = Pick<
  Prisma.TransactionClient,
  "attachmentVersion"
>;
type ZipOperationClient = Pick<Prisma.TransactionClient, "zipMasterOperation">;

@Injectable()
export class ZipMasterService {
  private readonly logger = new Logger(ZipMasterService.name);
  private readonly queuedZipMasterCheckIns = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
    private readonly access: ProjectAccessService
  ) {}

  @Interval(10_000)
  async reconcileWaitingZipMasterCloses() {
    if (!backgroundJobsEnabled()) {
      return;
    }
    const sessions = (await this.prisma.zipMasterSession.findMany({
      where: { state: "CLOSING_WAITING_ENTRIES" },
      orderBy: { updatedAt: "asc" },
      take: 20,
    })) as ZipMasterSession[];
    for (const session of sessions) {
      await this.advanceWaitingZipMasterClose(session.id, {
        id: session.userId,
      }).catch((error: unknown) => {
        this.logger.warn(
          `Failed to reconcile waiting Zip Master ${session.id}: ${errorMessage(error)}`
        );
      });
    }
  }

  async openMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "uploadWorkingPapers"
    );
    await this.access.requireProjectRole(projectId, user.id, "PREPARER");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const attachment = await this.requireAttachment(projectId, attachmentId);
      this.requireZipAttachment(attachment);

      if (hasActiveLock(attachment)) {
        if (attachment.lockedBy === user.id && attachment.lockSessionId) {
          const session = await this.findOpenSessionForLock(
            projectId,
            attachmentId,
            user.id,
            attachment.lockSessionId
          );
          if (session) {
            return this.buildSessionResponse(attachment, session);
          }
          throw new ApiBadRequestException(
            "LOCK_REVOKED",
            "Zip Master lock is active but no recoverable session exists."
          );
        }
        return lockedByOtherResponse(attachment);
      }

      const baseBuffer = await this.storage.getObjectBuffer(attachment.fileUrl);
      const entries = await safeBuildZipEntryTree(baseBuffer);
      const lockedAt = new Date();
      const lockSessionId = randomUUID();
      const baseFileUrl = attachment.fileUrl;
      const baseVersion = attachment.version;
      const baseHeadVersionId = attachment.headVersionId ?? null;
      const session = await this.prisma.$transaction(async (tx) => {
        const txClient = tx;
        const updated = await txClient.attachment.updateMany({
          where: {
            id: attachmentId,
            projectId,
            deletedAt: null,
            lockedBy: null,
            fileUrl: baseFileUrl,
            version: baseVersion,
            headVersionId: baseHeadVersionId,
          },
          data: {
            lockedBy: user.id,
            lockedAt,
            lockExpiresAt: null,
            lockSessionId,
            lockHeartbeatAt: lockedAt,
            lockStaleAt: null,
            lockRevokedAt: null,
            lockRevokedBy: null,
            lockReleaseReason: null,
          },
        });
        if (updated.count === 0) {
          return null;
        }
        return txClient.zipMasterSession.create({
          data: {
            projectId,
            attachmentId,
            userId: user.id,
            lockSessionId,
            baseVersion,
            baseHash: sha256(baseBuffer),
            state: "OPEN",
            dirty: false,
            entryTreeJson: toStoredEntryTree(entries),
            lastSeenAt: lockedAt,
          },
        });
      });

      if (!session) {
        const current = await this.requireAttachment(projectId, attachmentId);
        if (hasActiveLock(current)) {
          return lockedByOtherResponse(current);
        }
        if (
          current.fileUrl !== baseFileUrl ||
          current.version !== baseVersion ||
          (current.headVersionId ?? null) !== baseHeadVersionId
        ) {
          continue;
        }
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "该文件已被其他成员锁定"
        );
      }

      await this.auditLogs
        .log({
          actorId: user.id,
          action: "ATTACHMENT_ZIP_MASTER_OPENED",
          targetType: "ATTACHMENT",
          targetId: attachmentId,
          projectId,
          description: `Open Zip Master ${displayName(attachment)}`,
          source,
        })
        .catch(() => {});

      return this.buildSessionResponse(
        { ...attachment, lockedBy: user.id, lockSessionId },
        session,
        entries
      );
    }

    throw new ApiBadRequestException(
      "CONFLICT_RISK",
      "Zip Master attachment changed while opening. Please retry."
    );
  }

  async readOnly(projectId: string, attachmentId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireZipAttachment(attachment);
    const snapshot = await this.prisma.zipArchiveSnapshot.findFirst({
      where: {
        attachmentId: attachment.id,
        attachmentVersion: attachment.version,
      },
    });
    const cachedEntries = parseStoredEntryTree(snapshot?.entryTreeJson);
    if (cachedEntries) {
      return {
        ok: true as const,
        mode: "READ_ONLY" as const,
        attachmentId,
        projectId,
        fileName: displayName(attachment),
        version: attachment.version,
        entries: cachedEntries,
      };
    }

    const buffer = await this.storage.getObjectBuffer(attachment.fileUrl);
    const entries = await safeBuildZipEntryTree(buffer);
    await this.prisma.zipArchiveSnapshot.upsert({
      where: {
        attachmentId_attachmentVersion: {
          attachmentId: attachment.id,
          attachmentVersion: attachment.version,
        },
      },
      update: {
        projectId,
        entryTreeJson: toStoredEntryTree(entries),
      },
      create: {
        projectId,
        attachmentId: attachment.id,
        attachmentVersion: attachment.version,
        entryTreeJson: toStoredEntryTree(entries),
      },
    });
    return {
      ok: true as const,
      mode: "READ_ONLY" as const,
      attachmentId,
      projectId,
      fileName: displayName(attachment),
      version: attachment.version,
      entries,
    };
  }

  async downloadReadOnlyEntry(
    projectId: string,
    attachmentId: string,
    entryPath: string,
    user: RequestUser
  ): Promise<ZipEntryDownloadObject> {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireAttachment(projectId, attachmentId);
    this.requireZipAttachment(attachment);
    const normalizedEntryPath = normalizeZipEntryPath(entryPath);
    const cached = await this.prisma.zipArchiveEntryCache.findFirst({
      where: {
        attachmentId: attachment.id,
        attachmentVersion: attachment.version,
        entryPath: normalizedEntryPath,
      },
    });
    if (cached) {
      return this.storage.getDownloadObject(
        cached.objectKey,
        cached.fileName,
        cached.mimeType
      );
    }

    const buffer = await this.storage.getObjectBuffer(attachment.fileUrl);
    const entry = await safeReadZipEntryFile(buffer, normalizedEntryPath);
    const mimeType = inferMimeType(entry.name);
    const stored = await this.storage.putZipCacheObject(
      projectId,
      attachment.id,
      attachment.version,
      entry.name,
      entry.content,
      mimeType
    );
    await this.prisma.zipArchiveEntryCache.upsert({
      where: {
        attachmentId_attachmentVersion_entryPath: {
          attachmentId: attachment.id,
          attachmentVersion: attachment.version,
          entryPath: entry.path,
        },
      },
      update: {
        projectId,
        fileName: entry.name,
        mimeType,
        fileSize: entry.size,
        objectKey: stored.objectKey,
        contentHash: sha256(entry.content),
      },
      create: {
        projectId,
        attachmentId: attachment.id,
        attachmentVersion: attachment.version,
        entryPath: entry.path,
        fileName: entry.name,
        mimeType,
        fileSize: entry.size,
        objectKey: stored.objectKey,
        contentHash: sha256(entry.content),
      },
    });
    return this.storage.getDownloadObject(
      stored.objectKey,
      entry.name,
      mimeType
    );
  }

  async openEntryMaster(
    projectId: string,
    sessionId: string,
    entryPath: string,
    user: RequestUser,
    requestContext: DesktopMasterOpenRequestContext
  ) {
    const session = await this.requireOwnedSession(
      projectId,
      sessionId,
      user.id
    );
    if (
      !(MUTABLE_ZIP_SESSION_STATES as readonly string[]).includes(session.state)
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip Master session is not editable."
      );
    }
    const attachment = await this.requireAttachment(
      projectId,
      session.attachmentId
    );
    await this.requireActiveSessionLock(session, attachment);
    const normalizedEntryPath = normalizeZipEntryPath(entryPath);
    const existing = await this.findOpenEntrySession(
      session.id,
      normalizedEntryPath
    );
    if (existing) {
      this.assertEntrySessionOwner(existing, user.id);
      const grantSecret = randomUUID();
      const refreshed = (await this.prisma.zipEntryMasterSession.update({
        where: { id: existing.id },
        data: {
          secretHash: sha256(Buffer.from(grantSecret)),
          lastSeenAt: new Date(),
          lastError: null,
        },
      })) as ZipEntryMasterSession;
      const hydrated = await this.hydrateEntryMasterBase(attachment, session, {
        ...refreshed,
        grantSecret,
      });
      return this.buildEntryMasterOpenResponse(
        attachment,
        session,
        hydrated,
        requestContext
      );
    }

    const entry = await this.findSessionEntryFileNode(
      attachment,
      session,
      normalizedEntryPath
    );
    const operationRecords = await this.loadZipOperationRecords(session.id);
    const operationSequence = maxOperationSequence(operationRecords);
    if (!isDesktopAgentOpenSupportedFileName(entry.name, "MASTER")) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "This zip entry cannot be opened as Master."
      );
    }

    const lockSessionId = randomUUID();
    const grantSecret = randomUUID();
    const entrySession = (await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const parentClaim = await txClient.zipMasterSession.updateMany({
        where: {
          id: session.id,
          projectId,
          userId: user.id,
          state: { in: [...MUTABLE_ZIP_SESSION_STATES] },
        },
        data: { lastSeenAt: new Date() },
      });
      if (parentClaim.count === 0) {
        throw new ApiBadRequestException(
          "ZIP_MASTER_CLOSING",
          "Zip Master is closing and cannot open another entry Master."
        );
      }
      return txClient.zipEntryMasterSession.create({
        data: {
          projectId,
          attachmentId: attachment.id,
          zipMasterSessionId: session.id,
          userId: user.id,
          entryPath: entry.path,
          fileName: entry.name,
          mimeType: inferMimeType(entry.name),
          fileSize: entry.size ?? 0,
          lockSessionId,
          secretHash: sha256(Buffer.from(grantSecret)),
          baseHash: "",
          baseContentObjectKey: null,
          baseOperationSequence: operationSequence,
          state: "OPEN",
          lastSeenAt: new Date(),
        },
      });
    })) as ZipEntryMasterSession;
    const hydrated = await this.hydrateEntryMasterBase(attachment, session, {
      ...entrySession,
      grantSecret,
    });
    return this.buildEntryMasterOpenResponse(
      attachment,
      session,
      hydrated,
      requestContext
    );
  }

  async downloadSessionEntry(
    projectId: string,
    sessionId: string,
    entryPath: string,
    user: RequestUser
  ): Promise<ZipEntryDownloadObject> {
    const session = await this.requireOwnedSession(
      projectId,
      sessionId,
      user.id
    );
    const attachment = await this.requireAttachment(
      projectId,
      session.attachmentId
    );
    await this.requireActiveSessionLock(session, attachment);
    const normalizedEntryPath = normalizeZipEntryPath(entryPath);
    const entrySession = await this.findOpenEntrySession(
      session.id,
      normalizedEntryPath
    );
    if (entrySession) {
      this.assertEntrySessionOwner(entrySession, user.id);
      if (entrySession.baseContentObjectKey) {
        return this.storage.getDownloadObject(
          entrySession.baseContentObjectKey,
          entrySession.fileName,
          entrySession.mimeType
        );
      }
    }
    const cached = await this.readCachedOrSessionEntryFile(
      attachment,
      session,
      normalizedEntryPath,
      entrySession ?? undefined
    );
    const { entry } = cached;
    if (entrySession && cached.objectKey) {
      return this.storage.getDownloadObject(
        cached.objectKey,
        entry.name,
        inferMimeType(entry.name)
      );
    }
    return {
      fileName: entry.name,
      mimeType: inferMimeType(entry.name),
      buffer: entry.content,
    };
  }

  async prepareEntryMasterUpload(input: ZipEntryMasterUploadPrepareInput) {
    const { entrySession } = await this.requireMutableEntryUpload(input);
    const objectKey = buildZipEntryCheckInObjectKey(entrySession, input);
    return this.storage.createResumableUploadGrant({
      objectKey,
      contentType: input.mimeType,
      fileSize: input.fileSize,
      contentSha256: input.localContentHash,
      resumeUploadId: input.resumeUploadId,
    });
  }

  async completeEntryMasterUpload(input: ZipEntryMasterUploadCompleteInput) {
    const { entrySession } = await this.requireMutableEntryUpload(input);
    assertZipEntryCheckInObjectKey(entrySession, input, input.objectKey);
    await this.storage.completeResumableUpload({
      objectKey: input.objectKey,
      uploadId: input.uploadId,
      parts: input.parts,
      fileSize: input.fileSize,
      contentSha256: input.localContentHash,
    });
    return { ok: true as const, objectKey: input.objectKey };
  }

  async heartbeatEntryMasterSession(input: ZipEntryMasterHeartbeatInput) {
    const entrySession = await this.requireEntrySession(input);
    this.assertEntrySessionGrant(entrySession, input.grantSecret);
    if (!isMutableZipEntrySessionState(entrySession.state)) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Zip entry Master session is no longer editable."
      );
    }
    const { attachment, session } =
      await this.requireEntryParentSession(entrySession);
    const heartbeatAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      await txClient.zipEntryMasterSession.update({
        where: { id: entrySession.id },
        data: { lastSeenAt: heartbeatAt },
      });
      const updated = await txClient.attachment.updateMany({
        where: activeLockWhere(attachment, session),
        data: { lockHeartbeatAt: heartbeatAt },
      });
      if (updated.count === 0) {
        throw new ApiBadRequestException(
          "LOCK_REVOKED",
          "Zip Master lock is no longer active."
        );
      }
    });
    return {
      ok: true as const,
      lockSessionId: entrySession.lockSessionId,
      heartbeatAt: heartbeatAt.toISOString(),
    };
  }

  async checkInEntryMasterSession(
    input: ZipEntryMasterCheckInInput,
    file?: UploadedWorkflowFile,
    source?: AuditLogSource
  ) {
    const entrySession = await this.requireEntrySession(input);
    this.assertEntrySessionGrant(entrySession, input.grantSecret);
    if (entrySession.state === "CLOSED" && entrySession.closeResponseJson) {
      await this.advanceWaitingZipMasterClose(
        entrySession.zipMasterSessionId,
        { id: entrySession.userId },
        source,
        true
      );
      return entrySession.closeResponseJson;
    }
    if (!isMutableZipEntrySessionState(entrySession.state)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip entry Master session is not editable."
      );
    }
    const { attachment, session } =
      await this.requireEntryParentSession(entrySession);
    if (attachment.version > input.baseVersion) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "Server version is newer than the zip entry Master session base version."
      );
    }
    const conflictingOperation = await this.findEntryOperationConflict(
      session.id,
      entrySession.entryPath,
      entrySession.baseOperationSequence
    );
    if (conflictingOperation) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "Zip entry changed after this Master session opened."
      );
    }

    const directUpload = input.objectKey
      ? await this.resolveEntryMasterCheckInObject(entrySession, input)
      : null;
    if (!directUpload && !file?.buffer?.length) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "请上传文件");
    }

    let { baseHash } = entrySession;
    if (!baseHash) {
      const cached = await this.readCachedOrSessionEntryFile(
        attachment,
        session,
        entrySession.entryPath,
        entrySession
      );
      baseHash = sha256(cached.entry.content);
    }

    const localHash = input.localContentHash;
    const checkedInAt = new Date();
    const response = {
      ok: true as const,
      uploaded: localHash !== baseHash,
      projectId: entrySession.projectId,
      attachmentId: entrySession.attachmentId,
      zipMasterSessionId: entrySession.zipMasterSessionId,
      entryPath: entrySession.entryPath,
      lockSessionId: input.lockSessionId,
      localContentHash: localHash,
    };

    if (!response.uploaded) {
      await this.closeEntrySession(entrySession, response, checkedInAt);
      await this.advanceWaitingZipMasterClose(
        entrySession.zipMasterSessionId,
        { id: entrySession.userId },
        source
      );
      return response;
    }

    const stored = directUpload
      ? { objectKey: directUpload.objectKey }
      : await this.storage.putZipDraftObject(
          input.projectId,
          entrySession.zipMasterSessionId,
          entrySession.fileName,
          (file as UploadedWorkflowFile).buffer,
          file?.mimetype || "application/octet-stream"
        );
    const checkedInFileSize = directUpload?.fileSize ?? file?.size ?? 0;
    const checkedInMimeType =
      directUpload?.mimeType ?? file?.mimetype ?? "application/octet-stream";

    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const claimed = await txClient.zipEntryMasterSession.updateMany({
        where: {
          id: entrySession.id,
          state: { in: [...MUTABLE_ZIP_ENTRY_SESSION_STATES] },
        },
        data: {
          state: "CLOSED",
          closeResponseJson: response,
          closedAt: checkedInAt,
          lastSeenAt: checkedInAt,
          lastError: null,
        },
      });
      if (claimed.count === 0) {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "Zip entry Master session is not editable."
        );
      }
      let updatedParent = await txClient.zipMasterSession.updateMany({
        where: {
          id: session.id,
          projectId: input.projectId,
          userId: entrySession.userId,
          state: "CLOSING_WAITING_ENTRIES",
        },
        data: {
          dirty: true,
          lastSeenAt: checkedInAt,
          lastError: null,
        },
      });
      if (updatedParent.count === 0) {
        updatedParent = await txClient.zipMasterSession.updateMany({
          where: {
            id: session.id,
            projectId: input.projectId,
            userId: entrySession.userId,
            state: { in: [...MUTABLE_ZIP_SESSION_STATES] },
          },
          data: {
            state: "DIRTY",
            dirty: true,
            lastSeenAt: checkedInAt,
            lastError: null,
          },
        });
      }
      if (updatedParent.count === 0) {
        throw new ApiBadRequestException(
          "LOCK_REVOKED",
          "Parent Zip Master session is not editable."
        );
      }
      const sequence = await this.nextOperationSequence(session.id, txClient);
      await txClient.zipMasterOperation.create({
        data: {
          sessionId: session.id,
          sequence,
          type: "REPLACE_FILE",
          entryPath: entrySession.entryPath,
          objectKey: stored.objectKey,
          fileName: entrySession.fileName,
          mimeType: checkedInMimeType,
          fileSize: checkedInFileSize,
        },
      });
    });

    await this.advanceWaitingZipMasterClose(
      entrySession.zipMasterSessionId,
      { id: entrySession.userId },
      source
    );

    await this.auditLogs
      .log({
        actorId: entrySession.userId,
        action: "ATTACHMENT_ZIP_ENTRY_MASTER_CHECKED_IN",
        targetType: "ATTACHMENT",
        targetId: entrySession.attachmentId,
        projectId: entrySession.projectId,
        description: `Checked in zip entry ${entrySession.entryPath}`,
        source,
      })
      .catch(() => {});
    return response;
  }

  async releaseEntryMasterSession(
    input: ZipEntryMasterReleaseInput,
    source?: AuditLogSource
  ) {
    const entrySession = await this.requireEntrySession(input);
    this.assertEntrySessionGrant(entrySession, input.grantSecret);
    if (entrySession.state === "CLOSED" && entrySession.closeResponseJson) {
      await this.advanceWaitingZipMasterClose(
        entrySession.zipMasterSessionId,
        { id: entrySession.userId },
        source,
        true
      );
      return input.reason === "RECOVERY_ENDED"
        ? { ...(entrySession.closeResponseJson as object), recoveryEnded: true }
        : entrySession.closeResponseJson;
    }
    await this.requireEntryParentSession(entrySession, false);
    const releasedAt = new Date();
    const response = {
      ok: true as const,
      released: true as const,
      projectId: entrySession.projectId,
      attachmentId: entrySession.attachmentId,
      zipMasterSessionId: entrySession.zipMasterSessionId,
      entryPath: entrySession.entryPath,
      lockSessionId: input.lockSessionId,
      reason: input.reason,
      ...(input.reason === "RECOVERY_ENDED" ? { recoveryEnded: true } : {}),
    };
    await this.closeEntrySession(entrySession, response, releasedAt);
    await this.advanceWaitingZipMasterClose(
      entrySession.zipMasterSessionId,
      { id: entrySession.userId },
      source,
      true
    );
    await this.auditLogs
      .log({
        actorId: entrySession.userId,
        action: "ATTACHMENT_ZIP_ENTRY_MASTER_RELEASED",
        targetType: "ATTACHMENT",
        targetId: entrySession.attachmentId,
        projectId: entrySession.projectId,
        description: `Released zip entry ${entrySession.entryPath}`,
        source,
      })
      .catch(() => {});
    return response;
  }

  async addOperation(
    projectId: string,
    sessionId: string,
    user: RequestUser,
    input: ZipMasterOperationInput,
    file?: UploadedWorkflowFile
  ) {
    const session = await this.requireOwnedSession(
      projectId,
      sessionId,
      user.id
    );
    if (
      !(MUTABLE_ZIP_SESSION_STATES as readonly string[]).includes(session.state)
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip Master session is not editable."
      );
    }
    const attachment = await this.requireAttachment(
      projectId,
      session.attachmentId
    );
    await this.requireActiveSessionLock(session, attachment);

    const prepared = this.prepareOperationInput(input, file);
    const baseEntries = await this.getSessionBaseEntryTree(attachment, session);
    const updatedAt = new Date();
    let entries: ZipEntryNode[] = [];
    await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const claimed = await txClient.zipMasterSession.updateMany({
        where: {
          id: sessionId,
          projectId,
          userId: user.id,
          state: { in: [...MUTABLE_ZIP_SESSION_STATES] },
        },
        data: {
          state: "DIRTY",
          dirty: true,
          lastSeenAt: updatedAt,
          lastError: null,
        },
      });
      if (claimed.count === 0) {
        throw new ApiBadRequestException(
          "BAD_REQUEST",
          "Zip Master session is not editable."
        );
      }
      const operations = await this.loadZipOperationData(sessionId, txClient);
      entries = safeApplyZipOperationsToEntryTree(baseEntries, [
        ...operations,
        prepared.data,
      ]);
      const operation = await this.storeOperationDraftContent(
        projectId,
        session,
        prepared
      );
      const sequence = await this.nextOperationSequence(sessionId, txClient);
      await txClient.zipMasterOperation.create({
        data: {
          sessionId,
          sequence,
          ...operation,
        },
      });
    });

    return this.buildSessionResponse(
      attachment,
      {
        ...session,
        state: "DIRTY",
        dirty: true,
      },
      entries
    );
  }

  async close(
    projectId: string,
    sessionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const session = await this.requireOwnedSession(
      projectId,
      sessionId,
      user.id
    );
    if (session.state === "CLOSED" && session.closeResponseJson) {
      return session.closeResponseJson;
    }
    if (session.state === "CHECKING_IN") {
      const attachment = await this.requireAttachment(
        projectId,
        session.attachmentId
      );
      await this.requireActiveSessionLock(session, attachment);
      this.enqueueZipMasterCheckIn(session.id, user, source);
      return this.buildQueuedCloseResponse(attachment, session);
    }
    if (session.state === "CLOSING_WAITING_ENTRIES") {
      const attachment = await this.requireAttachment(
        projectId,
        session.attachmentId
      );
      await this.requireActiveSessionLock(session, attachment);
      return this.advanceWaitingZipMasterClose(session.id, user, source);
    }
    const attachment = await this.requireAttachment(
      projectId,
      session.attachmentId
    );
    await this.requireActiveSessionLock(session, attachment);
    const closingSession = await this.beginSessionClose(
      session,
      "CLOSING_WAITING_ENTRIES",
      CLOSABLE_ZIP_SESSION_STATES
    );
    return this.advanceWaitingZipMasterClose(closingSession.id, user, source);
  }

  private buildQueuedCloseResponse(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession
  ) {
    return {
      ok: true as const,
      checkedIn: false as const,
      discarded: false as const,
      queued: true as const,
      attachmentId: attachment.id,
      projectId: attachment.projectId,
      sessionId: session.id,
      lockSessionId: session.lockSessionId,
      version: attachment.version,
    };
  }

  private buildWaitingCloseResponse(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entrySessions: ZipEntryMasterSession[]
  ) {
    return {
      ok: true as const,
      checkedIn: false as const,
      discarded: false as const,
      queued: false as const,
      waitingForEntries: true as const,
      activeEntryMasters: entrySessions.map((entrySession) => ({
        entryPath: entrySession.entryPath,
        state: entrySession.state,
      })),
      attachmentId: attachment.id,
      projectId: attachment.projectId,
      sessionId: session.id,
      lockSessionId: session.lockSessionId,
      version: attachment.version,
    };
  }

  private async advanceWaitingZipMasterClose(
    sessionId: string,
    user: Pick<RequestUser, "id">,
    source?: AuditLogSource,
    cleanupOnlyIfUnauthorized = false
  ): Promise<unknown> {
    const session = (await this.prisma.zipMasterSession.findUnique({
      where: { id: sessionId },
    })) as ZipMasterSession | null;
    if (!session) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip Master session not found."
      );
    }
    if (session.state === "CLOSED" && session.closeResponseJson) {
      return session.closeResponseJson;
    }
    const attachment = await this.requireAttachment(
      session.projectId,
      session.attachmentId
    );
    try {
      await this.requireActiveSessionLock(session, attachment);
    } catch (error) {
      if (
        cleanupOnlyIfUnauthorized &&
        (error instanceof ApiForbiddenException ||
          error instanceof ApiNotFoundException)
      ) {
        return null;
      }
      throw error;
    }
    if (session.state === "CHECKING_IN") {
      this.enqueueZipMasterCheckIn(session.id, user, source);
      return this.buildQueuedCloseResponse(attachment, session);
    }
    if (session.state !== "CLOSING_WAITING_ENTRIES") {
      return null;
    }

    const activeEntrySessions = await this.listOpenEntrySessions(session.id);
    if (activeEntrySessions.length > 0) {
      return this.buildWaitingCloseResponse(
        attachment,
        session,
        activeEntrySessions
      );
    }

    const claimed = await this.prisma.zipMasterSession.updateMany({
      where: {
        id: session.id,
        projectId: session.projectId,
        userId: session.userId,
        state: "CLOSING_WAITING_ENTRIES",
      },
      data: {
        state: "CHECKING_IN",
        lastSeenAt: new Date(),
        lastError: null,
      },
    });
    if (claimed.count === 0) {
      const current = (await this.prisma.zipMasterSession.findUnique({
        where: { id: session.id },
      })) as ZipMasterSession | null;
      if (current?.state === "CLOSED" && current.closeResponseJson) {
        return current.closeResponseJson;
      }
      if (current?.state === "CHECKING_IN") {
        this.enqueueZipMasterCheckIn(current.id, user, source);
        return this.buildQueuedCloseResponse(attachment, current);
      }
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip Master close state changed."
      );
    }

    const closingSession = {
      ...session,
      state: "CHECKING_IN",
    };
    if (attachment.version !== closingSession.baseVersion) {
      await this.markSession(session.id, "BASE_VERSION_CONFLICT");
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "Server version is newer than the zip Master session base version."
      );
    }
    if (!closingSession.dirty) {
      return this.releaseWithoutVersion(
        closingSession,
        attachment,
        user,
        "UNCHANGED_RELEASE",
        false,
        source
      );
    }

    this.enqueueZipMasterCheckIn(closingSession.id, user, source);
    return this.buildQueuedCloseResponse(attachment, closingSession);
  }

  private enqueueZipMasterCheckIn(
    sessionId: string,
    user: Pick<RequestUser, "id">,
    source?: AuditLogSource
  ) {
    if (this.queuedZipMasterCheckIns.has(sessionId)) {
      return;
    }
    this.queuedZipMasterCheckIns.add(sessionId);
    const timer = setTimeout(() => {
      void this.finishQueuedZipMasterCheckIn(sessionId, user, source).finally(
        () => {
          this.queuedZipMasterCheckIns.delete(sessionId);
        }
      );
    }, 0);
    timer.unref?.();
  }

  private async finishQueuedZipMasterCheckIn(
    sessionId: string,
    user: Pick<RequestUser, "id">,
    source?: AuditLogSource
  ) {
    const session = (await this.prisma.zipMasterSession.findUnique({
      where: { id: sessionId },
    })) as ZipMasterSession | null;
    if (!session || session.state !== "CHECKING_IN") {
      return;
    }

    try {
      const attachment = await this.requireAttachment(
        session.projectId,
        session.attachmentId
      );
      await this.requireActiveSessionLock(session, attachment);
      if (attachment.version !== session.baseVersion) {
        await this.markSession(
          session.id,
          "BASE_VERSION_CONFLICT",
          "Server version is newer than the zip Master session base version."
        );
        return;
      }

      const baseBuffer = await this.storage.getObjectBuffer(attachment.fileUrl);
      if (sha256(baseBuffer) !== session.baseHash) {
        await this.markSession(
          session.id,
          "BASE_VERSION_CONFLICT",
          "Base zip content no longer matches this Master session."
        );
        return;
      }

      const operations = await this.loadZipOperations(session.id);
      if (operations.length === 0) {
        await this.releaseWithoutVersion(
          session,
          attachment,
          user,
          "UNCHANGED_RELEASE",
          false,
          source
        );
        return;
      }

      const originalName = displayName(attachment);
      const rebuilt = await safeRebuildZipWithOperations(
        baseBuffer,
        operations
      );
      const stored = await this.storage.putObject(
        session.projectId,
        attachment.workingPaperId ?? "unassigned",
        originalName,
        rebuilt,
        "application/zip"
      );
      const checkedInAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const txClient = tx;
        const parentVersionId = await resolveAttachmentHeadVersionId(
          txClient,
          attachment
        );
        const version = attachment.version + 1;
        const lockClaim = await txClient.attachment.updateMany({
          where: activeAttachmentWhere(attachment, session),
          data: { lockHeartbeatAt: checkedInAt },
        });
        if (lockClaim.count === 0) {
          throw new ApiBadRequestException(
            "LOCK_REVOKED",
            "Zip Master lock is no longer active."
          );
        }
        const revision = await createAttachmentRevision(txClient, {
          attachmentId: attachment.id,
          projectId: session.projectId,
          version,
          parentVersionId,
          sourceVersionId: null,
          fileKind: attachment.fileKind,
          fileName: stored.fileName,
          originalName,
          fileUrl: stored.objectKey,
          fileSize: rebuilt.length,
          mimeType: "application/zip",
          workDate: attachment.workDate ?? null,
          uploadedBy: user.id,
          uploadedAt: checkedInAt,
          archivedBy: user.id,
          action: "CHECK_IN",
          createdAt: checkedInAt,
        });
        const updated = await txClient.attachment.updateMany({
          where: activeAttachmentWhere(attachment, session),
          data: {
            fileName: stored.fileName,
            originalName,
            fileUrl: stored.objectKey,
            fileSize: rebuilt.length,
            mimeType: "application/zip",
            version,
            headVersionId: revision.id,
            uploadedBy: user.id,
            lastModifiedBy: user.id,
            lastModifiedAt: checkedInAt,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lockSessionId: null,
            lockHeartbeatAt: null,
            lockStaleAt: null,
            lockRevokedAt: null,
            lockRevokedBy: null,
            lockReleaseReason: "CHECKED_IN",
          },
        });
        if (updated.count === 0) {
          throw new ApiBadRequestException(
            "LOCK_REVOKED",
            "Zip Master lock is no longer active."
          );
        }
        const closeResponse = {
          ok: true as const,
          checkedIn: true as const,
          discarded: false as const,
          attachmentId: attachment.id,
          projectId: session.projectId,
          sessionId: session.id,
          lockSessionId: session.lockSessionId,
          version,
        };
        await txClient.zipMasterSession.update({
          where: { id: session.id },
          data: {
            state: "CLOSED",
            dirty: false,
            closeResponseJson: closeResponse,
            closedAt: checkedInAt,
            lastSeenAt: checkedInAt,
            lastError: null,
          },
        });
      });

      await this.auditLogs
        .log({
          actorId: user.id,
          action: "ATTACHMENT_ZIP_MASTER_CHECKED_IN",
          targetType: "ATTACHMENT",
          targetId: attachment.id,
          projectId: session.projectId,
          description: `Checked in Zip Master ${originalName}`,
          source,
        })
        .catch(() => {});
    } catch (error) {
      const currentSession = (await this.prisma.zipMasterSession.findUnique({
        where: { id: session.id },
      })) as ZipMasterSession | null;
      if (!currentSession || currentSession.state === "CLOSED") {
        return;
      }
      await this.markFailedClose(session.id, error, "CHECKIN_FAILED");
    }
  }

  async discard(
    projectId: string,
    sessionId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const session = await this.requireOwnedSession(
      projectId,
      sessionId,
      user.id
    );
    if (session.state === "CLOSED" && session.closeResponseJson) {
      return session.closeResponseJson;
    }
    const attachment = await this.requireAttachment(
      projectId,
      session.attachmentId
    );
    await this.requireActiveSessionLock(session, attachment, false);
    const activeEntrySessions = await this.listOpenEntrySessions(session.id);
    if (activeEntrySessions.length > 0) {
      throw new ApiBadRequestException(
        "ZIP_ENTRY_MASTERS_ACTIVE",
        "Close or release every open zip entry Master before discarding the Zip Master."
      );
    }
    const releasingSession = await this.beginSessionClose(
      session,
      "RELEASING",
      [...CLOSABLE_ZIP_SESSION_STATES, "CLOSING_WAITING_ENTRIES"]
    );
    return this.releaseWithoutVersion(
      releasingSession,
      attachment,
      user,
      "DISCARDED",
      true,
      source
    );
  }

  private async readSessionEntryFile(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entryPath: string
  ) {
    const entryFile = await this.readSessionEntryFileWithCursor(
      attachment,
      session,
      entryPath
    );
    return entryFile.entry;
  }

  private async readCachedOrSessionEntryFile(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entryPath: string,
    entrySession?: ZipEntryMasterSession
  ) {
    if (entrySession?.baseContentObjectKey) {
      const content = await this.storage.getObjectBuffer(
        entrySession.baseContentObjectKey
      );
      return {
        entry: {
          path: entrySession.entryPath,
          name: entrySession.fileName,
          size: content.length,
          content,
        },
        objectKey: entrySession.baseContentObjectKey,
      };
    }

    const { entry } = await this.readSessionEntryFileWithCursor(
      attachment,
      session,
      entryPath
    );
    if (entrySession) {
      const stored = await this.storage.putZipDraftObject(
        session.projectId,
        session.id,
        `base-${entrySession.id}${pathModule.extname(entry.name)}`,
        entry.content,
        inferMimeType(entry.name)
      );
      await this.prisma.zipEntryMasterSession.updateMany({
        where: {
          id: entrySession.id,
          state: { in: [...OPEN_ZIP_ENTRY_SESSION_STATES] },
        },
        data: {
          fileName: entry.name,
          mimeType: inferMimeType(entry.name),
          fileSize: entry.size,
          baseHash: sha256(entry.content),
          baseContentObjectKey: stored.objectKey,
          lastSeenAt: new Date(),
          lastError: null,
        },
      });
      return { entry, objectKey: stored.objectKey };
    }
    return { entry };
  }

  private async hydrateEntryMasterBase(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entrySession: ZipEntryMasterSession & { grantSecret?: string }
  ) {
    if (entrySession.baseHash && entrySession.baseContentObjectKey) {
      return entrySession;
    }
    const cached = await this.readCachedOrSessionEntryFile(
      attachment,
      session,
      entrySession.entryPath,
      entrySession
    );
    return {
      ...entrySession,
      fileName: cached.entry.name,
      mimeType: inferMimeType(cached.entry.name),
      fileSize: cached.entry.size,
      baseHash: sha256(cached.entry.content),
      baseContentObjectKey:
        cached.objectKey ?? entrySession.baseContentObjectKey ?? null,
    };
  }

  private async readSessionEntryFileWithCursor(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entryPath: string
  ) {
    const baseBuffer = await this.storage.getObjectBuffer(attachment.fileUrl);
    const operationRecords = await this.loadZipOperationRecords(session.id);
    const operations = await this.recordsToZipOperations(operationRecords);
    const operationSequence = maxOperationSequence(operationRecords);
    if (operations.length === 0) {
      return {
        entry: await safeReadZipEntryFile(baseBuffer, entryPath),
        operationSequence,
      };
    }
    return {
      entry: await safeReadZipEntryFileWithOperations(
        baseBuffer,
        operations,
        entryPath
      ),
      operationSequence,
    };
  }

  private async findSessionEntryFileNode(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entryPath: string
  ) {
    const node = findEntryTreeNode(
      await this.computeEntries(attachment, session),
      entryPath
    );
    if (!node || node.type !== "file") {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip entry does not exist."
      );
    }
    return node;
  }

  private async getSessionBaseEntryTree(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession
  ) {
    const stored = parseStoredEntryTree(session.entryTreeJson);
    if (stored) {
      return stored;
    }
    return safeBuildZipEntryTree(
      await this.storage.getObjectBuffer(attachment.fileUrl)
    );
  }

  private async findEntryOperationConflict(
    sessionId: string,
    entryPath: string,
    afterSequence: number
  ) {
    const records = (await this.prisma.zipMasterOperation.findMany({
      where: { sessionId, sequence: { gte: afterSequence + 1 } },
      orderBy: { sequence: "asc" },
    })) as ZipMasterOperationRecord[];
    const operations = recordsToStoredZipOperationData(records);
    return (
      operations.find((operation) =>
        zipOperationTouchesEntry(operation, entryPath)
      ) ?? null
    );
  }

  private async findOpenEntrySession(
    zipMasterSessionId: string,
    entryPath: string
  ) {
    return (await this.prisma.zipEntryMasterSession.findFirst({
      where: {
        zipMasterSessionId,
        entryPath,
        state: { in: [...OPEN_ZIP_ENTRY_SESSION_STATES] },
      },
    })) as ZipEntryMasterSession | null;
  }

  private async listOpenEntrySessions(zipMasterSessionId: string) {
    return (await this.prisma.zipEntryMasterSession.findMany({
      where: {
        zipMasterSessionId,
        state: { in: [...OPEN_ZIP_ENTRY_SESSION_STATES] },
      },
    })) as ZipEntryMasterSession[];
  }

  private assertEntrySessionOwner(
    entrySession: ZipEntryMasterSession,
    userId: string
  ) {
    if (entrySession.userId !== userId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip entry is already opened by another member."
      );
    }
  }

  private buildEntryMasterOpenResponse(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entrySession: ZipEntryMasterSession & { grantSecret?: string },
    requestContext: DesktopMasterOpenRequestContext
  ) {
    return {
      ok: true as const,
      mode: "ZIP_ENTRY_MASTER" as const,
      projectId: attachment.projectId,
      attachmentId: buildZipEntryAgentAttachmentId(
        attachment.id,
        entrySession.entryPath
      ),
      zipMasterSessionId: session.id,
      entryPath: entrySession.entryPath,
      fileName: entrySession.fileName,
      mimeType: entrySession.mimeType,
      fileSize: entrySession.fileSize,
      lockSessionId: entrySession.lockSessionId,
      baseVersion: attachment.version,
      contentToken: entrySession.baseHash || undefined,
      contentHash: entrySession.baseHash || undefined,
      cacheVersionId: buildZipEntryCacheVersionId(attachment, entrySession),
      cacheOwnerId: entrySession.userId,
      directUploadSupported: this.storage.supportsDirectTransfer?.() ?? false,
      grantSecret: entrySession.grantSecret,
      downloadUrl: buildZipEntryDownloadUrl(
        requestContext,
        attachment.projectId,
        session.id,
        entrySession.entryPath
      ),
      heartbeatUrl: buildZipEntryCallbackUrl(
        requestContext,
        entrySession.lockSessionId,
        "heartbeat"
      ),
      checkInUrl: buildZipEntryCallbackUrl(
        requestContext,
        entrySession.lockSessionId,
        "check-in"
      ),
      releaseUrl: buildZipEntryCallbackUrl(
        requestContext,
        entrySession.lockSessionId,
        "release"
      ),
    };
  }

  private async requireEntrySession(input: {
    projectId: string;
    attachmentId: string;
    lockSessionId: string;
  }) {
    const entrySession = (await this.prisma.zipEntryMasterSession.findFirst({
      where: {
        projectId: input.projectId,
        lockSessionId: input.lockSessionId,
      },
    })) as ZipEntryMasterSession | null;
    const acceptedAttachmentIds = entrySession
      ? new Set([
          entrySession.attachmentId,
          `${ZIP_ENTRY_AGENT_ATTACHMENT_ID_PREFIX}${entrySession.id}`,
          buildZipEntryAgentAttachmentId(
            entrySession.attachmentId,
            entrySession.entryPath
          ),
        ])
      : null;
    if (!entrySession || !acceptedAttachmentIds?.has(input.attachmentId)) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip entry Master session not found."
      );
    }
    return entrySession;
  }

  private assertEntrySessionGrant(
    entrySession: ZipEntryMasterSession,
    grantSecret: string
  ) {
    if (entrySession.secretHash !== sha256(Buffer.from(grantSecret))) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Zip entry Master grant is invalid."
      );
    }
  }

  private async requireMutableEntryUpload(
    input: ZipEntryMasterUploadPrepareInput
  ) {
    const entrySession = await this.requireEntrySession(input);
    this.assertEntrySessionGrant(entrySession, input.grantSecret);
    if (!isMutableZipEntrySessionState(entrySession.state)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip entry Master session is not editable."
      );
    }
    const { attachment, session } =
      await this.requireEntryParentSession(entrySession);
    if (attachment.version > input.baseVersion) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "Server version is newer than the zip entry Master session base version."
      );
    }
    const conflict = await this.findEntryOperationConflict(
      session.id,
      entrySession.entryPath,
      entrySession.baseOperationSequence
    );
    if (conflict) {
      throw new ApiBadRequestException(
        "CONFLICT_RISK",
        "Zip entry changed after this Master session opened."
      );
    }
    return { entrySession, attachment, session };
  }

  private async resolveEntryMasterCheckInObject(
    entrySession: ZipEntryMasterSession,
    input: ZipEntryMasterCheckInInput
  ) {
    if (
      !input.objectKey ||
      !input.fileName ||
      input.fileSize === undefined ||
      !input.mimeType
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip entry direct upload metadata is invalid."
      );
    }
    assertZipEntryCheckInObjectKey(entrySession, input, input.objectKey);
    await this.storage.assertUploadedObject(
      input.objectKey,
      input.fileSize,
      input.localContentHash
    );
    return {
      objectKey: input.objectKey,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
    };
  }

  private async requireEntryParentSession(
    entrySession: ZipEntryMasterSession,
    verifyAuthorization = true
  ) {
    const session = (await this.prisma.zipMasterSession.findFirst({
      where: {
        id: entrySession.zipMasterSessionId,
        projectId: entrySession.projectId,
        attachmentId: entrySession.attachmentId,
        userId: entrySession.userId,
        state: { in: [...ENTRY_PARENT_ACTIVE_STATES] },
      },
    })) as ZipMasterSession | null;
    if (!session) {
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Parent Zip Master session is not editable."
      );
    }
    const attachment = await this.requireAttachment(
      entrySession.projectId,
      entrySession.attachmentId
    );
    await this.requireActiveSessionLock(
      session,
      attachment,
      verifyAuthorization
    );
    return { attachment, session };
  }

  private async closeEntrySession(
    entrySession: ZipEntryMasterSession,
    response: unknown,
    closedAt: Date
  ) {
    await this.prisma.zipEntryMasterSession.update({
      where: { id: entrySession.id },
      data: {
        state: "CLOSED",
        closeResponseJson: response as Prisma.InputJsonValue,
        closedAt,
        lastSeenAt: closedAt,
        lastError: null,
      },
    });
  }

  private prepareOperationInput(
    input: ZipMasterOperationInput,
    file?: UploadedWorkflowFile
  ): PreparedZipOperation {
    const entryPath = normalizeZipEntryPath(input.entryPath);

    if (input.type === "ADD_FILE" || input.type === "REPLACE_FILE") {
      if (!file?.buffer?.length) {
        throw new ApiBadRequestException("VALIDATION_FAILED", "请上传文件");
      }
      const fileName = normalizeFileName(file.originalname);
      if (!fileName) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "Zip operation is invalid."
        );
      }
      const mimeType = file.mimetype || "application/octet-stream";
      const fileSize = file.size;
      return {
        data: {
          type: input.type,
          entryPath,
          fileName,
          mimeType,
          fileSize,
        },
        draftFile: {
          fileName,
          mimeType,
          fileSize,
          buffer: file.buffer,
        },
      };
    }

    const targetPath = input.targetPath
      ? normalizeZipEntryPath(input.targetPath)
      : undefined;
    const normalizedInput: ZipMasterOperationInput = {
      ...input,
      entryPath,
      ...(targetPath ? { targetPath } : {}),
    };
    const parsed = ZipMasterOperationSchema.safeParse(normalizedInput);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip operation is invalid."
      );
    }
    return {
      data: parsed.data,
    };
  }

  private async storeOperationDraftContent(
    projectId: string,
    session: ZipMasterSession,
    prepared: PreparedZipOperation
  ) {
    if (!prepared.draftFile) {
      return prepared.data;
    }
    const stored = await this.storage.putZipDraftObject(
      projectId,
      session.id,
      prepared.draftFile.fileName,
      prepared.draftFile.buffer,
      prepared.draftFile.mimeType
    );
    const operation = {
      ...prepared.data,
      objectKey: stored.objectKey,
    };
    const parsed = ZipMasterOperationSchema.safeParse(operation);
    if (!parsed.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip operation is invalid."
      );
    }
    return parsed.data;
  }

  private async buildSessionResponse(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession,
    entries?: ZipEntryNode[]
  ) {
    const sessionEntries =
      entries ?? (await this.computeEntries(attachment, session));
    const openEntrySessions = await this.listOpenEntrySessions(session.id);
    const activeEntryMasters = openEntrySessions.map((entrySession) => ({
      entryPath: entrySession.entryPath,
      state: entrySession.state,
    }));
    return {
      ok: true as const,
      mode: "MASTER" as const,
      sessionId: session.id,
      attachmentId: attachment.id,
      projectId: attachment.projectId,
      lockSessionId: session.lockSessionId,
      fileName: displayName(attachment),
      version: attachment.version,
      state: session.state,
      dirty: session.dirty,
      activeEntryMasters,
      entries: await this.withEntryMasterStatuses(session.id, sessionEntries),
    };
  }

  private async withEntryMasterStatuses(
    sessionId: string,
    entries: ZipEntryNode[]
  ): Promise<ZipEntryNodeWithMasterStatus[]> {
    const entrySessions = (await this.prisma.zipEntryMasterSession.findMany({
      where: {
        zipMasterSessionId: sessionId,
        state: { in: [...OPEN_ZIP_ENTRY_SESSION_STATES] },
      },
    })) as ZipEntryMasterSession[];
    if (entrySessions.length === 0) {
      return entries;
    }
    const statuses = new Map<string, ZipEntryMasterStatus>(
      entrySessions.map((entrySession) => [
        entrySession.entryPath,
        { status: "MASTER", masterState: entrySession.state },
      ])
    );
    return applyEntryMasterStatuses(entries, statuses);
  }

  private async computeEntries(
    attachment: ZipMasterAttachment,
    session: ZipMasterSession
  ): Promise<ZipEntryNode[]> {
    const baseEntries = await this.getSessionBaseEntryTree(attachment, session);
    const operations = await this.loadZipOperationData(session.id);
    return safeApplyZipOperationsToEntryTree(baseEntries, operations);
  }

  private async loadZipOperationData(
    sessionId: string,
    client: ZipOperationClient = this.prisma
  ): Promise<StoredZipOperationData[]> {
    const records = await this.loadZipOperationRecords(sessionId, client);
    return recordsToStoredZipOperationData(records);
  }

  private async loadZipOperationRecords(
    sessionId: string,
    client: ZipOperationClient = this.prisma
  ): Promise<ZipMasterOperationRecord[]> {
    return (await client.zipMasterOperation.findMany({
      where: { sessionId },
      orderBy: { sequence: "asc" },
    })) as ZipMasterOperationRecord[];
  }

  private async loadZipOperations(
    sessionId: string,
    client: ZipOperationClient = this.prisma
  ): Promise<ZipOperation[]> {
    const records = await this.loadZipOperationRecords(sessionId, client);
    return this.recordsToZipOperations(records);
  }

  private async recordsToZipOperations(
    records: ZipMasterOperationRecord[]
  ): Promise<ZipOperation[]> {
    const operations: ZipOperation[] = [];
    for (const record of records) {
      if (record.type === "ADD_FILE" || record.type === "REPLACE_FILE") {
        if (!record.objectKey) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Zip file operation is missing stored content."
          );
        }
        operations.push({
          type: record.type,
          entryPath: record.entryPath,
          fileName: record.fileName ?? undefined,
          mimeType: record.mimeType ?? undefined,
          fileSize: record.fileSize ?? undefined,
          content: await this.storage.getObjectBuffer(record.objectKey),
        });
        continue;
      }
      if (record.type === "DELETE_ENTRY" || record.type === "CREATE_FOLDER") {
        operations.push({
          type: record.type,
          entryPath: record.entryPath,
        });
        continue;
      }
      if (
        record.type === "RENAME_ENTRY" ||
        record.type === "MOVE_ENTRY" ||
        record.type === "COPY_ENTRY"
      ) {
        if (!record.targetPath) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Zip move operation is missing target path."
          );
        }
        operations.push({
          type: record.type,
          entryPath: record.entryPath,
          targetPath: record.targetPath,
        });
      }
    }
    return operations;
  }

  private async releaseWithoutVersion(
    session: ZipMasterSession,
    attachment: ZipMasterAttachment,
    user: Pick<RequestUser, "id">,
    reason: "UNCHANGED_RELEASE" | "DISCARDED",
    discarded: boolean,
    source?: AuditLogSource
  ) {
    const releasedAt = new Date();
    let response: {
      ok: true;
      checkedIn: false;
      discarded: boolean;
      attachmentId: string;
      projectId: string;
      sessionId: string;
      lockSessionId: string;
      version: number;
    };
    try {
      response = await this.prisma.$transaction(async (tx) => {
        const txClient = tx;
        const updated = await txClient.attachment.updateMany({
          where: activeLockWhere(attachment, session),
          data: {
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lockSessionId: null,
            lockHeartbeatAt: null,
            lockStaleAt: null,
            lockRevokedAt: null,
            lockRevokedBy: null,
            lockReleaseReason: reason,
          },
        });
        if (updated.count === 0) {
          throw new ApiBadRequestException(
            "LOCK_REVOKED",
            "Zip Master lock is no longer active."
          );
        }
        const closeResponse = {
          ok: true as const,
          checkedIn: false as const,
          discarded,
          attachmentId: attachment.id,
          projectId: attachment.projectId,
          sessionId: session.id,
          lockSessionId: session.lockSessionId,
          version: attachment.version,
        };
        await txClient.zipMasterSession.update({
          where: { id: session.id },
          data: {
            state: "CLOSED",
            dirty: false,
            closeResponseJson: closeResponse,
            closedAt: releasedAt,
            lastSeenAt: releasedAt,
            lastError: null,
          },
        });
        return closeResponse;
      });
    } catch (error) {
      await this.markFailedClose(session.id, error, "RELEASE_FAILED");
      throw error;
    }

    await this.auditLogs
      .log({
        actorId: user.id,
        action: discarded
          ? "ATTACHMENT_ZIP_MASTER_DISCARDED"
          : "ATTACHMENT_ZIP_MASTER_RELEASED",
        targetType: "ATTACHMENT",
        targetId: attachment.id,
        projectId: attachment.projectId,
        description: `${discarded ? "Discard" : "Release"} Zip Master ${displayName(attachment)}`,
        source,
      })
      .catch(() => {});
    return response;
  }

  private async requireAttachment(projectId: string, attachmentId: string) {
    const attachment = (await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: null },
      include: {
        lockHolder: { select: { id: true, name: true, email: true } },
      },
    })) as ZipMasterAttachment | null;
    if (!attachment) {
      throw new ApiBadRequestException("NOT_FOUND", "附件不存在");
    }
    return attachment;
  }

  private requireZipAttachment(attachment: ZipMasterAttachment) {
    if (!isZipMasterSupportedFileName(displayName(attachment))) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "This attachment is not a supported Zip Master file."
      );
    }
  }

  private async findOpenSessionForLock(
    projectId: string,
    attachmentId: string,
    userId: string,
    lockSessionId: string
  ) {
    return (await this.prisma.zipMasterSession.findFirst({
      where: {
        projectId,
        attachmentId,
        userId,
        lockSessionId,
        state: { in: [...OPEN_ZIP_SESSION_STATES] },
      },
    })) as ZipMasterSession | null;
  }

  private async requireOwnedSession(
    projectId: string,
    sessionId: string,
    userId: string
  ) {
    const session = (await this.prisma.zipMasterSession.findFirst({
      where: { id: sessionId, projectId, userId },
    })) as ZipMasterSession | null;
    if (!session) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip Master session not found."
      );
    }
    return session;
  }

  private async requireActiveSessionLock(
    session: ZipMasterSession,
    attachment: ZipMasterAttachment,
    verifyAuthorization = true
  ) {
    if (verifyAuthorization) {
      await this.access.requireProjectAction(
        session.projectId,
        session.userId,
        "uploadWorkingPapers"
      );
      await this.access.requireProjectRole(
        session.projectId,
        session.userId,
        "PREPARER"
      );
    }
    if (
      attachment.lockedBy !== session.userId ||
      attachment.lockSessionId !== session.lockSessionId
    ) {
      await this.markSession(session.id, "LOCK_REVOKED");
      throw new ApiBadRequestException(
        "LOCK_REVOKED",
        "Zip Master lock is no longer active."
      );
    }
  }

  private async beginSessionClose(
    session: ZipMasterSession,
    state: "CLOSING_WAITING_ENTRIES" | "CHECKING_IN" | "RELEASING",
    allowedStates: readonly ZipMasterSessionState[]
  ) {
    const claimed = await this.prisma.zipMasterSession.updateMany({
      where: {
        id: session.id,
        projectId: session.projectId,
        userId: session.userId,
        state: { in: [...allowedStates] },
      },
      data: {
        state,
        lastSeenAt: new Date(),
        lastError: null,
      },
    });
    if (claimed.count === 0) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Zip Master session is not editable."
      );
    }
    const current = (await this.prisma.zipMasterSession.findUnique({
      where: { id: session.id },
    })) as ZipMasterSession | null;
    if (!current) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip Master session not found."
      );
    }
    return current;
  }

  private async markFailedClose(
    sessionId: string,
    error: unknown,
    fallbackState: "CHECKIN_FAILED" | "RELEASE_FAILED"
  ) {
    const code = apiErrorCode(error);
    if (code === "LOCK_REVOKED") {
      await this.markSession(sessionId, "LOCK_REVOKED", errorMessage(error));
      return;
    }
    if (code === "CONFLICT_RISK") {
      return;
    }
    if (code === "VALIDATION_FAILED") {
      await this.markSession(sessionId, fallbackState, errorMessage(error));
      return;
    }
    await this.markSession(sessionId, fallbackState, errorMessage(error));
  }

  private async markSession(
    sessionId: string,
    state: ZipMasterSessionState,
    lastError?: string
  ) {
    await this.prisma.zipMasterSession.update({
      where: { id: sessionId },
      data: {
        state,
        lastSeenAt: new Date(),
        lastError: lastError ?? null,
      },
    });
  }

  private async nextOperationSequence(
    sessionId: string,
    client: ZipOperationClient = this.prisma
  ) {
    const result = await client.zipMasterOperation.aggregate({
      where: { sessionId },
      _max: { sequence: true },
    });
    return (result._max.sequence ?? 0) + 1;
  }
}

function displayName(
  attachment: Pick<ZipMasterAttachment, "fileName" | "originalName">
) {
  return normalizeFileName(attachment.originalName ?? attachment.fileName);
}

function buildZipEntryAgentAttachmentId(
  attachmentId: string,
  entryPath: string
) {
  const entryIdentity = createHash("sha256")
    .update(normalizeZipEntryPath(entryPath))
    .digest("hex")
    .slice(0, 32);
  return `${ZIP_ENTRY_AGENT_ATTACHMENT_ID_PREFIX}${attachmentId}:${entryIdentity}`;
}

function normalizeFileName(fileName: string) {
  return pathModule
    .basename(fileName)
    .replaceAll(/[\p{Cc}\u007F]/gu, "")
    .trim();
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hasActiveLock(attachment: {
  lockedBy?: string | null;
  lockRevokedAt?: Date | null;
}) {
  return Boolean(attachment.lockedBy && !attachment.lockRevokedAt);
}

function parseStoredEntryTree(value: unknown): ZipEntryNode[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  try {
    return value.map(normalizeStoredEntryNode);
  } catch {
    return null;
  }
}

function normalizeStoredEntryNode(value: unknown): ZipEntryNode {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid stored zip entry");
  }
  const entry = value as Record<string, unknown>;
  const { type } = entry;
  const path = validateZipEntryPath(String(entry.path ?? ""));
  const name =
    typeof entry.name === "string" && entry.name.trim()
      ? entry.name
      : pathModule.basename(path.replaceAll(/\/+$/g, ""));
  const modifiedAt =
    typeof entry.modifiedAt === "string" ? entry.modifiedAt : undefined;

  if (type === "folder") {
    return {
      name,
      path: path.endsWith("/") ? path : `${path}/`,
      type: "folder",
      ...(modifiedAt ? { modifiedAt } : {}),
      children: Array.isArray(entry.children)
        ? entry.children.map(normalizeStoredEntryNode)
        : [],
    };
  }
  if (type === "file") {
    return {
      name,
      path,
      type: "file",
      ...(modifiedAt ? { modifiedAt } : {}),
      size: typeof entry.size === "number" ? entry.size : 0,
    };
  }
  throw new Error("Invalid stored zip entry");
}

function toStoredEntryTree(entries: ZipEntryNode[]): ZipEntryNode[] {
  return entries.map((entry) => {
    if (entry.type === "folder") {
      return {
        name: entry.name,
        path: entry.path,
        type: "folder" as const,
        ...(entry.modifiedAt ? { modifiedAt: entry.modifiedAt } : {}),
        children: toStoredEntryTree(entry.children ?? []),
      };
    }
    return {
      name: entry.name,
      path: entry.path,
      type: "file" as const,
      ...(entry.modifiedAt ? { modifiedAt: entry.modifiedAt } : {}),
      size: entry.size ?? 0,
    };
  });
}

function applyEntryMasterStatuses(
  entries: ZipEntryNode[],
  statuses: Map<string, ZipEntryMasterStatus>
): ZipEntryNodeWithMasterStatus[] {
  return entries.map((entry) => {
    const children = entry.children
      ? applyEntryMasterStatuses(entry.children, statuses)
      : undefined;
    const status = entry.type === "file" ? statuses.get(entry.path) : undefined;
    return {
      ...entry,
      ...(children ? { children } : {}),
      ...status,
    };
  });
}

function maxOperationSequence(records: ZipMasterOperationRecord[]) {
  return records.reduce(
    (max, operation) => Math.max(max, operation.sequence),
    0
  );
}

function findEntryTreeNode(
  entries: ZipEntryNode[],
  entryPath: string
): ZipEntryNode | null {
  for (const entry of entries) {
    if (entry.path === entryPath) {
      return entry;
    }
    if (entry.children) {
      const child = findEntryTreeNode(entry.children, entryPath);
      if (child) {
        return child;
      }
    }
  }
  return null;
}

function recordsToStoredZipOperationData(
  records: ZipMasterOperationRecord[]
): StoredZipOperationData[] {
  return records.map((record) => ({
    type: record.type,
    entryPath: record.entryPath,
    ...(record.targetPath ? { targetPath: record.targetPath } : {}),
    ...(record.objectKey ? { objectKey: record.objectKey } : {}),
    ...(record.fileName ? { fileName: record.fileName } : {}),
    ...(record.mimeType ? { mimeType: record.mimeType } : {}),
    ...(record.fileSize === null || record.fileSize === undefined
      ? {}
      : { fileSize: record.fileSize }),
  }));
}

function zipOperationTouchesEntry(
  operation: StoredZipOperationData,
  entryPath: string
) {
  const normalizedEntryPath = validateZipEntryPath(entryPath);
  if (zipPathTouchesEntry(operation.entryPath, normalizedEntryPath)) {
    return true;
  }
  return operation.targetPath
    ? zipPathTouchesEntry(operation.targetPath, normalizedEntryPath)
    : false;
}

function zipPathTouchesEntry(operationPath: string, entryPath: string) {
  const normalizedOperationPath = validateZipEntryPath(operationPath);
  return (
    normalizedOperationPath === entryPath ||
    (normalizedOperationPath.endsWith("/") &&
      entryPath.startsWith(normalizedOperationPath))
  );
}

function lockedByOtherResponse(attachment: ZipMasterAttachment) {
  return {
    ok: false as const,
    code: "LOCKED_BY_OTHER" as const,
    holderName: attachment.lockHolder?.name ?? "其他成员",
  };
}

function isMutableZipEntrySessionState(state: string) {
  return (MUTABLE_ZIP_ENTRY_SESSION_STATES as readonly string[]).includes(
    state
  );
}

function buildZipEntryDownloadUrl(
  context: DesktopMasterOpenRequestContext,
  projectId: string,
  sessionId: string,
  entryPath: string
) {
  const params = new URLSearchParams({ path: entryPath });
  return `${buildExternalBaseUrl(context)}/engagement/${encodeURIComponent(
    projectId
  )}/workflow/zip-master-sessions/${encodeURIComponent(
    sessionId
  )}/entries/download?${params.toString()}`;
}

function buildZipEntryCacheVersionId(
  attachment: { id: string; version: number },
  entrySession: {
    entryPath: string;
    baseOperationSequence: number;
  }
) {
  const entryFingerprint = sha256(
    Buffer.from(
      `${entrySession.entryPath}\0${entrySession.baseOperationSequence}`
    )
  );
  return `zip-entry:${attachment.id}:v${attachment.version}:${entryFingerprint}`;
}

function buildZipEntryCheckInObjectKey(
  entrySession: ZipEntryMasterSession,
  input: Pick<
    ZipEntryMasterUploadPrepareInput,
    "localContentHash" | "fileName" | "uploadAttemptId"
  >
) {
  if (!/^[a-f0-9]{64}$/i.test(input.localContentHash)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip entry content hash is invalid."
    );
  }
  return pathModule.posix.join(
    "zip-entry-check-ins",
    safeZipUploadSegment(entrySession.projectId),
    safeZipUploadSegment(entrySession.zipMasterSessionId),
    safeZipUploadSegment(entrySession.lockSessionId),
    ...(input.uploadAttemptId
      ? [safeZipUploadSegment(input.uploadAttemptId)]
      : []),
    `${input.localContentHash.toLowerCase()}${pathModule.extname(input.fileName)}`
  );
}

function assertZipEntryCheckInObjectKey(
  entrySession: ZipEntryMasterSession,
  input: Pick<ZipEntryMasterCheckInInput, "localContentHash"> & {
    fileName?: string;
    uploadAttemptId?: string;
  },
  objectKey: string
) {
  if (
    !input.fileName ||
    buildZipEntryCheckInObjectKey(entrySession, {
      localContentHash: input.localContentHash,
      fileName: input.fileName,
      uploadAttemptId: input.uploadAttemptId,
    }) !== objectKey
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip entry upload object key is invalid."
    );
  }
}

function safeZipUploadSegment(value: string) {
  const normalized = value.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  if (!normalized) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip entry upload identity is invalid."
    );
  }
  return normalized;
}

function buildZipEntryCallbackUrl(
  context: DesktopMasterOpenRequestContext,
  lockSessionId: string,
  action: "check-in" | "heartbeat" | "release"
) {
  return `${buildExternalBaseUrl(
    context
  )}/desktop/zip-entry-master-sessions/${encodeURIComponent(
    lockSessionId
  )}/${action}`;
}

function buildExternalBaseUrl(context: DesktopMasterOpenRequestContext) {
  const protocol = context.protocol || "http";
  const host = context.host || "localhost:3000";
  const prefix = normalizeExternalPathPrefix(context.pathPrefix);
  return `${protocol}://${host}${prefix}`;
}

function normalizeExternalPathPrefix(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, "");
}

function inferMimeType(fileName: string) {
  switch (pathModule.extname(fileName).toLowerCase()) {
    case ".pdf": {
      return "application/pdf";
    }
    case ".xlsx": {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    case ".xls": {
      return "application/vnd.ms-excel";
    }
    case ".docx": {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    case ".doc": {
      return "application/msword";
    }
    case ".pptx": {
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    case ".ppt": {
      return "application/vnd.ms-powerpoint";
    }
    case ".txt": {
      return "text/plain";
    }
    case ".csv": {
      return "text/csv";
    }
    case ".json": {
      return "application/json";
    }
    case ".zip": {
      return "application/zip";
    }
    default: {
      return "application/octet-stream";
    }
  }
}

function toEntryTreeOperation(
  operation: StoredZipOperationData
): ZipEntryTreeOperation {
  if (operation.type === "DELETE_ENTRY" || operation.type === "CREATE_FOLDER") {
    return {
      type: operation.type,
      entryPath: operation.entryPath,
    };
  }
  if (
    operation.type === "RENAME_ENTRY" ||
    operation.type === "MOVE_ENTRY" ||
    operation.type === "COPY_ENTRY"
  ) {
    if (!operation.targetPath) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip operation is invalid."
      );
    }
    return {
      type: operation.type,
      entryPath: operation.entryPath,
      targetPath: operation.targetPath,
    };
  }
  if (operation.type === "ADD_FILE" || operation.type === "REPLACE_FILE") {
    return {
      type: operation.type,
      entryPath: operation.entryPath,
      fileSize: operation.fileSize,
    };
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Zip operation is invalid."
  );
}

function activeAttachmentWhere(
  attachment: ZipMasterAttachment,
  session: ZipMasterSession
) {
  return {
    ...activeLockWhere(attachment, session),
    version: session.baseVersion,
    headVersionId: attachment.headVersionId ?? null,
  };
}

function activeLockWhere(
  attachment: ZipMasterAttachment,
  session: ZipMasterSession
) {
  return {
    id: attachment.id,
    projectId: attachment.projectId,
    deletedAt: null,
    lockedBy: session.userId,
    lockSessionId: session.lockSessionId,
    lockRevokedAt: null,
  };
}

function normalizeZipEntryPath(path: string) {
  try {
    return validateZipEntryPath(path);
  } catch {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
}

async function safeBuildZipEntryTree(buffer: Buffer) {
  try {
    return await buildZipEntryTree(buffer);
  } catch {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip archive is invalid."
    );
  }
}

function safeApplyZipOperationsToEntryTree(
  baseEntries: ZipEntryNode[],
  operations: StoredZipOperationData[]
) {
  try {
    return applyZipOperationsToEntryTree(
      baseEntries,
      operations.map(toEntryTreeOperation)
    );
  } catch (error) {
    if (error instanceof ApiBadRequestException) {
      throw error;
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
}

async function safeReadZipEntryFile(buffer: Buffer, entryPath: string) {
  try {
    return await readZipEntryFile(buffer, entryPath);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Zip entry does not exist"
    ) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip entry does not exist."
      );
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip archive entry is invalid."
    );
  }
}

async function safeReadZipEntryFileWithOperations(
  baseBuffer: Buffer,
  operations: ZipOperation[],
  entryPath: string
) {
  try {
    return await readZipEntryFileWithOperations(
      baseBuffer,
      operations,
      entryPath
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Zip entry does not exist"
    ) {
      throw new ApiBadRequestException(
        "NOT_FOUND",
        "Zip entry does not exist."
      );
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip archive entry is invalid."
    );
  }
}

async function safeRebuildZipWithOperations(
  baseBuffer: Buffer,
  operations: ZipOperation[]
) {
  try {
    return await rebuildZipWithOperations(baseBuffer, operations);
  } catch (error) {
    if (error instanceof ApiBadRequestException) {
      throw error;
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Zip operation is invalid."
    );
  }
}

function apiErrorCode(error: unknown) {
  const response = (error as { getResponse?: () => unknown }).getResponse?.();
  if (!response || typeof response !== "object") {
    return;
  }
  const { code } = response as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const response = (error as { getResponse?: () => unknown }).getResponse?.();
  if (response && typeof response === "object") {
    const { message } = response as { message?: unknown };
    if (typeof message === "string" && message) {
      return message;
    }
  }
  return "Zip Master operation failed.";
}

async function resolveAttachmentHeadVersionId(
  tx: AttachmentVersionWriter,
  attachment: { id: string; headVersionId?: string | null }
) {
  if (attachment.headVersionId) {
    return attachment.headVersionId;
  }
  const latest = await tx.attachmentVersion.findFirst({
    where: { attachmentId: attachment.id },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return latest?.id ?? null;
}

async function createAttachmentRevision(
  tx: AttachmentVersionWriter,
  input: Prisma.AttachmentVersionUncheckedCreateInput
) {
  await tx.attachmentVersion.deleteMany({
    where: {
      attachmentId: input.attachmentId,
      version: { gte: input.version },
    },
  });
  await tx.attachmentVersion.updateMany({
    where: { attachmentId: input.attachmentId, isCurrent: true },
    data: { isCurrent: false },
  });
  return tx.attachmentVersion.create({
    data: {
      ...input,
      parentVersionId: input.parentVersionId ?? null,
      sourceVersionId: input.sourceVersionId ?? null,
      message: input.message ?? null,
      isCurrent: true,
    },
  });
}
