import { Injectable, Logger } from "@nestjs/common";

import { renderSystemEmail } from "../mail/system-email-template";
import { SystemEmailService } from "../mail/system-email.service";

export type AuthEmailOtpPurpose = "sign-in" | "forget-password";

@Injectable()
export class AuthEmailOtpService {
  private readonly logger = new Logger(AuthEmailOtpService.name);

  constructor(private readonly systemEmail: SystemEmailService) {}

  canAcceptRequests() {
    return this.systemEmail.isAvailable();
  }

  queueSignInCode(input: { email: string; otp: string }) {
    this.queueCode({ ...input, type: "sign-in" });
  }

  queueCode(input: { email: string; otp: string; type: AuthEmailOtpPurpose }) {
    void this.sendCode(input).catch((error: unknown) => {
      this.logger.error(
        "Failed to deliver an authentication verification code.",
        error instanceof Error ? error.stack : undefined
      );
    });
  }

  async sendSignInCode(input: { email: string; otp: string }) {
    await Promise.resolve();
    return this.sendCode({ ...input, type: "sign-in" });
  }

  async sendCode(input: {
    email: string;
    otp: string;
    type: AuthEmailOtpPurpose;
  }) {
    const isPasswordReset = input.type === "forget-password";
    const title = isPasswordReset
      ? "密码重置验证码 / Password reset code"
      : "邮箱验证码 / Email verification code";
    const rendered = renderSystemEmail({
      action: {
        label: isPasswordReset
          ? "返回登录 / Return to sign in"
          : "前往登录 / Continue sign in",
        url: resolveLoginUrl(),
      },
      body: isPasswordReset
        ? "您好，您正在重置 Project Wing 密码，请使用以下验证码完成操作。\n\nYou are resetting your Project Wing password. Use the verification code below to continue."
        : "您好，您正在登录 Project Wing，请使用以下验证码完成身份验证。\n\nYou are signing in to Project Wing. Use the verification code below to continue. Enter it only on the secure sign-in page.",
      brandName: "Project Wing",
      eyebrow: isPasswordReset
        ? "账户安全 / Account security"
        : "安全验证 / Secure verification",
      locale: "zh-CN",
      notice:
        "验证码 5 分钟内有效，请勿将验证码透露给他人。若非本人操作，请忽略此邮件。\nThe code expires in 5 minutes. Never share it with anyone. If you did not request it, ignore this email.",
      preheader: `${title}：${input.otp}`,
      productName: "Project Wing",
      title,
      tone: "security",
      verificationCode: input.otp,
    });
    const result = await this.systemEmail.send({
      html: rendered.html,
      to: input.email,
      subject: `[Project Wing] ${title}`,
      text: rendered.text,
    });

    if (result.skipped) {
      throw new Error("Email verification code service is unavailable.");
    }
  }
}

function resolveLoginUrl() {
  return new URL(
    "/zh-CN/login",
    process.env.FRONTEND_URL ?? "http://localhost:3001"
  ).toString();
}
