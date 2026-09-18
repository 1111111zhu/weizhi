import type { InboxMessage } from "../api/client";
import type { Dictionary } from "../i18n/dictionaries";

type InboxCopy = Dictionary["inbox"];
type InboxContentKey = keyof InboxCopy["messageTemplates"];
type MessageParameter = string | number | boolean | null;

export function localizeInboxMessage(
  message: InboxMessage,
  copy: InboxCopy | undefined
): InboxMessage {
  if (!copy?.messageTemplates || !copy.messageParameterLabels) {
    return message;
  }
  const content = resolveMessageContent(message, copy);
  if (!content) {
    return message;
  }
  const params = normalizeMessageParams(content.params, copy);
  const template = copy.messageTemplates[content.key];
  const title = interpolateMessageTemplate(template.title, params);
  const bodyTemplate = selectBodyTemplate(content.key, template, params);
  const body = interpolateMessageTemplate(bodyTemplate, params);
  if (!title || !body) {
    return message;
  }
  return { ...message, title, body };
}

function resolveMessageContent(message: InboxMessage, copy: InboxCopy) {
  if (isInboxContentKey(message.contentKey, copy)) {
    return { key: message.contentKey, params: message.contentParams };
  }

  const actor = message.sender?.name || message.sender?.email;
  const project = message.project ?? message.projectInvitation?.project;
  if (
    message.type === "PROJECT_INVITATION" &&
    actor &&
    project &&
    message.projectInvitation
  ) {
    return {
      key: "PROJECT_INVITATION" as const,
      params: {
        actor,
        projectCode: project.projectCode,
        projectName: project.name,
        role: message.projectInvitation.invitedRole,
      },
    };
  }

  const reviewKeys = {
    REVIEW_QUESTION: "REVIEW_QUESTION_ASSIGNED",
    REVIEW_REPLY: "REVIEW_QUESTION_REPLIED",
    REVIEW_FOLLOW_UP: "REVIEW_QUESTION_FOLLOW_UP",
    REVIEW_REOPENED: "REVIEW_QUESTION_REOPENED",
  } as const;
  const reviewKey =
    message.type in reviewKeys
      ? reviewKeys[message.type as keyof typeof reviewKeys]
      : null;
  if (reviewKey && actor && message.workingPaper && message.reviewQuestion) {
    return {
      key: reviewKey,
      params: {
        actor,
        paperCode: message.workingPaper.code,
        paperTitle: message.workingPaper.title,
        question: message.reviewQuestion.body,
      },
    };
  }

  return null;
}

function isInboxContentKey(
  value: string | null | undefined,
  copy: InboxCopy
): value is InboxContentKey {
  return Boolean(value && Object.hasOwn(copy.messageTemplates, value));
}

function normalizeMessageParams(
  value: InboxMessage["contentParams"] | undefined,
  copy: InboxCopy
) {
  const params: Record<string, MessageParameter> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (
        entry === null ||
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean"
      ) {
        params[key] = entry;
      }
    }
  }

  const { role } = params;
  if (
    typeof role === "string" &&
    Object.hasOwn(copy.messageParameterLabels.projectRoles, role)
  ) {
    params.role =
      copy.messageParameterLabels.projectRoles[
        role as keyof typeof copy.messageParameterLabels.projectRoles
      ];
  }
  const { half } = params;
  if (
    typeof half === "string" &&
    Object.hasOwn(copy.messageParameterLabels.timesheetHalves, half)
  ) {
    params.half =
      copy.messageParameterLabels.timesheetHalves[
        half as keyof typeof copy.messageParameterLabels.timesheetHalves
      ];
  }
  return params;
}

function selectBodyTemplate(
  key: InboxContentKey,
  template: InboxCopy["messageTemplates"][InboxContentKey],
  params: Record<string, MessageParameter>
) {
  if (
    key === "TMS_TIMESHEET_RETURNED" &&
    typeof params.reason === "string" &&
    params.reason.trim() &&
    "bodyWithReason" in template &&
    typeof template.bodyWithReason === "string"
  ) {
    return template.bodyWithReason;
  }
  if (
    key === "PROJECT_ARCHIVE_DEADLINE_REMINDER" &&
    Number(params.days) === 1 &&
    "bodyOne" in template &&
    typeof template.bodyOne === "string"
  ) {
    return template.bodyOne;
  }
  return template.body;
}

function interpolateMessageTemplate(
  template: string,
  params: Record<string, MessageParameter>
) {
  let missingParameter = false;
  const result = template.replaceAll(
    /\{([a-zA-Z][a-zA-Z0-9]*)\}/g,
    (_, key) => {
      if (!Object.hasOwn(params, key) || params[key] === null) {
        missingParameter = true;
        return "";
      }
      return String(params[key] ?? "");
    }
  );
  return missingParameter ? null : result;
}
