import { Injectable, Logger } from "@nestjs/common";

import type { AuditLogSource } from "../audit-logs/audit-log-source";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiNotFoundException,
} from "../common/api-error";
import {
  decryptCredential,
  encryptCredential,
} from "../common/credential-cipher";
import { PrismaService } from "../prisma/prisma.service";

const PROVIDER = "TRACKING_17TRACK" as const;
const QUOTA_ENDPOINT = "https://api.17track.net/track/v2.4/getquota";

type QuotaResponse = {
  code?: number;
  data?: {
    quota_total?: number;
    quota_used?: number;
    quota_remain?: number;
  };
};

@Injectable()
export class SystemConnectionsService {
  private readonly logger = new Logger(SystemConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async getTracking17TrackStatus() {
    const connection = await this.prisma.systemConnection.findUnique({
      where: { provider: PROVIDER },
      select: {
        id: true,
        provider: true,
        status: true,
        verifiedAt: true,
        lastTestedAt: true,
        lastError: true,
        quotaTotal: true,
        quotaUsed: true,
        quotaRemain: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      provider: PROVIDER,
      connected: Boolean(connection),
      status: connection?.status ?? null,
      verifiedAt: connection?.verifiedAt ?? null,
      lastTestedAt: connection?.lastTestedAt ?? null,
      lastError: connection?.lastError ?? null,
      quotaTotal: connection?.quotaTotal ?? null,
      quotaUsed: connection?.quotaUsed ?? null,
      quotaRemain: connection?.quotaRemain ?? null,
      updatedAt: connection?.updatedAt ?? null,
      updatedBy: connection?.updatedBy ?? null,
    };
  }

  async connect(user: RequestUser, apiKey: string, source: AuditLogSource) {
    const quota = await this.fetchQuota(apiKey);
    const encrypted = encryptCredential(apiKey);
    const testedAt = new Date();
    const connection = await this.prisma.systemConnection.upsert({
      where: { provider: PROVIDER },
      create: {
        provider: PROVIDER,
        ...encrypted,
        status: "CONNECTED",
        verifiedAt: testedAt,
        lastTestedAt: testedAt,
        lastError: null,
        ...quota,
        updatedById: user.id,
      },
      update: {
        ...encrypted,
        status: "CONNECTED",
        verifiedAt: testedAt,
        lastTestedAt: testedAt,
        lastError: null,
        ...quota,
        updatedById: user.id,
      },
      select: { id: true },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "SYSTEM_CONNECTION_CONNECTED",
      targetType: "SYSTEM_CONNECTION",
      targetId: connection.id,
      description: "Connected 17TRACK system integration",
      source,
    });
    return this.getTracking17TrackStatus();
  }

  async test(user: RequestUser, source: AuditLogSource) {
    const connection = await this.getTracking17TrackConnection();
    const apiKey = decryptCredential(connection);
    const testedAt = new Date();
    try {
      const quota = await this.fetchQuota(apiKey);
      await this.prisma.systemConnection.update({
        where: { provider: PROVIDER },
        data: {
          status: "CONNECTED",
          verifiedAt: testedAt,
          lastTestedAt: testedAt,
          lastError: null,
          ...quota,
          updatedById: user.id,
        },
      });
      await this.auditLogs.log({
        actorId: user.id,
        action: "SYSTEM_CONNECTION_TESTED",
        targetType: "SYSTEM_CONNECTION",
        targetId: connection.id,
        description: "Tested 17TRACK system integration",
        source,
      });
      return this.getTracking17TrackStatus();
    } catch (error) {
      await this.prisma.systemConnection.update({
        where: { provider: PROVIDER },
        data: {
          status: "ERROR",
          lastTestedAt: testedAt,
          lastError: "17TRACK API authentication failed",
          updatedById: user.id,
        },
      });
      throw error;
    }
  }

  async disconnect(user: RequestUser, source: AuditLogSource) {
    const connection = await this.prisma.systemConnection.findUnique({
      where: { provider: PROVIDER },
      select: { id: true },
    });
    if (!connection) {
      return this.getTracking17TrackStatus();
    }
    await this.prisma.systemConnection.delete({
      where: { provider: PROVIDER },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "SYSTEM_CONNECTION_DISCONNECTED",
      targetType: "SYSTEM_CONNECTION",
      targetId: connection.id,
      description: "Disconnected 17TRACK system integration",
      source,
    });
    return this.getTracking17TrackStatus();
  }

  private async getTracking17TrackConnection() {
    const connection = await this.prisma.systemConnection.findUnique({
      where: { provider: PROVIDER },
    });
    if (!connection) {
      throw new ApiNotFoundException(
        "SYSTEM_CONNECTION_NOT_FOUND",
        "17TRACK 尚未连接"
      );
    }
    return connection;
  }

  private async fetchQuota(apiKey: string) {
    try {
      const response = await fetch(QUOTA_ENDPOINT, {
        method: "POST",
        headers: {
          "17token": apiKey,
          "content-type": "application/json",
        },
        body: "[]",
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as QuotaResponse;
      if (!response.ok || payload.code !== 0 || !payload.data) {
        throw new Error(
          `17TRACK responded with code ${payload.code ?? response.status}`
        );
      }
      return {
        quotaTotal: numberOrNull(payload.data.quota_total),
        quotaUsed: numberOrNull(payload.data.quota_used),
        quotaRemain: numberOrNull(payload.data.quota_remain),
      };
    } catch (error) {
      this.logger.warn(
        `17TRACK connection test failed: ${safeErrorMessage(error)}`
      );
      throw new ApiBadRequestException(
        "SYSTEM_CONNECTION_FAILED",
        "17TRACK 连接失败，请检查 API Key"
      );
    }
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown 17TRACK error";
}
