"use client";
import type {
  CorrectProjectConfirmationTrackingInput,
  ConfirmationDraftPayload,
  ConfirmationDraftPatchSource,
  ConfirmationDraftTemplateCode,
  ConfirmationDifferenceStatus,
  ConfirmationStatus,
  ConfirmationType,
  CreateProjectConfirmationDispatchInput,
  CreateProjectConfirmationFollowUpEventInput,
  ReviewProjectConfirmationResponseInput,
} from "@project-wing/shared";
import {
  canGlobalRoleManageConfirmationTemplates,
  isConfirmationCustomTemplateCode,
} from "@project-wing/shared";
import {
  Button as MobileButton,
  useCompactViewport,
  MobileActionSheet,
} from "@project-wing/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ChevronLeft,
  Copy,
  ChevronsUpDown,
  Download,
  FileText,
  FolderInput,
  Handshake,
  Landmark,
  MoreHorizontal,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Scale,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  ConfirmationTemplateLibraryFile,
  ConfirmationResponseLibraryFile,
  Project,
  ProjectConfirmationBaseInformation,
  ProjectConfirmation,
  ProjectConfirmationResponseArtifact,
  ProjectConfirmationDefaults,
  ProjectMember,
  UpdateConfirmationTemplateLibraryDesignInput,
  User,
  UserMailConnection,
} from "../api/client";
import { ApiError, api, getProjectConfirmationAttachment } from "../api/client";
import { confirmationResponseRoutingCopy } from "../i18n/confirmation-response-routing-copy";
import {
  defaultConfirmationsCopy,
  defaultConfirmationResponseImportCopy,
  defaultConfirmationResponseWarehouseCopy,
  defaultConfirmationInformationLibraryCopy,
} from "../i18n/dictionaries";
import type { Dictionary } from "../i18n/dictionaries";
import { getUserFacingErrorMessage } from "../lib/error-toast";
import { openAuthorizedPreviewWindow } from "../lib/open-preview-window";
import {
  PREVIEW_QUERY_GC_TIME_MS,
  PREVIEW_QUERY_META,
  PREVIEW_QUERY_STALE_TIME_MS,
} from "../lib/preview-query-cache";
import { useSurfaceTransition } from "../lib/use-surface-transition";
import { ConfirmationResponseWarehouse as ProjectResponseWarehouse } from "./confirmation-response-warehouse";
import { getConfirmationBaseInformationFallback } from "./confirmations/confirmation-base-information-fallback";
import { ConfirmationBaseInformationLayout } from "./confirmations/confirmation-base-information-layout";
import {
  getConfirmationCategoryTone,
  getConfirmationTypeTone,
} from "./confirmations/confirmation-category-tone";
import { ConfirmationFollowUpPanel } from "./confirmations/confirmation-follow-up-panel";
import {
  ConfirmationGeneralInformationSettings,
  useConfirmationGeneralFields,
  useConfirmationGeneralLayout,
} from "./confirmations/confirmation-general-information-settings";
import { ConfirmationInformationLibrary } from "./confirmations/confirmation-information-library";
import type { ConfirmationInformationLibraryCopy } from "./confirmations/confirmation-information-library";
import { clearConfirmationInformationLibraryDraftValuesForTemplate } from "./confirmations/confirmation-information-library-match";
import { LogisticsUnreadDot } from "./confirmations/confirmation-logistics-unread";
import {
  ConfirmationMobileDirectoryProvider,
  ConfirmationMobileDirectoryButton,
  ConfirmationMobileHeading,
} from "./confirmations/confirmation-mobile-heading";
import { ConfirmationOverviewMatrix } from "./confirmations/confirmation-overview-matrix";
import type { ConfirmationOverviewCellSelection } from "./confirmations/confirmation-overview-matrix";
import { isConfirmationArchiveComplete } from "./confirmations/confirmation-presentation";
import { ConfirmationReceivedDateField } from "./confirmations/confirmation-received-date-field";
import { ConfirmationRegisterDataGrid as ConfirmationRegister } from "./confirmations/confirmation-register-data-grid";
import {
  DEFAULT_CONFIRMATION_REGISTER_FILTERS,
  hasConfirmationRegisterFilters,
  isUnclassifiedConfirmation,
  matchesConfirmationRegisterFilters,
} from "./confirmations/confirmation-register-model";
import type { ConfirmationRegisterFilters } from "./confirmations/confirmation-register-model";
import { ConfirmationResponseFilePicker } from "./confirmations/confirmation-response-file-picker";
import { ConfirmationResponsePreview } from "./confirmations/confirmation-response-preview";
import { ConfirmationResponseWarehouse } from "./confirmations/confirmation-response-warehouse";
import { ConfirmationReviewResolution } from "./confirmations/confirmation-review-resolution";
import { ConfirmationTemplateLibraryDataGrid } from "./confirmations/confirmation-template-library-data-grid";
import { ConfirmationTemplateLibraryFieldOverlay } from "./confirmations/confirmation-template-library-preview";
import { ConfirmationTemplateWorkbench } from "./confirmations/confirmation-template-workbench";
import { ConfirmationWorkflowTracker } from "./confirmations/confirmation-workflow-tracker";
import surfaceMotion from "./confirmations/confirmation-surface-motion.module.css";
import { ProjectConfirmationDispatchAction } from "./confirmations/project-confirmation-dispatch-action";
import {
  getEditableConfirmationDraftPayload,
  ProjectConfirmationEditor,
} from "./confirmations/project-confirmation-editor";
import type {
  ConfirmationDerivedValues,
  ConfirmationDownloadFormat,
} from "./confirmations/project-confirmation-editor";
import { PreviewPanelActions } from "./extend/preview-panel-actions";
import { BlobFilePreviewPane, getFilePreviewKind } from "./file-preview-pane";
import { SplitterRail } from "./splitter-rail";
import { useToast } from "./toast";

import baseInformationStyles from "./confirmations/confirmation-base-information-mobile.module.css";
import mobileStyles from "./confirmations/confirmation-project-mobile.module.css";

export { isConfirmationArchiveComplete } from "./confirmations/confirmation-presentation";

type ProjectConfirmationsCopy = Dictionary["confirmations"];
type PreparationStage = "draft" | "tracking" | "review";
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
  targetEventId?: string;
  previous?: ConfirmationPhaseSnapshot;
  next?: ConfirmationPhaseSnapshot;
};
type ConfirmationReviewTransitionEvent = NonNullable<
  ProjectConfirmation["followUpEvents"]
>[number];
type ConfirmationFilter<T extends string> = T | "ALL";
type ConfirmationCategory =
  | "FINANCIAL"
  | "CORRESPONDENCE"
  | "OTHER"
  | "UNCLASSIFIED";
type ConfirmationNavigationKey =
  | "OTHER_TYPE"
  | "OVERVIEW"
  | "BASE_INFORMATION"
  | "ALL"
  | "RESPONSE_WAREHOUSE"
  | ConfirmationCategory
  | ConfirmationType
  | "UNCLASSIFIED"
  | "RECYCLE_BIN"
  | "TEMPLATE_LIBRARY"
  | "INFORMATION_LIBRARY";
type GeneralFillValues = {
  clientName: string;
  confirmationDate: string;
  reference: string;
  pic: string;
  mic: string;
  reportDate: string;
};

type BaseInformationFormValues = GeneralFillValues & {
  baseInformation: ProjectConfirmationBaseInformation;
};

const FILTER_TYPES: ConfirmationType[] = [
  "BANK",
  "INTERMEDIARY",
  "BALANCE",
  "RELATED_PARTY",
  "LAWYER",
  "INVENTORY",
  "OTHER",
  "UNCLASSIFIED",
];
const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_CONTENT_TYPE = "application/pdf";
const TEMPLATE_FILE_ACCEPT = `.pdf,.docx,${PDF_CONTENT_TYPE},${DOCX_CONTENT_TYPE}`;
const CATEGORY_TYPES: Record<ConfirmationCategory, ConfirmationType[]> = {
  FINANCIAL: ["BANK", "INTERMEDIARY"],
  CORRESPONDENCE: ["BALANCE", "RELATED_PARTY"],
  OTHER: ["LAWYER", "INVENTORY", "OTHER"],
  UNCLASSIFIED: ["UNCLASSIFIED"],
};
const MANAGED_TEMPLATE_TYPES: readonly {
  code: ConfirmationDraftTemplateCode;
  confirmationType: ConfirmationType;
}[] = [
  { code: "STANDARD_FINANCIAL_INSTITUTION", confirmationType: "BANK" },
  { code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH", confirmationType: "BANK" },
  {
    code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    confirmationType: "INTERMEDIARY",
  },
  {
    code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
    confirmationType: "INTERMEDIARY",
  },
];

const MANAGED_TEMPLATE_CODE_SET = new Set<ConfirmationDraftTemplateCode>(
  MANAGED_TEMPLATE_TYPES.map(({ code }) => code).filter(
    (code) => code !== "STANDARD_FINANCIAL_INSTITUTION"
  )
);

function getConfirmationSynchronizationKey(confirmation: ProjectConfirmation) {
  return [
    confirmation.id,
    confirmation.type,
    confirmation.status,
    confirmation.draftTemplateCode ?? "",
    confirmation.draftUpdatedAt ?? "",
    confirmation.updatedAt,
    confirmation.currentArtifact?.id ?? "",
    confirmation.currentArtifact?.version ?? "",
    confirmation.currentArtifact?.templateCode ?? "",
    JSON.stringify(confirmation.dispatches ?? []),
    JSON.stringify(confirmation.responses ?? []),
    JSON.stringify(confirmation.followUpEvents ?? []),
    JSON.stringify(confirmation.empImportItems ?? []),
  ].join("|");
}

function getConfirmationRevision(confirmation: ProjectConfirmation) {
  return Math.max(
    ...[confirmation.draftUpdatedAt, confirmation.updatedAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter(Number.isFinite)
  );
}

export function getConfirmationPreviewSourceRevision(
  confirmation: ProjectConfirmation | null
) {
  const draftPayload = isRecord(confirmation?.draftPayload)
    ? confirmation.draftPayload
    : null;
  return JSON.stringify({
    templateLibrarySource: draftPayload?.templateLibrarySource ?? null,
  });
}

export const defaultProjectConfirmationsCopy = defaultConfirmationsCopy;

export function invalidateConfirmationEmpImportQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  projectId: string
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["project-confirmations", projectId],
    }),
    queryClient.invalidateQueries({ queryKey: ["workflow", projectId] }),
    queryClient.invalidateQueries({
      queryKey: ["project-attachments", projectId],
    }),
    queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
  ]);
}

function isDocxTemplate(template: ConfirmationTemplateLibraryFile) {
  return (
    template.fileName.toLowerCase().endsWith(".docx") &&
    template.mimeType === DOCX_CONTENT_TYPE
  );
}

function isPdfTemplate(template: ConfirmationTemplateLibraryFile) {
  return (
    template.fileName.toLowerCase().endsWith(".pdf") &&
    template.mimeType === PDF_CONTENT_TYPE
  );
}

function isTemplateDesignable(template: ConfirmationTemplateLibraryFile) {
  return isDocxTemplate(template) || isPdfTemplate(template);
}

type ConfirmationTemplateDesignStatus = "DRAFT" | "ENABLED" | "DISABLED";

type ConfirmationTemplateStatusApi = {
  updateConfirmationTemplateLibraryStatus: (
    templateId: string,
    input: { designStatus: ConfirmationTemplateDesignStatus }
  ) => Promise<ConfirmationTemplateLibraryFile>;
  bulkUpdateConfirmationTemplateLibraryStatus: (input: {
    templateIds: string[];
    designStatus: ConfirmationTemplateDesignStatus;
  }) => Promise<ConfirmationTemplateLibraryFile[]>;
};

const templateStatusApi = api as unknown as ConfirmationTemplateStatusApi;

function getTemplateDesignStatus(
  template: ConfirmationTemplateLibraryFile
): ConfirmationTemplateDesignStatus {
  return template.designStatus as ConfirmationTemplateDesignStatus;
}

const EMPTY_CONFIRMATIONS: ProjectConfirmation[] = [];
const EMPTY_RESPONSE_ARTIFACTS: ProjectConfirmationResponseArtifact[] = [];

function splitDefaultRows(value: string | null | undefined) {
  const rows = (value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return rows.length ? rows : [""];
}

function getBaseInformationFormValues(
  defaults: ProjectConfirmationDefaults | null | undefined
): BaseInformationFormValues {
  const base = defaults?.baseInformation;
  return {
    clientName: defaults?.clientName ?? "",
    confirmationDate: defaults?.confirmationDate ?? "",
    reference: defaults?.reference ?? "",
    pic: defaults?.pic ?? "",
    mic: defaults?.mic ?? "",
    reportDate: defaults?.reportDate ?? "",
    baseInformation: {
      ...(base?.customFields
        ? { customFields: base.customFields.map((field) => ({ ...field })) }
        : {}),
      clientNames: base?.clientNames?.length
        ? [...base.clientNames]
        : splitDefaultRows(defaults?.clientName),
      references: base?.references?.length
        ? [...base.references]
        : splitDefaultRows(defaults?.reference),
      banks: base?.banks?.length
        ? base.banks.map((bank) => ({ ...bank }))
        : [{ name: "", account: "", address: "" }],
    },
  };
}

type GeneralFillDraftPayload =
  | ConfirmationDraftPayload
  | Record<string, unknown>;

const GENERAL_FILL_DRAFT_FIELDS = [
  ["clientName", "clientName"],
  ["officeDate", "confirmationDate"],
  ["referenceCode", "reference"],
  ["picName", "pic"],
  ["micName", "mic"],
  ["micNameAndInitial", "mic"],
  ["reportDate", "reportDate"],
] as const;

function hasDraftText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function mergeGeneralFillDraftPayload(
  payload: GeneralFillDraftPayload,
  previous: GeneralFillDraftPayload | null | undefined,
  defaults: ProjectConfirmationDefaults | null | undefined
): ConfirmationDraftPayload {
  const merged = { ...(payload as Record<string, unknown>) };
  const previousRecord = (previous ?? {}) as Record<string, unknown>;

  for (const [draftKey, defaultKey] of GENERAL_FILL_DRAFT_FIELDS) {
    if (hasDraftText(merged[draftKey])) {
      continue;
    }
    if (
      Object.hasOwn(merged, draftKey) &&
      Object.hasOwn(previousRecord, draftKey)
    ) {
      continue;
    }
    const previousValue = previousRecord[draftKey];
    if (hasDraftText(previousValue)) {
      merged[draftKey] = previousValue;
      continue;
    }
    const defaultValue = defaults?.[defaultKey];
    if (!hasDraftText(defaultValue)) {
      continue;
    }
    merged[draftKey] = defaultValue;
  }

  return merged as ConfirmationDraftPayload;
}

export function getConfirmationEditorDraftPayload(
  draft: ConfirmationDraftPayload | null | undefined,
  defaults: ProjectConfirmationDefaults | null | undefined
): ConfirmationDraftPayload {
  const currentDraft = draft ?? null;
  return mergeGeneralFillDraftPayload(
    getEditableConfirmationDraftPayload(currentDraft),
    currentDraft,
    defaults
  );
}

const CONFIRMATION_RESPONSE_FILE_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const CONFIRMATION_NAV_MIN_WIDTH = 224;
const CONFIRMATION_NAV_MAX_WIDTH = 320;
const CONFIRMATION_NAV_DEFAULT_WIDTH = 256;
const CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD = 48;
const CONFIRMATION_NAV_DRAG_COLLAPSE_THRESHOLD = 48;

type ConfirmationLifecycleBatchResult = {
  succeeded: ProjectConfirmation[];
  failed: {
    confirmation: ProjectConfirmation;
    error: unknown;
  }[];
};

async function runConfirmationLifecycleBatch(
  confirmations: ProjectConfirmation[],
  operation: (confirmation: ProjectConfirmation) => Promise<unknown>
): Promise<ConfirmationLifecycleBatchResult> {
  const succeeded: ProjectConfirmation[] = [];
  const failed: ConfirmationLifecycleBatchResult["failed"] = [];

  for (const confirmation of confirmations) {
    try {
      await operation(confirmation);
      succeeded.push(confirmation);
    } catch (error) {
      failed.push({ confirmation, error });
    }
  }

  return { succeeded, failed };
}

type ProjectConfirmationsPanelProps = {
  projectId: string;
  project?: Project;
  currentUser?: Pick<User, "id" | "name" | "email" | "globalRole"> | null;
  members: ProjectMember[];
  copy?: ProjectConfirmationsCopy;
  responseImportCopy?: Dictionary["confirmationCenter"]["intranet"]["responseWarehousePanel"];
  responseWarehouseCopy?: Dictionary["confirmationCenter"]["intranet"]["responseWarehouseWorkspace"];
  commonCopy: Dictionary["common"];
  locale: string;
  readOnly?: boolean;
  initialConfirmationId?: string | null;
  initialConfirmationView?: string | null;
  onViewProjectFiles?: () => void;
};

export function ProjectConfirmationsPanel({
  projectId,
  project,
  currentUser,
  members,
  copy = defaultProjectConfirmationsCopy,
  responseImportCopy = defaultConfirmationResponseImportCopy,
  responseWarehouseCopy = defaultConfirmationResponseWarehouseCopy,
  commonCopy,
  locale,
  readOnly = false,
  initialConfirmationId = null,
  initialConfirmationView = null,
  onViewProjectFiles,
}: ProjectConfirmationsPanelProps) {
  const phone = useCompactViewport(767.98);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const mobileWorkspaceRef = useRef<HTMLDivElement>(null);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const informationLibraryCopy =
    (
      copy as ProjectConfirmationsCopy & {
        informationLibrary?: ConfirmationInformationLibraryCopy;
      }
    ).informationLibrary ?? defaultConfirmationInformationLibraryCopy;
  const queryClient = useQueryClient();
  const routingCopy =
    confirmationResponseRoutingCopy[
      locale.startsWith("zh") ? "zh-CN" : "en-US"
    ];
  const { toast } = useToast();
  const [activeConfirmation, setActiveConfirmation] =
    useState<ProjectConfirmation | null>(null);
  const [activeStage, setActiveStage] = useState<PreparationStage>("draft");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pendingNoSourceResponse, setPendingNoSourceResponse] =
    useState<ConfirmationResponseLibraryFile | null>(null);
  const pendingNoSourceCreateRef = useRef(false);
  const [baseInformationValues, setBaseInformationValues] =
    useState<BaseInformationFormValues>(() =>
      getBaseInformationFormValues(null)
    );
  const [newCategory, setNewCategory] =
    useState<ConfirmationCategory>("FINANCIAL");
  const [newType, setNewType] = useState<ConfirmationType>("BANK");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCounterparty, setUploadCounterparty] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [withdrawResponseDialogOpen, setWithdrawResponseDialogOpen] =
    useState(false);
  const [undoReviewDialogOpen, setUndoReviewDialogOpen] = useState(false);
  const [empImportConfirmationIds, setEmpImportConfirmationIds] = useState<
    string[] | null
  >(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const saved = window.history.state?.confirmationArchiveView;
    return saved?.projectId === projectId &&
      new URLSearchParams(window.location.search).get("workspace") ===
        "confirmations"
      ? saved.confirmationIds
      : null;
  });
  const [empImportBusy, setEmpImportBusy] = useState(false);
  const closeEmpImport = () => {
    setEmpImportConfirmationIds(null);
    const { confirmationArchiveView: _archiveView, ...state } =
      window.history.state ?? {};
    window.history.replaceState(state, "");
  };

  const [voidingConfirmations, setVoidingConfirmations] = useState<
    ProjectConfirmation[]
  >([]);
  const [lifecycleActionResetKey, setLifecycleActionResetKey] = useState(0);
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [responseReceivedAt, setResponseReceivedAt] = useState(() =>
    toLocalDateTimeInput(new Date())
  );
  const [responseChannel, setResponseChannel] = useState<
    "PAPER" | "ELECTRONIC" | "OTHER"
  >("PAPER");
  const [responseReference, setResponseReference] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [uploadedDocxUrl, setUploadedDocxUrl] = useState<string | null>(null);
  const [uploadedPdfError, setUploadedPdfError] = useState(false);
  const [navigationFilter, setNavigationFilter] =
    useState<ConfirmationNavigationKey>(
      initialConfirmationView === "unmatched" ? "RESPONSE_WAREHOUSE" : "ALL"
    );
  const [registerScope, setRegisterScope] =
    useState<ConfirmationNavigationKey>("ALL");
  const [registerFilters, setRegisterFilters] =
    useState<ConfirmationRegisterFilters>(
      DEFAULT_CONFIRMATION_REGISTER_FILTERS
    );
  const [namePrefix, setNamePrefix] = useState("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [completionFeedbackId, setCompletionFeedbackId] = useState<
    string | null
  >(null);
  const openedDeepLinkRef = useRef<string | null>(null);
  const categoryNavigationPanelRef = useRef<PanelImperativeHandle | null>(null);
  const categoryNavigationSplitterRef = useRef<HTMLDivElement | null>(null);
  const categoryNavigationLastWidthRef = useRef(CONFIRMATION_NAV_DEFAULT_WIDTH);
  const categoryNavigationResizeSessionRef = useRef<{
    previousWidth: number;
    startWidth: number;
    wasCollapsed: boolean;
    currentWidth: number;
    restoreWidth: number;
  } | null>(null);
  const [categoryNavigationWidth, setCategoryNavigationWidth] = useState(
    CONFIRMATION_NAV_DEFAULT_WIDTH
  );
  const [isCategoryNavigationCollapsed, setIsCategoryNavigationCollapsed] =
    useState(false);
  const [isCategoryNavigationDragging, setIsCategoryNavigationDragging] =
    useState(false);
  const [
    categoryNavigationDragPreviewExpanded,
    setCategoryNavigationDragPreviewExpanded,
  ] = useState(false);

  const confirmations = useQuery({
    queryKey: ["project-confirmations", projectId],
    queryFn: () => api.projectConfirmations(projectId),
    refetchInterval: 30_000,
  });
  const confirmationDefaults = useQuery<ProjectConfirmationDefaults>({
    queryKey: ["project-confirmation-defaults", projectId],
    queryFn: () => api.projectConfirmationDefaults(projectId),
  });
  const confirmationTemplateLibrary = useQuery({
    queryKey: ["confirmation-template-library"],
    queryFn: api.confirmationTemplateLibrary,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const pendingResponses = useQuery({
    queryKey: ["project-pending-confirmation-responses", projectId],
    queryFn: () => api.projectPendingConfirmationResponses(projectId),
    refetchInterval: 30_000,
  });
  const mailConnection = useQuery<UserMailConnection>({
    queryKey: ["user-mail-connection"],
    queryFn: api.userMailConnection,
  });
  const rows = confirmations.data ?? EMPTY_CONFIRMATIONS;
  const confirmationContentSurfaceRef = useSurfaceTransition<HTMLElement>(
    `confirmation:${projectId}:${confirmations.isLoading ? "loading" : "ready"}:${activeConfirmation?.id ?? "directory"}:${activeConfirmation ? activeStage : navigationFilter}`,
    {
      initial: true,
      variant: "content",
    }
  );
  const activeConfirmationType = activeConfirmation?.type;
  const availableTemplateOptions = useMemo(() => {
    const libraryTemplates = confirmationTemplateLibrary.data ?? [];
    const builtInOptions = MANAGED_TEMPLATE_TYPES.filter(
      ({ code, confirmationType }) => {
        const libraryTemplate = libraryTemplates.find(
          (template) => template.code === code
        );
        return (
          Boolean(libraryTemplate) &&
          (!activeConfirmationType ||
            confirmationType === activeConfirmationType) &&
          libraryTemplate?.designStatus === "ENABLED"
        );
      }
    ).map(({ code }) => ({
      code,
      label:
        copy.draftTemplateLabels[code as keyof typeof copy.draftTemplateLabels],
    }));
    const customOptions = libraryTemplates
      .filter(
        (template) =>
          !template.isBuiltIn &&
          template.designStatus === "ENABLED" &&
          (!activeConfirmationType ||
            template.confirmationType === activeConfirmationType)
      )
      .map((template) => ({
        code: template.code as ConfirmationDraftTemplateCode,
        label: template.name,
      }));
    return [...builtInOptions, ...customOptions];
  }, [activeConfirmationType, confirmationTemplateLibrary.data, copy]);
  const templateLabelOptions = useMemo(
    () =>
      (confirmationTemplateLibrary.data ?? [])
        .filter((template) => !template.isBuiltIn)
        .map((template) => ({
          code: template.code as ConfirmationDraftTemplateCode,
          label: template.name,
        })),
    [confirmationTemplateLibrary.data]
  );
  const registerFilterSourceRows = useMemo(
    () =>
      rows.filter(
        (confirmation) =>
          matchesConfirmationNavigation(confirmation, navigationFilter) &&
          matchesConfirmationNavigation(confirmation, registerScope)
      ),
    [navigationFilter, registerScope, rows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = namePrefix.trim().toLocaleLowerCase(locale);
    return registerFilterSourceRows
      .filter((confirmation) =>
        matchesConfirmationRegisterFilters(confirmation, registerFilters)
      )
      .filter(
        (confirmation) =>
          !normalizedQuery ||
          [
            confirmation.confirmationCode ?? "",
            confirmation.counterpartyName,
            confirmation.respondingEntityName ?? "",
            getConfirmationDisplayName(confirmation, copy),
          ].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery)
          )
      );
  }, [copy, locale, namePrefix, registerFilterSourceRows, registerFilters]);
  const hasFilters = hasConfirmationRegisterFilters(registerFilters);
  const hasSearchOrFilters =
    hasFilters ||
    navigationFilter !== "ALL" ||
    registerScope !== "ALL" ||
    Boolean(namePrefix.trim());
  const activeUploadedDocumentAttachment = activeConfirmation
    ? getProjectConfirmationAttachment(activeConfirmation)
    : null;
  const activeUploadedDocumentName =
    activeUploadedDocumentAttachment?.originalFileName?.trim() ?? "";
  const activeUploadedDocumentMimeType =
    activeUploadedDocumentAttachment?.originalMimeType?.trim() ?? "";
  const activeUploadedDocumentUnsupported = Boolean(
    activeConfirmation?.currentArtifact?.templateCode === "UPLOADED_DOCUMENT" &&
    (activeUploadedDocumentAttachment?.previewability === "DOWNLOAD_ONLY" ||
      activeUploadedDocumentAttachment?.previewability === "UNSUPPORTED" ||
      (activeUploadedDocumentName &&
        activeUploadedDocumentAttachment?.previewability !== "INLINE" &&
        getFilePreviewKind(
          activeUploadedDocumentName,
          activeUploadedDocumentMimeType
        ) === null))
  );
  const activeConfirmationId = activeConfirmation?.id ?? null;
  const activeDraftTemplateCode = activeConfirmation?.draftTemplateCode ?? null;
  const activeArtifactId = activeConfirmation?.currentArtifact?.id ?? null;
  const activeArtifactVersion =
    activeConfirmation?.currentArtifact?.version ?? null;
  const activeArtifactTemplateCode =
    activeConfirmation?.currentArtifact?.templateCode ?? null;
  useEffect(() => {
    if (!activeConfirmationId) {
      return;
    }
    const refreshed = rows.find((item) => item.id === activeConfirmationId);
    if (!refreshed) {
      return;
    }
    setActiveConfirmation((current) => {
      if (!current || current.id !== activeConfirmationId) {
        return current;
      }
      if (
        getConfirmationSynchronizationKey(refreshed) ===
        getConfirmationSynchronizationKey(current)
      ) {
        return current;
      }
      if (
        getConfirmationRevision(refreshed) < getConfirmationRevision(current)
      ) {
        return current;
      }
      return refreshed;
    });
  }, [activeConfirmationId, rows]);

  useEffect(() => {
    if (
      !initialConfirmationId ||
      openedDeepLinkRef.current === initialConfirmationId
    ) {
      return;
    }
    const confirmation = rows.find((item) => item.id === initialConfirmationId);
    if (!confirmation) {
      return;
    }
    openedDeepLinkRef.current = initialConfirmationId;
    setActiveConfirmation(confirmation);
    const stage = new URLSearchParams(window.location.search).get(
      "confirmationStage"
    );
    setActiveStage(
      stage === "draft" || stage === "tracking" || stage === "review"
        ? stage
        : getInitialStage(confirmation)
    );
    setValidationErrors([]);
  }, [initialConfirmationId, rows]);

  useEffect(() => {
    let active = true;
    let pdfObjectUrl: string | null = null;
    setUploadedPdfUrl(null);
    setUploadedDocxUrl(null);
    setUploadedPdfError(false);
    const usesManagedTemplatePreview = Boolean(
      activeDraftTemplateCode &&
      MANAGED_TEMPLATE_CODE_SET.has(activeDraftTemplateCode)
    );
    const usesCustomTemplatePreview = Boolean(
      activeDraftTemplateCode &&
      isConfirmationCustomTemplateCode(activeDraftTemplateCode)
    );
    const usesStandardPdfPreview =
      activeDraftTemplateCode === "STANDARD_FINANCIAL_INSTITUTION";
    if (
      !activeConfirmationId ||
      (!usesManagedTemplatePreview &&
        !usesCustomTemplatePreview &&
        !usesStandardPdfPreview &&
        activeArtifactTemplateCode !== "UPLOADED_DOCUMENT")
    ) {
      return;
    }
    if (activeUploadedDocumentUnsupported) {
      return;
    }

    const previewRevision = [
      activeArtifactId ?? "draft",
      activeArtifactVersion ?? 0,
      activeArtifactTemplateCode ?? activeDraftTemplateCode ?? "",
    ].join(":");
    void queryClient
      .fetchQuery({
        queryKey: [
          "project-confirmation-preview",
          "pdf",
          projectId,
          activeConfirmationId,
          previewRevision,
        ],
        queryFn: () =>
          api.previewProjectConfirmationPdf(projectId, activeConfirmationId),
        staleTime: PREVIEW_QUERY_STALE_TIME_MS,
        gcTime: PREVIEW_QUERY_GC_TIME_MS,
        meta: PREVIEW_QUERY_META,
      })
      .then((blob) => {
        if (!active || typeof URL.createObjectURL !== "function") {
          return;
        }
        pdfObjectUrl = URL.createObjectURL(blob);
        setUploadedPdfUrl(pdfObjectUrl);
      })
      .catch(() => {
        if (active) {
          setUploadedPdfError(true);
        }
      });
    return () => {
      active = false;
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [
    activeArtifactId,
    activeArtifactTemplateCode,
    activeArtifactVersion,
    activeConfirmationId,
    activeDraftTemplateCode,
    activeUploadedDocumentUnsupported,
    projectId,
    queryClient,
  ]);

  const refreshConfirmationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["project-confirmations", projectId],
      }),
      queryClient.invalidateQueries({ queryKey: ["confirmations"] }),
      queryClient.invalidateQueries({ queryKey: ["auditLogs", projectId] }),
    ]);
  };

  const createDraft = useMutation({
    mutationFn: (input: {
      type?: ConfirmationType;
      templateCode?: ConfirmationDraftTemplateCode;
      bankEntryId?: string;
    }) =>
      api.createProjectConfirmation(projectId, {
        draftPayload: input.bankEntryId
          ? { confirmationInformationLibraryEntryId: input.bankEntryId }
          : {},
        ...(input.type ? { type: input.type } : {}),
        ...(input.templateCode
          ? { draftTemplateCode: input.templateCode }
          : {}),
      }),
    onSuccess: async (confirmation) => {
      if (pendingNoSourceResponse) {
        try {
          await api.routeConfirmationResponseLibraryFile(
            pendingNoSourceResponse.id,
            {
              action: "MATCH_CONFIRMATION",
              projectId,
              confirmationId: confirmation.id,
            }
          );
          const refreshedConfirmations =
            await api.projectConfirmations(projectId);
          const refreshedConfirmation =
            refreshedConfirmations.find(
              (item) => item.id === confirmation.id
            ) ?? confirmation;
          setPendingNoSourceResponse(null);
          pendingNoSourceCreateRef.current = false;
          setActiveConfirmation(refreshedConfirmation);
          setActiveStage("review");
          await refreshConfirmationQueries();
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["project-pending-confirmation-responses", projectId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["project-confirmation-response-warehouse", projectId],
            }),
          ]);
          toast({ title: routingCopy.updateSuccess });
          return;
        } catch (error) {
          pendingNoSourceCreateRef.current = false;
          setActiveConfirmation(confirmation);
          setActiveStage("draft");
          await refreshConfirmationQueries();
          toast({
            title: routingCopy.updateError,
            description: error instanceof Error ? error.message : undefined,
            variant: "destructive",
          });
          return;
        }
      }
      pendingNoSourceCreateRef.current = false;
      setActiveConfirmation(confirmation);
      setActiveStage("draft");
      setValidationErrors([]);
      await refreshConfirmationQueries();
      toast({ title: copy.createSuccessTitle });
    },
    onError: (error) => {
      pendingNoSourceCreateRef.current = false;
      showMutationError(
        error,
        copy.createErrorTitle,
        copy.validationErrorMessages,
        toast,
        setValidationErrors
      );
    },
  });

  const saveBaseInformation = useMutation({
    mutationFn: (input: BaseInformationFormValues) =>
      api.updateProjectConfirmationDefaults(projectId, {
        clientName: input.baseInformation.clientNames.join("\n"),
        confirmationDate: input.confirmationDate,
        reference: input.baseInformation.references.join("\n"),
        pic: input.pic,
        mic: input.mic,
        reportDate: input.reportDate,
        baseInformation: input.baseInformation,
      }),
    onSuccess: async (defaults) => {
      queryClient.setQueryData(
        ["project-confirmation-defaults", projectId],
        defaults
      );
      setBaseInformationValues(getBaseInformationFormValues(defaults));
      await refreshConfirmationQueries();
      toast({ title: copy.baseInformation.saved });
    },
    onError: (error) =>
      toast({
        title: copy.baseInformation.saveError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  const saveDraft = useMutation({
    mutationFn: ({
      confirmation,
      draftPayload,
      patchSource,
      templateCode,
    }: {
      confirmation: ProjectConfirmation;
      draftPayload: ConfirmationDraftPayload;
      patchSource: ConfirmationDraftPatchSource;
      templateCode: ConfirmationDraftTemplateCode;
      isAutoSave?: boolean;
    }) =>
      api.updateProjectConfirmationDraft(projectId, confirmation.id, {
        draftPayload,
        draftTemplateCode: templateCode,
        patchSource,
      }),
    onSuccess: async (confirmation, variables) => {
      setActiveConfirmation(confirmation);
      setValidationErrors([]);
      if (variables.isAutoSave) {
        return;
      }
      await refreshConfirmationQueries();
      toast({ title: copy.saveSuccessTitle });
    },
    onError: (error) =>
      showMutationError(
        error,
        copy.saveErrorTitle,
        copy.validationErrorMessages,
        toast,
        setValidationErrors
      ),
  });

  const uploadConfirmation = useMutation({
    mutationFn: async () => {
      if (
        !activeConfirmation ||
        !uploadFiles.length ||
        uploadFiles.some((file) => file.size === 0) ||
        !uploadCounterparty.trim()
      ) {
        throw new Error(copy.newConfirmationDialog.uploadRequired);
      }
      if (
        activeConfirmation.draftTemplateCode ||
        (activeConfirmation.currentArtifact &&
          activeConfirmation.currentArtifact.templateCode !==
            "UPLOADED_DOCUMENT")
      ) {
        await api.removeProjectConfirmationContent(
          projectId,
          activeConfirmation.id
        );
      }
      return api.uploadProjectConfirmationFile(
        projectId,
        activeConfirmation.id,
        {
          counterpartyName: uploadCounterparty.trim(),
          file: uploadFiles,
        }
      );
    },
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("draft");
      setUploadDialogOpen(false);
      setUploadCounterparty("");
      setUploadFiles([]);
      await refreshConfirmationQueries();
      toast({ title: copy.newConfirmationDialog.uploadSuccess });
    },
    onError: (error) =>
      toast({
        title: copy.newConfirmationDialog.uploadError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  const removeConfirmationContent = useMutation({
    mutationFn: (confirmation: ProjectConfirmation) =>
      api.removeProjectConfirmationContent(projectId, confirmation.id),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setUploadFiles([]);
      await refreshConfirmationQueries();
    },
    onError: () =>
      toast({
        title: copy.newConfirmationDialog.uploadError,
        variant: "destructive",
      }),
  });

  const downloadConfirmation = async (
    confirmation: ProjectConfirmation,
    format: ConfirmationDownloadFormat,
    draftPayload?: ConfirmationDraftPayload
  ) => {
    try {
      const attachment = getProjectConfirmationAttachment(confirmation);
      const draftInput =
        draftPayload &&
        confirmation.status === "DRAFT" &&
        !confirmation.currentArtifact &&
        confirmation.draftTemplateCode
          ? {
              draftTemplateCode: confirmation.draftTemplateCode,
              patchSource: "MANUAL" as const,
              draftPayload: mergeGeneralFillDraftPayload(
                draftPayload,
                confirmation.draftPayload ?? null,
                confirmationDefaults.data
              ),
            }
          : undefined;
      const generatedArtifact =
        confirmation.currentArtifact &&
        confirmation.currentArtifact.templateCode !== "UPLOADED_DOCUMENT";
      const blob =
        draftInput || generatedArtifact
          ? await api.previewProjectConfirmationPdf(
              projectId,
              confirmation.id,
              draftInput
            )
          : await api.downloadProjectConfirmationAttachment(
              projectId,
              confirmation.id,
              attachment.downloadUrl
            );
      downloadBlob(
        blob,
        getConfirmationDownloadFileName(confirmation, copy, format)
      );
    } catch {
      toast({
        title: copy.uploadedDocumentPreviewError,
        variant: "destructive",
      });
    }
  };

  const openConfirmationDocument = async (
    confirmation: ProjectConfirmation
  ) => {
    try {
      const attachment = getProjectConfirmationAttachment(confirmation);
      const blob = await api.downloadProjectConfirmationAttachment(
        projectId,
        confirmation.id,
        attachment.downloadUrl
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      toast({
        title: copy.uploadedDocumentPreviewError,
        variant: "destructive",
      });
    }
  };

  const renameConfirmation = useMutation({
    mutationFn: ({
      confirmationId,
      displayName,
    }: {
      confirmationId: string;
      displayName: string;
    }) =>
      api.updateProjectConfirmation(projectId, confirmationId, { displayName }),
    onSuccess: async (confirmation) => {
      if (activeConfirmation?.id === confirmation.id) {
        setActiveConfirmation(confirmation);
      }
      setEditingNameId(null);
      await refreshConfirmationQueries();
      toast({ title: copy.renameSuccessTitle });
    },
    onError: () => {
      toast({
        title: copy.renameErrorTitle,
        variant: "destructive",
      });
    },
  });

  const reclassifyConfirmation = useMutation({
    mutationFn: ({
      confirmationId,
      type,
    }: {
      confirmationId: string;
      type: ConfirmationType;
    }) => api.updateProjectConfirmation(projectId, confirmationId, { type }),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
      toast({ title: routingCopy.categoryUpdated });
    },
    onError: () =>
      toast({
        title: routingCopy.categoryUpdateError,
        variant: "destructive",
      }),
  });

  const commitConfirmationName = (confirmation: ProjectConfirmation) => {
    const nextName = editingName.trim();
    if (!nextName) {
      setEditingNameId(null);
      return;
    }
    if (nextName === getConfirmationDisplayName(confirmation, copy)) {
      setEditingNameId(null);
      return;
    }
    renameConfirmation.mutate({
      confirmationId: confirmation.id,
      displayName: nextName,
    });
  };

  const submitDraft = useMutation({
    mutationFn: (confirmation: ProjectConfirmation) => {
      if (!confirmation.draftUpdatedAt) {
        throw new Error(copy.submissionValidationError);
      }
      return api.submitProjectConfirmation(projectId, confirmation.id, {
        expectedDraftUpdatedAt: confirmation.draftUpdatedAt,
        idempotencyKey: createIdempotencyKey(),
      });
    },
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("draft");
      setValidationErrors([]);
      await refreshConfirmationQueries();
      toast({ title: copy.submitSuccessTitle });
    },
    onError: (error) =>
      showMutationError(
        error,
        copy.submitErrorTitle,
        copy.validationErrorMessages,
        toast,
        setValidationErrors
      ),
  });

  const withdrawDraft = useMutation({
    mutationFn: ({
      confirmation,
      reason,
    }: {
      confirmation: ProjectConfirmation;
      reason: string;
    }) =>
      api.withdrawProjectConfirmation(projectId, confirmation.id, {
        idempotencyKey: createIdempotencyKey(),
        reason,
      }),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("draft");
      setValidationErrors([]);
      await refreshConfirmationQueries();
      toast({ title: copy.withdrawSuccessTitle });
    },
    onError: (error) =>
      showMutationError(
        error,
        copy.withdrawErrorTitle,
        copy.validationErrorMessages,
        toast,
        setValidationErrors
      ),
  });

  const dispatchConfirmation = useMutation({
    mutationFn: ({
      confirmation,
      input,
    }: {
      confirmation: ProjectConfirmation;
      input: CreateProjectConfirmationDispatchInput;
    }) =>
      api.createProjectConfirmationDispatch(projectId, confirmation.id, input),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("tracking");
      await refreshConfirmationQueries();
      toast({ title: copy.dispatchSuccessTitle });
    },
    onError: () =>
      toast({
        title: copy.dispatchErrorTitle,
        variant: "destructive",
      }),
  });

  const correctShipmentTracking = useMutation({
    mutationFn: ({
      confirmationId,
      dispatchId,
      input,
    }: {
      confirmationId: string;
      dispatchId: string;
      input: CorrectProjectConfirmationTrackingInput;
    }) =>
      api.correctProjectConfirmationTracking(
        projectId,
        confirmationId,
        dispatchId,
        input
      ),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
    },
  });

  const refreshShipmentTracking = useMutation({
    mutationFn: ({
      confirmationId,
      dispatchId,
    }: {
      confirmationId: string;
      dispatchId: string;
    }) =>
      api.refreshProjectConfirmationTracking(
        projectId,
        confirmationId,
        dispatchId
      ),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
    },
    onError: (error) =>
      toast({
        title: copy.tracking.shipmentRefreshError,
        description: getUserFacingErrorMessage(
          error,
          copy.tracking.shipmentRefreshError
        ),
        variant: "destructive",
      }),
  });

  const uploadDispatchScan = useMutation({
    mutationFn: ({
      confirmation,
      file,
    }: {
      confirmation: ProjectConfirmation;
      file: File;
    }) => {
      const latestDispatch = getLatestDispatch(confirmation);
      if (!latestDispatch) {
        throw new Error(copy.tracking.dispatchScanUploadError);
      }
      return api.uploadProjectConfirmationDispatchAttachment(
        projectId,
        confirmation.id,
        latestDispatch.id,
        file
      );
    },
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
      toast({ title: copy.tracking.dispatchScanUploadSuccess });
    },
    onError: () =>
      toast({
        title: copy.tracking.dispatchScanUploadError,
        variant: "destructive",
      }),
  });

  const receiveConfirmationResponse = useMutation({
    mutationFn: () => {
      if (!activeConfirmation || !responseFiles.length || !responseReceivedAt) {
        throw new Error(copy.tracking.responseScanHelp);
      }
      const existingResponse = getLatestRoutedResponse(activeConfirmation);
      if (
        existingResponse &&
        (activeConfirmation.status === "RESPONSE_RECEIVED" ||
          activeConfirmation.status === "CLOSED")
      ) {
        return api.addProjectConfirmationResponseArtifacts(
          projectId,
          activeConfirmation.id,
          existingResponse.id,
          responseFiles
        );
      }
      return api.receiveProjectConfirmationResponse(
        projectId,
        activeConfirmation.id,
        {
          files: responseFiles,
          receivedAt: new Date(responseReceivedAt).toISOString(),
          responseChannel,
          responseReference: responseReference.trim(),
          notes: responseNotes.trim(),
        }
      );
    },
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("review");
      setResponseDialogOpen(false);
      setResponseFiles([]);
      setResponseReference("");
      setResponseNotes("");
      setResponseReceivedAt(toLocalDateTimeInput(new Date()));
      await refreshConfirmationQueries();
      toast({ title: copy.tracking.responseUploadSuccess });
    },
    onError: () =>
      toast({
        title: copy.tracking.responseUploadError,
        variant: "destructive",
      }),
  });

  const recordFollowUpProgress = useMutation({
    mutationFn: ({
      confirmation,
      input,
    }: {
      confirmation: ProjectConfirmation;
      input: CreateProjectConfirmationFollowUpEventInput;
    }) =>
      api.createProjectConfirmationFollowUpEvent(
        projectId,
        confirmation.id,
        input
      ),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
    },
    onError: () =>
      toast({
        title: copy.dispatchErrorTitle,
        variant: "destructive",
      }),
  });

  const completeConfirmationProgram = useMutation({
    mutationFn: (confirmation: ProjectConfirmation) =>
      api.completeProjectConfirmationProgram(projectId, confirmation.id),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("review");
      if (confirmation.status === "CLOSED") {
        setCompletionFeedbackId(confirmation.id);
      }
      await refreshConfirmationQueries();
    },
    onError: () =>
      toast({
        title: copy.dispatchErrorTitle,
        variant: "destructive",
      }),
  });

  const reviewConfirmationResponse = useMutation({
    mutationFn: ({
      confirmation,
      input,
    }: {
      confirmation: ProjectConfirmation;
      input: ReviewProjectConfirmationResponseInput;
    }) =>
      api.reviewProjectConfirmationResponse(projectId, confirmation.id, input),
    onSuccess: async (confirmation, variables) => {
      setActiveConfirmation(confirmation);
      setActiveStage(getInitialStage(confirmation));
      if (
        variables.input.result === "MATCHED" &&
        confirmation.status === "CLOSED"
      ) {
        setCompletionFeedbackId(confirmation.id);
      }
      await refreshConfirmationQueries();
      toast({ title: copy.reviewResolution.saved });
    },
    onError: () =>
      toast({
        title: copy.dispatchErrorTitle,
        variant: "destructive",
      }),
  });

  const startRedispatchEditing = useMutation({
    mutationFn: (confirmation: ProjectConfirmation) =>
      api.startProjectConfirmationRedispatchEditing(projectId, confirmation.id),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage("draft");
      setValidationErrors([]);
      await refreshConfirmationQueries();
      toast({ title: copy.tracking.editRedispatchSuccess });
    },
    onError: () =>
      toast({
        title: copy.tracking.editRedispatchError,
        variant: "destructive",
      }),
  });

  const voidConfirmation = useMutation({
    mutationFn: (confirmationBatch: ProjectConfirmation[]) =>
      runConfirmationLifecycleBatch(confirmationBatch, (confirmation) =>
        api.voidProjectConfirmation(projectId, confirmation.id)
      ),
    onSuccess: async ({ succeeded, failed }) => {
      if (
        activeConfirmation &&
        succeeded.some(
          (confirmation) => confirmation.id === activeConfirmation.id
        )
      ) {
        setActiveConfirmation(null);
        setActiveStage("draft");
      }
      if (failed.length > 0) {
        setVoidingConfirmations(failed.map(({ confirmation }) => confirmation));
      } else {
        setVoidingConfirmations([]);
        setLifecycleActionResetKey((current) => current + 1);
      }
      await refreshConfirmationQueries();
      toast({
        title:
          failed.length > 0
            ? copy.register.deleteError
            : copy.register.deleteSuccess,
        variant: failed.length > 0 ? "destructive" : undefined,
      });
    },
    onError: () =>
      toast({
        title: copy.register.deleteError,
        variant: "destructive",
      }),
  });

  const restoreConfirmation = useMutation({
    mutationFn: (confirmationBatch: ProjectConfirmation[]) =>
      runConfirmationLifecycleBatch(confirmationBatch, (confirmation) =>
        api.restoreProjectConfirmation(projectId, confirmation.id)
      ),
    onSuccess: async ({ failed }) => {
      await refreshConfirmationQueries();
      if (failed.length > 0) {
        toast({ title: copy.register.restoreError, variant: "destructive" });
        return;
      }
      setLifecycleActionResetKey((current) => current + 1);
      toast({ title: copy.register.restoreSuccess });
    },
    onError: () =>
      toast({
        title: copy.register.restoreError,
        variant: "destructive",
      }),
  });

  const undoConfirmationReview = useMutation({
    mutationFn: (confirmation: ProjectConfirmation) =>
      api.undoProjectConfirmationReview(projectId, confirmation.id),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      setActiveStage(getInitialStage(confirmation));
      setCompletionFeedbackId(null);
      setUndoReviewDialogOpen(false);
      await refreshConfirmationQueries();
      toast({ title: copy.reviewResolution.undoSuccess });
    },
    onError: () =>
      toast({
        title: copy.reviewResolution.undoError,
        variant: "destructive",
      }),
  });

  const addResponseArtifacts = useMutation({
    mutationFn: ({
      confirmation,
      responseId,
      files,
    }: {
      confirmation: ProjectConfirmation;
      responseId: string;
      files: File[];
    }) =>
      api.addProjectConfirmationResponseArtifacts(
        projectId,
        confirmation.id,
        responseId,
        files
      ),
    onSuccess: async (confirmation) => {
      setActiveConfirmation(confirmation);
      await refreshConfirmationQueries();
      toast({ title: copy.tracking.responseAddSuccess });
    },
    onError: () =>
      toast({
        title: copy.tracking.responseAddError,
        variant: "destructive",
      }),
  });

  const withdrawConfirmationResponse = useMutation({
    mutationFn: ({
      confirmation,
      responseId,
    }: {
      confirmation: ProjectConfirmation;
      responseId: string;
    }) =>
      api.withdrawProjectConfirmationResponse(
        projectId,
        confirmation.id,
        responseId
      ),
    onSuccess: async (confirmation) => {
      if ("deletedConfirmationId" in confirmation) {
        setActiveConfirmation(null);
        recordConfirmationPage(null);
        openedDeepLinkRef.current = null;
        setNavigationFilter("RESPONSE_WAREHOUSE");
      } else {
        setActiveConfirmation(confirmation);
      }
      setActiveStage("draft");
      setWithdrawResponseDialogOpen(false);
      await Promise.all([
        refreshConfirmationQueries(),
        queryClient.invalidateQueries({
          queryKey: ["project-confirmation-response-warehouse", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["project-pending-confirmation-responses", projectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["confirmation-response-library"],
        }),
      ]);
      toast({ title: copy.tracking.withdrawResponseSuccess });
    },
    onError: () =>
      toast({
        title: copy.tracking.withdrawResponseError,
        variant: "destructive",
      }),
  });

  const downloadResponseScan = async (
    confirmation: ProjectConfirmation,
    responseId: string,
    artifact: { id: string; fileName: string }
  ) => {
    try {
      const blob = await api.projectConfirmationResponseArtifact(
        projectId,
        confirmation.id,
        responseId,
        artifact.id
      );
      downloadBlob(blob, artifact.fileName);
    } catch {
      toast({
        title: copy.tracking.responseUploadError,
        variant: "destructive",
      });
    }
  };

  const derivedValues = useMemo(
    () =>
      getDerivedValues(
        project,
        currentUser,
        members,
        activeConfirmation,
        locale
      ),
    [activeConfirmation, currentUser, locale, members, project]
  );

  function recordConfirmationPage(id: string | null, stage?: PreparationStage) {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set("confirmationId", id);
    } else {
      url.searchParams.delete("confirmationId");
    }
    if (stage) {
      url.searchParams.set("confirmationStage", stage);
    } else {
      url.searchParams.delete("confirmationStage");
    }
    if (url.href !== window.location.href) {
      window.history.pushState(
        window.history.state,
        "",
        url.pathname + url.search
      );
    }
  }
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("confirmationId");
      const selected = rows.find((item) => item.id === id) ?? null;
      setActiveConfirmation(selected);
      const stage = params.get("confirmationStage");
      setActiveStage(
        stage === "draft" || stage === "tracking" || stage === "review"
          ? stage
          : selected
            ? getInitialStage(selected)
            : "draft"
      );
      openedDeepLinkRef.current = id;
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [rows]);

  const selectConfirmation = (confirmation: ProjectConfirmation) => {
    recordConfirmationPage(confirmation.id, getInitialStage(confirmation));
    setActiveConfirmation(confirmation);
    setActiveStage(getInitialStage(confirmation));
    setValidationErrors([]);
  };

  const openRoutedConfirmation = async (
    response: ConfirmationResponseLibraryFile
  ) => {
    if (!response.confirmationId) {
      return;
    }
    const refreshedConfirmations = await queryClient.fetchQuery({
      queryKey: ["project-confirmations", projectId],
      queryFn: () => api.projectConfirmations(projectId),
    });
    const confirmation = refreshedConfirmations.find(
      (item) => item.id === response.confirmationId
    );
    if (!confirmation) {
      toast({
        title: routingCopy.updateError,
        variant: "destructive",
      });
      return;
    }
    setActiveConfirmation(confirmation);
    setActiveStage("review");
    setValidationErrors([]);
  };

  const openBaseInformation = async () => {
    let defaults: ProjectConfirmationDefaults;
    try {
      defaults = await queryClient.fetchQuery({
        queryKey: ["project-confirmation-defaults", projectId],
        queryFn: () => api.projectConfirmationDefaults(projectId),
      });
    } catch (error) {
      toast({
        title: locale.startsWith("zh")
          ? "基础信息加载失败"
          : "Unable to load base information",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
      return;
    }
    setBaseInformationValues(getBaseInformationFormValues(defaults));
    setActiveConfirmation(null);
    setActiveStage("draft");
    setValidationErrors([]);
    setNavigationFilter("BASE_INFORMATION");
    setRegisterScope("ALL");
  };

  const showOverview = () => {
    setActiveConfirmation(null);
    setActiveStage("draft");
    setValidationErrors([]);
  };

  const returnToRegister = () => {
    setNavigationFilter("ALL");
    setRegisterScope("ALL");
    showOverview();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("confirmationId");
      url.searchParams.delete("confirmationStage");
      window.history.pushState(
        window.history.state,
        "",
        url.pathname +
          (url.searchParams.toString() ? "?" + url.searchParams : "") +
          url.hash
      );
    }
  };

  const selectNavigation = (value: ConfirmationNavigationKey) => {
    if (value === "BASE_INFORMATION") {
      openBaseInformation();
      return;
    }
    setNavigationFilter(value);
    setRegisterScope(value === "RECYCLE_BIN" ? "RECYCLE_BIN" : "ALL");
    setRegisterFilters(DEFAULT_CONFIRMATION_REGISTER_FILTERS);
    showOverview();
  };

  const selectOverviewCell = (selection: ConfirmationOverviewCellSelection) => {
    setNavigationFilter("ALL");
    setRegisterScope(
      selection.unclassified
        ? "UNCLASSIFIED"
        : selection.type === "OTHER"
          ? "OTHER_TYPE"
          : (selection.type ?? selection.category ?? selection.navigation)
    );
    setRegisterFilters({
      ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
      ...getFiltersForOverviewColumn(selection.column),
    });
    showOverview();
  };

  const selectTemplate = (
    templateCode: ConfirmationDraftTemplateCode,
    bankEntryId?: string
  ) => {
    if (!activeConfirmation) {
      createDraft.mutate({
        templateCode,
        ...(bankEntryId ? { bankEntryId } : {}),
      });
      return;
    }
    if (activeConfirmation.draftTemplateCode === templateCode) {
      return;
    }
    const saveSelectedTemplate = (confirmation: ProjectConfirmation) =>
      saveDraft.mutate({
        confirmation,
        draftPayload: {
          ...clearConfirmationInformationLibraryDraftValuesForTemplate(
            mergeGeneralFillDraftPayload(
              getEditableConfirmationDraftPayload(
                confirmation.draftPayload ?? null
              ),
              confirmation.draftPayload ?? null,
              confirmationDefaults.data
            ),
            templateCode
          ),
          ...(bankEntryId
            ? { confirmationInformationLibraryEntryId: bankEntryId }
            : {}),
        },
        patchSource: "MANUAL",
        templateCode,
      });
    if (activeConfirmation.currentArtifact) {
      removeConfirmationContent.mutate(activeConfirmation, {
        onSuccess: saveSelectedTemplate,
      });
      return;
    }
    saveSelectedTemplate(activeConfirmation);
  };

  const selectCustomTemplate = () => {
    if (!activeConfirmation) {
      return;
    }
    setUploadDialogOpen(true);
  };

  const persistDraft = async (draftPayload: ConfirmationDraftPayload) => {
    if (!activeConfirmation?.draftTemplateCode) {
      return;
    }
    await saveDraft.mutateAsync({
      confirmation: activeConfirmation,
      draftPayload: mergeGeneralFillDraftPayload(
        draftPayload,
        activeConfirmation.draftPayload ?? null,
        confirmationDefaults.data
      ),
      patchSource: "MANUAL",
      templateCode: activeConfirmation.draftTemplateCode,
      isAutoSave: true,
    });
  };

  const latestResponse = activeConfirmation
    ? getLatestRoutedResponse(activeConfirmation)
    : undefined;
  const isSupplementingResponse = Boolean(
    latestResponse &&
    (activeConfirmation?.status === "RESPONSE_RECEIVED" ||
      activeConfirmation?.status === "CLOSED")
  );
  const canWithdrawResponse = Boolean(
    !readOnly &&
    activeConfirmation?.status === "RESPONSE_RECEIVED" &&
    !activeConfirmation.differenceStatus &&
    latestResponse
  );
  const latestDispatch = activeConfirmation
    ? getLatestDispatch(activeConfirmation)
    : undefined;
  const latestWorkflowDispatch = activeConfirmation
    ? getLatestWorkflowDispatch(activeConfirmation)
    : undefined;
  const latestRedispatchRequest = getLatestEvent(
    activeConfirmation?.followUpEvents?.filter(
      (event) => event.eventType === "REDISPATCH_REQUESTED"
    )
  );
  const canOpenReview = Boolean(
    activeConfirmation &&
    latestResponse &&
    (activeConfirmation.status === "RESPONSE_RECEIVED" ||
      activeConfirmation.status === "CLOSED" ||
      (activeConfirmation.status === "AWAITING_RESPONSE" &&
        !activeConfirmation.differenceStatus))
  );
  const latestReviewEvent = getLatestEvent(
    activeConfirmation?.followUpEvents?.filter((event) =>
      ["PROGRAM_COMPLETED", "REDISPATCH_REQUESTED", "REVIEW_RECORDED"].includes(
        event.eventType
      )
    )
  );
  const latestResponseWithdrawnEvent = getLatestEvent(
    activeConfirmation?.followUpEvents?.filter(
      (event) => event.eventType === "RESPONSE_WITHDRAWN"
    )
  );
  const latestProgramCompletedEvent = getLatestEvent(
    activeConfirmation?.followUpEvents?.filter((event) => {
      if (event.eventType !== "PROGRAM_COMPLETED") {
        return false;
      }
      const { payload } = event;
      return Boolean(
        payload &&
        typeof payload === "object" &&
        "operation" in payload &&
        payload.operation === "RESPONSE_ARCHIVED_TO_EMP"
      );
    })
  );
  const programCompleted = isConfirmationArchiveComplete(activeConfirmation);
  const pendingArchiveLabel =
    locale === "zh-CN" ? "待归档" : "Awaiting archive";
  const redispatchDecisionActive = Boolean(
    activeConfirmation &&
    ["DRAFT", "PREPARED", "AWAITING_RESPONSE"].includes(
      activeConfirmation.status
    ) &&
    activeConfirmation.differenceStatus === "EXCEPTION"
  );
  const preparedReplacementReady = Boolean(
    activeConfirmation?.status === "PREPARED" &&
    activeConfirmation.currentArtifactId &&
    latestWorkflowDispatch?.artifactId &&
    activeConfirmation.currentArtifactId !==
      latestWorkflowDispatch.artifactId &&
    latestResponse
  );
  const redispatchDispatchPending = Boolean(
    redispatchDecisionActive &&
    (preparedReplacementReady ||
      (latestWorkflowDispatch &&
        latestRedispatchRequest &&
        new Date(latestRedispatchRequest.occurredAt).getTime() >
          new Date(latestWorkflowDispatch.createdAt).getTime()))
  );
  const redispatchPending = Boolean(
    redispatchDecisionActive &&
    (redispatchDispatchPending ||
      (activeConfirmation?.status === "AWAITING_RESPONSE" &&
        (!latestWorkflowDispatch || latestWorkflowDispatch.sequence <= 1)))
  );
  const redispatchCycleActive = redispatchDecisionActive;
  const isRedispatchDraft = Boolean(
    activeConfirmation?.status === "DRAFT" && redispatchPending
  );
  const isRedispatchDispatchReady = Boolean(
    activeConfirmation?.status === "PREPARED" && redispatchDispatchPending
  );
  const redispatchSequence = redispatchDecisionActive
    ? redispatchPending
      ? (latestDispatch?.sequence ?? 1) + 1
      : latestDispatch && latestDispatch.sequence > 1
        ? latestDispatch.sequence
        : undefined
    : undefined;
  const redispatchReadyActorId = preparedReplacementReady
    ? activeConfirmation?.currentArtifact?.submittedBy
    : latestRedispatchRequest?.actorId;
  const redispatchReadyAt = preparedReplacementReady
    ? activeConfirmation?.currentArtifact?.submittedAt
    : latestRedispatchRequest?.occurredAt;
  const followUpComplete = Boolean(
    activeConfirmation &&
    !redispatchCycleActive &&
    (activeConfirmation.status === "RESPONSE_RECEIVED" ||
      activeConfirmation.status === "CLOSED" ||
      activeConfirmation.differenceStatus)
  );
  const manualReviewComplete = Boolean(
    activeConfirmation?.status === "CLOSED" ||
    (activeConfirmation?.differenceStatus && !redispatchCycleActive)
  );
  const manualReviewActive = Boolean(
    activeConfirmation?.status === "RESPONSE_RECEIVED" && !manualReviewComplete
  );
  const canRedispatch = Boolean(
    activeConfirmation?.status === "AWAITING_RESPONSE" &&
    redispatchDispatchPending
  );
  const undoableReview = activeConfirmation
    ? getUndoableConfirmationReviewEvent(activeConfirmation)
    : null;
  const canUndoReview = Boolean(!readOnly && undoableReview);
  const actorName = (userId: string | null | undefined) => {
    if (!userId) {
      return null;
    }
    if (activeConfirmation?.creator?.id === userId) {
      return activeConfirmation.creator.name;
    }
    if (currentUser?.id === userId) {
      return currentUser.name;
    }
    return (
      members.find((member) => member.user.id === userId)?.user.name ?? userId
    );
  };

  function setCategoryNavigationOpen(open: boolean) {
    categoryNavigationResizeSessionRef.current = null;
    setIsCategoryNavigationDragging(false);
    setCategoryNavigationDragPreviewExpanded(false);
    if (open) {
      categoryNavigationPanelRef.current?.expand();
      categoryNavigationPanelRef.current?.resize(
        categoryNavigationLastWidthRef.current
      );
      setCategoryNavigationWidth(categoryNavigationLastWidthRef.current);
      setIsCategoryNavigationCollapsed(false);
      return;
    }

    categoryNavigationPanelRef.current?.collapse();
    setIsCategoryNavigationCollapsed(true);
  }

  function handleCategoryNavigationResizeStart() {
    const measuredWidth =
      categoryNavigationPanelRef.current?.getSize().inPixels;
    const currentWidth =
      measuredWidth && measuredWidth > 0
        ? measuredWidth
        : categoryNavigationLastWidthRef.current;
    const wasCollapsed = isCategoryNavigationCollapsed;
    const startWidth = wasCollapsed ? 0 : currentWidth;
    categoryNavigationResizeSessionRef.current = {
      previousWidth: currentWidth,
      startWidth,
      wasCollapsed,
      currentWidth: startWidth,
      restoreWidth: wasCollapsed ? 0 : currentWidth,
    };
    setCategoryNavigationDragPreviewExpanded(false);
    setIsCategoryNavigationDragging(true);
  }

  function handleCategoryNavigationResize(deltaX: number) {
    const session = categoryNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    const nextWidth = Math.max(
      0,
      Math.min(CONFIRMATION_NAV_MAX_WIDTH, session.startWidth + deltaX)
    );
    session.currentWidth = nextWidth;
    setCategoryNavigationWidth(nextWidth);
    if (nextWidth >= CONFIRMATION_NAV_MIN_WIDTH) {
      session.restoreWidth = nextWidth;
    }
    const previewExpanded =
      session.wasCollapsed &&
      nextWidth >= CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD;
    categoryNavigationPanelRef.current?.expand();
    categoryNavigationPanelRef.current?.resize(nextWidth);
    categoryNavigationSplitterRef.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(nextWidth))
    );
    setCategoryNavigationDragPreviewExpanded((current) =>
      current === previewExpanded ? current : previewExpanded
    );
  }

  function handleCategoryNavigationResizeCancel() {
    const session = categoryNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    setIsCategoryNavigationDragging(false);
    if (session.wasCollapsed) {
      categoryNavigationPanelRef.current?.collapse();
      setIsCategoryNavigationCollapsed(true);
    } else {
      categoryNavigationPanelRef.current?.expand();
      categoryNavigationPanelRef.current?.resize(session.previousWidth);
      categoryNavigationLastWidthRef.current = session.previousWidth;
      setCategoryNavigationWidth(session.previousWidth);
      setIsCategoryNavigationCollapsed(false);
    }
    setCategoryNavigationDragPreviewExpanded(false);
    categoryNavigationResizeSessionRef.current = null;
  }

  function handleCategoryNavigationResizeEnd() {
    const session = categoryNavigationResizeSessionRef.current;
    if (!session) {
      return;
    }

    setIsCategoryNavigationDragging(false);
    const shouldCollapse = session.wasCollapsed
      ? session.currentWidth < CONFIRMATION_NAV_DRAG_EXPAND_THRESHOLD
      : session.currentWidth < CONFIRMATION_NAV_DRAG_COLLAPSE_THRESHOLD;
    const nextWidth = shouldCollapse
      ? session.restoreWidth
      : Math.min(
          CONFIRMATION_NAV_MAX_WIDTH,
          Math.max(CONFIRMATION_NAV_MIN_WIDTH, session.currentWidth)
        );

    if (shouldCollapse) {
      const preservedWidth =
        session.restoreWidth >= CONFIRMATION_NAV_MIN_WIDTH
          ? session.restoreWidth
          : session.previousWidth;
      categoryNavigationPanelRef.current?.collapse();
      categoryNavigationLastWidthRef.current = preservedWidth;
      setCategoryNavigationWidth(preservedWidth);
      setIsCategoryNavigationCollapsed(true);
    } else {
      categoryNavigationPanelRef.current?.expand();
      categoryNavigationPanelRef.current?.resize(nextWidth);
      categoryNavigationLastWidthRef.current = nextWidth;
      setCategoryNavigationWidth(nextWidth);
      setIsCategoryNavigationCollapsed(false);
    }
    setCategoryNavigationDragPreviewExpanded(false);
    categoryNavigationResizeSessionRef.current = null;
  }

  const categoryControl = activeConfirmation ? (
    <Select
      value={activeConfirmation.type}
      onValueChange={(value) => {
        if (value === activeConfirmation.type) {
          return;
        }
        reclassifyConfirmation.mutate({
          confirmationId: activeConfirmation.id,
          type: value as ConfirmationType,
        });
      }}
      disabled={
        readOnly ||
        activeConfirmation.status !== "DRAFT" ||
        reclassifyConfirmation.isPending
      }
    >
      <SelectTrigger
        size="sm"
        className={phone ? "w-full min-w-0" : "ml-auto w-36"}
        label={routingCopy.confirmationCategory}
      >
        <SelectValue>
          {phone ? getSubtypeLabel(copy, activeConfirmation.type) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {FILTER_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {getSubtypeLabel(copy, type)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;
  const stageTabs = (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        phone && mobileStyles.stageTabs
      )}
    >
      <Tabs
        value={activeStage}
        onValueChange={(value) => {
          recordConfirmationPage(
            activeConfirmation?.id ?? null,
            value as PreparationStage
          );
          setActiveStage(value as PreparationStage);
        }}
      >
        <TabsList
          variant={phone ? "default" : "line"}
          aria-label={copy.workflowTitle}
        >
          <TabsTrigger value="draft">{copy.preparationTabs.draft}</TabsTrigger>
          <TabsTrigger value="tracking" disabled={!activeConfirmation}>
            {copy.preparationTabs.tracking}
          </TabsTrigger>
          <TabsTrigger value="review" disabled={!canOpenReview}>
            {copy.preparationTabs.review}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {phone ? (
        activeConfirmation?.status === "DRAFT" && !readOnly ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={routingCopy.confirmationCategory}
              onClick={() => setMobileCategoryOpen(true)}
            >
              <MoreHorizontal />
            </Button>
            <MobileActionSheet
              open={mobileCategoryOpen}
              onOpenChange={setMobileCategoryOpen}
              title={routingCopy.confirmationCategory}
              closeLabel={commonCopy.cancel}
            >
              {categoryControl}
            </MobileActionSheet>
          </>
        ) : null
      ) : (
        categoryControl
      )}
    </div>
  );

  const workspaceContent = (
    <main
      ref={confirmationContentSurfaceRef}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        activeConfirmation &&
          (activeStage === "review" || activeStage === "tracking")
          ? "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0"
          : !activeConfirmation && navigationFilter === "OVERVIEW"
            ? "relative h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-0"
            : activeConfirmation
              ? "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0"
              : navigationFilter === "INFORMATION_LIBRARY"
                ? "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0"
                : "relative flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden p-0"
      )}
    >
      {activeConfirmation ? (
        activeStage === "draft" ? (
          <ProjectConfirmationEditor
            key={activeConfirmation?.id ?? "new-confirmation"}
            copy={copy}
            derivedValues={derivedValues}
            baseInformationOptions={
              confirmationDefaults.data?.baseInformation ?? null
            }
            draftPayload={
              activeConfirmation
                ? getConfirmationEditorDraftPayload(
                    activeConfirmation.draftPayload,
                    confirmationDefaults.data
                  )
                : null
            }
            templateCode={activeConfirmation?.draftTemplateCode ?? null}
            confirmationType={activeConfirmation?.type}
            availableTemplateOptions={availableTemplateOptions}
            templateLabelOptions={templateLabelOptions}
            locale={locale}
            isCreating={createDraft.isPending}
            isSaving={saveDraft.isPending}
            isSubmitting={submitDraft.isPending}
            readOnly={
              readOnly ||
              confirmationDefaults.isPending ||
              (activeConfirmation?.status !== undefined &&
                activeConfirmation.status !== "DRAFT")
            }
            validationErrors={validationErrors}
            toolbarStart={(stageActions) => (
              <ConfirmationDetailToolbar
                confirmation={activeConfirmation}
                copy={copy}
                onBack={returnToRegister}
                stageTabs={stageTabs}
                stageActions={
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isRedispatchDraft && redispatchSequence ? (
                      <Badge
                        data-testid="confirmation-redispatch-draft-indicator"
                        variant="outline"
                        className="shrink-0 border-warning/50 bg-warning/10 text-warning"
                      >
                        {copy.tracking.workflowRedispatch} #{redispatchSequence}
                      </Badge>
                    ) : null}
                    {stageActions}
                  </div>
                }
              />
            )}
            onSave={persistDraft}
            onSubmit={() =>
              activeConfirmation && submitDraft.mutate(activeConfirmation)
            }
            onTemplateSelect={selectTemplate}
            onCustomTemplateSelect={selectCustomTemplate}
            onUploadDocument={
              activeConfirmation &&
              !activeConfirmation.draftTemplateCode &&
              (!activeConfirmation.currentArtifact ||
                activeConfirmation.currentArtifact.templateCode ===
                  "UPLOADED_DOCUMENT") &&
              activeConfirmation.status === "DRAFT"
                ? () => {
                    setUploadCounterparty(
                      activeConfirmation.counterpartyName ?? ""
                    );
                    setUploadDialogOpen(true);
                  }
                : undefined
            }
            uploadedDocumentUrl={uploadedPdfUrl}
            uploadedDocumentDocxUrl={uploadedDocxUrl}
            uploadedDocumentFileName={activeUploadedDocumentName || null}
            uploadedDocumentMimeType={activeUploadedDocumentMimeType || null}
            uploadedDocumentUnsupported={activeUploadedDocumentUnsupported}
            hasUploadedDocument={
              activeConfirmation?.currentArtifact?.templateCode ===
              "UPLOADED_DOCUMENT"
            }
            uploadedDocumentError={uploadedPdfError && !uploadedDocxUrl}
            onDeleteUploadedDocument={
              activeConfirmation?.currentArtifact?.templateCode ===
              "UPLOADED_DOCUMENT"
                ? () => removeConfirmationContent.mutate(activeConfirmation)
                : undefined
            }
            onDeleteDocument={
              activeConfirmation?.status === "DRAFT" &&
              (activeConfirmation.draftTemplateCode ||
                activeConfirmation.currentArtifact)
                ? () => removeConfirmationContent.mutate(activeConfirmation)
                : undefined
            }
            onDownloadDocument={
              activeConfirmation &&
              (activeConfirmation.draftTemplateCode ||
                activeConfirmation.currentArtifact)
                ? (format, draftPayload) => {
                    downloadConfirmation(
                      activeConfirmation,
                      format,
                      draftPayload
                    );
                  }
                : undefined
            }
            onOpenDocument={
              activeConfirmation && activeUploadedDocumentUnsupported
                ? () => {
                    openConfirmationDocument(activeConfirmation);
                  }
                : undefined
            }
            preparedAction={
              activeConfirmation.status === "PREPARED" &&
              activeConfirmation.currentArtifact &&
              (!latestWorkflowDispatch || redispatchDispatchPending) ? (
                <ProjectConfirmationDispatchAction
                  copy={{ ...copy.tracking, cancel: commonCopy.cancel }}
                  locale={locale}
                  isDispatching={dispatchConfirmation.isPending}
                  isWithdrawing={withdrawDraft.isPending}
                  methodLabels={copy.dispatchMethodLabels}
                  confirmationName={getConfirmationDisplayName(
                    activeConfirmation,
                    copy
                  )}
                  attachmentFileName={`${sanitizeFileName(
                    getConfirmationDispatchAttachmentFileName(
                      activeConfirmation,
                      copy
                    )
                  )}`}
                  defaultRecipientName={activeConfirmation.counterpartyName}
                  defaultRecipientContact={
                    activeConfirmation.counterpartyContact ?? ""
                  }
                  mailConnection={mailConnection.data}
                  searchTrackingCarriers={api.tracking17TrackCarriers}
                  isRedispatch={isRedispatchDraft || isRedispatchDispatchReady}
                  onDispatch={(input) =>
                    dispatchConfirmation.mutateAsync({
                      confirmation: activeConfirmation,
                      input,
                    })
                  }
                  onUploadDispatchScan={(confirmation, file) =>
                    uploadDispatchScan.mutateAsync({ confirmation, file })
                  }
                  onWithdraw={(reason) =>
                    withdrawDraft.mutate({
                      confirmation: activeConfirmation,
                      reason,
                    })
                  }
                />
              ) : activeConfirmation.status === "PREPARED" &&
                activeConfirmation.currentArtifact &&
                redispatchDecisionActive &&
                latestWorkflowDispatch &&
                !redispatchDispatchPending ? (
                <span
                  data-testid="confirmation-redispatch-awaiting-request"
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {copy.tracking.workflowRedispatchWaiting}
                </span>
              ) : activeConfirmation.status === "AWAITING_RESPONSE" &&
                !latestResponse ? (
                <Button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setResponseDialogOpen(true)}
                >
                  <Upload />
                  {copy.tracking.recordResponse}
                </Button>
              ) : canWithdrawResponse ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => setWithdrawResponseDialogOpen(true)}
                >
                  <Undo2 />
                  {copy.tracking.withdrawResponse}
                </Button>
              ) : undefined
            }
          />
        ) : activeStage === "tracking" && activeConfirmation ? (
          <>
            <ConfirmationDetailToolbar
              confirmation={activeConfirmation}
              copy={copy}
              onBack={returnToRegister}
              stageTabs={stageTabs}
              stageActions={
                <span
                  data-testid="confirmation-tracking-toolbar-status"
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {redispatchPending
                    ? copy.tracking.workflowRedispatchWaiting
                    : activeConfirmation.status === "CLOSED" &&
                        !programCompleted
                      ? pendingArchiveLabel
                      : copy.statusLabels[activeConfirmation.status]}
                </span>
              }
            />
            <div
              data-testid="confirmation-tracking-content"
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
            >
              <ConfirmationWorkflowTracker
                ariaLabel={copy.tracking.workflowAriaLabel}
                actorLabel={copy.tracking.workflowActor}
                locale={locale}
                timeLabel={copy.tracking.workflowTime}
                waitingLabel={copy.tracking.workflowWaiting}
                titles={{
                  created: copy.tracking.workflowCreated,
                  frozen: copy.tracking.workflowFrozen,
                  sent: copy.tracking.workflowSent,
                  followUp: copy.tracking.workflowFollowUp,
                  manualReview: copy.tracking.workflowManualReview,
                  completed: copy.tracking.workflowCompleted,
                }}
                milestones={[
                  {
                    key: "created",
                    complete: !isRedispatchDraft,
                    active: isRedispatchDraft,
                    waitingLabel: isRedispatchDraft
                      ? copy.tracking.workflowRedispatchEditing
                      : undefined,
                    actor:
                      activeConfirmation.creator?.name ??
                      actorName(activeConfirmation.createdBy),
                    at: activeConfirmation.createdAt,
                  },
                  {
                    key: "frozen",
                    complete: activeConfirmation.status !== "DRAFT",
                    actor: actorName(
                      activeConfirmation.preparedDispatchReadyBy ??
                        activeConfirmation.currentArtifact?.submittedBy
                    ),
                    at:
                      activeConfirmation.preparedDispatchReadyAt ??
                      activeConfirmation.currentArtifact?.submittedAt,
                  },
                  {
                    key: "sent",
                    complete:
                      followUpComplete ||
                      (Boolean(latestWorkflowDispatch) &&
                        activeConfirmation.status !== "DRAFT" &&
                        !redispatchPending),
                    active: redispatchPending && !isRedispatchDraft,
                    title:
                      !isRedispatchDraft && redispatchSequence
                        ? `${copy.tracking.workflowRedispatch} #${redispatchSequence}`
                        : undefined,
                    waitingLabel:
                      redispatchPending && !isRedispatchDraft
                        ? activeConfirmation.status === "DRAFT"
                          ? copy.tracking.workflowRedispatchEditing
                          : copy.tracking.workflowRedispatchWaiting
                        : undefined,
                    actor: redispatchPending
                      ? actorName(redispatchReadyActorId)
                      : actorName(latestDispatch?.createdBy),
                    at: redispatchPending
                      ? redispatchReadyAt
                      : (latestDispatch?.sentAt ?? latestDispatch?.createdAt),
                  },
                  {
                    key: "followUp",
                    complete: followUpComplete,
                    active:
                      activeConfirmation.status === "AWAITING_RESPONSE" &&
                      !redispatchPending,
                    waitingLabel:
                      activeConfirmation.status === "AWAITING_RESPONSE" &&
                      !redispatchPending
                        ? copy.tracking.followUp.waitingResponse
                        : undefined,
                    actor: actorName(
                      latestResponse?.receivedBy ??
                        latestResponseWithdrawnEvent?.actorId
                    ),
                    at:
                      latestResponse?.receivedAt ??
                      latestResponseWithdrawnEvent?.occurredAt,
                  },
                  {
                    key: "manualReview",
                    complete: manualReviewComplete,
                    active: manualReviewActive,
                    waitingLabel: manualReviewActive
                      ? copy.tracking.workflowManualReviewWaiting
                      : undefined,
                    actor: actorName(latestReviewEvent?.actorId),
                    at: latestReviewEvent?.occurredAt,
                  },
                  {
                    key: "completed",
                    complete: programCompleted,
                    active: manualReviewComplete && !programCompleted,
                    actor: actorName(
                      programCompleted
                        ? latestProgramCompletedEvent?.actorId
                        : null
                    ),
                    at: programCompleted
                      ? latestProgramCompletedEvent?.occurredAt
                      : null,
                  },
                ]}
              />
              <ConfirmationFollowUpPanel
                confirmation={activeConfirmation}
                copy={copy.tracking.followUp}
                trackingCopy={copy.tracking}
                locale={locale}
                resolveActorName={actorName}
                canEdit={!readOnly}
                statusLabel={
                  redispatchPending
                    ? copy.tracking.workflowRedispatchWaiting
                    : activeConfirmation.status === "CLOSED" &&
                        !programCompleted
                      ? pendingArchiveLabel
                      : undefined
                }
                searchTrackingCarriers={api.tracking17TrackCarriers}
                isRefreshingTracking={refreshShipmentTracking.isPending}
                onRefreshTracking={(dispatchId) =>
                  refreshShipmentTracking.mutate({
                    confirmationId: activeConfirmation.id,
                    dispatchId,
                  })
                }
                onCorrectTracking={(dispatchId, input) =>
                  correctShipmentTracking.mutateAsync({
                    confirmationId: activeConfirmation.id,
                    dispatchId,
                    input,
                  })
                }
                isSaving={recordFollowUpProgress.isPending}
                isCompleting={completeConfirmationProgram.isPending}
                onRecordProgress={(input) =>
                  recordFollowUpProgress.mutate({
                    confirmation: activeConfirmation,
                    input,
                  })
                }
                canSupplementResponse={isSupplementingResponse}
                onUploadResponse={() => setResponseDialogOpen(true)}
                onCompleteProgram={() =>
                  completeConfirmationProgram.mutate(activeConfirmation)
                }
                undoReviewAction={
                  canUndoReview ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={undoConfirmationReview.isPending}
                      onClick={() => setUndoReviewDialogOpen(true)}
                    >
                      <Undo2 />
                      {copy.reviewResolution.undoReview}
                    </Button>
                  ) : undefined
                }
                redispatchAction={
                  canRedispatch && !readOnly ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={startRedispatchEditing.isPending}
                        onClick={() =>
                          startRedispatchEditing.mutate(activeConfirmation)
                        }
                      >
                        <Pencil />
                        {copy.tracking.editRedispatch}
                      </Button>
                      {activeConfirmation.currentArtifact ? (
                        <ProjectConfirmationDispatchAction
                          copy={{
                            ...copy.tracking,
                            cancel: commonCopy.cancel,
                          }}
                          locale={locale}
                          isDispatching={dispatchConfirmation.isPending}
                          methodLabels={copy.dispatchMethodLabels}
                          confirmationName={getConfirmationDisplayName(
                            activeConfirmation,
                            copy
                          )}
                          attachmentFileName={`${sanitizeFileName(
                            getConfirmationDispatchAttachmentFileName(
                              activeConfirmation,
                              copy
                            )
                          )}`}
                          defaultRecipientName={
                            activeConfirmation.counterpartyName
                          }
                          defaultRecipientContact={
                            activeConfirmation.counterpartyContact ?? ""
                          }
                          mailConnection={mailConnection.data}
                          searchTrackingCarriers={api.tracking17TrackCarriers}
                          isRedispatch
                          showWithdraw={false}
                          triggerLabel={copy.tracking.followUp.redispatch}
                          onDispatch={(input) =>
                            dispatchConfirmation.mutateAsync({
                              confirmation: activeConfirmation,
                              input,
                            })
                          }
                          onUploadDispatchScan={(confirmation, file) =>
                            uploadDispatchScan.mutateAsync({
                              confirmation,
                              file,
                            })
                          }
                        />
                      ) : null}
                    </>
                  ) : undefined
                }
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {completionFeedbackId === activeConfirmation.id ? (
              <div
                role="status"
                aria-live="polite"
                data-testid="confirmation-review-completion"
                className="flex shrink-0 items-center gap-2 border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
              >
                <span className="font-medium">
                  {copy.tracking.workflowCompleted}
                </span>
                <span className="text-muted-foreground">
                  {copy.statusLabels.CLOSED}
                </span>
              </div>
            ) : null}
            <ReviewPanel
              confirmation={activeConfirmation}
              copy={copy}
              locale={locale}
              projectId={projectId}
              toolbar={(stageActions) => (
                <ConfirmationDetailToolbar
                  confirmation={activeConfirmation}
                  copy={copy}
                  onBack={returnToRegister}
                  stageTabs={stageTabs}
                  stageActions={stageActions}
                />
              )}
              resolution={
                ((activeConfirmation.status === "RESPONSE_RECEIVED" &&
                  (!activeConfirmation.differenceStatus ||
                    activeConfirmation.differenceStatus ===
                      "PENDING_FOLLOW_UP")) ||
                  canUndoReview) &&
                !readOnly ? (
                  <ConfirmationReviewResolution
                    status={activeConfirmation.status}
                    differenceStatus={activeConfirmation.differenceStatus}
                    canEdit
                    isSaving={reviewConfirmationResponse.isPending}
                    isCompleting={completeConfirmationProgram.isPending}
                    canUndo={canUndoReview}
                    isUndoing={undoConfirmationReview.isPending}
                    copy={copy.reviewResolution}
                    onReview={(input) =>
                      reviewConfirmationResponse.mutate({
                        confirmation: activeConfirmation,
                        input,
                      })
                    }
                    onCompleteAlternativeProcedure={() =>
                      completeConfirmationProgram.mutate(activeConfirmation)
                    }
                    onUndo={() => setUndoReviewDialogOpen(true)}
                  />
                ) : null
              }
              canWithdraw={canWithdrawResponse}
              isWithdrawing={withdrawConfirmationResponse.isPending}
              canAddFiles={!readOnly}
              canImportToEmp={
                !readOnly &&
                activeConfirmation.status === "CLOSED" &&
                activeConfirmation.differenceStatus === "MATCHED"
              }
              isAddingFiles={addResponseArtifacts.isPending}
              onAddFiles={(responseId, files) =>
                addResponseArtifacts.mutate({
                  confirmation: activeConfirmation,
                  responseId,
                  files,
                })
              }
              onWithdraw={() => setWithdrawResponseDialogOpen(true)}
              onImportToEmp={() =>
                setEmpImportConfirmationIds([activeConfirmation.id])
              }
              onDownload={(responseId, artifact) => {
                downloadResponseScan(activeConfirmation, responseId, artifact);
              }}
            />
          </div>
        )
      ) : navigationFilter === "OVERVIEW" ? (
        <ConfirmationOverviewMatrix
          confirmations={rows}
          copy={copy}
          locale={locale}
          onCellSelect={selectOverviewCell}
        />
      ) : navigationFilter === "BASE_INFORMATION" ? (
        <ConfirmationBaseInformationPanel
          copy={copy}
          locale={locale}
          readOnly={readOnly}
          values={baseInformationValues}
          isSaving={saveBaseInformation.isPending}
          onChange={setBaseInformationValues}
          onSave={() => saveBaseInformation.mutate(baseInformationValues)}
        />
      ) : navigationFilter === "TEMPLATE_LIBRARY" ? (
        <ConfirmationTemplateLibrary
          copy={copy}
          commonCopy={commonCopy}
          currentUser={currentUser}
          locale={locale}
          projectId={projectId}
        />
      ) : navigationFilter === "INFORMATION_LIBRARY" ? (
        <ConfirmationInformationLibrary
          accessCopy={
            informationLibraryCopy.access ?? {
              complete: copy.informationLibraryMatch.complete,
              readOnlyTitle: "Read-only",
              readOnlyDescription:
                "Only SUPER_ADMIN can edit bank information.",
            }
          }
          canManage={currentUser?.globalRole === "SUPER_ADMIN"}
          copy={informationLibraryCopy}
          locale={locale}
        />
      ) : navigationFilter === "RESPONSE_WAREHOUSE" ? (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-0">
          <div className="min-h-[32rem] flex-1">
            <ProjectResponseWarehouse
              cancelLabel={commonCopy.cancel}
              copy={{
                ...responseWarehouseCopy,
                title: copy.sections.responseWarehouse,
              }}
              currentUserId={currentUser?.id}
              locale={locale}
              projectId={projectId}
              projectName={project?.name}
              projectCode={project?.projectCode}
              unmatchedOnly
              allowNoSourceRequest={!readOnly}
              onRouted={async (response, action) => {
                if (
                  (action === "MATCH_CONFIRMATION" ||
                    action === "NO_SOURCE_REQUEST") &&
                  response.confirmationId
                ) {
                  await openRoutedConfirmation(response);
                  const url = new URL(window.location.href);
                  url.searchParams.set("workspace", "confirmations");
                  url.searchParams.set(
                    "confirmationId",
                    response.confirmationId
                  );
                  window.history.pushState(window.history.state, "", url);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                  return;
                }
                if (action === "NO_SOURCE_REQUEST") {
                  setPendingNoSourceResponse(response);
                  setNewCategory("FINANCIAL");
                  setNewType("BANK");
                  setNewDialogOpen(true);
                  return;
                }
                await openRoutedConfirmation(response);
              }}
              {...(readOnly
                ? {}
                : { onImportToEmp: setEmpImportConfirmationIds })}
            />
          </div>
        </div>
      ) : (
        <ConfirmationRegister
          confirmations={filteredRows}
          filterConfirmations={registerFilterSourceRows}
          copy={copy}
          editingName={editingName}
          editingNameId={editingNameId}
          hasSearchOrFilters={hasSearchOrFilters}
          isRecycleBin={navigationFilter === "RECYCLE_BIN"}
          locale={locale}
          nameQuery={namePrefix}
          readOnly={readOnly}
          filters={registerFilters}
          title={getConfirmationRegisterTitle(
            copy,
            navigationFilter,
            registerScope
          )}
          onEditName={(confirmation) => {
            setEditingNameId(confirmation.id);
            setEditingName(getConfirmationDisplayName(confirmation, copy));
          }}
          onEditingNameChange={setEditingName}
          onEditingNameCommit={commitConfirmationName}
          onEditingNameCancel={() => setEditingNameId(null)}
          onNameQueryChange={setNamePrefix}
          showNew={navigationFilter !== "RECYCLE_BIN"}
          onNew={() => {
            setNewCategory("FINANCIAL");
            setNewType("BANK");
            setNewDialogOpen(true);
          }}
          onOpen={selectConfirmation}
          onVoidMany={setVoidingConfirmations}
          onRestoreMany={(selectedConfirmations) =>
            restoreConfirmation.mutate(selectedConfirmations)
          }
          isVoiding={voidConfirmation.isPending}
          isRestoring={restoreConfirmation.isPending}
          lifecycleActionResetKey={lifecycleActionResetKey}
          onFiltersChange={setRegisterFilters}
          onResetFilters={() => {
            setRegisterFilters(DEFAULT_CONFIRMATION_REGISTER_FILTERS);
            setRegisterScope("ALL");
            setNamePrefix("");
          }}
        />
      )}
    </main>
  );

  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/20 p-3",
        phone && mobileStyles.root
      )}
    >
      {phone ? (
        <ConfirmationMobileDirectoryProvider
          locale={locale}
          onOpen={() => setMobileNavigationOpen(true)}
        >
          <div className={mobileStyles.workspace} ref={mobileWorkspaceRef}>
            {!activeConfirmation &&
              (navigationFilter === "TEMPLATE_LIBRARY" ||
                navigationFilter === "INFORMATION_LIBRARY" ||
                navigationFilter === "RESPONSE_WAREHOUSE") && (
                <div className={mobileStyles.libraryHeading}>
                  <ConfirmationMobileHeading
                    title={
                      navigationFilter === "TEMPLATE_LIBRARY"
                        ? copy.templateLibrary.title
                        : navigationFilter === "INFORMATION_LIBRARY"
                          ? informationLibraryCopy.title
                          : copy.sections.responseWarehouse
                    }
                  />
                </div>
              )}
            {workspaceContent}
            <MobileActionSheet
              open={mobileNavigationOpen}
              onOpenChange={setMobileNavigationOpen}
              onOpenChangeComplete={(open) => {
                if (!open) {
                  mobileWorkspaceRef.current
                    ?.querySelector<HTMLButtonElement>(
                      '[data-testid="confirmation-mobile-directory"]'
                    )
                    ?.focus({ preventScroll: true });
                }
              }}
              title={locale === "zh-CN" ? "函证目录" : "Confirmation views"}
              closeLabel={commonCopy.cancel}
            >
              <ConfirmationCategoryNavigation
                confirmations={rows}
                pendingResponseCount={pendingResponses.data?.length ?? 0}
                copy={copy}
                value={navigationFilter}
                onValueChange={(value) => {
                  selectNavigation(value);
                  setMobileNavigationOpen(false);
                }}
              />
            </MobileActionSheet>
          </div>
        </ConfirmationMobileDirectoryProvider>
      ) : (
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full min-h-0 gap-0 overflow-visible"
        >
          <ResizablePanel
            panelRef={categoryNavigationPanelRef}
            defaultSize="16rem"
            minSize="0rem"
            maxSize="20rem"
            collapsedSize="0rem"
            collapsible
            className={cn(
              "relative z-30 min-w-0 !overflow-hidden",
              isCategoryNavigationDragging &&
                "!overflow-visible transition-none"
            )}
          >
            <aside
              className={cn(
                "h-full min-h-0 overflow-y-auto rounded-xl border border-border bg-card px-3 py-4 shadow-sm transition-opacity duration-200 ease-out motion-reduce:transition-none",
                isCategoryNavigationCollapsed &&
                  !categoryNavigationDragPreviewExpanded
                  ? "opacity-0"
                  : "opacity-100"
              )}
              style={{ width: categoryNavigationWidth }}
              inert={
                isCategoryNavigationCollapsed &&
                !categoryNavigationDragPreviewExpanded
              }
            >
              <ConfirmationCategoryNavigation
                confirmations={rows}
                pendingResponseCount={pendingResponses.data?.length ?? 0}
                copy={copy}
                value={navigationFilter}
                onValueChange={selectNavigation}
              />
            </aside>
          </ResizablePanel>
          <SplitterRail
            ref={categoryNavigationSplitterRef}
            expanded={
              !isCategoryNavigationCollapsed ||
              categoryNavigationDragPreviewExpanded
            }
            hitAreaTestId="confirmation-category-navigation-splitter-hit-area"
            label={copy.secondaryHeaderLabel}
            max={CONFIRMATION_NAV_MAX_WIDTH}
            min={CONFIRMATION_NAV_MIN_WIDTH}
            onDrag={handleCategoryNavigationResize}
            onDragCancel={handleCategoryNavigationResizeCancel}
            onDragEnd={handleCategoryNavigationResizeEnd}
            onPointerDown={handleCategoryNavigationResizeStart}
            onToggle={() =>
              setCategoryNavigationOpen(isCategoryNavigationCollapsed)
            }
            value={Math.round(
              isCategoryNavigationCollapsed ? 0 : categoryNavigationWidth
            )}
            className="relative z-10"
          />

          <ResizablePanel minSize="28rem" className="min-w-0 !overflow-hidden">
            {workspaceContent}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      <Dialog
        open={Boolean(empImportConfirmationIds?.length)}
        onOpenChange={(open) => {
          if (!open && !empImportBusy) {
            closeEmpImport();
            setEmpImportBusy(false);
          }
        }}
      >
        <DialogContent className="h-[min(42rem,calc(100vh-2rem))] max-h-none w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[min(42rem,calc(100vh-3rem))] sm:max-h-none sm:w-[min(72rem,calc(100vw-3rem))] sm:max-w-[min(72rem,calc(100vw-3rem))]">
          <DialogHeader className="border-b px-6 py-5 pr-14">
            <DialogTitle className="flex items-center gap-2">
              <Archive className="size-5 text-primary" />
              {responseImportCopy.title}
            </DialogTitle>
          </DialogHeader>
          {empImportConfirmationIds?.length ? (
            <ConfirmationResponseWarehouse
              copy={responseImportCopy}
              projectId={projectId}
              projectName={project?.name}
              projectCode={project?.projectCode}
              clientName={
                locale.startsWith("zh")
                  ? (project?.cmpClient?.nameZh ??
                    project?.cmpClient?.nameEn ??
                    undefined)
                  : (project?.cmpClient?.nameEn ??
                    project?.cmpClient?.nameZh ??
                    undefined)
              }
              confirmationIds={empImportConfirmationIds}
              onBusyChange={setEmpImportBusy}
              onClose={closeEmpImport}
              onViewProject={() => {
                setEmpImportConfirmationIds(null);
                onViewProjectFiles?.();
              }}
              onCompleted={() => {
                void invalidateConfirmationEmpImportQueries(
                  queryClient,
                  projectId
                );
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={newDialogOpen}
        onOpenChange={(open) => {
          setNewDialogOpen(open);
          if (!open && !pendingNoSourceCreateRef.current) {
            setPendingNoSourceResponse(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.newConfirmationDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.newConfirmationDialog.description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="new-confirmation-category">
                {copy.register.newCategoryLabel}
              </Label>
              <Select
                value={newCategory}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  const category = value as ConfirmationCategory;
                  setNewCategory(category);
                  setNewType(CATEGORY_TYPES[category][0] ?? "BANK");
                }}
              >
                <SelectTrigger
                  id="new-confirmation-category"
                  className="w-full"
                >
                  <SelectValue>
                    {getCategoryLabel(copy, newCategory)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  {(["FINANCIAL", "CORRESPONDENCE", "OTHER"] as const).map(
                    (category) => (
                      <SelectItem key={category} value={category}>
                        {getCategoryLabel(copy, category)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-confirmation-type">
                {copy.register.newSubtypeLabel}
              </Label>
              <Select
                value={newType}
                onValueChange={(value) => {
                  if (!value) {
                    return;
                  }
                  setNewType(value as ConfirmationType);
                }}
              >
                <SelectTrigger id="new-confirmation-type" className="w-full">
                  <SelectValue>{copy.typeLabels[newType]}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false}>
                  {CATEGORY_TYPES[newCategory].map((type) => (
                    <SelectItem key={type} value={type}>
                      {getSubtypeLabel(copy, type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => {
                  pendingNoSourceCreateRef.current = false;
                  setPendingNoSourceResponse(null);
                  setNewDialogOpen(false);
                }}
              >
                {commonCopy.cancel}
              </Button>
              <Button
                disabled={createDraft.isPending}
                onClick={() => {
                  pendingNoSourceCreateRef.current = true;
                  createDraft.mutate({ type: newType });
                  setNewDialogOpen(false);
                }}
              >
                {copy.newConfirmationDialog.create}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {copy.newConfirmationDialog.uploadDocument}
            </DialogTitle>
            <DialogDescription>
              {locale === "zh-CN"
                ? "上传 PDF 函证文件，每份最大 20 MB。"
                : "Upload PDF confirmation files, up to 20 MB each."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="upload-counterparty">
                {copy.newConfirmationDialog.counterpartyLabel}
              </Label>
              <Input
                id="upload-counterparty"
                value={uploadCounterparty}
                onChange={(event) => setUploadCounterparty(event.target.value)}
                placeholder={copy.newConfirmationDialog.counterpartyPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmation-file">
                {copy.newConfirmationDialog.fileLabel}
              </Label>
              {activeConfirmation?.uploadedFileNames?.length ? (
                <ul className="max-h-32 overflow-y-auto text-sm text-muted-foreground">
                  {activeConfirmation.uploadedFileNames.map((name, index) => (
                    <li key={`${index}-${name}`}>
                      {index + 1}. {name}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ConfirmationResponseFilePicker
                id="confirmation-file"
                label={copy.newConfirmationDialog.fileLabel}
                help={
                  locale === "zh-CN"
                    ? "支持多选或分次添加 PDF，每份最大 20 MB；追加后按顺序合并预览与下载。"
                    : "Select PDFs together or in batches, up to 20 MB each. Files are appended in order for preview and download."
                }
                accept={PDF_CONTENT_TYPE}
                locale={locale}
                files={uploadFiles}
                onChange={setUploadFiles}
              />
            </div>
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
              >
                {commonCopy.cancel}
              </Button>
              <Button
                disabled={
                  !uploadFiles.length ||
                  uploadFiles.some((file) => file.size === 0) ||
                  !uploadCounterparty.trim() ||
                  uploadConfirmation.isPending
                }
                onClick={() => uploadConfirmation.mutate()}
              >
                <Upload />
                {copy.newConfirmationDialog.uploadAndSubmit}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSupplementingResponse
                ? copy.tracking.responseAddFiles
                : copy.tracking.recordResponseTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {copy.tracking.recordResponseDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {isSupplementingResponse ? null : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="confirmation-response-received-at">
                      {copy.tracking.responseReceivedAt}
                    </Label>
                    <ConfirmationReceivedDateField
                      id="confirmation-response-received-at"
                      label={copy.tracking.responseReceivedAt}
                      locale={locale}
                      value={responseReceivedAt}
                      onChange={setResponseReceivedAt}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmation-response-channel">
                      {copy.tracking.responseChannel}
                    </Label>
                    <Select
                      value={responseChannel}
                      onValueChange={(value) =>
                        value &&
                        setResponseChannel(value as typeof responseChannel)
                      }
                    >
                      <SelectTrigger
                        id="confirmation-response-channel"
                        className="w-full"
                      >
                        <SelectValue>
                          {copy.tracking.responseChannels[responseChannel]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(["PAPER", "ELECTRONIC", "OTHER"] as const).map(
                          (channel) => (
                            <SelectItem key={channel} value={channel}>
                              {copy.tracking.responseChannels[channel]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmation-response-reference">
                    {copy.tracking.responseReference}
                  </Label>
                  <Input
                    id="confirmation-response-reference"
                    value={responseReference}
                    placeholder={copy.tracking.responseReferencePlaceholder}
                    onChange={(event) =>
                      setResponseReference(event.target.value)
                    }
                  />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="confirmation-response-file">
                {copy.tracking.responseScan}
              </Label>
              <ConfirmationResponseFilePicker
                id="confirmation-response-file"
                label={copy.tracking.responseScan}
                help={copy.tracking.responseScanHelp}
                accept={CONFIRMATION_RESPONSE_FILE_ACCEPT}
                locale={locale}
                files={responseFiles}
                onChange={setResponseFiles}
              />
            </div>
            {isSupplementingResponse ? null : (
              <div className="grid gap-2">
                <Label htmlFor="confirmation-response-notes">
                  {copy.tracking.responseNotes}
                </Label>
                <Textarea
                  id="confirmation-response-notes"
                  value={responseNotes}
                  onChange={(event) => setResponseNotes(event.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => setResponseDialogOpen(false)}
              >
                {commonCopy.cancel}
              </Button>
              <Button
                disabled={
                  !responseFiles.length ||
                  !responseReceivedAt ||
                  receiveConfirmationResponse.isPending
                }
                onClick={() => receiveConfirmationResponse.mutate()}
              >
                <Upload />
                {isSupplementingResponse
                  ? copy.tracking.responseAddFiles
                  : copy.tracking.responseConfirm}
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={voidingConfirmations.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setVoidingConfirmations([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.register.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.register.deleteDescription.replace(
                "{name}",
                voidingConfirmations
                  .map((confirmation) =>
                    getConfirmationDisplayName(confirmation, copy)
                  )
                  .join(locale.startsWith("zh") ? "、" : ", ")
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                voidConfirmation.isPending || !voidingConfirmations.length
              }
              onClick={() =>
                voidingConfirmations.length > 0 &&
                voidConfirmation.mutate(voidingConfirmations)
              }
            >
              <Trash2 />
              {copy.register.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={withdrawResponseDialogOpen}
        onOpenChange={setWithdrawResponseDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy.tracking.withdrawResponseTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy.tracking.withdrawResponseDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={withdrawConfirmationResponse.isPending}
              onClick={() =>
                activeConfirmation &&
                latestResponse &&
                withdrawConfirmationResponse.mutate({
                  confirmation: activeConfirmation,
                  responseId: latestResponse.id,
                })
              }
            >
              <Undo2 />
              {copy.tracking.withdrawResponseConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={undoReviewDialogOpen}
        onOpenChange={setUndoReviewDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {copy.reviewResolution.undoReviewTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {copy.reviewResolution.undoReviewDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{commonCopy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={undoConfirmationReview.isPending || !canUndoReview}
              onClick={() =>
                activeConfirmation &&
                undoConfirmationReview.mutate(activeConfirmation)
              }
            >
              <Undo2 />
              {copy.reviewResolution.undoReviewConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ConfirmationCategoryNavigation({
  confirmations,
  pendingResponseCount,
  copy,
  value,
  onValueChange,
}: {
  confirmations: ProjectConfirmation[];
  pendingResponseCount: number;
  copy: ProjectConfirmationsCopy;
  value: ConfirmationNavigationKey;
  onValueChange: (value: ConfirmationNavigationKey) => void;
}) {
  const groups: {
    key: ConfirmationCategory;
    icon: LucideIcon;
    items: ConfirmationType[];
  }[] = [
    {
      key: "FINANCIAL",
      icon: Landmark,
      items: CATEGORY_TYPES.FINANCIAL,
    },
    {
      key: "CORRESPONDENCE",
      icon: Handshake,
      items: CATEGORY_TYPES.CORRESPONDENCE,
    },
    {
      key: "OTHER",
      icon: Scale,
      items: CATEGORY_TYPES.OTHER,
    },
  ];

  return (
    <nav className="grid gap-3" aria-label={copy.register.allConfirmations}>
      <Button
        type="button"
        variant={value === "OVERVIEW" ? "secondary" : "ghost"}
        data-active={value === "OVERVIEW"}
        className={cn(surfaceMotion.navItem, "h-10 justify-start px-3")}
        onClick={() => onValueChange("OVERVIEW")}
      >
        <LayoutDashboard />
        <span className="flex-1 text-left">{copy.overview.navigation}</span>
      </Button>

      <Button
        type="button"
        variant={value === "BASE_INFORMATION" ? "secondary" : "ghost"}
        data-active={value === "BASE_INFORMATION"}
        className={cn(surfaceMotion.navItem, "h-10 justify-start px-3")}
        onClick={() => onValueChange("BASE_INFORMATION")}
      >
        <FileText />
        <span className="flex-1 text-left">
          {copy.sections.baseInformation}
        </span>
      </Button>

      <Button
        type="button"
        variant={value === "ALL" ? "secondary" : "ghost"}
        data-active={value === "ALL"}
        className={cn(surfaceMotion.navItem, "h-10 justify-start px-3")}
        onClick={() => onValueChange("ALL")}
      >
        <FileText />
        <span className="flex-1 text-left">
          {copy.register.allConfirmations}
        </span>
        <LogisticsUnreadDot
          confirmationIds={confirmations
            .filter((row) => matchesConfirmationNavigation(row, "ALL"))
            .map((row) => row.id)}
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {countForNavigation(confirmations, "ALL")}
        </span>
      </Button>

      <Separator />

      {groups.map((group) => {
        const GroupIcon = group.icon;
        const categoryTone = getConfirmationCategoryTone(group.key);
        return (
          <div className="grid gap-1" key={group.key}>
            <Button
              type="button"
              variant={value === group.key ? "secondary" : "ghost"}
              data-active={value === group.key}
              data-category-tone={categoryTone.key}
              className={cn(
                surfaceMotion.navItem,
                "h-9 justify-start border px-3 font-semibold",
                categoryTone.navigation
              )}
              onClick={() => onValueChange(group.key)}
            >
              <GroupIcon />
              <span className="flex-1 text-left">
                {getCategoryLabel(copy, group.key)}
              </span>
              <LogisticsUnreadDot
                confirmationIds={confirmations
                  .filter((row) =>
                    matchesConfirmationNavigation(row, group.key)
                  )
                  .map((row) => row.id)}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {countForNavigation(confirmations, group.key)}
              </span>
            </Button>
            <div className="grid gap-0.5 pl-7">
              {group.items.map((type) => (
                <Button
                  type="button"
                  variant="ghost"
                  data-active={value === getSubtypeNavigationKey(type)}
                  data-category-tone={getConfirmationTypeTone(type).key}
                  className={cn(
                    surfaceMotion.navItem,
                    "h-8 justify-start px-3",
                    getConfirmationTypeTone(type).navigation,
                    "border-0 bg-transparent",
                    value === getSubtypeNavigationKey(type)
                      ? "bg-secondary shadow-sm"
                      : undefined
                  )}
                  key={type}
                  onClick={() => onValueChange(getSubtypeNavigationKey(type))}
                >
                  <span className="flex-1 text-left">
                    {getSubtypeLabel(copy, type)}
                  </span>
                  <LogisticsUnreadDot
                    confirmationIds={confirmations
                      .filter((row) =>
                        matchesConfirmationNavigation(row, getSubtypeNavigationKey(type))
                      )
                      .map((row) => row.id)}
                  />
                  <span className="text-xs tabular-nums">
                    {countForNavigation(confirmations, getSubtypeNavigationKey(type))}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        );
      })}

      <Separator />

      <Button
        type="button"
        variant={value === "RESPONSE_WAREHOUSE" ? "secondary" : "ghost"}
        data-active={value === "RESPONSE_WAREHOUSE"}
        className={cn(
          surfaceMotion.navItem,
          "h-9 justify-start border px-3",
          value === "RESPONSE_WAREHOUSE"
            ? "bg-rose-100 text-rose-800 shadow-sm hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/40"
            : "text-rose-700 hover:text-rose-700"
        )}
        onClick={() => onValueChange("RESPONSE_WAREHOUSE")}
      >
        <Archive />
        <span className="flex-1 text-left">
          {copy.sections.responseWarehouse}
        </span>
        <span className="text-xs tabular-nums">{pendingResponseCount}</span>
      </Button>

      <Button
        type="button"
        variant={value === "RECYCLE_BIN" ? "secondary" : "ghost"}
        data-active={value === "RECYCLE_BIN"}
        data-category-tone={getConfirmationCategoryTone("RECYCLE_BIN").key}
        className={cn(
          surfaceMotion.navItem,
          "h-9 justify-start border px-3",
          getConfirmationCategoryTone("RECYCLE_BIN").navigation
        )}
        onClick={() => onValueChange("RECYCLE_BIN")}
      >
        <Trash2 />
        <span className="flex-1 text-left">{copy.register.recycleBin}</span>
        <span className="text-xs tabular-nums">
          {countForNavigation(confirmations, "RECYCLE_BIN")}
        </span>
      </Button>

      <Button
        type="button"
        variant={value === "TEMPLATE_LIBRARY" ? "secondary" : "ghost"}
        data-active={value === "TEMPLATE_LIBRARY"}
        className={cn(
          surfaceMotion.navItem,
          "h-9 justify-start px-3 text-muted-foreground"
        )}
        onClick={() => onValueChange("TEMPLATE_LIBRARY")}
      >
        <FileText />
        <span className="flex-1 text-left">
          {copy.register.templateLibrary}
        </span>
      </Button>

      <Button
        type="button"
        variant={value === "INFORMATION_LIBRARY" ? "secondary" : "ghost"}
        data-active={value === "INFORMATION_LIBRARY"}
        className={cn(
          surfaceMotion.navItem,
          "h-9 justify-start px-3 text-muted-foreground"
        )}
        onClick={() => onValueChange("INFORMATION_LIBRARY")}
      >
        <Landmark />
        <span className="flex-1 text-left">
          {copy.informationLibraryMatch.grid.title}
        </span>
      </Button>
    </nav>
  );
}

function ConfirmationBaseInformationPanel({
  copy,
  isSaving,
  locale,
  onChange,
  onSave,
  readOnly,
  values,
}: {
  copy: ProjectConfirmationsCopy;
  isSaving: boolean;
  locale: string;
  onChange: React.Dispatch<React.SetStateAction<BaseInformationFormValues>>;
  onSave: () => void;
  readOnly: boolean;
  values: BaseInformationFormValues;
}) {
  const text = copy.baseInformation;
  const phone = useCompactViewport(767.98);
  const globalFields = useConfirmationGeneralFields();
  const globalLayout = useConfirmationGeneralLayout();
  const customFields = (
    globalFields.data ??
    values.baseInformation.customFields ??
    []
  ).map((field) => ({
    ...field,
    value:
      values.baseInformation.customFields?.find((item) => item.id === field.id)
        ?.value ?? "",
  }));
  const updateBase = (patch: Partial<ProjectConfirmationBaseInformation>) => {
    onChange((current) => ({
      ...current,
      baseInformation: { ...current.baseInformation, ...patch },
    }));
  };
  const updateLegacy = (field: keyof GeneralFillValues, value: string) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <section
      aria-label={text.title}
      className={`min-h-full min-w-0 overflow-y-auto bg-background p-6 ${baseInformationStyles.panel}`}
      data-testid="confirmation-base-information"
      lang={locale.startsWith("zh") ? "zh-CN" : "en"}
    >
      <div
        className={`mx-auto grid max-w-5xl gap-6 ${baseInformationStyles.content}`}
      >
        <header
          className={`flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5 ${baseInformationStyles.intro}`}
        >
          <div>
            {phone ? (
              <ConfirmationMobileHeading title={text.title} />
            ) : (
              <h1 className="text-xl font-semibold tracking-tight">
                {text.title}
              </h1>
            )}
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {text.description}
            </p>
          </div>
          {!phone && (
            <Button
              type="button"
              disabled={readOnly || isSaving}
              onClick={onSave}
            >
              {isSaving ? "…" : text.save}
            </Button>
          )}
        </header>

        {globalLayout.data || phone ? (
          <ConfirmationBaseInformationLayout
            layout={
              globalLayout.data ??
              getConfirmationBaseInformationFallback(copy, customFields)
            }
            values={values}
            readOnly={readOnly}
            isSaving={isSaving}
            locale={locale}
            onChange={onChange}
          />
        ) : (
          <>
            <div className="grid gap-5">
              <BaseInformationRowsCard
                title={text.clientNames}
                addLabel={text.add}
                removeLabel={text.remove}
                values={values.baseInformation.clientNames}
                readOnly={readOnly}
                onChange={(clientNames) => updateBase({ clientNames })}
              />
              <BaseInformationRowsCard
                title={text.references}
                addLabel={text.add}
                removeLabel={text.remove}
                values={values.baseInformation.references}
                readOnly={readOnly}
                onChange={(references) => updateBase({ references })}
              />
            </div>

            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">{text.banks}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text.emptyHint}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() =>
                    updateBase({
                      banks: [
                        ...values.baseInformation.banks,
                        { name: "", account: "", address: "" },
                      ],
                    })
                  }
                >
                  <Plus />
                  {text.addBank}
                </Button>
              </div>
              <div className="mt-4 grid gap-3">
                {values.baseInformation.banks.map((bank, index) => (
                  <div
                    className="grid gap-3 rounded-lg border border-border/60 bg-muted/10 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]"
                    key={`base-bank-${index}`}
                  >
                    <BaseInformationInput
                      label={text.bankName}
                      value={bank.name}
                      disabled={readOnly}
                      id={`base-bank-name-${index}`}
                      onChange={(name) => {
                        const banks = [...values.baseInformation.banks];
                        banks[index] = { ...banks[index], name };
                        updateBase({ banks });
                      }}
                    />
                    <BaseInformationInput
                      label={text.account}
                      value={bank.account}
                      disabled={readOnly}
                      id={`base-bank-account-${index}`}
                      onChange={(account) => {
                        const banks = [...values.baseInformation.banks];
                        banks[index] = { ...banks[index], account };
                        updateBase({ banks });
                      }}
                    />
                    <BaseInformationInput
                      label={text.address}
                      value={bank.address}
                      disabled={readOnly}
                      id={`base-bank-address-${index}`}
                      onChange={(address) => {
                        const banks = [...values.baseInformation.banks];
                        banks[index] = { ...banks[index], address };
                        updateBase({ banks });
                      }}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${text.remove} ${index + 1}`}
                      disabled={
                        readOnly || values.baseInformation.banks.length <= 1
                      }
                      className="self-end text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        updateBase({
                          banks: values.baseInformation.banks.filter(
                            (_, rowIndex) => rowIndex !== index
                          ),
                        })
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">{copy.generalFill.title}</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.generalFill.description}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["confirmationDate", copy.generalFill.fields.date],
                    ["pic", copy.generalFill.fields.pic],
                    ["mic", copy.generalFill.fields.mic],
                    ["reportDate", copy.generalFill.fields.reportDate],
                  ] as const
                ).map(([field, label]) => (
                  <BaseInformationInput
                    key={field}
                    id={`base-legacy-${field}`}
                    label={label}
                    value={values[field]}
                    disabled={readOnly}
                    onChange={(value) => updateLegacy(field, value)}
                  />
                ))}
                {customFields.map((field) => (
                  <div key={field.id} className="min-w-0">
                    <BaseInformationInput
                      id={`custom-value-${field.id}`}
                      label={field.name}
                      value={field.value}
                      disabled={readOnly || isSaving}
                      onChange={(value) =>
                        updateBase({
                          customFields: customFields.map((item) =>
                            item.id === field.id ? { ...item, value } : item
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      {phone && (
        <footer className={baseInformationStyles.saveBar}>
          <MobileButton
            type="button"
            variant="primary"
            disabled={readOnly || isSaving}
            loading={isSaving}
            onClick={onSave}
          >
            {text.save}
          </MobileButton>
        </footer>
      )}
    </section>
  );
}

function BaseInformationRowsCard({
  addLabel,
  onChange,
  readOnly,
  removeLabel,
  title,
  values,
}: {
  addLabel: string;
  onChange: (values: string[]) => void;
  readOnly: boolean;
  removeLabel: string;
  title: string;
  values: string[];
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() => onChange([...values, ""])}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>
      <div className="mt-4 grid gap-3">
        {values.map((value, index) => (
          <div className="flex items-end gap-2" key={`${title}-${index}`}>
            <BaseInformationInput
              id={`base-${title}-${index}`}
              label={`${title} ${index + 1}`}
              value={value}
              disabled={readOnly}
              onChange={(nextValue) => {
                const next = [...values];
                next[index] = nextValue;
                onChange(next);
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`${removeLabel} ${index + 1}`}
              disabled={readOnly || values.length <= 1}
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange(values.filter((_, rowIndex) => rowIndex !== index))
              }
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function BaseInformationInput({
  disabled,
  id,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

export function ConfirmationTemplateLibrary({
  copy,
  commonCopy,
  currentUser,
  locale,
  projectId,
}: {
  copy: ProjectConfirmationsCopy;
  commonCopy: Dictionary["common"];
  currentUser?: Pick<User, "id" | "globalRole"> | null;
  locale: string;
  projectId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ConfirmationFilter<ConfirmationType>>("ALL");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<ConfirmationType>("BANK");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateFiles, setTemplateFiles] = useState<File[]>([]);
  const compact = useCompactViewport();
  const [previewingTemplate, setPreviewingTemplate] =
    useState<ConfirmationTemplateLibraryFile | null>(null);
  const [designingTemplate, setDesigningTemplate] =
    useState<ConfirmationTemplateLibraryFile | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(
    () => new Set()
  );
  const [templateSelectionAction, setTemplateSelectionAction] = useState<
    "DELETE" | "ENABLE" | "DISABLE" | null
  >(null);
  const [bulkDeletingTemplateIds, setBulkDeletingTemplateIds] = useState<
    string[]
  >([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManageTemplates = currentUser
    ? canGlobalRoleManageConfirmationTemplates(currentUser.globalRole)
    : false;
  const canManageTemplate = useCallback(
    (_template: ConfirmationTemplateLibraryFile) => canManageTemplates,
    [canManageTemplates]
  );
  const templates = useQuery({
    queryKey: ["confirmation-template-library"],
    queryFn: api.confirmationTemplateLibrary,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return (templates.data ?? []).filter(
      (template) =>
        (type === "ALL" || template.confirmationType === type) &&
        (!normalizedQuery ||
          [template.code, template.name, template.fileName].some((value) =>
            value.toLocaleLowerCase(locale).includes(normalizedQuery)
          ))
    );
  }, [locale, query, templates.data, type]);
  const selectableRows = useMemo(
    () => rows.filter(canManageTemplate),
    [canManageTemplate, rows]
  );
  const deletableRows = selectableRows;
  useEffect(() => {
    const selectableIds = new Set(
      selectableRows.map((template) => template.id)
    );
    setSelectedTemplateIds((current) => {
      const next = new Set(
        [...current].filter((templateId) => selectableIds.has(templateId))
      );
      return next.size === current.size ? current : next;
    });
  }, [selectableRows]);
  const selectedVisibleTemplateIds = useMemo(() => {
    const selectableIds = new Set(
      selectableRows.map((template) => template.id)
    );
    return new Set(
      [...selectedTemplateIds].filter((templateId) =>
        selectableIds.has(templateId)
      )
    );
  }, [selectableRows, selectedTemplateIds]);
  const selectedDeletableTemplateIds = useMemo(() => {
    const deletableIds = new Set(deletableRows.map((template) => template.id));
    return new Set(
      [...selectedVisibleTemplateIds].filter((templateId) =>
        deletableIds.has(templateId)
      )
    );
  }, [deletableRows, selectedVisibleTemplateIds]);
  const allSelectableRowsSelected =
    selectableRows.length > 0 &&
    selectableRows.every((template) =>
      selectedVisibleTemplateIds.has(template.id)
    );
  const someSelectableRowsSelected =
    selectedVisibleTemplateIds.size > 0 && !allSelectableRowsSelected;
  const toggleTemplateSelection = (templateId: string, checked: boolean) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(templateId);
      } else {
        next.delete(templateId);
      }
      return next;
    });
  };
  const toggleAllTemplateSelection = (checked: boolean) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      for (const template of selectableRows) {
        if (checked) {
          next.add(template.id);
        } else {
          next.delete(template.id);
        }
      }
      return next;
    });
  };
  const upload = useMutation({
    mutationFn: () => {
      if (
        templateFiles.length === 0 ||
        (templateFiles.length === 1 && !templateName.trim())
      ) {
        throw new Error(copy.templateLibrary.noFile);
      }
      return Promise.all(
        templateFiles.map((file) =>
          api.uploadConfirmationTemplateLibraryFile({
            name:
              templateFiles.length > 1
                ? file.name.replace(/\.pdf$/iu, "")
                : templateName.trim(),
            confirmationType: templateType,
            ...(templateDescription.trim()
              ? { description: templateDescription.trim() }
              : {}),
            file,
          })
        )
      );
    },
    onSuccess: async (uploadedTemplates) => {
      await queryClient.invalidateQueries({
        queryKey: ["confirmation-template-library"],
      });
      setUploadOpen(false);
      setTemplateName("");
      setTemplateType("BANK");
      setTemplateDescription("");
      setTemplateFiles([]);
      setPreviewingTemplate(null);
      setPreviewExpanded(false);
      setDesigningTemplate(uploadedTemplates[0] ?? null);
      toast({ title: copy.templateLibrary.uploadSuccess });
    },
    onError: (error) =>
      toast({
        title: copy.templateLibrary.uploadError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });
  const bulkRemove = useMutation({
    mutationFn: (templateIds: string[]) =>
      Promise.all(
        templateIds.map((templateId) =>
          api.deleteConfirmationTemplateLibraryFile(templateId)
        )
      ),
    onSuccess: async (_results, templateIds) => {
      await queryClient.invalidateQueries({
        queryKey: ["confirmation-template-library"],
      });
      if (previewingTemplate && templateIds.includes(previewingTemplate.id)) {
        setPreviewingTemplate(null);
        setPreviewExpanded(false);
      }
      setBulkDeletingTemplateIds([]);
      setSelectedTemplateIds(new Set());
      setTemplateSelectionAction(null);
      toast({ title: copy.templateLibrary.deleteSuccess });
    },
    onError: () =>
      toast({
        title: copy.templateLibrary.deleteError,
        variant: "destructive",
      }),
  });

  const updateDesign = useMutation({
    mutationFn: ({
      templateId,
      input,
    }: {
      templateId: string;
      input: UpdateConfirmationTemplateLibraryDesignInput;
    }) => api.updateConfirmationTemplateLibraryDesign(templateId, input),
    onSuccess: async (template) => {
      const templateLibraryQueryKey = [
        "confirmation-template-library",
      ] as const;
      const cachedTemplate = queryClient
        .getQueryData<ConfirmationTemplateLibraryFile[]>(
          templateLibraryQueryKey
        )
        ?.find((item) => item.id === template.id);
      const mergedTemplate = cachedTemplate
        ? {
            ...cachedTemplate,
            ...template,
            uploader: template.uploader ?? cachedTemplate.uploader,
          }
        : template;
      setDesigningTemplate(mergedTemplate);
      queryClient.setQueryData<ConfirmationTemplateLibraryFile[]>(
        templateLibraryQueryKey,
        (current) =>
          current?.map((item) =>
            item.id === template.id
              ? {
                  ...item,
                  ...template,
                  uploader: template.uploader ?? item.uploader,
                }
              : item
          ) ?? [mergedTemplate]
      );
      await queryClient.invalidateQueries({
        queryKey: templateLibraryQueryKey,
      });
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: ["project-confirmations", projectId],
        });
      }
      toast({ title: copy.templateLibrary.saveDesignSuccess });
    },
    onError: (error) =>
      toast({
        title: copy.templateLibrary.saveDesignError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  const updateTemplateCache = (
    updatedTemplates: readonly ConfirmationTemplateLibraryFile[]
  ) => {
    const updatedById = new Map(
      updatedTemplates.map((template) => [template.id, template])
    );
    queryClient.setQueryData<ConfirmationTemplateLibraryFile[]>(
      ["confirmation-template-library"],
      (current) =>
        current?.map((template) => {
          const updated = updatedById.get(template.id);
          return updated
            ? {
                ...template,
                ...updated,
                uploader: updated.uploader ?? template.uploader,
              }
            : template;
        }) ?? current
    );
  };

  const updateTemplateStatus = useMutation({
    mutationFn: ({
      templateId,
      designStatus,
    }: {
      templateId: string;
      designStatus: ConfirmationTemplateDesignStatus;
    }) =>
      templateStatusApi.updateConfirmationTemplateLibraryStatus(templateId, {
        designStatus,
      }),
    onSuccess: async (template) => {
      updateTemplateCache([template]);
      await queryClient.invalidateQueries({
        queryKey: ["confirmation-template-library"],
      });
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: ["project-confirmations", projectId],
        });
      }
      toast({ title: copy.templateLibrary.statusUpdateSuccess });
    },
    onError: (error) =>
      toast({
        title: copy.templateLibrary.statusUpdateError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  const bulkUpdateTemplateStatus = useMutation({
    mutationFn: (input: {
      templateIds: string[];
      designStatus: ConfirmationTemplateDesignStatus;
    }) => templateStatusApi.bulkUpdateConfirmationTemplateLibraryStatus(input),
    onSuccess: async (updatedTemplates) => {
      updateTemplateCache(updatedTemplates);
      setSelectedTemplateIds(new Set());
      setTemplateSelectionAction(null);
      await queryClient.invalidateQueries({
        queryKey: ["confirmation-template-library"],
      });
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: ["project-confirmations", projectId],
        });
      }
      toast({ title: copy.templateLibrary.statusUpdateSuccess });
    },
    onError: (error) =>
      toast({
        title: copy.templateLibrary.statusUpdateError,
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      }),
  });

  const globalFields = useConfirmationGeneralFields();
  const globalLayout = useConfirmationGeneralLayout();
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const statusMutationPending = bulkUpdateTemplateStatus.isPending;
  const templateActionPending =
    statusMutationPending ||
    updateTemplateStatus.isPending ||
    bulkRemove.isPending;
  const bulkUpdateSelectedTemplates = (
    designStatus: ConfirmationTemplateDesignStatus
  ) => {
    if (!selectedVisibleTemplateIds.size || statusMutationPending) {
      return;
    }
    bulkUpdateTemplateStatus.mutate({
      templateIds: [...selectedVisibleTemplateIds],
      designStatus,
    });
  };
  const exitTemplateSelectionMode = () => {
    setSelectedTemplateIds(new Set());
    setTemplateSelectionAction(null);
  };
  const requestBulkDelete = () => {
    if (!selectedDeletableTemplateIds.size || templateActionPending) {
      return;
    }
    setBulkDeletingTemplateIds([...selectedDeletableTemplateIds]);
  };
  const handleTemplateSelectionAction = (
    action: "DELETE" | "ENABLE" | "DISABLE"
  ) => {
    if (templateSelectionAction !== action) {
      setTemplateSelectionAction(action);
      return;
    }
    if (!selectedVisibleTemplateIds.size) {
      exitTemplateSelectionMode();
      return;
    }
    if (action === "DELETE") {
      requestBulkDelete();
      return;
    }
    bulkUpdateSelectedTemplates(action === "ENABLE" ? "ENABLED" : "DISABLED");
  };

  if (generalSettingsOpen && currentUser?.globalRole === "SUPER_ADMIN") {
    return (
      <ConfirmationGeneralInformationSettings
        locale={locale}
        onBack={() => setGeneralSettingsOpen(false)}
      />
    );
  }

  if (designingTemplate && canManageTemplates) {
    return (
      <ConfirmationTemplateWorkbench
        customFields={globalFields.data?.map((field) => ({
          ...field,
          value: "",
        }))}
        generalLayout={globalLayout.data}
        copy={copy.templateLibrary.workbench}
        loadFile={() =>
          api.previewConfirmationTemplateLibraryFile(designingTemplate.id)
        }
        onBack={() => setDesigningTemplate(null)}
        onSave={async (input) => {
          await updateDesign.mutateAsync({
            templateId: designingTemplate.id,
            input,
          });
        }}
        template={designingTemplate}
      />
    );
  }

  return (
    <ResizablePanelGroup
      orientation={compact ? "vertical" : "horizontal"}
      className="h-full min-h-0 gap-1 overflow-hidden"
    >
      <ResizablePanel
        minSize={compact ? (previewingTemplate ? "30%" : 0) : "32rem"}
        className="h-full min-h-0 min-w-0 overflow-hidden"
      >
        <section
          data-preview-open={previewingTemplate ? "true" : "false"}
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden bg-card [&_[data-slot=frame]]:h-full [&_[data-slot=frame]]:rounded-none [&_[data-slot=frame]]:border-0",
            previewingTemplate &&
              "border-r border-border [&_[data-slot=frame]]:border-r-0"
          )}
          aria-label={copy.templateLibrary.title}
        >
          <div className="min-h-0 flex-1">
            <ConfirmationTemplateLibraryDataGrid
              locale={locale}
              allSelectableRowsSelected={allSelectableRowsSelected}
              canManageTemplates={canManageTemplates}
              canManageTemplate={canManageTemplate}
              commonCopy={commonCopy}
              copy={copy}
              deletableRowsExist={deletableRows.length > 0}
              getDesignStatus={getTemplateDesignStatus}
              isTemplateDesignable={isTemplateDesignable}
              isLoading={templates.isLoading}
              onDelete={(template) => setBulkDeletingTemplateIds([template.id])}
              onDesign={(template) => {
                setPreviewingTemplate(null);
                setPreviewExpanded(false);
                setDesigningTemplate(template);
              }}
              onDownload={(template) =>
                window.open(
                  api.confirmationTemplateLibraryDownloadUrl(template.id),
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              onExitSelection={exitTemplateSelectionMode}
              onPreview={setPreviewingTemplate}
              onQueryChange={(value) => {
                setQuery(value);
                exitTemplateSelectionMode();
              }}
              onSelectionAction={handleTemplateSelectionAction}
              onToggleAllSelection={toggleAllTemplateSelection}
              onToggleSelection={(template, selected) =>
                toggleTemplateSelection(template.id, selected)
              }
              onToggleStatus={(template, designStatus) =>
                updateTemplateStatus.mutate({
                  templateId: template.id,
                  designStatus,
                })
              }
              onTypeChange={(value) => {
                setType(value as ConfirmationFilter<ConfirmationType>);
                exitTemplateSelectionMode();
              }}
              generalInformationSettings={
                currentUser?.globalRole === "SUPER_ADMIN" ? (
                  <Button
                    variant="outline"
                    onClick={() => setGeneralSettingsOpen(true)}
                  >
                    {locale.startsWith("zh")
                      ? "通用信息设置"
                      : "General information settings"}
                  </Button>
                ) : undefined
              }
              onUpload={() => setUploadOpen(true)}
              previewingTemplateId={previewingTemplate?.id ?? null}
              query={query}
              rows={rows}
              selectedTemplateIds={selectedTemplateIds}
              selectionAction={templateSelectionAction}
              someSelectableRowsSelected={someSelectableRowsSelected}
              statusMutationPending={statusMutationPending}
              templateActionPending={templateActionPending}
              type={type}
              typeOptions={FILTER_TYPES.map((item) => ({
                value: item,
                label: getSubtypeLabel(copy, item),
              }))}
            />
          </div>

          <Dialog
            open={canManageTemplates && uploadOpen}
            onOpenChange={setUploadOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{copy.templateLibrary.uploadTitle}</DialogTitle>
                <DialogDescription>
                  {copy.templateLibrary.uploadDescription}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="confirmation-template-name">
                    {copy.templateLibrary.name}
                  </Label>
                  <Input
                    id="confirmation-template-name"
                    value={templateName}
                    placeholder={copy.templateLibrary.namePlaceholder}
                    onChange={(event) => setTemplateName(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmation-template-type">
                    {copy.templateLibrary.type}
                  </Label>
                  <Select
                    value={templateType}
                    onValueChange={(value) =>
                      value && setTemplateType(value as ConfirmationType)
                    }
                  >
                    <SelectTrigger
                      id="confirmation-template-type"
                      className="w-full"
                    >
                      <SelectValue>
                        {getSubtypeLabel(copy, templateType)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_TYPES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {getSubtypeLabel(copy, item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmation-template-description">
                    {copy.templateLibrary.descriptionLabel}
                  </Label>
                  <Textarea
                    id="confirmation-template-description"
                    value={templateDescription}
                    placeholder={copy.templateLibrary.descriptionPlaceholder}
                    onChange={(event) =>
                      setTemplateDescription(event.target.value)
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{copy.templateLibrary.file}</Label>
                  <FileInput
                    ref={fileInputRef}
                    accept={TEMPLATE_FILE_ACCEPT}
                    multiple
                    onChange={(event) =>
                      setTemplateFiles([...(event.target.files ?? [])])
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload />
                    {copy.templateLibrary.chooseFile}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {templateFiles.length === 0
                      ? copy.templateLibrary.noFile
                      : templateFiles.map((file) => file.name).join(", ")}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <ButtonGroup>
                  <Button
                    variant="outline"
                    onClick={() => setUploadOpen(false)}
                  >
                    {commonCopy.cancel}
                  </Button>
                  <Button
                    disabled={
                      templateFiles.length === 0 ||
                      (templateFiles.length === 1 && !templateName.trim()) ||
                      upload.isPending
                    }
                    onClick={() => upload.mutate()}
                  >
                    <Upload />
                    {copy.templateLibrary.uploadConfirm}
                  </Button>
                </ButtonGroup>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={bulkDeletingTemplateIds.length > 0}
            onOpenChange={(open) => {
              if (open) {
                return;
              }
              setBulkDeletingTemplateIds([]);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {copy.templateLibrary.deleteTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {copy.templateLibrary.deleteDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{commonCopy.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={bulkRemove.isPending}
                  onClick={() => {
                    bulkRemove.mutate(bulkDeletingTemplateIds);
                  }}
                >
                  {copy.templateLibrary.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </ResizablePanel>
      {previewingTemplate ? (
        <>
          <ResizableHandle
            withHandle
            label={copy.templateLibrary.resizePreview}
            className="relative z-20"
          />
          <ResizablePanel
            defaultSize={compact ? "50%" : "42rem"}
            minSize={compact ? "30%" : "28rem"}
            groupResizeBehavior="preserve-pixel-size"
            className={`h-full min-h-0 min-w-0 overflow-hidden rounded-xl border border-border bg-workbench-sidebar shadow-sm ${
              previewExpanded ? "fixed inset-0 z-50 rounded-none border-0" : ""
            }`}
          >
            <BlobFilePreviewPane
              key={previewingTemplate.id}
              ariaLabel={`${copy.templateLibrary.preview}: ${previewingTemplate.name}`}
              fileName={previewingTemplate.fileName}
              mimeType={previewingTemplate.mimeType}
              queryKey={[
                "confirmation-template-library",
                "preview",
                previewingTemplate.id,
                previewingTemplate.updatedAt,
              ]}
              loadFile={() =>
                api.previewConfirmationTemplateLibraryFile(
                  previewingTemplate.id
                )
              }
              renderPageOverlay={({ pageNumber }) => (
                <ConfirmationTemplateLibraryFieldOverlay
                  locale={locale}
                  designSchema={previewingTemplate.designSchema}
                  pageNumber={pageNumber}
                />
              )}
              copy={{
                loading: copy.templateLibrary.loadingPreview,
                failedTitle: copy.templateLibrary.previewFailedTitle,
                retry: copy.templateLibrary.retryPreview,
                unsupported: copy.templateLibrary.unsupportedPreview,
              }}
              toolbarActions={
                <>
                  <PreviewPanelActions
                    expandLabel={copy.templateLibrary.expandPreview}
                    exitExpandedLabel={copy.templateLibrary.exitExpandedPreview}
                    isPreviewExpanded={previewExpanded}
                    onTogglePreviewExpanded={() =>
                      setPreviewExpanded((current) => !current)
                    }
                    openInNewWindowLabel={
                      copy.templateLibrary.openPreviewInNewWindow
                    }
                    onOpenInNewWindow={() => {
                      openAuthorizedPreviewWindow({
                        fileName: previewingTemplate.fileName,
                        mimeType: previewingTemplate.mimeType,
                        loadBlob: () =>
                          api.previewConfirmationTemplateLibraryFile(
                            previewingTemplate.id
                          ),
                      });
                    }}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={copy.templateLibrary.closePreview}
                    onClick={() => {
                      setPreviewingTemplate(null);
                      setPreviewExpanded(false);
                    }}
                  >
                    <X />
                  </Button>
                </>
              }
            />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}

function ConfirmationDetailToolbar({
  confirmation,
  copy,
  onBack,
  stageTabs,
  stageActions,
}: {
  confirmation: ProjectConfirmation;
  copy: ProjectConfirmationsCopy;
  onBack: () => void;
  stageTabs: ReactNode;
  stageActions?: ReactNode;
}) {
  const { toast } = useToast();
  const tone = getConfirmationTypeTone(confirmation.type);
  const displayName = getConfirmationDisplayName(confirmation, copy);
  const confirmationCode = confirmation.confirmationCode?.trim();
  const identity = confirmationCode || displayName;
  const secondaryName =
    confirmationCode &&
    displayName !== copy.newConfirmation &&
    displayName !== confirmationCode
      ? displayName
      : null;
  return (
    <div
      data-testid="confirmation-detail-toolbar"
      className="flex min-w-0 shrink-0 flex-col border-b border-border"
    >
      <div
        data-testid="confirmation-detail-toolbar-primary"
        className="flex min-h-10 min-w-0 items-center gap-2 px-3 py-1.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 transition-transform hover:-translate-x-0.5 active:translate-y-px"
          aria-label={copy.backToAllConfirmations}
          onClick={onBack}
        >
          <ChevronLeft />
          <span className="hidden sm:inline">
            {copy.backToAllConfirmations}
          </span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <Badge
            variant="outline"
            data-category-tone={tone.key}
            className={cn("max-w-40 truncate", tone.badge)}
          >
            {getSubtypeLabel(copy, confirmation.type)}
          </Badge>
          <span
            className={cn(
              "shrink-0 truncate text-sm font-semibold",
              confirmationCode ? "font-mono" : "min-w-0"
            )}
          >
            {identity}
          </span>
          {confirmationCode ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label={copy.copyConfirmationCode}
              title={copy.copyConfirmationCode}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(confirmationCode);
                  toast({ title: copy.confirmationCodeCopied });
                } catch {
                  toast({
                    title: copy.confirmationCodeCopyFailed,
                    variant: "destructive",
                  });
                }
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          ) : null}
          {secondaryName ? (
            <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
              {secondaryName}
            </span>
          ) : null}
        </div>
        <ConfirmationMobileDirectoryButton />
        <div className="min-w-0 shrink-0">{stageTabs}</div>
      </div>
      {stageActions === undefined ? null : (
        <div
          data-testid="confirmation-detail-toolbar-actions"
          className="flex min-h-10 min-w-0 items-center border-t border-border/70 px-3 py-1.5"
        >
          {stageActions}
        </div>
      )}
    </div>
  );
}

function getSubtypeNavigationKey(
  type: ConfirmationType
): ConfirmationNavigationKey {
  return type === "OTHER" ? "OTHER_TYPE" : type;
}

function matchesConfirmationNavigation(
  confirmation: ProjectConfirmation,
  navigation: ConfirmationNavigationKey
) {
  if (navigation === "OVERVIEW") {
    return false;
  }
  if (navigation === "TEMPLATE_LIBRARY") {
    return false;
  }
  if (navigation === "INFORMATION_LIBRARY") {
    return false;
  }
  if (navigation === "RECYCLE_BIN") {
    return confirmation.status === "VOIDED";
  }
  if (confirmation.status === "VOIDED") {
    return false;
  }
  if (navigation === "ALL") {
    return true;
  }
  if (navigation === "OTHER_TYPE") {
    return confirmation.type === "OTHER";
  }
  if (navigation === "UNCLASSIFIED") {
    return isUnclassifiedConfirmation(confirmation);
  }
  if (navigation in CATEGORY_TYPES) {
    return CATEGORY_TYPES[navigation as ConfirmationCategory].includes(
      confirmation.type
    );
  }
  return confirmation.type === navigation;
}

function countForNavigation(
  confirmations: ProjectConfirmation[],
  navigation: ConfirmationNavigationKey
) {
  return confirmations.filter((confirmation) =>
    matchesConfirmationNavigation(confirmation, navigation)
  ).length;
}

function getFiltersForOverviewColumn(
  column: ConfirmationOverviewCellSelection["column"]
): Partial<ConfirmationRegisterFilters> {
  if (column === "DRAFT") {
    return { currentStatus: ["DRAFT"] };
  }
  if (column === "PREPARED") {
    return { currentStatus: ["PREPARED"] };
  }
  if (column === "SENT_TOTAL") {
    return { currentStatus: ["SENT"] };
  }
  if (column.startsWith("SENT_")) {
    return {
      currentStatus: ["SENT"],
      waitingTime: [
        column.replace(
          "SENT_",
          ""
        ) as ConfirmationRegisterFilters["waitingTime"][number],
      ],
    };
  }
  if (column === "RECEIVED_PENDING") {
    return { currentStatus: ["RECEIVED"], responseOutcome: ["PENDING"] };
  }
  if (column === "RECEIVED_MISMATCH") {
    return { currentStatus: ["RECEIVED"], responseOutcome: ["MISMATCH"] };
  }
  if (column === "RECEIVED_TOTAL") {
    return { currentStatus: ["RECEIVED"] };
  }
  if (column === "PROCESSED") {
    return { currentStatus: ["PROCESSED"] };
  }
  if (column === "COMPLETED") {
    return { currentStatus: ["COMPLETED"] };
  }
  return {};
}

function getCategoryLabel(
  copy: ProjectConfirmationsCopy,
  category: ConfirmationCategory
) {
  if (category === "FINANCIAL") {
    return copy.register.financialInstitutions;
  }
  if (category === "CORRESPONDENCE") {
    return copy.register.correspondence;
  }
  if (category === "UNCLASSIFIED") {
    return copy.register.unclassified;
  }
  return copy.register.otherConfirmations;
}

function getSubtypeLabel(
  copy: ProjectConfirmationsCopy,
  type: ConfirmationType
) {
  const labels: Record<ConfirmationType, string> = {
    BANK: copy.register.bank,
    INTERMEDIARY: copy.register.otherFinancialInstitution,
    BALANCE: copy.register.thirdParty,
    RELATED_PARTY: copy.register.relatedParty,
    LAWYER: copy.register.lawyer,
    INVENTORY: copy.register.inventory,
    OTHER: copy.register.miscellaneous,
    UNCLASSIFIED: copy.register.unclassified,
  };
  return labels[type] ?? copy.register.unclassified;
}

function getConfirmationRegisterTitle(
  copy: ProjectConfirmationsCopy,
  navigation: ConfirmationNavigationKey,
  scope: ConfirmationNavigationKey
) {
  const value = scope === "ALL" ? navigation : scope;
  if (value === "OTHER_TYPE") {
    return getSubtypeLabel(copy, "OTHER");
  }
  if (value === "ALL") {
    return copy.register.allConfirmations;
  }
  if (value === "RECYCLE_BIN") {
    return copy.register.recycleBin;
  }
  if (
    value === "FINANCIAL" ||
    value === "CORRESPONDENCE" ||
    value === "OTHER"
  ) {
    return getCategoryLabel(copy, value);
  }
  if (
    value === "BANK" ||
    value === "INTERMEDIARY" ||
    value === "BALANCE" ||
    value === "RELATED_PARTY" ||
    value === "LAWYER" ||
    value === "INVENTORY" ||
    value === "UNCLASSIFIED"
  ) {
    return getSubtypeLabel(copy, value);
  }
  return copy.register.allConfirmations;
}

function ReviewPanel({
  confirmation,
  copy,
  locale,
  projectId,
  toolbar,
  resolution,
  canWithdraw,
  isWithdrawing,
  canAddFiles,
  canImportToEmp,
  isAddingFiles,
  onAddFiles,
  onImportToEmp,
  onWithdraw,
  onDownload,
}: {
  confirmation: ProjectConfirmation | null;
  copy: ProjectConfirmationsCopy;
  locale: string;
  projectId: string;
  toolbar: (stageActions: ReactNode) => ReactNode;
  resolution: ReactNode;
  canWithdraw: boolean;
  isWithdrawing: boolean;
  canAddFiles: boolean;
  canImportToEmp: boolean;
  isAddingFiles: boolean;
  onAddFiles: (responseId: string, files: File[]) => void;
  onImportToEmp: () => void;
  onWithdraw: () => void;
  onDownload: (
    responseId: string,
    artifact: { id: string; fileName: string }
  ) => void;
}) {
  const response = confirmation
    ? getLatestRoutedResponse(confirmation)
    : undefined;
  const artifacts = response?.artifacts ?? EMPTY_RESPONSE_ARTIFACTS;
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null
  );
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const artifact =
    artifacts.find((item) => item.id === selectedArtifactId) ?? artifacts[0];

  useEffect(() => {
    if (!artifacts.some((item) => item.id === selectedArtifactId)) {
      setSelectedArtifactId(artifacts[0]?.id ?? null);
    }
  }, [artifacts, selectedArtifactId]);

  if (!confirmation || !response || !artifact) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card"
        data-testid="confirmation-review-panel"
      >
        {toolbar(
          resolution ? <div className="shrink-0">{resolution}</div> : null
        )}
        <div className="grid min-h-80 flex-1 place-items-center border-y border-dashed border-border px-6 text-center">
          <div className="max-w-lg">
            <Archive className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {copy.reviewEmpty}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone = getConfirmationTypeTone(confirmation.type);
  const selectedArtifactIndex = Math.max(
    0,
    artifacts.findIndex((item) => item.id === artifact.id)
  );
  const normalizedFileQuery = fileQuery.trim().toLocaleLowerCase(locale);
  const filteredArtifacts = normalizedFileQuery
    ? artifacts.filter(
        (item) =>
          item.fileName
            .toLocaleLowerCase(locale)
            .includes(normalizedFileQuery) ||
          String(item.sequence).includes(normalizedFileQuery)
      )
    : artifacts;
  const responseMeta = [
    formatDate(response.receivedAt, locale),
    response.responseChannel
      ? copy.tracking.responseChannels[response.responseChannel]
      : "",
    response.responseReference ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  const stageActions = (
    <div
      data-testid="confirmation-review-header"
      className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <Popover
            open={filePickerOpen}
            onOpenChange={(open) => {
              setFilePickerOpen(open);
              if (!open) {
                setFileQuery("");
              }
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  role="combobox"
                  aria-controls="confirmation-response-file-picker-options"
                  aria-expanded={filePickerOpen}
                  aria-label={`${copy.tracking.responseFilePicker}: ${artifact.fileName}`}
                  data-testid="confirmation-response-file-picker-trigger"
                  data-category-tone={tone.key}
                  className={cn(
                    "w-full min-w-0 justify-start border shadow-none",
                    tone.navigation
                  )}
                />
              }
            >
              <FileText />
              <span className="shrink-0 text-xs tabular-nums">
                {selectedArtifactIndex + 1}/{artifacts.length}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">
                {artifact.fileName}
              </span>
              <ChevronsUpDown className="text-current/60" />
            </PopoverTrigger>
            {filePickerOpen ? (
              <PopoverContent
                align="start"
                sideOffset={4}
                collisionAvoidance={{ side: "flip", align: "shift" }}
                data-testid="confirmation-response-file-picker-content"
                className="max-h-(--available-height) w-[min(26rem,calc(100vw-2rem))] overflow-hidden p-2"
              >
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    autoComplete="off"
                    autoFocus
                    aria-label={copy.tracking.responseFileSearch}
                    placeholder={copy.tracking.responseFileSearch}
                    value={fileQuery}
                    onChange={(event) => setFileQuery(event.target.value)}
                  />
                </InputGroup>
                <div
                  id="confirmation-response-file-picker-options"
                  role="listbox"
                  aria-label={copy.tracking.responseFilePicker}
                  className="max-h-72 min-h-0 overflow-y-auto overscroll-contain"
                >
                  {filteredArtifacts.length ? (
                    <ButtonGroup
                      orientation="vertical"
                      className="w-full gap-1"
                    >
                      {filteredArtifacts.map((item) => {
                        const active = item.id === artifact.id;
                        const fileSize = formatFileSize(item.fileSize);
                        return (
                          <Button
                            key={item.id}
                            type="button"
                            size="sm"
                            variant="ghost"
                            role="option"
                            aria-selected={active}
                            aria-current={active ? "true" : undefined}
                            aria-label={`${item.sequence}. ${item.fileName}, ${fileSize}`}
                            data-category-tone={active ? tone.key : undefined}
                            className={cn(
                              "h-auto w-full min-w-0 justify-start border border-transparent px-2 py-2 text-left",
                              active ? tone.navigation : "hover:border-border"
                            )}
                            onClick={() => {
                              setSelectedArtifactId(item.id);
                              setFilePickerOpen(false);
                              setFileQuery("");
                            }}
                          >
                            <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                              {item.sequence}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {item.fileName}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {fileSize}
                              </span>
                            </span>
                            {active ? <Check className="shrink-0" /> : null}
                          </Button>
                        );
                      })}
                    </ButtonGroup>
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      {copy.tracking.responseFileEmpty}
                    </p>
                  )}
                </div>
              </PopoverContent>
            ) : null}
          </Popover>
        </div>
        {resolution ? (
          <div className="shrink-0">{resolution}</div>
        ) : responseMeta ? (
          <p className="hidden max-w-64 min-w-0 shrink truncate text-xs text-muted-foreground lg:block">
            {responseMeta}
          </p>
        ) : null}
      </div>
      <ButtonGroup className="ml-auto shrink-0">
        <Input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          aria-label={copy.tracking.responseAddFiles}
          accept={CONFIRMATION_RESPONSE_FILE_ACCEPT}
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length && response) {
              onAddFiles(response.id, files);
            }
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canAddFiles || isAddingFiles}
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus />
          {copy.tracking.responseAddFiles}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDownload(response.id, artifact)}
        >
          <Download />
          {copy.tracking.responseDownload}
        </Button>
        {canImportToEmp ? (
          <Button type="button" variant="outline" onClick={onImportToEmp}>
            <FolderInput />
            {copy.tracking.importToProjectDirectory}
          </Button>
        ) : null}
        {canWithdraw ? (
          <Button
            type="button"
            variant="outline"
            disabled={isWithdrawing}
            onClick={onWithdraw}
          >
            <Undo2 />
            {copy.tracking.withdrawResponse}
          </Button>
        ) : null}
      </ButtonGroup>
    </div>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card"
      data-testid="confirmation-review-panel"
    >
      {toolbar(stageActions)}
      <ConfirmationResponsePreview
        artifact={artifact}
        projectId={projectId}
        confirmationId={confirmation.id}
        responseId={response.id}
        copy={{
          loading: copy.tracking.responsePreviewLoading,
          loadError: copy.tracking.responsePreviewError,
          retry: copy.tracking.responsePreviewRetry,
        }}
      />
    </div>
  );
}

function toLocalDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getLatestDispatch(confirmation: ProjectConfirmation) {
  return [...(confirmation.dispatches ?? [])].sort(
    (left, right) => right.sequence - left.sequence
  )[0];
}

function getLatestWorkflowDispatch(confirmation: ProjectConfirmation) {
  return [...(confirmation.dispatches ?? [])]
    .filter((dispatch) => dispatch.executionStatus !== "FAILED")
    .sort((left, right) => right.sequence - left.sequence)[0];
}

function getLatestEvent<T extends { occurredAt: string }>(
  events: T[] | null | undefined
) {
  return [...(events ?? [])].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  )[0];
}

function getInitialStage(confirmation: ProjectConfirmation): PreparationStage {
  if (confirmation.status === "DRAFT" || confirmation.status === "PREPARED") {
    return "draft";
  }
  if (
    confirmation.status === "AWAITING_RESPONSE" &&
    confirmation.differenceStatus === "EXCEPTION"
  ) {
    return "tracking";
  }
  if (
    confirmation.status === "CLOSED" ||
    confirmation.status === "RESPONSE_RECEIVED" ||
    getLatestRoutedResponse(confirmation)
  ) {
    return "review";
  }
  if (confirmation.status === "AWAITING_RESPONSE") {
    return "tracking";
  }
  return "tracking";
}

const UNDOABLE_CONFIRMATION_EVENT_TYPES = new Set([
  "PROGRAM_COMPLETED",
  "REDISPATCH_REQUESTED",
  "REVIEW_RECORDED",
]);

function getUndoableConfirmationReviewEvent(
  confirmation: ProjectConfirmation
): {
  event: ConfirmationReviewTransitionEvent;
  payload: ConfirmationReviewTransitionPayload;
} | null {
  const current: ConfirmationPhaseSnapshot = {
    status: confirmation.status,
    differenceStatus: confirmation.differenceStatus ?? null,
    notes: confirmation.notes ?? null,
  };
  const response = getLatestRoutedResponse(confirmation);
  const retractedEventIds = new Set<string>();
  const events = (confirmation.followUpEvents ?? [])
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const createdAt =
        new Date(right.event.createdAt).getTime() -
        new Date(left.event.createdAt).getTime();
      if (createdAt !== 0) {
        return createdAt;
      }
      const occurredAt =
        new Date(right.event.occurredAt).getTime() -
        new Date(left.event.occurredAt).getTime();
      return occurredAt === 0 ? right.index - left.index : occurredAt;
    });

  for (const { event } of events) {
    const payload = getConfirmationReviewTransitionPayload(
      event.eventType,
      event.payload,
      event.notes,
      current,
      response?.id
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
      !sameConfirmationPhase(payload.next, current) ||
      (payload.responseId && payload.responseId !== response?.id)
    ) {
      continue;
    }
    if (
      event.eventType === "REDISPATCH_REQUESTED" &&
      confirmation.dispatches?.some(
        (dispatch) =>
          dispatch.sequence > 1 &&
          new Date(dispatch.createdAt).getTime() >=
            new Date(event.occurredAt).getTime()
      )
    ) {
      continue;
    }
    return { event, payload };
  }
  return null;
}

function parseConfirmationReviewTransitionPayload(
  payload: unknown
): ConfirmationReviewTransitionPayload | null {
  if (!isRecord(payload)) {
    return null;
  }
  return {
    responseId: readOptionalString(payload.responseId),
    result: readOptionalString(payload.result),
    action: readOptionalString(payload.action),
    resolution: readOptionalString(payload.resolution),
    targetEventId: readOptionalString(payload.targetEventId),
    previous: parseConfirmationPhaseSnapshot(payload.previous) ?? undefined,
    next: parseConfirmationPhaseSnapshot(payload.next) ?? undefined,
  };
}

function getConfirmationReviewTransitionPayload(
  eventType: string,
  rawPayload: unknown,
  eventNotes: string | null | undefined,
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
  // one-step states, and never overwrite a note that was recorded with the event.
  if (eventNotes !== null && eventNotes !== undefined) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getLatestRoutedResponse(confirmation: ProjectConfirmation) {
  return [...(confirmation.responses ?? [])]
    .filter((response) => response.routingStatus === "ROUTED")
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .at(0);
}

function getConfirmationDisplayName(
  confirmation: ProjectConfirmation,
  copy: ProjectConfirmationsCopy
) {
  return (
    confirmation.displayName?.trim() ||
    confirmation.counterpartyName.trim() ||
    copy.newConfirmation
  );
}

function getDerivedValues(
  project: Project | undefined,
  currentUser: Pick<User, "name" | "email"> | null | undefined,
  members: ProjectMember[],
  confirmation: ProjectConfirmation | null,
  locale: string
): ConfirmationDerivedValues {
  const pic =
    project?.cmpEngagement?.pic?.trim() ||
    project?.cmpClient?.clientPartnerPic?.trim() ||
    members.find((member) => member.inChargeRole === "PARTNER_IN_CHARGE")?.user
      .name ||
    "";
  const balanceSheetDate =
    project?.cmpEngagement?.yearEndDate ?? project?.yearEndDate;
  const fiscalYear = balanceSheetDate
    ? String(new Date(balanceSheetDate).getUTCFullYear())
    : "";
  return {
    balanceSheetDate: formatDate(balanceSheetDate, locale),
    clientCode: project?.cmpClient?.clientCode?.trim() || "",
    clientName:
      project?.cmpClient?.nameZh?.trim() ||
      project?.cmpClient?.nameEn?.trim() ||
      "",
    confirmationCode: confirmation?.confirmationCode ?? "",
    contactEmail: currentUser?.email?.trim() ?? "",
    contactName: currentUser?.name?.trim() ?? "",
    fiscalYear,
    picName: pic,
    projectCode: project?.projectCode ?? "",
    projectName: project?.name ?? "",
  };
}

function createIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

function sanitizeFileName(value: string) {
  const invalid = '<>:"/\\|?*';
  const sanitized = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 || invalid.includes(character) ? "-" : character;
    })
    .join("")
    .trim();
  return sanitized || "confirmation";
}

function getConfirmationDownloadFileName(
  confirmation: ProjectConfirmation,
  copy: ProjectConfirmationsCopy,
  extension: "pdf" | "docx" = "pdf"
) {
  const originalName =
    getProjectConfirmationAttachment(confirmation).originalFileName?.trim();
  if (
    originalName &&
    (confirmation.currentArtifact?.templateCode === "UPLOADED_DOCUMENT" ||
      !/\.(?:pdf|docx?)$/i.test(originalName))
  ) {
    return sanitizeFileName(originalName);
  }
  return `${sanitizeFileName(getConfirmationDisplayName(confirmation, copy))}.${extension}`;
}

export function getConfirmationDispatchAttachmentFileName(
  confirmation: ProjectConfirmation,
  copy: ProjectConfirmationsCopy
) {
  const attachment = getProjectConfirmationAttachment(confirmation);
  if (
    confirmation.currentArtifact?.templateCode === "UPLOADED_DOCUMENT" &&
    attachment.originalFileName?.trim()
  ) {
    return sanitizeFileName(attachment.originalFileName);
  }
  return `${sanitizeFileName(getConfirmationDisplayName(confirmation, copy))}.pdf`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale).format(date);
}

function formatFileSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function showMutationError(
  error: unknown,
  title: string,
  localizedErrors: Record<string, string>,
  toast: (options: {
    title: string;
    description?: string;
    variant?: "destructive";
  }) => void,
  setValidationErrors: (errors: string[]) => void
) {
  const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
  const message =
    localizedErrors[code] ??
    (error instanceof ApiError ? localizedErrors.REQUEST_FAILED : undefined) ??
    getUserFacingErrorMessage(error, title);
  const detail = message;
  setValidationErrors([message]);
  toast({ title, description: detail, variant: "destructive" });
}
