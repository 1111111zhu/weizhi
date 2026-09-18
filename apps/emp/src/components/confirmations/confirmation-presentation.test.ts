import { describe, expect, it } from "vitest";

import type { ProjectConfirmation } from "../../api/client";
import {
  getConfirmationPresentation,
  getSentAgeBucket,
} from "./confirmation-presentation";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function confirmation(
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return {
    id: "confirmation-1",
    projectId: "project-1",
    type: "BANK",
    status: "DRAFT",
    counterpartyName: "Example Bank",
    teamConfirmStatus: "PENDING",
    createdBy: "user-1",
    createdAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T12:00:00.000Z",
    ...overrides,
  };
}

describe(getConfirmationPresentation, () => {
  it.each([
    [
      { status: "DRAFT" as const },
      {
        stage: "DRAFT",
        baseDate: "2026-07-30T12:00:00.000Z",
        waitingDays: 4,
      },
    ],
    [
      {
        status: "PREPARED" as const,
        preparedDispatchReadyAt: "2026-08-01T12:00:00.000Z",
      },
      {
        stage: "PREPARED",
        baseDate: "2026-08-01T12:00:00.000Z",
        waitingDays: 2,
      },
    ],
    [
      { status: "VOIDED" as const },
      {
        stage: "VOIDED",
        baseDate: "2026-07-30T12:00:00.000Z",
        waitingDays: 4,
      },
    ],
  ])("derives the base presentation for %s", (overrides, expected) => {
    expect(
      getConfirmationPresentation(confirmation(overrides), NOW)
    ).toMatchObject(expected);
  });

  it("uses the latest dispatch as the sent base date and derives whole waiting days", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "AWAITING_RESPONSE",
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-20T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
          {
            id: "dispatch-2",
            confirmationId: "confirmation-1",
            sequence: 2,
            method: "COURIER",
            sentAt: "2026-07-31T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-31T10:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "SENT",
      baseDate: "2026-07-31T12:00:00.000Z",
      waitingDays: 3,
      sentAgeBucket: "0_7",
    });
  });

  it("classifies a dispatched retry after a received response as processed", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        responses: [
          {
            id: "response-1",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "ROUTED",
            receivedAt: "2026-07-28T12:00:00.000Z",
            createdAt: "2026-07-28T12:00:00.000Z",
            updatedAt: "2026-07-28T12:00:00.000Z",
          },
        ],
        dispatches: [
          {
            id: "dispatch-2",
            confirmationId: "confirmation-1",
            sequence: 2,
            method: "COURIER",
            sentAt: "2026-08-01T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-08-01T10:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "PROCESSED",
      baseDate: "2026-08-01T12:00:00.000Z",
      waitingDays: 2,
      sentAgeBucket: null,
    });
  });

  it("keeps a mismatched response in received until the retry is actually sent", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        responses: [
          {
            id: "response-1",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "ROUTED",
            receivedAt: "2026-07-28T12:00:00.000Z",
            createdAt: "2026-07-28T12:00:00.000Z",
            updatedAt: "2026-07-28T12:00:00.000Z",
          },
        ],
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-20T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "RECEIVED",
      baseDate: "2026-07-28T12:00:00.000Z",
      waitingDays: 6,
    });
  });

  it("uses the latest routed response when a newer response is still pending", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
        responses: [
          {
            id: "response-pending",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "PENDING",
            receivedAt: "2026-08-02T12:00:00.000Z",
            createdAt: "2026-08-02T12:00:00.000Z",
            updatedAt: "2026-08-02T12:00:00.000Z",
          },
          {
            id: "response-routed",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "ROUTED",
            receivedAt: "2026-07-28T12:00:00.000Z",
            createdAt: "2026-07-28T12:00:00.000Z",
            updatedAt: "2026-07-28T12:00:00.000Z",
          },
        ],
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-20T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "RECEIVED",
      baseDate: "2026-07-28T12:00:00.000Z",
      waitingDays: 6,
    });
  });

  it("keeps a confirmation with only a pending response in the sent stage", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "RESPONSE_RECEIVED",
        responses: [
          {
            id: "response-pending",
            confirmationId: "confirmation-1",
            responseStatus: "RECEIVED",
            routingStatus: "PENDING",
            receivedAt: "2026-08-02T12:00:00.000Z",
            createdAt: "2026-08-02T12:00:00.000Z",
            updatedAt: "2026-08-02T12:00:00.000Z",
          },
        ],
        dispatches: [
          {
            id: "dispatch-1",
            confirmationId: "confirmation-1",
            sequence: 1,
            method: "COURIER",
            sentAt: "2026-07-20T12:00:00.000Z",
            createdBy: "user-1",
            createdAt: "2026-07-20T10:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "SENT",
      baseDate: "2026-07-20T12:00:00.000Z",
      waitingDays: 14,
      sentAgeBucket: "8_14",
    });
  });

  it("uses the completion event date and stops the waiting counter", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "CLOSED",
        followUpEvents: [
          {
            id: "event-1",
            confirmationId: "confirmation-1",
            eventType: "PROGRAM_COMPLETED",
            source: "PROJECT_TEAM_MANUAL",
            occurredAt: "2026-08-02T12:00:00.000Z",
            createdAt: "2026-08-02T12:00:00.000Z",
          },
        ],
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "PENDING_ARCHIVE",
      baseDate: "2026-08-02T12:00:00.000Z",
      waitingDays: null,
      sentAgeBucket: null,
    });
  });

  it("presents a legacy matched response as completed so matrix drill-down stays aligned", () => {
    const result = getConfirmationPresentation(
      confirmation({
        status: "RESPONSE_RECEIVED",
        differenceStatus: "MATCHED",
        updatedAt: "2026-08-02T12:00:00.000Z",
      }),
      NOW
    );

    expect(result).toMatchObject({
      stage: "PENDING_ARCHIVE",
      baseDate: "2026-08-02T12:00:00.000Z",
      waitingDays: null,
      sentAgeBucket: null,
    });
  });

  it("does not expose a negative or invalid waiting duration", () => {
    expect(
      getConfirmationPresentation(
        confirmation({
          status: "AWAITING_RESPONSE",
          dispatches: [
            {
              id: "dispatch-future",
              confirmationId: "confirmation-1",
              sequence: 1,
              method: "COURIER",
              sentAt: "2026-08-04T12:00:00.000Z",
              createdBy: "user-1",
              createdAt: "2026-08-04T12:00:00.000Z",
            },
          ],
        }),
        NOW
      ).waitingDays
    ).toBe(0);
    expect(
      getConfirmationPresentation(
        confirmation({
          status: "AWAITING_RESPONSE",
          dispatches: [
            {
              id: "dispatch-invalid",
              confirmationId: "confirmation-1",
              sequence: 1,
              method: "COURIER",
              sentAt: "not-a-date",
              createdBy: "user-1",
              createdAt: "not-a-date",
            },
          ],
        }),
        NOW
      )
    ).toMatchObject({
      baseDate: "not-a-date",
      waitingDays: null,
      sentAgeBucket: "UNKNOWN",
    });
  });
});

describe(getSentAgeBucket, () => {
  it.each([
    [0, "0_7"],
    [7, "0_7"],
    [8, "8_14"],
    [14, "8_14"],
    [15, "15_21"],
    [21, "15_21"],
    [22, "22_30"],
    [30, "22_30"],
    [31, "31_45"],
    [45, "31_45"],
    [46, "46_PLUS"],
  ] as const)("maps %s waiting days to %s", (days, expected) => {
    expect(getSentAgeBucket(days)).toBe(expected);
  });

  it("returns unknown when no sent date is available", () => {
    expect(getSentAgeBucket(null)).toBe("UNKNOWN");
  });
});
