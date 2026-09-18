import { describe, expect, it } from "vitest";

import type { WorkingPaperQuestion } from "../api/client";
import {
  getFileLevelReviewQuestions,
  isSmartFormItemReviewQuestion,
} from "./review-question-scope";

function question(
  id: string,
  smartFormNodeId?: string | null
): WorkingPaperQuestion {
  return {
    id,
    projectId: "project-1",
    workingPaperId: "paper-1",
    smartFormNodeId,
    body: id,
    status: "OPEN",
    assignedToId: null,
    createdById: "reviewer-1",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };
}

describe("review question scope", () => {
  it("keeps SmartForm item questions out of file-level review dialogs", () => {
    const fileQuestion = question("file-question");
    const itemQuestion = question("item-question", "procedure-section");

    expect(isSmartFormItemReviewQuestion(itemQuestion)).toBeTruthy();
    expect(
      getFileLevelReviewQuestions([fileQuestion, itemQuestion])
    ).toStrictEqual([fileQuestion]);
  });
});
