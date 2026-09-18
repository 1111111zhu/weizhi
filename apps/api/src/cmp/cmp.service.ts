import { createHash } from "node:crypto";

import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CmpMasterStatus } from "@prisma/client";
import type {
  CmpAcceptanceDraftAssignmentInput,
  CmpAcceptanceDraftListType,
  CmpAcceptanceListQuery,
  CmpAcceptanceRequestType,
  CmpAcceptanceReturnInput,
  CmpBudgetCurrency,
  CmpClientAcceptanceDraftPayload,
  CmpClientGroupStructureProposal,
  CmpClientListQuery,
  CmpClientVersionListQuery,
  CmpEngagementFeeNote,
  CmpEngagementFeeNoteUpdateInput,
  CreateCmpEngagementFeeNoteInput,
  CmpEngagementArchiveDraftSaveInput,
  CmpEngagementArchiveFinalizeInput,
  CmpEngagementArchivePayload,
  CmpEngagementArchiveReturnInput,
  CmpEngagementArchiveSubmitInput,
  CmpEngagementListQuery,
  CmpFeeNoteLocale,
  CreateCmpAcceptanceRequestInput,
  CreateCmpClientGroupInput,
  CreateCmpClientInput,
  CreateCmpEngagementInput,
  TmsEngagementDirectoryItem,
  TmsEngagementDirectoryQuery,
  TmsEngagementSummary,
  TmsEngagementTimesheetAccessReason,
  TmsTimesheetRow,
  UpdateCmpAcceptanceRequestInput,
  UpdateCmpBudgetExchangeRateFallbackInput,
  UpdateCmpClientGroupInput,
  UpdateCmpClientInput,
  UpdateCmpEngagementInput,
  InboxStructuredContent,
} from "@project-wing/shared";
import {
  CMP_BUDGET_CURRENCIES,
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES,
  CmpAcceptanceChangeSummarySchema,
  CmpAcceptanceDraftsResponseSchema,
  CmpAcceptanceEngagementDraftPayloadSchema,
  CmpAcceptanceRequestSchema,
  CmpAcceptanceRequestsResponseSchema,
  CmpClientAcceptanceDraftPayloadSchema,
  CmpClientGroupStructureSchema,
  CmpClientGroupsResponseSchema,
  CmpClientSchema,
  CmpClientVersionDetailSchema,
  CmpClientVersionSchema,
  CmpClientVersionsResponseSchema,
  CmpClientsResponseSchema,
  CmpEngagementFeeNoteLineItemsSchema,
  CmpEngagementFeeNoteResponseSchema,
  CmpEngagementFeeNotesResponseSchema,
  CmpEngagementFeeNoteSchema,
  CmpEngagementArchiveDraftSchema,
  CmpEngagementArchiveCheckCodeEnum,
  CmpEngagementArchivePayloadSchema,
  CmpEngagementArchiveReviewSchema,
  CmpEngagementArchiveSnapshotSchema,
  CmpEngagementArchivesResponseSchema,
  CmpEngagementSchema,
  CmpEngagementsResponseSchema,
  CmpFeeNoteLocalizedContentsSchema,
  CreateCmpEngagementSchema,
  TmsEngagementDirectoryResponseSchema,
  TmsEngagementSummarySchema,
  validateCmpEngagementBudget,
} from "@project-wing/shared";
import {
  CmpCompanyIdentityResolutionSchema,
  CmpEntityRelationshipDraftSchema,
  CmpGroupRelationshipDraftSchema,
  CmpRelatedEntityDraftSchema,
} from "@project-wing/shared/cmp-entity-graph";
import type {
  CmpRecordPreviewDocument,
  CmpRecordPreviewLocale,
} from "@project-wing/shared/cmp-record-preview";
import { z } from "zod";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
  ApiNotFoundException,
} from "../common/api-error";
import type { ErrorCode } from "../common/api-error";
import {
  normalizeInboxLocale,
  resolveInboxEmailContent,
} from "../inbox/inbox-email-content";
import { resolveInboxEmailPresentation } from "../inbox/inbox-email-presentation";
import { InboxService } from "../inbox/inbox.service";
import { renderSystemEmail } from "../mail/system-email-template";
import { SystemEmailService } from "../mail/system-email.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildAcceptanceChangeSummary } from "./acceptance-changes";
import { CmpAmlService, deriveAmlAttentionCount } from "./aml/cmp-aml.service";
import { CmpBudgetExchangeRatesService } from "./cmp-budget-exchange-rates.service";
import {
  buildEngagementArchiveTypst,
  buildEngagementArchiveWorkbook,
} from "./cmp-engagement-archive-export";
import { buildEngagementBudgetWorkbook } from "./cmp-engagement-budget-workbook";
import {
  buildFeeNoteDocx,
  buildFeeNoteExportDocument,
  buildFeeNotePdfSource,
} from "./cmp-engagement-fee-note-export";
import {
  buildClientPreviewDocument,
  buildCmpRecordPreviewPdfSource,
  buildEngagementPreviewDocument,
} from "./cmp-record-preview";
import {
  CmpEntityGraphService,
  ensureCmpClientRootEntity,
  materializeCmpEntityMapDraft,
  materializeCmpRelatedPartyDraft,
} from "./entity-graph/cmp-entity-graph.service";
import { buildTmsEngagementSummary } from "./tms-engagement-summary";
import type {
  TmsSummaryApprovalRecord,
  TmsSummaryMember,
} from "./tms-engagement-summary";

type AcceptanceRequestTypeValue = CmpAcceptanceRequestType;
type ChangeBaseline = {
  payload: Record<string, unknown>;
  capturedAt: Date;
  targetUpdatedAt: Date;
};
type MaterializedCmpClientInput = Omit<CreateCmpClientInput, "status"> & {
  status: NonNullable<CmpClientAcceptanceDraftPayload["status"]>;
  groupStructure?: CmpClientGroupStructureProposal;
  relatedEntities?: NonNullable<
    CmpClientAcceptanceDraftPayload["relatedEntities"]
  >;
  relatedRelationships?: NonNullable<
    CmpClientAcceptanceDraftPayload["relatedRelationships"]
  >;
  relatedGroupRelationships?: NonNullable<
    CmpClientAcceptanceDraftPayload["relatedGroupRelationships"]
  >;
  removedGroupRelationshipIds?: NonNullable<
    CmpClientAcceptanceDraftPayload["removedGroupRelationshipIds"]
  >;
};
const MIC_EDITABLE_ACCEPTANCE_STATUSES = [
  "DRAFT",
  "RETURNED",
  "STAFF_EDITING",
] as const;
const MIC_ACCEPTANCE_ROLES = ["MANAGER"] as const;
const CMP_ACCEPTANCE_INITIATOR_ROLES = [
  ...MIC_ACCEPTANCE_ROLES,
  "PARTNER",
] as const;
const CLIENT_SUMMARY_SELECT = {
  id: true,
  clientCode: true,
  nameZh: true,
  nameEn: true,
  groupId: true,
  status: true,
} as const;
const RELATIONSHIP_INCLUDE =
  Prisma.validator<Prisma.CmpClientRelationshipInclude>()({
    fromClient: { select: CLIENT_SUMMARY_SELECT },
    toClient: { select: CLIENT_SUMMARY_SELECT },
  });
const GROUP_INCLUDE = Prisma.validator<Prisma.CmpClientGroupInclude>()({
  _count: { select: { clients: true } },
  ultimateParent: { select: CLIENT_SUMMARY_SELECT },
});
const CLIENT_INCLUDE = Prisma.validator<Prisma.CmpClientInclude>()({
  group: true,
  addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
  contacts: { orderBy: { sortOrder: "asc" } },
  ultimateParentForGroup: { select: { id: true } },
  relationshipsFrom: {
    where: { effectiveTo: null },
    include: RELATIONSHIP_INCLUDE,
    orderBy: { createdAt: "asc" },
  },
  relationshipsTo: {
    where: { effectiveTo: null },
    include: RELATIONSHIP_INCLUDE,
    orderBy: { createdAt: "asc" },
  },
});
const ENGAGEMENT_INCLUDE = {
  client: true,
  codeAliases: {
    orderBy: { replacedAt: "desc" },
  },
  feeNotes: { orderBy: { periodNumber: "asc" } },
  feePlanningLines: {
    orderBy: { sortOrder: "asc" },
    include: {
      staff: {
        orderBy: { sortOrder: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  },
  feeExchangeRateSnapshot: true,
} as const;
const USER_REF_SELECT = {
  id: true,
  name: true,
  email: true,
  globalRole: true,
  status: true,
} as const;
const ACCEPTANCE_INCLUDE =
  Prisma.validator<Prisma.CmpAcceptanceRequestInclude>()({
    submittedBy: { select: USER_REF_SELECT },
    micApprover: { select: USER_REF_SELECT },
    picApprover: { select: USER_REF_SELECT },
    itApprover: { select: USER_REF_SELECT },
    draftAssignee: { select: USER_REF_SELECT },
    draftCompletedBy: { select: USER_REF_SELECT },
    approvalSteps: {
      orderBy: [{ createdAt: "asc" }],
      include: { approver: { select: USER_REF_SELECT } },
    },
    amlScreeningBatches: {
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
      select: {
        status: true,
        subjectCount: true,
        attentionCount: true,
        errorCount: true,
        completedAt: true,
        createdAt: true,
        subjects: {
          select: {
            status: true,
            hits: { select: { reviewStatus: true } },
          },
        },
      },
    },
  });

@Injectable()
export class CmpService {
  private readonly logger = new Logger(CmpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly inbox?: InboxService,
    @Optional() private readonly email?: SystemEmailService,
    @Optional()
    private readonly budgetExchangeRates?: CmpBudgetExchangeRatesService,
    @Optional()
    private readonly entityGraph?: CmpEntityGraphService,
    @Optional()
    private readonly aml?: CmpAmlService
  ) {}

  async getBudgetExchangeRates() {
    if (!this.budgetExchangeRates) {
      return { rates: [] };
    }
    return { rates: await this.budgetExchangeRates.latest() };
  }

  async getSettingsExchangeRates(user: RequestUser) {
    if (!this.budgetExchangeRates) {
      throw new ApiBadRequestException(
        "CMP_EXCHANGE_RATE_UNAVAILABLE",
        "CMP exchange rates are unavailable"
      );
    }
    return this.budgetExchangeRates.settings(user);
  }

  async refreshSettingsExchangeRates(
    user: RequestUser,
    source?: AuditLogSource
  ) {
    if (!this.budgetExchangeRates) {
      throw new ApiBadRequestException(
        "CMP_EXCHANGE_RATE_UNAVAILABLE",
        "CMP exchange rates are unavailable"
      );
    }
    return this.budgetExchangeRates.refresh(user, source);
  }

  async updateSettingsExchangeRateFallback(
    user: RequestUser,
    input: UpdateCmpBudgetExchangeRateFallbackInput,
    source?: AuditLogSource
  ) {
    if (!this.budgetExchangeRates) {
      throw new ApiBadRequestException(
        "CMP_EXCHANGE_RATE_UNAVAILABLE",
        "CMP exchange rates are unavailable"
      );
    }
    return this.budgetExchangeRates.updateFallback(user, input, source);
  }

  async dashboard(user?: RequestUser) {
    if (user?.globalRole !== "SUPER_ADMIN") {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "CMP Dashboard is available to IT administrators only"
      );
    }
    const [
      clientCount,
      engagementCount,
      draftsCount,
      approvalsCount,
      returnedCount,
      recentApprovals,
    ] = await Promise.all([
      this.prisma.cmpClient.count(),
      this.prisma.cmpEngagement.count(),
      user
        ? this.prisma.cmpAcceptanceRequest.count({
            where: {
              OR: [
                { submittedById: user.id },
                { draftAssigneeId: user.id, draftCompletedAt: null },
              ],
              status: { in: [...MIC_EDITABLE_ACCEPTANCE_STATUSES] },
            },
          })
        : 0,
      user
        ? this.prisma.cmpAcceptanceRequest.count({
            where: buildApprovalWhere(user.id),
          })
        : 0,
      user
        ? this.prisma.cmpAcceptanceRequest.count({
            where: { submittedById: user.id, status: "RETURNED" },
          })
        : 0,
      user
        ? this.prisma.cmpAcceptanceRequest.findMany({
            where: {
              OR: [
                { submittedById: user.id },
                { micApproverId: user.id },
                { picApproverId: user.id },
                { itApproverId: user.id },
                { draftAssigneeId: user.id },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
          })
        : [],
    ]);
    return {
      draftsAssignedToMe: draftsCount,
      approvalsAssignedToMe: approvalsCount,
      returnedRequests: returnedCount,
      myClients: clientCount,
      myEngagements: engagementCount,
      recentChanges: [],
      recentApprovals: recentApprovals.map((request) => ({
        id: request.id,
        type: "approval" as const,
        title: `${request.requestNo} ${request.status.replaceAll("_", " ")}`,
        subtitle: getAcceptanceTypeLabel(request.type),
        timestamp: request.updatedAt.toISOString(),
      })),
    };
  }

  async listClientGroups() {
    const groups = await this.prisma.cmpClientGroup.findMany({
      orderBy: [{ status: "asc" }, { groupCode: "asc" }],
      include: GROUP_INCLUDE,
    });

    return CmpClientGroupsResponseSchema.parse({
      groups: groups.map(formatClientGroup),
    });
  }

  async getClientGroupStructure(id: string) {
    const group = await this.prisma.cmpClientGroup.findUnique({
      where: { id },
      include: {
        ...GROUP_INCLUDE,
        clients: {
          orderBy: [{ clientCode: "asc" }],
          select: {
            ...CLIENT_SUMMARY_SELECT,
            parentClientCode: true,
            subsidiariesOrAssociates: true,
          },
        },
        relationships: {
          include: RELATIONSHIP_INCLUDE,
          orderBy: [{ type: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!group) {
      throw new ApiNotFoundException("NOT_FOUND", "Client group was not found");
    }

    const externalRelationships =
      await this.prisma.cmpClientRelationship.findMany({
        where: {
          groupId: { not: id },
          OR: [
            {
              type: { in: ["ASSOCIATE", "JOINT_VENTURE"] },
              fromClient: { groupId: id },
            },
            {
              type: { in: ["ASSOCIATE", "JOINT_VENTURE"] },
              toClient: { groupId: id },
            },
          ],
        },
        include: RELATIONSHIP_INCLUDE,
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
      });
    const relationships = [
      ...new Map(
        [...group.relationships, ...externalRelationships].map(
          (relationship) => [relationship.id, relationship]
        )
      ).values(),
    ].map(formatClientRelationship);
    const activeRelationships = relationships.filter(
      (relationship) => relationship.effectiveTo === null
    );
    const subsidiaryRelationships = activeRelationships.filter(
      (relationship) => relationship.type === "SUBSIDIARY"
    );
    const incoming = new Map(
      subsidiaryRelationships.map((relationship) => [
        relationship.toClientId,
        relationship,
      ])
    );
    const childrenByParent = new Map<string, typeof subsidiaryRelationships>();
    for (const relationship of subsidiaryRelationships) {
      const children = childrenByParent.get(relationship.fromClientId) ?? [];
      children.push(relationship);
      childrenByParent.set(relationship.fromClientId, children);
    }
    const clientsById = new Map(
      group.clients.map((client) => [client.id, formatClientSummary(client)])
    );
    const visited = new Set<string>();
    const buildNode = (
      clientId: string,
      relationship: (typeof subsidiaryRelationships)[number] | null,
      ancestors: Set<string>
    ): unknown => {
      const client = clientsById.get(clientId);
      if (!client) {
        return null;
      }
      visited.add(clientId);
      if (ancestors.has(clientId)) {
        return { client, relationship, children: [] };
      }
      const nextAncestors = new Set(ancestors).add(clientId);
      return {
        client,
        relationship,
        children: (childrenByParent.get(clientId) ?? [])
          .map((childRelationship) =>
            buildNode(
              childRelationship.toClientId,
              childRelationship,
              nextAncestors
            )
          )
          .filter(Boolean),
      };
    };
    const orderedRoots = group.clients.filter(
      (client) =>
        client.id === group.ultimateParentClientId || !incoming.has(client.id)
    );
    orderedRoots.sort((left, right) => {
      if (left.id === group.ultimateParentClientId) {
        return -1;
      }
      if (right.id === group.ultimateParentClientId) {
        return 1;
      }
      return left.clientCode.localeCompare(right.clientCode);
    });
    const subsidiaryTree = orderedRoots
      .map((client) =>
        buildNode(client.id, incoming.get(client.id) ?? null, new Set())
      )
      .filter(Boolean);
    for (const client of group.clients) {
      if (!visited.has(client.id)) {
        const node = buildNode(
          client.id,
          incoming.get(client.id) ?? null,
          new Set()
        );
        if (node) {
          subsidiaryTree.push(node);
        }
      }
    }

    const warnings: {
      code:
        | "ULTIMATE_PARENT_NOT_ASSIGNED"
        | "LEGACY_PARENT_UNRESOLVED"
        | "LEGACY_RELATIONSHIP_NOTE";
      message: string;
      clientId: string | null;
    }[] = [];
    if (!group.ultimateParent) {
      warnings.push({
        code: "ULTIMATE_PARENT_NOT_ASSIGNED",
        message: "Ultimate Parent has not been assigned",
        clientId: null,
      });
    }
    for (const client of group.clients) {
      if (
        normalizeOptional(client.parentClientCode) &&
        !incoming.has(client.id)
      ) {
        warnings.push({
          code: "LEGACY_PARENT_UNRESOLVED",
          message: `Legacy Parent Client Code for ${client.clientCode} requires review`,
          clientId: client.id,
        });
      }
      if (normalizeOptional(client.subsidiariesOrAssociates)) {
        warnings.push({
          code: "LEGACY_RELATIONSHIP_NOTE",
          message: `Legacy relationship note for ${client.clientCode} requires review`,
          clientId: client.id,
        });
      }
    }

    return CmpClientGroupStructureSchema.parse({
      group: formatClientGroup(group),
      ultimateParent: group.ultimateParent
        ? formatClientSummary(group.ultimateParent)
        : null,
      subsidiaryTree,
      associates: activeRelationships.filter(
        (relationship) => relationship.type === "ASSOCIATE"
      ),
      jointVentures: activeRelationships.filter(
        (relationship) => relationship.type === "JOINT_VENTURE"
      ),
      relationshipHistory: relationships.filter(
        (relationship) => relationship.effectiveTo !== null
      ),
      warnings,
    });
  }

  async listUsers() {
    await Promise.resolve();
    return this.prisma.user.findMany({
      where: { status: "ACTIVE", globalRole: { not: "SUPER_ADMIN" } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: USER_REF_SELECT,
    });
  }

  async createClientGroup(
    input: CreateCmpClientGroupInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    assertCmpGroupAdmin(user);
    try {
      const group = await this.prisma.cmpClientGroup.create({
        data: {
          groupCode: input.groupCode,
          nameZh: input.nameZh ?? "",
          nameEn: normalizeOptional(input.nameEn),
          createdById: user.id,
        },
        include: GROUP_INCLUDE,
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_CLIENT_GROUP_CREATED",
        targetType: "CMP_CLIENT_GROUP",
        targetId: group.id,
        description: `Created CMP client group ${group.groupCode}`,
        source,
      });
      return formatClientGroup(group);
    } catch (error) {
      handleDuplicateCode(error, "Client group code already exists");
      throw error;
    }
  }

  async updateClientGroup(
    id: string,
    input: UpdateCmpClientGroupInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    assertCmpGroupAdmin(user);
    await this.ensureClientGroupExists(id);
    try {
      const data: Prisma.CmpClientGroupUpdateInput = {
        ...(input.groupCode ? { groupCode: input.groupCode } : {}),
        ...(input.nameZh === undefined ? {} : { nameZh: input.nameZh.trim() }),
        ...(input.nameEn === undefined
          ? {}
          : { nameEn: normalizeOptional(input.nameEn) }),
        ...(input.status ? { status: input.status as CmpMasterStatus } : {}),
      };
      const group = (await this.prisma.cmpClientGroup.update({
        where: { id },
        data,
        include: GROUP_INCLUDE,
      })) as ClientGroupWithCount;
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_CLIENT_GROUP_UPDATED",
        targetType: "CMP_CLIENT_GROUP",
        targetId: group.id,
        description: `Updated CMP client group ${group.groupCode}`,
        source,
      });
      return formatClientGroup(group);
    } catch (error) {
      handleDuplicateCode(error, "Client group code already exists");
      throw error;
    }
  }

  async listClients(query: CmpClientListQuery = {}) {
    const where: Prisma.CmpClientWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    const groupId = normalizeOptional(query.groupId);
    if (groupId) {
      where.groupId = groupId;
    }
    const search = normalizeOptional(query.q);
    if (search) {
      where.OR = [
        { clientCode: { contains: search, mode: "insensitive" } },
        { nameZh: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { companyCode: { contains: search, mode: "insensitive" } },
        { companyNumber: { contains: search, mode: "insensitive" } },
        { group: { groupCode: { contains: search, mode: "insensitive" } } },
        { group: { nameZh: { contains: search, mode: "insensitive" } } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { clientPartnerPic: { contains: search, mode: "insensitive" } },
        { clientManagerMic: { contains: search, mode: "insensitive" } },
      ];
    }

    const clients = await this.prisma.cmpClient.findMany({
      where,
      orderBy: [{ status: "asc" }, { clientCode: "asc" }],
      include: CLIENT_INCLUDE,
    });

    return CmpClientsResponseSchema.parse({
      clients: clients.map(formatClient),
    });
  }

  async getClient(id: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id },
      include: CLIENT_INCLUDE,
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    return formatClient(client);
  }

  async getClientPreview(id: string, locale: CmpRecordPreviewLocale) {
    const client = await this.getClient(id);
    return buildClientPreviewDocument(client, locale);
  }

  async exportClientPreviewPdf(id: string, locale: CmpRecordPreviewLocale) {
    const document = await this.getClientPreview(id, locale);
    return compileRecordPreviewPdf(
      document,
      `${safeFileName(document.code)}-client-profile.pdf`,
      "CLIENT_PREVIEW_PDF_FAILED"
    );
  }

  async listClientVersions(id: string, query: CmpClientVersionListQuery) {
    await this.prisma.$transaction((tx) =>
      this.ensureClientVersionBaseline(tx, id)
    );
    const client = await this.prisma.cmpClient.findUnique({
      where: { id },
      include: CLIENT_INCLUDE,
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    const versions = await this.prisma.cmpClientVersion.findMany({
      where: { clientId: id },
      include: { acceptanceRequest: { select: { requestNo: true } } },
      orderBy: [{ versionNumber: "desc" }],
    });
    const filtered = versions.filter((version) =>
      matchesClientVersionFilter(version, query)
    );
    const start = (query.page - 1) * query.pageSize;
    return CmpClientVersionsResponseSchema.parse({
      client: formatClient(client),
      currentVersion: versions[0] ? formatClientVersion(versions[0]) : null,
      versions: filtered
        .slice(start, start + query.pageSize)
        .map(formatClientVersion),
      total: filtered.length,
    });
  }

  async getClientVersion(clientId: string, versionId: string) {
    const version = await this.findClientVersion(clientId, versionId);
    return CmpClientVersionDetailSchema.parse({
      ...formatClientVersion(version),
      snapshot: CmpClientSchema.parse(version.snapshotJson),
    });
  }

  async compareClientVersionToCurrent(clientId: string, versionId: string) {
    const [version, current] = await Promise.all([
      this.findClientVersion(clientId, versionId),
      this.prisma.cmpClientVersion.findFirst({
        where: { clientId },
        include: { acceptanceRequest: { select: { requestNo: true } } },
        orderBy: [{ versionNumber: "desc" }],
      }),
    ]);
    if (!current) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Client version was not found"
      );
    }
    const selected = CmpClientSchema.parse(version.snapshotJson);
    const latest = CmpClientSchema.parse(current.snapshotJson);
    return {
      version: formatClientVersion(version),
      currentVersion: formatClientVersion(current),
      isCurrent: version.id === current.id,
      changes: buildAcceptanceChangeSummary({
        type: "CLIENT_CHANGE",
        baseline: selected,
        proposed: latest,
        baselineCapturedAt: version.approvedAt ?? version.createdAt,
        staleMasterData: false,
      }),
    };
  }

  async exportClientVersionPdf(clientId: string, versionId: string) {
    const version = await this.findClientVersion(clientId, versionId);
    const snapshot = CmpClientSchema.parse(version.snapshotJson);
    const current = await this.prisma.cmpClientVersion.findFirst({
      where: { clientId },
      orderBy: [{ versionNumber: "desc" }],
    });
    const comparison = current
      ? buildAcceptanceChangeSummary({
          type: "CLIENT_CHANGE",
          baseline: snapshot,
          proposed: CmpClientSchema.parse(current.snapshotJson),
          baselineCapturedAt: version.approvedAt ?? version.createdAt,
          staleMasterData: false,
        })
      : null;
    const comparisonRows =
      comparison?.groups.flatMap((group) => group.changes) ?? [];
    const comparisonContent =
      current?.id === version.id
        ? "#heading(level: 2)[Current version]\nThis is the current approved version."
        : `#heading(level: 2)[Differences from current version]\n${comparisonRows.length > 0 ? `#list(${comparisonRows.map((change) => `[${typstText(`${change.field}: ${formatPdfValue(change.before)} -> ${formatPdfValue(change.after)}`)}]`).join(", ")})` : "No differences from the current version."}`;
    const rows = Object.entries(snapshot)
      .filter(([key]) => !["id", "relationships", "addresses"].includes(key))
      .map(([key, value]) => [key, formatPdfValue(value)] as const);
    const addressRows = (snapshot.addresses ?? []).map(
      (address) =>
        [
          `${address.type}${address.label ? ` - ${address.label}` : ""}`,
          address.address,
        ] as const
    );
    const heading = `${snapshot.clientCode} - ${snapshot.nameEn || snapshot.nameZh}`;
    const source = `#set page(margin: 16mm)\n#set text(size: 9pt)\n#heading(level: 1)[Client version ${version.versionNumber}]\n#text(fill: rgb(93, 107, 130))[${typstText(heading)}]\n#v(3mm)\n#table(columns: (45mm, 1fr), stroke: rgb(217, 224, 232), inset: 2mm, ${[
      ["Version", `v${version.versionNumber}`],
      ["Request", version.acceptanceRequest?.requestNo ?? "Baseline"],
      ["Changed by", version.changedByName],
      ["Approved by", version.approvedByName ?? "System migration"],
      [
        "Approved at",
        version.approvedAt?.toISOString() ?? version.createdAt.toISOString(),
      ],
      ...rows,
      ...addressRows,
    ]
      .map(
        ([label, value]) =>
          `[#text(weight: "bold")[${typstText(label)}]], [${typstText(value)}]`
      )
      .join(",\n")})\n#v(5mm)\n${comparisonContent}`;
    try {
      const compiler = NodeCompiler.create();
      const compiled = compiler.compile({ mainFileContent: source });
      if (compiled.hasError() || !compiled.result) {
        throw new Error("Typst compilation failed");
      }
      return {
        fileName: `${safeFileName(snapshot.clientCode)}-v${version.versionNumber}.pdf`,
        body: Buffer.from(compiler.pdf(compiled.result)),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: "CLIENT_VERSION_PDF_FAILED",
        message: "Client version PDF export is temporarily unavailable",
      });
    }
  }

  async createClient(
    input: CreateCmpClientInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    assertAtLeastOneClientName(input.nameEn, input.nameZh);
    const companyCode = normalizeOptional(input.companyCode);
    if (!companyCode) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Company Code is required when creating a Client"
      );
    }
    await assertCompanyCodeAvailable(this.prisma, companyCode);
    const groupId = normalizeOptional(input.groupId);
    if (groupId) {
      await this.ensureClientGroupExists(groupId);
    }
    try {
      const contacts = normalizeClientContacts(input);
      const [primaryContact] = contacts;
      const responsiblePeople = await buildClientResponsiblePersonData(
        this.prisma,
        input,
        false
      );
      const client = (await this.prisma.cmpClient.create({
        data: {
          clientCode: input.clientCode,
          companyCode,
          companyIdentifierType:
            input.companyIdentifierType ?? "COMPANY_REGISTRATION_NUMBER",
          companyNumber: normalizeOptional(input.companyNumber),
          nameZh: normalizeOptional(input.nameZh),
          nameEn: normalizeOptional(input.nameEn),
          groupId,
          groupMode: normalizeOptional(input.groupMode),
          groupName: normalizeOptional(input.groupName),
          address: normalizeOptional(input.address),
          contactPerson:
            primaryContact?.name ?? normalizeOptional(input.contactPerson),
          telephone:
            primaryContact?.officePhone ?? normalizeOptional(input.telephone),
          email: primaryContact?.email ?? normalizeOptional(input.email),
          contactPosition:
            primaryContact?.position ??
            normalizeOptional(input.contactPosition),
          contactDepartment:
            primaryContact?.department ??
            normalizeOptional(input.contactDepartment),
          contactMobile:
            primaryContact?.mobile ?? normalizeOptional(input.contactMobile),
          contactRemarks:
            primaryContact?.remarks ?? normalizeOptional(input.contactRemarks),
          contacts:
            contacts.length > 0
              ? { create: contacts.map(contactCreateData) }
              : undefined,
          website: normalizeOptional(input.website),
          yearEndDate: normalizeOptionalDate(input.yearEndDate),
          yearEndMonth: input.yearEndMonth ?? null,
          hsicSectionCode: normalizeOptional(input.hsicSectionCode),
          placeOfIncorporation: normalizeOptional(input.placeOfIncorporation),
          incorporationYearMonth: normalizeOptional(
            input.incorporationYearMonth
          ),
          reportingGaap: normalizeOptional(input.reportingGaap),
          industryOtherDescription:
            input.hsicSectionCode === "OTHER"
              ? normalizeOptional(input.industryOtherDescription)
              : null,
          listedOrPrivate: normalizeOptional(input.listedOrPrivate),
          companyTypeOtherDescription: normalizeOptional(
            input.companyTypeOtherDescription
          ),
          stockExchangeOrListingPlace: normalizeOptional(
            input.stockExchangeOrListingPlace
          ),
          stockCode: normalizeOptional(input.stockCode),
          marketSegment: normalizeOptional(input.marketSegment),
          regulatedEntities: normalizeOptional(input.regulatedEntities),
          regulatedBy: normalizeOptional(input.regulatedBy),
          isSubsidiary: input.isSubsidiary ?? false,
          parentClientCode: normalizeOptional(input.parentClientCode),
          parentHoldingCompanyName: normalizeOptional(
            input.parentHoldingCompanyName
          ),
          hasSubsidiariesOrAssociates:
            input.hasSubsidiariesOrAssociates ?? false,
          subsidiariesOrAssociates: normalizeOptional(
            input.subsidiariesOrAssociates
          ),
          referredBy: normalizeOptional(input.referredBy),
          ...responsiblePeople,
          expectedJobOrEngagementType: normalizeOptional(
            input.expectedJobOrEngagementType
          ),
          serviceType: normalizeOptional(input.serviceType),
          serviceLines: normalizeOptional(input.serviceLines),
          taxServiceDetails: normalizeOptional(input.taxServiceDetails),
          comSecServiceDetails: normalizeOptional(input.comSecServiceDetails),
          otherServiceDescription: normalizeOptional(
            input.otherServiceDescription
          ),
          approvalReferenceNumber: normalizeOptional(
            input.approvalReferenceNumber
          ),
          approvalDate: normalizeOptionalDate(input.approvalDate),
          remarks: normalizeOptional(input.remarks),
          preparedBy: normalizeOptional(input.preparedBy),
          approvedBy: normalizeOptional(input.approvedBy),
          micApproval: normalizeOptional(input.micApproval),
          picApproval: normalizeOptional(input.picApproval),
          itAdmin: normalizeOptional(input.itAdmin),
          signOffDate: normalizeOptionalDate(input.signOffDate),
          status: input.status,
          createdById: user.id,
        },
        include: CLIENT_INCLUDE,
      })) as ClientWithGroup;
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_CLIENT_CREATED",
        targetType: "CMP_CLIENT",
        targetId: client.id,
        description: `Created CMP client ${client.clientCode}`,
        source,
      });
      return formatClient(client);
    } catch (error) {
      handleDuplicateCode(error, "Client code already exists");
      throw error;
    }
  }

  async updateClient(
    id: string,
    input: UpdateCmpClientInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    if (input.status !== undefined) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client status can only be changed through a Client Change request"
      );
    }
    if (input.nameEn !== undefined || input.nameZh !== undefined) {
      const existingClient = await this.prisma.cmpClient.findUnique({
        where: { id },
        select: { id: true, nameEn: true, nameZh: true },
      });
      if (!existingClient) {
        throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
      }
      assertAtLeastOneClientName(
        input.nameEn === undefined
          ? (existingClient.nameEn ?? undefined)
          : input.nameEn,
        input.nameZh === undefined
          ? (existingClient.nameZh ?? undefined)
          : input.nameZh
      );
    } else {
      await this.ensureClientExists(id);
    }
    const groupId =
      input.groupId === undefined
        ? undefined
        : normalizeOptional(input.groupId);
    if (groupId) {
      await this.ensureClientGroupExists(groupId);
    }
    if (input.companyCode !== undefined) {
      await assertCompanyCodeAvailable(this.prisma, input.companyCode, id);
    }
    try {
      const contacts =
        input.contacts === undefined
          ? undefined
          : normalizeClientContacts(input);
      const primaryContact = contacts?.[0];
      const responsiblePeople = await buildClientResponsiblePersonData(
        this.prisma,
        input,
        true
      );
      const client = (await this.prisma.cmpClient.update({
        where: { id },
        data: {
          ...(input.clientCode ? { clientCode: input.clientCode } : {}),
          ...(input.companyCode === undefined
            ? {}
            : { companyCode: normalizeOptional(input.companyCode) }),
          ...(input.companyIdentifierType === undefined
            ? {}
            : { companyIdentifierType: input.companyIdentifierType }),
          ...(input.companyNumber === undefined
            ? {}
            : { companyNumber: normalizeOptional(input.companyNumber) }),
          ...(input.nameZh ? { nameZh: input.nameZh } : {}),
          ...(input.nameEn === undefined
            ? {}
            : { nameEn: normalizeOptional(input.nameEn) }),
          ...(groupId === undefined ? {} : { groupId }),
          ...(input.groupMode === undefined
            ? {}
            : { groupMode: normalizeOptional(input.groupMode) }),
          ...(input.groupName === undefined
            ? {}
            : { groupName: normalizeOptional(input.groupName) }),
          ...(input.address === undefined
            ? {}
            : { address: normalizeOptional(input.address) }),
          ...(input.contacts === undefined
            ? {}
            : {
                contactPerson: primaryContact?.name ?? null,
                telephone: primaryContact?.officePhone ?? null,
                email: primaryContact?.email ?? null,
                contactPosition: primaryContact?.position ?? null,
                contactDepartment: primaryContact?.department ?? null,
                contactMobile: primaryContact?.mobile ?? null,
                contactRemarks: primaryContact?.remarks ?? null,
                contacts: {
                  deleteMany: {},
                  create: (contacts ?? []).map(contactCreateData),
                },
              }),
          ...(input.contacts === undefined && input.contactPerson !== undefined
            ? { contactPerson: normalizeOptional(input.contactPerson) }
            : {}),
          ...(input.contacts === undefined && input.telephone !== undefined
            ? { telephone: normalizeOptional(input.telephone) }
            : {}),
          ...(input.contacts === undefined && input.email !== undefined
            ? { email: normalizeOptional(input.email) }
            : {}),
          ...(input.website === undefined
            ? {}
            : { website: normalizeOptional(input.website) }),
          ...(input.yearEndDate === undefined
            ? {}
            : { yearEndDate: normalizeOptionalDate(input.yearEndDate) }),
          ...(input.placeOfIncorporation === undefined
            ? {}
            : {
                placeOfIncorporation: normalizeOptional(
                  input.placeOfIncorporation
                ),
              }),
          ...(input.incorporationYearMonth === undefined
            ? {}
            : {
                incorporationYearMonth: normalizeOptional(
                  input.incorporationYearMonth
                ),
              }),
          ...(input.reportingGaap === undefined
            ? {}
            : { reportingGaap: normalizeOptional(input.reportingGaap) }),
          ...(input.hsicSectionCode === undefined
            ? {}
            : { hsicSectionCode: normalizeOptional(input.hsicSectionCode) }),
          ...(input.industryOtherDescription === undefined
            ? input.hsicSectionCode !== undefined &&
              input.hsicSectionCode !== "OTHER"
              ? { industryOtherDescription: null }
              : {}
            : {
                industryOtherDescription:
                  input.hsicSectionCode === "OTHER"
                    ? normalizeOptional(input.industryOtherDescription)
                    : null,
              }),
          ...(input.listedOrPrivate === undefined
            ? {}
            : { listedOrPrivate: normalizeOptional(input.listedOrPrivate) }),
          ...(input.companyTypeOtherDescription === undefined
            ? {}
            : {
                companyTypeOtherDescription: normalizeOptional(
                  input.companyTypeOtherDescription
                ),
              }),
          ...(input.stockExchangeOrListingPlace === undefined
            ? {}
            : {
                stockExchangeOrListingPlace: normalizeOptional(
                  input.stockExchangeOrListingPlace
                ),
              }),
          ...(input.stockCode === undefined
            ? {}
            : { stockCode: normalizeOptional(input.stockCode) }),
          ...(input.marketSegment === undefined
            ? {}
            : { marketSegment: normalizeOptional(input.marketSegment) }),
          ...(input.regulatedEntities === undefined
            ? {}
            : {
                regulatedEntities: normalizeOptional(input.regulatedEntities),
              }),
          ...(input.regulatedBy === undefined
            ? {}
            : { regulatedBy: normalizeOptional(input.regulatedBy) }),
          ...(input.isSubsidiary === undefined
            ? {}
            : { isSubsidiary: input.isSubsidiary }),
          ...(input.parentClientCode === undefined
            ? {}
            : {
                parentClientCode: normalizeOptional(input.parentClientCode),
              }),
          ...(input.parentHoldingCompanyName === undefined
            ? {}
            : {
                parentHoldingCompanyName: normalizeOptional(
                  input.parentHoldingCompanyName
                ),
              }),
          ...(input.hasSubsidiariesOrAssociates === undefined
            ? {}
            : {
                hasSubsidiariesOrAssociates: input.hasSubsidiariesOrAssociates,
              }),
          ...(input.subsidiariesOrAssociates === undefined
            ? {}
            : {
                subsidiariesOrAssociates: normalizeOptional(
                  input.subsidiariesOrAssociates
                ),
              }),
          ...(input.referredBy === undefined
            ? {}
            : { referredBy: normalizeOptional(input.referredBy) }),
          ...responsiblePeople,
          ...(input.expectedJobOrEngagementType === undefined
            ? {}
            : {
                expectedJobOrEngagementType: normalizeOptional(
                  input.expectedJobOrEngagementType
                ),
              }),
          ...(input.serviceType === undefined
            ? {}
            : { serviceType: normalizeOptional(input.serviceType) }),
          ...(input.serviceLines === undefined
            ? {}
            : { serviceLines: normalizeOptional(input.serviceLines) }),
          ...(input.taxServiceDetails === undefined
            ? {}
            : {
                taxServiceDetails: normalizeOptional(input.taxServiceDetails),
              }),
          ...(input.comSecServiceDetails === undefined
            ? {}
            : {
                comSecServiceDetails: normalizeOptional(
                  input.comSecServiceDetails
                ),
              }),
          ...(input.otherServiceDescription === undefined
            ? {}
            : {
                otherServiceDescription: normalizeOptional(
                  input.otherServiceDescription
                ),
              }),
          ...(input.approvalReferenceNumber === undefined
            ? {}
            : {
                approvalReferenceNumber: normalizeOptional(
                  input.approvalReferenceNumber
                ),
              }),
          ...(input.approvalDate === undefined
            ? {}
            : { approvalDate: normalizeOptionalDate(input.approvalDate) }),
          ...(input.remarks === undefined
            ? {}
            : { remarks: normalizeOptional(input.remarks) }),
          ...(input.preparedBy === undefined
            ? {}
            : { preparedBy: normalizeOptional(input.preparedBy) }),
          ...(input.approvedBy === undefined
            ? {}
            : { approvedBy: normalizeOptional(input.approvedBy) }),
          ...(input.micApproval === undefined
            ? {}
            : { micApproval: normalizeOptional(input.micApproval) }),
          ...(input.picApproval === undefined
            ? {}
            : { picApproval: normalizeOptional(input.picApproval) }),
          ...(input.itAdmin === undefined
            ? {}
            : { itAdmin: normalizeOptional(input.itAdmin) }),
          ...(input.signOffDate === undefined
            ? {}
            : { signOffDate: normalizeOptionalDate(input.signOffDate) }),
          ...(input.status ? { status: input.status } : {}),
        },
        include: CLIENT_INCLUDE,
      })) as ClientWithGroup;
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_CLIENT_UPDATED",
        targetType: "CMP_CLIENT",
        targetId: client.id,
        description: `Updated CMP client ${client.clientCode}`,
        source,
      });
      return formatClient(client);
    } catch (error) {
      handleDuplicateCode(error, "Client code already exists");
      throw error;
    }
  }

  async listEngagements(query: CmpEngagementListQuery = {}) {
    const where: Prisma.CmpEngagementWhereInput = {};
    const clientId = normalizeOptional(query.clientId);
    if (clientId) {
      where.clientId = clientId;
    }
    where.status = query.status ?? { not: "ARCHIVED" };
    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }
    if (query.availableForProject) {
      where.status = "ACTIVE";
      where.client = { status: "ACTIVE" };
      where.picUser = {
        is: {
          status: "ACTIVE",
          globalRole: { in: ["PARTNER", "PRINCIPAL"] },
        },
      };
      where.micUser = {
        is: { status: "ACTIVE", globalRole: "MANAGER" },
      };
    }
    const search = normalizeOptional(query.q);
    if (search) {
      where.OR = [
        { engagementCode: { contains: search, mode: "insensitive" } },
        { pic: { contains: search, mode: "insensitive" } },
        { mic: { contains: search, mode: "insensitive" } },
        { client: { clientCode: { contains: search, mode: "insensitive" } } },
        { client: { nameZh: { contains: search, mode: "insensitive" } } },
        { client: { nameEn: { contains: search, mode: "insensitive" } } },
      ];
    }

    const engagements = await this.prisma.cmpEngagement.findMany({
      where,
      orderBy: [{ status: "asc" }, { engagementCode: "asc" }],
      include: ENGAGEMENT_INCLUDE,
    });

    return CmpEngagementsResponseSchema.parse({
      engagements: engagements.map(formatEngagement),
    });
  }

  async resolveEngagementForProjectCode(code: string) {
    const engagement = await this.prisma.cmpEngagement.findFirst({
      where: {
        engagementCode: { equals: code.trim(), mode: "insensitive" },
        status: "ACTIVE",
        client: { status: "ACTIVE" },
      },
      include: ENGAGEMENT_INCLUDE,
    });
    if (!engagement) {
      throw new ApiNotFoundException(
        "CMP_ENGAGEMENT_NOT_AVAILABLE",
        "The Engagement Code is not active or does not exist"
      );
    }
    const [pic, mic] = await Promise.all([
      engagement.picUserId
        ? this.prisma.user.findUnique({
            where: { id: engagement.picUserId },
            select: USER_REF_SELECT,
          })
        : null,
      engagement.micUserId
        ? this.prisma.user.findUnique({
            where: { id: engagement.micUserId },
            select: USER_REF_SELECT,
          })
        : null,
    ]);
    if (
      !pic ||
      pic.status !== "ACTIVE" ||
      !["PARTNER", "PRINCIPAL"].includes(pic.globalRole) ||
      !mic ||
      mic.status !== "ACTIVE" ||
      mic.globalRole !== "MANAGER"
    ) {
      throw new ApiBadRequestException(
        "CMP_ENGAGEMENT_RESPONSIBLE_USERS_INVALID",
        "The Engagement Code requires active PIC and MIC users"
      );
    }
    return formatEngagement(engagement);
  }

  async listTmsEngagements(
    query: TmsEngagementDirectoryQuery | undefined,
    user: RequestUser
  ) {
    const search = normalizeOptional(query?.q);
    const normalizedSearch = search ? normalizeEngagementCode(search) : null;
    if (!search) {
      return TmsEngagementDirectoryResponseSchema.parse({ engagements: [] });
    }
    const where: Prisma.CmpEngagementWhereInput = {
      status: { in: ["ACTIVE", "ARCHIVED"] },
      OR: [
        { engagementCode: { contains: search, mode: "insensitive" } },
        {
          client: {
            clientCode: { contains: search, mode: "insensitive" },
          },
        },
        { client: { nameZh: { contains: search, mode: "insensitive" } } },
        { client: { nameEn: { contains: search, mode: "insensitive" } } },
        {
          codeAliases: {
            some: {
              normalizedCode: {
                contains: normalizedSearch ?? search,
              },
            },
          },
        },
        {
          projects: {
            some: {
              status: "ACTIVE",
              OR: [
                { projectCode: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    };
    const engagements = await this.prisma.cmpEngagement.findMany({
      where,
      orderBy: { engagementCode: "asc" },
      include: ENGAGEMENT_INCLUDE,
    });
    const engagementIds = engagements.map((engagement) => engagement.id);
    const projects = await this.prisma.project.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          ...(engagementIds.length > 0
            ? [{ cmpEngagementId: { in: engagementIds } }]
            : []),
          {
            AND: [
              { cmpEngagementId: null },
              {
                members: {
                  some: { userId: user.id, status: "ACTIVE" },
                },
              },
              {
                OR: [
                  { projectCode: { contains: search, mode: "insensitive" } },
                  { name: { contains: search, mode: "insensitive" } },
                ],
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        cmpClientId: true,
        cmpEngagementId: true,
        members: {
          where: { userId: user.id, status: "ACTIVE" },
          select: { joinedAt: true },
        },
      },
    });
    const projectIds = projects
      .filter((project) => project.cmpEngagementId)
      .map((project) => project.id);
    const declarations =
      projectIds.length > 0
        ? await this.prisma.independenceDeclaration.findMany({
            where: {
              userId: user.id,
              projectId: { in: projectIds },
              declarationVersion: "v1",
            },
            orderBy: { acceptedAt: "desc" },
            select: { projectId: true, acceptedAt: true },
          })
        : [];
    const declarationsByProjectId = new Map<string, Date[]>();
    for (const declaration of declarations) {
      if (!declaration.projectId) {
        continue;
      }
      const existing = declarationsByProjectId.get(declaration.projectId) ?? [];
      existing.push(declaration.acceptedAt);
      declarationsByProjectId.set(declaration.projectId, existing);
    }
    const projectsByEngagementId = new Map<
      string,
      {
        id: string;
        projectCode: string;
        name: string;
        members: { joinedAt: Date }[];
      }[]
    >();
    for (const project of projects) {
      if (!project.cmpEngagementId) {
        continue;
      }
      const current = projectsByEngagementId.get(project.cmpEngagementId) ?? [];
      current.push(project);
      projectsByEngagementId.set(project.cmpEngagementId, current);
    }

    const directory = [
      ...engagements.flatMap<TmsEngagementDirectoryItem>((engagement) => {
        const linkedProjects = projectsByEngagementId.get(engagement.id) ?? [];
        const base = {
          id: engagement.id,
          engagementCode: engagement.engagementCode,
          clientId: engagement.clientId,
          clientCode: engagement.client.clientCode,
          clientName:
            engagement.client.nameEn || engagement.client.nameZh || "",
          serviceType: engagement.serviceType,
          budgetedHours: engagement.budgetedHours.toFixed(2),
          agreedFee: engagement.agreedFee.toFixed(2),
          recoveryRate: engagement.recoveryRate?.toFixed(2) ?? null,
          feeCurrency: engagement.feeCurrency as CmpBudgetCurrency,
          pic: engagement.pic,
          mic: engagement.mic,
          codeAliases: engagement.codeAliases.map((alias) => alias.code),
        };
        if (linkedProjects.length === 0) {
          return [
            {
              ...base,
              timesheetAccess: resolveTmsTimesheetAccess(
                [],
                declarationsByProjectId
              ),
            },
          ];
        }
        return linkedProjects.map((project) => ({
          ...base,
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.name,
          timesheetAccess: resolveTmsTimesheetAccess(
            [project],
            declarationsByProjectId
          ),
        }));
      }),
      ...projects
        .filter((project) => !project.cmpEngagementId)
        .map((project) => ({
          id: `unlinked:${project.id}`,
          source: "UNLINKED_PROJECT" as const,
          projectId: project.id,
          projectCode: project.projectCode,
          projectName: project.name,
          engagementCode: project.projectCode,
          clientId: project.cmpClientId ?? `project:${project.id}`,
          clientCode: project.projectCode,
          clientName: project.name,
          serviceType: "OTHERS" as const,
          budgetedHours: "0.00",
          agreedFee: "0.00",
          recoveryRate: null,
          feeCurrency: "HKD" as const,
          pic: null,
          mic: null,
          codeAliases: [],
          timesheetAccess: {
            allowed: true,
            reason: "ALLOWED" as const,
          },
        })),
    ].sort(
      (left, right) =>
        left.engagementCode.localeCompare(right.engagementCode) ||
        (left.projectCode ?? "").localeCompare(right.projectCode ?? "")
    );

    return TmsEngagementDirectoryResponseSchema.parse({
      engagements: directory,
    });
  }

  async getTmsEngagementSummary(
    engagementId: string
  ): Promise<TmsEngagementSummary> {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id: engagementId },
      select: { id: true, picUserId: true, micUserId: true },
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }

    const [projects, approvalRows] = await Promise.all([
      this.prisma.project.findMany({
        where: { cmpEngagementId: engagementId, status: "ACTIVE" },
        select: {
          members: {
            where: { status: "ACTIVE" },
            select: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.tmsApprovalSubmission.findMany({
        where: { engagementId },
        orderBy: [{ year: "asc" }, { month: "asc" }, { revision: "desc" }],
        select: {
          ownerUserId: true,
          year: true,
          month: true,
          half: true,
          revision: true,
          status: true,
          submittedRows: true,
        },
      }),
    ]);
    const ownerIds = [
      engagement.picUserId,
      engagement.micUserId,
      ...approvalRows.map((record) => record.ownerUserId),
    ].filter((value): value is string => Boolean(value));
    const userRefs = await this.prisma.user.findMany({
      where: {
        OR: [
          { id: { in: [...new Set(ownerIds)] } },
          { globalRole: { in: ["PARTNER", "MANAGER"] } },
        ],
      },
      select: { id: true, name: true, globalRole: true },
    });
    const userById = new Map(userRefs.map((user) => [user.id, user]));
    const directUserIds = new Set(
      userRefs
        .filter(
          (user) =>
            user.globalRole === "PARTNER" ||
            user.globalRole === "MANAGER" ||
            user.id === engagement.picUserId ||
            user.id === engagement.micUserId
        )
        .map((user) => user.id)
    );
    const directMonths =
      directUserIds.size > 0
        ? await this.prisma.tmsTimesheetMonth.findMany({
            where: { userId: { in: [...directUserIds] } },
            select: {
              userId: true,
              year: true,
              month: true,
              firstStatus: true,
              firstSubmittedRevision: true,
              firstSubmittedRows: true,
              secondStatus: true,
              secondSubmittedRevision: true,
              secondSubmittedRows: true,
            },
          })
        : [];
    const membersById = new Map<string, TmsSummaryMember>();
    for (const project of projects) {
      for (const member of project.members) {
        membersById.set(member.user.id, {
          userId: member.user.id,
          name: member.user.name,
        });
      }
    }
    for (const userId of [engagement.picUserId, engagement.micUserId]) {
      if (!userId) {
        continue;
      }
      const user = userById.get(userId);
      if (user) {
        membersById.set(user.id, { userId: user.id, name: user.name });
      }
    }

    const approvalRecords: TmsSummaryApprovalRecord[] = approvalRows.map(
      (record) => ({
        userId: record.ownerUserId,
        name: userById.get(record.ownerUserId)?.name ?? record.ownerUserId,
        year: record.year,
        month: record.month,
        half: record.half,
        revision: record.revision,
        status: record.status,
        rows: readTmsRows(record.submittedRows),
      })
    );
    const directSubmissions: TmsSummaryApprovalRecord[] = [];
    for (const month of directMonths) {
      const ownerName = userById.get(month.userId)?.name ?? month.userId;
      for (const half of ["FIRST_HALF", "SECOND_HALF"] as const) {
        const prefix = half === "FIRST_HALF" ? "first" : "second";
        const status = month[`${prefix}Status` as const];
        const revision = month[`${prefix}SubmittedRevision` as const];
        if (status === "DRAFT" || revision <= 0) {
          continue;
        }
        directSubmissions.push({
          userId: month.userId,
          name: ownerName,
          year: month.year,
          month: month.month,
          half,
          revision,
          status: status === "APPROVED" ? "APPROVED" : "SUBMITTED",
          rows: readTmsRows(month[`${prefix}SubmittedRows` as const]),
        });
      }
    }

    return TmsEngagementSummarySchema.parse(
      buildTmsEngagementSummary({
        engagementId,
        members: [...membersById.values()],
        approvalRecords,
        directSubmissions,
      })
    );
  }

  async getEngagement(id: string) {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id },
      include: ENGAGEMENT_INCLUDE,
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }
    return formatEngagement(engagement);
  }

  async getEngagementArchiveReview(id: string, user: RequestUser) {
    const engagement = await this.getEngagement(id);
    this.assertArchiveViewer(engagement, user);
    const draftRecord = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    let draft = draftRecord ? formatArchiveDraft(draftRecord) : null;
    const payload = draft
      ? CmpEngagementArchivePayloadSchema.parse(draft.payload)
      : archivePayloadFromEngagement(engagement);
    const costs = await this.buildArchiveCosts(id, engagement, payload);
    if (
      draftRecord?.workflowStatus === "PENDING_PIC" &&
      (draftRecord.sourceUpdatedAt.toISOString() !== engagement.updatedAt ||
        draftRecord.tmsFingerprint !== costs.tmsFingerprint)
    ) {
      const reason =
        draftRecord.sourceUpdatedAt.toISOString() === engagement.updatedAt
          ? "Approved TMS hours changed after submission."
          : "Engagement details changed after submission.";
      await this.returnStaleArchiveDraft(draftRecord.id, user.id, reason);
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_ENGAGEMENT_ARCHIVE_INVALIDATED",
        targetType: "CMP_ENGAGEMENT",
        targetId: id,
        description: `Invalidated pending CMP archive ${engagement.engagementCode}: ${reason}`,
      });
      await this.notifyArchiveActor(
        engagement,
        engagement.micUserId,
        user.id,
        "Archive returned for revision",
        reason
      );
      const refreshed =
        await this.prisma.cmpEngagementArchiveDraft.findUniqueOrThrow({
          where: { id: draftRecord.id },
        });
      draft = formatArchiveDraft(refreshed);
    }
    const blockers = archiveBlockers(
      { ...engagement, feePlanningLines: payload.feePlanningLines ?? [] },
      costs.memberCosts,
      costs.unassignedApprovedUserIds,
      costs.hasUnapprovedTime
    );
    const readiness = buildArchiveReadiness({
      engagement,
      payload,
      costs,
      blockers,
    });
    const workflow = archiveWorkflowCapabilities(engagement, draft, user);
    return CmpEngagementArchiveReviewSchema.parse({
      engagement,
      draft,
      tmsFingerprint: costs.tmsFingerprint,
      memberCosts: costs.memberCosts,
      totals: costs.totals,
      warnings: readiness
        .filter((item) => item.severity === "WARNING")
        .map((item) => archiveReadinessText(item.code)),
      blockers,
      canArchive: workflow.canApprove && blockers.length === 0,
      readiness,
      workflow,
    });
  }

  async saveEngagementArchiveDraft(
    id: string,
    input: CmpEngagementArchiveDraftSaveInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const engagement = await this.getEngagement(id);
    this.assertArchivePreparer(engagement, user);
    this.assertArchiveEligible(engagement.status);
    if (engagement.updatedAt !== input.sourceUpdatedAt) {
      throwArchiveSourceConflict();
    }
    const existing = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    if (existing?.workflowStatus === "PENDING_PIC") {
      throw new ApiConflictException(
        "CMP_ENGAGEMENT_ARCHIVE_PENDING_REVIEW",
        "Archive details are locked while PIC review is pending"
      );
    }
    const draft = await this.prisma.cmpEngagementArchiveDraft.upsert({
      where: { engagementId: id },
      create: {
        engagementId: id,
        payload: input.payload as Prisma.InputJsonValue,
        sourceUpdatedAt: new Date(input.sourceUpdatedAt),
        tmsFingerprint: input.tmsFingerprint,
        editorUserId: user.id,
        workflowStatus: "DRAFT",
      },
      update: {
        payload: input.payload as Prisma.InputJsonValue,
        sourceUpdatedAt: new Date(input.sourceUpdatedAt),
        tmsFingerprint: input.tmsFingerprint,
        editorUserId: user.id,
        workflowStatus: "DRAFT",
        submittedById: null,
        submittedAt: null,
        returnedById: null,
        returnedAt: null,
        returnReason: null,
        overrideReason: null,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ENGAGEMENT_ARCHIVE_DRAFT_SAVED",
      targetType: "CMP_ENGAGEMENT",
      targetId: id,
      description: `Saved archive draft for CMP engagement ${engagement.engagementCode}`,
      source,
    });
    return CmpEngagementArchiveDraftSchema.parse(formatArchiveDraft(draft));
  }

  async deleteEngagementArchiveDraft(
    id: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const engagement = await this.getEngagement(id);
    this.assertArchivePreparer(engagement, user);
    const draft = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    if (draft?.workflowStatus === "PENDING_PIC") {
      throw new ApiConflictException(
        "CMP_ENGAGEMENT_ARCHIVE_PENDING_REVIEW",
        "Archive details cannot be deleted while PIC review is pending"
      );
    }
    await this.prisma.cmpEngagementArchiveDraft.deleteMany({
      where: { engagementId: id },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ENGAGEMENT_ARCHIVE_DRAFT_DELETED",
      targetType: "CMP_ENGAGEMENT",
      targetId: id,
      description: `Deleted archive draft for CMP engagement ${engagement.engagementCode}`,
      source,
    });
    return { deleted: true };
  }

  async submitEngagementArchive(
    id: string,
    input: CmpEngagementArchiveSubmitInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const engagement = await this.getEngagement(id);
    this.assertArchivePreparer(engagement, user);
    this.assertArchiveEligible(engagement.status);
    const draft = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    if (!draft) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive draft was not found"
      );
    }
    if (draft.workflowStatus === "PENDING_PIC") {
      return CmpEngagementArchiveDraftSchema.parse(formatArchiveDraft(draft));
    }
    if (
      engagement.updatedAt !== input.sourceUpdatedAt ||
      draft.sourceUpdatedAt.toISOString() !== input.sourceUpdatedAt
    ) {
      throwArchiveSourceConflict();
    }
    const payload = CmpEngagementArchivePayloadSchema.parse(draft.payload);
    assertArchiveReportDate(payload.reportDate);
    const costs = await this.buildArchiveCosts(id, engagement, payload);
    if (
      costs.tmsFingerprint !== input.tmsFingerprint ||
      draft.tmsFingerprint !== input.tmsFingerprint
    ) {
      throwArchiveTmsConflict();
    }
    const blockers = archiveBlockers(
      { ...engagement, feePlanningLines: payload.feePlanningLines ?? [] },
      costs.memberCosts,
      costs.unassignedApprovedUserIds,
      costs.hasUnapprovedTime
    );
    const readiness = buildArchiveReadiness({
      engagement,
      payload,
      costs,
      blockers,
    });
    const readinessBlockers = readiness
      .filter((item) => item.severity === "BLOCKER")
      .map((item) => item.code);
    if (readinessBlockers.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        readinessBlockers.join(", ")
      );
    }
    const overrideReason = this.requireArchiveOverrideReason(
      engagement,
      user,
      input.overrideReason,
      "prepare"
    );
    const submitted = await this.prisma.cmpEngagementArchiveDraft.update({
      where: { id: draft.id },
      data: {
        workflowStatus: "PENDING_PIC",
        submittedById: user.id,
        submittedAt: new Date(),
        returnedById: null,
        returnedAt: null,
        returnReason: null,
        overrideReason,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ENGAGEMENT_ARCHIVE_SUBMITTED",
      targetType: "CMP_ENGAGEMENT",
      targetId: id,
      description: `Submitted CMP archive for PIC review: ${engagement.engagementCode}${overrideReason ? ` (Super Admin override: ${overrideReason})` : ""}`,
      source,
    });
    await this.notifyArchiveActor(
      engagement,
      engagement.picUserId,
      user.id,
      "Archive review requested",
      `Please review archive ${engagement.engagementCode}.`
    );
    return CmpEngagementArchiveDraftSchema.parse(formatArchiveDraft(submitted));
  }

  async returnEngagementArchive(
    id: string,
    input: CmpEngagementArchiveReturnInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const engagement = await this.getEngagement(id);
    const draft = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    if (!draft || draft.workflowStatus !== "PENDING_PIC") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive is not awaiting PIC review"
      );
    }
    this.assertArchiveReviewer(engagement, user, input.overrideReason);
    if (
      engagement.updatedAt !== input.sourceUpdatedAt ||
      draft.sourceUpdatedAt.toISOString() !== input.sourceUpdatedAt
    ) {
      await this.returnStaleArchiveDraft(
        draft.id,
        user.id,
        "Engagement details changed after submission."
      );
      throwArchiveSourceConflict();
    }
    const costs = await this.buildArchiveCosts(
      id,
      engagement,
      CmpEngagementArchivePayloadSchema.parse(draft.payload)
    );
    if (
      costs.tmsFingerprint !== input.tmsFingerprint ||
      draft.tmsFingerprint !== input.tmsFingerprint
    ) {
      await this.returnStaleArchiveDraft(
        draft.id,
        user.id,
        "Approved TMS hours changed after submission."
      );
      throwArchiveTmsConflict();
    }
    const returned = await this.prisma.cmpEngagementArchiveDraft.update({
      where: { id: draft.id },
      data: {
        workflowStatus: "RETURNED",
        returnedById: user.id,
        returnedAt: new Date(),
        returnReason: input.reason,
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ENGAGEMENT_ARCHIVE_RETURNED",
      targetType: "CMP_ENGAGEMENT",
      targetId: id,
      description: `Returned CMP archive ${engagement.engagementCode}: ${input.reason}`,
      source,
    });
    await this.notifyArchiveActor(
      engagement,
      engagement.micUserId,
      user.id,
      "Archive returned for revision",
      input.reason
    );
    return CmpEngagementArchiveDraftSchema.parse(formatArchiveDraft(returned));
  }

  async archiveEngagement(
    id: string,
    input: CmpEngagementArchiveFinalizeInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const current = await this.getEngagement(id);
    const draft = await this.prisma.cmpEngagementArchiveDraft.findUnique({
      where: { engagementId: id },
    });
    const existing = await this.prisma.cmpEngagementArchiveSnapshot.findUnique({
      where: { engagementId: id },
    });
    if (existing) {
      return this.getEngagementArchiveSnapshot(id);
    }
    this.assertArchiveEligible(current.status);
    if (!draft || draft.id !== input.draftId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive draft was not found"
      );
    }
    if (draft.workflowStatus !== "PENDING_PIC") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Archive is not awaiting PIC review"
      );
    }
    this.assertArchiveReviewer(current, user, input.overrideReason);
    if (
      current.updatedAt !== input.sourceUpdatedAt ||
      draft.sourceUpdatedAt.toISOString() !== input.sourceUpdatedAt
    ) {
      await this.returnStaleArchiveDraft(
        draft.id,
        user.id,
        "Engagement details changed after submission."
      );
      throwArchiveSourceConflict();
    }
    const payload = CmpEngagementArchivePayloadSchema.parse(draft.payload);
    assertArchiveReportDate(payload.reportDate);
    const costs = await this.buildArchiveCosts(id, current, payload);
    if (
      costs.tmsFingerprint !== input.tmsFingerprint ||
      draft.tmsFingerprint !== input.tmsFingerprint
    ) {
      await this.returnStaleArchiveDraft(
        draft.id,
        user.id,
        "Approved TMS hours changed after submission."
      );
      throwArchiveTmsConflict();
    }
    const blockers = archiveBlockers(
      { ...current, feePlanningLines: payload.feePlanningLines ?? [] },
      costs.memberCosts,
      costs.unassignedApprovedUserIds,
      costs.hasUnapprovedTime
    );
    const readiness = buildArchiveReadiness({
      engagement: current,
      payload,
      costs,
      blockers,
    });
    const readinessBlockers = readiness
      .filter((item) => item.severity === "BLOCKER")
      .map((item) => item.code);
    if (readinessBlockers.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        readinessBlockers.join(", ")
      );
    }
    const requiredWarnings = readiness
      .filter((item) => item.severity === "WARNING")
      .map((item) => item.code);
    if (
      requiredWarnings.some(
        (code) => !input.acknowledgedWarnings.includes(code)
      )
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "All archive warnings must be acknowledged before approval"
      );
    }
    const finalized = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.cmpEngagement.findUniqueOrThrow({
          where: { id },
          include: ENGAGEMENT_INCLUDE,
        });
        if (locked.status === "ARCHIVED") {
          return null;
        }
        if (locked.updatedAt.toISOString() !== input.sourceUpdatedAt) {
          throwArchiveSourceConflict();
        }
        const data = await buildCmpEngagementUpdateData(tx, {
          ...payload,
          status: "ARCHIVED",
        });
        await tx.cmpEngagement.update({ where: { id }, data });
        await replaceEngagementFeePlanLines(
          tx,
          id,
          payload.feePlanningLines,
          payload.feeCurrency,
          data.feeExchangeRateSnapshotId as string | null | undefined,
          data.feeExchangeRateHkdPerUnit as string | null | undefined,
          true
        );
        const archived = await tx.cmpEngagement.findUniqueOrThrow({
          where: { id },
          include: ENGAGEMENT_INCLUDE,
        });
        const snapshot = await tx.cmpEngagementArchiveSnapshot.create({
          data: {
            engagementId: id,
            engagementPayload: formatEngagement(
              archived
            ) as Prisma.InputJsonValue,
            currency: costs.totals.currency,
            budgetCost: costs.totals.budgetCost,
            actualCost: costs.totals.actualCost,
            tmsFingerprint: costs.tmsFingerprint,
            archivedById: user.id,
            workflowVersion: 2,
            preparedById: draft.submittedById ?? draft.editorUserId,
            submittedAt: draft.submittedAt,
            approvedById: user.id,
            approvalNote: input.approvalNote ?? null,
            acknowledgedWarnings:
              input.acknowledgedWarnings as Prisma.InputJsonValue,
            memberCosts: {
              create: costs.memberCosts.map((row, sortOrder) => ({
                userId: row.userId,
                userName: row.name,
                userEmail: row.email,
                grade: row.grade,
                historical: row.historical,
                budgetNormal: row.budgetNormal,
                budgetOt: row.budgetOt,
                actualNormal: row.actualNormal,
                actualOt: row.actualOt,
                absent: row.absent,
                hourlyRate: row.hourlyRate,
                budgetCost: row.budgetCost,
                actualCost: row.actualCost,
                currency: row.currency,
                sortOrder,
              })),
            },
          },
        });
        await tx.cmpEngagementArchiveDraft.deleteMany({
          where: { engagementId: id },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "CMP_ENGAGEMENT_ARCHIVED",
            targetType: "CMP_ENGAGEMENT",
            targetId: id,
            description: `Archived CMP engagement ${archived.engagementCode}${input.overrideReason ? ` (Super Admin override: ${input.overrideReason})` : ""}`,
          },
        });
        return snapshot;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    if (!finalized) {
      return this.getEngagementArchiveSnapshot(id);
    }
    void source;
    return this.getEngagementArchiveSnapshot(id);
  }

  async listEngagementArchives(user: RequestUser) {
    const snapshots = await this.prisma.cmpEngagementArchiveSnapshot.findMany({
      where: ["SUPER_ADMIN", "PARTNER"].includes(user.globalRole)
        ? undefined
        : {
            engagement: {
              is: {
                OR: [{ picUserId: user.id }, { micUserId: user.id }],
              },
            },
          },
      orderBy: { archivedAt: "desc" },
      include: { engagement: { include: ENGAGEMENT_INCLUDE } },
    });
    return CmpEngagementArchivesResponseSchema.parse({
      archives: snapshots.map((snapshot) => {
        const engagement = formatEngagement(snapshot.engagement);
        return {
          id: snapshot.id,
          engagementId: snapshot.engagementId,
          engagementCode: engagement.engagementCode,
          clientName:
            engagement.client.nameZh ||
            engagement.client.nameEn ||
            engagement.client.clientCode,
          reportDate: engagement.reportDate,
          pic: engagement.pic,
          archivedAt: snapshot.archivedAt.toISOString(),
          totals: {
            currency: snapshot.currency,
            budgetCost: snapshot.budgetCost.toFixed(2),
            actualCost: snapshot.actualCost.toFixed(2),
          },
        };
      }),
    });
  }

  async getEngagementArchiveSnapshot(id: string, user?: RequestUser) {
    const snapshot = await this.prisma.cmpEngagementArchiveSnapshot.findUnique({
      where: { engagementId: id },
      include: {
        memberCosts: { orderBy: { sortOrder: "asc" } },
        engagement: { select: { picUserId: true, micUserId: true } },
      },
    });
    if (!snapshot) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Engagement archive was not found"
      );
    }
    if (user) {
      this.assertArchiveViewer(snapshot.engagement, user);
    }
    return CmpEngagementArchiveSnapshotSchema.parse({
      id: snapshot.id,
      engagementId: snapshot.engagementId,
      engagement: snapshot.engagementPayload,
      archivedById: snapshot.archivedById,
      archivedAt: snapshot.archivedAt.toISOString(),
      workflowVersion: snapshot.workflowVersion,
      preparedById: snapshot.preparedById,
      submittedAt: snapshot.submittedAt?.toISOString() ?? null,
      approvedById: snapshot.approvedById,
      approvalNote: snapshot.approvalNote,
      acknowledgedWarnings: snapshot.acknowledgedWarnings,
      tmsFingerprint: snapshot.tmsFingerprint,
      totals: {
        currency: snapshot.currency,
        budgetCost: snapshot.budgetCost.toFixed(2),
        actualCost: snapshot.actualCost.toFixed(2),
      },
      memberCosts: snapshot.memberCosts.map((row) => ({
        userId: row.userId,
        name: row.userName,
        email: row.userEmail,
        grade: row.grade,
        historical: row.historical,
        budgetNormal: row.budgetNormal.toFixed(2),
        budgetOt: row.budgetOt.toFixed(2),
        actualNormal: row.actualNormal.toFixed(2),
        actualOt: row.actualOt.toFixed(2),
        absent: row.absent.toFixed(2),
        hourlyRate: row.hourlyRate.toFixed(2),
        budgetCost: row.budgetCost.toFixed(2),
        actualCost: row.actualCost.toFixed(2),
        currency: row.currency,
      })),
    });
  }

  async exportEngagementArchivePdf(id: string, user: RequestUser) {
    const snapshot = await this.getEngagementArchiveSnapshot(id, user);
    try {
      const compiler = NodeCompiler.create();
      const compiled = compiler.compile({
        mainFileContent: buildEngagementArchiveTypst(snapshot),
      });
      if (compiled.hasError() || !compiled.result) {
        throw new Error("Typst compilation failed");
      }
      return {
        fileName: `${safeFileName(snapshot.engagement.engagementCode)}-archive.pdf`,
        body: Buffer.from(compiler.pdf(compiled.result)),
      };
    } catch {
      throw new ApiBadRequestException(
        "ENGAGEMENT_PREVIEW_PDF_FAILED",
        "Archive PDF export is temporarily unavailable"
      );
    }
  }

  async exportEngagementArchiveWorkbook(id: string, user: RequestUser) {
    const snapshot = await this.getEngagementArchiveSnapshot(id, user);
    return {
      fileName: `${safeFileName(snapshot.engagement.engagementCode)}-archive.xlsx`,
      body: await buildEngagementArchiveWorkbook(snapshot),
    };
  }

  private assertArchiveViewer(
    engagement: { picUserId: string | null; micUserId: string | null },
    user: RequestUser
  ) {
    if (
      !["SUPER_ADMIN", "PARTNER"].includes(user.globalRole) &&
      engagement.picUserId !== user.id &&
      engagement.micUserId !== user.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only this Engagement's MIC, PIC, Partner, or a Super Admin can view its archive"
      );
    }
  }

  private assertLegacyFeeNoteViewer(
    engagement: { picUserId: string | null; micUserId: string | null },
    user: RequestUser
  ) {
    if (
      ["PARTNER", "MANAGER", "SUPER_ADMIN"].includes(user.globalRole) ||
      engagement.picUserId === user.id ||
      engagement.micUserId === user.id
    ) {
      return;
    }
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Only this Engagement's MIC, PIC, or Finance users can view its legacy fee note"
    );
  }

  private assertArchivePreparer(
    engagement: { micUserId: string | null },
    user: RequestUser
  ) {
    if (
      !["SUPER_ADMIN", "PARTNER"].includes(user.globalRole) &&
      engagement.micUserId !== user.id
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only this Engagement's MIC, a Partner, or a Super Admin can prepare its archive"
      );
    }
  }

  private assertArchiveReviewer(
    engagement: { picUserId: string | null },
    user: RequestUser,
    overrideReason?: string
  ) {
    if (user.globalRole !== "SUPER_ADMIN" && engagement.picUserId !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only this Engagement's PIC or a Super Admin can approve its archive"
      );
    }
    this.requireArchiveOverrideReason(
      engagement,
      user,
      overrideReason,
      "review"
    );
  }

  private requireArchiveOverrideReason(
    engagement: { picUserId?: string | null; micUserId?: string | null },
    user: RequestUser,
    reason: string | undefined,
    role: "prepare" | "review"
  ) {
    const assignedUserId =
      role === "prepare" ? engagement.micUserId : engagement.picUserId;
    if (user.globalRole === "SUPER_ADMIN" && assignedUserId !== user.id) {
      if (!reason?.trim()) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "A Super Admin must provide an override reason when substituting for the assigned archive role"
        );
      }
      return reason.trim();
    }
    return null;
  }

  private async returnStaleArchiveDraft(
    draftId: string,
    actorId: string,
    reason: string
  ) {
    await this.prisma.cmpEngagementArchiveDraft.update({
      where: { id: draftId },
      data: {
        workflowStatus: "RETURNED",
        returnedById: actorId,
        returnedAt: new Date(),
        returnReason: reason,
      },
    });
  }

  private async notifyArchiveActor(
    engagement: { id: string; engagementCode: string },
    recipientId: string | null,
    senderId: string,
    title: string,
    body: string
  ) {
    if (!recipientId || recipientId === senderId) {
      return;
    }
    await this.inbox?.createCollaborationMessage({
      recipientId,
      senderId,
      type: "SYSTEM_NOTIFICATION",
      title,
      body,
      actionUrl: `/cmp/engagement/${engagement.id}/archive/review`,
      suppressEmail: true,
    });
  }

  private assertArchiveEligible(status: string) {
    if (status !== "ACTIVE" && status !== "COMPLETED") {
      throw new ApiBadRequestException(
        "CMP_ENGAGEMENT_ARCHIVE_NOT_ELIGIBLE",
        "Only active or completed Engagements can be archived"
      );
    }
  }

  private async buildArchiveCosts(
    engagementId: string,
    engagement: Awaited<ReturnType<CmpService["getEngagement"]>>,
    payload: CmpEngagementArchivePayload = archivePayloadFromEngagement(
      engagement
    )
  ) {
    const summary = await this.getTmsEngagementSummary(engagementId);
    const approvedByUser = new Map(
      summary.approved.rows
        .filter((row) => row.userId !== "total")
        .map((row) => [row.userId, row])
    );
    const staffIds = [
      ...new Set(
        (payload.feePlanningLines ?? [])
          .map((line) => line.staffUserId)
          .filter((userId): userId is string => Boolean(userId))
      ),
    ];
    const users =
      staffIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true, email: true, status: true },
          })
        : [];
    const usersById = new Map(users.map((item) => [item.id, item]));
    const memberCosts = (payload.feePlanningLines ?? []).flatMap((line) => {
      const userId = line.staffUserId;
      if (!userId) {
        return [];
      }
      const user = usersById.get(userId);
      const actual = approvedByUser.get(userId);
      const rate = new Prisma.Decimal(line.hourlyRate);
      const budgetNormal = new Prisma.Decimal(line.budgetHours);
      const budgetOt = new Prisma.Decimal(0);
      const actualNormal = new Prisma.Decimal(actual?.finalNormal ?? 0);
      const actualOt = new Prisma.Decimal(actual?.finalOt ?? 0);
      const absent = new Prisma.Decimal(actual?.absent ?? 0);
      return [
        {
          userId,
          name: user?.name ?? userId,
          email: user?.email ?? "",
          grade: line.grade,
          historical: user?.status !== "ACTIVE",
          budgetNormal: budgetNormal.toFixed(2),
          budgetOt: budgetOt.toFixed(2),
          actualNormal: actualNormal.toFixed(2),
          actualOt: actualOt.toFixed(2),
          absent: absent.toFixed(2),
          hourlyRate: rate.toFixed(2),
          budgetCost: budgetNormal
            .plus(budgetOt)
            .mul(rate)
            .toDecimalPlaces(2)
            .toFixed(2),
          actualCost: actualNormal
            .plus(actualOt)
            .mul(rate)
            .toDecimalPlaces(2)
            .toFixed(2),
          currency: payload.feeCurrency,
        },
      ];
    });
    const totals = memberCosts.reduce(
      (total, row) => ({
        budgetCost: total.budgetCost.plus(row.budgetCost),
        actualCost: total.actualCost.plus(row.actualCost),
      }),
      { budgetCost: new Prisma.Decimal(0), actualCost: new Prisma.Decimal(0) }
    );
    const unassignedApprovedUserIds = summary.approved.rows
      .filter(
        (row) =>
          row.userId !== "total" &&
          ((row.finalNormal ?? 0) > 0 || (row.finalOt ?? 0) > 0) &&
          !staffIds.includes(row.userId)
      )
      .map((row) => row.userId);
    const hasDraftHours = summary.draft.rows.some(
      (row) =>
        row.userId !== "total" &&
        ((row.finalNormal ?? 0) > 0 ||
          (row.finalOt ?? 0) > 0 ||
          (row.absent ?? 0) > 0)
    );
    const budgetStaffWithoutApprovedHours = staffIds.some((userId) => {
      const row = approvedByUser.get(userId);
      return !row || ((row.finalNormal ?? 0) <= 0 && (row.finalOt ?? 0) <= 0);
    });
    return {
      tmsFingerprint: archiveTmsFingerprint(summary),
      memberCosts,
      totals: {
        currency: payload.feeCurrency,
        budgetCost: totals.budgetCost.toDecimalPlaces(2).toFixed(2),
        actualCost: totals.actualCost.toDecimalPlaces(2).toFixed(2),
      },
      warnings: hasDraftHours
        ? ["Unapproved TMS hours are excluded from archive costs."]
        : [],
      hasUnapprovedTime: hasDraftHours || budgetStaffWithoutApprovedHours,
      unassignedApprovedUserIds,
    };
  }

  async getEngagementPreview(id: string, locale: CmpRecordPreviewLocale) {
    return buildEngagementPreviewDocument(await this.getEngagement(id), locale);
  }

  async exportEngagementPreviewPdf(id: string, locale: CmpRecordPreviewLocale) {
    const document = await this.getEngagementPreview(id, locale);
    return compileRecordPreviewPdf(
      document,
      `${safeFileName(document.code)}-engagement-profile.pdf`,
      "ENGAGEMENT_PREVIEW_PDF_FAILED"
    );
  }

  async exportEngagementBudgetWorkbook(
    id: string,
    locale: CmpRecordPreviewLocale
  ) {
    const archive = await this.prisma.cmpEngagementArchiveSnapshot.findUnique({
      where: { engagementId: id }, select: { id: true },
    });
    if (!archive) {
      throw new ApiBadRequestException("VALIDATION_FAILED", "The budget workbook can only be exported after the Engagement has been archived");
    }
    const engagement = (await this.getEngagementArchiveSnapshot(id)).engagement;
    const client = await this.prisma.cmpClient.findUnique({
      where: { id: engagement.clientId },
      select: {
        clientCode: true,
        companyCode: true,
        companyNumber: true,
        nameEn: true,
        nameZh: true,
        status: true,
        listedOrPrivate: true,
        placeOfIncorporation: true,
        contactPerson: true,
      },
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    return {
      fileName: `${safeFileName(engagement.engagementCode)}-budget.xlsx`,
      body: await buildEngagementBudgetWorkbook({ engagement, client, locale }),
    };
  }
  async getEngagementFeeNotes(id: string, user?: RequestUser) {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id },
      include: {
        feeNotes: { orderBy: { periodNumber: "asc" } },
        client: {
          include: {
            addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
          },
        },
      },
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }
    if (user) {
      this.assertLegacyFeeNoteViewer(engagement, user);
    }
    return CmpEngagementFeeNotesResponseSchema.parse({
      notes: engagement.feeNotes.map((note) => formatEngagementFeeNote(note)),
      updatedAt: engagement.updatedAt.toISOString(),
    });
  }

  async getEngagementFeeNote(id: string, feeNoteIdOrUser?: string | RequestUser, optionalUser?: RequestUser) {
    const feeNoteId = typeof feeNoteIdOrUser === "string" ? feeNoteIdOrUser : undefined;
    const user = typeof feeNoteIdOrUser === "string" ? optionalUser : feeNoteIdOrUser;
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id }, include: { feeNotes: { orderBy: { periodNumber: "asc" } }, client: { include: { addresses: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] } } } },
    });
    if (!engagement) throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    if (user) this.assertLegacyFeeNoteViewer(engagement, user);
    const persisted = feeNoteId ? engagement.feeNotes.find((note) => note.id === feeNoteId) : engagement.feeNotes[0];
    if (feeNoteId && !persisted) throw new ApiNotFoundException("NOT_FOUND", "Fee note was not found");
    const defaults = buildDefaultEngagementFeeNote(engagement, { periodNumber: persisted?.periodNumber ?? 1, plannedIssueDate: persisted?.plannedIssueDate, plannedAmount: persisted?.plannedAmount });
    return CmpEngagementFeeNoteResponseSchema.parse({
      note: persisted ? formatEngagementFeeNote(persisted) : defaults,
      defaults,
    });
  }

  async createEngagementFeeNote(id: string, input: CreateCmpEngagementFeeNoteInput, user: RequestUser, source?: AuditLogSource) {
    const engagement = await this.prisma.cmpEngagement.findUnique({ where: { id }, select: { status: true, feeCurrency: true } });
    if (!engagement) throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    if (engagement.status === "ARCHIVED") throw new ApiBadRequestException("VALIDATION_FAILED", "Billing plans are frozen after the Engagement has been archived");
    if (input.currency && input.currency !== engagement.feeCurrency) throw new ApiBadRequestException("VALIDATION_FAILED", "Fee note currency must match the Engagement budget currency");
    const note = await this.prisma.cmpEngagementFeeNote.create({ data: { engagementId: id, ...buildEngagementFeeNoteData({ ...input, issueDate: input.issueDate ?? "", lineItems: [{ id: "professional-services", description: "Professional services", amount: input.plannedAmount }], amount: input.plannedAmount, totalAmount: input.plannedAmount, disbursementAmount: "0.00" }) } });
    await this.auditLogs.log({ actorId: user.id, action: "CMP_ENGAGEMENT_FEE_NOTE_CREATED", targetType: "CMP_ENGAGEMENT", targetId: id, description: `Created fee note period ${input.periodNumber} for CMP engagement ${id}`, source });
    return this.getEngagementFeeNote(id, note.id, user);
  }

  async updateEngagementFeeNote(
    id: string,
    input: CmpEngagementFeeNoteUpdateInput,
    user: RequestUser,
    source?: AuditLogSource,
    feeNoteId?: string
  ) {
    const current = await this.getEngagementFeeNote(id, feeNoteId);
    const resolvedInput = mergeLegacyFeeNoteLocalizedContent(
      input,
      current.note
    );
    const note = current.note.id
      ? await this.prisma.cmpEngagementFeeNote.update({ where: { id: current.note.id }, data: buildEngagementFeeNoteData(resolvedInput) })
      : await this.prisma.cmpEngagementFeeNote.create({ data: { engagementId: id, ...buildEngagementFeeNoteData({ ...current.defaults, ...resolvedInput }) } });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ENGAGEMENT_FEE_NOTE_UPDATED",
      targetType: "CMP_ENGAGEMENT",
      targetId: id,
      description: `Updated fee note for CMP engagement ${id}`,
      source,
    });
    return this.getEngagementFeeNote(id, note.id, user);
  }

  async exportEngagementFeeNote(
    id: string,
    locale: CmpFeeNoteLocale,
    format: "pdf" | "docx",
    feeNoteIdOrUser?: string | RequestUser
  ) {
    const { note } = await this.getEngagementFeeNote(id, feeNoteIdOrUser);
    const document = buildFeeNoteExportDocument(note, locale);
    const baseName = safeFileName(
      note.feeNoteNumber || note.engagementReference || "fee-note"
    );
    if (format === "docx") {
      return {
        fileName: `${baseName}-fee-note-${locale}.docx`,
        body: await buildFeeNoteDocx(document),
      };
    }
    try {
      const compiler = NodeCompiler.create();
      const compiled = compiler.compile({
        mainFileContent: buildFeeNotePdfSource(document),
      });
      if (compiled.hasError() || !compiled.result) {
        throw new Error("Typst compilation failed");
      }
      return {
        fileName: `${baseName}-fee-note-${locale}.pdf`,
        body: Buffer.from(compiler.pdf(compiled.result)),
      };
    } catch {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Fee note PDF export is temporarily unavailable"
      );
    }
  }

  async createEngagement(
    input: CreateCmpEngagementInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    await this.ensureClientExists(input.clientId);
    try {
      const engagement = await this.prisma.$transaction(
        async (tx) => {
          await this.ensureEngagementCodeAvailable(
            input.engagementCode,
            undefined,
            tx
          );
          const createdEngagement = await tx.cmpEngagement.create({
            data: {
              ...(await buildCmpEngagementData(tx, input)),
              createdById: user.id,
            },
            include: ENGAGEMENT_INCLUDE,
          });
          if (input.feePlanningLines === undefined) {
            return createdEngagement;
          }
          await replaceEngagementFeePlanLines(
            tx,
            createdEngagement.id,
            input.feePlanningLines,
            input.feeCurrency,
            createdEngagement.feeExchangeRateSnapshotId,
            createdEngagement.feeExchangeRateHkdPerUnit?.toFixed(8)
          );
          return tx.cmpEngagement.findUniqueOrThrow({
            where: { id: createdEngagement.id },
            include: ENGAGEMENT_INCLUDE,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_ENGAGEMENT_CREATED",
        targetType: "CMP_ENGAGEMENT",
        targetId: engagement.id,
        description: `Created CMP engagement ${engagement.engagementCode}`,
        source,
      });
      return formatEngagement(engagement);
    } catch (error) {
      handleDuplicateCode(error, "Engagement code already exists");
      throw error;
    }
  }

  async updateEngagement(
    id: string,
    input: UpdateCmpEngagementInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.ensureEngagementExists(id);
    if (existing.status === "ARCHIVED") {
      throw new ApiBadRequestException(
        "CMP_ENGAGEMENT_ARCHIVED",
        "Archived Engagements can only be viewed through their archive snapshot"
      );
    }
    if (input.clientId) {
      await this.ensureClientExists(input.clientId);
    }
    try {
      const existingWithRisk =
        await this.prisma.cmpEngagement.findUniqueOrThrow({
          where: { id },
          select: {
            engagementRiskClassification: true,
            picUserId: true,
            micUserId: true,
            eqReviewerUserId: true,
            pic: true,
            mic: true,
            eqReviewer: true,
            feeCurrency: true,
            feeExchangeRateSnapshotId: true,
            feeExchangeRateHkdPerUnit: true,
            feeExchangeRateSource: true,
          },
        });
      const responsiblePeople = await buildEngagementResponsiblePersonData(
        this.prisma,
        {
          ...input,
          picUserId: input.picUserId ?? existingWithRisk.picUserId ?? undefined,
          micUserId: input.micUserId ?? existingWithRisk.micUserId ?? undefined,
          eqReviewerUserId:
            input.eqReviewerUserId ??
            existingWithRisk.eqReviewerUserId ??
            undefined,
          pic: input.pic ?? existingWithRisk.pic ?? undefined,
          mic: input.mic ?? existingWithRisk.mic ?? undefined,
          eqReviewer:
            input.eqReviewer ?? existingWithRisk.eqReviewer ?? undefined,
          engagementRiskClassification:
            input.engagementRiskClassification ??
            existingWithRisk.engagementRiskClassification,
        },
        false,
        input.engagementRiskClassification ??
          existingWithRisk.engagementRiskClassification
      );
      const nextCode = input.engagementCode?.trim();
      const shouldUpdateExchangeRate =
        input.feeCurrency !== undefined ||
        input.feeExchangeRateSnapshotId !== undefined ||
        input.feeExchangeRateHkdPerUnit !== undefined ||
        input.feeExchangeRateSource !== undefined;
      const nextExchangeRate = shouldUpdateExchangeRate
        ? await resolveEngagementExchangeRate(
            this.prisma,
            (input.feeCurrency ??
              existingWithRisk.feeCurrency) as CmpBudgetCurrency,
            input.feeExchangeRateSnapshotId ??
              existingWithRisk.feeExchangeRateSnapshotId,
            input.feeExchangeRateHkdPerUnit,
            input.feeExchangeRateSource ??
              (existingWithRisk.feeExchangeRateSource as "SYSTEM" | "MANUAL")
          )
        : null;
      const codeChanged =
        Boolean(nextCode) &&
        normalizeEngagementCode(nextCode ?? "") !==
          normalizeEngagementCode(existing.engagementCode);
      const data: Prisma.CmpEngagementUncheckedUpdateInput = {
        ...(input.clientId ? { clientId: input.clientId } : {}),
        ...(nextCode ? { engagementCode: nextCode } : {}),
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
        ...(input.otherServiceDescription !== undefined ||
        input.serviceType !== undefined
          ? {
              otherServiceDescription:
                input.serviceType === "OTHERS"
                  ? normalizeOptional(input.otherServiceDescription)
                  : null,
            }
          : {}),
        ...(input.deliverables === undefined
          ? {}
          : { deliverables: input.deliverables ?? [] }),
        ...(input.yearEndDate === undefined
          ? {}
          : { yearEndDate: normalizeOptionalDate(input.yearEndDate) }),
        ...(input.reportDate === undefined
          ? {}
          : { reportDate: normalizeOptionalDate(input.reportDate) }),
        ...(input.approvalReferenceNumber === undefined
          ? {}
          : {
              approvalReferenceNumber: normalizeOptional(
                input.approvalReferenceNumber
              ),
            }),
        ...(input.engagementDate === undefined
          ? {}
          : { engagementDate: normalizeOptionalDate(input.engagementDate) }),
        ...(input.budgetedHours === undefined
          ? {}
          : { budgetedHours: input.budgetedHours }),
        ...(input.agreedFee === undefined
          ? {}
          : { agreedFee: input.agreedFee }),
        ...(input.recoveryRate === undefined
          ? {}
          : { recoveryRate: normalizeOptional(input.recoveryRate) }),
        ...(input.feeCurrency === undefined
          ? {}
          : { feeCurrency: input.feeCurrency }),
        ...(nextExchangeRate
          ? {
              feeExchangeRateSnapshotId: nextExchangeRate.snapshotId,
              feeExchangeRateHkdPerUnit: nextExchangeRate.hkdPerUnit,
              feeExchangeRateSource: nextExchangeRate.source,
            }
          : {}),
        ...(input.amlRiskClassification === undefined
          ? {}
          : { amlRiskClassification: input.amlRiskClassification }),
        ...(input.engagementRiskClassification === undefined
          ? {}
          : {
              engagementRiskClassification: input.engagementRiskClassification,
            }),
        ...responsiblePeople,
        ...(input.status ? { status: input.status } : {}),
        ...(input.remarks === undefined
          ? {}
          : { remarks: normalizeOptional(input.remarks) }),
      };
      const replaceFeePlanLines = input.feePlanningLines !== undefined;
      const engagement = (
        codeChanged || replaceFeePlanLines
          ? await this.prisma.$transaction(
              async (tx) => {
                if (codeChanged) {
                  await this.ensureEngagementCodeAvailable(
                    nextCode ?? "",
                    id,
                    tx
                  );
                  await tx.cmpEngagementCodeAlias.deleteMany({
                    where: {
                      engagementId: id,
                      normalizedCode: normalizeEngagementCode(nextCode ?? ""),
                    },
                  });
                  await tx.cmpEngagementCodeAlias.create({
                    data: {
                      engagementId: id,
                      code: existing.engagementCode,
                      normalizedCode: normalizeEngagementCode(
                        existing.engagementCode
                      ),
                    },
                  });
                }
                await tx.cmpEngagement.update({
                  where: { id },
                  data,
                });
                await replaceEngagementFeePlanLines(
                  tx,
                  id,
                  input.feePlanningLines,
                  (input.feeCurrency ??
                    existingWithRisk.feeCurrency) as CmpBudgetCurrency,
                  nextExchangeRate?.snapshotId ??
                    existingWithRisk.feeExchangeRateSnapshotId,
                  nextExchangeRate?.hkdPerUnit ??
                    existingWithRisk.feeExchangeRateHkdPerUnit?.toFixed(8)
                );
                return tx.cmpEngagement.findUniqueOrThrow({
                  where: { id },
                  include: ENGAGEMENT_INCLUDE,
                });
              },
              {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              }
            )
          : await this.prisma.cmpEngagement.update({
              where: { id },
              data,
              include: ENGAGEMENT_INCLUDE,
            })
      ) as EngagementWithClient;
      await this.auditLogs.log({
        actorId: user.id,
        action: "CMP_ENGAGEMENT_UPDATED",
        targetType: "CMP_ENGAGEMENT",
        targetId: engagement.id,
        description: `Updated CMP engagement ${engagement.engagementCode}`,
        source,
      });
      return formatEngagement(engagement);
    } catch (error) {
      handleDuplicateCode(error, "Engagement code already exists");
      throw error;
    }
  }

  async listAcceptance(
    query: CmpAcceptanceListQuery | undefined,
    user: RequestUser
  ) {
    const where = buildAcceptanceWhere(query ?? {});
    if (user.globalRole !== "SUPER_ADMIN") {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        buildAcceptanceVisibilityWhere(user.id),
      ];
    }
    const requests = await this.prisma.cmpAcceptanceRequest.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { requestNo: "desc" }],
      include: ACCEPTANCE_INCLUDE,
    });
    return CmpAcceptanceRequestsResponseSchema.parse({
      requests: requests.map(formatAcceptanceRequest),
    });
  }

  async listMasterDrafts(type: CmpAcceptanceDraftListType, user: RequestUser) {
    const requests = await this.prisma.cmpAcceptanceRequest.findMany({
      where: {
        type,
        status: { in: [...MIC_EDITABLE_ACCEPTANCE_STATUSES] },
        OR: [
          { submittedById: user.id },
          { micApproverId: user.id },
          { draftAssigneeId: user.id },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { requestNo: "desc" }],
      include: ACCEPTANCE_INCLUDE,
    });

    return CmpAcceptanceDraftsResponseSchema.parse({
      drafts: requests
        .filter((request) => canUserSeeMasterDraft(request, user.id))
        .map((request) => {
          const isActiveAssignee =
            request.status === "STAFF_EDITING" &&
            request.draftAssigneeId !== null &&
            request.draftCompletedAt === null;
          const currentOwner = isActiveAssignee
            ? assertPresentValue(request.draftAssignee)
            : resolveAcceptanceDraftControllerId(request) ===
                request.micApproverId
              ? request.micApprover
              : request.submittedBy;
          const isDraftController =
            resolveAcceptanceDraftControllerId(request) === user.id;
          const canEdit =
            (request.status === "STAFF_EDITING" &&
              request.draftAssigneeId === user.id &&
              request.draftCompletedAt === null) ||
            (request.status !== "STAFF_EDITING" && isDraftController);
          const canDelete =
            request.status === "DRAFT" &&
            request.submittedAt === null &&
            isDraftController;

          return {
            request: formatAcceptanceRequest(request),
            displayStatus: "DRAFT" as const,
            currentOwner,
            canEdit,
            canDelete,
          };
        }),
    });
  }

  async listApprovals(user: RequestUser) {
    const requests = await this.prisma.cmpAcceptanceRequest.findMany({
      where: buildApprovalWhere(user.id),
      orderBy: [{ updatedAt: "asc" }, { requestNo: "asc" }],
      include: ACCEPTANCE_INCLUDE,
    });
    return CmpAcceptanceRequestsResponseSchema.parse({
      requests: requests.map(formatAcceptanceRequest),
    });
  }

  async getAcceptance(id: string, user: RequestUser) {
    const request = await this.prisma.cmpAcceptanceRequest.findUnique({
      where: { id },
      include: ACCEPTANCE_INCLUDE,
    });
    if (!request) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Acceptance request was not found"
      );
    }
    if (
      user.globalRole !== "SUPER_ADMIN" &&
      !canUserSeeAcceptanceRequest(request, user.id)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "You do not have access to this acceptance request"
      );
    }
    return formatAcceptanceRequest(request);
  }

  async getAcceptanceChanges(id: string, user: RequestUser) {
    const request = await this.prisma.cmpAcceptanceRequest.findUnique({
      where: { id },
      include: ACCEPTANCE_INCLUDE,
    });
    if (!request) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Acceptance request was not found"
      );
    }
    if (
      user.globalRole !== "SUPER_ADMIN" &&
      !canUserSeeAcceptanceRequest(request, user.id)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "You do not have access to this acceptance request"
      );
    }
    if (!isChangeAcceptanceType(request.type)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Change comparison is only available for Change requests"
      );
    }

    if (!request.changeBaselinePayload) {
      return buildAcceptanceChangeSummary({
        type: request.type,
        baseline: null,
        proposed:
          request.type === "CLIENT_CHANGE"
            ? request.clientPayload
            : request.engagementPayload,
        baselineCapturedAt: null,
        staleMasterData: false,
      });
    }

    const proposed =
      request.type === "CLIENT_CHANGE"
        ? request.clientPayload
        : request.engagementPayload;
    const current = await this.captureCurrentChangeTarget(request);
    const displayLookup = await this.buildChangeDisplayLookup(
      request.changeBaselinePayload,
      proposed
    );
    const staleMasterData = request.approvedAt
      ? current
        ? buildAcceptanceChangeSummary({
            type: request.type,
            baseline: proposed,
            proposed: current.payload,
            baselineCapturedAt: request.changeBaselineCapturedAt,
            staleMasterData: false,
            displayLookup,
          }).changedFieldCount > 0
        : true
      : !current ||
        !request.changeBaselineTargetUpdatedAt ||
        current.updatedAt.getTime() !==
          request.changeBaselineTargetUpdatedAt.getTime();

    return buildAcceptanceChangeSummary({
      type: request.type,
      baseline: request.changeBaselinePayload,
      proposed,
      baselineCapturedAt: request.changeBaselineCapturedAt,
      staleMasterData,
      displayLookup,
    });
  }

  async createAcceptance(
    input: CreateCmpAcceptanceRequestInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    if (!isCmpAcceptanceInitiator(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only a Manager, Senior Manager, or Partner can initiate an acceptance request"
      );
    }
    const isPartnerInitiated = user.globalRole === "PARTNER";
    const draftName = normalizeOptional(input.draftName);
    validateAcceptancePayload(input, {
      requireCompleteEngagement: input.submit === true,
      requireCompleteClient: input.submit === true,
    });
    const routing = input.submit
      ? await this.resolveV2AcceptanceRouting(input, user)
      : isPartnerInitiated
        ? {
            // A Partner may save an unrouted draft. The non-null database
            // Column uses the submitter as an internal placeholder until a
            // Real MIC is selected; submission still validates the handoff.
            micApproverId: normalizeOptional(input.micApproverId)
              ? await this.resolvePartnerMicApproverId(input)
              : user.id,
            picApproverId: null,
            itApproverId: null,
          }
        : {
            micApproverId: user.id,
            picApproverId: null,
            itApproverId: null,
          };
    const normalizedInput = { ...input, ...routing };
    if (isClientAcceptanceType(input.type)) {
      normalizedInput.clientPayload = parseStoredClientAcceptancePayload(
        normalizedInput.clientPayload
      );
    }
    if (input.submit) {
      if (isClientAcceptanceType(input.type)) {
        normalizedInput.clientPayload = await prepareClientGroupStructure(
          this.prisma,
          assertCompleteClientAcceptancePayload(normalizedInput.clientPayload),
          normalizeOptional(input.targetClientId)
        );
      }
      await this.ensureEngagementResponsiblePeople(normalizedInput);
      await this.ensureApprovers({
        micApproverId: routing.micApproverId,
        picApproverId: assertPresentValue(routing.picApproverId),
        itApproverId: assertPresentValue(routing.itApproverId),
      });
    }
    if (input.draftAssigneeId) {
      await this.ensureDraftAssignee(input.draftAssigneeId);
    }
    if (input.submit && input.draftAssigneeId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "An assigned draft must be completed and submitted by the MIC"
      );
    }
    await this.assertNoActiveChangeAcceptance(input);
    const changeBaseline = await this.captureChangeBaseline(input);
    const submittedAt = input.submit ? new Date() : null;
    let request: AcceptanceWithRelations;
    try {
      request = await this.prisma.cmpAcceptanceRequest.create({
        data: {
          requestNo: await this.nextAcceptanceRequestNo(input.type),
          draftName: input.submit ? null : draftName,
          type: input.type,
          status: input.submit
            ? isPartnerInitiated
              ? "PENDING_MIC"
              : "PENDING_PIC"
            : input.draftAssigneeId
              ? "STAFF_EDITING"
              : "DRAFT",
          currentStep: input.submit
            ? isPartnerInitiated
              ? "MIC"
              : "PIC"
            : "MIC",
          submittedById: user.id,
          micApproverId: routing.micApproverId,
          picApproverId: routing.picApproverId,
          itApproverId: routing.itApproverId,
          workflowVersion: 2,
          draftAssigneeId: input.draftAssigneeId,
          targetClientId: isClientAcceptanceType(input.type)
            ? normalizeOptional(input.targetClientId)
            : null,
          targetEngagementId: isEngagementAcceptanceType(input.type)
            ? normalizeOptional(input.targetEngagementId)
            : null,
          clientPayload: isClientAcceptanceType(input.type)
            ? (normalizedInput.clientPayload as Prisma.InputJsonValue)
            : undefined,
          engagementPayload: isEngagementAcceptanceType(input.type)
            ? (normalizedInput.engagementPayload as Prisma.InputJsonValue)
            : undefined,
          changeBaselinePayload: changeBaseline
            ? (changeBaseline.payload as Prisma.InputJsonValue)
            : undefined,
          changeBaselineCapturedAt: changeBaseline?.capturedAt,
          changeBaselineTargetUpdatedAt: changeBaseline?.targetUpdatedAt,
          submittedAt,
          approvalSteps: input.submit
            ? {
                create: isPartnerInitiated
                  ? [
                      {
                        step: "MIC" as const,
                        approverId: routing.micApproverId,
                      },
                    ]
                  : [
                      {
                        step: "MIC" as const,
                        approverId: routing.micApproverId,
                        status: "APPROVED" as const,
                        actedAt: submittedAt,
                      },
                      {
                        step: "PIC" as const,
                        approverId: assertPresentValue(routing.picApproverId),
                      },
                    ],
              }
            : undefined,
        },
        include: ACCEPTANCE_INCLUDE,
      });
    } catch (error) {
      handleActiveChangeAcceptanceConflict(error);
      throw error;
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: input.submit
        ? "CMP_ACCEPTANCE_SUBMITTED"
        : "CMP_ACCEPTANCE_CREATED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `${input.submit ? "Submitted" : "Created"} CMP acceptance ${request.requestNo}`,
      source,
    });
    if (input.submit) {
      await this.notifyV2AcceptanceSubmitted(request, user.name);
    } else if (input.draftAssigneeId) {
      await this.notifyDraftAssigned(request, user.name);
    }
    return formatAcceptanceRequest(request);
  }

  async updateAcceptance(
    id: string,
    input: UpdateCmpAcceptanceRequestInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    const nextDraftName = input.submit
      ? undefined
      : (normalizeOptional(input.draftName) ?? existing.draftName);
    const isV2 = existing.workflowVersion >= 2;
    const isDraftController =
      resolveAcceptanceDraftControllerId(existing) === user.id;
    const isActiveAssignee =
      existing.draftAssigneeId === user.id && !existing.draftCompletedAt;
    const isPartnerOwnedDraft =
      user.globalRole === "PARTNER" &&
      existing.status === "DRAFT" &&
      existing.submittedAt === null &&
      existing.submittedById === user.id;
    const canEditV2Request =
      existing.status === "STAFF_EDITING"
        ? isActiveAssignee
        : isDraftController;
    if (
      (isV2 && !canEditV2Request) ||
      (!isV2 && existing.submittedById !== user.id)
    ) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        existing.status === "STAFF_EDITING"
          ? "Only the assigned Staff user can edit this request"
          : "Only the current draft controller can edit this request"
      );
    }
    if (!isMicEditableAcceptanceStatus(existing.status)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only MIC-owned drafts, returned requests, or Staff editing requests can be edited"
      );
    }
    assertChangeTargetIsImmutable(existing, input);
    if (input.submit && input.draftAssigneeId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "An assigned draft must be completed and submitted by the MIC"
      );
    }
    const requestedInput = {
      type: existing.type,
      clientPayload:
        input.clientPayload ?? (existing.clientPayload as unknown) ?? undefined,
      engagementPayload:
        input.engagementPayload ??
        (existing.engagementPayload as unknown) ??
        undefined,
      targetClientId: isActiveAssignee
        ? (existing.targetClientId ?? undefined)
        : (input.targetClientId ?? existing.targetClientId ?? undefined),
      targetEngagementId: isActiveAssignee
        ? (existing.targetEngagementId ?? undefined)
        : (input.targetEngagementId ??
          existing.targetEngagementId ??
          undefined),
      micApproverId: input.micApproverId ?? existing.micApproverId,
      picApproverId: input.picApproverId ?? existing.picApproverId,
      itApproverId: input.itApproverId ?? existing.itApproverId,
    };
    const hasUnroutedPartnerDraft =
      isPartnerOwnedDraft &&
      requestedInput.micApproverId === existing.submittedById;
    if (input.submit && hasUnroutedPartnerDraft) {
      await this.resolvePartnerMicApproverId({ micApproverId: undefined });
    }
    const routing = isV2
      ? isPartnerOwnedDraft
        ? {
            micApproverId: hasUnroutedPartnerDraft
              ? existing.submittedById
              : await this.resolvePartnerMicApproverId(requestedInput),
            picApproverId: existing.picApproverId,
            itApproverId: existing.itApproverId,
          }
        : {
            micApproverId: existing.micApproverId,
            picApproverId: existing.picApproverId,
            itApproverId: existing.itApproverId,
          }
      : {
          micApproverId: requestedInput.micApproverId,
          picApproverId: requestedInput.picApproverId,
          itApproverId: requestedInput.itApproverId,
        };
    const nextInput = { ...requestedInput, ...routing };
    if (isClientAcceptanceType(existing.type)) {
      nextInput.clientPayload = parseStoredClientAcceptancePayload(
        nextInput.clientPayload
      );
    }
    validateAcceptancePayload(nextInput, {
      requireCompleteEngagement: input.submit === true,
      requireCompleteClient: input.submit === true,
    });
    if (!isV2) {
      await this.ensureApprovers({
        micApproverId: nextInput.micApproverId,
        picApproverId: assertPresentValue(nextInput.picApproverId),
        itApproverId: assertPresentValue(nextInput.itApproverId),
      });
    }
    if (input.submit && isClientAcceptanceType(existing.type)) {
      nextInput.clientPayload = await prepareClientGroupStructure(
        this.prisma,
        assertCompleteClientAcceptancePayload(nextInput.clientPayload),
        normalizeOptional(nextInput.targetClientId)
      );
    }
    const request = await this.prisma.cmpAcceptanceRequest.update({
      where: { id },
      data: {
        draftName: input.submit ? null : nextDraftName,
        micApproverId: routing.micApproverId,
        picApproverId: routing.picApproverId,
        itApproverId: routing.itApproverId,
        targetClientId: isClientAcceptanceType(existing.type)
          ? normalizeOptional(nextInput.targetClientId)
          : null,
        targetEngagementId: isEngagementAcceptanceType(existing.type)
          ? normalizeOptional(nextInput.targetEngagementId)
          : null,
        clientPayload: isClientAcceptanceType(existing.type)
          ? (nextInput.clientPayload as Prisma.InputJsonValue)
          : undefined,
        engagementPayload: isEngagementAcceptanceType(existing.type)
          ? (nextInput.engagementPayload as Prisma.InputJsonValue)
          : undefined,
      },
      include: ACCEPTANCE_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_UPDATED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Updated CMP acceptance ${request.requestNo}`,
      source,
    });
    if (input.submit) {
      return this.submitAcceptance(id, user, source);
    }
    if (input.draftAssigneeId) {
      return this.assignAcceptanceDraft(
        id,
        { assigneeId: input.draftAssigneeId },
        user,
        source
      );
    }
    return formatAcceptanceRequest(request);
  }

  private async captureChangeBaseline(
    input: CreateCmpAcceptanceRequestInput
  ): Promise<ChangeBaseline | null> {
    const capturedAt = new Date();
    if (input.type === "CLIENT_CHANGE") {
      const targetId = normalizeOptional(input.targetClientId);
      if (!targetId) {
        return null;
      }
      const client = await this.prisma.cmpClient.findUnique({
        where: { id: targetId },
        include: CLIENT_INCLUDE,
      });
      if (!client) {
        throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
      }
      return {
        payload: clientChangePayloadFromMaster(client),
        capturedAt,
        targetUpdatedAt: client.updatedAt,
      };
    }
    if (input.type === "ENGAGEMENT_CHANGE") {
      const targetId = normalizeOptional(input.targetEngagementId);
      if (!targetId) {
        return null;
      }
      const engagement = await this.prisma.cmpEngagement.findUnique({
        where: { id: targetId },
        include: ENGAGEMENT_INCLUDE,
      });
      if (!engagement) {
        throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
      }
      return {
        payload: formatEngagement(engagement),
        capturedAt,
        targetUpdatedAt: engagement.updatedAt,
      };
    }
    return null;
  }

  private async captureCurrentChangeTarget(request: {
    type: CmpAcceptanceRequestType;
    targetClientId: string | null;
    targetEngagementId: string | null;
  }): Promise<{ payload: Record<string, unknown>; updatedAt: Date } | null> {
    if (request.type === "CLIENT_CHANGE" && request.targetClientId) {
      const client = await this.prisma.cmpClient.findUnique({
        where: { id: request.targetClientId },
        include: CLIENT_INCLUDE,
      });
      return client
        ? {
            payload: clientChangePayloadFromMaster(client),
            updatedAt: client.updatedAt,
          }
        : null;
    }
    if (request.type === "ENGAGEMENT_CHANGE" && request.targetEngagementId) {
      const engagement = await this.prisma.cmpEngagement.findUnique({
        where: { id: request.targetEngagementId },
        include: ENGAGEMENT_INCLUDE,
      });
      return engagement
        ? {
            payload: formatEngagement(engagement),
            updatedAt: engagement.updatedAt,
          }
        : null;
    }
    return null;
  }

  private async buildChangeDisplayLookup(
    baseline: Prisma.JsonValue,
    proposed: Prisma.JsonValue | null
  ) {
    const records = [baseline, proposed].filter(isJsonRecord);
    const clientIds = [
      ...new Set([
        ...collectStringValues(records, "clientId"),
        ...collectStringValues(records, "counterpartClientId"),
      ]),
    ];
    const groupIds = [
      ...new Set([
        ...collectStringValues(records, "groupId"),
        ...collectStringValues(records, "primaryGroupId"),
      ]),
    ];
    const userIds = [
      "clientPartnerPicId",
      "clientLeadingPartnerId",
      "clientManagerMicId",
      "alternativePartnerSecondMicId",
      "picUserId",
      "micUserId",
    ].flatMap((field) => collectStringValues(records, field));
    const uniqueUserIds = [...new Set(userIds)];
    const [clients, groups, users] = await Promise.all([
      clientIds.length > 0
        ? this.prisma.cmpClient.findMany({
            where: { id: { in: clientIds } },
            select: {
              id: true,
              clientCode: true,
              nameEn: true,
              nameZh: true,
            },
          })
        : [],
      groupIds.length > 0
        ? this.prisma.cmpClientGroup.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, groupCode: true, nameEn: true, nameZh: true },
          })
        : [],
      uniqueUserIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
    ]);
    return new Map([
      ...clients.map(
        (client) =>
          [
            `client:${client.id}`,
            `${client.clientCode} - ${client.nameEn || client.nameZh}`,
          ] as const
      ),
      ...groups.map(
        (group) =>
          [
            `group:${group.id}`,
            `${group.groupCode} - ${group.nameEn || group.nameZh}`,
          ] as const
      ),
      ...users.map(
        (user) =>
          [
            `user:${user.id}`,
            user.name ? `${user.name} (${user.email})` : user.email,
          ] as const
      ),
    ]);
  }

  async submitAcceptance(
    id: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    if (existing.workflowVersion >= 2) {
      if (isMicHandoffDraft(existing)) {
        return this.submitMicHandoffAcceptance(existing, user, source);
      }
      return this.submitV2Acceptance(existing, user, source);
    }
    if (existing.submittedById !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the submitter can submit this request"
      );
    }
    if (!["DRAFT", "RETURNED"].includes(existing.status)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only draft or returned requests can be submitted"
      );
    }
    validateAcceptancePayload(
      {
        type: existing.type,
        clientPayload: (existing.clientPayload as unknown) ?? undefined,
        engagementPayload: (existing.engagementPayload as unknown) ?? undefined,
        targetClientId: existing.targetClientId ?? undefined,
        targetEngagementId: existing.targetEngagementId ?? undefined,
      },
      { requireCompleteClient: true, requireCompleteEngagement: true }
    );
    await this.ensureEngagementResponsiblePeople({
      type: existing.type,
      engagementPayload: (existing.engagementPayload as unknown) ?? undefined,
    });
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.cmpAcceptanceApprovalStep.deleteMany({
        where: { requestId: id },
      });
      return tx.cmpAcceptanceRequest.update({
        where: { id },
        data: {
          status: "PENDING_MIC",
          currentStep: "MIC",
          returnReason: null,
          returnedAt: null,
          submittedAt: new Date(),
          approvalSteps: {
            create: buildInitialApprovalSteps({
              micApproverId: existing.micApproverId,
              picApproverId: assertPresentValue(existing.picApproverId),
              itApproverId: assertPresentValue(existing.itApproverId),
            }),
          },
        },
        include: ACCEPTANCE_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_SUBMITTED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Submitted CMP acceptance ${request.requestNo}`,
      source,
    });
    await this.notifyAcceptanceSubmitted(request, user.name);
    return formatAcceptanceRequest(request);
  }

  async deleteAcceptanceDraft(
    id: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    this.assertV2DraftManagedByController(existing, user.id);
    if (existing.status !== "DRAFT" || existing.submittedAt !== null) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only unsubmitted drafts can be deleted"
      );
    }
    await this.aml?.deleteRemoteSessionsForAcceptance(id, user, source);
    await this.prisma.cmpAcceptanceRequest.delete({ where: { id } });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_DRAFT_DELETED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: id,
      description: `Deleted CMP acceptance draft ${existing.requestNo}`,
      source,
    });
    return { id };
  }

  async assignAcceptanceDraft(
    id: string,
    input: CmpAcceptanceDraftAssignmentInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    this.assertV2DraftManagedByController(existing, user.id);
    await this.ensureDraftAssignee(input.assigneeId);
    const request = await this.prisma.cmpAcceptanceRequest.update({
      where: { id },
      data: {
        status: "STAFF_EDITING",
        draftAssigneeId: input.assigneeId,
        draftCompletedAt: null,
        draftCompletedById: null,
      },
      include: ACCEPTANCE_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_DRAFT_ASSIGNED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: id,
      description: `Assigned CMP acceptance draft ${request.requestNo}`,
      source,
    });
    await this.notifyDraftAssigned(request, user.name);
    return formatAcceptanceRequest(request);
  }

  async recallAcceptanceDraft(
    id: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    this.assertV2DraftManagedByController(existing, user.id);
    const recalledAssignee = existing.draftAssigneeId
      ? await this.prisma.user.findUnique({
          where: { id: existing.draftAssigneeId },
          select: { id: true, email: true },
        })
      : null;
    const request = await this.prisma.cmpAcceptanceRequest.update({
      where: { id },
      data: {
        status: getMicOwnedDraftStatus(existing),
        draftAssigneeId: null,
        draftCompletedAt: null,
        draftCompletedById: null,
      },
      include: ACCEPTANCE_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_DRAFT_RECALLED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: id,
      description: `Recalled CMP acceptance draft ${request.requestNo}`,
      source,
    });
    if (recalledAssignee) {
      await this.notifyDraftRecalled(request, recalledAssignee, user.name);
    }
    return formatAcceptanceRequest(request);
  }

  async completeAcceptanceDraft(
    id: string,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    if (existing.workflowVersion < 2) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Legacy requests do not support delegated drafts"
      );
    }
    if (existing.status !== "STAFF_EDITING") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only requests being edited by Staff can be completed"
      );
    }
    if (existing.draftAssigneeId !== user.id) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the assigned Staff user can complete this draft"
      );
    }
    if (existing.draftCompletedAt) {
      throw new ApiBadRequestException("BAD_REQUEST", "Draft is already ready");
    }
    const request = await this.prisma.cmpAcceptanceRequest.update({
      where: { id },
      data: {
        status: getMicOwnedDraftStatus(existing),
        draftCompletedAt: new Date(),
        draftCompletedById: user.id,
      },
      include: ACCEPTANCE_INCLUDE,
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_DRAFT_COMPLETED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: id,
      description: `Marked CMP acceptance draft ${request.requestNo} ready for MIC`,
      source,
    });
    await this.notifyDraftCompleted(request, user.name);
    return formatAcceptanceRequest(request);
  }

  private async submitMicHandoffAcceptance(
    existing: Awaited<ReturnType<CmpService["findAcceptanceForMutation"]>>,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    this.assertV2DraftManagedByController(existing, user.id);
    if (existing.draftAssigneeId && !existing.draftCompletedAt) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The assigned Staff user must mark the draft ready before submission"
      );
    }
    const submissionInput = {
      type: existing.type,
      clientPayload: (existing.clientPayload as unknown) ?? undefined,
      engagementPayload: existing.engagementPayload ?? undefined,
      targetClientId: existing.targetClientId ?? undefined,
      targetEngagementId: existing.targetEngagementId ?? undefined,
      micApproverId: existing.micApproverId,
    };
    validateAcceptancePayload(submissionInput, {
      requireCompleteEngagement: true,
      requireCompleteClient: true,
    });
    if (isClientAcceptanceType(existing.type)) {
      submissionInput.clientPayload = await prepareClientGroupStructure(
        this.prisma,
        assertCompleteClientAcceptancePayload(submissionInput.clientPayload),
        existing.targetClientId
      );
    }
    await this.ensureEngagementResponsiblePeople(submissionInput);
    const routing = await this.resolveV2AcceptanceRouting(
      submissionInput,
      user,
      existing.micApproverId
    );
    await this.ensureApprovers(routing);
    const now = new Date();
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.cmpAcceptanceApprovalStep.deleteMany({
        where: { requestId: existing.id },
      });
      return tx.cmpAcceptanceRequest.update({
        where: { id: existing.id },
        data: {
          status: "PENDING_MIC",
          currentStep: "MIC",
          micApproverId: routing.micApproverId,
          picApproverId: routing.picApproverId,
          itApproverId: routing.itApproverId,
          clientPayload: isClientAcceptanceType(existing.type)
            ? (submissionInput.clientPayload as Prisma.InputJsonValue)
            : undefined,
          engagementPayload: isEngagementAcceptanceType(existing.type)
            ? (submissionInput.engagementPayload as Prisma.InputJsonValue)
            : undefined,
          submittedAt: now,
          returnReason: null,
          returnedAt: null,
          approvalSteps: {
            create: [{ step: "MIC", approverId: routing.micApproverId }],
          },
        },
        include: ACCEPTANCE_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_SUBMITTED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Submitted CMP acceptance ${request.requestNo} to MIC`,
      source,
    });
    await this.notifyV2AcceptanceSubmitted(request, user.name);
    return formatAcceptanceRequest(request);
  }

  private async submitV2Acceptance(
    existing: Awaited<ReturnType<CmpService["findAcceptanceForMutation"]>>,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    this.assertV2DraftManagedByController(existing, user.id);
    if (existing.draftAssigneeId && !existing.draftCompletedAt) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The assigned Staff user must mark the draft ready before submission"
      );
    }
    const submissionInput = {
      type: existing.type,
      clientPayload: (existing.clientPayload as unknown) ?? undefined,
      engagementPayload: (existing.engagementPayload as unknown) ?? undefined,
      targetClientId: existing.targetClientId ?? undefined,
      targetEngagementId: existing.targetEngagementId ?? undefined,
    };
    validateAcceptancePayload(submissionInput, {
      requireCompleteEngagement: true,
      requireCompleteClient: true,
    });
    if (isClientAcceptanceType(existing.type)) {
      submissionInput.clientPayload = await prepareClientGroupStructure(
        this.prisma,
        assertCompleteClientAcceptancePayload(submissionInput.clientPayload),
        existing.targetClientId
      );
    }
    await this.ensureEngagementResponsiblePeople(submissionInput);
    const routing = await this.resolveV2AcceptanceRouting(
      submissionInput,
      user
    );
    await this.ensureApprovers(routing);
    const persistedPicApproverId = existing.picApprovedAt
      ? existing.picApproverId
      : routing.picApproverId;
    if (!persistedPicApproverId) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "The previously approved PIC is unavailable"
      );
    }
    const now = new Date();
    const targetStep = existing.picApprovedAt ? "IT" : "PIC";
    const targetApproverId = existing.picApprovedAt
      ? routing.itApproverId
      : persistedPicApproverId;
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.cmpAcceptanceApprovalStep.createMany({
        data: [
          {
            requestId: existing.id,
            step: "MIC",
            approverId: existing.micApproverId,
            status: "APPROVED",
            actedAt: now,
            comment: existing.returnedFromStep
              ? `Resubmitted after ${existing.returnedFromStep} return`
              : "Submitted for approval",
          },
          {
            requestId: existing.id,
            step: targetStep,
            approverId: targetApproverId,
            status: "PENDING",
          },
        ],
      });
      return tx.cmpAcceptanceRequest.update({
        where: { id: existing.id },
        data: {
          status: targetStep === "PIC" ? "PENDING_PIC" : "PENDING_IT",
          currentStep: targetStep,
          picApproverId: persistedPicApproverId,
          itApproverId: routing.itApproverId,
          returnReason: null,
          returnedAt: null,
          returnedFromStep: null,
          submittedAt: existing.submittedAt ?? now,
          clientPayload: isClientAcceptanceType(existing.type)
            ? (submissionInput.clientPayload as Prisma.InputJsonValue)
            : undefined,
        },
        include: ACCEPTANCE_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_SUBMITTED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Submitted CMP acceptance ${request.requestNo} to ${targetStep}`,
      source,
    });
    await this.notifyV2AcceptanceSubmitted(request, user.name);
    return formatAcceptanceRequest(request);
  }

  private async ensureEngagementResponsiblePeople(input: {
    type: AcceptanceRequestTypeValue;
    engagementPayload?: unknown;
  }) {
    if (!isEngagementAcceptanceType(input.type)) {
      return;
    }
    await buildEngagementResponsiblePersonData(
      this.prisma,
      (input.engagementPayload ?? {}) as EngagementResponsiblePersonInput,
      false
    );
  }

  async approveAcceptance(
    id: string,
    user: RequestUser,
    comment: string | undefined,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    assertPendingAcceptance(existing);
    assertCurrentApprover(existing, user.id);
    assertCurrentApprovalRole(existing.currentStep, user.globalRole);
    const now = new Date();
    const next = getNextApprovalState(existing.currentStep);
    let materializedTarget:
      | { targetClientId?: string; targetEngagementId?: string }
      | undefined;
    let request: AcceptanceWithRelations;
    try {
      request = await this.prisma.$transaction(
        async (tx) => {
          await tx.cmpAcceptanceApprovalStep.updateMany({
            where: {
              requestId: id,
              step: existing.currentStep,
              approverId: user.id,
              status: "PENDING",
            },
            data: {
              status: "APPROVED",
              comment: normalizeOptional(comment),
              actedAt: now,
            },
          });
          if (
            existing.workflowVersion >= 2 &&
            ["MIC", "PIC"].includes(existing.currentStep)
          ) {
            const nextStep =
              existing.currentStep === "MIC"
                ? {
                    step: "PIC" as const,
                    approverId: assertPresentValue(existing.picApproverId),
                  }
                : {
                    step: "IT" as const,
                    approverId: assertPresentValue(existing.itApproverId),
                  };
            await tx.cmpAcceptanceApprovalStep.create({
              data: {
                requestId: id,
                ...nextStep,
                status: "PENDING",
              },
            });
          }
          materializedTarget =
            next.status === "APPROVED"
              ? await (async () => {
                  const target = await materializeApprovedAcceptance(
                    tx,
                    existing,
                    user.id
                  );
                  if (target.targetClientId) {
                    await this.createApprovedClientVersion(tx, {
                      clientId: target.targetClientId,
                      request: existing,
                      approvedBy: user,
                      approvedAt: now,
                    });
                  }
                  return target;
                })()
              : undefined;
          return tx.cmpAcceptanceRequest.update({
            where: { id },
            data: {
              status: next.status,
              currentStep: next.currentStep,
              picApprovedAt:
                existing.currentStep === "PIC" ? now : existing.picApprovedAt,
              approvedAt: next.status === "APPROVED" ? now : null,
              ...(materializedTarget?.targetClientId
                ? { targetClientId: materializedTarget.targetClientId }
                : {}),
              ...(materializedTarget?.targetEngagementId
                ? { targetEngagementId: materializedTarget.targetEngagementId }
                : {}),
            },
            include: ACCEPTANCE_INCLUDE,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      handleDuplicateCode(
        error,
        "Approved CMP acceptance could not be applied"
      );
      throw error;
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_APPROVED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Approved ${existing.currentStep} for CMP acceptance ${request.requestNo}`,
      source,
    });
    await this.notifyAcceptanceApproved(request, user.name);
    return formatAcceptanceRequest(request);
  }

  private async ensureClientVersionBaseline(
    tx: Prisma.TransactionClient,
    clientId: string
  ) {
    const existing = await tx.cmpClientVersion.findFirst({
      where: { clientId },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    const client = await tx.cmpClient.findUnique({
      where: { id: clientId },
      include: CLIENT_INCLUDE,
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    const snapshot = formatClient(client);
    const creator = client.createdById
      ? await tx.user.findUnique({
          where: { id: client.createdById },
          select: { name: true },
        })
      : null;
    await tx.cmpClientVersion.create({
      data: {
        clientId,
        versionNumber: 1,
        sourceType: "BASELINE",
        snapshotJson: snapshot as Prisma.InputJsonValue,
        changedById: client.createdById,
        changedByName: creator?.name ?? "System migration",
        approvedAt: client.updatedAt,
      },
    });
  }

  private async createApprovedClientVersion(
    tx: Prisma.TransactionClient,
    input: {
      clientId: string;
      request: {
        id: string;
        type: AcceptanceRequestTypeValue;
        submittedById: string;
        changeBaselinePayload?: Prisma.JsonValue | null;
      };
      approvedBy: RequestUser;
      approvedAt: Date;
    }
  ) {
    const duplicate = await tx.cmpClientVersion.findFirst({
      where: { acceptanceRequestId: input.request.id },
      select: { id: true },
    });
    if (duplicate) {
      return;
    }
    const [client, requester] = await Promise.all([
      tx.cmpClient.findUnique({
        where: { id: input.clientId },
        include: CLIENT_INCLUDE,
      }),
      tx.user.findUnique({
        where: { id: input.request.submittedById },
        select: { name: true },
      }),
    ]);
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
    let previous = await tx.cmpClientVersion.findFirst({
      where: { clientId: input.clientId },
      orderBy: { versionNumber: "desc" },
    });
    const baseline = CmpClientSchema.safeParse(
      input.request.changeBaselinePayload
    );
    if (
      !previous &&
      input.request.type === "CLIENT_CHANGE" &&
      baseline.success
    ) {
      previous = await tx.cmpClientVersion.create({
        data: {
          clientId: input.clientId,
          versionNumber: 1,
          sourceType: "BASELINE",
          snapshotJson: baseline.data as Prisma.InputJsonValue,
          changedById: null,
          changedByName: "System migration",
          approvedAt: input.approvedAt,
        },
      });
    }
    const snapshot = formatClient(client);
    const isInitial = input.request.type === "CLIENT" && !previous;
    const summary = isInitial
      ? null
      : buildAcceptanceChangeSummary({
          type: "CLIENT_CHANGE",
          baseline: previous?.snapshotJson ?? {},
          proposed: snapshot,
          baselineCapturedAt:
            previous?.approvedAt ?? previous?.createdAt ?? null,
          staleMasterData: false,
        });
    await tx.cmpClientVersion.create({
      data: {
        clientId: input.clientId,
        versionNumber: (previous?.versionNumber ?? 0) + 1,
        sourceType:
          input.request.type === "CLIENT_CHANGE"
            ? "CLIENT_CHANGE"
            : "CLIENT_ACCEPTANCE",
        acceptanceRequestId: input.request.id,
        snapshotJson: snapshot as Prisma.InputJsonValue,
        changeSummaryJson: summary
          ? (summary as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        changedById: input.request.submittedById,
        changedByName: requester?.name ?? "Unknown user",
        approvedById: input.approvedBy.id,
        approvedByName: input.approvedBy.name,
        approvedAt: input.approvedAt,
      },
    });
  }

  private async findClientVersion(clientId: string, versionId: string) {
    const version = await this.prisma.cmpClientVersion.findFirst({
      where: { id: versionId, clientId },
      include: { acceptanceRequest: { select: { requestNo: true } } },
    });
    if (!version) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Client version was not found"
      );
    }
    return version;
  }

  async returnAcceptance(
    id: string,
    input: CmpAcceptanceReturnInput,
    user: RequestUser,
    source?: AuditLogSource
  ) {
    const existing = await this.findAcceptanceForMutation(id);
    assertPendingAcceptance(existing);
    assertCurrentApprover(existing, user.id);
    assertCurrentApprovalRole(existing.currentStep, user.globalRole);
    const now = new Date();
    const request = await this.prisma.$transaction(async (tx) => {
      await tx.cmpAcceptanceApprovalStep.updateMany({
        where: {
          requestId: id,
          step: existing.currentStep,
          approverId: user.id,
          status: "PENDING",
        },
        data: {
          status: "RETURNED",
          comment: input.comment,
          actedAt: now,
        },
      });
      return tx.cmpAcceptanceRequest.update({
        where: { id },
        data: {
          status: "RETURNED",
          currentStep: "MIC",
          returnedFromStep: existing.currentStep,
          returnReason: input.comment,
          returnedAt: now,
        },
        include: ACCEPTANCE_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_ACCEPTANCE_RETURNED",
      targetType: "CMP_ACCEPTANCE_REQUEST",
      targetId: request.id,
      description: `Returned CMP acceptance ${request.requestNo}`,
      source,
    });
    await this.notifyAcceptanceReturned(request, user.name);
    return formatAcceptanceRequest(request);
  }

  private async notifyAcceptanceSubmitted(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    await Promise.all([
      this.createAcceptanceInboxMessage({
        request,
        recipientId: request.submittedById,
        tab: "requests",
        title: `${request.requestNo} 已提交成功`,
        body: `${getAcceptanceTypeLabel(request.type)} 已提交，当前等待 MIC 审批：${getAcceptanceSubject(request)}。`,
        contentKey: "CMP_ACCEPTANCE_SUBMITTED",
        contentParams: {
          requestNo: request.requestNo,
          acceptanceType: request.type,
          subject: getAcceptanceSubject(request),
        },
        actorName,
      }),
      this.createAcceptanceInboxMessage({
        request,
        recipientId: request.micApproverId,
        tab: "approvals",
        title: `${request.requestNo} 已提交，等待你审批`,
        body: `${actorName} 提交了 ${getAcceptanceTypeLabel(request.type)}：${getAcceptanceSubject(request)}。当前步骤：MIC 审批。`,
        contentKey: "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
        contentParams: {
          requestNo: request.requestNo,
          actor: actorName,
          acceptanceType: request.type,
          subject: getAcceptanceSubject(request),
          step: "MIC",
        },
        actorName,
      }),
    ]);
  }

  private async notifyV2AcceptanceSubmitted(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    if (request.status === "PENDING_MIC") {
      await this.notifyAcceptanceSubmitted(request, actorName);
      return;
    }
    const targetIsIt = request.status === "PENDING_IT";
    await this.createAcceptanceInboxMessage({
      request,
      recipientId: targetIsIt
        ? assertPresentValue(request.itApproverId)
        : assertPresentValue(request.picApproverId),
      tab: "approvals",
      title: `${request.requestNo} 已进入 ${targetIsIt ? "IT" : "PIC"} 审批`,
      body: `${actorName} 已提交${getAcceptanceTypeLabel(request.type)}：${getAcceptanceSubject(request)}。当前步骤：${targetIsIt ? "IT" : "PIC"} 审批。`,
      contentKey: "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
      contentParams: {
        requestNo: request.requestNo,
        actor: actorName,
        acceptanceType: request.type,
        subject: getAcceptanceSubject(request),
        step: targetIsIt ? "IT" : "PIC",
      },
      actorName,
    });
  }

  private async notifyDraftAssigned(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    if (!request.draftAssigneeId) {
      return;
    }
    await this.createAcceptanceInboxMessage({
      request,
      recipientId: request.draftAssigneeId,
      tab: "requests",
      title: `${request.requestNo} 草稿已分派给你`,
      body: `${actorName} 已将${getAcceptanceTypeLabel(request.type)}草稿分派给你完成：${getAcceptanceSubject(request)}。`,
      contentKey: "CMP_ACCEPTANCE_DRAFT_ASSIGNED",
      contentParams: {
        requestNo: request.requestNo,
        actor: actorName,
        acceptanceType: request.type,
        subject: getAcceptanceSubject(request),
      },
      actorName,
    });
  }

  private async notifyDraftRecalled(
    request: AcceptanceWithRelations,
    recipient: { id: string; email: string },
    actorName: string
  ) {
    await this.createAcceptanceInboxMessage({
      request,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      tab: "requests",
      title: `${request.requestNo} 草稿已被撤回`,
      body: `${actorName} 已撤回你负责的${getAcceptanceTypeLabel(request.type)}草稿：${getAcceptanceSubject(request)}。`,
      contentKey: "CMP_ACCEPTANCE_DRAFT_RECALLED",
      contentParams: {
        requestNo: request.requestNo,
        actor: actorName,
        acceptanceType: request.type,
        subject: getAcceptanceSubject(request),
      },
      actorName,
    });
  }

  private async notifyDraftCompleted(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    await this.createAcceptanceInboxMessage({
      request,
      recipientId: resolveAcceptanceDraftControllerId(request),
      tab: "requests",
      title:
        request.submittedAt === null
          ? `${request.requestNo} 草稿已完成，等待发起人复核`
          : `${request.requestNo} 草稿已完成，等待 MIC 审阅`,
      body: `${actorName} 已完成委派草稿：${getAcceptanceSubject(request)}。`,
      contentKey: "CMP_ACCEPTANCE_DRAFT_COMPLETED",
      contentParams: {
        requestNo: request.requestNo,
        actor: actorName,
        subject: getAcceptanceSubject(request),
        nextReviewer: request.submittedAt === null ? "REQUESTER" : "MIC",
      },
      actorName,
    });
  }

  private async notifyAcceptanceApproved(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    if (request.status === "PENDING_PIC") {
      await Promise.all([
        this.createAcceptanceInboxMessage({
          request,
          recipientId: request.submittedById,
          tab: "requests",
          title: `${request.requestNo} 已通过 MIC 审批`,
          body: `${actorName} 已通过 MIC 审批，申请已进入 PIC 审批：${getAcceptanceSubject(request)}。`,
          contentKey: "CMP_ACCEPTANCE_STEP_ADVANCED",
          contentParams: {
            requestNo: request.requestNo,
            actor: actorName,
            subject: getAcceptanceSubject(request),
            completedStep: "MIC",
            nextStep: "PIC",
          },
          actorName,
        }),
        this.createAcceptanceInboxMessage({
          request,
          recipientId: assertPresentValue(request.picApproverId),
          tab: "approvals",
          title: `${request.requestNo} 已进入 PIC 审批`,
          body: `${actorName} 已完成 MIC 审批。${getAcceptanceTypeLabel(request.type)}：${getAcceptanceSubject(request)}。`,
          contentKey: "CMP_ACCEPTANCE_NEXT_APPROVER",
          contentParams: {
            requestNo: request.requestNo,
            actor: actorName,
            acceptanceType: request.type,
            subject: getAcceptanceSubject(request),
            completedStep: "MIC",
          },
          actorName,
        }),
      ]);
      return;
    }
    if (request.status === "PENDING_IT") {
      await Promise.all([
        this.createAcceptanceInboxMessage({
          request,
          recipientId: request.submittedById,
          tab: "requests",
          title: `${request.requestNo} 已通过 PIC 审批`,
          body: `${actorName} 已通过 PIC 审批，申请已进入 IT 审批：${getAcceptanceSubject(request)}。`,
          contentKey: "CMP_ACCEPTANCE_STEP_ADVANCED",
          contentParams: {
            requestNo: request.requestNo,
            actor: actorName,
            subject: getAcceptanceSubject(request),
            completedStep: "PIC",
            nextStep: "IT",
          },
          actorName,
        }),
        this.createAcceptanceInboxMessage({
          request,
          recipientId: assertPresentValue(request.itApproverId),
          tab: "approvals",
          title: `${request.requestNo} 已进入 IT 审批`,
          body: `${actorName} 已完成 PIC 审批。${getAcceptanceTypeLabel(request.type)}：${getAcceptanceSubject(request)}。`,
          contentKey: "CMP_ACCEPTANCE_NEXT_APPROVER",
          contentParams: {
            requestNo: request.requestNo,
            actor: actorName,
            acceptanceType: request.type,
            subject: getAcceptanceSubject(request),
            completedStep: "PIC",
          },
          actorName,
        }),
      ]);
      return;
    }
    if (request.status === "APPROVED") {
      const draftContributors = await this.prisma.auditLog.findMany({
        where: {
          action: "CMP_ACCEPTANCE_DRAFT_COMPLETED",
          targetType: "CMP_ACCEPTANCE_REQUEST",
          targetId: request.id,
        },
        select: { actorId: true },
      });
      const recipientIds = [
        ...new Set(
          [
            request.submittedById,
            request.draftCompletedById,
            ...draftContributors.map((item) => item.actorId),
          ].filter((id): id is string => Boolean(id))
        ),
      ];
      await Promise.all(
        recipientIds.map((recipientId) =>
          this.createAcceptanceInboxMessage({
            request,
            recipientId,
            tab: "requests",
            title: `${request.requestNo} 已通过`,
            body: `${actorName} 已完成最终审批，${getAcceptanceTypeLabel(request.type)} 已写入主数据：${getAcceptanceSubject(request)}。`,
            contentKey: "CMP_ACCEPTANCE_APPROVED",
            contentParams: {
              requestNo: request.requestNo,
              actor: actorName,
              acceptanceType: request.type,
              subject: getAcceptanceSubject(request),
            },
            actorName,
          })
        )
      );
      if (isEngagementAcceptanceType(request.type)) {
        await this.notifyApprovedEngagementOwners(request);
      }
    }
  }

  private async notifyApprovedEngagementOwners(
    request: AcceptanceWithRelations
  ) {
    const payload = CreateCmpEngagementSchema.parse(request.engagementPayload);
    const recipientIds = [
      ...new Set(
        [payload.picUserId, payload.micUserId].filter((id): id is string =>
          Boolean(id)
        )
      ),
    ];

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.inbox?.createCollaborationMessage({
          recipientId,
          senderId: null,
          type: "SYSTEM_NOTIFICATION",
          title: `${payload.engagementCode} 承接已最终批准`,
          body: `Engagement ${payload.engagementCode} 已完成最终审批，现已可在 EMP 创建项目。`,
          contentKey: "CMP_ENGAGEMENT_APPROVED",
          contentParams: { engagementCode: payload.engagementCode },
          actionUrl: "/engagement",
        })
      )
    );
  }

  private async notifyAcceptanceReturned(
    request: AcceptanceWithRelations,
    actorName: string
  ) {
    const returnReason = request.returnReason?.trim();
    await this.createAcceptanceInboxMessage({
      request,
      recipientId: resolveAcceptanceReturnRecipientId(request),
      tab: "requests",
      title: `${request.requestNo} 已被退回`,
      body: `${actorName} 退回了 ${getAcceptanceTypeLabel(request.type)}：${getAcceptanceSubject(request)}。原因：${returnReason ? notificationExcerpt(returnReason) : "未填写退回原因"}`,
      contentKey: "CMP_ACCEPTANCE_RETURNED",
      contentParams: {
        requestNo: request.requestNo,
        actor: actorName,
        acceptanceType: request.type,
        subject: getAcceptanceSubject(request),
        ...(returnReason
          ? { reason: notificationExcerpt(returnReason) }
          : { reason: null }),
      },
      actorName,
    });
  }

  private async createAcceptanceInboxMessage(
    input: {
      request: AcceptanceWithRelations;
      recipientId: string;
      recipientEmail?: string;
      tab: "requests" | "approvals";
      title: string;
      body: string;
      actorName?: string;
    } & InboxStructuredContent
  ) {
    const actionUrl = `/cmp/acceptance?tab=${input.tab}&requestId=${input.request.id}`;
    const content = copyInboxStructuredContent(input);
    await Promise.all([
      this.inbox?.createCollaborationMessage({
        recipientId: input.recipientId,
        senderId: null,
        type: "SYSTEM_NOTIFICATION",
        title: input.title,
        body: input.body,
        actionUrl,
        suppressEmail: true,
        ...content,
      }),
      this.sendAcceptanceEmail({ ...input, actionUrl }),
    ]);
  }

  private async sendAcceptanceEmail(
    input: {
      request: AcceptanceWithRelations;
      recipientId: string;
      recipientEmail?: string;
      tab: "requests" | "approvals";
      title: string;
      body: string;
      actorName?: string;
      actionUrl: string;
    } & InboxStructuredContent
  ) {
    if (!this.email) {
      return;
    }
    const recipientEmail = await this.resolveAcceptanceRecipientEmail(
      input.request,
      input.recipientId,
      input.recipientEmail
    );
    if (!recipientEmail) {
      this.logger.warn(
        `Skipped CMP email for ${input.request.requestNo}: recipient ${input.recipientId} has no email address`
      );
      return;
    }

    const preferredLocale = await this.resolveAcceptanceRecipientLocale(
      input.recipientId
    );
    const structuredContent = copyInboxStructuredContent(input);
    const localized = resolveInboxEmailContent(
      {
        ...structuredContent,
        fallbackTitle: input.title,
        fallbackBody: input.body,
      },
      preferredLocale
    );
    const url = this.getCmpAcceptanceUrl(input.actionUrl, localized.locale);
    const english = localized.locale === "en-US";
    const presentation = resolveInboxEmailPresentation({
      ...structuredContent,
      locale: localized.locale,
    });
    const rendered = renderSystemEmail({
      action: { label: presentation.actionLabel, url },
      body: localized.body,
      brandName: "Project Wing",
      eyebrow: presentation.eyebrow,
      facts: presentation.facts,
      locale: localized.locale,
      preheader: localized.body,
      productName: "CMP",
      title: localized.title,
      tone: presentation.tone,
    });
    const text = [
      english ? "CMP acceptance notification" : "CMP 准入通知",
      `${english ? "Request" : "申请编号"}：${input.request.requestNo}`,
      `${english ? "Event" : "事件"}：${localized.title}`,
      `${english ? "Description" : "说明"}：${localized.body}`,
      `${english ? "Details" : "详情"}：${url}`,
    ].join("\n");

    try {
      await this.email.send({
        html: rendered.html,
        to: recipientEmail,
        subject: `[CMP] ${localized.title}`,
        text,
      });
    } catch (error) {
      this.logger.warn(
        `CMP email failed for ${input.request.requestNo}, recipient ${input.recipientId}: ${getErrorMessage(error)}`
      );
    }
  }

  private async resolveAcceptanceRecipientEmail(
    request: AcceptanceWithRelations,
    recipientId: string,
    explicitEmail?: string
  ) {
    if (explicitEmail) {
      return explicitEmail;
    }
    const knownEmail = [
      request.submittedBy,
      request.micApprover,
      request.picApprover,
      request.itApprover,
      request.draftAssignee,
      request.draftCompletedBy,
      ...request.approvalSteps.map((step) => step.approver),
    ].find((recipient) => recipient?.id === recipientId)?.email;
    if (knownEmail) {
      return knownEmail;
    }
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    return recipient?.email;
  }

  private async resolveAcceptanceRecipientLocale(recipientId: string) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { preferredLocale: true },
    });
    return normalizeInboxLocale(recipient?.preferredLocale);
  }

  private getCmpAcceptanceUrl(actionUrl: string, preferredLocale: string) {
    const configuredUrl =
      process.env.PROJECTWING_CMP_URL?.trim() || "http://localhost:3002";
    try {
      const cmpPath = actionUrl.replace(/^\/cmp(?=\/|\?|$)/, "") || "/";
      return new URL(
        `/${normalizeInboxLocale(preferredLocale)}${cmpPath}`,
        configuredUrl
      ).toString();
    } catch {
      this.logger.warn(
        `PROJECTWING_CMP_URL is invalid; using local CMP URL for acceptance links`
      );
      const cmpPath = actionUrl.replace(/^\/cmp(?=\/|\?|$)/, "") || "/";
      return new URL(
        `/${normalizeInboxLocale(preferredLocale)}${cmpPath}`,
        "http://localhost:3002"
      ).toString();
    }
  }

  private async ensureClientGroupExists(id: string) {
    const group = await this.prisma.cmpClientGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!group) {
      throw new ApiNotFoundException("NOT_FOUND", "Client group was not found");
    }
  }

  private async ensureClientExists(id: string) {
    const client = await this.prisma.cmpClient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!client) {
      throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
    }
  }

  private async ensureEngagementExists(id: string) {
    const engagement = await this.prisma.cmpEngagement.findUnique({
      where: { id },
      select: { id: true, engagementCode: true, status: true },
    });
    if (!engagement) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }
    return engagement;
  }

  private async ensureEngagementCodeAvailable(
    code: string,
    excludingEngagementId?: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    await Promise.resolve();
    return ensureEngagementCodeAvailable(prisma, code, excludingEngagementId);
  }

  private async resolveV2AcceptanceRouting(
    input: {
      type: AcceptanceRequestTypeValue;
      clientPayload?: unknown;
      engagementPayload?: unknown;
      targetClientId?: string;
      targetEngagementId?: string;
      micApproverId?: string;
    },
    user: RequestUser,
    fixedMicApproverId?: string
  ) {
    if (!fixedMicApproverId && !isCmpAcceptanceInitiator(user.globalRole)) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only a Manager, Senior Manager, or Partner can initiate an acceptance request"
      );
    }
    const micApproverId = fixedMicApproverId
      ? await this.resolvePartnerMicApproverId({
          micApproverId: fixedMicApproverId,
        })
      : user.globalRole === "PARTNER"
        ? await this.resolvePartnerMicApproverId(input)
        : user.id;

    let picApproverId = normalizeOptional(
      (input.clientPayload as { clientPartnerPicId?: string } | undefined)
        ?.clientPartnerPicId
    );
    if (!picApproverId && isEngagementAcceptanceType(input.type)) {
      let clientId = normalizeOptional(
        (input.engagementPayload as { clientId?: string } | undefined)?.clientId
      );
      if (!clientId && input.targetEngagementId) {
        const engagement = await this.prisma.cmpEngagement.findUnique({
          where: { id: input.targetEngagementId },
          select: { clientId: true },
        });
        clientId = engagement?.clientId ?? null;
      }
      if (clientId) {
        const client = await this.prisma.cmpClient.findUnique({
          where: { id: clientId },
          select: { clientPartnerPicId: true },
        });
        picApproverId = client?.clientPartnerPicId ?? null;
      }
    }
    if (!picApproverId && input.targetClientId) {
      const client = await this.prisma.cmpClient.findUnique({
        where: { id: input.targetClientId },
        select: { clientPartnerPicId: true },
      });
      picApproverId = client?.clientPartnerPicId ?? null;
    }
    if (!picApproverId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client Partner / PIC must be selected before this request can be submitted"
      );
    }

    const configuredItId = normalizeOptional(
      process.env.CMP_DEFAULT_IT_APPROVER_ID
    );
    const itUsers = await this.prisma.user.findMany({
      where: {
        status: "ACTIVE",
        globalRole: "SUPER_ADMIN",
        ...(configuredItId ? { id: configuredItId } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: configuredItId ? 1 : 2,
      select: { id: true },
    });
    if (itUsers.length !== 1) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        configuredItId
          ? "Configured CMP IT approver is unavailable"
          : "CMP requires exactly one active IT approver or CMP_DEFAULT_IT_APPROVER_ID"
      );
    }
    const itApproverId = itUsers[0].id;
    return {
      micApproverId,
      picApproverId,
      itApproverId,
    };
  }

  private async resolvePartnerMicApproverId(input: { micApproverId?: string }) {
    const micApproverId = normalizeOptional(input.micApproverId);
    if (!micApproverId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Partner-initiated requests must select a Manager or Senior Manager as MIC"
      );
    }
    const mic = await this.prisma.user.findUnique({
      where: { id: micApproverId },
      select: { id: true, status: true, globalRole: true },
    });
    if (
      !mic ||
      mic.status !== "ACTIVE" ||
      !isMicAcceptanceRole(mic.globalRole)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "MIC approver must be an active Manager or Senior Manager"
      );
    }
    return mic.id;
  }

  private async ensureDraftAssignee(assigneeId: string) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { status: true, globalRole: true },
    });
    if (
      !assignee ||
      assignee.status !== "ACTIVE" ||
      !["SENIOR", "STAFF", "ASSISTANT"].includes(assignee.globalRole)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Draft assignee must be an active Senior, Staff, or Assistant"
      );
    }
  }

  private assertV2DraftManagedByController(
    request: {
      workflowVersion: number;
      status: string;
      micApproverId: string;
      submittedById: string;
      submittedAt: Date | null;
    },
    userId: string
  ) {
    if (request.workflowVersion < 2) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Legacy requests do not support the delegated draft workflow"
      );
    }
    if (!isMicEditableAcceptanceStatus(request.status)) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Only active drafts, returned requests, or Staff editing requests can be managed"
      );
    }
    if (resolveAcceptanceDraftControllerId(request) !== userId) {
      throw new ApiForbiddenException(
        "FORBIDDEN",
        "Only the current draft controller can perform this action"
      );
    }
  }

  private async ensureApprovers(input: {
    micApproverId: string;
    picApproverId: string;
    itApproverId: string;
  }) {
    const uniqueIds = [
      ...new Set(
        [input.micApproverId, input.picApproverId, input.itApproverId].filter(
          Boolean
        )
      ),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds }, status: "ACTIVE" },
      select: { id: true, globalRole: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "One or more approvers are unavailable"
      );
    }
    const roleById = new Map(users.map((item) => [item.id, item.globalRole]));
    if (!["MANAGER"].includes(roleById.get(input.micApproverId) ?? "")) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "MIC approver must be Manager"
      );
    }
    if (
      !["PARTNER", "PRINCIPAL"].includes(
        roleById.get(input.picApproverId) ?? ""
      )
    ) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "PIC approver must be Partner or Principal"
      );
    }
    if (roleById.get(input.itApproverId) !== "SUPER_ADMIN") {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "IT approver must be Super Admin"
      );
    }
  }

  private async findAcceptanceForMutation(id: string) {
    const request = await this.prisma.cmpAcceptanceRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Acceptance request was not found"
      );
    }
    return request;
  }

  private async assertNoActiveChangeAcceptance(input: {
    type: AcceptanceRequestTypeValue;
    targetClientId?: string;
    targetEngagementId?: string;
  }) {
    if (!isChangeAcceptanceType(input.type)) {
      return;
    }

    const targetClientId =
      input.type === "CLIENT_CHANGE"
        ? normalizeOptional(input.targetClientId)
        : null;
    const targetEngagementId =
      input.type === "ENGAGEMENT_CHANGE"
        ? normalizeOptional(input.targetEngagementId)
        : null;
    if (!targetClientId && !targetEngagementId) {
      return;
    }

    const existing = await this.prisma.cmpAcceptanceRequest.findFirst({
      where: {
        type: input.type,
        status: { in: [...ACTIVE_CHANGE_ACCEPTANCE_STATUSES] },
        ...(targetClientId ? { targetClientId } : { targetEngagementId }),
      },
      select: { requestNo: true },
    });
    if (existing) {
      throwActiveChangeAcceptanceConflict(existing.requestNo);
    }
  }

  private async nextAcceptanceRequestNo(type: AcceptanceRequestTypeValue) {
    const prefix = ACCEPTANCE_TYPE_PREFIX[type];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const requestNo = `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const existing = await this.prisma.cmpAcceptanceRequest.findUnique({
        where: { requestNo },
        select: { id: true },
      });
      if (!existing) {
        return requestNo;
      }
    }
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Could not allocate acceptance request number"
    );
  }
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function assertCompanyCodeAvailable(
  prisma: Pick<PrismaService, "cmpClient">,
  value: string | null | undefined,
  excludeClientId?: string
) {
  const companyCode = normalizeOptional(value);
  if (!companyCode) {
    return;
  }
  const duplicate = await prisma.cmpClient.findFirst({
    where: {
      companyCode: { equals: companyCode, mode: "insensitive" },
      ...(excludeClientId ? { NOT: { id: excludeClientId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiBadRequestException(
      "DUPLICATE_CODE",
      "Company Code already exists"
    );
  }
}

function normalizeOptionalDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return new Date(`${trimmed}T00:00:00.000Z`);
}

function archivePayloadFromEngagement(
  engagement: Awaited<ReturnType<CmpService["getEngagement"]>>
): CmpEngagementArchivePayload {
  return CmpEngagementArchivePayloadSchema.parse({
    clientId: engagement.clientId,
    engagementCode: engagement.engagementCode,
    serviceType: engagement.serviceType,
    otherServiceDescription: engagement.otherServiceDescription ?? "",
    deliverables: engagement.deliverables ?? [],
    yearEndDate: engagement.yearEndDate,
    reportDate: engagement.reportDate,
    approvalReferenceNumber: engagement.approvalReferenceNumber ?? "",
    engagementDate: engagement.engagementDate,
    budgetedHours: engagement.budgetedHours,
    agreedFee: engagement.agreedFee,
    recoveryRate: engagement.recoveryRate ?? "",
    feePlanningLines: engagement.feePlanningLines.map((line) => ({
      key: line.id,
      grade: line.grade,
      assignmentType: line.assignmentType,
      staffUserId: line.staff?.id ?? null,
      hourlyRate: line.hourlyRate,
      budgetHours: line.budgetHours,
      dateFrom: line.dateFrom ?? "",
      dateTo: line.dateTo ?? "",
      sortOrder: line.sortOrder,
    })),
    feeCurrency: engagement.feeCurrency,
    feeExchangeRateSnapshotId: engagement.feeExchangeRateSnapshot?.id ?? "",
    feeExchangeRateHkdPerUnit: engagement.feeExchangeRateHkdPerUnit ?? "",
    feeExchangeRateSource:
      engagement.feeExchangeRateSource === "MANUAL" ? "MANUAL" : "SYSTEM",
    amlRiskClassification: engagement.amlRiskClassification,
    engagementRiskClassification: engagement.engagementRiskClassification,
    picUserId: engagement.picUserId ?? "",
    micUserId: engagement.micUserId ?? "",
    ...(engagement.eqReviewerUserId
      ? { eqReviewerUserId: engagement.eqReviewerUserId }
      : {}),
    pic: engagement.pic ?? "",
    mic: engagement.mic ?? "",
    eqReviewer: engagement.eqReviewer ?? "",
    remarks: engagement.remarks ?? "",
  });
}

function formatArchiveDraft(draft: {
  id: string;
  engagementId: string;
  payload: Prisma.JsonValue;
  sourceUpdatedAt: Date;
  tmsFingerprint: string;
  editorUserId: string;
  workflowStatus: "DRAFT" | "PENDING_PIC" | "RETURNED";
  submittedById: string | null;
  submittedAt: Date | null;
  returnedById: string | null;
  returnedAt: Date | null;
  returnReason: string | null;
  overrideReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: draft.id,
    engagementId: draft.engagementId,
    payload: CmpEngagementArchivePayloadSchema.parse(draft.payload),
    sourceUpdatedAt: draft.sourceUpdatedAt.toISOString(),
    tmsFingerprint: draft.tmsFingerprint,
    editorUserId: draft.editorUserId,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    workflowStatus: draft.workflowStatus,
    submittedById: draft.submittedById,
    submittedAt: draft.submittedAt?.toISOString() ?? null,
    returnedById: draft.returnedById,
    returnedAt: draft.returnedAt?.toISOString() ?? null,
    returnReason: draft.returnReason,
    overrideReason: draft.overrideReason,
  };
}

function archiveWorkflowCapabilities(
  engagement: { picUserId: string | null; micUserId: string | null },
  draft: ReturnType<typeof formatArchiveDraft> | null,
  user: RequestUser
) {
  const status = draft?.workflowStatus ?? "DRAFT";
  const isAdmin = user.globalRole === "SUPER_ADMIN";
  const isPartner = user.globalRole === "PARTNER";
  const isMic = engagement.micUserId === user.id;
  const isPic = engagement.picUserId === user.id;
  return {
    status,
    canEdit: status !== "PENDING_PIC" && (isMic || isPartner || isAdmin),
    canSubmit:
      Boolean(draft) &&
      status !== "PENDING_PIC" &&
      (isMic || isPartner || isAdmin),
    canApprove: status === "PENDING_PIC" && (isPic || isAdmin),
    canReturn: status === "PENDING_PIC" && (isPic || isAdmin),
    overrideRequired: isAdmin && !(isMic || isPic),
  };
}

function buildArchiveReadiness(input: {
  engagement: Awaited<ReturnType<CmpService["getEngagement"]>>;
  payload: CmpEngagementArchivePayload;
  costs: {
    memberCosts: {
      historical: boolean;
      budgetNormal: string;
      budgetOt: string;
      actualNormal: string;
      actualOt: string;
      budgetCost: string;
      actualCost: string;
    }[];
    totals: { budgetCost: string; actualCost: string };
    unassignedApprovedUserIds: string[];
    hasUnapprovedTime: boolean;
  };
  blockers: string[];
}) {
  const checks: {
    code: z.infer<typeof CmpEngagementArchiveCheckCodeEnum>;
    severity: "BLOCKER" | "WARNING";
    params: Record<string, string>;
  }[] = [];
  const add = (
    code: z.infer<typeof CmpEngagementArchiveCheckCodeEnum>,
    severity: "BLOCKER" | "WARNING",
    params: Record<string, string> = {}
  ) => checks.push({ code, severity, params });
  const blockerText = input.blockers.join(" ");
  if (blockerText.includes("Only active")) {
    add("ENGAGEMENT_NOT_ELIGIBLE", "BLOCKER");
  }
  if (blockerText.includes("TBC")) {
    add("UNRESOLVED_TBC", "BLOCKER");
  }
  if (blockerText.includes("only be assigned once")) {
    add("DUPLICATE_BUDGET_PERSON", "BLOCKER");
  }
  if (input.costs.unassignedApprovedUserIds.length) {
    add("UNASSIGNED_APPROVED_TMS_PERSON", "BLOCKER", {
      count: String(input.costs.unassignedApprovedUserIds.length),
    });
  }
  if (input.costs.hasUnapprovedTime) {
    add("UNAPPROVED_TMS_TIME", "BLOCKER");
  }
  if (
    !input.engagement.picUserId ||
    !input.engagement.micUserId ||
    input.engagement.picUserId === input.engagement.micUserId
  ) {
    add("RESPONSIBLE_USERS_INVALID", "BLOCKER");
  }
  if (archiveReportDateInvalid(input.payload.reportDate)) {
    add("REPORT_DATE_INVALID", "BLOCKER");
  }
  if (!(input.payload.deliverables ?? []).length) {
    add("NO_DELIVERABLES", "WARNING");
  }
  const budgetHours = input.costs.memberCosts.reduce(
    (total, row) => total + Number(row.budgetNormal) + Number(row.budgetOt),
    0
  );
  const actualHours = input.costs.memberCosts.reduce(
    (total, row) => total + Number(row.actualNormal) + Number(row.actualOt),
    0
  );
  if (actualHours > budgetHours) {
    add("ACTUAL_HOURS_OVER_BUDGET", "WARNING");
  }
  if (
    Number(input.costs.totals.actualCost) >
    Number(input.costs.totals.budgetCost)
  ) {
    add("ACTUAL_COST_OVER_BUDGET", "WARNING");
  }
  if (Number(input.costs.totals.actualCost) > Number(input.payload.agreedFee)) {
    add("ACTUAL_COST_OVER_FEE", "WARNING");
  }
  if (input.costs.memberCosts.some((row) => row.historical)) {
    add("HISTORICAL_MEMBER", "WARNING");
  }
  const recoveryRate = Number(input.payload.recoveryRate || 0);
  // Recovery rate is stored and displayed as a percentage, not a 0-1 ratio.
  if (recoveryRate < 0 || recoveryRate > 150) {
    add("RECOVERY_RATE_EXCEPTION", "WARNING");
  }
  return checks;
}

function archiveReadinessText(
  code: z.infer<typeof CmpEngagementArchiveCheckCodeEnum>
) {
  const labels: Partial<
    Record<z.infer<typeof CmpEngagementArchiveCheckCodeEnum>, string>
  > = {
    NO_DELIVERABLES: "No reports or deliverables are recorded.",
    ACTUAL_HOURS_OVER_BUDGET: "Actual hours exceed budgeted hours.",
    ACTUAL_COST_OVER_BUDGET: "Actual cost exceeds budget cost.",
    ACTUAL_COST_OVER_FEE: "Actual cost exceeds agreed fee.",
    HISTORICAL_MEMBER: "Archive includes a historical or inactive member.",
    RECOVERY_RATE_EXCEPTION: "Recovery rate requires review.",
  };
  return labels[code] ?? code;
}

function archiveTmsFingerprint(summary: TmsEngagementSummary) {
  return createHash("sha256")
    .update(JSON.stringify(summary.approved))
    .digest("hex");
}

function archiveBlockers(
  engagement: {
    status: string;
    feePlanningLines: { assignmentType: "STAFF" | "TBC" }[];
  },
  memberCosts: { userId: string }[],
  unassignedApprovedUserIds: string[],
  hasUnapprovedTime = false
) {
  const blockers: string[] = [];
  if (engagement.status !== "ACTIVE" && engagement.status !== "COMPLETED") {
    blockers.push("Only active or completed Engagements can be archived.");
  }
  if (
    engagement.feePlanningLines.some((line) => line.assignmentType === "TBC")
  ) {
    blockers.push(
      "All TBC budget positions must be assigned before archiving."
    );
  }
  const assigned = new Set(memberCosts.map((row) => row.userId));
  if (assigned.size !== memberCosts.length) {
    blockers.push("Each budget person can only be assigned once.");
  }
  if (unassignedApprovedUserIds.length > 0) {
    blockers.push(
      "Every person with approved TMS hours must be assigned to a budget line."
    );
  }
  if (hasUnapprovedTime) {
    blockers.push("All TMS hours must be approved before archiving.");
  }
  return blockers;
}

function assertArchiveReportDate(value: string | null | undefined) {
  if (!value) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Report date is required before archiving"
    );
  }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const shanghaiToday = `${part("year")}-${part("month")}-${part("day")}`;
  if (value > shanghaiToday) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Report date cannot be after the archive date"
    );
  }
}

function archiveReportDateInvalid(value: string | null | undefined) {
  if (!value) {
    return true;
  }
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return value > `${part("year")}-${part("month")}-${part("day")}`;
}

function throwArchiveSourceConflict(): never {
  throw new ApiConflictException(
    "CMP_ENGAGEMENT_ARCHIVE_SOURCE_CONFLICT",
    "The Engagement changed after this archive draft was created. Rebuild the draft from the latest Engagement."
  );
}

function throwArchiveTmsConflict(): never {
  throw new ApiConflictException(
    "CMP_ENGAGEMENT_ARCHIVE_TMS_CONFLICT",
    "Approved TMS hours changed. Refresh the archive costs and confirm again."
  );
}

function assertRelationshipDateNotInFuture(
  value: string | null | undefined,
  label: string
) {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (normalized > today) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      `${label} cannot be in the future`
    );
  }
}

const ACCEPTANCE_TYPE_PREFIX: Record<AcceptanceRequestTypeValue, string> = {
  CLIENT: "CA",
  CLIENT_CHANGE: "CC",
  ENGAGEMENT: "EA",
  ENGAGEMENT_CHANGE: "EC",
};
const ACCEPTANCE_TYPE_LABEL: Record<AcceptanceRequestTypeValue, string> = {
  CLIENT: "Client Acceptance",
  CLIENT_CHANGE: "Client Change",
  ENGAGEMENT: "Engagement Acceptance",
  ENGAGEMENT_CHANGE: "Engagement Change",
};
const APPROVAL_NUMBER_PREFIX: Record<AcceptanceRequestTypeValue, string> = {
  CLIENT: "NCA",
  CLIENT_CHANGE: "NCC",
  ENGAGEMENT: "NEA",
  ENGAGEMENT_CHANGE: "NEC",
};

function isClientAcceptanceType(type: AcceptanceRequestTypeValue) {
  return type === "CLIENT" || type === "CLIENT_CHANGE";
}

function isEngagementAcceptanceType(type: AcceptanceRequestTypeValue) {
  return type === "ENGAGEMENT" || type === "ENGAGEMENT_CHANGE";
}

function isChangeAcceptanceType(type: AcceptanceRequestTypeValue) {
  return type === "CLIENT_CHANGE" || type === "ENGAGEMENT_CHANGE";
}

async function nextApprovalNumber(
  tx: Prisma.TransactionClient,
  type: AcceptanceRequestTypeValue,
  issuedAt: Date
) {
  const prefix = APPROVAL_NUMBER_PREFIX[type];
  const year = issuedAt.getUTCFullYear();
  const sequence = await tx.cmpApprovalNumberSequence.findUnique({
    where: { prefix_year: { prefix, year } },
    select: { lastNumber: true },
  });
  let nextNumber = (sequence?.lastNumber ?? 0) + 1;

  const existingReferences = isClientAcceptanceType(type)
    ? await tx.cmpClient.findMany({
        where: {
          approvalReferenceNumber: { startsWith: `${prefix}-${year}-` },
        },
        select: { approvalReferenceNumber: true },
      })
    : await tx.cmpEngagement.findMany({
        where: {
          approvalReferenceNumber: { startsWith: `${prefix}-${year}-` },
        },
        select: { approvalReferenceNumber: true },
      });
  for (const record of existingReferences) {
    const value = Number(record.approvalReferenceNumber?.split("-").at(-1));
    if (Number.isInteger(value)) {
      nextNumber = Math.max(nextNumber, value + 1);
    }
  }

  await tx.cmpApprovalNumberSequence.upsert({
    where: { prefix_year: { prefix, year } },
    create: { prefix, year, lastNumber: nextNumber },
    update: { lastNumber: nextNumber },
  });
  return `${prefix}-${year}-${String(nextNumber).padStart(4, "0")}`;
}

const ACTIVE_CHANGE_ACCEPTANCE_STATUSES = [
  "DRAFT",
  "STAFF_EDITING",
  "RETURNED",
  "PENDING_MIC",
  "PENDING_PIC",
  "PENDING_IT",
] as const;

function assertChangeTargetIsImmutable(
  existing: {
    type: AcceptanceRequestTypeValue;
    targetClientId: string | null;
    targetEngagementId: string | null;
  },
  input: UpdateCmpAcceptanceRequestInput
) {
  if (
    existing.type === "CLIENT_CHANGE" &&
    input.targetClientId !== undefined &&
    normalizeOptional(input.targetClientId) !== existing.targetClientId
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A Client Change target cannot be replaced after creation"
    );
  }
  if (
    existing.type === "ENGAGEMENT_CHANGE" &&
    input.targetEngagementId !== undefined &&
    normalizeOptional(input.targetEngagementId) !== existing.targetEngagementId
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "An Engagement Change target cannot be replaced after creation"
    );
  }
}

function isJsonRecord(
  value: Prisma.JsonValue | null
): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectStringValues(records: Prisma.JsonObject[], key: string) {
  const values = new Set<string>();
  const visit = (value: Prisma.JsonValue) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (
        nestedKey === key &&
        typeof nestedValue === "string" &&
        nestedValue.trim()
      ) {
        values.add(nestedValue);
      }
      if (nestedValue !== undefined) {
        visit(nestedValue);
      }
    }
  };
  records.forEach(visit);
  return [...values];
}

function getAcceptanceTypeLabel(type: AcceptanceRequestTypeValue) {
  return ACCEPTANCE_TYPE_LABEL[type];
}

function getAcceptanceSubject(request: {
  type: AcceptanceRequestTypeValue;
  clientPayload: Prisma.JsonValue | null;
  engagementPayload: Prisma.JsonValue | null;
}) {
  if (isClientAcceptanceType(request.type)) {
    const payload = (request.clientPayload ?? {}) as Partial<{
      clientCode: string;
      nameEn: string;
      nameZh: string;
    }>;
    return (
      payload.nameEn ?? payload.nameZh ?? payload.clientCode ?? "Unnamed client"
    );
  }
  const payload = (request.engagementPayload ?? {}) as Partial<{
    engagementCode: string;
  }>;
  return payload.engagementCode ?? "Unnamed engagement";
}

function notificationExcerpt(value: string, limit = 120) {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, Math.max(0, limit - 1))}…`
    : normalized;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function throwActiveChangeAcceptanceConflict(requestNo?: string): never {
  const existingRequest = requestNo ? ` (${requestNo})` : "";
  throw new ApiConflictException(
    "CONFLICT_RISK",
    `An active Change request${existingRequest} already exists for this master record. Merge the new changes into that request, or have it returned to MIC for revision.`
  );
}

function handleActiveChangeAcceptanceConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return;
  }
  const target = error.meta?.target;
  const constraint = [
    error.message,
    Array.isArray(target) ? target.join(" ") : String(target ?? ""),
  ].join(" ");
  if (
    constraint.includes(
      "cmp_acceptance_requests_active_client_change_target_key"
    ) ||
    constraint.includes(
      "cmp_acceptance_requests_active_engagement_change_target_key"
    )
  ) {
    throwActiveChangeAcceptanceConflict();
  }
}

function handleDuplicateCode(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiBadRequestException("DUPLICATE_CODE", message);
  }
}

const CLIENT_RESPONSIBLE_PERSON_FIELDS = [
  {
    idKey: "clientLeadingPartnerId",
    nameKey: "clientLeadingPartner",
    label: "Client Leading Partner",
  },
  {
    idKey: "clientPartnerPicId",
    nameKey: "clientPartnerPic",
    label: "PIC",
  },
  {
    idKey: "clientManagerMicId",
    nameKey: "clientManagerMic",
    label: "MIC",
  },
  {
    idKey: "alternativePartnerSecondMicId",
    nameKey: "alternativePartnerSecondMic",
    label: "Alternative Partner / 2nd MIC",
  },
] as const;

type ClientResponsiblePersonInput = Pick<
  Partial<CreateCmpClientInput>,
  | "clientPartnerPicId"
  | "clientPartnerPic"
  | "clientLeadingPartnerId"
  | "clientLeadingPartner"
  | "clientManagerMicId"
  | "clientManagerMic"
  | "alternativePartnerSecondMicId"
  | "alternativePartnerSecondMic"
>;

async function buildClientResponsiblePersonData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: ClientResponsiblePersonInput,
  partial: boolean
) {
  const data: Record<string, string | null> = {};
  for (const field of CLIENT_RESPONSIBLE_PERSON_FIELDS) {
    const hasIdInput = Object.hasOwn(input, field.idKey);
    const normalizedId = normalizeOptional(input[field.idKey]);
    if (normalizedId) {
      const user = await prisma.user.findFirst({
        where: { id: normalizedId, status: "ACTIVE" },
        select: { name: true },
      });
      if (!user) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          `${field.label} must be an active user`
        );
      }
      data[field.idKey] = normalizedId;
      data[field.nameKey] = user.name;
      continue;
    }
    if (hasIdInput) {
      data[field.idKey] = null;
      data[field.nameKey] = null;
      continue;
    }
    if (!partial || Object.hasOwn(input, field.nameKey)) {
      data[field.nameKey] = normalizeOptional(input[field.nameKey]);
    }
  }
  return data;
}

const ENGAGEMENT_RESPONSIBLE_PERSON_FIELDS = [
  {
    idKey: "picUserId",
    nameKey: "pic",
    label: "PIC",
    roles: ["PARTNER", "PRINCIPAL"],
  },
  {
    idKey: "micUserId",
    nameKey: "mic",
    label: "MIC",
    roles: ["MANAGER"],
  },
  {
    idKey: "eqReviewerUserId",
    nameKey: "eqReviewer",
    label: "EQR",
    roles: ["EQCR"],
  },
] as const;

type EngagementResponsiblePersonInput = {
  engagementRiskClassification?:
    | CreateCmpEngagementInput["engagementRiskClassification"]
    | null;
  eqReviewer?: string | null;
  eqReviewerUserId?: string | null;
  mic?: string | null;
  micUserId?: string | null;
  pic?: string | null;
  picUserId?: string | null;
};

async function buildEngagementResponsiblePersonData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: EngagementResponsiblePersonInput,
  partial: boolean,
  riskClassification:
    | "NORMAL"
    | "GREATER_THAN_NORMAL" = input.engagementRiskClassification ?? "NORMAL"
) {
  const data: Record<string, string | null> = {};
  for (const field of ENGAGEMENT_RESPONSIBLE_PERSON_FIELDS) {
    const isConditionallyRequired =
      field.idKey === "eqReviewerUserId"
        ? riskClassification !== "NORMAL"
        : true;
    if (!isConditionallyRequired) {
      data[field.idKey] = null;
      data[field.nameKey] = null;
      continue;
    }
    const hasIdInput = Object.hasOwn(input, field.idKey);
    const normalizedId = normalizeOptional(input[field.idKey]);
    if (normalizedId) {
      const user = await prisma.user.findFirst({
        where: {
          id: normalizedId,
          status: "ACTIVE",
          globalRole: { in: [...field.roles] },
        },
        select: { name: true },
      });
      if (!user) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          `${field.label} must be an active ${field.roles.join(" or ")} user`
        );
      }
      data[field.idKey] = normalizedId;
      data[field.nameKey] = user.name;
      continue;
    }
    if (hasIdInput) {
      data[field.idKey] = null;
      data[field.nameKey] = null;
      continue;
    }
    if (!partial) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        `${field.label} is required`
      );
    }
  }
  const ids = Object.entries(data)
    .filter(([key, value]) => key.endsWith("UserId") && value)
    .map(([, value]) => value);
  if (ids.length !== new Set(ids).size) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "PIC, MIC, and EQR must be different users"
    );
  }
  return data;
}

async function materializeApprovedAcceptance(
  tx: Prisma.TransactionClient,
  request: {
    id: string;
    type: AcceptanceRequestTypeValue;
    workflowVersion: number;
    clientPayload: Prisma.JsonValue | null;
    engagementPayload: Prisma.JsonValue | null;
    targetClientId: string | null;
    targetEngagementId: string | null;
  },
  actorId: string
) {
  if (isClientAcceptanceType(request.type)) {
    const parsedPayload = assertCompleteClientAcceptancePayload(
      request.clientPayload
    );
    if (!parsedPayload) {
      throw new ApiBadRequestException(
        "BAD_REQUEST",
        "Client acceptance requires client payload"
      );
    }
    const approvalIssuedAt = new Date();
    const approvalReferenceNumber = await nextApprovalNumber(
      tx,
      request.type,
      approvalIssuedAt
    );
    const approvalDate = approvalIssuedAt.toISOString().slice(0, 10);
    const payload = await prepareClientGroupStructure(
      tx,
      {
        ...parsedPayload,
        approvalReferenceNumber,
        approvalDate,
      },
      request.targetClientId
    );
    if (request.targetClientId) {
      const existing = await tx.cmpClient.findUnique({
        where: { id: request.targetClientId },
        select: { id: true },
      });
      if (!existing) {
        throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
      }
      await assertCompanyCodeAvailable(
        tx,
        payload.companyCode,
        request.targetClientId
      );
      const updateData = await buildCmpClientUpdateData(tx, payload);
      Object.assign(updateData, {
        approvalReferenceNumber,
        approvalDate: approvalIssuedAt,
      });
      await tx.cmpClient.update({
        where: { id: request.targetClientId },
        data: updateData,
      });
      await replaceClientAddresses(tx, request.targetClientId, payload);
      await replaceClientContacts(tx, request.targetClientId, payload);
      await applyClientGroupStructure(
        tx,
        request.targetClientId,
        payload.groupStructure,
        request.id,
        actorId
      );
      await ensureCmpClientRootEntity(
        tx,
        request.targetClientId,
        parsedPayload
      );
      await materializeCmpRelatedPartyDraft(
        tx,
        request.targetClientId,
        actorId,
        parsedPayload.relatedEntities ?? [],
        parsedPayload.relatedRelationships ?? [],
        parsedPayload.relatedGroupRelationships ?? [],
        parsedPayload.removedGroupRelationshipIds ?? []
      );
      await tx.cmpAmlScreeningBatch.updateMany({
        where: { acceptanceRequestId: request.id },
        data: { clientId: request.targetClientId },
      });
      return { targetClientId: request.targetClientId };
    }
    await assertCompanyCodeAvailable(tx, payload.companyCode);
    const client = await tx.cmpClient.create({
      data: {
        ...(await buildCmpClientData(tx, payload)),
        createdById: actorId,
      },
      select: { id: true },
    });
    await replaceClientAddresses(tx, client.id, payload);
    await replaceClientContacts(tx, client.id, payload);
    await applyClientGroupStructure(
      tx,
      client.id,
      payload.groupStructure,
      request.id,
      actorId
    );
    await ensureCmpClientRootEntity(tx, client.id, parsedPayload);
    await materializeCmpEntityMapDraft(tx, request.id, client.id, actorId);
    await materializeCmpRelatedPartyDraft(
      tx,
      client.id,
      actorId,
      parsedPayload.relatedEntities ?? [],
      parsedPayload.relatedRelationships ?? [],
      parsedPayload.relatedGroupRelationships ?? [],
      parsedPayload.removedGroupRelationshipIds ?? []
    );
    await tx.cmpAmlScreeningBatch.updateMany({
      where: { acceptanceRequestId: request.id },
      data: { clientId: client.id },
    });
    return { targetClientId: client.id };
  }

  if (!request.engagementPayload) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Engagement acceptance requires engagement payload"
    );
  }
  const parsedPayload = CreateCmpEngagementSchema.safeParse(
    request.engagementPayload
  );
  if (!parsedPayload.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Engagement commercial information must be completed before final approval"
    );
  }
  const payload = parsedPayload.data;
  const approvalIssuedAt = new Date();
  const approvalReferenceNumber = await nextApprovalNumber(
    tx,
    request.type,
    approvalIssuedAt
  );
  const materializedPayload = {
    ...payload,
    approvalReferenceNumber,
    approvalDate: approvalIssuedAt.toISOString().slice(0, 10),
  };
  if (request.targetEngagementId) {
    const existing = await tx.cmpEngagement.findUnique({
      where: { id: request.targetEngagementId },
      select: { engagementCode: true, status: true },
    });
    if (!existing) {
      throw new ApiNotFoundException("NOT_FOUND", "Engagement was not found");
    }
    if (existing.status === "ARCHIVED") {
      throw new ApiBadRequestException(
        "CMP_ENGAGEMENT_ARCHIVED",
        "Archived Engagements cannot be changed through approval"
      );
    }
    const nextCode = payload.engagementCode.trim();
    const codeChanged =
      normalizeEngagementCode(nextCode) !==
      normalizeEngagementCode(existing.engagementCode);
    if (codeChanged) {
      await ensureEngagementCodeAvailable(
        tx,
        nextCode,
        request.targetEngagementId
      );
      await tx.cmpEngagementCodeAlias.deleteMany({
        where: {
          engagementId: request.targetEngagementId,
          normalizedCode: normalizeEngagementCode(nextCode),
        },
      });
      await tx.cmpEngagementCodeAlias.create({
        data: {
          engagementId: request.targetEngagementId,
          code: existing.engagementCode,
          normalizedCode: normalizeEngagementCode(existing.engagementCode),
        },
      });
    }
    const engagementData = await buildCmpEngagementUpdateData(
      tx,
      materializedPayload
    );
    await tx.cmpEngagement.update({
      where: { id: request.targetEngagementId },
      data: engagementData,
    });
    await replaceEngagementFeePlanLines(
      tx,
      request.targetEngagementId,
      materializedPayload.feePlanningLines,
      materializedPayload.feeCurrency,
      engagementData.feeExchangeRateSnapshotId as string | null | undefined,
      engagementData.feeExchangeRateHkdPerUnit as string | null | undefined
    );
    return { targetEngagementId: request.targetEngagementId };
  }
  await ensureEngagementCodeAvailable(tx, payload.engagementCode);
  const engagementData = await buildCmpEngagementData(tx, materializedPayload);
  const engagement = await tx.cmpEngagement.create({
    data: {
      ...engagementData,
      createdById: actorId,
    },
    select: { id: true },
  });
  await replaceEngagementFeePlanLines(
    tx,
    engagement.id,
    materializedPayload.feePlanningLines,
    materializedPayload.feeCurrency,
    engagementData.feeExchangeRateSnapshotId,
    engagementData.feeExchangeRateHkdPerUnit
  );
  return { targetEngagementId: engagement.id };
}

async function buildCmpClientData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: MaterializedCmpClientInput
) {
  const responsiblePeople = await buildClientResponsiblePersonData(
    prisma,
    input,
    false
  );
  const contacts = normalizeClientContacts(input);
  const [primaryContact] = contacts;
  return {
    clientCode: input.clientCode,
    companyCode: normalizeOptional(input.companyCode),
    companyIdentifierType:
      input.companyIdentifierType ?? "COMPANY_REGISTRATION_NUMBER",
    companyNumber: normalizeOptional(input.companyNumber),
    nameZh: normalizeOptional(input.nameZh),
    nameEn: normalizeOptional(input.nameEn),
    groupId: normalizeOptional(input.groupId),
    groupMode: normalizeOptional(input.groupMode),
    groupName: normalizeOptional(input.groupName),
    address: normalizeOptional(input.address),
    contactPerson:
      primaryContact?.name ?? normalizeOptional(input.contactPerson),
    telephone:
      primaryContact?.officePhone ?? normalizeOptional(input.telephone),
    email: primaryContact?.email ?? normalizeOptional(input.email),
    website: normalizeOptional(input.website),
    yearEndDate: normalizeOptionalDate(input.yearEndDate),
    yearEndMonth: input.yearEndMonth ?? null,
    hsicSectionCode: normalizeOptional(input.hsicSectionCode),
    industryOtherDescription:
      input.hsicSectionCode === "OTHER"
        ? normalizeOptional(input.industryOtherDescription)
        : null,
    reportingGaap: normalizeOptional(input.reportingGaap),
    contactPosition:
      primaryContact?.position ?? normalizeOptional(input.contactPosition),
    contactDepartment:
      primaryContact?.department ?? normalizeOptional(input.contactDepartment),
    contactMobile:
      primaryContact?.mobile ?? normalizeOptional(input.contactMobile),
    contactRemarks:
      primaryContact?.remarks ?? normalizeOptional(input.contactRemarks),
    principalAddressSameAsRegistered:
      input.principalAddressSameAsRegistered ?? false,
    placeOfIncorporation: normalizeOptional(input.placeOfIncorporation),
    incorporationYearMonth: normalizeOptional(input.incorporationYearMonth),
    listedOrPrivate: normalizeOptional(input.listedOrPrivate),
    companyTypeOtherDescription: normalizeOptional(
      input.companyTypeOtherDescription
    ),
    stockExchangeOrListingPlace: normalizeOptional(
      input.stockExchangeOrListingPlace
    ),
    stockCode: normalizeOptional(input.stockCode),
    marketSegment: normalizeOptional(input.marketSegment),
    regulatedEntities: normalizeOptional(input.regulatedEntities),
    regulatedBy: normalizeOptional(input.regulatedBy),
    referredBy: normalizeOptional(input.referredBy),
    ...responsiblePeople,
    expectedJobOrEngagementType: normalizeOptional(
      input.expectedJobOrEngagementType
    ),
    serviceType: normalizeOptional(input.serviceType),
    serviceLines: normalizeOptional(input.serviceLines),
    taxServiceDetails: normalizeOptional(input.taxServiceDetails),
    comSecServiceDetails: normalizeOptional(input.comSecServiceDetails),
    otherServiceDescription: normalizeOptional(input.otherServiceDescription),
    approvalReferenceNumber: normalizeOptional(input.approvalReferenceNumber),
    approvalDate: normalizeOptionalDate(input.approvalDate),
    remarks: normalizeOptional(input.remarks),
    preparedBy: normalizeOptional(input.preparedBy),
    approvedBy: normalizeOptional(input.approvedBy),
    micApproval: normalizeOptional(input.micApproval),
    picApproval: normalizeOptional(input.picApproval),
    itAdmin: normalizeOptional(input.itAdmin),
    signOffDate: normalizeOptionalDate(input.signOffDate),
    status: input.status,
  };
}

async function buildCmpClientUpdateData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: MaterializedCmpClientInput
): Promise<Prisma.CmpClientUncheckedUpdateInput> {
  await Promise.resolve();
  return buildCmpClientData(prisma, input);
}

async function replaceClientAddresses(
  tx: Prisma.TransactionClient,
  clientId: string,
  input: MaterializedCmpClientInput
) {
  const registeredAddress = normalizeOptional(input.registeredAddress);
  const principalAddress = normalizeOptional(
    input.principalAddressSameAsRegistered
      ? input.registeredAddress
      : input.principalBusinessAddress
  );
  const additionalAddresses = (input.additionalAddresses ?? []).flatMap(
    (address, index) => {
      const label = normalizeOptional(address.label);
      const addressValue = normalizeOptional(address.address);
      return label && addressValue
        ? [
            {
              id: normalizeOptional(address.id),
              label,
              address: addressValue,
              sortOrder: address.sortOrder ?? index,
            },
          ]
        : [];
    }
  );
  const existing = await tx.cmpClientAddress.findMany({
    where: { clientId },
    select: { id: true },
  });
  const incomingIds = new Set(
    additionalAddresses.map((address) => address.id).filter(Boolean)
  );
  await tx.cmpClientAddress.deleteMany({
    where: {
      clientId,
      OR: [
        { type: { in: ["REGISTERED", "PRINCIPAL"] } },
        {
          type: "OTHER",
          id: {
            notIn: existing
              .filter((item) => incomingIds.has(item.id))
              .map((item) => item.id),
          },
        },
      ],
    },
  });

  const standardAddresses = [
    ...(registeredAddress
      ? [
          {
            clientId,
            type: "REGISTERED" as const,
            label: "Registered address",
            address: registeredAddress,
            sortOrder: 0,
          },
        ]
      : []),
    ...(principalAddress
      ? [
          {
            clientId,
            type: "PRINCIPAL" as const,
            label: "Principal business address",
            address: principalAddress,
            sortOrder: 0,
          },
        ]
      : []),
  ];
  if (standardAddresses.length > 0) {
    await tx.cmpClientAddress.createMany({
      data: standardAddresses,
    });
  }
  for (const address of additionalAddresses) {
    await (address.id && existing.some((item) => item.id === address.id)
      ? tx.cmpClientAddress.update({
          where: { id: address.id },
          data: {
            type: "OTHER",
            label: address.label,
            address: address.address,
            sortOrder: address.sortOrder,
          },
        })
      : tx.cmpClientAddress.create({
          data: {
            clientId,
            type: "OTHER",
            label: address.label,
            address: address.address,
            sortOrder: address.sortOrder,
          },
        }));
  }
}

function normalizeClientContacts(
  input: Pick<
    CreateCmpClientInput,
    | "contacts"
    | "contactPerson"
    | "contactPosition"
    | "contactDepartment"
    | "telephone"
    | "contactMobile"
    | "email"
    | "contactRemarks"
  >
) {
  const source =
    input.contacts === undefined
      ? [
          {
            name: input.contactPerson,
            position: input.contactPosition,
            department: input.contactDepartment,
            officePhone: input.telephone,
            mobile: input.contactMobile,
            email: input.email,
            remarks: input.contactRemarks,
          },
        ]
      : input.contacts;
  return source.flatMap((contact, index) => {
    const normalized = {
      id: normalizeOptional(contact.id),
      name: normalizeOptional(contact.name),
      position: normalizeOptional(contact.position),
      department: normalizeOptional(contact.department),
      officePhone: normalizeOptional(contact.officePhone),
      mobile: normalizeOptional(contact.mobile),
      email: normalizeOptional(contact.email),
      remarks: normalizeOptional(contact.remarks),
      sortOrder: contact.sortOrder ?? index,
    };
    return Object.entries(normalized).some(
      ([key, value]) =>
        key !== "id" && typeof value === "string" && Boolean(value)
    )
      ? [normalized]
      : [];
  });
}

function contactCreateData(
  contact: ReturnType<typeof normalizeClientContacts>[number]
) {
  return {
    name: contact.name,
    position: contact.position,
    department: contact.department,
    officePhone: contact.officePhone,
    mobile: contact.mobile,
    email: contact.email,
    remarks: contact.remarks,
    sortOrder: contact.sortOrder,
  };
}

async function replaceClientContacts(
  tx: Prisma.TransactionClient,
  clientId: string,
  input: MaterializedCmpClientInput
) {
  const contacts = normalizeClientContacts(input);
  await tx.cmpClientContact.deleteMany({ where: { clientId } });
  if (contacts.length === 0) {
    return;
  }
  await tx.cmpClientContact.createMany({
    data: contacts.map((contact) => ({
      clientId,
      ...contactCreateData(contact),
    })),
  });
}

type CmpEngagementPersistenceInput = Omit<
  CreateCmpEngagementInput,
  "serviceType" | "feeExchangeRateSource"
> & {
  serviceType: CmpEngagementArchivePayload["serviceType"];
  feeExchangeRateSource?: "SYSTEM" | "MANUAL";
};

async function buildCmpEngagementData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: CmpEngagementPersistenceInput
) {
  const responsiblePeople = await buildEngagementResponsiblePersonData(
    prisma,
    input,
    false
  );
  const exchangeRate = await resolveEngagementExchangeRate(
    prisma,
    input.feeCurrency,
    input.feeExchangeRateSnapshotId,
    input.feeExchangeRateHkdPerUnit,
    input.feeExchangeRateSource ?? "SYSTEM"
  );
  return {
    clientId: input.clientId,
    engagementCode: input.engagementCode,
    serviceType: input.serviceType,
    otherServiceDescription:
      input.serviceType === "OTHERS"
        ? normalizeOptional(input.otherServiceDescription)
        : null,
    deliverables: input.deliverables ?? [],
    yearEndDate: normalizeOptionalDate(input.yearEndDate),
    reportDate: normalizeOptionalDate(input.reportDate),
    approvalReferenceNumber: normalizeOptional(input.approvalReferenceNumber),
    engagementDate: normalizeOptionalDate(input.engagementDate),
    budgetedHours: input.budgetedHours,
    agreedFee: input.agreedFee,
    recoveryRate: normalizeOptional(input.recoveryRate),
    feeCurrency: input.feeCurrency,
    feeExchangeRateSnapshotId: exchangeRate.snapshotId,
    feeExchangeRateHkdPerUnit: exchangeRate.hkdPerUnit,
    feeExchangeRateSource: exchangeRate.source,
    amlRiskClassification: input.amlRiskClassification,
    engagementRiskClassification: input.engagementRiskClassification,
    ...responsiblePeople,
    status: input.status,
    remarks: normalizeOptional(input.remarks),
  };
}

async function buildCmpEngagementUpdateData(
  prisma: Prisma.TransactionClient | PrismaService,
  input: CmpEngagementPersistenceInput
): Promise<Prisma.CmpEngagementUncheckedUpdateInput> {
  await Promise.resolve();
  return buildCmpEngagementData(prisma, input);
}

async function replaceEngagementFeePlanLines(
  tx: Prisma.TransactionClient,
  engagementId: string,
  lines: CmpEngagementPersistenceInput["feePlanningLines"],
  feeCurrency: CmpEngagementPersistenceInput["feeCurrency"],
  feeExchangeRateSnapshotId?: string | null,
  feeExchangeRateHkdPerUnit?: string | null,
  allowHistoricalStaff = false
) {
  if (lines === undefined) {
    return;
  }
  const hkdPerUnit = feeExchangeRateHkdPerUnit
    ? Number(feeExchangeRateHkdPerUnit)
    : await resolveBudgetExchangeRate(
        tx,
        feeCurrency,
        feeExchangeRateSnapshotId
      );
  if (!Number.isFinite(hkdPerUnit) || hkdPerUnit <= 0) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Applied engagement exchange rate is unavailable"
    );
  }
  const engagement = await tx.cmpEngagement.findUniqueOrThrow({
    where: { id: engagementId },
    select: {
      clientId: true,
      client: { select: { listedOrPrivate: true } },
    },
  });
  const sourceLineIds = [
    ...new Set(lines.map((line) => line.key.split("::")[0] ?? line.key)),
  ];
  const sourceLines =
    sourceLineIds.length > 0
      ? await tx.cmpEngagementFeePlanLine.findMany({
          where: { id: { in: sourceLineIds } },
          select: {
            id: true,
            grade: true,
            hourlyRate: true,
            engagement: {
              select: {
                clientId: true,
                feeCurrency: true,
                feeExchangeRateSnapshotId: true,
                feeExchangeRateHkdPerUnit: true,
              },
            },
          },
        })
      : [];
  const copiedHourlyRates = new Map(
    sourceLines
      .filter(
        (sourceLine) =>
          sourceLine.engagement.clientId === engagement.clientId &&
          sourceLine.engagement.feeCurrency === feeCurrency &&
          sourceLine.engagement.feeExchangeRateSnapshotId ===
            feeExchangeRateSnapshotId &&
          sourceLine.engagement.feeExchangeRateHkdPerUnit?.toFixed(8) ===
            feeExchangeRateHkdPerUnit
      )
      .map((sourceLine) => [sourceLine.id, sourceLine])
  );
  const resolvedLines = lines.map((line) => {
    const sourceLine = copiedHourlyRates.get(
      line.key.split("::")[0] ?? line.key
    );
    return {
      ...line,
      hourlyRate:
        sourceLine?.grade === line.grade
          ? sourceLine.hourlyRate.toFixed(2)
          : (
              CMP_ENGAGEMENT_FEE_PLAN_GRADE_RATES[line.grade] / hkdPerUnit
            ).toFixed(2),
    };
  });
  const staffUserIds = resolvedLines
    .map((line) => line.staffUserId)
    .filter((userId): userId is string => Boolean(userId));
  if (new Set(staffUserIds).size !== staffUserIds.length) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A staff member can only be selected once in a budget"
    );
  }
  if (staffUserIds.length > 0) {
    const eligibleUsers = await tx.user.count({
      where: {
        id: { in: staffUserIds },
        globalRole: { not: "SUPER_ADMIN" },
        ...(allowHistoricalStaff ? {} : { status: "ACTIVE" }),
      },
    });
    if (eligibleUsers !== staffUserIds.length) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        allowHistoricalStaff
          ? "Budget staff must be valid firm users"
          : "Budget staff must be active users"
      );
    }
  }
  const budgetValidation = validateCmpEngagementBudget({
    isPrivateClient: engagement.client.listedOrPrivate === "PRIVATE",
    hkdPerUnit,
    lines: resolvedLines.map((line) => ({
      grade: line.grade,
      hourlyRate: Number(line.hourlyRate),
      budgetHours: Number(line.budgetHours),
    })),
  });
  if (!budgetValidation.privateCostRule.passed) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "For private engagements over HK$10,000, partner and manager time costs must be at least 30% of total engagement costs"
    );
  }
  await tx.cmpEngagementFeePlanLine.deleteMany({ where: { engagementId } });
  if (resolvedLines.length === 0) {
    return;
  }
  for (const [index, line] of resolvedLines.entries()) {
    await tx.cmpEngagementFeePlanLine.create({
      data: {
        engagementId,
        grade: line.grade,
        quantity: 1,
        hourlyRate: line.hourlyRate,
        hoursPerPerson: Number(line.budgetHours).toFixed(2),
        otHoursPerPerson: "0.00",
        dateFrom: normalizeOptionalDate(line.dateFrom),
        dateTo: normalizeOptionalDate(line.dateTo),
        tbcQuantity: line.assignmentType === "TBC" ? 1 : 0,
        sortOrder: line.sortOrder ?? index,
        staff: {
          create:
            line.assignmentType === "STAFF" && line.staffUserId
              ? [{ userId: line.staffUserId, sortOrder: 0 }]
              : [],
        },
      },
    });
  }
}

async function resolveBudgetExchangeRateSnapshotId(
  prisma: Prisma.TransactionClient | PrismaService,
  currency: CreateCmpEngagementInput["feeCurrency"],
  snapshotId?: string | null
) {
  if (currency === "HKD") {
    return null;
  }
  if (!snapshotId) {
    const snapshot = await resolveCurrentBudgetExchangeRateSnapshot(
      prisma,
      currency
    );
    return snapshot.id;
  }
  const snapshot = await prisma.cmpBudgetExchangeRateSnapshot.findFirst({
    where: { id: snapshotId, currency },
    select: { id: true },
  });
  if (!snapshot) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Budget exchange-rate snapshot is unavailable"
    );
  }
  return snapshot.id;
}

async function resolveEngagementExchangeRate(
  prisma: Prisma.TransactionClient | PrismaService,
  currency: CreateCmpEngagementInput["feeCurrency"],
  snapshotId?: string | null,
  manualHkdPerUnit?: string | null,
  source: "SYSTEM" | "MANUAL" = "SYSTEM"
) {
  if (currency === "HKD") {
    return {
      snapshotId: null,
      hkdPerUnit: "1.00000000",
      source: "SYSTEM" as const,
    };
  }
  const resolvedSnapshotId = await resolveBudgetExchangeRateSnapshotId(
    prisma,
    currency,
    snapshotId
  );
  if (!resolvedSnapshotId) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Budget exchange-rate snapshot is unavailable"
    );
  }
  if (source === "MANUAL") {
    const rate = new Prisma.Decimal(manualHkdPerUnit || "0");
    if (!rate.isFinite() || rate.lte(0)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A manual exchange rate greater than zero is required"
      );
    }
    return {
      snapshotId: resolvedSnapshotId,
      hkdPerUnit: rate
        .toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP)
        .toFixed(8),
      source: "MANUAL" as const,
    };
  }
  const snapshot = await prisma.cmpBudgetExchangeRateSnapshot.findUnique({
    where: { id: resolvedSnapshotId },
    select: { hkdPerUnit: true },
  });
  if (!snapshot) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Budget exchange-rate snapshot is unavailable"
    );
  }
  return {
    snapshotId: resolvedSnapshotId,
    hkdPerUnit: snapshot.hkdPerUnit
      .toDecimalPlaces(8, Prisma.Decimal.ROUND_HALF_UP)
      .toFixed(8),
    source: "SYSTEM" as const,
  };
}

async function resolveBudgetExchangeRate(
  prisma: Prisma.TransactionClient,
  currency: CreateCmpEngagementInput["feeCurrency"],
  snapshotId?: string | null
) {
  if (currency === "HKD") {
    return 1;
  }
  const snapshot = snapshotId
    ? await prisma.cmpBudgetExchangeRateSnapshot.findFirst({
        where: { id: snapshotId, currency },
        select: { hkdPerUnit: true },
      })
    : await resolveCurrentBudgetExchangeRateSnapshot(prisma, currency);
  const rate = Number(snapshot?.hkdPerUnit);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Budget exchange-rate snapshot is unavailable"
    );
  }
  return rate;
}

async function resolveCurrentBudgetExchangeRateSnapshot(
  prisma: Prisma.TransactionClient | PrismaService,
  currency: Exclude<CmpBudgetCurrency, "HKD">
) {
  const batch = await prisma.cmpExchangeRateBatch.findFirst({
    orderBy: [{ sourceDate: "desc" }, { fetchedAt: "desc" }],
    select: { id: true },
  });
  const snapshot = batch
    ? await prisma.cmpBudgetExchangeRateSnapshot.findFirst({
        where: { exchangeRateBatchId: batch.id, currency },
        select: { id: true, hkdPerUnit: true },
      })
    : null;
  if (snapshot) {
    return snapshot;
  }
  throw new ApiBadRequestException(
    "CMP_EXCHANGE_RATE_UNAVAILABLE",
    "The current CMP budget exchange rate is unavailable"
  );
}

function buildAcceptanceWhere(query: CmpAcceptanceListQuery) {
  const where: Prisma.CmpAcceptanceRequestWhereInput = {};
  if (query.type) {
    where.type = query.type;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.currentStep) {
    where.currentStep = query.currentStep;
  }
  if (query.targetEngagementId) {
    where.targetEngagementId = query.targetEngagementId;
  }
  const search = normalizeOptional(query.q);
  if (search) {
    where.OR = [
      { requestNo: { contains: search, mode: "insensitive" } },
      { submittedBy: { name: { contains: search, mode: "insensitive" } } },
      { micApprover: { name: { contains: search, mode: "insensitive" } } },
      { picApprover: { name: { contains: search, mode: "insensitive" } } },
      { itApprover: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  return where;
}

function buildApprovalWhere(
  userId: string
): Prisma.CmpAcceptanceRequestWhereInput {
  return {
    OR: [
      { status: "PENDING_MIC", currentStep: "MIC", micApproverId: userId },
      { status: "PENDING_PIC", currentStep: "PIC", picApproverId: userId },
      { status: "PENDING_IT", currentStep: "IT", itApproverId: userId },
    ],
  };
}

function buildAcceptanceVisibilityWhere(
  userId: string
): Prisma.CmpAcceptanceRequestWhereInput {
  return {
    OR: [
      { submittedById: userId },
      { micApproverId: userId },
      { picApproverId: userId },
      { itApproverId: userId },
      { draftAssigneeId: userId },
    ],
  };
}

function canUserSeeAcceptanceRequest(
  request: {
    submittedById: string;
    micApproverId: string;
    picApproverId: string | null;
    itApproverId: string | null;
    draftAssigneeId?: string | null;
  },
  userId: string
) {
  return (
    request.submittedById === userId ||
    request.micApproverId === userId ||
    request.picApproverId === userId ||
    request.itApproverId === userId ||
    request.draftAssigneeId === userId
  );
}

function canUserSeeMasterDraft(
  request: {
    status: string;
    submittedAt: Date | null;
    submittedById: string;
    micApproverId: string;
    draftAssigneeId: string | null;
    draftCompletedAt: Date | null;
  },
  userId: string
) {
  if (request.submittedById === userId) {
    return true;
  }
  if (resolveAcceptanceDraftControllerId(request) === userId) {
    return true;
  }
  return (
    request.status === "STAFF_EDITING" &&
    request.draftAssigneeId === userId &&
    request.draftCompletedAt === null
  );
}

function validateAcceptancePayload(
  input: {
    type: AcceptanceRequestTypeValue;
    clientPayload?: unknown;
    engagementPayload?: unknown;
    targetClientId?: string;
    targetEngagementId?: string;
  },
  options: {
    requireCompleteEngagement?: boolean;
    requireCompleteClient?: boolean;
  } = {}
) {
  if (isClientAcceptanceType(input.type) && !input.clientPayload) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client request requires client payload"
    );
  }
  if (isClientAcceptanceType(input.type)) {
    const parsedClient = CmpClientAcceptanceDraftPayloadSchema.safeParse(
      normalizeLegacyClientAcceptancePayload(input.clientPayload)
    );
    if (!parsedClient.success) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Client draft contains invalid values"
      );
    }
    if (input.type === "CLIENT" && parsedClient.data.status === "RESIGNED") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A new client cannot have Resigned status"
      );
    }
  }
  if (isClientAcceptanceType(input.type) && input.targetEngagementId) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client request cannot target an engagement"
    );
  }
  if (isEngagementAcceptanceType(input.type) && !input.engagementPayload) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Engagement request requires engagement payload"
    );
  }
  if (
    isEngagementAcceptanceType(input.type) &&
    !CmpAcceptanceEngagementDraftPayloadSchema.safeParse(
      input.engagementPayload
    ).success
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Engagement draft contains invalid values"
    );
  }
  if (options.requireCompleteClient && isClientAcceptanceType(input.type)) {
    assertCompleteClientAcceptancePayload(input.clientPayload);
  }
  if (
    options.requireCompleteEngagement &&
    isEngagementAcceptanceType(input.type) &&
    !CreateCmpEngagementSchema.safeParse(input.engagementPayload).success
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Complete the required Engagement fields before submitting"
    );
  }
  if (isEngagementAcceptanceType(input.type) && input.targetClientId) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Engagement request cannot target a client"
    );
  }
  if (
    input.type === "CLIENT_CHANGE" &&
    !normalizeOptional(input.targetClientId)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client change must target an existing client"
    );
  }
  if (input.type === "CLIENT" && normalizeOptional(input.targetClientId)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "New client acceptance cannot target an existing client"
    );
  }
  if (
    input.type === "ENGAGEMENT_CHANGE" &&
    !normalizeOptional(input.targetEngagementId)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Engagement change must target an existing engagement"
    );
  }
  if (
    input.type === "ENGAGEMENT" &&
    normalizeOptional(input.targetEngagementId)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "New engagement acceptance cannot target an existing engagement"
    );
  }
}

function assertAtLeastOneClientName(nameEn?: string, nameZh?: string) {
  if (normalizeOptional(nameEn) || normalizeOptional(nameZh)) {
    return;
  }
  throw new ApiBadRequestException(
    "VALIDATION_FAILED",
    "Company Name English or Chinese is required"
  );
}

function assertCompleteClientAcceptancePayload(
  payload: unknown
): MaterializedCmpClientInput {
  const parsedPayload = CmpClientAcceptanceDraftPayloadSchema.safeParse(
    normalizeLegacyClientAcceptancePayload(payload)
  );
  if (!parsedPayload.success) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Complete the required Client fields before submitting"
    );
  }
  const client = parsedPayload.data;
  if (!normalizeOptional(client.clientCode)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client Code is required before submitting"
    );
  }
  if (!normalizeOptional(client.companyCode)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Company Code is required before submitting"
    );
  }
  if (!normalizeOptional(client.companyNumber)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Company Number is required before submitting"
    );
  }
  if (!normalizeOptional(client.nameEn) && !normalizeOptional(client.nameZh)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Company Name English or Chinese is required before submitting"
    );
  }
  if (!client.status) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client Status is required before submitting"
    );
  }
  if (!client.yearEndMonth) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "YE Month / Year End is required before submitting"
    );
  }
  if (
    client.hsicSectionCode === "OTHER" &&
    !normalizeOptional(client.industryOtherDescription)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Other Industry Description is required when Industry is Other"
    );
  }
  if (!normalizeOptional(client.registeredAddress)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Registered address is required before submitting"
    );
  }
  if (!normalizeOptional(client.principalBusinessAddress)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Principal business address is required before submitting"
    );
  }
  if (!normalizeOptional(client.placeOfIncorporation)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Place of Incorporation is required before submitting"
    );
  }
  if (!normalizeOptional(client.listedOrPrivate)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Company Type is required before submitting"
    );
  }
  if (
    client.listedOrPrivate === "OTHER" &&
    !normalizeOptional(client.companyTypeOtherDescription)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Other Company Type is required before submitting"
    );
  }
  if (!normalizeOptional(client.clientLeadingPartnerId)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Client Leading Partner is required before submitting"
    );
  }
  if (!normalizeOptional(client.clientPartnerPicId)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "PIC is required before submitting"
    );
  }
  if (!normalizeOptional(client.clientManagerMicId)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "MIC is required before submitting"
    );
  }
  if (!normalizeOptional(client.serviceType)) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Service Type is required before submitting"
    );
  }
  if (
    [client.serviceType, client.serviceLines]
      .filter(Boolean)
      .join(",")
      .split(",")
      .some((service) => service.trim().toLowerCase() === "others") &&
    !normalizeOptional(client.expectedJobOrEngagementType)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Expected Job / Engagement Type is required when Others is selected"
    );
  }
  const relatedEntities = CmpRelatedEntityDraftSchema.array().safeParse(
    client.relatedEntities ?? []
  );
  const relatedRelationships =
    CmpEntityRelationshipDraftSchema.array().safeParse(
      client.relatedRelationships ?? []
    );
  const relatedGroupRelationships =
    CmpGroupRelationshipDraftSchema.array().safeParse(
      client.relatedGroupRelationships ?? []
    );
  const removedGroupRelationshipIds = z
    .array(z.string().min(1))
    .safeParse(client.removedGroupRelationshipIds ?? []);
  const companyIdentityResolution = client.companyIdentityResolution
    ? CmpCompanyIdentityResolutionSchema.safeParse(
        client.companyIdentityResolution
      )
    : null;
  if (
    !relatedEntities.success ||
    !relatedRelationships.success ||
    !relatedGroupRelationships.success ||
    !removedGroupRelationshipIds.success ||
    (companyIdentityResolution && !companyIdentityResolution.success)
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Related-party identity data is invalid"
    );
  }
  return {
    ...client,
    clientCode: client.clientCode ?? "",
    nameZh: client.nameZh ?? "",
    relatedEntities: relatedEntities.data,
    relatedRelationships: relatedRelationships.data,
    relatedGroupRelationships: relatedGroupRelationships.data,
    removedGroupRelationshipIds: removedGroupRelationshipIds.data,
    companyIdentityResolution: companyIdentityResolution?.data,
  } as MaterializedCmpClientInput;
}

type ClientGroupStructurePrisma = Prisma.TransactionClient | PrismaService;

async function prepareClientGroupStructure(
  prisma: ClientGroupStructurePrisma,
  input: MaterializedCmpClientInput,
  currentClientId: string | null
): Promise<MaterializedCmpClientInput> {
  const currentClient = currentClientId
    ? await prisma.cmpClient.findUnique({
        where: { id: currentClientId },
        select: {
          id: true,
          groupId: true,
          ultimateParentForGroup: { select: { id: true } },
        },
      })
    : null;
  if (currentClientId && !currentClient) {
    throw new ApiNotFoundException("NOT_FOUND", "Client was not found");
  }

  let proposal = input.groupStructure
    ? {
        ...input.groupStructure,
        relationships: [...(input.groupStructure.relationships ?? [])],
      }
    : undefined;
  const primaryGroupId =
    proposal?.primaryGroupId === undefined
      ? (normalizeOptional(input.groupId) ?? currentClient?.groupId ?? null)
      : normalizeOptional(proposal.primaryGroupId ?? undefined);
  const hasFormalSubsidiaryProposal = proposal?.relationships.some(
    (relationship) =>
      relationship.action === "UPSERT" && relationship.type === "SUBSIDIARY"
  );
  if (
    !hasFormalSubsidiaryProposal &&
    normalizeOptional(input.parentClientCode)
  ) {
    if (!primaryGroupId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Select a primary Group before converting the legacy Parent Client Code"
      );
    }
    const matches = await prisma.cmpClient.findMany({
      where: {
        clientCode: {
          equals: assertPresentValue(normalizeOptional(input.parentClientCode)),
          mode: "insensitive",
        },
        groupId: primaryGroupId,
        ...(currentClientId ? { id: { not: currentClientId } } : {}),
      },
      select: { id: true },
      take: 2,
    });
    if (matches.length !== 1) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The legacy Parent Client Code cannot be matched uniquely. Update the related-party relationship before submitting"
      );
    }
    proposal = {
      ...(proposal ?? {
        primaryGroupId,
        ultimateParentAction: "UNCHANGED" as const,
        relationships: [],
      }),
      relationships: [
        ...(proposal?.relationships ?? []),
        {
          action: "UPSERT",
          type: "SUBSIDIARY",
          direction: "TO_CLIENT",
          counterpartClientId: assertPresentValue(matches[0]).id,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          remarks: "Converted from legacy Parent Client Code",
        },
      ],
    };
  }

  if (!proposal) {
    return {
      ...input,
      groupId: primaryGroupId ?? undefined,
    };
  }

  proposal.primaryGroupId = primaryGroupId;
  if (primaryGroupId) {
    const group = await prisma.cmpClientGroup.findUnique({
      where: { id: primaryGroupId },
      select: { id: true, status: true, ultimateParentClientId: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The selected primary Group is not active"
      );
    }
  }

  const activeForCurrent = currentClientId
    ? await prisma.cmpClientRelationship.findMany({
        where: {
          effectiveTo: null,
          OR: [
            { fromClientId: currentClientId },
            { toClientId: currentClientId },
          ],
        },
        select: {
          id: true,
          groupId: true,
          fromClientId: true,
          toClientId: true,
          type: true,
        },
      })
    : [];
  const activeById = new Map(
    activeForCurrent.map((relationship) => [relationship.id, relationship])
  );
  const endingIds = new Set<string>();
  const pendingEdges: {
    relationshipId?: string;
    groupId: string;
    type: "SUBSIDIARY" | "ASSOCIATE" | "JOINT_VENTURE";
    fromClientId: string;
    toClientId: string;
  }[] = [];
  const currentNodeId = currentClientId ?? "__CURRENT_CLIENT__";

  for (const relationship of proposal.relationships ?? []) {
    if (relationship.action === "END") {
      const relationshipId = normalizeOptional(relationship.relationshipId);
      const existing = relationshipId
        ? activeById.get(relationshipId)
        : undefined;
      if (!existing) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "A relationship selected for ending is no longer active"
        );
      }
      if (!normalizeOptional(relationship.effectiveTo)) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "An end date is required when ending a relationship"
        );
      }
      assertRelationshipDateNotInFuture(
        relationship.effectiveTo,
        "Relationship end date"
      );
      endingIds.add(existing.id);
      continue;
    }

    const { type } = relationship;
    const { direction } = relationship;
    const counterpartClientId = normalizeOptional(
      relationship.counterpartClientId
    );
    const existingId = normalizeOptional(relationship.relationshipId);
    const proposedRelationshipGroupId = normalizeOptional(relationship.groupId);
    if (
      !type ||
      !direction ||
      !counterpartClientId ||
      !normalizeOptional(relationship.effectiveFrom)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Relationship type, related Client and effective date are required"
      );
    }
    assertRelationshipDateNotInFuture(
      relationship.effectiveFrom,
      "Relationship effective date"
    );
    if (counterpartClientId === currentClientId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A Client cannot be related to itself"
      );
    }
    const counterpart = await prisma.cmpClient.findUnique({
      where: { id: counterpartClientId },
      select: { id: true, groupId: true },
    });
    if (!counterpart) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The related Client no longer exists"
      );
    }
    let existingRelationship: (typeof activeForCurrent)[number] | undefined;
    if (existingId) {
      existingRelationship = activeById.get(existingId);
      if (!existingRelationship) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "A relationship selected for editing is no longer active"
        );
      }
      if (
        proposedRelationshipGroupId &&
        proposedRelationshipGroupId !== existingRelationship.groupId
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "An existing relationship cannot be moved to another Group"
        );
      }
      endingIds.add(existingId);
    }
    const relationshipGroupId = existingRelationship?.groupId ?? primaryGroupId;
    if (!relationshipGroupId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A primary Group is required for a new relationship"
      );
    }
    if (
      !existingRelationship &&
      proposedRelationshipGroupId &&
      proposedRelationshipGroupId !== primaryGroupId
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A new relationship must belong to the current Client's primary Group"
      );
    }
    if (
      type === "SUBSIDIARY" &&
      (!primaryGroupId ||
        relationshipGroupId !== primaryGroupId ||
        counterpart.groupId !== primaryGroupId)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Parent and subsidiary Clients must belong to the same primary Group"
      );
    }
    let fromClientId =
      direction === "FROM_CLIENT" ? currentNodeId : counterpartClientId;
    let toClientId =
      direction === "FROM_CLIENT" ? counterpartClientId : currentNodeId;
    if (type === "JOINT_VENTURE" && fromClientId > toClientId) {
      [fromClientId, toClientId] = [toClientId, fromClientId];
    }
    pendingEdges.push({
      ...(existingId ? { relationshipId: existingId } : {}),
      groupId: relationshipGroupId,
      type,
      fromClientId,
      toClientId,
    });
  }

  if (currentClient && currentClient.groupId !== primaryGroupId) {
    const unresolvedOldSubsidiary = activeForCurrent.some(
      (relationship) =>
        relationship.type === "SUBSIDIARY" && !endingIds.has(relationship.id)
    );
    if (unresolvedOldSubsidiary) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "End the Client's existing subsidiary relationships before changing its primary Group"
      );
    }
    if (
      currentClient.ultimateParentForGroup &&
      (proposal.ultimateParentAction ?? "UNCHANGED") === "UNCHANGED"
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Clear or reassign the Ultimate Parent before changing the primary Group"
      );
    }
  }

  if (primaryGroupId) {
    const currentSubsidiaryEdges = await prisma.cmpClientRelationship.findMany({
      where: {
        groupId: primaryGroupId,
        type: "SUBSIDIARY",
        effectiveTo: null,
      },
      select: { id: true, fromClientId: true, toClientId: true },
    });
    const finalEdges = [
      ...currentSubsidiaryEdges
        .filter((edge) => !endingIds.has(edge.id))
        .map((edge) => ({
          fromClientId: edge.fromClientId,
          toClientId: edge.toClientId,
        })),
      ...pendingEdges
        .filter(
          (edge) =>
            edge.type === "SUBSIDIARY" && edge.groupId === primaryGroupId
        )
        .map((edge) => ({
          fromClientId: edge.fromClientId,
          toClientId: edge.toClientId,
        })),
    ];
    assertValidSubsidiaryGraph(finalEdges);

    const group = await prisma.cmpClientGroup.findUniqueOrThrow({
      where: { id: primaryGroupId },
      select: {
        ultimateParentClientId: true,
        ultimateParent: { select: { id: true, groupId: true, status: true } },
      },
    });
    const ultimateAction = proposal.ultimateParentAction ?? "UNCHANGED";
    const finalUltimateParentId =
      ultimateAction === "SET_CURRENT"
        ? currentNodeId
        : ultimateAction === "CLEAR"
          ? null
          : group.ultimateParentClientId;
    const finalUltimateParent =
      finalUltimateParentId === currentNodeId
        ? { groupId: primaryGroupId, status: input.status }
        : group.ultimateParent;
    if (
      finalUltimateParentId &&
      (finalUltimateParent?.groupId !== primaryGroupId ||
        finalUltimateParent.status !== "ACTIVE")
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The Ultimate Parent must be an active primary member of the Group"
      );
    }
    if (
      finalUltimateParentId &&
      finalEdges.some((edge) => edge.toClientId === finalUltimateParentId)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "The Ultimate Parent cannot have an active parent relationship"
      );
    }
  } else if (
    (proposal.relationships ?? []).some(
      (relationship) => relationship.action === "UPSERT"
    ) ||
    proposal.ultimateParentAction === "SET_CURRENT"
  ) {
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "A primary Group is required for subsidiary and Ultimate Parent changes"
    );
  }

  return {
    ...input,
    groupId: primaryGroupId ?? undefined,
    groupStructure: proposal,
  };
}

export function assertValidSubsidiaryGraph(
  edges: { fromClientId: string; toClientId: string }[]
) {
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const existingParent = parentByChild.get(edge.toClientId);
    if (existingParent && existingParent !== edge.fromClientId) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "A subsidiary can only have one active direct parent"
      );
    }
    parentByChild.set(edge.toClientId, edge.fromClientId);
    const children = childrenByParent.get(edge.fromClientId) ?? [];
    children.push(edge.toClientId);
    childrenByParent.set(edge.fromClientId, children);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (clientId: string) => {
    if (visiting.has(clientId)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Subsidiary relationships cannot form a cycle"
      );
    }
    if (visited.has(clientId)) {
      return;
    }
    visiting.add(clientId);
    for (const childId of childrenByParent.get(clientId) ?? []) {
      visit(childId);
    }
    visiting.delete(clientId);
    visited.add(clientId);
  };
  for (const clientId of childrenByParent.keys()) {
    visit(clientId);
  }
}

async function applyClientGroupStructure(
  tx: Prisma.TransactionClient,
  currentClientId: string,
  proposal: CmpClientGroupStructureProposal | undefined,
  requestId: string,
  actorId: string
) {
  if (!proposal) {
    return;
  }
  const primaryGroupId = normalizeOptional(
    proposal.primaryGroupId ?? undefined
  );
  const currentRelationships = await tx.cmpClientRelationship.findMany({
    where: {
      effectiveTo: null,
      OR: [{ fromClientId: currentClientId }, { toClientId: currentClientId }],
    },
    select: {
      id: true,
      groupId: true,
      type: true,
      fromClientId: true,
      toClientId: true,
      ownershipPercentage: true,
      effectiveFrom: true,
      remarks: true,
    },
  });
  const currentRelationshipIds = new Set(
    currentRelationships.map((relationship) => relationship.id)
  );
  const currentRelationshipById = new Map(
    currentRelationships.map((relationship) => [relationship.id, relationship])
  );
  const unchangedRelationshipIds = new Set<string>();

  for (const relationship of proposal.relationships ?? []) {
    const relationshipId = normalizeOptional(relationship.relationshipId);
    if (relationship.action === "END" || relationshipId) {
      if (!relationshipId || !currentRelationshipIds.has(relationshipId)) {
        throw new ApiBadRequestException(
          "CONFLICT_RISK",
          "A proposed Client relationship changed during approval"
        );
      }
      const currentRelationship = currentRelationshipById.get(relationshipId);
      if (
        relationship.action === "UPSERT" &&
        currentRelationship &&
        relationshipProposalMatchesCurrent(
          relationship,
          currentRelationship,
          currentClientId
        )
      ) {
        unchangedRelationshipIds.add(relationshipId);
        continue;
      }
      await tx.cmpClientRelationship.update({
        where: { id: relationshipId },
        data: {
          effectiveTo:
            normalizeOptionalDate(
              relationship.action === "END"
                ? relationship.effectiveTo
                : relationship.effectiveFrom
            ) ?? new Date(),
        },
      });
    }
  }

  for (const relationship of proposal.relationships ?? []) {
    if (relationship.action !== "UPSERT") {
      continue;
    }
    if (
      relationship.relationshipId &&
      unchangedRelationshipIds.has(relationship.relationshipId)
    ) {
      continue;
    }
    const counterpartClientId = assertPresentValue(
      normalizeOptional(relationship.counterpartClientId)
    );
    let fromClientId =
      relationship.direction === "FROM_CLIENT"
        ? currentClientId
        : counterpartClientId;
    let toClientId =
      relationship.direction === "FROM_CLIENT"
        ? counterpartClientId
        : currentClientId;
    if (relationship.type === "JOINT_VENTURE" && fromClientId > toClientId) {
      [fromClientId, toClientId] = [toClientId, fromClientId];
    }
    await tx.cmpClientRelationship.create({
      data: {
        groupId:
          currentRelationshipById.get(
            normalizeOptional(relationship.relationshipId) ?? ""
          )?.groupId ??
          normalizeOptional(relationship.groupId) ??
          assertPresentValue(primaryGroupId),
        fromClientId,
        toClientId,
        type: assertPresentValue(relationship.type),
        ownershipPercentage:
          relationship.ownershipPercentage === undefined
            ? null
            : new Prisma.Decimal(relationship.ownershipPercentage),
        effectiveFrom: normalizeOptionalDate(relationship.effectiveFrom),
        remarks: normalizeOptional(relationship.remarks),
        approvedViaRequestId: requestId,
        createdById: actorId,
      },
    });
  }

  const ultimateAction = proposal.ultimateParentAction ?? "UNCHANGED";
  if (ultimateAction !== "UNCHANGED") {
    await tx.cmpClientGroup.updateMany({
      where: { ultimateParentClientId: currentClientId },
      data: { ultimateParentClientId: null },
    });
    if (ultimateAction === "SET_CURRENT" && primaryGroupId) {
      await tx.cmpClientGroup.update({
        where: { id: primaryGroupId },
        data: { ultimateParentClientId: currentClientId },
      });
    }
  }
}

function relationshipProposalMatchesCurrent(
  proposal: NonNullable<
    CmpClientGroupStructureProposal["relationships"]
  >[number],
  current: {
    groupId: string;
    type: "SUBSIDIARY" | "ASSOCIATE" | "JOINT_VENTURE";
    fromClientId: string;
    toClientId: string;
    ownershipPercentage: Prisma.Decimal | null;
    effectiveFrom: Date | null;
    remarks: string | null;
  },
  currentClientId: string
) {
  const currentIsFrom = current.fromClientId === currentClientId;
  const currentCounterpartId = currentIsFrom
    ? current.toClientId
    : current.fromClientId;
  return (
    (!normalizeOptional(proposal.groupId) ||
      normalizeOptional(proposal.groupId) === current.groupId) &&
    proposal.type === current.type &&
    proposal.direction === (currentIsFrom ? "FROM_CLIENT" : "TO_CLIENT") &&
    normalizeOptional(proposal.counterpartClientId) === currentCounterpartId &&
    (proposal.ownershipPercentage ?? null) ===
      (current.ownershipPercentage?.toNumber() ?? null) &&
    (normalizeOptional(proposal.effectiveFrom) ?? null) ===
      (current.effectiveFrom?.toISOString().slice(0, 10) ?? null) &&
    (normalizeOptional(proposal.remarks) ?? null) === current.remarks
  );
}

function normalizeLegacyClientAcceptancePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const {
    id: _id,
    group: _group,
    dateOfIncorporation,
    countryOrDistrict: _countryOrDistrict,
    companyTypeOrSpecialIndustry: _companyTypeOrSpecialIndustry,
    specialIndustryDetails: _specialIndustryDetails,
    internalSource: _internalSource,
    externalSource: _externalSource,
    sourceDescription: _sourceDescription,
    industryBusinessNatureDetails,
    industryOrBusinessNature,
    ...client
  } = payload as Record<string, unknown>;
  const isLegacyShape =
    !client.yearEndMonth &&
    !client.registeredAddress &&
    !client.hsicSectionCode;
  const legacyIndustry =
    typeof industryBusinessNatureDetails === "string"
      ? industryBusinessNatureDetails
      : typeof industryOrBusinessNature === "string"
        ? industryOrBusinessNature
        : undefined;
  const normalized: Record<string, unknown> = {
    ...client,
    ...(isLegacyShape
      ? {
          yearEndMonth: normalizeLegacyYearEndMonth(client.yearEndDate),
          registeredAddress: client.address,
          principalBusinessAddress: client.address,
          principalAddressSameAsRegistered: Boolean(client.address),
        }
      : {}),
    incorporationYearMonth:
      client.incorporationYearMonth ??
      normalizeLegacyIncorporationMonth(dateOfIncorporation),
    ...(client.hsicSectionCode === "OTHER"
      ? {
          industryOtherDescription:
            client.industryOtherDescription ?? legacyIndustry,
        }
      : !client.hsicSectionCode && legacyIndustry
        ? {
            hsicSectionCode: "OTHER",
            industryOtherDescription: legacyIndustry,
          }
        : {}),
  };
  if (
    ["ARCHIVED", "PROSPECT", "LEAD", "FILES_ARCHIVED"].includes(
      String(normalized.status ?? "")
    )
  ) {
    return { ...normalized, status: "INACTIVE" };
  }
  return normalized;
}

function parseStoredClientAcceptancePayload(payload: unknown) {
  return CmpClientAcceptanceDraftPayloadSchema.parse(
    normalizeLegacyClientAcceptancePayload(payload)
  );
}

function normalizeLegacyIncorporationMonth(value: unknown) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])/.test(value)
    ? value.slice(0, 7)
    : undefined;
}

function normalizeLegacyYearEndMonth(value: unknown) {
  if (typeof value !== "string") {
    return;
  }
  const month = Number(value.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : undefined;
}

function getMicOwnedDraftStatus(request: {
  returnReason: string | null;
  returnedAt: Date | null;
}) {
  return request.returnReason || request.returnedAt ? "RETURNED" : "DRAFT";
}

function isMicEditableAcceptanceStatus(
  status: string
): status is (typeof MIC_EDITABLE_ACCEPTANCE_STATUSES)[number] {
  return (MIC_EDITABLE_ACCEPTANCE_STATUSES as readonly string[]).includes(
    status
  );
}

function buildInitialApprovalSteps(input: {
  micApproverId: string;
  picApproverId: string;
  itApproverId: string;
}) {
  return [
    { step: "MIC" as const, approverId: input.micApproverId },
    { step: "PIC" as const, approverId: input.picApproverId },
    { step: "IT" as const, approverId: input.itApproverId },
  ];
}

function assertPendingAcceptance(request: {
  status: string;
  requestNo: string;
}) {
  if (!["PENDING_MIC", "PENDING_PIC", "PENDING_IT"].includes(request.status)) {
    throw new ApiBadRequestException(
      "BAD_REQUEST",
      "Only pending acceptance requests can be approved or returned"
    );
  }
}

function assertCurrentApprover(
  request: {
    currentStep: string;
    micApproverId: string;
    picApproverId: string | null;
    itApproverId: string | null;
  },
  userId: string
) {
  const expectedApproverId =
    request.currentStep === "MIC"
      ? request.micApproverId
      : request.currentStep === "PIC"
        ? request.picApproverId
        : request.itApproverId;
  if (expectedApproverId !== userId) {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Only the current approver can act on this request"
    );
  }
}

function assertCurrentApprovalRole(
  currentStep: string,
  role: RequestUser["globalRole"]
) {
  const isAllowed =
    currentStep === "MIC"
      ? ["MANAGER"].includes(role)
      : currentStep === "PIC"
        ? ["PARTNER", "PRINCIPAL"].includes(role)
        : currentStep === "IT" && role === "SUPER_ADMIN";
  if (!isAllowed) {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      `Your current role cannot approve the ${currentStep} step`
    );
  }
}

function isMicAcceptanceRole(role: RequestUser["globalRole"]) {
  return (MIC_ACCEPTANCE_ROLES as readonly string[]).includes(role);
}

function isCmpAcceptanceInitiator(role: RequestUser["globalRole"]) {
  return (CMP_ACCEPTANCE_INITIATOR_ROLES as readonly string[]).includes(role);
}

function resolveAcceptanceDraftControllerId(request: {
  submittedAt: Date | null;
  submittedById: string;
  micApproverId: string;
}) {
  return request.submittedAt ? request.micApproverId : request.submittedById;
}

function resolveAcceptanceReturnRecipientId(request: {
  returnedFromStep: string | null;
  submittedById: string;
  micApproverId: string;
}) {
  return request.returnedFromStep === "PIC" || request.returnedFromStep === "IT"
    ? request.micApproverId
    : request.submittedById;
}

function isMicHandoffDraft(request: {
  workflowVersion: number;
  status: string;
  submittedById: string;
  micApproverId: string;
  submittedAt: Date | null;
}) {
  return (
    request.workflowVersion >= 2 &&
    request.status === "DRAFT" &&
    request.submittedAt === null &&
    request.submittedById !== request.micApproverId
  );
}

function assertCmpGroupAdmin(user: RequestUser) {
  if (!["SUPER_ADMIN", "MANAGER", "PARTNER"].includes(user.globalRole)) {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Only Managers, Partners, and IT administrators can maintain Client Groups"
    );
  }
}

function getNextApprovalState(currentStep: string) {
  if (currentStep === "MIC") {
    return { status: "PENDING_PIC" as const, currentStep: "PIC" as const };
  }
  if (currentStep === "PIC") {
    return { status: "PENDING_IT" as const, currentStep: "IT" as const };
  }
  return { status: "APPROVED" as const, currentStep: "DONE" as const };
}

type ClientGroupWithCount = Prisma.CmpClientGroupGetPayload<{
  include: typeof GROUP_INCLUDE;
}>;

function formatClientGroup(group: ClientGroupWithCount) {
  return {
    id: group.id,
    groupCode: group.groupCode,
    nameZh: group.nameZh,
    nameEn: group.nameEn,
    status: group.status,
    clientCount: group._count.clients,
    ultimateParentClientId: group.ultimateParentClientId,
    ultimateParent: group.ultimateParent
      ? formatClientSummary(group.ultimateParent)
      : null,
    createdById: group.createdById,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

type ClientWithGroup = Prisma.CmpClientGetPayload<{
  include: typeof CLIENT_INCLUDE;
}>;

type EngagementWithClient = Prisma.CmpEngagementGetPayload<{
  include: typeof ENGAGEMENT_INCLUDE;
}>;

type AcceptanceWithRelations = Prisma.CmpAcceptanceRequestGetPayload<{
  include: typeof ACCEPTANCE_INCLUDE;
}>;

function formatClient(client: ClientWithGroup) {
  const relationships = [
    ...(client.relationshipsFrom ?? []),
    ...(client.relationshipsTo ?? []),
  ];
  const uniqueRelationships = [
    ...new Map(
      relationships.map((relationship) => [relationship.id, relationship])
    ).values(),
  ];
  return CmpClientSchema.parse({
    id: client.id,
    clientCode: client.clientCode,
    companyCode: client.companyCode,
    companyIdentifierType: client.companyIdentifierType,
    companyNumber: client.companyNumber,
    nameZh: client.nameZh ?? "",
    nameEn: client.nameEn,
    groupId: client.groupId,
    group: client.group
      ? {
          id: client.group.id,
          groupCode: client.group.groupCode,
          nameZh: client.group.nameZh,
          nameEn: client.group.nameEn,
          status: client.group.status,
        }
      : null,
    groupMode: client.groupMode,
    groupName: client.groupName,
    isUltimateParentOfGroupId: client.ultimateParentForGroup?.id ?? null,
    relationships: uniqueRelationships.map(formatClientRelationship),
    address: client.address,
    addresses: (client.addresses ?? []).map((address) => ({
      id: address.id,
      type: address.type,
      label: address.label,
      address: address.address,
      sortOrder: address.sortOrder,
    })),
    contacts: (client.contacts ?? []).map((contact) => ({
      id: contact.id,
      name: contact.name,
      position: contact.position,
      department: contact.department,
      officePhone: contact.officePhone,
      mobile: contact.mobile,
      email: contact.email,
      remarks: contact.remarks,
      sortOrder: contact.sortOrder,
    })),
    contactPerson: client.contactPerson,
    telephone: client.telephone,
    email: client.email,
    website: client.website,
    yearEndDate: client.yearEndDate?.toISOString().slice(0, 10) ?? null,
    yearEndMonth: client.yearEndMonth,
    hsicSectionCode: client.hsicSectionCode,
    industryOtherDescription: client.industryOtherDescription,
    reportingGaap: client.reportingGaap,
    contactPosition: client.contactPosition,
    contactDepartment: client.contactDepartment,
    contactMobile: client.contactMobile,
    contactRemarks: client.contactRemarks,
    principalAddressSameAsRegistered: client.principalAddressSameAsRegistered,
    placeOfIncorporation: client.placeOfIncorporation,
    incorporationYearMonth: client.incorporationYearMonth,
    listedOrPrivate: client.listedOrPrivate,
    companyTypeOtherDescription: client.companyTypeOtherDescription,
    stockExchangeOrListingPlace: client.stockExchangeOrListingPlace,
    stockCode: client.stockCode,
    marketSegment: client.marketSegment,
    regulatedEntities: client.regulatedEntities,
    regulatedBy: client.regulatedBy,
    isSubsidiary: client.isSubsidiary,
    parentClientCode: client.parentClientCode,
    parentHoldingCompanyName: client.parentHoldingCompanyName,
    hasSubsidiariesOrAssociates: client.hasSubsidiariesOrAssociates,
    subsidiariesOrAssociates: client.subsidiariesOrAssociates,
    referredBy: client.referredBy,
    clientPartnerPicId: client.clientPartnerPicId,
    clientPartnerPic: client.clientPartnerPic,
    clientLeadingPartnerId: client.clientLeadingPartnerId,
    clientLeadingPartner: client.clientLeadingPartner,
    clientManagerMicId: client.clientManagerMicId,
    clientManagerMic: client.clientManagerMic,
    alternativePartnerSecondMicId: client.alternativePartnerSecondMicId,
    alternativePartnerSecondMic: client.alternativePartnerSecondMic,
    expectedJobOrEngagementType: client.expectedJobOrEngagementType,
    serviceType: client.serviceType,
    serviceLines: client.serviceLines,
    taxServiceDetails: client.taxServiceDetails,
    comSecServiceDetails: client.comSecServiceDetails,
    otherServiceDescription: client.otherServiceDescription,
    approvalReferenceNumber: client.approvalReferenceNumber,
    approvalDate: client.approvalDate?.toISOString().slice(0, 10) ?? null,
    remarks: client.remarks,
    preparedBy: client.preparedBy,
    approvedBy: client.approvedBy,
    micApproval: client.micApproval,
    picApproval: client.picApproval,
    itAdmin: client.itAdmin,
    signOffDate: client.signOffDate?.toISOString().slice(0, 10) ?? null,
    status: client.status,
    createdById: client.createdById,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  });
}

function formatClientSummary(client: {
  id: string;
  clientCode: string;
  nameZh: string | null;
  nameEn: string | null;
  groupId: string | null;
  status: string;
}) {
  return {
    id: client.id,
    clientCode: client.clientCode,
    nameZh: client.nameZh,
    nameEn: client.nameEn,
    groupId: client.groupId,
    status: client.status,
  };
}

function formatClientRelationship(relationship: {
  id: string;
  groupId: string;
  fromClientId: string;
  toClientId: string;
  type: "SUBSIDIARY" | "ASSOCIATE" | "JOINT_VENTURE";
  ownershipPercentage: Prisma.Decimal | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  remarks: string | null;
  approvedViaRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
  fromClient: Parameters<typeof formatClientSummary>[0];
  toClient: Parameters<typeof formatClientSummary>[0];
}) {
  return {
    id: relationship.id,
    groupId: relationship.groupId,
    fromClientId: relationship.fromClientId,
    toClientId: relationship.toClientId,
    type: relationship.type,
    ownershipPercentage: relationship.ownershipPercentage?.toNumber() ?? null,
    effectiveFrom:
      relationship.effectiveFrom?.toISOString().slice(0, 10) ?? null,
    effectiveTo: relationship.effectiveTo?.toISOString().slice(0, 10) ?? null,
    remarks: relationship.remarks,
    approvedViaRequestId: relationship.approvedViaRequestId,
    fromClient: formatClientSummary(relationship.fromClient),
    toClient: formatClientSummary(relationship.toClient),
    createdAt: relationship.createdAt.toISOString(),
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

function formatClientVersion(version: {
  id: string;
  clientId: string;
  versionNumber: number;
  sourceType: string;
  acceptanceRequestId: string | null;
  snapshotJson: Prisma.JsonValue;
  changeSummaryJson: Prisma.JsonValue | null;
  changedById: string | null;
  changedByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  schemaVersion: number;
  createdAt: Date;
  acceptanceRequest?: { requestNo: string } | null;
}) {
  const summary = CmpAcceptanceChangeSummarySchema.safeParse(
    version.changeSummaryJson
  );
  const changes = summary.success
    ? summary.data.groups.flatMap((group) => group.changes)
    : [];
  return CmpClientVersionSchema.parse({
    id: version.id,
    clientId: version.clientId,
    versionNumber: version.versionNumber,
    sourceType: version.sourceType,
    acceptanceRequestId: version.acceptanceRequestId,
    acceptanceRequestNo: version.acceptanceRequest?.requestNo ?? null,
    changedBy: { id: version.changedById, name: version.changedByName },
    approvedBy: version.approvedByName
      ? { id: version.approvedById, name: version.approvedByName }
      : null,
    approvedAt: version.approvedAt?.toISOString() ?? null,
    schemaVersion: version.schemaVersion,
    changedFieldCount: changes.length,
    changedFields: [...new Set(changes.map((change) => change.field))],
    createdAt: version.createdAt.toISOString(),
  });
}

function matchesClientVersionFilter(
  version: {
    changedById: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    acceptanceRequest?: { requestNo: string } | null;
    changeSummaryJson: Prisma.JsonValue | null;
  },
  query: CmpClientVersionListQuery
) {
  if (query.changedById && version.changedById !== query.changedById) {
    return false;
  }
  const date = version.approvedAt ?? version.createdAt;
  if (query.from && date < new Date(`${query.from}T00:00:00.000Z`)) {
    return false;
  }
  if (query.to && date > new Date(`${query.to}T23:59:59.999Z`)) {
    return false;
  }
  if (
    query.requestNo &&
    !version.acceptanceRequest?.requestNo
      ?.toLowerCase()
      .includes(query.requestNo.toLowerCase())
  ) {
    return false;
  }
  if (query.field) {
    const summary = CmpAcceptanceChangeSummarySchema.safeParse(
      version.changeSummaryJson
    );
    if (
      !summary.success ||
      !summary.data.groups.some((group) =>
        group.changes.some((change) => change.field === query.field)
      )
    ) {
      return false;
    }
  }
  return true;
}

function formatPdfValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return JSON.stringify(value);
}

function compileRecordPreviewPdf(
  document: CmpRecordPreviewDocument,
  fileName: string,
  errorCode: ErrorCode
) {
  try {
    const compiler = NodeCompiler.create();
    const compiled = compiler.compile({
      mainFileContent: buildCmpRecordPreviewPdfSource(document),
    });
    if (compiled.hasError() || !compiled.result) {
      throw new Error("Typst compilation failed");
    }
    return {
      fileName,
      body: Buffer.from(compiler.pdf(compiled.result)),
    };
  } catch {
    throw new ApiBadRequestException(
      errorCode,
      "Record preview PDF export is temporarily unavailable"
    );
  }
}

function safeFileName(value: string) {
  return value.replaceAll(/[<>:"/\\|?*]+/g, "-").trim() || "client-version";
}

function typstText(value: string) {
  return `#text(${JSON.stringify(value)})`;
}

function formatStoredFeePlanningLines(
  lines: EngagementWithClient["feePlanningLines"]
) {
  return lines.flatMap((line) => {
    const budgetHours = line.hoursPerPerson
      .plus(line.otHoursPerPerson)
      .toFixed(2);
    const logicalLines: {
      id: string;
      assignmentType: "STAFF" | "TBC";
      staff: { id: string; name: string; email: string } | null;
      logicalOrder: number;
    }[] = line.staff.map((assignment, index) => ({
      id: `${line.id}::staff::${index}`,
      assignmentType: "STAFF" as const,
      staff: {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
      },
      logicalOrder: index,
    }));
    const missingAssignments = Math.max(
      0,
      line.quantity - line.staff.length - line.tbcQuantity
    );
    const tbcCount = Math.max(0, line.tbcQuantity + missingAssignments);
    for (let index = 0; index < tbcCount; index += 1) {
      logicalLines.push({
        id: `${line.id}::tbc::${index}`,
        assignmentType: "TBC",
        staff: null,
        logicalOrder: line.staff.length + index,
      });
    }
    if (logicalLines.length === 0) {
      logicalLines.push({
        id: `${line.id}::tbc::0`,
        assignmentType: "TBC",
        staff: null,
        logicalOrder: 0,
      });
    }
    return logicalLines.map((logical) => ({
      id: logical.id,
      grade: line.grade,
      assignmentType: logical.assignmentType,
      staff: logical.staff,
      hourlyRate: line.hourlyRate.toFixed(2),
      budgetHours,
      dateFrom: line.dateFrom?.toISOString().slice(0, 10) ?? null,
      dateTo: line.dateTo?.toISOString().slice(0, 10) ?? null,
      lineTotal: line.hourlyRate.mul(budgetHours).toFixed(2),
      sortOrder: line.sortOrder * 100 + logical.logicalOrder,
    }));
  });
}

function formatEngagement(engagement: EngagementWithClient) {
  return CmpEngagementSchema.parse({
    id: engagement.id,
    clientId: engagement.clientId,
    client: {
      id: engagement.client.id,
      clientCode: engagement.client.clientCode,
      nameZh: engagement.client.nameZh,
      nameEn: engagement.client.nameEn,
      status: engagement.client.status,
    },
    engagementCode: engagement.engagementCode,
    serviceType: engagement.serviceType,
    otherServiceDescription: engagement.otherServiceDescription,
    deliverables: engagement.deliverables,
    yearEndDate: engagement.yearEndDate?.toISOString().slice(0, 10) ?? null,
    reportDate: engagement.reportDate?.toISOString().slice(0, 10) ?? null,
    approvalReferenceNumber: engagement.approvalReferenceNumber,
    engagementDate:
      engagement.engagementDate?.toISOString().slice(0, 10) ?? null,
    budgetedHours: engagement.budgetedHours.toFixed(2),
    agreedFee: engagement.agreedFee.toFixed(2),
    recoveryRate: engagement.recoveryRate?.toFixed(2) ?? null,
    feePlanningLines: formatStoredFeePlanningLines(
      engagement.feePlanningLines ?? []
    ),
    feeCurrency: engagement.feeCurrency,
    feeExchangeRateHkdPerUnit:
      engagement.feeExchangeRateHkdPerUnit?.toFixed(8) ?? null,
    feeExchangeRateSource:
      engagement.feeExchangeRateSource === "MANUAL" ? "MANUAL" : "SYSTEM",
    agreedFeeHkd: engagement.feeExchangeRateHkdPerUnit
      ? engagement.agreedFee
          .mul(engagement.feeExchangeRateHkdPerUnit)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
          .toFixed(2)
      : null,
    feeExchangeRateSnapshot: engagement.feeExchangeRateSnapshot
      ? {
          id: engagement.feeExchangeRateSnapshot.id,
          currency: engagement.feeExchangeRateSnapshot.currency,
          hkdPerUnit: engagement.feeExchangeRateSnapshot.hkdPerUnit.toFixed(8),
          periodStart: engagement.feeExchangeRateSnapshot.periodStart
            .toISOString()
            .slice(0, 10),
          periodEnd: engagement.feeExchangeRateSnapshot.periodEnd
            .toISOString()
            .slice(0, 10),
          fetchedAt: engagement.feeExchangeRateSnapshot.fetchedAt.toISOString(),
          source:
            engagement.feeExchangeRateSnapshot.source === "FALLBACK"
              ? "FALLBACK"
              : engagement.feeExchangeRateSnapshot.source === "LEGACY"
                ? "LEGACY"
                : "SYSTEM",
          stale:
            Date.now() -
              engagement.feeExchangeRateSnapshot.fetchedAt.getTime() >
            48 * 60 * 60 * 1000,
        }
      : null,
    amlRiskClassification: engagement.amlRiskClassification,
    engagementRiskClassification: engagement.engagementRiskClassification,
    picUserId: engagement.picUserId,
    micUserId: engagement.micUserId,
    eqReviewerUserId: engagement.eqReviewerUserId,
    pic: engagement.pic,
    mic: engagement.mic,
    eqReviewer: engagement.eqReviewer,
    status: engagement.status,
    remarks: engagement.remarks,
    createdById: engagement.createdById,
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
    codeAliases: engagement.codeAliases.map((alias) => alias.code),
  });
}

function buildDefaultEngagementFeeNote(engagement: {
  id: string;
  engagementCode: string;
  yearEndDate: Date | null;
  feeCurrency: string;
  agreedFee: Prisma.Decimal;
  pic: string | null;
  client: {
    clientCode: string;
    nameZh: string | null;
    nameEn: string | null;
    addresses: { type: string; address: string }[];
  };
}, options: { periodNumber?: number; plannedIssueDate?: Date | null; plannedAmount?: Prisma.Decimal | null } = {}) {
  const recipientNameZh =
    engagement.client.nameZh?.trim() ||
    engagement.client.nameEn?.trim() ||
    engagement.client.clientCode;
  const recipientNameEn =
    engagement.client.nameEn?.trim() ||
    engagement.client.nameZh?.trim() ||
    engagement.client.clientCode;
  const recipientAddress =
    engagement.client.addresses.find((address) => address.type === "REGISTERED")
      ?.address ??
    engagement.client.addresses.find((address) => address.type === "PRINCIPAL")
      ?.address ??
    "";
  const currency = CMP_BUDGET_CURRENCIES.includes(
    engagement.feeCurrency as CmpBudgetCurrency
  )
    ? (engagement.feeCurrency as CmpBudgetCurrency)
    : "HKD";
  const lineItems = [
    {
      id: "service-fee",
      description: "",
      amount: options.plannedAmount?.toFixed(2) ?? engagement.agreedFee.toFixed(2),
    },
  ];
  const localizedContent = {
    "zh-CN": {
      recipientName: recipientNameZh,
      recipientAttention: "董事",
      recipientSalutation: "贵公司",
      recipientAddress,
      serviceDescription: "",
      lineItemDescriptions: { "service-fee": "" },
      signatoryName: engagement.pic ?? "",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "维致（香港）会计师事务所",
      firmAddress: "香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    },
    "en-US": {
      recipientName: recipientNameEn,
      recipientAttention: "Director",
      recipientSalutation: "Your company",
      recipientAddress,
      serviceDescription: "",
      lineItemDescriptions: { "service-fee": "" },
      signatoryName: engagement.pic ?? "",
      bankPayeeName: "",
      bankName: "",
      firmLegalName: "Wing Zenith",
      firmAddress:
        "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong",
    },
  };
  return CmpEngagementFeeNoteSchema.parse({
    id: null,
    engagementId: engagement.id,
    periodNumber: options.periodNumber ?? 1,
    plannedIssueDate: options.plannedIssueDate?.toISOString().slice(0, 10) ?? "",
    plannedAmount: options.plannedAmount?.toFixed(2) ?? engagement.agreedFee.toFixed(2),
    receivedAmount: "",
    receivedDate: "",
    collectionStatus: "UNISSUED",
    outstandingAmount: options.plannedAmount?.toFixed(2) ?? engagement.agreedFee.toFixed(2),
    feeNoteNumber: "",
    engagementReference: engagement.engagementCode,
    issueDate: new Date().toISOString().slice(0, 10),
    recipientName: recipientNameZh,
    recipientAttention: "董事",
    recipientSalutation: "贵公司",
    recipientAddress,
    currency,
    serviceDescription: localizedContent["zh-CN"].serviceDescription,
    lineItems,
    amount: engagement.agreedFee.toFixed(2),
    disbursementAmount: "0.00",
    totalAmount: engagement.agreedFee.toFixed(2),
    issuerReference: "",
    signatoryName: localizedContent["zh-CN"].signatoryName,
    bankPayeeName: "",
    bankPayeeNameZh: "",
    bankName: "",
    hkdAccountNumber: "",
    cnyAccountNumber: "",
    usdAccountNumber: "",
    swiftCode: "",
    hkdSwiftCode: "",
    cnySwiftCode: "",
    usdSwiftCode: "",
    firmLegalName: localizedContent["zh-CN"].firmLegalName,
    firmAddress: localizedContent["zh-CN"].firmAddress,
    firmPhone: "Tel: (852) 53667568",
    firmFax: "",
    firmEmail: "info@wzcpa.hk",
    firmWebsite: "www.wzcpa.hk",
    localizedContent,
    createdAt: null,
    updatedAt: null,
  });
}

function buildEngagementFeeNoteData(input: CmpEngagementFeeNoteUpdateInput) {
  const lineItems =
    input.lineItems === undefined
      ? undefined
      : normalizeFeeNoteLineItems(input.lineItems);
  const lineItemTotal = lineItems
    ? sumFeeNoteLineItems(lineItems).toFixed(2)
    : undefined;
  const { localizedContent } = input;
  const zh = localizedContent?.["zh-CN"];
  const en = localizedContent?.["en-US"];
  return {
    ...(input.periodNumber === undefined ? {} : { periodNumber: input.periodNumber }),
    ...(input.plannedIssueDate === undefined ? {} : { plannedIssueDate: normalizeOptionalDate(input.plannedIssueDate) }),
    ...(input.plannedAmount === undefined ? {} : { plannedAmount: normalizeOptional(input.plannedAmount) }),
    ...(input.receivedAmount === undefined ? {} : { receivedAmount: normalizeOptional(input.receivedAmount) }),
    ...(input.receivedDate === undefined ? {} : { receivedDate: normalizeOptionalDate(input.receivedDate) }),
    ...(input.feeNoteNumber === undefined
      ? {}
      : { feeNoteNumber: normalizeOptional(input.feeNoteNumber) }),
    ...(input.engagementReference === undefined
      ? {}
      : { engagementReference: normalizeOptional(input.engagementReference) }),
    ...(input.issueDate === undefined
      ? {}
      : { issueDate: normalizeOptionalDate(input.issueDate) }),
    ...(zh
      ? { recipientName: normalizeOptional(zh.recipientName) }
      : input.recipientName === undefined
        ? {}
        : { recipientName: normalizeOptional(input.recipientName) }),
    ...(zh
      ? { recipientAttention: normalizeOptional(zh.recipientAttention) }
      : input.recipientAttention === undefined
        ? {}
        : { recipientAttention: normalizeOptional(input.recipientAttention) }),
    ...(zh
      ? { recipientSalutation: normalizeOptional(zh.recipientSalutation) }
      : input.recipientSalutation === undefined
        ? {}
        : {
            recipientSalutation: normalizeOptional(input.recipientSalutation),
          }),
    ...(zh
      ? { recipientAddress: normalizeOptional(zh.recipientAddress) }
      : input.recipientAddress === undefined
        ? {}
        : { recipientAddress: normalizeOptional(input.recipientAddress) }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(zh
      ? { serviceDescription: normalizeOptional(zh.serviceDescription) }
      : input.serviceDescription === undefined
        ? {}
        : { serviceDescription: normalizeOptional(input.serviceDescription) }),
    ...(input.amount === undefined
      ? {}
      : { amount: normalizeOptional(input.amount) }),
    ...(input.disbursementAmount === undefined
      ? {}
      : { disbursementAmount: normalizeOptional(input.disbursementAmount) }),
    ...(input.totalAmount === undefined
      ? {}
      : { totalAmount: normalizeOptional(input.totalAmount) }),
    ...(lineItems === undefined
      ? {}
      : {
          lineItems,
          amount: lineItemTotal,
          disbursementAmount: null,
          totalAmount: lineItemTotal,
        }),
    ...(input.issuerReference === undefined
      ? {}
      : { issuerReference: normalizeOptional(input.issuerReference) }),
    ...(zh
      ? { signatoryName: normalizeOptional(zh.signatoryName) }
      : input.signatoryName === undefined
        ? {}
        : { signatoryName: normalizeOptional(input.signatoryName) }),
    ...(en
      ? { bankPayeeName: normalizeOptional(en.bankPayeeName) }
      : input.bankPayeeName === undefined
        ? {}
        : { bankPayeeName: normalizeOptional(input.bankPayeeName) }),
    ...(zh
      ? { bankPayeeNameZh: normalizeOptional(zh.bankPayeeName) }
      : input.bankPayeeNameZh === undefined
        ? {}
        : { bankPayeeNameZh: normalizeOptional(input.bankPayeeNameZh) }),
    ...(zh
      ? { bankName: normalizeOptional(zh.bankName) }
      : input.bankName === undefined
        ? {}
        : { bankName: normalizeOptional(input.bankName) }),
    ...(input.hkdAccountNumber === undefined
      ? {}
      : { hkdAccountNumber: normalizeOptional(input.hkdAccountNumber) }),
    ...(input.cnyAccountNumber === undefined
      ? {}
      : { cnyAccountNumber: normalizeOptional(input.cnyAccountNumber) }),
    ...(input.usdAccountNumber === undefined
      ? {}
      : { usdAccountNumber: normalizeOptional(input.usdAccountNumber) }),
    ...(input.swiftCode === undefined
      ? {}
      : { swiftCode: normalizeOptional(input.swiftCode) }),
    ...(input.hkdSwiftCode === undefined
      ? {}
      : { hkdSwiftCode: normalizeOptional(input.hkdSwiftCode) }),
    ...(input.cnySwiftCode === undefined
      ? {}
      : { cnySwiftCode: normalizeOptional(input.cnySwiftCode) }),
    ...(input.usdSwiftCode === undefined
      ? {}
      : { usdSwiftCode: normalizeOptional(input.usdSwiftCode) }),
    ...(zh
      ? { firmLegalName: normalizeOptional(zh.firmLegalName) }
      : input.firmLegalName === undefined
        ? {}
        : { firmLegalName: normalizeOptional(input.firmLegalName) }),
    ...(zh
      ? { firmAddress: normalizeOptional(zh.firmAddress) }
      : input.firmAddress === undefined
        ? {}
        : { firmAddress: normalizeOptional(input.firmAddress) }),
    ...(input.firmPhone === undefined
      ? {}
      : { firmPhone: normalizeOptional(input.firmPhone) }),
    ...(input.firmFax === undefined
      ? {}
      : { firmFax: normalizeOptional(input.firmFax) }),
    ...(input.firmEmail === undefined
      ? {}
      : { firmEmail: normalizeOptional(input.firmEmail) }),
    ...(input.firmWebsite === undefined
      ? {}
      : { firmWebsite: normalizeOptional(input.firmWebsite) }),
    ...(localizedContent === undefined
      ? {}
      : { localizedContent: localizedContent as Prisma.InputJsonValue }),
  };
}

export function mergeLegacyFeeNoteLocalizedContent(
  input: CmpEngagementFeeNoteUpdateInput,
  current: CmpEngagementFeeNote
): CmpEngagementFeeNoteUpdateInput {
  if (input.localizedContent !== undefined) {
    return input;
  }
  const hasLegacyLocalizedChange =
    input.recipientName !== undefined ||
    input.recipientAttention !== undefined ||
    input.recipientSalutation !== undefined ||
    input.recipientAddress !== undefined ||
    input.serviceDescription !== undefined ||
    input.lineItems !== undefined ||
    input.signatoryName !== undefined ||
    input.bankPayeeName !== undefined ||
    input.bankPayeeNameZh !== undefined ||
    input.bankName !== undefined ||
    input.firmLegalName !== undefined ||
    input.firmAddress !== undefined;
  if (!hasLegacyLocalizedChange) {
    return input;
  }

  const localizedContent = {
    "zh-CN": {
      ...current.localizedContent["zh-CN"],
      ...(input.recipientName === undefined
        ? {}
        : { recipientName: input.recipientName }),
      ...(input.recipientAttention === undefined
        ? {}
        : { recipientAttention: input.recipientAttention }),
      ...(input.recipientSalutation === undefined
        ? {}
        : { recipientSalutation: input.recipientSalutation }),
      ...(input.recipientAddress === undefined
        ? {}
        : { recipientAddress: input.recipientAddress }),
      ...(input.serviceDescription === undefined
        ? {}
        : { serviceDescription: input.serviceDescription }),
      ...(input.signatoryName === undefined
        ? {}
        : { signatoryName: input.signatoryName }),
      ...(input.bankPayeeNameZh === undefined
        ? {}
        : { bankPayeeName: input.bankPayeeNameZh }),
      ...(input.bankName === undefined ? {} : { bankName: input.bankName }),
      ...(input.firmLegalName === undefined
        ? {}
        : { firmLegalName: input.firmLegalName }),
      ...(input.firmAddress === undefined
        ? {}
        : { firmAddress: input.firmAddress }),
    },
    "en-US": {
      ...current.localizedContent["en-US"],
      ...(input.recipientName === undefined
        ? {}
        : { recipientName: input.recipientName }),
      ...(input.recipientAttention === undefined
        ? {}
        : { recipientAttention: input.recipientAttention }),
      ...(input.recipientSalutation === undefined
        ? {}
        : { recipientSalutation: input.recipientSalutation }),
      ...(input.recipientAddress === undefined
        ? {}
        : { recipientAddress: input.recipientAddress }),
      ...(input.serviceDescription === undefined
        ? {}
        : { serviceDescription: input.serviceDescription }),
      ...(input.signatoryName === undefined
        ? {}
        : { signatoryName: input.signatoryName }),
      ...(input.bankPayeeName === undefined
        ? {}
        : { bankPayeeName: input.bankPayeeName }),
      ...(input.bankName === undefined ? {} : { bankName: input.bankName }),
      ...(input.firmLegalName === undefined
        ? {}
        : { firmLegalName: input.firmLegalName }),
      ...(input.firmAddress === undefined
        ? {}
        : { firmAddress: input.firmAddress }),
    },
  };
  if (input.lineItems !== undefined) {
    const descriptions = Object.fromEntries(
      input.lineItems.map((item) => [item.id, item.description ?? ""])
    );
    localizedContent["zh-CN"].lineItemDescriptions = descriptions;
    localizedContent["en-US"].lineItemDescriptions = descriptions;
  }
  return { ...input, localizedContent };
}

function formatEngagementFeeNote(note: {
  id: string;
  engagementId: string;
  periodNumber: number;
  plannedIssueDate: Date | null;
  plannedAmount: Prisma.Decimal | null;
  receivedAmount: Prisma.Decimal | null;
  receivedDate: Date | null;
  feeNoteNumber: string | null;
  engagementReference: string | null;
  issueDate: Date | null;
  recipientName: string | null;
  recipientAttention: string | null;
  recipientSalutation: string | null;
  recipientAddress: string | null;
  currency: string;
  serviceDescription: string | null;
  lineItems: Prisma.JsonValue;
  amount: Prisma.Decimal | null;
  disbursementAmount: Prisma.Decimal | null;
  totalAmount: Prisma.Decimal | null;
  issuerReference: string | null;
  signatoryName: string | null;
  bankPayeeName: string | null;
  bankPayeeNameZh: string | null;
  bankName: string | null;
  hkdAccountNumber: string | null;
  cnyAccountNumber: string | null;
  usdAccountNumber: string | null;
  swiftCode: string | null;
  hkdSwiftCode: string | null;
  cnySwiftCode: string | null;
  usdSwiftCode: string | null;
  firmLegalName: string | null;
  firmAddress: string | null;
  firmPhone: string | null;
  firmFax: string | null;
  firmEmail: string | null;
  firmWebsite: string | null;
  localizedContent: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  const lineItems = readFeeNoteLineItems(note.lineItems, note);
  const localizedContent = readFeeNoteLocalizedContent(
    note.localizedContent,
    note,
    lineItems
  );
  return CmpEngagementFeeNoteSchema.parse({
    id: note.id,
    engagementId: note.engagementId,
    periodNumber: note.periodNumber,
    plannedIssueDate: note.plannedIssueDate?.toISOString().slice(0, 10) ?? "",
    plannedAmount: note.plannedAmount?.toFixed(2) ?? "",
    receivedAmount: note.receivedAmount?.toFixed(2) ?? "",
    receivedDate: note.receivedDate?.toISOString().slice(0, 10) ?? "",
    ...deriveFeeNoteCollection(note),
    feeNoteNumber: note.feeNoteNumber ?? "",
    engagementReference: note.engagementReference ?? "",
    issueDate: note.issueDate?.toISOString().slice(0, 10) ?? "",
    recipientName: note.recipientName ?? "",
    recipientAttention: note.recipientAttention ?? "",
    recipientSalutation: note.recipientSalutation ?? "",
    recipientAddress: note.recipientAddress ?? "",
    currency: note.currency,
    serviceDescription: note.serviceDescription ?? "",
    lineItems,
    amount: note.amount?.toFixed(2) ?? "",
    disbursementAmount: note.disbursementAmount?.toFixed(2) ?? "",
    totalAmount: note.totalAmount?.toFixed(2) ?? "",
    issuerReference: note.issuerReference ?? "",
    signatoryName: note.signatoryName ?? "",
    bankPayeeName: note.bankPayeeName ?? "",
    bankPayeeNameZh: note.bankPayeeNameZh ?? "",
    bankName: note.bankName ?? "",
    hkdAccountNumber: note.hkdAccountNumber ?? "",
    cnyAccountNumber: note.cnyAccountNumber ?? "",
    usdAccountNumber: note.usdAccountNumber ?? "",
    swiftCode: note.swiftCode ?? "",
    hkdSwiftCode: note.hkdSwiftCode ?? note.swiftCode ?? "",
    cnySwiftCode: note.cnySwiftCode ?? note.swiftCode ?? "",
    usdSwiftCode: note.usdSwiftCode ?? note.swiftCode ?? "",
    firmLegalName: note.firmLegalName ?? "",
    firmAddress: note.firmAddress ?? "",
    firmPhone: note.firmPhone ?? "",
    firmFax: note.firmFax ?? "",
    firmEmail: note.firmEmail ?? "",
    firmWebsite: note.firmWebsite ?? "",
    localizedContent,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });
}

function deriveFeeNoteCollection(note: { issueDate: Date | null; totalAmount: Prisma.Decimal | null; amount: Prisma.Decimal | null; plannedAmount: Prisma.Decimal | null; receivedAmount: Prisma.Decimal | null }) {
  const billed = note.totalAmount ?? note.amount ?? note.plannedAmount ?? new Prisma.Decimal(0);
  if (!note.issueDate) return { collectionStatus: "UNISSUED" as const, outstandingAmount: billed.toFixed(2) };
  if (!note.receivedAmount) return { collectionStatus: "UNRECORDED" as const, outstandingAmount: billed.toFixed(2) };
  const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), billed.minus(note.receivedAmount));
  if (outstanding.isZero()) return { collectionStatus: "RECEIVED" as const, outstandingAmount: "0.00" };
  return { collectionStatus: note.receivedAmount.gt(0) ? "PARTIALLY_RECEIVED" as const : "OUTSTANDING" as const, outstandingAmount: outstanding.toFixed(2) };
}

function normalizeFeeNoteLineItems(
  items: { id: string; description?: string; amount: string }[]
) {
  return items.map((item) => ({
    id: item.id.trim(),
    description: item.description?.trim() ?? "",
    amount: item.amount.trim(),
  }));
}

function readFeeNoteLocalizedContent(
  value: Prisma.JsonValue,
  legacy: {
    recipientName: string | null;
    recipientAttention: string | null;
    recipientSalutation: string | null;
    recipientAddress: string | null;
    serviceDescription: string | null;
    signatoryName: string | null;
    bankPayeeName: string | null;
    bankPayeeNameZh: string | null;
    bankName: string | null;
    firmLegalName: string | null;
    firmAddress: string | null;
  },
  lineItems: CmpEngagementFeeNote["lineItems"]
) {
  const descriptions = Object.fromEntries(
    lineItems.map((item) => [item.id, item.description])
  );
  const common = {
    recipientName: legacy.recipientName ?? "",
    recipientAttention: legacy.recipientAttention ?? "",
    recipientSalutation: legacy.recipientSalutation ?? "",
    recipientAddress: legacy.recipientAddress ?? "",
    serviceDescription: legacy.serviceDescription ?? "",
    lineItemDescriptions: descriptions,
    signatoryName: legacy.signatoryName ?? "",
    bankName: legacy.bankName ?? "",
    firmLegalName: legacy.firmLegalName ?? "",
    firmAddress: legacy.firmAddress ?? "",
  };
  const fallback = {
    "zh-CN": {
      ...common,
      bankPayeeName: legacy.bankPayeeNameZh ?? legacy.bankPayeeName ?? "",
    },
    "en-US": {
      ...common,
      bankPayeeName: legacy.bankPayeeName ?? legacy.bankPayeeNameZh ?? "",
    },
  };
  const parsed = CmpFeeNoteLocalizedContentsSchema.safeParse(value);
  if (!parsed.success) {
    return fallback;
  }
  return {
    "zh-CN": {
      ...fallback["zh-CN"],
      ...parsed.data["zh-CN"],
      lineItemDescriptions: {
        ...fallback["zh-CN"].lineItemDescriptions,
        ...parsed.data["zh-CN"].lineItemDescriptions,
      },
    },
    "en-US": {
      ...fallback["en-US"],
      ...parsed.data["en-US"],
      lineItemDescriptions: {
        ...fallback["en-US"].lineItemDescriptions,
        ...parsed.data["en-US"].lineItemDescriptions,
      },
    },
  };
}

function readFeeNoteLineItems(
  value: Prisma.JsonValue,
  legacy: {
    amount: Prisma.Decimal | null;
    disbursementAmount: Prisma.Decimal | null;
  }
) {
  const parsed = CmpEngagementFeeNoteLineItemsSchema.safeParse(value);
  if (parsed.success && parsed.data.length > 0) {
    return parsed.data;
  }

  const legacyLines = [
    legacy.amount
      ? {
          id: "service-fee",
          description: "",
          amount: legacy.amount.toFixed(2),
        }
      : null,
    legacy.disbursementAmount
      ? {
          id: "disbursements",
          description: "Disbursements",
          amount: legacy.disbursementAmount.toFixed(2),
        }
      : null,
  ].filter(
    (item): item is { id: string; description: string; amount: string } =>
      item !== null
  );

  return legacyLines.length > 0
    ? legacyLines
    : [{ id: "fee-item-1", description: "", amount: "" }];
}

function sumFeeNoteLineItems(items: { amount: string }[]): Prisma.Decimal {
  return items.reduce(
    (total, item) => total.plus(item.amount.trim() || "0"),
    new Prisma.Decimal(0)
  );
}

function clientChangePayloadFromMaster(client: ClientWithGroup) {
  const formatted = formatClient(client);
  const registeredAddress =
    formatted.addresses?.find((address) => address.type === "REGISTERED")
      ?.address ?? formatted.address;
  const principalBusinessAddress =
    formatted.addresses?.find((address) => address.type === "PRINCIPAL")
      ?.address ?? formatted.address;
  return {
    ...formatted,
    registeredAddress,
    principalBusinessAddress,
    additionalAddresses: (formatted.addresses ?? [])
      .filter((address) => address.type === "OTHER")
      .map((address) => ({
        id: address.id,
        label: address.label ?? "",
        address: address.address,
        sortOrder: address.sortOrder,
      })),
    groupName:
      formatted.groupName ??
      formatted.group?.nameEn ??
      formatted.group?.nameZh ??
      null,
    groupStructure: clientGroupStructurePayloadFromMaster(client),
  };
}

function clientGroupStructurePayloadFromMaster(
  client: ClientWithGroup
): CmpClientGroupStructureProposal {
  const relationships = [
    ...(client.relationshipsFrom ?? []),
    ...(client.relationshipsTo ?? []),
  ];
  const uniqueRelationships = [
    ...new Map(
      relationships.map((relationship) => [relationship.id, relationship])
    ).values(),
  ];
  return {
    primaryGroupId: client.groupId,
    ultimateParentAction: "UNCHANGED",
    relationships: uniqueRelationships.map((relationship) => {
      const currentIsFrom = relationship.fromClientId === client.id;
      return {
        action: "UPSERT" as const,
        relationshipId: relationship.id,
        groupId: relationship.groupId,
        type: relationship.type,
        direction: currentIsFrom
          ? ("FROM_CLIENT" as const)
          : ("TO_CLIENT" as const),
        counterpartClientId: currentIsFrom
          ? relationship.toClientId
          : relationship.fromClientId,
        ownershipPercentage:
          relationship.ownershipPercentage?.toNumber() ?? undefined,
        effectiveFrom:
          relationship.effectiveFrom?.toISOString().slice(0, 10) ?? undefined,
        remarks: relationship.remarks ?? undefined,
      };
    }),
  };
}

type TmsTimesheetProject = {
  id: string;
  members: { joinedAt: Date }[];
};

function resolveTmsTimesheetAccess(
  projects: TmsTimesheetProject[],
  declarationsByProjectId: ReadonlyMap<string, Date[]>
): { allowed: boolean; reason: TmsEngagementTimesheetAccessReason } {
  if (projects.length === 0) {
    return {
      allowed: false,
      reason: "EMP_PROJECT_REQUIRED" as const,
    };
  }

  const hasEligibleProject = projects.some((project) => {
    const joinedAt = project.members[0]?.joinedAt;
    if (!joinedAt) {
      return false;
    }

    return (declarationsByProjectId.get(project.id) ?? []).some(
      (acceptedAt) => acceptedAt >= joinedAt
    );
  });
  if (hasEligibleProject) {
    return { allowed: true, reason: "ALLOWED" as const };
  }

  return {
    allowed: false,
    reason: projects.some((project) => project.members.length > 0)
      ? ("INDEPENDENCE_DECLARATION_REQUIRED" as const)
      : ("EMP_MEMBERSHIP_REQUIRED" as const),
  };
}

function normalizeEngagementCode(value: string) {
  return value.trim().toLocaleUpperCase("en-US");
}

function copyInboxStructuredContent(
  content: InboxStructuredContent
): InboxStructuredContent {
  return {
    contentKey: content.contentKey,
    contentParams: content.contentParams,
  } as InboxStructuredContent;
}

async function ensureEngagementCodeAvailable(
  prisma: Prisma.TransactionClient | PrismaService,
  code: string,
  excludingEngagementId?: string
) {
  const normalizedCode = normalizeEngagementCode(code);
  const [current, alias] = await Promise.all([
    prisma.cmpEngagement.findFirst({
      where: {
        engagementCode: { equals: code.trim(), mode: "insensitive" },
        ...(excludingEngagementId
          ? { NOT: { id: excludingEngagementId } }
          : {}),
      },
      select: { id: true },
    }),
    prisma.cmpEngagementCodeAlias.findUnique({
      where: { normalizedCode },
      select: { engagementId: true },
    }),
  ]);
  if (current || (alias && alias.engagementId !== excludingEngagementId)) {
    throw new ApiBadRequestException(
      "DUPLICATE_CODE",
      "Engagement code already exists or is reserved by a previous code"
    );
  }
}

function readTmsRows(value: Prisma.JsonValue | null) {
  return Array.isArray(value) ? (value as TmsTimesheetRow[]) : [];
}

function formatAcceptanceRequest(request: AcceptanceWithRelations) {
  const clientPayload = request.clientPayload
    ? parseStoredClientAcceptancePayload(request.clientPayload)
    : null;
  const proposedPayload =
    request.type === "CLIENT_CHANGE"
      ? clientPayload
      : request.type === "ENGAGEMENT_CHANGE"
        ? request.engagementPayload
        : null;
  const changedFieldCount =
    isChangeAcceptanceType(request.type) && request.changeBaselinePayload
      ? buildAcceptanceChangeSummary({
          type: request.type,
          baseline: request.changeBaselinePayload,
          proposed: proposedPayload,
          baselineCapturedAt: request.changeBaselineCapturedAt,
          staleMasterData: false,
        }).changedFieldCount
      : null;
  const amlBatch = request.amlScreeningBatches?.[0];
  const amlAttentionCount = amlBatch ? deriveAmlAttentionCount(amlBatch) : 0;
  const amlSummary = amlBatch
    ? {
        status:
          amlBatch.status === "RUNNING" || amlAttentionCount > 0
            ? ("ATTENTION" as const)
            : amlBatch.errorCount > 0
              ? ("ERROR" as const)
              : ("CLEAR" as const),
        subjectCount: amlBatch.subjectCount,
        attentionCount: amlAttentionCount,
        errorCount: amlBatch.errorCount,
        lastScreenedAt: (
          amlBatch.completedAt ?? amlBatch.createdAt
        ).toISOString(),
      }
    : {
        status: "NOT_RUN" as const,
        subjectCount: 0,
        attentionCount: 0,
        errorCount: 0,
        lastScreenedAt: null,
      };

  return CmpAcceptanceRequestSchema.parse({
    id: request.id,
    requestNo: request.requestNo,
    draftName: request.draftName ?? null,
    type: request.type,
    status: request.status,
    currentStep: request.currentStep,
    submittedById: request.submittedById,
    submittedBy: request.submittedBy,
    micApproverId: request.micApproverId,
    micApprover: request.micApprover,
    picApproverId: request.picApproverId,
    picApprover: request.picApprover,
    itApproverId: request.itApproverId,
    itApprover: request.itApprover,
    workflowVersion: request.workflowVersion ?? 1,
    draftAssigneeId: request.draftAssigneeId ?? null,
    draftAssignee: request.draftAssignee ?? null,
    draftCompletedAt: request.draftCompletedAt?.toISOString() ?? null,
    draftCompletedById: request.draftCompletedById ?? null,
    draftCompletedBy: request.draftCompletedBy ?? null,
    returnedFromStep: request.returnedFromStep ?? null,
    picApprovedAt: request.picApprovedAt?.toISOString() ?? null,
    targetClientId: request.targetClientId,
    targetEngagementId: request.targetEngagementId,
    clientPayload,
    engagementPayload: request.engagementPayload ?? null,
    returnReason: request.returnReason,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    returnedAt: request.returnedAt?.toISOString() ?? null,
    changedFieldCount,
    amlSummary,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    approvalSteps: request.approvalSteps.map((step) => ({
      id: step.id,
      step: step.step,
      approverId: step.approverId,
      approver: step.approver,
      status: step.status,
      comment: step.comment,
      actedAt: step.actedAt?.toISOString() ?? null,
      createdAt: step.createdAt.toISOString(),
    })),
  });
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
