import { describe, expect, it } from "vitest";

import type { ProjectConfirmation } from "../../api/client";
import {
  DEFAULT_CONFIRMATION_REGISTER_FILTERS,
  getConfirmationRegisterRow,
  matchesConfirmationRegisterFilters,
} from "./confirmation-register-model";
import type { ConfirmationRegisterFilters } from "./confirmation-register-model";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function confirmation(
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return {
    id: "confirmation-1",
    projectId: "project-1",
    type: "BANK",
    status: "AWAITING_RESPONSE",
    counterpartyName: "Example Bank",
    teamConfirmStatus: "PENDING",
    createdBy: "user-1",
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    dispatches: [
      {
        id: "dispatch-1",
        confirmationId: "confirmation-1",
        sequence: 1,
        method: "COURIER",
        sentAt: "2026-07-31T12:00:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-07-31T12:00:00.000Z",
      },
    ],
    responses: [],
    ...overrides,
  };
}

describe("confirmation-register-model", () => {
  it("uses the shared presentation helper for status, base date, and waiting time", () => {
    const row = getConfirmationRegisterRow(confirmation(), NOW);

    expect(row).toMatchObject({
      currentStatus: "SENT",
      baseDate: "2026-07-31T12:00:00.000Z",
      waitingDays: 3,
      sentAgeBucket: "0_7",
      updatedAt: "2026-08-02T12:00:00.000Z",
    });
  });

  it("combines independent column filters without refetching data", () => {
    const filters: ConfirmationRegisterFilters = {
      ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
      counterparty: ["Example Bank"],
      type: ["BANK"],
      currentStatus: ["SENT"],
      baseDate: ["2026-07-31"],
      waitingTime: ["0_7"],
      updatedAt: ["2026-08-02"],
    };

    expect(
      matchesConfirmationRegisterFilters(confirmation(), filters, NOW)
    ).toBeTruthy();
    expect(
      matchesConfirmationRegisterFilters(
        confirmation({ status: "DRAFT" }),
        filters,
        NOW
      )
    ).toBeFalsy();
  });

  it("matches visible counterparty and confirmation type independently", () => {
    expect(
      matchesConfirmationRegisterFilters(
        confirmation({ displayName: "Visible counterparty" }),
        {
          ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
          counterparty: ["Visible counterparty"],
        },
        NOW
      )
    ).toBeTruthy();
    expect(
      matchesConfirmationRegisterFilters(
        confirmation({ type: "RELATED_PARTY" }),
        {
          ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
          type: ["RELATED_PARTY"],
        },
        NOW
      )
    ).toBeTruthy();
    expect(
      matchesConfirmationRegisterFilters(
        confirmation({ type: "RELATED_PARTY" }),
        {
          ...DEFAULT_CONFIRMATION_REGISTER_FILTERS,
          type: ["BANK"],
        },
        NOW
      )
    ).toBeFalsy();
  });
});
