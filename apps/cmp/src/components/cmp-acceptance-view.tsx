"use client";

import {
  CmpAcceptanceEngagementDraftPayloadSchema,
  CMP_BUDGET_CURRENCIES,
  CMP_BUDGET_CURRENCY_LABELS,
  CmpClientAcceptanceDraftPayloadSchema,
  CreateCmpEngagementSchema,
  getCmpFixedBudgetExchangeRate,
} from "@project-wing/shared";
import type {
  CmpAcceptanceChangeSummary,
  CmpAcceptanceEngagementDraftPayload,
  CmpAcceptanceRequest,
  CmpAcceptanceRequestType,
  CmpAcceptanceStatus,
  CmpAcceptanceStep,
  CmpBudgetCurrency,
  CmpBudgetExchangeRateSnapshot,
  CmpClient,
  CmpClientAcceptanceDraftPayload,
  CmpClientGroup,
  CmpClientUltimateParentAction,
  CmpEngagementDeliverable,
  CmpEngagementServiceType,
  CreateCmpAcceptanceRequestInput,
  CreateCmpEngagementInput,
  UpdateCmpAcceptanceRequestInput,
} from "@project-wing/shared";
import {
  Badge,
  Button,
  ButtonGroup,
  Input,
  Skeleton,
  projectWingToast as sonnerToast,
} from "@project-wing/ui";
import {
  ArrowRight,
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Eye,
  ListChecks,
  Pencil,
  RotateCcw,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { getCmpAcceptanceChanges } from "../api/acceptance-changes-client";
import type { CurrentUser, DirectoryUser } from "../api/client";
import { useCmpI18n } from "../i18n/client";
import {
  AcceptanceFormAccordionSection,
  AcceptanceFormSectionContent,
} from "./acceptance-form-accordion-section";
import type { AcceptanceFormAccordionStatusCopy } from "./acceptance-form-accordion-section";
import {
  AcceptanceFormHeader,
  AcceptanceFormWorkspace,
} from "./acceptance-form-workspace";
import {
  ClientMasterForm,
  EMPTY_CLIENT_MASTER_FORM,
  buildClientPayload,
  clientMasterFormFromPayload,
  parseClientServiceTypes,
  validateClientForm,
} from "./client-master-form";
import type { ClientMasterFormData } from "./client-master-form";
import { AcceptanceChangeComparison } from "./cmp-acceptance-change-comparison";
import { CmpAcceptanceDataGrid } from "./cmp-acceptance-data-grid";
import {
  CmpAsyncActionFeedback,
  useCmpAsyncActionFeedback,
} from "./cmp-async-action-feedback";
import { CmpDraftExitDialog } from "./cmp-draft-exit-dialog";
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
  recalculateFeePlanningRates,
} from "./cmp-engagement-fee-planning-table";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-table";
import { CmpEngagementRiskSelector } from "./cmp-engagement-risk-selector";
import {
  FormReviewDialog,
  FormReviewPage,
  SearchSelect,
} from "./cmp-form-controls";
import type {
  CmpFormSectionStatus,
  FormWizardStep,
  ReviewSection,
} from "./cmp-form-controls";
import {
  FormValidationSummary,
  focusFirstInvalidField,
  schemaIssuesToErrors,
  validationErrorId,
} from "./form-validation";
import { Accordion } from "./ui/accordion";
import { NativeSelect } from "./ui/native-select";
import { Textarea } from "./ui/textarea";

type AcceptanceMode = "acceptance" | "approvals";
type AcceptanceFormAction = "draft" | "assign" | "submit";

function orderedAcceptanceCurrencies(preferred?: readonly CmpBudgetCurrency[]) {
  const selected = (preferred ?? []).filter((currency) =>
    CMP_BUDGET_CURRENCIES.includes(currency)
  );
  return [
    ...selected,
    ...CMP_BUDGET_CURRENCIES.filter((currency) => !selected.includes(currency)),
  ];
}

export type CmpAcceptancePendingAction = {
  requestId: string;
  kind: "assign" | "recall" | "complete" | "submit" | "approve" | "return";
};

function PendingActionLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-busy="true">
      <Skeleton className="size-3.5 rounded-full" />
      <span>{label}</span>
    </span>
  );
}

type AcceptanceFormState = {
  draftName: string;
  type: CmpAcceptanceRequestType;
  targetClientId?: string;
  targetEngagementId?: string;
  micApproverId: string;
  picApproverId: string;
  itApproverId: string;
  draftAssigneeId: string;
  clientPayload: ClientMasterFormData;
  engagementPayload: EngagementPayloadState;
};

type EngagementPayloadState = {
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
  status: CreateCmpEngagementInput["status"];
  remarks: string;
};

type EngagementPayloadErrors = Partial<
  Record<keyof EngagementPayloadState | "feePlanningLines", string>
>;

type AcceptanceEngagementStepId = "setup" | "commercial" | "notes";
type AcceptanceEngagementWizardStepId = AcceptanceEngagementStepId | "review";

const ACCEPTANCE_ENGAGEMENT_STEPS: AcceptanceEngagementStepId[] = [
  "setup",
  "commercial",
  "notes",
];
const ACCEPTANCE_ENGAGEMENT_ERROR_KEYS: Record<
  AcceptanceEngagementStepId,
  (keyof EngagementPayloadState)[]
> = {
  setup: [
    "clientId",
    "engagementDate",
    "yearEndDate",
    "reportDate",
    "engagementCode",
    "serviceType",
    "otherServiceDescription",
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
const EMPTY_CLIENT_PAYLOAD = EMPTY_CLIENT_MASTER_FORM;
const EMPTY_ENGAGEMENT_PAYLOAD: EngagementPayloadState = {
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
};
const TYPE_LABELS: Record<CmpAcceptanceRequestType, string> = {
  CLIENT: "Client Acceptance",
  CLIENT_CHANGE: "Client Change",
  ENGAGEMENT: "Engagement Acceptance",
  ENGAGEMENT_CHANGE: "Engagement Change",
};

function isClientRequestType(type: CmpAcceptanceRequestType) {
  return type === "CLIENT" || type === "CLIENT_CHANGE";
}

function isEngagementRequestType(type: CmpAcceptanceRequestType) {
  return type === "ENGAGEMENT" || type === "ENGAGEMENT_CHANGE";
}

const STATUS_LABELS: Record<CmpAcceptanceStatus, string> = {
  DRAFT: "Draft",
  STAFF_EDITING: "Staff editing",
  PENDING_MIC: "Pending MIC",
  PENDING_PIC: "Pending PIC",
  PENDING_IT: "Pending IT",
  APPROVED: "Approved",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};
const ZH_TYPE_LABELS: Record<CmpAcceptanceRequestType, string> = {
  CLIENT: "客户承接",
  CLIENT_CHANGE: "客户资料变更",
  ENGAGEMENT: "业务承接",
  ENGAGEMENT_CHANGE: "业务资料变更",
};
const ZH_STATUS_LABELS: Record<CmpAcceptanceStatus, string> = {
  DRAFT: "草稿",
  STAFF_EDITING: "员工编辑中",
  PENDING_MIC: "等待 MIC 审批",
  PENDING_PIC: "等待 PIC 审批",
  PENDING_IT: "等待 IT 审批",
  APPROVED: "已批准",
  RETURNED: "已退回",
  CANCELLED: "已取消",
};

function acceptanceTypeLabel(type: CmpAcceptanceRequestType, locale: string) {
  return locale === "zh-CN" ? ZH_TYPE_LABELS[type] : TYPE_LABELS[type];
}

function acceptanceStatusLabel(status: CmpAcceptanceStatus, locale: string) {
  return locale === "zh-CN" ? ZH_STATUS_LABELS[status] : STATUS_LABELS[status];
}

const EDITABLE_ACCEPTANCE_STATUSES: CmpAcceptanceStatus[] = [
  "DRAFT",
  "RETURNED",
  "STAFF_EDITING",
];
const STEP_LABELS: Record<CmpAcceptanceStep, string> = {
  MIC: "MIC",
  PIC: "PIC",
  IT: "IT",
  DONE: "Done",
};

function acceptanceStepLabel(step: CmpAcceptanceStep, locale: string) {
  if (locale !== "zh-CN") {
    return STEP_LABELS[step];
  }
  return step === "DONE" ? "完成" : step;
}

const EMPTY_ARRAY: never[] = [];

function omitErrorKey<T extends object>(value: T, key: string): T {
  const { [key]: _removed, ...remaining } = value as Record<string, unknown>;
  return remaining as T;
}

export function CmpAcceptanceView({
  mode,
  requests,
  users,
  exchangeRates = EMPTY_ARRAY,
  clients,
  groups = EMPTY_ARRAY,
  currentUser,
  isBusy,
  pendingActions = EMPTY_ARRAY,
  onCreate,
  onUpdate,
  onSubmit,
  onApprove,
  onReturn,
  onAssignDraft,
  onRecallDraft,
  onCompleteDraft,
  initialStatus,
  selectedRequestId,
  recentlyUpdatedRequestId,
  onDetailClose,
  titleActions,
  searchValue,
  formPageMode = false,
  initialEditRequestId,
  validateOnOpen = false,
  onEditRequest,
  onEditEngagementRequest,
  onFormClose,
  onFormDirtyChange,
}: {
  mode: AcceptanceMode;
  requests: CmpAcceptanceRequest[];
  users: DirectoryUser[];
  exchangeRates?: CmpBudgetExchangeRateSnapshot[];
  clients: CmpClient[];
  groups?: CmpClientGroup[];
  currentUser: CurrentUser;
  isBusy?: boolean;
  pendingActions?: CmpAcceptancePendingAction[];
  onCreate?: (input: CreateCmpAcceptanceRequestInput) => Promise<unknown>;
  onUpdate?: (
    id: string,
    input: UpdateCmpAcceptanceRequestInput
  ) => Promise<unknown>;
  onSubmit?: (id: string) => Promise<unknown>;
  onApprove?: (id: string, comment?: string) => Promise<unknown>;
  onReturn?: (id: string, comment: string) => Promise<unknown>;
  onAssignDraft?: (id: string, assigneeId: string) => Promise<unknown>;
  onRecallDraft?: (id: string) => Promise<unknown>;
  onCompleteDraft?: (id: string) => Promise<unknown>;
  initialStatus?: string | null;
  selectedRequestId?: string | null;
  recentlyUpdatedRequestId?: string | null;
  onDetailClose?: () => void;
  titleActions?: ReactNode;
  searchValue?: string;
  formPageMode?: boolean;
  initialEditRequestId?: string;
  validateOnOpen?: boolean;
  onEditRequest?: (
    request: CmpAcceptanceRequest,
    validateOnOpen?: boolean
  ) => void;
  onEditEngagementRequest?: (
    request: CmpAcceptanceRequest,
    validateOnOpen?: boolean
  ) => void;
  onFormClose?: (reason: "cancelled" | "submitted") => void;
  onFormDirtyChange?: (isDirty: boolean) => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const pendingActionFor = (requestId: string) =>
    pendingActions.find((action) => action.requestId === requestId);
  const [form, setForm] = useState<AcceptanceFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validateFormOnOpen, setValidateFormOnOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<CmpAcceptanceRequest | null>(null);
  const [previewRequest, setPreviewRequest] =
    useState<CmpAcceptanceRequest | null>(null);
  const didOpenInitialEdit = useRef(false);
  const [submissionConfirmationRequest, setSubmissionConfirmationRequest] =
    useState<CmpAcceptanceRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const actionFeedback = useCmpAsyncActionFeedback();

  function runRequestAction<T>(
    kind: CmpAcceptancePendingAction["kind"],
    requestId: string,
    operation: () => Promise<T>
  ) {
    const labels = {
      assign: {
        pendingLabel: copy.assigningDraft,
        successLabel: copy.toastDraftAssigned,
      },
      recall: {
        pendingLabel: copy.recallingDraft,
        successLabel: copy.toastDraftRecalled,
      },
      complete: {
        pendingLabel: copy.markingReadyForMic,
        successLabel: copy.toastDraftReady,
      },
      submit: {
        pendingLabel: copy.formSubmitting,
        successLabel: copy.formSubmitSuccess,
      },
      approve: {
        pendingLabel: copy.approvingRequest,
        successLabel: copy.toastApprovalRecorded,
      },
      return: {
        pendingLabel: copy.returningToMic,
        successLabel: copy.toastReturnedToMic,
      },
    }[kind];
    return actionFeedback.run({ ...labels, actionKey: requestId }, operation);
  }

  const responsibleUserOptions = useMemo(
    () =>
      users
        .filter(
          (user) => user.status !== "INACTIVE" && user.status !== "DISABLED"
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );
  const approverOptions = useMemo(
    () => responsibleUserOptions.filter((user) => user.id !== currentUser.id),
    [currentUser.id, responsibleUserOptions]
  );
  const micApproverOptions = useMemo(
    () =>
      responsibleUserOptions.filter((user) =>
        ["MANAGER"].includes(user.globalRole)
      ),
    [responsibleUserOptions]
  );
  const picApproverOptions = useMemo(
    () =>
      responsibleUserOptions.filter((user) =>
        ["PARTNER", "PRINCIPAL"].includes(user.globalRole)
      ),
    [responsibleUserOptions]
  );
  const eqReviewerOptions = useMemo(
    () => responsibleUserOptions.filter((user) => user.globalRole === "EQCR"),
    [responsibleUserOptions]
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
  const filteredRequests = useMemo(() => {
    const pageSearch = searchValue?.trim().toLowerCase() ?? "";
    if (!pageSearch) {
      return requests;
    }
    return requests.filter((request) => {
      const title = getRequestTitle(request);
      const searchable = [
        request.requestNo,
        TYPE_LABELS[request.type],
        STATUS_LABELS[request.status],
        title,
        request.submittedBy.name,
        request.micApprover.name,
        request.picApprover?.name ?? "",
        request.itApprover?.name ?? "",
      ];
      return searchable.some((value) =>
        value.toLowerCase().includes(pageSearch)
      );
    });
  }, [requests, searchValue]);
  const requestResultsKey = filteredRequests
    .map((request) => request.id)
    .join(",");
  const initialStatusColumnFilters = useMemo(() => {
    const values = (initialStatus ?? "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is CmpAcceptanceStatus => value in STATUS_LABELS)
      .map((status) => acceptanceStatusLabel(status, locale));
    return values.length > 0 ? [{ id: "status", value: values }] : [];
  }, [initialStatus, locale]);
  const editingRequest = editingId
    ? (requests.find((request) => request.id === editingId) ?? null)
    : null;
  const isEditingAssignedStaffDraft = Boolean(
    editingRequest?.status === "STAFF_EDITING" &&
    editingRequest.draftAssigneeId === currentUser.id &&
    !editingRequest.draftCompletedAt
  );
  useEffect(() => {
    if (!selectedRequestId) {
      return;
    }
    const request = requests.find((item) => item.id === selectedRequestId);
    if (request) {
      setSelectedRequest(request);
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    setSelectedRequest((current) => {
      if (!current) {
        return current;
      }
      return requests.find((request) => request.id === current.id) ?? null;
    });
  }, [requests]);

  useEffect(() => {
    setPreviewRequest((current) => {
      if (!current) {
        return current;
      }
      return requests.find((request) => request.id === current.id) ?? null;
    });
  }, [requests]);

  const openEdit = useCallback(
    (request: CmpAcceptanceRequest, shouldValidateOnOpen = false) => {
      if (!formPageMode && onEditRequest) {
        onEditRequest(request, shouldValidateOnOpen);
        return;
      }
      if (
        !formPageMode &&
        isEngagementRequestType(request.type) &&
        onEditEngagementRequest
      ) {
        onEditEngagementRequest(request, shouldValidateOnOpen);
        return;
      }
      setSelectedRequest(null);
      setEditingId(request.id);
      setForm(formFromRequest(request, clients[0]?.id ?? "", clients));
      setValidateFormOnOpen(shouldValidateOnOpen);
    },
    [clients, formPageMode, onEditEngagementRequest, onEditRequest]
  );

  function closeForm(reason: "cancelled" | "submitted" = "cancelled") {
    setForm(null);
    setEditingId(null);
    setValidateFormOnOpen(false);
    onFormDirtyChange?.(false);
    onFormClose?.(reason);
  }

  useEffect(() => {
    if (!formPageMode || !initialEditRequestId || didOpenInitialEdit.current) {
      return;
    }
    const request = requests.find((item) => item.id === initialEditRequestId);
    if (!request) {
      return;
    }
    didOpenInitialEdit.current = true;
    openEdit(request, validateOnOpen);
  }, [formPageMode, initialEditRequestId, openEdit, requests, validateOnOpen]);

  function submitRequestOrOpenErrors(request: CmpAcceptanceRequest) {
    const requestForm = formFromRequest(request, clients[0]?.id ?? "", clients);
    const validation = isClientRequestType(request.type)
      ? validateClientRequestForSubmission(requestForm)
      : validateEngagementFormalPayload(requestForm.engagementPayload, clients);

    if (Object.keys(validation).length > 0) {
      openEdit(request, true);
      return;
    }
    setSubmissionConfirmationRequest(request);
  }

  function closeSelectedRequest() {
    setSelectedRequest(null);
    setApprovalComment("");
    setReturnComment("");
    onDetailClose?.();
  }

  function closePreviewRequest() {
    setPreviewRequest(null);
    setApprovalComment("");
    setReturnComment("");
  }

  function openPayloadPreview(request: CmpAcceptanceRequest) {
    setSelectedRequest(null);
    setPreviewRequest(request);
  }

  function saveRequest(action: AcceptanceFormAction): Promise<unknown> {
    if (!form) {
      return Promise.resolve();
    }
    const payload = buildAcceptanceSubmissionPayload(form, action);
    if (editingId) {
      return onUpdate
        ? onUpdate(editingId, buildAcceptanceUpdatePayload(payload))
        : Promise.resolve();
    }
    return onCreate ? onCreate(payload) : Promise.resolve();
  }

  function currentCanEdit(request: CmpAcceptanceRequest) {
    if (mode !== "acceptance") {
      return false;
    }
    return canEditCmpAcceptanceRequest(request, currentUser.id);
  }

  function currentCanManageDraft(request: CmpAcceptanceRequest) {
    return (
      request.workflowVersion >= 2 &&
      resolveAcceptanceDraftControllerId(request) === currentUser.id &&
      EDITABLE_ACCEPTANCE_STATUSES.includes(request.status)
    );
  }

  function currentCanSubmitAsMic(request: CmpAcceptanceRequest) {
    return currentCanManageDraft(request) && request.status !== "STAFF_EDITING";
  }

  function currentIsActiveAssignee(request: CmpAcceptanceRequest) {
    return (
      request.workflowVersion >= 2 &&
      request.draftAssigneeId === currentUser.id &&
      !request.draftCompletedAt &&
      request.status === "STAFF_EDITING"
    );
  }

  function currentCanApprove(request: CmpAcceptanceRequest) {
    if (mode !== "approvals") {
      return false;
    }
    if (request.status === "PENDING_MIC") {
      return request.micApproverId === currentUser.id;
    }
    if (request.status === "PENDING_PIC") {
      return request.picApproverId === currentUser.id;
    }
    if (request.status === "PENDING_IT") {
      return request.itApproverId === currentUser.id;
    }
    return false;
  }

  const activeDialogRequestId =
    selectedRequest?.id ??
    previewRequest?.id ??
    submissionConfirmationRequest?.id ??
    null;
  const dialogFeedback = activeDialogRequestId
    ? actionFeedback.feedbackFor(activeDialogRequestId)
    : null;
  const workspaceFeedbacks = actionFeedback.feedbacks.filter(
    (feedback) => feedback.actionKey !== activeDialogRequestId
  );

  function renderRequestActions(request: CmpAcceptanceRequest) {
    const pendingAction = pendingActionFor(request.id);
    const isRequestActionPending = Boolean(pendingAction);
    const submitTarget = getDraftSubmitTarget(request);
    const submitLabel = `${request.picApprovedAt ? "Resubmit" : "Submit"} to ${submitTarget}`;
    const readyLabel = `Mark ready for ${getDraftReadyRecipientLabel(request)}`;

    return (
      <ButtonGroup className="cmp-row-actions">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          accessibleName={copy.view}
          tooltip={copy.view}
          onClick={(event) => {
            event.stopPropagation();
            if (mode === "approvals") {
              openPayloadPreview(request);
            } else {
              setSelectedRequest(request);
            }
          }}
          disabled={isRequestActionPending}
        >
          <Eye />
        </Button>
        {currentCanEdit(request) ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              accessibleName={copy.edit}
              tooltip={copy.edit}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(request);
              }}
              disabled={isRequestActionPending}
            >
              <Pencil />
            </Button>
            {currentCanSubmitAsMic(request) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                accessibleName={
                  pendingAction?.kind === "submit"
                    ? `Submitting to ${submitTarget}...`
                    : submitLabel
                }
                tooltip={submitLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  submitRequestOrOpenErrors(request);
                }}
                disabled={
                  isRequestActionPending ||
                  Boolean(request.draftAssigneeId && !request.draftCompletedAt)
                }
              >
                {pendingAction?.kind === "submit" ? (
                  <Skeleton className="size-4 rounded-full" />
                ) : (
                  <Send />
                )}
              </Button>
            ) : null}
            {currentIsActiveAssignee(request) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                accessibleName={
                  pendingAction?.kind === "complete"
                    ? `Marking ready for ${getDraftReadyRecipientLabel(request)}...`
                    : readyLabel
                }
                tooltip={readyLabel}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!onCompleteDraft) {
                    return;
                  }
                  void Promise.resolve(
                    runRequestAction("complete", request.id, () =>
                      onCompleteDraft(request.id)
                    )
                  ).catch(() => {});
                }}
                disabled={isRequestActionPending}
              >
                {pendingAction?.kind === "complete" ? (
                  <Skeleton className="size-4 rounded-full" />
                ) : (
                  <CircleCheck />
                )}
              </Button>
            ) : null}
          </>
        ) : null}
        {currentCanApprove(request) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            accessibleName="Review"
            tooltip="Review"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedRequest(request);
            }}
            disabled={isRequestActionPending}
          >
            <ListChecks />
          </Button>
        ) : null}
      </ButtonGroup>
    );
  }

  return (
    <section className="cmp-acceptance-workspace">
      {formPageMode ? null : (
        <section
          id="cmp-acceptance-view-panel"
          className="cmp-acceptance-view-panel"
          role="tabpanel"
          aria-labelledby={
            mode === "approvals"
              ? "cmp-acceptance-approvals-tab"
              : "cmp-acceptance-requests-tab"
          }
        >
          <CmpAcceptanceDataGrid
            key={`${mode}-${initialStatus ?? "all"}-${requestResultsKey || "empty"}`}
            copy={copy}
            formatDate={(value) => formatAcceptanceDate(value, locale)}
            getCurrentOwner={getCurrentOwnerName}
            getStatusLabel={(status) => acceptanceStatusLabel(status, locale)}
            initialColumnFilters={initialStatusColumnFilters}
            getStepLabel={(request) =>
              acceptanceStepLabel(request.currentStep, locale)
            }
            getSubtitle={getRequestSubtitle}
            getTitle={getRequestTitle}
            getTypeLabel={(request) =>
              acceptanceTypeLabel(request.type, locale)
            }
            onRowClick={(request) =>
              mode === "approvals"
                ? openPayloadPreview(request)
                : setSelectedRequest(request)
            }
            renderActions={renderRequestActions}
            requests={filteredRequests}
            recentlyUpdatedRequestId={recentlyUpdatedRequestId}
            selectedRequestId={selectedRequest?.id ?? previewRequest?.id}
            title={mode === "approvals" ? copy.myApprovals : copy.myRequests}
            toolbarActions={titleActions}
          />
        </section>
      )}

      <FormReviewDialog
        open={Boolean(submissionConfirmationRequest)}
        title={copy.formSubmitConfirmTitle}
        sections={[]}
        isBusy={Boolean(
          submissionConfirmationRequest &&
          (pendingActionFor(submissionConfirmationRequest.id) ||
            actionFeedback.isRunningFor(submissionConfirmationRequest.id))
        )}
        submitLabel={
          submissionConfirmationRequest
            ? `${submissionConfirmationRequest.picApprovedAt ? "Resubmit" : "Submit"} to ${getDraftSubmitTarget(submissionConfirmationRequest)}`
            : "Submit"
        }
        onOpenChange={(open) => {
          if (!open) {
            setSubmissionConfirmationRequest(null);
          }
        }}
        onSubmit={() => {
          if (!submissionConfirmationRequest || !onSubmit) {
            return;
          }
          const requestId = submissionConfirmationRequest.id;
          void Promise.resolve(
            runRequestAction("submit", requestId, () => onSubmit(requestId))
          )
            .then(() => setSubmissionConfirmationRequest(null))
            .catch(() => {
              // The page mutation displays its error and keeps confirmation open.
            });
        }}
      />

      {form ? (
        <AcceptanceFormModal
          form={form}
          acceptanceDraftId={editingId}
          clients={clients}
          groups={groups}
          users={users}
          exchangeRates={exchangeRates}
          currentUser={currentUser}
          micUsers={micApproverOptions}
          picUsers={picApproverOptions}
          eqReviewerUsers={eqReviewerOptions}
          itUsers={itApproverOptions}
          staffUsers={staffOptions}
          canDelegateDraft={
            ["MANAGER", "PARTNER"].includes(currentUser.globalRole) &&
            (!editingRequest || currentCanManageDraft(editingRequest))
          }
          draftSubmitTarget={
            editingRequest
              ? getDraftSubmitTarget(editingRequest)
              : currentUser.globalRole === "PARTNER"
                ? "MIC"
                : "PIC"
          }
          isEditing={Boolean(editingId)}
          validateOnOpen={validateFormOnOpen}
          allowIncompleteSubmit={isEditingAssignedStaffDraft}
          isBusy={isBusy}
          pageMode={formPageMode}
          onDirtyChange={onFormDirtyChange}
          onChange={setForm}
          onClose={closeForm}
          onSubmit={saveRequest}
          onSubmitClientResult={(result) => {
            const payload: AcceptanceFormState = {
              ...form,
              draftName: result.draftName ?? form.draftName,
              clientPayload: clientMasterFormFromPayload(result.payload, {
                micApproverId: result.micApproverId ?? "",
                picApproverId: result.picApproverId ?? "",
                itApproverId: result.itApproverId ?? "",
              }),
              micApproverId: result.micApproverId ?? "",
              picApproverId: result.picApproverId ?? "",
              itApproverId: result.itApproverId ?? "",
              draftAssigneeId: result.draftAssigneeId ?? "",
            };
            const action =
              isEditingAssignedStaffDraft && result.action === "submit"
                ? "draft"
                : result.action;
            const requestPayload = buildAcceptanceSubmissionPayload(
              payload,
              action,
              result.payload
            );
            if (editingId) {
              return onUpdate
                ? onUpdate(
                    editingId,
                    buildAcceptanceUpdatePayload(requestPayload)
                  )
                : Promise.resolve();
            }
            return onCreate ? onCreate(requestPayload) : Promise.resolve();
          }}
        />
      ) : null}

      {selectedRequest ? (
        <AcceptanceDetailModal
          request={selectedRequest}
          users={users}
          canApprove={currentCanApprove(selectedRequest)}
          approvalComment={approvalComment}
          returnComment={returnComment}
          isBusy={isBusy || actionFeedback.isRunningFor(selectedRequest.id)}
          pendingAction={pendingActionFor(selectedRequest.id)}
          onApprovalCommentChange={setApprovalComment}
          onReturnCommentChange={setReturnComment}
          onClose={closeSelectedRequest}
          onApprove={() => {
            if (!onApprove) {
              return;
            }
            closeAfterAcceptanceAction(
              runRequestAction("approve", selectedRequest.id, () =>
                onApprove(selectedRequest.id, approvalComment)
              ),
              closeSelectedRequest
            );
          }}
          onReturn={() => {
            if (returnComment.trim()) {
              closeAfterAcceptanceAction(
                onReturn
                  ? runRequestAction("return", selectedRequest.id, () =>
                      onReturn(selectedRequest.id, returnComment)
                    )
                  : Promise.resolve(),
                closeSelectedRequest
              );
            }
          }}
          staffUsers={staffOptions}
          isMic={currentCanManageDraft(selectedRequest)}
          onAssignDraft={(assigneeId) => {
            if (!onAssignDraft) {
              return;
            }
            void Promise.resolve(
              runRequestAction("assign", selectedRequest.id, () =>
                onAssignDraft(selectedRequest.id, assigneeId)
              )
            ).catch(() => {});
          }}
          onRecallDraft={() => {
            if (!onRecallDraft) {
              return;
            }
            void Promise.resolve(
              runRequestAction("recall", selectedRequest.id, () =>
                onRecallDraft(selectedRequest.id)
              )
            ).catch(() => {});
          }}
        />
      ) : null}

      {previewRequest ? (
        <AcceptancePayloadPreviewModal
          request={previewRequest}
          clients={clients}
          groups={groups}
          users={users}
          canApprove={currentCanApprove(previewRequest)}
          approvalComment={approvalComment}
          returnComment={returnComment}
          isBusy={isBusy || actionFeedback.isRunningFor(previewRequest.id)}
          pendingAction={pendingActionFor(previewRequest.id)}
          onApprovalCommentChange={setApprovalComment}
          onReturnCommentChange={setReturnComment}
          onClose={closePreviewRequest}
          onApprove={() => {
            if (!onApprove) {
              return;
            }
            closeAfterAcceptanceAction(
              runRequestAction("approve", previewRequest.id, () =>
                onApprove(previewRequest.id, approvalComment)
              ),
              closePreviewRequest
            );
          }}
          onReturn={() => {
            if (returnComment.trim()) {
              closeAfterAcceptanceAction(
                onReturn
                  ? runRequestAction("return", previewRequest.id, () =>
                      onReturn(previewRequest.id, returnComment)
                    )
                  : Promise.resolve(),
                closePreviewRequest
              );
            }
          }}
        />
      ) : null}
      <CmpAsyncActionFeedback
        feedback={workspaceFeedbacks}
        presentation="workspace"
      />
      <CmpAsyncActionFeedback feedback={dialogFeedback} presentation="screen" />
    </section>
  );
}

function closeAfterAcceptanceAction(result: unknown, onSuccess: () => void) {
  if (
    result &&
    typeof result === "object" &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    void Promise.resolve(result)
      .then(onSuccess)
      .catch(() => {
        // The mutation displays its error toast and keeps the dialog open.
      });
    return;
  }

  onSuccess();
}

function getCurrentOwnerName(request: CmpAcceptanceRequest) {
  if (request.status === "STAFF_EDITING") {
    return request.draftAssignee?.name ?? getDraftControllerName(request);
  }
  if (request.status === "PENDING_PIC") {
    return request.picApprover?.name ?? "—";
  }
  if (request.status === "PENDING_IT") {
    return request.itApprover?.name ?? "—";
  }
  if (["APPROVED", "CANCELLED"].includes(request.status)) {
    return "—";
  }
  return getDraftControllerName(request);
}

function resolveAcceptanceDraftControllerId(request: CmpAcceptanceRequest) {
  return request.submittedAt ? request.micApproverId : request.submittedById;
}

export function canEditCmpEngagementRequest(
  request: CmpAcceptanceRequest,
  currentUserId: string
) {
  if (!isEngagementRequestType(request.type)) {
    return false;
  }
  return canEditCmpAcceptanceRequest(request, currentUserId);
}

export function canEditCmpAcceptanceRequest(
  request: CmpAcceptanceRequest,
  currentUserId: string
) {
  if (!EDITABLE_ACCEPTANCE_STATUSES.includes(request.status)) {
    return false;
  }
  if (request.workflowVersion < 2) {
    return request.submittedById === currentUserId;
  }
  if (request.status === "STAFF_EDITING") {
    return (
      request.draftAssigneeId === currentUserId && !request.draftCompletedAt
    );
  }
  return resolveAcceptanceDraftControllerId(request) === currentUserId;
}

function getDraftControllerName(request: CmpAcceptanceRequest) {
  return request.submittedAt
    ? request.micApprover.name
    : request.submittedBy.name;
}

function getDraftSubmitTarget(request: CmpAcceptanceRequest) {
  if (request.picApprovedAt) {
    return "IT";
  }
  return !request.submittedAt && request.submittedById !== request.micApproverId
    ? "MIC"
    : "PIC";
}

function getDraftReadyRecipientLabel(request: CmpAcceptanceRequest) {
  return !request.submittedAt && request.submittedById !== request.micApproverId
    ? "request owner"
    : "MIC";
}

function formatAcceptanceDate(value: string | null, locale: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function AcceptanceFormModal({
  form,
  acceptanceDraftId,
  micUsers,
  picUsers,
  eqReviewerUsers,
  itUsers,
  staffUsers,
  canDelegateDraft,
  draftSubmitTarget,
  clients,
  groups,
  users,
  exchangeRates,
  currentUser,
  isEditing,
  allowIncompleteSubmit,
  validateOnOpen,
  isBusy,
  pageMode = false,
  onDirtyChange,
  onChange,
  onClose,
  onSubmit,
  onSubmitClientResult,
}: {
  form: AcceptanceFormState;
  acceptanceDraftId?: string | null;
  micUsers: DirectoryUser[];
  picUsers: DirectoryUser[];
  eqReviewerUsers: DirectoryUser[];
  itUsers: DirectoryUser[];
  staffUsers: DirectoryUser[];
  canDelegateDraft: boolean;
  draftSubmitTarget: "MIC" | "PIC" | "IT";
  clients: CmpClient[];
  groups: CmpClientGroup[];
  users: DirectoryUser[];
  exchangeRates: CmpBudgetExchangeRateSnapshot[];
  currentUser: CurrentUser;
  isEditing: boolean;
  allowIncompleteSubmit: boolean;
  validateOnOpen: boolean;
  isBusy?: boolean;
  pageMode?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onChange: (form: AcceptanceFormState) => void;
  onClose: (reason?: "cancelled" | "submitted") => void;
  onSubmit: (action: AcceptanceFormAction) => Promise<unknown>;
  onSubmitClientResult: (result: {
    action: AcceptanceFormAction;
    payload: CmpClientAcceptanceDraftPayload;
    draftName?: string;
    draftAssigneeId?: string;
    micApproverId?: string;
    picApproverId?: string;
    itApproverId?: string;
  }) => Promise<unknown>;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const [engagementErrors, setEngagementErrors] =
    useState<EngagementPayloadErrors>({});
  const [activeEngagementSection, setActiveEngagementSection] =
    useState<AcceptanceEngagementWizardStepId>("setup");
  const [engagementSavedAt, setEngagementSavedAt] = useState<string | null>(
    null
  );
  const [isEngagementExitDialogOpen, setIsEngagementExitDialogOpen] =
    useState(false);
  const engagementFormRef = useRef<HTMLFormElement>(null);
  const didValidateOnOpen = useRef(false);
  const [cleanEngagementSnapshot, setCleanEngagementSnapshot] = useState(
    JSON.stringify({
      draftName: form.draftName,
      draftAssigneeId: form.draftAssigneeId,
      engagementPayload: form.engagementPayload,
    })
  );
  const engagementActionFeedback = useCmpAsyncActionFeedback();

  function update<Key extends keyof AcceptanceFormState>(
    key: Key,
    value: AcceptanceFormState[Key]
  ) {
    onChange({ ...form, [key]: value });
  }

  function updateEngagement<Key extends keyof EngagementPayloadState>(
    key: Key,
    value: EngagementPayloadState[Key]
  ) {
    const next = { ...form.engagementPayload, [key]: value };
    if (key === "clientId") {
      const client = clients.find((item) => item.id === value);
      const inheritedPic = picUsers.find(
        (user) =>
          user.id === client?.clientPartnerPicId ||
          (!client?.clientPartnerPicId &&
            user.name === client?.clientPartnerPic)
      );
      const inheritedMic = micUsers.find(
        (user) =>
          user.id === client?.clientManagerMicId ||
          (!client?.clientManagerMicId &&
            user.name === client?.clientManagerMic)
      );
      next.picUserId = client?.clientPartnerPicId ?? inheritedPic?.id ?? "";
      next.pic = client?.clientPartnerPic ?? inheritedPic?.name ?? "";
      next.micUserId = client?.clientManagerMicId ?? inheritedMic?.id ?? "";
      next.mic = client?.clientManagerMic ?? inheritedMic?.name ?? "";
    }
    if (key === "picUserId") {
      next.pic = picUsers.find((user) => user.id === value)?.name ?? "";
    }
    if (key === "micUserId") {
      next.mic = micUsers.find((user) => user.id === value)?.name ?? "";
    }
    if (key === "engagementRiskClassification" && value === "NORMAL") {
      next.eqReviewerUserId = "";
      next.eqReviewer = "";
    }
    if (key === "feeCurrency") {
      const currency = value as CmpBudgetCurrency;
      const persistedExchangeRate = exchangeRates.find(
        (rate) => rate.currency === currency
      );
      const exchangeRate =
        persistedExchangeRate ?? getCmpFixedBudgetExchangeRate(currency);
      next.feeExchangeRateSnapshotId =
        currency === "HKD" ? "" : (persistedExchangeRate?.id ?? "");
      next.feeExchangeRateHkdPerUnit = exchangeRate.hkdPerUnit;
      next.feeExchangeRateSource = "SYSTEM";
      next.feePlanningLines = recalculateFeePlanningRates(
        next.feePlanningLines,
        currency,
        exchangeRate
      );
    }
    if (key === "feeExchangeRateHkdPerUnit") {
      const hkdPerUnit = String(value);
      const systemRate =
        exchangeRates.find(
          (rate) =>
            rate.id === next.feeExchangeRateSnapshotId ||
            rate.currency === next.feeCurrency
        ) ?? getCmpFixedBudgetExchangeRate(next.feeCurrency);
      next.feeExchangeRateSource = "MANUAL";
      next.feePlanningLines = recalculateFeePlanningRates(
        next.feePlanningLines,
        next.feeCurrency,
        isPositiveDecimal(hkdPerUnit)
          ? { ...systemRate, hkdPerUnit }
          : systemRate
      );
    }
    if (key === "feeExchangeRateSource" && value === "SYSTEM") {
      const systemRate =
        exchangeRates.find((rate) => rate.currency === next.feeCurrency) ??
        getCmpFixedBudgetExchangeRate(next.feeCurrency);
      next.feeExchangeRateSnapshotId =
        next.feeCurrency === "HKD" ? "" : systemRate.id;
      next.feeExchangeRateHkdPerUnit = systemRate.hkdPerUnit;
      next.feePlanningLines = recalculateFeePlanningRates(
        next.feePlanningLines,
        next.feeCurrency,
        systemRate
      );
    }
    setEngagementErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
    update("engagementPayload", next);
  }

  function saveEngagementRequest(
    action: AcceptanceFormAction
  ): Promise<unknown> {
    const isFormalSubmit = action === "submit" && !allowIncompleteSubmit;
    const validation = isFormalSubmit
      ? validateEngagementFormalPayload(form.engagementPayload, clients)
      : validateEngagementDraftPayload(form.engagementPayload);
    setEngagementErrors(validation);
    if (Object.keys(validation).length > 0) {
      const firstInvalidStep = ACCEPTANCE_ENGAGEMENT_STEPS.find((step) =>
        ACCEPTANCE_ENGAGEMENT_ERROR_KEYS[step].some((field) =>
          Boolean(validation[field])
        )
      );
      setActiveEngagementSection(firstInvalidStep ?? "setup");
      requestAnimationFrame(() =>
        focusFirstInvalidField(engagementFormRef.current)
      );
      return Promise.reject(new Error("Engagement form validation failed"));
    }
    const resolvedAction = isFormalSubmit
      ? "submit"
      : action === "submit"
        ? "draft"
        : action;
    if (resolvedAction !== "submit" && !form.draftName.trim()) {
      return Promise.reject(new Error("Draft name is required"));
    }
    return Promise.resolve(
      engagementActionFeedback.run(
        {
          pendingLabel:
            resolvedAction === "assign"
              ? copy.assigningDraft
              : resolvedAction === "submit"
                ? copy.formSubmitting
                : copy.formSaving,
          successLabel:
            resolvedAction === "assign"
              ? copy.toastDraftAssigned
              : resolvedAction === "submit"
                ? copy.formSubmitSuccess
                : copy.formSaved,
        },
        () => onSubmit(resolvedAction)
      )
    )
      .then(() => {
        if (resolvedAction === "submit") {
          onClose("submitted");
          return;
        }
        setCleanEngagementSnapshot(
          JSON.stringify({
            draftName: form.draftName,
            draftAssigneeId: form.draftAssigneeId,
            engagementPayload: form.engagementPayload,
          })
        );
        setEngagementSavedAt(
          new Intl.DateTimeFormat(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date())
        );
      })
      .catch(() => {
        // The page mutation reports the error and keeps the form open.
        throw new Error("Could not save engagement draft");
      });
  }

  const engagementIsDirty =
    JSON.stringify({
      draftName: form.draftName,
      draftAssigneeId: form.draftAssigneeId,
      engagementPayload: form.engagementPayload,
    }) !== cleanEngagementSnapshot;

  useEffect(() => {
    if (isEngagementRequestType(form.type)) {
      onDirtyChange?.(engagementIsDirty);
    }
  }, [engagementIsDirty, form.type, onDirtyChange]);

  const requestEngagementClose = useCallback(() => {
    if (isBusy || engagementActionFeedback.isRunning) {
      return;
    }
    if (engagementIsDirty) {
      setIsEngagementExitDialogOpen(true);
      return;
    }
    onClose("cancelled");
  }, [engagementActionFeedback.isRunning, engagementIsDirty, isBusy, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        !(target instanceof Node) ||
        !engagementFormRef.current?.contains(target) ||
        event.key !== "Escape"
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestEngagementClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestEngagementClose]);

  function validateAcceptanceEngagementField(
    field: string,
    fieldValue?: string
  ) {
    const payloadToValidate =
      fieldValue !== undefined &&
      field in form.engagementPayload &&
      typeof form.engagementPayload[field as keyof EngagementPayloadState] ===
        "string"
        ? ({
            ...form.engagementPayload,
            [field]: fieldValue,
          } as EngagementPayloadState)
        : form.engagementPayload;
    const validation = validateEngagementFormalPayload(
      payloadToValidate,
      clients
    );
    setEngagementErrors((current) => {
      const next = { ...current };
      const typedField = field as keyof EngagementPayloadErrors;
      if (validation[typedField]) {
        next[typedField] = validation[typedField];
      } else {
        return omitErrorKey(next, typedField);
      }
      return next;
    });
  }

  useEffect(() => {
    if (
      !validateOnOpen ||
      didValidateOnOpen.current ||
      !isEngagementRequestType(form.type)
    ) {
      return;
    }
    didValidateOnOpen.current = true;
    const validation = validateEngagementFormalPayload(
      form.engagementPayload,
      clients
    );
    setEngagementErrors(validation);
    if (Object.keys(validation).length > 0) {
      const firstInvalidStep = ACCEPTANCE_ENGAGEMENT_STEPS.find((step) =>
        ACCEPTANCE_ENGAGEMENT_ERROR_KEYS[step].some((field) =>
          Boolean(validation[field])
        )
      );
      setActiveEngagementSection(firstInvalidStep ?? "setup");
      requestAnimationFrame(() =>
        focusFirstInvalidField(engagementFormRef.current)
      );
    }
  }, [clients, form.engagementPayload, form.type, validateOnOpen]);

  const acceptanceEngagementBudget = deriveFeePlanningBudget(
    form.engagementPayload.feePlanningLines,
    form.engagementPayload.agreedFee
  );
  const engagementRequiredChecks = [
    Boolean(form.engagementPayload.clientId.trim()),
    Boolean(form.engagementPayload.engagementCode.trim()),
    Boolean(form.engagementPayload.serviceType),
    acceptanceEngagementBudget.totalHours > 0,
    form.engagementPayload.agreedFee.trim() !== "" &&
      Number(form.engagementPayload.agreedFee) >= 0,
    Boolean(form.engagementPayload.amlRiskClassification),
    Boolean(form.engagementPayload.engagementRiskClassification),
    Boolean(form.engagementPayload.picUserId),
    Boolean(form.engagementPayload.micUserId),
    ...(form.engagementPayload.engagementRiskClassification === "NORMAL"
      ? []
      : [Boolean(form.engagementPayload.eqReviewerUserId)]),
  ];
  const engagementMissingCount = engagementRequiredChecks.filter(
    (value) => !value
  ).length;
  const acceptanceEngagementStatus: CmpFormSectionStatus = Object.values(
    engagementErrors
  ).some(Boolean)
    ? "error"
    : engagementMissingCount
      ? "incomplete"
      : "complete";
  const selectedAcceptanceClient = clients.find(
    (client) => client.id === form.engagementPayload.clientId
  );
  const acceptanceEngagementSteps: {
    id: AcceptanceEngagementStepId;
    label: string;
  }[] = [
    { id: "setup", label: copy.engagementSetup },
    { id: "commercial", label: copy.engagementCommercialPlanning },
    { id: "notes", label: copy.engagementStatusAndRemarks },
  ];
  function acceptanceEngagementMissingCount(
    stepId: AcceptanceEngagementStepId
  ) {
    const payload = form.engagementPayload;
    const checks: Record<AcceptanceEngagementStepId, boolean[]> = {
      setup: [
        Boolean(payload.clientId.trim()),
        Boolean(payload.engagementCode.trim()),
        Boolean(payload.serviceType),
        Boolean(payload.amlRiskClassification),
        Boolean(payload.engagementRiskClassification),
        Boolean(payload.picUserId),
        Boolean(payload.micUserId),
        ...(payload.engagementRiskClassification === "NORMAL"
          ? []
          : [Boolean(payload.eqReviewerUserId)]),
      ],
      commercial: [
        deriveFeePlanningBudget(payload.feePlanningLines, payload.agreedFee)
          .totalHours > 0,
        payload.agreedFee.trim() !== "" && Number(payload.agreedFee) >= 0,
      ],
      notes: [],
    };
    return checks[stepId].filter((complete) => !complete).length;
  }
  function acceptanceEngagementStepStatus(stepId: AcceptanceEngagementStepId) {
    if (
      ACCEPTANCE_ENGAGEMENT_ERROR_KEYS[stepId].some((field) =>
        Boolean(engagementErrors[field])
      )
    ) {
      return "error" as const;
    }
    return acceptanceEngagementMissingCount(stepId)
      ? ("incomplete" as const)
      : stepId === "notes" && !form.engagementPayload.remarks.trim()
        ? ("not-started" as const)
        : ("complete" as const);
  }
  const acceptanceWizardSteps: FormWizardStep[] = [
    ...acceptanceEngagementSteps.map((step) => ({
      ...step,
      status: acceptanceEngagementStepStatus(step.id),
      missingCount: acceptanceEngagementMissingCount(step.id),
    })),
    {
      id: "review",
      label: copy.formReviewAndSubmit,
      status: engagementMissingCount ? "incomplete" : "complete",
      missingCount: engagementMissingCount,
    },
  ];
  const acceptanceReviewSections: ReviewSection[] = [
    {
      id: "setup",
      label: copy.engagementSetup,
      status: acceptanceEngagementStepStatus("setup"),
      items: [
        { label: copy.requestType, value: TYPE_LABELS[form.type] },
        {
          label: copy.client,
          value: selectedAcceptanceClient
            ? `${selectedAcceptanceClient.clientCode} - ${selectedAcceptanceClient.nameEn || selectedAcceptanceClient.nameZh}`
            : undefined,
        },
        { label: copy.yearEnd, value: form.engagementPayload.yearEndDate },
        { label: copy.reportDate, value: form.engagementPayload.reportDate },
        {
          label: copy.engagementCode,
          value: form.engagementPayload.engagementCode,
        },
        {
          label: copy.serviceType,
          value: form.engagementPayload.serviceType,
        },
        {
          label: copy.amlTfRisk,
          value:
            form.engagementPayload.amlRiskClassification === "HIGH"
              ? copy.amlTfRiskHigh
              : copy.amlTfRiskNotHigh,
        },
        {
          label: copy.engagementRisk,
          value: acceptanceEngagementRiskLabel(
            form.engagementPayload.engagementRiskClassification,
            copy
          ),
        },
        { label: copy.pic, value: form.engagementPayload.pic },
        { label: copy.mic, value: form.engagementPayload.mic },
        ...(form.engagementPayload.engagementRiskClassification === "NORMAL"
          ? []
          : [
              {
                label: copy.eqReviewer,
                value: form.engagementPayload.eqReviewer,
              },
            ]),
        {
          label: copy.engagementDeliverables,
          value:
            form.engagementPayload.deliverables.length > 0
              ? formatEngagementDeliverables(
                  form.engagementPayload.deliverables,
                  locale === "zh-CN" ? "zh-CN" : "en-US"
                )
              : undefined,
        },
      ],
    },
    {
      id: "commercial",
      label: copy.engagementCommercialPlanning,
      status: acceptanceEngagementStepStatus("commercial"),
      items: [
        {
          label: copy.agreedFee,
          value: formatPreviewMoney(
            form.engagementPayload.agreedFee,
            form.engagementPayload.feeCurrency,
            locale
          ),
        },
        {
          label: copy.budgetedHours,
          value: acceptanceEngagementBudget.budgetedHours,
        },
        {
          label: copy.recoveryRate,
          value: acceptanceEngagementBudget.recoveryRate
            ? `${acceptanceEngagementBudget.recoveryRate}%`
            : undefined,
        },
        {
          label: copy.feePlanningDetails,
          value: (
            <CmpEngagementFeePlanningSummary
              lines={form.engagementPayload.feePlanningLines}
              currency={form.engagementPayload.feeCurrency}
              users={users}
            />
          ),
        },
      ],
    },
    {
      id: "notes",
      label: copy.engagementStatusAndRemarks,
      status: acceptanceEngagementStepStatus("notes"),
      items: [
        { label: copy.status, value: form.engagementPayload.status },
        { label: copy.remarks, value: form.engagementPayload.remarks },
      ],
    },
  ];

  function activateEngagementStep(stepId: AcceptanceEngagementWizardStepId) {
    setActiveEngagementSection(stepId);
  }

  function goToNextEngagementStep() {
    const steps: AcceptanceEngagementWizardStepId[] = [
      ...ACCEPTANCE_ENGAGEMENT_STEPS,
      "review",
    ];
    const index = steps.indexOf(activeEngagementSection);
    if (index < steps.length - 1) {
      activateEngagementStep(steps[index + 1]);
    }
  }

  if (isClientRequestType(form.type)) {
    return (
      <div className="cmp-modal-backdrop" role="presentation">
        <dialog
          open
          className="cmp-modal cmp-client-modal cmp-client-form-modal m-0"
          aria-modal="true"
        >
          <ClientMasterForm
            acceptanceDraftId={acceptanceDraftId}
            initialValue={{
              ...form.clientPayload,
              micApproverId: form.micApproverId,
              picApproverId: form.picApproverId,
              itApproverId: form.itApproverId,
            }}
            groups={groups}
            existingClients={clients}
            excludeClientId={form.targetClientId}
            users={[...micUsers, ...picUsers, ...itUsers, ...staffUsers]}
            initialDraftAssigneeId={form.draftAssigneeId}
            initialDraftName={form.draftName}
            canDelegateDraft={canDelegateDraft}
            draftOwnerLabel={
              draftSubmitTarget === "MIC"
                ? "Request owner owns this draft"
                : "MIC owns this draft"
            }
            allowIncompleteSubmit={allowIncompleteSubmit}
            validateOnOpen={validateOnOpen}
            mode={form.type === "CLIENT_CHANGE" ? "edit-request" : "acceptance"}
            title={
              isEditing
                ? `${copy.edit} ${TYPE_LABELS[form.type]}`
                : form.type === "CLIENT_CHANGE"
                  ? copy.clientChangeTitle
                  : copy.newClientAcceptance
            }
            isBusy={isBusy}
            submitLabel={
              allowIncompleteSubmit
                ? copy.saveChanges
                : `Submit to ${draftSubmitTarget}`
            }
            reviewLabel={`Review & send to ${draftSubmitTarget}`}
            onCancel={onClose}
            onDirtyChange={onDirtyChange}
            onSubmit={onSubmitClientResult}
            onSubmitSuccess={(result) => {
              if (!allowIncompleteSubmit && result.action === "submit") {
                onClose("submitted");
              }
            }}
          />
        </dialog>
      </div>
    );
  }

  return (
    <div
      className={pageMode ? "cmp-form-page-host" : "cmp-modal-backdrop"}
      role={pageMode ? undefined : "presentation"}
    >
      <section
        className={
          pageMode
            ? "cmp-form-page-surface"
            : "cmp-modal cmp-client-modal cmp-client-form-modal"
        }
        role={pageMode ? "region" : "dialog"}
        aria-modal={pageMode ? undefined : true}
      >
        <form
          ref={engagementFormRef}
          className="cmp-acceptance-engagement-form cmp-client-form cmp-client-form-shell cmp-client-form-workspace cmp-form-wizard-workspace"
          data-actions-placement="header"
          noValidate
          onBlurCapture={(event) => {
            const target = event.target as unknown as
              | HTMLInputElement
              | HTMLSelectElement
              | HTMLTextAreaElement;
            const field = target.dataset.validationField;
            if (field) {
              const fieldValue = target.value;
              window.setTimeout(
                () => validateAcceptanceEngagementField(field, fieldValue),
                0
              );
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (allowIncompleteSubmit || activeEngagementSection === "review") {
              void saveEngagementRequest("submit").catch(() => {});
              return;
            }
            if (activeEngagementSection === "notes") {
              activateEngagementStep("review");
            } else {
              goToNextEngagementStep();
            }
          }}
        >
          <AcceptanceFormWorkspace
            activeStepId={activeEngagementSection}
            stepperLabel={copy.engagementRequestSections}
            steps={acceptanceWizardSteps}
            onStepChange={(stepId) =>
              activateEngagementStep(stepId as AcceptanceEngagementWizardStepId)
            }
            header={
              <AcceptanceFormHeader>
                <div className="cmp-form-workspace-title">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="relative -top-px text-xl leading-7 font-semibold">
                      {form.type === "ENGAGEMENT_CHANGE"
                        ? copy.formRouteEngagementChangeTitle
                        : copy.formRouteEngagementAcceptanceTitle}
                    </h1>
                    <Badge
                      className="h-7 min-h-7 rounded-md! px-2"
                      radius="default"
                      variant="info-outline"
                    >
                      {copy.clientFormDraftStatus}
                    </Badge>
                    <Input
                      aria-label={
                        locale === "zh-CN" ? "草稿名称" : "Draft name"
                      }
                      className="h-7 w-44 text-xs"
                      maxLength={100}
                      placeholder={
                        locale === "zh-CN" ? "草稿名称" : "Draft name"
                      }
                      value={form.draftName}
                      onChange={(event) =>
                        update("draftName", event.target.value)
                      }
                    />
                    {engagementSavedAt ? (
                      <span className="cmp-form-save-state">
                        {copy.formSavedAt.replace("{time}", engagementSavedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ButtonGroup className="cmp-form-header-actions shrink-0 items-center gap-1.5">
                  {canDelegateDraft ? (
                    <AcceptanceDraftAssignment
                      compact
                      assigneeId={form.draftAssigneeId}
                      users={staffUsers}
                      isBusy={isBusy || engagementActionFeedback.isRunning}
                      ownerLabel={
                        draftSubmitTarget === "MIC"
                          ? "Request owner owns this draft"
                          : "MIC owns this draft"
                      }
                      onChange={(draftAssigneeId) =>
                        update("draftAssigneeId", draftAssigneeId)
                      }
                      onAssign={() => {
                        void saveEngagementRequest("assign").catch(() => {});
                      }}
                    />
                  ) : null}
                  <Button
                    type="button"
                    className="h-7 cursor-pointer px-2 text-xs!"
                    variant="ghost"
                    disabled={isBusy || engagementActionFeedback.isRunning}
                    onClick={() => {
                      void saveEngagementRequest("draft").catch(() => {});
                    }}
                  >
                    {copy.saveDraft}
                  </Button>
                  {allowIncompleteSubmit ||
                  activeEngagementSection === "review" ? (
                    <Button
                      type="submit"
                      className="h-7 cursor-pointer px-2.5 text-xs!"
                      variant="secondary"
                      disabled={isBusy || engagementActionFeedback.isRunning}
                    >
                      {isBusy || engagementActionFeedback.isRunning
                        ? copy.formSaving
                        : allowIncompleteSubmit
                          ? copy.saveChanges
                          : `Submit to ${draftSubmitTarget}`}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      aria-label={copy.formNext}
                      className="size-7 cursor-pointer rounded-full! [&_svg]:size-3.5"
                      variant="secondary"
                      disabled={isBusy || engagementActionFeedback.isRunning}
                    >
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  )}
                </ButtonGroup>
                <Button
                  type="button"
                  className="cmp-icon-button cmp-form-close-button"
                  aria-label={copy.closeForm}
                  onClick={requestEngagementClose}
                  disabled={isBusy || engagementActionFeedback.isRunning}
                >
                  <X aria-hidden="true" />
                </Button>
              </AcceptanceFormHeader>
            }
          >
            {activeEngagementSection === "review" ? (
              <FormValidationSummary errors={engagementErrors} />
            ) : null}
            <EngagementPayloadFields
              form={form.engagementPayload}
              clients={clients}
              users={users}
              exchangeRates={exchangeRates}
              currentUser={currentUser}
              picUsers={picUsers}
              micUsers={micUsers}
              eqReviewerUsers={eqReviewerUsers}
              errors={engagementErrors}
              activeSectionId={activeEngagementSection}
              stepStatus={acceptanceEngagementStepStatus}
              onBlurField={(field) => validateAcceptanceEngagementField(field)}
              onChange={updateEngagement}
              requestTypeControl={
                <label>
                  {copy.requestType}
                  <NativeSelect
                    value={form.type}
                    disabled={isEditing}
                    onChange={(event) =>
                      update(
                        "type",
                        event.target.value as CmpAcceptanceRequestType
                      )
                    }
                  >
                    {(
                      [
                        "CLIENT",
                        "CLIENT_CHANGE",
                        "ENGAGEMENT",
                        "ENGAGEMENT_CHANGE",
                      ] as CmpAcceptanceRequestType[]
                    ).map((type) => (
                      <option key={type} value={type}>
                        {acceptanceTypeLabel(type, locale)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              }
            />
            {activeEngagementSection === "review" ? (
              <Accordion
                multiple
                defaultValue={["review"]}
                className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
              >
                <AcceptanceFormAccordionSection
                  sectionId="review"
                  title={copy.clientFormPreview}
                  status={acceptanceEngagementStatus}
                  statusCopy={{
                    complete: copy.formComplete,
                    error: copy.formHasErrors,
                    incomplete: copy.formIncomplete,
                    notStarted: copy.formNotStarted,
                  }}
                  onFocus={() => setActiveEngagementSection("review")}
                >
                  <FormReviewPage
                    sections={acceptanceReviewSections}
                    title={copy.clientFormPreview}
                    showHeader={false}
                    showSectionStatus={false}
                    showEditActions={false}
                    onEdit={(sectionId) =>
                      activateEngagementStep(
                        sectionId as AcceptanceEngagementStepId
                      )
                    }
                  />
                </AcceptanceFormAccordionSection>
              </Accordion>
            ) : null}
          </AcceptanceFormWorkspace>
          <CmpAsyncActionFeedback
            feedback={engagementActionFeedback.feedback}
          />
        </form>
      </section>
      <CmpDraftExitDialog
        draftName={form.draftName}
        isSaving={Boolean(isBusy || engagementActionFeedback.isRunning)}
        open={isEngagementExitDialogOpen}
        onDraftNameChange={(draftName) => update("draftName", draftName)}
        onKeepAndExit={() => {
          void saveEngagementRequest("draft")
            .then(() => {
              setIsEngagementExitDialogOpen(false);
              onClose("cancelled");
            })
            .catch(() => {});
        }}
        onOpenChange={setIsEngagementExitDialogOpen}
      />
    </div>
  );
}

function EngagementPayloadPage({
  id,
  title,
  children,
  activeSectionId,
  openSectionIds,
  setOpenSectionIds,
  status,
  statusCopy,
}: {
  id: AcceptanceEngagementStepId;
  title: string;
  children: ReactNode;
  activeSectionId: AcceptanceEngagementWizardStepId;
  openSectionIds: string[];
  setOpenSectionIds: Dispatch<SetStateAction<string[]>>;
  status: CmpFormSectionStatus;
  statusCopy: AcceptanceFormAccordionStatusCopy;
}) {
  return (
    <section
      className="cmp-form-wizard-page"
      data-engagement-form-section={id}
      hidden={activeSectionId !== id}
    >
      <Accordion
        multiple
        keepMounted
        value={openSectionIds.includes(id) ? [id] : []}
        className="cmp-client-form-accordion mx-auto w-full max-w-[82rem] overflow-hidden rounded-lg border border-border"
        onValueChange={(value) =>
          setOpenSectionIds((current) => [
            ...current.filter((sectionId) => sectionId !== id),
            ...value.filter((sectionId) => sectionId === id),
          ])
        }
      >
        <AcceptanceFormAccordionSection
          sectionId={id}
          title={title}
          status={status}
          statusCopy={statusCopy}
          onFocus={() => {}}
        >
          <AcceptanceFormSectionContent>
            {children}
          </AcceptanceFormSectionContent>
        </AcceptanceFormAccordionSection>
      </Accordion>
    </section>
  );
}

function EngagementPayloadFields({
  form,
  clients,
  users,
  exchangeRates,
  currentUser,
  picUsers,
  micUsers,
  eqReviewerUsers,
  errors,
  activeSectionId,
  stepStatus,
  onBlurField,
  onChange,
  requestTypeControl,
}: {
  form: EngagementPayloadState;
  clients: CmpClient[];
  users: DirectoryUser[];
  exchangeRates: CmpBudgetExchangeRateSnapshot[];
  currentUser: CurrentUser;
  picUsers: DirectoryUser[];
  micUsers: DirectoryUser[];
  eqReviewerUsers: DirectoryUser[];
  errors: EngagementPayloadErrors;
  activeSectionId: AcceptanceEngagementWizardStepId;
  stepStatus: (stepId: AcceptanceEngagementStepId) => CmpFormSectionStatus;
  onBlurField?: (field: keyof EngagementPayloadState) => void;
  onChange: <Key extends keyof EngagementPayloadState>(
    key: Key,
    value: EngagementPayloadState[Key]
  ) => void;
  requestTypeControl: ReactNode;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const selectedClient = clients.find((client) => client.id === form.clientId);
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
  const budget = deriveFeePlanningBudget(form.feePlanningLines, form.agreedFee);
  const appliedExchangeRate = feeExchangeRateForAcceptance(form, exchangeRates);
  const currencyOptions = orderedAcceptanceCurrencies(
    currentUser.cmpCurrencyOrder
  ).map((currency) => {
    const definition = CMP_BUDGET_CURRENCY_LABELS[currency];
    const rate =
      exchangeRates.find((item) => item.currency === currency) ??
      getCmpFixedBudgetExchangeRate(currency);
    return {
      value: currency,
      label: `${locale === "zh-CN" ? definition.zh : definition.en} · ${currency}`,
      description:
        currency === "HKD"
          ? locale === "zh-CN"
            ? "港币结算本位币"
            : "Hong Kong dollar settlement currency"
          : `${currency} · 1 ${currency} = ${formatExchangeRateValue(rate)} HKD`,
      keywords: [
        currency,
        definition.en,
        definition.zh,
        ...definition.aliases,
      ].join(" "),
    };
  });
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([
    activeSectionId === "review" ? "setup" : activeSectionId,
  ]);
  const accordionStatusCopy: AcceptanceFormAccordionStatusCopy = {
    complete: copy.formComplete,
    error: copy.formHasErrors,
    incomplete: copy.formIncomplete,
    notStarted: copy.formNotStarted,
  };

  useEffect(() => {
    if (activeSectionId === "review") {
      return;
    }
    setOpenSectionIds([activeSectionId]);
  }, [activeSectionId]);

  return (
    <>
      <EngagementPayloadPage
        id="setup"
        title={copy.engagementSetup}
        activeSectionId={activeSectionId}
        openSectionIds={openSectionIds}
        setOpenSectionIds={setOpenSectionIds}
        status={stepStatus("setup")}
        statusCopy={accordionStatusCopy}
      >
        <AcceptanceEngagementSubsection
          className="cmp-form-subsection-first"
          title={copy.engagementIdentity}
        >
          {requestTypeControl}
          <SearchSelect
            label={copy.client}
            fieldId="clientId"
            required
            value={form.clientId}
            error={errors.clientId}
            placeholder={copy.selectClient}
            searchPlaceholder={copy.formSearch}
            options={clients.map((client) => ({
              value: client.id,
              label: `${client.clientCode} - ${client.nameEn || client.nameZh}`,
              description: [client.nameZh, client.status]
                .filter(Boolean)
                .join(" · "),
              keywords: `${client.clientCode} ${client.nameEn ?? ""} ${client.nameZh ?? ""}`,
            }))}
            onChange={(value) => onChange("clientId", value)}
            onBlur={() => onBlurField?.("clientId")}
          />
          <label
            className={errors.serviceType ? "cmp-field-invalid" : undefined}
          >
            <RequiredLabel label={copy.serviceType} />
            <NativeSelect
              aria-invalid={Boolean(errors.serviceType)}
              data-validation-field="serviceType"
              value={form.serviceType}
              onChange={(event) =>
                onChange(
                  "serviceType",
                  event.target.value as EngagementPayloadState["serviceType"]
                )
              }
            >
              <option value="">{copy.selectServiceType}</option>
              {form.serviceType &&
              ![
                "ANNUAL_AUDIT",
                "REVIEW",
                "SPECIAL_AUDIT_PRIVATE_CO",
                "OTHERS",
              ].includes(form.serviceType) ? (
                <option value={form.serviceType}>
                  {serviceTypeLabels[form.serviceType]} ·{" "}
                  {copy.engagementLegacyServiceType}
                </option>
              ) : null}
              <option value="ANNUAL_AUDIT">
                {serviceTypeLabels.ANNUAL_AUDIT}
              </option>
              <option value="REVIEW">{serviceTypeLabels.REVIEW}</option>
              <option value="SPECIAL_AUDIT_PRIVATE_CO">
                {serviceTypeLabels.SPECIAL_AUDIT_PRIVATE_CO}
              </option>
              <option value="OTHERS">{serviceTypeLabels.OTHERS}</option>
            </NativeSelect>
            {errors.serviceType ? (
              <span className="cmp-field-error">{errors.serviceType}</span>
            ) : null}
          </label>
          {form.serviceType === "OTHERS" ? (
            <TextField
              label={copy.clientFormExpectedEngagementType}
              value={form.otherServiceDescription}
              onChange={(value) => onChange("otherServiceDescription", value)}
              error={errors.otherServiceDescription}
              validationField="otherServiceDescription"
              required
            />
          ) : null}
          <TextField
            label={copy.engagementCode}
            value={form.engagementCode}
            onChange={(value) => onChange("engagementCode", value)}
            error={errors.engagementCode}
            validationField="engagementCode"
            required
          />
          {selectedClient ? (
            <div className="cmp-client-context cmp-form-span-full">
              <div>
                <strong>
                  {selectedClient.clientCode} ·{" "}
                  {selectedClient.nameEn || selectedClient.nameZh}
                </strong>
                <span>
                  {selectedClient.status === "ACTIVE"
                    ? copy.clientStatusActive
                    : selectedClient.status === "INACTIVE"
                      ? copy.clientStatusInactive
                      : copy.clientStatusResigned}{" "}
                  · {copy.pic}{" "}
                  {selectedClient.clientPartnerPic || copy.formNotSet} ·{" "}
                  {copy.mic}{" "}
                  {selectedClient.clientManagerMic || copy.formNotSet}
                </span>
              </div>
              <span className="cmp-inherited-badge">
                {copy.formClientDetailsApplied}
              </span>
            </div>
          ) : null}
        </AcceptanceEngagementSubsection>
        <AcceptanceEngagementSubsection title={copy.engagementKeyDates}>
          <TextField
            label={copy.yearEnd}
            type="date"
            value={form.yearEndDate}
            onChange={(value) => onChange("yearEndDate", value)}
            error={errors.yearEndDate}
            validationField="yearEndDate"
          />
          <TextField
            label={copy.reportDate}
            type="date"
            value={form.reportDate}
            onChange={(value) => onChange("reportDate", value)}
            error={errors.reportDate}
            validationField="reportDate"
          />
          <TextField
            label={copy.engagementDate}
            type="date"
            value={form.engagementDate}
            onChange={(value) => onChange("engagementDate", value)}
            error={errors.engagementDate}
            validationField="engagementDate"
          />
        </AcceptanceEngagementSubsection>
        <AcceptanceEngagementSubsection
          title={copy.engagementRiskClassification}
        >
          <CmpEngagementRiskSelector
            amlRiskClassification={form.amlRiskClassification}
            engagementRiskClassification={form.engagementRiskClassification}
            labels={copy}
            onAmlRiskClassificationChange={(value) =>
              onChange("amlRiskClassification", value)
            }
            onEngagementRiskClassificationChange={(value) =>
              onChange("engagementRiskClassification", value)
            }
          />
        </AcceptanceEngagementSubsection>
        <AcceptanceEngagementSubsection
          title={copy.engagementResponsiblePersons}
        >
          <SearchSelect
            label={copy.pic}
            fieldId="picUserId"
            required
            value={form.picUserId}
            error={errors.picUserId}
            placeholder={copy.selectPic}
            searchPlaceholder={copy.formSearch}
            options={[
              ...(form.picUserId &&
              !picUsers.some((user) => user.id === form.picUserId)
                ? [
                    {
                      value: form.picUserId,
                      label:
                        form.pic ||
                        selectedClient?.clientPartnerPic ||
                        form.picUserId,
                      description: copy.clientAssignment,
                    },
                  ]
                : []),
              ...picUsers.map((user) => ({
                value: user.id,
                label: user.name,
                description: user.globalRole.replaceAll("_", " "),
              })),
            ]}
            onChange={(value) => onChange("picUserId", value)}
            onBlur={() => onBlurField?.("picUserId")}
          />
          <SearchSelect
            label={copy.mic}
            fieldId="micUserId"
            required
            value={form.micUserId}
            error={errors.micUserId}
            placeholder={copy.selectMic}
            searchPlaceholder={copy.formSearch}
            options={[
              ...(form.micUserId &&
              !micUsers.some((user) => user.id === form.micUserId)
                ? [
                    {
                      value: form.micUserId,
                      label:
                        form.mic ||
                        selectedClient?.clientManagerMic ||
                        form.micUserId,
                      description: copy.clientAssignment,
                    },
                  ]
                : []),
              ...micUsers.map((user) => ({
                value: user.id,
                label: user.name,
                description: user.globalRole.replaceAll("_", " "),
              })),
            ]}
            onChange={(value) => onChange("micUserId", value)}
            onBlur={() => onBlurField?.("micUserId")}
          />
          {form.engagementRiskClassification === "NORMAL" ? null : (
            <SearchSelect
              label={copy.eqReviewer}
              fieldId="eqReviewerUserId"
              required
              value={form.eqReviewerUserId}
              error={errors.eqReviewerUserId}
              placeholder={copy.selectEqReviewer}
              searchPlaceholder={copy.selectEqReviewer}
              options={eqReviewerUsers.map((user) => ({
                value: user.id,
                label: user.name,
                description: user.globalRole,
              }))}
              onChange={(value) => {
                const user = eqReviewerUsers.find(
                  (candidate) => candidate.id === value
                );
                onChange("eqReviewerUserId", user?.id ?? "");
                onChange("eqReviewer", user?.name ?? "");
              }}
              onBlur={() => onBlurField?.("eqReviewerUserId")}
            />
          )}
        </AcceptanceEngagementSubsection>
        <AcceptanceEngagementSubsection title={copy.engagementDeliverables}>
          <EngagementDeliverablesField
            value={form.deliverables}
            serviceType={form.serviceType}
            locale={locale}
            onChange={(deliverables) => onChange("deliverables", deliverables)}
          />
        </AcceptanceEngagementSubsection>
      </EngagementPayloadPage>
      <EngagementPayloadPage
        id="commercial"
        title={copy.engagementCommercialPlanning}
        activeSectionId={activeSectionId}
        openSectionIds={openSectionIds}
        setOpenSectionIds={setOpenSectionIds}
        status={stepStatus("commercial")}
        statusCopy={accordionStatusCopy}
      >
        <AcceptanceEngagementSubsection
          className="cmp-form-subsection-first"
          title={copy.engagementBudgetOverview}
        >
          <TextField
            label={copy.agreedFee}
            type="number"
            value={form.agreedFee}
            onChange={(value) => onChange("agreedFee", value)}
            error={errors.agreedFee}
            validationField="agreedFee"
            required
          />
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
              if (value) {
                onChange("feeCurrency", value as CmpBudgetCurrency);
              }
            }}
          />
          {form.feeCurrency === "HKD" ? null : (
            <div className="cmp-form-subsection-grid cmp-form-subsection-grid-two cmp-form-span-full">
              <TextField
                label={
                  locale === "zh-CN"
                    ? `汇率（1 ${form.feeCurrency} = X HKD）`
                    : `Exchange rate (1 ${form.feeCurrency} = X HKD)`
                }
                type="number"
                value={form.feeExchangeRateHkdPerUnit}
                onChange={(value) =>
                  onChange("feeExchangeRateHkdPerUnit", value)
                }
                error={errors.feeExchangeRateHkdPerUnit}
                validationField="feeExchangeRateHkdPerUnit"
              />
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
                      (rate) => rate.currency === form.feeCurrency
                    ) ?? getCmpFixedBudgetExchangeRate(form.feeCurrency)
                  )}
                </strong>
                <Button
                  className="mt-2 w-fit"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onChange("feeExchangeRateSource", "SYSTEM");
                  }}
                >
                  {locale === "zh-CN"
                    ? "使用最新系统汇率"
                    : "Use latest system rate"}
                </Button>
              </div>
            </div>
          )}
          <div
            className="cmp-budget-derived-grid cmp-form-span-full"
            data-validation-field="budgetedHours"
          >
            <BudgetDerivedMetric
              label={copy.budgetedHours}
              value={budget.budgetedHours ? `${budget.budgetedHours} h` : "—"}
            />
            <BudgetDerivedMetric
              label={
                locale === "zh-CN"
                  ? "港币结算协定收费"
                  : "HKD settlement agreed fee"
              }
              value={
                form.agreedFee &&
                Number.isFinite(Number(appliedExchangeRate.hkdPerUnit))
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
                budget.standardValue
              )}
            />
            <BudgetDerivedMetric
              label={copy.recoveryRate}
              value={budget.recoveryRate ? `${budget.recoveryRate}%` : "—"}
            />
            <BudgetDerivedMetric
              label={copy.formEffectiveHourlyRate}
              value={
                budget.effectiveHourlyRate === null
                  ? "—"
                  : formatBudgetMoney(
                      locale,
                      form.feeCurrency,
                      budget.effectiveHourlyRate
                    )
              }
            />
          </div>
          {errors.budgetedHours ? (
            <span className="cmp-field-error cmp-form-span-full">
              {errors.budgetedHours}
            </span>
          ) : null}
        </AcceptanceEngagementSubsection>
        <AcceptanceEngagementSubsection title={copy.feePlanningDetails}>
          <CmpEngagementFeePlanningTable
            value={form.feePlanningLines}
            onChange={(feePlanningLines) =>
              onChange("feePlanningLines", feePlanningLines)
            }
            currency={form.feeCurrency}
            exchangeRate={appliedExchangeRate}
            users={users}
            isPrivateClient={selectedClient?.listedOrPrivate === "PRIVATE"}
            error={errors.feePlanningLines}
          />
        </AcceptanceEngagementSubsection>
      </EngagementPayloadPage>
      <EngagementPayloadPage
        id="notes"
        title={copy.engagementStatusAndRemarks}
        activeSectionId={activeSectionId}
        openSectionIds={openSectionIds}
        setOpenSectionIds={setOpenSectionIds}
        status={stepStatus("notes")}
        statusCopy={accordionStatusCopy}
      >
        <AcceptanceEngagementSubsection
          className="cmp-form-subsection-first"
          title={copy.engagementRecordDetails}
        >
          <label>
            {copy.status}
            <NativeSelect
              value={form.status}
              onChange={(event) =>
                onChange(
                  "status",
                  event.target.value as EngagementPayloadState["status"]
                )
              }
            >
              <option value="ACTIVE">{copy.clientStatusActive}</option>
              <option value="INACTIVE">{copy.clientStatusInactive}</option>
              <option value="COMPLETED">
                {copy.engagementStatusCompleted}
              </option>
              <option value="ARCHIVED">{copy.engagementStatusArchived}</option>
            </NativeSelect>
          </label>
          <TextAreaField
            label={copy.remarks}
            value={form.remarks}
            onChange={(value) => onChange("remarks", value)}
            error={errors.remarks}
            validationField="remarks"
          />
        </AcceptanceEngagementSubsection>
      </EngagementPayloadPage>
    </>
  );
}

function AcceptanceEngagementSubsection({
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
      <div className="cmp-form-subsection-grid cmp-form-span-full">
        {children}
      </div>
    </section>
  );
}

function AcceptanceDetailModal({
  request,
  canApprove,
  approvalComment,
  returnComment,
  isBusy,
  pendingAction,
  onApprovalCommentChange,
  onReturnCommentChange,
  onClose,
  onApprove,
  onReturn,
  users,
  staffUsers,
  isMic,
  onAssignDraft,
  onRecallDraft,
}: {
  request: CmpAcceptanceRequest;
  canApprove: boolean;
  approvalComment: string;
  returnComment: string;
  isBusy?: boolean;
  pendingAction?: CmpAcceptancePendingAction;
  onApprovalCommentChange: (value: string) => void;
  onReturnCommentChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReturn: () => void;
  users: DirectoryUser[];
  staffUsers: DirectoryUser[];
  isMic: boolean;
  onAssignDraft: (assigneeId: string) => void;
  onRecallDraft: () => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const [assigneeId, setAssigneeId] = useState(request.draftAssigneeId ?? "");
  const [isChangesOpen, setIsChangesOpen] = useState(false);
  const [changeSummary, setChangeSummary] =
    useState<CmpAcceptanceChangeSummary>();
  const [changeError, setChangeError] = useState<unknown>();
  const [isChangesLoading, setIsChangesLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(Boolean(isBusy));
  useEffect(() => {
    onCloseRef.current = onClose;
    isBusyRef.current = Boolean(isBusy);
  }, [isBusy, onClose]);
  const isChangeRequest =
    request.type === "CLIENT_CHANGE" || request.type === "ENGAGEMENT_CHANGE";
  const isRequestActionPending = Boolean(pendingAction);
  const displayedChangeCount =
    changeSummary?.status === "AVAILABLE"
      ? changeSummary.changedFieldCount
      : request.changedFieldCount;

  useEffect(() => {
    setAssigneeId(request.draftAssigneeId ?? "");
    setIsChangesOpen(false);
    setChangeSummary(undefined);
    setChangeError(undefined);
  }, [request]);

  useEffect(() => {
    if (!isChangeRequest || !isChangesOpen || changeSummary || changeError) {
      return;
    }
    let cancelled = false;
    setIsChangesLoading(true);
    setChangeError(undefined);
    void getCmpAcceptanceChanges(request.id)
      .then((summary) => {
        if (!cancelled) {
          setChangeSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChangeError(new Error("Could not load changes"));
          sonnerToast.error("Could not load changes", { duration: 5000 });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChangesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [changeError, changeSummary, isChangeRequest, isChangesOpen, request.id]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isBusyRef.current) {
          return;
        }
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const [first] = focusable;
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      queueMicrotask(() => previouslyFocused?.focus());
    };
  }, []);

  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        ref={dialogRef}
        className="cmp-modal cmp-acceptance-detail-modal m-0"
        aria-modal="true"
        aria-labelledby="cmp-acceptance-detail-title"
        tabIndex={-1}
      >
        <header className="cmp-modal-heading cmp-acceptance-detail-header">
          <div>
            <p className="cmp-eyebrow">{TYPE_LABELS[request.type]}</p>
            <div className="cmp-acceptance-detail-title-row">
              <h3 id="cmp-acceptance-detail-title">{request.requestNo}</h3>
              <span
                className={`cmp-status-pill is-${request.status.toLowerCase()}`}
              >
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            <p className="cmp-acceptance-detail-subject">
              {getRequestTitle(request)}
              <span>{getRequestSubtitle(request)}</span>
            </p>
            {isChangeRequest ? (
              <Button
                type="button"
                className="cmp-change-toggle"
                aria-expanded={isChangesOpen}
                aria-controls="cmp-acceptance-change-comparison"
                onClick={() => setIsChangesOpen((open) => !open)}
              >
                {locale === "zh-CN" ? "查看修改" : "View changes"}
                {displayedChangeCount !== null &&
                displayedChangeCount !== undefined
                  ? ` (${displayedChangeCount})`
                  : ""}
                <ChevronDown
                  aria-hidden="true"
                  className={isChangesOpen ? "is-open" : ""}
                />
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            className="cmp-icon-button"
            aria-label={copy.closeAcceptanceDetails}
            onClick={onClose}
            disabled={isBusy}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="cmp-acceptance-detail-body">
          <section
            className="cmp-acceptance-current-owner"
            aria-label={copy.currentResponsibility}
          >
            <Clock3 aria-hidden="true" />
            <div>
              <span>{copy.currentResponsibility}</span>
              <strong>{getCurrentResponsibility(request)}</strong>
            </div>
          </section>
          <AcceptanceWorkflowStepper request={request} />
          {request.returnReason ? (
            <AcceptanceReturnBanner request={request} />
          ) : null}
          {isClientRequestType(request.type) ? (
            <AcceptanceAmlSummary request={request} locale={locale} />
          ) : null}
          {isChangeRequest ? (
            <div
              id="cmp-acceptance-change-comparison"
              className={`cmp-change-comparison-collapse ${isChangesOpen ? "is-open" : ""}`}
              aria-hidden={!isChangesOpen}
              inert={!isChangesOpen}
            >
              <div>
                {isChangesOpen || changeSummary || changeError ? (
                  <AcceptanceChangeComparison
                    summary={changeSummary}
                    isLoading={isChangesLoading}
                    error={changeError}
                    locale={locale}
                    onRetry={() => {
                      setChangeError(undefined);
                      setChangeSummary(undefined);
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          <section className="cmp-form-section">
            <div className="cmp-form-section-heading">
              <h4>Request details</h4>
            </div>
            <dl className="cmp-acceptance-metadata-grid">
              <div>
                <dt>Submitted by</dt>
                <dd>{request.submittedBy.name}</dd>
              </div>
              <div>
                <dt>Current step</dt>
                <dd>{STEP_LABELS[request.currentStep]}</dd>
              </div>
              <div>
                <dt>Created at</dt>
                <dd>{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated at</dt>
                <dd>{formatDateTime(request.updatedAt)}</dd>
              </div>
              {request.workflowVersion >= 2 ? (
                <>
                  <div>
                    <dt>Draft owner</dt>
                    <dd>
                      {getDraftControllerName(request)}
                      {request.submittedAt ? " (MIC)" : " (Request owner)"}
                    </dd>
                  </div>
                  <div>
                    <dt>Staff assignee</dt>
                    <dd>{request.draftAssignee?.name ?? "Not assigned"}</dd>
                  </div>
                  <div className="cmp-metadata-span-2">
                    <dt>Draft readiness</dt>
                    <dd>{getDraftReadinessLabel(request)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>
          {isMic ? (
            <section className="cmp-form-section cmp-draft-delegation-controls">
              <div className="cmp-form-section-heading">
                <h4>Draft delegation</h4>
                <p>
                  Assign or return form completion to an execution team member.
                </p>
              </div>
              <div className="cmp-draft-delegation-action-row">
                <label>
                  {copy.staffMember}
                  <NativeSelect
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                  >
                    <option value="">{copy.selectStaff}</option>
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <div className="cmp-draft-delegation-actions">
                  {request.draftAssigneeId ? (
                    <Button
                      type="button"
                      className="cmp-secondary-button"
                      disabled={isBusy || isRequestActionPending}
                      onClick={onRecallDraft}
                    >
                      {pendingAction?.kind === "recall" ? (
                        <PendingActionLabel label={copy.recallingDraft} />
                      ) : (
                        "Recall draft"
                      )}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="cmp-primary-button"
                    disabled={isBusy || isRequestActionPending || !assigneeId}
                    onClick={() => onAssignDraft(assigneeId)}
                  >
                    {pendingAction?.kind === "assign" ? (
                      <PendingActionLabel label={copy.assigningDraft} />
                    ) : request.draftAssigneeId ? (
                      "Reassign draft"
                    ) : (
                      "Assign draft"
                    )}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
          {request.engagementPayload ? (
            <section className="cmp-form-section">
              <div className="cmp-form-section-heading">
                <h4>{locale === "zh-CN" ? "预算" : "Budget"}</h4>
              </div>
              <dl className="cmp-commercial-summary-grid">
                <div>
                  <dt>Budgeted Hours</dt>
                  <dd>{request.engagementPayload.budgetedHours}</dd>
                </div>
                <div>
                  <dt>Agreed Fee</dt>
                  <dd>
                    {formatPreviewMoney(
                      request.engagementPayload.agreedFee,
                      request.engagementPayload.feeCurrency ?? "HKD",
                      locale
                    ) ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt>{copy.recoveryRate}</dt>
                  <dd>
                    {request.engagementPayload.recoveryRate
                      ? `${request.engagementPayload.recoveryRate}%`
                      : "-"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <h5>{copy.feePlanningDetails}</h5>
                <CmpEngagementFeePlanningSummary
                  lines={feePlanningLinesFromDraft(
                    request.engagementPayload.feePlanningLines
                  )}
                  currency={request.engagementPayload.feeCurrency}
                  users={users}
                />
              </div>
            </section>
          ) : null}
          <ApprovalRoleSummary request={request} />
        </div>
        {canApprove ? (
          <AcceptanceApprovalFooter
            approvalComment={approvalComment}
            returnComment={returnComment}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onApprovalCommentChange={onApprovalCommentChange}
            onReturnCommentChange={onReturnCommentChange}
            onApprove={onApprove}
            onReturn={onReturn}
          />
        ) : null}
      </dialog>
    </div>
  );
}

function AcceptanceAmlSummary({
  request,
  locale,
}: {
  request: CmpAcceptanceRequest;
  locale: string;
}) {
  const zh = locale === "zh-CN";
  const summary = request.amlSummary;
  const status = summary?.status ?? "NOT_RUN";
  const label =
    status === "CLEAR"
      ? zh
        ? "AML 筛查未发现风险提示"
        : "AML screening is clear"
      : status === "ATTENTION"
        ? zh
          ? "AML 筛查存在需要关注的结果"
          : "AML screening needs attention"
        : status === "ERROR"
          ? zh
            ? "AML 筛查存在未完成项目"
            : "AML screening is incomplete"
          : zh
            ? "尚未进行 AML 筛查"
            : "AML screening was not run";
  return (
    <section
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        status === "CLEAR"
          ? "border-success/30 bg-success/10"
          : "border-warning/40 bg-warning/10"
      }`}
      aria-label={zh ? "AML 筛查摘要" : "AML screening summary"}
    >
      <AlertTriangle
        className={`mt-0.5 size-5 shrink-0 ${
          status === "CLEAR" ? "text-success" : "text-warning"
        }`}
        aria-hidden="true"
      />
      <div>
        <strong className="text-sm">{label}</strong>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary
            ? zh
              ? `主体 ${summary.subjectCount} · 需关注 ${summary.attentionCount} · 未完成 ${summary.errorCount}`
              : `${summary.subjectCount} subjects · ${summary.attentionCount} attention · ${summary.errorCount} incomplete`
            : zh
              ? "AML 为可选、非阻断步骤。"
              : "AML is optional and non-blocking."}
        </p>
      </div>
    </section>
  );
}

function AcceptanceApprovalFooter({
  approvalComment,
  returnComment,
  isBusy,
  pendingAction,
  onApprovalCommentChange,
  onReturnCommentChange,
  onApprove,
  onReturn,
}: {
  approvalComment: string;
  returnComment: string;
  isBusy?: boolean;
  pendingAction?: CmpAcceptancePendingAction;
  onApprovalCommentChange: (value: string) => void;
  onReturnCommentChange: (value: string) => void;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const isActionPending = Boolean(pendingAction);
  return (
    <footer className="cmp-acceptance-approval-footer">
      <div className="cmp-form-section-heading">
        <h4>Approval action</h4>
        <p>Approve with an optional comment, or return with a reason.</p>
      </div>
      <div className="cmp-acceptance-approval-fields">
        <div className="cmp-approval-action-group">
          <TextAreaField
            label="Approve comment"
            value={approvalComment}
            onChange={onApprovalCommentChange}
          />
          <div className="cmp-approval-action-button-row">
            <Button
              type="button"
              className="cmp-primary-button"
              onClick={onApprove}
              disabled={isBusy || isActionPending}
            >
              {pendingAction?.kind === "approve" ? (
                <PendingActionLabel label={copy.approvingRequest} />
              ) : (
                "Approve"
              )}
            </Button>
          </div>
        </div>
        <div className="cmp-approval-action-group">
          <TextAreaField
            label="Return reason"
            value={returnComment}
            onChange={onReturnCommentChange}
          />
          <div className="cmp-approval-action-button-row">
            <Button
              type="button"
              className="cmp-secondary-button"
              onClick={onReturn}
              disabled={isBusy || isActionPending || !returnComment.trim()}
            >
              {pendingAction?.kind === "return" ? (
                <PendingActionLabel label={copy.returningToMic} />
              ) : (
                "Return to MIC"
              )}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

type AcceptancePreviewItem = {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
};

type AcceptancePreviewSection = {
  id: string;
  title: string;
  items: AcceptancePreviewItem[];
};

function AcceptancePayloadPreviewModal({
  request,
  clients,
  groups,
  users,
  canApprove,
  approvalComment,
  returnComment,
  isBusy,
  pendingAction,
  onApprovalCommentChange,
  onReturnCommentChange,
  onClose,
  onApprove,
  onReturn,
}: {
  request: CmpAcceptanceRequest;
  clients: CmpClient[];
  groups: CmpClientGroup[];
  users: DirectoryUser[];
  canApprove: boolean;
  approvalComment: string;
  returnComment: string;
  isBusy?: boolean;
  pendingAction?: CmpAcceptancePendingAction;
  onApprovalCommentChange: (value: string) => void;
  onReturnCommentChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const { dictionary, locale } = useCmpI18n();
  const copy = dictionary.workspace;
  const [changeSummary, setChangeSummary] =
    useState<CmpAcceptanceChangeSummary>();
  const [changeError, setChangeError] = useState<unknown>();
  const [isChangesLoading, setIsChangesLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(Boolean(isBusy));
  useEffect(() => {
    onCloseRef.current = onClose;
    isBusyRef.current = Boolean(isBusy);
  }, [isBusy, onClose]);
  const isChangeRequest =
    request.type === "CLIENT_CHANGE" || request.type === "ENGAGEMENT_CHANGE";
  const sections = isClientRequestType(request.type)
    ? buildClientPayloadPreviewSections(request, clients, groups, copy)
    : buildEngagementPayloadPreviewSections(
        request,
        clients,
        users,
        copy,
        locale
      );

  useEffect(() => {
    if (!request.id) {
      return;
    }
    setChangeSummary(undefined);
    setChangeError(undefined);
  }, [request]);

  useEffect(() => {
    if (!isChangeRequest || changeError) {
      return;
    }
    let cancelled = false;
    setIsChangesLoading(true);
    setChangeError(undefined);
    void getCmpAcceptanceChanges(request.id)
      .then((summary) => {
        if (!cancelled) {
          setChangeSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChangeError(new Error("Could not load changes"));
          sonnerToast.error("Could not load changes", { duration: 5000 });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsChangesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [changeError, isChangeRequest, request]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isBusyRef.current) {
          return;
        }
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const [first] = focusable;
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      queueMicrotask(() => previouslyFocused?.focus());
    };
  }, []);

  const title = isClientRequestType(request.type)
    ? copy.formPreviewClient
    : copy.formPreviewEngagement;
  const changeCount =
    changeSummary?.status === "AVAILABLE"
      ? changeSummary.changedFieldCount
      : request.changedFieldCount;

  return (
    <div className="cmp-modal-backdrop" role="presentation">
      <dialog
        open
        ref={dialogRef}
        className="cmp-modal cmp-acceptance-detail-modal cmp-acceptance-payload-preview-modal m-0"
        aria-modal="true"
        aria-labelledby="cmp-acceptance-payload-preview-title"
        tabIndex={-1}
      >
        <header className="cmp-modal-heading cmp-acceptance-detail-header">
          <div>
            <p className="cmp-eyebrow">{TYPE_LABELS[request.type]}</p>
            <h3 id="cmp-acceptance-payload-preview-title">{title}</h3>
            <p className="cmp-acceptance-detail-subject">
              {getRequestTitle(request)}
              <span>{getRequestSubtitle(request)}</span>
            </p>
          </div>
          <Button
            type="button"
            className="cmp-icon-button"
            aria-label="Close form preview"
            onClick={onClose}
            disabled={isBusy}
          >
            <X aria-hidden="true" />
          </Button>
        </header>
        <div className="cmp-acceptance-detail-body cmp-acceptance-payload-preview-body">
          {isChangeRequest ? (
            <section
              className="cmp-form-section"
              aria-label={copy.formPreviewChanges}
            >
              <div className="cmp-form-section-heading">
                <h4>
                  {copy.formPreviewChanges}
                  {changeCount !== null && changeCount !== undefined
                    ? ` (${changeCount})`
                    : ""}
                </h4>
              </div>
              <AcceptanceChangeComparison
                summary={changeSummary}
                isLoading={isChangesLoading}
                error={changeError}
                locale={locale}
                onRetry={() => {
                  setChangeError(undefined);
                  setChangeSummary(undefined);
                }}
              />
            </section>
          ) : null}
          {sections.map((section) => (
            <section key={section.id} className="cmp-form-section">
              <div className="cmp-form-section-heading">
                <h4>{section.title}</h4>
              </div>
              <dl className="cmp-acceptance-metadata-grid cmp-read-only-form-grid">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className={
                      item.fullWidth ? "cmp-metadata-span-2" : undefined
                    }
                  >
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        {canApprove ? (
          <AcceptanceApprovalFooter
            approvalComment={approvalComment}
            returnComment={returnComment}
            isBusy={isBusy}
            pendingAction={pendingAction}
            onApprovalCommentChange={onApprovalCommentChange}
            onReturnCommentChange={onReturnCommentChange}
            onApprove={onApprove}
            onReturn={onReturn}
          />
        ) : null}
      </dialog>
    </div>
  );
}

function buildClientPayloadPreviewSections(
  request: CmpAcceptanceRequest,
  clients: CmpClient[],
  groups: CmpClientGroup[],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
): AcceptancePreviewSection[] {
  const payload =
    request.clientPayload as CmpClientAcceptanceDraftPayload | null;
  if (!payload) {
    return [];
  }
  const has = (key: keyof CmpClientAcceptanceDraftPayload) =>
    Object.hasOwn(payload, key);
  const field = (
    label: string,
    value: unknown,
    options: { always?: boolean; show?: boolean; fullWidth?: boolean } = {}
  ) =>
    previewItem(label, value, copy.formNotProvided, {
      show: options.show ?? hasPreviewValue(value),
      always: options.always,
      fullWidth: options.fullWidth,
    });
  const { groupStructure } = payload;
  const primaryGroupId = groupStructure?.primaryGroupId ?? payload.groupId;
  const primaryGroup = primaryGroupId
    ? (formatGroupReference(
        groups.find((group) => group.id === primaryGroupId)
      ) ?? primaryGroupId)
    : payload.groupMode === "NO_GROUP"
      ? copy.formNoGroup
      : undefined;
  const serviceTypes = parseClientServiceTypes(
    payload.serviceLines,
    payload.serviceType
  );
  const relationships = groupStructure?.relationships;
  const relationshipValue = relationships ? (
    relationships.length > 0 ? (
      <ReadOnlyRelationshipList
        relationships={relationships}
        clients={clients}
        groups={groups}
        emptyLabel={copy.formNone}
      />
    ) : (
      copy.formNone
    )
  ) : undefined;
  return compactPreviewSections([
    {
      id: "basic",
      title: copy.clientFormInformation,
      items: compactPreviewItems([
        field(copy.clientCode, payload.clientCode, { always: true }),
        field(copy.companyCode, payload.companyCode, { always: true }),
        field("Company Number", payload.companyNumber),
        field("Company Name English", payload.nameEn, { always: true }),
        field(copy.chineseName, payload.nameZh, { always: true }),
        field(copy.status, formatPreviewEnum(payload.status), { always: true }),
        field("Year End Month", formatMonth(payload.yearEndMonth), {
          always: true,
        }),
        field(
          "Registered Address",
          payload.registeredAddress ?? payload.address,
          {
            fullWidth: true,
          }
        ),
        field(
          "Principal Business Address",
          payload.principalBusinessAddress ?? payload.address,
          {
            fullWidth: true,
          }
        ),
        field("Contact Person", payload.contactPerson),
        field("Position", payload.contactPosition),
        field("Department", payload.contactDepartment),
        field("Office Telephone", payload.telephone),
        field("Mobile", payload.contactMobile),
        field("Email", payload.email),
        field("Contact Notes", payload.contactRemarks, { fullWidth: true }),
        field(copy.referredBy, payload.referredBy),
        field(copy.remarks, payload.remarks, { fullWidth: true }),
      ]),
    },
    {
      id: "registration",
      title: copy.formRegistrationSection,
      items: compactPreviewItems([
        field(copy.placeOfIncorporation, payload.placeOfIncorporation),
        field("Incorporation year / month", payload.incorporationYearMonth),
        field("Reporting GAAP", payload.reportingGaap),
        field("Industry", payload.hsicSectionCode),
        field("Other Industry Description", payload.industryOtherDescription, {
          show: payload.hsicSectionCode === "OTHER",
          fullWidth: true,
        }),
        field("Company Type", payload.listedOrPrivate),
        field("Other Company Type", payload.companyTypeOtherDescription, {
          show: payload.listedOrPrivate === "OTHER",
        }),
        field(
          "Stock Exchange / Place of Listing",
          payload.stockExchangeOrListingPlace
        ),
        field(copy.stockCode, payload.stockCode),
        field("Main Board / GEM / Others", payload.marketSegment),
        field(copy.regulatedEntities, payload.regulatedEntities),
        field("Regulator / Regulated By", payload.regulatedBy),
      ]),
    },
    {
      id: "relationships",
      title: copy.formRelatedPartiesSection,
      items: compactPreviewItems([
        field("Primary Group", primaryGroup, {
          show:
            has("groupMode") ||
            has("groupId") ||
            Boolean(groupStructure?.primaryGroupId),
        }),
        field(
          "Ultimate Parent",
          formatUltimateParentAction(
            groupStructure?.ultimateParentAction,
            copy
          ),
          { show: Boolean(groupStructure?.ultimateParentAction) }
        ),
        field("Formal relationships", relationshipValue, {
          show: relationships !== undefined,
          fullWidth: true,
        }),
        field(
          copy.subsidiary,
          formatPreviewBoolean(payload.isSubsidiary, copy),
          {
            show: has("isSubsidiary"),
          }
        ),
        field("Parent Client Code", payload.parentClientCode),
        field(
          "Parent / Holding Company Name",
          payload.parentHoldingCompanyName
        ),
        field(
          "Has Subsidiaries / Associates",
          formatPreviewBoolean(payload.hasSubsidiariesOrAssociates, copy),
          { show: has("hasSubsidiariesOrAssociates") }
        ),
        field(
          "Subsidiaries / Associates list",
          payload.subsidiariesOrAssociates,
          {
            fullWidth: true,
          }
        ),
      ]),
    },
    {
      id: "responsible",
      title: copy.responsiblePersons,
      items: compactPreviewItems([
        field(
          "Client Leading Partner",
          payload.clientLeadingPartner ?? payload.clientLeadingPartnerId
        ),
        field("PIC", payload.clientPartnerPic ?? payload.clientPartnerPicId),
        field("MIC", payload.clientManagerMic ?? payload.clientManagerMicId),
        field(
          copy.alternativePartnerSecondMic,
          payload.alternativePartnerSecondMic ??
            payload.alternativePartnerSecondMicId
        ),
      ]),
    },
    {
      id: "service",
      title: copy.formExpectedServiceSection,
      items: compactPreviewItems([
        field(
          copy.expectedJobOrEngagementType,
          payload.expectedJobOrEngagementType
        ),
        field(copy.serviceType, serviceTypes.join(", "), {
          show: has("serviceLines") || has("serviceType"),
          fullWidth: true,
        }),
      ]),
    },
  ]);
}

function buildEngagementPayloadPreviewSections(
  request: CmpAcceptanceRequest,
  clients: CmpClient[],
  users: DirectoryUser[],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"],
  locale: string
): AcceptancePreviewSection[] {
  const payload = request.engagementPayload;
  if (!payload) {
    return [];
  }
  const _has = (key: keyof typeof payload) => Object.hasOwn(payload, key);
  const field = (
    label: string,
    value: unknown,
    options: { always?: boolean; show?: boolean; fullWidth?: boolean } = {}
  ) =>
    previewItem(label, value, copy.formNotProvided, {
      show: options.show ?? hasPreviewValue(value),
      always: options.always,
      fullWidth: options.fullWidth,
    });
  const client = clients.find((item) => item.id === payload.clientId);
  const clientReference = formatClientReference(client) ?? payload.clientId;
  const pic = resolvePersonName(payload.pic, payload.picUserId, users);
  const mic = resolvePersonName(payload.mic, payload.micUserId, users);
  const eqReviewer = resolvePersonName(
    payload.eqReviewer,
    payload.eqReviewerUserId,
    users
  );
  const currency = payload.feeCurrency ?? "HKD";
  const appliedRate =
    currency === "HKD" ? 1 : Number(payload.feeExchangeRateHkdPerUnit || 0);
  const hkdSettlementAmount =
    Number.isFinite(appliedRate) && appliedRate > 0 && payload.agreedFee
      ? Number(payload.agreedFee) * appliedRate
      : undefined;

  return compactPreviewSections([
    {
      id: "client-approval",
      title: copy.engagementClientAndApproval,
      items: compactPreviewItems([
        field(copy.client, clientReference, { always: true }),
        field(copy.engagementDate, payload.engagementDate),
      ]),
    },
    {
      id: "basic",
      title: copy.engagementInformation,
      items: compactPreviewItems([
        field(copy.engagementCode, payload.engagementCode, { always: true }),
        field(copy.serviceType, formatPreviewEnum(payload.serviceType), {
          always: true,
        }),
        field(
          "Expected Job / Engagement Type",
          payload.otherServiceDescription,
          {
            show: payload.serviceType === "OTHERS",
          }
        ),
        field(copy.yearEnd, payload.yearEndDate, { always: true }),
        field(copy.reportDate, payload.reportDate),
      ]),
    },
    {
      id: "deliverables",
      title: copy.engagementDeliverables,
      items: compactPreviewItems([
        field(
          copy.engagementSelectedDeliverables,
          payload.deliverables?.length
            ? formatEngagementDeliverables(
                payload.deliverables,
                locale === "zh-CN" ? "zh-CN" : "en-US"
              ).join("\n")
            : undefined,
          { always: true, fullWidth: true }
        ),
      ]),
    },
    {
      id: "commercial",
      title: copy.engagementCommercialPlanning,
      items: compactPreviewItems([
        field(copy.budgetedHours, formatPreviewHours(payload.budgetedHours), {
          always: true,
        }),
        field(
          copy.agreedFee,
          formatPreviewMoney(payload.agreedFee, currency, locale),
          {
            always: true,
          }
        ),
        field(
          locale === "zh-CN"
            ? "应用汇率（1 外币 = HKD）"
            : "Applied rate (1 foreign currency = HKD)",
          currency === "HKD" ? "1.00000000" : payload.feeExchangeRateHkdPerUnit,
          { always: true }
        ),
        field(
          locale === "zh-CN" ? "港币结算协定收费" : "HKD settlement agreed fee",
          hkdSettlementAmount === undefined
            ? undefined
            : formatPreviewMoney(String(hkdSettlementAmount), "HKD", locale),
          { always: true }
        ),
        field(
          copy.recoveryRate,
          payload.recoveryRate ? `${payload.recoveryRate}%` : undefined
        ),
      ]),
    },
    {
      id: "risk",
      title: copy.engagementRiskAndResponsibility,
      items: compactPreviewItems([
        field(
          copy.amlTfRisk,
          payload.amlRiskClassification === "HIGH"
            ? copy.amlTfRiskHigh
            : copy.amlTfRiskNotHigh,
          { always: true }
        ),
        field(
          copy.engagementRisk,
          acceptanceEngagementRiskLabel(
            payload.engagementRiskClassification ?? "NORMAL",
            copy
          ),
          { always: true }
        ),
        field(copy.pic, pic, { always: true }),
        field(copy.mic, mic, { always: true }),
        field(copy.eqReviewer, eqReviewer, {
          show: payload.engagementRiskClassification !== "NORMAL",
        }),
      ]),
    },
    {
      id: "status-notes",
      title: copy.engagementStatusAndRemarks,
      items: compactPreviewItems([
        field(copy.status, formatPreviewEnum(payload.status), { always: true }),
        field(copy.remarks, payload.remarks, { fullWidth: true }),
      ]),
    },
  ]);
}

function compactPreviewItems(
  items: (AcceptancePreviewItem | null)[]
): AcceptancePreviewItem[] {
  return items.filter((item): item is AcceptancePreviewItem => item !== null);
}

function compactPreviewSections(
  sections: AcceptancePreviewSection[]
): AcceptancePreviewSection[] {
  return sections.filter((section) => section.items.length > 0);
}

function previewItem(
  label: string,
  value: unknown,
  fallback: string,
  options: { show?: boolean; always?: boolean; fullWidth?: boolean } = {}
): AcceptancePreviewItem | null {
  if (!options.always && !options.show) {
    return null;
  }
  return {
    label,
    value: hasPreviewValue(value) ? (value as ReactNode) : fallback,
    fullWidth: options.fullWidth,
  };
}

function hasPreviewValue(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }
  return typeof value !== "string" || Boolean(value.trim());
}

function formatPreviewBoolean(
  value: boolean | null | undefined,
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  if (value === undefined || value === null) {
    return;
  }
  return value ? copy.yes : copy.no;
}

function formatPreviewEnum(value: string | null | undefined) {
  if (!value) {
    return;
  }
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPreviewPercent(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const text = String(value).trim();
  return text.endsWith("%") ? text : `${text}%`;
}

function formatPreviewHours(value: string | null | undefined) {
  if (!value?.trim()) {
    return;
  }
  return `${value} hours`;
}

function formatPreviewMoney(
  value: string | null | undefined,
  currency: string,
  locale: string
) {
  if (!value?.trim()) {
    return;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatGroupReference(group: CmpClientGroup | undefined) {
  if (!group) {
    return;
  }
  return `${group.groupCode} — ${group.nameEn ?? group.nameZh}`;
}

function formatClientReference(client: CmpClient | undefined) {
  if (!client) {
    return;
  }
  return `${client.clientCode} — ${client.nameEn || client.nameZh}`;
}

function resolvePersonName(
  payloadName: string | null | undefined,
  userId: string | null | undefined,
  users: DirectoryUser[]
) {
  if (payloadName?.trim()) {
    return payloadName;
  }
  return users.find((user) => user.id === userId)?.name ?? userId;
}

function formatUltimateParentAction(
  action: CmpClientUltimateParentAction | undefined,
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  if (!action || action === "UNCHANGED") {
    return;
  }
  return action === "SET_CURRENT" ? copy.yes : copy.no;
}

function ReadOnlyRelationshipList({
  relationships,
  clients,
  groups,
  emptyLabel,
}: {
  relationships: NonNullable<
    CmpClientAcceptanceDraftPayload["groupStructure"]
  >["relationships"] extends infer Relationships
    ? Relationships extends (infer Relationship)[]
      ? Relationship[]
      : never
    : never;
  clients: CmpClient[];
  groups: CmpClientGroup[];
  emptyLabel: string;
}) {
  if (relationships.length === 0) {
    return emptyLabel;
  }
  return (
    <div className="cmp-read-only-related-list">
      {relationships.map((relationship, index) => {
        const counterpart = clients.find(
          (client) => client.id === relationship.counterpartClientId
        );
        const group = groups.find((item) => item.id === relationship.groupId);
        return (
          <article key={relationship.relationshipId ?? `${index}`}>
            <strong>
              {formatPreviewEnum(relationship.type) ?? "Relationship"}
              {relationship.action === "END" ? " — End" : ""}
            </strong>
            <span>
              {formatClientReference(counterpart) ??
                relationship.counterpartClientId ??
                "Counterpart not provided"}
            </span>
            <span>
              {formatGroupReference(group) ??
                relationship.groupId ??
                "Group not provided"}
            </span>
            {relationship.ownershipPercentage === undefined ? null : (
              <span>
                {formatPreviewPercent(relationship.ownershipPercentage)}
              </span>
            )}
            {relationship.effectiveFrom || relationship.effectiveTo ? (
              <span>
                {relationship.effectiveFrom ?? "—"} to{" "}
                {relationship.effectiveTo ?? "—"}
              </span>
            ) : null}
            {relationship.remarks ? <span>{relationship.remarks}</span> : null}
          </article>
        );
      })}
    </div>
  );
}

type ApprovalRole = Exclude<CmpAcceptanceStep, "DONE">;
type WorkflowStepState =
  | "complete"
  | "active"
  | "upcoming"
  | "returned"
  | "needs-changes";

const APPROVAL_ROLES: ApprovalRole[] = ["MIC", "PIC", "IT"];

function AcceptanceWorkflowStepper({
  request,
}: {
  request: CmpAcceptanceRequest;
}) {
  return (
    <section className="cmp-approval-workflow" aria-label="Approval workflow">
      <div className="cmp-form-section-heading">
        <h4>Approval workflow</h4>
        <p>MIC submission, one-time PIC approval, then final IT approval.</p>
      </div>
      <ol className="cmp-approval-stepper">
        {APPROVAL_ROLES.map((role, index) => {
          const state = getWorkflowStepState(request, role);
          return (
            <li key={role} className={`is-${state}`}>
              <div className="cmp-approval-step-marker" aria-hidden="true">
                {state === "complete" ? (
                  <Check />
                ) : state === "returned" || state === "needs-changes" ? (
                  <RotateCcw />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className="cmp-approval-step-content">
                <div>
                  <strong>{role}</strong>
                  <span className="cmp-approval-step-state">
                    {workflowStateLabel(state)}
                  </span>
                </div>
                <p>{getRoleApproverName(request, role)}</p>
                {role === "MIC" ? (
                  <StaffWorkflowSubstate request={request} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StaffWorkflowSubstate({ request }: { request: CmpAcceptanceRequest }) {
  if (request.workflowVersion < 2) {
    return null;
  }
  if (request.draftCompletedAt) {
    return (
      <span className="cmp-staff-workflow-substate is-ready">
        <Check aria-hidden="true" />
        {request.draftCompletedBy?.name ??
          request.draftAssignee?.name ??
          "Staff"}
        {` ready ${formatDateTime(request.draftCompletedAt)}`}
      </span>
    );
  }
  if (request.draftAssignee) {
    return (
      <span className="cmp-staff-workflow-substate">
        <UserRound aria-hidden="true" />
        {request.draftAssignee.name} is editing
      </span>
    );
  }
  return (
    <span className="cmp-staff-workflow-substate">
      <UserRound aria-hidden="true" />
      Not delegated
    </span>
  );
}

function AcceptanceReturnBanner({
  request,
}: {
  request: CmpAcceptanceRequest;
}) {
  const returnedFromStep = getReturnedFromStep(request);
  return (
    <section className="cmp-acceptance-return-banner" aria-live="polite">
      <RotateCcw aria-hidden="true" />
      <div>
        <strong>Returned from {returnedFromStep ?? request.currentStep}</strong>
        <p>{request.returnReason}</p>
        {request.returnedAt ? (
          <span>{formatDateTime(request.returnedAt)}</span>
        ) : null}
      </div>
    </section>
  );
}

function ApprovalRoleSummary({ request }: { request: CmpAcceptanceRequest }) {
  return (
    <section className="cmp-approval-history-section">
      <div className="cmp-form-section-heading">
        <h4>Approval history</h4>
        <p>Latest effective result for each approval role.</p>
      </div>
      <div className="cmp-approval-role-grid">
        {APPROVAL_ROLES.map((role) => {
          const summary = getRoleSummary(request, role);
          return (
            <article key={role} className={`is-${summary.state}`}>
              <div className="cmp-approval-role-heading">
                <strong>{role}</strong>
                <span>{summary.label}</span>
              </div>
              <p>{summary.approver}</p>
              <dl>
                <div>
                  <dt>Latest action</dt>
                  <dd>{summary.time ? formatDateTime(summary.time) : "-"}</dd>
                </div>
                <div>
                  <dt>Comment</dt>
                  <dd>{summary.comment || "No comment"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getWorkflowStepState(
  request: CmpAcceptanceRequest,
  role: ApprovalRole
): WorkflowStepState {
  if (request.status === "APPROVED") {
    return "complete";
  }
  if (hasReturnedWorkflow(request)) {
    const returnedFromStep = getReturnedFromStep(request);
    if (role === "MIC") {
      return "needs-changes";
    }
    if (role === returnedFromStep) {
      return "returned";
    }
    if (role === "PIC" && request.picApprovedAt) {
      return "complete";
    }
    return "upcoming";
  }
  if (
    request.status === "DRAFT" ||
    request.status === "STAFF_EDITING" ||
    request.status === "PENDING_MIC"
  ) {
    return role === "MIC" ? "active" : "upcoming";
  }
  if (request.status === "PENDING_PIC") {
    if (role === "MIC") {
      return "complete";
    }
    return role === "PIC" ? "active" : "upcoming";
  }
  if (request.status === "PENDING_IT") {
    return role === "IT" ? "active" : "complete";
  }
  return "upcoming";
}

function hasReturnedWorkflow(request: CmpAcceptanceRequest) {
  return (
    request.status === "RETURNED" ||
    (request.status === "STAFF_EDITING" &&
      Boolean(request.returnReason || request.returnedAt))
  );
}

function getRoleSummary(request: CmpAcceptanceRequest, role: ApprovalRole) {
  const steps = request.approvalSteps
    .filter((step) => step.step === role)
    .sort(
      (left, right) =>
        approvalStepTimestamp(right) - approvalStepTimestamp(left)
    );
  const [latest] = steps;
  const state = getWorkflowStepState(request, role);
  const approvedStep = steps.find((step) => step.status === "APPROVED");
  const returnedStep = steps.find((step) => step.status === "RETURNED");

  if (role === "PIC" && request.picApprovedAt) {
    return {
      state: "complete" as const,
      label: "Approved",
      approver: getRoleApproverName(request, role),
      time: request.picApprovedAt,
      comment: approvedStep?.comment ?? null,
    };
  }
  if (state === "returned" || state === "needs-changes") {
    return {
      state,
      label: state === "returned" ? "Returned" : "Changes required",
      approver: getRoleApproverName(request, role),
      time: request.returnedAt ?? returnedStep?.actedAt ?? latest?.createdAt,
      comment: request.returnReason ?? returnedStep?.comment ?? null,
    };
  }
  const effectiveStep = state === "complete" ? approvedStep : latest;
  return {
    state,
    label: workflowStateLabel(state),
    approver: getRoleApproverName(request, role),
    time: effectiveStep?.actedAt ?? effectiveStep?.createdAt,
    comment: effectiveStep?.comment ?? null,
  };
}

function getReturnedFromStep(
  request: CmpAcceptanceRequest
): ApprovalRole | null {
  if (request.returnedFromStep && request.returnedFromStep !== "DONE") {
    return request.returnedFromStep;
  }
  const [latestReturnedStep] = request.approvalSteps
    .filter(
      (
        step
      ): step is (typeof request.approvalSteps)[number] & {
        step: ApprovalRole;
      } => step.status === "RETURNED" && step.step !== "DONE"
    )
    .sort(
      (left, right) =>
        approvalStepTimestamp(right) - approvalStepTimestamp(left)
    );
  return latestReturnedStep?.step ?? null;
}

function getRoleApproverName(
  request: CmpAcceptanceRequest,
  role: ApprovalRole
) {
  if (role === "MIC") {
    return request.micApprover.name;
  }
  if (role === "PIC") {
    return request.picApprover?.name ?? "Assigned on submit";
  }
  return request.itApprover?.name ?? "Assigned on submit";
}

function getCurrentResponsibility(request: CmpAcceptanceRequest) {
  if (request.status === "APPROVED") {
    return "Workflow complete";
  }
  if (request.status === "CANCELLED") {
    return "Request cancelled";
  }
  if (request.status === "RETURNED") {
    return `${request.micApprover.name} (MIC) - changes required`;
  }
  if (
    request.status === "STAFF_EDITING" &&
    request.draftAssignee &&
    !request.draftCompletedAt
  ) {
    return `${request.draftAssignee.name} - draft completion`;
  }
  if (request.currentStep === "PIC") {
    return `${request.picApprover?.name ?? "PIC"} - PIC approval`;
  }
  if (request.currentStep === "IT") {
    return `${request.itApprover?.name ?? "IT"} - final approval`;
  }
  return `${request.micApprover.name} - MIC review`;
}

function getDraftReadinessLabel(request: CmpAcceptanceRequest) {
  if (request.workflowVersion < 2) {
    return "Legacy workflow";
  }
  if (request.draftCompletedAt) {
    return `Ready since ${formatDateTime(request.draftCompletedAt)}`;
  }
  if (request.draftAssigneeId) {
    return "Staff is editing";
  }
  return `${getDraftControllerName(request)} is editing`;
}

function workflowStateLabel(state: WorkflowStepState) {
  if (state === "complete") {
    return "Completed";
  }
  if (state === "active") {
    return "In progress";
  }
  if (state === "returned") {
    return "Returned";
  }
  if (state === "needs-changes") {
    return "Changes required";
  }
  return "Not started";
}

function approvalStepTimestamp(
  step: CmpAcceptanceRequest["approvalSteps"][number]
) {
  return new Date(step.actedAt ?? step.createdAt).getTime();
}

function _ApproverSelect({
  label,
  value,
  users,
  onChange,
}: {
  label: string;
  value: string;
  users: DirectoryUser[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Select user</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} / {user.globalRole.replaceAll("_", " ")}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  error,
  validationField,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  validationField?: string;
}) {
  const field = validationField ?? label;
  const errorId = error ? validationErrorId(`acceptance-${field}`) : undefined;
  return (
    <label className={error ? "cmp-field-invalid" : undefined}>
      {required ? <RequiredLabel label={label} /> : label}
      <Input
        aria-label={label}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        data-validation-field={field}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="cmp-field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function RequiredLabel({ label }: { label: string }) {
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

function AcceptanceDraftAssignment({
  compact = false,
  assigneeId,
  users,
  isBusy,
  ownerLabel,
  onChange,
  onAssign,
}: {
  compact?: boolean;
  assigneeId: string;
  users: DirectoryUser[];
  isBusy?: boolean;
  ownerLabel: string;
  onChange: (assigneeId: string) => void;
  onAssign: () => void;
}) {
  const { dictionary } = useCmpI18n();
  const copy = dictionary.workspace;
  const assignee = users.find((user) => user.id === assigneeId);
  return (
    <section
      className={`cmp-draft-assignment-panel${compact ? " cmp-header-assignment-panel" : ""}`}
    >
      <div className="cmp-draft-assignment-copy">
        <span className="cmp-workflow-label">{copy.draftAssignment}</span>
        <strong>
          {assignee
            ? copy.staffWillCompleteDraft.replace("{staff}", assignee.name)
            : ownerLabel}
        </strong>
        <p>{copy.draftAssignmentDescription}</p>
      </div>
      <label>
        {copy.staffMember}
        <NativeSelect
          value={assigneeId}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{copy.selectStaff}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button
        type="button"
        className="cmp-secondary-button cmp-assignment-action"
        disabled={isBusy || !assigneeId}
        onClick={onAssign}
      >
        {copy.saveAndAssign}
      </Button>
    </section>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  error,
  validationField,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  validationField?: string;
}) {
  const field = validationField ?? label;
  const errorId = error ? validationErrorId(`acceptance-${field}`) : undefined;
  return (
    <label className={`cmp-field-span-2${error ? " cmp-field-invalid" : ""}`}>
      {label}
      <Textarea
        aria-label={label}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        data-validation-field={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className="cmp-field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function _CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="cmp-checkbox-row">
      <Input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function validateEngagementDraftPayload(
  payload: EngagementPayloadState
): EngagementPayloadErrors {
  const result = CmpAcceptanceEngagementDraftPayloadSchema.safeParse(
    buildEngagementPayload(payload)
  );
  if (result.success) {
    return {};
  }
  const errors = schemaIssuesToErrors<keyof EngagementPayloadErrors & string>(
    result.error.issues
  );
  if (
    result.error.issues.some((issue) => issue.path[0] === "feePlanningLines")
  ) {
    errors.feePlanningLines = "Check the budget rows before saving.";
  }
  return errors;
}

function validateEngagementFormalPayload(
  payload: EngagementPayloadState,
  _clients: CmpClient[]
): EngagementPayloadErrors {
  const budget = deriveFeePlanningBudget(
    payload.feePlanningLines,
    payload.agreedFee
  );
  const result = CreateCmpEngagementSchema.safeParse(
    buildEngagementFormalPayload(payload)
  );
  const errors: EngagementPayloadErrors = result.success
    ? {}
    : schemaIssuesToErrors<keyof EngagementPayloadErrors & string>(
        result.error.issues
      );
  if (
    !result.success &&
    result.error.issues.some((issue) => issue.path[0] === "feePlanningLines")
  ) {
    errors.feePlanningLines = "Complete or remove each budget row.";
  }
  if (!payload.clientId) {
    errors.clientId = "Client is required.";
  }
  if (!payload.engagementCode.trim()) {
    errors.engagementCode = "Engagement Code is required.";
  }
  if (!payload.serviceType) {
    errors.serviceType = "Service Type is required.";
  }
  if (
    payload.serviceType === "OTHERS" &&
    !payload.otherServiceDescription.trim()
  ) {
    errors.otherServiceDescription =
      "Expected Job / Engagement Type is required for Others.";
  }
  if (!isPositiveDecimal(budget.budgetedHours)) {
    errors.budgetedHours =
      "Add at least one complete budget row with hours greater than 0.";
  }
  if (!isNonNegativeDecimal(payload.agreedFee)) {
    errors.agreedFee = "Agreed Fee must be a non-negative amount.";
  }
  return errors;
}

function validateClientRequestForSubmission(form: AcceptanceFormState) {
  const payload = buildClientPayload(form.clientPayload);
  const result = CmpClientAcceptanceDraftPayloadSchema.safeParse(payload);
  return {
    ...(result.success ? {} : schemaIssuesToErrors(result.error.issues)),
    ...validateClientForm(form.clientPayload, { requiresRouting: true }),
  };
}

function isNonNegativeDecimal(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value.trim());
}

function isPositiveDecimal(value: string) {
  return isNonNegativeDecimal(value) && Number(value) > 0;
}

function buildAcceptancePayload(
  form: AcceptanceFormState
): CreateCmpAcceptanceRequestInput {
  return {
    draftName: optionalDraftName(form.draftName),
    type: form.type,
    targetClientId: optionalId(form.targetClientId),
    targetEngagementId: optionalId(form.targetEngagementId),
    micApproverId: optionalId(form.micApproverId),
    picApproverId: optionalId(form.picApproverId),
    itApproverId: optionalId(form.itApproverId),
    draftAssigneeId: optionalId(form.draftAssigneeId),
    clientPayload: isClientRequestType(form.type)
      ? buildClientPayload(form.clientPayload)
      : undefined,
    engagementPayload: isEngagementRequestType(form.type)
      ? buildEngagementPayload(form.engagementPayload)
      : undefined,
  };
}

function buildAcceptanceSubmissionPayload(
  form: AcceptanceFormState,
  action: AcceptanceFormAction,
  clientPayload?: CmpClientAcceptanceDraftPayload
): CreateCmpAcceptanceRequestInput {
  const payload = buildAcceptancePayload(form);
  return {
    ...payload,
    ...(clientPayload ? { clientPayload } : {}),
    draftAssigneeId:
      action === "assign" ? optionalId(form.draftAssigneeId) : undefined,
    submit: action === "submit",
  };
}

function buildAcceptanceUpdatePayload(
  payload: CreateCmpAcceptanceRequestInput
): UpdateCmpAcceptanceRequestInput {
  return {
    draftName: payload.submit ? undefined : payload.draftName,
    targetClientId: optionalId(payload.targetClientId),
    targetEngagementId: optionalId(payload.targetEngagementId),
    clientPayload: payload.clientPayload,
    engagementPayload: payload.engagementPayload,
    micApproverId: optionalId(payload.micApproverId),
    picApproverId: optionalId(payload.picApproverId),
    itApproverId: optionalId(payload.itApproverId),
    ...(payload.submit ? { submit: true } : {}),
    ...(payload.draftAssigneeId
      ? { draftAssigneeId: payload.draftAssigneeId }
      : {}),
  };
}

function optionalId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function optionalDraftName(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function buildEngagementPayload(
  form: EngagementPayloadState
): CmpAcceptanceEngagementDraftPayload {
  const budget = deriveFeePlanningBudget(form.feePlanningLines, form.agreedFee);
  return {
    ...form,
    budgetedHours: budget.budgetedHours,
    recoveryRate: budget.recoveryRate,
    serviceType: form.serviceType || undefined,
    otherServiceDescription:
      form.serviceType === "OTHERS"
        ? form.otherServiceDescription.trim()
        : undefined,
    deliverables: form.deliverables.map((item, index) => ({
      ...item,
      description: item.description?.trim() || undefined,
      sortOrder: index,
    })),
    feePlanningLines: feePlanningLinesForDraft(form.feePlanningLines),
    eqReviewerUserId: form.eqReviewerUserId || undefined,
    eqReviewer: form.eqReviewer.trim() || undefined,
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

function feeExchangeRateForAcceptance(
  form: Pick<
    EngagementPayloadState,
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

function buildEngagementFormalPayload(form: EngagementPayloadState) {
  return {
    ...buildEngagementPayload(form),
    feePlanningLines: feePlanningLinesForSubmission(form.feePlanningLines),
  };
}

function acceptanceEngagementRiskLabel(
  value: EngagementPayloadState["engagementRiskClassification"],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  return value === "GREATER_THAN_NORMAL"
    ? copy.engagementRiskGreaterThanNormal
    : copy.engagementRiskNormal;
}

function _acceptanceRequiredPeopleLabel(
  value: EngagementPayloadState["engagementRiskClassification"],
  copy: ReturnType<typeof useCmpI18n>["dictionary"]["workspace"]
) {
  return value === "GREATER_THAN_NORMAL"
    ? `${copy.pic}, ${copy.mic}, ${copy.eqReviewer}`
    : `${copy.pic}, ${copy.mic}`;
}

function formFromRequest(
  request: CmpAcceptanceRequest,
  fallbackClientId: string,
  clients: CmpClient[]
): AcceptanceFormState {
  const selectedMicApproverId =
    !request.submittedAt &&
    request.submittedBy.globalRole === "PARTNER" &&
    request.micApproverId === request.submittedById
      ? ""
      : request.micApproverId;
  const targetClient = request.targetClientId
    ? clients.find((client) => client.id === request.targetClientId)
    : undefined;
  return {
    draftName: request.draftName ?? getRequestTitle(request),
    type: request.type,
    targetClientId: request.targetClientId ?? undefined,
    targetEngagementId: request.targetEngagementId ?? undefined,
    micApproverId: selectedMicApproverId,
    picApproverId: request.picApproverId ?? "",
    itApproverId: request.itApproverId ?? "",
    draftAssigneeId: request.draftAssigneeId ?? "",
    clientPayload: request.clientPayload
      ? clientMasterFormFromPayload(
          request.clientPayload,
          {
            micApproverId: selectedMicApproverId,
            picApproverId: request.picApproverId ?? "",
            itApproverId: request.itApproverId ?? "",
          },
          targetClient
        )
      : EMPTY_CLIENT_PAYLOAD,
    engagementPayload: request.engagementPayload
      ? {
          ...EMPTY_ENGAGEMENT_PAYLOAD,
          ...request.engagementPayload,
          feePlanningLines: (
            request.engagementPayload.feePlanningLines ?? []
          ).map((line) => ({
            key: line.key,
            grade: line.grade ?? "",
            assignmentType: line.assignmentType ?? "",
            staffUserId: line.staffUserId ?? "",
            hourlyRate: line.hourlyRate ?? "",
            budgetHours: line.budgetHours ?? "",
            dateFrom: line.dateFrom ?? "",
            dateTo: line.dateTo ?? "",
          })),
        }
      : { ...EMPTY_ENGAGEMENT_PAYLOAD, clientId: fallbackClientId },
  };
}

function feePlanningLinesFromDraft(
  lines: CmpAcceptanceEngagementDraftPayload["feePlanningLines"]
): CmpFeePlanningFormLine[] {
  return (lines ?? []).map((line) => ({
    key: line.key,
    grade: line.grade ?? "",
    assignmentType: line.assignmentType ?? "",
    staffUserId: line.staffUserId ?? "",
    hourlyRate: line.hourlyRate ?? "",
    budgetHours: line.budgetHours ?? "",
    dateFrom: line.dateFrom ?? "",
    dateTo: line.dateTo ?? "",
  }));
}

function getRequestTitle(request: CmpAcceptanceRequest) {
  if (isClientRequestType(request.type)) {
    return (
      request.clientPayload?.nameEn ||
      request.clientPayload?.nameZh ||
      request.clientPayload?.clientCode ||
      "Untitled client"
    );
  }
  return request.engagementPayload?.engagementCode || "Untitled engagement";
}

function getRequestSubtitle(request: CmpAcceptanceRequest) {
  if (isClientRequestType(request.type)) {
    return request.clientPayload?.clientCode ?? "Client code pending";
  }
  return request.engagementPayload?.engagementCode ?? "Engagement code pending";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatMonth(value: unknown) {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return;
  }
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(Date.UTC(2020, month - 1, 1))
  );
}
