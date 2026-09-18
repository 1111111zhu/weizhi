"use client";

import type {
  CmpAcceptanceDraftListItem,
  CmpClient,
  CmpEngagement,
} from "@project-wing/shared";
import { Button } from "@project-wing/ui";
import { Eye, FilePenLine } from "lucide-react";
import type { ReactNode } from "react";

import { useCmpI18n } from "../i18n/client";
import { CmpFormDraftDeleteAction } from "./cmp-form-draft-delete-action";

const CLIENT_DRAFT_ROW_PREFIX = "cmp-client-draft:";
const ENGAGEMENT_DRAFT_ROW_PREFIX = "cmp-engagement-draft:";

export type CmpClientDraftRow = CmpClient & {
  readonly __cmpDraft: CmpAcceptanceDraftListItem;
};

export type CmpEngagementDraftRow = CmpEngagement & {
  readonly __cmpDraft: CmpAcceptanceDraftListItem;
};

export function toCmpClientDraftRow(
  draft: CmpAcceptanceDraftListItem
): CmpClientDraftRow {
  const payload = draft.request.clientPayload ?? {};
  return {
    id: `${CLIENT_DRAFT_ROW_PREFIX}${draft.request.id}`,
    clientCode: payload.clientCode || "-",
    companyCode: payload.companyCode || null,
    companyNumber: payload.companyNumber || null,
    nameZh: payload.nameZh || "",
    nameEn: payload.nameEn || null,
    groupId: payload.groupId || null,
    group: null,
    address: payload.address || payload.registeredAddress || null,
    contactPerson: payload.contactPerson || null,
    telephone: payload.telephone || null,
    email: payload.email || null,
    website: payload.website || null,
    yearEndDate: payload.yearEndDate || null,
    yearEndMonth: payload.yearEndMonth || null,
    hsicSectionCode: payload.hsicSectionCode || null,
    industryOtherDescription: payload.industryOtherDescription || null,
    placeOfIncorporation: payload.placeOfIncorporation || null,
    listedOrPrivate: payload.listedOrPrivate || null,
    isSubsidiary: Boolean(payload.isSubsidiary),
    parentClientCode: payload.parentClientCode || null,
    subsidiariesOrAssociates: payload.subsidiariesOrAssociates || null,
    clientPartnerPic: payload.clientPartnerPic || null,
    clientManagerMic: payload.clientManagerMic || null,
    serviceType: payload.serviceType || null,
    serviceLines: payload.serviceLines || null,
    status: "DRAFT",
    approvalReferenceNumber: null,
    approvalDate: null,
    preparedBy: null,
    approvedBy: null,
    micApproval: null,
    picApproval: null,
    itAdmin: null,
    signOffDate: null,
    createdAt: draft.request.createdAt,
    updatedAt: draft.request.updatedAt,
    __cmpDraft: draft,
  } as unknown as CmpClientDraftRow;
}

export function toCmpEngagementDraftRow(
  draft: CmpAcceptanceDraftListItem,
  clients: CmpClient[]
): CmpEngagementDraftRow {
  const payload = draft.request.engagementPayload ?? {};
  const client = clients.find((item) => item.id === payload.clientId);
  return {
    id: `${ENGAGEMENT_DRAFT_ROW_PREFIX}${draft.request.id}`,
    clientId: payload.clientId || "",
    client: {
      id: client?.id || payload.clientId || "",
      clientCode: client?.clientCode || "-",
      nameZh: client?.nameZh || "",
      nameEn: client?.nameEn || null,
      status: client?.status || "ACTIVE",
    },
    engagementCode: payload.engagementCode || "-",
    serviceType: (payload.serviceType ||
      "OTHERS") as CmpEngagement["serviceType"],
    otherServiceDescription: payload.otherServiceDescription || null,
    deliverables: payload.deliverables || [],
    yearEndDate: payload.yearEndDate || null,
    reportDate: payload.reportDate || null,
    approvalReferenceNumber: payload.approvalReferenceNumber || null,
    engagementDate: payload.engagementDate || null,
    budgetedHours: payload.budgetedHours || "0",
    agreedFee: payload.agreedFee || "0",
    recoveryRate: payload.recoveryRate || null,
    feePlanningLines: [],
    feeCurrency: payload.feeCurrency || "HKD",
    amlRiskClassification: payload.amlRiskClassification || "NOT_HIGH",
    engagementRiskClassification:
      payload.engagementRiskClassification || "NORMAL",
    picUserId: payload.picUserId || null,
    micUserId: payload.micUserId || null,
    eqReviewerUserId: payload.eqReviewerUserId || null,
    pic: payload.pic || null,
    mic: payload.mic || null,
    eqReviewer: payload.eqReviewer || null,
    status: "DRAFT",
    remarks: payload.remarks || null,
    createdById: draft.request.submittedById,
    createdAt: draft.request.createdAt,
    updatedAt: draft.request.updatedAt,
    codeAliases: [],
    __cmpDraft: draft,
  } as unknown as CmpEngagementDraftRow;
}

export function isCmpClientDraftRow(
  value: CmpClient
): value is CmpClientDraftRow {
  return "__cmpDraft" in value;
}

export function isCmpEngagementDraftRow(
  value: CmpEngagement
): value is CmpEngagementDraftRow {
  return "__cmpDraft" in value;
}

export function getCmpMasterDraftHref(
  draft: CmpAcceptanceDraftListItem,
  returnTo: string,
  localizedPath: (path: string) => string
) {
  return localizedPath(
    draft.canEdit
      ? `/acceptance/requests/${encodeURIComponent(draft.request.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`
      : `/acceptance?tab=requests&requestId=${encodeURIComponent(draft.request.id)}`
  );
}

export function CmpMasterDraftRowMeta({
  draft,
}: {
  draft: CmpAcceptanceDraftListItem;
}) {
  const { dictionary, locale } = useCmpI18n();
  const labels =
    locale === "zh-CN"
      ? { request: "申请编号", updated: "最后更新" }
      : { request: "Request no.", updated: "Last updated" };
  const owner = draft.currentOwner.name || draft.currentOwner.email;
  const draftName = resolveCmpDraftDisplayName(draft);
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      <span className="font-medium text-amber-700 dark:text-amber-300">
        {locale === "zh-CN" ? "草稿" : "Draft"}: {draftName}
      </span>
      <br />
      {labels.request}: {draft.request.requestNo} ·{" "}
      {dictionary.workspace.currentOwner}: {owner}
      <span className="hidden xl:inline">
        {" "}
        · {labels.updated}: {formatDraftTime(draft.request.updatedAt, locale)}
      </span>
    </span>
  );
}

export function resolveCmpDraftDisplayName(draft: CmpAcceptanceDraftListItem) {
  const namedDraft = draft.request.draftName?.trim();
  if (namedDraft) {
    return namedDraft;
  }

  const { clientPayload } = draft.request;
  const { engagementPayload } = draft.request;
  return (
    clientPayload?.nameEn?.trim() ||
    clientPayload?.nameZh?.trim() ||
    clientPayload?.clientCode?.trim() ||
    engagementPayload?.engagementCode?.trim() ||
    draft.request.requestNo
  );
}

export function CmpMasterDraftLink({
  children,
  draft,
  returnTo,
}: {
  children: ReactNode;
  draft: CmpAcceptanceDraftListItem;
  returnTo: string;
}) {
  const { dictionary, locale, localizedPath } = useCmpI18n();
  const continueEditing = locale === "zh-CN" ? "继续编辑" : "Continue editing";
  const actionLabel = draft.canEdit
    ? continueEditing
    : dictionary.workspace.view;
  const href = getCmpMasterDraftHref(draft, returnTo, localizedPath);
  const label = `${actionLabel}: ${draft.request.requestNo}`;

  return (
    <a
      aria-label={label}
      className="block min-w-0 rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      href={href}
      onClick={(event) => event.stopPropagation()}
      title={label}
    >
      {children}
    </a>
  );
}

export function CmpMasterDraftActions({
  draft,
  returnTo,
  handleDeleteDraft,
}: {
  draft: CmpAcceptanceDraftListItem;
  returnTo: string;
  handleDeleteDraft?: (id: string) => Promise<unknown>;
}) {
  const { dictionary, locale, localizedPath } = useCmpI18n();
  const copy = dictionary.workspace;
  const continueEditing = locale === "zh-CN" ? "继续编辑" : "Continue editing";
  const href = getCmpMasterDraftHref(draft, returnTo, localizedPath);
  return (
    <div className="flex items-center gap-1">
      <a
        aria-label={draft.canEdit ? continueEditing : copy.view}
        className="inline-flex size-8 items-center justify-center rounded-md text-secondary-foreground/80 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        href={href}
        onClick={(event) => event.stopPropagation()}
        title={draft.canEdit ? continueEditing : copy.view}
      >
        {draft.canEdit ? (
          <FilePenLine aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </a>
      {draft.canDelete && handleDeleteDraft ? (
        <CmpFormDraftDeleteAction
          copy={{
            cancel: copy.cancel,
            delete: copy.delete,
            deleteDraft: copy.deleteDraft,
            deleteDraftDescription: copy.deleteDraftDescription,
            deleteDraftTitle: copy.deleteDraftTitle,
            deletingDraft: copy.deletingDraft,
          }}
          onDelete={() => handleDeleteDraft(draft.request.id)}
        />
      ) : null}
    </div>
  );
}

export function CmpShowDraftsButton({
  count,
  onPressedChange,
  pressed,
}: {
  count: number;
  onPressedChange: (next: boolean) => void;
  pressed: boolean;
}) {
  const { locale } = useCmpI18n();
  const label = pressed
    ? locale === "zh-CN"
      ? "返回主表"
      : "Back to records"
    : locale === "zh-CN"
      ? "显示草稿"
      : "Show drafts";
  return (
    <Button
      aria-pressed={pressed}
      className="h-8 gap-1.5 rounded-md px-2.5 text-[0.8rem]! font-semibold! whitespace-nowrap"
      size="sm"
      variant={pressed ? "secondary" : "outline"}
      onClick={() => onPressedChange(!pressed)}
    >
      <FilePenLine aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
      {!pressed ? (
        <span className="rounded-sm bg-amber-400/20 px-1 text-[0.7rem] text-amber-900 dark:text-amber-200">
          {count}
        </span>
      ) : null}
    </Button>
  );
}

function formatDraftTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
