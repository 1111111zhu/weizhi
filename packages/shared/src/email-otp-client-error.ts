import { BetterAuthClientError } from "./auth-client-error.js";

export type EmailOtpClientErrorCode =
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "OTP_RATE_LIMITED"
  | "OTP_TOO_MANY_ATTEMPTS"
  | "OTP_UNAVAILABLE";

const EMAIL_OTP_ERROR_MESSAGES: Record<EmailOtpClientErrorCode, string> = {
  OTP_EXPIRED: "Verification code has expired.",
  OTP_INVALID: "Verification code is invalid.",
  OTP_RATE_LIMITED: "Too many verification code requests.",
  OTP_TOO_MANY_ATTEMPTS: "Too many verification attempts.",
  OTP_UNAVAILABLE: "Email verification code service is unavailable.",
};

export class EmailOtpClientError extends BetterAuthClientError {
  constructor(
    public readonly code: EmailOtpClientErrorCode,
    status?: number
  ) {
    super(EMAIL_OTP_ERROR_MESSAGES[code], status);
    this.name = "EmailOtpClientError";
  }
}
