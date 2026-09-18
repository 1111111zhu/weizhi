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
  decimalStringBody,
  parseDesktopUploadCompleteInput,
  parseDesktopUploadPrepareInput,
  parseDirectCommitMetadata,
  positiveIntegerBody,
  stringBody,
} from "./workflow-controller-input";
import { WorkflowService } from "./workflow.service";
import type { UploadedWorkflowFile } from "./workflow.service";

@Controller("desktop/master-sessions")
export class DesktopMasterSessionController {
  constructor(private readonly workflow: WorkflowService) {}

  @Post(":lockSessionId/heartbeat")
  heartbeat(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    const value = asBodyRecord(body);
    const projectId = stringBody(value.projectId);
    const attachmentId = stringBody(value.attachmentId);
    const grantSecret = stringBody(value.grantSecret);
    const lockEpoch =
      value.lockEpoch === undefined
        ? undefined
        : positiveIntegerBody(value.lockEpoch);
    if (!projectId || !attachmentId || !grantSecret) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Desktop heartbeat request is invalid."
      );
    }
    return this.workflow.heartbeatDesktopMasterSession({
      projectId,
      attachmentId,
      lockSessionId,
      grantSecret,
      lockEpoch,
    });
  }

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
    const localContentCrc64 = decimalStringBody(value.localContentCrc64);
    const idempotencyKey = stringBody(value.idempotencyKey);
    const baseVersion = positiveIntegerBody(value.baseVersion);
    const baseVersionId = stringBody(value.baseVersionId);
    const lockEpoch =
      value.lockEpoch === undefined
        ? undefined
        : positiveIntegerBody(value.lockEpoch);
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
        "Desktop check-in request is invalid."
      );
    }
    return this.workflow.checkInDesktopMasterSession(
      {
        projectId,
        attachmentId,
        lockSessionId,
        grantSecret,
        baseVersion,
        baseVersionId,
        lockEpoch,
        localContentHash,
        localContentCrc64,
        idempotencyKey,
        ...parseDirectCommitMetadata(body),
      },
      file,
      source
    );
  }

  @Post(":lockSessionId/check-in/prepare")
  prepareUpload(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    return this.workflow.prepareDesktopMasterUpload(
      parseDesktopUploadPrepareInput(lockSessionId, body)
    );
  }

  @Post(":lockSessionId/check-in/complete")
  completeUpload(
    @Param("lockSessionId") lockSessionId: string,
    @Body() body: unknown
  ) {
    return this.workflow.completeDesktopMasterUpload(
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
    const lockEpoch =
      value.lockEpoch === undefined
        ? undefined
        : positiveIntegerBody(value.lockEpoch);
    const reason =
      value.reason === "RECOVERY_ENDED"
        ? "RECOVERY_ENDED"
        : value.reason === "UNCHANGED_RELEASE"
          ? "UNCHANGED_RELEASE"
          : "CHECKED_IN";
    if (!projectId || !attachmentId || !grantSecret) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Desktop release request is invalid."
      );
    }
    return this.workflow.releaseDesktopMasterSession(
      {
        projectId,
        attachmentId,
        lockSessionId,
        grantSecret,
        lockEpoch,
        reason,
      },
      source
    );
  }
}
