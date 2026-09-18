import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { AuthGate } from "./route-guards";

vi.mock("../api/mode", () => ({
  getApiMode: () => "mock",
  isMockApiMode: () => true,
}));

const mockRouter = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const mockLocation = vi.hoisted(() => ({
  pathname: "/workspaces",
  search: "",
}));
const mockSessionValidation = vi.spyOn(api, "me");

vi.mock("next/navigation", () => ({
  usePathname: () => mockLocation.pathname,
  useRouter: () => mockRouter,
  useSearchParams: () => ({ toString: () => mockLocation.search }),
}));

vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "zh-CN",
    dictionary: { common: {} },
    localizedPath: (pathname: string) => pathname,
  }),
}));

describe("lint test setup", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    mockLocation.pathname = "/workspaces";
    mockLocation.search = "";
    window.history.replaceState(null, "", "/workspaces");
  });

  describe(AuthGate, () => {
    it("redirects authenticated users to the system declaration page first", async () => {
      mockLocation.pathname = "/workspaces";
      mockLocation.search = "tab=recent";
      mockSessionValidation.mockResolvedValue({
        id: "user-1",
        email: "staff@projectwing.local",
        name: "King Su",
        globalRole: "STAFF",
        declarationAccepted: false,
      });

      renderGate();

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          "/zh-CN/declaration?redirect=%2Fworkspaces%3Ftab%3Drecent"
        );
      });
      expect(screen.queryByText("protected content")).toBeNull();
    });

    it("uses a top progress bar while checking the current account", () => {
      mockSessionValidation.mockReturnValue(new Promise(() => {}));

      renderGate();

      expect(screen.getByTestId("project-wing-loading-progress")).toBeTruthy();
      expect(screen.queryByText("正在加载账号信息...")).toBeNull();
      expect(screen.queryByText("protected content")).toBeNull();
    });

    it("renders protected content after the system declaration is accepted", async () => {
      mockSessionValidation.mockResolvedValue({
        id: "user-1",
        email: "partner@projectwing.local",
        name: "Jony Ma",
        globalRole: "PARTNER",
        declarationAccepted: true,
      });

      renderGate();

      await expect(
        screen.findByText("protected content")
      ).resolves.toBeTruthy();
    });

    it("renders protected content after refresh with a shared cookie session", async () => {
      mockSessionValidation.mockResolvedValue({
        id: "user-1",
        email: "partner@projectwing.local",
        name: "Jony Ma",
        globalRole: "PARTNER",
        declarationAccepted: true,
      });

      renderGate();

      await expect(
        screen.findByText("protected content")
      ).resolves.toBeTruthy();
      expect(mockSessionValidation).toHaveBeenCalledOnce();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("redirects a portal navigation when no shared session is available", async () => {
      mockLocation.pathname = "/workspaces";
      mockLocation.search = "from=portal";
      window.history.replaceState(null, "", "/workspaces?from=portal");
      mockSessionValidation.mockResolvedValue(null);

      renderGate();

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          "/zh-CN/login?next=%2Fworkspaces"
        );
      });
      expect(mockSessionValidation).toHaveBeenCalledOnce();
    });
  });

  function renderGate() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          AuthGate,
          null,
          createElement("div", null, "protected content")
        )
      )
    );
  }
});
