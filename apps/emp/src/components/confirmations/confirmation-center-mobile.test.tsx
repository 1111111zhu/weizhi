// @vitest-environment jsdom
import { ProjectWingThemeProvider } from "@project-wing/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectConfirmation } from "@/api/client";
import type { ConfirmationWorkspaceSummary } from "@/api/confirmation-workspace";
import { getDictionary } from "@/i18n/dictionaries";

import { ConfirmationCenterMobile } from "./confirmation-center-mobile";
import type {
  ConfirmationCenterView,
  ConfirmationMobileSelection,
  ConfirmationSort,
} from "./confirmation-center-mobile";

const dictionary = await getDictionary("en-US");
const summary: ConfirmationWorkspaceSummary = {
  projectId: "p1",
  projectName: "Audit project with a long title",
  projectCode: "AUD-001",
  reportDate: "2027-03-31",
  totalConfirmationCount: 1,
  ownConfirmationCount: 1,
  awaitingResponseCount: 1,
  statusCounts: {
    DRAFT: 0,
    PREPARED: 0,
    AWAITING_RESPONSE: 1,
    RESPONSE_RECEIVED: 0,
    CLOSED: 0,
    VOIDED: 0,
  },
};
const row: ProjectConfirmation = {
  id: "c1",
  projectId: "p1",
  type: "BANK",
  status: "AWAITING_RESPONSE",
  counterpartyName: "Example Bank",
  teamConfirmStatus: "PENDING",
  createdBy: "u1",
  createdAt: "2026-08-01",
  updatedAt: "2026-09-01",
};
const onOpen = vi.fn();
const retry = vi.fn();
function Harness({
  error = false,
  loading = false,
}: {
  error?: boolean;
  loading?: boolean;
}) {
  const [view, setView] = useState<ConfirmationCenterView>("ALL");
  const [selection, setSelection] =
    useState<ConfirmationMobileSelection | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ConfirmationSort>("REPORT_DATE_ASC");
  return (
    <ProjectWingThemeProvider>
      <ConfirmationCenterMobile
        dictionary={dictionary}
        locale="en-US"
        view={view}
        onViewChange={setView}
        selection={selection}
        onSelectionChange={setSelection}
        summaries={[summary]}
        rows={[row]}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        loading={loading}
        error={error}
        onRetry={retry}
        detailsLoading={false}
        detailsError={false}
        onRetryDetails={retry}
        onOpen={onOpen}
        onLeave={vi.fn()}
        headerActions={null}
        library={<div>Library content</div>}
      />
    </ProjectWingThemeProvider>
  );
}
describe("mobile confirmation center", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/en-US/confirmations");
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("shows projects and progress without mounting the desktop table", async () => {
    render(<Harness />);
    expect(
      screen.getByRole("link", { name: /Audit project with a long title/ })
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Example Bank")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Audit project with a long title/ })
    ).toHaveLength(5);
    fireEvent.click(
      screen.getByRole("link", { name: /Audit project with a long title/ })
    );
    await screen.findByRole("link", { name: /Example Bank/ });
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await screen.findByRole("link", {
      name: /Audit project with a long title/,
    });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Example Bank")).toBeNull();
  });

  it("opens a project as a separate list, then routes to the existing confirmation", async () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("link", { name: /Audit project with a long title/ })
    );
    const confirmation = await screen.findByRole("link", {
      name: /Example Bank/,
    });
    expect(confirmation.getAttribute("href")).toContain("confirmationId=c1");
    expect(
      screen.queryByRole("link", { name: /Audit project with a long title/ })
    ).toBeNull();
    fireEvent.click(confirmation);
    expect(onOpen).toHaveBeenCalledWith(row);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Audit project with a long title/ })
      ).toBeTruthy()
    );
  });

  it("restores a project deep link and retains search scope", async () => {
    window.history.replaceState(
      null,
      "",
      "/en-US/confirmations#confirmations?view=ALL&project=p1&name=Audit&q=Audit"
    );
    render(<Harness />);
    await expect(
      screen.findByRole("link", { name: /Example Bank/ })
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Back" }));
    await waitFor(() =>
      expect(screen.getByRole("searchbox").getAttribute("value")).toBe("Audit")
    );
  });

  it("keeps status drill-down in the navigation state", async () => {
    render(<Harness />);
    const sent = screen.getByRole("button", {
      name: `${summary.projectName} · ${dictionary.confirmations.overview.stages.sent} 1`,
    });
    fireEvent.click(sent);
    await screen.findByRole("link", { name: /Example Bank/ });
    expect(window.location.hash).toContain("status=AWAITING_RESPONSE");
  });

  it("supports failed and loading states without showing stale project actions", () => {
    const result = render(<Harness error />);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("link", { name: /Audit project with a long title/ })
    ).toBeNull();
    result.unmount();
    render(<Harness loading />);
    expect(
      screen.queryByRole("link", { name: /Audit project with a long title/ })
    ).toBeNull();
  });
});
