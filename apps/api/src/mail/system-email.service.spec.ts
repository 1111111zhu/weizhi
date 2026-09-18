import { Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

import { SystemEmailService } from "./system-email.service";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

describe("systemEmailService availability", () => {
  const originalHost = process.env.PROJECT_WING_SMTP_HOST;
  const originalTimeout = process.env.PROJECT_WING_SMTP_TIMEOUT_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalHost === undefined) {
      delete process.env.PROJECT_WING_SMTP_HOST;
    } else {
      process.env.PROJECT_WING_SMTP_HOST = originalHost;
    }
    if (originalTimeout === undefined) {
      delete process.env.PROJECT_WING_SMTP_TIMEOUT_MS;
    } else {
      process.env.PROJECT_WING_SMTP_TIMEOUT_MS = originalTimeout;
    }
  });

  it("returns false without opening a transport when SMTP is unconfigured", async () => {
    delete process.env.PROJECT_WING_SMTP_HOST;

    await expect(new SystemEmailService().isAvailable()).resolves.toBeFalsy();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("verifies and closes the SMTP transport for every preflight", async () => {
    process.env.PROJECT_WING_SMTP_HOST = "smtp.example.com";
    delete process.env.PROJECT_WING_SMTP_TIMEOUT_MS;
    const verify = vi.fn().mockResolvedValue(true);
    const close = vi.fn();
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      verify,
      close,
    } as never);

    await expect(new SystemEmailService().isAvailable()).resolves.toBeTruthy();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10_000,
      })
    );
    expect(verify).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("normalizes SMTP verification failures without exposing details", async () => {
    process.env.PROJECT_WING_SMTP_HOST = "smtp.example.com";
    vi.spyOn(Logger.prototype, "warn").mockReturnValue();
    const close = vi.fn();
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      verify: vi.fn().mockRejectedValue(new Error("authentication failed")),
      close,
    } as never);

    await expect(new SystemEmailService().isAvailable()).resolves.toBeFalsy();
    expect(close).toHaveBeenCalledOnce();
  });

  it("sends HTML with only the CID assets referenced by the template", async () => {
    process.env.PROJECT_WING_SMTP_HOST = "smtp.example.com";
    const sendMail = vi.fn().mockResolvedValue({ messageId: "mail-1" });
    const close = vi.fn();
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      close,
      sendMail,
    } as never);

    await expect(
      new SystemEmailService().send({
        html: '<img src="cid:project-wing-brand"><img src="cid:project-wing-verification-footer">',
        subject: "Verification",
        text: "Verification code: 123456",
        to: "staff@example.com",
      })
    ).resolves.toStrictEqual({ skipped: false });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("cid:project-wing-brand"),
        attachments: [
          expect.objectContaining({
            cid: "project-wing-brand",
            content: expect.any(Buffer),
            contentDisposition: "inline",
          }),
          expect.objectContaining({
            cid: "project-wing-verification-footer",
            content: expect.any(Buffer),
            contentDisposition: "inline",
          }),
        ],
      })
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
