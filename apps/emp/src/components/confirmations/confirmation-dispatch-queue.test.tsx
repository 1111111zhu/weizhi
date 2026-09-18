import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import type { ConfirmationDispatchQueueItem } from "../../api/client";
import { getDictionary } from "../../i18n/dictionaries";
import { ConfirmationDispatchQueue } from "./confirmation-dispatch-queue";

const item: ConfirmationDispatchQueueItem = {
  confirmationId: "confirmation-1",
  confirmationCode: "AUD-2026-0001-YH-001",
  project: {
    id: "project-1",
    name: "Orchid audit",
    projectCode: "AUD-2026-0001",
  },
  type: "BANK",
  counterpartyName: "Example bank",
  templateCode: "PRC_BANK_TEMPLATE_1",
  artifact: {
    id: "artifact-1",
    version: 1,
    disposition: "ACTIVE",
    templateCode: "PRC_BANK_TEMPLATE_1",
    templateVersion: "1.0",
    pdfSha256: "a".repeat(64),
    submittedAt: "2026-07-12T02:00:00.000Z",
  },
  preparedDispatchMethod: "COURIER",
  plannedSendDate: null,
  queuedAt: "2026-07-12T02:00:00.000Z",
  updatedAt: "2026-07-12T02:00:00.000Z",
  stage: "PENDING_DISPATCH",
  queueStatus: "CLAIMED",
  validationStatus: "READY",
  claim: { userId: "officer-1", claimedAt: "2026-07-12T02:01:00.000Z" },
  pic: null,
  revisionReason: null,
  latestDispatch: null,
};

describe(ConfirmationDispatchQueue, () => {
  afterEach(cleanup);

  it("keeps printing and dispatching scoped to the individual claimed item", async () => {
    const dictionary = await getDictionary("en-US");
    const onDispatch = vi.fn();
    const onPrint = vi.fn();
    const onSelect = vi.fn();
    const onReturn = vi.fn();
    render(
      <ConfirmationDispatchQueue
        copy={dictionary.confirmationCenter.dispatchQueue}
        closeLabel="Cancel"
        currentUserId="officer-1"
        isLoading={false}
        isProcessing={false}
        items={[item]}
        onClaim={vi.fn()}
        onCompleteMockDelivery={vi.fn()}
        onDispatch={onDispatch}
        onSelect={onSelect}
        onPrint={onPrint}
        onReturn={onReturn}
        onStageChange={vi.fn()}
        stage="PENDING_DISPATCH"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Print confirmations" })
    );
    expect(onPrint).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByText("Example bank"));
    expect(onSelect).toHaveBeenCalledWith(item);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send confirmation" })
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Return for revision" })
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Return reason" }), {
      target: { value: "Recipient details need review." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Return for revision" })
    );
    expect(onReturn).toHaveBeenCalledWith(
      item,
      "Recipient details need review."
    );
  });

  it("uses a localized status column for sent confirmations", async () => {
    const dictionary = await getDictionary("zh-CN");
    const sentItem: ConfirmationDispatchQueueItem = {
      ...item,
      claim: null,
      latestDispatch: {
        id: "dispatch-1",
        method: "EMAIL",
        executionStatus: "SENT",
        sentAt: "2026-07-12T02:05:00.000Z",
        deliveredAt: null,
        courierName: null,
        trackingNumber: null,
        providerName: "MANUAL",
        providerReference: "email-1",
      },
      stage: "SENT",
    };
    render(
      <ConfirmationDispatchQueue
        copy={dictionary.confirmationCenter.dispatchQueue}
        closeLabel="取消"
        currentUserId="officer-1"
        isLoading={false}
        isProcessing={false}
        items={[sentItem]}
        onClaim={vi.fn()}
        onCompleteMockDelivery={vi.fn()}
        onDispatch={vi.fn()}
        onSelect={vi.fn()}
        onPrint={vi.fn()}
        onReturn={vi.fn()}
        onStageChange={vi.fn()}
        stage="SENT"
      />
    );

    expect(screen.getByRole("columnheader", { name: "状态" })).toBeVisible();
    expect(screen.getByText("已发送")).toBeVisible();
    expect(screen.queryByText("SENT")).not.toBeInTheDocument();
  });
});
