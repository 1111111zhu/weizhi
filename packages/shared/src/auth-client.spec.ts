import { describe, expect, it, vi } from "vitest";

import type { EmailOtpClientError } from "./index";
import {
  requestEmailPasswordResetOtp,
  requestEmailSignInOtp,
  resetPasswordWithEmailOtp,
  signInWithBetterAuth,
  signInWithEmailOtp,
  signOutWithBetterAuth,
  verifyEmailPasswordResetOtp,
} from "./index";

describe("better Auth browser client", () => {
  it("creates an HttpOnly cookie session without exposing an access token", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      signInWithBetterAuth(
        {
          baseURL: "https://auth.superfx.cn/",
          email: "staff@example.com",
          password: "Password123!",
          rememberMe: true,
        },
        fetcher as never
      )
    ).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.superfx.cn/auth/sign-in/email",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "staff@example.com",
          password: "Password123!",
          rememberMe: true,
        }),
      })
    );
  });

  it("uses the central session endpoint for sign-out", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await signOutWithBetterAuth("https://auth.superfx.cn", fetcher as never);

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.superfx.cn/auth/sign-out",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  it("requests a sign-in OTP without exposing a code in the response", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await requestEmailSignInOtp(
      { baseURL: "https://auth.superfx.cn/", email: "staff@example.com" },
      fetcher as never
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.superfx.cn/auth/email-otp/send-verification-otp",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "staff@example.com",
          type: "sign-in",
        }),
      })
    );
  });

  it("creates a cookie session with an email OTP", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await signInWithEmailOtp(
      {
        baseURL: "https://auth.superfx.cn",
        email: "staff@example.com",
        otp: "123456",
      },
      fetcher as never
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.superfx.cn/auth/sign-in/email-otp",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "staff@example.com", otp: "123456" }),
      })
    );
  });

  it("maps OTP delivery and verification failures to stable client codes", async () => {
    const unavailableFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ message: "SMTP connection failed" }),
    });
    const expiredFetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: "OTP expired" }),
    });

    await expect(
      requestEmailSignInOtp(
        { baseURL: "https://auth.superfx.cn", email: "staff@example.com" },
        unavailableFetcher as never
      )
    ).rejects.toMatchObject<Partial<EmailOtpClientError>>({
      code: "OTP_UNAVAILABLE",
      status: 503,
    });
    await expect(
      signInWithEmailOtp(
        {
          baseURL: "https://auth.superfx.cn",
          email: "staff@example.com",
          otp: "123456",
        },
        expiredFetcher as never
      )
    ).rejects.toMatchObject<Partial<EmailOtpClientError>>({
      code: "OTP_EXPIRED",
      status: 400,
    });
  });

  it("surfaces the server message when sign-in fails", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: "Invalid credentials" }),
    });

    await expect(
      signInWithBetterAuth(
        {
          baseURL: "https://auth.superfx.cn",
          email: "staff@example.com",
          password: "wrong-password",
        },
        fetcher as never
      )
    ).rejects.toThrow("Invalid credentials");
  });

  it("sends and verifies a sign-in email code", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await requestEmailSignInOtp(
      {
        baseURL: "https://auth.superfx.cn",
        email: "staff@example.com",
      },
      fetcher as never
    );
    await signInWithEmailOtp(
      {
        baseURL: "https://auth.superfx.cn",
        email: "staff@example.com",
        otp: "123456",
      },
      fetcher as never
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://auth.superfx.cn/auth/email-otp/send-verification-otp",
      expect.objectContaining({
        body: JSON.stringify({
          email: "staff@example.com",
          type: "sign-in",
        }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://auth.superfx.cn/auth/sign-in/email-otp",
      expect.objectContaining({
        body: JSON.stringify({
          email: "staff@example.com",
          otp: "123456",
        }),
      })
    );
  });

  it("requests and completes a password reset with an email code", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await requestEmailPasswordResetOtp(
      { baseURL: "https://auth.superfx.cn", email: "staff@example.com" },
      fetcher as never
    );
    await verifyEmailPasswordResetOtp(
      {
        baseURL: "https://auth.superfx.cn",
        email: "staff@example.com",
        otp: "654321",
      },
      fetcher as never
    );
    await resetPasswordWithEmailOtp(
      {
        baseURL: "https://auth.superfx.cn",
        email: "staff@example.com",
        otp: "654321",
        password: "NewPassword123!",
      },
      fetcher as never
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://auth.superfx.cn/auth/email-otp/request-password-reset",
      expect.objectContaining({
        body: JSON.stringify({ email: "staff@example.com" }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://auth.superfx.cn/auth/email-otp/check-verification-otp",
      expect.objectContaining({
        body: JSON.stringify({
          email: "staff@example.com",
          otp: "654321",
          type: "forget-password",
        }),
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://auth.superfx.cn/auth/email-otp/reset-password",
      expect.objectContaining({
        body: JSON.stringify({
          email: "staff@example.com",
          otp: "654321",
          password: "NewPassword123!",
        }),
      })
    );
  });
});
