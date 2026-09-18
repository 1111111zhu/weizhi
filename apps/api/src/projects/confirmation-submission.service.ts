import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  SubmitProjectConfirmationInput,
  WithdrawProjectConfirmationInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import type { RequestUser } from "../auth/request-user";
import {
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmationArtifactService } from "./confirmation-artifact.service";
import { ConfirmationDerivedDataService } from "./confirmation-derived-data.service";
import { ProjectAccessService } from "./project-access.service";
import { PROJECT_CONFIRMATION_INCLUDE } from "./project-confirmations.service";

const ACTIVE_ARTIFACT_SELECT = {
  id: true,
  confirmationId: true,
  version: true,
  disposition: true,
  templateCode: true,
  templateVersion: true,
  docxSize: true,
  pdfSize: true,
  pdfSha256: true,
  submittedBy: true,
  submittedAt: true,
  invalidatedBy: true,
  invalidatedAt: true,
  invalidationReason: true,
} satisfies Prisma.ConfirmationArtifactSelect;

type SubmissionPreflight = Prisma.ProjectConfirmationGetPayload<{
  include: typeof PROJECT_CONFIRMATION_INCLUDE;
}>;

@Injectable()
export class ConfirmationSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly derivedData: ConfirmationDerivedDataService,
    private readonly artifacts: ConfirmationArtifactService
  ) {}

  async submit(
    projectId: string,
    confirmationId: string,
    input: SubmitProjectConfirmationInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const preflight = await this.findConfirmation(projectId, confirmationId);
    const existing = await this.findArtifactBySubmissionKey(
      input.idempotencyKey
    );
    if (existing) {
      this.requireExactReplay(
        preflight,
        existing,
        confirmationId,
        input.expectedDraftUpdatedAt
      );
      return preflight;
    }

    if (
      preflight.status === "DRAFT" &&
      preflight.currentArtifact?.templateCode === "UPLOADED_DOCUMENT"
    ) {
      return this.freezeUploadedDraft(
        projectId,
        confirmationId,
        preflight,
        input,
        user,
        source
      );
    }

    this.requireSubmittableDraft(preflight, input.expectedDraftUpdatedAt);
    const derivedSnapshot = await this.derivedData.resolve(
      projectId,
      user,
      preflight.confirmationCode ?? ""
    );
    const artifactId = randomUUID();
    let storedArtifact = false;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.recheckMutableMembership(tx, projectId, user.id);
          const confirmation = await tx.projectConfirmation.findFirst({
            where: { id: confirmationId, projectId },
            include: { currentArtifact: { select: ACTIVE_ARTIFACT_SELECT } },
          });
          if (!confirmation) {
            this.notFound();
          }

          const retryArtifact = await tx.confirmationArtifact.findUnique({
            where: { submissionKey: input.idempotencyKey },
            select: { id: true, confirmationId: true, disposition: true },
          });
          if (retryArtifact) {
            this.requireExactReplay(
              confirmation,
              retryArtifact,
              confirmationId,
              input.expectedDraftUpdatedAt
            );
            return this.findResponse(tx, projectId, confirmationId);
          }

          this.requireSubmittableDraft(
            confirmation,
            input.expectedDraftUpdatedAt
          );
          if (confirmation.submissionVersion !== preflight.submissionVersion) {
            this.stateConflict(
              "Confirmation version changed before submission"
            );
          }

          const nextVersion = confirmation.submissionVersion + 1;
          const previousArtifact =
            confirmation.submissionVersion > 0
              ? await tx.confirmationArtifact.findFirst({
                  where: {
                    confirmationId,
                    version: confirmation.submissionVersion,
                  },
                  select: { id: true, disposition: true },
                })
              : null;
          if (confirmation.submissionVersion > 0 && !previousArtifact) {
            this.stateConflict("Previous confirmation artifact is missing");
          }
          const submittedAt = new Date();
          const artifact = await this.artifacts.create(
            {
              confirmation,
              derivedSnapshot,
              version: nextVersion,
              submissionKey: input.idempotencyKey,
              submittedBy: user.id,
              submittedAt,
              artifactId,
            },
            tx
          );
          storedArtifact = true;

          if (previousArtifact) {
            const superseded = await tx.confirmationArtifact.updateMany({
              where: {
                id: previousArtifact.id,
                confirmationId,
                disposition: previousArtifact.disposition,
              },
              data: {
                disposition: "INVALIDATED",
                invalidatedBy: user.id,
                invalidatedAt: submittedAt,
                invalidationReason: `SUPERSEDED_BY_VERSION_${nextVersion}`,
              },
            });
            if (superseded.count !== 1) {
              this.stateConflict("Previous confirmation artifact changed");
            }
          }

          const updated = await tx.projectConfirmation.updateMany({
            where: {
              id: confirmationId,
              projectId,
              status: "DRAFT",
              submissionVersion: preflight.submissionVersion,
              currentArtifactId: null,
              draftUpdatedAt: new Date(input.expectedDraftUpdatedAt),
            },
            data: {
              status: "PREPARED",
              submissionVersion: nextVersion,
              currentArtifactId: artifact.id,
              queuedAt: submittedAt,
              queueClaimedBy: null,
              queueClaimedAt: null,
              revisionReason: null,
              revisionRequestedBy: null,
              revisionRequestedAt: null,
              responsibleUserId: user.id,
              preparedDispatchReadyBy: user.id,
              preparedDispatchReadyAt: submittedAt,
            },
          });
          if (updated.count !== 1) {
            this.stateConflict("Confirmation changed before submission");
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action:
                nextVersion === 1
                  ? "PROJECT_CONFIRMATION_SUBMITTED"
                  : "PROJECT_CONFIRMATION_RESUBMITTED",
              targetType: "PROJECT_CONFIRMATION",
              targetId: confirmationId,
              projectId,
              description: `${nextVersion === 1 ? "Submitted" : "Resubmitted"} confirmation ${confirmation.confirmationCode ?? confirmationId} as artifact version ${nextVersion}`,
              ipAddress: source.ipAddress,
              userAgent: source.userAgent,
            },
          });

          return this.findResponse(tx, projectId, confirmationId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 120_000,
        }
      );
    } catch (error) {
      if (storedArtifact) {
        try {
          await this.artifacts.deleteStoredFiles(
            projectId,
            confirmationId,
            artifactId
          );
        } catch {
          // Preserve the transaction failure if best-effort cleanup also fails.
        }
      }
      if (this.isSubmissionRace(error)) {
        try {
          const winner = await this.findArtifactBySubmissionKey(
            input.idempotencyKey
          );
          const confirmation = await this.prisma.projectConfirmation.findFirst({
            where: { id: confirmationId, projectId },
            include: PROJECT_CONFIRMATION_INCLUDE,
          });
          if (
            winner &&
            confirmation &&
            this.isExactReplay(
              confirmation,
              winner,
              confirmationId,
              input.expectedDraftUpdatedAt
            )
          ) {
            return confirmation;
          }
        } catch {
          // Normalize failed race reconciliation to the same public conflict.
        }
        this.stateConflict("Confirmation changed during submission");
      }
      throw error;
    }
  }

  private async freezeUploadedDraft(
    projectId: string,
    confirmationId: string,
    confirmation: SubmissionPreflight,
    input: SubmitProjectConfirmationInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    if (
      !confirmation.currentArtifactId ||
      !confirmation.draftUpdatedAt ||
      new Date(confirmation.draftUpdatedAt).getTime() !==
        new Date(input.expectedDraftUpdatedAt).getTime()
    ) {
      this.stateConflict("Uploaded confirmation changed before freeze");
    }
    const frozenAt = new Date();
    const updated = await this.prisma.projectConfirmation.updateMany({
      where: {
        id: confirmationId,
        projectId,
        status: "DRAFT",
        currentArtifactId: confirmation.currentArtifactId,
        draftUpdatedAt: new Date(input.expectedDraftUpdatedAt),
      },
      data: {
        status: "PREPARED",
        queuedAt: frozenAt,
        responsibleUserId: user.id,
        preparedDispatchReadyBy: user.id,
        preparedDispatchReadyAt: frozenAt,
        queueClaimedBy: null,
        queueClaimedAt: null,
      },
    });
    if (updated.count !== 1) {
      this.stateConflict("Uploaded confirmation changed before freeze");
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "PROJECT_CONFIRMATION_UPLOADED_FILE_FROZEN",
        targetType: "PROJECT_CONFIRMATION",
        targetId: confirmationId,
        projectId,
        description: `Froze uploaded confirmation ${confirmation.confirmationCode ?? confirmationId}`,
        ipAddress: source.ipAddress,
        userAgent: source.userAgent,
      },
    });
    await this.prisma.confirmationFollowUpEvent.create({
      data: {
        confirmationId,
        eventType: "CONFIRMATION_FROZEN",
        actorId: user.id,
        source: "PROJECT_TEAM_SYSTEM",
        occurredAt: frozenAt,
      },
    });
    return this.findConfirmation(projectId, confirmationId);
  }

  async withdraw(
    projectId: string,
    confirmationId: string,
    input: WithdrawProjectConfirmationInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const reason = input.reason?.trim() || null;
    const preflight = await this.findConfirmation(projectId, confirmationId);
    this.requireWithdrawable(preflight);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.recheckMutableMembership(tx, projectId, user.id);
          const confirmation = await tx.projectConfirmation.findFirst({
            where: { id: confirmationId, projectId },
            include: { currentArtifact: { select: ACTIVE_ARTIFACT_SELECT } },
          });
          if (!confirmation) {
            this.notFound();
          }
          this.requireWithdrawable(confirmation);

          const invalidatedAt = new Date();
          const artifactUpdated = await tx.confirmationArtifact.updateMany({
            where: {
              id: confirmation.currentArtifact.id,
              confirmationId,
              disposition: "ACTIVE",
            },
            data: {
              disposition: "INVALIDATED",
              invalidatedBy: user.id,
              invalidatedAt,
              invalidationReason: reason ? `WITHDRAWN: ${reason}` : "WITHDRAWN",
            },
          });
          if (artifactUpdated.count !== 1) {
            this.stateConflict("Active confirmation artifact changed");
          }

          const confirmationUpdated = await tx.projectConfirmation.updateMany({
            where: {
              id: confirmationId,
              projectId,
              status: "PREPARED",
              currentArtifactId: confirmation.currentArtifact.id,
              queueClaimedAt: null,
            },
            data: {
              status: "DRAFT",
              currentArtifactId: null,
              queuedAt: null,
              queueClaimedBy: null,
              queueClaimedAt: null,
            },
          });
          if (confirmationUpdated.count !== 1) {
            this.stateConflict("Confirmation was claimed before withdrawal");
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: "PROJECT_CONFIRMATION_WITHDRAWN",
              targetType: "PROJECT_CONFIRMATION",
              targetId: confirmationId,
              projectId,
              description: `Withdrew confirmation ${confirmation.confirmationCode ?? confirmationId}${reason ? `: ${reason}` : ""}`,
              ipAddress: source.ipAddress,
              userAgent: source.userAgent,
            },
          });
          await tx.confirmationFollowUpEvent.create({
            data: {
              confirmationId,
              eventType: "CONFIRMATION_UNFROZEN",
              actorId: user.id,
              source: "PROJECT_TEAM_SYSTEM",
              notes: reason,
              occurredAt: invalidatedAt,
            },
          });

          return this.findResponse(tx, projectId, confirmationId);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (this.isPrismaError(error, "P2034")) {
        this.stateConflict("Confirmation was claimed before withdrawal");
      }
      throw error;
    }
  }

  private async findConfirmation(projectId: string, confirmationId: string) {
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE,
    });
    if (!confirmation) {
      this.notFound();
    }
    return confirmation;
  }

  private async findArtifactBySubmissionKey(submissionKey: string) {
    await Promise.resolve();
    return this.prisma.confirmationArtifact.findUnique({
      where: { submissionKey },
      select: { id: true, confirmationId: true, disposition: true },
    });
  }

  private requireExactReplay(
    confirmation: Pick<
      SubmissionPreflight,
      "status" | "draftUpdatedAt" | "currentArtifactId" | "currentArtifact"
    >,
    artifact: { id: string; confirmationId: string; disposition: string },
    confirmationId: string,
    expectedDraftUpdatedAt: string
  ) {
    if (artifact.confirmationId !== confirmationId) {
      this.stateConflict("Submission key belongs to another confirmation");
    }
    if (
      !confirmation.draftUpdatedAt ||
      confirmation.draftUpdatedAt.getTime() !==
        new Date(expectedDraftUpdatedAt).getTime()
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_DRAFT_CHANGED",
        "Confirmation draft changed before submission"
      );
    }
    if (
      !this.isExactReplay(
        confirmation,
        artifact,
        confirmationId,
        expectedDraftUpdatedAt
      )
    ) {
      this.stateConflict(
        "Submission key is not the active confirmation artifact"
      );
    }
  }

  private isExactReplay(
    confirmation: Pick<
      SubmissionPreflight,
      "status" | "draftUpdatedAt" | "currentArtifactId" | "currentArtifact"
    >,
    artifact: { id: string; confirmationId: string; disposition: string },
    confirmationId: string,
    expectedDraftUpdatedAt: string
  ) {
    return (
      artifact.confirmationId === confirmationId &&
      confirmation.draftUpdatedAt?.getTime() ===
        new Date(expectedDraftUpdatedAt).getTime() &&
      confirmation.status === "PREPARED" &&
      confirmation.currentArtifactId === artifact.id &&
      confirmation.currentArtifact?.id === artifact.id &&
      confirmation.currentArtifact.disposition === "ACTIVE" &&
      artifact.disposition === "ACTIVE"
    );
  }

  private isSubmissionRace(error: unknown) {
    return (
      this.isPrismaError(error, "P2002") || this.isPrismaError(error, "P2034")
    );
  }

  private isPrismaError(error: unknown, code: "P2002" | "P2034") {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }

  private requireSubmittableDraft(
    confirmation: Pick<
      SubmissionPreflight,
      "status" | "draftUpdatedAt" | "currentArtifactId"
    >,
    expectedDraftUpdatedAt: string
  ) {
    if (
      !confirmation.draftUpdatedAt ||
      confirmation.draftUpdatedAt.getTime() !==
        new Date(expectedDraftUpdatedAt).getTime()
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_DRAFT_CHANGED",
        "Confirmation draft changed before submission"
      );
    }
    if (confirmation.status !== "DRAFT" || confirmation.currentArtifactId) {
      this.stateConflict("Only an unsubmitted draft can be submitted");
    }
  }

  private requireWithdrawable(
    confirmation: Pick<
      SubmissionPreflight,
      "status" | "queueClaimedAt" | "currentArtifact"
    >
  ): asserts confirmation is typeof confirmation & {
    currentArtifact: NonNullable<typeof confirmation.currentArtifact>;
  } {
    if (
      confirmation.status !== "PREPARED" ||
      confirmation.queueClaimedAt ||
      !confirmation.currentArtifact ||
      confirmation.currentArtifact.disposition !== "ACTIVE"
    ) {
      this.stateConflict(
        "Only an active, unclaimed prepared confirmation can be withdrawn"
      );
    }
  }

  private async recheckMutableMembership(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string
  ) {
    const member = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { project: { select: { status: true } } },
    });
    if (!member || member.status !== "ACTIVE") {
      const [user, project] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { globalRole: true } }),
        tx.project.findUnique({ where: { id: projectId }, select: { status: true } }),
      ]);
      if (user?.globalRole === "SUPER_ADMIN" && project) {
        if (project.status === "ARCHIVED") {
          throw new ApiForbiddenException(
            "PROJECT_ARCHIVED",
            "Project is archived and cannot be modified"
          );
        }
        if (project.status === "PENDING_FINAL_CHECK") {
          throw new ApiForbiddenException(
            "FORBIDDEN",
            "Project is pending final check and read-only"
          );
        }
        return;
      }
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        "Project does not exist or you do not have access"
      );
    }
    if (member.project.status === "ARCHIVED") {
      throw new ApiForbiddenException(
        "PROJECT_ARCHIVED",
        "Project is archived and cannot be modified"
      );
    }
    if (member.project.status === "PENDING_FINAL_CHECK") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Project is pending final check and read-only"
      );
    }
  }

  private async findResponse(
    tx: Prisma.TransactionClient,
    projectId: string,
    confirmationId: string
  ) {
    const confirmation = await tx.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE,
    });
    if (!confirmation) {
      this.notFound();
    }
    return confirmation;
  }

  private notFound(): never {
    throw new ApiNotFoundException(
      "NOT_FOUND",
      "Confirmation record was not found"
    );
  }

  private stateConflict(message: string): never {
    throw new ApiConflictException("CONFIRMATION_STATE_CONFLICT", message);
  }
}
