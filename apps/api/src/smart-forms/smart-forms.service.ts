import { createHash, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { PaperType, Prisma, WorkingPaperBucket } from "@prisma/client";
import {
  SMART_FORM_MIME_TYPE,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  SaveSmartFormPackageSchema,
  SmartFormPackageSchema,
  SmartFormV2DefinitionSchema,
  compileSmartFormV2Definition,
  normalizeCodeWithoutDigitFour,
  validateSmartFormV2Response,
} from "@project-wing/shared";
import type {
  CreateProjectSmartFormInput,
  CreateSmartFormTemplateInput,
  SaveSmartFormPackageInput,
  SmartFormPackage,
  SmartFormTemplateListQueryInput,
  SmartFormV2Definition,
  SmartFormV2FieldAnswer,
  SmartFormV2RichTextBlock,
  SmartFormV2RichTextDocument,
  UpdateSmartFormTemplateInput,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { StorageService } from "../storage/storage.service";
import {
  buildNextWorkingPaperCode,
  isHierarchicalNumericWorkingPaperCode,
} from "../workflow/working-paper-code";
import { loadSmartFormV2PdfEngagementDetails } from "./smart-form-v2-project-context";

const SMART_FORM_TEMPLATE_INCLUDE = {
  frameworkTemplate: true,
  currentPublishedVersion: true,
} as const;
const USER_SUMMARY_SELECT = { id: true, name: true, email: true } as const;
const REVIEW_QUESTION_INCLUDE = {
  assignedTo: { select: USER_SUMMARY_SELECT },
  createdBy: { select: USER_SUMMARY_SELECT },
  repliedBy: { select: USER_SUMMARY_SELECT },
  clearedBy: { select: USER_SUMMARY_SELECT },
  reopenedBy: { select: USER_SUMMARY_SELECT },
  messages: {
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: USER_SUMMARY_SELECT },
      images: { orderBy: { createdAt: "asc" } },
      references: {
        orderBy: { createdAt: "asc" },
        include: {
          workingPaper: {
            select: {
              id: true,
              code: true,
              title: true,
              workflowNodeId: true,
              bucket: true,
            },
          },
        },
      },
    },
  },
} as const;
const ATTACHMENT_USER_INCLUDE = {
  uploader: { select: USER_SUMMARY_SELECT },
  lockHolder: { select: USER_SUMMARY_SELECT },
  deletedByUser: { select: USER_SUMMARY_SELECT },
  restoredByUser: { select: USER_SUMMARY_SELECT },
  lastModifier: { select: USER_SUMMARY_SELECT },
  reviewQuestions: {
    orderBy: { createdAt: "desc" },
    include: REVIEW_QUESTION_INCLUDE,
  },
} as const;
const ATTACHMENT_REVISION_ACTIONS = {
  INITIAL: "INITIAL",
  CHECK_IN: "CHECK_IN",
} as const;

@Injectable()
export class SmartFormsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditLogsService)
    private readonly auditLogs: AuditLogsService,
    @Inject(StorageService)
    private readonly storage: StorageService,
    @Inject(ProjectAccessService)
    private readonly access: ProjectAccessService
  ) {}

  async getSmartFormV2PdfEngagementDetails(
    projectId: string,
    user: RequestUser,
    locale = "zh-CN"
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const details = await loadSmartFormV2PdfEngagementDetails(
      this.prisma,
      projectId,
      locale
    );
    if (!details) {
      throw new ApiNotFoundException(
        "PROJECT_NOT_FOUND",
        "Project does not exist"
      );
    }
    return details;
  }

  adminListTemplates(query: SmartFormTemplateListQueryInput = {}) {
    return this.prisma.smartFormTemplate.findMany({
      where: this.templateWhere(query, { includeArchived: false }),
      orderBy: [{ name: "asc" }, { code: "asc" }],
      include: SMART_FORM_TEMPLATE_INCLUDE,
    });
  }

  listPublishedTemplates(query: SmartFormTemplateListQueryInput = {}) {
    return this.prisma.smartFormTemplate.findMany({
      where: {
        ...this.templateWhere(query, { includeArchived: false }),
        status: "PUBLISHED",
        currentPublishedVersionId: { not: null },
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      include: SMART_FORM_TEMPLATE_INCLUDE,
    });
  }

  async createTemplate(input: CreateSmartFormTemplateInput, user: RequestUser) {
    this.requireSuperAdmin(user);
    const definition = SmartFormV2DefinitionSchema.parse(input.definition);
    const frameworkTemplateId = normalizeFrameworkTemplateId(
      input.frameworkTemplateId
    );
    if (frameworkTemplateId) {
      await this.requireFrameworkTemplate(frameworkTemplateId);
    }
    try {
      const template = await this.prisma.smartFormTemplate.create({
        data: {
          code: input.code,
          name: input.name,
          frameworkTemplateId,
          description: normalizeOptionalText(input.description),
          status: "DRAFT",
          draftDefinitionJson: definition as Prisma.InputJsonValue,
          createdBy: user.id,
        },
        include: SMART_FORM_TEMPLATE_INCLUDE,
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "CREATE_SMART_FORM_TEMPLATE",
        targetType: "SMART_FORM_TEMPLATE",
        targetId: template.id,
        description: `Created Smart Form template ${template.code}`,
      });
      return template;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Smart Form template code already exists"
        );
      }
      throw error;
    }
  }

  async updateTemplate(
    templateId: string,
    input: UpdateSmartFormTemplateInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    const hasFrameworkTemplateId = input.frameworkTemplateId !== undefined;
    const frameworkTemplateId = hasFrameworkTemplateId
      ? normalizeFrameworkTemplateId(input.frameworkTemplateId)
      : undefined;
    if (frameworkTemplateId) {
      await this.requireFrameworkTemplate(frameworkTemplateId);
    }
    try {
      const template = await this.prisma.smartFormTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.code === undefined ? {} : { code: input.code }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(hasFrameworkTemplateId ? { frameworkTemplateId } : {}),
          ...(input.description === undefined
            ? {}
            : { description: normalizeOptionalText(input.description) }),
          ...(input.definition === undefined
            ? {}
            : {
                draftDefinitionJson: SmartFormV2DefinitionSchema.parse(
                  input.definition
                ) as Prisma.InputJsonValue,
              }),
          ...(input.status === undefined ? {} : { status: input.status }),
          updatedBy: user.id,
        },
        include: SMART_FORM_TEMPLATE_INCLUDE,
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "UPDATE_SMART_FORM_TEMPLATE",
        targetType: "SMART_FORM_TEMPLATE",
        targetId: template.id,
        description: `Updated Smart Form template ${template.code}`,
      });
      return template;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Smart Form template code already exists"
        );
      }
      throw error;
    }
  }

  async publishTemplate(templateId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    const template = await this.prisma.smartFormTemplate.findFirst({
      where: { id: templateId, status: { not: "ARCHIVED" } },
    });
    if (!template) {
      throw new ApiNotFoundException(
        "SMART_FORM_TEMPLATE_NOT_FOUND",
        "Smart Form template not found"
      );
    }
    const definition = SmartFormV2DefinitionSchema.parse(
      template.draftDefinitionJson
    );
    compileSmartFormV2Definition(
      definition,
      STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
    );
    const latest = await this.prisma.smartFormTemplateVersion.aggregate({
      where: { templateId },
      _max: { version: true },
    });
    const nextVersion = (latest._max.version ?? 0) + 1;
    const definitionHash = this.hashDefinition(definition);
    const publishedTemplate = await this.prisma.$transaction(async (tx) => {
      const version = await tx.smartFormTemplateVersion.create({
        data: {
          templateId,
          version: nextVersion,
          definitionJson: definition as Prisma.InputJsonValue,
          definitionHash,
          publishedBy: user.id,
        },
      });
      return tx.smartFormTemplate.update({
        where: { id: templateId },
        data: {
          status: "PUBLISHED",
          currentPublishedVersionId: version.id,
          updatedBy: user.id,
        },
        include: SMART_FORM_TEMPLATE_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PUBLISH_SMART_FORM_TEMPLATE",
      targetType: "SMART_FORM_TEMPLATE",
      targetId: publishedTemplate.id,
      description: `Published Smart Form template ${publishedTemplate.code}`,
    });
    return publishedTemplate;
  }

  async archiveTemplate(templateId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    const template = await this.prisma.smartFormTemplate.update({
      where: { id: templateId },
      data: { status: "ARCHIVED", updatedBy: user.id },
      include: SMART_FORM_TEMPLATE_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "ARCHIVE_SMART_FORM_TEMPLATE",
      targetType: "SMART_FORM_TEMPLATE",
      targetId: template.id,
      description: `Archived Smart Form template ${template.code}`,
    });
    return template;
  }

  async createProjectSmartForm(
    projectId: string,
    nodeId: string,
    input: CreateProjectSmartFormInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "useLibrary");
    await this.access.requireProjectRole(projectId, user.id, "PREPARER");
    const version = await this.prisma.smartFormTemplateVersion.findFirst({
      where: {
        id: input.smartFormTemplateVersionId,
        template: { status: "PUBLISHED" },
      },
      include: { template: true },
    });
    if (!version) {
      throw new ApiNotFoundException(
        "SMART_FORM_TEMPLATE_NOT_FOUND",
        "Published Smart Form template version not found"
      );
    }
    const node = await this.prisma.workflowNode.findFirst({
      where: { id: nodeId, projectId },
      select: { id: true, code: true, level: true },
    });
    if (!node) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Please choose a project folder before adding Smart Forms"
      );
    }
    const existingPapers = await this.prisma.workingPaper.findMany({
      where: { projectId, workflowNodeId: node.id },
      select: { code: true },
    });
    const requestedCode =
      normalizeOptionalText(input.code) ??
      buildNextWorkingPaperCode(node.code, existingPapers);
    const code = isHierarchicalNumericWorkingPaperCode(requestedCode)
      ? requestedCode
          .trim()
          .replaceAll(/\s*-\s*/g, "-")
          .replaceAll(/\s*\.\s*/g, ".")
      : normalizeCodeWithoutDigitFour(requestedCode);
    const title = normalizeSmartFormFileName(
      normalizeOptionalText(input.title) ?? version.template.name
    );
    const now = new Date();
    const paperId = randomUUID();
    const smartFormPackage = buildSmartFormPackage({
      template: version.template,
      version,
      language: input.language ?? "zh-CN",
      now,
    });
    const completion = evaluateSmartFormV2Completion(smartFormPackage);
    const buffer = serializeSmartFormPackage(smartFormPackage);
    const stored = await this.storage.putObject(
      projectId,
      paperId,
      title,
      buffer,
      SMART_FORM_MIME_TYPE
    );
    try {
      const attachment = await this.prisma.$transaction(async (tx) => {
        const txClient = tx;
        const paper = await txClient.workingPaper.create({
          data: {
            id: paperId,
            projectId,
            workflowNodeId: node.id,
            code,
            title,
            paperType: PaperType.WORKING_PAPER,
            bucket: WorkingPaperBucket.CURRENT,
            createdBy: user.id,
          },
        });
        const created = await txClient.attachment.create({
          data: {
            projectId,
            workingPaperId: paper.id,
            workflowNodeId: node.id,
            bucket: WorkingPaperBucket.CURRENT,
            code,
            title,
            fileKind: "SMART_FORM",
            fileName: stored.fileName,
            originalName: title,
            fileUrl: stored.objectKey,
            fileSize: buffer.byteLength,
            mimeType: SMART_FORM_MIME_TYPE,
            uploadedBy: user.id,
            lastModifiedBy: user.id,
            lastModifiedAt: now,
            workDate: startOfUtcDate(now),
          },
          include: ATTACHMENT_USER_INCLUDE,
        });
        const revision = await this.createAttachmentRevision(txClient, {
          attachmentId: created.id,
          projectId,
          version: 1,
          parentVersionId: null,
          sourceVersionId: null,
          fileKind: "SMART_FORM",
          fileName: stored.fileName,
          originalName: title,
          fileUrl: stored.objectKey,
          fileSize: buffer.byteLength,
          mimeType: SMART_FORM_MIME_TYPE,
          workDate: startOfUtcDate(now),
          uploadedBy: user.id,
          uploadedAt: now,
          archivedBy: user.id,
          action: ATTACHMENT_REVISION_ACTIONS.INITIAL,
          createdAt: now,
        });
        const updatedAttachment = await txClient.attachment.update({
          where: { id: created.id },
          data: { headVersionId: revision.id },
          include: ATTACHMENT_USER_INCLUDE,
        });
        await txClient.smartFormInstance.create({
          data: {
            projectId,
            attachmentId: created.id,
            smartFormTemplateId: version.templateId,
            smartFormTemplateVersionId: version.id,
            schemaHash: this.hashDefinition(smartFormPackage.definition),
            answerHash: this.hashJson(smartFormPackage.response),
            status: completion.complete ? "COMPLETE" : "INCOMPLETE",
            completedAt: completion.complete ? now : null,
            lastSavedBy: user.id,
            lastSavedAt: now,
          },
        });
        return updatedAttachment;
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "SMART_FORM_CREATED",
        targetType: "ATTACHMENT",
        targetId: attachment.id,
        projectId,
        description: `Created Smart Form ${title}`,
        source,
      });
      return attachment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Smart Form refcode already exists in this directory"
        );
      }
      throw error;
    }
  }

  async openMaster(
    projectId: string,
    attachmentId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireSmartFormWriteAccess(projectId, user.id);
    const attachment = await this.requireSmartFormAttachment(
      projectId,
      attachmentId
    );
    if (hasActiveLock(attachment)) {
      if (attachment.lockedBy === user.id && attachment.lockSessionId) {
        return this.buildSessionResponse(
          attachment,
          await this.readPackage(attachment.fileUrl),
          "MASTER",
          attachment.lockSessionId
        );
      }
      return {
        ok: false as const,
        code: "LOCKED_BY_OTHER" as const,
        holderName: attachment.lockHolder?.name ?? "其他成员",
      };
    }

    const lockedAt = new Date();
    const lockSessionId = randomUUID();
    const result = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, projectId, deletedAt: null, lockedBy: null },
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
    if (result.count === 0) {
      const current = await this.requireSmartFormAttachment(
        projectId,
        attachmentId
      );
      return {
        ok: false as const,
        code: "LOCKED_BY_OTHER" as const,
        holderName: current.lockHolder?.name ?? "其他成员",
      };
    }
    const updated = await this.requireSmartFormAttachment(
      projectId,
      attachmentId
    );
    await this.auditLogs.log({
      actorId: user.id,
      action: "SMART_FORM_MASTER_OPENED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Opened Smart Form Master ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return this.buildSessionResponse(
      updated,
      await this.readPackage(updated.fileUrl),
      "MASTER",
      lockSessionId
    );
  }

  async readOnly(projectId: string, attachmentId: string, user: RequestUser) {
    await this.access.requireProjectMember(projectId, user.id);
    const attachment = await this.requireSmartFormAttachment(
      projectId,
      attachmentId
    );
    return this.buildSessionResponse(
      attachment,
      await this.readPackage(attachment.fileUrl),
      "READ_ONLY",
      null
    );
  }

  async save(
    projectId: string,
    attachmentId: string,
    input: SaveSmartFormPackageInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.persistSmartFormPackage(
      projectId,
      attachmentId,
      input,
      user,
      false,
      source
    );
  }

  async close(
    projectId: string,
    attachmentId: string,
    input: SaveSmartFormPackageInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await Promise.resolve();
    return this.persistSmartFormPackage(
      projectId,
      attachmentId,
      input,
      user,
      true,
      source
    );
  }

  async discard(
    projectId: string,
    attachmentId: string,
    input: { lockSessionId: string },
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.requireSmartFormWriteAccess(projectId, user.id);
    const attachment = await this.requireSmartFormAttachment(
      projectId,
      attachmentId
    );
    this.assertSmartFormLock(attachment, input.lockSessionId, user);
    const updated = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        lockedBy: null,
        lockedAt: null,
        lockExpiresAt: null,
        lockSessionId: null,
        lockHeartbeatAt: null,
        lockStaleAt: null,
        lockRevokedAt: null,
        lockRevokedBy: null,
        lockReleaseReason: "UNCHANGED_RELEASE",
      },
      include: ATTACHMENT_USER_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "SMART_FORM_MASTER_DISCARDED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `Discarded Smart Form Master ${attachment.originalName ?? attachment.fileName}`,
      source,
    });
    return { ok: true as const, attachment: updated };
  }

  hashDefinition(definition: SmartFormV2Definition) {
    return this.hashJson(definition);
  }

  private hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private requireSuperAdmin(user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super admins can edit Smart Form templates"
      );
    }
  }

  private async requireFrameworkTemplate(frameworkTemplateId: string) {
    const framework = await this.prisma.frameworkTemplate.findUnique({
      where: { id: frameworkTemplateId },
      select: { id: true },
    });
    if (!framework) {
      throw new ApiNotFoundException(
        "FRAMEWORK_TEMPLATE_NOT_FOUND",
        "Applicable standard does not exist"
      );
    }
  }

  private templateWhere(
    query: SmartFormTemplateListQueryInput,
    options: { includeArchived: boolean }
  ): Prisma.SmartFormTemplateWhereInput {
    const filters: Prisma.SmartFormTemplateWhereInput[] = [];
    const search = query.q?.trim();
    if (search) {
      filters.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    return {
      ...(options.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
      ...(query.frameworkTemplateId
        ? {
            OR: [
              { frameworkTemplateId: query.frameworkTemplateId },
              { frameworkTemplateId: null },
            ],
          }
        : {}),
      ...(filters.length > 0 ? { AND: filters } : {}),
    };
  }

  private async persistSmartFormPackage(
    projectId: string,
    attachmentId: string,
    input: SaveSmartFormPackageInput,
    user: RequestUser,
    releaseLock: boolean,
    source?: AuditLogSource
  ) {
    await this.requireSmartFormWriteAccess(projectId, user.id);
    const parsed = SaveSmartFormPackageSchema.parse(input);
    const attachment = await this.requireSmartFormAttachment(
      projectId,
      attachmentId
    );
    this.assertSmartFormLock(attachment, parsed.lockSessionId, user);
    const now = new Date();
    const smartFormPackage = normalizeSavedPackage(parsed.package, now);
    await this.assertWorkingPaperReferences(
      projectId,
      smartFormPackage.response
    );
    const completion = evaluateSmartFormV2Completion(smartFormPackage);
    const schemaHash = this.hashDefinition(smartFormPackage.definition);
    const answerHash = this.hashJson(smartFormPackage.response);
    const status = completion.complete ? "COMPLETE" : "INCOMPLETE";
    const completedAt = completion.complete ? now : null;
    const buffer = serializeSmartFormPackage(smartFormPackage);
    const originalName = normalizeSmartFormFileName(
      attachment.originalName ?? attachment.fileName
    );
    const stored = await this.storage.putObject(
      projectId,
      attachment.workingPaperId ?? "unassigned",
      originalName,
      buffer,
      SMART_FORM_MIME_TYPE
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const txClient = tx;
      const revision = await this.createAttachmentRevision(txClient, {
        attachmentId,
        projectId,
        version: attachment.version + 1,
        parentVersionId: attachment.headVersionId ?? null,
        sourceVersionId: null,
        fileKind: "SMART_FORM",
        fileName: stored.fileName,
        originalName,
        fileUrl: stored.objectKey,
        fileSize: buffer.byteLength,
        mimeType: SMART_FORM_MIME_TYPE,
        workDate: attachment.workDate ?? startOfUtcDate(now),
        uploadedBy: user.id,
        uploadedAt: now,
        archivedBy: user.id,
        action: ATTACHMENT_REVISION_ACTIONS.CHECK_IN,
        createdAt: now,
      });
      await txClient.smartFormInstance.upsert({
        where: { attachmentId },
        update: {
          schemaHash,
          answerHash,
          status,
          completedAt,
          lastSavedBy: user.id,
          lastSavedAt: now,
        },
        create: {
          projectId: attachment.projectId,
          attachmentId,
          smartFormTemplateId: smartFormPackage.template.id,
          smartFormTemplateVersionId: smartFormPackage.template.versionId,
          schemaHash,
          answerHash,
          status,
          completedAt,
          lastSavedBy: user.id,
          lastSavedAt: now,
        },
      });
      return txClient.attachment.update({
        where: { id: attachmentId },
        data: {
          fileName: stored.fileName,
          originalName,
          fileUrl: stored.objectKey,
          fileSize: buffer.byteLength,
          mimeType: SMART_FORM_MIME_TYPE,
          version: attachment.version + 1,
          headVersionId: revision.id,
          lastModifiedBy: user.id,
          lastModifiedAt: now,
          ...(releaseLock
            ? {
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                lockSessionId: null,
                lockHeartbeatAt: null,
                lockStaleAt: null,
                lockRevokedAt: null,
                lockRevokedBy: null,
                lockReleaseReason: "CHECKED_IN",
              }
            : {
                lockedBy: user.id,
                lockSessionId: parsed.lockSessionId,
                lockHeartbeatAt: now,
                lockStaleAt: null,
                lockRevokedAt: null,
                lockRevokedBy: null,
                lockReleaseReason: null,
              }),
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: releaseLock
        ? "SMART_FORM_MASTER_CLOSED"
        : "SMART_FORM_MASTER_SAVED",
      targetType: "ATTACHMENT",
      targetId: attachmentId,
      projectId,
      description: `${releaseLock ? "Closed" : "Saved"} Smart Form ${originalName}`,
      source,
    });
    return this.buildSessionResponse(
      updated,
      smartFormPackage,
      releaseLock ? "READ_ONLY" : "MASTER",
      releaseLock ? null : parsed.lockSessionId
    );
  }

  private async requireSmartFormWriteAccess(projectId: string, userId: string) {
    await this.access.requireProjectAction(
      projectId,
      userId,
      "uploadWorkingPapers"
    );
    return this.access.requireProjectRole(projectId, userId, "PREPARER");
  }

  private async assertWorkingPaperReferences(
    projectId: string,
    response: SmartFormPackage["response"]
  ) {
    const referencedWorkingPaperIds = new Set<string>();
    const answers: SmartFormV2FieldAnswer[] = [
      ...Object.values(response.fields),
      ...Object.values(response.sheets).flatMap((sheet) =>
        sheet.rows.flatMap((row) => Object.values(row.cells))
      ),
    ];
    for (const answer of answers) {
      collectWorkingPaperReferenceIds(answer, referencedWorkingPaperIds);
    }
    if (referencedWorkingPaperIds.size === 0) {
      return;
    }

    const matchingWorkingPapers = await this.prisma.workingPaper.findMany({
      where: {
        projectId,
        id: { in: [...referencedWorkingPaperIds] },
      },
      select: { id: true },
    });
    if (matchingWorkingPapers.length !== referencedWorkingPaperIds.size) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Smart Form contains a working paper reference outside this project"
      );
    }
  }

  private async requireSmartFormAttachment(
    projectId: string,
    attachmentId: string
  ) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, projectId, deletedAt: null },
      include: ATTACHMENT_USER_INCLUDE,
    });
    if (!attachment) {
      throw new ApiNotFoundException("NOT_FOUND", "Smart Form file not found");
    }
    if (attachment.fileKind !== "SMART_FORM") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "This file is not a Smart Form"
      );
    }
    return attachment;
  }

  private async readPackage(objectKey: string) {
    const buffer = await this.storage.getObjectBuffer(objectKey);
    return SmartFormPackageSchema.parse(JSON.parse(buffer.toString("utf-8")));
  }

  private buildSessionResponse(
    attachment: SmartFormAttachmentRecord,
    smartFormPackage: SmartFormPackage,
    mode: "MASTER" | "READ_ONLY",
    lockSessionId: string | null
  ) {
    return {
      ok: true as const,
      mode,
      attachment,
      package: smartFormPackage,
      lockSessionId,
      completion: evaluateSmartFormV2Completion(smartFormPackage),
    };
  }

  private assertSmartFormLock(
    attachment: SmartFormAttachmentRecord,
    lockSessionId: string,
    user: RequestUser
  ) {
    if (
      attachment.lockedBy !== user.id ||
      attachment.lockSessionId !== lockSessionId ||
      attachment.lockRevokedAt
    ) {
      throw new ApiBadRequestException(
        "LOCK_SESSION_MISMATCH",
        "You are not the active Smart Form Master for this file."
      );
    }
  }

  private async createAttachmentRevision(
    tx: AttachmentVersionWriter,
    input: AttachmentRevisionInput
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
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeFrameworkTemplateId(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function buildSmartFormPackage(input: {
  template: { id: string; code: string; name: string };
  version: {
    id: string;
    version: number;
    definitionJson: unknown;
    publishedAt: Date;
  };
  language: SmartFormPackage["template"]["language"];
  now: Date;
}): SmartFormPackage {
  const definition = compileSmartFormV2Definition(
    input.version.definitionJson,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  const responseLocale = input.language ?? definition.i18n.defaultLocale;
  const timestamp = input.now.toISOString();
  return {
    packageType: "PROJECT_WING_SMART_FORM",
    formatVersion: 2,
    template: {
      id: input.template.id,
      versionId: input.version.id,
      code: input.template.code,
      title: input.template.name,
      publishedAt: input.version.publishedAt.toISOString(),
      language: input.language,
    },
    definition,
    response: {
      kind: "smartFormResponse",
      schemaVersion: 2,
      definitionVersionId: definition.id,
      responseLocale,
      updatedAt: timestamp,
      fields: {},
      sheets: {},
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function evaluateSmartFormV2Completion(smartFormPackage: SmartFormPackage) {
  const definition = compileSmartFormV2Definition(
    smartFormPackage.definition,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  const validation = validateSmartFormV2Response(
    definition,
    smartFormPackage.response
  );
  return {
    complete: validation.success,
    issues: validation.success ? [] : validation.issues,
  };
}

function collectWorkingPaperReferenceIds(
  answer: SmartFormV2FieldAnswer,
  target: Set<string>
) {
  if (answer.type === "localized") {
    Object.values(answer.values).forEach((value) => {
      if (value) {
        collectWorkingPaperReferenceIds(value, target);
      }
    });
    return;
  }
  if (answer.type === "richText") {
    collectRichTextWorkingPaperReferenceIds(answer.document, target);
    return;
  }
  if (answer.type !== "reference") {
    return;
  }
  answer.references.forEach((reference) => {
    if (reference.targetType === "projectWing.workingPaper") {
      target.add(reference.targetId);
    }
  });
}

function collectRichTextWorkingPaperReferenceIds(
  document: SmartFormV2RichTextDocument,
  target: Set<string>
) {
  const visitBlock = (block: SmartFormV2RichTextBlock) => {
    if (block.type === "embed") {
      if (block.entityType === "workingPaper") {
        target.add(block.entityId);
      }
      return;
    }
    if (block.type === "paragraph" || block.type === "heading") {
      block.content.forEach((inline) => {
        if (
          inline.type === "entityReference" &&
          inline.entityType === "workingPaper"
        ) {
          target.add(inline.entityId);
        }
      });
      return;
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      block.items.forEach((item) => item.content.forEach(visitBlock));
      return;
    }
    if (block.type === "blockquote") {
      block.content.forEach(visitBlock);
      return;
    }
    if (block.type === "table") {
      block.rows.forEach((row) =>
        row.cells.forEach((cell) => cell.content.forEach(visitBlock))
      );
    }
  };
  document.content.forEach(visitBlock);
}

function normalizeSavedPackage(input: SmartFormPackage, now: Date) {
  const parsed = SmartFormPackageSchema.parse(input);
  return {
    ...parsed,
    updatedAt: now.toISOString(),
  };
}

function serializeSmartFormPackage(input: SmartFormPackage) {
  return Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf-8");
}

function normalizeSmartFormFileName(value: string) {
  const normalized = value.trim();
  return normalized.toLowerCase().endsWith(".sf")
    ? normalized
    : `${normalized}.sf`;
}

function startOfUtcDate(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function hasActiveLock(attachment: SmartFormAttachmentRecord) {
  return Boolean(attachment.lockedBy && !attachment.lockRevokedAt);
}

type SmartFormAttachmentRecord = {
  id: string;
  projectId: string;
  workingPaperId?: string | null;
  fileKind: string;
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  version: number;
  headVersionId?: string | null;
  workDate?: Date | null;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  lockSessionId?: string | null;
  lockRevokedAt?: Date | null;
  lockHolder?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  reviewQuestions?: Prisma.WorkingPaperQuestionGetPayload<{
    include: typeof REVIEW_QUESTION_INCLUDE;
  }>[];
};

type AttachmentRevisionInput = {
  attachmentId: string;
  projectId: string;
  version: number;
  parentVersionId?: string | null;
  sourceVersionId?: string | null;
  fileKind: "SMART_FORM";
  fileName: string;
  originalName?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  workDate?: Date | null;
  uploadedBy?: string | null;
  uploadedAt: Date;
  archivedBy: string;
  action: (typeof ATTACHMENT_REVISION_ACTIONS)[keyof typeof ATTACHMENT_REVISION_ACTIONS];
  message?: string | null;
  createdAt: Date;
};

type AttachmentVersionWriter = {
  attachmentVersion: {
    deleteMany: (input: {
      where: { attachmentId: string; version: { gte: number } };
    }) => Promise<unknown>;
    updateMany: (input: {
      where: { attachmentId: string; isCurrent: true };
      data: { isCurrent: false };
    }) => Promise<unknown>;
    create: (input: {
      data: AttachmentRevisionInput & {
        parentVersionId: string | null;
        sourceVersionId: string | null;
        message: string | null;
        isCurrent: true;
      };
    }) => Promise<{ id: string }>;
  };
};
