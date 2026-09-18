import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

import { sanitizeEmailSubject } from "./email-content-security";
import { resolveSystemEmailInlineAssets } from "./system-email-assets";

export type SystemEmailMessage = {
  html: string;
  to: string;
  subject: string;
  text: string;
};

@Injectable()
export class SystemEmailService {
  private readonly logger = new Logger(SystemEmailService.name);

  async isAvailable() {
    const transport = this.createTransport();
    if (!transport) {
      return false;
    }
    try {
      await transport.verify();
      return true;
    } catch {
      this.logger.warn("SMTP availability check failed.");
      return false;
    } finally {
      transport.close();
    }
  }

  async send(message: SystemEmailMessage) {
    const transport = this.createTransport();
    if (!transport) {
      this.logger.warn(
        `SMTP is not configured; skipped email to ${message.to}: ${message.subject}`
      );
      return { skipped: true };
    }
    const from =
      process.env.PROJECT_WING_SMTP_FROM ??
      process.env.PROJECT_WING_SMTP_USER ??
      "ProjectWing <no-reply@projectwing.local>";
    try {
      const attachments = await resolveSystemEmailInlineAssets(message.html);
      await transport.sendMail({
        attachments,
        from,
        html: message.html,
        to: message.to,
        subject: sanitizeEmailSubject(message.subject),
        text: message.text,
      });
      return { skipped: false };
    } finally {
      transport.close();
    }
  }

  private createTransport() {
    const host = process.env.PROJECT_WING_SMTP_HOST;
    if (!host) {
      return null;
    }
    const port = Number(process.env.PROJECT_WING_SMTP_PORT ?? 587);
    const user = process.env.PROJECT_WING_SMTP_USER;
    const pass = process.env.PROJECT_WING_SMTP_PASS;
    const timeout = resolvePositiveNumber(
      process.env.PROJECT_WING_SMTP_TIMEOUT_MS,
      5000
    );
    return nodemailer.createTransport({
      host,
      port,
      secure: process.env.PROJECT_WING_SMTP_SECURE === "true" || port === 465,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout * 2,
    });
  }
}

function resolvePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
