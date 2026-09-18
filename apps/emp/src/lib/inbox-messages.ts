import type { InboxMessage, InboxMessageType } from "../api/client";

const REVIEW_MESSAGE_TYPES: InboxMessageType[] = [
  "REVIEW_QUESTION",
  "REVIEW_REPLY",
  "REVIEW_FOLLOW_UP",
  "REVIEW_REOPENED",
];

export function isReviewInboxMessage(message: InboxMessage) {
  return REVIEW_MESSAGE_TYPES.includes(message.type);
}

export function isNotificationInboxMessage(message: InboxMessage) {
  return !isReviewInboxMessage(message);
}

export function getInboxMessageProjectId(message: InboxMessage) {
  return (
    message.projectId ??
    message.project?.id ??
    message.projectInvitation?.project.id ??
    null
  );
}
