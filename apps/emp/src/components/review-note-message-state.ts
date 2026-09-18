import type { WorkingPaperQuestionMessage } from "../api/client";

export type LocalReviewMessage = {
  clientId: string;
  message: WorkingPaperQuestionMessage;
  knownServerIds: string[];
  confirmed?: WorkingPaperQuestionMessage;
};

/** Keep the same row key as a pending message becomes a confirmed server row.
 * Old refetches must not remove it; equal repeated messages match one-to-one. */
export function mergeReviewMessages(
  server: WorkingPaperQuestionMessage[],
  local: LocalReviewMessage[]
) {
  const remaining = [...local];
  const merged = server.map((message) => {
    const index = remaining.findIndex((item) =>
      item.confirmed
        ? item.confirmed.id === message.id
        : !item.knownServerIds.includes(message.id) &&
          item.message.messageType === message.messageType &&
          item.message.body.trim() === message.body.trim() &&
          item.message.authorId === message.authorId
    );
    const matched = index === -1 ? undefined : remaining.splice(index, 1)[0];
    return {
      ...message,
      renderKey: matched?.clientId ?? message.id,
      pending: false,
    };
  });
  return [
    ...merged,
    ...remaining.map((item) => ({
      ...(item.confirmed ?? item.message),
      renderKey: item.clientId,
      pending: !item.confirmed,
    })),
  ];
}

export function confirmReviewMessage(
  local: LocalReviewMessage,
  server: WorkingPaperQuestionMessage[]
) {
  const confirmed = server.find(
    (message) =>
      !local.knownServerIds.includes(message.id) &&
      message.messageType === local.message.messageType &&
      message.body.trim() === local.message.body.trim() &&
      message.authorId === local.message.authorId
  );
  return confirmed ? { ...local, confirmed } : local;
}
