import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditSource } from "../audit-logs/audit-source.decorator";
import { ApiBadRequestException } from "../common/api-error";
import {
  asBodyRecord,
  parseDesktopUploadCompleteInput,
  parseDesktopUploadPrepareInput,
  parseDirectCommitMetadata,
  positiveIntegerBody,
  stringBody,
} from "./workflow-controller-input";
import type { UploadedWorkflowFile } from "./workflow.service";
import { ZipMasterService } from "./zip-master.service";

@Controller("desktop/zip-entry-master-sessions")
export class DesktopZipEntryMasterSessionController {
  constructor(private readonly zipMaster: ZipMasterService) {}

  @Post(":lockSessionId/check-in")
  @UseInterceptors(FileInterceptor("file"))
  checkIn(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedWorkflowFile | undefined,
    @AuditSource() source: AuditLogSource
  ) {
    const value = asBodyRecord(body);
    const projectId = stringBody(value.projectId);
    const attachmentId = stringBody(value.attachmentId);
    const grantSecret = stringBody(value.grantSecret);
    const localContentHash = stringBody(value.localContentHash);
    const idempotencyKey = stringBody(value.idempotencyKey);
    const baseVersion = positiveIntegerBody(value.baseVersion);
    if (
      !projectId ||
      !attachmentId ||
      !grantSecret ||
      !localContentHash ||
      !idempotencyKey ||
      !baseVersion
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip entry check-in request is invalid."
      );
    }
    return this.zipMaster.checkInEntryMasterSession(
      {
        projectId,
        attachmentId,
        lockSessionId,
        grantSecret,
        baseVersion,
        localContentHash,
        idempotencyKey,
        ...parseDirectCommitMetadata(body),
      },
      file,
      source
    );
  }

  @Post(":lockSessionId/heartbeat")
  heartbeat(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    const value = asBodyRecord(body);
    const projectId = stringBody(value.projectId);
    const attachmentId = stringBody(value.attachmentId);
    const grantSecret = stringBody(value.grantSecret);
    if (!projectId || !attachmentId || !grantSecret) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip entry heartbeat request is invalid."
      );
    }
    return this.zipMaster.heartbeatEntryMasterSession({
      projectId,
      attachmentId,
      lockSessionId,
      grantSecret,
    });
  }

  @Post(":lockSessionId/check-in/prepare")
  prepareUpload(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    return this.zipMaster.prepareEntryMasterUpload(
      parseDesktopUploadPrepareInput(lockSessionId, body)
    );
  }

  @Post(":lockSessionId/check-in/complete")
  completeUpload(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    return this.zipMaster.completeEntryMasterUpload(
      parseDesktopUploadCompleteInput(lockSessionId, body)
    );
  }

  @Post([":lockSessionId/release", ":lockSessionId/end-tracking"])
  release(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown,
    @AuditSource() source: AuditLogSource
  ) {
    const value = asBodyRecord(body);
    const projectId = stringBody(value.projectId);
    const attachmentId = stringBody(value.attachmentId);
    const grantSecret = stringBody(value.grantSecret);
    const reason =
      value.reason === "RECOVERY_ENDED"
        ? "RECOVERY_ENDED"
        : value.reason === "UNCHANGED_RELEASE"
          ? "UNCHANGED_RELEASE"
          : "CHECKED_IN";
    if (!projectId || !attachmentId || !grantSecret) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Zip entry release request is invalid."
      );
    }
    return this.zipMaster.releaseEntryMasterSession(
      {
        projectId,
        attachmentId,
        lockSessionId,
        grantSecret,
        reason,
      },
      source
    );
  }
}
