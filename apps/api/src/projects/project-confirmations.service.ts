import { createHash, randomUUID } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ConfirmationDifferenceStatus,
  ConfirmationDispatchMethod,
  ConfirmationStatus,
  ConfirmationType,
} from "@prisma/client";
import type {
  ConfirmationDraftTemplateCode,
  ConfirmationTemplateTextStyle,
  CorrectProjectConfirmationTrackingInput,
  CreateProjectConfirmationDispatchInput,
  CreateProjectConfirmationFollowUpEventInput,
  CreateProjectConfirmationInput,
  PrepareProjectConfirmationDispatchInput,
  ReviewProjectConfirmationResponseInput,
  UpdateProjectConfirmationDraftInput,
  UpdateProjectConfirmationInput,
} from "@project-wing/shared";
import {
  CONFIRMATION_TEMPLATE_FONT_FAMILIES,
  CONFIRMATION_TEMPLATE_FONT_SIZES,
  isConfirmationCustomTemplateCode,
} from "@project-wing/shared";
import { getConfirmationLogisticsDeliveryVersion } from "@project-wing/shared/confirmation-logistics";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiConflictException,
  ApiNotFoundException,
} from "../common/api-error";
import { normalizeUploadedFileName } from "../common/file-name";
import { renderSystemEmail } from "../mail/system-email-template";
import { UserMailConnectionService } from "../mail/user-mail-connection.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { Tracking17TrackService } from "../system-connections/tracking-17track.service";
import type { Tracking17TrackSnapshot } from "../system-connections/tracking-17track.service";
import { ConfirmationDerivedDataService } from "./confirmation-derived-data.service";
import { ConfirmationDocumentService } from "./confirmation-document.service";
import { ConfirmationEmpImportWithdrawalService } from "./confirmation-emp-import-withdrawal.service";
import { ConfirmationGeneralFieldsService } from "./confirmation-general-fields.service";
import {
  ConfirmationImportLinkGuardService,
  type ConfirmationImportLinkPrismaLike,
  type ConfirmationSourceInvalidatingAction,
} from "./confirmation-import-link-guard.service";
import { getDefaultConfirmationTemplateDesign } from "./confirmation-template-design-defaults";
import {
  CONFIRMATION_BASE_INFORMATION_BINDINGS,
  CONFIRMATION_INFORMATION_LIBRARY_BINDINGS,
} from "./confirmation-template-library.service";
import type {
  ConfirmationTemplateDesignFieldBinding,
  ConfirmationTemplateDesignFieldSourceRange,
} from "./confirmation-template-library.service";
import {
  getConfirmationTemplateDefinition,
  isConfirmationTemplateAvailableForNewDrafts,
} from "./confirmation-template-registry";
import type { ConfirmationTemplateDefinition } from "./confirmation-template-registry";
import type {
  UploadedConfirmationFile,
  UploadedConfirmationSourceSnapshot,
} from "./confirmation-upload.service";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";

type CreateProjectConfirmationFollowUpEventServiceInput =
  | CreateProjectConfirmationFollowUpEventInput
  | {
      eventType: "REDISPATCH_REQUESTED";
      notes?: string;
    };

type ConfirmationPhaseSnapshot = {
  status: ConfirmationStatus;
  differenceStatus: ConfirmationDifferenceStatus | null;
  notes: string | null;
};

type ConfirmationReviewTransitionPayload = {
  responseId?: string;
  result?: string;
  action?: string;
  resolution?: string;
  transition?: string;
  targetEventId?: string;
  previous?: ConfirmationPhaseSnapshot;
  next?: ConfirmationPhaseSnapshot;
};

const UNDOABLE_CONFIRMATION_EVENT_TYPES = new Set([
  "PROGRAM_COMPLETED",
  "REDISPATCH_REQUESTED",
  "REVIEW_RECORDED",
]);
const DISPATCH_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const MAX_DISPATCH_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const LOGISTICS_VISIBLE_PROJECT_STATUSES = [
  "ACTIVE",
  "PENDING_FINAL_CHECK",
  "ARCHIVED",
] as const;
const PROJECT_CONFIRMATION_ARTIFACT_PUBLIC_SELECT = {
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
const PROJECT_CONFIRMATION_RESPONSE_ARTIFACT_PUBLIC_SELECT = {
  id: true,
  responseId: true,
  sequence: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  sha256: true,
  uploadedBy: true,
  capturedAt: true,
  createdAt: true,
} satisfies Prisma.ConfirmationResponseArtifactSelect;
const PROJECT_CONFIRMATION_INCLUDE_BASE = {
  project: {
    select: {
      id: true,
      name: true,
      projectCode: true,
      reportDate: true,
      status: true,
    },
  },
  responsibleUser: {
    select: { id: true, name: true, email: true, globalRole: true },
  },
  creator: {
    select: { id: true, name: true, email: true, globalRole: true },
  },
  currentArtifact: {
    select: PROJECT_CONFIRMATION_ARTIFACT_PUBLIC_SELECT,
  },
  dispatches: {
    orderBy: { sequence: "asc" },
    include: { events: { orderBy: { occurredAt: "asc" } } },
  },
  empImportItems: {
    where: { status: "SUCCEEDED", withdrawnAt: null },
    select: {
      responseArtifactId: true,
      attachmentId: true,
      attachment: { select: { deletedAt: true } },
    },
  },
  followUpEvents: { orderBy: { occurredAt: "asc" } },
  responses: {
    orderBy: { createdAt: "desc" },
    include: {
      artifacts: {
        orderBy: { sequence: "asc" },
        select: PROJECT_CONFIRMATION_RESPONSE_ARTIFACT_PUBLIC_SELECT,
      },
    },
  },
} satisfies Prisma.ProjectConfirmationInclude;

export const PROJECT_CONFIRMATION_INCLUDE = PROJECT_CONFIRMATION_INCLUDE_BASE;

export const PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA = {
  ...PROJECT_CONFIRMATION_INCLUDE_BASE,
  currentArtifact: {
    select: {
      ...PROJECT_CONFIRMATION_ARTIFACT_PUBLIC_SELECT,
      docxObjectKey: true,
      structuredSnapshot: true,
    },
  },
} satisfies Prisma.ProjectConfirmationInclude;

const PROJECT_CONFIRMATION_LOGISTICS_SELECT = {
  id: true,
  projectId: true,
  type: true,
  dispatches: {
    where: {
      method: { in: ["COURIER", "POST"] },
    },
    select: {
      id: true,
      method: true,
      executionStatus: true,
      trackingStatus: true,
      trackingNumber: true,
      deliveredAt: true,
      trackingLastEventAt: true,
      trackingEvents: true,
    },
  },
  followUpEvents: {
    where: { eventType: "COUNTERPARTY_SENT_RESPONSE" },
    select: { id: true, eventType: true, payload: true },
  },
} satisfies Prisma.ProjectConfirmationSelect;

const PROJECT_CONFIRMATION_SENSITIVE_KEYS = new Set([
  "objectKey",
  "attachmentObjectKey",
  "docxObjectKey",
  "pdfObjectKey",
  "structuredSnapshot",
]);

export function sanitizeConfirmationResponse<T>(value: T): T {
  return sanitizeConfirmationResponseValue(value) as T;
}

function sanitizeConfirmationResponseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeConfirmationResponseValue);
  }
  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return value;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (PROJECT_CONFIRMATION_SENSITIVE_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = sanitizeConfirmationResponseValue(nested);
  }
  return sanitized;
}

const MAX_CONFIRMATION_CREATE_ATTEMPTS = 3;
const MAX_STALE_CONFIRMATION_SEQUENCE_SKIPS = 1000;
const MANAGED_CONFIRMATION_TEMPLATE_CODES = [
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
] as const satisfies readonly ConfirmationDraftTemplateCode[];
const LEGACY_CONFIRMATION_TEMPLATE_CODES = [
  "PRC_BANK_TEMPLATE_1",
  "PRC_BANK_TEMPLATE_2",
  "SHINEWING_ENG_BANK",
] as const satisfies readonly ConfirmationDraftTemplateCode[];

export type UpdateProjectConfirmationDefaultsInput = {
  clientName?: string | null;
  confirmationDate?: string | null;
  reference?: string | null;
  pic?: string | null;
  mic?: string | null;
  reportDate?: string | null;
  baseInformation?: ProjectConfirmationBaseInformation | null;
};

export type ProjectConfirmationBaseInformation = {
  customFields?: { id: string; name: string; value: string }[];

  clientNames: string[];
  references: string[];
  banks: {
    name: string;
    account: string;
    address: string;
  }[];
};

type ProjectConfirmationDefaultsRecord = {
  id: string;
  projectId: string;
  clientName: string | null;
  confirmationDate: string | null;
  reference: string | null;
  pic: string | null;
  mic: string | null;
  reportDate: string | null;
  baseInformation: ProjectConfirmationBaseInformation | null;
  createdAt?: Date;
  updatedAt: Date | null;
};

type ConfirmationTemplateDesignFieldSnapshot = {
  binding?: ConfirmationTemplateDesignFieldBinding;
  baseInformationBinding?: ConfirmationTemplateDesignFieldBinding;
  defaultChecked?: boolean;
  defaultValueSource?:
    | {
        binding: ConfirmationTemplateDesignFieldBinding;
        source: "BASE_INFORMATION" | "INFORMATION_LIBRARY";
      }
    | { source: "CUSTOM"; value: string }
    | { source: "SYSTEM"; value: "CURRENT_DATE" };
  id: string;
  informationLibraryBinding?: ConfirmationTemplateDesignFieldBinding;
  kind:
    | "TEXT"
    | "MULTILINE"
    | "NUMBER"
    | "DATE"
    | "CHECKBOX"
    | "SELECT"
    | "RADIO"
    | "STATIC_TEXT"
    | "MASK";
  name?: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  textStyle?: ConfirmationTemplateTextStyle;
  textAlign?: "left" | "center" | "right";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceRanges?: ConfirmationTemplateDesignFieldSourceRange[];
};

type ConfirmationTemplateDesignSnapshot = {
  version: 1;
  fields: ConfirmationTemplateDesignFieldSnapshot[];
};

type ConfirmationTemplateDesignRecord = {
  designStatus: string;
  designSchema: unknown;
  deletedAt?: Date | null;
};

type CustomConfirmationTemplateRecord = {
  code: string;
  name: string;
  confirmationType: ConfirmationType;
  designStatus: string;
  designSchema: unknown;
  fileName: string;
  objectKey: string;
  mimeType: string;
};

type CustomConfirmationTemplateSnapshot = Pick<
  CustomConfirmationTemplateRecord,
  | "code"
  | "designStatus"
  | "designSchema"
  | "fileName"
  | "objectKey"
  | "mimeType"
>;

type CustomConfirmationTemplateClient = {
  findMany: (args: unknown) => Promise<CustomConfirmationTemplateSnapshot[]>;
  findUnique: (
    args: unknown
  ) => Promise<CustomConfirmationTemplateRecord | null>;
};

type CustomConfirmationTemplateSource = {
  code: string;
  fileName: string;
  objectKey: string;
  mimeType: string;
};

type EnabledConfirmationTemplateSelection = {
  definition: ConfirmationTemplateDefinition;
  designSchema: ConfirmationTemplateDesignSnapshot | null;
  source: CustomConfirmationTemplateSource | null;
};

const TEMPLATE_FIELD_BINDINGS = new Set<ConfirmationTemplateDesignFieldBinding>(
  [
    "accountNumber",
    "auditorAddress",
    "auditorName",
    "authorizationAccount",
    "bankName",
    "clientName",
    "micEmail",
    "micNameAndInitial",
    "officeDate",
    "recipientAddress",
    "recipientName",
    "referenceCode",
    "picName",
    "micName",
    "reportDate",
    "salutation",
    "yearEndDate",
  ]
);
const BASE_INFORMATION_FIELD_BINDINGS =
  new Set<ConfirmationTemplateDesignFieldBinding>(
    CONFIRMATION_BASE_INFORMATION_BINDINGS
  );
const INFORMATION_LIBRARY_FIELD_BINDINGS =
  new Set<ConfirmationTemplateDesignFieldBinding>(
    CONFIRMATION_INFORMATION_LIBRARY_BINDINGS
  );

type ManagedTemplateSnapshot = {
  customByCode: ReadonlyMap<string, CustomConfirmationTemplateSnapshot>;
  overrideByCode: ReadonlyMap<string, ConfirmationTemplateDesignRecord>;
  availableCodes: readonly ConfirmationDraftTemplateCode[];
};

type ConfirmationTemplateBuiltInOverrideClient = {
  findUnique: (
    args: unknown
  ) => Promise<ConfirmationTemplateDesignRecord | null>;
  findMany: (args: unknown) => Promise<
    {
      templateCode: string;
      designStatus: string;
      designSchema?: unknown;
      deletedAt?: Date | null;
    }[]
  >;
};

function confirmationTemplateBuiltInOverrideClient(
  client: unknown
): ConfirmationTemplateBuiltInOverrideClient {
  return (
    client as {
      confirmationTemplateLibraryBuiltInOverride: ConfirmationTemplateBuiltInOverrideClient;
    }
  ).confirmationTemplateLibraryBuiltInOverride;
}

type RedispatchReservationData = {
  confirmationId: string;
  method: ConfirmationDispatchMethod;
  artifactId: string;
  executionStatus: "QUEUED" | "STARTED";
  idempotencyKey: string;
  startedAt: Date;
  senderName?: string | null;
  applicantName?: string | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingProvider?: string | null;
  trackingCarrierCode?: number | null;
  dispatchReference?: string | null;
  recipientName?: string | null;
  recipientContact?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  emailSubject?: string | null;
  emailBodyText?: string | null;
  followUpDate?: Date | null;
  attachmentName?: string | null;
  notes?: string | null;
  createdBy: string;
};

@Injectable()
export class ProjectConfirmationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly auditLogs: AuditLogsService,
    private readonly confirmationDocuments: ConfirmationDocumentService,
    private readonly confirmationCodes: ProjectConfirmationCodeService,
    private readonly confirmationDerivedData: ConfirmationDerivedDataService,
    private readonly storage: StorageService,
    private readonly userMail: UserMailConnectionService,
    private readonly shipmentTracking: Tracking17TrackService,
    private readonly importLinkGuard: ConfirmationImportLinkGuardService,
    private readonly generalFields: ConfirmationGeneralFieldsService,
    @Optional()
    private readonly empImportWithdrawal?: ConfirmationEmpImportWithdrawalService
  ) {}

  async listForProject(projectId: string, user: RequestUser) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const confirmations = await this.prisma.projectConfirmation.findMany({
      where: { projectId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
    });
    const defaults = await this.findProjectConfirmationDefaults(projectId);
    const repairedConfirmations = await Promise.all(
      confirmations.map((confirmation) =>
        this.repairPreparedSentConfirmation(projectId, confirmation)
      )
    );
    const managedTemplateSnapshot = repairedConfirmations.some(
      (confirmation) => confirmation.status === "DRAFT"
    )
      ? await this.findManagedTemplateSnapshot()
      : null;
    const decoratedConfirmations = managedTemplateSnapshot
      ? repairedConfirmations.map((confirmation) =>
          this.attachLatestEnabledTemplateDesign(
            confirmation,
            managedTemplateSnapshot
          )
        )
      : repairedConfirmations;
    return decoratedConfirmations.map((confirmation) =>
      mergeProjectConfirmationDefaults(
        normalizeConfirmationResponseFileNames(confirmation),
        defaults
      )
    );
  }

  async getProjectConfirmationDefaults(projectId: string, user: RequestUser) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const defaults = await this.findProjectConfirmationDefaults(projectId);
    return (
      defaults ?? {
        projectId,
        clientName: null,
        confirmationDate: null,
        reference: null,
        pic: null,
        mic: null,
        reportDate: null,
        baseInformation: null,
        updatedAt: null,
      }
    );
  }

  async updateProjectConfirmationDefaults(
    projectId: string,
    input: UpdateProjectConfirmationDefaultsInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.findProjectConfirmationDefaults(projectId);
    let normalizedBaseInformation =
      input.baseInformation === undefined
        ? (existing?.baseInformation ?? null)
        : normalizeProjectConfirmationBaseInformation(input.baseInformation);
    if (input.baseInformation?.customFields) {
      const supplied = input.baseInformation.customFields;
      const existingValues = existing?.baseInformation?.customFields ?? [];
      const customFields = await this.generalFields.validateProjectValues([
        ...existingValues.filter(
          (field) => !supplied.some((item) => item.id === field.id)
        ),
        ...supplied,
      ]);
      normalizedBaseInformation = {
        ...normalizedBaseInformation!,
        customFields,
      };
    }
    const data = {
      clientName:
        input.clientName === undefined
          ? (existing?.clientName ?? null)
          : normalizeProjectConfirmationDefault(input.clientName),
      confirmationDate:
        input.confirmationDate === undefined
          ? (existing?.confirmationDate ?? null)
          : normalizeProjectConfirmationDefault(input.confirmationDate),
      reference:
        input.reference === undefined
          ? (existing?.reference ?? null)
          : normalizeProjectConfirmationDefault(input.reference),
      pic:
        input.pic === undefined
          ? (existing?.pic ?? null)
          : normalizeProjectConfirmationDefault(input.pic),
      mic:
        input.mic === undefined
          ? (existing?.mic ?? null)
          : normalizeProjectConfirmationDefault(input.mic),
      reportDate:
        input.reportDate === undefined
          ? (existing?.reportDate ?? null)
          : normalizeProjectConfirmationDefault(input.reportDate),
      baseInformation: normalizedBaseInformation ?? Prisma.JsonNull,
    };
    const defaults = await this.prisma.projectConfirmationDefaults.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_DEFAULTS_UPDATED",
      targetType: "PROJECT_CONFIRMATION_DEFAULTS",
      targetId: defaults.id,
      projectId,
      description: "Updated project confirmation defaults",
      source,
    });
    return defaults;
  }

  async listForOffice(user: RequestUser) {
    const where: Prisma.ProjectConfirmationWhereInput =
      hasConfirmationOfficeAccess(user)
        ? {}
        : {
            project: {
              members: {
                some: {
                  userId: user.id,
                  status: "ACTIVE",
                },
              },
            },
          };
    const confirmations = await this.prisma.projectConfirmation.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
    });
    const managedTemplateSnapshot = confirmations.some(
      (confirmation) => confirmation.status === "DRAFT"
    )
      ? await this.findManagedTemplateSnapshot()
      : null;
    const decoratedConfirmations = managedTemplateSnapshot
      ? confirmations.map((confirmation) =>
          this.attachLatestEnabledTemplateDesign(
            confirmation,
            managedTemplateSnapshot
          )
        )
      : confirmations;
    return decoratedConfirmations.map(normalizeConfirmationResponseFileNames);
  }

  async listLogisticsUnread(user: RequestUser) {
    const confirmations = await this.prisma.projectConfirmation.findMany({
      where: {
        status: { not: "VOIDED" },
        project: {
          status: { in: [...LOGISTICS_VISIBLE_PROJECT_STATUSES] },
          ...(hasConfirmationOfficeAccess(user)
            ? {}
            : {
                members: {
                  some: { userId: user.id, status: "ACTIVE" },
                },
              }),
        },
      },
      select: PROJECT_CONFIRMATION_LOGISTICS_SELECT,
    });
    const rows = confirmations
      .map((confirmation) => ({
        projectId: confirmation.projectId,
        confirmationId: confirmation.id,
        type: confirmation.type,
        version: getConfirmationLogisticsDeliveryVersion(confirmation),
      }))
      .filter(
        (row): row is typeof row & { version: string } => row.version !== null
      );
    if (rows.length === 0) {
      return [];
    }
    const readStates = await this.prisma.confirmationLogisticsReadState.findMany(
      {
        where: {
          userId: user.id,
          confirmationId: { in: rows.map((row) => row.confirmationId) },
        },
        select: { confirmationId: true, version: true },
      }
    );
    const acknowledged = new Map(
      readStates.map((state) => [state.confirmationId, state.version])
    );
    return rows.filter(
      (row) => acknowledged.get(row.confirmationId) !== row.version
    );
  }

  async acknowledgeLogisticsRead(
    projectId: string,
    confirmationId: string,
    version: string,
    user: RequestUser
  ) {
    if (!hasConfirmationOfficeAccess(user)) {
      await this.access.requireProjectMember(projectId, user.id);
    }
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: {
        id: confirmationId,
        projectId,
        status: { not: "VOIDED" },
        project: { status: { in: [...LOGISTICS_VISIBLE_PROJECT_STATUSES] } },
      },
      select: PROJECT_CONFIRMATION_LOGISTICS_SELECT,
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    const currentVersion = getConfirmationLogisticsDeliveryVersion(confirmation);
    if (!currentVersion || currentVersion !== version) {
      return { acknowledged: false, version: currentVersion };
    }
    await this.prisma.confirmationLogisticsReadState.upsert({
      where: {
        userId_confirmationId: { userId: user.id, confirmationId },
      },
      create: { userId: user.id, confirmationId, version },
      update: { version },
    });
    return { acknowledged: true, version };
  }

  async createForProject(
    projectId: string,
    input: CreateProjectConfirmationInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    await this.assertBankInformationCanApply(input.draftPayload);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectCode: true },
    });
    if (!project) {
      throw new ApiNotFoundException("NOT_FOUND", "Project was not found");
    }

    const templateSelection = input.draftTemplateCode
      ? await this.requireEnabledTemplate(input.draftTemplateCode, "NEW_DRAFT")
      : null;
    const templateDesignSchema = templateSelection?.designSchema ?? null;
    const template = templateSelection?.definition ?? null;
    const managedTemplate = Boolean(
      templateSelection &&
      (templateSelection.source !== null ||
        MANAGED_CONFIRMATION_TEMPLATE_CODES.some(
          (code) => code === input.draftTemplateCode
        ))
    );
    const type =
      input.type ??
      (template?.confirmationType as ConfirmationType | undefined);
    if (!type) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Confirmation type is required"
      );
    }
    const defaults = await this.findProjectConfirmationDefaults(projectId);
    const templateDraftPayload = managedTemplate
      ? sanitizeCreatedTemplateDynamicFields(
          input.draftPayload,
          templateDesignSchema
        )
      : input.draftPayload;
    let draftPayload = withTemplateAvailableCodes(
      input.draftTemplateCode
        ? withTemplateSourceSnapshot(
            withTemplateDesignSnapshot(
              templateDraftPayload,
              templateDesignSchema,
              managedTemplate,
              false
            ),
            templateSelection?.source ?? null,
            true
          )
        : input.draftPayload,
      await this.findAvailableManagedTemplateCodes()
    );
    ({ draftPayload } = mergeProjectConfirmationDefaults(
      {
        draftPayload,
        draftTemplateCode: input.draftTemplateCode,
        status: "DRAFT",
      },
      defaults,
      true
    ));
    const createInput = { ...input, draftPayload };
    const confirmation = await this.createDraftConfirmationWithRetry(
      projectId,
      project.projectCode,
      type,
      template,
      createInput,
      user.id
    );

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_CREATED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmation.id,
      projectId,
      description: `Created confirmation record for ${confirmation.counterpartyName}`,
      source,
    });
    await this.prisma.confirmationFollowUpEvent.create({
      data: {
        confirmationId: confirmation.id,
        eventType: "CONFIRMATION_CREATED",
        actorId: user.id,
        source: "PROJECT_TEAM_SYSTEM",
        occurredAt: confirmation.createdAt,
      },
    });

    return mergeProjectConfirmationDefaults(
      normalizeConfirmationResponseFileNames(confirmation),
      defaults,
      true
    );
  }

  async updateForProject(
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        type: true,
        status: true,
        project: { select: { projectCode: true } },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      input.type !== undefined &&
      input.type !== existing.type &&
      existing.status !== "DRAFT"
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Only draft confirmations can be reclassified"
      );
    }

    const data: Prisma.ProjectConfirmationUpdateInput = {};
    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.displayName !== undefined) {
      data.displayName = input.displayName.trim();
    }
    if (input.plannedSendDate !== undefined) {
      data.plannedSendDate = parseOptionalDate(input.plannedSendDate);
    }
    if (input.reportDeadline !== undefined) {
      data.reportDeadline = parseOptionalDate(input.reportDeadline);
    }
    if (input.teamConfirmStatus !== undefined) {
      data.teamConfirmStatus = input.teamConfirmStatus;
    }
    if (input.teamConfirmedByName !== undefined) {
      data.teamConfirmedByName = emptyToNull(input.teamConfirmedByName);
    }
    if (input.teamConfirmedAt !== undefined) {
      data.teamConfirmedAt = parseOptionalDate(input.teamConfirmedAt);
    }
    if (input.notes !== undefined) {
      data.notes = emptyToNull(input.notes);
    }

    const confirmation =
      input.type !== undefined && input.type !== existing.type
        ? await this.reclassifyDraftWithRetry(
            projectId,
            confirmationId,
            existing.project.projectCode,
            input.type as ConfirmationType,
            data
          )
        : await this.prisma.projectConfirmation.update({
            where: { id: confirmationId },
            data,
            include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
          });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_UPDATED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmation.id,
      projectId,
      description:
        input.type !== undefined && input.type !== existing.type
          ? `Reclassified confirmation ${confirmation.confirmationCode ?? confirmation.id} from ${existing.type} to ${input.type}`
          : `Updated confirmation record for ${confirmation.counterpartyName}`,
      source,
    });

    return normalizeConfirmationResponseFileNames(confirmation);
  }

  async voidProjectConfirmation(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    await this.assertSourceTransitionAllowed(
      {
        confirmationId,
        projectId,
        actorId: user.id,
        auditSource: source,
      },
      "VOID_CONFIRMATION"
    );
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: { id: true, status: true, counterpartyName: true },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (existing.status === "VOIDED") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "函证已在回收站"
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      await this.assertSourceTransitionAllowed(
        {
          confirmationId,
          projectId,
          actorId: user.id,
          auditSource: source,
        },
        "VOID_CONFIRMATION",
        transaction
      );
      const result = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: existing.status,
        },
        data: {
          status: "VOIDED",
          voidedFromStatus: existing.status,
        },
      });
      if (result.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_VOIDED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Moved confirmation ${existing.counterpartyName} to recycle bin`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  async restoreProjectConfirmation(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        voidedFromStatus: true,
        counterpartyName: true,
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (existing.status !== "VOIDED") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "函证不在回收站"
      );
    }

    const restoredStatus = existing.voidedFromStatus ?? "DRAFT";
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: "VOIDED",
        },
        data: {
          status: restoredStatus,
          voidedFromStatus: null,
        },
      });
      if (result.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_RESTORED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Restored confirmation ${existing.counterpartyName} from recycle bin`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  private async reclassifyDraftWithRetry(
    projectId: string,
    confirmationId: string,
    projectCode: string,
    type: ConfirmationType,
    data: Prisma.ProjectConfirmationUpdateInput
  ) {
    for (
      let attempt = 1;
      attempt <= MAX_CONFIRMATION_CREATE_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          for (
            let skip = 0;
            skip < MAX_STALE_CONFIRMATION_SEQUENCE_SKIPS;
            skip += 1
          ) {
            const allocation =
              await this.confirmationCodes.allocateInTransaction(
                tx,
                projectId,
                projectCode,
                type
              );
            const collision = await tx.projectConfirmation.findFirst({
              where: {
                projectId,
                OR: [
                  { confirmationCode: allocation.confirmationCode },
                  { type, typeSequence: allocation.sequence },
                ],
              },
              select: { id: true },
            });
            if (collision) {
              continue;
            }
            return tx.projectConfirmation.update({
              where: { id: confirmationId, status: "DRAFT" },
              data: {
                ...data,
                confirmationCode: allocation.confirmationCode,
                typeSequence: allocation.sequence,
              },
              include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
            });
          }
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Unable to advance confirmation sequence"
          );
        });
      } catch (error) {
        if (
          attempt < MAX_CONFIRMATION_CREATE_ATTEMPTS &&
          isProjectConfirmationTypeSequenceConflict(error)
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Unable to allocate confirmation code"
    );
  }

  async updateDraftForProject(
    projectId: string,
    confirmationId: string,
    input: UpdateProjectConfirmationDraftInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    await this.assertBankInformationCanApply(input.draftPayload);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        type: true,
        draftTemplateCode: true,
        draftPayload: true,
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (existing.status !== "DRAFT") {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only draft confirmations can be updated"
      );
    }
    const defaults = await this.findProjectConfirmationDefaults(projectId);
    const switchedTemplate =
      input.draftTemplateCode !== existing.draftTemplateCode;
    const templateSelection = switchedTemplate
      ? await this.requireEnabledTemplate(
          input.draftTemplateCode,
          "DRAFT_SWITCH"
        )
      : null;
    const currentCustomTemplate = isConfirmationCustomTemplateCode(
      input.draftTemplateCode
    )
      ? await this.findCustomTemplate(input.draftTemplateCode)
      : null;
    const currentCustomTemplateDesignSchema =
      !switchedTemplate && currentCustomTemplate?.designStatus === "ENABLED"
        ? parseConfirmationTemplateDesign(currentCustomTemplate.designSchema)
        : null;
    if (
      !switchedTemplate &&
      currentCustomTemplate?.designStatus === "ENABLED" &&
      currentCustomTemplate.designSchema != null &&
      !currentCustomTemplateDesignSchema
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板设计无效，不能用于函证"
      );
    }
    const templateDesignSchema =
      templateSelection?.designSchema ?? currentCustomTemplateDesignSchema;
    const template =
      templateSelection?.definition ??
      (currentCustomTemplate
        ? createCustomTemplateDefinition(currentCustomTemplate)
        : getConfirmationTemplateDefinition(input.draftTemplateCode));
    if (!template) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板不存在或已无法使用"
      );
    }
    const incomingDraftPayload = switchedTemplate
      ? input.draftPayload
      : currentCustomTemplateDesignSchema
        ? sanitizeCreatedTemplateDynamicFields(
            input.draftPayload,
            currentCustomTemplateDesignSchema
          )
        : sanitizeSavedTemplateDynamicFields(
            input.draftPayload,
            input.draftTemplateCode,
            existing.draftPayload
          );
    const draft = withTemplateAvailableCodes(
      withTemplateSourceSnapshot(
        withTemplateDesignSnapshot(
          incomingDraftPayload,
          templateDesignSchema,
          switchedTemplate,
          switchedTemplate
        ),
        templateSelection?.source ??
          (currentCustomTemplateDesignSchema ? currentCustomTemplate : null),
        switchedTemplate
      ),
      await this.findAvailableManagedTemplateCodes()
    );
    const data: Prisma.ProjectConfirmationUpdateManyMutationInput = {
      // The template controls document rendering; `type` is the independently
      // Assigned workpaper category and must survive subsequent draft saves.
      counterpartyName: getDraftString(draft, template.thirdPartyField) ?? "",
      counterpartyAddress: getDraftString(draft, "counterpartyAddress"),
      counterpartyContact: getDraftString(draft, "counterpartyContact"),
      draftTemplateCode: input.draftTemplateCode,
      draftPayload: draft as Prisma.InputJsonValue,
      draftUpdatedAt: new Date(),
    };
    const updated = await this.prisma.projectConfirmation.updateMany({
      where: {
        id: confirmationId,
        projectId,
        status: "DRAFT",
      },
      data,
    });
    if (updated.count === 0) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "Only draft confirmations can be updated"
      );
    }

    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_DRAFT_UPDATED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmation.id,
      projectId,
      description: `Updated confirmation draft for ${confirmation.counterpartyName} from ${input.patchSource}`,
      source,
    });

    return mergeProjectConfirmationDefaults(
      normalizeConfirmationResponseFileNames(confirmation),
      defaults
    );
  }

  private async assertBankInformationCanApply(draft: unknown) {
    if (!draft || typeof draft !== "object") return;
    const entryId = (draft as Record<string, unknown>).confirmationInformationLibraryEntryId;
    if (typeof entryId !== "string" || !entryId.trim()) return;
    const entry = await this.prisma.confirmationInformationLibraryEntry.findUnique({
      where: { id: entryId.trim() },
      select: { requiresBankTemplate: true },
    });
    if (entry?.requiresBankTemplate) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该银行要求使用银行指定格式，无法将银行信息应用到当前模板。请使用该银行提供的函证格式。"
      );
    }
  }

  private async findProjectConfirmationDefaults(
    projectId: string
  ): Promise<ProjectConfirmationDefaultsRecord | null> {
    const defaults = (await this.prisma.projectConfirmationDefaults.findUnique({
      where: { projectId },
    })) as ProjectConfirmationDefaultsRecord | null;
    const customFields = await this.generalFields.projectValues(
      defaults?.baseInformation?.customFields
    );
    if (!customFields.length && !defaults?.baseInformation?.customFields) {
      return defaults;
    }
    return {
      ...(defaults ?? {
        id: "",
        projectId,
        clientName: null,
        confirmationDate: null,
        reference: null,
        pic: null,
        mic: null,
        reportDate: null,
        updatedAt: null,
      }),
      baseInformation: {
        clientNames: [],
        references: [],
        banks: [],
        ...defaults?.baseInformation,
        customFields,
      },
    };
  }

  private async findBuiltInTemplateOverride(
    code: ConfirmationDraftTemplateCode
  ): Promise<ConfirmationTemplateDesignRecord | null> {
    const override = await confirmationTemplateBuiltInOverrideClient(
      this.prisma
    ).findUnique({
      where: { templateCode: code },
      select: { designStatus: true, designSchema: true, deletedAt: true },
    });
    return override;
  }

  private async findAvailableManagedTemplateCodes() {
    const overrides = await confirmationTemplateBuiltInOverrideClient(
      this.prisma
    ).findMany({
      select: { templateCode: true, designStatus: true, deletedAt: true },
    });
    const overrideByCode = new Map(
      overrides.map((override) => [override.templateCode, override])
    );
    const builtInCodes = MANAGED_CONFIRMATION_TEMPLATE_CODES.filter((code) => {
      const override = overrideByCode.get(code);
      return (
        isConfirmationTemplateAvailableForNewDrafts(code) &&
        !override?.deletedAt &&
        (override === undefined || override.designStatus === "ENABLED")
      );
    });
    return [
      ...builtInCodes,
      ...(await this.findEnabledCustomTemplateCodes()),
    ] as ConfirmationDraftTemplateCode[];
  }

  private async findManagedTemplateSnapshot(): Promise<ManagedTemplateSnapshot> {
    const overrides = await confirmationTemplateBuiltInOverrideClient(
      this.prisma
    ).findMany({
      select: {
        templateCode: true,
        designStatus: true,
        designSchema: true,
        deletedAt: true,
      },
    });
    const overrideByCode = new Map(
      overrides.map(
        (override) =>
          [
            override.templateCode,
            {
              designStatus: override.designStatus,
              designSchema: override.designSchema,
              deletedAt: override.deletedAt,
            },
          ] as const
      )
    );
    const customTemplates = await this.findEnabledCustomTemplates();
    const customByCode = new Map(
      customTemplates.map((template) => [template.code, template] as const)
    );
    return {
      customByCode,
      overrideByCode,
      availableCodes: [
        ...MANAGED_CONFIRMATION_TEMPLATE_CODES.filter(
          (code) =>
            isConfirmationTemplateAvailableForNewDrafts(code) &&
            !overrideByCode.get(code)?.deletedAt &&
            (overrideByCode.get(code)?.designStatus === undefined ||
              overrideByCode.get(code)?.designStatus === "ENABLED")
        ),
        ...customTemplates.map(
          (template) => template.code as ConfirmationDraftTemplateCode
        ),
      ],
    };
  }

  private async findEnabledCustomTemplates() {
    const client = confirmationTemplateLibraryFileClient(this.prisma);
    if (!client) {
      return [] as CustomConfirmationTemplateSnapshot[];
    }
    const templates =
      (await client.findMany({
        where: { designStatus: "ENABLED" },
        select: {
          code: true,
          designStatus: true,
          designSchema: true,
          fileName: true,
          objectKey: true,
          mimeType: true,
        },
        orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
      })) ?? [];
    return templates.filter((template) =>
      isConfirmationCustomTemplateCode(template.code)
    );
  }

  private async findEnabledCustomTemplateCodes() {
    const client = confirmationTemplateLibraryFileClient(this.prisma);
    if (!client) {
      return [] as ConfirmationDraftTemplateCode[];
    }
    const templates =
      (await client.findMany({
        where: { designStatus: "ENABLED" },
        select: { code: true },
        orderBy: [{ name: "asc" }, { updatedAt: "desc" }],
      })) ?? [];
    return templates
      .map((template) => template.code)
      .filter(
        isConfirmationCustomTemplateCode
      ) as ConfirmationDraftTemplateCode[];
  }

  private async findCustomTemplate(code: ConfirmationDraftTemplateCode) {
    await Promise.resolve();
    if (!isConfirmationCustomTemplateCode(code)) {
      return null;
    }
    const client = confirmationTemplateLibraryFileClient(this.prisma);
    if (!client) {
      return null;
    }
    return client.findUnique({
      where: { code },
      select: {
        code: true,
        name: true,
        confirmationType: true,
        designStatus: true,
        designSchema: true,
        fileName: true,
        objectKey: true,
        mimeType: true,
      },
    });
  }

  private async requireEnabledTemplate(
    code: ConfirmationDraftTemplateCode,
    reason: "NEW_DRAFT" | "DRAFT_SWITCH"
  ): Promise<EnabledConfirmationTemplateSelection> {
    const unavailableMessage =
      reason === "DRAFT_SWITCH"
        ? "该函证模板已停用，不能切换到此模板"
        : "该函证模板已停用，不能用于新建函证";

    if (isConfirmationCustomTemplateCode(code)) {
      const template = await this.findCustomTemplate(code);
      if (!template || template.designStatus !== "ENABLED") {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          unavailableMessage
        );
      }
      const designSchema = parseConfirmationTemplateDesign(
        template.designSchema
      );
      if (
        template.designSchema !== null &&
        designSchema !== undefined &&
        !designSchema
      ) {
        throw new ApiBadRequestException(
          "VALIDATION_FAILED",
          "该函证模板设计无效，不能用于函证"
        );
      }
      return {
        definition: createCustomTemplateDefinition(template),
        designSchema,
        source: {
          code: template.code,
          fileName: template.fileName,
          objectKey: template.objectKey,
          mimeType: template.mimeType,
        },
      };
    }

    if (!isConfirmationTemplateAvailableForNewDrafts(code)) {
      throw new ApiBadRequestException("VALIDATION_FAILED", unavailableMessage);
    }

    const override = await this.findBuiltInTemplateOverride(code);
    if (
      override &&
      (override.deletedAt || override.designStatus !== "ENABLED")
    ) {
      throw new ApiBadRequestException("VALIDATION_FAILED", unavailableMessage);
    }
    const designSchema = parseConfirmationTemplateDesign(
      override?.designSchema ?? getDefaultConfirmationTemplateDesign(code)
    );
    if (
      override?.designSchema !== null &&
      override?.designSchema !== undefined &&
      !designSchema
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板设计无效，不能用于函证"
      );
    }
    const definition = getConfirmationTemplateDefinition(code);
    if (!definition) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板不存在或已无法使用"
      );
    }
    return { definition, designSchema, source: null };
  }

  private attachLatestEnabledTemplateDesign<
    T extends {
      status?: unknown;
      draftTemplateCode?: unknown;
      draftPayload?: unknown;
    },
  >(confirmation: T, snapshot: ManagedTemplateSnapshot): T {
    if (confirmation.status !== "DRAFT") {
      return confirmation;
    }
    let draftPayload = withTemplateAvailableCodes(
      confirmation.draftPayload,
      snapshot.availableCodes
    );
    if (typeof confirmation.draftTemplateCode !== "string") {
      return { ...confirmation, draftPayload };
    }

    const code =
      confirmation.draftTemplateCode as ConfirmationDraftTemplateCode;
    const customTemplate = snapshot.customByCode.get(code);
    if (!isConfirmationTemplateAvailableForNewDrafts(code) && !customTemplate) {
      return { ...confirmation, draftPayload };
    }
    if (customTemplate) {
      const designSchema = parseConfirmationTemplateDesign(
        customTemplate.designSchema
      );
      if (designSchema) {
        draftPayload = withTemplateDesignSnapshot(
          draftPayload,
          designSchema,
          false,
          false
        );
      }
      draftPayload = withTemplateSourceSnapshot(
        draftPayload,
        {
          code: customTemplate.code,
          fileName: customTemplate.fileName,
          objectKey: customTemplate.objectKey,
          mimeType: customTemplate.mimeType,
        },
        false
      );
      return {
        ...confirmation,
        draftPayload,
      };
    }
    const override = snapshot.overrideByCode.get(code);
    const designSchema =
      override && override.designStatus !== "ENABLED"
        ? null
        : parseConfirmationTemplateDesign(
            override?.designSchema ?? getDefaultConfirmationTemplateDesign(code)
          );
    if (designSchema) {
      draftPayload = withTemplateDesignSnapshot(
        draftPayload,
        designSchema,
        false,
        false
      );
    }
    return {
      ...confirmation,
      draftPayload,
    };
  }

  private async prepareConfirmationForRendering<
    T extends {
      status?: unknown;
      draftTemplateCode?: unknown;
      draftPayload?: unknown;
    },
  >(confirmation: T): Promise<T> {
    if (confirmation.status !== "DRAFT") {
      return confirmation;
    }
    return this.attachLatestEnabledTemplateDesign(
      confirmation,
      await this.findManagedTemplateSnapshot()
    );
  }

  private async createDraftConfirmationWithRetry(
    projectId: string,
    projectCode: string,
    type: ConfirmationType,
    template: ConfirmationTemplateDefinition | null,
    input: CreateProjectConfirmationInput,
    createdBy: string
  ) {
    for (
      let attempt = 1;
      attempt <= MAX_CONFIRMATION_CREATE_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          for (
            let skip = 0;
            skip < MAX_STALE_CONFIRMATION_SEQUENCE_SKIPS;
            skip += 1
          ) {
            const allocation =
              await this.confirmationCodes.allocateInTransaction(
                tx,
                projectId,
                projectCode,
                type
              );
            const collision = await tx.projectConfirmation.findFirst({
              where: {
                projectId,
                OR: [
                  { confirmationCode: allocation.confirmationCode },
                  { type, typeSequence: allocation.sequence },
                ],
              },
              select: { id: true },
            });
            if (collision) {
              continue;
            }

            return tx.projectConfirmation.create({
              data: {
                projectId,
                type,
                displayName:
                  (template
                    ? getDraftString(
                        input.draftPayload,
                        template.thirdPartyField
                      )
                    : null) ?? null,
                confirmationCode: allocation.confirmationCode,
                typeSequence: allocation.sequence,
                counterpartyName:
                  (template
                    ? getDraftString(
                        input.draftPayload,
                        template.thirdPartyField
                      )
                    : null) ?? "",
                counterpartyAddress: getDraftString(
                  input.draftPayload,
                  "counterpartyAddress"
                ),
                counterpartyContact: getDraftString(
                  input.draftPayload,
                  "counterpartyContact"
                ),
                draftTemplateCode: input.draftTemplateCode ?? null,
                draftPayload: input.draftPayload
                  ? (input.draftPayload as Prisma.InputJsonValue)
                  : undefined,
                draftUpdatedAt: input.draftPayload ? new Date() : null,
                notes: emptyToNull(
                  getDraftString(input.draftPayload, "draftNotes") ?? undefined
                ),
                createdBy,
                responsibleUserId: createdBy,
              },
              include: PROJECT_CONFIRMATION_INCLUDE,
            });
          }
          throw new ApiBadRequestException(
            "VALIDATION_FAILED",
            "Unable to advance confirmation sequence"
          );
        });
      } catch (error) {
        if (
          attempt < MAX_CONFIRMATION_CREATE_ATTEMPTS &&
          isProjectConfirmationTypeSequenceConflict(error)
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ApiBadRequestException(
      "VALIDATION_FAILED",
      "Unable to allocate confirmation code"
    );
  }

  async previewPdfForProject(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    draftOverride?: UpdateProjectConfirmationDraftInput
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE,
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      draftOverride &&
      (confirmation.status !== "DRAFT" || confirmation.currentArtifact)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "只有函证草稿可以使用当前填写内容下载"
      );
    }
    if (
      !draftOverride &&
      confirmation.currentArtifact?.templateCode === "UPLOADED_DOCUMENT"
    ) {
      const artifact = await this.prisma.confirmationArtifact.findUnique({
        where: { id: confirmation.currentArtifact.id },
        select: {
          pdfObjectKey: true,
          docxObjectKey: true,
          structuredSnapshot: true,
        },
      });
      if (!artifact) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Confirmation file was not found"
        );
      }
      const sourceSnapshot = parseUploadedConfirmationSourceSnapshot(
        artifact.structuredSnapshot
      );
      if (sourceSnapshot && !sourceSnapshot.previewIsPdf) {
        const sourceFileName =
          normalizeUploadedFileName(sourceSnapshot.fileName).trim() ||
          "confirmation";
        const stored = await this.confirmationDocuments.getStoredFile(
          sourceSnapshot.objectKey,
          sourceFileName,
          sourceSnapshot.mimeType
        );
        return {
          ...stored,
          fileName: sourceFileName,
          mimeType: "application/octet-stream",
        };
      }
      return this.confirmationDocuments.getStoredPdf(
        artifact.pdfObjectKey,
        confirmation.attachmentName?.replace(/\.(docx?|pdf)$/i, ".pdf") ??
          "confirmation.pdf"
      );
    }
    const renderConfirmation = draftOverride
      ? await this.prepareConfirmationForRendering({
          ...confirmation,
          draftTemplateCode: draftOverride.draftTemplateCode,
          draftPayload: draftOverride.draftPayload,
        })
      : await this.prepareConfirmationForRendering(confirmation);
    const derivedSnapshot = await this.confirmationDerivedData.resolve(
      projectId,
      user,
      confirmation.confirmationCode ?? ""
    );
    return this.confirmationDocuments.renderPreviewPdf({
      confirmation: renderConfirmation,
      derivedSnapshot,
    });
  }

  async previewDocxForProject(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    draftOverride?: UpdateProjectConfirmationDraftInput
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE,
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      draftOverride &&
      (confirmation.status !== "DRAFT" || confirmation.currentArtifact)
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "只有函证草稿可以使用当前填写内容下载"
      );
    }
    if (
      !draftOverride &&
      confirmation.currentArtifact?.templateCode === "UPLOADED_DOCUMENT"
    ) {
      const artifact = await this.prisma.confirmationArtifact.findUnique({
        where: { id: confirmation.currentArtifact.id },
        select: {
          docxObjectKey: true,
          structuredSnapshot: true,
        },
      });
      if (!artifact) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Confirmation file was not found"
        );
      }
      const sourceSnapshot = parseUploadedConfirmationSourceSnapshot(
        artifact.structuredSnapshot
      );
      if (sourceSnapshot) {
        if (sourceSnapshot.previewIsPdf) {
          throw new ApiBadRequestException(
            "BAD_REQUEST",
            "PDF 函证没有可用的 DOCX 预览回退"
          );
        }
        const sourceFileName =
          normalizeUploadedFileName(sourceSnapshot.fileName).trim() ||
          "confirmation.docx";
        return this.confirmationDocuments.getStoredFile(
          sourceSnapshot.objectKey,
          sourceFileName,
          sourceSnapshot.mimeType
        );
      }
      return this.confirmationDocuments.getStoredFile(
        artifact.docxObjectKey,
        confirmation.attachmentName?.replace(/\.(docx?|pdf)$/i, ".docx") ??
          "confirmation.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    }
    const renderConfirmation = draftOverride
      ? await this.prepareConfirmationForRendering({
          ...confirmation,
          draftTemplateCode: draftOverride.draftTemplateCode,
          draftPayload: draftOverride.draftPayload,
        })
      : await this.prepareConfirmationForRendering(confirmation);
    const derivedSnapshot = await this.confirmationDerivedData.resolve(
      projectId,
      user,
      confirmation.confirmationCode ?? ""
    );
    if (draftOverride) {
      return this.confirmationDocuments.renderFilledDocx({
        confirmation: renderConfirmation,
        derivedSnapshot,
      });
    }
    return this.confirmationDocuments.renderPreviewDocx({
      confirmation: renderConfirmation,
      derivedSnapshot,
    });
  }

  async createDispatchForConfirmation(
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationDispatchInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    const duplicate = await this.prisma.projectConfirmationDispatch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        confirmationId: true,
        executionStatus: true,
        providerErrorMessage: true,
      },
    });
    if (duplicate) {
      if (duplicate.confirmationId !== confirmationId) {
        throw new ApiConflictException(
          "DISPATCH_STATE_CONFLICT",
          "发函请求标识已被其他函证使用"
        );
      }
      if (duplicate.executionStatus === "FAILED") {
        throw new ApiBadRequestException(
          "TRACKING_REGISTRATION_FAILED",
          duplicate.providerErrorMessage ?? "17TRACK 物流登记失败，请修改后重试"
        );
      }
      return this.getForProject(projectId, confirmationId, user);
    }
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        confirmationCode: true,
        counterpartyName: true,
        status: true,
        differenceStatus: true,
        currentArtifactId: true,
        currentArtifact: {
          select: {
            disposition: true,
            pdfObjectKey: true,
            docxObjectKey: true,
            structuredSnapshot: true,
          },
        },
        dispatches: {
          where: {
            executionStatus: { in: ["QUEUED", "STARTED", "SENT", "DELIVERED"] },
          },
          orderBy: { sequence: "desc" },
          select: {
            id: true,
            artifactId: true,
            sequence: true,
            sentAt: true,
            createdAt: true,
          },
          take: 1,
        },
        followUpEvents: {
          where: { eventType: "REDISPATCH_REQUESTED" },
          orderBy: { occurredAt: "desc" },
          select: { occurredAt: true, payload: true },
          take: 1,
        },
        responses: {
          where: { routingStatus: "ROUTED" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    const [latestDispatch] = existing.dispatches;
    const latestRedispatchRequest = existing.followUpEvents?.[0];
    const latestResponseId = existing.responses?.[0]?.id;
    const redispatchResponseId = getResponseIdFromPayload(
      latestRedispatchRequest?.payload
    );
    const redispatchRequestedAfterLatestDispatch =
      Boolean(latestDispatch) &&
      Boolean(latestRedispatchRequest) &&
      latestRedispatchRequest.occurredAt.getTime() >
        latestDispatch.createdAt.getTime();
    const hasPreparedReplacement =
      existing.status === "PREPARED" &&
      existing.differenceStatus === "EXCEPTION" &&
      Boolean(latestResponseId) &&
      Boolean(latestDispatch?.artifactId) &&
      existing.currentArtifactId !== latestDispatch.artifactId;
    const canInitialDispatch =
      !input.isRedispatch &&
      existing.status === "PREPARED" &&
      existing.dispatches.length === 0;
    const canRedispatch =
      input.isRedispatch &&
      (existing.status === "AWAITING_RESPONSE" ||
        existing.status === "PREPARED") &&
      existing.differenceStatus === "EXCEPTION" &&
      Boolean(latestResponseId) &&
      ((redispatchResponseId === latestResponseId &&
        redispatchRequestedAfterLatestDispatch) ||
        hasPreparedReplacement);
    if (
      (!canInitialDispatch && !canRedispatch) ||
      !existing.currentArtifactId ||
      existing.currentArtifact?.disposition !== "ACTIVE"
    ) {
      throw new ApiBadRequestException(
        "CONFIRMATION_STATE_CONFLICT",
        input.isRedispatch
          ? "Only a confirmation with a new redispatch request can be sent again"
          : "Only an unsent prepared confirmation can be dispatched"
      );
    }

    if (input.method === "EMAIL") {
      return this.createEmailDispatchForConfirmation(
        projectId,
        existing,
        input,
        user,
        source,
        input.isRedispatch ? (latestResponseId ?? null) : null
      );
    }
    const requiresTrackingRegistration =
      (input.method === "COURIER" || input.method === "POST") &&
      Boolean(input.trackingNumber?.trim());

    const lastDispatch =
      await this.prisma.projectConfirmationDispatch.findFirst({
        where: { confirmationId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
    const sequence = (lastDispatch?.sequence ?? 0) + 1;
    const sentAt = parseRequiredDate(input.sentAt);
    const startedAt = new Date();
    let dispatch;
    let reservationToken: string | null = null;
    if (input.isRedispatch) {
      const reservation = await this.reserveRedispatchDispatch(
        projectId,
        confirmationId,
        assertPresentValue(latestResponseId),
        {
          confirmationId,
          idempotencyKey: input.idempotencyKey,
          method: input.method as ConfirmationDispatchMethod,
          artifactId: assertPresentValue(existing.currentArtifactId),
          executionStatus: "STARTED",
          startedAt,
          senderName: emptyToNull(input.senderName),
          applicantName: emptyToNull(input.applicantName),
          courierName: emptyToNull(input.courierName),
          trackingNumber: emptyToNull(input.trackingNumber),
          trackingProvider: requiresTrackingRegistration ? "17TRACK" : null,
          trackingCarrierCode: input.trackingCarrierCode ?? null,
          dispatchReference: emptyToNull(input.dispatchReference),
          recipientName: emptyToNull(input.recipientName),
          recipientContact: emptyToNull(input.recipientContact),
          recipientPhone: emptyToNull(input.recipientPhone),
          followUpDate: parseOptionalDate(input.followUpDate),
          attachmentName: emptyToNull(input.attachmentName),
          notes: emptyToNull(input.notes),
          createdBy: user.id,
        },
        user.id,
        "PROJECT_TEAM_MANUAL"
      );
      ({ reservationToken, dispatch } = reservation);
    } else {
      dispatch = await this.prisma.projectConfirmationDispatch.create({
        data: {
          confirmationId,
          sequence,
          idempotencyKey: input.idempotencyKey,
          method: input.method as ConfirmationDispatchMethod,
          artifactId: existing.currentArtifactId,
          executionStatus: "STARTED",
          startedAt,
          senderName: emptyToNull(input.senderName),
          applicantName: emptyToNull(input.applicantName),
          courierName: emptyToNull(input.courierName),
          trackingNumber: emptyToNull(input.trackingNumber),
          trackingProvider: requiresTrackingRegistration ? "17TRACK" : null,
          trackingCarrierCode: input.trackingCarrierCode ?? null,
          dispatchReference: emptyToNull(input.dispatchReference),
          recipientName: emptyToNull(input.recipientName),
          recipientContact: emptyToNull(input.recipientContact),
          recipientPhone: emptyToNull(input.recipientPhone),
          followUpDate: parseOptionalDate(input.followUpDate),
          attachmentName: emptyToNull(input.attachmentName),
          notes: emptyToNull(input.notes),
          createdBy: user.id,
          events: {
            create: [
              {
                eventType: "CREATED",
                actorId: user.id,
                source: "PROJECT_TEAM_MANUAL",
                payload: { method: input.method },
                occurredAt: sentAt,
              },
              {
                eventType: "STARTED",
                actorId: user.id,
                source: "PROJECT_TEAM_MANUAL",
                payload: {
                  method: input.method,
                  trackingNumber: input.trackingNumber ?? null,
                  trackingCarrierCode: input.trackingCarrierCode ?? null,
                },
                occurredAt: startedAt,
              },
            ],
          },
        },
      });
    }

    let registration:
      | Awaited<
          ReturnType<ProjectConfirmationsService["registerShipmentTracking"]>
        >
      | {
          ok: true;
          carrierCode: null;
          registeredAt: null;
          snapshot: null;
        };
    try {
      registration = requiresTrackingRegistration
        ? await this.registerShipmentTracking(
            dispatch.id,
            assertPresentValue(dispatch.trackingNumber),
            input.trackingCarrierCode,
            input.trackingQueryParameters
          )
        : {
            ok: true,
            carrierCode: null,
            registeredAt: null,
            snapshot: null,
          };
    } catch (error) {
      registration = {
        ok: false,
        errorCode: "TRACKING_PROVIDER_ERROR",
        errorMessage:
          error instanceof Error
            ? error.message
            : "17TRACK registration failed",
      };
    }

    // The user is recording an already posted letter. Tracking availability does
    // not change that fact; keep its failure separate from the dispatch state.
    const trackingData = registration.ok
      ? {
          trackingCarrierCode: registration.carrierCode,
          trackingRegisteredAt: registration.registeredAt,
          trackingUpdatedAt: registration.registeredAt,
          trackingError: null,
          providerErrorCode: null,
          providerErrorMessage: null,
          ...trackingSnapshotUpdate(registration.snapshot),
        }
      : {
          trackingCarrierCode: input.trackingCarrierCode ?? null,
          trackingRegisteredAt: null,
          trackingUpdatedAt: new Date(),
          trackingError: registration.errorMessage,
          providerErrorCode: registration.errorCode,
          providerErrorMessage: registration.errorMessage,
        };

    const sentData = {
      executionStatus: "SENT" as const,
      sentAt,
      ...trackingData,
      events: {
        create: {
          eventType: "SENT" as const,
          actorId: user.id,
          source: "PROJECT_TEAM_MANUAL",
          payload: {
            method: input.method,
            trackingNumber: dispatch.trackingNumber,
            trackingCarrierCode: trackingData.trackingCarrierCode,
            trackingErrorCode: registration.ok ? null : registration.errorCode,
          },
          occurredAt: sentAt,
        },
      },
    };
    const confirmation = input.isRedispatch
      ? await this.finalizeRedispatchDispatch(
          projectId,
          confirmationId,
          assertPresentValue(latestResponseId),
          dispatch.id,
          assertPresentValue(reservationToken),
          "STARTED",
          sentData
        )
      : await this.prisma.$transaction(async (transaction) => {
          await transaction.projectConfirmationDispatch.update({
            where: { id: dispatch.id },
            data: sentData,
          });
          const advanced = await transaction.projectConfirmation.updateMany({
            where: { id: confirmationId, status: "PREPARED" },
            data: {
              status: "AWAITING_RESPONSE",
              queueClaimedBy: null,
              queueClaimedAt: null,
            },
          });
          if (advanced.count !== 1) {
            throw new ApiConflictException(
              "CONFIRMATION_STATE_CONFLICT",
              "函证状态已变化，请刷新后重试"
            );
          }
          return transaction.projectConfirmation.findUniqueOrThrow({
            where: { id: confirmationId },
            include: PROJECT_CONFIRMATION_INCLUDE,
          });
        });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_DISPATCH_CREATED",
      targetType: "PROJECT_CONFIRMATION_DISPATCH",
      targetId: dispatch.id,
      projectId,
      description: `Recorded dispatch ${dispatch.sequence} for ${existing.counterpartyName}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(confirmation);
  }

  async uploadDispatchAttachment(
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    file: UploadedConfirmationFile | undefined,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    const dispatch = await this.prisma.projectConfirmationDispatch.findFirst({
      where: { id: dispatchId, confirmationId },
      select: { id: true, attachmentObjectKey: true },
    });
    if (!dispatch) {
      throw new ApiNotFoundException(
        "CONFIRMATION_DISPATCH_NOT_FOUND",
        "发函记录不存在"
      );
    }
    if (!file || !DISPATCH_ATTACHMENT_TYPES.has(file.mimetype)) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "仅支持 PDF、JPG 和 PNG 格式的寄出函证扫描件"
      );
    }
    if (file.size > MAX_DISPATCH_ATTACHMENT_SIZE) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "寄出函证扫描件不能超过 20 MB"
      );
    }

    const stored = await this.storage.putConfirmationDispatchAttachment(
      projectId,
      confirmationId,
      dispatchId,
      file.originalname,
      file.buffer,
      file.mimetype
    );
    const fileName = normalizeUploadedFileName(file.originalname);
    const attachmentSha256 = createHash("sha256")
      .update(file.buffer)
      .digest("hex");

    let confirmation;
    try {
      confirmation = await this.prisma.$transaction(async (transaction) => {
        const changed =
          await transaction.projectConfirmationDispatch.updateMany({
            where: {
              id: dispatchId,
              confirmationId,
              attachmentObjectKey: dispatch.attachmentObjectKey,
            },
            data: {
              attachmentName: fileName,
              attachmentObjectKey: stored.objectKey,
              attachmentMimeType: file.mimetype,
              attachmentSize: file.size,
              attachmentSha256,
            },
          });
        if (changed.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "发函记录已变化，请刷新后重试"
          );
        }
        return transaction.projectConfirmation.findUniqueOrThrow({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE,
        });
      });
    } catch (error) {
      await this.storage.deleteObject(stored.objectKey).catch(() => {});
      throw error;
    }

    if (
      dispatch.attachmentObjectKey &&
      dispatch.attachmentObjectKey !== stored.objectKey
    ) {
      await this.storage
        .deleteObject(dispatch.attachmentObjectKey)
        .catch(() => {});
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_DISPATCH_ATTACHMENT_UPLOADED",
      targetType: "PROJECT_CONFIRMATION_DISPATCH",
      targetId: dispatchId,
      projectId,
      description: `Uploaded sent confirmation scan for ${confirmationId}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(confirmation);
  }

  private async reserveRedispatchDispatch(
    projectId: string,
    confirmationId: string,
    responseId: string,
    data: RedispatchReservationData,
    actorId: string,
    eventSource: "PROJECT_TEAM_MANUAL" | "PROJECT_TEAM_EMAIL"
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reservationToken = randomUUID();
        const claimed = await transaction.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            projectId,
            status: { in: ["AWAITING_RESPONSE", "PREPARED"] },
            differenceStatus: "EXCEPTION",
            queueClaimedBy: null,
            currentArtifactId: data.artifactId,
            dispatches: {
              none: {
                executionStatus: { in: ["QUEUED", "STARTED"] },
              },
            },
            responses: {
              some: { id: responseId, routingStatus: "ROUTED" },
            },
          },
          data: {
            queueClaimedBy: reservationToken,
            queueClaimedAt: data.startedAt,
          },
        });
        if (claimed.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "函证状态已变化，请刷新后重试"
          );
        }

        const latestDispatch =
          await transaction.projectConfirmationDispatch.findFirst({
            where: { confirmationId },
            orderBy: { sequence: "desc" },
            select: { sequence: true },
          });
        const dispatch = await transaction.projectConfirmationDispatch.create({
          data: {
            ...data,
            sequence: (latestDispatch?.sequence ?? 0) + 1,
          },
        });
        await transaction.confirmationDispatchEvent.create({
          data: {
            dispatchId: dispatch.id,
            eventType: "CREATED",
            actorId,
            source: eventSource,
            payload: { method: data.method },
            occurredAt: data.startedAt,
          },
        });
        if (data.executionStatus === "STARTED") {
          await transaction.confirmationDispatchEvent.create({
            data: {
              dispatchId: dispatch.id,
              eventType: "STARTED",
              actorId,
              source: eventSource,
              payload: {
                method: data.method,
                trackingNumber: data.trackingNumber ?? null,
                trackingCarrierCode: data.trackingCarrierCode ?? null,
              },
              occurredAt: data.startedAt,
            },
          });
        }
        return { dispatch, reservationToken };
      });
    } catch (error) {
      if (isRedispatchReservationConflict(error)) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      throw error;
    }
  }

  private async finalizeRedispatchDispatch(
    projectId: string,
    confirmationId: string,
    responseId: string,
    dispatchId: string,
    reservationToken: string,
    reservationStatus: "QUEUED" | "STARTED",
    data: Prisma.ProjectConfirmationDispatchUpdateArgs["data"]
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const stillValid = await transaction.projectConfirmation.updateMany({
          where: {
            id: confirmationId,
            projectId,
            status: { in: ["AWAITING_RESPONSE", "PREPARED"] },
            differenceStatus: "EXCEPTION",
            queueClaimedBy: reservationToken,
            responses: {
              some: { id: responseId, routingStatus: "ROUTED" },
            },
            dispatches: {
              some: { id: dispatchId, executionStatus: reservationStatus },
            },
          },
          data: {
            status: "AWAITING_RESPONSE",
            queueClaimedBy: null,
            queueClaimedAt: null,
          },
        });
        if (stillValid.count !== 1) {
          throw new ApiConflictException(
            "CONFIRMATION_STATE_CONFLICT",
            "函证状态已变化，请刷新后重试"
          );
        }
        await transaction.projectConfirmationDispatch.update({
          where: { id: dispatchId },
          data,
        });
        return transaction.projectConfirmation.findUniqueOrThrow({
          where: { id: confirmationId },
          include: PROJECT_CONFIRMATION_INCLUDE,
        });
      });
    } catch (error) {
      if (error instanceof ApiConflictException) {
        await this.reconcileRedispatchDispatchAfterSend(
          projectId,
          confirmationId,
          reservationToken,
          dispatchId,
          reservationStatus,
          data
        );
      }
      throw error;
    }
  }

  private async failRedispatchDispatch(
    projectId: string,
    confirmationId: string,
    reservationToken: string,
    dispatchId: string,
    reservationStatus: "QUEUED" | "STARTED",
    data: Prisma.ProjectConfirmationDispatchUpdateManyMutationInput,
    event: {
      actorId: string;
      source: "PROJECT_TEAM_MANUAL" | "PROJECT_TEAM_EMAIL";
      payload: Prisma.InputJsonValue;
      occurredAt: Date;
    }
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const failed = await transaction.projectConfirmationDispatch.updateMany({
        where: { id: dispatchId, executionStatus: reservationStatus },
        data,
      });
      if (failed.count !== 1) {
        return;
      }
      await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          queueClaimedBy: reservationToken,
        },
        data: {
          queueClaimedBy: null,
          queueClaimedAt: null,
        },
      });
      await transaction.confirmationDispatchEvent.create({
        data: {
          dispatchId,
          eventType: "FAILED",
          ...event,
        },
      });
    });
  }

  private async reconcileRedispatchDispatchAfterSend(
    projectId: string,
    confirmationId: string,
    reservationToken: string,
    dispatchId: string,
    reservationStatus: "QUEUED" | "STARTED",
    data: Prisma.ProjectConfirmationDispatchUpdateArgs["data"]
  ) {
    const reconciliationData = { ...data } as
      | Prisma.ProjectConfirmationDispatchUncheckedUpdateManyInput
      | Prisma.ProjectConfirmationDispatchUpdateManyMutationInput;
    delete (reconciliationData as { events?: unknown }).events;
    await this.prisma.$transaction(async (transaction) => {
      await transaction.projectConfirmationDispatch.updateMany({
        where: { id: dispatchId, executionStatus: reservationStatus },
        data: reconciliationData,
      });
      await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          queueClaimedBy: reservationToken,
        },
        data: {
          queueClaimedBy: null,
          queueClaimedAt: null,
        },
      });
    });
  }

  async createFollowUpEventForConfirmation(
    projectId: string,
    confirmationId: string,
    input: CreateProjectConfirmationFollowUpEventServiceInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    if (input.eventType === "REDISPATCH_REQUESTED") {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Redispatch requests must be created by response review"
      );
    }
    const occurredAt = new Date();
    const followUpId = randomUUID();
    const returnShipment = input.eventType === "COUNTERPARTY_SENT_RESPONSE" && input.trackingNumber?.trim()
      ? { trackingNumber: input.trackingNumber.trim(), courierName: input.courierName ?? null,
          trackingCarrierCode: input.trackingCarrierCode ?? null }
      : null;
    const confirmation = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.projectConfirmation.findFirst({
        where: { id: confirmationId, projectId },
        select: { id: true, status: true, counterpartyName: true },
      });
      if (!current) {
        throw new ApiNotFoundException(
          "NOT_FOUND",
          "Confirmation record was not found"
        );
      }
      const claimed = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: "AWAITING_RESPONSE",
        },
        data: { status: "AWAITING_RESPONSE" },
      });
      if (claimed.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      await transaction.confirmationFollowUpEvent.create({
        data: {
          id: followUpId,
          confirmationId,
          ...(returnShipment ? { payload: { returnShipment } } : {}),
          eventType: input.eventType,
          actorId: user.id,
          source: "PROJECT_TEAM_MANUAL",
          notes: emptyToNull(input.notes),
          occurredAt,
        },
      });
      return current;
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_FOLLOW_UP_RECORDED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Recorded ${input.eventType} for ${confirmation.counterpartyName}`,
      source,
    });
    if (returnShipment && input.eventType === "COUNTERPARTY_SENT_RESPONSE") {
      await this.shipmentTracking.registerReturnShipment(followUpId, returnShipment, input.trackingQueryParameters);
    }
    return this.getForProject(projectId, confirmationId, user);
  }

  async completeConfirmationProgram(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        differenceStatus: true,
        currentArtifactId: true,
        notes: true,
        counterpartyName: true,
        responses: {
          select: { id: true },
          where: { routingStatus: "ROUTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      confirmation.status !== "RESPONSE_RECEIVED" ||
      confirmation.responses.length === 0 ||
      confirmation.differenceStatus !== "PENDING_FOLLOW_UP"
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "The response must be reviewed before the program can be completed"
      );
    }
    const occurredAt = new Date();
    const previous = {
      status: confirmation.status,
      differenceStatus: confirmation.differenceStatus,
      notes: confirmation.notes ?? null,
    } satisfies ConfirmationPhaseSnapshot;
    const next = {
      status: "CLOSED",
      differenceStatus: confirmation.differenceStatus,
      notes: confirmation.notes ?? null,
    } satisfies ConfirmationPhaseSnapshot;
    const updated = await this.prisma.$transaction(async (transaction) => {
      const completed = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          status: "RESPONSE_RECEIVED",
          differenceStatus: "PENDING_FOLLOW_UP",
          responses: {
            some: {
              id: assertPresentValue(confirmation.responses[0]).id,
              routingStatus: "ROUTED",
            },
          },
        },
        data: { status: "CLOSED" },
      });
      if (completed.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      await transaction.confirmationFollowUpEvent.create({
        data: {
          confirmationId,
          eventType: "PROGRAM_COMPLETED",
          actorId: user.id,
          source: "PROJECT_TEAM_MANUAL",
          payload: {
            resolution: "ALTERNATIVE_PROCEDURE",
            transition: "COMPLETION",
            responseId: assertPresentValue(confirmation.responses[0]).id,
            previous,
            next,
          },
          occurredAt,
        },
      });
      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_PROGRAM_COMPLETED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Completed confirmation program for ${confirmation.counterpartyName}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  async reviewProjectConfirmationResponse(
    projectId: string,
    confirmationId: string,
    input: ReviewProjectConfirmationResponseInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        differenceStatus: true,
        notes: true,
        counterpartyName: true,
        responses: {
          select: { id: true },
          where: { routingStatus: "ROUTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    if (
      confirmation.status !== "RESPONSE_RECEIVED" ||
      confirmation.responses.length === 0 ||
      confirmation.differenceStatus !== null
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "Only a received response can be reviewed"
      );
    }

    const responseId = assertPresentValue(confirmation.responses[0]).id;
    const notes = input.notes?.trim() || undefined;
    const previous = {
      status: confirmation.status,
      differenceStatus: confirmation.differenceStatus,
      notes: confirmation.notes ?? null,
    } satisfies ConfirmationPhaseSnapshot;
    const nextStatus =
      input.result === "MATCHED"
        ? "CLOSED"
        : input.action === "REDISPATCH"
          ? "DRAFT"
          : "RESPONSE_RECEIVED";
    const nextDifferenceStatus =
      input.result === "MATCHED"
        ? "MATCHED"
        : input.action === "REDISPATCH"
          ? "EXCEPTION"
          : "PENDING_FOLLOW_UP";
    const next = {
      status: nextStatus,
      differenceStatus: nextDifferenceStatus,
      notes: notes ?? confirmation.notes ?? null,
    } satisfies ConfirmationPhaseSnapshot;
    const updateData = {
      status: next.status,
      differenceStatus: next.differenceStatus,
      ...(input.action === "REDISPATCH"
        ? {
            queuedAt: null,
            queueClaimedBy: null,
            queueClaimedAt: null,
          }
        : {}),
      ...(notes ? { notes } : {}),
    } satisfies Prisma.ProjectConfirmationUpdateManyMutationInput;
    const occurredAt = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      const reviewed = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
          responses: {
            some: { id: responseId, routingStatus: "ROUTED" },
          },
        },
        data: updateData,
      });
      if (reviewed.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }

      if (input.result === "MATCHED") {
        await transaction.confirmationFollowUpEvent.create({
          data: {
            confirmationId,
            eventType: "REVIEW_RECORDED",
            actorId: user.id,
            source: "PROJECT_TEAM_MANUAL",
            notes,
            payload: {
              responseId,
              result: "MATCHED",
              transition: "REVIEW",
              previous,
              next,
            },
            occurredAt,
          },
        });
      } else if (input.action === "REDISPATCH") {
        await transaction.confirmationFollowUpEvent.create({
          data: {
            confirmationId,
            eventType: "REDISPATCH_REQUESTED",
            actorId: user.id,
            source: "PROJECT_TEAM_MANUAL",
            notes,
            payload: {
              responseId,
              result: "MISMATCHED",
              action: "REDISPATCH",
              transition: "REVIEW",
              previous,
              next,
            },
            occurredAt,
          },
        });
      } else {
        await transaction.confirmationFollowUpEvent.create({
          data: {
            confirmationId,
            eventType: "REVIEW_RECORDED",
            actorId: user.id,
            source: "PROJECT_TEAM_MANUAL",
            notes,
            payload: {
              responseId,
              result: "MISMATCHED",
              action: "ALTERNATIVE_PROCEDURE",
              transition: "REVIEW",
              previous,
              next,
            },
            occurredAt,
          },
        });
      }

      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_RESPONSE_REVIEWED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Reviewed response for ${confirmation.counterpartyName}: ${input.result}${input.action ? ` via ${input.action}` : ""}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  async startRedispatchEditing(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.access.requireMutableProject(projectId, user.id);
    await this.assertSourceTransitionAllowed(
      {
        confirmationId,
        projectId,
        actorId: user.id,
        auditSource: source,
      },
      "REDISPATCH_EDITING"
    );
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        differenceStatus: true,
        counterpartyName: true,
        dispatches: {
          select: { sequence: true, createdAt: true },
          orderBy: { sequence: "desc" },
          take: 1,
        },
        followUpEvents: {
          where: { eventType: "REDISPATCH_REQUESTED" },
          select: { occurredAt: true },
          orderBy: { occurredAt: "desc" },
          take: 1,
        },
      },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }

    const [latestRequest] = existing.followUpEvents;
    const [latestDispatch] = existing.dispatches;
    if (
      existing.status !== "AWAITING_RESPONSE" ||
      existing.differenceStatus !== "EXCEPTION" ||
      !latestRequest ||
      (latestDispatch &&
        latestDispatch.sequence > 1 &&
        latestRequest.occurredAt <= latestDispatch.createdAt)
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "当前函证没有待编辑的重发草稿"
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      await this.assertSourceTransitionAllowed(
        {
          confirmationId,
          projectId,
          actorId: user.id,
          auditSource: source,
        },
        "REDISPATCH_EDITING",
        transaction
      );
      const reopened = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: "AWAITING_RESPONSE",
          differenceStatus: "EXCEPTION",
        },
        data: {
          status: "DRAFT",
          queuedAt: null,
          queueClaimedBy: null,
          queueClaimedAt: null,
        },
      });
      if (reopened.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }
      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_REDISPATCH_EDITING_STARTED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Returned confirmation ${existing.counterpartyName} to draft for redispatch editing`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  async undoProjectConfirmationReview(
    projectId: string,
    confirmationId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    if (this.empImportWithdrawal) {
      await this.empImportWithdrawal.withdrawForConfirmation(
        projectId,
        confirmationId,
        user,
        source
      );
    } else {
      await this.assertSourceTransitionAllowed(
        {
          confirmationId,
          projectId,
          actorId: user.id,
          auditSource: source,
        },
        "UNDO_REVIEW"
      );
    }
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: {
        id: true,
        status: true,
        differenceStatus: true,
        notes: true,
        counterpartyName: true,
        responses: {
          where: { routingStatus: "ROUTED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
        dispatches: {
          orderBy: { sequence: "desc" },
          select: { sequence: true, createdAt: true },
        },
        followUpEvents: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            eventType: true,
            notes: true,
            payload: true,
            occurredAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }

    const current = {
      status: confirmation.status,
      differenceStatus: confirmation.differenceStatus,
      notes: confirmation.notes ?? null,
    } satisfies ConfirmationPhaseSnapshot;
    const retractedEventIds = new Set<string>();
    let transition: {
      event: (typeof confirmation.followUpEvents)[number];
      payload: ConfirmationReviewTransitionPayload;
    } | null = null;

    for (const event of confirmation.followUpEvents) {
      const payload = getConfirmationReviewTransitionPayload(
        event.eventType,
        event.payload,
        event.notes,
        current,
        confirmation.responses[0]?.id
      );
      if (event.eventType === "REVIEW_RETRACTED") {
        if (payload?.targetEventId) {
          retractedEventIds.add(payload.targetEventId);
        }
        continue;
      }
      if (
        !UNDOABLE_CONFIRMATION_EVENT_TYPES.has(event.eventType) ||
        retractedEventIds.has(event.id) ||
        !payload?.previous ||
        !payload.next ||
        !sameConfirmationPhase(payload.next, current)
      ) {
        continue;
      }
      if (
        payload.responseId &&
        confirmation.responses[0]?.id !== payload.responseId
      ) {
        continue;
      }
      transition = { event, payload };
      break;
    }

    if (!transition) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "当前没有可以撤回的复核结论"
      );
    }

    if (
      transition.event.eventType === "REDISPATCH_REQUESTED" &&
      confirmation.dispatches.some(
        (dispatch) =>
          dispatch.sequence > 1 &&
          dispatch.createdAt.getTime() >=
            assertPresentValue(transition).event.occurredAt.getTime()
      )
    ) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "重发函证已经创建，不能撤回复核结论"
      );
    }

    const { previous } = transition.payload;
    const { next } = transition.payload;
    if (!previous || !next) {
      throw new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "当前复核记录缺少可撤回的状态快照"
      );
    }
    const occurredAt = new Date();
    const updated = await this.prisma.$transaction(async (transaction) => {
      await this.assertSourceTransitionAllowed(
        {
          confirmationId,
          projectId,
          actorId: user.id,
          auditSource: source,
        },
        "UNDO_REVIEW",
        transaction
      );
      const restored = await transaction.projectConfirmation.updateMany({
        where: {
          id: confirmationId,
          projectId,
          status: current.status,
          differenceStatus: current.differenceStatus,
          notes: current.notes,
          ...(transition.payload.responseId
            ? {
                responses: {
                  some: {
                    id: transition.payload.responseId,
                    routingStatus: "ROUTED",
                  },
                },
              }
            : {}),
        },
        data: {
          status: previous.status,
          differenceStatus: previous.differenceStatus,
          notes: previous.notes,
        },
      });
      if (restored.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证状态已变化，请刷新后重试"
        );
      }

      await transaction.confirmationFollowUpEvent.create({
        data: {
          confirmationId,
          eventType: "REVIEW_RETRACTED",
          actorId: user.id,
          source: "PROJECT_TEAM_MANUAL",
          notes: "撤回复核结论",
          payload: {
            targetEventId: transition.event.id,
            responseId: transition.payload.responseId ?? null,
            previous: next,
            next: previous,
            transition: "ROLLBACK",
          },
          occurredAt,
        },
      });

      return transaction.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      });
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_REVIEW_RETRACTED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmationId,
      projectId,
      description: `Retracted confirmation review for ${confirmation.counterpartyName}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(updated);
  }

  async correctTrackingForConfirmation(
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    input: CorrectProjectConfirmationTrackingInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    if (dispatchId.startsWith("return:")) {
      const event = await this.prisma.confirmationFollowUpEvent.findFirst({
        where: { id: dispatchId.slice(7), confirmationId, eventType: "COUNTERPARTY_SENT_RESPONSE", confirmation: { projectId } },
      });
      if (!event) throw new ApiNotFoundException("NOT_FOUND", "Return shipment was not found");
      await this.shipmentTracking.registerReturnShipment(event.id, {
        trackingNumber: input.trackingNumber, courierName: input.courierName ?? null,
        trackingCarrierCode: input.trackingCarrierCode ?? null,
      }, input.trackingQueryParameters);
      await this.auditLogs.log({
        actorId: user.id, action: "PROJECT_CONFIRMATION_TRACKING_UPDATED",
        targetType: "PROJECT_CONFIRMATION", targetId: confirmationId, projectId,
        description: "Updated return shipment tracking", source,
      });
      return this.getForProject(projectId, confirmationId, user);
    }
    const dispatch = await this.prisma.projectConfirmationDispatch.findFirst({
      where: {
        id: dispatchId,
        confirmationId,
        confirmation: { projectId },
      },
      select: {
        id: true,
        method: true,
        executionStatus: true,
        trackingNumber: true,
        trackingStoppedAt: true,
      },
    });
    if (!dispatch) {
      throw new ApiNotFoundException(
        "CONFIRMATION_DISPATCH_NOT_FOUND",
        "发函记录不存在"
      );
    }
    if (
      (dispatch.method !== "COURIER" && dispatch.method !== "POST") ||
      dispatch.executionStatus !== "SENT"
    ) {
      throw new ApiBadRequestException(
        "DISPATCH_STATE_CONFLICT",
        "只有已寄出的实体函证可以更正物流信息"
      );
    }

    const registration = await this.registerShipmentTracking(
      dispatch.id,
      input.trackingNumber,
      input.trackingCarrierCode,
      input.trackingQueryParameters
    );
    if (!registration.ok) {
      throw new ApiBadRequestException(
        "TRACKING_REGISTRATION_FAILED",
        registration.errorMessage
      );
    }

    await this.prisma.projectConfirmationDispatch.update({
      where: { id: dispatch.id },
      data: {
        executionStatus: "SENT",
        deliveredAt: null,
        trackingNumber: input.trackingNumber,
        courierName: emptyToNull(input.courierName),
        trackingCarrierCode: registration.carrierCode,
        trackingCarrierName: null,
        trackingStatus: null,
        trackingSubstatus: null,
        trackingDescription: null,
        trackingLocation: null,
        trackingEvents: Prisma.JsonNull,
        trackingRegisteredAt: registration.registeredAt,
        trackingLastEventAt: null,
        trackingUpdatedAt: registration.registeredAt,
        trackingStoppedAt: null,
        trackingError: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        ...trackingSnapshotUpdate(registration.snapshot),
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_TRACKING_CORRECTED",
      targetType: "PROJECT_CONFIRMATION_DISPATCH",
      targetId: dispatch.id,
      projectId,
      description: `Corrected tracking ${dispatch.trackingNumber ?? "—"} to ${input.trackingNumber}: ${input.reason}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(
      await this.prisma.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      })
    );
  }

  async refreshTrackingForConfirmation(
    projectId: string,
    confirmationId: string,
    dispatchId: string,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    if (dispatchId.startsWith("return:")) {
      const event = await this.prisma.confirmationFollowUpEvent.findFirst({
        where: { id: dispatchId.slice(7), confirmationId, eventType: "COUNTERPARTY_SENT_RESPONSE", confirmation: { projectId } },
      });
      if (!event) throw new ApiNotFoundException("NOT_FOUND", "Return shipment was not found");
      await this.shipmentTracking.refreshReturnShipment(event.id);
      await this.auditLogs.log({
        actorId: user.id, action: "PROJECT_CONFIRMATION_TRACKING_UPDATED",
        targetType: "PROJECT_CONFIRMATION", targetId: confirmationId, projectId,
        description: "Updated return shipment tracking", source,
      });
      return this.getForProject(projectId, confirmationId, user);
    }
    const dispatch = await this.prisma.projectConfirmationDispatch.findFirst({
      where: {
        id: dispatchId,
        confirmationId,
        confirmation: { projectId },
      },
      select: {
        id: true,
        method: true,
        executionStatus: true,
        trackingCarrierCode: true,
        trackingNumber: true,
      },
    });
    if (!dispatch) {
      throw new ApiNotFoundException(
        "CONFIRMATION_DISPATCH_NOT_FOUND",
        "发函记录不存在"
      );
    }
    if (
      (dispatch.method !== "COURIER" && dispatch.method !== "POST") ||
      (dispatch.executionStatus !== "SENT" &&
        dispatch.executionStatus !== "DELIVERED") ||
      !dispatch.trackingNumber
    ) {
      throw new ApiBadRequestException(
        "DISPATCH_STATE_CONFLICT",
        "只有已寄出且已登记运单号的实体函证可以刷新物流信息"
      );
    }

    const refreshed = await this.shipmentTracking.refreshTracking(
      dispatch.trackingNumber,
      dispatch.trackingCarrierCode ?? undefined
    );
    if (!refreshed.ok) {
      throw new ApiBadRequestException(
        "TRACKING_REFRESH_FAILED",
        refreshed.errorMessage
      );
    }

    await this.prisma.projectConfirmationDispatch.update({
      where: { id: dispatch.id },
      data: {
        trackingProvider: "17TRACK",
        trackingError: null,
        providerErrorCode: null,
        providerErrorMessage: null,
        ...trackingSnapshotUpdate(refreshed.snapshot),
      },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_TRACKING_REFRESHED",
      targetType: "PROJECT_CONFIRMATION_DISPATCH",
      targetId: dispatch.id,
      projectId,
      description: `Refreshed tracking ${dispatch.trackingNumber}`,
      source,
    });
    return normalizeConfirmationResponseFileNames(
      await this.prisma.projectConfirmation.findUniqueOrThrow({
        where: { id: confirmationId },
        include: PROJECT_CONFIRMATION_INCLUDE,
      })
    );
  }

  private registerShipmentTracking(
    dispatchId: string,
    trackingNumber: string,
    carrierCode: number | undefined,
    queryParameters: Record<string, string> | undefined
  ) {
    return queryParameters && Object.keys(queryParameters).length > 0
      ? this.shipmentTracking.registerDispatch(
          dispatchId,
          trackingNumber,
          carrierCode,
          queryParameters
        )
      : this.shipmentTracking.registerDispatch(
          dispatchId,
          trackingNumber,
          carrierCode
        );
  }

  private async createEmailDispatchForConfirmation(
    projectId: string,
    confirmation: {
      id: string;
      confirmationCode: string | null;
      counterpartyName: string;
      currentArtifactId: string | null;
      currentArtifact: {
        disposition: string;
        pdfObjectKey: string;
        docxObjectKey?: string;
        structuredSnapshot?: Prisma.JsonValue;
      } | null;
    },
    input: CreateProjectConfirmationDispatchInput,
    user: RequestUser,
    source: AuditLogSource,
    redispatchResponseId: string | null
  ) {
    if (!confirmation.currentArtifactId || !confirmation.currentArtifact) {
      throw new ApiBadRequestException(
        "CONFIRMATION_STATE_CONFLICT",
        "函证没有可发送的冻结文件"
      );
    }
    const recipientEmail = input.recipientContact?.trim();
    if (!recipientEmail || !input.emailSubject || !input.emailBody) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "收件邮箱、邮件主题和正文不能为空"
      );
    }
    const startedAt = new Date();
    const artifact = confirmation.currentArtifact;
    const getAttachment = async () => {
      const sourceSnapshot = parseUploadedConfirmationSourceSnapshot(
        artifact.structuredSnapshot
      );
      const useOriginal = sourceSnapshot?.previewIsPdf === false;
      const body = await this.storage.getObjectBuffer(
        useOriginal ? sourceSnapshot.objectKey : artifact.pdfObjectKey
      );
      return {
        body,
        fileName: useOriginal
          ? sourceSnapshot.fileName
          : ensurePdfAttachmentFileName(
              input.attachmentName?.trim() ||
                `${confirmation.confirmationCode ?? confirmation.id}-confirmation.pdf`
            ),
        contentType: useOriginal ? sourceSnapshot.mimeType : "application/pdf",
      };
    };
    let dispatch: { id: string; sequence: number };
    let initialAttachment:
      | Awaited<ReturnType<typeof getAttachment>>
      | undefined;
    let reservationToken: string | null = null;
    if (input.isRedispatch) {
      if (!redispatchResponseId) {
        throw new ApiBadRequestException(
          "CONFIRMATION_STATE_CONFLICT",
          "函证没有可重发的回函"
        );
      }
      const reservation = await this.reserveRedispatchDispatch(
        projectId,
        confirmation.id,
        redispatchResponseId,
        {
          confirmationId: confirmation.id,
          method: "EMAIL",
          artifactId: confirmation.currentArtifactId,
          executionStatus: "QUEUED",
          idempotencyKey: input.idempotencyKey,
          startedAt,
          senderName: emptyToNull(input.senderName) ?? user.name,
          recipientName: emptyToNull(input.recipientName),
          recipientContact: recipientEmail,
          recipientEmail,
          emailSubject: input.emailSubject,
          emailBodyText: input.emailBody,
          followUpDate: parseOptionalDate(input.followUpDate),
          attachmentName: emptyToNull(input.attachmentName),
          notes: emptyToNull(input.notes),
          createdBy: user.id,
        },
        user.id,
        "PROJECT_TEAM_EMAIL"
      );
      ({ reservationToken, dispatch } = reservation);
    } else {
      initialAttachment = await getAttachment();
      const latestDispatch =
        await this.prisma.projectConfirmationDispatch.findFirst({
          where: { confirmationId: confirmation.id },
          orderBy: { sequence: "desc" },
          select: { sequence: true },
        });
      const sequence = (latestDispatch?.sequence ?? 0) + 1;
      dispatch = await this.prisma.projectConfirmationDispatch.create({
        data: {
          confirmationId: confirmation.id,
          sequence,
          method: "EMAIL",
          artifactId: confirmation.currentArtifactId,
          executionStatus: "QUEUED",
          idempotencyKey: input.idempotencyKey,
          startedAt,
          senderName: emptyToNull(input.senderName) ?? user.name,
          recipientName: emptyToNull(input.recipientName),
          recipientContact: recipientEmail,
          recipientEmail,
          emailSubject: input.emailSubject,
          emailBodyText: input.emailBody,
          followUpDate: parseOptionalDate(input.followUpDate),
          attachmentName: emptyToNull(input.attachmentName),
          notes: emptyToNull(input.notes),
          createdBy: user.id,
          events: {
            create: {
              eventType: "CREATED",
              actorId: user.id,
              source: "PROJECT_TEAM_EMAIL",
              payload: { method: "EMAIL", recipientEmail },
              occurredAt: startedAt,
            },
          },
        },
      });
    }
    let receipt: Awaited<ReturnType<UserMailConnectionService["send"]>>;
    try {
      const attachment = input.isRedispatch
        ? await getAttachment()
        : assertPresentValue(initialAttachment);
      const emailLocale = resolveConfirmationEmailLocale(
        `${input.emailSubject}\n${input.emailBody}`
      );
      const english = emailLocale === "en-US";
      const renderedEmail = renderSystemEmail({
        body: input.emailBody,
        brandName: "Wing Zenith",
        eyebrow: english ? "Audit confirmation" : "审计函证",
        facts: [
          {
            label: english ? "Reference" : "函证编号",
            value: confirmation.confirmationCode ?? confirmation.id,
          },
          {
            label: english ? "Counterparty" : "被函证单位",
            value: confirmation.counterpartyName,
          },
          {
            label: english ? "Prepared by" : "发送人",
            value: user.name,
          },
        ],
        footerNote: english
          ? "This message was sent by an authorized audit team member through the Project Wing Confirmation Centre."
          : "本邮件由获授权的审计项目成员通过 Project Wing 函证中心发送。",
        locale: emailLocale,
        notice: english
          ? "The requested document is attached. Verify the sender address before opening attachments."
          : "所需函证文件已随邮件附上。打开附件前，请核对发件人地址。",
        preheader: input.emailBody,
        productName: english ? "Audit Confirmation Centre" : "函证中心",
        title: input.emailSubject,
        tone: "neutral",
      });
      receipt = await this.userMail.send(user.id, {
        html: renderedEmail.html,
        to: recipientEmail,
        subject: input.emailSubject,
        text: renderedEmail.text,
        senderName: user.name,
        attachment: {
          fileName: attachment.fileName,
          content: attachment.body,
          contentType: attachment.contentType,
        },
      });
    } catch (error) {
      const failedAt = new Date();
      if (input.isRedispatch) {
        await this.failRedispatchDispatch(
          projectId,
          confirmation.id,
          assertPresentValue(reservationToken),
          dispatch.id,
          "QUEUED",
          {
            executionStatus: "FAILED",
            providerName: "WECOM_EXMAIL_SMTP",
            providerErrorCode: "MAIL_CONNECTION_FAILED",
            providerErrorMessage: "企业邮箱发送失败",
          },
          {
            actorId: user.id,
            source: "PROJECT_TEAM_EMAIL",
            payload: { method: "EMAIL", recipientEmail },
            occurredAt: failedAt,
          }
        );
      }
      if (!input.isRedispatch) {
        await this.prisma.projectConfirmationDispatch.update({
          where: { id: dispatch.id },
          data: {
            executionStatus: "FAILED",
            providerName: "WECOM_EXMAIL_SMTP",
            providerErrorCode: "MAIL_CONNECTION_FAILED",
            providerErrorMessage: "企业邮箱发送失败",
            events: {
              create: {
                eventType: "FAILED",
                actorId: user.id,
                source: "PROJECT_TEAM_EMAIL",
                payload: { method: "EMAIL", recipientEmail },
                occurredAt: failedAt,
              },
            },
          },
        });
      }
      throw error;
    }

    const sentAt = new Date();
    const sentData = {
      executionStatus: "SENT" as const,
      providerName: receipt.providerName,
      providerReference: receipt.providerReference,
      senderEmail: receipt.senderEmail,
      sentAt,
      events: {
        create: {
          eventType: "SENT" as const,
          actorId: user.id,
          source: "PROJECT_TEAM_EMAIL",
          payload: {
            method: "EMAIL",
            recipientEmail,
            senderEmail: receipt.senderEmail,
            providerReference: receipt.providerReference,
          },
          occurredAt: sentAt,
        },
      },
    };
    await (input.isRedispatch
      ? this.finalizeRedispatchDispatch(
          projectId,
          confirmation.id,
          assertPresentValue(redispatchResponseId),
          dispatch.id,
          assertPresentValue(reservationToken),
          "QUEUED",
          sentData
        )
      : this.prisma.projectConfirmationDispatch.update({
          where: { id: dispatch.id },
          data: sentData,
        }));
    if (!input.isRedispatch) {
      const updated = await this.prisma.projectConfirmation.updateMany({
        where: {
          id: confirmation.id,
          projectId,
          status: "PREPARED",
          currentArtifactId: confirmation.currentArtifactId,
        },
        data: { status: "AWAITING_RESPONSE" },
      });
      if (updated.count !== 1) {
        throw new ApiConflictException(
          "CONFIRMATION_STATE_CONFLICT",
          "邮件已发送，但函证状态发生变化，请联系管理员核对"
        );
      }
    }
    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_EMAIL_SENT",
      targetType: "PROJECT_CONFIRMATION_DISPATCH",
      targetId: dispatch.id,
      projectId,
      description: `Sent confirmation email ${dispatch.sequence} to ${recipientEmail}`,
      source,
    });
    return this.getForProject(projectId, confirmation.id, user);
  }

  async prepareDispatchForConfirmation(
    projectId: string,
    confirmationId: string,
    input: PrepareProjectConfirmationDispatchInput,
    user: RequestUser,
    source: AuditLogSource
  ) {
    await this.requireDispatchAccess(projectId, user);
    const existing = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      select: { id: true, counterpartyName: true, status: true },
    });
    if (!existing) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }

    const data: Prisma.ProjectConfirmationUpdateInput = {
      preparedDispatchMethod: input.method ?? null,
      preparedSenderName: emptyToNull(input.senderName),
      preparedApplicantName: emptyToNull(input.applicantName),
      preparedRecipientName: emptyToNull(input.recipientName),
      preparedRecipientContact: emptyToNull(input.recipientContact),
      preparedRecipientPhone: emptyToNull(input.recipientPhone),
      preparedCourierName: emptyToNull(input.courierName),
      preparedTrackingNumber: emptyToNull(input.trackingNumber),
      preparedDispatchReference: emptyToNull(input.dispatchReference),
      preparedFollowUpDate: parseOptionalDate(input.followUpDate),
      preparedAttachmentName: emptyToNull(input.attachmentName),
      preparedDispatchNotes: emptyToNull(input.notes),
    };
    if (input.markReady) {
      data.status = "PREPARED";
      data.preparedDispatchReadyBy = user.id;
      data.preparedDispatchReadyAt = new Date();
    }

    const confirmation = await this.prisma.projectConfirmation.update({
      where: { id: confirmationId },
      data,
      include: PROJECT_CONFIRMATION_INCLUDE,
    });

    await this.auditLogs.log({
      actorId: user.id,
      action: "PROJECT_CONFIRMATION_UPDATED",
      targetType: "PROJECT_CONFIRMATION",
      targetId: confirmation.id,
      projectId,
      description: input.markReady
        ? `Marked confirmation ready for ${confirmation.counterpartyName}`
        : `Prepared dispatch details for ${confirmation.counterpartyName}`,
      source,
    });

    return normalizeConfirmationResponseFileNames(confirmation);
  }

  private async getForProject(
    projectId: string,
    confirmationId: string,
    user: RequestUser
  ) {
    await this.access.requireProjectMember(projectId, user.id);
    const confirmation = await this.prisma.projectConfirmation.findFirst({
      where: { id: confirmationId, projectId },
      include: PROJECT_CONFIRMATION_INCLUDE_WITH_UPLOAD_METADATA,
    });
    if (!confirmation) {
      throw new ApiNotFoundException(
        "NOT_FOUND",
        "Confirmation record was not found"
      );
    }
    return normalizeConfirmationResponseFileNames(
      await this.repairPreparedSentConfirmation(projectId, confirmation)
    );
  }

  private async repairPreparedSentConfirmation<
    T extends {
      id: string;
      status: ConfirmationStatus;
      dispatches?: { id: string; executionStatus: string }[];
    },
  >(projectId: string, confirmation: T): Promise<T> {
    const latestDispatch = confirmation.dispatches?.at(-1);
    if (
      confirmation.status !== "PREPARED" ||
      latestDispatch?.executionStatus !== "SENT"
    ) {
      return confirmation;
    }

    const repaired = await this.prisma.projectConfirmation.updateMany({
      where: {
        id: confirmation.id,
        projectId,
        status: "PREPARED",
        dispatches: {
          some: { id: latestDispatch.id, executionStatus: "SENT" },
        },
      },
      data: { status: "AWAITING_RESPONSE" },
    });
    return repaired.count === 1
      ? { ...confirmation, status: "AWAITING_RESPONSE" }
      : confirmation;
  }

  private async assertSourceTransitionAllowed(
    source: {
      confirmationId: string;
      projectId: string;
      actorId: string;
      auditSource: AuditLogSource;
    },
    action: ConfirmationSourceInvalidatingAction,
    transaction?: unknown
  ) {
    try {
      await (transaction
        ? this.importLinkGuard.assertCanInvalidateSource(
            source,
            action,
            transaction as ConfirmationImportLinkPrismaLike
          )
        : this.importLinkGuard.assertCanInvalidateSource(source, action));
    } catch (error) {
      if (error instanceof ApiConflictException) {
        const response = error.getResponse();
        const message =
          typeof response === "object" &&
          response !== null &&
          "message" in response
            ? String(response.message)
            : error.message;
        try {
          await this.auditLogs.log({
            actorId: source.actorId,
            action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
            targetType: "PROJECT_CONFIRMATION",
            targetId: source.confirmationId,
            projectId: source.projectId,
            description: message,
            source: source.auditSource,
          });
        } catch {
          // The guard conflict remains authoritative if audit persistence fails.
        }
      }
      throw error;
    }
  }

  private async requireDispatchAccess(projectId: string, user: RequestUser) {
    await this.access.requireMutableProject(projectId, user.id);
  }
}

function resolveConfirmationEmailLocale(value: string) {
  return /[\u3400-\u9FFF]/u.test(value)
    ? ("zh-CN" as const)
    : ("en-US" as const);
}

export function normalizeConfirmationResponseFileNames<T>(confirmation: T): T {
  if (!confirmation || typeof confirmation !== "object") {
    return sanitizeConfirmationResponse(confirmation);
  }
  const record = confirmation as T & {
    id?: unknown;
    projectId?: unknown;
    project?: { id?: unknown } | null;
    currentArtifact?: unknown;
    responses?: {
      attachmentName?: string | null;
      artifacts?: { fileName: string }[];
    }[];
  };
  const artifact = isRecord(record.currentArtifact)
    ? record.currentArtifact
    : null;
  const sourceSnapshot = parseUploadedConfirmationSourceSnapshot(
    artifact?.structuredSnapshot
  );
  const publicArtifact = artifact
    ? (() => {
        const {
          docxObjectKey: _docxObjectKey,
          structuredSnapshot: _structuredSnapshot,
          ...safeArtifact
        } = artifact;
        return safeArtifact;
      })()
    : null;
  const projectId =
    typeof record.projectId === "string"
      ? record.projectId
      : isRecord(record.project) && typeof record.project.id === "string"
        ? record.project.id
        : null;
  const confirmationId = typeof record.id === "string" ? record.id : null;
  const downloadUrl =
    sourceSnapshot && projectId && confirmationId
      ? `/engagement/${encodeURIComponent(projectId)}/confirmations/${encodeURIComponent(confirmationId)}/preview.pdf`
      : null;
  const attachment =
    sourceSnapshot && downloadUrl
      ? {
          originalFileName: sourceSnapshot.fileName,
          originalMimeType: sourceSnapshot.mimeType,
          previewability: sourceSnapshot.previewIsPdf
            ? ("INLINE" as const)
            : ("DOWNLOAD_ONLY" as const),
          downloadUrl,
        }
      : null;
  return sanitizeConfirmationResponse({
    ...record,
    ...(sourceSnapshot &&
    isRecord(artifact?.structuredSnapshot) &&
    Array.isArray(artifact.structuredSnapshot.fileNames)
      ? {
          uploadedFileNames: artifact.structuredSnapshot.fileNames.filter(
            (name): name is string => typeof name === "string"
          ),
        }
      : {}),
    ...(Array.isArray(record.responses)
      ? {
          responses: record.responses.map((response) => ({
            ...response,
            attachmentName: response.attachmentName
              ? normalizeUploadedFileName(response.attachmentName)
              : response.attachmentName,
            artifacts: response.artifacts?.map((responseArtifact) => ({
              ...responseArtifact,
              fileName: normalizeUploadedFileName(responseArtifact.fileName),
            })),
          })),
        }
      : {}),
    ...(publicArtifact ? { currentArtifact: publicArtifact } : {}),
    ...(attachment
      ? {
          attachment,
          originalFileName: attachment.originalFileName,
          originalMimeType: attachment.originalMimeType,
          previewability: attachment.previewability,
          downloadUrl: attachment.downloadUrl,
        }
      : {}),
  } as T);
}

function parseConfirmationReviewTransitionPayload(
  payload: Prisma.JsonValue | null
): ConfirmationReviewTransitionPayload | null {
  if (!isRecord(payload)) {
    return null;
  }
  const previous = parseConfirmationPhaseSnapshot(payload.previous);
  const next = parseConfirmationPhaseSnapshot(payload.next);
  return {
    responseId:
      typeof payload.responseId === "string" ? payload.responseId : undefined,
    result: typeof payload.result === "string" ? payload.result : undefined,
    action: typeof payload.action === "string" ? payload.action : undefined,
    resolution:
      typeof payload.resolution === "string" ? payload.resolution : undefined,
    transition:
      typeof payload.transition === "string" ? payload.transition : undefined,
    targetEventId:
      typeof payload.targetEventId === "string"
        ? payload.targetEventId
        : undefined,
    previous: previous ?? undefined,
    next: next ?? undefined,
  };
}

function getConfirmationReviewTransitionPayload(
  eventType: string,
  rawPayload: Prisma.JsonValue | null,
  eventNotes: string | null,
  current: ConfirmationPhaseSnapshot,
  routedResponseId: string | undefined
): ConfirmationReviewTransitionPayload | null {
  const payload = parseConfirmationReviewTransitionPayload(rawPayload);
  if (!payload) {
    return null;
  }
  if (payload.previous && payload.next) {
    return payload;
  }

  // Older local imports predate transition snapshots. Infer only clear
  // One-step states, and never overwrite a note that was recorded with the event.
  if (eventNotes !== null) {
    return null;
  }
  const responseId = payload.responseId ?? routedResponseId;
  if (!responseId) {
    return null;
  }

  let previous: ConfirmationPhaseSnapshot | null = null;
  if (
    eventType === "PROGRAM_COMPLETED" &&
    payload.result === "MATCHED" &&
    current.status === "CLOSED" &&
    current.differenceStatus === "MATCHED"
  ) {
    previous = {
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      notes: current.notes,
    };
  } else if (
    eventType === "REDISPATCH_REQUESTED" &&
    payload.action === "REDISPATCH" &&
    (current.status === "AWAITING_RESPONSE" || current.status === "DRAFT") &&
    current.differenceStatus === "EXCEPTION"
  ) {
    previous = {
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      notes: current.notes,
    };
  } else if (
    eventType === "REVIEW_RECORDED" &&
    payload.action === "ALTERNATIVE_PROCEDURE" &&
    current.status === "RESPONSE_RECEIVED" &&
    current.differenceStatus === "PENDING_FOLLOW_UP"
  ) {
    previous = {
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      notes: current.notes,
    };
  } else if (
    eventType === "PROGRAM_COMPLETED" &&
    payload.resolution === "ALTERNATIVE_PROCEDURE" &&
    current.status === "CLOSED" &&
    current.differenceStatus === "PENDING_FOLLOW_UP"
  ) {
    previous = {
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
      notes: current.notes,
    };
  }

  return previous ? { ...payload, responseId, previous, next: current } : null;
}

function parseConfirmationPhaseSnapshot(
  value: unknown
): ConfirmationPhaseSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isConfirmationStatus(value.status)) {
    return null;
  }
  if (
    value.differenceStatus !== null &&
    !isConfirmationDifferenceStatus(value.differenceStatus)
  ) {
    return null;
  }
  if (value.notes !== null && typeof value.notes !== "string") {
    return null;
  }
  return {
    status: value.status,
    differenceStatus: value.differenceStatus,
    notes: value.notes,
  };
}

function sameConfirmationPhase(
  left: ConfirmationPhaseSnapshot,
  right: ConfirmationPhaseSnapshot
) {
  return (
    left.status === right.status &&
    left.differenceStatus === right.differenceStatus &&
    left.notes === right.notes
  );
}

function confirmationTemplateLibraryFileClient(
  client: unknown
): CustomConfirmationTemplateClient | null {
  const templateLibraryFile = (
    client as {
      confirmationTemplateLibraryFile?: CustomConfirmationTemplateClient;
    }
  ).confirmationTemplateLibraryFile;
  return templateLibraryFile ?? null;
}

function parseConfirmationTemplateDesign(
  value: unknown
): ConfirmationTemplateDesignSnapshot | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.fields)) {
    return null;
  }

  const fields: ConfirmationTemplateDesignFieldSnapshot[] = [];
  for (const field of value.fields) {
    if (!isRecord(field)) {
      return null;
    }
    const { kind } = field;
    const { page } = field;
    const { x } = field;
    const { y } = field;
    const { width } = field;
    const { height } = field;
    const { textAlign } = field;
    const { defaultChecked, required } = field;
    const defaultValueSource = parseConfirmationTemplateDefaultValueSource(
      field.defaultValueSource,
      kind
    );
    const binding = parseConfirmationTemplateFieldBinding(field.binding, kind);
    const baseInformationBinding = parseConfirmationTemplateFieldBinding(
      field.baseInformationBinding,
      kind,
      BASE_INFORMATION_FIELD_BINDINGS
    );
    const informationLibraryBinding = parseConfirmationTemplateFieldBinding(
      field.informationLibraryBinding,
      kind,
      INFORMATION_LIBRARY_FIELD_BINDINGS
    );
    const legacyRelationDefaultValueSource =
      defaultValueSource?.source === "BASE_INFORMATION" ||
      defaultValueSource?.source === "INFORMATION_LIBRARY"
        ? defaultValueSource
        : undefined;
    const migratedBaseInformationBinding =
      legacyRelationDefaultValueSource?.source === "BASE_INFORMATION"
        ? parseConfirmationTemplateFieldBinding(
            legacyRelationDefaultValueSource.binding,
            kind,
            BASE_INFORMATION_FIELD_BINDINGS
          )
        : undefined;
    const migratedInformationLibraryBinding =
      legacyRelationDefaultValueSource?.source === "INFORMATION_LIBRARY"
        ? parseConfirmationTemplateFieldBinding(
            legacyRelationDefaultValueSource.binding,
            kind,
            INFORMATION_LIBRARY_FIELD_BINDINGS
          )
        : undefined;
    const normalizedBaseInformationBinding =
      baseInformationBinding ?? migratedBaseInformationBinding;
    const normalizedInformationLibraryBinding =
      informationLibraryBinding ?? migratedInformationLibraryBinding;
    const normalizedBinding = normalizedBaseInformationBinding ?? binding;
    const normalizedDefaultValueSource = legacyRelationDefaultValueSource
      ? undefined
      : defaultValueSource;
    const sourceRanges = parseConfirmationTemplateFieldSourceRanges(
      field.sourceRanges
    );
    const textStyle = parseConfirmationTemplateFieldTextStyle(
      field.textStyle,
      kind
    );
    if (
      typeof field.id !== "string" ||
      !field.id.trim() ||
      (kind !== "TEXT" &&
        kind !== "MULTILINE" &&
        kind !== "NUMBER" &&
        kind !== "DATE" &&
        kind !== "CHECKBOX" &&
        kind !== "SELECT" &&
        kind !== "RADIO" &&
        kind !== "STATIC_TEXT" &&
        kind !== "MASK") ||
      typeof page !== "number" ||
      !Number.isInteger(page) ||
      page < 1 ||
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1 ||
      binding === null ||
      baseInformationBinding === null ||
      informationLibraryBinding === null ||
      migratedBaseInformationBinding === null ||
      migratedInformationLibraryBinding === null ||
      sourceRanges === null ||
      textStyle === null ||
      defaultValueSource === null ||
      (legacyRelationDefaultValueSource &&
        (field.binding !== undefined ||
          field.baseInformationBinding !== undefined ||
          field.informationLibraryBinding !== undefined)) ||
      (textAlign !== undefined &&
        textAlign !== "left" &&
        textAlign !== "center" &&
        textAlign !== "right") ||
      (defaultChecked !== undefined &&
        (kind !== "CHECKBOX" || typeof defaultChecked !== "boolean")) ||
      (required !== undefined &&
        (kind !== "CHECKBOX" || typeof required !== "boolean"))
    ) {
      return null;
    }
    if (field.name !== undefined && typeof field.name !== "string") {
      return null;
    }
    if (
      field.placeholder !== undefined &&
      typeof field.placeholder !== "string"
    ) {
      return null;
    }
    if (
      field.options !== undefined &&
      (!Array.isArray(field.options) ||
        !field.options.every((option) => typeof option === "string"))
    ) {
      return null;
    }
    const normalizedOptions = Array.isArray(field.options)
      ? field.options.map((option) => option.trim())
      : [];
    if (
      defaultValueSource?.source === "CUSTOM" &&
      !isValidCustomDefaultFillValue(
        kind,
        defaultValueSource.value,
        normalizedOptions
      )
    ) {
      return null;
    }
    fields.push({
      ...(kind === "CHECKBOX" && typeof defaultChecked === "boolean"
        ? { defaultChecked }
        : {}),
      ...(normalizedDefaultValueSource
        ? { defaultValueSource: normalizedDefaultValueSource }
        : {}),
      id: field.id.trim(),
      kind,
      ...(typeof field.name === "string" ? { name: field.name } : {}),
      ...(typeof field.placeholder === "string"
        ? { placeholder: field.placeholder }
        : {}),
      ...(Array.isArray(field.options) ? { options: normalizedOptions } : {}),
      ...(kind === "CHECKBOX" && typeof required === "boolean"
        ? { required }
        : {}),
      ...(textStyle ? { textStyle } : {}),
      ...(textAlign ? { textAlign } : {}),
      ...(normalizedBinding ? { binding: normalizedBinding } : {}),
      ...(normalizedBaseInformationBinding
        ? {
            baseInformationBinding: normalizedBaseInformationBinding,
          }
        : {}),
      ...(normalizedInformationLibraryBinding
        ? { informationLibraryBinding: normalizedInformationLibraryBinding }
        : {}),
      page,
      x,
      y,
      width,
      height,
      ...(sourceRanges?.length ? { sourceRanges } : {}),
    });
  }
  return { version: 1, fields };
}

function parseConfirmationTemplateFieldTextStyle(
  value: unknown,
  kind: unknown
): ConfirmationTemplateTextStyle | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    kind === "MASK" ||
    !isRecord(value) ||
    !["bold", "fontFamily", "fontSize", "italic", "underline"].every((key) =>
      Object.hasOwn(value, key)
    ) ||
    !Object.keys(value).every((key) =>
      [
        "backgroundColor",
        "bold",
        "fontFamily",
        "fontSize",
        "italic",
        "textColor",
        "underline",
      ].includes(key)
    ) ||
    typeof value.bold !== "boolean" ||
    typeof value.italic !== "boolean" ||
    typeof value.underline !== "boolean" ||
    !CONFIRMATION_TEMPLATE_FONT_FAMILIES.includes(
      value.fontFamily as (typeof CONFIRMATION_TEMPLATE_FONT_FAMILIES)[number]
    ) ||
    !CONFIRMATION_TEMPLATE_FONT_SIZES.includes(
      value.fontSize as (typeof CONFIRMATION_TEMPLATE_FONT_SIZES)[number]
    ) ||
    (value.textColor !== undefined &&
      (typeof value.textColor !== "string" ||
        !/^#[0-9A-Fa-f]{6}$/u.test(value.textColor))) ||
    (value.backgroundColor !== undefined &&
      (typeof value.backgroundColor !== "string" ||
        (value.backgroundColor !== "transparent" &&
          !/^#[0-9A-Fa-f]{6}$/u.test(value.backgroundColor))))
  ) {
    return null;
  }
  return {
    ...(value.backgroundColor
      ? { backgroundColor: value.backgroundColor }
      : {}),
    bold: value.bold,
    fontFamily: value.fontFamily as ConfirmationTemplateTextStyle["fontFamily"],
    fontSize: value.fontSize as ConfirmationTemplateTextStyle["fontSize"],
    italic: value.italic,
    ...(value.textColor ? { textColor: value.textColor } : {}),
    underline: value.underline,
  };
}

function parseConfirmationTemplateFieldBinding(
  value: unknown,
  kind: unknown,
  bindings: ReadonlySet<ConfirmationTemplateDesignFieldBinding> = TEMPLATE_FIELD_BINDINGS
): ConfirmationTemplateDesignFieldBinding | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    typeof value !== "string" ||
    !(
      bindings.has(value as ConfirmationTemplateDesignFieldBinding) ||
      (bindings !== INFORMATION_LIBRARY_FIELD_BINDINGS &&
        /^custom:[a-zA-Z0-9-]{1,80}$/.test(value))
    )
  ) {
    return null;
  }
  return value as ConfirmationTemplateDesignFieldBinding;
}

function parseConfirmationTemplateDefaultValueSource(
  value: unknown,
  kind: unknown
):
  | ConfirmationTemplateDesignFieldSnapshot["defaultValueSource"]
  | null
  | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    kind !== "STATIC_TEXT" &&
    kind !== "MASK" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "CUSTOM" &&
    typeof value.value === "string" &&
    value.value.length <= 10_000
  ) {
    return { source: "CUSTOM", value: value.value };
  }
  if (
    kind === "DATE" &&
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.source === "SYSTEM" &&
    value.value === "CURRENT_DATE"
  ) {
    return { source: "SYSTEM", value: "CURRENT_DATE" };
  }
  if (
    (kind !== "TEXT" && kind !== "MULTILINE") ||
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    (value.source !== "BASE_INFORMATION" &&
      value.source !== "INFORMATION_LIBRARY")
  ) {
    return null;
  }
  const binding = parseConfirmationTemplateFieldBinding(
    value.binding,
    kind,
    value.source === "BASE_INFORMATION"
      ? BASE_INFORMATION_FIELD_BINDINGS
      : INFORMATION_LIBRARY_FIELD_BINDINGS
  );
  if (!binding) {
    return null;
  }
  return { binding, source: value.source };
}

function isValidCustomDefaultFillValue(
  kind: unknown,
  value: string,
  options: string[]
) {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  if (kind === "NUMBER") {
    return /^-?(?:\d+|\d*\.\d+)$/u.test(normalized);
  }
  if (kind === "DATE") {
    return (
      /^\d{4}-\d{2}-\d{2}$/u.test(normalized) &&
      !Number.isNaN(Date.parse(normalized))
    );
  }
  if (kind === "RADIO" || kind === "SELECT") {
    return options.includes(normalized);
  }
  if (kind === "CHECKBOX") {
    return normalized === "true" || normalized === "false";
  }
  return kind === "TEXT" || kind === "MULTILINE";
}

function parseConfirmationTemplateFieldSourceRanges(
  value: unknown
): ConfirmationTemplateDesignFieldSourceRange[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length > 200) {
    return null;
  }

  const ranges: ConfirmationTemplateDesignFieldSourceRange[] = [];
  for (const range of value) {
    const expectedKeys =
      isRecord(range) && range.paragraphId === undefined
        ? [
            "part",
            "paragraphOrdinal",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ]
        : [
            "part",
            "paragraphOrdinal",
            "paragraphId",
            "paragraphXmlSha256",
            "sourceText",
            "start",
            "end",
          ];
    if (
      !isRecord(range) ||
      Object.keys(range).length !== expectedKeys.length ||
      !expectedKeys.every((key) => Object.hasOwn(range, key)) ||
      range.part !== "word/document.xml" ||
      typeof range.paragraphOrdinal !== "number" ||
      !Number.isSafeInteger(range.paragraphOrdinal) ||
      range.paragraphOrdinal < 0 ||
      (range.paragraphId !== undefined &&
        (typeof range.paragraphId !== "string" || !range.paragraphId.trim())) ||
      typeof range.paragraphXmlSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(range.paragraphXmlSha256) ||
      typeof range.sourceText !== "string" ||
      typeof range.start !== "number" ||
      typeof range.end !== "number" ||
      !Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      !range.sourceText ||
      range.sourceText.length > 10_000 ||
      range.end - range.start !== range.sourceText.length
    ) {
      return null;
    }
    ranges.push({
      end: range.end,
      ...(typeof range.paragraphId === "string"
        ? { paragraphId: range.paragraphId }
        : {}),
      paragraphOrdinal: range.paragraphOrdinal,
      paragraphXmlSha256: range.paragraphXmlSha256,
      part: "word/document.xml",
      sourceText: range.sourceText,
      start: range.start,
    });
  }
  return ranges;
}

function normalizeTemplateFieldValues(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, fieldValue]) => typeof fieldValue === "string"
    )
  ) as Record<string, string>;
}

function withInstanceTemplateTextStyles(
  designSchema: ConfirmationTemplateDesignSnapshot,
  incomingDesignSchema: unknown
) {
  if (
    !isRecord(incomingDesignSchema) ||
    !Array.isArray(incomingDesignSchema.fields)
  ) {
    return designSchema;
  }
  const incomingFields = new Map(
    incomingDesignSchema.fields
      .filter(
        (field): field is Record<string, unknown> =>
          isRecord(field) && typeof field.id === "string"
      )
      .map((field) => [field.id, field] as const)
  );
  return {
    ...designSchema,
    fields: designSchema.fields.map((field) => {
      const incomingField = incomingFields.get(field.id);
      const textStyle = parseConfirmationTemplateFieldTextStyle(
        incomingField?.textStyle,
        field.kind
      );
      return textStyle ? { ...field, textStyle } : field;
    }),
  };
}

function sanitizeCreatedTemplateDynamicFields(
  payload: unknown,
  designSchema: ConfirmationTemplateDesignSnapshot | null
) {
  const draft = isRecord(payload) ? { ...payload } : {};
  const allowedFieldIds = new Set(
    designSchema?.fields
      .filter((field) => field.kind !== "STATIC_TEXT" && field.kind !== "MASK")
      .map((field) => field.id) ?? []
  );
  draft.templateFieldValues = Object.fromEntries(
    Object.entries(
      normalizeTemplateFieldValues(draft.templateFieldValues)
    ).filter(([fieldId]) => allowedFieldIds.has(fieldId))
  );
  return draft;
}

function sanitizeSavedTemplateDynamicFields(
  payload: unknown,
  templateCode: ConfirmationDraftTemplateCode,
  storedPayload: unknown
) {
  const draft = isRecord(payload) ? { ...payload } : {};
  if (isConfirmationCustomTemplateCode(templateCode)) {
    const storedDesignSchema = isRecord(storedPayload)
      ? storedPayload.templateDesignSchema
      : null;
    const frozenDesignSchema =
      parseConfirmationTemplateDesign(storedDesignSchema);
    if (
      storedDesignSchema !== null &&
      storedDesignSchema !== undefined &&
      !frozenDesignSchema
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板设计无效，不能用于函证"
      );
    }
    if (frozenDesignSchema) {
      draft.templateDesignSchema = frozenDesignSchema;
      if (Object.hasOwn(draft, "templateFieldValues")) {
        const allowedFieldIds = new Set(
          frozenDesignSchema.fields
            .filter(
              (field) => field.kind !== "STATIC_TEXT" && field.kind !== "MASK"
            )
            .map((field) => field.id)
        );
        draft.templateFieldValues = Object.fromEntries(
          Object.entries(
            normalizeTemplateFieldValues(draft.templateFieldValues)
          ).filter(([fieldId]) => allowedFieldIds.has(fieldId))
        );
      }
    } else {
      delete draft.templateDesignSchema;
      delete draft.templateFieldValues;
    }
    const storedSource = isRecord(storedPayload)
      ? storedPayload.templateLibrarySource
      : null;
    if (isRecord(storedSource)) {
      draft.templateLibrarySource = { ...storedSource };
    } else {
      delete draft.templateLibrarySource;
    }
    return draft;
  }
  if (
    MANAGED_CONFIRMATION_TEMPLATE_CODES.some((code) => code === templateCode)
  ) {
    const storedDesignSchema = isRecord(storedPayload)
      ? storedPayload.templateDesignSchema
      : null;
    const frozenDesignSchema =
      parseConfirmationTemplateDesign(storedDesignSchema);
    if (
      storedDesignSchema !== null &&
      storedDesignSchema !== undefined &&
      !frozenDesignSchema
    ) {
      throw new ApiBadRequestException(
        "VALIDATION_FAILED",
        "该函证模板设计无效，不能用于函证"
      );
    }
    if (frozenDesignSchema) {
      draft.templateDesignSchema = frozenDesignSchema;
      if (Object.hasOwn(draft, "templateFieldValues")) {
        const allowedFieldIds = new Set(
          frozenDesignSchema.fields
            .filter(
              (field) => field.kind !== "STATIC_TEXT" && field.kind !== "MASK"
            )
            .map((field) => field.id)
        );
        draft.templateFieldValues = Object.fromEntries(
          Object.entries(
            normalizeTemplateFieldValues(draft.templateFieldValues)
          ).filter(([fieldId]) => allowedFieldIds.has(fieldId))
        );
      }
    } else {
      delete draft.templateDesignSchema;
      delete draft.templateFieldValues;
    }
    return draft;
  }

  if (
    LEGACY_CONFIRMATION_TEMPLATE_CODES.some((code) => code === templateCode)
  ) {
    delete draft.templateDesignSchema;
    delete draft.templateFieldValues;
  }
  return draft;
}

function withTemplateDesignSnapshot(
  payload: unknown,
  designSchema: ConfirmationTemplateDesignSnapshot | null,
  replaceDesignSchema: boolean,
  resetFieldValues: boolean
) {
  const draft = isRecord(payload) ? { ...payload } : {};
  if (replaceDesignSchema) {
    if (designSchema) {
      draft.templateDesignSchema = designSchema;
    } else {
      delete draft.templateDesignSchema;
    }
  } else if (designSchema) {
    draft.templateDesignSchema = withInstanceTemplateTextStyles(
      designSchema,
      draft.templateDesignSchema
    );
  }

  const hasFieldValues = Object.hasOwn(draft, "templateFieldValues");
  if (resetFieldValues || hasFieldValues) {
    draft.templateFieldValues = resetFieldValues
      ? {}
      : normalizeTemplateFieldValues(draft.templateFieldValues);
  }
  return draft;
}

function withTemplateSourceSnapshot(
  payload: unknown,
  source: CustomConfirmationTemplateSource | null,
  replaceSource: boolean
) {
  const draft = isRecord(payload) ? { ...payload } : {};
  if (source) {
    draft.templateLibrarySource = {
      code: source.code,
      fileName: source.fileName,
      objectKey: source.objectKey,
      mimeType: source.mimeType,
    };
  } else if (replaceSource) {
    delete draft.templateLibrarySource;
  }
  return draft;
}

function withTemplateAvailableCodes(
  payload: unknown,
  availableCodes: readonly ConfirmationDraftTemplateCode[]
) {
  const draft = isRecord(payload) ? { ...payload } : {};
  draft.templateAvailableCodes = [...availableCodes];
  return draft;
}

function createCustomTemplateDefinition(
  template: Pick<CustomConfirmationTemplateRecord, "code" | "confirmationType">
): ConfirmationTemplateDefinition {
  return {
    confirmationType: template.confirmationType,
    typeCode: "CUSTOM",
    rendererVersion: `custom-${template.code}`,
    requiredEditableFields: [],
    thirdPartyField:
      template.confirmationType === "BANK" ? "bankName" : "recipientName",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeProjectConfirmationDefaults<
  T extends {
    status?: unknown;
    draftPayload?: unknown | null;
    draftTemplateCode?: unknown;
  },
>(
  confirmation: T,
  defaults: ProjectConfirmationDefaultsRecord | null,
  fillExplicitlyBlankValues = false
): T {
  if (confirmation.status !== "DRAFT" || !defaults) {
    return confirmation;
  }
  const current = isRecord(confirmation.draftPayload)
    ? confirmation.draftPayload
    : {};
  const draftPayload = { ...current };
  const fill = (key: string, value: string | null) => {
    if (
      value &&
      (!Object.hasOwn(draftPayload, key) ||
        (fillExplicitlyBlankValues && isEmptyDraftValue(draftPayload[key])))
    ) {
      draftPayload[key] = value;
    }
  };

  fill("clientName", defaults.clientName);
  fill("officeDate", defaults.confirmationDate);
  const draftTemplateCode =
    typeof confirmation.draftTemplateCode === "string"
      ? confirmation.draftTemplateCode
      : null;
  const usesManagedTemplate =
    draftTemplateCode !== null &&
    isConfirmationTemplateAvailableForNewDrafts(
      draftTemplateCode as Parameters<
        typeof isConfirmationTemplateAvailableForNewDrafts
      >[0]
    );
  const hasReferenceBinding =
    parseConfirmationTemplateDesign(
      draftPayload.templateDesignSchema
    )?.fields.some((field) => field.binding === "referenceCode") ?? false;
  const normalizedDesign = parseConfirmationTemplateDesign(
    draftPayload.templateDesignSchema
  );
  const isBuiltInReferenceField = normalizedDesign?.fields.some(
    (field) =>
      field.binding === "referenceCode" &&
      (field.id === "confirmation-reference-code" ||
        field.id === "confirmation-securities-reference")
  );
  if (
    !usesManagedTemplate ||
    (hasReferenceBinding && !isBuiltInReferenceField)
  ) {
    fill("referenceCode", defaults.reference);
  }
  fill("picName", defaults.pic);
  fill("micName", defaults.mic);
  fill("micNameAndInitial", defaults.mic);
  fill("reportDate", defaults.reportDate);
  const customFields = defaults.baseInformation?.customFields ?? [];
  const fieldValues = isRecord(draftPayload.templateFieldValues)
    ? { ...draftPayload.templateFieldValues }
    : {};
  for (const field of normalizedDesign?.fields ?? []) {
    const binding = field.baseInformationBinding ?? field.binding;
    const custom = customFields.find((item) => `custom:${item.id}` === binding);
    if (custom && !Object.hasOwn(fieldValues, field.id)) {
      fieldValues[field.id] = custom.value;
    }
  }
  if (Object.keys(fieldValues).length) {
    draftPayload.templateFieldValues = fieldValues;
  }

  return {
    ...confirmation,
    draftPayload:
      Object.keys(draftPayload).length > 0
        ? draftPayload
        : confirmation.draftPayload,
  };
}

function isEmptyDraftValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  );
}

function normalizeProjectConfirmationDefault(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeProjectConfirmationBaseInformation(
  value: ProjectConfirmationBaseInformation | null | undefined
) {
  if (!value) {
    return null;
  }
  return {
    ...(value.customFields
      ? {
          customFields: value.customFields.map((field) => ({
            ...field,
            name: field.name.trim(),
          })),
        }
      : {}),
    clientNames: value.clientNames.map((item) => item.trim()).filter(Boolean),
    references: value.references.map((item) => item.trim()).filter(Boolean),
    banks: value.banks
      .map((bank) => ({
        name: bank.name.trim(),
        account: bank.account.trim(),
        address: bank.address.trim(),
      }))
      .filter((bank) => bank.name || bank.account || bank.address),
  } satisfies ProjectConfirmationBaseInformation;
}

function parseUploadedConfirmationSourceSnapshot(
  value: unknown
): UploadedConfirmationSourceSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.source !== "UPLOAD" ||
    typeof value.objectKey !== "string" ||
    typeof value.fileName !== "string" ||
    typeof value.mimeType !== "string" ||
    typeof value.size !== "number" ||
    typeof value.sha256 !== "string" ||
    typeof value.previewIsPdf !== "boolean" ||
    typeof value.previewMimeType !== "string"
  ) {
    return null;
  }
  return {
    source: "UPLOAD",
    objectKey: value.objectKey,
    fileName: value.fileName,
    mimeType: value.mimeType,
    size: value.size,
    sha256: value.sha256,
    previewIsPdf: value.previewIsPdf,
    previewMimeType: value.previewMimeType,
  };
}

function ensurePdfAttachmentFileName(fileName: string) {
  const normalized =
    normalizeUploadedFileName(fileName).trim() || "confirmation";
  if (normalized.toLowerCase().endsWith(".pdf")) {
    return normalized;
  }
  return `${normalized.replace(/\.[^./\\]*$/, "") || "confirmation"}.pdf`;
}

function isConfirmationStatus(value: unknown): value is ConfirmationStatus {
  return (
    value === "DRAFT" ||
    value === "PREPARED" ||
    value === "AWAITING_RESPONSE" ||
    value === "RESPONSE_RECEIVED" ||
    value === "CLOSED" ||
    value === "VOIDED"
  );
}

function isConfirmationDifferenceStatus(
  value: unknown
): value is ConfirmationDifferenceStatus {
  return (
    value === "MATCHED" ||
    value === "EXCEPTION" ||
    value === "PENDING_FOLLOW_UP" ||
    value === "NO_RESPONSE"
  );
}

function trackingSnapshotUpdate(
  snapshot: Tracking17TrackSnapshot | null
): Prisma.ProjectConfirmationDispatchUpdateInput {
  if (!snapshot) {
    return {};
  }
  const delivered = snapshot.status?.toLowerCase() === "delivered";
  return {
    trackingCarrierName: snapshot.carrierName,
    trackingStatus: snapshot.status,
    trackingSubstatus: snapshot.substatus,
    trackingDescription: snapshot.description,
    trackingLocation: snapshot.location,
    trackingEvents: snapshot.events as Prisma.InputJsonValue,
    trackingLastEventAt: snapshot.lastEventAt,
    trackingUpdatedAt: snapshot.retrievedAt,
    ...(delivered
      ? {
          executionStatus: "DELIVERED" as const,
          deliveredAt: snapshot.lastEventAt ?? snapshot.retrievedAt,
        }
      : {}),
  };
}

function hasConfirmationOfficeAccess(user: RequestUser) {
  return (
    user.globalRole === "CONFIRMATION_OFFICER" ||
    user.globalRole === "SUPER_ADMIN"
  );
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function getResponseIdFromPayload(
  payload: Prisma.JsonValue | null | undefined
) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }
  const { responseId } = payload as { responseId?: unknown };
  return typeof responseId === "string" ? responseId : null;
}

function getDraftString(
  draft: CreateProjectConfirmationInput["draftPayload"],
  key: string
) {
  const value = draft?.[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function isProjectConfirmationTypeSequenceConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }
  const fields = new Set(target.map(String));
  return (
    (fields.has("projectId") &&
      fields.has("type") &&
      fields.has("typeSequence")) ||
    (fields.has("project_id") &&
      fields.has("type") &&
      fields.has("type_sequence"))
  );
}

function isRedispatchReservationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function parseOptionalDate(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid date");
  }
  return date;
}

function parseRequiredDate(value: string) {
  const date = parseOptionalDate(value);
  if (!date) {
    throw new ApiBadRequestException("VALIDATION_FAILED", "Invalid date");
  }
  return date;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
