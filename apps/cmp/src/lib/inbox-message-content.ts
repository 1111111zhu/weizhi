import type { InboxMessage } from "../api/client";
import type { CmpDictionary } from "../i18n/client";

type ShellCopy = CmpDictionary["shell"];
type CmpInboxContentKey = keyof ShellCopy["messageTemplates"];
type MessageParameter = string | number | boolean | null;

export function localizeCmpInboxMessage(
  message: InboxMessage,
  copy: ShellCopy
): InboxMessage {
  if (!isCmpInboxContentKey(message.contentKey, copy)) {
    return message;
  }
  const params = normalizeMessageParams(message.contentParams, copy);
  const template = copy.messageTemplates[message.contentKey];
  const title = interpolateMessageTemplate(template.title, params);
  const body = interpolateMessageTemplate(
    selectBodyTemplate(message.contentKey, template, params),
    params
  );
  if (!title || !body) {
    return message;
  }
  return { ...message, title, body };
}

function selectBodyTemplate(
  key: CmpInboxContentKey,
  template: ShellCopy["messageTemplates"][CmpInboxContentKey],
  params: Record<string, MessageParameter>
) {
  if (
    key === "CMP_ACCEPTANCE_RETURNED" &&
    (typeof params.reason !== "string" || !params.reason.trim()) &&
    "bodyWithoutReason" in template &&
    typeof template.bodyWithoutReason === "string"
  ) {
    return template.bodyWithoutReason;
  }
  return template.body;
}

function isCmpInboxContentKey(
  value: InboxMessage["contentKey"],
  copy: ShellCopy
): value is CmpInboxContentKey {
  return Boolean(value && Object.hasOwn(copy.messageTemplates, value));
}

function normalizeMessageParams(
  value: InboxMessage["contentParams"],
  copy: ShellCopy
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

  replaceLabel(
    params,
    "acceptanceType",
    copy.messageParameterLabels.acceptanceTypes
  );
  replaceLabel(params, "step", copy.messageParameterLabels.approvalSteps);
  replaceLabel(
    params,
    "completedStep",
    copy.messageParameterLabels.approvalSteps
  );
  replaceLabel(params, "nextStep", copy.messageParameterLabels.approvalSteps);
  replaceLabel(
    params,
    "nextReviewer",
    copy.messageParameterLabels.draftReviewers
  );
  return params;
}

function replaceLabel(
  params: Record<string, MessageParameter>,
  key: string,
  labels: Record<string, string>
) {
  const value = params[key];
  if (typeof value === "string" && Object.hasOwn(labels, value)) {
    params[key] = labels[value];
  }
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
      return String(params[key]);
    }
  );
  return missingParameter ? null : result;
}
