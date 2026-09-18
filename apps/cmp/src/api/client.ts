import type {
  CmpAcceptanceActionInput,
  CmpAcceptanceDraftAssignmentInput,
  CmpAcceptanceDraftListType,
  CmpAcceptanceDraftsResponse,
  CmpAcceptanceRequest,
  CmpAcceptanceRequestsResponse,
  CmpAcceptanceReturnInput,
  CmpAmlHit,
  CmpAmlConfigurationStatus,
  CmpAmlHitReviewInput,
  CmpAmlLatestResponse,
  CmpAmlRunInput,
  CmpBudgetExchangeRatesResponse,
  CmpSettingsExchangeRatesResponse,
  CmpClientGroupStructure,
  CmpClientGroupsResponse,
  CmpClientVersionDetail,
  CmpClientVersionListQuery,
  CmpClientVersionsResponse,
  CmpClientsResponse,
  CmpDashboardSummary,
  CmpEngagement,
  CmpEngagementArchiveDraft,
  CmpEngagementArchiveDraftSaveInput,
  CmpEngagementArchiveFinalizeInput,
  CmpEngagementArchiveMemberCost,
  CmpEngagementArchivePayload,
  CmpEngagementArchiveReadinessCheck,
  CmpEngagementArchiveReturnInput,
  CmpEngagementArchiveReview,
  CmpEngagementArchiveSnapshot,
  CmpEngagementArchiveSubmitInput,
  CmpEngagementArchivesResponse,
  CmpEngagementArchiveTotals,
  CmpEngagementFeeNoteResponse,
  CmpEngagementFeeNotesResponse,
  CmpEngagementFeeNoteUpdateInput,
  CreateCmpEngagementFeeNoteInput,
  TmsTimesheetQueryResponse,
  CmpEngagementsResponse,
  CmpBilling,
  CmpBillingBankTemplate,
  CmpBudgetCurrency,
  CmpBillingClientPaymentClaimInput,
  CmpBillingDefaultsResponse,
  CmpBillingExpectedVersion,
  CmpBillingFinanceReceiptInput,
  CmpBillingFirmTemplate,
  CmpBillingImportOptionsResponse,
  CmpBillingInvoiceInput,
  CmpBillingListQuery,
  CmpBillingListResponse,
  CmpBillingMarkSentInput,
  CmpBillingReconcileInput,
  CmpBillingReturnInput,
  CmpBillingTemplateListResponse,
  CmpBillingTemplateVersionInput,
  CmpFeeNoteLocale,
  CreateCmpBillingBankTemplateInput,
  CreateCmpBillingFirmTemplateInput,
  CreateCmpBillingInput,
  CreateCmpAcceptanceRequestInput,
  CreateCmpClientGroupInput,
  CreateCmpEngagementInput,
  GlobalRole,
  InboxContentKey,
  InboxContentParameter,
  LinkProjectEngagementInput,
  TmsEngagementDirectoryItem,
  TmsEngagementDirectoryResponse,
  TmsEngagementSummary,
  TmsProjectLink,
  TmsProjectLinkQuery,
  TmsProjectLinksResponse,
  UpdateCmpAcceptanceRequestInput,
  UpdateCmpBillingInput,
  UpdateCmpBillingBankTemplateInput,
  UpdateCmpBillingFirmTemplateInput,
  UpdateCmpClientGroupInput,
  UpdateCmpEngagementInput,
  UpdateCmpBudgetExchangeRateFallbackInput,
  WorkItemListResponse,
} from "@project-wing/shared";
import {
  CMP_BUDGET_CURRENCIES,
  EMAIL_SIGN_IN_OTP_MOCK_CODE,
  EmailOtpClientError,
  getCmpFixedBudgetExchangeRate,
  requestEmailPasswordResetOtp,
  requestEmailSignInOtp,
  resetPasswordWithEmailOtp,
  signInWithBetterAuth,
  signInWithEmailOtp,
  signOutWithBetterAuth,
  verifyEmailPasswordResetOtp,
} from "@project-wing/shared";
import type { CmpClientProfile } from "@project-wing/shared/cmp-client-profile";
import type {
  CmpClientGraph,
  CmpCompanyIdentityMatchResponse,
  CmpEntityRelationshipsResponse,
  CmpGroupRelationshipsResponse,
  CmpRelatedEntitiesResponse,
  CreateCmpEntityRelationshipInput,
  CreateCmpGroupRelationshipInput,
  CreateCmpRelatedEntityInput,
  UpdateCmpEntityRelationshipInput,
  UpdateCmpGroupRelationshipInput,
  UpdateCmpRelatedEntityInput,
} from "@project-wing/shared/cmp-entity-graph";
import {
  CmpClientGraphSchema,
  CmpEntityRelationshipsResponseSchema,
  CmpGroupRelationshipsResponseSchema,
} from "@project-wing/shared/cmp-entity-graph";
import type {
  AttachCmpEntityMapDraftInput,
  BindCmpEntityMapNodeClientInput,
  CmpEntityMap,
  CmpEntityMapClientCandidates,
  CreateCmpEntityMapEdgeInput,
  CreateCmpEntityMapInput,
  CreateCmpEntityMapNodeInput,
  UpdateCmpEntityMapEdgeInput,
  UpdateCmpEntityMapNodeInput,
} from "@project-wing/shared/cmp-entity-maps";
import type {
  CmpRecordPreviewDocument,
  CmpRecordPreviewLocale,
} from "@project-wing/shared/cmp-record-preview";

import {
  emptyPreviewTmsSummary,
  previewAcceptanceRequests,
  previewArchiveMemberCosts as previewArchiveMemberCostFixture,
  previewClients,
  previewEngagements,
  previewGroups,
  previewTmsEngagementSummaries,
  previewUsers,
} from "./preview-data";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? API_BASE_URL;
const PREVIEW_SESSION_KEY = "project-wing-cmp-preview-user";
let previewAcceptanceDraftSequence = 0;
const previewAcceptanceDrafts = new Map<string, CmpAcceptanceRequest>();
const previewAmlByAcceptance = new Map<string, CmpAmlLatestResponse>();
let previewAmlConfiguration: CmpAmlConfigurationStatus = {
  enabled: false,
  configured: false,
  source: null,
  updatedAt: null,
  updatedBy: null,
};
const previewEngagementFeeNotes = new Map<
  string,
  CmpEngagementFeeNoteResponse["note"]
>();

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  preferredLocale?: "zh-CN" | "en-US";
  cmpCurrencyOrder?: CmpBudgetCurrency[];
  declarationAccepted?: boolean;
  declarationAcceptedAt?: string | null;
};

export type DirectoryUser = CurrentUser & { status?: string };

export type CmpClientSearchDocumentCategory = "AML_SEARCH" | "COMPANY_SEARCH";

export type CmpClientSearchDocument = {
  id: string;
  clientId: string;
  category: CmpClientSearchDocumentCategory;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

export type InboxMessage = {
  id: string;
  recipientId: string;
  senderId: string | null;
  type: string;
  title: string;
  body: string;
  contentKey?: InboxContentKey | null;
  contentParams?: Record<string, InboxContentParameter> | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const previewUser: CurrentUser = {
  id: "preview-partner",
  email: "partner@projectwing.local",
  name: "Partner",
  globalRole: "PARTNER",
};
const previewDashboard: CmpDashboardSummary = {
  draftsAssignedToMe: 0,
  approvalsAssignedToMe: 0,
  returnedRequests: 0,
  myClients: 0,
  myEngagements: 0,
  recentChanges: [],
  recentApprovals: [],
};

let previewInboxMessages: InboxMessage[] = [
  {
    id: "preview-message-pic",
    recipientId: previewUser.id,
    senderId: "preview-mic",
    type: "SYSTEM_NOTIFICATION",
    title: "CA-PREVIEW-0043 has entered PIC approval",
    body: "Leo Li submitted Orchid Technology Limited for partner review. The current approval step is PIC.",
    contentKey: "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
    contentParams: {
      requestNo: "CA-PREVIEW-0043",
      actor: "Leo Li",
      acceptanceType: "CLIENT",
      subject: "Orchid Technology Limited",
      step: "PIC",
    },
    actionUrl: "/cmp/acceptance?requestId=preview-ca-orchid",
    readAt: null,
    createdAt: "2026-08-25T11:28:00.000Z",
  },
  {
    id: "preview-message-submitted",
    recipientId: previewUser.id,
    senderId: "preview-staff",
    type: "SYSTEM_NOTIFICATION",
    title: "EA-PREVIEW-0038 was submitted successfully",
    body: "Orchid 2027 annual audit is waiting for MIC approval.",
    contentKey: "CMP_ACCEPTANCE_SUBMITTED",
    contentParams: {
      requestNo: "EA-PREVIEW-0038",
      acceptanceType: "ENGAGEMENT",
      subject: "Orchid 2027 annual audit",
    },
    actionUrl: "/cmp/acceptance?requestId=preview-ea-orchid",
    readAt: null,
    createdAt: "2026-08-24T09:42:00.000Z",
  },
  {
    id: "preview-message-returned",
    recipientId: previewUser.id,
    senderId: "preview-partner",
    type: "SYSTEM_NOTIFICATION",
    title: "CC-PREVIEW-0019 was returned for revision",
    body: "Please update the contact information and risk assessment before resubmitting Harbour Retail Limited.",
    contentKey: "CMP_ACCEPTANCE_RETURNED",
    contentParams: {
      requestNo: "CC-PREVIEW-0019",
      actor: "Jony Ma",
      acceptanceType: "CLIENT_CHANGE",
      subject: "Harbour Retail Limited",
      reason: "Update the contact information and risk assessment.",
    },
    actionUrl: "/cmp/acceptance?requestId=preview-cc-harbour",
    readAt: null,
    createdAt: "2026-08-22T15:15:00.000Z",
  },
  {
    id: "preview-message-approved",
    recipientId: previewUser.id,
    senderId: "preview-partner",
    type: "SYSTEM_NOTIFICATION",
    title: "EC-PREVIEW-0014 was approved",
    body: "Workshop 2026 annual audit has completed the acceptance workflow.",
    contentKey: "CMP_ACCEPTANCE_APPROVED",
    contentParams: {
      requestNo: "EC-PREVIEW-0014",
      actor: "Jony Ma",
      acceptanceType: "ENGAGEMENT_CHANGE",
      subject: "Workshop 2026 annual audit",
    },
    actionUrl: "/cmp/acceptance?requestId=preview-ec-workshop",
    readAt: "2026-08-20T08:30:00.000Z",
    createdAt: "2026-08-20T08:20:00.000Z",
  },
  {
    id: "preview-message-archive",
    recipientId: previewUser.id,
    senderId: null,
    type: "SYSTEM_NOTIFICATION",
    title: "Client master record synchronized",
    body: "The approved changes for CMP E2E Approval 20260716 2322 are now visible in the client directory.",
    actionUrl: "/cmp/clients",
    readAt: "2026-08-14T12:05:00.000Z",
    createdAt: "2026-08-14T11:58:00.000Z",
  },
];

const selectedApi = {
  async login(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) {
    if (isMockMode()) {
      return previewLogin(input.email);
    }
    await signInWithBetterAuth({
      baseURL: AUTH_BASE_URL,
      email: input.email,
      password: input.password,
      rememberMe: input.rememberMe,
    });
    return request<CurrentUser>("/account/me");
  },
  async requestLoginOtp(email: string, _mutationContext?: unknown) {
    if (isMockMode()) {
      return { demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as {
        demoCode?: string;
      };
    }
    await requestEmailSignInOtp({ baseURL: AUTH_BASE_URL, email });
    return {} as { demoCode?: string };
  },
  async listDevelopmentAccounts() {
    if (isMockMode()) {
      return previewUsers.map(({ email, globalRole, name }) => ({
        email,
        name,
        role: globalRole,
      }));
    }
    const response = await fetch(`${AUTH_BASE_URL}/auth/development/accounts`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new ApiError(
        response.status,
        "Unable to load development accounts"
      );
    }
    const body = (await response.json()) as {
      accounts: { email: string; name: string; globalRole: GlobalRole }[];
    };
    return body.accounts.map(({ email, name, globalRole }) => ({
      email,
      name,
      role: globalRole,
    }));
  },
  async impersonateDevelopmentAccount(email: string) {
    if (isMockMode()) {
      return previewLogin(email);
    }
    const response = await fetch(
      `${AUTH_BASE_URL}/auth/development/impersonate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );
    if (!response.ok) {
      throw new ApiError(response.status, "Unable to impersonate account");
    }
    return request<CurrentUser>("/account/me");
  },
  async loginWithOtp(
    input: { email: string; otp: string },
    _mutationContext?: unknown
  ) {
    if (isMockMode()) {
      if (input.otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
        throw new EmailOtpClientError("OTP_INVALID", 400);
      }
      return previewLogin(input.email);
    }
    await signInWithEmailOtp({
      baseURL: AUTH_BASE_URL,
      email: input.email,
      otp: input.otp,
    });
    return request<CurrentUser>("/account/me");
  },
  async requestPasswordResetOtp(email: string) {
    if (isMockMode()) {
      return { demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as { demoCode?: string };
    }
    await requestEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, email });
    return {} as { demoCode?: string };
  },
  async resetPasswordWithOtp(input: {
    email: string;
    otp: string;
    password: string;
  }) {
    if (isMockMode()) {
      if (input.otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
        throw new EmailOtpClientError("OTP_INVALID", 400);
      }
      return;
    }
    await resetPasswordWithEmailOtp({ baseURL: AUTH_BASE_URL, ...input });
  },
  async verifyPasswordResetOtp(input: { email: string; otp: string }) {
    if (isMockMode()) {
      if (input.otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
        throw new EmailOtpClientError("OTP_INVALID", 400);
      }
      return;
    }
    await verifyEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, ...input });
  },
  signOut() {
    if (isMockMode()) {
      clearPreviewSession();
      return Promise.resolve();
    }
    return signOutWithBetterAuth(AUTH_BASE_URL);
  },
  me() {
    if (isMockMode()) {
      return Promise.resolve(previewSessionUser());
    }
    return request<CurrentUser>("/account/me");
  },
  updatePreferredLocale(preferredLocale: "zh-CN" | "en-US") {
    if (isMockMode()) {
      previewUser.preferredLocale = preferredLocale;
      return Promise.resolve({ ...previewUser });
    }
    return request<CurrentUser>("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify({ preferredLocale }),
      keepalive: true,
    });
  },
  updateCmpCurrencyOrder(cmpCurrencyOrder: CmpBudgetCurrency[]) {
    if (isMockMode()) {
      previewUser.cmpCurrencyOrder = cmpCurrencyOrder;
      return Promise.resolve({ ...previewUser });
    }
    return request<CurrentUser>("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify({ cmpCurrencyOrder }),
      keepalive: true,
    });
  },
  cmpDashboard() {
    if (isMockMode()) {
      return Promise.resolve(previewDashboard);
    }
    return request<CmpDashboardSummary>("/cmp/dashboard");
  },
  inboxMessages() {
    if (isMockMode()) {
      return Promise.resolve(
        previewInboxMessages.map((message) => ({ ...message }))
      );
    }
    return request<InboxMessage[]>("/cmp/inbox/messages");
  },
  workItems(locale: "zh-CN" | "en-US" = "zh-CN") {
    if (isMockMode()) {
      const now = new Date().toISOString();
      return Promise.resolve({
        items: [
          {
            id: "CMP-004:preview",
            ruleId: "CMP-004",
            domain: "CMP",
            view: "PERSONAL",
            category: "ACCEPTANCE",
            state: "OPEN",
            severity: "ACTION_REQUIRED",
            priority: "HIGH",
            title:
              locale === "zh-CN"
                ? "审批承接申请（Orchid Technology Limited，CA-PREVIEW-0043）"
                : "Approve acceptance request (Orchid Technology Limited, CA-PREVIEW-0043)",
            description:
              locale === "zh-CN"
                ? "该申请正在等待你的 PIC 审批。"
                : "This request is waiting for your approval as PIC.",
            subjectType: "CMP_ACCEPTANCE",
            subjectId: "preview-ca-orchid",
            project: null,
            reference: "CA-PREVIEW-0043",
            objectLabel: "Orchid Technology Limited",
            responsibleLabel: previewUser.name,
            assignedTo: {
              id: previewUser.id,
              name: previewUser.name,
              email: previewUser.email,
            },
            createdBy: null,
            dueAt: null,
            openedAt: now,
            updatedAt: now,
            actionTarget: {
              app: "CMP",
              resourceType: "CMP_ACCEPTANCE",
              resourceId: "preview-ca-orchid",
              params: { requestId: "preview-ca-orchid" },
            },
          },
        ],
        categories: [
          {
            category: "ACCEPTANCE",
            label: locale === "zh-CN" ? "承接审批" : "Acceptance",
            total: 1,
            blockers: 0,
            earliestOpenedAt: now,
          },
        ],
        counts: { total: 1, EMP: 0, PROJECT: 0, CMP: 1, TMS: 0, OPS: 0 },
      } satisfies WorkItemListResponse);
    }
    return request<WorkItemListResponse>(
      `/work-items?view=PERSONAL&scope=CMP&locale=${locale}`
    );
  },
  markInboxMessageRead(messageId: string) {
    if (isMockMode()) {
      const message = previewInboxMessages.find(
        (item) => item.id === messageId
      );
      if (!message) {
        return Promise.reject(new ApiError(404, "Preview message not found"));
      }
      const updated = {
        ...message,
        readAt: message.readAt ?? new Date().toISOString(),
      };
      previewInboxMessages = previewInboxMessages.map((item) =>
        item.id === messageId ? updated : item
      );
      return Promise.resolve(updated);
    }
    return request<InboxMessage>(`/cmp/inbox/messages/${messageId}/read`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  markInboxMessageUnread(messageId: string) {
    if (isMockMode()) {
      const message = previewInboxMessages.find(
        (item) => item.id === messageId
      );
      if (!message) {
        return Promise.reject(new ApiError(404, "Preview message not found"));
      }
      const updated = { ...message, readAt: null };
      previewInboxMessages = previewInboxMessages.map((item) =>
        item.id === messageId ? updated : item
      );
      return Promise.resolve(updated);
    }
    return request<InboxMessage>(`/cmp/inbox/messages/${messageId}/unread`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  userDirectory() {
    if (isMockMode()) {
      return Promise.resolve(previewUsers);
    }
    return request<DirectoryUser[]>("/users/directory");
  },
  cmpUsers() {
    if (isMockMode()) {
      return Promise.resolve(previewUsers);
    }
    return request<DirectoryUser[]>("/cmp/users");
  },
  cmpBudgetExchangeRates() {
    if (isMockMode()) {
      return Promise.resolve({
        rates: CMP_BUDGET_CURRENCIES.map((currency) =>
          getCmpFixedBudgetExchangeRate(currency)
        ),
      });
    }
    return request<CmpBudgetExchangeRatesResponse>(
      "/cmp/budget/exchange-rates"
    );
  },
  cmpSettingsExchangeRates() {
    if (isMockMode()) {
      const rates = CMP_BUDGET_CURRENCIES.map((currency) =>
        getCmpFixedBudgetExchangeRate(currency)
      );
      return Promise.resolve({
        batch: {
          id: "CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED",
          baseCurrency: "HKD" as const,
          provider: "LEGACY_FIXED" as const,
          sourceDate: "2026-07-31",
          sourceUrl: "SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07",
          fetchedAt: "2026-08-01T00:00:00.000Z",
          refreshedBy: null,
          stale: true,
        },
        rates,
        canRefresh: false,
        canMaintainFallback: false,
      } satisfies CmpSettingsExchangeRatesResponse);
    }
    return request<CmpSettingsExchangeRatesResponse>(
      "/cmp/settings/exchange-rates"
    );
  },
  refreshCmpSettingsExchangeRates() {
    if (isMockMode()) {
      const rates = CMP_BUDGET_CURRENCIES.map((currency) =>
        getCmpFixedBudgetExchangeRate(currency)
      );
      return Promise.resolve({
        batch: {
          id: "CMP-EXCHANGE-RATE-BATCH-LEGACY-FIXED",
          baseCurrency: "HKD" as const,
          provider: "LEGACY_FIXED" as const,
          sourceDate: "2026-07-31",
          sourceUrl: "SYSTEM_FIXED_HKMA_AVERAGE_2025_08_2026_07",
          fetchedAt: "2026-08-01T00:00:00.000Z",
          refreshedBy: null,
          stale: true,
        },
        rates,
        canRefresh: false,
        canMaintainFallback: false,
      } satisfies CmpSettingsExchangeRatesResponse);
    }
    return request<CmpSettingsExchangeRatesResponse>(
      "/cmp/settings/exchange-rates/refresh",
      { method: "POST", body: JSON.stringify({}) }
    );
  },
  updateCmpSettingsExchangeRateFallback(
    input: UpdateCmpBudgetExchangeRateFallbackInput
  ) {
    if (isMockMode()) {
      return api.cmpSettingsExchangeRates();
    }
    return request<CmpSettingsExchangeRatesResponse>(
      "/cmp/settings/exchange-rates/fallback",
      { method: "PUT", body: JSON.stringify(input) }
    );
  },
  cmpAcceptance(
    query: {
      q?: string;
      type?: string;
      status?: string;
      currentStep?: string;
      targetEngagementId?: string;
    } = {}
  ) {
    if (isMockMode()) {
      const normalizedQuery = query.q?.trim().toLowerCase();
      return Promise.resolve({
        requests: [
          ...previewAcceptanceDrafts.values(),
          ...previewAcceptanceRequests,
        ].filter((item) => {
          if (query.type && item.type !== query.type) {
            return false;
          }
          if (query.status && item.status !== query.status) {
            return false;
          }
          if (query.currentStep && item.currentStep !== query.currentStep) {
            return false;
          }
          if (!normalizedQuery) {
            return true;
          }
          return [
            item.requestNo,
            item.clientPayload?.nameEn,
            item.clientPayload?.nameZh,
            item.engagementPayload?.engagementCode,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));
        }),
      });
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CmpAcceptanceRequestsResponse>(`/cmp/acceptance${suffix}`);
  },
  cmpAcceptanceDrafts(type: CmpAcceptanceDraftListType) {
    if (isMockMode()) {
      return Promise.resolve({
        drafts: [...previewAcceptanceDrafts.values()]
          .filter(
            (item) =>
              item.type === type &&
              ["DRAFT", "STAFF_EDITING", "RETURNED"].includes(item.status)
          )
          .map((draft) => {
            const isActiveAssignee =
              draft.status === "STAFF_EDITING" &&
              draft.draftAssignee !== null &&
              draft.draftCompletedAt === null;
            return {
              request: draft,
              displayStatus: "DRAFT" as const,
              currentOwner: isActiveAssignee
                ? (draft.draftAssignee ?? draft.submittedBy)
                : draft.submittedAt
                  ? draft.micApprover
                  : draft.submittedBy,
              canEdit: true,
              canDelete: draft.status === "DRAFT" && draft.submittedAt === null,
            };
          }),
      });
    }
    return request<CmpAcceptanceDraftsResponse>(
      `/cmp/acceptance/drafts?type=${encodeURIComponent(type)}`
    );
  },
  cmpApprovals() {
    if (isMockMode()) {
      return Promise.resolve({
        requests: previewAcceptanceRequests.filter(
          (item) => item.status !== "DRAFT" && item.status !== "APPROVED"
        ),
      });
    }
    return request<CmpAcceptanceRequestsResponse>("/cmp/approvals");
  },
  createCmpAcceptance(input: CreateCmpAcceptanceRequestInput) {
    if (isMockMode()) {
      const draft = createPreviewAcceptance(input);
      previewAcceptanceDrafts.set(draft.id, draft);
      return Promise.resolve(draft);
    }
    return request<CmpAcceptanceRequest>("/cmp/acceptance", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpAcceptance(id: string, input: UpdateCmpAcceptanceRequestInput) {
    if (isMockMode()) {
      const existing = previewAcceptanceDrafts.get(id);
      if (!existing) {
        return Promise.reject(new ApiError(404, "Acceptance draft not found"));
      }
      const updated = updatePreviewAcceptance(existing, input);
      previewAcceptanceDrafts.set(id, updated);
      return Promise.resolve(updated);
    }
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteCmpAcceptance(id: string) {
    if (isMockMode()) {
      if (!previewAcceptanceDrafts.delete(id)) {
        return Promise.reject(new ApiError(404, "Acceptance draft not found"));
      }
      return Promise.resolve({ id });
    }
    return request<{ id: string }>(`/cmp/acceptance/${id}`, {
      method: "DELETE",
    });
  },
  cmpAmlConfiguration() {
    if (isMockMode()) {
      return Promise.resolve({ ...previewAmlConfiguration });
    }
    return request<CmpAmlConfigurationStatus>("/cmp/settings/aml");
  },
  updateCmpAmlConfiguration(apiKey: string) {
    if (isMockMode()) {
      const currentUser = previewSessionUser() ?? previewUser;
      const normalizedApiKey = apiKey.trim();
      if (currentUser.globalRole !== "SUPER_ADMIN") {
        return Promise.reject(
          new ApiError(
            403,
            "Super Admin is required to manage AML configuration"
          )
        );
      }
      if (!normalizedApiKey || normalizedApiKey.length > 4096) {
        return Promise.reject(new ApiError(400, "AML API key is required"));
      }
      previewAmlConfiguration = {
        enabled: true,
        configured: true,
        source: "DATABASE",
        updatedAt: new Date().toISOString(),
        updatedBy: { id: currentUser.id, name: currentUser.name },
      };
      return Promise.resolve({ ...previewAmlConfiguration });
    }
    return request<CmpAmlConfigurationStatus>("/cmp/settings/aml", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    });
  },
  disableCmpAmlConfiguration() {
    if (isMockMode()) {
      const currentUser = previewSessionUser() ?? previewUser;
      if (currentUser.globalRole !== "SUPER_ADMIN") {
        return Promise.reject(
          new ApiError(
            403,
            "Super Admin is required to manage AML configuration"
          )
        );
      }
      previewAmlConfiguration = {
        enabled: false,
        configured: false,
        source: null,
        updatedAt: new Date().toISOString(),
        updatedBy: { id: currentUser.id, name: currentUser.name },
      };
      return Promise.resolve({ ...previewAmlConfiguration });
    }
    return request<CmpAmlConfigurationStatus>("/cmp/settings/aml", {
      method: "DELETE",
    });
  },
  cmpAmlLatest(acceptanceId: string) {
    if (isMockMode()) {
      return Promise.resolve(
        previewAmlByAcceptance.get(acceptanceId) ?? emptyPreviewAmlResponse()
      );
    }
    return request<CmpAmlLatestResponse>(
      `/cmp/acceptance/${acceptanceId}/aml-screenings/latest`
    );
  },
  runCmpAmlScreening(acceptanceId: string, input?: CmpAmlRunInput) {
    const normalizedInput: CmpAmlRunInput = input ?? { force: false };
    if (isMockMode()) {
      const response = createPreviewAmlResponse(acceptanceId, normalizedInput);
      previewAmlByAcceptance.set(acceptanceId, response);
      return Promise.resolve(response);
    }
    return request<CmpAmlLatestResponse>(
      `/cmp/acceptance/${acceptanceId}/aml-screenings`,
      { method: "POST", body: JSON.stringify(normalizedInput) }
    );
  },
  reviewCmpAmlHit(
    screeningId: string,
    hitId: string,
    input: CmpAmlHitReviewInput
  ) {
    if (isMockMode()) {
      const reviewedAt = new Date().toISOString();
      const updated: CmpAmlHit = {
        id: hitId,
        diditHitId: hitId,
        reviewStatus: input.reviewStatus,
        matchScore: 96,
        riskScore: 82,
        details: { name: "Preview AML hit" },
        reviewedBy: { id: previewUser.id, name: previewUser.name },
        reviewedAt,
        reviewComment: input.comment?.trim() || null,
        createdAt: reviewedAt,
      };
      return Promise.resolve(updated);
    }
    return request<CmpAmlHit>(
      `/cmp/aml-screenings/${screeningId}/hits/${hitId}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  submitCmpAcceptance(id: string) {
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  assignCmpAcceptanceDraft(
    id: string,
    input: CmpAcceptanceDraftAssignmentInput
  ) {
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}/assign-draft`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  recallCmpAcceptanceDraft(id: string) {
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}/recall-draft`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  completeCmpAcceptanceDraft(id: string) {
    return request<CmpAcceptanceRequest>(
      `/cmp/acceptance/${id}/complete-draft`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  },
  approveCmpAcceptance(id: string, input: CmpAcceptanceActionInput = {}) {
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  returnCmpAcceptance(id: string, input: CmpAcceptanceReturnInput) {
    return request<CmpAcceptanceRequest>(`/cmp/acceptance/${id}/return`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  cmpClientGroups() {
    if (isMockMode()) {
      return Promise.resolve({ groups: previewGroups });
    }
    return request<CmpClientGroupsResponse>("/cmp/client-groups");
  },
  cmpEntityMaps() {
    if (isMockMode()) {
      return Promise.resolve({ maps: [] as CmpEntityMap[] });
    }
    return request<{ maps: CmpEntityMap[] }>("/cmp/entity-maps");
  },
  createCmpEntityMap(input: CreateCmpEntityMapInput) {
    return request<CmpEntityMap>("/cmp/entity-maps", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpEntityMapNode(
    mapId: string,
    nodeId: string,
    input: UpdateCmpEntityMapNodeInput
  ) {
    return request<CmpEntityMap>(`/cmp/entity-maps/${mapId}/nodes/${nodeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  createCmpEntityMapNode(mapId: string, input: CreateCmpEntityMapNodeInput) {
    return request<CmpEntityMap>(`/cmp/entity-maps/${mapId}/nodes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  createCmpEntityMapEdge(mapId: string, input: CreateCmpEntityMapEdgeInput) {
    return request<CmpEntityMap>(`/cmp/entity-maps/${mapId}/edges`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpEntityMapEdge(
    mapId: string,
    edgeId: string,
    input: UpdateCmpEntityMapEdgeInput
  ) {
    return request<CmpEntityMap>(`/cmp/entity-maps/${mapId}/edges/${edgeId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  attachCmpEntityMapDraft(mapId: string, input: AttachCmpEntityMapDraftInput) {
    return request<CmpEntityMap>(`/cmp/entity-maps/${mapId}/attach-draft`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  bindCmpEntityMapClient(
    mapId: string,
    nodeId: string,
    input: BindCmpEntityMapNodeClientInput
  ) {
    return request<CmpEntityMap>(
      `/cmp/entity-maps/${mapId}/nodes/${nodeId}/bind-client`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },
  cmpEntityMapClientCandidates(query: string) {
    if (isMockMode()) {
      const normalized = query.trim().toLowerCase();
      return Promise.resolve({
        candidates: previewClients
          .filter((client) =>
            client.clientCode.toLowerCase().includes(normalized)
          )
          .slice(0, 10)
          .map((client) => ({
            id: client.id,
            clientCode: client.clientCode,
            nameZh: client.nameZh,
            nameEn: client.nameEn,
            companyNumber: client.companyNumber,
            status: client.status,
            boundMap: null,
          })),
      } satisfies CmpEntityMapClientCandidates);
    }
    const suffix = new URLSearchParams({ q: query }).toString();
    return request<CmpEntityMapClientCandidates>(
      `/cmp/entity-maps/client-candidates?${suffix}`
    );
  },
  cmpClientGroupStructure(id: string) {
    if (isMockMode()) {
      const group = previewGroups.find((item) => item.id === id);
      if (!group) {
        return Promise.reject(new ApiError(404, "Client group not found"));
      }
      const groupMembers = previewClients
        .filter((client) => client.groupId === id)
        .sort((left, right) => {
          if (left.id === group.ultimateParentClientId) {
            return -1;
          }
          if (right.id === group.ultimateParentClientId) {
            return 1;
          }
          return left.clientCode.localeCompare(right.clientCode);
        });

      return Promise.resolve<CmpClientGroupStructure>({
        group,
        ultimateParent: group.ultimateParent ?? null,
        subsidiaryTree: groupMembers.map((client) => ({
          client: {
            id: client.id,
            clientCode: client.clientCode,
            nameZh: client.nameZh,
            nameEn: client.nameEn,
            groupId: client.groupId,
            status: client.status,
          },
          relationship: null,
          children: [],
        })),
        associates: [],
        jointVentures: [],
        relationshipHistory: [],
        warnings: group.ultimateParent
          ? []
          : [
              {
                code: "ULTIMATE_PARENT_NOT_ASSIGNED",
                message: "Ultimate Parent has not been assigned",
                clientId: null,
              },
            ],
      });
    }
    return request<CmpClientGroupStructure>(
      `/cmp/client-groups/${id}/structure`
    );
  },
  createCmpClientGroup(input: CreateCmpClientGroupInput) {
    return request<CmpClientGroupsResponse["groups"][number]>(
      "/cmp/client-groups",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },
  updateCmpClientGroup(id: string, input: UpdateCmpClientGroupInput) {
    return request<CmpClientGroupsResponse["groups"][number]>(
      `/cmp/client-groups/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    );
  },
  cmpClients(query: { q?: string; groupId?: string; status?: string } = {}) {
    if (isMockMode()) {
      const normalizedQuery = query.q?.trim().toLowerCase();
      return Promise.resolve({
        clients: previewClients.filter((item) => {
          if (query.groupId && item.groupId !== query.groupId) {
            return false;
          }
          if (query.status && item.status !== query.status) {
            return false;
          }
          if (!normalizedQuery) {
            return true;
          }
          return [
            item.clientCode,
            item.companyCode,
            item.companyNumber,
            item.nameEn,
            item.nameZh,
            item.contactPerson,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));
        }),
      });
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CmpClientsResponse>(`/cmp/clients${suffix}`);
  },
  cmpClientSearchDocuments(
    clientId: string,
    category: CmpClientSearchDocumentCategory
  ) {
    if (isMockMode()) {
      return Promise.resolve({ documents: [] });
    }
    return request<{ documents: CmpClientSearchDocument[] }>(
      `/cmp/clients/${encodeURIComponent(clientId)}/search-documents?category=${category}`
    );
  },
  uploadCmpClientSearchDocument(
    clientId: string,
    category: CmpClientSearchDocumentCategory,
    file: File
  ) {
    const body = new FormData();
    body.set("file", file);
    return requestMultipart<CmpClientSearchDocument>(
      `/cmp/clients/${encodeURIComponent(clientId)}/search-documents?category=${category}`,
      { method: "POST", body }
    );
  },
  deleteCmpClientSearchDocument(documentId: string) {
    return request<{ deleted: boolean }>(
      `/cmp/client-search-documents/${encodeURIComponent(documentId)}`,
      { method: "DELETE" }
    );
  },
  cmpClientSearchDocumentDownloadUrl(documentId: string) {
    return `${API_BASE_URL}/cmp/client-search-documents/${encodeURIComponent(documentId)}/download`;
  },
  async loadCmpClientSearchDocument(documentId: string) {
    const response = await fetch(
      `${API_BASE_URL}/cmp/client-search-documents/${encodeURIComponent(documentId)}/download`,
      { credentials: "include" }
    );
    if (!response.ok) {
      throw new ApiError(response.status, getSafeErrorMessage(response.status));
    }
    return response.blob();
  },
  cmpClientProfile(clientId: string) {
    return request<CmpClientProfile>(`/cmp/clients/${clientId}/profile`);
  },
  cmpClientPreview(clientId: string, locale: CmpRecordPreviewLocale) {
    if (isMockMode()) {
      return Promise.resolve(buildMockClientPreview(clientId, locale));
    }
    return request<CmpRecordPreviewDocument>(
      `/cmp/clients/${encodeURIComponent(clientId)}/preview?locale=${encodeURIComponent(locale)}`
    );
  },
  cmpClientPreviewPdfUrl(clientId: string, locale: CmpRecordPreviewLocale) {
    return `${API_BASE_URL}/cmp/clients/${encodeURIComponent(clientId)}/export.pdf?locale=${encodeURIComponent(locale)}`;
  },
  cmpClientGraph(clientId: string, asOf?: string) {
    if (isMockMode()) {
      return Promise.resolve(previewRelatedParties(clientId, asOf).graph);
    }
    const suffix = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
    return request<unknown>(`/cmp/clients/${clientId}/graph${suffix}`).then(
      (value) => CmpClientGraphSchema.parse(value)
    );
  },
  cmpRelatedEntities(clientId: string) {
    if (isMockMode()) {
      return Promise.resolve<CmpRelatedEntitiesResponse>(
        previewRelatedParties(clientId).entities
      );
    }
    return request<CmpRelatedEntitiesResponse>(
      `/cmp/clients/${clientId}/entities`
    );
  },
  cmpCompanyIdentityMatch(identifierType: string, identifierValue: string) {
    if (isMockMode()) {
      return Promise.resolve({ match: null });
    }
    const params = new URLSearchParams({ identifierType, identifierValue });
    return request<CmpCompanyIdentityMatchResponse>(
      `/cmp/clients/identity/company-match?${params.toString()}`
    );
  },
  createCmpRelatedEntity(clientId: string, input: CreateCmpRelatedEntityInput) {
    return request<{ entity: CmpRelatedEntitiesResponse["entities"][number] }>(
      `/cmp/clients/${clientId}/entities`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  updateCmpRelatedEntity(
    clientId: string,
    entityId: string,
    input: UpdateCmpRelatedEntityInput
  ) {
    return request<{ entity: CmpRelatedEntitiesResponse["entities"][number] }>(
      `/cmp/clients/${clientId}/entities/${entityId}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  removeCmpRelatedEntity(clientId: string, entityId: string) {
    return request<{ removed: boolean }>(
      `/cmp/clients/${clientId}/entities/${entityId}`,
      {
        method: "DELETE",
      }
    );
  },
  cmpEntityRelationships(clientId: string) {
    if (isMockMode()) {
      return Promise.resolve(previewRelatedParties(clientId).relationships);
    }
    return request<unknown>(`/cmp/clients/${clientId}/relationships`).then(
      (value) => CmpEntityRelationshipsResponseSchema.parse(value)
    );
  },
  createCmpEntityRelationship(
    clientId: string,
    input: CreateCmpEntityRelationshipInput
  ) {
    return request<{
      relationship: CmpEntityRelationshipsResponse["relationships"][number];
    }>(`/cmp/clients/${clientId}/relationships`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpEntityRelationship(
    clientId: string,
    relationshipId: string,
    input: UpdateCmpEntityRelationshipInput
  ) {
    return request<{
      relationship: CmpEntityRelationshipsResponse["relationships"][number];
    }>(`/cmp/clients/${clientId}/relationships/${relationshipId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  removeCmpEntityRelationship(clientId: string, relationshipId: string) {
    return request<{ removed: boolean }>(
      `/cmp/clients/${clientId}/relationships/${relationshipId}`,
      { method: "DELETE" }
    );
  },
  cmpGroupRelationships(clientId: string) {
    if (isMockMode()) {
      return Promise.resolve(
        previewRelatedParties(clientId).groupRelationships
      );
    }
    return request<unknown>(
      `/cmp/clients/${clientId}/group-relationships`
    ).then((value) => CmpGroupRelationshipsResponseSchema.parse(value));
  },
  createCmpGroupRelationship(
    clientId: string,
    input: CreateCmpGroupRelationshipInput
  ) {
    return request<{
      relationship: CmpGroupRelationshipsResponse["relationships"][number];
    }>(`/cmp/clients/${clientId}/group-relationships`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpGroupRelationship(
    clientId: string,
    relationshipId: string,
    input: UpdateCmpGroupRelationshipInput
  ) {
    return request<{
      relationship: CmpGroupRelationshipsResponse["relationships"][number];
    }>(`/cmp/clients/${clientId}/group-relationships/${relationshipId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  removeCmpGroupRelationship(clientId: string, relationshipId: string) {
    return request<{ removed: boolean }>(
      `/cmp/clients/${clientId}/group-relationships/${relationshipId}`,
      { method: "DELETE" }
    );
  },
  cmpClientVersions(
    clientId: string,
    query: Partial<CmpClientVersionListQuery> = {}
  ) {
    if (isMockMode()) {
      return Promise.resolve({
        client:
          previewClients.find((client) => client.id === clientId) ??
          previewClients[0],
        currentVersion: null,
        versions: [],
        total: 0,
      } as CmpClientVersionsResponse);
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CmpClientVersionsResponse>(
      `/cmp/clients/${clientId}/versions${suffix}`
    );
  },
  cmpClientVersion(clientId: string, versionId: string) {
    return request<CmpClientVersionDetail>(
      `/cmp/clients/${clientId}/versions/${versionId}`
    );
  },
  cmpClientVersionComparison(clientId: string, versionId: string) {
    return request(
      `/cmp/clients/${clientId}/versions/${versionId}/compare-current`
    );
  },
  cmpClientVersionPdfUrl(clientId: string, versionId: string) {
    return `${API_BASE_URL}/cmp/clients/${encodeURIComponent(clientId)}/versions/${encodeURIComponent(versionId)}/export.pdf`;
  },
  cmpEngagements(
    query: {
      q?: string;
      clientId?: string;
      status?: string;
      serviceType?: string;
    } = {}
  ) {
    if (isMockMode()) {
      const normalizedQuery = query.q?.trim().toLowerCase();
      return Promise.resolve({
        engagements: previewEngagements.filter((item) => {
          if (query.clientId && item.clientId !== query.clientId) {
            return false;
          }
          if (query.status && item.status !== query.status) {
            return false;
          }
          if (query.serviceType && item.serviceType !== query.serviceType) {
            return false;
          }
          if (!normalizedQuery) {
            return true;
          }
          return [
            item.engagementCode,
            item.client.clientCode,
            item.client.nameEn,
            item.client.nameZh,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery));
        }),
      });
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CmpEngagementsResponse>(`/cmp/engagements${suffix}`);
  },
  cmpEngagementPreview(engagementId: string, locale: CmpRecordPreviewLocale) {
    if (isMockMode()) {
      return Promise.resolve(buildMockEngagementPreview(engagementId, locale));
    }
    return request<CmpRecordPreviewDocument>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/preview?locale=${encodeURIComponent(locale)}`
    );
  },
  cmpEngagement(engagementId: string) {
    if (isMockMode()) {
      const engagement = previewEngagements.find(
        (item) => item.id === engagementId
      );
      if (engagement) {
        return Promise.resolve(engagement);
      }
    }
    return request<CmpEngagement>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}`
    );
  },
  cmpEngagementArchiveReview(engagementId: string) {
    if (isMockMode()) {
      return Promise.resolve(previewBuildArchiveReview(engagementId));
    }
    return request<CmpEngagementArchiveReview>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-review`
    );
  },
  saveCmpEngagementArchiveDraft(
    engagementId: string,
    input: CmpEngagementArchiveDraftSaveInput
  ) {
    if (isMockMode()) {
      previewArchiveEngagement(engagementId);
      const existing = previewArchiveDrafts.get(engagementId);
      if (existing?.workflowStatus === "PENDING_PIC") {
        throw new ApiError(
          409,
          "Archive details are locked while PIC review is pending",
          "CMP_ENGAGEMENT_ARCHIVE_PENDING_REVIEW"
        );
      }
      if (existing && existing.sourceUpdatedAt !== input.sourceUpdatedAt) {
        previewArchiveSourceConflict();
      }
      const draft: CmpEngagementArchiveDraft = {
        id: existing?.id ?? `preview-draft-${engagementId}`,
        engagementId,
        payload: input.payload,
        sourceUpdatedAt: input.sourceUpdatedAt,
        tmsFingerprint: input.tmsFingerprint,
        editorUserId: previewSessionUser()?.id ?? previewUser.id,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workflowStatus: "DRAFT",
        submittedById: null,
        submittedAt: null,
        returnedById: null,
        returnedAt: null,
        returnReason: null,
        overrideReason: existing?.overrideReason ?? null,
      };
      previewArchiveDrafts.set(engagementId, draft);
      persistPreviewArchiveState();
      return Promise.resolve(draft);
    }
    return request<CmpEngagementArchiveDraft>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-draft`,
      { method: "PUT", body: JSON.stringify(input) }
    );
  },
  deleteCmpEngagementArchiveDraft(engagementId: string) {
    if (isMockMode()) {
      previewArchiveEngagement(engagementId);
      previewArchiveDrafts.delete(engagementId);
      persistPreviewArchiveState();
      return Promise.resolve({ deleted: true });
    }
    return request<{ deleted: boolean }>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-draft`,
      { method: "DELETE" }
    );
  },
  submitCmpEngagementArchive(
    engagementId: string,
    input: CmpEngagementArchiveSubmitInput
  ) {
    if (isMockMode()) {
      const engagement = previewArchiveEngagement(engagementId);
      const draft = previewArchiveRequireDraft(engagementId);
      if (draft.workflowStatus !== "PENDING_PIC") {
        if (draft.sourceUpdatedAt !== input.sourceUpdatedAt) {
          previewArchiveSourceConflict();
        }
        draft.workflowStatus = "PENDING_PIC";
        draft.submittedById = previewSessionUser()?.id ?? previewUser.id;
        draft.submittedAt = new Date().toISOString();
        draft.returnedById = null;
        draft.returnedAt = null;
        draft.returnReason = null;
        draft.updatedAt = new Date().toISOString();
      }
      persistPreviewArchiveState();
      void engagement;
      return Promise.resolve(draft);
    }
    return request<CmpEngagementArchiveDraft>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-submit`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  returnCmpEngagementArchive(
    engagementId: string,
    input: CmpEngagementArchiveReturnInput
  ) {
    if (isMockMode()) {
      previewArchiveEngagement(engagementId);
      const draft = previewArchiveRequireDraft(engagementId);
      if (draft.workflowStatus !== "PENDING_PIC") {
        previewArchiveNotAwaitingReview();
      }
      draft.workflowStatus = "RETURNED";
      draft.returnedById = previewSessionUser()?.id ?? previewUser.id;
      draft.returnedAt = new Date().toISOString();
      draft.returnReason = input.reason;
      draft.updatedAt = new Date().toISOString();
      persistPreviewArchiveState();
      return Promise.resolve(draft);
    }
    return request<CmpEngagementArchiveDraft>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-return`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  archiveCmpEngagement(
    engagementId: string,
    input: CmpEngagementArchiveFinalizeInput
  ) {
    if (isMockMode()) {
      const engagement = previewArchiveEngagement(engagementId);
      const existing = previewArchiveSnapshots.get(engagementId);
      if (existing) {
        return Promise.resolve(existing);
      }
      const draft = previewArchiveRequireDraft(engagementId);
      if (
        draft.id !== input.draftId ||
        draft.workflowStatus !== "PENDING_PIC"
      ) {
        previewArchiveNotAwaitingReview();
      }
      if (draft.sourceUpdatedAt !== input.sourceUpdatedAt) {
        previewArchiveSourceConflict();
      }
      const memberCosts = previewArchiveMemberCosts(engagementId);
      const archivedAt = new Date().toISOString();
      const archivedEngagement: CmpEngagement = {
        ...engagement,
        status: "ARCHIVED",
        updatedAt: archivedAt,
      };
      engagement.status = "ARCHIVED";
      engagement.updatedAt = archivedAt;
      const snapshot: CmpEngagementArchiveSnapshot = {
        id: `preview-snapshot-${engagementId}`,
        engagementId,
        engagement: archivedEngagement,
        archivedById: previewSessionUser()?.id ?? previewUser.id,
        archivedAt,
        tmsFingerprint: input.tmsFingerprint,
        totals: previewArchiveTotals(memberCosts),
        memberCosts,
        workflowVersion: 2,
        preparedById: draft.submittedById ?? draft.editorUserId,
        submittedAt: draft.submittedAt,
        approvedById: previewSessionUser()?.id ?? previewUser.id,
        approvalNote: input.approvalNote ?? null,
        acknowledgedWarnings: input.acknowledgedWarnings,
      };
      previewArchiveSnapshots.set(engagementId, snapshot);
      previewArchiveDrafts.delete(engagementId);
      persistPreviewArchiveState();
      return Promise.resolve(snapshot);
    }
    return request<CmpEngagementArchiveSnapshot>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  cmpEngagementArchiveSnapshot(engagementId: string) {
    if (isMockMode()) {
      const snapshot = previewArchiveSnapshots.get(engagementId);
      if (!snapshot) {
        throw new ApiError(
          404,
          "Engagement archive was not found",
          "NOT_FOUND"
        );
      }
      return Promise.resolve(snapshot);
    }
    return request<CmpEngagementArchiveSnapshot>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/archive-snapshot`
    );
  },
  cmpEngagementArchives() {
    if (isMockMode()) {
      return Promise.resolve({
        archives: previewEngagements
          .filter((engagement) => engagement.status === "ARCHIVED")
          .map((engagement) => {
            const snapshot = previewArchiveSnapshots.get(engagement.id);
            return {
              id: `archive-${engagement.id}`,
              engagementId: engagement.id,
              engagementCode: engagement.engagementCode,
              clientName:
                engagement.client.nameZh ||
                engagement.client.nameEn ||
                engagement.client.clientCode,
              reportDate: engagement.reportDate,
              pic: engagement.pic,
              archivedAt: snapshot?.archivedAt ?? engagement.updatedAt,
              totals: snapshot?.totals ?? {
                currency: engagement.feeCurrency,
                budgetCost: "0.00",
                actualCost: "0.00",
              },
            };
          }),
      } satisfies CmpEngagementArchivesResponse);
    }
    return request<CmpEngagementArchivesResponse>("/cmp/engagement-archives");
  },
  cmpEngagementPreviewPdfUrl(
    engagementId: string,
    locale: CmpRecordPreviewLocale
  ) {
    return `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/export.pdf?locale=${encodeURIComponent(locale)}`;
  },
  cmpEngagementFeeNote(engagementId: string) {
    if (isMockMode()) {
      return Promise.resolve(buildPreviewEngagementFeeNote(engagementId));
    }
    return request<CmpEngagementFeeNoteResponse>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/fee-note`
    );
  },
  cmpEngagementFeeNotes(engagementId: string) { return request<CmpEngagementFeeNotesResponse>(`/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes`); },
  cmpEngagementFeeNoteById(engagementId: string, feeNoteId: string) { return request<CmpEngagementFeeNoteResponse>(`/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes/${encodeURIComponent(feeNoteId)}`); },
  createCmpEngagementFeeNote(engagementId: string, input: CreateCmpEngagementFeeNoteInput) { return request<CmpEngagementFeeNoteResponse>(`/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes`, { method: "POST", body: JSON.stringify(input) }); },
  updateCmpEngagementFeeNoteById(engagementId: string, feeNoteId: string, input: CmpEngagementFeeNoteUpdateInput) { return request<CmpEngagementFeeNoteResponse>(`/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes/${encodeURIComponent(feeNoteId)}`, { method: "PATCH", body: JSON.stringify(input) }); },
  updateCmpEngagementFeeNote(
    engagementId: string,
    input: CmpEngagementFeeNoteUpdateInput
  ) {
    if (isMockMode()) {
      const current = buildPreviewEngagementFeeNote(engagementId);
      const lineItems = input.lineItems ?? current.note.lineItems;
      const lineItemTotal = input.lineItems
        ? lineItems
            .reduce((total, item) => {
              const amount = Number(item.amount.trim());
              return total + (Number.isFinite(amount) ? amount : 0);
            }, 0)
            .toFixed(2)
        : undefined;
      const note = {
        ...current.note,
        ...input,
        ...(lineItemTotal === undefined
          ? {}
          : {
              lineItems,
              amount: lineItemTotal,
              disbursementAmount: "",
              totalAmount: lineItemTotal,
            }),
        id: current.note.id ?? `fee-note-${engagementId}`,
        updatedAt: new Date().toISOString(),
      };
      previewEngagementFeeNotes.set(engagementId, note);
      return Promise.resolve({ ...current, note });
    }
    return request<CmpEngagementFeeNoteResponse>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/fee-note`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  cmpEngagementFeeNoteExportUrl(
    engagementId: string,
    format: "pdf" | "docx",
    locale: CmpFeeNoteLocale
  ) {
    return `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/fee-note/export.${format}?locale=${encodeURIComponent(locale)}`;
  },
  cmpEngagementFeeNoteExportByIdUrl(engagementId: string, feeNoteId: string, format: "pdf" | "docx", locale: CmpFeeNoteLocale) { return `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes/${encodeURIComponent(feeNoteId)}/export.${format}?locale=${encodeURIComponent(locale)}`; },
  cmpEngagementFeeNoteOriginalUrl(engagementId: string, feeNoteId: string, locale: CmpFeeNoteLocale) { return `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/fee-notes/${encodeURIComponent(feeNoteId)}/original.pdf?locale=${encodeURIComponent(locale)}`; },
  cmpEngagementBudgetWorkbookUrl(
    engagementId: string,
    locale: CmpRecordPreviewLocale
  ) {
    return `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/export.xlsx?locale=${encodeURIComponent(locale)}`;
  },
  cmpTmsEngagementSummary(engagementId: string) {
    if (isMockMode()) {
      return Promise.resolve(
        previewTmsEngagementSummaries[engagementId] ?? emptyPreviewTmsSummary()
      );
    }
    return request<TmsEngagementSummary>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/tms-summary`
    );
  },
  cmpTmsTimesheetRecords(engagementCode: string) {
    if (isMockMode()) {
      const engagement = previewEngagements.find(
        (item) => item.engagementCode === engagementCode
      );
      return Promise.resolve(
        previewTmsTimesheetRecords(engagement?.id ?? engagementCode)
      );
    }
    const params = new URLSearchParams({
      jobCode: engagementCode,
      mode: "DETAIL",
      page: "1",
      pageSize: "100",
    });
    return request<TmsTimesheetQueryResponse>(
      `/tms/timesheets/query?${params.toString()}`
    );
  },
  cmpAssociationDirectory(query: string) {
    if (isMockMode()) {
      const normalized = query.trim().toLowerCase();
      if (normalized.includes("dummy-emp")) {
        return Promise.resolve({
          engagements: [
            {
              id: `unlinked:${query}`,
              source: "UNLINKED_PROJECT" as const,
              projectId: `preview-project-${normalized}`,
              projectCode: query,
              projectName: query,
              engagementCode: query,
              clientId: `preview-client-${normalized}`,
              clientCode: query,
              clientName: query,
              serviceType: "OTHERS" as const,
              budgetedHours: "0.00",
              agreedFee: "0.00",
              recoveryRate: null,
              feeCurrency: "HKD" as const,
              pic: null,
              mic: null,
              codeAliases: [],
              timesheetAccess: { allowed: true, reason: "ALLOWED" as const },
            },
          ],
        });
      }
      const engagement = previewEngagements.find((candidate) => {
        const clientName =
          candidate.client.nameEn || candidate.client.nameZh || "";
        return [
          candidate.engagementCode,
          candidate.client.clientCode,
          clientName,
        ].some((value) => value.toLowerCase().includes(normalized));
      });
      if (!engagement) {
        return Promise.resolve({ engagements: [] });
      }
      const clientName =
        engagement.client.nameEn || engagement.client.nameZh || "";
      const base = {
        id: engagement.id,
        source: "ENGAGEMENT" as const,
        engagementCode: engagement.engagementCode,
        clientId: engagement.clientId,
        clientCode: engagement.client.clientCode,
        clientName,
        serviceType: engagement.serviceType,
        budgetedHours: engagement.budgetedHours,
        agreedFee: engagement.agreedFee,
        recoveryRate: engagement.recoveryRate,
        feeCurrency: engagement.feeCurrency,
        pic: engagement.pic,
        mic: engagement.mic,
        codeAliases: engagement.codeAliases,
        timesheetAccess: { allowed: true, reason: "ALLOWED" as const },
      } satisfies Omit<
        TmsEngagementDirectoryItem,
        "projectId" | "projectCode" | "projectName"
      >;
      return Promise.resolve({
        engagements: [
          {
            ...base,
            projectId: `preview-project-${engagement.id}-1`,
            projectCode: engagement.engagementCode,
            projectName: `${clientName} · ${engagement.serviceType}`,
          },
          {
            ...base,
            projectId: `preview-project-${engagement.id}-2`,
            projectCode: `${engagement.engagementCode}-02`,
            projectName: `${clientName} · ${engagement.serviceType} 02`,
          },
        ],
      });
    }
    const params = new URLSearchParams({ q: query });
    return request<TmsEngagementDirectoryResponse>(
      `/cmp/integrations/tms/engagements?${params.toString()}`
    );
  },
  tmsProjectLinks(input: TmsProjectLinkQuery = {}) {
    if (isMockMode()) {
      return Promise.resolve({ links: [] });
    }
    const params = new URLSearchParams();
    if (input.q) {
      params.set("q", input.q);
    }
    if (input.projectId) {
      params.set("projectId", input.projectId);
    }
    if (input.status) {
      params.set("status", input.status);
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return request<TmsProjectLinksResponse>(
      `/tms/timesheets/project-links${suffix}`
    );
  },
  linkEmpProject(projectId: string, input: LinkProjectEngagementInput) {
    return request(
      `/projects/${encodeURIComponent(projectId)}/link-engagement`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },
  unlinkEmpProject(projectId: string) {
    return request(
      `/projects/${encodeURIComponent(projectId)}/link-engagement`,
      { method: "DELETE" }
    );
  },
  linkTmsProject(rowId: string, projectId: string) {
    return request<TmsProjectLink>("/tms/timesheets/project-links", {
      method: "POST",
      body: JSON.stringify({ rowId, projectId }),
    });
  },
  unlinkTmsProject(rowId: string) {
    return request<TmsProjectLink>(
      `/tms/timesheets/project-links/${encodeURIComponent(rowId)}`,
      { method: "DELETE" }
    );
  },
  createCmpEngagement(input: CreateCmpEngagementInput) {
    return request<CmpEngagement>("/cmp/engagements", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpEngagement(id: string, input: UpdateCmpEngagementInput) {
    return request<CmpEngagement>(`/cmp/engagements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  cmpBillings(query: CmpBillingListQuery = {}) {
    if (isMockMode()) {
      return Promise.resolve(previewBillingList(query));
    }
    const search = new URLSearchParams();
    if (query.queue) {
      search.set("queue", query.queue);
    }
    if (query.engagementId) {
      search.set("engagementId", query.engagementId);
    }
    if (query.query) {
      search.set("query", query.query);
    }
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<CmpBillingListResponse>(`/cmp/billing${suffix}`);
  },
  cmpEngagementBillings(engagementId: string) {
    if (isMockMode()) {
      return Promise.resolve(previewBillingList({ engagementId }));
    }
    return request<CmpBillingListResponse>(
      `/cmp/engagements/${encodeURIComponent(engagementId)}/billing`
    );
  },
  cmpBilling(id: string) {
    if (isMockMode()) {
      const billing = previewBillingRecords.find((entry) => entry.id === id);
      if (!billing) {
        return Promise.reject(
          new ApiError(404, "Billing record was not found", "NOT_FOUND")
        );
      }
      return Promise.resolve(billing);
    }
    return request<CmpBilling>(`/cmp/billing/${encodeURIComponent(id)}`);
  },
  cmpBillingDefaults(id: string) {
    if (isMockMode()) {
      return Promise.resolve(previewBillingImportOptions(id).defaults);
    }
    return request<CmpBillingDefaultsResponse>(
      `/cmp/billing/${encodeURIComponent(id)}/defaults`
    );
  },
  cmpBillingImportOptions(id: string) {
    if (isMockMode()) {
      return Promise.resolve(previewBillingImportOptions(id));
    }
    return request<CmpBillingImportOptionsResponse>(
      `/cmp/billing/${encodeURIComponent(id)}/import-options`
    );
  },
  cmpBillingTemplates(includeInactive = false) {
    if (isMockMode()) {
      return Promise.resolve(previewBillingTemplates(includeInactive));
    }
    return request<CmpBillingTemplateListResponse>(
      `/cmp/billing/templates?includeInactive=${includeInactive ? "true" : "false"}`
    );
  },
  createCmpBillingFirmTemplate(input: CreateCmpBillingFirmTemplateInput) {
    if (isMockMode()) {
      return Promise.resolve(previewCreateFirmTemplate(input));
    }
    return request<CmpBillingFirmTemplate>("/cmp/billing/templates/firm", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpBillingFirmTemplate(
    id: string,
    input: UpdateCmpBillingFirmTemplateInput
  ) {
    if (isMockMode()) {
      return Promise.resolve(previewUpdateFirmTemplate(id, input));
    }
    return request<CmpBillingFirmTemplate>(
      `/cmp/billing/templates/firm/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  deactivateCmpBillingFirmTemplate(
    id: string,
    input: CmpBillingTemplateVersionInput
  ) {
    if (isMockMode()) {
      return Promise.resolve(previewDeactivateFirmTemplate(id, input));
    }
    return request<CmpBillingFirmTemplate>(
      `/cmp/billing/templates/firm/${encodeURIComponent(id)}/deactivate`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  createCmpBillingBankTemplate(input: CreateCmpBillingBankTemplateInput) {
    if (isMockMode()) {
      return Promise.resolve(previewCreateBankTemplate(input));
    }
    return request<CmpBillingBankTemplate>("/cmp/billing/templates/bank", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpBillingBankTemplate(
    id: string,
    input: UpdateCmpBillingBankTemplateInput
  ) {
    if (isMockMode()) {
      return Promise.resolve(previewUpdateBankTemplate(id, input));
    }
    return request<CmpBillingBankTemplate>(
      `/cmp/billing/templates/bank/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) }
    );
  },
  deactivateCmpBillingBankTemplate(
    id: string,
    input: CmpBillingTemplateVersionInput
  ) {
    if (isMockMode()) {
      return Promise.resolve(previewDeactivateBankTemplate(id, input));
    }
    return request<CmpBillingBankTemplate>(
      `/cmp/billing/templates/bank/${encodeURIComponent(id)}/deactivate`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  createCmpBilling(input: CreateCmpBillingInput) {
    return request<CmpBilling>("/cmp/billing", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateCmpBilling(id: string, input: UpdateCmpBillingInput) {
    if (isMockMode()) {
      return Promise.resolve(previewUpdateBilling(id, input));
    }
    return request<CmpBilling>(`/cmp/billing/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteCmpBilling(id: string, input: CmpBillingExpectedVersion) {
    return request<{ deleted: boolean }>(
      `/cmp/billing/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        body: JSON.stringify(input),
      }
    );
  },
  submitCmpBilling(id: string, input: CmpBillingExpectedVersion) {
    return request<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/submit`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  returnCmpBilling(id: string, input: CmpBillingReturnInput) {
    return request<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/return`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  approveCmpBilling(id: string, input: CmpBillingExpectedVersion) {
    return request<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/approve`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  markCmpBillingSent(id: string, input: CmpBillingMarkSentInput) {
    return request<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/mark-sent`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  claimCmpBillingClientPayment(
    id: string,
    input: CmpBillingClientPaymentClaimInput,
    file: File
  ) {
    return requestMultipart<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/client-payment-claims`,
      {
        method: "POST",
        body: billingMultipart(input, file),
      }
    );
  },
  addCmpBillingFinanceReceipt(
    id: string,
    input: CmpBillingFinanceReceiptInput,
    file: File
  ) {
    return requestMultipart<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/finance-receipts`,
      {
        method: "POST",
        body: billingMultipart(input, file),
      }
    );
  },
  reconcileCmpBilling(id: string, input: CmpBillingReconcileInput) {
    return request<CmpBilling>(
      `/cmp/billing/${encodeURIComponent(id)}/reconcile`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  async generateCmpBillingInvoice(id: string, input: CmpBillingInvoiceInput) {
    const response = await fetch(
      `${API_BASE_URL}/cmp/billing/${encodeURIComponent(id)}/invoices`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      throw await createApiError(response);
    }
    const format = input.format ?? "pdf";
    triggerBlobDownload(
      await response.blob(),
      filenameFromResponse(response, `billing-${input.locale}.${format}`)
    );
  },
  async downloadCmpBillingArtifact(artifactId: string) {
    const { blob, fileName } = await loadCmpBillingArtifactFile(artifactId);
    triggerBlobDownload(blob, fileName);
  },
  async loadCmpBillingArtifact(artifactId: string) {
    const artifact = await loadCmpBillingArtifactFile(artifactId);
    return artifact.blob;
  },
};

type CmpApi = Omit<typeof selectedApi, "me" | "signOut"> & {
  me: () => Promise<CurrentUser | null>;
  restoreIntranetEntry: () => Promise<CurrentUser | null>;
  signOut: () => Promise<void>;
};

export const api: CmpApi = {
  ...selectedApi,
  async me() {
    try {
      return await selectedApi.me();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },
  async restoreIntranetEntry() {
    try {
      return await api.me();
    } catch {
      return null;
    }
  },
  async signOut() {
    await selectedApi.signOut();
  },
};

function buildPreviewEngagementFeeNote(
  engagementId: string
): CmpEngagementFeeNoteResponse {
  const existing = previewEngagementFeeNotes.get(engagementId);
  const engagement =
    previewEngagements.find((candidate) => candidate.id === engagementId) ??
    previewEngagements[0];
  if (!engagement) {
    throw new Error("Preview engagement data is unavailable");
  }
  const client =
    previewClients.find((candidate) => candidate.id === engagement.clientId) ??
    previewClients[0];
  if (!client) {
    throw new Error("Preview client data is unavailable");
  }
  const note = {
    id: null,
    engagementId: engagement.id,
    periodNumber: 1,
    plannedIssueDate: "",
    plannedAmount: engagement.agreedFee,
    receivedAmount: "",
    receivedDate: "",
    collectionStatus: "UNISSUED" as const,
    outstandingAmount: engagement.agreedFee,
    feeNoteNumber: "",
    engagementReference: engagement.engagementCode,
    issueDate: new Date().toISOString().slice(0, 10),
    recipientName: client.nameZh || client.nameEn || client.clientCode,
    recipientAttention: "董事",
    recipientSalutation: "贵公司",
    recipientAddress:
      client.addresses?.find((address) => address.type === "REGISTERED")
        ?.address ??
      client.addresses?.find((address) => address.type === "PRINCIPAL")
        ?.address ??
      client.address ??
      "",
    currency: engagement.feeCurrency,
    serviceDescription: "",
    lineItems: [
      {
        id: "service-fee",
        description: "",
        amount: engagement.agreedFee,
      },
    ],
    amount: engagement.agreedFee,
    disbursementAmount: "0.00",
    totalAmount: engagement.agreedFee,
    issuerReference: "",
    signatoryName: engagement.pic || "",
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
    firmLegalName: "维致（香港）会计师事务所 / Wing Zenith",
    firmAddress:
      "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong\n香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    firmPhone: "Tel: (852) 53667568",
    firmFax: "",
    firmEmail: "info@wzcpa.hk",
    firmWebsite: "www.wzcpa.hk",
    localizedContent: {
      "zh-CN": {
        recipientName: client.nameZh || client.nameEn || client.clientCode,
        recipientAttention: "董事",
        recipientSalutation: "贵公司",
        recipientAddress:
          client.addresses?.find((address) => address.type === "REGISTERED")
            ?.address ??
          client.addresses?.find((address) => address.type === "PRINCIPAL")
            ?.address ??
          client.address ??
          "",
        serviceDescription: "",
        lineItemDescriptions: { "service-fee": "" },
        signatoryName: engagement.pic || "",
        bankPayeeName: "",
        bankName: "",
        firmLegalName: "维致（香港）会计师事务所",
        firmAddress: "香港灣仔駱克道193號東超商業中心17樓1703至1704室",
      },
      "en-US": {
        recipientName: client.nameEn || client.nameZh || client.clientCode,
        recipientAttention: "Director",
        recipientSalutation: "Your company",
        recipientAddress:
          client.addresses?.find((address) => address.type === "REGISTERED")
            ?.address ??
          client.addresses?.find((address) => address.type === "PRINCIPAL")
            ?.address ??
          client.address ??
          "",
        serviceDescription: "",
        lineItemDescriptions: { "service-fee": "" },
        signatoryName: engagement.pic || "",
        bankPayeeName: "",
        bankName: "",
        firmLegalName: "Wing Zenith",
        firmAddress:
          "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong",
      },
    },
    createdAt: null,
    updatedAt: null,
  } as CmpEngagementFeeNoteResponse["note"];
  return { note: existing ?? note, defaults: note };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    throw await createApiError(response);
  }
  return response.json() as Promise<T>;
}

async function requestMultipart<T>(
  path: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
  });
  if (!response.ok) {
    throw await createApiError(response);
  }
  return response.json() as Promise<T>;
}

function billingMultipart(input: object, file: File) {
  const data = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      data.set(key, String(value));
    }
  });
  data.set("file", file);
  return data;
}

function filenameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i
  );
  return match
    ? decodeURIComponent(match[1] ?? match[2] ?? fallback)
    : fallback;
}

async function createApiError(response: Response) {
  type ApiErrorBody = {
    code?: unknown;
    message?: unknown;
    requestId?: unknown;
  };
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Some upstream failures do not return JSON.
  }
  const safeBackendMessage =
    response.status < 500 && typeof body?.message === "string"
      ? body.message
      : getSafeErrorMessage(response.status);
  return new ApiError(
    response.status,
    safeBackendMessage,
    typeof body?.code === "string" ? body.code : undefined,
    typeof body?.requestId === "string" ? body.requestId : undefined
  );
}

function isMockMode() {
  return process.env.NEXT_PUBLIC_API_MODE === "mock";
}

const previewBillingRecords: CmpBilling[] = [
  previewBillingRecord({
    id: "bill-orc-aud-001",
    engagementId: "eng-orc-aud",
    billNumber: "ORC-2026-AUD-001",
    issueDate: "2026-06-30",
    amount: "120000.00",
    received: "120000.00",
    status: "RECONCILED",
  }),
  previewBillingRecord({
    id: "bill-orc-aud-002",
    engagementId: "eng-orc-aud",
    billNumber: "ORC-2026-AUD-002",
    issueDate: "2026-08-15",
    amount: "60000.00",
    received: "15000.00",
    status: "CLIENT_PAID",
  }),
  previewBillingRecord({
    id: "bill-hbr-001",
    engagementId: "eng-hbr",
    billNumber: "HBR-2026-ACC-001",
    issueDate: "2026-07-31",
    amount: "80000.00",
    received: "62000.00",
    status: "CLIENT_PAID",
  }),
  previewBillingRecord({
    id: "bill-orc-risk-001",
    engagementId: "eng-orc-risk",
    billNumber: "ORC-2026-RISK-001",
    issueDate: "2026-07-15",
    amount: "30000.00",
    received: "25000.00",
    status: "CLIENT_PAID",
  }),
  previewBillingRecord({
    id: "bill-wks-001",
    engagementId: "eng-wks",
    billNumber: "WKS-2026-AUD-001",
    issueDate: "2026-08-01",
    amount: "200000.00",
    received: "180000.00",
    status: "CLIENT_PAID",
  }),
  previewBillingRecord({
    id: "bill-orc-aud-import-draft",
    engagementId: "eng-orc-aud",
    billNumber: "ORC-2026-AUD-DRAFT",
    issueDate: "2026-08-31",
    amount: "0.00",
    received: "0.00",
    status: "DRAFT",
  }),
];

let previewBillingFirmTemplates: CmpBillingFirmTemplate[] = [
  {
    id: "preview-billing-firm-wz",
    name: "WZ Default Firm Profile",
    status: "ACTIVE",
    isDefault: true,
    version: 1,
    firmLegalNameZh: "维致（香港）会计师事务所",
    firmLegalNameEn: "Wing Zenith",
    firmAddressZh: "香港灣仔駱克道193號東超商業中心17樓1703至1704室",
    firmAddressEn:
      "Rooms 1703-4, 17/F, Tung Chiu Commercial Centre, 193 Lockhart Road, Wan Chai, Hong Kong",
    phone: "(852) 53667568",
    email: "info@wzcpa.hk",
    website: "www.wzcpa.hk",
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  },
];
let previewBillingBankTemplates: CmpBillingBankTemplate[] = [];
let previewBillingTemplateSequence = 1;

function previewBillingTemplates(
  includeInactive: boolean
): CmpBillingTemplateListResponse {
  const visible = <T extends { status: string }>(items: T[]) =>
    items.filter((item) => includeInactive || item.status === "ACTIVE");
  return {
    canManage: true,
    firmTemplates: visible(previewBillingFirmTemplates).map((template) => ({
      ...template,
    })),
    bankTemplates: visible(previewBillingBankTemplates).map((template) => ({
      ...template,
    })),
  };
}

function previewBillingImportOptions(
  id: string
): CmpBillingImportOptionsResponse {
  const billing = previewBillingRecords.find((entry) => entry.id === id);
  if (!billing) {
    throw new Error("Billing was not found");
  }
  const zh = billing.localizedContent["zh-CN"];
  const en = billing.localizedContent["en-US"];
  return {
    defaults: {
      clientSnapshot: { ...billing.clientSnapshot },
      firmSnapshot: { ...billing.firmSnapshot },
      localizedContent: {
        "zh-CN": {
          ...zh,
          lineItemDescriptions: { ...zh.lineItemDescriptions },
        },
        "en-US": {
          ...en,
          lineItemDescriptions: { ...en.lineItemDescriptions },
        },
      },
    },
    cmpFields: [
      {
        key: "clientSnapshot",
        section: "CLIENT",
        source: "Client master",
        editable: false,
        value: {
          zh: String(billing.clientSnapshot.clientCode ?? billing.clientName),
          en: String(billing.clientSnapshot.clientCode ?? billing.clientName),
        },
      },
      {
        key: "recipientName",
        section: "RECIPIENT",
        source: "Client master",
        editable: true,
        value: { zh: zh.recipientName, en: en.recipientName },
      },
      {
        key: "recipientAddress",
        section: "RECIPIENT",
        source: "Client registered / principal address",
        editable: true,
        value: { zh: zh.recipientAddress, en: en.recipientAddress },
      },
      {
        key: "recipientAttention",
        section: "RECIPIENT",
        source: "System billing default",
        editable: true,
        value: { zh: zh.recipientAttention, en: en.recipientAttention },
      },
      {
        key: "recipientSalutation",
        section: "RECIPIENT",
        source: "System billing default",
        editable: true,
        value: { zh: zh.recipientSalutation, en: en.recipientSalutation },
      },
      {
        key: "engagementSnapshot",
        section: "ENGAGEMENT",
        source: "Engagement master",
        editable: false,
        value: { zh: billing.engagementCode, en: billing.engagementCode },
      },
      {
        key: "signatoryName",
        section: "ENGAGEMENT",
        source: "Engagement PIC",
        editable: true,
        value: { zh: zh.signatoryName, en: en.signatoryName },
      },
    ],
    firmTemplates: previewBillingTemplates(false).firmTemplates,
    bankTemplates: previewBillingTemplates(false).bankTemplates,
    canManageTemplates: true,
  };
}

function previewCreateFirmTemplate(
  input: CreateCmpBillingFirmTemplateInput
): CmpBillingFirmTemplate {
  if (input.isDefault) {
    previewBillingFirmTemplates = previewBillingFirmTemplates.map(
      (template) => ({
        ...template,
        isDefault: false,
        version: template.version + 1,
      })
    );
  }
  const timestamp = new Date().toISOString();
  const sequence = previewBillingTemplateSequence;
  previewBillingTemplateSequence += 1;
  const template: CmpBillingFirmTemplate = {
    id: `preview-billing-firm-${sequence}`,
    name: input.name,
    status: "ACTIVE",
    isDefault: input.isDefault ?? false,
    version: 1,
    firmLegalNameZh: input.firmLegalNameZh,
    firmLegalNameEn: input.firmLegalNameEn,
    firmAddressZh: input.firmAddressZh,
    firmAddressEn: input.firmAddressEn,
    phone: input.phone,
    email: input.email,
    website: input.website,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  previewBillingFirmTemplates = [...previewBillingFirmTemplates, template];
  return { ...template };
}

function previewUpdateFirmTemplate(
  id: string,
  input: UpdateCmpBillingFirmTemplateInput
): CmpBillingFirmTemplate {
  const index = previewBillingFirmTemplates.findIndex(
    (entry) => entry.id === id
  );
  if (
    index === -1 ||
    previewBillingFirmTemplates[index].version !== input.expectedVersion
  ) {
    throw new Error("The template was changed by another user");
  }
  if (input.isDefault) {
    previewBillingFirmTemplates = previewBillingFirmTemplates.map((template) =>
      template.id === id
        ? template
        : { ...template, isDefault: false, version: template.version + 1 }
    );
  }
  const { expectedVersion: _expectedVersion, ...changes } = input;
  const updated = {
    ...previewBillingFirmTemplates[index],
    ...changes,
    version: previewBillingFirmTemplates[index].version + 1,
    updatedAt: new Date().toISOString(),
  };
  previewBillingFirmTemplates[index] = updated;
  return { ...updated };
}

function previewDeactivateFirmTemplate(
  id: string,
  input: CmpBillingTemplateVersionInput
): CmpBillingFirmTemplate {
  const index = previewBillingFirmTemplates.findIndex(
    (entry) => entry.id === id
  );
  if (
    index === -1 ||
    previewBillingFirmTemplates[index].version !== input.expectedVersion
  ) {
    throw new Error("The template was changed by another user");
  }
  const updated = {
    ...previewBillingFirmTemplates[index],
    status: "INACTIVE" as const,
    isDefault: false,
    version: previewBillingFirmTemplates[index].version + 1,
    updatedAt: new Date().toISOString(),
  };
  previewBillingFirmTemplates[index] = updated;
  return { ...updated };
}

function previewCreateBankTemplate(
  input: CreateCmpBillingBankTemplateInput
): CmpBillingBankTemplate {
  if (input.isDefault) {
    previewBillingBankTemplates = previewBillingBankTemplates.map(
      (template) => ({
        ...template,
        isDefault: false,
        version: template.version + 1,
      })
    );
  }
  const timestamp = new Date().toISOString();
  const sequence = previewBillingTemplateSequence;
  previewBillingTemplateSequence += 1;
  const template: CmpBillingBankTemplate = {
    id: `preview-billing-bank-${sequence}`,
    name: input.name,
    status: "ACTIVE",
    isDefault: input.isDefault ?? false,
    version: 1,
    bankPayeeNameZh: input.bankPayeeNameZh,
    bankPayeeNameEn: input.bankPayeeNameEn,
    bankNameZh: input.bankNameZh,
    bankNameEn: input.bankNameEn,
    hkdAccountNumber: input.hkdAccountNumber,
    hkdSwiftCode: input.hkdSwiftCode,
    cnyAccountNumber: input.cnyAccountNumber,
    cnySwiftCode: input.cnySwiftCode,
    usdAccountNumber: input.usdAccountNumber,
    usdSwiftCode: input.usdSwiftCode,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  previewBillingBankTemplates = [...previewBillingBankTemplates, template];
  return { ...template };
}

function previewUpdateBankTemplate(
  id: string,
  input: UpdateCmpBillingBankTemplateInput
): CmpBillingBankTemplate {
  const index = previewBillingBankTemplates.findIndex(
    (entry) => entry.id === id
  );
  if (
    index === -1 ||
    previewBillingBankTemplates[index].version !== input.expectedVersion
  ) {
    throw new Error("The template was changed by another user");
  }
  if (input.isDefault) {
    previewBillingBankTemplates = previewBillingBankTemplates.map((template) =>
      template.id === id
        ? template
        : { ...template, isDefault: false, version: template.version + 1 }
    );
  }
  const { expectedVersion: _expectedVersion, ...changes } = input;
  const updated = {
    ...previewBillingBankTemplates[index],
    ...changes,
    version: previewBillingBankTemplates[index].version + 1,
    updatedAt: new Date().toISOString(),
  };
  previewBillingBankTemplates[index] = updated;
  return { ...updated };
}

function previewDeactivateBankTemplate(
  id: string,
  input: CmpBillingTemplateVersionInput
): CmpBillingBankTemplate {
  const index = previewBillingBankTemplates.findIndex(
    (entry) => entry.id === id
  );
  if (
    index === -1 ||
    previewBillingBankTemplates[index].version !== input.expectedVersion
  ) {
    throw new Error("The template was changed by another user");
  }
  const updated = {
    ...previewBillingBankTemplates[index],
    status: "INACTIVE" as const,
    isDefault: false,
    version: previewBillingBankTemplates[index].version + 1,
    updatedAt: new Date().toISOString(),
  };
  previewBillingBankTemplates[index] = updated;
  return { ...updated };
}

function previewBillingRecord(input: {
  id: string;
  engagementId: string;
  billNumber: string;
  issueDate: string;
  amount: string;
  received: string;
  status: CmpBilling["status"];
}): CmpBilling {
  const engagement = previewEngagements.find(
    (entry) => entry.id === input.engagementId
  );
  if (!engagement) {
    throw new Error(`Unknown preview engagement: ${input.engagementId}`);
  }
  const clientName =
    engagement.client.nameZh ??
    engagement.client.nameEn ??
    engagement.client.clientCode;
  const remaining = Math.max(Number(input.amount) - Number(input.received), 0);
  const lineItemId = `${input.id}-line-1`;
  const localizedContent = {
    recipientName: clientName,
    recipientAttention: "",
    recipientSalutation: "",
    recipientAddress: "",
    serviceDescription: `Professional services for ${engagement.engagementCode}`,
    lineItemDescriptions: { [lineItemId]: "Professional services" },
    signatoryName: "",
    bankPayeeName: "",
    bankName: "",
    firmLegalName: "WZ",
    firmAddress: "",
  };
  return {
    id: input.id,
    engagementId: engagement.id,
    engagementCode: engagement.engagementCode,
    clientName,
    billNumber: input.billNumber,
    legacyFeeNoteNumber: null,
    status: input.status,
    version: 1,
    issueDate: input.issueDate,
    currency: "HKD",
    lineItems: [
      {
        id: lineItemId,
        descriptionZh: "专业服务费",
        descriptionEn: "Professional services",
        amount: input.amount,
        sortOrder: 0,
      },
    ],
    subtotalAmount: input.amount,
    totalAmount: input.amount,
    clientSnapshot: { clientCode: engagement.client.clientCode, clientName },
    firmSnapshot: { firmLegalName: "WZ" },
    localizedContent: { "zh-CN": localizedContent, "en-US": localizedContent },
    clientClaim: null,
    receiptTotalInBillCurrency: input.received,
    remainingAmount: remaining.toFixed(2),
    sentAt:
      input.status === "RECONCILED" || input.status === "CLIENT_PAID"
        ? input.issueDate
        : null,
    returnReason: null,
    createdAt: `${input.issueDate}T09:00:00.000Z`,
    updatedAt: `${input.issueDate}T09:00:00.000Z`,
    artifacts: [],
    financeReceipts: Number(input.received)
      ? [
          {
            id: `${input.id}-receipt-1`,
            receiptDate: input.issueDate,
            bankReference: `BANK-${input.billNumber}`,
            receiptAmount: input.received,
            receiptCurrency: "HKD",
            exchangeRateToBill: "1.00000000",
            exchangeRateBatchId: null,
            exchangeRateSourceDate: null,
            exchangeRateProvider: null,
            exchangeRateOrigin: "LEGACY_MANUAL" as const,
            billCurrencyAmount: input.received,
            internalNote: null,
            createdAt: `${input.issueDate}T09:00:00.000Z`,
          },
        ]
      : [],
    capabilities: {
      canEdit: input.status === "DRAFT",
      canDelete: input.status === "DRAFT",
      canSubmit: input.status === "DRAFT",
      canApprove: false,
      canReturn: false,
      canMarkSent: false,
      canClaimClientPayment: false,
      canAddFinanceReceipt: false,
      canReconcile: false,
      canGenerateInvoice: false,
    },
  };
}

function previewUpdateBilling(
  id: string,
  input: UpdateCmpBillingInput
): CmpBilling {
  const index = previewBillingRecords.findIndex((entry) => entry.id === id);
  const current = previewBillingRecords[index];
  if (index === -1 || !current) {
    throw new ApiError(404, "Billing record was not found", "NOT_FOUND");
  }
  if (current.version !== input.expectedVersion) {
    throw new ApiError(
      409,
      "Billing record was changed by another user",
      "VERSION_CONFLICT"
    );
  }
  const lineItems = input.lineItems
    ? input.lineItems.map((line, sortOrder) => ({
        id: line.id ?? `${id}-line-${sortOrder + 1}`,
        descriptionZh: line.descriptionZh,
        descriptionEn: line.descriptionEn,
        amount: line.amount,
        sortOrder: line.sortOrder ?? sortOrder,
      }))
    : current.lineItems;
  const total = lineItems.reduce((sum, line) => sum + Number(line.amount), 0);
  const totalAmount = total.toFixed(2);
  const updated: CmpBilling = {
    ...current,
    ...(input.issueDate === undefined ? {} : { issueDate: input.issueDate }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.clientSnapshot === undefined
      ? {}
      : { clientSnapshot: input.clientSnapshot }),
    ...(input.firmSnapshot === undefined
      ? {}
      : { firmSnapshot: input.firmSnapshot }),
    ...(input.localizedContent === undefined
      ? {}
      : { localizedContent: input.localizedContent }),
    lineItems,
    subtotalAmount: totalAmount,
    totalAmount,
    remainingAmount: Math.max(
      total - Number(current.receiptTotalInBillCurrency),
      0
    ).toFixed(2),
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  previewBillingRecords[index] = updated;
  return updated;
}

/**
 * Billing is not persisted in CMP preview mode. Keep the preview response
 * contract complete so that finance-center UI changes can be reviewed without
 * calling a local API, including its server-owned collection overview.
 */
function previewBillingList(
  query: CmpBillingListQuery
): CmpBillingListResponse {
  const matchingEngagements = previewEngagements.filter(
    (engagement) =>
      engagement.status !== "ARCHIVED" &&
      (!query.engagementId || engagement.id === query.engagementId)
  );
  const selectedEngagement = query.engagementId
    ? (matchingEngagements[0] ?? null)
    : null;
  const receiptByEngagementId: Record<string, number> = {
    "eng-hbr": 62_000,
    "eng-orc-aud": 135_000,
    "eng-orc-risk": 25_000,
    "eng-wks": 180_000,
  };
  const currency = selectedEngagement?.feeCurrency ?? "HKD";
  const exchangeToScopeCurrency = (amount: number, from: typeof currency) =>
    amount *
    (Number(getCmpFixedBudgetExchangeRate(from).hkdPerUnit) /
      Number(getCmpFixedBudgetExchangeRate(currency).hkdPerUnit));
  const agreedFee = matchingEngagements.reduce(
    (total, engagement) =>
      total +
      exchangeToScopeCurrency(
        Number(engagement.agreedFee),
        engagement.feeCurrency
      ),
    0
  );
  const actualReceived = matchingEngagements.reduce(
    (total, engagement) =>
      total +
      exchangeToScopeCurrency(
        receiptByEngagementId[engagement.id] ?? 0,
        engagement.feeCurrency
      ),
    0
  );
  const outstanding = Math.max(agreedFee - actualReceived, 0);
  const overReceived = Math.max(actualReceived - agreedFee, 0);
  const billings = previewBillingRecords.filter((billing) => {
    if (query.engagementId && billing.engagementId !== query.engagementId) {
      return false;
    }
    if (
      query.queue === "PENDING_RECONCILIATION" &&
      billing.status !== "CLIENT_PAID"
    ) {
      return false;
    }
    if (query.queue === "RECONCILED" && billing.status !== "RECONCILED") {
      return false;
    }
    const needle = query.query?.trim().toLowerCase();
    return (
      !needle ||
      [billing.billNumber, billing.engagementCode, billing.clientName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  });

  return {
    billings,
    revenue: [],
    collectionOverview: {
      scope: selectedEngagement ? "ENGAGEMENT" : "ALL",
      currency,
      agreedFee: agreedFee.toFixed(2),
      actualReceived: actualReceived.toFixed(2),
      outstanding: outstanding.toFixed(2),
      receivedRate:
        agreedFee === 0
          ? null
          : ((actualReceived / agreedFee) * 100).toFixed(2),
      overReceived: overReceived.toFixed(2),
      engagement: selectedEngagement
        ? {
            id: selectedEngagement.id,
            engagementCode: selectedEngagement.engagementCode,
            clientCode: selectedEngagement.client.clientCode,
            clientName:
              selectedEngagement.client.nameZh ??
              selectedEngagement.client.nameEn ??
              selectedEngagement.client.clientCode,
            serviceType: selectedEngagement.serviceType,
            status: selectedEngagement.status,
          }
        : null,
    },
  };
}

export async function downloadCmpEngagementArchiveExport(
  engagementId: string,
  kind: "pdf" | "xlsx"
): Promise<void> {
  if (isMockMode()) {
    const snapshot = previewArchiveSnapshots.get(engagementId);
    const engagement = previewEngagements.find(
      (item) => item.id === engagementId
    );
    if (!snapshot || !engagement) {
      throw new ApiError(404, "Engagement archive was not found", "NOT_FOUND");
    }
    const rows: string[][] = [
      [engagement.engagementCode, snapshot.archivedAt],
      [],
      [
        "Grade",
        "Member",
        "Budget hours",
        "Actual hours",
        "Budget cost",
        "Actual cost",
      ],
      ...snapshot.memberCosts.map((row) => [
        row.grade,
        row.name,
        (Number(row.budgetNormal) + Number(row.budgetOt)).toFixed(2),
        (Number(row.actualNormal) + Number(row.actualOt)).toFixed(2),
        row.budgetCost,
        row.actualCost,
      ]),
      [
        "Total",
        "",
        "",
        "",
        snapshot.totals.budgetCost,
        snapshot.totals.actualCost,
      ],
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\r\n");
    triggerBlobDownload(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      `${engagement.engagementCode}-archive-preview.csv`
    );
    return;
  }
  const response = await fetch(
    `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/archive/export.${kind}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i
  );
  const fileName = match
    ? decodeURIComponent(match[1] ?? match[2] ?? "")
    : `${engagementId}-archive.${kind}`;
  triggerBlobDownload(await response.blob(), fileName);
}

export async function downloadCmpEngagementBudgetWorkbook(
  engagementId: string,
  locale: CmpRecordPreviewLocale
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/cmp/engagements/${encodeURIComponent(engagementId)}/export.xlsx?locale=${encodeURIComponent(locale)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  triggerBlobDownload(
    await response.blob(),
    filenameFromResponse(response, `${engagementId}-budget.xlsx`)
  );
}

async function loadCmpBillingArtifactFile(artifactId: string) {
  const response = await fetch(
    `${API_BASE_URL}/cmp/billing/artifacts/${encodeURIComponent(artifactId)}/download`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw await createApiError(response);
  }
  return {
    blob: await response.blob(),
    fileName: filenameFromResponse(response, "billing-artifact"),
  };
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function previewLabel(
  locale: CmpRecordPreviewLocale,
  english: string,
  chinese: string
) {
  return locale === "zh-CN" ? chinese : english;
}

function previewField(
  id: string,
  label: string,
  value: string | number | null | undefined
) {
  return {
    id,
    label,
    value:
      value === null || value === undefined || value === ""
        ? "—"
        : String(value),
  };
}

function buildMockClientPreview(
  clientId: string,
  locale: CmpRecordPreviewLocale
): CmpRecordPreviewDocument {
  const client =
    previewClients.find((candidate) => candidate.id === clientId) ??
    previewClients[0];
  if (!client) {
    throw new Error("Preview client data is unavailable");
  }
  const l = (english: string, chinese: string) =>
    previewLabel(locale, english, chinese);
  return {
    kind: "CLIENT",
    recordId: client.id,
    code: client.clientCode,
    title: client.nameEn || client.nameZh || client.clientCode,
    status: client.status,
    updatedAt: client.updatedAt,
    sections: [
      {
        id: "basic",
        title: l("Client information", "客户信息"),
        fields: [
          previewField(
            "clientCode",
            l("Client Code", "客户编号"),
            client.clientCode
          ),
          previewField(
            "companyCode",
            l("Company Code", "公司代码"),
            client.companyCode
          ),
          previewField(
            "companyNumber",
            l("Company Number", "公司编号"),
            client.companyNumber
          ),
          previewField(
            "nameEn",
            l("Company Name English", "公司英文名称"),
            client.nameEn
          ),
          previewField(
            "nameZh",
            l("Company Name Chinese", "公司中文名称"),
            client.nameZh
          ),
          previewField("status", l("Client Status", "客户状态"), client.status),
          previewField(
            "yearEndMonth",
            l("Year End Month", "年结月份"),
            client.yearEndMonth
          ),
          previewField(
            "contactPerson",
            l("Contact Name", "联系人"),
            client.contactPerson
          ),
          previewField(
            "telephone",
            l("Office Telephone", "办公电话"),
            client.telephone
          ),
          previewField("email", l("Email", "电子邮箱"), client.email),
        ],
      },
      {
        id: "registration",
        title: l("Registration / regulation", "注册／监管"),
        fields: [
          previewField(
            "placeOfIncorporation",
            l("Place of Incorporation", "注册地"),
            client.placeOfIncorporation
          ),
          previewField(
            "industry",
            l("Industry", "行业"),
            client.industryOtherDescription ?? client.hsicSectionCode
          ),
          previewField(
            "companyType",
            l("Company Type", "公司类型"),
            client.listedOrPrivate
          ),
        ],
      },
      {
        id: "relationships",
        title: l("Group relationship / client source", "集团关系／客户来源"),
        fields: [
          previewField(
            "relationships",
            l("Client Relationships", "客户关系"),
            null
          ),
          previewField(
            "referredBy",
            l("Referred By", "推荐人"),
            client.referredBy
          ),
        ],
      },
      {
        id: "responsible-and-services",
        title: l("Responsible persons / expected services", "负责人／预期服务"),
        fields: [
          previewField("pic", "PIC", client.clientPartnerPic),
          previewField("mic", "MIC", client.clientManagerMic),
          previewField(
            "serviceLines",
            l("Service Type", "服务类型"),
            client.serviceLines
          ),
          previewField(
            "expectedJob",
            l("Expected Job / Engagement Type", "预期工作／业务类型"),
            client.expectedJobOrEngagementType
          ),
        ],
      },
    ],
  };
}

function buildMockEngagementPreview(
  engagementId: string,
  locale: CmpRecordPreviewLocale
): CmpRecordPreviewDocument {
  const engagement =
    previewEngagements.find((candidate) => candidate.id === engagementId) ??
    previewEngagements[0];
  if (!engagement) {
    throw new Error("Preview engagement data is unavailable");
  }
  const l = (english: string, chinese: string) =>
    previewLabel(locale, english, chinese);
  return {
    kind: "ENGAGEMENT",
    recordId: engagement.id,
    code: engagement.engagementCode,
    title: engagement.engagementCode,
    status: engagement.status,
    updatedAt: engagement.updatedAt,
    sections: [
      {
        id: "setup",
        title: l("Engagement Setup", "业务设置"),
        fields: [
          previewField(
            "client",
            l("Client", "客户"),
            `${engagement.client.clientCode} - ${engagement.client.nameEn || engagement.client.nameZh}`
          ),
          previewField(
            "engagementCode",
            l("Engagement Code", "业务代码"),
            engagement.engagementCode
          ),
          previewField(
            "serviceType",
            l("Service Type", "服务类型"),
            engagement.serviceType
          ),
          previewField(
            "approvalReferenceNumber",
            l("Approval No.", "批准编号"),
            engagement.approvalReferenceNumber
          ),
          previewField(
            "engagementDate",
            l("Engagement Date", "业务日期"),
            engagement.engagementDate
          ),
          previewField(
            "yearEndDate",
            l("Year End", "年结日"),
            engagement.yearEndDate
          ),
          previewField(
            "reportDate",
            l("Estimated Report Date", "预计报告日期"),
            engagement.reportDate
          ),
          previewField("pic", "PIC", engagement.pic),
          previewField("mic", "MIC", engagement.mic),
        ],
      },
      {
        id: "deliverables",
        title: l("Reports & Deliverables", "报告及交付物"),
        fields: [
          previewField(
            "deliverables",
            l("Selected deliverables", "已选交付物"),
            (engagement.deliverables ?? []).map((item) => item.code).join(", ")
          ),
        ],
      },
      {
        id: "commercial",
        title: l("Budget", "预算"),
        fields: [
          previewField(
            "budgetedHours",
            l("Budgeted Hours", "预算工时"),
            engagement.budgetedHours
          ),
          previewField(
            "agreedFee",
            l("Agreed Fee", "约定费用"),
            engagement.agreedFee
          ),
          previewField(
            "recoveryRate",
            l("Recovery Rate", "回收率"),
            engagement.recoveryRate ? `${engagement.recoveryRate}%` : null
          ),
          previewField(
            "feeCurrency",
            l("Currency", "币种"),
            engagement.feeCurrency
          ),
        ],
        tables:
          engagement.feePlanningLines.length > 0
            ? [
                {
                  id: "fee-planning-lines",
                  title: l("Budget details", "预算明细"),
                  columns: [
                    l("Firm Grade", "事务所职级"),
                    l("Staff Name", "员工姓名"),
                    l("Date (From)", "开始日期"),
                    l("Date (To)", "结束日期"),
                    l("Fixed Hourly Rate", "固定时薪"),
                    l("Budget in Hours", "预算工时"),
                    l("Total", "总额"),
                  ],
                  rows: engagement.feePlanningLines.map((line) => [
                    line.grade,
                    line.assignmentType === "TBC"
                      ? "TBC"
                      : (line.staff?.name ?? "—"),
                    line.dateFrom ?? "—",
                    line.dateTo ?? "—",
                    `${engagement.feeCurrency} ${line.hourlyRate}`,
                    Number(line.budgetHours).toFixed(2),
                    `${engagement.feeCurrency} ${line.lineTotal}`,
                  ]),
                  footer: [
                    l("Detail total hours", "明细总工时"),
                    "",
                    "",
                    "",
                    "",
                    engagement.feePlanningLines
                      .reduce(
                        (total, line) => total + Number(line.budgetHours),
                        0
                      )
                      .toFixed(2),
                    `${engagement.feeCurrency} ${engagement.feePlanningLines
                      .reduce(
                        (total, line) => total + Number(line.lineTotal),
                        0
                      )
                      .toFixed(2)}`,
                  ],
                },
              ]
            : undefined,
      },
      {
        id: "notes",
        title: l("Status and Remarks", "状态及备注"),
        fields: [
          previewField("status", l("Status", "状态"), engagement.status),
          previewField("remarks", l("Remarks", "备注"), engagement.remarks),
        ],
      },
    ],
  };
}

function createPreviewAcceptance(
  input: CreateCmpAcceptanceRequestInput
): CmpAcceptanceRequest {
  const now = new Date().toISOString();
  const submittedBy = toPreviewAcceptanceUser(
    previewSessionUser() ?? previewUser
  );
  const { micApprover, picApprover, itApprover, draftAssignee } =
    resolvePreviewCreationParticipants(input, submittedBy);
  const submitted = input.submit === true;
  const partnerInitiated = submittedBy.globalRole === "PARTNER";
  previewAcceptanceDraftSequence += 1;
  const sequence = previewAcceptanceDraftSequence;
  const [template] = previewAcceptanceRequests;

  return {
    ...template,
    id: `preview-acceptance-draft-${sequence}`,
    requestNo: `CA-PREVIEW-DRAFT-${String(sequence).padStart(4, "0")}`,
    type: input.type,
    status: previewAcceptanceStatus(
      submitted,
      partnerInitiated,
      Boolean(draftAssignee)
    ),
    currentStep: submitted && !partnerInitiated ? "PIC" : "MIC",
    submittedById: submittedBy.id,
    submittedBy,
    micApproverId: micApprover.id,
    micApprover,
    picApproverId: picApprover?.id ?? null,
    picApprover,
    itApproverId: itApprover?.id ?? null,
    itApprover,
    workflowVersion: 2,
    draftAssigneeId: draftAssignee?.id ?? null,
    draftAssignee,
    targetClientId: input.targetClientId ?? null,
    targetEngagementId: input.targetEngagementId ?? null,
    draftName: submitted ? null : (input.draftName ?? null),
    clientPayload: input.clientPayload ?? null,
    engagementPayload: input.engagementPayload ?? null,
    submittedAt: submitted ? now : null,
    createdAt: now,
    updatedAt: now,
    approvalSteps: [],
  };
}

function updatePreviewAcceptance(
  existing: CmpAcceptanceRequest,
  input: UpdateCmpAcceptanceRequestInput
): CmpAcceptanceRequest {
  const submitted = input.submit === true;
  const partnerInitiated = existing.submittedBy.globalRole === "PARTNER";
  const { micApprover, picApprover, itApprover, draftAssignee } =
    resolvePreviewUpdateParticipants(existing, input);
  const now = new Date().toISOString();

  return {
    ...existing,
    status: previewAcceptanceStatus(
      submitted,
      partnerInitiated,
      Boolean(draftAssignee)
    ),
    currentStep: submitted && !partnerInitiated ? "PIC" : "MIC",
    micApproverId: micApprover.id,
    micApprover,
    picApproverId: picApprover?.id ?? null,
    picApprover,
    itApproverId: itApprover?.id ?? null,
    itApprover,
    draftAssigneeId: draftAssignee?.id ?? null,
    draftAssignee,
    targetClientId: input.targetClientId ?? existing.targetClientId,
    targetEngagementId: input.targetEngagementId ?? existing.targetEngagementId,
    draftName: submitted
      ? existing.draftName
      : (input.draftName ?? existing.draftName),
    clientPayload: input.clientPayload ?? existing.clientPayload,
    engagementPayload: input.engagementPayload ?? existing.engagementPayload,
    submittedAt: submitted ? now : existing.submittedAt,
    updatedAt: now,
  };
}

function resolvePreviewCreationParticipants(
  input: CreateCmpAcceptanceRequestInput,
  submittedBy: CmpAcceptanceRequest["submittedBy"]
) {
  return {
    micApprover: input.micApproverId
      ? findPreviewAcceptanceUser(input.micApproverId, ["MANAGER"])
      : submittedBy,
    picApprover: findPreviewAcceptanceUser(input.picApproverId, [
      "PARTNER",
      "PRINCIPAL",
    ]),
    itApprover: findPreviewAcceptanceUser(input.itApproverId, ["SUPER_ADMIN"]),
    draftAssignee: input.draftAssigneeId
      ? findPreviewAcceptanceUser(input.draftAssigneeId, [
          "SENIOR",
          "STAFF",
          "ASSISTANT",
        ])
      : null,
  };
}

function resolvePreviewUpdateParticipants(
  existing: CmpAcceptanceRequest,
  input: UpdateCmpAcceptanceRequestInput
) {
  return {
    micApprover: input.micApproverId
      ? findPreviewAcceptanceUser(input.micApproverId, ["MANAGER"])
      : existing.micApprover,
    picApprover: input.picApproverId
      ? findPreviewAcceptanceUser(input.picApproverId, ["PARTNER", "PRINCIPAL"])
      : existing.picApprover,
    itApprover: input.itApproverId
      ? findPreviewAcceptanceUser(input.itApproverId, ["SUPER_ADMIN"])
      : existing.itApprover,
    draftAssignee: input.draftAssigneeId
      ? findPreviewAcceptanceUser(input.draftAssigneeId, [
          "SENIOR",
          "STAFF",
          "ASSISTANT",
        ])
      : input.draftAssigneeId === undefined
        ? existing.draftAssignee
        : null,
  };
}

function previewAcceptanceStatus(
  submitted: boolean,
  partnerInitiated: boolean,
  assigned: boolean
): CmpAcceptanceRequest["status"] {
  if (submitted) {
    return partnerInitiated ? "PENDING_MIC" : "PENDING_PIC";
  }
  return assigned ? "STAFF_EDITING" : "DRAFT";
}

function findPreviewAcceptanceUser(
  id: string | undefined,
  fallbackRoles: GlobalRole[]
) {
  const user =
    previewUsers.find((candidate) => candidate.id === id) ??
    previewUsers.find((candidate) =>
      fallbackRoles.includes(candidate.globalRole)
    );
  if (!user) {
    throw new ApiError(400, "Preview approver is unavailable");
  }
  return toPreviewAcceptanceUser(user);
}

function toPreviewAcceptanceUser(user: CurrentUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
  };
}

function previewLogin(email: string): CurrentUser {
  const user = getPreviewUser(email);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREVIEW_SESSION_KEY, user.email);
  }
  return user;
}

function previewSessionUser(): CurrentUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  const email = window.localStorage.getItem(PREVIEW_SESSION_KEY);
  return email ? getPreviewUser(email) : null;
}

// --- Preview engagement archive engine (mock mode only). Mirrors the backend
// maker-checker workflow so the archive UI is fully demoable without the API. ---

const previewArchiveDrafts = new Map<string, CmpEngagementArchiveDraft>();
const previewArchiveSnapshots = new Map<string, CmpEngagementArchiveSnapshot>();
const PREVIEW_ARCHIVE_STORAGE_KEY = "project-wing-cmp-preview-archive-state";

type PreviewArchivePersistedState = {
  drafts: [string, CmpEngagementArchiveDraft][];
  snapshots: [string, CmpEngagementArchiveSnapshot][];
  archivedEngagementIds: string[];
};

function persistPreviewArchiveState() {
  if (typeof window === "undefined") {
    return;
  }
  const state: PreviewArchivePersistedState = {
    drafts: [...previewArchiveDrafts.entries()],
    snapshots: [...previewArchiveSnapshots.entries()],
    archivedEngagementIds: previewEngagements
      .filter((engagement) => engagement.status === "ARCHIVED")
      .map((engagement) => engagement.id),
  };
  window.localStorage.setItem(
    PREVIEW_ARCHIVE_STORAGE_KEY,
    JSON.stringify(state)
  );
}

function hydratePreviewArchiveState() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const raw = window.localStorage.getItem(PREVIEW_ARCHIVE_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const state = JSON.parse(raw) as PreviewArchivePersistedState;
    for (const [id, draft] of state.drafts ?? []) {
      previewArchiveDrafts.set(id, draft);
    }
    for (const [id, snapshot] of state.snapshots ?? []) {
      previewArchiveSnapshots.set(id, snapshot);
    }
    const archived = new Set(state.archivedEngagementIds);
    for (const engagement of previewEngagements) {
      if (archived.has(engagement.id)) {
        engagement.status = "ARCHIVED";
      }
    }
  } catch {
    // Corrupt preview state is ignored; the archive flow restarts cleanly.
  }
}

hydratePreviewArchiveState();

function previewArchiveEngagement(engagementId: string): CmpEngagement {
  const engagement = previewEngagements.find(
    (item) => item.id === engagementId
  );
  if (!engagement) {
    throw new ApiError(404, "Engagement was not found", "NOT_FOUND");
  }
  return engagement;
}

function previewArchivePayload(
  engagement: CmpEngagement
): CmpEngagementArchivePayload {
  return {
    clientId: engagement.clientId,
    engagementCode: engagement.engagementCode,
    serviceType: engagement.serviceType,
    otherServiceDescription: "",
    deliverables: [],
    yearEndDate: engagement.yearEndDate ?? "",
    reportDate: engagement.reportDate ?? "",
    approvalReferenceNumber: engagement.approvalReferenceNumber ?? "",
    engagementDate: engagement.engagementDate ?? "",
    budgetedHours: engagement.budgetedHours,
    agreedFee: engagement.agreedFee,
    recoveryRate: engagement.recoveryRate ?? "",
    feeCurrency: engagement.feeCurrency,
    feeExchangeRateSnapshotId: "",
    feeExchangeRateHkdPerUnit: engagement.feeExchangeRateHkdPerUnit ?? "",
    feeExchangeRateSource: engagement.feeExchangeRateSource ?? "SYSTEM",
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
  };
}

function previewArchiveMemberCosts(
  engagementId: string
): CmpEngagementArchiveMemberCost[] {
  return previewArchiveMemberCostFixture[engagementId] ?? [];
}

function previewArchiveTotals(
  memberCosts: CmpEngagementArchiveMemberCost[]
): CmpEngagementArchiveTotals {
  const sum = (pick: (cost: CmpEngagementArchiveMemberCost) => string) =>
    memberCosts
      .reduce((total, cost) => total + Number(pick(cost) || 0), 0)
      .toFixed(2);
  return {
    currency: "HKD",
    budgetCost: sum((cost) => cost.budgetCost),
    actualCost: sum((cost) => cost.actualCost),
  };
}

function previewArchiveReadiness(
  engagement: CmpEngagement,
  payload: CmpEngagementArchivePayload,
  memberCosts: CmpEngagementArchiveMemberCost[]
): CmpEngagementArchiveReadinessCheck[] {
  const checks: CmpEngagementArchiveReadinessCheck[] = [];
  const add = (
    code: CmpEngagementArchiveReadinessCheck["code"],
    severity: CmpEngagementArchiveReadinessCheck["severity"],
    params: Record<string, string> = {}
  ) => checks.push({ code, severity, params });
  if (
    !engagement.picUserId ||
    !engagement.micUserId ||
    engagement.picUserId === engagement.micUserId
  ) {
    add("RESPONSIBLE_USERS_INVALID", "BLOCKER");
  }
  if (!payload.reportDate) {
    add("REPORT_DATE_INVALID", "BLOCKER");
  }
  const unresolvedTbc = (payload.feePlanningLines ?? []).filter(
    (line) => line.assignmentType === "TBC"
  ).length;
  if (unresolvedTbc > 0) {
    add("UNRESOLVED_TBC", "BLOCKER", { count: String(unresolvedTbc) });
  }
  const approvedHours = previewTmsEngagementSummaries[
    engagement.id
  ]?.approved.rows.filter(
    (row) =>
      row.userId !== "total" &&
      (Number(row.finalNormal ?? 0) > 0 || Number(row.finalOt ?? 0) > 0)
  );
  if (approvedHours && approvedHours.length) {
    const assigned = new Set(
      (payload.feePlanningLines ?? [])
        .map((line) => line.staffUserId)
        .filter((userId): userId is string => Boolean(userId))
    );
    const unassigned = approvedHours.filter((row) => !assigned.has(row.userId));
    if (unassigned.length) {
      add("UNASSIGNED_APPROVED_TMS_PERSON", "BLOCKER", {
        count: String(unassigned.length),
      });
    }
  }
  if (!(payload.deliverables ?? []).length) {
    add("NO_DELIVERABLES", "WARNING");
  }
  const budgetHours = memberCosts.reduce(
    (total, row) =>
      total + Number(row.budgetNormal || 0) + Number(row.budgetOt || 0),
    0
  );
  const actualHours = memberCosts.reduce(
    (total, row) =>
      total + Number(row.actualNormal || 0) + Number(row.actualOt || 0),
    0
  );
  if (actualHours > budgetHours) {
    add("ACTUAL_HOURS_OVER_BUDGET", "WARNING");
  }
  const totals = previewArchiveTotals(memberCosts);
  if (Number(totals.actualCost) > Number(totals.budgetCost)) {
    add("ACTUAL_COST_OVER_BUDGET", "WARNING");
  }
  if (Number(totals.actualCost) > Number(payload.agreedFee || 0)) {
    add("ACTUAL_COST_OVER_FEE", "WARNING");
  }
  if (memberCosts.some((row) => row.historical)) {
    add("HISTORICAL_MEMBER", "WARNING");
  }
  return checks;
}

function previewArchiveWorkflow(
  engagement: CmpEngagement,
  draft: CmpEngagementArchiveDraft | null,
  user: CurrentUser | null
) {
  const status = draft?.workflowStatus ?? "DRAFT";
  const isAdmin = user?.globalRole === "SUPER_ADMIN";
  const isMic = engagement.micUserId === user?.id;
  const isPic = engagement.picUserId === user?.id;
  const isSubmitter = draft?.submittedById === user?.id;
  return {
    status,
    canEdit: status !== "PENDING_PIC" && Boolean(isMic || isAdmin),
    canSubmit:
      Boolean(draft) && status !== "PENDING_PIC" && Boolean(isMic || isAdmin),
    canApprove:
      status === "PENDING_PIC" && !isSubmitter && Boolean(isPic || isAdmin),
    canReturn:
      status === "PENDING_PIC" && !isSubmitter && Boolean(isPic || isAdmin),
    overrideRequired: Boolean(isAdmin && !(isMic || isPic)),
  };
}

function previewArchiveSourceConflict(): never {
  throw new ApiError(
    409,
    "The Engagement changed after this archive draft was created.",
    "CMP_ENGAGEMENT_ARCHIVE_SOURCE_CONFLICT"
  );
}

function previewArchiveNotAwaitingReview(): never {
  throw new ApiError(
    400,
    "Archive is not awaiting PIC review",
    "VALIDATION_FAILED"
  );
}

function previewBuildArchiveReview(
  engagementId: string
): CmpEngagementArchiveReview {
  const engagement = previewArchiveEngagement(engagementId);
  const draft = previewArchiveDrafts.get(engagementId) ?? null;
  const memberCosts = previewArchiveMemberCosts(engagementId);
  const payload = draft?.payload ?? previewArchivePayload(engagement);
  const readiness = previewArchiveReadiness(engagement, payload, memberCosts);
  const workflow = previewArchiveWorkflow(
    engagement,
    draft,
    previewSessionUser()
  );
  const blockers = readiness
    .filter((item) => item.severity === "BLOCKER")
    .map((item) => item.code.replaceAll("_", " ").toLowerCase());
  return {
    engagement,
    draft,
    tmsFingerprint: `preview-tms-${engagement.updatedAt}`,
    memberCosts,
    totals: previewArchiveTotals(memberCosts),
    warnings: readiness
      .filter((item) => item.severity === "WARNING")
      .map((item) => item.code.replaceAll("_", " ").toLowerCase()),
    blockers,
    canArchive: workflow.canApprove && blockers.length === 0,
    readiness,
    workflow,
  };
}

type TmsTimesheetDetailResponse = Extract<
  TmsTimesheetQueryResponse,
  { mode: "DETAIL" }
>;

function previewTmsTimesheetRecords(
  engagementId: string
): TmsTimesheetDetailResponse {
  const engagement = previewEngagements.find(
    (item) => item.id === engagementId
  );
  const jobCode = engagement?.engagementCode ?? engagementId;
  const clientName =
    engagement?.client.nameZh ??
    engagement?.client.nameEn ??
    engagement?.client.clientCode ??
    jobCode;
  const rows: TmsTimesheetDetailResponse["rows"] = [];
  const pushDays = (
    staffNo: string,
    staffName: string,
    rate: string,
    timesheetStatus: "DRAFT" | "SUBMITTED" | "APPROVED",
    days: { date: string; normal: number; ot: number; absent: number }[]
  ) => {
    for (const day of days) {
      rows.push({
        jobCode,
        staffNo,
        staffName,
        rate,
        normal: day.normal,
        ot: day.ot,
        absent: day.absent,
        total: (day.normal + day.ot + day.absent).toFixed(1),
        clientName,
        netBudgetFee: null,
        pic: "Jony Ma",
        mic: "Leo Li",
        timesheetStatus,
        activeStatus: day.absent > 0 ? "LEAVE" : "ACTIVE",
        timesheetDate: day.date,
      });
    }
  };
  // July 2026 demo month: attendance-style daily records per member.
  pushDays("E0018", "Edric Han", "1500.00", "APPROVED", [
    { date: "2026-07-01", normal: 8, ot: 0, absent: 0 },
    { date: "2026-07-02", normal: 8, ot: 0, absent: 0 },
    { date: "2026-07-03", normal: 8, ot: 2, absent: 0 },
    { date: "2026-07-06", normal: 8, ot: 0, absent: 0 },
    { date: "2026-07-07", normal: 2, ot: 0, absent: 0 },
  ]);
  pushDays("E0042", "Amy Chan", "600.00", "DRAFT", [
    { date: "2026-07-02", normal: 8, ot: 0, absent: 0 },
    { date: "2026-07-03", normal: 0, ot: 0, absent: 8 },
    { date: "2026-07-06", normal: 8, ot: 0, absent: 0 },
  ]);
  return {
    mode: "DETAIL",
    rows,
    total: rows.length,
    page: 1,
    pageSize: 100,
  };
}

function previewArchiveRequireDraft(
  engagementId: string
): CmpEngagementArchiveDraft {
  const draft = previewArchiveDrafts.get(engagementId);
  if (!draft) {
    throw new ApiError(400, "Archive draft was not found", "VALIDATION_FAILED");
  }
  return draft;
}

function getPreviewUser(email: string): CurrentUser {
  const candidate = email.trim();
  const user = previewUsers.find((entry) => entry.email === candidate);
  return user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
      }
    : { ...previewUser, email: candidate || previewUser.email };
}

function previewRelatedParties(clientId: string, asOf?: string) {
  const client =
    previewClients.find((candidate) => candidate.id === clientId) ??
    previewClients[0];
  const rootId = `preview-entity-${client.id}`;
  const ownerId = `preview-owner-${client.id}`;
  const coParticipantId = `preview-co-participant-${client.id}`;
  const jointVentureId = `preview-joint-venture-${client.id}`;
  const associateId = `preview-associate-${client.id}`;
  const timestamp = "2026-08-09T00:00:00.000Z";
  const root = {
    id: rootId,
    role: "ROOT" as const,
    kind: "COMPANY" as const,
    displayName: client.nameEn || client.nameZh || client.clientCode,
    nameZh: client.nameZh,
    nameEn: client.nameEn,
    jurisdiction: "Hong Kong",
    registrationNumber: client.companyNumber,
    status: "ACTIVE" as const,
    companyProfile: null,
    personProfile: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const owner = {
    id: ownerId,
    role: "RELATED" as const,
    kind: "COMPANY" as const,
    displayName: `${client.nameEn || client.clientCode} Holdings`,
    nameZh: null,
    nameEn: `${client.nameEn || client.clientCode} Holdings`,
    jurisdiction: "Cayman Islands",
    registrationNumber: `REG-${client.clientCode}`,
    status: "ACTIVE" as const,
    companyProfile: null,
    personProfile: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const coParticipant = {
    ...owner,
    id: coParticipantId,
    displayName: "Co-investor B Limited",
    nameZh: "共同投资方 B 有限公司",
    nameEn: "Co-investor B Limited",
    jurisdiction: "Hong Kong",
    registrationNumber: "JC-B-001",
  };
  const jointVenture = {
    ...owner,
    id: jointVentureId,
    displayName: "Joint Venture C Limited",
    nameZh: "合营企业 C 有限公司",
    nameEn: "Joint Venture C Limited",
    jurisdiction: "Hong Kong",
    registrationNumber: "JV-C-001",
  };
  const associate = {
    ...owner,
    id: associateId,
    displayName: "Associate D Limited",
    nameZh: "联营企业 D 有限公司",
    nameEn: "Associate D Limited",
    jurisdiction: "Hong Kong",
    registrationNumber: "AS-D-001",
  };
  const relationship = {
    id: `preview-relationship-${client.id}`,
    fromEntityId: ownerId,
    toEntityId: rootId,
    type: "OWNS" as const,
    ownershipPercentage: 100,
    effectiveFrom: null,
    effectiveTo: null,
    sourceDocument: "Company registry extract",
    remarks: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const groupRelationships = {
    relationships: [
      {
        id: `preview-associate-relationship-${client.id}`,
        targetEntityId: associateId,
        type: "ASSOCIATE" as const,
        effectiveFrom: null,
        effectiveTo: null,
        sourceDocument: "Associate register",
        remarks: null,
        participants: [
          {
            entityId: rootId,
            method: "OWNERSHIP" as const,
            ownershipPercentage: 30,
            otherDescription: null,
          },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: `preview-joint-venture-relationship-${client.id}`,
        targetEntityId: jointVentureId,
        type: "JOINT_VENTURE" as const,
        effectiveFrom: null,
        effectiveTo: null,
        sourceDocument: "Joint venture agreement",
        remarks: null,
        participants: [
          {
            entityId: rootId,
            method: "OWNERSHIP" as const,
            ownershipPercentage: 50,
            otherDescription: null,
          },
          {
            entityId: coParticipantId,
            method: "OTHER" as const,
            ownershipPercentage: null,
            otherDescription: "Contractual joint venture arrangement",
          },
        ],
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
  return {
    entities: {
      rootEntityId: rootId,
      entities: [root, owner, coParticipant, jointVenture, associate],
    },
    relationships: {
      relationships: [relationship],
    },
    groupRelationships,
    graph: {
      client: {
        id: client.id,
        clientCode: client.clientCode,
        rootEntityId: rootId,
      },
      asOf: asOf ?? "2026-08-09",
      nodes: [
        {
          ...root,
          isRoot: true,
          clientIds: [client.id],
        },
        ...[owner, coParticipant, jointVenture, associate].map((entity) => ({
          ...entity,
          isRoot: false,
          clientIds: [client.id],
        })),
      ],
      edges: [relationship],
      groupRelationships: groupRelationships.relationships,
    } satisfies CmpClientGraph,
  };
}

function clearPreviewSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PREVIEW_SESSION_KEY);
}

function emptyPreviewAmlResponse(): CmpAmlLatestResponse {
  return {
    enabled: true,
    configured: true,
    canReviewHits: true,
    currentInputFingerprint: "preview-current",
    isStale: false,
    availableSubjects: previewAmlSubjects(),
    batch: null,
  };
}

function createPreviewAmlResponse(
  acceptanceId: string,
  input: CmpAmlRunInput
): CmpAmlLatestResponse {
  const timestamp = new Date().toISOString();
  const force = input.force === true;
  const availableSubjects = previewAmlSubjects();
  const selectedKeys = new Set(
    input.subjectKeys?.length
      ? input.subjectKeys
      : availableSubjects
          .filter(
            (subject) =>
              subject.subjectKey === "ROOT" || subject.entityType === "PERSON"
          )
          .map((subject) => subject.subjectKey)
  );
  const selectedSubjects = availableSubjects.filter((subject) =>
    selectedKeys.has(subject.subjectKey)
  );
  const suffix = `${Date.now()}-${force ? "force" : "initial"}`;
  return {
    enabled: true,
    configured: true,
    canReviewHits: true,
    currentInputFingerprint: "preview-current",
    isStale: false,
    availableSubjects,
    batch: {
      id: `preview-aml-batch-${suffix}`,
      acceptanceRequestId: acceptanceId,
      clientId: null,
      requestFingerprint: "preview-current",
      forceRun: force,
      status: "COMPLETED",
      subjectCount: selectedSubjects.length,
      attentionCount: 0,
      errorCount: 0,
      triggeredBy: { id: previewUser.id, name: previewUser.name },
      createdAt: timestamp,
      completedAt: timestamp,
      subjects: selectedSubjects.map((subject, index) => ({
        id: `preview-aml-screening-${suffix}-${index}`,
        subjectKey: subject.subjectKey,
        entityType: subject.entityType,
        roles: subject.roles,
        displayName: subject.displayName,
        status: subject.ready ? "APPROVED" : "ERROR",
        score: subject.ready ? 0 : null,
        totalHits: 0,
        warnings: subject.warnings,
        errorCode: subject.ready ? null : "SUBJECT_DATA_INCOMPLETE",
        errorMessage: subject.ready
          ? null
          : "A legal name is required before this subject can be screened",
        diditRequestId: subject.ready
          ? `11111111-2222-4333-8444-${String(Date.now()).slice(-12)}`
          : null,
        startedAt: timestamp,
        completedAt: timestamp,
        hits: [],
      })),
    },
  };
}

function previewAmlSubjects(): CmpAmlLatestResponse["availableSubjects"] {
  return [
    {
      subjectKey: "ROOT",
      entityType: "COMPANY",
      roles: ["CLIENT"],
      displayName: "Preview Client Limited",
      ready: true,
      warnings: [],
    },
    {
      subjectKey: "COMPANY:DRAFT:group-company",
      entityType: "COMPANY",
      roles: ["GROUP_COMPANY", "OWNER"],
      displayName: "Preview Group Holdings Limited",
      ready: true,
      warnings: [],
    },
    {
      subjectKey: "PERSON:DRAFT:beneficial-owner",
      entityType: "PERSON",
      roles: ["BENEFICIAL_OWNER", "DIRECTOR"],
      displayName: "Preview Beneficial Owner",
      ready: true,
      warnings: [],
    },
  ];
}

function getSafeErrorMessage(status: number) {
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "You do not have permission to complete this action.";
  }
  if (status === 404) {
    return "The requested record could not be found.";
  }
  if (status === 409) {
    return "This record has changed. Refresh and try again.";
  }
  if (status >= 500) {
    return "The server is unavailable. Please try again later.";
  }
  return "The request could not be completed. Please try again.";
}
