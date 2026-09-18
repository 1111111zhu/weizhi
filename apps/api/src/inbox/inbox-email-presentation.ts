import type {
  InboxContentKey,
  InboxContentParameter,
} from "@project-wing/shared";

import type {
  SystemEmailFact,
  SystemEmailLocale,
  SystemEmailTone,
} from "../mail/system-email-template";

type InboxEmailPresentationInput = {
  contentKey?: InboxContentKey | null;
  contentParams?: Record<string, InboxContentParameter> | null;
  locale: SystemEmailLocale;
};

const successKeys = new Set<InboxContentKey>([
  "WORKING_PAPER_PREPARED",
  "WORKING_PAPER_REVIEWED",
  "REVIEW_QUESTION_REPLIED",
  "PROJECT_ARCHIVE_COMPLETED",
  "CMP_ENGAGEMENT_APPROVED",
  "CMP_ACCEPTANCE_APPROVED",
]);

const warningKeys = new Set<InboxContentKey>([
  "REVIEW_QUESTION_FOLLOW_UP",
  "REVIEW_QUESTION_REOPENED",
  "ATTACHMENT_CONFLICT",
  "PROJECT_ARCHIVE_REVIEW_RETURNED",
  "PROJECT_ARCHIVE_DEADLINE_REMINDER",
  "TMS_TIMESHEET_RETURNED",
  "CMP_ACCEPTANCE_DRAFT_RECALLED",
  "CMP_ACCEPTANCE_RETURNED",
]);

const actionKeys = new Set<InboxContentKey>([
  "PROJECT_INVITATION",
  "REVIEW_QUESTION_ASSIGNED",
  "PROJECT_ARCHIVE_REVIEW_REQUESTED",
  "CMP_ACCEPTANCE_SUBMITTED",
  "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
  "CMP_ACCEPTANCE_DRAFT_ASSIGNED",
  "CMP_ACCEPTANCE_DRAFT_COMPLETED",
  "CMP_ACCEPTANCE_STEP_ADVANCED",
  "CMP_ACCEPTANCE_NEXT_APPROVER",
]);

export function resolveInboxEmailPresentation(
  input: InboxEmailPresentationInput
) {
  const tone = resolveTone(input.contentKey);
  const area = resolveArea(input.contentKey);
  const english = input.locale === "en-US";
  return {
    actionLabel: resolveActionLabel(input.contentKey, english),
    eyebrow: `${resolveStateLabel(tone, english)} · ${area}`,
    facts: resolveFacts(input.contentParams, english),
    tone,
  };
}

function resolveTone(contentKey?: InboxContentKey | null): SystemEmailTone {
  if (contentKey && successKeys.has(contentKey)) {
    return "success";
  }
  if (contentKey && warningKeys.has(contentKey)) {
    return "warning";
  }
  if (contentKey && actionKeys.has(contentKey)) {
    return "action";
  }
  return "neutral";
}

function resolveArea(contentKey?: InboxContentKey | null) {
  if (!contentKey) {
    return "Project Wing";
  }
  if (contentKey.startsWith("CMP_")) {
    return "CMP";
  }
  if (contentKey.startsWith("TMS_")) {
    return "TMS";
  }
  if (contentKey.startsWith("PROJECT_ARCHIVE_")) {
    return "Archive · EMP";
  }
  if (contentKey.startsWith("REVIEW_QUESTION_")) {
    return "Review · EMP";
  }
  if (contentKey.startsWith("WORKING_PAPER_")) {
    return "Workpaper · EMP";
  }
  if (contentKey === "ATTACHMENT_CONFLICT") {
    return "File versions · EMP";
  }
  return "EMP";
}

function resolveStateLabel(tone: SystemEmailTone, english: boolean) {
  if (english) {
    return {
      action: "Action required",
      neutral: "Notification",
      security: "Security",
      success: "Completed",
      warning: "Attention",
    }[tone];
  }
  return {
    action: "待办",
    neutral: "通知",
    security: "安全",
    success: "已完成",
    warning: "需要注意",
  }[tone];
}

function resolveActionLabel(
  contentKey: InboxContentKey | null | undefined,
  english: boolean
) {
  const labels = english
    ? {
        cmp: "Open request",
        default: "View details",
        invitation: "Open invitation",
        project: "Open project",
        review: "Open review note",
        tms: "Open TMS",
      }
    : {
        cmp: "打开申请",
        default: "查看详情",
        invitation: "打开邀请",
        project: "打开项目",
        review: "打开复核问题",
        tms: "打开 TMS",
      };
  if (!contentKey) {
    return labels.default;
  }
  if (contentKey === "PROJECT_INVITATION") {
    return labels.invitation;
  }
  if (contentKey.startsWith("REVIEW_QUESTION_")) {
    return labels.review;
  }
  if (contentKey.startsWith("CMP_")) {
    return labels.cmp;
  }
  if (contentKey.startsWith("TMS_")) {
    return labels.tms;
  }
  if (
    contentKey.startsWith("PROJECT_ARCHIVE_") ||
    contentKey.startsWith("WORKING_PAPER_") ||
    contentKey === "ATTACHMENT_CONFLICT"
  ) {
    return labels.project;
  }
  return labels.default;
}

function resolveFacts(
  params: Record<string, InboxContentParameter> | null | undefined,
  english: boolean
) {
  if (!params) {
    return [];
  }
  const facts: SystemEmailFact[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value?.trim()) {
      facts.push({ label, value: value.trim() });
    }
  };
  const text = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const project = [text("projectCode"), text("projectName")]
    .filter(Boolean)
    .join(" · ");
  const paper = [text("paperCode"), text("paperTitle")]
    .filter(Boolean)
    .join(" · ");
  add(english ? "Project" : "项目", project);
  add(english ? "Workpaper" : "底稿", paper);
  add(english ? "Request" : "申请编号", text("requestNo"));
  add(english ? "File" : "文件", text("fileName"));
  add(english ? "Engagement" : "项目编号", text("engagementCode"));
  return facts.slice(0, 4);
}
