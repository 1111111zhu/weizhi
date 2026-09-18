import { Injectable } from "@nestjs/common";
import type { CmpAmlConfigurationStatus } from "@project-wing/shared";

import type { AuditLogSource } from "../../audit-logs/audit-log-source";
import { AuditLogsService } from "../../audit-logs/audit-logs.service";
import type { RequestUser } from "../../auth/request-user";
import { ApiForbiddenException } from "../../common/api-error";
import {
  decryptCredential,
  encryptCredential,
} from "../../common/credential-cipher";
import { PrismaService } from "../../prisma/prisma.service";

const CONFIGURATION_ID = "default";

export type ResolvedCmpAmlConfiguration = CmpAmlConfigurationStatus & {
  apiKey: string | null;
};

@Injectable()
export class CmpAmlConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async getStatus(): Promise<ResolvedCmpAmlConfiguration> {
    const configuration = await this.prisma.cmpAmlConfiguration.findUnique({
      where: { id: CONFIGURATION_ID },
      select: {
        id: true,
        enabled: true,
        credentialCiphertext: true,
        credentialIv: true,
        credentialAuthTag: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    });
    if (configuration) {
      const configured = Boolean(
        configuration.enabled &&
        configuration.credentialCiphertext &&
        configuration.credentialIv &&
        configuration.credentialAuthTag
      );
      return {
        enabled: configuration.enabled,
        configured,
        source: configuration.enabled ? "DATABASE" : null,
        updatedAt: configuration.updatedAt.toISOString(),
        updatedBy: configuration.updatedBy,
        apiKey: configured
          ? decryptCredential({
              credentialCiphertext: configuration.credentialCiphertext!,
              credentialIv: configuration.credentialIv!,
              credentialAuthTag: configuration.credentialAuthTag!,
            })
          : null,
      };
    }

    const enabled = process.env.PROJECT_WING_DIDIT_AML_ENABLED === "true";
    const apiKey = process.env.PROJECT_WING_DIDIT_API_KEY?.trim() ?? "";
    return {
      enabled,
      configured: enabled && Boolean(apiKey),
      source: enabled && apiKey ? "ENVIRONMENT" : null,
      updatedAt: null,
      updatedBy: null,
      apiKey: enabled && apiKey ? apiKey : null,
    };
  }

  async getPublicStatus() {
    const configuration = await this.prisma.cmpAmlConfiguration.findUnique({
      where: { id: CONFIGURATION_ID },
      select: {
        enabled: true,
        credentialCiphertext: true,
        credentialIv: true,
        credentialAuthTag: true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    });
    if (configuration) {
      return {
        enabled: configuration.enabled,
        configured: Boolean(
          configuration.enabled &&
          configuration.credentialCiphertext &&
          configuration.credentialIv &&
          configuration.credentialAuthTag
        ),
        source: configuration.enabled ? ("DATABASE" as const) : null,
        updatedAt: configuration.updatedAt.toISOString(),
        updatedBy: configuration.updatedBy,
      };
    }

    const enabled = process.env.PROJECT_WING_DIDIT_AML_ENABLED === "true";
    const hasEnvironmentKey = Boolean(
      process.env.PROJECT_WING_DIDIT_API_KEY?.trim()
    );
    return {
      enabled,
      configured: enabled && hasEnvironmentKey,
      source: enabled && hasEnvironmentKey ? ("ENVIRONMENT" as const) : null,
      updatedAt: null,
      updatedBy: null,
    };
  }

  async resolveApiKey() {
    const status = await this.getStatus();
    return status.configured ? status.apiKey : null;
  }

  async save(user: RequestUser, apiKey: string, source?: AuditLogSource) {
    assertSuperAdmin(user);
    const encrypted = encryptCredential(apiKey.trim());
    const configuration = await this.prisma.cmpAmlConfiguration.upsert({
      where: { id: CONFIGURATION_ID },
      create: {
        id: CONFIGURATION_ID,
        enabled: true,
        ...encrypted,
        updatedById: user.id,
      },
      update: {
        enabled: true,
        ...encrypted,
        updatedById: user.id,
      },
      select: { id: true },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_AML_CONFIGURATION_UPDATED",
      targetType: "CMP_AML_CONFIGURATION",
      targetId: configuration.id,
      description: "Updated CMP Didit AML configuration",
      source,
    });
    return this.getPublicStatus();
  }

  async disable(user: RequestUser, source?: AuditLogSource) {
    assertSuperAdmin(user);
    const configuration = await this.prisma.cmpAmlConfiguration.upsert({
      where: { id: CONFIGURATION_ID },
      create: {
        id: CONFIGURATION_ID,
        enabled: false,
        credentialCiphertext: null,
        credentialIv: null,
        credentialAuthTag: null,
        updatedById: user.id,
      },
      update: {
        enabled: false,
        credentialCiphertext: null,
        credentialIv: null,
        credentialAuthTag: null,
        updatedById: user.id,
      },
      select: { id: true },
    });
    await this.auditLogs.log({
      actorId: user.id,
      action: "CMP_AML_CONFIGURATION_DISABLED",
      targetType: "CMP_AML_CONFIGURATION",
      targetId: configuration.id,
      description: "Disabled CMP Didit AML configuration",
      source,
    });
    return this.getPublicStatus();
  }
}

function assertSuperAdmin(user: RequestUser) {
  if (user.globalRole !== "SUPER_ADMIN") {
    throw new ApiForbiddenException(
      "FORBIDDEN",
      "Super Admin is required to manage AML configuration"
    );
  }
}
