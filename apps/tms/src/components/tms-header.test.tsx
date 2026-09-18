import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
// @vitest-environment happy-dom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type * as TmsApi from "@/lib/api";
import type { User } from "@/lib/api";

import { TmsHeader } from "./tms-header";

type TmsApiModule = typeof TmsApi;

vi.stubGlobal(
  "ResizeObserver",
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
);

const { setFlavor, setFontSize } = vi.hoisted(() => ({
  setFlavor: vi.fn(),
  setFontSize: vi.fn(),
}));

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    flavor: "latte",
    accent: "lime",
    fontSize: "md",
    setFlavor,
    setFontSize,
  }),
}));

vi.mock("@/lib/api", async () => {
  const original = await vi.importActual<TmsApiModule>("@/lib/api");
  return {
    ...original,
    impersonateDevelopmentAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/portal", () => ({
  getIntranetPortalUrl: () => "http://localhost:3007/",
}));

const managerUser: User = {
  id: "manager-1",
  email: "manager@projectwing.local",
  name: "Manager",
  globalRole: "MANAGER",
};

describe(TmsHeader, () => {
  it("uses the three-line TMS brand and retains the approval action", () => {
    const homeHtml = renderToString(
      <TmsHeader
        user={managerUser}
        approvalPending
        timesheetActive
        onOpenApprovals={() => {}}
        onOpenTimesheet={() => {}}
        onSignOut={() => {}}
      />
    );
    const approvalHtml = renderToString(
      <TmsHeader
        user={managerUser}
        approvalActive
        onOpenQuery={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(homeHtml).toMatch(
      /project-wing-top-bar-status-icon[\s\S]*data-testid="approval-icon"[\s\S]*project-wing-top-bar-status-dot/
    );
    expect(approvalHtml).not.toMatch(
      /data-action-id="approvals"[^>]*disabled=""/
    );
  });

  it("uses an expandable action bar for home, approval, and settings", () => {
    const html = renderToString(
      <TmsHeader
        user={managerUser}
        onOpenApprovals={() => {}}
        onOpenQuery={() => {}}
        onOpenTimesheet={() => {}}
        onSignOut={() => {}}
      />
    );

    expect(html.indexOf('data-action-id="portal-home"')).toBeLessThan(
      html.indexOf('data-action-id="timesheet"')
    );
    expect(html.indexOf('data-action-id="timesheet"')).toBeLessThan(
      html.indexOf('data-action-id="approvals"')
    );
    expect(html.indexOf('data-action-id="approvals"')).toBeLessThan(
      html.indexOf('data-action-id="query"')
    );
    expect(html.indexOf('data-action-id="query"')).toBeLessThan(
      html.indexOf('data-action-id="settings"')
    );
  });

  it("returns to the actual previous browser page when no workspace return is available", () => {
    const historyBack = vi.spyOn(window.history, "back").mockReturnValue();
    const historyLength = vi
      .spyOn(window.history, "length", "get")
      .mockReturnValue(2);
    const { unmount } = render(
      <TmsHeader
        user={managerUser}
        onOpenApprovals={() => {}}
        onSignOut={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "返回上一页" }));
    expect(historyBack).toHaveBeenCalledOnce();

    unmount();
    historyBack.mockRestore();
    historyLength.mockRestore();
  });

  it("uses touch-sized mobile settings with the existing preference callbacks", () => {
    cleanup();
    setFlavor.mockClear();
    setFontSize.mockClear();
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        matches: query.includes("767"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    try {
      render(<TmsHeader user={managerUser} onSignOut={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "功能导航" }));
      fireEvent.click(screen.getByRole("button", { name: "设置" }));
      const dialog = screen.getByRole("dialog", { name: "设置" });
      const appearance = within(dialog).getByRole("group", { name: "外观" });
      expect(
        within(appearance)
          .getByRole("button", { name: "日间" })
          .getAttribute("aria-pressed")
      ).toBe("true");
      fireEvent.click(within(appearance).getByRole("button", { name: "夜间" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "大" }));
      expect(setFlavor).toHaveBeenCalledWith("mocha");
      expect(setFontSize).toHaveBeenCalledWith("lg");
      expect(within(dialog).queryByRole("tablist")).toBeNull();
    } finally {
      cleanup();
      matchMedia.mockRestore();
    }
  });

  it("morphs settings from the toolbar without redundant headings", () => {
    render(
      <TmsHeader
        user={managerUser}
        onOpenApprovals={() => {}}
        onSignOut={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const dialog = screen.getByRole("dialog", { name: "设置" });
    expect(dialog.parentElement?.dataset.morphPopoverPortal).not.toBeNull();
    expect(within(dialog).queryByText("设置")).toBeNull();
    expect(within(dialog).queryByText("个人偏好")).toBeNull();
    expect(within(dialog).getByRole("tab", { name: "简" })).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: "日间" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("tab", { name: "夜间" }));
    fireEvent.click(within(dialog).getByRole("tab", { name: "大" }));
    expect(setFlavor).toHaveBeenCalledWith("mocha");
    expect(setFontSize).toHaveBeenCalledWith("lg");
  });
});
