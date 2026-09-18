// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "../../api/client";
import { defaultConfirmationsCopy } from "../../i18n/dictionaries";
import { ConfirmationOverviewMatrix } from "./confirmation-overview-matrix";

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
    dispatches: [],
    responses: [],
    ...overrides,
  };
}

function renderMatrix(
  confirmations: ProjectConfirmation[] = [confirmation()],
  onCellSelect = vi.fn()
) {
  render(
    <ConfirmationOverviewMatrix
      confirmations={confirmations}
      copy={defaultConfirmationsCopy}
      locale="en-US"
      now={new Date("2026-08-03T12:00:00.000Z")}
      onCellSelect={onCellSelect}
    />
  );
  return onCellSelect;
}

describe("ConfirmationOverviewMatrix", () => {
  afterEach(cleanup);

  it("renders as the shared DataGrid without the permanent description, legend, or row-count badge", () => {
    renderMatrix();

    const grid = screen.getByTestId("confirmation-overview-data-grid");
    expect(grid).toHaveAttribute("data-slot", "frame");
    expect(
      within(grid).getByRole("heading", { name: "Confirmation overview" })
    ).toBeVisible();
    expect(
      within(grid).queryByText(
        defaultConfirmationsCopy.overview.matrix.description
      )
    ).toBeNull();
    expect(within(grid).queryByText("Reading guide")).toBeNull();
    expect(
      within(grid).queryByLabelText(/Confirmation overview: \d+/)
    ).toBeNull();
    expect(
      within(grid).getByRole("table", { name: "Confirmation overview" })
    ).toBeVisible();
  });

  it("moves the full legend into a toolbar popover", async () => {
    renderMatrix();
    const user = userEvent.setup();

    await user.click(screen.getByTestId("confirmation-matrix-legend-trigger"));

    const legend = await screen.findByTestId(
      "confirmation-matrix-legend-content"
    );
    for (const label of [
      "Reading guide",
      "No records",
      "Few",
      "Some",
      "Many",
      "Pending",
      "Mismatch",
      "Completed",
    ]) {
      expect(within(legend).getByText(label)).toBeVisible();
    }
  });

  it("uses grouped headers and collapses sent and received to their subtotals", () => {
    renderMatrix();

    expect(
      screen.getByRole("columnheader", { name: "Preparation" })
    ).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Sent" })).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Response received" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "Processing" })
    ).toBeVisible();
    expect(
      screen.getByRole("columnheader", { name: "0–7 days" })
    ).toBeVisible();

    fireEvent.click(screen.getByTestId("confirmation-matrix-sent-toggle"));
    expect(screen.queryByRole("columnheader", { name: "0–7 days" })).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "Sent subtotal" })
    ).toBeVisible();

    fireEvent.click(screen.getByTestId("confirmation-matrix-received-toggle"));
    expect(
      screen.queryByRole("columnheader", { name: "Pending review" })
    ).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "Received subtotal" })
    ).toBeVisible();
  });

  it("supports count and percentage modes and preserves cell navigation", async () => {
    const onCellSelect = renderMatrix();
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: "Draft Bank 1" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Percentage" }));
    const cell = screen.getByRole("button", { name: "Draft Bank 100%" });
    await user.click(cell);

    expect(onCellSelect).toHaveBeenCalledWith({
      navigation: "ALL",
      column: "DRAFT",
      type: "BANK",
      category: "FINANCIAL",
      unclassified: false,
    });
  });

  it("shows metric headers as complete plain labels", () => {
    renderMatrix();
    for (const label of [
      "Category detail",
      "0–7 days",
      "8–14 days",
      "15–21 days",
      "22–30 days",
      "31–45 days",
      "46+ days",
    ]) {
      const header = screen.getByRole("columnheader", { name: label });
      expect(header).toBeVisible();
      expect(within(header).queryByRole("button")).toBeNull();
    }
  });

  it("keeps intensity and response semantics on the compact metric buttons", () => {
    renderMatrix([
      ...Array.from({ length: 7 }, (_, index) =>
        confirmation({ id: `draft-${index}` })
      ),
      confirmation({ id: "sent-1", status: "AWAITING_RESPONSE" }),
    ]);

    expect(
      screen.getByRole("button", { name: "Draft Bank 7" })
    ).toHaveAttribute("data-matrix-intensity", "high");
    expect(
      screen.getByRole("button", { name: "Pending review Bank 0" })
    ).toHaveAttribute("data-matrix-tone", "waiting");
    expect(
      screen.getByRole("button", { name: "Mismatch to handle Bank 0" })
    ).toHaveAttribute("data-matrix-tone", "mismatch");
    expect(
      screen.getByRole("button", { name: "Completed Bank 0" })
    ).toHaveAttribute("data-matrix-tone", "complete");
  });
});
