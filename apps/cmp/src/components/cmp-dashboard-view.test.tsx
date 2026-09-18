import { render, screen } from "@testing-library/react";

import { CmpI18nProvider } from "../i18n/client";
import { CmpDashboardView } from "./cmp-dashboard-view";

describe(CmpDashboardView, () => {
  it("renders clickable CMP dashboard cards and activity states", () => {
    render(
      <CmpI18nProvider>
        <CmpDashboardView
          summary={{
            draftsAssignedToMe: 0,
            approvalsAssignedToMe: 1,
            returnedRequests: 0,
            myClients: 3,
            myEngagements: 2,
            recentChanges: [],
            recentApprovals: [
              {
                id: "request-1",
                type: "approval",
                title: "EA-001",
                subtitle: "Engagement Acceptance",
                timestamp: "2026-07-08T00:00:00.000Z",
              },
            ],
          }}
        />
      </CmpI18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Engagement Management Platform" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Drafts assigned to me/ })
    ).toHaveAttribute(
      "href",
      "/en-US/acceptance?tab=requests&status=DRAFT,STAFF_EDITING"
    );
    expect(
      screen.getByRole("link", { name: /Approvals assigned to me/ })
    ).toHaveAttribute("href", "/en-US/acceptance?tab=approvals");
    expect(screen.getByRole("link", { name: /My clients/ })).toHaveAttribute(
      "href",
      "/en-US/client"
    );
    expect(screen.getByRole("link", { name: /EA-001/ })).toHaveAttribute(
      "href",
      "/en-US/acceptance?tab=approvals&requestId=request-1"
    );
    expect(screen.getByText("No client changes")).toBeInTheDocument();
  });
});
