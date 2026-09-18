import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
// @vitest-environment happy-dom
import { StrictMode } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/api";

import { TmsApp } from "./tms-app";

const me = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const getTmsApprovalProjects = vi.hoisted(() => vi.fn());
const getIntranetPortalUrl = vi.hoisted(() =>
  vi.fn(() => "http://localhost:3007/" as const)
);
const partnerUser: User = {
  id: "partner-1",
  email: "partner@projectwing.local",
  name: "Wing Zenith",
  globalRole: "PARTNER",
};

vi.mock("@/lib/api", () => ({
  getTmsApprovalProjects,
  me,
  signOut,
}));

vi.mock("@/lib/portal", () => ({
  getIntranetPortalUrl,
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/tms-header", () => ({
  TmsHeader: ({
    onOpenApprovals,
    onOpenTimesheet,
    timesheetActive,
  }: {
    onOpenApprovals?: () => void;
    onOpenTimesheet?: () => void;
    timesheetActive?: boolean;
  }) => (
    <header data-testid="persistent-tms-header">
      <button
        aria-current={timesheetActive ? "page" : undefined}
        type="button"
        onClick={onOpenTimesheet}
      >
        顶部时间表
      </button>
      <button
        type="button"
        disabled={!onOpenApprovals}
        onClick={onOpenApprovals}
      >
        顶部审批
      </button>
    </header>
  ),
}));

vi.mock("@/components/login-screen", () => ({
  LoginScreen: ({
    onAuthenticated,
  }: {
    onAuthenticated: (user: User, options: { autoLogin: boolean }) => void;
  }) => (
    <section>
      <h1>登录 TMS</h1>
      <button
        type="button"
        onClick={() => onAuthenticated(partnerUser, { autoLogin: false })}
      >
        Authenticate
      </button>
    </section>
  ),
}));

vi.mock("@/components/timesheet-workspace", () => ({
  TimesheetWorkspace: ({
    approvalPending,
    onOpenApprovals,
    onOpenQuery,
    onSignOut,
    user,
  }: {
    approvalPending?: boolean;
    onOpenApprovals?: () => void;
    onOpenQuery?: () => void;
    onSignOut: () => void;
    user: User;
  }) => (
    <>
      <p>{user.name}</p>
      {approvalPending ? <span>存在待审批</span> : null}
      {onOpenApprovals ? (
        <button type="button" onClick={onOpenApprovals}>
          审批
        </button>
      ) : null}
      {onOpenQuery ? (
        <button type="button" onClick={onOpenQuery}>
          搜索
        </button>
      ) : null}
      <button type="button" onClick={onSignOut}>
        退出登录
      </button>
    </>
  ),
}));

vi.mock("@/components/query-workspace", () => ({
  QueryWorkspace: ({ onBack }: { onBack: () => void }) => (
    <section>
      <h1>工时搜索</h1>
      <button type="button" onClick={onBack}>
        返回工时
      </button>
    </section>
  ),
}));

vi.mock("@/components/approval-workspace", () => ({
  readApprovalFilters: () => ({ year: 2026, month: 7, period: "all" }),
  ApprovalWorkspace: ({
    approvalPending,
    onApprovalPendingChange,
    onOpenQuery,
  }: {
    approvalPending?: boolean;
    onApprovalPendingChange?: (pending: boolean) => void;
    onOpenQuery?: () => void;
  }) => (
    <section>
      <h1>工时审批</h1>
      {approvalPending ? <span>审批页存在待审批</span> : null}
      <button type="button" onClick={() => onApprovalPendingChange?.(false)}>
        同步审批状态
      </button>
      <button type="button" onClick={onOpenQuery ?? (() => {})}>
        审批页搜索
      </button>
    </section>
  ),
}));

describe(TmsApp, () => {
  beforeEach(() => {
    me.mockReset();
    signOut.mockReset();
    getTmsApprovalProjects.mockReset();
    getTmsApprovalProjects.mockResolvedValue({
      projects: [{ engagementId: "engagement-1" }],
    });
    getIntranetPortalUrl.mockClear();
    navigate.mockReset();
    window.history.replaceState(null, "", "/");
  });

  afterEach(cleanup);

  it("shows the shared session state while redirecting an unauthenticated workspace", async () => {
    me.mockResolvedValue(null);
    render(<TmsApp navigate={navigate} />);

    await expect(
      screen.findByTestId("project-wing-loading-progress")
    ).resolves.toBeTruthy();
    expect(me).toHaveBeenCalledWith();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/zh-CN/login"));
  });

  it("does not render a loading screen while restoring a protected session", () => {
    me.mockReturnValue(new Promise(() => {}));
    render(<TmsApp navigate={navigate} />);

    expect(screen.getByTestId("project-wing-loading-progress")).toBeTruthy();
  });

  it("restores the same entry only once when StrictMode replays the effect", async () => {
    me.mockResolvedValue(null);

    render(
      <StrictMode>
        <TmsApp navigate={navigate} />
      </StrictMode>
    );

    await expect(
      screen.findByTestId("project-wing-loading-progress")
    ).resolves.toBeTruthy();
    expect(me).toHaveBeenCalledExactlyOnceWith();
    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(navigate).toHaveBeenCalledWith("/zh-CN/login");
  });

  it("returns to the shared session state after signing out", async () => {
    me.mockResolvedValue(partnerUser);
    render(<TmsApp navigate={navigate} />);

    await expect(screen.findByText("Wing Zenith")).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(getIntranetPortalUrl).not.toHaveBeenCalled();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/zh-CN/login"));
    await expect(
      screen.findByTestId("project-wing-loading-progress")
    ).resolves.toBeTruthy();
  });

  it("does not expose approval to an account without project approval access", async () => {
    me.mockResolvedValue({
      ...partnerUser,
      id: "staff-1",
      email: "staff@projectwing.local",
      name: "Staff",
      globalRole: "STAFF",
    });
    getTmsApprovalProjects.mockResolvedValue({ projects: [] });

    render(<TmsApp navigate={navigate} />);

    await expect(screen.findByText("Staff")).resolves.toBeTruthy();
    await waitFor(() => expect(getTmsApprovalProjects).not.toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "审批" })).toBeNull();
  });

  it("opens the requested approval workspace for a structured task target", async () => {
    me.mockResolvedValue(partnerUser);

    render(<TmsApp initialWorkspace="APPROVALS" navigate={navigate} />);

    await expect(
      screen.findByRole("heading", { name: "工时审批" })
    ).resolves.toBeTruthy();
  });

  it("does not honor an approval target for a user without approval access", async () => {
    me.mockResolvedValue({
      ...partnerUser,
      id: "staff-1",
      name: "Staff",
      globalRole: "STAFF",
    });

    render(<TmsApp initialWorkspace="APPROVALS" navigate={navigate} />);

    await expect(screen.findByText("Staff")).resolves.toBeTruthy();
    expect(screen.queryByRole("heading", { name: "工时审批" })).toBeNull();
  });

  it.each(["PARTNER", "MANAGER"] as const)(
    "exposes approval to a %s account with project access",
    async (globalRole) => {
      me.mockResolvedValue({ ...partnerUser, globalRole });
      getTmsApprovalProjects.mockResolvedValue({
        projects: [{ engagementId: "engagement-1" }],
      });

      render(<TmsApp navigate={navigate} />);

      await expect(
        screen.findByRole("button", { name: "审批" })
      ).resolves.toBeTruthy();
      await waitFor(() =>
        expect(getTmsApprovalProjects).toHaveBeenCalledWith(2026, 7)
      );
    }
  );

  it("keeps approval available for an approver when the project lookup is empty", async () => {
    me.mockResolvedValue(partnerUser);
    getTmsApprovalProjects.mockResolvedValue({ projects: [] });

    render(<TmsApp navigate={navigate} />);

    const approvalButton = await screen.findByRole("button", {
      name: "顶部审批",
    });
    await waitFor(() =>
      expect((approvalButton as HTMLButtonElement).disabled).toBeFalsy()
    );
  });

  it("opens and closes the Manager query workspace", async () => {
    me.mockResolvedValue({ ...partnerUser, globalRole: "MANAGER" });
    render(<TmsApp navigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "搜索" }));
    await expect(
      screen.findByRole("heading", { name: "工时搜索" })
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "返回工时" }));
    await expect(screen.findByText("Wing Zenith")).resolves.toBeTruthy();
  });

  it("keeps search and pending state available after entering approval", async () => {
    me.mockResolvedValue(partnerUser);
    getTmsApprovalProjects.mockResolvedValue({
      projects: [{ engagementId: "engagement-1", pendingCount: 2 }],
    });

    render(<TmsApp navigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "审批" }));
    await expect(
      screen.findByRole("heading", { name: "工时审批" })
    ).resolves.toBeTruthy();
    expect(screen.getByText("审批页存在待审批")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "审批页搜索" }));
    await expect(
      screen.findByRole("heading", { name: "工时搜索" })
    ).resolves.toBeTruthy();
  });

  it("keeps the same header mounted while switching workspaces", async () => {
    me.mockResolvedValue(partnerUser);
    render(<TmsApp navigate={navigate} />);

    const header = await screen.findByTestId("persistent-tms-header");
    const approvalButton = screen.getByRole("button", { name: "顶部审批" });
    await waitFor(() =>
      expect((approvalButton as HTMLButtonElement).disabled).toBeFalsy()
    );
    fireEvent.click(approvalButton);

    await expect(
      screen.findByRole("heading", { name: "工时审批" })
    ).resolves.toBeTruthy();
    expect(screen.getByTestId("persistent-tms-header")).toBe(header);
  });

  it("returns to the default timesheet from the persistent header", async () => {
    me.mockResolvedValue(partnerUser);
    render(<TmsApp navigate={navigate} />);

    const timesheetButton = await screen.findByRole("button", {
      name: "顶部时间表",
    });
    expect(timesheetButton.getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "顶部审批" }));
    await expect(
      screen.findByRole("heading", { name: "工时审批" })
    ).resolves.toBeTruthy();
    expect(timesheetButton.getAttribute("aria-current")).toBeNull();

    fireEvent.click(timesheetButton);
    await expect(screen.findByText("Wing Zenith")).resolves.toBeTruthy();
    expect(timesheetButton.getAttribute("aria-current")).toBe("page");
  });

  it("passes the pending approval state to the timesheet header", async () => {
    me.mockResolvedValue(partnerUser);
    getTmsApprovalProjects.mockResolvedValue({
      projects: [{ engagementId: "engagement-1", pendingCount: 2 }],
    });

    render(<TmsApp navigate={navigate} />);

    await expect(screen.findByText("存在待审批")).resolves.toBeTruthy();
    expect(getTmsApprovalProjects).toHaveBeenCalledWith(2026, 7);
  });

  it("updates the shared pending state after the approval view refreshes", async () => {
    me.mockResolvedValue(partnerUser);
    getTmsApprovalProjects.mockResolvedValue({
      projects: [{ engagementId: "engagement-1", pendingCount: 2 }],
    });

    render(<TmsApp navigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "审批" }));
    await expect(screen.findByText("审批页存在待审批")).resolves.toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "同步审批状态" }));

    await waitFor(() => {
      expect(screen.queryByText("审批页存在待审批")).toBeNull();
    });
  });
});
