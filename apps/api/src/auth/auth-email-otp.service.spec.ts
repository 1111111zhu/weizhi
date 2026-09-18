import { Logger } from "@nestjs/common";

import { AuthEmailOtpService } from "./auth-email-otp.service";

describe(AuthEmailOtpService, () => {
  it("sends a bilingual sign-in message without logging the code", async () => {
    const send = vi.fn().mockResolvedValue({ skipped: false });
    const service = new AuthEmailOtpService({ send } as never);

    await service.sendSignInCode({
      email: "staff@example.com",
      otp: "123456",
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringMatching(/cid:project-wing-brand[\s\S]*123456/),
        to: "staff@example.com",
        subject: expect.stringContaining("邮箱验证码"),
        text: expect.stringMatching(/123456[\s\S]*5 分钟[\s\S]*5 minutes/),
      })
    );
  });

  it("fails closed when SMTP is not configured", async () => {
    const service = new AuthEmailOtpService({
      send: vi.fn().mockResolvedValue({ skipped: true }),
    } as never);

    await expect(
      service.sendSignInCode({
        email: "staff@example.com",
        otp: "123456",
      })
    ).rejects.toThrow("Email verification code service is unavailable");
  });

  it("sends a distinct bilingual password-reset message", async () => {
    const send = vi.fn().mockResolvedValue({ skipped: false });
    const service = new AuthEmailOtpService({ send } as never);

    await service.sendCode({
      email: "staff@example.com",
      otp: "654321",
      type: "forget-password",
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "staff@example.com",
        subject: expect.stringContaining("密码重置"),
      })
    );
    const message = send.mock.calls[0]?.[0];
    expect(message.text).toContain("654321");
    expect(message.text).toMatch(/password reset/i);
    expect(message.text).toContain("密码重置");
  });

  it("uses an account-independent SMTP availability check", async () => {
    const isAvailable = vi.fn().mockResolvedValue(false);
    const service = new AuthEmailOtpService({ isAvailable } as never);

    await expect(service.canAcceptRequests()).resolves.toBeFalsy();
    expect(isAvailable).toHaveBeenCalledOnce();
  });

  it("does not let a recipient-specific failure alter global availability", async () => {
    const logError = vi.spyOn(Logger.prototype, "error").mockReturnValue();
    const isAvailable = vi.fn().mockResolvedValue(true);
    const service = new AuthEmailOtpService({
      isAvailable,
      send: vi.fn().mockRejectedValue(new Error("SMTP rejected message")),
    } as never);

    await expect(service.canAcceptRequests()).resolves.toBeTruthy();
    service.queueSignInCode({ email: "staff@example.com", otp: "123456" });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    await expect(service.canAcceptRequests()).resolves.toBeTruthy();
    logError.mockRestore();
  });
});
