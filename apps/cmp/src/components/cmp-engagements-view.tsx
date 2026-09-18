"use client";

import {
  CmpAcceptanceEngagementDraftPayloadSchema,
  CMP_BUDGET_CURRENCIES,
  CMP_BUDGET_CURRENCY_LABELS,
  CreateCmpEngagementSchema,
  getCmpFixedBudgetExchangeRate,
} from "@project-wing/shared";
import type {
  CmpAcceptanceEngagementDraftPayload,
  CmpAcceptanceDraftListItem,
  CreateCmpAcceptanceRequestInput,
  CmpClient,
  CmpEngagement,
  CmpBudgetCurrency,
  CmpBudgetExchangeRateSnapshot,
  CmpEngagementDeliverable,
  CmpEngagementServiceType,
  CmpEngagementStatus,
  CmpSelectableEngagementServiceType,
  CreateCmpEngagementInput,
  TmsEngagementSummary,
} from "@project-wing/shared";
import {
  Badge,
  Button,
  ButtonGroup,
  Checkbox,
  Frame,
  FramePanel,
  Input,
  MemberDirectoryCompactIdentity,
  MotionButton,
  StatefulMotionButton,
} from "@project-wing/ui";
import type { MotionButtonState } from "@project-wing/ui";
import { ArrowRight, Check, List, Plus, UsersRound, X } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { CurrentUser, DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import { openCmpRecordPreviewWindow } from "../lib/open-cmp-record-preview-window";
import {
  AcceptanceFormAccordionSection,
  AcceptanceFormPreviewNavigationItem,
  AcceptanceFormSectionContent,
} from "./acceptance-form-accordion-section";
import type { AcceptanceFormAccordionStatusCopy } from "./acceptance-form-accordion-section";
import {
  AcceptanceFormHeader,
  AcceptanceFormWorkspace,
} from "./acceptance-form-workspace";
import { ClientFormMemberActionDialog } from "./client-form-member-action-dialog";
import {
  CmpAsyncActionFeedback,
  useCmpAsyncActionFeedback,
} from "./cmp-async-action-feedback";
import {
  CMP_DATA_GRID_TOOLBAR_ACTION_CLASS,
  CmpDataGridToolbar,
} from "./cmp-data-grid-toolbar";
import { CmpDraftExitDialog } from "./cmp-draft-exit-dialog";
import { CmpEngagementAssociations } from "./cmp-engagement-associations";
import { CmpEngagementClientGroups } from "./cmp-engagement-client-groups";
import type { CmpEngagementClientGroup } from "./cmp-engagement-client-groups";
import {
  EngagementDeliverablesField,
  formatEngagementDeliverables,
} from "./cmp-engagement-deliverables";
import {
  CmpEngagementFeePlanningSummary,
  CmpEngagementFeePlanningTable,
  deriveFeePlanningBudget,
  feePlanningLinesForDraft,
  feePlanningLinesForSubmission,
  feePlanningLinesFromEngagement,
  recalculateFeePlanningRates,
} from "./cmp-engagement-fee-planning-table";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-table";
import {
  DEFAULT_ENGAGEMENT_IMPORT_SECTIONS,
  includesEngagementImportSection,
} from "./cmp-engagement-import-sections";
import type { EngagementImportSection } from "./cmp-engagement-import-sections";
import { CmpEngagementRiskSelector } from "./cmp-engagement-risk-selector";
import { CmpEngagementsDataGrid } from "./cmp-engagements-data-grid";
import { FormReviewPage, SearchSelect } from "./cmp-form-controls";
import type {
  CmpFormSectionStatus,
  FormWizardStep,
  ReviewSection,
} from "./cmp-form-controls";
import { CmpFormDraftDeleteAction } from "./cmp-form-draft-delete-action";
import { CmpTmsSummary } from "./cmp-tms-summary";
import {
  focusFirstInvalidField,
  schemaIssuesToErrors,
  validationErrorId,
} from "./form-validation";
import { Accordion } from "./ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";

type EngagementFormState = {
  draftName: string;
  clientId: string;
  engagementCode: string;
  serviceType: CmpEngagementServiceType | "";
  otherServiceDescription: string;
  deliverables: CmpEngagementDeliverable[];
  yearEndDate: string;
  reportDate: string;
  engagementDate: string;
  budgetedHours: string;
  agreedFee: string;
  recoveryRate: string;
  feePlanningLines: CmpFeePlanningFormLine[];
  feeCurrency: CmpBudgetCurrency;
  feeExchangeRateSnapshotId: string;
  feeExchangeRateHkdPerUnit: string;
  feeExchangeRateSource: "SYSTEM" | "MANUAL";
  amlRiskClassification: "HIGH" | "NOT_HIGH";
  engagementRiskClassification: "NORMAL" | "GREATER_THAN_NORMAL";
  picUserId: string;
  micUserId: string;
  eqReviewerUserId: string;
  pic: string;
  mic: string;
  eqReviewer: string;
  status: CmpEngagementStatus;
  remarks: string;
  micApproverId: string;
  picApproverId: string;
  itApproverId: string;
  draftAssigneeId: string;
};

type EngagementFilters = {
  clientCode: string;
  clientName: string;
  engagementCode: string;
  serviceType: string;
  status: string;
  pic: string;
  mic: string;
  keyword: string;
};

type EngagementFormErrors = Partial<
  Record<keyof EngagementFormState | "feePlanningLines", string>
>;

type ClientPrefillOptions = {
  yearEndDate: boolean;
  service: boolean;
  pic: boolean;
  mic: boolean;
  sourceService: boolean;
  sourceDeliverables: boolean;
  sourceDates: boolean;
  sourceCommercial: boolean;
  sourceRisk: boolean;
  sourceResponsible: boolean;
  sourceNotes: boolean;
};

const EMPTY_CLIENT_PREFILL_OPTIONS: ClientPrefillOptions = {
  yearEndDate: false,
  service: false,
  pic: false,
  mic: false,
  sourceService: false,
  sourceDeliverables: false,
  sourceDates: false,
  sourceCommercial: false,
  sourceRisk: false,
  sourceResponsible: false,
  sourceNotes: false,
};

type EngagementFormSectionId = "setup" | "commercial" | "notes";

const _ENGAGEMENT_FORM_SECTION_ORDER: EngagementFormSectionId[] = [
  "setup",
  "commercial",
  "notes",
];
const AUTO_SAVE_DELAY_MS = 500;

type EngagementFormWizardStepId = EngagementFormSectionId | "review";

const ENGAGEMENT_SECTION_ERROR_KEYS: Record<
  EngagementFormSectionId,
  (keyof EngagementFormState)[]
> = {
  setup: [
    "clientId",
    "engagementCode",
    "serviceType",
    "otherServiceDescription",
    "engagementDate",
    "yearEndDate",
    "reportDate",
    "amlRiskClassification",
    "engagementRiskClassification",
    "picUserId",
    "micUserId",
    "eqReviewerUserId",
  ],
  commercial: [
    "budgetedHours",
    "agreedFee",
    "feeExchangeRateHkdPerUnit",
    "recoveryRate",
    "feePlanningLines",
  ],
  notes: ["status", "remarks"],
};
const SERVICE_TYPES: {
  value: CmpSelectableEngagementServiceType;
  label: string;
}[] = [
  { value: "ANNUAL_AUDIT", label: "Annual Audit" },
  { value: "REVIEW", label: "Review" },
  {
    value: "SPECIAL_AUDIT_PRIVATE_CO",
    label: "Special audit for private co. (with audit opinion issued)",
  },
  { value: "OTHERS", label: "Others" },
];
const STATUSES: { value: CmpEngagementStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];
const EMPTY_FILTERS: EngagementFilters = {
  clientCode: "",
  clientName: "",
  engagementCode: "",
  serviceType: "",
  status: "",
  pic: "",
  mic: "",
  keyword: "",
};
const EMPTY_CMP_DRAFTS: CmpAcceptanceDraftListItem[] = [];
const NOOP_DELETE_DRAFT = async (_id: string) => {};
const EMPTY_FORM: EngagementFormState = {
  draftName: "",
  clientId: "",
  engagementCode: "",
  serviceType: "",
  otherServiceDescription: "",
  deliverables: [],
  yearEndDate: "",
  reportDate: "",
  engagementDate: "",
  budgetedHours: "",
  agreedFee: "",
  recoveryRate: "",
  feePlanningLines: [],
  feeCurrency: "HKD",
  feeExchangeRateSnapshotId: "",
  feeExchangeRateHkdPerUnit: "1.00000000",
  feeExchangeRateSource: "SYSTEM",
  amlRiskClassification: "NOT_HIGH",
  engagementRiskClassification: "NORMAL",
  picUserId: "",
  micUserId: "",
  eqReviewerUserId: "",
  pic: "",
  mic: "",
  eqReviewer: "",
  status: "ACTIVE",
  remarks: "",
  micApproverId: "",
  picApproverId: "",
  itApproverId: "",
  draftAssigneeId: "",
};

function hasEngagementTextValue(...values: (string | null | undefined)[]) {
  return values.some((value) => Boolean(value?.trim()));
}

function hasEngagementSectionContent(
  form: EngagementFormState,
  sectionId: EngagementFormSectionId
) {
  switch (sectionId) {
    case "setup": {
      return (
        hasEngagementTextValue(
          form.engagementCode,
          form.otherServiceDescription,
          form.engagementDate,
          form.yearEndDate,
          form.reportDate
        ) ||
        form.serviceType !== EMPTY_FORM.serviceType ||
        form.deliverables.length > 0 ||
        hasEngagementTextValue(
          form.picUserId,
          form.micUserId,
          form.eqReviewerUserId
        )
      );
    }
    case "commercial": {
      return (
        hasEngagementTextValue(form.agreedFee) ||
        form.feePlanningLines.some((line) =>
          Boolean(
            line.grade ||
            line.assignmentType ||
            line.budgetHours ||
            line.dateFrom ||
            line.dateTo
          )
        )
      );
    }
    case "notes": {
      return hasEngagementTextValue(form.remarks);
    }
    default: {
      return false;
    }
  }
}

const EMPTY_ARRAY: never[] = [];

function omitFormError<T extends object>(value: T, key: string): T {
  const { [key]: _removed, ...remaining } = value as Record<string, unknown>;
  return remaining as T;
}

export function CmpEngagementsView({
  clients,
  engagements,
  users = EMPTY_ARRAY,
  exchangeRates = EMPTY_ARRAY,
  currentUser,
  isCreating,
  onSubmitEngagementAcceptance,
  searchValue,
  initialClientId,
  initialSourceEngagement,
  initialImportSections = DEFAULT_ENGAGEMENT_IMPORT_SECTIONS,
  initialGroupedClientId,
  initialView = "list",
  tmsSummary,
  isTmsSummaryLoading,
  onEditingEngagementIdChange,
  onCreateEngagement,
  onEditEngagement,
  onOpenFeeNote,
  formPageMode = false,
  initialFormMode,
  initialEngagementId,
  initialValidateOnOpen = false,
  onFormClose,
  onFormDirtyChange,
  hasPersistedDraft = false,
  isDeletingDraft = false,
  onDeleteDraft,
  archiveCount = 0,
  drafts = EMPTY_CMP_DRAFTS,
  onDeleteListedDraft = NOOP_DELETE_DRAFT,
}: {
  clients: CmpClient[];
  engagements: CmpEngagement[];
  users?: DirectoryUser[];
  exchangeRates?: CmpBudgetExchangeRateSnapshot[];
  currentUser?: CurrentUser;
  isCreating?: boolean;
  searchValue?: string;
  initialClientId?: string;
  initialSourceEngagement?: CmpEngagement;
  initialImportSections?: EngagementImportSection[];
  initialGroupedClientId?: string;
  initialView?: "list" | "client";
  tmsSummary?: TmsEngagementSummary | null;
  isTmsSummaryLoading?: boolean;
  onEditingEngagementIdChange?: (id: string | null) => void;
  onCreateEngagement?: (clientId?: string) => void;
  onEditEngagement?: (engagement: CmpEngagement) => void;
  onOpenFeeNote?: (engagement: CmpEngagement) => void;
  formPageMode?: boolean;
  initialFormMode?: "create" | "edit";
  initialEngagementId?: string;
  initialValidateOnOpen?: boolean;
  onFormClose?: (reason: "cancelled" | "submitted") => void;
  onFormDirtyChange?: (isDirty: boolean) => void;
  hasPersistedDraft?: boolean;
  isDeletingDraft?: boolean;
  onDeleteDraft?: () => Promise<unknown>;
  archiveCount?: number;
  drafts?: CmpAcceptanceDraftListItem[];
  onDeleteListedDraft?: (id: string) => Promise<unknown>;
  onSubmitEngagementAcceptance: (
    input: CreateCmpAcceptanceRequestInput
  ) => Promise<unknown>;
}) {
  const { dictionary, locale, localizedPath } = useCmpI18n();
  // The source-selection flow is deliberately rendered as a page workspace.
  // Keep the legacy dialog branch disabled while existing embedded callers move
  // to the same workspace route.
  const legacyClientPrefillDialogEnabled = false;
  const copy = dictionary.workspace;
  const accordionStatusCopy: AcceptanceFormAccordionStatusCopy = {
    complete: copy.formComplete,
    error: copy.formHasErrors,
    incomplete: copy.formIncomplete,
    notStarted: copy.formNotStarted,
  };
  const serviceTypeLabels: Record<CmpEngagementServiceType, string> = {
    ACCOUNTING: copy.serviceTypeAccounting,
    ANNUAL_AUDIT: copy.serviceTypeAnnualAudit,
    AUDIT: copy.serviceTypeAudit,
    COM_SEC: copy.serviceTypeComSec,
    REVIEW: copy.serviceTypeReview,
    RISK: copy.serviceTypeRisk,
    SPECIAL_AUDIT_PRIVATE_CO: copy.serviceTypeSpecialAudit,
    TAX: copy.serviceTypeTax,
    OTHERS: copy.serviceTypeOthers,
  };
  const statusLabels: Record<CmpEngagementStatus, string> = {
    ACTIVE: copy.clientStatusActive,
    INACTIVE: copy.clientStatusInactive,
    COMPLETED: copy.engagementStatusCompleted,
    ARCHIVED: copy.engagementStatusArchived,
  };
  const canCreateAcceptance =
    !currentUser || ["MANAGER", "PARTNER"].includes(currentUser.globalRole);
  const canCreateChange =
    !currentUser || ["MANAGER", "PARTNER"].includes(currentUser.globalRole);
  const isPartnerInitiator = currentUser?.globalRole === "PARTNER";
  const [filters, setFilters] = useState<EngagementFilters>(EMPTY_FILTERS);
  void setFilters;
  const [displayMode, setDisplayMode] = useState<"list" | "client">(
    initialView
  );
  const [groupTargetClientId, setGroupTargetClientId] = useState<
    string | undefined
  >(initialView === "client" ? initialGroupedClientId : undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientPrefillId, setClientPrefillId] = useState<string | null>(null);
  const [clientPrefillSourceEngagementId, setClientPrefillSourceEngagementId] =
    useState("");
  const [clientPrefillOptions, setClientPrefillOptions] =
    useState<ClientPrefillOptions>({
      yearEndDate: false,
      service: false,
      pic: true,
      mic: true,
      sourceService: true,
      sourceDeliverables: true,
      sourceDates: true,
      sourceCommercial: true,
      sourceRisk: true,
      sourceResponsible: true,
      sourceNotes: true,
    });
  const [form, setForm] = useState<EngagementFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<EngagementFormErrors>({});
  const serviceTypeError =
    formErrors.serviceType === "Invalid input"
      ? copy.engagementSelectCurrentServiceType
      : formErrors.serviceType;
  const [activeFormSectionId, setActiveFormSectionId] =
    useState<EngagementFormWizardStepId>("setup");
  const [openFormSectionIds, setOpenFormSectionIds] = useState<string[]>([
    "setup",
  ]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [memberActionDialog, setMemberActionDialog] = useState<
    "assign" | "submit" | null
  >(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<
    "Loading" | "Saved" | "Saving" | "Error"
  >("Loading");
  const [failedAction, setFailedAction] = useState<
    "draft" | "assign" | "submit" | null
  >(null);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [draftNameError, setDraftNameError] = useState<string | null>(null);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const workspaceContentRef = useRef<HTMLElement>(null);
  const [cleanSnapshot, setCleanSnapshot] = useState(
    JSON.stringify(EMPTY_FORM)
  );
  const didOpenInitialClient = useRef(false);
  const autoSaveInitializedRef = useRef(false);
  const draftSaveRequestRef = useRef(0);
  const failedAutoSaveSnapshotRef = useRef<string | null>(null);
  const actionFeedback = useCmpAsyncActionFeedback();
  const currentSnapshot = JSON.stringify(form);
  const isFormDirty = currentSnapshot !== cleanSnapshot;
  const hasDraftName = Boolean(form.draftName.trim());
  const usesAutoSave = formPageMode && hasDraftName;
  const isDraftSaving = usesAutoSave
    ? draftSaveState === "Loading" || draftSaveState === "Saving"
    : actionFeedback.isRunningFor("draft");
  const isDraftSaved = usesAutoSave
    ? draftSaveState === "Saved" && !isFormDirty
    : Boolean(savedAt && !isFormDirty && !isDraftSaving);
  const saveButtonState: MotionButtonState = isDraftSaving
    ? "loading"
    : usesAutoSave && draftSaveState === "Error"
      ? "error"
      : !usesAutoSave && failedAction === "draft"
        ? "error"
        : isDraftSaved
          ? "success"
          : "idle";
  const saveLabel = isDraftSaving
    ? usesAutoSave
      ? copy.formSaveStateSaving
      : copy.formSaving
    : usesAutoSave && draftSaveState === "Error"
      ? copy.retry
      : !usesAutoSave && failedAction === "draft"
        ? copy.retry
        : isDraftSaved && !isSaveHovered
          ? copy.formSaved
          : copy.formSave;

  useEffect(() => {
    onFormDirtyChange?.(isFormDirty);
  }, [isFormDirty, onFormDirtyChange]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((left, right) =>
        left.clientCode.localeCompare(right.clientCode)
      ),
    [clients]
  );
  const approverOptions = useMemo(
    () =>
      users
        .filter(
          (user) => user.status !== "INACTIVE" && user.status !== "DISABLED"
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );
  const micApproverOptions = useMemo(
    () =>
      approverOptions.filter((user) => ["MANAGER"].includes(user.globalRole)),
    [approverOptions]
  );
  const picApproverOptions = useMemo(
    () =>
      approverOptions.filter((user) =>
        ["PARTNER", "PRINCIPAL"].includes(user.globalRole)
      ),
    [approverOptions]
  );
  const eqReviewerOptions = useMemo(
    () => approverOptions.filter((user) => user.globalRole === "EQCR"),
    [approverOptions]
  );
  const itApproverOptions = useMemo(
    () => approverOptions.filter((user) => user.globalRole === "SUPER_ADMIN"),
    [approverOptions]
  );
  const staffOptions = useMemo(
    () =>
      approverOptions.filter((user) =>
        ["SENIOR", "STAFF", "ASSISTANT"].includes(user.globalRole)
      ),
    [approverOptions]
  );
  const filteredEngagements = useMemo(() => {
    const pageSearch = searchValue?.trim().toLowerCase() ?? "";
    const normalized = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [
        key,
        value.trim().toLowerCase(),
      ])
    ) as EngagementFilters;
    return engagements.filter((engagement) => {
      const keywordValues = [
        engagement.engagementCode,
        engagement.client.clientCode,
        engagement.client.nameZh,
        engagement.client.nameEn,
        engagement.approvalReferenceNumber,
        engagement.pic,
        engagement.mic,
        engagement.remarks,
      ];
      return (
        includesText(engagement.client.clientCode, normalized.clientCode) &&
        includesText(
          `${engagement.client.nameZh} ${engagement.client.nameEn ?? ""}`,
          normalized.clientName
        ) &&
        includesText(engagement.engagementCode, normalized.engagementCode) &&
        (!normalized.serviceType ||
          engagement.serviceType.toLowerCase() === normalized.serviceType) &&
        (!normalized.status ||
          engagement.status.toLowerCase() === normalized.status) &&
        includesText(engagement.pic, normalized.pic) &&
        includesText(engagement.mic, normalized.mic) &&
        (!pageSearch ||
          keywordValues
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(pageSearch)
            )) &&
        (!normalized.keyword ||
          keywordValues
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(normalized.keyword)
            ))
      );
    });
  }, [engagements, filters, searchValue]);

  const engagementResultsKey = filteredEngagements
    .map((engagement) => engagement.id)
    .join(",");
  const engagementClientGroups = useMemo<CmpEngagementClientGroup[]>(() => {
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const grouped = new Map<string, CmpEngagement[]>();
    for (const engagement of filteredEngagements) {
      const current = grouped.get(engagement.clientId) ?? [];
      current.push(engagement);
      grouped.set(engagement.clientId, current);
    }
    if (groupTargetClientId && !grouped.has(groupTargetClientId)) {
      grouped.set(groupTargetClientId, []);
    }
    return [...grouped.entries()]
      .flatMap(([clientId, clientEngagements]) => {
        const client = clientById.get(clientId);
        if (!client) {
          return [];
        }
        return [
          {
            client,
            engagements: [...clientEngagements].sort(
              (left, right) =>
                left.status.localeCompare(right.status) ||
                left.engagementCode.localeCompare(right.engagementCode)
            ),
          },
        ];
      })
      .sort((left, right) =>
        left.client.clientCode.localeCompare(right.client.clientCode)
      );
  }, [clients, filteredEngagements, groupTargetClientId]);
  const editingEngagement = editingId
    ? (engagements.find((engagement) => engagement.id === editingId) ?? null)
    : null;
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const isSourceClientLocked = Boolean(
    formPageMode && initialFormMode === "create" && initialSourceEngagement
  );

  const clientPrefillClient = clientPrefillId
    ? (clients.find((client) => client.id === clientPrefillId) ?? null)
    : null;
  const clientPrefillService = clientPrefillClient
    ? deriveEngagementServicePrefill(clientPrefillClient)
    : null;
  const clientPrefillSourceEngagements = useMemo(
    () =>
      clientPrefillClient
        ? engagements
            .filter(
              (engagement) => engagement.clientId === clientPrefillClient.id
            )
            .sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt)
            )
        : [],
    [clientPrefillClient, engagements]
  );
  const clientPrefillSourceEngagement =
    clientPrefillSourceEngagements.find(
      (engagement) => engagement.id === clientPrefillSourceEngagementId
    ) ?? null;

  function initializeCreateForm(
    clientId = "",
    options: ClientPrefillOptions = {
      yearEndDate: false,
      service: false,
      pic: true,
      mic: true,
      sourceService: true,
      sourceDeliverables: true,
      sourceDates: true,
      sourceCommercial: true,
      sourceRisk: true,
      sourceResponsible: true,
      sourceNotes: true,
    },
    sourceEngagement: CmpEngagement | null = null
  ) {
    onEditingEngagementIdChange?.(null);
    const client = clients.find((item) => item.id === clientId);
    const inheritedPic = picApproverOptions.find(
      (user) =>
        user.id === client?.clientPartnerPicId ||
        (!client?.clientPartnerPicId && user.name === client?.clientPartnerPic)
    );
    const inheritedMic = micApproverOptions.find(
      (user) =>
        user.id === client?.clientManagerMicId ||
        (!client?.clientManagerMicId && user.name === client?.clientManagerMic)
    );
    const servicePrefill = client
      ? deriveEngagementServicePrefill(client)
      : null;
    const inheritFromSource =
      sourceEngagement?.clientId === client?.id ? sourceEngagement : null;
    const sourceServicePrefill = inheritFromSource
      ? selectableServicePrefill(
          inheritFromSource.serviceType,
          inheritFromSource.otherServiceDescription
        )
      : null;
    const nextForm: EngagementFormState = {
      ...EMPTY_FORM,
      clientId: client?.id ?? "",
      yearEndDate:
        inheritFromSource && options.sourceDates
          ? (inheritFromSource.yearEndDate ?? "")
          : options.yearEndDate
            ? (client?.yearEndDate ?? "")
            : "",
      reportDate:
        inheritFromSource && options.sourceDates
          ? (inheritFromSource.reportDate ?? "")
          : "",
      engagementDate:
        inheritFromSource && options.sourceDates
          ? (inheritFromSource.engagementDate ?? "")
          : "",
      serviceType:
        inheritFromSource && options.sourceService
          ? (sourceServicePrefill?.serviceType ?? "")
          : options.service
            ? (servicePrefill?.serviceType ?? "")
            : "",
      otherServiceDescription:
        inheritFromSource && options.sourceService
          ? sourceServicePrefill?.serviceType === "OTHERS"
            ? sourceServicePrefill.description
            : ""
          : options.service && servicePrefill?.serviceType === "OTHERS"
            ? servicePrefill.description
            : "",
      deliverables:
        inheritFromSource && options.sourceDeliverables
          ? cloneDeliverables(inheritFromSource.deliverables)
          : [],
      budgetedHours:
        inheritFromSource && options.sourceCommercial
          ? inheritFromSource.budgetedHours
          : "",
      agreedFee:
        inheritFromSource && options.sourceCommercial
          ? inheritFromSource.agreedFee
          : "",
      recoveryRate:
        inheritFromSource && options.sourceCommercial
          ? (inheritFromSource.recoveryRate ?? "")
          : "",
      feePlanningLines:
        inheritFromSource && options.sourceCommercial
          ? feePlanningLinesFromEngagement(inheritFromSource.feePlanningLines)
          : [],
      feeCurrency:
        inheritFromSource && options.sourceCommercial
          ? inheritFromSource.feeCurrency
          : "HKD",
      feeExchangeRateSnapshotId:
        inheritFromSource && options.sourceCommercial
          ? (inheritFromSource.feeExchangeRateSnapshot?.id ?? "")
          : "",
      amlRiskClassification:
        inheritFromSource && options.sourceRisk
          ? inheritFromSource.amlRiskClassification
          : "NOT_HIGH",
      engagementRiskClassification:
        inheritFromSource && options.sourceRisk
          ? inheritFromSource.engagementRiskClassification
          : "NORMAL",
      picUserId:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.picUserId ?? "")
          : options.pic
            ? (client?.clientPartnerPicId ?? inheritedPic?.id ?? "")
            : "",
      pic:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.pic ?? "")
          : options.pic
            ? (client?.clientPartnerPic ?? inheritedPic?.name ?? "")
            : "",
      micUserId:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.micUserId ?? "")
          : options.mic
            ? (client?.clientManagerMicId ?? inheritedMic?.id ?? "")
            : "",
      mic:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.mic ?? "")
          : options.mic
            ? (client?.clientManagerMic ?? inheritedMic?.name ?? "")
            : "",
      eqReviewerUserId:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.eqReviewerUserId ?? "")
          : "",
      eqReviewer:
        inheritFromSource && options.sourceResponsible
          ? (inheritFromSource.eqReviewer ?? "")
          : "",
      remarks:
        inheritFromSource && options.sourceNotes
          ? (inheritFromSource.remarks ?? "")
          : "",
      micApproverId: micApproverOptions[0]?.id ?? "",
      picApproverId: picApproverOptions[0]?.id ?? "",
      itApproverId: itApproverOptions[0]?.id ?? "",
    };
    setEditingId(null);
    setForm(nextForm);
    setCleanSnapshot(JSON.stringify(nextForm));
    setFormErrors({});
    setActiveFormSectionId("setup");
    setSavedAt(null);
    setDraftSaveState("Saved");
    autoSaveInitializedRef.current = false;
    setIsFormOpen(true);
  }

  function openCreateForm(
    clientId = "",
    sourceEngagement?: CmpEngagement,
    importSections = DEFAULT_ENGAGEMENT_IMPORT_SECTIONS
  ) {
    if (onCreateEngagement) {
      onCreateEngagement(clientId);
      return;
    }
    if (sourceEngagement) {
      initializeCreateForm(
        clientId,
        prefillOptionsFromImportSections(
          EMPTY_CLIENT_PREFILL_OPTIONS,
          importSections
        ),
        sourceEngagement
      );
      return;
    }
    if (clientId && clients.some((client) => client.id === clientId)) {
      const client = clients.find((item) => item.id === clientId)!;
      setClientPrefillOptions(defaultClientPrefillOptions(client));
      setClientPrefillSourceEngagementId("");
      setClientPrefillId(clientId);
      return;
    }
    initializeCreateForm();
  }

  function confirmClientPrefill() {
    if (!clientPrefillClient) {
      setClientPrefillId(null);
      initializeCreateForm();
      return;
    }
    const clientId = clientPrefillClient.id;
    const options = clientPrefillOptions;
    const sourceEngagement = clientPrefillSourceEngagement;
    setClientPrefillId(null);
    setClientPrefillSourceEngagementId("");
    initializeCreateForm(clientId, options, sourceEngagement);
  }

  function chooseAnotherClient() {
    setClientPrefillId(null);
    setClientPrefillSourceEngagementId("");
    initializeCreateForm();
  }

  function openEditForm(engagement: CmpEngagement) {
    if (onEditEngagement) {
      onEditEngagement(engagement);
      return;
    }
    onEditingEngagementIdChange?.(engagement.id);
    setEditingId(engagement.id);
    const nextForm = {
      ...formFromEngagement(engagement),
      micApproverId: micApproverOptions[0]?.id ?? "",
      picApproverId: picApproverOptions[0]?.id ?? "",
      itApproverId: itApproverOptions[0]?.id ?? "",
    };
    setForm(nextForm);
    setCleanSnapshot(JSON.stringify(nextForm));
    setFormErrors({});
    setActiveFormSectionId("setup");
    setSavedAt(null);
    setDraftSaveState("Saved");
    autoSaveInitializedRef.current = false;
    setIsFormOpen(true);
  }

  const openCreateFormEvent = useEffectEvent(openCreateForm);
  const openEditFormEvent = useEffectEvent(openEditForm);

  function closeForm(
    force = false,
    reason: "cancelled" | "submitted" = "cancelled"
  ) {
    if (!force && (isCreating || actionFeedback.isRunning)) {
      return;
    }
    if (!force && JSON.stringify(form) !== cleanSnapshot) {
      setIsExitDialogOpen(true);
      return;
    }
    onEditingEngagementIdChange?.(null);
    setIsFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setActiveFormSectionId("setup");
    autoSaveInitializedRef.current = false;
    onFormDirtyChange?.(false);
    onFormClose?.(reason);
  }

  const engagementSections: {
    id: EngagementFormSectionId;
    label: string;
  }[] = useMemo(
    () => [
      { id: "setup", label: copy.engagementSetup },
      { id: "commercial", label: copy.engagementCommercialPlanning },
      { id: "notes", label: copy.engagementStatusAndRemarks },
    ],
    [
      copy.engagementCommercialPlanning,
      copy.engagementSetup,
      copy.engagementStatusAndRemarks,
    ]
  );

  useEffect(() => {
    if (formPageMode && initialFormMode) {
      if (didOpenInitialClient.current) {
        return;
      }
      if (initialFormMode === "edit") {
        const engagement = engagements.find(
          (item) => item.id === initialEngagementId
        );
        if (!engagement) {
          return;
        }
        didOpenInitialClient.current = true;
        openEditFormEvent(engagement);
        if (initialValidateOnOpen) {
          const validation = validateEngagementForm(
            formFromEngagement(engagement),
            clients.find((client) => client.id === engagement.clientId)
          );
          setFormErrors(validation);
          const firstSection = engagementSections.find((section) =>
            ENGAGEMENT_SECTION_ERROR_KEYS[section.id].some((field) =>
              Boolean(validation[field])
            )
          );
          setActiveFormSectionId(firstSection?.id ?? "setup");
          requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
        }
        return;
      }
      if (
        initialFormMode === "create" &&
        (!initialClientId ||
          clients.some((client) => client.id === initialClientId))
      ) {
        didOpenInitialClient.current = true;
        openCreateFormEvent(
          initialClientId ?? "",
          initialSourceEngagement,
          initialImportSections
        );
      }
      return;
    }
    if (
      didOpenInitialClient.current ||
      !initialClientId ||
      !clients.some((client) => client.id === initialClientId)
    ) {
      return;
    }
    didOpenInitialClient.current = true;
    openCreateFormEvent(initialClientId);
  }, [
    clients,
    engagements,
    formPageMode,
    initialEngagementId,
    initialFormMode,
    initialClientId,
    initialImportSections,
    initialSourceEngagement,
    initialValidateOnOpen,
    engagementSections,
  ]);

  function submitRequest(
    action: "draft" | "assign" | "submit",
    formToSubmit: EngagementFormState = form
  ): Promise<unknown> {
    if (action === "draft" && formPageMode && !formToSubmit.draftName.trim()) {
      setDraftNameError(
        locale === "zh-CN" ? "请先填写草稿名称。" : "Enter a draft name first."
      );
      return Promise.reject(new Error("Draft name is required"));
    }
    const validation =
      action === "submit"
        ? validateEngagementForm(formToSubmit, selectedClient)
        : validateEngagementDraft(formToSubmit);
    setFormErrors(validation);
    if (Object.keys(validation).length) {
      const firstSectionWithError = engagementSections.find((section) =>
        ENGAGEMENT_SECTION_ERROR_KEYS[section.id].some((field) =>
          Boolean(validation[field])
        )
      );
      setActiveFormSectionId(firstSectionWithError?.id ?? "setup");
      window.setTimeout(() => focusFirstInvalidField(formRef.current), 0);
      return Promise.reject(new Error("Engagement form validation failed"));
    }
    const isAutoSave = action === "draft" && usesAutoSave;
    const submittedSnapshot = JSON.stringify(formToSubmit);
    const draftSaveRequestId = isAutoSave ? draftSaveRequestRef.current : null;
    if (isAutoSave) {
      setDraftSaveState("Saving");
    }
    const operation = () =>
      onSubmitEngagementAcceptance({
        type: editingId ? "ENGAGEMENT_CHANGE" : "ENGAGEMENT",
        targetEngagementId: editingId ?? undefined,
        engagementPayload:
          action === "submit"
            ? buildCreatePayload(formToSubmit)
            : buildEngagementDraftPayload(formToSubmit),
        draftAssigneeId:
          action === "submit"
            ? undefined
            : formToSubmit.draftAssigneeId || undefined,
        micApproverId: formToSubmit.micUserId || undefined,
        draftName:
          action === "submit" ? undefined : formToSubmit.draftName.trim(),
        submit: action === "submit",
      });
    const submission = isAutoSave
      ? operation()
      : actionFeedback.run(
          {
            actionKey: action,
            pendingLabel:
              action === "assign"
                ? copy.assigningDraft
                : action === "submit"
                  ? copy.formSubmitting
                  : copy.formSaving,
            successLabel:
              action === "assign"
                ? copy.toastDraftAssigned
                : action === "submit"
                  ? copy.formSubmitSuccess
                  : copy.formSaved,
          },
          operation
        );
    return Promise.resolve(submission)
      .then(() => {
        if (
          draftSaveRequestId !== null &&
          draftSaveRequestId !== draftSaveRequestRef.current
        ) {
          setDraftSaveState("Saved");
          return;
        }
        setFailedAction(null);
        if (action === "submit") {
          closeForm(true, "submitted");
          return;
        }
        setCleanSnapshot(submittedSnapshot);
        failedAutoSaveSnapshotRef.current = null;
        setSavedAt(
          new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date())
        );
        if (isAutoSave) {
          setDraftSaveState("Saved");
        }
      })
      .catch(() => {
        if (
          draftSaveRequestId !== null &&
          draftSaveRequestId !== draftSaveRequestRef.current
        ) {
          setDraftSaveState("Saved");
          return;
        }
        if (action === "assign") {
          setForm(form);
        }
        if (isAutoSave) {
          failedAutoSaveSnapshotRef.current = submittedSnapshot;
          setDraftSaveState("Error");
        }
        setFailedAction(action);
        // The page mutation displays its error and preserves the form.
        throw new Error("Could not save engagement draft");
      });
  }

  const submitRequestEvent = useEffectEvent(submitRequest);

  useEffect(() => {
    if (usesAutoSave && isFormOpen) {
      draftSaveRequestRef.current += 1;
    }
  }, [isFormOpen, usesAutoSave]);

  useEffect(() => {
    if (!usesAutoSave || !isFormOpen) {
      return;
    }
    const isInitialSave = !autoSaveInitializedRef.current;
    if (
      (!isInitialSave && !isFormDirty) ||
      (draftSaveState === "Error" &&
        failedAutoSaveSnapshotRef.current === currentSnapshot) ||
      isCreating ||
      actionFeedback.isRunning ||
      draftSaveState === "Saving"
    ) {
      return;
    }
    const timeoutId = window.setTimeout(
      () => {
        autoSaveInitializedRef.current = true;
        void submitRequestEvent("draft").catch(() => {
          // The inline draft state exposes the retry action.
        });
      },
      isInitialSave ? 0 : AUTO_SAVE_DELAY_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [
    actionFeedback.isRunning,
    currentSnapshot,
    draftSaveState,
    isCreating,
    isFormDirty,
    isFormOpen,
    usesAutoSave,
  ]);

  function engagementSectionHasErrors(sectionId: EngagementFormSectionId) {
    return ENGAGEMENT_SECTION_ERROR_KEYS[sectionId].some((field) =>
      Boolean(formErrors[field])
    );
  }

  function engagementSectionMissingCount(sectionId: EngagementFormSectionId) {
    const checks: Record<EngagementFormSectionId, boolean[]> = {
      setup: [
        Boolean(form.clientId),
        Boolean(form.engagementCode.trim()),
        Boolean(form.serviceType),
        Boolean(form.amlRiskClassification),
        Boolean(form.engagementRiskClassification),
        Boolean(form.picUserId),
        Boolean(form.micUserId),
        ...(form.engagementRiskClassification === "NORMAL"
          ? []
          : [Boolean(form.eqReviewerUserId)]),
      ],
      commercial: [
        Number(form.budgetedHours) > 0,
        form.agreedFee.trim() !== "" && Number(form.agreedFee) >= 0,
      ],
      notes: [],
    };
    return checks[sectionId].filter((value) => !value).length;
  }

  function engagementSectionStatus(
    sectionId: EngagementFormSectionId
  ): CmpFormSectionStatus {
    if (engagementSectionHasErrors(sectionId)) {
      return "error";
    }
    if (engagementSectionMissingCount(sectionId)) {
      return "incomplete";
    }
    return hasEngagementSectionContent(form, sectionId)
      ? "complete"
      : "not-started";
  }

  function validateEngagementField(
    field: keyof EngagementFormState,
    fieldValue?: string
  ) {
    const formToValidate =
      fieldValue === undefined || typeof form[field] !== "string"
        ? form
        : { ...form, [field]: fieldValue };
    const validation = validateEngagementForm(formToValidate, selectedClient);
    setFormErrors((current) => {
      const next = { ...current };
      if (validation[field]) {
        next[field] = validation[field];
      } else {
        return omitFormError(next, field);
      }
      return next;
    });
  }

  function activateStep(stepId: EngagementFormWizardStepId) {
    setActiveFormSectionId(stepId);
    if (stepId === "review") {
      setIsPreviewOpen(true);
    } else {
      setOpenFormSectionIds([stepId]);
    }
    scrollWorkspaceToStart();
  }

  function scrollWorkspaceToStart() {
    window.requestAnimationFrame(() => {
      const root = workspaceContentRef.current;
      if (!root) {
        return;
      }

      const prefersReducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (root.scrollTo) {
        root.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      } else {
        root.scrollTop = 0;
      }
    });
  }

  function updateOpenFormSections(sectionIds: string[]) {
    if (sectionIds.length === 0) {
      setOpenFormSectionIds([]);
      return;
    }
    const nextSectionId =
      sectionIds.find((sectionId) => !openFormSectionIds.includes(sectionId)) ??
      sectionIds[0];
    setOpenFormSectionIds([nextSectionId]);
    setActiveFormSectionId(nextSectionId as EngagementFormSectionId);
  }

  function _goToPreviousStep() {
    const steps: EngagementFormWizardStepId[] = [
      ...engagementSections.map((section) => section.id),
      "review",
    ];
    const index = steps.indexOf(activeFormSectionId);
    if (index > 0) {
      activateStep(steps[index - 1]);
    }
  }

  function goToNextStep() {
    const steps: EngagementFormWizardStepId[] = [
      ...engagementSections.map((section) => section.id),
      "review",
    ];
    const index = steps.indexOf(activeFormSectionId);
    if (index < steps.length - 1) {
      activateStep(steps[index + 1]);
    }
  }

  const engagementBudget = deriveFeePlanningBudget(
    form.feePlanningLines,
    form.agreedFee
  );
  const appliedExchangeRate = feeExchangeRateForForm(form, exchangeRates);
  const currencyOptions = useMemo(
    () =>
      orderedCmpCurrencies(currentUser?.cmpCurrencyOrder).map((currency) => {
        const definition = CMP_BUDGET_CURRENCY_LABELS[currency];
        const localizedName =
          locale === "zh-CN" ? definition.zh : definition.en;
        return {
          value: currency,
          label: `${localizedName} · ${currency}`,
          description:
            currency === "HKD"
              ? locale === "zh-CN"
                ? "港币结算本位币"
                : "Hong Kong dollar settlement currency"
              : `${currency} · 1 ${currency} = ${formatExchangeRateValue(
                  exchangeRates.find((rate) => rate.currency === currency) ??
                    getCmpFixedBudgetExchangeRate(currency)
                )} HKD`,
          keywords: [currency, definition.en, definition.zh, ...definition.aliases].join(
            " "
          ),
        };
      }),
    [currentUser?.cmpCurrencyOrder, exchangeRates, locale]
  );
  const engagementRequiredChecks = [
    Boolean(form.engagementCode.trim()),
    Boolean(form.serviceType),
    Boolean(form.clientId),
    engagementBudget.totalHours > 0,
    form.agreedFee.trim() !== "" && Number(form.agreedFee) >= 0,
    Boolean(form.amlRiskClassification),
    Boolean(form.engagementRiskClassification),
    Boolean(form.picUserId),
    Boolean(form.micUserId),
    ...(form.engagementRiskClassification === "NORMAL"
      ? []
      : [Boolean(form.eqReviewerUserId)]),
  ];
  const _engagementRequiredProgress = copy.clientFormRequiredProgress
    .replace(
      "{completed}",
      String(engagementRequiredChecks.filter(Boolean).length)
    )
    .replace("{total}", String(engagementRequiredChecks.length));
  const { effectiveHourlyRate } = engagementBudget;
  const engagementReviewSections: ReviewSection[] = engagementSections.map(
    (section) => {
      const itemsBySection: Record<
        EngagementFormSectionId,
        { label: string; value?: ReactNode }[]
      > = {
        setup: [
          {
            label: copy.client,
            value: selectedClient
              ? `${selectedClient.clientCode} - ${selectedClient.nameEn || selectedClient.nameZh}`
              : undefined,
          },
          { label: copy.engagementDate, value: form.engagementDate },
          { label: copy.yearEnd, value: form.yearEndDate },
          { label: copy.reportDate, value: form.reportDate },
          { label: copy.engagementCode, value: form.engagementCode },
          {
            label: copy.serviceType,
            value: form.serviceType
              ? serviceTypeLabels[form.serviceType]
              : undefined,
          },
          {
            label: copy.amlTfRisk,
            value:
              form.amlRiskClassification === "HIGH"
                ? copy.amlTfRiskHigh
                : copy.amlTfRiskNotHigh,
          },
          {
            label: copy.engagementRisk,
            value: engagementRiskLabel(form.engagementRiskClassification, copy),
          },
          { label: copy.pic, value: form.pic },
          { label: copy.mic, value: form.mic },
          ...(form.engagementRiskClassification === "NORMAL"
            ? []
            : [{ label: copy.eqReviewer, value: form.eqReviewer }]),
          {
            label: copy.engagementDeliverables,
            value:
              form.deliverables.length > 0
                ? formatEngagementDeliverables(form.deliverables, locale)
                : undefined,
          },
        ],
        commercial: [
          {
            label: copy.budgetedHours,
            value: engagementBudget.budgetedHours,
          },
          {
            label: copy.agreedFee,
            value: form.agreedFee
              ? `${form.feeCurrency} ${form.agreedFee}`
              : undefined,
          },
          {
            label:
              locale === "zh-CN"
                ? "应用汇率（1 外币 = HKD）"
                : "Applied rate (1 foreign currency = HKD)",
            value:
              form.feeCurrency === "HKD"
                ? "1.00000000"
                : `${form.feeExchangeRateHkdPerUnit || "—"} · ${
                    form.feeExchangeRateSource === "MANUAL"
                      ? locale === "zh-CN"
                        ? "手工"
                        : "Manual"
                      : locale === "zh-CN"
                        ? "系统"
                        : "System"
                  }`,
          },
          {
            label:
              locale === "zh-CN"
                ? "港币结算协定收费"
                : "HKD settlement agreed fee",
            value:
              form.agreedFee &&
              Number.isFinite(Number(appliedExchangeRate.hkdPerUnit))
                ? formatBudgetMoney(
                    locale,
                    "HKD",
                    Number(form.agreedFee) *
                      Number(appliedExchangeRate.hkdPerUnit)
                  )
                : undefined,
          },
          {
            label: copy.recoveryRate,
            value: engagementBudget.recoveryRate
              ? `${engagementBudget.recoveryRate}%`
              : undefined,
          },
          {
            label: copy.feePlanningDetails,
            value: (
              <CmpEngagementFeePlanningSummary
                lines={form.feePlanningLines}
                currency={form.feeCurrency}
                users={users}
              />
            ),
          },
        ],
        notes: [
          { label: copy.status, value: statusLabels[form.status] },
          { label: copy.remarks, value: form.remarks },
        ],
      };
      return {
        id: section.id,
        label: section.label,
        status: engagementSectionStatus(section.id),
        items: itemsBySection[section.id],
      };
    }
  );
  const engagementWizardSteps: FormWizardStep[] = [
    ...engagementSections.map((section) => ({
      id: section.id,
      label: section.label,
      status: engagementSectionStatus(section.id),
      missingCount: engagementSectionMissingCount(section.id),
    })),
    {
      id: "review",
      label: copy.clientFormPreview,
      status: engagementRequiredChecks.every(Boolean)
        ? "complete"
        : "incomplete",
      missingCount: engagementRequiredChecks.filter((complete) => !complete)
        .length,
    },
  ];
  const engagementViewActionLabel =
    displayMode === "client" ? copy.listEngagements : copy.groupByClient;
  const engagementViewAction = (
    <MotionButton
      aria-label={engagementViewActionLabel}
      aria-pressed={displayMode === "client"}
      className={CMP_DATA_GRID_TOOLBAR_ACTION_CLASS}
      size="sm"
      variant="secondary"
      onClick={() => {
        if (displayMode === "client") {
          setDisplayMode("list");
          setGroupTargetClientId(undefined);
          return;
        }
        setGroupTargetClientId(undefined);
        setDisplayMode("client");
      }}
    >
      {displayMode === "client" ? (
        <List aria-hidden="true" className="size-3.5" />
      ) : (
        <UsersRound aria-hidden="true" className="size-3.5" />
      )}
      <span>{engagementViewActionLabel}</span>
    </MotionButton>
  );
  const newEngagementAction = canCreateAcceptance ? (
    <MotionButton
      aria-label={copy.newEngagement}
      className={CMP_DATA_GRID_TOOLBAR_ACTION_CLASS}
      disabled={sortedClients.length === 0}
      size="sm"
      variant="secondary"
      onClick={() => openCreateForm()}
    >
      <Plus aria-hidden="true" className="size-3.5" />
      <span>{copy.newEngagement}</span>
    </MotionButton>
  ) : null;

  return (
    <section className="cmp-engagements-workspace">
      {!formPageMode && !clientPrefillClient ? (
        <>
          {sortedClients.length === 0 ? (
            <div className="cmp-empty">{copy.createClientFirst}</div>
          ) : null}
          {displayMode === "client" ? (
            <Frame
              className="h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden [&_td]:border-border [&_th]:border-border"
              data-testid="cmp-engagements-list"
              dense
              stacked
            >
              <CmpDataGridToolbar
                leadingActions={engagementViewAction}
                recordCount={filteredEngagements.length}
                title={copy.engagements}
                trailingActions={newEngagementAction}
              />
              <FramePanel className="min-h-0 p-3 shadow-none">
                <CmpEngagementClientGroups
                  key={`client-groups-${groupTargetClientId ?? "all"}-${engagementClientGroups.map(({ client }) => client.id).join(",")}`}
                  groups={engagementClientGroups}
                  targetClientId={groupTargetClientId}
                  onPreviewClient={(client) =>
                    openCmpRecordPreviewWindow(
                      localizedPath(`/client/${encodeURIComponent(client.id)}`)
                    )
                  }
                  onPreviewEngagement={(engagement) =>
                    openCmpRecordPreviewWindow(
                      localizedPath(
                        `/engagement/${encodeURIComponent(engagement.id)}`
                      )
                    )
                  }
                />
              </FramePanel>
            </Frame>
          ) : (
            <CmpEngagementsDataGrid
              key={engagementResultsKey || "empty"}
              canEdit={canCreateChange}
              clients={clients}
              copy={copy}
              archiveCount={archiveCount}
              drafts={drafts}
              engagements={filteredEngagements}
              leadingActions={engagementViewAction}
              onEdit={openEditForm}
              onDeleteDraft={onDeleteListedDraft}
              onOpenFeeNote={onOpenFeeNote}
              onPreview={(engagement) =>
                openCmpRecordPreviewWindow(
                  localizedPath(
                    `/engagement/${encodeURIComponent(engagement.id)}`
                  )
                )
              }
              serviceTypeLabels={serviceTypeLabels}
              statusLabels={statusLabels}
              trailingActions={newEngagementAction}
            />
          )}
        </>
      ) : null}

      {clientPrefillClient ? (
        <EngagementClientPrefillWorkspace
          client={clientPrefillClient}
          clientService={clientPrefillService}
          copy={copy}
          options={clientPrefillOptions}
          serviceTypeLabels={serviceTypeLabels}
          sourceEngagement={clientPrefillSourceEngagement}
          sourceEngagementId={clientPrefillSourceEngagementId}
          sourceEngagements={clientPrefillSourceEngagements}
          statusLabels={statusLabels}
          onChooseAnotherClient={chooseAnotherClient}
          onConfirm={confirmClientPrefill}
          onOptionChange={(option, checked) =>
            setClientPrefillOptions((current) => ({
              ...current,
              [option]: checked,
            }))
          }
          onSourceEngagementChange={setClientPrefillSourceEngagementId}
        />
      ) : null}

      {clientPrefillClient &&
      !formPageMode &&
      legacyClientPrefillDialogEnabled ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              chooseAnotherClient();
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{copy.engagementClientPrefillTitle}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {copy.engagementClientPrefillDescription}
              </p>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {copy.engagementClientPrefillClient}
                </p>
                <p className="mt-1 font-medium">
                  {clientPrefillClient.clientCode} -{" "}
                  {clientPrefillClient.nameEn || clientPrefillClient.nameZh}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {clientPrefillClient.status === "RESIGNED"
                    ? copy.clientStatusResigned
                    : statusLabels[clientPrefillClient.status]}
                  {" · "}
                  {copy.clientFormYearEndMonth}{" "}
                  {clientPrefillClient.yearEndMonth || copy.formNotSet}
                </p>
              </div>
              {clientPrefillSourceEngagements.length ? (
                <div className="grid gap-3 rounded-lg border border-border bg-background p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {copy.engagementClientPrefillSource}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {copy.engagementClientPrefillSourceDescription}
                    </p>
                  </div>
                  <NativeSelect
                    aria-label={copy.engagementClientPrefillSource}
                    value={clientPrefillSourceEngagementId}
                    onChange={(event) =>
                      setClientPrefillSourceEngagementId(event.target.value)
                    }
                  >
                    <option value="">
                      {copy.engagementClientPrefillSourceNone}
                    </option>
                    {clientPrefillSourceEngagements.map((engagement) => (
                      <option key={engagement.id} value={engagement.id}>
                        {engagement.engagementCode} -{" "}
                        {engagement.client.nameEn || engagement.client.nameZh} ·{" "}
                        {serviceTypeLabels[engagement.serviceType]}
                      </option>
                    ))}
                  </NativeSelect>
                  {clientPrefillSourceEngagement ? (
                    <>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {copy.engagementClientPrefillSourceSections}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceService}
                          label={copy.engagementClientPrefillSourceService}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceService: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceDeliverables}
                          label={copy.engagementClientPrefillSourceDeliverables}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceDeliverables: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceDates}
                          label={copy.engagementClientPrefillSourceDates}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceDates: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceCommercial}
                          label={copy.engagementClientPrefillSourceCommercial}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceCommercial: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceRisk}
                          label={copy.engagementClientPrefillSourceRisk}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceRisk: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceResponsible}
                          label={copy.engagementClientPrefillSourceResponsible}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceResponsible: checked,
                            }))
                          }
                        />
                        <ClientPrefillOption
                          checked={clientPrefillOptions.sourceNotes}
                          label={copy.engagementClientPrefillSourceNotes}
                          onCheckedChange={(checked) =>
                            setClientPrefillOptions((current) => ({
                              ...current,
                              sourceNotes: checked,
                            }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {copy.engagementClientPrefillSourceHint}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {copy.engagementClientPrefillEngagementDefaults}
                </p>
                {clientPrefillClient.yearEndDate ? (
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2">
                    <span>
                      <span className="block text-sm font-medium">
                        {copy.engagementClientPrefillYearEnd}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {clientPrefillClient.yearEndDate}
                      </span>
                    </span>
                    <Checkbox
                      checked={clientPrefillOptions.yearEndDate}
                      onCheckedChange={(checked) =>
                        setClientPrefillOptions((current) => ({
                          ...current,
                          yearEndDate: checked === true,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {clientPrefillService ? (
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2">
                    <span>
                      <span className="block text-sm font-medium">
                        {copy.engagementClientPrefillService}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {serviceTypeLabels[clientPrefillService.serviceType]}
                        {clientPrefillService.description
                          ? ` · ${clientPrefillService.description}`
                          : ""}
                      </span>
                    </span>
                    <Checkbox
                      checked={clientPrefillOptions.service}
                      onCheckedChange={(checked) =>
                        setClientPrefillOptions((current) => ({
                          ...current,
                          service: checked === true,
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium">
                      {copy.engagementClientPrefillPic}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {clientPrefillClient.clientPartnerPic || copy.formNotSet}
                    </span>
                  </span>
                  <Checkbox
                    checked={clientPrefillOptions.pic}
                    onCheckedChange={(checked) =>
                      setClientPrefillOptions((current) => ({
                        ...current,
                        pic: checked === true,
                      }))
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-background px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium">
                      {copy.engagementClientPrefillMic}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {clientPrefillClient.clientManagerMic || copy.formNotSet}
                    </span>
                  </span>
                  <Checkbox
                    checked={clientPrefillOptions.mic}
                    onCheckedChange={(checked) =>
                      setClientPrefillOptions((current) => ({
                        ...current,
                        mic: checked === true,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="grid gap-2 rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {copy.engagementClientPrefillContext}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {copy.engagementClientPrefillContextReadonly}
                  </span>
                </div>
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <ClientPrefillContextItem
                    label={copy.groupCode}
                    value={
                      clientPrefillClient.group?.groupCode ||
                      clientPrefillClient.groupName
                    }
                  />
                  <ClientPrefillContextItem
                    label={copy.clientFormReportingGaap}
                    value={clientPrefillClient.reportingGaap}
                  />
                  <ClientPrefillContextItem
                    label={copy.clientFormIndustry}
                    value={
                      clientPrefillClient.industryOtherDescription ||
                      clientPrefillClient.hsicSectionCode
                    }
                  />
                  <ClientPrefillContextItem
                    label={copy.placeOfIncorporation}
                    value={clientPrefillClient.placeOfIncorporation}
                  />
                  <ClientPrefillContextItem
                    label={copy.registeredAddress}
                    value={clientPrefillClient.address}
                    wide
                  />
                  <ClientPrefillContextItem
                    label={copy.clientFormContactPerson}
                    value={clientPrefillClient.contactPerson}
                  />
                  <ClientPrefillContextItem
                    label={copy.email}
                    value={clientPrefillClient.email}
                  />
                </dl>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={chooseAnotherClient}
                type="button"
                variant="outline"
              >
                {copy.engagementClientPrefillChooseAnother}
              </Button>
              <Button onClick={confirmClientPrefill} type="button">
                {copy.engagementClientPrefillUse}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {isFormOpen ? (
        <div
          className={formPageMode ? "contents" : "cmp-modal-backdrop"}
          role={formPageMode ? undefined : "presentation"}
        >
          <section
            className={
              formPageMode
                ? "contents"
                : "cmp-modal cmp-client-modal cmp-client-form-modal"
            }
            role={formPageMode ? "region" : "dialog"}
            aria-modal={formPageMode ? undefined : true}
            aria-label={
              editingEngagement
                ? "Edit engagement"
                : "New engagement acceptance"
            }
          >
            <form
              ref={formRef}
              className="cmp-client-form cmp-client-form-shell cmp-client-form-workspace cmp-form-wizard-workspace"
              data-actions-placement="header"
              noValidate
              onChangeCapture={(event) => {
                const field = (event.target as HTMLElement).dataset
                  .validationField as keyof EngagementFormErrors | undefined;
                if (field) {
                  setFormErrors((current) => ({
                    ...current,
                    [field]: undefined,
                  }));
                }
              }}
              onBlurCapture={(event) => {
                const target = event.target as unknown as
                  | HTMLInputElement
                  | HTMLSelectElement
                  | HTMLTextAreaElement;
                const field = target.dataset.validationField as
                  | keyof EngagementFormState
                  | undefined;
                if (field) {
                  const fieldValue = target.value;
                  window.setTimeout(
                    () => validateEngagementField(field, fieldValue),
                    0
                  );
                }
              }}
              onSubmit={(event) => {
                event.preventDefault();
                if (activeFormSectionId === "review") {
                  void submitRequest("submit").catch(() => {});
                } else if (activeFormSectionId === "notes") {
                  activateStep("review");
                } else {
                  goToNextStep();
                }
              }}
            >
              <AcceptanceFormWorkspace
                activeStepId={activeFormSectionId}
                contentRef={workspaceContentRef}
                stepperLabel={copy.engagementFormSections}
                steps={engagementWizardSteps}
                onStepChange={(stepId) =>
                  activateStep(stepId as EngagementFormWizardStepId)
                }
                header={
                  <AcceptanceFormHeader>
                    <div className="cmp-form-workspace-title">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="relative -top-px text-xl leading-7 font-semibold">
                          {editingEngagement
                            ? locale === "zh-CN"
                              ? "业务资料变更"
                              : "Engagement change"
                            : copy.newEngagementAcceptance}
                        </h1>
                        <Badge
                          className="h-7 min-h-7 rounded-md! px-2"
                          radius="default"
                          variant="info-outline"
                        >
                          {copy.clientFormDraftStatus}
                        </Badge>
                        <Input
                          aria-invalid={Boolean(draftNameError)}
                          aria-label={
                            locale === "zh-CN" ? "草稿名称" : "Draft name"
                          }
                          className="h-7 w-44 text-xs"
                          maxLength={100}
                          placeholder={
                            locale === "zh-CN" ? "草稿名称" : "Draft name"
                          }
                          value={form.draftName}
                          onChange={(event) => {
                            setDraftNameError(null);
                            setForm((current) => ({
                              ...current,
                              draftName: event.target.value,
                            }));
                          }}
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          {formPageMode && onDeleteDraft ? (
                            <CmpFormDraftDeleteAction
                              copy={{
                                cancel: copy.cancel,
                                delete: copy.delete,
                                deleteDraft: copy.deleteDraft,
                                deleteDraftDescription:
                                  copy.deleteDraftDescription,
                                deleteDraftTitle: copy.deleteDraftTitle,
                                deletingDraft: copy.deletingDraft,
                              }}
                              disabled={!hasPersistedDraft || isCreating}
                              isDeleting={isDeletingDraft}
                              onDelete={onDeleteDraft}
                            />
                          ) : null}
                          <StatefulMotionButton
                            type="button"
                            aria-label={saveLabel}
                            className="h-7 shrink-0 cursor-pointer px-2 text-xs! [&_.lucide-x]:text-destructive [&_svg]:size-3.5"
                            disabled={
                              isCreating ||
                              (actionFeedback.isRunning && !isDraftSaving)
                            }
                            errorText={copy.formRetrySave}
                            loadingText={copy.formSaveStateSaving}
                            state={saveButtonState}
                            successIcon={
                              isSaveHovered ? (
                                <Check className="text-success" />
                              ) : undefined
                            }
                            successText={
                              isSaveHovered ? copy.formSave : copy.formSaved
                            }
                            size="sm"
                            variant="ghost"
                            onBlur={() => setIsSaveHovered(false)}
                            onFocus={() => setIsSaveHovered(true)}
                            onMouseEnter={() => setIsSaveHovered(true)}
                            onMouseLeave={() => setIsSaveHovered(false)}
                            onClick={() => {
                              void submitRequest("draft").catch(() => {});
                            }}
                          >
                            {copy.formSave}
                          </StatefulMotionButton>
                        </div>
                      </div>
                    </div>
                    <ButtonGroup className="cmp-form-header-actions shrink-0 items-center gap-1.5">
                      <MotionButton
                        type="button"
                        aria-label={
                          form.draftAssigneeId
                            ? `${copy.assignedToAction} ${staffOptions.find((user) => user.id === form.draftAssigneeId)?.name ?? ""}`
                            : copy.assignAction
                        }
                        className={
                          form.draftAssigneeId
                            ? "h-7 cursor-pointer border-muted-foreground/10! bg-muted! px-2 text-foreground! shadow-none! hover:bg-muted/80!"
                            : "h-7 cursor-pointer px-2 text-xs!"
                        }
                        disabled={isCreating || actionFeedback.isRunning}
                        size="sm"
                        variant="secondary"
                        onClick={() => setMemberActionDialog("assign")}
                      >
                        {form.draftAssigneeId ? (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {copy.assignedToAction}
                            </span>
                            <MemberDirectoryCompactIdentity
                              name={
                                staffOptions.find(
                                  (user) => user.id === form.draftAssigneeId
                                )?.name ?? ""
                              }
                            />
                          </>
                        ) : (
                          copy.assignAction
                        )}
                      </MotionButton>
                      {activeFormSectionId === "review" ? (
                        <MotionButton
                          type="submit"
                          className="h-7 cursor-pointer px-2.5 text-xs!"
                          disabled={isCreating || actionFeedback.isRunning}
                          size="sm"
                          variant="secondary"
                        >
                          {isPartnerInitiator
                            ? `${copy.submitDialogTitle} MIC`
                            : copy.submitForApproval}
                        </MotionButton>
                      ) : (
                        <MotionButton
                          type="submit"
                          aria-label={copy.formNext}
                          className="size-7 cursor-pointer rounded-full! [&_svg]:size-3.5"
                          disabled={isCreating || actionFeedback.isRunning}
                          size="icon"
                          variant="secondary"
                        >
                          <ArrowRight aria-hidden="true" />
                        </MotionButton>
                      )}
                    </ButtonGroup>
                    <Button
                      type="button"
                      className="cmp-icon-button cmp-form-close-button"
                      aria-label={copy.closeForm}
                      disabled={isCreating || actionFeedback.isRunning}
                      onClick={() => closeForm()}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </AcceptanceFormHeader>
                }
              >
                {activeFormSectionId === "review" ? (
                  <Accordion
                    multiple
                    value={isPreviewOpen ? ["review"] : []}
                    className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
                    onValueChange={(value) =>
                      setIsPreviewOpen(value.includes("review"))
                    }
                  >
                    <AcceptanceFormAccordionSection
                      sectionId="review"
                      title={copy.clientFormPreview}
                      status={
                        Object.values(formErrors).some(Boolean)
                          ? "error"
                          : engagementRequiredChecks.every(Boolean)
                            ? "complete"
                            : "incomplete"
                      }
                      statusCopy={accordionStatusCopy}
                      onFocus={() => setActiveFormSectionId("review")}
                    >
                      <FormReviewPage
                        sections={engagementReviewSections}
                        title={copy.clientFormPreview}
                        showHeader={false}
                        showSectionStatus={false}
                        showEditActions={false}
                        onEdit={(sectionId) =>
                          activateStep(sectionId as EngagementFormSectionId)
                        }
                      />
                    </AcceptanceFormAccordionSection>
                  </Accordion>
                ) : (
                  <Accordion
                    multiple
                    keepMounted
                    value={openFormSectionIds}
                    className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
                    onValueChange={updateOpenFormSections}
                  >
                    <EngagementAcceptanceSection
                      sectionId="setup"
                      onFocus={() => setActiveFormSectionId("setup")}
                      status={engagementSectionStatus("setup")}
                      title={copy.engagementSetup}
                    >
                      <EngagementFormSubsection
                        className="cmp-form-subsection-first"
                        title={copy.engagementIdentity}
                      >
                        <div className="cmp-form-field-row cmp-form-span-full">
                          <SearchSelect
                            label={copy.client}
                            fieldId="clientId"
                            required
                            disabled={isSourceClientLocked}
                            value={form.clientId}
                            error={formErrors.clientId}
                            placeholder={copy.selectClient}
                            hint={
                              isSourceClientLocked
                                ? copy.engagementImportClientLocked
                                : undefined
                            }
                            searchPlaceholder={copy.formSearch}
                            options={sortedClients.map((client) => ({
                              value: client.id,
                              label: `${client.clientCode} - ${client.nameEn || client.nameZh}`,
                              description: [
                                client.nameZh,
                                client.yearEndMonth
                                  ? `${copy.clientFormYearEndMonth} ${client.yearEndMonth}`
                                  : null,
                                client.status === "RESIGNED"
                                  ? copy.clientStatusResigned
                                  : statusLabels[client.status],
                              ]
                                .filter(Boolean)
                                .join(" · "),
                              keywords: `${client.clientCode} ${client.nameEn ?? ""} ${client.nameZh ?? ""}`,
                            }))}
                            onBlur={() => validateEngagementField("clientId")}
                            onChange={(clientId) => {
                              const client = clients.find(
                                (item) => item.id === clientId
                              );
                              const inheritedPic = picApproverOptions.find(
                                (user) =>
                                  user.id === client?.clientPartnerPicId ||
                                  (!client?.clientPartnerPicId &&
                                    user.name === client?.clientPartnerPic)
                              );
                              const inheritedMic = micApproverOptions.find(
                                (user) =>
                                  user.id === client?.clientManagerMicId ||
                                  (!client?.clientManagerMicId &&
                                    user.name === client?.clientManagerMic)
                              );
                              setForm((current) => ({
                                ...current,
                                clientId,
                                picUserId:
                                  client?.clientPartnerPicId ??
                                  inheritedPic?.id ??
                                  "",
                                pic:
                                  client?.clientPartnerPic ??
                                  inheritedPic?.name ??
                                  "",
                                micUserId:
                                  client?.clientManagerMicId ??
                                  inheritedMic?.id ??
                                  "",
                                mic:
                                  client?.clientManagerMic ??
                                  inheritedMic?.name ??
                                  "",
                              }));
                            }}
                          />
                          <label
                            className={
                              formErrors.engagementCode
                                ? "cmp-field-invalid"
                                : undefined
                            }
                          >
                            <RequiredFieldLabel label={copy.engagementCode} />
                            <Input
                              aria-label={copy.engagementCode}
                              aria-describedby={
                                formErrors.engagementCode
                                  ? validationErrorId("engagementCode")
                                  : undefined
                              }
                              aria-invalid={Boolean(formErrors.engagementCode)}
                              data-validation-field="engagementCode"
                              required
                              value={form.engagementCode}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  engagementCode: event.target.value,
                                }))
                              }
                            />
                            {formErrors.engagementCode ? (
                              <span
                                className="cmp-field-error"
                                id={validationErrorId("engagementCode")}
                              >
                                {formErrors.engagementCode}
                              </span>
                            ) : null}
                          </label>
                          <label
                            className={
                              serviceTypeError ? "cmp-field-invalid" : undefined
                            }
                          >
                            <RequiredFieldLabel label={copy.serviceType} />
                            <NativeSelect
                              aria-label={copy.serviceType}
                              aria-describedby={
                                serviceTypeError
                                  ? validationErrorId("serviceType")
                                  : undefined
                              }
                              aria-invalid={Boolean(serviceTypeError)}
                              data-validation-field="serviceType"
                              value={form.serviceType}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  serviceType: event.target
                                    .value as EngagementFormState["serviceType"],
                                }))
                              }
                            >
                              <option value="">{copy.selectServiceType}</option>
                              {form.serviceType &&
                              !SERVICE_TYPES.some(
                                (serviceType) =>
                                  serviceType.value === form.serviceType
                              ) ? (
                                <option value={form.serviceType}>
                                  {serviceTypeLabels[form.serviceType]} ·{" "}
                                  {copy.engagementLegacyServiceType}
                                </option>
                              ) : null}
                              {SERVICE_TYPES.map((serviceType) => (
                                <option
                                  key={serviceType.value}
                                  value={serviceType.value}
                                >
                                  {serviceTypeLabels[serviceType.value]}
                                </option>
                              ))}
                            </NativeSelect>
                            {serviceTypeError ? (
                              <span
                                className="cmp-field-error"
                                id={validationErrorId("serviceType")}
                              >
                                {serviceTypeError}
                              </span>
                            ) : null}
                          </label>
                        </div>
                        {form.serviceType === "OTHERS" ? (
                          <label
                            className={`cmp-form-span-full${
                              formErrors.otherServiceDescription
                                ? " cmp-field-invalid"
                                : ""
                            }`}
                          >
                            <RequiredFieldLabel
                              label={copy.clientFormExpectedEngagementType}
                            />
                            <Textarea
                              aria-label={copy.clientFormExpectedEngagementType}
                              aria-invalid={Boolean(
                                formErrors.otherServiceDescription
                              )}
                              data-validation-field="otherServiceDescription"
                              required
                              value={form.otherServiceDescription}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  otherServiceDescription: event.target.value,
                                }))
                              }
                            />
                            {formErrors.otherServiceDescription ? (
                              <span className="cmp-field-error">
                                {formErrors.otherServiceDescription}
                              </span>
                            ) : null}
                          </label>
                        ) : null}
                        {selectedClient ? (
                          <div className="cmp-client-context">
                            <div>
                              <strong>
                                {selectedClient.clientCode} ·{" "}
                                {selectedClient.nameEn || selectedClient.nameZh}
                              </strong>
                              <span>
                                {selectedClient.status === "RESIGNED"
                                  ? copy.clientStatusResigned
                                  : statusLabels[selectedClient.status]}{" "}
                                · {copy.clientFormYearEndMonth}{" "}
                                {selectedClient.yearEndMonth || copy.formNotSet}{" "}
                                · {copy.pic}{" "}
                                {selectedClient.clientPartnerPic ||
                                  copy.formNotSet}{" "}
                                · {copy.mic}{" "}
                                {selectedClient.clientManagerMic ||
                                  copy.formNotSet}
                              </span>
                            </div>
                            <span className="cmp-inherited-badge">
                              {copy.formClientDetailsApplied}
                            </span>
                          </div>
                        ) : null}
                      </EngagementFormSubsection>
                      <EngagementFormSubsection title={copy.engagementKeyDates}>
                        <div className="cmp-form-field-row cmp-form-span-full">
                          <label
                            className={
                              formErrors.engagementDate
                                ? "cmp-field-invalid"
                                : undefined
                            }
                          >
                            {copy.engagementDate}
                            <Input
                              aria-label={copy.engagementDate}
                              {...engagementValidationProps(
                                "engagementDate",
                                formErrors.engagementDate
                              )}
                              type="date"
                              value={form.engagementDate}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  engagementDate: event.target.value,
                                }))
                              }
                            />
                            <EngagementFieldError
                              field="engagementDate"
                              error={formErrors.engagementDate}
                            />
                          </label>
                          <label
                            className={
                              formErrors.yearEndDate
                                ? "cmp-field-invalid"
                                : undefined
                            }
                          >
                            {copy.yearEnd}
                            <Input
                              aria-label={copy.yearEnd}
                              {...engagementValidationProps(
                                "yearEndDate",
                                formErrors.yearEndDate
                              )}
                              type="date"
                              value={form.yearEndDate}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  yearEndDate: event.target.value,
                                }))
                              }
                            />
                            <EngagementFieldError
                              field="yearEndDate"
                              error={formErrors.yearEndDate}
                            />
                          </label>
                          <label
                            className={
                              formErrors.reportDate
                                ? "cmp-field-invalid"
                                : undefined
                            }
                          >
                            {copy.reportDate}
                            <Input
                              aria-label={copy.reportDate}
                              {...engagementValidationProps(
                                "reportDate",
                                formErrors.reportDate
                              )}
                              type="date"
                              value={form.reportDate}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  reportDate: event.target.value,
                                }))
                              }
                            />
                            <EngagementFieldError
                              field="reportDate"
                              error={formErrors.reportDate}
                            />
                          </label>
                        </div>
                      </EngagementFormSubsection>
                      <EngagementFormSubsection
                        title={copy.engagementRiskClassification}
                      >
                        <CmpEngagementRiskSelector
                          amlRiskClassification={form.amlRiskClassification}
                          engagementRiskClassification={
                            form.engagementRiskClassification
                          }
                          labels={copy}
                          onAmlRiskClassificationChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              amlRiskClassification: value,
                            }))
                          }
                          onEngagementRiskClassificationChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              engagementRiskClassification: value,
                              ...(value === "NORMAL"
                                ? { eqReviewerUserId: "", eqReviewer: "" }
                                : {}),
                            }))
                          }
                        />
                      </EngagementFormSubsection>
                      <EngagementFormSubsection
                        title={copy.engagementResponsiblePersons}
                      >
                        <div className="cmp-form-subsection-grid cmp-form-span-full">
                          <SearchSelect
                            label={copy.pic}
                            fieldId="picUserId"
                            required
                            value={form.picUserId}
                            error={formErrors.picUserId}
                            placeholder={copy.selectPic}
                            searchPlaceholder={copy.formSearch}
                            options={[
                              ...(form.picUserId &&
                              !picApproverOptions.some(
                                (user) => user.id === form.picUserId
                              )
                                ? [
                                    {
                                      value: form.picUserId,
                                      label: form.pic || form.picUserId,
                                      description: copy.clientAssignment,
                                    },
                                  ]
                                : []),
                              ...picApproverOptions.map((user) => ({
                                value: user.id,
                                label: user.name,
                                description: user.globalRole.replaceAll(
                                  "_",
                                  " "
                                ),
                              })),
                            ]}
                            onBlur={() => validateEngagementField("picUserId")}
                            onChange={(userId) => {
                              const user = picApproverOptions.find(
                                (item) => item.id === userId
                              );
                              setForm((current) => ({
                                ...current,
                                picUserId: user?.id ?? "",
                                pic: user?.name ?? "",
                              }));
                            }}
                          />
                          <SearchSelect
                            label={copy.mic}
                            fieldId="micUserId"
                            required
                            value={form.micUserId}
                            error={formErrors.micUserId}
                            placeholder={copy.selectMic}
                            searchPlaceholder={copy.formSearch}
                            options={[
                              ...(form.micUserId &&
                              !micApproverOptions.some(
                                (user) => user.id === form.micUserId
                              )
                                ? [
                                    {
                                      value: form.micUserId,
                                      label: form.mic || form.micUserId,
                                      description: copy.clientAssignment,
                                    },
                                  ]
                                : []),
                              ...micApproverOptions.map((user) => ({
                                value: user.id,
                                label: user.name,
                                description: user.globalRole.replaceAll(
                                  "_",
                                  " "
                                ),
                              })),
                            ]}
                            onBlur={() => validateEngagementField("micUserId")}
                            onChange={(userId) => {
                              const user = micApproverOptions.find(
                                (item) => item.id === userId
                              );
                              setForm((current) => ({
                                ...current,
                                micUserId: user?.id ?? "",
                                mic: user?.name ?? "",
                              }));
                            }}
                          />
                          {form.engagementRiskClassification ===
                          "NORMAL" ? null : (
                            <SearchSelect
                              label={copy.eqReviewer}
                              fieldId="eqReviewerUserId"
                              required
                              value={form.eqReviewerUserId}
                              error={formErrors.eqReviewerUserId}
                              placeholder={copy.selectEqReviewer}
                              searchPlaceholder={copy.selectEqReviewer}
                              options={eqReviewerOptions.map((user) => ({
                                value: user.id,
                                label: user.name,
                                description: user.globalRole,
                              }))}
                              onBlur={() =>
                                validateEngagementField("eqReviewerUserId")
                              }
                              onChange={(userId) => {
                                const user = eqReviewerOptions.find(
                                  (item) => item.id === userId
                                );
                                setForm((current) => ({
                                  ...current,
                                  eqReviewerUserId: user?.id ?? "",
                                  eqReviewer: user?.name ?? "",
                                }));
                              }}
                            />
                          )}
                        </div>
                      </EngagementFormSubsection>
                      <EngagementFormSubsection
                        title={copy.engagementDeliverables}
                      >
                        <EngagementDeliverablesField
                          value={form.deliverables}
                          serviceType={form.serviceType}
                          locale={locale}
                          onChange={(deliverables) =>
                            setForm((current) => ({ ...current, deliverables }))
                          }
                        />
                      </EngagementFormSubsection>
                      {editingEngagement ? (
                        <CmpEngagementAssociations
                          copy={copy.engagementAssociations}
                          engagement={editingEngagement}
                        />
                      ) : null}
                    </EngagementAcceptanceSection>

                    <EngagementAcceptanceSection
                      sectionId="commercial"
                      onFocus={() => setActiveFormSectionId("commercial")}
                      status={engagementSectionStatus("commercial")}
                      title={copy.engagementCommercialPlanning}
                    >
                      <EngagementFormSubsection
                        className="cmp-form-subsection-first"
                        title={copy.engagementBudgetOverview}
                      >
                        <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two cmp-form-span-full">
                          <label
                            className={
                              formErrors.agreedFee
                                ? "cmp-field-invalid"
                                : undefined
                            }
                          >
                            <RequiredFieldLabel label={copy.agreedFee} />
                            <Input
                              aria-label={copy.agreedFee}
                              aria-describedby={
                                formErrors.agreedFee
                                  ? validationErrorId("agreedFee")
                                  : undefined
                              }
                              aria-invalid={Boolean(formErrors.agreedFee)}
                              data-validation-field="agreedFee"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={form.agreedFee}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  agreedFee: event.target.value,
                                }))
                              }
                            />
                            {formErrors.agreedFee ? (
                              <span
                                className="cmp-field-error"
                                id={validationErrorId("agreedFee")}
                              >
                                {formErrors.agreedFee}
                              </span>
                            ) : null}
                          </label>
                          <SearchSelect
                            fieldId="feeCurrency"
                            label={copy.currency}
                            options={currencyOptions}
                            searchPlaceholder={
                              locale === "zh-CN"
                                ? "搜索币种代码或名称"
                                : "Search currency code or name"
                            }
                            value={form.feeCurrency}
                            onChange={(value) => {
                              if (!value) {
                                return;
                              }
                              const feeCurrency = value as CmpBudgetCurrency;
                              const persistedExchangeRate = exchangeRates.find(
                                (rate) => rate.currency === feeCurrency
                              );
                              const exchangeRate =
                                persistedExchangeRate ??
                                getCmpFixedBudgetExchangeRate(feeCurrency);
                              setForm((current) => ({
                                ...current,
                                feeCurrency,
                                feeExchangeRateSnapshotId:
                                  feeCurrency === "HKD"
                                    ? ""
                                    : (persistedExchangeRate?.id ?? ""),
                                feeExchangeRateHkdPerUnit:
                                  exchangeRate.hkdPerUnit,
                                feeExchangeRateSource: "SYSTEM",
                                feePlanningLines: recalculateFeePlanningRates(
                                  current.feePlanningLines,
                                  feeCurrency,
                                  exchangeRate
                                ),
                              }));
                            }}
                          />
                        </div>
                        {form.feeCurrency !== "HKD" ? (
                          <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two cmp-form-span-full">
                            <label
                              className={
                                formErrors.feeExchangeRateHkdPerUnit
                                  ? "cmp-field-invalid"
                                  : undefined
                              }
                            >
                              {locale === "zh-CN"
                                ? `汇率（1 ${form.feeCurrency} = X HKD）`
                                : `Exchange rate (1 ${form.feeCurrency} = X HKD)`}
                              <Input
                                aria-invalid={Boolean(
                                  formErrors.feeExchangeRateHkdPerUnit
                                )}
                                data-validation-field="feeExchangeRateHkdPerUnit"
                                inputMode="decimal"
                                min="0.00000001"
                                step="0.00000001"
                                type="number"
                                value={form.feeExchangeRateHkdPerUnit}
                                onChange={(event) => {
                                  const feeExchangeRateHkdPerUnit = event.target.value;
                                  const parsedRate = Number(
                                    feeExchangeRateHkdPerUnit
                                  );
                                  const nextRate = {
                                    ...appliedExchangeRate,
                                    // Do not temporarily recalculate lines with
                                    // an invalid/blank input while the user is
                                    // editing.  The server remains the source of
                                    // truth and validates the final rate.
                                    hkdPerUnit:
                                      Number.isFinite(parsedRate) && parsedRate > 0
                                        ? feeExchangeRateHkdPerUnit
                                        : appliedExchangeRate.hkdPerUnit,
                                  };
                                  setForm((current) => ({
                                    ...current,
                                    feeExchangeRateHkdPerUnit,
                                    feeExchangeRateSource: "MANUAL",
                                    feePlanningLines:
                                      recalculateFeePlanningRates(
                                        current.feePlanningLines,
                                        current.feeCurrency,
                                        nextRate
                                      ),
                                  }));
                                }}
                              />
                              {formErrors.feeExchangeRateHkdPerUnit ? (
                                <span className="cmp-field-error">
                                  {formErrors.feeExchangeRateHkdPerUnit}
                                </span>
                              ) : null}
                            </label>
                            <div className="cmp-budget-derived-metric self-end">
                              <span>
                                {form.feeExchangeRateSource === "MANUAL"
                                  ? locale === "zh-CN"
                                    ? "手工汇率"
                                    : "Manual rate"
                                  : locale === "zh-CN"
                                    ? "系统汇率"
                                    : "System rate"}
                              </span>
                              <strong>
                                {locale === "zh-CN" ? "系统：" : "System: "}
                                {formatExchangeRateValue(
                                  exchangeRates.find(
                                    (rate) =>
                                      rate.currency === form.feeCurrency
                                  ) ??
                                    getCmpFixedBudgetExchangeRate(
                                      form.feeCurrency
                                    )
                                )}
                              </strong>
                              <Button
                                className="mt-2 w-fit"
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const systemRate =
                                    exchangeRates.find(
                                      (rate) =>
                                        rate.currency === form.feeCurrency
                                    ) ??
                                    getCmpFixedBudgetExchangeRate(
                                      form.feeCurrency
                                    );
                                  setForm((current) => ({
                                    ...current,
                                    feeExchangeRateSnapshotId: systemRate.id,
                                    feeExchangeRateHkdPerUnit:
                                      systemRate.hkdPerUnit,
                                    feeExchangeRateSource: "SYSTEM",
                                    feePlanningLines:
                                      recalculateFeePlanningRates(
                                        current.feePlanningLines,
                                        current.feeCurrency,
                                        systemRate
                                      ),
                                  }));
                                }}
                              >
                                {locale === "zh-CN"
                                  ? "使用最新系统汇率"
                                  : "Use latest system rate"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        <div
                          className="cmp-budget-derived-grid cmp-form-span-full"
                          data-validation-field="budgetedHours"
                        >
                          <BudgetDerivedMetric
                            label={copy.budgetedHours}
                            value={
                              engagementBudget.budgetedHours
                                ? `${engagementBudget.budgetedHours} h`
                                : "—"
                            }
                          />
                          <BudgetDerivedMetric
                            label={
                              locale === "zh-CN"
                                ? "港币结算协定收费"
                                : "HKD settlement agreed fee"
                            }
                            value={
                              form.agreedFee &&
                              Number.isFinite(
                                Number(appliedExchangeRate.hkdPerUnit)
                              )
                                ? formatBudgetMoney(
                                    locale,
                                    "HKD",
                                    Number(form.agreedFee) *
                                      Number(appliedExchangeRate.hkdPerUnit)
                                  )
                                : "—"
                            }
                          />
                          <BudgetDerivedMetric
                            label={copy.feePlanningTotalAmount}
                            value={formatBudgetMoney(
                              locale,
                              form.feeCurrency,
                              engagementBudget.standardValue
                            )}
                          />
                          <BudgetDerivedMetric
                            label={copy.recoveryRate}
                            value={
                              engagementBudget.recoveryRate
                                ? `${engagementBudget.recoveryRate}%`
                                : "—"
                            }
                          />
                          <BudgetDerivedMetric
                            label={copy.formEffectiveHourlyRate}
                            value={
                              effectiveHourlyRate === null
                                ? "—"
                                : formatBudgetMoney(
                                    locale,
                                    form.feeCurrency,
                                    effectiveHourlyRate
                                  )
                            }
                          />
                        </div>
                        {formErrors.budgetedHours ? (
                          <span
                            className="cmp-field-error cmp-form-span-full"
                            id={validationErrorId("budgetedHours")}
                          >
                            {formErrors.budgetedHours}
                          </span>
                        ) : null}
                      </EngagementFormSubsection>
                      <EngagementFormSubsection title={copy.feePlanningDetails}>
                        <CmpEngagementFeePlanningTable
                          value={form.feePlanningLines}
                          onChange={(feePlanningLines) =>
                            setForm((current) => ({
                              ...current,
                              feePlanningLines,
                            }))
                          }
                          currency={form.feeCurrency}
                          exchangeRate={appliedExchangeRate}
                          users={users}
                          isPrivateClient={
                            clients.find(
                              (client) => client.id === form.clientId
                            )?.listedOrPrivate === "PRIVATE"
                          }
                          error={formErrors.feePlanningLines}
                        />
                      </EngagementFormSubsection>
                      {editingId && (isTmsSummaryLoading || tmsSummary) ? (
                        <EngagementFormSubsection
                          title={copy.engagementBudgetExecution}
                        >
                          {isTmsSummaryLoading && !tmsSummary ? (
                            <p className="cmp-form-empty-note cmp-form-span-full">
                              Loading TMS summary…
                            </p>
                          ) : tmsSummary ? (
                            <CmpTmsSummary summary={tmsSummary} />
                          ) : null}
                        </EngagementFormSubsection>
                      ) : null}
                    </EngagementAcceptanceSection>

                    <EngagementAcceptanceSection
                      sectionId="notes"
                      onFocus={() => setActiveFormSectionId("notes")}
                      status={engagementSectionStatus("notes")}
                      title={copy.engagementStatusAndRemarks}
                    >
                      <EngagementFormSubsection
                        className="cmp-form-subsection-first"
                        title={copy.engagementRecordDetails}
                      >
                        <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two cmp-form-span-full">
                          <label>
                            {copy.status}
                            <NativeSelect
                              value={form.status}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  status: event.target
                                    .value as CmpEngagementStatus,
                                }))
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {statusLabels[status.value]}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <label
                            className={`cmp-field-span-2${formErrors.remarks ? " cmp-field-invalid" : ""}`}
                          >
                            {copy.remarks}
                            <Textarea
                              aria-label={copy.remarks}
                              {...engagementValidationProps(
                                "remarks",
                                formErrors.remarks
                              )}
                              rows={4}
                              value={form.remarks}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  remarks: event.target.value,
                                }))
                              }
                            />
                            <EngagementFieldError
                              field="remarks"
                              error={formErrors.remarks}
                            />
                          </label>
                        </div>
                      </EngagementFormSubsection>
                    </EngagementAcceptanceSection>
                    <AcceptanceFormPreviewNavigationItem
                      title={copy.clientFormPreview}
                      status={
                        Object.values(formErrors).some(Boolean)
                          ? "error"
                          : engagementRequiredChecks.every(Boolean)
                            ? "complete"
                            : "incomplete"
                      }
                      onSelect={() => activateStep("review")}
                    />
                  </Accordion>
                )}
              </AcceptanceFormWorkspace>
              <CmpAsyncActionFeedback feedback={actionFeedback.feedback} />
            </form>
            <ClientFormMemberActionDialog
              actionKind="assign"
              copy={{
                actionLabel: copy.assignAction,
                actionsColumn: copy.memberDialogActionsColumn,
                emptyLabel: copy.memberDialogNoResults,
                memberColumn: copy.memberDialogMemberColumn,
                memberCountOne: copy.memberDialogMemberCountOne,
                memberCountOther: copy.memberDialogMemberCountOther,
                rankColumn: copy.memberDialogRankColumn,
                roleColumn: copy.memberDialogRoleColumn,
                searchLabel: copy.memberDialogSearch,
                title: copy.assignDialogTitle,
              }}
              isBusy={isCreating || actionFeedback.isRunning}
              open={memberActionDialog === "assign"}
              users={staffOptions}
              onConfirm={(user) => {
                const nextForm = { ...form, draftAssigneeId: user.id };
                setForm(nextForm);
                setMemberActionDialog(null);
                void submitRequest("assign", nextForm).catch(() => {});
              }}
              onOpenChange={(open) => {
                if (!open) {
                  setMemberActionDialog(null);
                }
              }}
            />
          </section>
        </div>
      ) : null}
      <CmpDraftExitDialog
        draftName={form.draftName}
        isSaving={isCreating || actionFeedback.isRunning || isDraftSaving}
        open={isExitDialogOpen}
        onDraftNameChange={(draftName) => {
          setDraftNameError(null);
          setForm((current) => ({ ...current, draftName }));
        }}
        onKeepAndExit={() => {
          void submitRequest("draft")
            .then(() => {
              setIsExitDialogOpen(false);
              closeForm(true);
            })
            .catch(() => {});
        }}
        onOpenChange={setIsExitDialogOpen}
      />
    </section>
  );
}

function RequiredFieldLabel({ label }: { label: string }) {
  return (
    <span className="cmp-field-label">
      {label}
      <span aria-hidden="true" className="cmp-required-mark">
        {" "}
        *
      </span>
    </span>
  );
}

function engagementValidationProps(
  field: keyof EngagementFormState,
  error?: string
) {
  return {
    "aria-describedby": error ? validationErrorId(field) : undefined,
    "aria-invalid": Boolean(error),
    "data-validation-field": field,
  } as const;
}

function EngagementFieldError({
  field,
  error,
}: {
  field: keyof EngagementFormState;
  error?: string;
}) {
  return error ? (
    <span className="cmp-field-error" id={validationErrorId(field)}>
      {error}
    </span>
  ) : null;
}

function EngagementFormSubsection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`cmp-form-subsection cmp-form-span-full${className ? ` ${className}` : ""}`}
    >
      <header className="cmp-form-subsection-heading">
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function EngagementAcceptanceSection({
  sectionId,
  onFocus,
  title,
  status,
  children,
}: {
  sectionId: string;
  onFocus?: () => void;
  title: string;
  status: CmpFormSectionStatus;
  children: ReactNode;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  return (
    <AcceptanceFormAccordionSection
      sectionId={sectionId}
      title={title}
      status={status}
      statusCopy={{
        complete: copy.formComplete,
        error: copy.formHasErrors,
        incomplete: copy.formIncomplete,
        notStarted: copy.formNotStarted,
      }}
      onFocus={onFocus ?? (() => {})}
    >
      <AcceptanceFormSectionContent>{children}</AcceptanceFormSectionContent>
    </AcceptanceFormAccordionSection>
  );
}

function includesText(value: string | null | undefined, filter: string) {
  return !filter || (value ?? "").toLowerCase().includes(filter);
}

function validateEngagementForm(
  form: EngagementFormState,
  _client: CmpClient | undefined
): EngagementFormErrors {
  const budget = deriveFeePlanningBudget(form.feePlanningLines, form.agreedFee);
  const result = CreateCmpEngagementSchema.safeParse(buildCreatePayload(form));
  const errors: EngagementFormErrors = result.success
    ? {}
    : schemaIssuesToErrors<keyof EngagementFormErrors & string>(
        result.error.issues
      );
  if (
    !result.success &&
    result.error.issues.some((issue) => issue.path[0] === "feePlanningLines")
  ) {
    errors.feePlanningLines = "Complete or remove each budget row.";
  }
  if (!form.clientId) {
    errors.clientId = "Client is required.";
  }
  if (!form.engagementCode.trim()) {
    errors.engagementCode = "Engagement Code is required.";
  }
  if (!form.serviceType) {
    errors.serviceType = "Service Type is required.";
  }
  if (form.serviceType === "OTHERS" && !form.otherServiceDescription.trim()) {
    errors.otherServiceDescription =
      "Expected Job / Engagement Type is required for Others.";
  }
  if (!isPositiveDecimal(budget.budgetedHours)) {
    errors.budgetedHours =
      "Add at least one complete budget row with hours greater than 0.";
  }
  if (!isNonNegativeDecimal(form.agreedFee)) {
    errors.agreedFee = "Agreed Fee must be a non-negative amount.";
  }
  return errors;
}

function validateEngagementDraft(
  form: EngagementFormState
): EngagementFormErrors {
  const result = CmpAcceptanceEngagementDraftPayloadSchema.safeParse(
    buildEngagementDraftPayload(form)
  );
  if (result.success) {
    return {};
  }
  const errors = schemaIssuesToErrors<keyof EngagementFormErrors & string>(
    result.error.issues
  );
  if (
    result.error.issues.some((issue) => issue.path[0] === "feePlanningLines")
  ) {
    errors.feePlanningLines = "Check the budget rows before saving.";
  }
  return errors;
}

function isNonNegativeDecimal(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value.trim());
}

function isPositiveDecimal(value: string) {
  return isNonNegativeDecimal(value) && Number(value) > 0;
}

function orderedCmpCurrencies(preferred?: readonly CmpBudgetCurrency[]) {
  const known = new Set(CMP_BUDGET_CURRENCIES);
  const ordered = (preferred ?? []).filter(
    (currency): currency is CmpBudgetCurrency => known.has(currency)
  );
  return [
    ...ordered,
    ...CMP_BUDGET_CURRENCIES.filter((currency) => !ordered.includes(currency)),
  ];
}

function feeExchangeRateForForm(
  form: Pick<
    EngagementFormState,
    | "feeCurrency"
    | "feeExchangeRateSnapshotId"
    | "feeExchangeRateHkdPerUnit"
    | "feeExchangeRateSource"
  >,
  exchangeRates: readonly CmpBudgetExchangeRateSnapshot[]
) {
  const systemRate =
    exchangeRates.find(
      (rate) =>
        rate.id === form.feeExchangeRateSnapshotId ||
        rate.currency === form.feeCurrency
    ) ?? getCmpFixedBudgetExchangeRate(form.feeCurrency);
  if (
    form.feeCurrency !== "HKD" &&
    form.feeExchangeRateSource === "MANUAL" &&
    isPositiveDecimal(form.feeExchangeRateHkdPerUnit)
  ) {
    return { ...systemRate, hkdPerUnit: form.feeExchangeRateHkdPerUnit };
  }
  return systemRate;
}

function formatExchangeRateValue(rate: CmpBudgetExchangeRateSnapshot) {
  const value = Number(rate.hkdPerUnit);
  return Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 8,
      }).format(value)
    : "—";
}

function buildCreatePayload(
  form: EngagementFormState
): CreateCmpEngagementInput {
  const budget = deriveFeePlanningBudget(form.feePlanningLines, form.agreedFee);
  return {
    clientId: form.clientId,
    engagementCode: form.engagementCode.trim(),
    serviceType: form.serviceType as CmpSelectableEngagementServiceType,
    otherServiceDescription:
      form.serviceType === "OTHERS"
        ? form.otherServiceDescription.trim()
        : undefined,
    deliverables: form.deliverables.map((item, index) => ({
      ...item,
      description: item.description?.trim() || undefined,
      sortOrder: index,
    })),
    yearEndDate: form.yearEndDate,
    reportDate: form.reportDate,
    engagementDate: form.engagementDate,
    budgetedHours: budget.budgetedHours,
    agreedFee: form.agreedFee,
    recoveryRate: budget.recoveryRate,
    feePlanningLines: feePlanningLinesForSubmission(form.feePlanningLines),
    feeCurrency: form.feeCurrency,
    feeExchangeRateSnapshotId:
      form.feeCurrency === "HKD" ? undefined : form.feeExchangeRateSnapshotId,
    feeExchangeRateHkdPerUnit:
      form.feeCurrency === "HKD"
        ? undefined
        : form.feeExchangeRateHkdPerUnit,
    feeExchangeRateSource: form.feeExchangeRateSource,
    amlRiskClassification: form.amlRiskClassification,
    engagementRiskClassification: form.engagementRiskClassification,
    picUserId: form.picUserId,
    micUserId: form.micUserId,
    eqReviewerUserId: form.eqReviewerUserId || undefined,
    pic: form.pic.trim(),
    mic: form.mic.trim(),
    eqReviewer: form.eqReviewer.trim() || undefined,
    status: form.status,
    remarks: form.remarks.trim(),
  };
}

function BudgetDerivedMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cmp-budget-derived-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBudgetMoney(
  locale: string,
  currency: CmpBudgetCurrency,
  value: number
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildEngagementDraftPayload(
  form: EngagementFormState
): CmpAcceptanceEngagementDraftPayload {
  const _payload = buildCreatePayload(form);
  return {
    ...Object.fromEntries(
      Object.entries(buildCreatePayload(form)).filter(
        ([, value]) => value !== "" && value !== null && value !== undefined
      )
    ),
    feePlanningLines: feePlanningLinesForDraft(form.feePlanningLines),
  } as CmpAcceptanceEngagementDraftPayload;
}

function formFromEngagement(engagement: CmpEngagement): EngagementFormState {
  return {
    draftName: "",
    clientId: engagement.clientId,
    engagementCode: engagement.engagementCode,
    serviceType: engagement.serviceType,
    otherServiceDescription: engagement.otherServiceDescription ?? "",
    deliverables: engagement.deliverables ?? [],
    yearEndDate: engagement.yearEndDate ?? "",
    reportDate: engagement.reportDate ?? "",
    engagementDate: engagement.engagementDate ?? "",
    budgetedHours: engagement.budgetedHours,
    agreedFee: engagement.agreedFee,
    recoveryRate: engagement.recoveryRate ?? "",
    feePlanningLines: feePlanningLinesFromEngagement(
      engagement.feePlanningLines
    ),
    feeCurrency: engagement.feeCurrency,
    feeExchangeRateSnapshotId: engagement.feeExchangeRateSnapshot?.id ?? "",
    feeExchangeRateHkdPerUnit:
      engagement.feeExchangeRateHkdPerUnit ??
      engagement.feeExchangeRateSnapshot?.hkdPerUnit ??
      getCmpFixedBudgetExchangeRate(engagement.feeCurrency).hkdPerUnit,
    feeExchangeRateSource: engagement.feeExchangeRateSource ?? "SYSTEM",
    amlRiskClassification: engagement.amlRiskClassification,
    engagementRiskClassification: engagement.engagementRiskClassification,
    picUserId: engagement.picUserId ?? "",
    micUserId: engagement.micUserId ?? "",
    eqReviewerUserId: engagement.eqReviewerUserId ?? "",
    pic: engagement.pic ?? "",
    mic: engagement.mic ?? "",
    eqReviewer: engagement.eqReviewer ?? "",
    status: engagement.status,
    remarks: engagement.remarks ?? "",
    micApproverId: "",
    picApproverId: "",
    itApproverId: "",
    draftAssigneeId: "",
  };
}

function formFromSourceEngagement(
  sourceEngagement: CmpEngagement,
  importSections: readonly EngagementImportSection[],
  clientDefaultForm: EngagementFormState,
  availableBudgetStaffIds: ReadonlySet<string>
): EngagementFormState {
  const imports = (section: EngagementImportSection) =>
    includesEngagementImportSection(importSections, section);
  const importedFeePlanningLines = feePlanningLinesFromEngagement(
    sourceEngagement.feePlanningLines
  ).map((line) => {
    const staffAvailable =
      line.assignmentType !== "STAFF" ||
      availableBudgetStaffIds.has(line.staffUserId);
    return {
      ...line,
      assignmentType: staffAvailable ? line.assignmentType : "TBC",
      staffUserId: staffAvailable ? line.staffUserId : "",
    };
  });

  return {
    ...clientDefaultForm,
    ...(imports("business")
      ? {
          serviceType: sourceEngagement.serviceType,
          otherServiceDescription:
            sourceEngagement.otherServiceDescription ?? "",
        }
      : {}),
    ...(imports("reports")
      ? {
          deliverables: sourceEngagement.deliverables ?? [],
          yearEndDate: sourceEngagement.yearEndDate ?? "",
          reportDate: sourceEngagement.reportDate ?? "",
          engagementDate: sourceEngagement.engagementDate ?? "",
        }
      : {}),
    ...(imports("risk")
      ? {
          amlRiskClassification: sourceEngagement.amlRiskClassification,
          engagementRiskClassification:
            sourceEngagement.engagementRiskClassification,
        }
      : {}),
    ...(imports("people")
      ? {
          picUserId: sourceEngagement.picUserId ?? "",
          micUserId: sourceEngagement.micUserId ?? "",
          eqReviewerUserId: sourceEngagement.eqReviewerUserId ?? "",
          pic: sourceEngagement.pic ?? "",
          mic: sourceEngagement.mic ?? "",
          eqReviewer: sourceEngagement.eqReviewer ?? "",
        }
      : {}),
    ...(imports("commercial")
      ? {
          budgetedHours: sourceEngagement.budgetedHours,
          agreedFee: sourceEngagement.agreedFee,
          recoveryRate: sourceEngagement.recoveryRate ?? "",
          feePlanningLines: importedFeePlanningLines,
          feeCurrency: sourceEngagement.feeCurrency,
          feeExchangeRateSnapshotId:
            sourceEngagement.feeExchangeRateSnapshot?.id ?? "",
          feeExchangeRateHkdPerUnit:
            sourceEngagement.feeExchangeRateHkdPerUnit ??
            sourceEngagement.feeExchangeRateSnapshot?.hkdPerUnit ??
            getCmpFixedBudgetExchangeRate(sourceEngagement.feeCurrency)
              .hkdPerUnit,
          feeExchangeRateSource: sourceEngagement.feeExchangeRateSource,
        }
      : {}),
    ...(imports("notes") ? { remarks: sourceEngagement.remarks ?? "" } : {}),
    engagementCode: "",
    status: "ACTIVE",
    micApproverId: "",
    picApproverId: "",
    itApproverId: "",
    draftAssigneeId: "",
  };
}

function defaultClientPrefillOptions(client: CmpClient): ClientPrefillOptions {
  return {
    yearEndDate: Boolean(client.yearEndDate),
    service: Boolean(deriveEngagementServicePrefill(client)),
    pic: Boolean(client.clientPartnerPicId || client.clientPartnerPic),
    mic: Boolean(client.clientManagerMicId || client.clientManagerMic),
    sourceService: true,
    sourceDeliverables: true,
    sourceDates: true,
    sourceCommercial: true,
    sourceRisk: true,
    sourceResponsible: true,
    sourceNotes: true,
  };
}

function prefillOptionsFromImportSections(
  defaults: ClientPrefillOptions,
  importSections: readonly EngagementImportSection[]
): ClientPrefillOptions {
  return {
    ...defaults,
    sourceService: includesEngagementImportSection(importSections, "business"),
    sourceDeliverables: includesEngagementImportSection(
      importSections,
      "reports"
    ),
    sourceDates: includesEngagementImportSection(importSections, "reports"),
    sourceCommercial: includesEngagementImportSection(
      importSections,
      "commercial"
    ),
    sourceRisk: includesEngagementImportSection(importSections, "risk"),
    sourceResponsible: includesEngagementImportSection(
      importSections,
      "people"
    ),
    sourceNotes: includesEngagementImportSection(importSections, "notes"),
  };
}

function deriveEngagementServicePrefill(client: CmpClient): {
  serviceType: CmpSelectableEngagementServiceType;
  description: string;
} | null {
  const sourceValues = [client.serviceType, client.serviceLines]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(/[,;|]/));

  for (const sourceValue of sourceValues) {
    const serviceType = selectableEngagementServiceType(sourceValue);
    if (serviceType) {
      return {
        serviceType,
        description:
          serviceType === "OTHERS"
            ? client.expectedJobOrEngagementType ||
              client.otherServiceDescription ||
              client.taxServiceDetails ||
              client.comSecServiceDetails ||
              sourceValue.trim()
            : "",
      };
    }
  }

  return null;
}

function selectableServicePrefill(
  source: string,
  description: string | null | undefined
): {
  serviceType: CmpSelectableEngagementServiceType;
  description: string;
} | null {
  const serviceType = selectableEngagementServiceType(source);
  if (!serviceType) {
    return null;
  }
  return {
    serviceType,
    description: serviceType === "OTHERS" ? description?.trim() || source : "",
  };
}

function selectableEngagementServiceType(
  source: string
): CmpSelectableEngagementServiceType | null {
  const normalized = source
    .trim()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("special audit")) {
    return "SPECIAL_AUDIT_PRIVATE_CO";
  }
  if (normalized === "review" || normalized.includes("interim review")) {
    return "REVIEW";
  }
  if (normalized === "audit" || normalized.includes("annual audit")) {
    return "ANNUAL_AUDIT";
  }
  if (
    [
      "tax",
      "risk",
      "accounting",
      "accounting service",
      "com sec",
      "others",
      "other",
    ].includes(normalized)
  ) {
    return "OTHERS";
  }
  return null;
}

function cloneDeliverables(
  deliverables: CmpEngagementDeliverable[] | undefined
): CmpEngagementDeliverable[] {
  return (deliverables ?? []).map((deliverable) => ({
    ...deliverable,
    key: `${deliverable.key}-copy-${crypto.randomUUID()}`,
  }));
}

function ClientPrefillContextItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value?.trim() || "-"}</dd>
    </div>
  );
}

function EngagementClientPrefillWorkspace({
  client,
  clientService,
  copy,
  options,
  serviceTypeLabels,
  sourceEngagement,
  sourceEngagementId,
  sourceEngagements,
  statusLabels,
  onChooseAnotherClient,
  onConfirm,
  onOptionChange,
  onSourceEngagementChange,
}: {
  client: CmpClient;
  clientService: {
    serviceType: CmpSelectableEngagementServiceType;
    description: string;
  } | null;
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"];
  options: ClientPrefillOptions;
  serviceTypeLabels: Record<CmpEngagementServiceType, string>;
  sourceEngagement: CmpEngagement | null;
  sourceEngagementId: string;
  sourceEngagements: CmpEngagement[];
  statusLabels: Record<CmpEngagementStatus, string>;
  onChooseAnotherClient: () => void;
  onConfirm: () => void;
  onOptionChange: (
    option: keyof ClientPrefillOptions,
    checked: boolean
  ) => void;
  onSourceEngagementChange: (id: string) => void;
}) {
  const sourceOptions: {
    option: keyof ClientPrefillOptions;
    label: string;
  }[] = [
    {
      option: "sourceService",
      label: copy.engagementClientPrefillSourceService,
    },
    {
      option: "sourceDeliverables",
      label: copy.engagementClientPrefillSourceDeliverables,
    },
    {
      option: "sourceDates",
      label: copy.engagementClientPrefillSourceDates,
    },
    {
      option: "sourceCommercial",
      label: copy.engagementClientPrefillSourceCommercial,
    },
    { option: "sourceRisk", label: copy.engagementClientPrefillSourceRisk },
    {
      option: "sourceResponsible",
      label: copy.engagementClientPrefillSourceResponsible,
    },
    { option: "sourceNotes", label: copy.engagementClientPrefillSourceNotes },
  ];

  const allDefaultOptions: {
    option: keyof ClientPrefillOptions;
    label: string;
    value: string | null | undefined;
  }[] = [
    {
      option: "yearEndDate",
      label: copy.engagementClientPrefillYearEnd,
      value: client.yearEndDate,
    },
    {
      option: "service",
      label: copy.engagementClientPrefillService,
      value: clientService
        ? `${serviceTypeLabels[clientService.serviceType]}${
            clientService.description ? ` · ${clientService.description}` : ""
          }`
        : null,
    },
    {
      option: "pic",
      label: copy.engagementClientPrefillPic,
      value: client.clientPartnerPic,
    },
    {
      option: "mic",
      label: copy.engagementClientPrefillMic,
      value: client.clientManagerMic,
    },
  ];
  const defaultOptions = allDefaultOptions.filter(
    (
      item
    ): item is {
      option: keyof ClientPrefillOptions;
      label: string;
      value: string;
    } => Boolean(item.value)
  );

  return (
    <section
      aria-labelledby="engagement-prefill-title"
      className="mx-auto w-full max-w-6xl rounded-xl border border-border bg-background shadow-sm"
    >
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {copy.engagements}
          </p>
          <h2
            id="engagement-prefill-title"
            className="mt-1 text-xl font-semibold"
          >
            {copy.engagementClientPrefillTitle}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {copy.engagementClientPrefillDescription}
          </p>
        </div>
        <div className="min-w-0 border-l border-border pl-4 text-right max-sm:w-full max-sm:border-l-0 max-sm:pl-0 max-sm:text-left">
          <p className="text-xs text-muted-foreground">
            {copy.engagementClientPrefillClient}
          </p>
          <p className="mt-1 truncate font-medium">
            {client.clientCode} - {client.nameEn || client.nameZh}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {client.status === "RESIGNED"
              ? copy.clientStatusResigned
              : statusLabels[client.status]}
            {" · "}
            {copy.clientFormYearEndMonth}{" "}
            {client.yearEndMonth || copy.formNotSet}
          </p>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
          <section className="min-w-0 rounded-lg border border-border bg-muted/15 p-4 sm:p-5">
            <p className="text-sm font-semibold">
              {copy.engagementClientPrefillSource}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy.engagementClientPrefillSourceDescription}
            </p>
            {sourceEngagements.length ? (
              <div className="mt-4 grid gap-4">
                <NativeSelect
                  aria-label={copy.engagementClientPrefillSource}
                  value={sourceEngagementId}
                  onChange={(event) =>
                    onSourceEngagementChange(event.target.value)
                  }
                >
                  <option value="">
                    {copy.engagementClientPrefillSourceNone}
                  </option>
                  {sourceEngagements.map((engagement) => (
                    <option key={engagement.id} value={engagement.id}>
                      {engagement.engagementCode} ·{" "}
                      {serviceTypeLabels[engagement.serviceType]}
                    </option>
                  ))}
                </NativeSelect>
                {sourceEngagement ? (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {copy.engagementClientPrefillSourceSections}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {sourceOptions.map((item) => (
                        <ClientPrefillOption
                          key={item.option}
                          checked={options[item.option]}
                          label={item.label}
                          onCheckedChange={(checked) =>
                            onOptionChange(item.option, checked)
                          }
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {copy.engagementClientPrefillSourceHint}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {copy.engagementClientPrefillSourceNone}
              </p>
            )}
          </section>

          <section className="min-w-0 rounded-lg border border-border p-4 sm:p-5">
            <p className="text-sm font-semibold">
              {copy.engagementClientPrefillEngagementDefaults}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copy.engagementClientPrefillSourceHint}
            </p>
            {defaultOptions.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {defaultOptions.map((item) => (
                  <PrefillValueOption
                    key={item.option}
                    checked={options[item.option]}
                    label={item.label}
                    value={item.value!}
                    onCheckedChange={(checked) =>
                      onOptionChange(item.option, checked)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {copy.formNotSet}
              </p>
            )}
          </section>

          <section className="min-w-0 rounded-lg border border-border p-4 sm:p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {copy.engagementClientPrefillContext}
              </p>
              <span className="text-xs text-muted-foreground">
                {copy.engagementClientPrefillContextReadonly}
              </span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <ClientPrefillContextItem
                label={copy.groupCode}
                value={client.group?.groupCode || client.groupName}
              />
              <ClientPrefillContextItem
                label={copy.clientFormReportingGaap}
                value={client.reportingGaap}
              />
              <ClientPrefillContextItem
                label={copy.clientFormIndustry}
                value={
                  client.industryOtherDescription || client.hsicSectionCode
                }
              />
              <ClientPrefillContextItem
                label={copy.placeOfIncorporation}
                value={client.placeOfIncorporation}
              />
              <ClientPrefillContextItem
                label={copy.registeredAddress}
                value={client.address}
                wide
              />
              <ClientPrefillContextItem
                label={copy.clientFormContactPerson}
                value={client.contactPerson}
              />
              <ClientPrefillContextItem
                label={copy.email}
                value={client.email}
              />
            </dl>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-5 py-4 sm:px-6">
        <p className="text-xs text-muted-foreground">
          {copy.engagementClientPrefillContextReadonly}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={onChooseAnotherClient}
            type="button"
            variant="outline"
          >
            {copy.engagementClientPrefillChooseAnother}
          </Button>
          <Button onClick={onConfirm} type="button">
            {copy.engagementClientPrefillUse}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </section>
  );
}

function PrefillValueOption({
  checked,
  label,
  value,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  value: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {value}
        </span>
      </span>
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
    </label>
  );
}

function ClientPrefillOption({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
      <span>{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
    </label>
  );
}

function labelForServiceType(value: CmpEngagementServiceType) {
  return (
    SERVICE_TYPES.find((serviceType) => serviceType.value === value)?.label ??
    value
  );
}

function _labelForStatus(value: CmpEngagementStatus) {
  return STATUSES.find((status) => status.value === value)?.label ?? value;
}

function engagementRiskLabel(
  value: EngagementFormState["engagementRiskClassification"],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  return value === "GREATER_THAN_NORMAL"
    ? copy.engagementRiskGreaterThanNormal
    : copy.engagementRiskNormal;
}

function _requiredResponsiblePeopleLabel(
  risk: EngagementFormState["engagementRiskClassification"],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  return risk === "GREATER_THAN_NORMAL"
    ? `${copy.pic}, ${copy.mic}, ${copy.eqReviewer}`
    : `${copy.pic}, ${copy.mic}`;
}
