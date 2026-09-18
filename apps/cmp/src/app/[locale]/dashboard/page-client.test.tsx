import { ProjectWingThemeProvider } from "@project-wing/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../../api/client";
import { CmpI18nProvider } from "../../../i18n/client";
import { CmpDashboardClient } from "./page-client";

const replace = vi.fn();
const getIntranetPortalUrl = vi.hoisted(() =>
  vi.fn(() => "http://localhost:3007/" as const)
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("../../../api/client", () => ({
  api: {
    me: vi.fn(),
    cmpDashboard: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("../../../lib/portal", () => ({ getIntranetPortalUrl }));

describe(CmpDashboardClient, () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = "NEXT_LOCALE=; path=/; max-age=0";
    window.history.replaceState(null, "", "/cmp/dashboard");
    vi.clearAllMocks();
  });

  it("leaves unauthenticated navigation to the shared auth boundary", async () => {
    vi.mocked(api.me).mockResolvedValue(null);

    renderWithClient(<CmpDashboardClient />);

    await waitFor(() => expect(api.me).toHaveBeenCalledOnce());
    expect(replace).not.toHaveBeenCalled();
    expect(api.cmpDashboard).not.toHaveBeenCalled();
  });

  it("uses the shared action contract to retry a failed dashboard request", async () => {
    vi.mocked(api.me).mockResolvedValue({
      id: "user-1",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
    });
    vi.mocked(api.cmpDashboard).mockRejectedValue(
      new Error("Dashboard unavailable")
    );

    renderWithClient(<CmpDashboardClient />);

    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(retry).toHaveAttribute("data-variant", "primary");
    expect(retry).toHaveAttribute("data-size", "lg");
    expect(retry).toHaveAttribute("data-full-width", "true");

    fireEvent.click(retry);
    await waitFor(() => expect(api.cmpDashboard).toHaveBeenCalledTimes(2));
  });

  it("renders the authenticated CMP dashboard", async () => {
    vi.mocked(api.me).mockResolvedValue({
      id: "user-1",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
    });
    vi.mocked(api.cmpDashboard).mockResolvedValue({
      draftsAssignedToMe: 0,
      approvalsAssignedToMe: 0,
      returnedRequests: 0,
      myClients: 0,
      myEngagements: 0,
      recentChanges: [],
      recentApprovals: [],
    });

    renderWithClient(<CmpDashboardClient />);

    await expect(
      screen.findByRole("heading", {
        name: "Engagement Management Platform",
      })
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account menu" })
    ).toBeInTheDocument();
  });

  it("returns to CMP login instead of the portal after signing out", async () => {
    vi.mocked(api.me).mockResolvedValue({
      id: "user-1",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
    });
    vi.mocked(api.cmpDashboard).mockResolvedValue({
      draftsAssignedToMe: 0,
      approvalsAssignedToMe: 0,
      returnedRequests: 0,
      myClients: 0,
      myEngagements: 0,
      recentChanges: [],
      recentApprovals: [],
    });

    renderWithClient(<CmpDashboardClient />);
    await screen.findByRole("heading", {
      name: "Engagement Management Platform",
    });

    fireEvent.pointerEnter(screen.getByTestId("cmp-account-button"));
    fireEvent.click(
      await screen.findByRole("button", { name: /退出登录|sign out/i })
    );

    await waitFor(() => expect(api.signOut).toHaveBeenCalledOnce());
    expect(replace).toHaveBeenCalledWith("/en-US/login");
  });

  it("redirects non-IT portal users to Clients without requesting dashboard data", async () => {
    window.history.replaceState(null, "", "/cmp/dashboard?from=portal");
    vi.mocked(api.me).mockResolvedValue({
      id: "user-1",
      email: "manager@example.com",
      name: "Manager",
      globalRole: "MANAGER",
    });

    renderWithClient(<CmpDashboardClient />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en-US/client"));
    expect(api.cmpDashboard).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("project-wing-token")).toBeNull();
    expect(window.sessionStorage.getItem("project-wing-token")).toBeNull();
  });
});

function renderWithClient(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectWingThemeProvider>
        <CmpI18nProvider>{element}</CmpI18nProvider>
      </ProjectWingThemeProvider>
    </QueryClientProvider>
  );
}
