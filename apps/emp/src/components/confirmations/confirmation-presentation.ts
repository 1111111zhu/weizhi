import type { ProjectConfirmation } from "../../api/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ConfirmationPresentationStage =
  | "DRAFT"
  | "PREPARED"
  | "SENT"
  | "RECEIVED"
  | "PROCESSED"
  | "PENDING_ARCHIVE"
  | "COMPLETED"
  | "VOIDED";

export type ConfirmationSentAgeBucket =
  | "0_7"
  | "8_14"
  | "15_21"
  | "22_30"
  | "31_45"
  | "46_PLUS"
  | "UNKNOWN";

export type ConfirmationPresentation = {
  stage: ConfirmationPresentationStage;
  baseDate: string | null;
  waitingDays: number | null;
  sentAgeBucket: ConfirmationSentAgeBucket | null;
};

export function getConfirmationPresentation(
  confirmation: ProjectConfirmation,
  now = new Date()
): ConfirmationPresentation {
  const latestResponse = latestByDate(
    (confirmation.responses ?? []).filter(
      (response) => response.routingStatus === "ROUTED"
    ),
    (response) => response.createdAt
  );
  const [latestDispatch] = [...(confirmation.dispatches ?? [])].sort(
    (left, right) => right.sequence - left.sequence
  );
  const latestCompletion = latestByDate(
    (confirmation.followUpEvents ?? []).filter(
      (event) => event.eventType === "PROGRAM_COMPLETED"
    ),
    (event) => event.occurredAt
  );

  if (confirmation.status === "VOIDED") {
    return presentation("VOIDED", confirmation.updatedAt, now);
  }
  if (
    confirmation.status === "CLOSED" ||
    confirmation.differenceStatus === "MATCHED"
  ) {
    return {
      stage: isConfirmationArchiveComplete(confirmation)
        ? "COMPLETED"
        : "PENDING_ARCHIVE",
      baseDate: latestCompletion?.occurredAt ?? confirmation.updatedAt,
      waitingDays: null,
      sentAgeBucket: null,
    };
  }
  if (confirmation.status === "DRAFT") {
    return presentation("DRAFT", confirmation.createdAt, now);
  }
  if (confirmation.status === "PREPARED") {
    return presentation(
      "PREPARED",
      confirmation.preparedDispatchReadyAt ??
        confirmation.currentArtifact?.submittedAt ??
        confirmation.updatedAt,
      now
    );
  }

  const responseDate =
    latestResponse?.receivedAt ?? latestResponse?.createdAt ?? null;
  const dispatchDate =
    latestDispatch?.sentAt ?? latestDispatch?.createdAt ?? null;
  const redispatchWasSent =
    latestDispatch?.sequence !== undefined &&
    latestDispatch.sequence > 1 &&
    isAfter(dispatchDate, responseDate);

  if (
    latestResponse &&
    !redispatchWasSent &&
    (confirmation.status === "RESPONSE_RECEIVED" ||
      confirmation.differenceStatus === "EXCEPTION")
  ) {
    return presentation(
      "RECEIVED",
      responseDate ?? confirmation.updatedAt,
      now
    );
  }

  if (redispatchWasSent) {
    return presentation("PROCESSED", dispatchDate, now);
  }

  const sent = presentation("SENT", dispatchDate, now);
  return {
    ...sent,
    sentAgeBucket: getSentAgeBucket(sent.waitingDays),
  };
}

export function getSentAgeBucket(
  waitingDays: number | null
): ConfirmationSentAgeBucket {
  if (waitingDays === null) {
    return "UNKNOWN";
  }
  if (waitingDays <= 7) {
    return "0_7";
  }
  if (waitingDays <= 14) {
    return "8_14";
  }
  if (waitingDays <= 21) {
    return "15_21";
  }
  if (waitingDays <= 30) {
    return "22_30";
  }
  if (waitingDays <= 45) {
    return "31_45";
  }
  return "46_PLUS";
}

function presentation(
  stage: ConfirmationPresentationStage,
  baseDate: string | null | undefined,
  now: Date
): ConfirmationPresentation {
  return {
    stage,
    baseDate: baseDate ?? null,
    waitingDays: waitingDaysFrom(baseDate, now),
    sentAgeBucket: null,
  };
}

function waitingDaysFrom(
  baseDate: string | null | undefined,
  now: Date
): number | null {
  if (!baseDate) {
    return null;
  }
  const timestamp = new Date(baseDate).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function isAfter(
  candidate: string | null | undefined,
  reference: string | null | undefined
) {
  if (!candidate || !reference) {
    return false;
  }
  const candidateTime = new Date(candidate).getTime();
  const referenceTime = new Date(reference).getTime();
  return (
    Number.isFinite(candidateTime) &&
    Number.isFinite(referenceTime) &&
    candidateTime > referenceTime
  );
}

function latestByDate<T>(
  items: T[],
  dateFor: (item: T) => string | null | undefined
): T | undefined {
  return [...items].sort((left, right) => {
    const leftTime = new Date(dateFor(left) ?? "").getTime();
    const rightTime = new Date(dateFor(right) ?? "").getTime();
    return (
      (Number.isFinite(rightTime) ? rightTime : 0) -
      (Number.isFinite(leftTime) ? leftTime : 0)
    );
  })[0];
}

export function isConfirmationArchiveComplete(
  confirmation: ProjectConfirmation | null | undefined
) {
  if (!confirmation || confirmation.status !== "CLOSED") return false;
  const artifacts =
    latestByDate(
      (confirmation.responses ?? []).filter(
        (response) => response.routingStatus === "ROUTED"
      ),
      (response) => response.createdAt
    )?.artifacts ?? [];
  return (
    artifacts.length > 0 &&
    artifacts.every((artifact) =>
      confirmation.empImportItems?.some(
        (item) =>
          item.responseArtifactId === artifact.id &&
          item.attachmentId &&
          item.attachment &&
          !item.attachment.deletedAt
      )
    )
  );
}
