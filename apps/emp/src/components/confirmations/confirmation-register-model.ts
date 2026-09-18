import type { ConfirmationType } from "@project-wing/shared";

import type { ProjectConfirmation } from "../../api/client";
import { getConfirmationPresentation } from "./confirmation-presentation";
import type {
  ConfirmationPresentation,
  ConfirmationPresentationStage,
  ConfirmationSentAgeBucket,
} from "./confirmation-presentation";

export const KNOWN_CONFIRMATION_TYPES: readonly ConfirmationType[] = [
  "BANK",
  "INTERMEDIARY",
  "BALANCE",
  "RELATED_PARTY",
  "LAWYER",
  "INVENTORY",
  "OTHER",
];

export type ConfirmationResponseOutcome =
  | "PENDING"
  | "MISMATCH"
  | "MATCHED"
  | "NONE";

export type ConfirmationRegisterFilters = {
  counterparty: string[];
  type: string[];
  currentStatus: ConfirmationPresentationStage[];
  baseDate: string[];
  waitingTime: ConfirmationSentAgeBucket[];
  updatedAt: string[];
  responseOutcome: ConfirmationResponseOutcome[];
};

export const DEFAULT_CONFIRMATION_REGISTER_FILTERS: ConfirmationRegisterFilters =
  {
    counterparty: [],
    type: [],
    currentStatus: [],
    baseDate: [],
    waitingTime: [],
    updatedAt: [],
    responseOutcome: [],
  };

export type ConfirmationRegisterRow = {
  confirmation: ProjectConfirmation;
  presentation: ConfirmationPresentation;
  currentStatus: ConfirmationPresentationStage;
  baseDate: string | null;
  waitingDays: number | null;
  sentAgeBucket: ConfirmationSentAgeBucket | null;
  updatedAt: string;
  responseOutcome: ConfirmationResponseOutcome;
};

export function getConfirmationRegisterRow(
  confirmation: ProjectConfirmation,
  now = new Date()
): ConfirmationRegisterRow {
  const presentation = getConfirmationPresentation(confirmation, now);
  return {
    confirmation,
    presentation,
    currentStatus: presentation.stage,
    baseDate: presentation.baseDate,
    waitingDays: presentation.waitingDays,
    sentAgeBucket: presentation.sentAgeBucket,
    updatedAt: confirmation.updatedAt,
    responseOutcome: getResponseOutcome(confirmation),
  };
}

export function isUnclassifiedConfirmation(confirmation: ProjectConfirmation) {
  return !KNOWN_CONFIRMATION_TYPES.includes(
    confirmation.type as ConfirmationType
  );
}

export function getConfirmationCounterpartyFilterValue(
  confirmation: ProjectConfirmation
) {
  return (
    confirmation.displayName?.trim() || confirmation.counterpartyName.trim()
  );
}

export function matchesConfirmationRegisterFilters(
  confirmation: ProjectConfirmation,
  filters: ConfirmationRegisterFilters,
  now = new Date()
) {
  const row = getConfirmationRegisterRow(confirmation, now);
  return (
    (filters.counterparty.length === 0 ||
      filters.counterparty.includes(
        getConfirmationCounterpartyFilterValue(confirmation)
      )) &&
    (filters.type.length === 0 || filters.type.includes(confirmation.type)) &&
    (filters.currentStatus.length === 0 ||
      filters.currentStatus.includes(row.currentStatus)) &&
    (filters.baseDate.length === 0 ||
      filters.baseDate.includes(getConfirmationDateFilterKey(row.baseDate))) &&
    (filters.waitingTime.length === 0 ||
      (row.sentAgeBucket !== null &&
        filters.waitingTime.includes(row.sentAgeBucket))) &&
    (filters.updatedAt.length === 0 ||
      filters.updatedAt.includes(
        getConfirmationDateFilterKey(row.updatedAt)
      )) &&
    (filters.responseOutcome.length === 0 ||
      filters.responseOutcome.includes(row.responseOutcome))
  );
}

export function getConfirmationDateFilterKey(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hasConfirmationRegisterFilters(
  filters: ConfirmationRegisterFilters
) {
  return Object.values(filters).some((value) => value.length > 0);
}

function getResponseOutcome(
  confirmation: ProjectConfirmation
): ConfirmationResponseOutcome {
  if (confirmation.differenceStatus === "MATCHED") {
    return "MATCHED";
  }
  if (
    confirmation.differenceStatus === "EXCEPTION" ||
    confirmation.differenceStatus === "PENDING_FOLLOW_UP" ||
    confirmation.differenceStatus === "NO_RESPONSE"
  ) {
    return "MISMATCH";
  }
  if (confirmation.status === "RESPONSE_RECEIVED") {
    return "PENDING";
  }
  return "NONE";
}
