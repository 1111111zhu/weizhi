import type { WorkingPaperQuestion } from "../api/client";

export function isSmartFormItemReviewQuestion(
  question: Pick<WorkingPaperQuestion, "smartFormNodeId">
) {
  return Boolean(question.smartFormNodeId);
}

export function getFileLevelReviewQuestions(
  questions: readonly WorkingPaperQuestion[] | null | undefined
) {
  return (questions ?? []).filter(
    (question) => !isSmartFormItemReviewQuestion(question)
  );
}
