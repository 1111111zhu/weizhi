import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { promisify } from "node:util";

import { path7za } from "7zip-bin";
import { Injectable, Optional } from "@nestjs/common";
import { PaperType, Prisma } from "@prisma/client";
import type {
  ApplyProjectTemplateInput,
  ConfirmProjectTemplateFileUploadInput,
  CreateProjectTemplateInput,
  CreateProjectTemplateNodeInput,
  CreateProjectTemplatePlaceholderInput,
  CreateProjectTemplateSmartFormInput,
  ImportProjectTemplateZipInput,
  ProjectTemplateFileInput,
  ProjectTemplateListQueryInput,
  ReorderProjectTemplateItemsInput,
  RequestProjectTemplateFileUploadUrlInput,
  SmartFormLocale,
  UpdateProjectTemplateInput,
  UpdateProjectTemplateItemCodeInput,
  UpdateProjectTemplateNodeInput,
} from "@project-wing/shared";
import {
  ATTACHMENT_PLACEHOLDER_TYPES,
  formatNumberWithoutDigitFour,
  normalizeCodeWithoutDigitFour,
} from "@project-wing/shared";
import JSZip from "jszip";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import { ensureExecutableFile } from "../common/executable-file";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { SmartFormsService } from "../smart-forms/smart-forms.service";
import { StorageService } from "../storage/storage.service";
import {
  buildNextWorkingPaperCode,
  isHierarchicalNumericFolderCode,
  isHierarchicalNumericWorkingPaperCode,
  normalizeHierarchicalNumericCode,
} from "../workflow/working-paper-code";

export type UploadedProjectTemplateFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const USER_SUMMARY_SELECT = { id: true, name: true, email: true } as const;
const ATTACHMENT_USER_INCLUDE = {
  uploader: { select: USER_SUMMARY_SELECT },
  lockHolder: { select: USER_SUMMARY_SELECT },
  deletedByUser: { select: USER_SUMMARY_SELECT },
  restoredByUser: { select: USER_SUMMARY_SELECT },
  lastModifier: { select: USER_SUMMARY_SELECT },
} as const;

type ProjectTemplateForApply = Prisma.ProjectTemplateGetPayload<{
  include: {
    nodes: {
      include: {
        files: true;
        smartForms: true;
      };
    };
  };
}>;
type ProjectTemplateFileForApply =
  ProjectTemplateForApply["nodes"][number]["files"][number];
type ProjectTemplateSmartFormForApply =
  ProjectTemplateForApply["nodes"][number]["smartForms"][number];
type ProjectTemplateApplyTarget = {
  id: string;
  code: string;
  title: string;
  level: number;
};
type ExistingProjectTemplatePaper = {
  id: string;
  code: string;
  title: string;
  paperType: PaperType;
  bucket: NonNullable<ApplyProjectTemplateInput["bucket"]>;
  templateItemId: string | null;
};
type ProjectTemplateApplyPlanItem = {
  templateFileId: string;
  templateNodeId: string;
  sourceCode: string;
  title: string;
  originalName: string | null;
  paperType: PaperType;
  bucket: NonNullable<ApplyProjectTemplateInput["bucket"]>;
  status: "CREATE" | "EXISTS";
  plannedCode: string | null;
  existingWorkingPaper: ExistingProjectTemplatePaper | null;
};
type ProjectTemplateApplySmartFormPlanItem = {
  smartFormReferenceId: string;
  templateNodeId: string;
  sourceCode: string;
  title: string;
  originalName: string;
  paperType: PaperType;
  bucket: NonNullable<ApplyProjectTemplateInput["bucket"]>;
  status: "CREATE" | "EXISTS";
  plannedCode: string | null;
  existingWorkingPaper: ExistingProjectTemplatePaper | null;
  smartFormTemplateVersionId: string;
};
type ParsedProjectTemplateZip = {
  folders: string[];
  files: {
    path: string;
    folderPath: string;
    originalName: string;
    content: Buffer;
    mimeType: string;
  }[];
};
type RawProjectTemplateArchiveFile = {
  path: string;
  read: () => Promise<Buffer>;
};

const MAX_PROJECT_TEMPLATE_ZIP_FILES = 500;
const MAX_PROJECT_TEMPLATE_ZIP_TOTAL_BYTES = 100 * 1024 * 1024;
const SEVEN_ZIP_EXTRACT_TIMEOUT_MS = 60_000;
const PROJECT_TEMPLATE_ZIP_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);
const PROJECT_TEMPLATE_7Z_MIME_TYPES = new Set([
  "application/x-7z-compressed",
  "application/x-7z",
]);
const execFileAsync = promisify(execFile);

@Injectable()
export class ProjectTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly access?: ProjectAccessService,
    @Optional() private readonly auditLogs?: AuditLogsService,
    @Optional() private readonly smartForms?: SmartFormsService
  ) {}

  list(
    query: ProjectTemplateListQueryInput = {},
    options: { includeAllStatuses?: boolean } = {}
  ) {
    const where: Prisma.ProjectTemplateWhereInput = options.includeAllStatuses
      ? { status: { not: "ARCHIVED" } }
      : { status: "PUBLISHED" };
    const search = query.q?.trim();
    if (search) {
      const searchFilter: Prisma.ProjectTemplateWhereInput = {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      };
      where.AND = where.AND
        ? [...asWhereArray(where.AND), searchFilter]
        : [searchFilter];
    }
    return this.prisma.projectTemplate.findMany({
      where,
      orderBy: [{ name: "asc" }, { code: "asc" }],
      include: {
        frameworkTemplate: true,
        _count: {
          select: {
            nodes: true,
            files: true,
            smartForms: true,
          },
        },
      },
    });
  }

  async get(
    templateId: string,
    options: { includeAllStatuses?: boolean } = {}
  ) {
    const template = await this.prisma.projectTemplate.findFirst({
      where: {
        id: templateId,
        ...(options.includeAllStatuses ? {} : { status: "PUBLISHED" }),
      },
      include: {
        frameworkTemplate: true,
        nodes: {
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
          include: {
            files: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            },
            smartForms: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
              include: {
                smartFormTemplate: true,
                smartFormTemplateVersion: true,
              },
            },
          },
        },
        _count: {
          select: {
            nodes: true,
            files: true,
            smartForms: true,
          },
        },
      },
    });
    if (!template) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template not found"
      );
    }
    return template;
  }

  async create(input: CreateProjectTemplateInput, user: RequestUser) {
    this.requireSuperAdmin(user);
    await this.requireFrameworkTemplate(input.frameworkTemplateId);
    try {
      return await this.prisma.projectTemplate.create({
        data: {
          code: input.code,
          name: input.name,
          language: input.language,
          frameworkTemplateId: input.frameworkTemplateId,
          description: normalizeOptionalText(input.description),
          status: input.status,
          createdBy: user.id,
        },
        include: PROJECT_TEMPLATE_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Project template code already exists"
        );
      }
      throw error;
    }
  }

  async importZip(
    input: ImportProjectTemplateZipInput,
    file: UploadedProjectTemplateFile,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireFrameworkTemplate(input.frameworkTemplateId);
    if (!isSupportedArchiveUpload(file)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Please upload a zip or 7z file"
      );
    }
    const parsed = await parseProjectTemplateArchive(file, input.name);
    try {
      const templateId = await this.prisma.$transaction(async (tx) => {
        const template = await tx.projectTemplate.create({
          data: {
            code: input.code,
            name: input.name,
            language: input.language,
            frameworkTemplateId: input.frameworkTemplateId,
            description: null,
            status: "DRAFT",
            createdBy: user.id,
          },
        });
        const nodeByPath = new Map<
          string,
          { id: string; code: string; level: number }
        >();
        const nextNodeSortByParent = new Map<string, number>();
        const siblingNodeCodesByParent = new Map<string, Set<string>>();
        for (const folderPath of parsed.folders) {
          const segments = folderPath.split("/");
          const parentPath = segments.slice(0, -1).join("/");
          const parent = parentPath ? nodeByPath.get(parentPath) : null;
          if (parentPath && !parent) {
            throw new ApiBadRequestException(
              "PROJECT_TEMPLATE_INVALID",
              `Parent folder is missing for ${folderPath}`
            );
          }
          const level = segments.length;
          const parentSortKey = parentPath || "__root__";
          const sortOrder = (nextNodeSortByParent.get(parentSortKey) ?? 0) + 1;
          nextNodeSortByParent.set(parentSortKey, sortOrder);
          const folderLabel = normalizeTemplateZipLabel(
            segments[segments.length - 1] ?? "Folder"
          );
          const { code, title } = parseImportedFolderLabel(folderLabel);
          const siblingCodes =
            siblingNodeCodesByParent.get(parentSortKey) ?? new Set<string>();
          if (siblingCodes.has(code)) {
            throw new ApiBadRequestException(
              "DUPLICATE_CODE",
              `Duplicate folder code ${code} under ${parentPath || "root"}`
            );
          }
          siblingCodes.add(code);
          siblingNodeCodesByParent.set(parentSortKey, siblingCodes);
          const node = await tx.projectTemplateNode.create({
            data: {
              projectTemplateId: template.id,
              parentId: parent?.id ?? null,
              code,
              title,
              level,
              nodeType: getWorkflowNodeType(level),
              sortOrder,
            },
          });
          nodeByPath.set(folderPath, {
            id: node.id,
            code: node.code,
            level: node.level,
          });
        }
        const nextFileSortByFolder = new Map<string, number>();
        for (const importedFile of parsed.files) {
          const node = nodeByPath.get(importedFile.folderPath);
          if (!node) {
            throw new ApiBadRequestException(
              "PROJECT_TEMPLATE_INVALID",
              `Template folder is missing for ${importedFile.path}`
            );
          }
          const sortOrder =
            (nextFileSortByFolder.get(importedFile.folderPath) ?? 0) + 1;
          nextFileSortByFolder.set(importedFile.folderPath, sortOrder);
          const stored = await this.fileStorage().putProjectTemplateFile(
            template.id,
            node.id,
            importedFile.originalName,
            importedFile.content,
            importedFile.mimeType
          );
          await tx.projectTemplateFile.create({
            data: {
              projectTemplateId: template.id,
              templateNodeId: node.id,
              code: buildTemplateFileCode(node.code, sortOrder),
              title: importedFile.originalName,
              fileName: importedFile.originalName,
              originalName: importedFile.originalName,
              fileUrl: stored.objectKey,
              fileSize: importedFile.content.length,
              mimeType: importedFile.mimeType,
              paperType: "WORKING_PAPER",
              sortOrder,
            },
          });
        }
        return template.id;
      });
      return this.get(templateId, { includeAllStatuses: true });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Project template code already exists"
        );
      }
      throw error;
    }
  }

  async update(
    templateId: string,
    input: UpdateProjectTemplateInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    if (input.frameworkTemplateId) {
      await this.requireFrameworkTemplate(input.frameworkTemplateId);
    }
    await this.requireTemplate(templateId);
    try {
      return await this.prisma.projectTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.code === undefined ? {} : { code: input.code }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.language === undefined ? {} : { language: input.language }),
          ...(input.frameworkTemplateId === undefined
            ? {}
            : { frameworkTemplateId: input.frameworkTemplateId }),
          ...(input.description === undefined
            ? {}
            : { description: normalizeOptionalText(input.description) }),
          ...(input.status === undefined ? {} : { status: input.status }),
        },
        include: PROJECT_TEMPLATE_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Project template code already exists"
        );
      }
      throw error;
    }
  }

  async archive(templateId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    return this.prisma.projectTemplate.update({
      where: { id: templateId },
      data: { status: "ARCHIVED" },
      include: PROJECT_TEMPLATE_INCLUDE,
    });
  }

  async previewApplyToProject(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput,
    user: RequestUser
  ) {
    await this.projectAccess().requireProjectAction(
      projectId,
      user.id,
      "useLibrary"
    );
    await this.projectAccess().requireProjectRole(
      projectId,
      user.id,
      "PREPARER"
    );
    const { template, targetNode, files, smartForms } =
      await this.requireProjectTemplateApplyContext(
        projectId,
        templateId,
        input
      );
    const plan = await this.buildProjectTemplateApplyPlan(
      this.prisma,
      targetNode,
      files,
      smartForms,
      input.bucket,
      input.referenceCodeOverrides
    );
    return { template, targetNode, plan };
  }

  async applyToProject(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.projectAccess().requireProjectAction(
      projectId,
      user.id,
      "useLibrary"
    );
    await this.projectAccess().requireProjectRole(
      projectId,
      user.id,
      "PREPARER"
    );
    const { template, targetNode, files, smartForms } =
      await this.requireProjectTemplateApplyContext(
        projectId,
        templateId,
        input
      );
    const smartFormLanguage = await this.getProjectSmartFormLanguage(projectId);

    try {
      const { createdPapers, applyPlan } = await this.prisma.$transaction(
        async (tx) => {
          const templateApplyPlan = await this.buildProjectTemplateApplyPlan(
            tx,
            targetNode,
            files,
            smartForms,
            input.bucket,
            input.referenceCodeOverrides
          );
          const filesById = new Map(files.map((file) => [file.id, file]));
          const papers = [];
          for (const item of templateApplyPlan.items) {
            if (item.status !== "CREATE" || !item.plannedCode) {
              continue;
            }
            const file = filesById.get(item.templateFileId);
            if (!file) {
              continue;
            }
            const paper = await tx.workingPaper.create({
              data: {
                projectId,
                workflowNodeId: targetNode.id,
                code: item.plannedCode,
                title: file.title,
                paperType: file.paperType,
                bucket: item.bucket,
                // Repeat imports create independent copies; keep source linkage
                // on the attachment, not the library's unique workpaper slot.
                templateItemId: null,
                createdBy: user.id,
              },
            });
            const originalName = file.originalName ?? file.title;
            if (file.placeholderType) {
              const uploadedAt = new Date();
              const attachment = await tx.attachment.create({
                data: {
                  projectId,
                  workingPaperId: paper.id,
                  templateItemId: file.templateItemId,
                  fileKind: "SUPPORTING",
                  fileName: file.fileName,
                  originalName,
                  fileUrl: "",
                  fileSize: 0,
                  mimeType: file.mimeType,
                  placeholderType: file.placeholderType,
                  uploadedBy: user.id,
                  lastModifiedBy: user.id,
                  lastModifiedAt: uploadedAt,
                  workDate: startOfUtcDate(uploadedAt),
                },
                include: ATTACHMENT_USER_INCLUDE,
              });
              papers.push({ ...paper, attachments: [attachment] });
              continue;
            }
            const stored = await this.fileStorage().copyObjectToWorkingPaper(
              projectId,
              paper.id,
              originalName,
              file.fileUrl,
              file.mimeType
            );
            const uploadedAt = new Date();
            const attachment = await tx.attachment.create({
              data: {
                projectId,
                workingPaperId: paper.id,
                templateItemId: file.templateItemId,
                fileKind: "SUPPORTING",
                fileName: stored.fileName,
                originalName,
                fileUrl: stored.objectKey,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                uploadedBy: user.id,
                lastModifiedBy: user.id,
                lastModifiedAt: uploadedAt,
                workDate: startOfUtcDate(uploadedAt),
              },
              include: ATTACHMENT_USER_INCLUDE,
            });
            const version = await tx.attachmentVersion.create({
              data: {
                attachmentId: attachment.id,
                projectId,
                version: 1,
                parentVersionId: null,
                sourceVersionId: null,
                fileKind: "SUPPORTING",
                fileName: stored.fileName,
                originalName,
                fileUrl: stored.objectKey,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                workDate: startOfUtcDate(uploadedAt),
                uploadedBy: user.id,
                uploadedAt,
                archivedBy: user.id,
                action: "INITIAL",
                isCurrent: true,
              },
            });
            const updatedAttachment = await tx.attachment.update({
              where: { id: attachment.id },
              data: { headVersionId: version.id },
              include: ATTACHMENT_USER_INCLUDE,
            });
            papers.push({ ...paper, attachments: [updatedAttachment] });
          }
          return { createdPapers: papers, applyPlan: templateApplyPlan };
        }
      );
      const createdSmartForms = [];
      for (const item of applyPlan.smartFormItems) {
        if (item.status !== "CREATE" || !item.plannedCode) {
          continue;
        }
        createdSmartForms.push(
          await this.smartFormManager().createProjectSmartForm(
            projectId,
            targetNode.id,
            {
              smartFormTemplateVersionId: item.smartFormTemplateVersionId,
              code: item.plannedCode,
              title: item.originalName,
              language: smartFormLanguage,
            },
            user,
            source
          )
        );
      }
      if (createdPapers.length > 0 || createdSmartForms.length > 0) {
        await this.auditLogger().log({
          actorId: user.id,
          action: "PROJECT_TEMPLATE_APPLIED",
          targetType: "PROJECT_TEMPLATE",
          targetId: template.id,
          projectId,
          description: `Applied project template ${template.code} to ${targetNode.code}; created ${createdPapers.length} workpapers and ${createdSmartForms.length} Smart Forms`,
          source,
        });
      }
      return {
        template,
        targetNode,
        plan: applyPlan,
        createdWorkingPapers: createdPapers,
        createdSmartForms,
        existingWorkingPapers: [
          ...applyPlan.items.map((item) => item.existingWorkingPaper),
          ...applyPlan.smartFormItems.map((item) => item.existingWorkingPaper),
        ].filter((paper): paper is ExistingProjectTemplatePaper =>
          Boolean(paper)
        ),
        skippedTemplateFileIds: applyPlan.items
          .filter((item) => item.status === "EXISTS")
          .map((item) => item.templateFileId),
        skippedSmartFormReferenceIds: applyPlan.smartFormItems
          .filter((item) => item.status === "EXISTS")
          .map((item) => item.smartFormReferenceId),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "DUPLICATE_CODE",
          "Generated workpaper code already exists; please try again"
        );
      }
      throw error;
    }
  }

  async createSmartFormReference(
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplateSmartFormInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    const node = await this.requireTemplateFolder(templateId, nodeId);
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
    const title = normalizeOptionalText(input.title) ?? version.template.name;
    try {
      return await this.withTemplateItemSequence(
        node.id,
        async (tx, sortOrder) => {
          await Promise.resolve();
          const code =
            normalizeOptionalText(input.code) ??
            buildTemplateFileCode(node.code, sortOrder);
          return tx.projectTemplateSmartForm.create({
            data: {
              projectTemplateId: templateId,
              templateNodeId: node.id,
              smartFormTemplateId: version.templateId,
              smartFormTemplateVersionId: version.id,
              code,
              title,
              fileName: normalizeSmartFormFileName(title),
              sortOrder,
            },
            include: {
              smartFormTemplate: true,
              smartFormTemplateVersion: true,
            },
          });
        }
      );
    } catch (error) {
      throwProjectTemplateDuplicateCode(error);
    }
  }

  async createPlaceholder(
    templateId: string,
    nodeId: string,
    input: CreateProjectTemplatePlaceholderInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    const node = await this.requireTemplateFolder(templateId, nodeId);
    const placeholder = ATTACHMENT_PLACEHOLDER_TYPES[input.placeholderType];
    const title = ensureFileExtension(input.title, placeholder.extension);
    try {
      return await this.withTemplateItemSequence(
        node.id,
        async (tx, sortOrder) => {
          await Promise.resolve();
          return tx.projectTemplateFile.create({
            data: {
              projectTemplateId: templateId,
              templateNodeId: node.id,
              code: input.code,
              title,
              fileName: title,
              originalName: title,
              fileUrl: "",
              fileSize: 0,
              mimeType: placeholder.mimeType,
              placeholderType: input.placeholderType,
              paperType: "WORKING_PAPER",
              sortOrder,
            },
          });
        }
      );
    } catch (error) {
      throwProjectTemplateDuplicateCode(error);
    }
  }

  async deleteSmartFormReference(
    templateId: string,
    referenceId: string,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const reference = await this.prisma.projectTemplateSmartForm.findFirst({
      where: { id: referenceId, projectTemplateId: templateId },
    });
    if (!reference) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template Smart Form reference not found"
      );
    }
    return this.prisma.projectTemplateSmartForm.delete({
      where: { id: referenceId },
    });
  }

  async updateSmartFormReferenceCode(
    templateId: string,
    referenceId: string,
    input: UpdateProjectTemplateItemCodeInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const reference = await this.prisma.projectTemplateSmartForm.findFirst({
      where: { id: referenceId, projectTemplateId: templateId },
      select: { templateNodeId: true },
    });
    if (!reference) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template Smart Form reference not found"
      );
    }
    const node = await this.requireNumericTemplateNode(
      templateId,
      reference.templateNodeId
    );
    const code = buildNumericTemplateItemCode(node.code, input.sequence);
    return this.withTemplateItemLock(node.id, async (tx) => {
      const current = await tx.projectTemplateSmartForm.findFirst({
        where: { id: referenceId, projectTemplateId: templateId },
        select: { id: true },
      });
      if (!current) {
        throw new ApiNotFoundException(
          "PROJECT_TEMPLATE_NOT_FOUND",
          "Project template Smart Form reference not found"
        );
      }
      await this.assertTemplateItemCodeAvailable(tx, node.id, code, {
        type: "SMART_FORM",
        id: referenceId,
      });
      return tx.projectTemplateSmartForm.update({
        where: { id: referenceId },
        data: { code },
      });
    });
  }

  async reorderItems(
    templateId: string,
    nodeId: string,
    input: ReorderProjectTemplateItemsInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const node = await this.requireNumericTemplateNode(templateId, nodeId);
    return this.withTemplateItemLock(node.id, async (tx) => {
      const [files, smartForms] = await Promise.all([
        tx.projectTemplateFile.findMany({
          where: { projectTemplateId: templateId, templateNodeId: node.id },
          select: { id: true },
        }),
        tx.projectTemplateSmartForm.findMany({
          where: { projectTemplateId: templateId, templateNodeId: node.id },
          select: { id: true },
        }),
      ]);
      const storedItems = [
        ...files.map((item) => `FILE:${item.id}`),
        ...smartForms.map((item) => `SMART_FORM:${item.id}`),
      ];
      const requestedItems = input.items.map(
        (item) => `${item.type}:${item.id}`
      );
      const requestedSet = new Set(requestedItems);
      if (
        storedItems.length !== requestedItems.length ||
        storedItems.some((item) => !requestedSet.has(item))
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "Project template items must include the complete folder contents"
        );
      }

      await Promise.all(
        input.items.map((item) =>
          item.type === "FILE"
            ? tx.projectTemplateFile.update({
                where: { id: item.id },
                data: { code: `__projectwing_order__${item.id}` },
              })
            : tx.projectTemplateSmartForm.update({
                where: { id: item.id },
                data: { code: `__projectwing_order__${item.id}` },
              })
        )
      );

      const items = await Promise.all(
        input.items.map(async (item, index) => {
          const sortOrder = index + 1;
          const code = buildNumericTemplateItemCode(node.code, sortOrder);
          const updated =
            item.type === "FILE"
              ? await tx.projectTemplateFile.update({
                  where: { id: item.id },
                  data: { code, sortOrder },
                })
              : await tx.projectTemplateSmartForm.update({
                  where: { id: item.id },
                  data: { code, sortOrder },
                });
          return { type: item.type, ...updated };
        })
      );
      return { items };
    });
  }

  async createNode(
    templateId: string,
    input: CreateProjectTemplateNodeInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const parentId = normalizeOptionalText(input.parentId);
    const parent = parentId
      ? await this.prisma.projectTemplateNode.findFirst({
          where: { id: parentId, projectTemplateId: templateId },
        })
      : null;
    if (parentId && !parent) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Parent folder is not part of this project template"
      );
    }
    const level = getCreatableChildLevel(parent?.level ?? null);
    if (!level) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Project template parent folder is invalid"
      );
    }
    const sortOrder = await this.nextNodeSortOrder(
      templateId,
      parentId ?? null
    );
    try {
      return await this.prisma.projectTemplateNode.create({
        data: {
          projectTemplateId: templateId,
          parentId: parentId ?? null,
          code: input.code,
          title: input.title,
          auditAreaCode: input.auditAreaCode ?? null,
          level,
          nodeType: getWorkflowNodeType(level),
          sortOrder,
        },
      });
    } catch (error) {
      throwProjectTemplateDuplicateCode(error);
    }
  }

  async updateNode(
    templateId: string,
    nodeId: string,
    input: UpdateProjectTemplateNodeInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    await this.requireTemplateNode(templateId, nodeId);
    try {
      return await this.prisma.projectTemplateNode.update({
        where: { id: nodeId },
        data: {
          ...(input.code === undefined ? {} : { code: input.code }),
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.auditAreaCode === undefined
            ? {}
            : { auditAreaCode: input.auditAreaCode }),
        },
      });
    } catch (error) {
      throwProjectTemplateDuplicateCode(error);
    }
  }

  async deleteNode(templateId: string, nodeId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    await this.requireTemplateNode(templateId, nodeId);
    return this.prisma.projectTemplateNode.delete({ where: { id: nodeId } });
  }

  async createFileUploadGrant(
    templateId: string,
    nodeId: string,
    input: RequestProjectTemplateFileUploadUrlInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplateFolder(templateId, nodeId);
    return this.fileStorage().createProjectTemplateFileUploadGrant(
      templateId,
      nodeId,
      normalizeUploadedFileName(input.fileName),
      input.mimeType
    );
  }

  async confirmFileUpload(
    templateId: string,
    nodeId: string,
    input: ConfirmProjectTemplateFileUploadInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    const node = await this.requireTemplateFolder(templateId, nodeId);
    const objectKey = await this.assertTemplateObjectMatches(
      templateId,
      nodeId,
      input.objectKey,
      input.fileSize,
      input.mimeType
    );
    return this.createTemplateFileRecord(templateId, node, input, {
      fileName: normalizeUploadedFileName(input.fileName),
      objectKey,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      originalName: normalizeUploadedFileName(input.fileName),
    });
  }

  async uploadFile(
    templateId: string,
    nodeId: string,
    input: ProjectTemplateFileInput,
    file: UploadedProjectTemplateFile,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    const node = await this.requireTemplateFolder(templateId, nodeId);
    if (!file?.buffer?.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Please upload a file"
      );
    }
    const originalName = normalizeUploadedFileName(file.originalname);
    const stored = await this.fileStorage().putProjectTemplateFile(
      templateId,
      nodeId,
      originalName,
      file.buffer,
      file.mimetype || "application/octet-stream"
    );
    return this.createTemplateFileRecord(templateId, node, input, {
      fileName: originalName,
      objectKey: stored.objectKey,
      fileSize: file.size,
      mimeType: file.mimetype || "application/octet-stream",
      originalName,
    });
  }

  async deleteFile(templateId: string, fileId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const file = await this.prisma.projectTemplateFile.findFirst({
      where: { id: fileId, projectTemplateId: templateId },
    });
    if (!file) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template file not found"
      );
    }
    return this.prisma.projectTemplateFile.delete({ where: { id: fileId } });
  }

  async previewFile(templateId: string, fileId: string, user: RequestUser) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const file = await this.prisma.projectTemplateFile.findFirst({
      where: { id: fileId, projectTemplateId: templateId },
      select: {
        fileName: true,
        fileUrl: true,
        mimeType: true,
        originalName: true,
        placeholderType: true,
      },
    });
    if (!file || file.placeholderType || !file.fileUrl) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template file is not available for preview"
      );
    }
    return {
      body: await this.fileStorage().getObjectBuffer(file.fileUrl),
      fileName: file.originalName || file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
    };
  }

  async updateFileCode(
    templateId: string,
    fileId: string,
    input: UpdateProjectTemplateItemCodeInput,
    user: RequestUser
  ) {
    this.requireSuperAdmin(user);
    await this.requireTemplate(templateId);
    const file = await this.prisma.projectTemplateFile.findFirst({
      where: { id: fileId, projectTemplateId: templateId },
      select: { templateNodeId: true },
    });
    if (!file) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template file not found"
      );
    }
    const node = await this.requireNumericTemplateNode(
      templateId,
      file.templateNodeId
    );
    const code = buildNumericTemplateItemCode(node.code, input.sequence);
    return this.withTemplateItemLock(node.id, async (tx) => {
      const current = await tx.projectTemplateFile.findFirst({
        where: { id: fileId, projectTemplateId: templateId },
        select: { id: true },
      });
      if (!current) {
        throw new ApiNotFoundException(
          "PROJECT_TEMPLATE_NOT_FOUND",
          "Project template file not found"
        );
      }
      await this.assertTemplateItemCodeAvailable(tx, node.id, code, {
        type: "FILE",
        id: fileId,
      });
      return tx.projectTemplateFile.update({
        where: { id: fileId },
        data: { code },
      });
    });
  }

  private async requireProjectTemplateApplyContext(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) {
    const template = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, status: "PUBLISHED" },
      include: {
        frameworkTemplate: true,
        nodes: {
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
          include: {
            files: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            },
            smartForms: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            },
          },
        },
        _count: {
          select: {
            nodes: true,
            files: true,
            smartForms: true,
          },
        },
      },
    });
    if (!template) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template is not available"
      );
    }
    const targetNode = await this.prisma.workflowNode.findFirst({
      where: { id: input.workflowNodeId, projectId },
      select: {
        id: true,
        code: true,
        title: true,
        level: true,
      },
    });
    if (!targetNode) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Choose a project folder before applying a project template"
      );
    }
    const files = template.nodes.flatMap((node) => node.files ?? []);
    const smartForms = template.nodes.flatMap((node) => node.smartForms ?? []);
    const selectedIds = new Set(
      input.selectedTemplateFileIds
        ?.map((id: string) => id.trim())
        .filter(Boolean)
    );
    const selectedSmartFormIds = new Set(
      input.selectedSmartFormReferenceIds
        ?.map((id: string) => id.trim())
        .filter(Boolean)
    );
    const selectedFiles =
      selectedIds.size > 0
        ? files.filter((file) => selectedIds.has(file.id))
        : [];
    const selectedSmartForms =
      selectedSmartFormIds.size > 0
        ? smartForms.filter((item) => selectedSmartFormIds.has(item.id))
        : [];
    if (selectedIds.size > 0 && selectedFiles.length !== selectedIds.size) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "One or more selected template files are not available"
      );
    }
    if (
      selectedSmartFormIds.size > 0 &&
      selectedSmartForms.length !== selectedSmartFormIds.size
    ) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "One or more selected Smart Form references are not available"
      );
    }
    if (selectedFiles.length === 0 && selectedSmartForms.length === 0) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Project template has no files or Smart Forms to apply"
      );
    }
    return {
      template,
      targetNode: {
        id: targetNode.id,
        code: targetNode.code,
        title: targetNode.title,
        level: targetNode.level,
      },
      files: selectedFiles,
      smartForms: selectedSmartForms,
    };
  }

  private async buildProjectTemplateApplyPlan(
    tx: Pick<Prisma.TransactionClient, "workingPaper">,
    targetNode: ProjectTemplateApplyTarget,
    files: ProjectTemplateFileForApply[],
    smartForms: ProjectTemplateSmartFormForApply[],
    bucketOverride?: ApplyProjectTemplateInput["bucket"],
    referenceCodeOverrides?: ApplyProjectTemplateInput["referenceCodeOverrides"]
  ) {
    const existingPapers = await tx.workingPaper.findMany({
      where: { workflowNodeId: targetNode.id },
      select: {
        id: true,
        code: true,
        title: true,
        paperType: true,
        bucket: true,
        templateItemId: true,
      },
    });
    const plannedCodes = existingPapers.map((paper) => ({ code: paper.code }));
    const referenceCodeByItemId = new Map(
      (referenceCodeOverrides ?? []).map((item) => [item.itemId, item.code])
    );
    const plannedItems: ProjectTemplateApplyPlanItem[] = [];
    const plannedSmartFormItems: ProjectTemplateApplySmartFormPlanItem[] = [];
    const orderedItems = [
      ...files.map((item) => ({ type: "FILE" as const, item })),
      ...smartForms.map((item) => ({ type: "SMART_FORM" as const, item })),
    ].sort(
      (left, right) =>
        left.item.templateNodeId.localeCompare(right.item.templateNodeId) ||
        left.item.sortOrder - right.item.sortOrder ||
        left.item.code.localeCompare(right.item.code)
    );
    for (const orderedItem of orderedItems) {
      const source = orderedItem.item;
      const plannedCode =
        referenceCodeByItemId.get(source.id) ??
        buildNextWorkingPaperCode(targetNode.code, plannedCodes);
      assertAvailableReferenceCode(plannedCode, plannedCodes);
      plannedCodes.push({ code: plannedCode });
      if (orderedItem.type === "FILE") {
        const file = orderedItem.item;
        plannedItems.push({
          templateFileId: file.id,
          templateNodeId: file.templateNodeId,
          sourceCode: file.code,
          title: file.title,
          originalName: file.originalName,
          paperType: file.paperType,
          bucket: bucketOverride ?? "CURRENT",
          status: "CREATE",
          plannedCode,
          existingWorkingPaper: null,
        });
      } else {
        const smartForm = orderedItem.item;
        plannedSmartFormItems.push({
          smartFormReferenceId: smartForm.id,
          templateNodeId: smartForm.templateNodeId,
          sourceCode: smartForm.code,
          title: smartForm.title,
          originalName: normalizeSmartFormFileName(
            smartForm.fileName || smartForm.title
          ),
          paperType: PaperType.WORKING_PAPER,
          bucket: "CURRENT",
          status: "CREATE",
          plannedCode,
          existingWorkingPaper: null,
          smartFormTemplateVersionId: smartForm.smartFormTemplateVersionId,
        });
      }
    }
    const createFileCount = plannedItems.filter(
      (item) => item.status === "CREATE"
    ).length;
    const createSmartFormCount = plannedSmartFormItems.filter(
      (item) => item.status === "CREATE"
    ).length;
    const existingFileCount = plannedItems.filter(
      (item) => item.status === "EXISTS"
    ).length;
    const existingSmartFormCount = plannedSmartFormItems.filter(
      (item) => item.status === "EXISTS"
    ).length;
    return {
      summary: {
        total: plannedItems.length + plannedSmartFormItems.length,
        files: plannedItems.length,
        smartForms: plannedSmartFormItems.length,
        create: createFileCount + createSmartFormCount,
        existing: existingFileCount + existingSmartFormCount,
        createFiles: createFileCount,
        createSmartForms: createSmartFormCount,
        existingFiles: existingFileCount,
        existingSmartForms: existingSmartFormCount,
      },
      items: plannedItems,
      smartFormItems: plannedSmartFormItems,
    };
  }

  private async createTemplateFileRecord(
    templateId: string,
    node: { id: string; code: string },
    input: ProjectTemplateFileInput,
    stored: {
      fileName: string;
      objectKey: string;
      fileSize: number;
      mimeType: string;
      originalName?: string;
    }
  ) {
    const originalName =
      stored.originalName ??
      normalizeUploadedFileName(input.title || stored.fileName);
    const title = normalizeOptionalText(input.title) ?? originalName;
    try {
      return await this.withTemplateItemSequence(
        node.id,
        async (tx, sortOrder) => {
          await Promise.resolve();
          const code =
            normalizeOptionalText(input.code) ??
            buildTemplateFileCode(node.code, sortOrder);
          return tx.projectTemplateFile.create({
            data: {
              projectTemplateId: templateId,
              templateNodeId: node.id,
              code,
              title,
              fileName: stored.fileName,
              originalName,
              fileUrl: stored.objectKey,
              fileSize: stored.fileSize,
              mimeType: stored.mimeType,
              paperType: "WORKING_PAPER",
              sortOrder,
            },
          });
        }
      );
    } catch (error) {
      throwProjectTemplateDuplicateCode(error);
    }
  }

  private async requireTemplate(templateId: string) {
    const template = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, status: { not: "ARCHIVED" } },
    });
    if (!template) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template not found"
      );
    }
    return template;
  }

  private async requireFrameworkTemplate(frameworkTemplateId: string) {
    const frameworkTemplate = await this.prisma.frameworkTemplate.findFirst({
      where: { id: frameworkTemplateId, isActive: true },
      select: { id: true },
    });
    if (!frameworkTemplate) {
      throw new ApiBadRequestException(
        "FRAMEWORK_TEMPLATE_NOT_FOUND",
        "Applicable standard template is not available"
      );
    }
    return frameworkTemplate;
  }

  private async requireTemplateNode(templateId: string, nodeId: string) {
    const node = await this.prisma.projectTemplateNode.findFirst({
      where: { id: nodeId, projectTemplateId: templateId },
    });
    if (!node) {
      throw new ApiNotFoundException(
        "PROJECT_TEMPLATE_NOT_FOUND",
        "Project template folder not found"
      );
    }
    return node;
  }

  private async requireTemplateFolder(templateId: string, nodeId: string) {
    await this.requireTemplate(templateId);
    return this.requireTemplateNode(templateId, nodeId);
  }

  private async requireNumericTemplateNode(templateId: string, nodeId: string) {
    const node = await this.requireTemplateNode(templateId, nodeId);
    if (!isHierarchicalNumericFolderCode(node.code)) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Project template folder code must use the numeric project convention"
      );
    }
    return node;
  }

  private async nextNodeSortOrder(templateId: string, parentId: string | null) {
    const result = await this.prisma.projectTemplateNode.aggregate({
      where: { projectTemplateId: templateId, parentId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? 0) + 1;
  }

  private withTemplateItemSequence<T>(
    templateNodeId: string,
    create: (tx: Prisma.TransactionClient, sortOrder: number) => Promise<T>
  ) {
    return this.withTemplateItemLock(templateNodeId, async (tx) => {
      const sortOrder = await this.nextTemplateItemSortOrder(
        tx,
        templateNodeId
      );
      return create(tx, sortOrder);
    });
  }

  private async withTemplateItemLock<T>(
    templateNodeId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ) {
    await Promise.resolve();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`project-template-item:${templateNodeId}`}, 0)
        )
      `;
      return operation(tx);
    });
  }

  private async assertTemplateItemCodeAvailable(
    tx: Prisma.TransactionClient,
    templateNodeId: string,
    code: string,
    current: { type: "FILE" | "SMART_FORM"; id: string }
  ) {
    const [file, smartForm] = await Promise.all([
      tx.projectTemplateFile.findFirst({
        where: {
          templateNodeId,
          code,
          ...(current.type === "FILE" ? { id: { not: current.id } } : {}),
        },
        select: { id: true },
      }),
      tx.projectTemplateSmartForm.findFirst({
        where: {
          templateNodeId,
          code,
          ...(current.type === "SMART_FORM" ? { id: { not: current.id } } : {}),
        },
        select: { id: true },
      }),
    ]);
    if (file || smartForm) {
      throw new ApiBadRequestException(
        "DUPLICATE_CODE",
        "Project template item code already exists in this folder"
      );
    }
  }

  private async nextTemplateItemSortOrder(
    tx: Prisma.TransactionClient,
    templateNodeId: string
  ) {
    const [fileResult, smartFormResult] = await Promise.all([
      tx.projectTemplateFile.aggregate({
        where: { templateNodeId },
        _max: { sortOrder: true },
      }),
      tx.projectTemplateSmartForm.aggregate({
        where: { templateNodeId },
        _max: { sortOrder: true },
      }),
    ]);
    return (
      Math.max(
        fileResult?._max.sortOrder ?? 0,
        smartFormResult?._max.sortOrder ?? 0
      ) + 1
    );
  }

  private async assertTemplateObjectMatches(
    templateId: string,
    nodeId: string,
    objectKey: string,
    fileSize: number,
    mimeType: string
  ) {
    const normalized = normalizeConfirmedObjectKey(objectKey);
    const expectedPrefix = pathModule.posix.join(
      "project-templates",
      templateId,
      nodeId
    );
    if (!normalized || !normalized.startsWith(`${expectedPrefix}/`)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object does not belong to this project template folder"
      );
    }
    const metadata = await this.fileStorage().getObjectMetadata(normalized);
    if (metadata.contentLength !== fileSize) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object size does not match the template file metadata"
      );
    }
    if (
      mimeType &&
      metadata.contentType !== "application/octet-stream" &&
      metadata.contentType.toLowerCase() !== mimeType.toLowerCase()
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Uploaded object content type does not match the template file metadata"
      );
    }
    return normalized;
  }

  private requireSuperAdmin(user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super admins can edit project templates"
      );
    }
  }

  private projectAccess() {
    if (!this.access) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Project access service is not available"
      );
    }
    return this.access;
  }

  private auditLogger() {
    if (!this.auditLogs) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Audit log service is not available"
      );
    }
    return this.auditLogs;
  }

  private smartFormManager() {
    if (!this.smartForms) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Smart Form service is not available"
      );
    }
    return this.smartForms;
  }

  private async getProjectSmartFormLanguage(
    projectId: string
  ): Promise<SmartFormLocale> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { language: true },
    });
    return project?.language === "en-US" ? "en-US" : "zh-CN";
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }
}

function asWhereArray(
  input: Prisma.ProjectTemplateWhereInput | Prisma.ProjectTemplateWhereInput[]
): Prisma.ProjectTemplateWhereInput[] {
  return Array.isArray(input) ? input : [input];
}

async function parseProjectTemplateArchive(
  file: UploadedProjectTemplateFile,
  defaultFolderName: string
): Promise<ParsedProjectTemplateZip> {
  await Promise.resolve();
  if (isSevenZipUpload(file)) {
    return parseProjectTemplateSevenZip(file.buffer, defaultFolderName);
  }
  return parseProjectTemplateZip(file.buffer, defaultFolderName);
}

async function parseProjectTemplateZip(
  buffer: Buffer,
  defaultFolderName: string
): Promise<ParsedProjectTemplateZip> {
  if (!buffer?.length) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Please upload a zip or 7z file"
    );
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Project template zip is invalid"
    );
  }
  const folderPaths = new Set<string>();
  const fileEntries: RawProjectTemplateArchiveFile[] = [];
  for (const entry of Object.values(zip.files)) {
    const normalized = normalizeZipEntryPath(entry.name);
    if (!normalized || shouldIgnoreProjectTemplateZipEntry(normalized)) {
      continue;
    }
    if (entry.dir) {
      folderPaths.add(normalized);
      continue;
    }
    fileEntries.push({
      path: normalized,
      read: async () => Buffer.from(await entry.async("nodebuffer")),
    });
  }
  return normalizeProjectTemplateArchiveEntries(
    folderPaths,
    fileEntries,
    defaultFolderName
  );
}

async function parseProjectTemplateSevenZip(
  buffer: Buffer,
  defaultFolderName: string
): Promise<ParsedProjectTemplateZip> {
  if (!buffer?.length) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Please upload a zip or 7z file"
    );
  }
  const tempRoot = await mkdtemp(
    pathModule.join(tmpdir(), `projectwing-template-${randomUUID()}-`)
  );
  const archivePath = pathModule.join(tempRoot, "template.7z");
  const extractDir = pathModule.join(tempRoot, "extract");
  try {
    await mkdir(extractDir, { recursive: true });
    await writeFile(archivePath, buffer);
    const sevenZipPath = await ensureExecutableFile(path7za, "7za");
    try {
      await execFileAsync(
        sevenZipPath,
        ["x", "-y", `-o${extractDir}`, archivePath],
        {
          timeout: SEVEN_ZIP_EXTRACT_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        }
      );
    } catch {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Project template 7z archive is invalid"
      );
    }
    const entries = await collectExtractedArchiveEntries(extractDir);
    return normalizeProjectTemplateArchiveEntries(
      entries.folderPaths,
      entries.fileEntries,
      defaultFolderName
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function collectExtractedArchiveEntries(rootDir: string) {
  const folderPaths = new Set<string>();
  const fileEntries: RawProjectTemplateArchiveFile[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = pathModule.join(currentDir, entry.name);
      const archivePath = toArchivePath(pathModule.relative(rootDir, fullPath));
      const normalized = normalizeZipEntryPath(archivePath);
      if (!normalized || shouldIgnoreProjectTemplateZipEntry(normalized)) {
        continue;
      }
      if (entry.isDirectory()) {
        folderPaths.add(normalized);
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      fileEntries.push({
        path: normalized,
        read: () => readFile(fullPath),
      });
    }
  }

  await walk(rootDir);
  return { folderPaths, fileEntries };
}

async function normalizeProjectTemplateArchiveEntries(
  folderPaths: Set<string>,
  fileEntries: RawProjectTemplateArchiveFile[],
  defaultFolderName: string
): Promise<ParsedProjectTemplateZip> {
  if (folderPaths.size === 0 && fileEntries.length === 0) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      "Project template archive must contain at least one folder or file"
    );
  }
  if (fileEntries.length > MAX_PROJECT_TEMPLATE_ZIP_FILES) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      `Project template archive cannot contain more than ${MAX_PROJECT_TEMPLATE_ZIP_FILES} files`
    );
  }
  const completeFolderPaths = new Set<string>(folderPaths);
  const rootFileFolder = normalizeTemplateZipLabel(defaultFolderName);
  const normalizedFileEntries = fileEntries.map((entry) => {
    if (entry.path.includes("/")) {
      return entry;
    }
    completeFolderPaths.add(rootFileFolder);
    return {
      ...entry,
      path: `${rootFileFolder}/${entry.path}`,
    };
  });
  const filePathSet = new Set<string>();
  for (const folderPath of completeFolderPaths) {
    const segments = folderPath.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      completeFolderPaths.add(segments.slice(0, index).join("/"));
    }
  }
  for (const { path } of normalizedFileEntries) {
    const segments = path.split("/");
    filePathSet.add(path);
    for (let index = 1; index < segments.length; index += 1) {
      completeFolderPaths.add(segments.slice(0, index).join("/"));
    }
  }
  for (const folderPath of completeFolderPaths) {
    if (filePathSet.has(folderPath)) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        `Zip path ${folderPath} cannot be both a file and a folder`
      );
    }
  }
  let totalBytes = 0;
  const files: ParsedProjectTemplateZip["files"] = [];
  for (const { path, read } of sortZipFileEntries(normalizedFileEntries)) {
    const content = await read();
    if (content.length === 0) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        `Archive file ${path} is empty`
      );
    }
    totalBytes += content.length;
    if (totalBytes > MAX_PROJECT_TEMPLATE_ZIP_TOTAL_BYTES) {
      throw new ApiBadRequestException(
        "PROJECT_TEMPLATE_INVALID",
        "Project template archive is too large after extraction"
      );
    }
    const originalName = normalizeUploadedFileName(
      pathModule.posix.basename(path)
    );
    files.push({
      path,
      folderPath: pathModule.posix.dirname(path),
      originalName,
      content,
      mimeType: getMimeTypeForFileName(originalName),
    });
  }
  return {
    folders: [...completeFolderPaths].sort(compareZipPaths),
    files,
  };
}

function toArchivePath(filePath: string) {
  return filePath.split("\\").join("/");
}

function normalizeZipEntryPath(entryName: string) {
  const name = entryName.trim();
  if (!name) {
    return null;
  }
  if (
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.startsWith("../") ||
    name === ".."
  ) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      `Unsafe zip path ${entryName}`
    );
  }
  const withoutTrailingSlash = name.endsWith("/") ? name.slice(0, -1) : name;
  if (!withoutTrailingSlash) {
    return null;
  }
  const normalized = pathModule.posix.normalize(withoutTrailingSlash);
  if (
    normalized !== withoutTrailingSlash ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".."
  ) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      `Unsafe zip path ${entryName}`
    );
  }
  const hasEmptySegment = normalized
    .split("/")
    .some((segment) => !segment.trim());
  if (hasEmptySegment) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      `Unsafe zip path ${entryName}`
    );
  }
  return normalized;
}

function shouldIgnoreProjectTemplateZipEntry(entryPath: string) {
  const segments = entryPath.split("/");
  return (
    segments.includes("__MACOSX") ||
    segments.some((segment) => segment === ".DS_Store")
  );
}

function sortZipFileEntries<T extends { path: string }>(entries: T[]) {
  return [...entries].sort((left, right) =>
    compareZipPaths(left.path, right.path)
  );
}

function compareZipPaths(left: string, right: string) {
  const leftDepth = left.split("/").length;
  const rightDepth = right.split("/").length;
  return leftDepth - rightDepth || left.localeCompare(right);
}

function isSupportedArchiveUpload(
  file: UploadedProjectTemplateFile | undefined
) {
  return isZipUpload(file) || isSevenZipUpload(file);
}

function isZipUpload(file: UploadedProjectTemplateFile | undefined) {
  if (!file?.buffer?.length) {
    return false;
  }
  const fileName = file.originalname?.trim().toLowerCase() ?? "";
  const mimeType = file.mimetype?.trim().toLowerCase() ?? "";
  return (
    fileName.endsWith(".zip") || PROJECT_TEMPLATE_ZIP_MIME_TYPES.has(mimeType)
  );
}

function isSevenZipUpload(file: UploadedProjectTemplateFile | undefined) {
  if (!file?.buffer?.length) {
    return false;
  }
  const fileName = file.originalname?.trim().toLowerCase() ?? "";
  const mimeType = file.mimetype?.trim().toLowerCase() ?? "";
  return (
    fileName.endsWith(".7z") || PROJECT_TEMPLATE_7Z_MIME_TYPES.has(mimeType)
  );
}

function normalizeTemplateZipLabel(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      "Project template zip contains an invalid folder name"
    );
  }
  return normalized.slice(0, 255);
}

function buildImportedFolderCode(title: string) {
  return title.slice(0, 80);
}

function parseImportedFolderLabel(label: string) {
  const parts = label
    .split(/\s+-\s+|-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const title = parts[parts.length - 1] ?? "";
  if (parts.length < 2 || !hasDescriptiveFolderTitle(title)) {
    return { code: buildImportedFolderCode(label), title: label };
  }

  return {
    code: buildImportedFolderCode(parts.slice(0, -1).join("-")),
    title: normalizeTemplateZipLabel(title),
  };
}

function hasDescriptiveFolderTitle(value: string) {
  return /[^\d\s.-]/.test(value);
}

function getMimeTypeForFileName(fileName: string) {
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
    case ".csv": {
      return "text/csv";
    }
    case ".txt": {
      return "text/plain";
    }
    case ".zip": {
      return "application/zip";
    }
    default: {
      return "application/octet-stream";
    }
  }
}

const PROJECT_TEMPLATE_INCLUDE = {
  frameworkTemplate: true,
  nodes: {
    orderBy: [{ level: "asc" as const }, { sortOrder: "asc" as const }],
    include: {
      files: {
        orderBy: [{ sortOrder: "asc" as const }, { code: "asc" as const }],
      },
      smartForms: {
        orderBy: [{ sortOrder: "asc" as const }, { code: "asc" as const }],
        include: {
          smartFormTemplate: true,
          smartFormTemplateVersion: true,
        },
      },
    },
  },
  _count: {
    select: {
      nodes: true,
      files: true,
      smartForms: true,
    },
  },
};

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function throwProjectTemplateDuplicateCode(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiBadRequestException(
      "DUPLICATE_CODE",
      "Project template code already exists"
    );
  }
  throw error;
}

function normalizeUploadedFileName(fileName: string) {
  return pathModule.basename(fileName).trim() || "upload";
}

function startOfUtcDate(input: Date) {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

function assertAvailableReferenceCode(
  code: string,
  plannedCodes: { code: string }[]
) {
  const normalize = (value: string) =>
    isHierarchicalNumericWorkingPaperCode(value)
      ? value.trim().replaceAll(/\s+/g, "")
      : normalizeCodeWithoutDigitFour(value).trim().toLowerCase();
  const normalized = normalize(code);
  if (plannedCodes.some((item) => normalize(item.code) === normalized)) {
    throw new ApiBadRequestException(
      "DUPLICATE_CODE",
      "Workpaper reference code already exists"
    );
  }
}

function buildTemplateFileCode(nodeCode: string, sortOrder: number) {
  if (isHierarchicalNumericFolderCode(nodeCode)) {
    return `${normalizeHierarchicalNumericCode(nodeCode)}.${sortOrder}`;
  }
  return `${nodeCode}-F${formatNumberWithoutDigitFour(sortOrder, 3)}`;
}

function buildNumericTemplateItemCode(nodeCode: string, sequence: number) {
  if (!isHierarchicalNumericFolderCode(nodeCode)) {
    throw new ApiBadRequestException(
      "PROJECT_TEMPLATE_INVALID",
      "Project template folder code must use the numeric project convention"
    );
  }
  return `${normalizeHierarchicalNumericCode(nodeCode)}.${sequence}`;
}

function normalizeSmartFormFileName(value: string) {
  const normalized = value.trim();
  return normalized.toLowerCase().endsWith(".sf")
    ? normalized
    : `${normalized}.sf`;
}

function ensureFileExtension(value: string, extension: string) {
  const normalized = value.trim();
  return normalized.toLowerCase().endsWith(extension.toLowerCase())
    ? normalized
    : `${normalized.replace(/\.[^.]+$/, "")}${extension}`;
}

function getCreatableChildLevel(parentLevel: number | null) {
  if (parentLevel === null) {
    return 1;
  }
  if (parentLevel < 1) {
    return null;
  }
  return parentLevel + 1;
}

function getWorkflowNodeType(level: number) {
  if (level === 1) {
    return "PHASE";
  }
  if (level === 2) {
    return "ACCOUNT";
  }
  return "WORKING_PAPER";
}

function normalizeConfirmedObjectKey(objectKey: string) {
  if (
    !objectKey ||
    objectKey.startsWith("/") ||
    objectKey.includes("\\") ||
    pathModule.posix.normalize(objectKey) !== objectKey ||
    objectKey.startsWith("../") ||
    objectKey === ".."
  ) {
    return null;
  }
  return objectKey;
}
