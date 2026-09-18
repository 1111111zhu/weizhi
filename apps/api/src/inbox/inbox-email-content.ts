import type {
  InboxContentKey,
  InboxContentParameter,
} from "@project-wing/shared";

export type InboxLocale = "zh-CN" | "en-US";

type InboxEmailTemplate = {
  title: string;
  body: string;
  bodyOne?: string;
  bodyWithReason?: string;
  bodyWithoutReason?: string;
};

type InboxEmailContentInput = {
  contentKey?: InboxContentKey | null;
  contentParams?: Record<string, InboxContentParameter> | null;
  fallbackTitle: string;
  fallbackBody: string;
};

const templates: Record<
  InboxLocale,
  Record<InboxContentKey, InboxEmailTemplate>
> = {
  "zh-CN": {
    PROJECT_INVITATION: {
      title: "{actor} 邀请你加入审计项目",
      body: "{projectCode} {projectName}，项目职责：{role}",
    },
    WORKING_PAPER_PREPARED: {
      title: "底稿已完成编制：{paperCode}",
      body: "{actor} 已编制签署底稿 {paperCode} {paperTitle}。",
    },
    WORKING_PAPER_REVIEWED: {
      title: "底稿已完成复核：{paperCode}",
      body: "{actor} 已复核签署底稿 {paperCode} {paperTitle}。",
    },
    REVIEW_QUESTION_ASSIGNED: {
      title: "复核问题待回复：{paperCode}",
      body: "{actor} 指派你处理底稿 {paperCode} {paperTitle} 的复核问题：{question}",
    },
    REVIEW_QUESTION_REPLIED: {
      title: "复核问题已回复：{paperCode}",
      body: "{actor} 回复了底稿 {paperCode} {paperTitle} 的复核问题：{question}",
    },
    REVIEW_QUESTION_FOLLOW_UP: {
      title: "复核问题需补充：{paperCode}",
      body: "{actor} 继续追问底稿 {paperCode} {paperTitle} 的复核问题：{question}",
    },
    REVIEW_QUESTION_REOPENED: {
      title: "复核问题已重开：{paperCode}",
      body: "{actor} 重新打开底稿 {paperCode} {paperTitle} 的复核问题：{question}",
    },
    ATTACHMENT_CONFLICT: {
      title: "底稿版本冲突待裁决：{fileName}",
      body: "Desktop Agent 已保留冲突版本 {candidateVersionId}。该底稿已冻结，请由 PIC 选择服务端版本、冲突版本或共同父版本。",
    },
    PROJECT_ARCHIVE_COMPLETED: {
      title: "项目已成功归档：{projectCode}",
      body: "{projectName} 已成功归档。归档包：{packageFileName}",
    },
    PROJECT_ARCHIVE_REVIEW_REQUESTED: {
      title: "归档复核待处理：{projectCode}",
      body: "{projectName} 已提交最终归档复核。",
    },
    PROJECT_ARCHIVE_REVIEW_RETURNED: {
      title: "归档复核已退回：{projectCode}",
      body: "{projectName} 的最终归档复核已退回，项目现已恢复为可编辑状态。",
    },
    PROJECT_ARCHIVE_DEADLINE_REMINDER: {
      title: "归档期限提醒：{projectCode}",
      body: "项目“{projectName}”（{projectCode}）的归档期限为 {deadline}，距今 {days} 天。请准备归档提交。",
      bodyOne:
        "项目“{projectName}”（{projectCode}）的归档期限为 {deadline}，距今 1 天。请准备归档提交。",
    },
    TMS_TIMESHEET_RETURNED: {
      title: "TMS 工时已退回",
      body: "你的 {year} 年 {month} 月{half}工时已退回，请打开 TMS 查看并修正。",
      bodyWithReason:
        "你的 {year} 年 {month} 月{half}工时已退回。理由：{reason}",
    },
    CMP_ENGAGEMENT_APPROVED: {
      title: "{engagementCode} 承接已最终批准",
      body: "项目 {engagementCode} 已完成最终审批，现已可在 EMP 创建项目。",
    },
    CMP_ACCEPTANCE_SUBMITTED: {
      title: "{requestNo} 已提交成功",
      body: "{acceptanceType}已提交，当前等待 MIC 审批：{subject}。",
    },
    CMP_ACCEPTANCE_APPROVAL_REQUESTED: {
      title: "{requestNo} 等待你进行 {step} 审批",
      body: "{actor} 提交了{acceptanceType}：{subject}。当前步骤：{step} 审批。",
    },
    CMP_ACCEPTANCE_DRAFT_ASSIGNED: {
      title: "{requestNo} 草稿已分派给你",
      body: "{actor} 已将{acceptanceType}草稿分派给你完成：{subject}。",
    },
    CMP_ACCEPTANCE_DRAFT_RECALLED: {
      title: "{requestNo} 草稿已被撤回",
      body: "{actor} 已撤回分派给你的{acceptanceType}草稿：{subject}。",
    },
    CMP_ACCEPTANCE_DRAFT_COMPLETED: {
      title: "{requestNo} 草稿已完成",
      body: "{actor} 已完成委派草稿：{subject}。当前等待{nextReviewer}复核。",
    },
    CMP_ACCEPTANCE_STEP_ADVANCED: {
      title: "{requestNo} 已通过 {completedStep} 审批",
      body: "{actor} 已完成审批，申请已进入 {nextStep} 审批：{subject}。",
    },
    CMP_ACCEPTANCE_NEXT_APPROVER: {
      title: "{requestNo} 已进入你的审批环节",
      body: "{actor} 已完成 {completedStep} 审批。{acceptanceType}：{subject}。",
    },
    CMP_ACCEPTANCE_APPROVED: {
      title: "{requestNo} 已通过",
      body: "{actor} 已完成最终审批，{acceptanceType}已写入主数据：{subject}。",
    },
    CMP_ACCEPTANCE_RETURNED: {
      title: "{requestNo} 已被退回",
      body: "{actor} 退回了{acceptanceType}：{subject}。原因：{reason}",
      bodyWithoutReason:
        "{actor} 退回了{acceptanceType}：{subject}。未填写退回原因。",
    },
  },
  "en-US": {
    PROJECT_INVITATION: {
      title: "{actor} invited you to an audit project",
      body: "{projectCode} {projectName}. Project role: {role}.",
    },
    WORKING_PAPER_PREPARED: {
      title: "Workpaper prepared: {paperCode}",
      body: "{actor} completed the preparer sign-off for {paperCode} {paperTitle}.",
    },
    WORKING_PAPER_REVIEWED: {
      title: "Workpaper reviewed: {paperCode}",
      body: "{actor} completed the reviewer sign-off for {paperCode} {paperTitle}.",
    },
    REVIEW_QUESTION_ASSIGNED: {
      title: "Review note awaiting reply: {paperCode}",
      body: "{actor} assigned you a review note on {paperCode} {paperTitle}: {question}",
    },
    REVIEW_QUESTION_REPLIED: {
      title: "Review note replied: {paperCode}",
      body: "{actor} replied to the review note on {paperCode} {paperTitle}: {question}",
    },
    REVIEW_QUESTION_FOLLOW_UP: {
      title: "Review note needs follow-up: {paperCode}",
      body: "{actor} followed up on the review note for {paperCode} {paperTitle}: {question}",
    },
    REVIEW_QUESTION_REOPENED: {
      title: "Review note reopened: {paperCode}",
      body: "{actor} reopened the review note for {paperCode} {paperTitle}: {question}",
    },
    ATTACHMENT_CONFLICT: {
      title: "File version conflict: {fileName}",
      body: "Desktop Agent preserved conflicting version {candidateVersionId}. The file is frozen until the PIC selects the server version, conflicting version, or common parent version.",
    },
    PROJECT_ARCHIVE_COMPLETED: {
      title: "Project successfully archived: {projectCode}",
      body: "{projectName} has been successfully archived. Archive package: {packageFileName}",
    },
    PROJECT_ARCHIVE_REVIEW_REQUESTED: {
      title: "Archive review requested: {projectCode}",
      body: "{projectName} has been submitted for final archive review.",
    },
    PROJECT_ARCHIVE_REVIEW_RETURNED: {
      title: "Archive review returned: {projectCode}",
      body: "{projectName} was returned from final archive review. The project is editable again.",
    },
    PROJECT_ARCHIVE_DEADLINE_REMINDER: {
      title: "Archive deadline reminder: {projectCode}",
      body: "The archive deadline for {projectName} ({projectCode}) is {deadline}, in {days} days. Please prepare the archive submission.",
      bodyOne:
        "The archive deadline for {projectName} ({projectCode}) is {deadline}, in 1 day. Please prepare the archive submission.",
    },
    TMS_TIMESHEET_RETURNED: {
      title: "TMS timesheet returned",
      body: "Your timesheet for the {half} of {month}/{year} was returned. Open TMS to review and correct it.",
      bodyWithReason:
        "Your timesheet for the {half} of {month}/{year} was returned. Reason: {reason}",
    },
    CMP_ENGAGEMENT_APPROVED: {
      title: "{engagementCode} acceptance finally approved",
      body: "Engagement {engagementCode} has received final approval and is now available for project creation in EMP.",
    },
    CMP_ACCEPTANCE_SUBMITTED: {
      title: "{requestNo} submitted",
      body: "{acceptanceType} was submitted and is awaiting MIC approval: {subject}.",
    },
    CMP_ACCEPTANCE_APPROVAL_REQUESTED: {
      title: "{requestNo} is awaiting your {step} approval",
      body: "{actor} submitted {acceptanceType}: {subject}. Current step: {step} approval.",
    },
    CMP_ACCEPTANCE_DRAFT_ASSIGNED: {
      title: "{requestNo} draft assigned to you",
      body: "{actor} assigned the {acceptanceType} draft to you: {subject}.",
    },
    CMP_ACCEPTANCE_DRAFT_RECALLED: {
      title: "{requestNo} draft recalled",
      body: "{actor} recalled the {acceptanceType} draft assigned to you: {subject}.",
    },
    CMP_ACCEPTANCE_DRAFT_COMPLETED: {
      title: "{requestNo} draft completed",
      body: "{actor} completed the delegated draft for {subject}. It is awaiting {nextReviewer} review.",
    },
    CMP_ACCEPTANCE_STEP_ADVANCED: {
      title: "{requestNo} passed {completedStep} approval",
      body: "{actor} approved the request. It has advanced to {nextStep} approval: {subject}.",
    },
    CMP_ACCEPTANCE_NEXT_APPROVER: {
      title: "{requestNo} is awaiting your approval",
      body: "{actor} completed {completedStep} approval. {acceptanceType}: {subject}.",
    },
    CMP_ACCEPTANCE_APPROVED: {
      title: "{requestNo} approved",
      body: "{actor} completed final approval. {acceptanceType} was applied to master data: {subject}.",
    },
    CMP_ACCEPTANCE_RETURNED: {
      title: "{requestNo} returned",
      body: "{actor} returned {acceptanceType}: {subject}. Reason: {reason}",
      bodyWithoutReason:
        "{actor} returned {acceptanceType}: {subject}. No reason was provided.",
    },
  },
};

export function normalizeInboxLocale(
  value: string | null | undefined
): InboxLocale {
  return value === "en-US" ? "en-US" : "zh-CN";
}

export function resolveInboxEmailContent(
  input: InboxEmailContentInput,
  preferredLocale: string | null | undefined
) {
  const locale = normalizeInboxLocale(preferredLocale);
  if (!input.contentKey || !input.contentParams) {
    return {
      locale,
      title: input.fallbackTitle,
      body: input.fallbackBody,
    };
  }

  const params = normalizeParameters(input.contentParams, locale);
  const template = templates[locale][input.contentKey];
  const bodyTemplate = selectBodyTemplate(input.contentKey, template, params);
  return {
    locale,
    title: interpolate(template.title, params),
    body: interpolate(bodyTemplate, params),
  };
}

function normalizeParameters(
  params: Record<string, InboxContentParameter>,
  locale: InboxLocale
) {
  const normalized = { ...params };
  const labels = locale === "en-US" ? englishLabels : chineseLabels;
  for (const [key, map] of Object.entries(labels)) {
    const value = normalized[key];
    if (typeof value === "string" && value in map) {
      normalized[key] = map[value] ?? value;
    }
  }
  return normalized;
}

const chineseLabels: Record<string, Record<string, string>> = {
  role: {
    PARTNER: "合伙人",
    REVIEWER: "复核人",
    PREPARER: "编制人",
    EQCR: "项目质量复核人",
    TAX_REVIEWER: "税务复核人",
  },
  half: { FIRST_HALF: "上半月", SECOND_HALF: "下半月" },
  acceptanceType: {
    CLIENT: "客户准入",
    CLIENT_CHANGE: "客户变更",
    ENGAGEMENT: "项目准入",
    ENGAGEMENT_CHANGE: "项目变更",
  },
  nextReviewer: { REQUESTER: "发起人", MIC: "MIC" },
};

const englishLabels: Record<string, Record<string, string>> = {
  role: {
    PARTNER: "Partner",
    REVIEWER: "Reviewer",
    PREPARER: "Preparer",
    EQCR: "Engagement Quality Reviewer",
    TAX_REVIEWER: "Tax Reviewer",
  },
  half: { FIRST_HALF: "first half", SECOND_HALF: "second half" },
  acceptanceType: {
    CLIENT: "Client Acceptance",
    CLIENT_CHANGE: "Client Change",
    ENGAGEMENT: "Engagement Acceptance",
    ENGAGEMENT_CHANGE: "Engagement Change",
  },
  nextReviewer: { REQUESTER: "requester", MIC: "MIC" },
};

function selectBodyTemplate(
  key: InboxContentKey,
  template: InboxEmailTemplate,
  params: Record<string, InboxContentParameter>
) {
  if (key === "PROJECT_ARCHIVE_DEADLINE_REMINDER" && params.days === 1) {
    return template.bodyOne ?? template.body;
  }
  if (key === "TMS_TIMESHEET_RETURNED" && params.reason) {
    return template.bodyWithReason ?? template.body;
  }
  if (key === "CMP_ACCEPTANCE_RETURNED" && !params.reason) {
    return template.bodyWithoutReason ?? template.body;
  }
  return template.body;
}

function interpolate(
  template: string,
  params: Record<string, InboxContentParameter>
) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (_, key) =>
    String(params[key] ?? "")
  );
}
