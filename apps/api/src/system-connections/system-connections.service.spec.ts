import { Logger } from "@nestjs/common";

import type { RequestUser } from "../auth/request-user";
import { decryptCredential } from "../common/credential-cipher";
import { SystemConnectionsService } from "./system-connections.service";

const prisma = {
  systemConnection: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
const auditLogs = { log: vi.fn() };
const user: RequestUser = {
  id: "admin-1",
  email: "admin@example.test",
  name: "System Admin",
  globalRole: "SUPER_ADMIN",
};
const source = { ipAddress: "127.0.0.1" };

type FetchMock = {
  mockResolvedValue: (value: unknown) => FetchMock;
};

function fetchMock() {
  return vi.spyOn(global, "fetch") as unknown as FetchMock;
}

describe(SystemConnectionsService, () => {
  const service = new SystemConnectionsService(
    prisma as never,
    auditLogs as never
  );

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY = Buffer.alloc(32, 9).toString(
      "base64"
    );
    fetchMock().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        await Promise.resolve();
        return {
          code: 0,
          data: { quota_total: 1100, quota_used: 2, quota_remain: 1098 },
        };
      },
    });
    prisma.systemConnection.upsert.mockResolvedValue({ id: "connection-1" });
    prisma.systemConnection.findUnique.mockResolvedValue({
      id: "connection-1",
      provider: "TRACKING_17TRACK",
      status: "CONNECTED",
      verifiedAt: new Date(),
      lastTestedAt: new Date(),
      lastError: null,
      quotaTotal: 1100,
      quotaUsed: 2,
      quotaRemain: 1098,
      updatedAt: new Date(),
      updatedBy: { id: user.id, name: user.name, email: user.email },
    });
  });

  afterAll(() => {
    delete process.env.PROJECT_WING_MAIL_CREDENTIAL_KEY;
  });

  it("verifies and encrypts the shared 17TRACK API key", async () => {
    await service.connect(user, "seventeen-track-key", source);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.17track.net/track/v2.4/getquota",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "17token": "seventeen-track-key" }),
      })
    );
    const data = prisma.systemConnection.upsert.mock.calls[0][0].create;
    expect(data.credentialCiphertext).not.toContain("seventeen-track-key");
    expect(decryptCredential(data)).toBe("seventeen-track-key");
    expect(data).toMatchObject({
      provider: "TRACKING_17TRACK",
      quotaRemain: 1098,
      updatedById: user.id,
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SYSTEM_CONNECTION_CONNECTED" })
    );
  });

  it("does not store an invalid API key", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});
    fetchMock().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        await Promise.resolve();
        return { code: -18_010_002 };
      },
    });

    await expect(service.connect(user, "invalid-key", source)).rejects.toThrow(
      "17TRACK 连接失败"
    );
    expect(prisma.systemConnection.upsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "17TRACK connection test failed: 17TRACK responded with code -18010002"
    );
    warn.mockRestore();
  });
});
