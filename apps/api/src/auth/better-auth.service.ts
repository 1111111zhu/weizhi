import type { IncomingHttpHeaders } from "node:http";

import { Injectable } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";

import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuthEmailOtpService } from "./auth-email-otp.service";
import { createProjectWingAuth } from "./better-auth";
import { resolveProjectWingAuthRuntimeConfig } from "./better-auth-runtime";
import type { BetterAuthSessionReader } from "./better-auth-session-reader";

@Injectable()
export class BetterAuthService implements BetterAuthSessionReader {
  readonly auth;

  constructor(
    prisma: PrismaService,
    auditLogs: AuditLogsService,
    emailOtp: AuthEmailOtpService
  ) {
    this.auth = createProjectWingAuth(
      prisma,
      resolveProjectWingAuthRuntimeConfig(process.env),
      async (session) => {
        await auditLogs.log({
          actorId: session.userId,
          action: "LOGIN_SUCCESS",
          targetType: "USER",
          targetId: session.userId,
          description: "登录系统",
          source: {
            ipAddress: session.ipAddress ?? undefined,
            userAgent: session.userAgent ?? undefined,
          },
        });
      },
      async ({ email, otp, type }) => {
        await Promise.resolve();
        emailOtp.queueCode({ email, otp, type });
      },
      () => emailOtp.canAcceptRequests(),
      async (user) => {
        await auditLogs.log({
          actorId: user.id,
          action: "PASSWORD_RESET",
          targetType: "USER",
          targetId: user.id,
          description: "用户通过邮箱验证码重置密码",
        });
      }
    );
  }

  async getSession(headers: IncomingHttpHeaders) {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });
    return session ? { user: { id: session.user.id } } : null;
  }
}
