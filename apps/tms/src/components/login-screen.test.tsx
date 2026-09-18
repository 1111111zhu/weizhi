import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import { LoginScreen } from "./login-screen";

const login = vi.hoisted(() => vi.fn());
const me = vi.hoisted(() => vi.fn());

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ flavor: "latte", setFlavor: vi.fn() }),
}));
vi.mock("@/lib/api", () => ({
  login,
  impersonateDevelopmentAccount: vi.fn(),
  listDevelopmentAccounts: vi.fn().mockResolvedValue([]),
  loginWithOtp: vi.fn(),
  me,
  requestLoginOtp: vi.fn(),
  requestPasswordResetOtp: vi.fn(),
  resetPasswordWithOtp: vi.fn(),
  verifyPasswordResetOtp: vi.fn(),
}));

describe(LoginScreen, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    me.mockResolvedValue(null);
  });

  afterEach(cleanup);

  it("renders the complete shared Auth surface inside the tilt card", () => {
    const { container } = render(<LoginScreen onAuthenticated={() => {}} />);
    const tiltCard = container.querySelector(".pw-tilt-card");
    expect(tiltCard?.querySelector(".project-wing-top-bar-brand")).toBeTruthy();
    expect(
      tiltCard?.querySelector(".project-wing-top-bar-brand")?.textContent
    ).toBe("TimesheetManagementSystem");
    expect(
      screen.queryByRole("heading", { name: "Sign in to TMS" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Email code" })).toBeTruthy();
    expect(
      tiltCard?.contains(screen.getByRole("button", { name: "Sign up" }))
    ).toBeTruthy();
    expect(
      container.querySelector(".pw-auth-hero-image img")?.getAttribute("src")
    ).toBe("/brand/emp-login-hong-kong.webp");
    expect(screen.queryByText("登录 TMS")).toBeNull();
    expect(screen.queryByText("演示账号")).toBeNull();
  });

  it("keeps TMS authentication and redirect handling outside the shared UI", async () => {
    const user = {
      id: "partner-1",
      email: "partner@projectwing.local",
      name: "Partner",
      globalRole: "PARTNER",
    };
    const onAuthenticated = vi.fn();
    login.mockResolvedValue(user);
    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "partner@projectwing.local" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Partner123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith(
        "partner@projectwing.local",
        "Partner123!",
        true
      )
    );
    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith(user, { autoLogin: true })
    );
  });
});
