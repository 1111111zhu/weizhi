import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom

import { ProjectConfirmationTracking } from "./project-confirmation-tracking";

describe(ProjectConfirmationTracking, () => {
  afterEach(cleanup);

  it("shows artifact, queue, dispatch, tracking, and response state", () => {
    render(
      <ProjectConfirmationTracking
        artifact={{ pdfSha256: "abcdef0123456789", version: 2 }}
        dispatchRecords={[
          {
            at: "2026-07-12T08:00:00.000Z",
            method: "Courier",
            reference: "DISPATCH-001",
            trackingNumber: "SF123",
          },
        ]}
        latestPackage={{
          code: "PKG-001",
          status: "DISPATCHED",
          trackingNumber: "SF123",
        }}
        locale="en-US"
        queue={{
          claimedAt: null,
          queuedAt: "2026-07-12T08:00:00.000Z",
        }}
        response={{ status: "PENDING" }}
        status="PREPARED"
      />
    );

    expect(screen.getByText(/Version 2/)).toBeVisible();
    expect(screen.getByText(/abcdef012345/)).toBeVisible();
    expect(screen.getByText("Pending dispatch")).toBeVisible();
    expect(screen.getByText("PKG-001")).toBeVisible();
    expect(screen.getByText("SF123")).toBeVisible();
    expect(screen.getByText("Courier")).toBeVisible();
    expect(screen.getByText(/DISPATCH-001/)).toBeVisible();
    expect(screen.getByText("Pending response")).toBeVisible();
    expect(screen.getAllByText("Jul 12, 2026").length).toBeGreaterThanOrEqual(
      2
    );
    expect(document.body.textContent).not.toMatch(
      /\b\d{1,2}:\d{2}\s?(AM|PM)\b/
    );
  });

  it("offers withdrawal while a confirmation is pending dispatch", () => {
    const onWithdraw = vi.fn();
    const { rerender } = render(
      <ProjectConfirmationTracking
        artifact={{ pdfSha256: "abcdef", version: 1 }}
        locale="en-US"
        onWithdraw={onWithdraw}
        queue={{
          claimedAt: null,
          queuedAt: "2026-07-12T08:00:00.000Z",
        }}
        status="PREPARED"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.change(screen.getByLabelText("Withdrawal reason"), {
      target: { value: "Correct recipient details" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    expect(onWithdraw).toHaveBeenCalledWith("Correct recipient details");

    rerender(
      <ProjectConfirmationTracking
        artifact={{ pdfSha256: "abcdef", version: 1 }}
        locale="en-US"
        onWithdraw={onWithdraw}
        queue={{ claimedAt: null }}
        status="AWAITING_RESPONSE"
      />
    );
    expect(
      screen.queryByRole("button", { name: "Withdraw" })
    ).not.toBeInTheDocument();
  });

  it("allows withdrawing without a reason", () => {
    const onWithdraw = vi.fn();
    render(
      <ProjectConfirmationTracking
        artifact={{ pdfSha256: "abcdef", version: 1 }}
        locale="en-US"
        onWithdraw={onWithdraw}
        status="PREPARED"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    expect(onWithdraw).toHaveBeenCalledWith("");
  });

  it("lets a project member record an individual dispatch", () => {
    const onDispatch = vi.fn();
    render(
      <ProjectConfirmationTracking
        artifact={{ pdfSha256: "abcdef", version: 1 }}
        locale="en-US"
        onDispatch={onDispatch}
        status="PREPARED"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));
    fireEvent.change(screen.getByLabelText("Contact / email / address"), {
      target: { value: "confirmations@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm sent" }));

    expect(onDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "EMAIL",
        recipientContact: "confirmations@example.test",
        sentAt: expect.any(String),
      })
    );
  });
});
