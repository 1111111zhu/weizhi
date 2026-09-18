// @vitest-environment jsdom
import { ProjectWingThemeProvider } from "@project-wing/ui";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "@/api/client";
import { getConfirmationOverviewMobileCopy } from "@/i18n/confirmation-overview-mobile";
import {
  defaultConfirmationsCopy as copy,
  getDictionary,
} from "@/i18n/dictionaries";

import { ConfirmationOverviewMatrix } from "./confirmation-overview-matrix";

const now = new Date("2026-08-03T12:00:00Z");
const mobileCopy = getConfirmationOverviewMobileCopy("en-US");
function record(
  id: string,
  overrides: Partial<ProjectConfirmation> = {}
): ProjectConfirmation {
  return {
    id,
    projectId: "project",
    type: "BANK",
    status: "DRAFT",
    counterpartyName: "Example Bank",
    teamConfirmStatus: "PENDING",
    createdBy: "user",
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-01T12:00:00Z",
    dispatches: [],
    responses: [],
    ...overrides,
  };
}
const sent = record("sent", {
  status: "AWAITING_RESPONSE",
  dispatches: [
    {
      id: "dispatch",
      confirmationId: "sent",
      sequence: 1,
      method: "COURIER",
      sentAt: "2026-06-01T12:00:00Z",
      createdBy: "user",
      createdAt: "2026-06-01T12:00:00Z",
    },
  ],
});
function setup(rows: ProjectConfirmation[] = [record("draft"), sent]) {
  const select = vi.fn();
  render(
    <ProjectWingThemeProvider>
      <ConfirmationOverviewMatrix
        confirmations={rows}
        copy={copy}
        locale="en-US"
        now={now}
        onCellSelect={select}
      />
    </ProjectWingThemeProvider>
  );
  return select;
}
describe("mobile confirmation overview", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("767"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows all-category metrics without a wide table and excludes voided records", async () => {
    const select = setup([
      record("draft"),
      sent,
      record("voided", { status: "VOIDED" }),
    ]);
    await screen.findByTestId("confirmation-overview-mobile");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Total Total 2" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Draft Total 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sent Total 1" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Sent Total 1" }));
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ navigation: "ALL", column: "SENT_TOTAL" })
    );
  });

  it("uses the selected category denominator for percentages and preserves drill-down", async () => {
    const user = userEvent.setup();
    const select = setup([
      record("draft"),
      sent,
      record("lawyer", { type: "LAWYER" }),
    ]);
    await screen.findByTestId("confirmation-overview-mobile");
    await user.click(
      screen.getByRole("combobox", { name: copy.register.columns.type })
    );
    await user.click(
      await screen.findByRole("option", {
        name: /Financial institutions · Bank/,
      })
    );
    await user.click(
      screen.getByRole("button", { name: copy.overview.matrix.percentMode })
    );
    await user.click(screen.getByRole("button", { name: "Draft Bank 50%" }));
    expect(select).toHaveBeenCalledWith({
      navigation: "ALL",
      column: "DRAFT",
      type: "BANK",
      category: "FINANCIAL",
      unclassified: false,
    });
    expect(screen.getByText(mobileCopy.percentHint)).toBeVisible();
  });

  it("retains age bucket and received-detail navigation in bottom sheets", async () => {
    const user = userEvent.setup();
    const select = setup();
    await screen.findByTestId("confirmation-overview-mobile");
    await user.click(
      screen.getByRole("button", { name: mobileCopy.sentAging })
    );
    const aging = await screen.findByRole("dialog", {
      name: `${mobileCopy.allCategories} · ${mobileCopy.sentAging}`,
    });
    await user.click(
      within(aging).getByRole("button", {
        name: `${copy.overview.ageBuckets.days46Plus} Total 1`,
      })
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ column: "SENT_46_PLUS" })
    );
    await user.click(within(aging).getByRole("button", { name: "Close" }));
    await user.click(
      screen.getByRole("button", { name: mobileCopy.receivedDetails })
    );
    const received = await screen.findByRole("dialog", {
      name: `${mobileCopy.allCategories} · ${mobileCopy.receivedDetails}`,
    });
    const mismatch = within(received).getByRole("button", {
      name: `${copy.overview.matrix.columns.receivedMismatch} Total 0`,
    });
    expect(mismatch).toHaveAttribute("data-matrix-tone", "mismatch");
    await user.click(mismatch);
    expect(select).toHaveBeenLastCalledWith(
      expect.objectContaining({ column: "RECEIVED_MISMATCH" })
    );
  });

  it("keeps unclassified records addressable", async () => {
    const user = userEvent.setup();
    const select = setup([record("unknown", { type: "UNCLASSIFIED" })]);
    await screen.findByTestId("confirmation-overview-mobile");
    await user.click(
      screen.getByRole("combobox", { name: copy.register.columns.type })
    );
    await user.click(
      await screen.findByRole("option", { name: /^Unclassified/ })
    );
    await user.click(
      screen.getByRole("button", { name: "Total Unclassified 1" })
    );
    expect(select).toHaveBeenCalledWith({
      navigation: "ALL",
      column: "TOTAL",
      type: undefined,
      category: undefined,
      unclassified: true,
    });
  });

  it("shows dashes for an empty denominator and keeps a mode selected", async () => {
    const user = userEvent.setup();
    setup([]);
    await screen.findByTestId("confirmation-overview-mobile");
    await user.click(
      screen.getByRole("button", { name: copy.overview.matrix.percentMode })
    );
    expect(screen.getByRole("button", { name: "Total Total —" })).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: copy.overview.matrix.percentMode })
    );
    expect(
      screen.getByRole("button", { name: copy.overview.matrix.percentMode })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("localizes the legend and does not use the generic English overflow menu", async () => {
    const user = userEvent.setup();
    const dictionary = await getDictionary("zh-CN");
    render(
      <ProjectWingThemeProvider>
        <ConfirmationOverviewMatrix
          confirmations={[]}
          copy={dictionary.confirmations}
          locale="zh-CN"
          onCellSelect={vi.fn()}
        />
      </ProjectWingThemeProvider>
    );
    await screen.findByTestId("confirmation-overview-mobile");
    await user.click(screen.getByRole("button", { name: "图例" }));
    const legend = await screen.findByRole("dialog", { name: "图例" });
    expect(within(legend).getByText("阅读提示")).toBeVisible();
    expect(within(legend).getByText("不符待处理")).toBeVisible();
    expect(screen.queryByText("More actions")).toBeNull();
  });
});
