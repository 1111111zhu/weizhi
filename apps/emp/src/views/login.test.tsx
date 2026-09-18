import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import { api } from "../api/client";
import { LoginPage } from "./login";

const replace = vi.fn();
const success = vi.hoisted(() => vi.fn());
const warning = vi.hoisted(() => vi.fn());
const pairDesktopAgent = vi.hoisted(() =>
  vi.fn<() => Promise<void>>().mockImplementation(async () => {})
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock("sonner", () => ({ toast: { success, warning } }));
vi.mock("../components/theme-provider", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("../api/client", () => ({
  api: {
    login: vi.fn(),
    impersonateDevelopmentAccount: vi.fn(),
    listDevelopmentAccounts: vi.fn(),
    loginWithOtp: vi.fn(),
    requestLoginOtp: vi.fn(),
    requestPasswordResetOtp: vi.fn(),
    resetPasswordWithOtp: vi.fn(),
    restoreIntranetEntry: vi.fn().mockResolvedValue(null),
    updatePreferredLocale: vi.fn().mockResolvedValue({}),
    verifyPasswordResetOtp: vi.fn(),
  },
}));
vi.mock("../api/desktop-agent", () => ({
  pairDesktopAgentWithBetterAuth: pairDesktopAgent,
}));
vi.mock("../i18n/client", () => ({
  useI18n: () => ({
    locale: "en-US",
    dictionary: {
      auth: {
        back: "Back",
        backToLogin: "Back to sign in",
        codeSent: "A code has been sent.",
        codeVerified: "Code verified.",
        confirmPassword: "Confirm new password",
        emailCode: "Email code",
        emailRequired: "Enter your email address.",
        emailOrUsername: "Email",
        emailPlaceholder: "",
        forgotPassword: "Forgot password?",
        hidePassword: "Hide password",
        invalidEmail: "Enter a valid email address.",
        login: "Sign in",
        needAccount: "Need an account?",
        newPassword: "New password",
        orContinueWith: "Or continue with",
        password: "Password",
        passwordPlaceholder: "Enter your password",
        passwordRequirements: "Use at least 8 characters.",
        resetPassword: "Reset password",
        resetPasswordDescription:
          "Verify your email, then choose a new password.",
        resetSuccess: "Password reset. Sign in with your new password.",
        resendCode: "Resend code",
        resendCountdown: "Resend ({seconds}s)",
        sendCode: "Send code",
        showPassword: "Show password",
        signInFailed: "Unable to sign in. Please try again.",
        signUp: "Sign up",
        signUpUnavailable: "Email OTP sign-up is not available yet",
        verifyCode: "Verify code",
        wecom: "WeCom",
        wecomUnavailable: "WeCom is not available yet",
      },
    },
    localizedPath: (pathname: string) => pathname,
  }),
}));

describe(LoginPage, () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    pairDesktopAgent.mockImplementation(async () => {});
    vi.mocked(api.restoreIntranetEntry).mockResolvedValue(null);
    vi.mocked(api.listDevelopmentAccounts).mockResolvedValue([
      {
        email: "admin@projectwing.local",
        name: "System Admin",
        role: "SUPER_ADMIN",
      },
    ]);
  });

  afterEach(cleanup);

  it("renders the complete shared Auth surface inside the tilt card", () => {
    const { container } = render(<LoginPage />);
    const tiltCard = container.querySelector(".pw-tilt-card");
    expect(tiltCard?.querySelector(".project-wing-top-bar-brand")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Sign in to EMP" })
    ).toBeNull();
    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "placeholder",
      ""
    );
    expect(screen.getByText("Or continue with")).toBeTruthy();
    expect(tiltCard).toContainElement(
      screen.getByRole("button", { name: "Sign up" })
    );
    expect(screen.queryByText("登录 EMP")).toBeNull();
    expect(screen.queryByText(/Demo account/)).toBeNull();
  });

  it("impersonates the selected development account", async () => {
    vi.mocked(api.impersonateDevelopmentAccount).mockResolvedValue({
      id: "user-admin",
      email: "admin@projectwing.local",
      name: "System Admin",
      globalRole: "SUPER_ADMIN",
    });
    render(<LoginPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Development accounts" })
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /System Admin.*SUPER_ADMIN.*admin@projectwing\.local/,
      })
    );

    expect(warning).toHaveBeenCalledWith("For developer mode only.");
    expect(api.login).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(api.impersonateDevelopmentAccount).toHaveBeenCalledWith(
        "admin@projectwing.local"
      )
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/en-US/engagement")
    );
    expect(pairDesktopAgent).toHaveBeenCalledOnce();
    expect(api.updatePreferredLocale).toHaveBeenCalledWith("en-US");
  });

  it("submits the EMP password adapter and redirects after authentication", async () => {
    vi.mocked(api.login).mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
    });
    pairDesktopAgent.mockRejectedValueOnce(
      new Error("Desktop Agent is unavailable")
    );
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(api.login).toHaveBeenCalledWith(
        "staff@example.com",
        "Password123!",
        true
      )
    );
    await waitFor(() =>
      expect(
        document.querySelector('.pw-auth-submit[data-state="success"]')
      ).toBeTruthy()
    );
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/en-US/engagement")
    );
    expect(pairDesktopAgent).toHaveBeenCalledOnce();
    expect(api.updatePreferredLocale).toHaveBeenCalledWith("en-US");
    expect(window.localStorage.getItem("project-wing-emp-login-email")).toBe(
      "staff@example.com"
    );
  });

  it("shows custom validation instead of the browser validation bubble", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(document.querySelector("form")).toHaveAttribute("novalidate");
    expect(screen.getByText("Enter your email address.")).toBeTruthy();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("switches to email code mode and focuses an empty email", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Email code" }));

    expect(screen.getByLabelText("Email code")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.requestLoginOtp).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Email"))
    );
  });

  it("toggles password visibility without changing the entered password", () => {
    render(<LoginPage />);

    const password = screen.getByLabelText("Password");
    fireEvent.change(password, { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("Password123!");
  });

  it("automatically signs in when the email code is complete", async () => {
    vi.mocked(api.loginWithOtp).mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
    });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email code" }));

    expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
    expect(api.requestLoginOtp).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email code")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() =>
      expect(api.requestLoginOtp).toHaveBeenCalledWith("staff@example.com")
    );
    expect(screen.getByRole("button", { name: "Resend (60s)" })).toBeDisabled();
    expect(screen.queryByLabelText("Password")).toBeNull();
    const otp = screen.getByLabelText("Email code");
    expect(otp).toBeEnabled();
    await waitFor(() => expect(document.activeElement).toBe(otp));
    for (const key of "123456") {
      fireEvent.keyDown(otp, { key });
    }

    expect(screen.getAllByText("6")).toHaveLength(1);
    await waitFor(() =>
      expect(api.loginWithOtp).toHaveBeenCalledWith(
        "staff@example.com",
        "123456"
      )
    );
    await waitFor(() =>
      expect(
        document.querySelector('.pw-auth-submit[data-state="success"]')
      ).toBeTruthy()
    );
  });

  it("returns to the password field from email code mode", () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email code" }));

    fireEvent.click(screen.getByRole("button", { name: "Password" }));

    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email code" })).toBeTruthy();
  });

  it("warns that WeCom sign-in is not available", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "WeCom" }));

    expect(warning).toHaveBeenCalledWith("WeCom is not available yet");
  });

  it("warns that email OTP sign-up is not available", () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(warning).toHaveBeenCalledWith(
      "Email OTP sign-up is not available yet"
    );
  });

  it("sends, verifies, and uses an email OTP to reset a password", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(
      screen.queryByRole("heading", { name: "Reset password" })
    ).toBeNull();
    expect(screen.getByText("Or continue with")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "WeCom" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Verify code" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() =>
      expect(api.requestPasswordResetOtp).toHaveBeenCalledWith(
        "staff@example.com"
      )
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        "If this email is registered, a code has been sent. Check your inbox and spam folder."
      )
    );
    expect(screen.getByRole("button", { name: "Resend (60s)" })).toBeDisabled();

    const otp = screen.getByLabelText("Email code");
    for (const key of "123456") {
      fireEvent.keyDown(otp, { key });
    }

    await waitFor(() =>
      expect(api.verifyPasswordResetOtp).toHaveBeenCalledWith(
        "staff@example.com",
        "123456"
      )
    );
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(api.resetPasswordWithOtp).toHaveBeenCalledWith(
        "staff@example.com",
        "123456",
        "NewPassword123!"
      )
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        "Password reset. Sign in with your new password."
      )
    );
  });

  it("maps an API OTP error to the OTP input", async () => {
    vi.mocked(api.verifyPasswordResetOtp).mockRejectedValueOnce(
      Object.assign(new Error("Invalid verification code"), {
        code: "OTP_INVALID",
      })
    );
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "staff@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() =>
      expect(api.requestPasswordResetOtp).toHaveBeenCalledWith(
        "staff@example.com"
      )
    );
    const otp = screen.getByLabelText("Email code");
    for (const key of "000000") {
      fireEvent.keyDown(otp, { key });
    }

    await waitFor(() => expect(otp).toHaveAttribute("aria-invalid", "true"));
    expect(
      screen.getByText("Unable to sign in. Please try again.")
    ).toBeTruthy();
  });

  it("shows an email-specific error before requesting a reset code", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter your email address."
      )
    );
    expect(api.requestPasswordResetOtp).not.toHaveBeenCalled();
  });
});
