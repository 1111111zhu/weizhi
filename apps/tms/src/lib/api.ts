import type {
  TmsApprovalActionInput,
  TmsApprovalEditInput,
  TmsApprovalProject,
  TmsApprovalProjectsResponse,
  TmsApprovalRecord,
  TmsApprovalRecordsResponse,
  TmsApprovalReturnInput,
  TmsApprovalStatus,
  TmsEngagementDirectoryResponse,
  TmsOverviewPeriod,
  TmsOverviewResponse,
  TmsProjectLink,
  TmsSaveDraftInput,
  TmsSubmitInput,
  TmsTimesheetMonth,
  TmsTimesheetQueryInput,
  TmsTimesheetQueryResponse,
  WorkItemListResponse,
} from "@project-wing/shared";
import {
  EMAIL_SIGN_IN_OTP_MOCK_CODE,
  EmailOtpClientError,
  TmsApprovalProjectsResponseSchema,
  TmsApprovalRecordSchema,
  TmsApprovalRecordsResponseSchema,
  TmsOverviewResponseSchema,
  TmsProjectLinkSchema,
  TmsTimesheetMonthSchema,
  TmsTimesheetQueryResponseSchema,
  requestEmailPasswordResetOtp,
  requestEmailSignInOtp,
  resetPasswordWithEmailOtp,
  signInWithBetterAuth,
  signInWithEmailOtp,
  signOutWithBetterAuth,
  verifyEmailPasswordResetOtp,
} from "@project-wing/shared";

import { toEngagement } from "./timesheet";
import type { Engagement } from "./timesheet";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? API_BASE_URL;
const PREVIEW_SESSION_KEY = "project-wing-tms-preview-user";
const previewTimesheetMonths = new Map<string, TmsTimesheetMonth>();

export type User = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
};

export const previewUser: User = {
  id: "preview-partner",
  email: "partner@projectwing.local",
  name: "Partner",
  globalRole: "PARTNER",
};

const previewCmpEngagements: Engagement[] = [
  {
    engagementId: "engagement-orchid-2026",
    projectId: "project-orchid-group-2026",
    projectCode: "ORC-2026-AUD-GROUP",
    projectName: "Group reporting",
    engagementCode: "ORC-2026-AUD",
    clientCode: "C-ORC-2026",
    clientName: "Orchid Technology Limited",
    budgetedHours: "420.00",
    agreedFee: "180000.00",
    recoveryRate: null,
    feeCurrency: "HKD",
    pic: "Jony Ma",
    mic: "Eden Chan",
    codeAliases: ["ORC-2025-AUD"],
    timesheetAccess: { allowed: true, reason: "ALLOWED" },
  },
  {
    engagementId: "engagement-orchid-2026",
    projectId: "project-orchid-hk-2026",
    projectCode: "ORC-2026-AUD-HK",
    projectName: "Hong Kong component",
    engagementCode: "ORC-2026-AUD",
    clientCode: "C-ORC-2026",
    clientName: "Orchid Technology Limited",
    budgetedHours: "420.00",
    agreedFee: "180000.00",
    recoveryRate: null,
    feeCurrency: "HKD",
    pic: "Jony Ma",
    mic: "Eden Chan",
    codeAliases: ["ORC-2025-AUD"],
    timesheetAccess: { allowed: true, reason: "ALLOWED" },
  },
];
const previewApprovalProjects: TmsApprovalProject[] = [
  {
    engagementId: "engagement-orchid-2026",
    engagementCode: "ORC-2026-AUD",
    clientCode: "C-ORC-2026",
    clientName: "Orchid Technology Limited",
    pic: "Partner",
    mic: "Jony Ma",
    status: "ACTIVE",
    pendingCount: 2,
    returnedCount: 1,
    projectCount: 2,
  },
  {
    engagementId: "engagement-harbour-2026",
    engagementCode: "HBR-2026-ACC",
    clientCode: "C-HBR-2026",
    clientName: "Harbour Retail Limited",
    pic: "Partner",
    mic: "Jony Ma",
    status: "ARCHIVED",
    pendingCount: 1,
    returnedCount: 0,
    projectCount: 1,
  },
];
const previewApprovalRecords: TmsApprovalRecord[] = [
  {
    id: "approval-orchid-jony-first",
    ownerUserId: "employee-jony",
    ownerName: "Jony Ma",
    ownerEmail: "jony.ma@projectwing.local",
    year: 2026,
    month: 7,
    half: "FIRST_HALF",
    engagementId: "engagement-orchid-2026",
    engagementCode: "ORC-2026-AUD",
    projectId: "project-orchid-group-2026",
    projectCode: "ORC-2026-AUD-GROUP",
    projectName: "Group reporting",
    clientCode: "C-ORC-2026",
    clientName: "Orchid Technology Limited",
    revision: 2,
    status: "SUBMITTED",
    submittedRows: [
      {
        id: "row-orchid-jony",
        engagementId: "engagement-orchid-2026",
        projectId: "project-orchid-group-2026",
        periodScope: "first",
        type: "Chargeable",
        details: "Fieldwork",
        description: "Sample testing and walkthroughs",
        hoursByDate: { "2026-07-14": 8 },
        periodTotal: 8,
      },
    ],
    submittedAt: "2026-07-16T09:00:00.000Z",
    reviewedById: null,
    reviewedAt: null,
    returnReason: null,
  },
  {
    id: "approval-orchid-amy-first",
    ownerUserId: "employee-amy",
    ownerName: "Amy Chan",
    ownerEmail: "amy.chan@projectwing.local",
    year: 2026,
    month: 7,
    half: "FIRST_HALF",
    engagementId: "engagement-orchid-2026",
    engagementCode: "ORC-2026-AUD",
    projectId: "project-orchid-hk-2026",
    projectCode: "ORC-2026-AUD-HK",
    projectName: "Hong Kong component",
    clientCode: "C-ORC-2026",
    clientName: "Orchid Technology Limited",
    revision: 1,
    status: "RETURNED",
    submittedRows: [],
    submittedAt: "2026-07-16T08:00:00.000Z",
    reviewedById: "preview-partner",
    reviewedAt: "2026-07-16T10:00:00.000Z",
    returnReason: "请补充 7 月 8 日的测试底稿说明。",
  },
  {
    id: "approval-harbour-li-second",
    ownerUserId: "employee-li",
    ownerName: "Li Wei",
    ownerEmail: "li.wei@projectwing.local",
    year: 2026,
    month: 7,
    half: "SECOND_HALF",
    engagementId: "engagement-harbour-2026",
    engagementCode: "HBR-2026-ACC",
    projectId: "project-harbour-2026",
    projectCode: "HBR-2026-ACC-01",
    projectName: "Annual accounts",
    clientCode: "C-HBR-2026",
    clientName: "Harbour Retail Limited",
    revision: 1,
    status: "SUBMITTED",
    submittedRows: [],
    submittedAt: "2026-07-18T08:00:00.000Z",
    reviewedById: null,
    reviewedAt: null,
    returnReason: null,
  },
];

export function getTmsTimesheetQuery(
  input: TmsTimesheetQueryInput
): Promise<TmsTimesheetQueryResponse> {
  return approvalRequest(
    `/tms/timesheets/query?${toTmsQueryParams(input).toString()}`,
    TmsTimesheetQueryResponseSchema
  );
}

export async function downloadTmsTimesheetQuery(input: TmsTimesheetQueryInput) {
  const response = await fetch(
    `${API_BASE_URL}/tms/timesheets/query/export?${toTmsQueryParams(input).toString()}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("Unable to export timesheet query.");
  }
  return {
    blob: await response.blob(),
    fileName:
      response.headers
        .get("content-disposition")
        ?.match(/filename="?([^";]+)"?/)?.[1] ?? "tms-timesheet-query.xlsx",
  };
}

function toTmsQueryParams(input: TmsTimesheetQueryInput) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}

export function getTmsApprovalProjects(
  year?: number,
  month?: number,
  query = ""
): Promise<TmsApprovalProjectsResponse> {
  if (isMockMode()) {
    const normalized = query.trim().toLowerCase();
    return Promise.resolve({
      projects: normalized
        ? previewApprovalProjects.filter((project) =>
            `${project.engagementCode} ${project.clientCode} ${project.clientName}`
              .toLowerCase()
              .includes(normalized)
          )
        : previewApprovalProjects,
    });
  }
  const params = new URLSearchParams();
  if (year !== undefined && month !== undefined) {
    params.set("year", String(year));
    params.set("month", String(month));
  }
  if (query.trim()) {
    params.set("q", query.trim());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return approvalRequest(
    `/tms/timesheets/approvals/engagements${suffix}`,
    TmsApprovalProjectsResponseSchema
  );
}

export function getTmsOverview(
  year: number,
  month: number,
  period: TmsOverviewPeriod = "all"
): Promise<TmsOverviewResponse> {
  if (isMockMode()) {
    return Promise.resolve({ year, month, period, employees: [] });
  }
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    period,
  });
  return approvalRequest(
    `/tms/timesheets/overview?${params.toString()}`,
    TmsOverviewResponseSchema
  );
}

export function getTmsApprovalRecords(
  engagementId: string,
  year: number,
  month: number,
  query: { status?: TmsApprovalRecord["status"]; q?: string } = {}
): Promise<TmsApprovalRecordsResponse> {
  if (isMockMode()) {
    return Promise.resolve({
      records: previewApprovalRecords.filter(
        (record) =>
          record.engagementId === engagementId &&
          record.year === year &&
          record.month === month &&
          (!query.status || record.status === query.status) &&
          (!query.q ||
            `${record.ownerName} ${record.ownerEmail}`
              .toLowerCase()
              .includes(query.q.toLowerCase()))
      ),
    });
  }
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }
  return approvalRequest(
    `/tms/timesheets/approvals/engagements/${encodeURIComponent(engagementId)}/submissions?${params.toString()}`,
    TmsApprovalRecordsResponseSchema
  );
}

export function approveTmsSubmission(
  submissionId: string,
  input: TmsApprovalActionInput
) {
  if (isMockMode()) {
    return updatePreviewApproval(
      submissionId,
      "APPROVED",
      undefined,
      input.restoreStatus
    );
  }
  return approvalRequest(
    `/tms/timesheets/approvals/${encodeURIComponent(submissionId)}/approve`,
    TmsApprovalRecordSchema,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function returnTmsSubmission(
  submissionId: string,
  input: TmsApprovalReturnInput
) {
  if (isMockMode()) {
    return updatePreviewApproval(submissionId, "RETURNED", input.reason);
  }
  return approvalRequest(
    `/tms/timesheets/approvals/${encodeURIComponent(submissionId)}/return`,
    TmsApprovalRecordSchema,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function editTmsSubmission(
  submissionId: string,
  input: TmsApprovalEditInput
) {
  if (isMockMode()) {
    const current = previewApprovalRecords.find(
      (record) => record.id === submissionId
    );
    if (!current || current.status === "NOT_SUBMITTED") {
      throw new Error("该员工尚未提交，不能修改审批快照");
    }
    if (current.revision !== input.expectedRevision) {
      throw new Error("提交版本已更新，请刷新后再保存");
    }
    current.revision += 1;
    current.status = input.rows.some((row) =>
      Object.values(row.hoursByDate).some((hours) => hours > 0)
    )
      ? "PENDING_CONFIRMATION"
      : "NOT_SUBMITTED";
    current.submittedRows = input.rows;
    current.submittedAt =
      current.status === "NOT_SUBMITTED" ? null : new Date().toISOString();
    current.reviewedById = null;
    current.reviewedAt = null;
    current.returnReason = null;
    return current;
  }
  return approvalRequest(
    `/tms/timesheets/approvals/${encodeURIComponent(submissionId)}`,
    TmsApprovalRecordSchema,
    { method: "PUT", body: JSON.stringify(input) }
  );
}

export async function login(
  email: string,
  password: string,
  rememberMe = false
): Promise<User> {
  if (isMockMode()) {
    return previewLogin(email);
  }

  await signInWithBetterAuth({
    baseURL: AUTH_BASE_URL,
    email,
    password,
    rememberMe,
  });
  const user = await rawMe();
  if (!user) {
    throw new Error("Unable to establish the TMS session.");
  }
  return user;
}

export async function listDevelopmentAccounts() {
  if (isMockMode()) {
    return [
      {
        email: previewUser.email,
        name: previewUser.name,
        role: previewUser.globalRole,
      },
    ];
  }
  const response = await fetch(`${AUTH_BASE_URL}/auth/development/accounts`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Unable to load TMS development accounts.");
  }
  const body = (await response.json()) as {
    accounts: { email: string; name: string; globalRole: string }[];
  };
  return body.accounts.map(({ email, name, globalRole }) => ({
    email,
    name,
    role: globalRole,
  }));
}

export async function impersonateDevelopmentAccount(
  email: string
): Promise<User> {
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
    throw new Error("Unable to impersonate the TMS development account.");
  }
  const user = await rawMe();
  if (!user) {
    throw new Error("Unable to establish the TMS session.");
  }
  return user;
}

export async function requestLoginOtp(email: string) {
  if (isMockMode()) {
    return { demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as {
      demoCode?: string;
    };
  }
  await requestEmailSignInOtp({ baseURL: AUTH_BASE_URL, email });
  return {} as { demoCode?: string };
}

export async function loginWithOtp(email: string, otp: string): Promise<User> {
  if (isMockMode()) {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return previewLogin(email);
  }

  await signInWithEmailOtp({ baseURL: AUTH_BASE_URL, email, otp });
  const user = await rawMe();
  if (!user) {
    throw new Error("Unable to establish the TMS session.");
  }
  return user;
}

export async function requestPasswordResetOtp(email: string) {
  if (isMockMode()) {
    return { demoCode: EMAIL_SIGN_IN_OTP_MOCK_CODE } as { demoCode?: string };
  }
  await requestEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, email });
  return {} as { demoCode?: string };
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  password: string
) {
  if (isMockMode()) {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return;
  }
  await resetPasswordWithEmailOtp({
    baseURL: AUTH_BASE_URL,
    email,
    otp,
    password,
  });
}

export async function verifyPasswordResetOtp(email: string, otp: string) {
  if (isMockMode()) {
    if (otp !== EMAIL_SIGN_IN_OTP_MOCK_CODE) {
      throw new EmailOtpClientError("OTP_INVALID", 400);
    }
    return;
  }
  await verifyEmailPasswordResetOtp({ baseURL: AUTH_BASE_URL, email, otp });
}

export async function signOut() {
  if (isMockMode()) {
    clearPreviewSession();
    return;
  }
  await signOutWithBetterAuth(AUTH_BASE_URL);
}

export function me() {
  return rawMe();
}

export async function loadTmsWorkItems(
  locale: "zh-CN" | "en-US" = "zh-CN"
): Promise<WorkItemListResponse> {
  if (isMockMode()) {
    const now = new Date().toISOString();
    return {
      items: [
        {
          id: "TMS-001:preview",
          ruleId: "TMS-001",
          domain: "TMS",
          view: "PERSONAL",
          category: "TIMESHEET",
          state: "OPEN",
          severity: "ACTION_REQUIRED",
          priority: "HIGH",
          title:
            locale === "zh-CN"
              ? "您还没有填报 2026 年 8 月下半月的工时，请尽快填报。"
              : "You have not completed your timesheet for the second half of August 2026. Please complete it as soon as possible.",
          description:
            locale === "zh-CN"
              ? "当前期间尚未提交"
              : "The current period has not been submitted",
          subjectType: "TMS_PERIOD",
          subjectId: "preview-period",
          project: null,
          reference: "2026-08",
          objectLabel:
            locale === "zh-CN" ? "2026年8月下半月" : "2026-08 second half",
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
            app: "TMS",
            resourceType: "TMS_PERIOD",
            resourceId: "preview-period",
            params: { year: 2026, month: 8, half: "SECOND_HALF" },
          },
        },
      ],
      categories: [
        {
          category: "TIMESHEET",
          label: locale === "zh-CN" ? "工时填报" : "Timesheet",
          total: 1,
          blockers: 0,
          earliestOpenedAt: now,
        },
      ],
      counts: { total: 1, EMP: 0, PROJECT: 0, CMP: 0, TMS: 1, OPS: 0 },
    };
  }
  const response = await fetch(
    `${API_BASE_URL}/work-items?view=PERSONAL&scope=TMS&locale=${locale}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("Unable to load TMS work items.");
  }
  return (await response.json()) as WorkItemListResponse;
}

async function rawMe() {
  if (isMockMode()) {
    return previewSessionUser();
  }

  const response = await fetch(`${API_BASE_URL}/account/me`, {
    credentials: "include",
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error("The account service is unavailable.");
  }
  return (await response.json()) as User;
}

export function getCmpEngagementDirectory(
  query = "",
  signal?: AbortSignal
): Promise<Engagement[]> {
  return tmsEngagementDirectory(query, signal);
}

export function loadTimesheetMonth(
  year: number,
  month: number
): Promise<TmsTimesheetMonth> {
  if (isTimesheetMockMode()) {
    return Promise.resolve(
      previewTimesheetMonths.get(`${year}-${month}`) ??
        emptyTimesheetMonth(year, month, "PREVIEW_MEMORY")
    );
  }
  return timesheetRequest(`/tms/timesheets/${year}/${month}`);
}

export function saveTimesheetDraft(
  year: number,
  month: number,
  input: TmsSaveDraftInput
): Promise<TmsTimesheetMonth> {
  if (isTimesheetMockMode()) {
    const current =
      previewTimesheetMonths.get(`${year}-${month}`) ??
      emptyTimesheetMonth(year, month, "PREVIEW_MEMORY");
    const saved = { ...current, rows: input.rows };
    previewTimesheetMonths.set(`${year}-${month}`, saved);
    return Promise.resolve(saved);
  }
  return timesheetRequest(`/tms/timesheets/${year}/${month}/draft`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function submitTimesheet(
  year: number,
  month: number,
  input: TmsSubmitInput
): Promise<TmsTimesheetMonth> {
  if (isTimesheetMockMode()) {
    const current =
      previewTimesheetMonths.get(`${year}-${month}`) ??
      emptyTimesheetMonth(year, month, "PREVIEW_MEMORY");
    const halves =
      input.scope === "ALL"
        ? (["FIRST_HALF", "SECOND_HALF"] as const)
        : ([input.scope] as const);
    const periods = { ...current.periods };
    for (const half of halves) {
      if (periods[half].status !== "APPROVED") {
        periods[half] = {
          status: "SUBMITTED",
          revision: periods[half].revision + 1,
          editable: true,
          approvalStatus: "SUBMITTED",
        };
      }
    }
    const saved = { ...current, periods };
    previewTimesheetMonths.set(`${year}-${month}`, saved);
    return Promise.resolve(saved);
  }
  return timesheetRequest(`/tms/timesheets/${year}/${month}/submit`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function unlinkTmsProject(rowId: string): Promise<TmsProjectLink> {
  if (isTimesheetMockMode()) {
    throw new Error("TMS project links are unavailable in preview mode.");
  }
  return projectLinkRequest(
    `/tms/timesheets/project-links/${encodeURIComponent(rowId)}`,
    TmsProjectLinkSchema,
    { method: "DELETE" }
  );
}

export function linkTmsProject(
  rowId: string,
  projectId: string
): Promise<TmsProjectLink> {
  if (isTimesheetMockMode()) {
    throw new Error("TMS project links are unavailable in preview mode.");
  }
  return projectLinkRequest(
    "/tms/timesheets/project-links",
    TmsProjectLinkSchema,
    {
      method: "POST",
      body: JSON.stringify({ rowId, projectId }),
    }
  );
}

export class TmsRequestError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "TmsRequestError";
    this.code = code;
    this.status = status;
  }
}

async function timesheetRequest(
  path: string,
  init: RequestInit = {}
): Promise<TmsTimesheetMonth> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new TmsRequestError(
      payload.message ?? `TMS request failed (${response.status})`,
      response.status,
      payload.code
    );
  }
  return TmsTimesheetMonthSchema.parse(await response.json());
}

async function projectLinkRequest<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new TmsRequestError(
      payload.message ?? `TMS project link request failed (${response.status})`,
      response.status,
      payload.code
    );
  }
  return schema.parse(await response.json());
}

async function approvalRequest<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(
      payload.message ?? `TMS approval request failed (${response.status})`
    );
  }
  return schema.parse(await response.json());
}

function updatePreviewApproval(
  submissionId: string,
  action: "APPROVED" | "RETURNED",
  reason?: string,
  restoreStatus?: TmsApprovalActionInput["restoreStatus"]
) {
  const record = previewApprovalRecords.find(
    (item) => item.id === submissionId
  );
  if (!record) {
    throw new Error("审批记录不存在");
  }
  const previousStatus = record.status;
  const nextStatus: TmsApprovalStatus | null =
    action === "APPROVED"
      ? record.status === "APPROVED"
        ? (restoreStatus ?? "SUBMITTED")
        : record.status === "SUBMITTED" ||
            record.status === "PENDING_CONFIRMATION"
          ? "APPROVED"
          : null
      : record.status === "RETURNED"
        ? "SUBMITTED"
        : record.status === "SUBMITTED" ||
            record.status === "PENDING_CONFIRMATION"
          ? "RETURNED"
          : null;
  if (!nextStatus) {
    throw new Error("当前状态不能执行该操作");
  }
  record.status = nextStatus;
  record.reviewedById =
    nextStatus === "SUBMITTED" || nextStatus === "PENDING_CONFIRMATION"
      ? null
      : previewUser.id;
  record.reviewedAt =
    nextStatus === "SUBMITTED" || nextStatus === "PENDING_CONFIRMATION"
      ? null
      : new Date().toISOString();
  record.returnReason = nextStatus === "RETURNED" ? (reason ?? null) : null;
  const project = previewApprovalProjects.find(
    (item) => item.engagementId === record.engagementId
  );
  if (project) {
    if (
      isPreviewApprovalPendingStatus(previousStatus) !==
      isPreviewApprovalPendingStatus(nextStatus)
    ) {
      project.pendingCount += isPreviewApprovalPendingStatus(nextStatus)
        ? 1
        : -1;
    }
    if ((previousStatus === "RETURNED") !== (nextStatus === "RETURNED")) {
      project.returnedCount = Math.max(
        0,
        project.returnedCount + (nextStatus === "RETURNED" ? 1 : -1)
      );
    }
  }
  return record;
}

function isPreviewApprovalPendingStatus(status: TmsApprovalStatus) {
  return status === "SUBMITTED" || status === "PENDING_CONFIRMATION";
}

function emptyTimesheetMonth(
  year: number,
  month: number,
  persistence: TmsTimesheetMonth["persistence"]
): TmsTimesheetMonth {
  return {
    year,
    month,
    rows: [],
    persistence,
    periods: {
      FIRST_HALF: {
        status: "DRAFT",
        revision: 0,
        editable: true,
        approvalStatus: "NOT_SUBMITTED",
      },
      SECOND_HALF: {
        status: "DRAFT",
        revision: 0,
        editable: true,
        approvalStatus: "NOT_SUBMITTED",
      },
    },
  };
}

export async function tmsEngagementDirectory(
  query = "",
  signal?: AbortSignal
): Promise<Engagement[]> {
  if (isMockMode()) {
    return filterPreviewCmpEngagements(query);
  }

  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(
    `${API_BASE_URL}/cmp/integrations/tms/engagements${suffix}`,
    {
      cache: "no-store",
      credentials: "include",
      ...(signal ? { signal } : {}),
    }
  );
  if (!response.ok) {
    throw new Error("Unable to load the live CMP engagement directory.");
  }

  const payload = (await response.json()) as TmsEngagementDirectoryResponse;
  return payload.engagements.map(toEngagement);
}

function previewLogin(email: string): User {
  const user = { ...previewUser, email: email.trim() || previewUser.email };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREVIEW_SESSION_KEY, user.email);
  }
  return user;
}

function isMockMode() {
  return process.env.NEXT_PUBLIC_API_MODE === "mock";
}

function isTimesheetMockMode() {
  return process.env.NEXT_PUBLIC_API_MODE === "mock";
}

function previewSessionUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }
  const email = window.localStorage.getItem(PREVIEW_SESSION_KEY);
  return email ? { ...previewUser, email } : null;
}

function clearPreviewSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PREVIEW_SESSION_KEY);
}

function filterPreviewCmpEngagements(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return previewCmpEngagements;
  }
  return previewCmpEngagements.filter((engagement) =>
    [
      engagement.engagementCode,
      engagement.projectCode ?? "",
      engagement.projectName ?? "",
      engagement.clientCode,
      engagement.clientName,
      ...engagement.codeAliases,
    ].some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}
