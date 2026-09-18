import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiNotFoundException,
} from "../common/api-error";
import {
  decryptCredential as decryptStoredCredential,
  encryptCredential as encryptStoredCredential,
} from "../common/credential-cipher";
import type { EncryptedCredential } from "../common/credential-cipher";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeEmailSubject } from "./email-content-security";
import { resolveSystemEmailInlineAssets } from "./system-email-assets";

const SMTP_HOST = "smtp.exmail.qq.com";
const SMTP_PORT = 465;
const SMTP_SECURE = true;
export type UserMailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  senderName: string;
  attachment: {
    fileName: string;
    content: Buffer;
    contentType: string;
  };
};

@Injectable()
export class UserMailConnectionService {
  private readonly logger = new Logger(UserMailConnectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async getStatus(user: RequestUser) {
    const connection = await this.prisma.userMailConnection.findUnique({
      where: { userId: user.id },
      select: {
        provider: true,
        emailAddress: true,
        status: true,
        verifiedAt: true,
        lastTestedAt: true,
        lastError: true,
        updatedAt: true,
      },
    });
    return {
      emailAddress: user.email,
      connected: Boolean(connection),
      provider: connection?.provider ?? "WECOM_EXMAIL",
      status: connection?.status ?? null,
      verifiedAt: connection?.verifiedAt ?? null,
      lastTestedAt: connection?.lastTestedAt ?? null,
      lastError: connection?.lastError ?? null,
      updatedAt: connection?.updatedAt ?? null,
    };
  }

  async connect(
    user: RequestUser,
    clientPassword: string,
    source: AuditLogSource
  ) {
    await this.verifyCredentials(user.email, clientPassword);
    const credential = encryptCredential(clientPassword);
    const now = new Date();
    const connection = await this.prisma.userMailConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        emailAddress: user.email,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
        smtpSecure: SMTP_SECURE,
        ...credential,
        status: "CONNECTED",
        verifiedAt: now,
        lastTestedAt: now,
        lastError: null,
      },
      update: {
        emailAddress: user.email,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
        smtpSecure: SMTP_SECURE,
        ...credential,
        status: "CONNECTED",
        verifiedAt: now,
        lastTestedAt: now,
        lastError: null,
      },
      select: { id: true },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "USER_MAIL_CONNECTION_CONNECTED",
      targetType: "USER_MAIL_CONNECTION",
      targetId: connection.id,
      description: `Connected enterprise mailbox ${user.email}`,
      source,
    });
    return this.getStatus(user);
  }

  async test(user: RequestUser, source: AuditLogSource) {
    const connection = await this.getConnection(user.id);
    const clientPassword = decryptCredential(connection);
    const testedAt = new Date();
    try {
      await this.verifyCredentials(connection.emailAddress, clientPassword);
      await this.prisma.userMailConnection.update({
        where: { userId: user.id },
        data: {
          status: "CONNECTED",
          verifiedAt: testedAt,
          lastTestedAt: testedAt,
          lastError: null,
        },
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "USER_MAIL_CONNECTION_TESTED",
        targetType: "USER_MAIL_CONNECTION",
        targetId: connection.id,
        description: `Verified enterprise mailbox ${connection.emailAddress}`,
        source,
      });
      return this.getStatus(user);
    } catch (error) {
      await this.prisma.userMailConnection.update({
        where: { userId: user.id },
        data: {
          status: "ERROR",
          lastTestedAt: testedAt,
          lastError: "Mailbox authentication failed",
        },
      });
      throw error;
    }
  }

  async disconnect(user: RequestUser, source: AuditLogSource) {
    const connection = await this.prisma.userMailConnection.findUnique({
      where: { userId: user.id },
      select: { id: true, emailAddress: true },
    });
    if (!connection) {
      return this.getStatus(user);
    }
    await this.prisma.userMailConnection.delete({ where: { userId: user.id } });
    await this.auditLogs.log({
      actorId: user.id,
      action: "USER_MAIL_CONNECTION_DISCONNECTED",
      targetType: "USER_MAIL_CONNECTION",
      targetId: connection.id,
      description: `Disconnected enterprise mailbox ${connection.emailAddress}`,
      source,
    });
    return this.getStatus(user);
  }

  async send(userId: string, message: UserMailMessage) {
    const connection = await this.getConnection(userId);
    const clientPassword = decryptCredential(connection);
    const transport = this.createTransport(
      connection.emailAddress,
      clientPassword
    );
    try {
      const inlineAssets = await resolveSystemEmailInlineAssets(message.html);
      const result = await transport.sendMail({
        from: { name: message.senderName, address: connection.emailAddress },
        replyTo: connection.emailAddress,
        to: message.to,
        subject: sanitizeEmailSubject(message.subject),
        text: message.text,
        html: message.html,
        attachments: [
          {
            filename: message.attachment.fileName,
            content: message.attachment.content,
            contentType: message.attachment.contentType,
          },
          ...inlineAssets,
        ],
      });
      return {
        providerName: "WECOM_EXMAIL_SMTP",
        providerReference: result.messageId || null,
        senderEmail: connection.emailAddress,
      };
    } catch (error) {
      this.logger.warn(
        `Enterprise mailbox send failed for user ${userId}: ${safeErrorMessage(error)}`
      );
      throw new ApiBadRequestException(
        "MAIL_CONNECTION_FAILED",
        "企业邮箱发送失败，请检查邮箱连接和收件地址后重试"
      );
    } finally {
      transport.close();
    }
  }

  private async getConnection(userId: string) {
    const connection = await this.prisma.userMailConnection.findUnique({
      where: { userId },
    });
    if (!connection) {
      throw new ApiNotFoundException(
        "MAIL_CONNECTION_NOT_FOUND",
        "请先连接企业邮箱"
      );
    }
    if (connection.status === "ERROR") {
      throw new ApiBadRequestException(
        "MAIL_CONNECTION_FAILED",
        "企业邮箱连接异常，请重新验证或连接邮箱"
      );
    }
    return connection;
  }

  private async verifyCredentials(email: string, clientPassword: string) {
    const transport = this.createTransport(email, clientPassword);
    try {
      await transport.verify();
    } catch (error) {
      this.logger.warn(
        `Enterprise mailbox verification failed for ${email}: ${safeErrorMessage(error)}`
      );
      throw new ApiBadRequestException(
        "MAIL_CONNECTION_FAILED",
        "企业邮箱验证失败，请检查客户端专用密码"
      );
    } finally {
      transport.close();
    }
  }

  private createTransport(email: string, clientPassword: string) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: email, pass: clientPassword },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
}

export function encryptCredential(value: string): EncryptedCredential {
  return encryptStoredCredential(value);
}

export function decryptCredential(credential: EncryptedCredential) {
  try {
    return decryptStoredCredential(credential);
  } catch {
    throw new ApiBadRequestException(
      "MAIL_CREDENTIAL_KEY_INVALID",
      "企业邮箱凭据无法解密，请联系系统管理员"
    );
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown SMTP error";
}
