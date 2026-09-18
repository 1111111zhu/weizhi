import { createHash, randomUUID } from "node:crypto";

import { Injectable, Logger, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ProjectRole,
  WorkflowNode,
  WorkflowNodeType,
} from "@prisma/client";
import type {
  ApplyProjectTemplateInput,
  AuditAreaCode,
  CreateProjectInput,
  InboxStructuredContent,
  CreateProjectInvitationInput,
  LinkProjectEngagementInput,
  MoveProjectPlacementInput,
  ProjectLanguage,
  SmartFormPackage,
  UpdateProjectInput,
} from "@project-wing/shared";
import {
  AUDIT_AREA_CODES,
  SMART_FORM_MIME_TYPE,
  STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY,
  SmartFormPackageSchema,
  canGlobalRoleCreateProject,
  canManageProjectLeadership,
  isProjectPermissionSubjectConsistent,
  compileSmartFormV2Definition,
  formatNumberWithoutDigitFour,
  getProjectInvitationEligibility,
  normalizeCodeWithoutDigitFour,
  validateSmartFormV2Response,
} from "@project-wing/shared";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiServiceUnavailableException,
} from "../common/api-error";
import {
  defaultDesktopPosition,
  findNextAvailableDesktopPosition,
} from "../desktop/desktop-layout";
import { InboxService } from "../inbox/inbox.service";
import { createInvitationToken, hashInvitationToken } from "../members/token";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { TmsTimesheetsService } from "../tms/tms-timesheets.service";
import { DEFAULT_WORKFLOW } from "../workflow/default-workflow";
import type { DefaultWorkflowNode } from "../workflow/default-workflow";
import { buildNextWorkingPaperCode } from "../workflow/working-paper-code";
import { ArchiveCheckService } from "./archive-check.service";
import { ArchiveJobService } from "./archive-job.service";
import { ProjectAccessService } from "./project-access.service";

const DEFAULT_DESKTOP_FOLDER_NAME = "Default";
const DEFAULT_PROJECT_INVITATION_EXPIRY_DAYS = 7;
const DEFAULT_WORKSPACE_NAME = "My Projects";
const PROJECT_CREATION_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;
const PROJECT_VISIBLE_STATUSES = [
  "ACTIVE",
  "PENDING_FINAL_CHECK",
  "ARCHIVED",
] as const;
const USER_SUMMARY_SELECT = { id: true, name: true, email: true } as const;
export const PROJECT_CMP_CLIENT_SELECT = {
  id: true,
  clientCode: true,
  nameZh: true,
  nameEn: true,
  status: true,
  clientPartnerPic: true,
  clientManagerMic: true,
} as const;
const PROJECT_CMP_CLIENT_DETAIL_SELECT = {
  ...PROJECT_CMP_CLIENT_SELECT,
  companyCode: true,
  companyIdentifierType: true,
  companyNumber: true,
  address: true,
  addresses: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      type: true,
      label: true,
      address: true,
      sortOrder: true,
    },
  },
  contacts: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      name: true,
      position: true,
      department: true,
      officePhone: true,
      mobile: true,
      email: true,
      remarks: true,
      sortOrder: true,
    },
  },
  website: true,
  yearEndDate: true,
  reportingGaap: true,
  hsicSectionCode: true,
  industryOtherDescription: true,
  placeOfIncorporation: true,
  incorporationYearMonth: true,
  listedOrPrivate: true,
  stockExchangeOrListingPlace: true,
  stockCode: true,
  groupName: true,
  group: {
    select: {
      id: true,
      groupCode: true,
      nameZh: true,
      nameEn: true,
      status: true,
    },
  },
  parentClientCode: true,
  parentHoldingCompanyName: true,
  subsidiariesOrAssociates: true,
  updatedAt: true,
} as const;
const PROJECT_CMP_ENGAGEMENT_SELECT = {
  id: true,
  clientId: true,
  engagementCode: true,
  serviceType: true,
  yearEndDate: true,
  reportDate: true,
  pic: true,
  mic: true,
  picUserId: true,
  micUserId: true,
  status: true,
} as const;
const PROJECT_CMP_ENGAGEMENT_DETAIL_SELECT = {
  ...PROJECT_CMP_ENGAGEMENT_SELECT,
  otherServiceDescription: true,
  deliverables: true,
  engagementDate: true,
  eqReviewer: true,
  updatedAt: true,
} as const;
const ATTACHMENT_USER_INCLUDE = {
  uploader: { select: USER_SUMMARY_SELECT },
  lockHolder: { select: USER_SUMMARY_SELECT },
  deletedByUser: { select: USER_SUMMARY_SELECT },
  restoredByUser: { select: USER_SUMMARY_SELECT },
  lastModifier: { select: USER_SUMMARY_SELECT },
} as const;

function hasConfirmationOfficeAccess(user: RequestUser) {
  return (
    user.globalRole === "SUPER_ADMIN" ||
    user.globalRole === "CONFIRMATION_OFFICER"
  );
}

type ProjectTemplateForCreate = Prisma.ProjectTemplateGetPayload<{
  include: {
    nodes: {
      include: {
        files: true;
        smartForms: {
          include: {
            smartFormTemplate: true;
            smartFormTemplateVersion: {
              include: { template: true };
            };
          };
        };
      };
    };
  };
}>;

type ProjectTemplateNodeForCreate = ProjectTemplateForCreate["nodes"][number];
type ProjectTemplateFileForApply =
  ProjectTemplateNodeForCreate["files"][number];
type ProjectTemplateSmartFormForCreate =
  ProjectTemplateNodeForCreate["smartForms"][number];
type ProjectTemplateItemForCreate =
  | { kind: "FILE"; item: ProjectTemplateFileForApply }
  | { kind: "SMART_FORM"; item: ProjectTemplateSmartFormForCreate };
type RollForwardSourceProject = Prisma.ProjectGetPayload<{
  include: {
    members: true;
    workflowNodes: true;
    workingPapers: true;
    attachments: {
      include: {
        versions: true;
        smartFormInstance: true;
      };
    };
  };
}>;
type ProjectTemplateNamedItem = { code: string; title: string };

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
  paperType: ProjectTemplateFileForApply["paperType"];
  bucket: NonNullable<ApplyProjectTemplateInput["bucket"]>;
  templateItemId: string | null;
};

type ProjectTemplateApplyPlanItem = {
  templateFileId: string;
  templateNodeId: string;
  fileCode: string;
  title: string;
  paperType: ProjectTemplateFileForApply["paperType"];
  bucket: NonNullable<ApplyProjectTemplateInput["bucket"]>;
  status: "CREATE" | "EXISTS";
  plannedCode: string | null;
  existingWorkingPaper: ExistingProjectTemplatePaper | null;
};

type InitialInvitationRecipient = {
  input: CreateProjectInvitationInput;
  recipient: {
    id: string;
    email: string;
    name: string;
    globalRole: RequestUser["globalRole"];
    status?: "ACTIVE" | "DISABLED";
    preferredLocale: string;
  };
};

type InitialInvitationEmailDelivery = {
  recipientId: string;
  recipientEmail: string;
  preferredLocale: string;
  title: string;
  body: string;
  contentKey: "PROJECT_INVITATION";
  contentParams: {
    actor: string;
    projectCode: string;
    projectName: string;
    role: ProjectRole;
  };
  actionUrl: string;
};

type ProjectCreationCodeSource = {
  projectCode: string;
  generateProjectCode?: boolean;
  cmpClientId?: string | null;
  cmpEngagementId?: string | null;
  engagementPicUserIds: string[];
  engagementMicUserIds: string[];
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly access: ProjectAccessService,
    private readonly archiveChecks: ArchiveCheckService,
    @Optional() private readonly inbox?: InboxService,
    @Optional() private readonly storage?: StorageService,
    @Optional() private readonly archiveJobs?: ArchiveJobService,
    @Optional() private readonly tmsTimesheets?: TmsTimesheetsService
  ) {}

  async list(user: RequestUser) {
    const projects = await this.prisma.project.findMany({
      where:
        user.globalRole === "SUPER_ADMIN"
          ? { status: { in: [...PROJECT_VISIBLE_STATUSES] } }
          : {
              status: { in: [...PROJECT_VISIBLE_STATUSES] },
              members: {
                some: {
                  userId: user.id,
                  status: "ACTIVE",
                },
              },
            },
      orderBy: { createdAt: "desc" },
      include: {
        cmpClient: { select: PROJECT_CMP_CLIENT_SELECT },
        cmpEngagement: { select: PROJECT_CMP_ENGAGEMENT_SELECT },
        frameworkTemplate: true,
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: { id: true, name: true, email: true, globalRole: true },
            },
          },
        },
        desktopPlacements: {
          where: { userId: user.id },
          include: { folder: true },
        },
      },
    });
    return projects.map((project) => this.withDesktopFolder(project));
  }

  async listDeleted(user: RequestUser) {
    const projects = await this.prisma.project.findMany({
      where:
        user.globalRole === "SUPER_ADMIN"
          ? { status: "DELETED" }
          : {
              status: "DELETED",
              members: {
                some: {
                  userId: user.id,
                  status: "ACTIVE",
                },
              },
            },
      orderBy: { updatedAt: "desc" },
      include: {
        cmpClient: { select: PROJECT_CMP_CLIENT_SELECT },
        cmpEngagement: { select: PROJECT_CMP_ENGAGEMENT_SELECT },
        frameworkTemplate: true,
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: { id: true, name: true, email: true, globalRole: true },
            },
          },
        },
        desktopPlacements: {
          where: { userId: user.id },
          include: { folder: true },
        },
      },
    });
    return projects.map((project) => this.withDesktopFolder(project));
  }

  async get(projectId: string, user: RequestUser) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId, status: { in: [...PROJECT_VISIBLE_STATUSES] } },
      include: {
        cmpClient: { select: PROJECT_CMP_CLIENT_DETAIL_SELECT },
        cmpEngagement: { select: PROJECT_CMP_ENGAGEMENT_DETAIL_SELECT },
        frameworkTemplate: true,
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: { id: true, name: true, email: true, globalRole: true },
            },
          },
        },
        desktopPlacements: {
          where: { userId: user.id },
          include: { folder: true },
        },
      },
    });
    return this.withDesktopFolder(project);
  }

  archiveCheck(projectId: string, user: RequestUser) {
    return this.archiveChecks.report(projectId, user);
  }

  exportArchiveCheck(projectId: string, user: RequestUser) {
    return this.archiveChecks.exportReportPdf(projectId, user);
  }

  startArchiveCheckJob(projectId: string, user: RequestUser) {
    return this.archiveChecks.startJob(projectId, user);
  }

  archiveCheckJob(projectId: string, jobId: string, user: RequestUser) {
    return this.archiveChecks.getJob(projectId, jobId, user);
  }

  startArchiveJob(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    return this.confirmArchive(projectId, user, source);
  }

  archiveJob(projectId: string, jobId: string, user: RequestUser) {
    return this.archiveJobService().getJob(projectId, jobId, user);
  }

  subscribeArchiveJob(
    jobId: string,
    listener: Parameters<ArchiveJobService["subscribeJob"]>[1]
  ) {
    return this.archiveJobService().subscribeJob(jobId, listener);
  }

  archiveArtifact(projectId: string, user: RequestUser) {
    return this.archiveJobService().latestArtifact(projectId, user);
  }

  downloadArchiveArtifact(projectId: string, user: RequestUser) {
    return this.archiveJobService().downloadLatestArtifact(projectId, user);
  }

  async rollForwardPreview(projectId: string, user: RequestUser) {
    const source = await this.requireRollForwardSource(projectId, user);
    return {
      project: this.withDesktopFolder(source),
      summary: buildRollForwardSummary(source),
      reset: {
        signoffs: true,
        reviewQuestions: true,
        locks: true,
        archiveArtifacts: true,
        auditLogs: true,
      },
      retained: {
        workflow: true,
        workingPapers: true,
        attachments: true,
        attachmentVersions: true,
        smartFormAnswers: true,
      },
    };
  }

  async create(
    input: CreateProjectInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    if (!canGlobalRoleCreateProject(user.globalRole)) {
      throw new ApiForbiddenException("FORBIDDEN", "当前角色不能创建项目");
    }

    const workspace = await this.ensureDefaultWorkspace(user);
    const { id: workspaceId } = workspace;
    if (input.rollForwardFromProjectId?.trim()) {
      return this.createRollForwardProject(input, user, workspaceId, source);
    }
    const accountingStandard =
      await this.resolveApplicableAccountingStandard(input);
    const codeSource = await this.resolveProjectCreationCodeSource(input);
    const projectTemplate = await this.resolveProjectTemplate(input);
    const selectedAuditAreaCodes = this.resolveWizardAuditAreaCodes(
      input,
      projectTemplate
    );
    const filterAuditAreas =
      input.industryCode !== undefined || input.auditAreaCodes !== undefined;
    const ownerId = input.ownerId ?? user.id;
    const projectRole = this.globalRoleToProjectRole(user.globalRole);
    let initialInvitationEmailDeliveries: InitialInvitationEmailDelivery[] = [];
    const project = await this.prisma.$transaction(async (tx) => {
      const initialInvitations = await this.resolveInitialInvitationRecipients(
        input.invitations ?? [],
        ownerId,
        [
          ...codeSource.engagementMicUserIds,
          ...codeSource.engagementPicUserIds,
        ],
        tx
      );
      const { projectCode } = codeSource;
      const createProject = (nextProjectCode: string) =>
        tx.project.create({
          data: {
            workspaceId,
            name: input.name,
            projectCode: nextProjectCode,
            cmpClientId: codeSource.cmpClientId ?? null,
            cmpEngagementId: codeSource.cmpEngagementId ?? null,
            industryCode: input.industryCode,
            industrySourceText: input.industrySourceText || null,
            auditAreaCodes: selectedAuditAreaCodes,
            language: input.language,
            frameworkTemplateId: accountingStandard.frameworkTemplateId,
            applicableAccountingStandard: accountingStandard.value,
            reportingDate: new Date(input.reportDate),
            yearEndDate: new Date(input.yearEndDate),
            reportDate: new Date(input.reportDate),
            archiveDeadline: new Date(input.archiveDeadline),
            ownerId,
            notes: input.notes,
            archivePassword: input.archivePassword,
          },
        });
      try {
        const created = await createProject(projectCode);
        const normalizedCreated =
          codeSource.generateProjectCode &&
          typeof created.projectNumber === "number"
            ? await tx.project.update({
                where: { id: created.id },
                data: {
                  projectCode: createGeneratedEmpProjectCode(
                    created.projectNumber
                  ),
                },
              })
            : created;
        await this.createInitialProjectMembers(
          tx,
          normalizedCreated.id,
          ownerId,
          projectRole,
          user.globalRole,
          codeSource
        );
        const desktopFolder = await this.resolveDesktopFolder(
          tx,
          ownerId,
          input.folderId
        );
        const occupiedDesktopPlacements =
          await tx.desktopProjectPlacement.findMany({
            where: {
              userId: ownerId,
              folderId: desktopFolder.id,
            },
            select: { desktopX: true, desktopY: true },
          });
        const desktopPosition = findNextAvailableDesktopPosition(
          defaultDesktopPosition(occupiedDesktopPlacements.length),
          occupiedDesktopPlacements
        );
        await tx.desktopProjectPlacement.upsert({
          where: {
            userId_projectId: {
              userId: ownerId,
              projectId: normalizedCreated.id,
            },
          },
          update: {
            folderId: desktopFolder.id,
          },
          create: {
            userId: ownerId,
            projectId: normalizedCreated.id,
            folderId: desktopFolder.id,
            desktopX: desktopPosition.desktopX,
            desktopY: desktopPosition.desktopY,
            sortOrder: occupiedDesktopPlacements.length,
          },
        });
        await this.initializeProjectWorkflow(
          tx,
          normalizedCreated.id,
          user.id,
          projectTemplate,
          input.language,
          selectedAuditAreaCodes,
          filterAuditAreas
        );
        initialInvitationEmailDeliveries = await this.createInitialInvitations(
          tx,
          {
            id: normalizedCreated.id,
            projectCode: normalizedCreated.projectCode,
            name: normalizedCreated.name,
          },
          initialInvitations,
          user
        );
        return normalizedCreated;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "项目代码已存在"
          );
        }
        throw error;
      }
    }, PROJECT_CREATION_TRANSACTION_OPTIONS);

    await this.deliverInitialInvitationEmails(initialInvitationEmailDeliveries);
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CREATED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `创建项目 ${project.projectCode}`,
      source,
    });
    return this.get(project.id, user);
  }

  private async resolveProjectCreationCodeSource(
    input: CreateProjectInput
  ): Promise<ProjectCreationCodeSource> {
    const projectCode = input.projectCode?.trim();
    const cmpClientId = input.cmpClientId?.trim();
    const cmpEngagementId = input.cmpEngagementId?.trim();
    if (!cmpClientId && !cmpEngagementId) {
      const independentPicUserIds = normalizeProjectLeadUserIds(
        input.projectPicUserIds,
        input.projectPicUserId
      );
      const independentMicUserIds = normalizeProjectLeadUserIds(
        input.projectMicUserIds,
        input.projectMicUserId
      );
      return {
        projectCode: projectCode || createUnlinkedProjectCode(),
        generateProjectCode: !projectCode,
        engagementPicUserIds: await this.validateProjectLeadUserIds(
          independentPicUserIds,
          ["PARTNER", "PRINCIPAL"],
          "Project PIC must be an active Partner or Principal"
        ),
        engagementMicUserIds: await this.validateProjectLeadUserIds(
          independentMicUserIds,
          ["MANAGER"],
          "Project MIC must be an active Manager"
        ),
      };
    }

    if (!cmpClientId || !cmpEngagementId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select both a CMP client and an active engagement"
      );
    }

    const engagement = await this.prisma.cmpEngagement.findFirst({
      where: {
        id: cmpEngagementId,
        clientId: cmpClientId,
        status: "ACTIVE",
        client: { status: "ACTIVE" },
      },
      select: {
        id: true,
        clientId: true,
        engagementCode: true,
        picUserId: true,
        micUserId: true,
        picUser: { select: { status: true, globalRole: true } },
        micUser: { select: { status: true, globalRole: true } },
      },
    });
    if (!engagement) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only active CMP engagements under an active client can create EMS projects"
      );
    }
    if (
      !engagement.picUserId ||
      engagement.picUser?.status !== "ACTIVE" ||
      !["PARTNER", "PRINCIPAL"].includes(
        engagement.picUser?.globalRole ?? ""
      ) ||
      !engagement.micUserId ||
      engagement.micUser?.status !== "ACTIVE" ||
      !["MANAGER"].includes(engagement.micUser?.globalRole ?? "")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select active PIC and MIC users in CMP before creating an EMS project"
      );
    }

    const hasPicArray = input.projectPicUserIds !== undefined;
    const hasMicArray = input.projectMicUserIds !== undefined;
    const overridePicUserId = input.projectPicUserId?.trim();
    const selectedPicUserIds = hasPicArray
      ? normalizeProjectLeadUserIds(input.projectPicUserIds)
      : overridePicUserId
        ? [overridePicUserId]
        : [engagement.picUserId];
    const selectedMicUserIds = hasMicArray
      ? normalizeProjectLeadUserIds(input.projectMicUserIds)
      : [engagement.micUserId];

    if (hasPicArray && selectedPicUserIds.length === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select at least one active project PIC"
      );
    }
    if (hasMicArray && selectedMicUserIds.length === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select at least one active project MIC"
      );
    }

    return {
      projectCode: projectCode || createUnlinkedProjectCode(),
      generateProjectCode: !projectCode,
      cmpClientId: engagement.clientId,
      cmpEngagementId: engagement.id,
      engagementPicUserIds: await this.validateProjectLeadUserIds(
        selectedPicUserIds,
        ["PARTNER", "PRINCIPAL"],
        "Project PIC must be an active Partner or Principal",
        hasPicArray ? undefined : overridePicUserId ? undefined : [
          engagement.picUserId,
        ]
      ),
      engagementMicUserIds: hasMicArray
        ? await this.validateProjectLeadUserIds(
            selectedMicUserIds,
            ["MANAGER"],
            "Project MIC must be an active Manager"
          )
        : [engagement.micUserId],
    };
  }

  private async validateProjectLeadUserIds(
    userIds: string[],
    allowedGlobalRoles: readonly string[],
    message: string,
    alreadyValidatedIds: string[] = []
  ) {
    const validated = new Set(alreadyValidatedIds);
    for (const userId of userIds) {
      if (validated.has(userId)) {
        continue;
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, globalRole: true },
      });
      if (
        !user ||
        user.status !== "ACTIVE" ||
        !allowedGlobalRoles.includes(user.globalRole)
      ) {
        throw new ApiBadRequestException("VALIDATION_FAILED", message);
      }
      validated.add(user.id);
    }
    return [...validated];
  }

  private async createInitialProjectMembers(
    tx: Prisma.TransactionClient,
    projectId: string,
    ownerId: string,
    ownerProjectRole: Prisma.ProjectMemberCreateManyInput["projectRole"],
    ownerGlobalRole: RequestUser["globalRole"],
    codeSource: ProjectCreationCodeSource
  ) {
    const members = new Map<
      string,
      {
        userId: string;
        projectRole: Prisma.ProjectMemberCreateManyInput["projectRole"];
        inChargeRole?: Prisma.ProjectMemberCreateManyInput["inChargeRole"];
      }
    >([
      [
        ownerId,
        {
          userId: ownerId,
          projectRole: ownerProjectRole,
          ...(ownerGlobalRole === "PARTNER" &&
          codeSource.engagementPicUserIds.length === 0
            ? { inChargeRole: "PARTNER_IN_CHARGE" }
            : {}),
        },
      ],
    ]);
    for (const userId of codeSource.engagementMicUserIds) {
      members.set(userId, {
        userId,
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      });
    }
    for (const userId of codeSource.engagementPicUserIds) {
      members.set(userId, {
        userId,
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      });
    }
    for (const member of members.values()) {
      await tx.projectMember.create({
        data: {
          ...member,
          projectId,
        },
      });
    }
  }

  private async createRollForwardProject(
    input: CreateProjectInput,
    user: RequestUser,
    workspaceId: string,
    source?: AuditLogSource
  ) {
    const sourceProjectId = input.rollForwardFromProjectId?.trim();
    if (!sourceProjectId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Choose an archived source project before rolling forward"
      );
    }
    const sourceProject = await this.requireRollForwardSource(
      sourceProjectId,
      user
    );
    const accountingStandard =
      await this.resolveApplicableAccountingStandard(input);
    const codeSource = await this.resolveProjectCreationCodeSource(input);
    const ownerId = input.ownerId ?? user.id;
    const projectRole = this.globalRoleToProjectRole(user.globalRole);
    let initialInvitationEmailDeliveries: InitialInvitationEmailDelivery[] = [];
    const project = await this.prisma.$transaction(async (tx) => {
      const inheritedMembers =
        input.inheritMembers === false
          ? []
          : sourceProject.members.filter(
              (member) =>
                member.status === "ACTIVE" && member.userId !== ownerId
            );
      const directMemberIds = new Set(
        [
          ownerId,
          ...codeSource.engagementPicUserIds,
          ...codeSource.engagementMicUserIds,
          ...inheritedMembers.map((member) => member.userId),
        ].filter((id): id is string => Boolean(id))
      );
      const initialInvitations = await this.resolveInitialInvitationRecipients(
        input.invitations ?? [],
        ownerId,
        [...directMemberIds],
        tx
      );
      const { projectCode } = codeSource;
      try {
        const created = await tx.project.create({
          data: {
            workspaceId,
            name: input.name,
            projectCode,
            cmpClientId: codeSource.cmpClientId ?? null,
            cmpEngagementId: codeSource.cmpEngagementId ?? null,
            language: input.language,
            frameworkTemplateId: accountingStandard.frameworkTemplateId,
            applicableAccountingStandard: accountingStandard.value,
            reportingDate: new Date(input.reportDate),
            yearEndDate: new Date(input.yearEndDate),
            reportDate: new Date(input.reportDate),
            archiveDeadline: new Date(input.archiveDeadline),
            ownerId,
            rolledForwardFromProjectId: sourceProject.id,
            notes: input.notes,
            archivePassword: input.archivePassword,
          },
        });
        const normalizedCreated =
          codeSource.generateProjectCode &&
          typeof created.projectNumber === "number"
            ? await tx.project.update({
                where: { id: created.id },
                data: {
                  projectCode: createGeneratedEmpProjectCode(
                    created.projectNumber
                  ),
                },
              })
            : created;
        await this.createInitialProjectMembers(
          tx,
          normalizedCreated.id,
          ownerId,
          projectRole,
          user.globalRole,
          codeSource
        );
        if (input.inheritMembers !== false) {
          const selectedLeadIds = new Set([
            ...codeSource.engagementPicUserIds,
            ...codeSource.engagementMicUserIds,
          ]);
          for (const member of sourceProject.members) {
            if (
              member.status !== "ACTIVE" ||
              member.userId === ownerId ||
              selectedLeadIds.has(member.userId)
            ) {
              continue;
            }
            await tx.projectMember.create({
              data: {
                projectId: normalizedCreated.id,
                userId: member.userId,
                projectRole: member.projectRole,
                inChargeRole: member.inChargeRole,
                status: "ACTIVE",
              },
            });
          }
        }
        const desktopFolder = await this.resolveDesktopFolder(
          tx,
          ownerId,
          input.folderId
        );
        const occupiedDesktopPlacements =
          await tx.desktopProjectPlacement.findMany({
            where: {
              userId: ownerId,
              folderId: desktopFolder.id,
            },
            select: { desktopX: true, desktopY: true },
          });
        const desktopPosition = findNextAvailableDesktopPosition(
          defaultDesktopPosition(occupiedDesktopPlacements.length),
          occupiedDesktopPlacements
        );
        await tx.desktopProjectPlacement.upsert({
          where: {
            userId_projectId: {
              userId: ownerId,
              projectId: normalizedCreated.id,
            },
          },
          update: {
            folderId: desktopFolder.id,
          },
          create: {
            userId: ownerId,
            projectId: normalizedCreated.id,
            folderId: desktopFolder.id,
            desktopX: desktopPosition.desktopX,
            desktopY: desktopPosition.desktopY,
            sortOrder: occupiedDesktopPlacements.length,
          },
        });
        await this.copyRollForwardContent(
          tx,
          sourceProject,
          normalizedCreated.id,
          user.id
        );
        initialInvitationEmailDeliveries = await this.createInitialInvitations(
          tx,
          {
            id: normalizedCreated.id,
            projectCode: normalizedCreated.projectCode,
            name: normalizedCreated.name,
          },
          initialInvitations,
          user
        );
        return normalizedCreated;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Project code already exists"
          );
        }
        throw error;
      }
    }, PROJECT_CREATION_TRANSACTION_OPTIONS);

    await this.deliverInitialInvitationEmails(initialInvitationEmailDeliveries);
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CREATED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Created project ${project.projectCode}`,
      source,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_ROLLED_FORWARD",
      targetType: "PROJECT",
      targetId: sourceProject.id,
      projectId: project.id,
      description: `Rolled forward ${sourceProject.projectCode} into ${project.projectCode}`,
      source,
    });
    return this.get(project.id, user);
  }

  private async requireRollForwardSource(
    projectId: string,
    user: RequestUser
  ): Promise<RollForwardSourceProject> {
    const source = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        status: "ARCHIVED",
        ...(user.globalRole === "SUPER_ADMIN"
          ? {}
          : {
              members: {
                some: { userId: user.id, status: "ACTIVE" },
              },
            }),
      },
      include: {
        members: { where: { status: "ACTIVE" } },
        workflowNodes: { orderBy: [{ level: "asc" }, { sortOrder: "asc" }] },
        workingPapers: { orderBy: [{ createdAt: "asc" }] },
        attachments: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "asc" }],
          include: {
            versions: { orderBy: [{ version: "asc" }] },
            smartFormInstance: true,
          },
        },
      },
    });
    if (!source) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only accessible archived projects can be rolled forward"
      );
    }
    return source;
  }

  private async copyRollForwardContent(
    tx: Prisma.TransactionClient,
    sourceProject: RollForwardSourceProject,
    targetProjectId: string,
    actorId: string
  ) {
    const nodeIdMap = new Map<string, string>();
    const paperIdMap = new Map<string, string>();
    const attachmentIdMap = new Map<string, string>();
    const versionIdMap = new Map<string, string>();

    for (const node of sourceProject.workflowNodes) {
      const created = await tx.workflowNode.create({
        data: {
          projectId: targetProjectId,
          parentId: node.parentId
            ? (nodeIdMap.get(node.parentId) ?? null)
            : null,
          level: node.level,
          code: node.code,
          title: node.title,
          nodeType: node.nodeType,
          sortOrder: node.sortOrder,
          createdBy: actorId,
        },
      });
      nodeIdMap.set(node.id, created.id);
    }

    for (const paper of sourceProject.workingPapers) {
      const workflowNodeId = nodeIdMap.get(paper.workflowNodeId);
      if (!workflowNodeId) {
        continue;
      }
      const created = await tx.workingPaper.create({
        data: {
          projectId: targetProjectId,
          workflowNodeId,
          code: paper.code,
          title: paper.title,
          paperType: paper.paperType,
          bucket: "PRIOR",
          templateItemId: paper.templateItemId,
          createdBy: actorId,
        },
      });
      paperIdMap.set(paper.id, created.id);
    }

    for (const attachment of sourceProject.attachments) {
      const workingPaperId = attachment.workingPaperId
        ? (paperIdMap.get(attachment.workingPaperId) ?? null)
        : null;
      const workflowNodeId = attachment.workflowNodeId
        ? (nodeIdMap.get(attachment.workflowNodeId) ?? null)
        : null;
      const storagePaperId =
        workingPaperId ?? workflowNodeId ?? `roll-forward-${targetProjectId}`;
      const sourceHeadVersion =
        attachment.versions.find(
          (version) => version.id === attachment.headVersionId
        ) ??
        attachment.versions.find((version) => version.isCurrent) ??
        attachment.versions.at(-1);
      const headStored = await this.fileStorage().copyObjectToWorkingPaper(
        targetProjectId,
        storagePaperId,
        sourceHeadVersion?.originalName ??
          attachment.originalName ??
          attachment.fileName,
        sourceHeadVersion?.fileUrl ?? attachment.fileUrl,
        sourceHeadVersion?.mimeType ?? attachment.mimeType
      );
      const createdAttachment = await tx.attachment.create({
        data: {
          projectId: targetProjectId,
          workingPaperId,
          workflowNodeId,
          bucket: "PRIOR",
          code: attachment.code,
          title: attachment.title,
          templateItemId: attachment.templateItemId,
          fileKind: attachment.fileKind,
          fileName:
            sourceHeadVersion?.fileName ??
            attachment.fileName ??
            headStored.fileName,
          originalName: attachment.originalName,
          fileUrl: headStored.objectKey,
          fileSize: sourceHeadVersion?.fileSize ?? attachment.fileSize,
          mimeType: sourceHeadVersion?.mimeType ?? attachment.mimeType,
          version: attachment.version,
          workDate: attachment.workDate,
          uploadedBy: actorId,
          lastModifiedBy: actorId,
          lastModifiedAt: new Date(),
        },
      });
      attachmentIdMap.set(attachment.id, createdAttachment.id);

      let copiedHeadVersionId: string | null = null;
      for (const version of attachment.versions) {
        const stored =
          version.id === sourceHeadVersion?.id
            ? headStored
            : await this.fileStorage().copyObjectToWorkingPaper(
                targetProjectId,
                storagePaperId,
                version.originalName ?? version.fileName,
                version.fileUrl,
                version.mimeType
              );
        const createdVersion = await tx.attachmentVersion.create({
          data: {
            attachmentId: createdAttachment.id,
            projectId: targetProjectId,
            version: version.version,
            parentVersionId: version.parentVersionId
              ? (versionIdMap.get(version.parentVersionId) ?? null)
              : null,
            sourceVersionId: null,
            fileKind: version.fileKind,
            fileName: version.fileName ?? stored.fileName,
            originalName: version.originalName,
            fileUrl: stored.objectKey,
            fileSize: version.fileSize,
            mimeType: version.mimeType,
            workDate: version.workDate,
            uploadedBy: version.uploadedBy,
            uploadedAt: version.uploadedAt,
            archivedBy: version.archivedBy,
            action: version.action,
            message: version.message,
            isCurrent: version.id === sourceHeadVersion?.id,
          },
        });
        versionIdMap.set(version.id, createdVersion.id);
        if (version.id === sourceHeadVersion?.id) {
          copiedHeadVersionId = createdVersion.id;
        }
      }

      if (copiedHeadVersionId) {
        await tx.attachment.update({
          where: { id: createdAttachment.id },
          data: { headVersionId: copiedHeadVersionId },
        });
      }

      if (attachment.smartFormInstance) {
        await tx.smartFormInstance.create({
          data: {
            projectId: targetProjectId,
            attachmentId: createdAttachment.id,
            smartFormTemplateId:
              attachment.smartFormInstance.smartFormTemplateId,
            smartFormTemplateVersionId:
              attachment.smartFormInstance.smartFormTemplateVersionId,
            schemaHash: attachment.smartFormInstance.schemaHash,
            answerHash: attachment.smartFormInstance.answerHash,
            status: attachment.smartFormInstance.status,
            completedAt: attachment.smartFormInstance.completedAt,
            lastSavedBy: attachment.smartFormInstance.lastSavedBy,
            lastSavedAt: attachment.smartFormInstance.lastSavedAt,
          },
        });
      }
    }

    return { nodeIdMap, paperIdMap, attachmentIdMap, versionIdMap };
  }

  private async resolveInitialInvitationRecipients(
    invitations: CreateProjectInvitationInput[],
    ownerId: string,
    excludedRecipientIds: string[] = [],
    client: Pick<Prisma.TransactionClient, "user"> = this.prisma
  ): Promise<InitialInvitationRecipient[]> {
    if (invitations.length === 0) {
      return [];
    }

    const normalized = invitations.map((invitation) => ({
      ...invitation,
      recipientUserId: invitation.recipientUserId.trim(),
      expiresInDays:
        invitation.expiresInDays ?? DEFAULT_PROJECT_INVITATION_EXPIRY_DAYS,
    }));
    const recipientIds = [];
    const seenRecipientIds = new Set<string>();
    for (const invitation of normalized) {
      if (!invitation.recipientUserId) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "请选择有效的收件人"
        );
      }
      if (seenRecipientIds.has(invitation.recipientUserId)) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "请勿重复邀请同一成员"
        );
      }
      if (
        invitation.recipientUserId === ownerId ||
        excludedRecipientIds.includes(invitation.recipientUserId)
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "该成员已作为项目负责人加入项目，无需重复邀请"
        );
      }
      seenRecipientIds.add(invitation.recipientUserId);
      recipientIds.push(invitation.recipientUserId);
    }

    const recipients = await client.user.findMany({
      where: {
        id: { in: recipientIds },
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
        preferredLocale: true,
      },
    });
    const recipientById = new Map(
      recipients.map((recipient) => [recipient.id, recipient])
    );
    if (recipientById.size !== recipientIds.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "请选择有效的收件人"
      );
    }

    return normalized.map((invitation) => {
      const recipient = recipientById.get(invitation.recipientUserId);
      if (!recipient) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "请选择有效的收件人"
        );
      }
      const eligibility = getProjectInvitationEligibility(recipient);
      if (
        !eligibility.canReceiveInvitation ||
        !eligibility.assignableProjectRoles.includes(invitation.invitedRole)
      ) {
        throw new ApiBadRequestException(
          "INVALID_PROJECT_ROLE",
          "该账号职级不能被邀请为所选项目职责"
        );
      }
      return { input: invitation, recipient };
    });
  }

  private async createInitialInvitations(
    tx: Prisma.TransactionClient,
    project: { id: string; projectCode: string; name: string },
    invitations: InitialInvitationRecipient[],
    user: RequestUser
  ) {
    const deliveries: InitialInvitationEmailDelivery[] = [];
    for (const invitation of invitations) {
      const token = createInvitationToken();
      const expiresAt = new Date(
        Date.now() +
          (invitation.input.expiresInDays ??
            DEFAULT_PROJECT_INVITATION_EXPIRY_DAYS) *
            24 *
            60 *
            60 *
            1000
      );
      const created = await tx.projectInvitation.create({
        data: {
          projectId: project.id,
          tokenHash: hashInvitationToken(token),
          recipientEmail: invitation.recipient.email,
          invitedRole: invitation.input.invitedRole,
          invitedBy: user.id,
          expiresAt,
        },
      });

      const content = {
        contentKey: "PROJECT_INVITATION",
        contentParams: {
          actor: user.name,
          projectCode: project.projectCode,
          projectName: project.name,
          role: invitation.input.invitedRole,
        },
      } satisfies InboxStructuredContent;

      await tx.inboxMessage.create({
        data: {
          recipientId: invitation.recipient.id,
          senderId: user.id,
          projectInvitationId: created.id,
          projectId: project.id,
          type: "PROJECT_INVITATION",
          title: `${user.name} 邀请你加入审计项目`,
          body: `${project.projectCode} ${project.name}，项目职责：${invitation.input.invitedRole}`,
          ...content,
          actionUrl: `/invitations/${token}`,
        },
      });
      deliveries.push({
        recipientId: invitation.recipient.id,
        recipientEmail: invitation.recipient.email,
        preferredLocale: invitation.recipient.preferredLocale,
        title: `${user.name} 邀请你加入审计项目`,
        body: `${project.projectCode} ${project.name}，项目职责：${invitation.input.invitedRole}`,
        contentKey: "PROJECT_INVITATION",
        contentParams: {
          actor: user.name,
          projectCode: project.projectCode,
          projectName: project.name,
          role: invitation.input.invitedRole,
        },
        actionUrl: `/invitations/${token}`,
      });
    }
    return deliveries;
  }

  private async deliverInitialInvitationEmails(
    deliveries: InitialInvitationEmailDelivery[]
  ) {
    const { inbox } = this;
    if (
      !inbox ||
      !deliveries.length ||
      typeof inbox.deliverMessageEmail !== "function"
    ) {
      return;
    }
    await Promise.all(
      deliveries.map((delivery) => inbox.deliverMessageEmail(delivery))
    );
  }

  async previewApplyProjectTemplate(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput,
    user: RequestUser
  ) {
    await this.access.requireProjectAction(projectId, user.id, "useLibrary");
    await this.access.requireProjectRole(projectId, user.id, "PREPARER");
    const { template, targetNode } =
      await this.requireProjectTemplateApplyContext(
        projectId,
        templateId,
        input
      );
    const selectedFiles = selectProjectTemplateFiles(
      template,
      input.selectedTemplateFileIds
    );
    const plan = await this.buildProjectTemplateApplyPlan(
      this.prisma,
      targetNode,
      selectedFiles,
      input.bucket
    );
    return { template, targetNode, plan };
  }

  async applyProjectTemplate(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "useLibrary");
    await this.access.requireProjectRole(projectId, user.id, "PREPARER");
    const { template, targetNode } =
      await this.requireProjectTemplateApplyContext(
        projectId,
        templateId,
        input
      );
    const selectedFiles = selectProjectTemplateFiles(
      template,
      input.selectedTemplateFileIds
    );
    const selectedFileById = new Map(
      selectedFiles.map((file) => [file.id, file])
    );

    try {
      const { createdPapers, createdWorkflowNodes, applyPlan } =
        await this.prisma.$transaction(async (tx) => {
          const templateApplyPlan = await this.buildProjectTemplateApplyPlan(
            tx,
            targetNode,
            selectedFiles,
            input.bucket
          );
          const createdNodes =
            selectedFiles.length === 0 && isFolderOnlyProjectTemplate(template)
              ? await this.applyFolderOnlyProjectTemplate(
                  tx,
                  projectId,
                  user.id,
                  template,
                  targetNode
                )
              : [];
          const papers = [];
          for (const item of templateApplyPlan.items) {
            if (item.status !== "CREATE" || !item.plannedCode) {
              continue;
            }
            const templateFile = selectedFileById.get(item.templateFileId);
            if (!templateFile) {
              continue;
            }
            const paper = await tx.workingPaper.create({
              data: {
                projectId,
                workflowNodeId: targetNode.id,
                code: item.plannedCode,
                title: getProjectTemplateDisplayTitle(templateFile),
                paperType: templateFile.paperType,
                bucket: item.bucket,
                templateItemId: templateFile.templateItemId,
                createdBy: user.id,
              },
            });
            const attachment = await this.copyProjectTemplateFileToWorkingPaper(
              tx,
              projectId,
              paper.id,
              user.id,
              templateFile
            );
            papers.push({ ...paper, attachments: [attachment] });
          }
          return {
            createdPapers: papers,
            createdWorkflowNodes: createdNodes,
            applyPlan: templateApplyPlan,
          };
        });
      if (createdPapers.length > 0 || createdWorkflowNodes.length > 0) {
        await this.auditLogs.log({
          actorId: user.id,
          action: "PROJECT_TEMPLATE_APPLIED",
          targetType: "PROJECT_TEMPLATE",
          targetId: template.id,
          projectId,
          description: `Applied project template ${template.code} to ${targetNode.code}; created ${createdPapers.length} workpapers and ${createdWorkflowNodes.length} folders`,
          source,
        });
      }
      return {
        template,
        targetNode,
        plan: applyPlan,
        createdWorkingPapers: createdPapers,
        createdWorkflowNodes,
        existingWorkingPapers: applyPlan.items
          .map((item) => item.existingWorkingPaper)
          .filter((paper): paper is ExistingProjectTemplatePaper =>
            Boolean(paper)
          ),
        skippedTemplateFileIds: applyPlan.items
          .filter((item) => item.status === "EXISTS")
          .map((item) => item.templateFileId),
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

  async movePlacement(
    projectId: string,
    user: RequestUser,
    input: MoveProjectPlacementInput,
    source?: AuditLogSource
  ) {
    if (user.globalRole !== "SUPER_ADMIN") {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const folder = await this.prisma.desktopFolder.findFirst({
      where: { id: input.folderId, ownerId: user.id },
    });
    if (!folder) {
      throw new ApiBadRequestException(
        "DESKTOP_FOLDER_NOT_FOUND",
        "Folder not found or not owned by user"
      );
    }
    await this.prisma.desktopProjectPlacement.upsert({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId,
        },
      },
      update: { folderId: input.folderId },
      create: {
        userId: user.id,
        projectId,
        folderId: input.folderId,
        desktopX: 0,
        desktopY: 0,
        sortOrder: 0,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_PLACEMENT_MOVED",
      source,
      targetType: "PROJECT",
      targetId: projectId,
      projectId,
      description: `移动项目到 Folder ${input.folderId}`,
    });
    return this.get(projectId, user);
  }

  async update(
    projectId: string,
    input: UpdateProjectInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "updateProjectInfo"
    );

    try {
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: {
          name: input.name,
          projectCode: input.projectCode,
          reportingDate: new Date(input.reportDate),
          yearEndDate: new Date(input.yearEndDate),
          reportDate: new Date(input.reportDate),
          archiveDeadline: new Date(input.archiveDeadline),
          notes: input.notes,
          archivePassword: input.archivePassword,
        },
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "PROJECT_UPDATED",
        source,
        targetType: "PROJECT",
        targetId: project.id,
        projectId: project.id,
        description: `鏇存柊椤圭洰鍩烘湰淇℃伅 ${project.projectCode}`,
      });
      return this.get(project.id, user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "椤圭洰浠ｇ爜宸插瓨鍦?"
        );
      }
      throw error;
    }
  }

  async linkEngagement(
    projectId: string,
    input: LinkProjectEngagementInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "updateProjectInfo"
    );

    const linkInTransaction = () =>
      this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findFirst({
          where: { id: projectId, status: "ACTIVE" },
          select: { id: true, projectCode: true, cmpEngagementId: true },
        });
        if (!project) {
          throw new ApiBadRequestException("NOT_FOUND", "项目不存在或不可编辑");
        }
        if (project.cmpEngagementId) {
          throw new ApiConflictException(
            "PROJECT_ENGAGEMENT_ALREADY_LINKED",
            "该项目已经绑定 Engagement Code"
          );
        }

        const engagement = await tx.cmpEngagement.findFirst({
          where: {
            id: input.cmpEngagementId,
            clientId: input.cmpClientId,
            status: "ACTIVE",
            client: { status: "ACTIVE" },
          },
          select: {
            id: true,
            clientId: true,
            engagementCode: true,
            picUserId: true,
            micUserId: true,
            picUser: { select: { status: true, globalRole: true } },
            micUser: { select: { status: true, globalRole: true } },
          },
        });
        if (!engagement) {
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "只能绑定有效的 CMP Engagement Code"
          );
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            cmpClientId: engagement.clientId,
            cmpEngagementId: engagement.id,
          },
        });
        await this.syncLinkedEngagementProjectMembers(
          tx,
          projectId,
          engagement,
          user.id
        );
        await this.auditLogs.logInTransaction(tx, {
          actorId: user.id,
          action: "PROJECT_ENGAGEMENT_LINKED",
          source,
          targetType: "PROJECT",
          targetId: projectId,
          projectId,
          description: `项目 ${project.projectCode} 绑定 Engagement Code ${engagement.engagementCode}，保留项目编号`,
        });
        return { engagementId: engagement.id };
      });
    let linked: Awaited<ReturnType<typeof linkInTransaction>>;
    try {
      linked = await linkInTransaction();
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
      try {
        linked = await linkInTransaction();
      } catch (retryError) {
        if (
          retryError instanceof Prisma.PrismaClientKnownRequestError &&
          retryError.code === "P2002"
        ) {
          throw new ApiConflictException(
            "CONFLICT_RISK",
            "关联业务时发生并发冲突，请刷新后重试"
          );
        }
        throw retryError;
      }
    }

    try {
      await this.tmsTimesheets?.reconcileProjectLink(
        projectId,
        linked.engagementId
      );
    } catch (error) {
      this.logger.error(
        `CMP project ${projectId} was linked but TMS reconciliation failed`,
        error instanceof Error ? error.stack : undefined
      );
    }
    return this.get(projectId, user);
  }

  private async syncLinkedEngagementProjectMembers(
    tx: Prisma.TransactionClient,
    projectId: string,
    engagement: {
      picUserId: string | null;
      micUserId: string | null;
      picUser: { status: string; globalRole: string } | null;
      micUser: { status: string; globalRole: string } | null;
    },
    actorId: string
  ) {
    const { picUserId, micUserId } = engagement;
    const validPic =
      picUserId &&
      engagement.picUser?.status === "ACTIVE" &&
      ["PARTNER", "PRINCIPAL"].includes(engagement.picUser.globalRole);
    const validMic =
      micUserId &&
      engagement.micUser?.status === "ACTIVE" &&
      ["MANAGER", "SENIOR_MANAGER"].includes(engagement.micUser.globalRole);
    if (
      !picUserId ||
      !micUserId ||
      !validPic ||
      !validMic ||
      picUserId === micUserId
    ) {
      return;
    }

    await tx.$queryRaw`SELECT id FROM users WHERE id IN (${actorId}, ${picUserId}, ${micUserId}) ORDER BY id FOR SHARE`;
    const actor = await tx.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actorId } },
      include: { user: { select: { globalRole: true, status: true } } },
    });
    if (
      !actor ||
      actor.status !== "ACTIVE" ||
      actor.user.status !== "ACTIVE" ||
      !canManageProjectLeadership({
        authorizationSuspended: Boolean(actor.authorizationSuspendedAt),
        globalRole: actor.user.globalRole,
        projectRole: actor.projectRole,
        inChargeRole: actor.inChargeRole,
      })
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "关联此业务会重设 PIC/MIC，必须由当前有效 PIC 操作；无有效 PIC 时请先联系管理员恢复"
      );
    }
    const accounts = await tx.user.findMany({
      where: { id: { in: [picUserId, micUserId] } },
      select: { id: true, globalRole: true, status: true },
    });
    const currentPic = accounts.find((account) => account.id === picUserId);
    const currentMic = accounts.find((account) => account.id === micUserId);
    if (
      !currentPic ||
      !currentMic ||
      currentPic.status !== "ACTIVE" ||
      currentMic.status !== "ACTIVE" ||
      !isProjectPermissionSubjectConsistent({
        globalRole: currentPic.globalRole,
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      }) ||
      !isProjectPermissionSubjectConsistent({
        globalRole: currentMic.globalRole,
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      })
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "业务负责人职级或状态已变化，请刷新后重试"
      );
    }
    await tx.projectMember.updateMany({
      where: {
        projectId,
        inChargeRole: "PARTNER_IN_CHARGE",
        userId: { not: picUserId },
      },
      data: { inChargeRole: null },
    });
    await tx.projectMember.updateMany({
      where: {
        projectId,
        inChargeRole: "MANAGER_IN_CHARGE",
        userId: { not: micUserId },
      },
      data: { inChargeRole: null },
    });
    await tx.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId: picUserId },
      },
      update: {
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
        authorizationSuspendedAt: null,
        status: "ACTIVE",
      },
      create: {
        projectId,
        userId: picUserId,
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
        status: "ACTIVE",
      },
    });
    await tx.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId: micUserId },
      },
      update: {
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
        authorizationSuspendedAt: null,
        status: "ACTIVE",
      },
      create: {
        projectId,
        userId: micUserId,
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
        status: "ACTIVE",
      },
    });
  }

  async unlinkEngagement(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "updateProjectInfo"
    );

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, status: "ACTIVE" },
      select: {
        id: true,
        projectNumber: true,
        projectCode: true,
        cmpEngagementId: true,
      },
    });
    if (!project) {
      throw new ApiBadRequestException("NOT_FOUND", "项目不存在或不可编辑");
    }
    if (!project.cmpEngagementId) {
      throw new ApiConflictException(
        "CONFLICT_RISK",
        "该项目尚未绑定 Engagement Code"
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        cmpClientId: null,
        cmpEngagementId: null,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_ENGAGEMENT_UNLINKED",
      source,
      targetType: "PROJECT",
      targetId: projectId,
      projectId,
      description: `项目 ${project.projectCode} 解除 Engagement 关联，保留项目编号`,
    });
    await this.tmsTimesheets?.refreshProjectLink(projectId);
    return this.get(projectId, user);
  }

  async archive(projectId: string, user: RequestUser, source?: AuditLogSource) {
    await Promise.resolve();
    return this.submitArchive(projectId, user, source);
  }

  async submitArchive(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "archiveProject"
    );
    await this.archiveChecks.assertReadyForArchive(projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: "PENDING_FINAL_CHECK" },
      select: { id: true, projectCode: true, name: true },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_SUBMITTED_FOR_ARCHIVE",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Submitted project ${project.projectCode} for final archive check`,
      source,
    });
    await this.notifySuperAdminsForArchiveSubmission(project, user.id);
    return this.get(project.id, user);
  }

  async reopen(projectId: string, user: RequestUser, source?: AuditLogSource) {
    this.assertSuperAdmin(user);
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId },
      select: { id: true, projectCode: true, status: true, name: true },
    });
    if (project.status !== "PENDING_FINAL_CHECK") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only projects pending final check can be reopened"
      );
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: "ACTIVE" },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_REOPENED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Reopened project ${project.projectCode} from final archive check`,
      source,
    });
    await this.notifyProjectMembersForReopen(project, user.id);
    return this.get(project.id, user);
  }

  async confirmArchive(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    this.assertSuperAdmin(user);
    const project = await this.prisma.project.findFirstOrThrow({
      where: { id: projectId },
      select: { id: true, projectCode: true, status: true },
    });
    if (project.status !== "PENDING_FINAL_CHECK") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only projects pending final check can be confirmed for archive"
      );
    }
    const job = await this.archiveJobService().startJob(projectId, user);
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_FINAL_ARCHIVE_CONFIRMED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Confirmed final archive for project ${project.projectCode}`,
      source,
    });
    return job;
  }

  async deleteProject(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(projectId, user.id, "deleteProject");
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: "DELETED" },
    });
    await this.prisma.desktopProjectPlacement.deleteMany({
      where: { projectId },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_DELETED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Delete project ${project.projectCode}`,
      source,
    });
    return project;
  }

  async restoreProject(
    projectId: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.access.requireProjectAction(
      projectId,
      user.id,
      "restoreProject"
    );
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: "ACTIVE" },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_RESTORED",
      targetType: "PROJECT",
      targetId: project.id,
      projectId: project.id,
      description: `Restore project ${project.projectCode}`,
      source,
    });
    return project;
  }

  private archiveJobService() {
    if (!this.archiveJobs) {
      throw new ApiBadRequestException(
        "ARCHIVE_JOB_UNAVAILABLE",
        "Archive job service is not available"
      );
    }
    return this.archiveJobs;
  }

  private async requireProjectTemplateApplyContext(
    projectId: string,
    templateId: string,
    input: ApplyProjectTemplateInput
  ) {
    const template = await this.prisma.projectTemplate.findFirst({
      where: { id: templateId, status: "PUBLISHED" },
      include: {
        nodes: {
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
          include: {
            files: {
              orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
            },
            smartForms: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              include: {
                smartFormTemplate: true,
                smartFormTemplateVersion: {
                  include: { template: true },
                },
              },
            },
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
    return {
      template,
      targetNode: {
        id: targetNode.id,
        code: targetNode.code,
        title: targetNode.title,
        level: targetNode.level,
      },
    };
  }

  private async buildProjectTemplateApplyPlan(
    tx: Pick<Prisma.TransactionClient, "workingPaper">,
    targetNode: ProjectTemplateApplyTarget,
    files: ProjectTemplateFileForApply[],
    bucketOverride?: ApplyProjectTemplateInput["bucket"]
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
    const plannedItems: ProjectTemplateApplyPlanItem[] = [];
    for (const file of files) {
      const targetBucket = bucketOverride ?? "CURRENT";
      const displayTitle = getProjectTemplateDisplayTitle(file);
      const existingPaper =
        existingPapers.find(
          (paper) =>
            paper.bucket === targetBucket &&
            ((file.templateItemId &&
              paper.templateItemId === file.templateItemId) ||
              normalizeComparisonText(paper.title) ===
                normalizeComparisonText(displayTitle) ||
              normalizeComparisonText(paper.title) ===
                normalizeComparisonText(file.title))
        ) ?? null;
      if (existingPaper) {
        const existingCode = normalizeCodeWithoutDigitFour(existingPaper.code);
        plannedItems.push({
          templateFileId: file.id,
          templateNodeId: file.templateNodeId,
          fileCode: file.code,
          title: displayTitle,
          paperType: existingPaper.paperType,
          bucket: existingPaper.bucket,
          status: "EXISTS",
          plannedCode: null,
          existingWorkingPaper: {
            ...existingPaper,
            code: existingCode,
            title:
              existingPaper.title === existingPaper.code
                ? existingCode
                : existingPaper.title,
          },
        });
        continue;
      }
      const code = buildNextWorkingPaperCode(targetNode.code, plannedCodes);
      plannedCodes.push({ code });
      plannedItems.push({
        templateFileId: file.id,
        templateNodeId: file.templateNodeId,
        fileCode: file.code,
        title: displayTitle,
        paperType: file.paperType,
        bucket: targetBucket,
        status: "CREATE",
        plannedCode: code,
        existingWorkingPaper: null,
      });
    }
    return {
      summary: {
        total: plannedItems.length,
        create: plannedItems.filter((item) => item.status === "CREATE").length,
        existing: plannedItems.filter((item) => item.status === "EXISTS")
          .length,
      },
      items: plannedItems,
    };
  }

  private async copyProjectTemplateFileToWorkingPaper(
    tx: Prisma.TransactionClient,
    projectId: string,
    workingPaperId: string,
    uploadedBy: string,
    file: ProjectTemplateFileForApply
  ) {
    if (file.placeholderType) {
      const uploadedAt = new Date();
      return tx.attachment.create({
        data: {
          projectId,
          workingPaperId,
          templateItemId: file.templateItemId,
          fileKind: "SUPPORTING",
          fileName: file.fileName,
          originalName: file.originalName ?? file.title,
          fileUrl: "",
          fileSize: 0,
          mimeType: file.mimeType,
          placeholderType: file.placeholderType,
          uploadedBy,
          lastModifiedBy: uploadedBy,
          lastModifiedAt: uploadedAt,
          workDate: startOfUtcDate(uploadedAt),
        },
        include: ATTACHMENT_USER_INCLUDE,
      });
    }
    const stored = await this.fileStorage().copyObjectToWorkingPaper(
      projectId,
      workingPaperId,
      file.originalName ?? file.title,
      file.fileUrl,
      file.mimeType
    );
    const uploadedAt = new Date();
    const attachment = await tx.attachment.create({
      data: {
        projectId,
        workingPaperId,
        templateItemId: file.templateItemId,
        fileKind: "SUPPORTING",
        fileName: stored.fileName,
        originalName: file.originalName ?? file.title,
        fileUrl: stored.objectKey,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        uploadedBy,
        lastModifiedBy: uploadedBy,
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
        originalName: file.originalName ?? file.title,
        fileUrl: stored.objectKey,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        workDate: startOfUtcDate(uploadedAt),
        uploadedBy,
        uploadedAt,
        archivedBy: uploadedBy,
        action: "INITIAL",
        isCurrent: true,
      },
    });
    return tx.attachment.update({
      where: { id: attachment.id },
      data: { headVersionId: version.id },
      include: ATTACHMENT_USER_INCLUDE,
    });
  }

  private globalRoleToProjectRole(
    role: RequestUser["globalRole"]
  ): ProjectRole {
    if (role === "PARTNER") {
      return "PARTNER";
    }
    if (role === "TAX_EXPERT") {
      return "TAX_REVIEWER";
    }
    return "PREPARER";
  }

  private async resolveApplicableAccountingStandard(input: CreateProjectInput) {
    const value = input.applicableAccountingStandard?.trim();
    const frameworkTemplateId = input.frameworkTemplateId?.trim();
    if (value) {
      return { value, frameworkTemplateId: frameworkTemplateId || null };
    }
    if (!frameworkTemplateId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Applicable accounting standard is required"
      );
    }
    const frameworkTemplate = await this.prisma.frameworkTemplate.findFirst({
      where: { id: frameworkTemplateId, isActive: true },
      select: { id: true, name: true },
    });
    if (!frameworkTemplate) {
      throw new ApiBadRequestException(
        "FRAMEWORK_TEMPLATE_NOT_FOUND",
        "Applicable standard template is not available"
      );
    }
    return {
      value: frameworkTemplate.name,
      frameworkTemplateId: frameworkTemplate.id,
    };
  }

  private async resolveProjectTemplate(input: CreateProjectInput) {
    const projectTemplateId = input.projectTemplateId?.trim();
    if (!projectTemplateId) {
      return null;
    }
    const template = await this.prisma.projectTemplate.findFirst({
      where: {
        id: projectTemplateId,
        status: "PUBLISHED",
      },
      include: {
        nodes: {
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
          include: {
            files: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            smartForms: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              include: {
                smartFormTemplate: true,
                smartFormTemplateVersion: {
                  include: { template: true },
                },
              },
            },
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
    return template;
  }

  private resolveWizardAuditAreaCodes(
    input: CreateProjectInput,
    projectTemplate: ProjectTemplateForCreate | null
  ): AuditAreaCode[] {
    const hasWizardInput =
      input.industryCode !== undefined || input.auditAreaCodes !== undefined;
    if (!hasWizardInput) {
      return [];
    }

    if (
      !input.cmpClientId?.trim() ||
      !input.cmpEngagementId?.trim() ||
      !input.industryCode ||
      !input.projectTemplateId?.trim() ||
      !projectTemplate
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A CMP client, engagement, industry and matching project template are required"
      );
    }

    const selected = [...new Set(input.auditAreaCodes)];
    const knownAreas = new Set<string>(AUDIT_AREA_CODES);
    if (selected.some((code) => !knownAreas.has(code))) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "One or more audit areas are invalid"
      );
    }
    const mappedAreas = new Set(
      projectTemplate.nodes
        .map((node) => node.auditAreaCode)
        .filter((code): code is string => Boolean(code))
    );
    const unsupported = selected.filter((code) => !mappedAreas.has(code));
    if (unsupported.length > 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `Project template does not support: ${unsupported.join(", ")}`
      );
    }
    return selected as AuditAreaCode[];
  }

  private async initializeProjectWorkflow(
    tx: Prisma.TransactionClient,
    projectId: string,
    createdBy: string,
    projectTemplate: ProjectTemplateForCreate | null,
    language: ProjectLanguage,
    selectedAuditAreaCodes: readonly AuditAreaCode[] = [],
    filterAuditAreas = false
  ) {
    if (!projectTemplate) {
      await this.createDefaultWorkflow(
        tx,
        projectId,
        createdBy,
        DEFAULT_WORKFLOW
      );
      return;
    }
    try {
      await this.createWorkflowFromProjectTemplate(
        tx,
        projectId,
        createdBy,
        projectTemplate,
        language,
        new Set(selectedAuditAreaCodes),
        filterAuditAreas
      );
    } catch (error) {
      this.logger.error(
        `Project template ${projectTemplate.id} initialization failed`,
        error instanceof Error ? error.stack : String(error)
      );
      throw new ApiServiceUnavailableException(
        "PROJECT_TEMPLATE_INITIALIZATION_FAILED",
        "The project template could not be initialized. Ask an administrator to verify its files, then try again."
      );
    }
  }

  private async createWorkflowFromProjectTemplate(
    tx: Prisma.TransactionClient,
    projectId: string,
    createdBy: string,
    projectTemplate: ProjectTemplateForCreate,
    language: ProjectLanguage,
    selectedAuditAreaCodes: ReadonlySet<string> = new Set(),
    filterAuditAreas = false
  ) {
    const nodesByParentId = groupProjectTemplateNodesByParent(projectTemplate);
    await this.createTemplateWorkflowChildren(
      tx,
      projectId,
      createdBy,
      nodesByParentId,
      "",
      null,
      0,
      true,
      language,
      null,
      [],
      selectedAuditAreaCodes,
      null,
      filterAuditAreas
    );
  }

  private async applyFolderOnlyProjectTemplate(
    tx: Prisma.TransactionClient,
    projectId: string,
    createdBy: string,
    projectTemplate: ProjectTemplateForCreate,
    targetNode: ProjectTemplateApplyTarget
  ) {
    await Promise.resolve();
    const nodesByParentId = groupProjectTemplateNodesByParent(projectTemplate);
    return this.createTemplateWorkflowChildren(
      tx,
      projectId,
      createdBy,
      nodesByParentId,
      "",
      targetNode.id,
      targetNode.level,
      false
    );
  }

  private async createTemplateWorkflowChildren(
    tx: Prisma.TransactionClient,
    projectId: string,
    createdBy: string,
    nodesByParentId: Map<string, ProjectTemplateNodeForCreate[]>,
    templateParentId: string,
    parentId: string | null,
    levelOffset = 0,
    preserveNodeTypes = true,
    language: ProjectLanguage = "zh-CN",
    smeRootParentCode: string | null = null,
    numericParentPath: number[] | null = preserveNodeTypes ? [] : null,
    selectedAuditAreaCodes: ReadonlySet<string> = new Set(),
    inheritedAuditAreaCode: string | null = null,
    filterAuditAreas = false
  ): Promise<WorkflowNode[]> {
    const createdNodes = [];
    const siblings = nodesByParentId.get(templateParentId) ?? [];
    const shouldRestoreSmeRootTitles =
      templateParentId === "" && hasSmeRootFolderSet(siblings);
    for (const [index, node] of siblings.entries()) {
      const activeAuditAreaCode = node.auditAreaCode ?? inheritedAuditAreaCode;
      if (
        filterAuditAreas &&
        activeAuditAreaCode &&
        !selectedAuditAreaCodes.has(activeAuditAreaCode)
      ) {
        continue;
      }
      const childNodes = nodesByParentId.get(node.id) ?? [];
      const identity = getProjectTemplateWorkflowNodeIdentity(node, {
        shouldRestoreSmeRootTitles,
        siblingIndex: index + 1,
        smeRootParentCode,
      });
      const hasTemplateContent =
        node.files.length > 0 ||
        (node.smartForms ?? []).length > 0 ||
        childNodes.length > 0;
      if (!identity.title && !hasTemplateContent) {
        continue;
      }
      const numericPath = numericParentPath
        ? [...numericParentPath, index + 1]
        : null;
      const instantiatedNodeCode = numericPath
        ? formatHierarchicalNumericCode(numericPath)
        : identity.code;
      const level = node.level + levelOffset;
      const created = await tx.workflowNode.create({
        data: {
          projectId,
          parentId,
          code: instantiatedNodeCode,
          title: identity.title || node.title.trim() || instantiatedNodeCode,
          level,
          nodeType: preserveNodeTypes
            ? node.nodeType
            : getWorkflowNodeType(level),
          sortOrder: node.sortOrder,
          createdBy,
        },
      });
      createdNodes.push(created);
      const templateItems = getOrderedProjectTemplateItems(node);
      for (const [itemIndex, templateItem] of templateItems.entries()) {
        const code = buildInstantiatedWorkingPaperCode(
          instantiatedNodeCode,
          itemIndex + 1
        );
        if (templateItem.kind === "SMART_FORM") {
          await this.createSmartFormFromTemplateReference(
            tx,
            projectId,
            created.id,
            createdBy,
            { ...templateItem.item, code },
            language
          );
          continue;
        }
        const file = templateItem.item;
        const paper = await tx.workingPaper.create({
          data: {
            projectId,
            workflowNodeId: created.id,
            code,
            title: getProjectTemplateDisplayTitle(file),
            paperType: file.paperType,
            bucket: "CURRENT",
            // Project-template copies are independent of the library's unique
            // per-folder working-paper slot. Preserve provenance on attachment.
            templateItemId: null,
            createdBy,
          },
        });
        await this.copyProjectTemplateFileToWorkingPaper(
          tx,
          projectId,
          paper.id,
          createdBy,
          file
        );
      }
      createdNodes.push(
        ...(await this.createTemplateWorkflowChildren(
          tx,
          projectId,
          createdBy,
          nodesByParentId,
          node.id,
          created.id,
          levelOffset,
          preserveNodeTypes,
          language,
          shouldRestoreSmeRootTitles && templateParentId === ""
            ? getSmeRootCode(identity.code)
            : null,
          numericPath,
          selectedAuditAreaCodes,
          activeAuditAreaCode,
          filterAuditAreas
        ))
      );
    }
    return createdNodes;
  }

  private async createDefaultWorkflow(
    tx: Prisma.TransactionClient,
    projectId: string,
    createdBy: string,
    nodes: DefaultWorkflowNode[],
    parentId?: string
  ) {
    for (const node of nodes) {
      const created = await tx.workflowNode.create({
        data: {
          projectId,
          parentId,
          code: node.code,
          title: node.title,
          level: node.level,
          nodeType: node.nodeType,
          sortOrder: node.sortOrder,
          createdBy,
        },
      });
      if (node.children?.length) {
        await this.createDefaultWorkflow(
          tx,
          projectId,
          createdBy,
          node.children,
          created.id
        );
      }
    }
  }

  private async ensureDefaultWorkspace(user: RequestUser) {
    const existing = await this.prisma.workspace.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.workspace.create({
      data: {
        name: DEFAULT_WORKSPACE_NAME,
        clientName: user.name,
        description: "Personal compatibility workspace for project launcher.",
        ownerId: user.id,
      },
    });
  }

  private fileStorage() {
    return this.storage ?? new StorageService();
  }

  private async createSmartFormFromTemplateReference(
    tx: Prisma.TransactionClient,
    projectId: string,
    workflowNodeId: string,
    createdBy: string,
    smartForm: ProjectTemplateSmartFormForCreate,
    language: ProjectLanguage
  ) {
    const version = smartForm.smartFormTemplateVersion;
    const { template } = version;
    const title = normalizeSmartFormFileName(
      getProjectTemplateDisplayTitle({
        code: smartForm.code,
        title: smartForm.title.trim() || template.name,
      })
    );
    const now = new Date();
    const smartFormPackage = buildProjectSmartFormPackage({
      template,
      version,
      language,
      now,
    });
    const completion = validateSmartFormV2Response(
      compileSmartFormV2Definition(
        smartFormPackage.definition,
        STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
      ),
      smartFormPackage.response
    );
    const buffer = serializeSmartFormPackage(smartFormPackage);
    const paper = await tx.workingPaper.create({
      data: {
        projectId,
        workflowNodeId,
        code: normalizeCodeWithoutDigitFour(smartForm.code),
        title,
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy,
      },
    });
    const stored = await this.fileStorage().putObject(
      projectId,
      paper.id,
      title,
      buffer,
      SMART_FORM_MIME_TYPE
    );
    const attachment = await tx.attachment.create({
      data: {
        projectId,
        workingPaperId: paper.id,
        workflowNodeId,
        bucket: "CURRENT",
        code: paper.code,
        title,
        fileKind: "SMART_FORM",
        fileName: stored.fileName,
        originalName: title,
        fileUrl: stored.objectKey,
        fileSize: buffer.byteLength,
        mimeType: SMART_FORM_MIME_TYPE,
        uploadedBy: createdBy,
        lastModifiedBy: createdBy,
        lastModifiedAt: now,
        workDate: startOfUtcDate(now),
      },
      include: ATTACHMENT_USER_INCLUDE,
    });
    const versionRecord = await tx.attachmentVersion.create({
      data: {
        attachmentId: attachment.id,
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
        uploadedBy: createdBy,
        uploadedAt: now,
        archivedBy: createdBy,
        action: "INITIAL",
        isCurrent: true,
      },
    });
    await tx.attachment.update({
      where: { id: attachment.id },
      data: { headVersionId: versionRecord.id },
      include: ATTACHMENT_USER_INCLUDE,
    });
    await tx.smartFormInstance.create({
      data: {
        projectId,
        attachmentId: attachment.id,
        smartFormTemplateId: version.templateId,
        smartFormTemplateVersionId: version.id,
        schemaHash: hashJson(smartFormPackage.definition),
        answerHash: hashJson(smartFormPackage.response),
        status: completion.success ? "COMPLETE" : "INCOMPLETE",
        completedAt: completion.success ? now : null,
        lastSavedBy: createdBy,
        lastSavedAt: now,
      },
    });
  }

  private async ensureDefaultDesktopFolder(
    tx: Prisma.TransactionClient,
    userId: string
  ) {
    const existing = await tx.desktopFolder.findFirst({
      where: { ownerId: userId, isDefault: true },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      return existing;
    }
    return tx.desktopFolder.create({
      data: {
        ownerId: userId,
        name: DEFAULT_DESKTOP_FOLDER_NAME,
        isDefault: true,
        sortOrder: 0,
      },
    });
  }

  private async resolveDesktopFolder(
    tx: Prisma.TransactionClient,
    userId: string,
    folderId?: string
  ) {
    if (!folderId) {
      return this.ensureDefaultDesktopFolder(tx, userId);
    }
    const folder = await tx.desktopFolder.findFirst({
      where: { id: folderId, ownerId: userId },
    });
    if (!folder) {
      throw new ApiBadRequestException(
        "DESKTOP_FOLDER_NOT_FOUND",
        "Desktop folder does not exist"
      );
    }
    return folder;
  }
  private assertSuperAdmin(user: RequestUser) {
    if (user.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only super admins can perform final archive review"
      );
    }
  }

  private async notifySuperAdminsForArchiveSubmission(
    project: { id: string; projectCode: string; name: string },
    senderId: string
  ) {
    const { inbox } = this;
    if (!inbox) {
      return;
    }
    const admins = await this.prisma.user.findMany({
      where: { globalRole: "SUPER_ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        inbox.createCollaborationMessage({
          recipientId: admin.id,
          senderId,
          projectId: project.id,
          type: "SYSTEM_NOTIFICATION",
          title: `Archive review requested for ${project.projectCode}`,
          body: `${project.name} has been submitted for final archive review.`,
          contentKey: "PROJECT_ARCHIVE_REVIEW_REQUESTED",
          contentParams: {
            projectCode: project.projectCode,
            projectName: project.name,
          },
        })
      )
    );
  }

  private async notifyProjectMembersForReopen(
    project: { id: string; projectCode: string; name: string },
    senderId: string
  ) {
    const { inbox } = this;
    if (!inbox) {
      return;
    }
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id, status: "ACTIVE" },
      select: { userId: true },
    });
    await Promise.all(
      members.map((member) =>
        inbox.createCollaborationMessage({
          recipientId: member.userId,
          senderId,
          projectId: project.id,
          type: "SYSTEM_NOTIFICATION",
          title: `Archive review returned for revision: ${project.projectCode}`,
          body: `${project.name} was returned from final archive review. The project is editable again.`,
          contentKey: "PROJECT_ARCHIVE_REVIEW_RETURNED",
          contentParams: {
            projectCode: project.projectCode,
            projectName: project.name,
          },
          actionUrl: `/engagement/${project.id}`,
        })
      )
    );
  }

  private withDesktopFolder<T extends object>(project: T) {
    const projectWithPlacements = project as T & {
      desktopPlacements?: { folder?: unknown }[];
    };
    const [desktopPlacement] = projectWithPlacements.desktopPlacements ?? [];
    const { desktopPlacements: _desktopPlacements, ...rest } =
      projectWithPlacements;
    return {
      ...rest,
      desktopFolder: desktopPlacement?.folder,
    };
  }
}

function startOfUtcDate(input: Date) {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

function buildProjectSmartFormPackage(input: {
  template: { id: string; code: string; name: string };
  version: {
    id: string;
    definitionJson: unknown;
    publishedAt: Date;
  };
  language: ProjectLanguage;
  now: Date;
}): SmartFormPackage {
  const definition = compileSmartFormV2Definition(
    input.version.definitionJson,
    STANDARD_SMART_FORM_V2_COMPONENT_REGISTRY
  );
  const timestamp = input.now.toISOString();
  return SmartFormPackageSchema.parse({
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
      responseLocale: input.language,
      updatedAt: timestamp,
      fields: {},
      sheets: {},
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
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

function buildRollForwardSummary(source: RollForwardSourceProject) {
  return {
    workflowNodes: source.workflowNodes.length,
    workingPapers: source.workingPapers.length,
    attachments: source.attachments.length,
    attachmentVersions: source.attachments.reduce(
      (total, attachment) => total + attachment.versions.length,
      0
    ),
    smartForms: source.attachments.filter(
      (attachment) => attachment.fileKind === "SMART_FORM"
    ).length,
  };
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function selectProjectTemplateFiles(
  template: ProjectTemplateForCreate,
  selectedFileIds?: string[]
) {
  const allFiles = template.nodes.flatMap((node) => node.files);
  if (!selectedFileIds) {
    return allFiles;
  }
  const selected = new Set(selectedFileIds);
  return allFiles.filter((file) => selected.has(file.id));
}

function isFolderOnlyProjectTemplate(template: ProjectTemplateForCreate) {
  return (
    template.nodes.length > 0 &&
    template.nodes.every(
      (node) => node.files.length === 0 && (node.smartForms ?? []).length === 0
    )
  );
}

function groupProjectTemplateNodesByParent(template: ProjectTemplateForCreate) {
  const nodesByParentId = new Map<string, ProjectTemplateNodeForCreate[]>();
  for (const node of template.nodes) {
    const parentKey = node.parentId ?? "";
    const siblings = nodesByParentId.get(parentKey) ?? [];
    siblings.push(node);
    nodesByParentId.set(parentKey, siblings);
  }
  for (const siblings of nodesByParentId.values()) {
    siblings.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.createdAt.getTime() - right.createdAt.getTime()
    );
  }
  return nodesByParentId;
}

function getOrderedProjectTemplateItems(
  node: ProjectTemplateNodeForCreate
): ProjectTemplateItemForCreate[] {
  return [
    ...node.files.map((item) => ({ kind: "FILE" as const, item })),
    ...(node.smartForms ?? []).map((item) => ({
      kind: "SMART_FORM" as const,
      item,
    })),
  ].sort(
    (left, right) =>
      left.item.sortOrder - right.item.sortOrder ||
      (left.item.createdAt?.getTime() ?? 0) -
        (right.item.createdAt?.getTime() ?? 0) ||
      left.kind.localeCompare(right.kind) ||
      left.item.id.localeCompare(right.item.id)
  );
}

function buildInstantiatedWorkingPaperCode(nodeCode: string, ordinal: number) {
  return /^\d{1,4}$|^\d+(?:-\d+)+$/.test(nodeCode)
    ? `${nodeCode}.${ordinal}`
    : `${nodeCode}-F${formatNumberWithoutDigitFour(ordinal, 3)}`;
}

function formatHierarchicalNumericCode(path: number[]) {
  if (path.length <= 4 && path.every((value) => value >= 1 && value <= 9)) {
    return `${path.join("")}${"0".repeat(4 - path.length)}`;
  }
  if (path.length < 4) {
    return `${path.join("-")}-${"0".repeat(4 - path.length)}`;
  }
  return path.join("-");
}

function getProjectTemplateDisplayTitle(item: ProjectTemplateNamedItem) {
  return getProjectTemplateDisplayTitleOrNull(item) || item.code.trim();
}

function getProjectTemplateWorkflowNodeIdentity(
  node: ProjectTemplateNodeForCreate,
  input: {
    shouldRestoreSmeRootTitles: boolean;
    siblingIndex: number;
    smeRootParentCode: string | null;
  }
) {
  if (input.smeRootParentCode) {
    const code = `${input.smeRootParentCode}${formatOrdinalWithoutDigitFour(input.siblingIndex)}`;
    return {
      code,
      title: getProjectTemplateGeneratedChildTitle(node, code),
    };
  }

  if (input.shouldRestoreSmeRootTitles) {
    const rootCode = getSmeRootCode(node.code);
    if (rootCode) {
      const displayTitle =
        (SME_ROOT_CODE_BY_TITLE[node.code.trim()]
          ? SME_ROOT_TITLE_BY_CODE[rootCode]
          : getProjectTemplateNodeDisplayTitleOrNull(node, false)) ||
        SME_ROOT_TITLE_BY_CODE[rootCode];
      return {
        code: rootCode,
        title: displayTitle,
      };
    }
  }

  const displayTitle = getProjectTemplateNodeDisplayTitleOrNull(
    node,
    input.shouldRestoreSmeRootTitles
  );
  return {
    code: node.code,
    title: displayTitle,
  };
}

function formatOrdinalWithoutDigitFour(index: number) {
  let value = 0;
  let remaining = index;
  while (remaining > 0) {
    value += 1;
    if (!String(value).includes("4")) {
      remaining -= 1;
    }
  }
  return String(value);
}

function getProjectTemplateNodeDisplayTitleOrNull(
  node: ProjectTemplateNodeForCreate,
  allowSmeRootTitle: boolean
) {
  return (
    getProjectTemplateDisplayTitleOrNull(node) ||
    (allowSmeRootTitle ? SME_ROOT_TITLE_BY_CODE[node.code.trim()] : "") ||
    ""
  );
}

function getProjectTemplateGeneratedChildTitle(
  node: ProjectTemplateNodeForCreate,
  generatedCode: string
) {
  const title = getProjectTemplateNodeDisplayTitleOrNull(node, false);
  if (title && !isReferenceCodeText(title)) {
    return stripProjectTemplateCodePrefix(title, generatedCode) || title;
  }
  return (
    stripProjectTemplateCodePrefix(node.code.trim(), generatedCode) ||
    stripLegacyReferenceCodePrefix(node.code.trim()) ||
    title ||
    generatedCode
  );
}

function getProjectTemplateDisplayTitleOrNull(item: ProjectTemplateNamedItem) {
  const title = item.title.trim();
  const code = item.code.trim();
  if (!title || !code) {
    return title || code;
  }
  const titleWithoutCode = stripProjectTemplateCodePrefix(title, code);
  return titleWithoutCode || "";
}

function stripProjectTemplateCodePrefix(title: string, code: string) {
  const titleValue = title.trim();
  if (isReferenceCodeText(titleValue)) {
    return "";
  }
  const codePattern = code
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean)
    .map(escapeRegExp)
    .join(String.raw`\s*-\s*`);
  if (!codePattern) {
    return title;
  }
  if (new RegExp(`^${codePattern}$`, "i").test(titleValue)) {
    return "";
  }
  const prefixMatch = titleValue.match(
    new RegExp(
      `^${codePattern}\\s*(?:-|\\u2013|\\u2014|:|\\uFF1A)\\s*(.+)$`,
      "i"
    )
  );
  if (!prefixMatch) {
    return stripLegacyReferenceCodePrefix(titleValue) ?? title;
  }
  const remainingTitle = prefixMatch[1].trim();
  return stripLegacyReferenceCodePrefix(remainingTitle) ?? remainingTitle;
}

function stripLegacyReferenceCodePrefix(title: string) {
  const parts = title
    .split(LEGACY_REFERENCE_TITLE_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || !isReferenceCodeStart(parts[0])) {
    return null;
  }
  if (parts.every(isReferenceCodePart)) {
    return "";
  }
  let prefixCount = 0;
  while (
    prefixCount < parts.length - 1 &&
    isReferenceCodePart(parts[prefixCount])
  ) {
    prefixCount += 1;
  }
  return prefixCount > 0 ? parts.slice(prefixCount).join(" - ").trim() : null;
}

function isReferenceCodeStart(value: string) {
  return (
    /^[A-Za-z]$/i.test(value) ||
    /^[A-Za-z]{1,3}\d+[A-Za-z]?$/i.test(value) ||
    /^F\d{1,5}$/i.test(value)
  );
}

function isReferenceCodePart(value: string) {
  return isReferenceCodeStart(value) || /^\d{1,6}$/.test(value);
}

function normalizeProjectLeadUserIds(
  userIds: string[] | undefined,
  singularUserId?: string
) {
  const selected = userIds ?? (singularUserId ? [singularUserId] : []);
  return [...new Set(selected.map((userId) => userId.trim()).filter(Boolean))];
}

function createUnlinkedProjectCode() {
  return `UNLINKED-PENDING-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function createGeneratedEmpProjectCode(projectNumber: number) {
  return `EMP-${projectNumber}`;
}

function isReferenceCodeText(value: string) {
  const parts = value
    .trim()
    .split(/\s*-\s*/g)
    .filter(Boolean);
  return (
    parts.length > 0 &&
    isReferenceCodeStart(parts[0]) &&
    parts.every(isReferenceCodePart)
  );
}

const LEGACY_REFERENCE_TITLE_SEPARATOR =
  /\s*(?:[:\uFF1A]|[\u2013\u2014]+|-)\s*/g;
const SME_ROOT_CODES = ["A", "B", "C", "D", "E", "F", "G"];
const SME_ROOT_TITLE_BY_CODE: Record<string, string> = {
  A: "Planning",
  B: "General Procedures",
  C: "Execution",
  D: "Reporting",
  E: "Completion",
  F: "Continued Connected Transactions (CCT)",
  G: "Other Audit Programmes",
};
const SME_ROOT_CODE_BY_TITLE = Object.fromEntries(
  Object.entries(SME_ROOT_TITLE_BY_CODE).map(([code, title]) => [title, code])
) as Record<string, string>;

function hasSmeRootFolderSet(nodes: { code: string }[]) {
  const codes = new Set(
    nodes.map((node) => getSmeRootCode(node.code)).filter(Boolean)
  );
  return SME_ROOT_CODES.every((code) => codes.has(code));
}

function getSmeRootCode(value: string) {
  const code = value.trim();
  return SME_ROOT_TITLE_BY_CODE[code] ? code : SME_ROOT_CODE_BY_TITLE[code];
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function getWorkflowNodeType(level: number): WorkflowNodeType {
  if (level === 1) {
    return "PHASE";
  }
  if (level === 2) {
    return "ACCOUNT";
  }
  return "WORKING_PAPER";
}

function normalizeComparisonText(value: string) {
  return value.trim().toLocaleLowerCase();
}
