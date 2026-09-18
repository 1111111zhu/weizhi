import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "../../api/client";
import { defaultConfirmationsCopy } from "../../i18n/dictionaries";
import { requiredFixture } from "../../test/required-fixture";
import { ConfirmationFollowUpPanel } from "./confirmation-follow-up-panel";

describe("confirmation behavior", () => {
  afterEach(cleanup);

  const copy = {
    title: "Response follow-up",
    description: "Business progress is shown separately from logistics.",
    currentStatus: "Current status",
    waitingResponse: "Awaiting response",
    responseReceived: "Response received",
    programCompleted: "Program completed",
    timelineEmpty: "No progress yet",
    recordProgress: "Record progress",
    uploadResponse: "Upload response",
    completeProgram: "Complete program",
    followUpSheetTitle: "Record follow-up progress",
    followUpSheetDescription: "Select the latest confirmed business event.",
    progressType: "Progress type",
    progressNotes: "Notes",
    progressNotesPlaceholder: "Add supporting details",
    saveProgress: "Save progress",
    cancel: "Cancel",
    firstDispatch: "Initial dispatch",
    redispatch: "Redispatch",
    redispatchTitle: "Redispatch #{sequence}",
    registeredBy: "Recorded by {name}",
    systemActor: "System",
    eventLabels: {
      CONFIRMATION_CREATED: "Confirmation created",
      CONFIRMATION_FROZEN: "Confirmation frozen",
      CONFIRMATION_UNFROZEN: "Freeze withdrawn",
      COUNTERPARTY_RECEIVED: "Counterparty received",
      COUNTERPARTY_SENT_RESPONSE: "Counterparty sent response",
      REDISPATCH_REQUESTED: "Redispatch requested",
      RESPONSE_RECEIVED: "Response received",
      RESPONSE_WITHDRAWN: "Response withdrawn",
      PROGRAM_COMPLETED: "Program completed",
      REVIEW_RECORDED: "Review conclusion recorded",
      REVIEW_RETRACTED: "Review conclusion undone",
      IMPORT_TARGET_CHANGED: "Project file status changed",
      IMPORT_WITHDRAWN: "Import withdrawn",
    },
  };

  function confirmation(
    input: Partial<ProjectConfirmation> = {}
  ): ProjectConfirmation {
    return {
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      status: "AWAITING_RESPONSE",
      counterpartyName: "HSBC Hong Kong",
      createdBy: "user-1",
      createdAt: "2026-07-05T07:00:00.000Z",
      updatedAt: "2026-07-05T10:00:00.000Z",
      dispatches: [
        {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          sentAt: "2026-07-05T08:00:00.000Z",
          trackingNumber: "SF1001",
          trackingCarrierName: "SF Express",
          trackingEvents: [
            {
              at: "2026-07-05T09:00:00.000Z",
              description: "Shipment collected",
              location: "Hong Kong",
            },
          ],
          createdBy: "user-1",
          createdAt: "2026-07-05T08:01:00.000Z",
        },
      ],
      followUpEvents: [
        {
          id: "follow-up-1",
          confirmationId: "confirmation-1",
          eventType: "COUNTERPARTY_RECEIVED",
          actorId: "user-1",
          source: "PROJECT_TEAM_MANUAL",
          notes: "Confirmed by phone",
          occurredAt: "2026-07-05T10:00:00.000Z",
          createdAt: "2026-07-05T10:00:00.000Z",
        },
      ],
      responses: [],
      ...input,
    } as ProjectConfirmation;
  }

  describe(ConfirmationFollowUpPanel, () => {
    it("opens pending tracking from the timeline and submits only the missing digits", async () => {
      const onCorrectTracking = vi.fn().mockResolvedValue({});
      const onRefreshTracking = vi.fn();
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            dispatches: [
              {
                id: "pending-dispatch",
                confirmationId: "confirmation-1",
                sequence: 1,
                method: "COURIER",
                executionStatus: "SENT",
                trackingNumber: "JD123456",
                trackingError: "The 'phone_number_last_4' field is required",
                createdBy: "user-1",
                createdAt: "2026-07-05T08:00:00.000Z",
              },
            ],
          })}
          copy={copy}
          locale="en-US"
          canEdit
          trackingCopy={defaultConfirmationsCopy.tracking}
          onCorrectTracking={onCorrectTracking}
          onRefreshTracking={onRefreshTracking}
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Add tracking details" })
      );
      expect(onRefreshTracking).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Last 4 digits of phone number"), {
        target: { value: "1234" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Track shipment" }));
      await waitFor(() =>
        expect(onCorrectTracking).toHaveBeenCalledWith(
          "pending-dispatch",
          expect.objectContaining({
            trackingNumber: "JD123456",
            trackingQueryParameters: { phone_number_last_4: "1234" },
          })
        )
      );
    });

    it("includes legacy creation and freeze metadata in newest-first order", () => {
      const frozen = confirmation({
        status: "PREPARED",
        dispatches: [],
        followUpEvents: [],
        preparedDispatchReadyAt: "2026-07-05T09:00:00.000Z",
        preparedDispatchReadyBy: "user-2",
      });
      const props = {
        copy,
        locale: "en-US",
        canEdit: false,
        resolveActorName: (id: string | null | undefined) =>
          id === "user-2" ? "Leo" : "Jony",
        trackingCopy: defaultConfirmationsCopy.tracking,
        onRecordProgress: vi.fn(),
        onUploadResponse: vi.fn(),
        onCompleteProgram: vi.fn(),
      };
      const view = render(
        <ConfirmationFollowUpPanel
          {...props}
          confirmation={{
            ...frozen,
            status: "DRAFT",
            preparedDispatchReadyAt: null,
            preparedDispatchReadyBy: null,
          }}
        />
      );
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      view.rerender(
        <ConfirmationFollowUpPanel {...props} confirmation={frozen} />
      );
      const rows = screen.getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Confirmation frozen");
      expect(rows[0]).toHaveTextContent("Leo");
      expect(rows[0]).toHaveTextContent("Latest");
      expect(rows[1]).toHaveTextContent("Confirmation created");
      expect(rows[1]).toHaveTextContent("Jony");
    });

    it("does not invent a freeze for a draft with old submission metadata", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            status: "DRAFT",
            dispatches: [],
            followUpEvents: [],
            preparedDispatchReadyAt: "2026-07-05T09:00:00.000Z",
          })}
          copy={copy}
          locale="en-US"
          canEdit={false}
          trackingCopy={defaultConfirmationsCopy.tracking}
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.queryByText("Confirmation frozen")).not.toBeInTheDocument();
    });

    it("shows confirmation lifecycle in the response follow-up timeline", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            status: "DRAFT",
            followUpEvents: [
              {
                id: "created",
                confirmationId: "confirmation-1",
                eventType: "CONFIRMATION_CREATED",
                actorId: "user-1",
                source: "PROJECT_TEAM_SYSTEM",
                occurredAt: "2026-07-05T07:00:00.000Z",
                createdAt: "2026-07-05T07:00:00.000Z",
              },
              {
                id: "frozen",
                confirmationId: "confirmation-1",
                eventType: "CONFIRMATION_FROZEN",
                actorId: "user-1",
                source: "PROJECT_TEAM_SYSTEM",
                occurredAt: "2026-07-05T09:00:00.000Z",
                createdAt: "2026-07-05T09:00:00.000Z",
              },
              {
                id: "unfrozen",
                confirmationId: "confirmation-1",
                eventType: "CONFIRMATION_UNFROZEN",
                actorId: "user-1",
                source: "PROJECT_TEAM_SYSTEM",
                occurredAt: "2026-07-05T10:00:00.000Z",
                createdAt: "2026-07-05T10:00:00.000Z",
              },
            ],
          })}
          copy={copy}
          locale="en-US"
          canEdit={false}
          trackingCopy={defaultConfirmationsCopy.tracking}
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      expect(screen.getByText("Confirmation created")).toBeVisible();
      expect(screen.getByText("Confirmation frozen")).toBeVisible();
      expect(screen.getByText("Freeze withdrawn")).toBeVisible();
    });

    it("uses the dispatch sequence in Chinese redispatch labels", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            dispatches: [
              {
                id: "dispatch-1",
                confirmationId: "confirmation-1",
                sequence: 1,
                method: "COURIER",
                sentAt: "2026-07-05T08:00:00.000Z",
                createdBy: "user-1",
                createdAt: "2026-07-05T08:01:00.000Z",
              },
              {
                id: "dispatch-3",
                confirmationId: "confirmation-1",
                sequence: 3,
                method: "COURIER",
                sentAt: "2026-07-06T08:00:00.000Z",
                createdBy: "user-1",
                createdAt: "2026-07-06T08:01:00.000Z",
              },
            ],
          })}
          copy={{
            ...copy,
            firstDispatch: "首次发函",
            redispatch: "二次发函",
            redispatchTitle: "{ordinal}次发函 #{sequence}",
          }}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="zh-CN"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      expect(screen.getByText("三次发函 #3")).toBeVisible();
      expect(screen.queryByText("二次发函 #3")).not.toBeInTheDocument();
    });

    it("shows one delivery milestone per shipment across refreshes without receiving the response", () => {
      const [dispatched] = requiredFixture(confirmation().dispatches);
      const delivered = {
        ...dispatched,
        trackingStatus: "Delivered",
        trackingLastEventAt: "2026-07-06T12:00:00.000Z",
        trackingEvents: [
          {
            stage: "Delivered",
            at: "2026-07-05T09:30:00.000Z",
            description: "Signed",
          },
        ],
      };
      const props = {
        copy,
        trackingCopy: defaultConfirmationsCopy.tracking,
        locale: "en-US",
        canEdit: true,
        onRecordProgress: vi.fn(),
        onUploadResponse: vi.fn(),
        onCompleteProgram: vi.fn(),
      };
      const data = confirmation({ dispatches: [delivered] });
      const view = render(
        <ConfirmationFollowUpPanel {...props} confirmation={data} />
      );
      expect(screen.getAllByText("Confirmation delivered")).toHaveLength(1);
      expect(screen.getByText("SF Express · SF1001")).toBeVisible();
      expect(screen.getAllByText("Latest")).toHaveLength(1);
      expect(screen.getAllByRole("listitem")[0]).toContainElement(
        screen.getByText("Latest")
      );
      expect(screen.getByText("Awaiting response")).toBeVisible();
      expect(
        screen.getAllByRole("listitem").map((item) => item.textContent)
      ).toStrictEqual([
        expect.stringContaining("Counterparty received"),
        expect.stringContaining("Confirmation delivered"),
        expect.stringContaining("Initial dispatch"),
        expect.stringContaining("Confirmation created"),
      ]);
      view.rerender(
        <ConfirmationFollowUpPanel {...props} confirmation={{ ...data }} />
      );
      expect(screen.getAllByText("Confirmation delivered")).toHaveLength(1);
      view.rerender(
        <ConfirmationFollowUpPanel
          {...props}
          confirmation={confirmation({
            dispatches: [
              delivered,
              {
                ...delivered,
                id: "dispatch-2",
                sequence: 2,
                trackingNumber: "SF1002",
              },
            ],
          })}
        />
      );
      expect(screen.getAllByText("Confirmation delivered")).toHaveLength(2);
      view.rerender(
        <ConfirmationFollowUpPanel
          {...props}
          confirmation={confirmation({
            dispatches: [{ ...dispatched, trackingStatus: "InTransit" }],
          })}
        />
      );
      expect(
        screen.queryByText("Confirmation delivered")
      ).not.toBeInTheDocument();
      expect(props.onRecordProgress).not.toHaveBeenCalled();
      expect(props.onCompleteProgram).not.toHaveBeenCalled();
    });

    it("keeps logistics out of the business timeline and opens it per dispatch", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation()}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          resolveActorName={() => "Leo Li"}
          redispatchAction={<button type="button">Redispatch action</button>}
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      expect(screen.getByText("Initial dispatch")).toBeVisible();
      expect(screen.queryByText("Shipment collected")).not.toBeInTheDocument();
      expect(screen.getAllByText("Recorded by Leo Li")).toHaveLength(3);
      expect(screen.getByText("Counterparty received")).toBeVisible();
      expect(screen.getByText("Confirmed by phone")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Redispatch action" })
      ).toBeVisible();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Initial dispatch · View tracking",
        })
      );
      expect(screen.getByText("SF Express · SF1001")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "View tracking" }));
      expect(screen.getAllByText("Shipment collected")).toHaveLength(2);
    });

    it("does not let late-arriving logistics events reorder business events", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            dispatches: [
              {
                id: "dispatch-1",
                confirmationId: "confirmation-1",
                sequence: 1,
                method: "COURIER",
                sentAt: "2026-07-05T08:00:00.000Z",
                trackingNumber: "SF1001",
                trackingCarrierName: "SF Express",
                trackingUpdatedAt: "2026-07-05T11:00:00.000Z",
                trackingEvents: [
                  {
                    at: "2026-07-05T09:00:00.000Z",
                    description: "Late webhook logistics event",
                    location: "Hong Kong",
                  },
                ],
                createdBy: "user-1",
                createdAt: "2026-07-05T08:01:00.000Z",
              },
            ],
            followUpEvents: [
              {
                id: "follow-up-1",
                confirmationId: "confirmation-1",
                eventType: "COUNTERPARTY_RECEIVED",
                actorId: "user-1",
                source: "PROJECT_TEAM_MANUAL",
                occurredAt: "2026-07-05T10:00:00.000Z",
                createdAt: "2026-07-05T10:00:00.000Z",
              },
            ],
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      const timelineItems = screen.getAllByRole("listitem");
      expect(timelineItems.map((item) => item.textContent)).toStrictEqual([
        expect.stringContaining("Counterparty received"),
        expect.stringContaining("Initial dispatch"),
        expect.stringContaining("Confirmation created"),
      ]);
    });

    it.each(["", "RETURN-100"])(
      "records a sent response with optional tracking %s",
      async (number) => {
        const onRecordProgress = vi.fn();
        render(
          <ConfirmationFollowUpPanel
            confirmation={confirmation()}
            copy={copy}
            trackingCopy={defaultConfirmationsCopy.tracking}
            locale="en-US"
            canEdit
            onRecordProgress={onRecordProgress}
            onUploadResponse={vi.fn()}
            onCompleteProgram={vi.fn()}
          />
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Record progress" })
        );
        const user = userEvent.setup();
        await user.click(
          screen.getByRole("combobox", { name: "Progress type" })
        );
        await user.click(
          screen.getByRole("option", { name: "Counterparty sent response" })
        );
        fireEvent.change(
          await screen.findByLabelText(
            defaultConfirmationsCopy.tracking.trackingNumberInput
          ),
          { target: { value: number } }
        );
        fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
        expect(onRecordProgress).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: "COUNTERPARTY_SENT_RESPONSE" })
        );
        expect(onRecordProgress.mock.calls[0][0].trackingNumber).toBe(
          number || undefined
        );
      }
    );

    it("shows return delivery without receiving the response file", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            followUpEvents: [
              {
                id: "return-event",
                confirmationId: "confirmation-1",
                eventType: "COUNTERPARTY_SENT_RESPONSE",
                actorId: "user-1",
                source: "PROJECT_TEAM_MANUAL",
                occurredAt: "2026-09-11T08:00:00Z",
                createdAt: "2026-09-11T08:00:00Z",
                payload: {
                  returnShipment: {
                    trackingNumber: "RETURN-100",
                    trackingStatus: "Delivered",
                    deliveredAt: "2026-09-14T08:30:00Z",
                  },
                },
              },
            ],
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );
      expect(screen.getByText("Return shipment delivered")).toBeVisible();
      expect(screen.getByText("Awaiting response")).toBeVisible();
      expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
        "Return shipment delivered"
      );
    });

    it("records the selected manual status without completing the program", () => {
      const onRecordProgress = vi.fn();
      const onCompleteProgram = vi.fn();
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation()}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={onRecordProgress}
          onUploadResponse={vi.fn()}
          onCompleteProgram={onCompleteProgram}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Record progress" }));
      fireEvent.change(screen.getByLabelText("Notes"), {
        target: { value: "Receipt confirmed by the counterparty" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save progress" }));

      expect(onRecordProgress).toHaveBeenCalledWith({
        eventType: "COUNTERPARTY_RECEIVED",
        notes: "Receipt confirmed by the counterparty",
      });
      expect(onCompleteProgram).not.toHaveBeenCalled();
    });

    it("does not offer redispatch as a generic follow-up event", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation()}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Record progress" }));
      fireEvent.click(screen.getByRole("combobox"));

      expect(
        screen.queryByRole("option", { name: "Redispatch requested" })
      ).not.toBeInTheDocument();
    });

    it("offers explicit completion only after the response has been recorded", () => {
      const onCompleteProgram = vi.fn();
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            status: "RESPONSE_RECEIVED",
            differenceStatus: "PENDING_FOLLOW_UP",
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={onCompleteProgram}
        />
      );

      expect(
        screen.queryByRole("button", { name: "Upload response" })
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Complete program" }));
      expect(onCompleteProgram).toHaveBeenCalledOnce();
    });

    it("does not offer completion before response review and formats timeline dates by minute", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({ status: "RESPONSE_RECEIVED" })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", { name: "Complete program" })
      ).not.toBeInTheDocument();
      expect(screen.getAllByText(/\d{1,2}:\d{2}/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Jul 5, 2026/).length).toBeGreaterThan(0);
    });

    it("places a warehouse rematch above its earlier withdrawal", () => {
      const updated = (
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            status: "RESPONSE_RECEIVED",
            followUpEvents: [
              {
                id: "withdrawn",
                confirmationId: "confirmation-1",
                eventType: "RESPONSE_WITHDRAWN",
                actorId: "user-1",
                source: "RESPONSE_INTAKE",
                occurredAt: "2026-09-12T04:06:46Z",
                createdAt: "2026-09-12T04:06:46Z",
              },
              {
                id: "rematched",
                confirmationId: "confirmation-1",
                eventType: "RESPONSE_RECEIVED",
                actorId: "user-1",
                source: "RESPONSE_INTAKE",
                occurredAt: "2026-08-13T15:10:47Z",
                createdAt: "2026-09-12T04:06:52Z",
                payload: { responseLibraryFileId: "warehouse-1" },
              },
            ],
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );
      const view = render(
        <ConfirmationFollowUpPanel
          {...updated.props}
          confirmation={{
            ...updated.props.confirmation,
            followUpEvents: updated.props.confirmation.followUpEvents.slice(
              0,
              1
            ),
          }}
        />
      );
      expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
        "Response withdrawn"
      );
      view.rerender(updated);
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Response received");
      expect(items[0]).toHaveTextContent("Sep 12, 2026");
      expect(items[1]).toHaveTextContent("Response withdrawn");
    });

    it("orders a backdated received response by its actual time", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            followUpEvents: [
              {
                id: "response-received-before-send",
                confirmationId: "confirmation-1",
                eventType: "RESPONSE_RECEIVED",
                actorId: "user-1",
                source: "RESPONSE_INTAKE",
                occurredAt: "2026-07-05T07:00:00.000Z",
                createdAt: "2026-07-05T11:00:00.000Z",
              },
            ],
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      const timelineItems = screen.getAllByRole("listitem");
      expect(timelineItems.map((item) => item.textContent)).toStrictEqual([
        expect.stringContaining("Initial dispatch"),
        expect.stringContaining("Confirmation created"),
        expect.stringContaining("Response received"),
      ]);
    });

    it("shows a later archive follow-up above an earlier withdrawal", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            followUpEvents: [
              {
                id: "response-withdrawn",
                confirmationId: "confirmation-1",
                eventType: "RESPONSE_WITHDRAWN",
                actorId: "user-1",
                source: "RESPONSE_INTAKE",
                occurredAt: "2026-07-05T11:00:00.000Z",
                createdAt: "2026-07-05T11:00:00.000Z",
              },
              {
                id: "response-archived",
                confirmationId: "confirmation-1",
                eventType: "REVIEW_RECORDED",
                actorId: "user-1",
                source: "PROJECT_TEAM_MANUAL",
                notes: "Response archived to the project",
                payload: { operation: "RESPONSE_ARCHIVED_TO_EMP" },
                occurredAt: "2026-07-05T11:36:00.000Z",
                createdAt: "2026-07-05T11:36:00.000Z",
              },
            ],
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      const timelineItems = screen.getAllByRole("listitem");
      expect(timelineItems.map((item) => item.textContent)).toStrictEqual([
        expect.stringContaining("Response archived to the project"),
        expect.stringContaining("Response withdrawn"),
        expect.stringContaining("Initial dispatch"),
        expect.stringContaining("Confirmation created"),
      ]);
    });

    it("offers review rollback for an awaiting response exception", () => {
      render(
        <ConfirmationFollowUpPanel
          confirmation={confirmation({
            status: "AWAITING_RESPONSE",
            differenceStatus: "EXCEPTION",
          })}
          copy={copy}
          trackingCopy={defaultConfirmationsCopy.tracking}
          locale="en-US"
          canEdit
          undoReviewAction={
            <button type="button">Undo review conclusion</button>
          }
          onRecordProgress={vi.fn()}
          onUploadResponse={vi.fn()}
          onCompleteProgram={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: "Undo review conclusion" })
      ).toBeVisible();
    });
  });

  it.each(["RESPONSE_RECEIVED", "CLOSED"] as const)(
    "keeps supplementary upload available after %s",
    (status) => {
      const onUploadResponse = vi.fn();
      const props = {
        canSupplementResponse: true,
        confirmation: confirmation({ status }),
        copy,
        locale: "en-US",
        trackingCopy: defaultConfirmationsCopy.tracking,
        onRecordProgress: vi.fn(),
        onUploadResponse,
        onCompleteProgram: vi.fn(),
      };
      const { rerender } = render(
        <ConfirmationFollowUpPanel {...props} canEdit />
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: defaultConfirmationsCopy.tracking.responseAddFiles,
        })
      );
      expect(onUploadResponse).toHaveBeenCalledOnce();
      rerender(<ConfirmationFollowUpPanel {...props} canEdit={false} />);
      expect(
        screen.queryByRole("button", {
          name: defaultConfirmationsCopy.tracking.responseAddFiles,
        })
      ).not.toBeInTheDocument();
    }
  );
});

vi.mock("./confirmation-logistics-unread", () => ({
  ConfirmationLogisticsReadMarker: () => null,
}));
