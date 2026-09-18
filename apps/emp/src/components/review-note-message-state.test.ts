import { describe, expect, it } from "vitest";

import type { WorkingPaperQuestionMessage } from "../api/client";
import {
  confirmReviewMessage,
  mergeReviewMessages,
} from "./review-note-message-state";
import type { LocalReviewMessage } from "./review-note-message-state";

const message = (id: string): WorkingPaperQuestionMessage => ({
  id,
  questionId: "q",
  authorId: "u",
  messageType: "REPLY",
  body: "Same reply",
  createdAt: "2026-09-07T00:00:00Z",
  author: null,
});
const pending = (
  id: string,
  knownServerIds: string[] = []
): LocalReviewMessage => ({
  clientId: id,
  message: message(id),
  knownServerIds,
});
describe("review message reconciliation", () => {
  it("retains a pending message through unchanged and stale refetches", () => {
    const local = pending("optimistic-1", ["older"]);
    expect(
      mergeReviewMessages([message("older")], [local]).map((m) => m.renderKey)
    ).toStrictEqual(["older", "optimistic-1"]);
    expect(mergeReviewMessages([], [local])[0]).toMatchObject({
      renderKey: "optimistic-1",
      pending: true,
    });
  });

  it("preserves the row key and canonical content when confirmed", () => {
    const local = pending("optimistic-1");
    const confirmed = confirmReviewMessage(local, [message("server-1")]);
    expect(mergeReviewMessages([], [confirmed])[0]).toMatchObject({
      id: "server-1",
      renderKey: "optimistic-1",
      pending: false,
    });
    expect(
      mergeReviewMessages([message("server-1")], [confirmed])
    ).toHaveLength(1);
    expect(
      mergeReviewMessages([message("server-1")], [confirmed])[0].renderKey
    ).toBe("optimistic-1");
  });

  it("matches repeated identical replies one-to-one without consuming historical messages", () => {
    const result = mergeReviewMessages(
      [message("old"), message("new")],
      [pending("a", ["old"]), pending("b", ["old"])]
    );
    expect(result.map((m) => m.renderKey)).toStrictEqual(["old", "a", "b"]);
    expect(result.map((m) => m.pending)).toStrictEqual([false, false, true]);
  });

  it("does not reconcile another author's message", () => {
    expect(
      mergeReviewMessages(
        [{ ...message("server"), authorId: "other" }],
        [pending("local")]
      )
    ).toHaveLength(2);
  });
});
