import { ProjectWingThemeProvider } from "@project-wing/ui";
// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../../api/client";
import { CmpI18nProvider } from "../../../i18n/client";
import { LoginClient } from "./page-client";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../../../api/client", () => ({
  api: {
    login: vi.fn(),
    impersonateDevelopmentAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn().mockResolvedValue([]),
    loginWithOtp: vi.fn(),
    requestLoginOtp: vi.fn(),
    requestPasswordResetOtp: vi.fn(),
    resetPasswordWithOtp: vi.fn(),
    restoreIntranetEntry: vi.fn().mockResolvedValue(null),
    updatePreferredLocale: vi.fn().mockResolvedValue({}),
    verifyPasswordResetOtp: vi.fn(),
  },
}));

describe(LoginClient, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.restoreIntranetEntry).mockResolvedValue(null);
  });

  afterEach(cleanup);

  function renderLogin() {
    return render(
      <CmpI18nProvider initialLocale="en-US">
        <ProjectWingThemeProvider>
          <LoginClient />
        </ProjectWingThemeProvider>
      </CmpI18nProvider>
    );
  }

  it("renders the complete shared Auth surface inside the tilt card", async () => {
    const { container } = renderLogin();
    await act(async () => {
      await Promise.resolve();
    });
    const tiltCard = container.querySelector(".pw-tilt-card");
    expect(tiltCard?.querySelector(".project-wing-top-bar-brand")).toBeTruthy();
    expect(
      tiltCard?.querySelector(".project-wing-top-bar-brand")?.textContent
    ).toBe("EngagementManagementPortal");
    expect(
      screen.queryByRole("heading", { name: "Sign in to CMP" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "WeCom" })).toBeTruthy();
    expect(tiltCard).toContainElement(
      screen.getByRole("button", { name: "Sign up" })
    );
    expect(container.querySelector(".pw-auth-hero-image img")).toHaveAttribute(
      "src",
      "/brand/emp-login-hong-kong.webp"
    );
    expect(
      screen.queryByRole("heading", { name: "Sign in to ReUI" })
    ).toBeNull();
  });

  it("shows selectable mock identities in the simulator", async () => {
    vi.mocked(api.listDevelopmentAccounts).mockResolvedValue([
      {
        email: "preview@projectwing.local",
        name: "Preview administrator",
        role: "SUPER_ADMIN",
      },
    ]);
    renderLogin();

    const simulator = await screen.findByRole("button", {
      name: "Development accounts",
    });
    fireEvent.click(simulator);

    await expect(
      screen.findByRole("button", { name: /Preview administrator/ })
    ).resolves.toBeInTheDocument();
  });

  it("keeps CMP role routing outside the shared UI", async () => {
    vi.mocked(api.login).mockResolvedValue({
      id: "admin-1",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
    });
    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "it@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(api.login).toHaveBeenCalledWith({
        email: "it@example.com",
        password: "Password123!",
        rememberMe: true,
      })
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/en-US/dashboard")
    );
    expect(api.updatePreferredLocale).toHaveBeenCalledWith("en-US");
  });
});
