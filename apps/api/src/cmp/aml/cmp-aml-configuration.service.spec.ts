import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../../auth/request-user";
import { encryptCredential } from "../../common/credential-cipher";
import { CmpAmlConfigurationService } from "./cmp-aml-configuration.service";

const admin: RequestUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  globalRole: "SUPER_ADMIN",
};
const staff: RequestUser = { ...admin, id: "staff-1", globalRole: "STAFF" };

afterEach(() => {
  vi.unstubAllEnvs();
});

function fixture(configuration: unknown = null) {
  const prisma = {
    cmpAmlConfiguration: {
      findUnique: vi.fn().mockResolvedValue(configuration),
      upsert: vi.fn().mockResolvedValue({ id: "default" }),
    },
  };
  const auditLogs = { log: vi.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    auditLogs,
    service: new CmpAmlConfigurationService(
      prisma as never,
      auditLogs as never
    ),
  };
}

describe(CmpAmlConfigurationService, () => {
  it("uses legacy environment configuration when no database record exists", async () => {
    vi.stubEnv("PROJECT_WING_DIDIT_AML_ENABLED", "true");
    vi.stubEnv("PROJECT_WING_DIDIT_API_KEY", " env-key ");
    const { service } = fixture();

    await expect(service.getPublicStatus()).resolves.toMatchObject({
      enabled: true,
      configured: true,
      source: "ENVIRONMENT",
    });
  });

  it("gives an explicit disabled database record precedence over environment variables", async () => {
    vi.stubEnv("PROJECT_WING_DIDIT_AML_ENABLED", "true");
    vi.stubEnv("PROJECT_WING_DIDIT_API_KEY", "env-key");
    const { service } = fixture({
      enabled: false,
      credentialCiphertext: null,
      credentialIv: null,
      credentialAuthTag: null,
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedBy: null,
    });

    await expect(service.getPublicStatus()).resolves.toMatchObject({
      enabled: false,
      configured: false,
      source: null,
    });
  });

  it("encrypts credentials, returns only status, and audits updates", async () => {
    vi.stubEnv(
      "PROJECT_WING_MAIL_CREDENTIAL_KEY",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    const fixtureData = fixture();
    const result = await fixtureData.service.save(admin, "  secret-key  ");

    expect(fixtureData.prisma.cmpAmlConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enabled: true }),
        update: expect.objectContaining({ enabled: true }),
      })
    );
    const call =
      fixtureData.prisma.cmpAmlConfiguration.upsert.mock.calls[0]?.[0];
    expect(call.create.credentialCiphertext).not.toBe("secret-key");
    expect(result).not.toHaveProperty("apiKey");
    expect(fixtureData.auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_AML_CONFIGURATION_UPDATED" })
    );
  });

  it("clears credentials when disabling and rejects non-admins", async () => {
    const fixtureData = fixture();
    await expect(fixtureData.service.disable(staff)).rejects.toMatchObject({
      response: { code: "FORBIDDEN" },
    });
    await fixtureData.service.disable(admin);
    expect(fixtureData.prisma.cmpAmlConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          enabled: false,
          credentialCiphertext: null,
          credentialIv: null,
          credentialAuthTag: null,
        }),
      })
    );
    expect(fixtureData.auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_AML_CONFIGURATION_DISABLED" })
    );
  });

  it("decrypts a database credential only for the internal resolver", async () => {
    vi.stubEnv(
      "PROJECT_WING_MAIL_CREDENTIAL_KEY",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    const encrypted = encryptCredential("database-key");
    const { service } = fixture({
      enabled: true,
      ...encrypted,
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedBy: { id: "admin-1", name: "Admin" },
    });
    await expect(service.resolveApiKey()).resolves.toBe("database-key");
    await expect(service.getPublicStatus()).resolves.not.toHaveProperty(
      "apiKey"
    );
  });

  it("does not decrypt a stored credential when reading public status", async () => {
    const { service } = fixture({
      enabled: true,
      credentialCiphertext: "invalid-ciphertext",
      credentialIv: "invalid-iv",
      credentialAuthTag: "invalid-auth-tag",
      updatedAt: new Date("2026-09-02T00:00:00.000Z"),
      updatedBy: null,
    });

    await expect(service.getPublicStatus()).resolves.toMatchObject({
      enabled: true,
      configured: true,
      source: "DATABASE",
    });
  });
});
