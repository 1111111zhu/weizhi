import { auditLogSourceFromRequest } from "./audit-log-source";
import { AuditLogsService } from "./audit-logs.service";

const prisma = {
  auditLog: {
    create: vi.fn(),
  },
};

describe(AuditLogsService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes request source fields before writing audit logs", async () => {
    prisma.auditLog.create.mockResolvedValue({ id: "log-1" });
    const service = new AuditLogsService(prisma as never);
    const source = auditLogSourceFromRequest({
      ip: "::ffff:10.0.0.5",
      header: (name: string) =>
        ({
          "x-forwarded-for": "203.0.113.10, 10.0.0.5",
          "user-agent": "ProjectWing Test Browser",
        })[name],
    });

    await service.log({
      actorId: "user-1",
      action: "PROJECT_CREATED",
      targetType: "PROJECT",
      targetId: "project-1",
      projectId: "project-1",
      description: "创建项目 AUD-2026-0001",
      source,
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "user-1",
        action: "PROJECT_CREATED",
        ipAddress: "203.0.113.10",
        userAgent: "ProjectWing Test Browser",
      }),
    });
  });

  it("writes through the supplied transaction client", async () => {
    const transaction = { auditLog: { create: vi.fn() } };
    transaction.auditLog.create.mockResolvedValue({ id: "log-2" });
    const service = new AuditLogsService(prisma as never);

    await service.logInTransaction(transaction as never, {
      actorId: "admin-1",
      action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_UPLOADED",
      targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
      targetId: "template-1",
      description: "Uploaded confirmation template CTPL-1",
      source: { ipAddress: "127.0.0.1", userAgent: "Jest" },
    });

    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        action: "CONFIRMATION_TEMPLATE_LIBRARY_FILE_UPLOADED",
        targetType: "CONFIRMATION_TEMPLATE_LIBRARY_FILE",
        targetId: "template-1",
        projectId: undefined,
        description: "Uploaded confirmation template CTPL-1",
        ipAddress: "127.0.0.1",
        userAgent: "Jest",
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("falls back to the direct socket address when proxy headers are absent", () => {
    expect(
      auditLogSourceFromRequest({
        socket: { remoteAddress: "::ffff:192.0.2.25" },
        headers: { "user-agent": "Socket Browser" },
      })
    ).toStrictEqual({
      ipAddress: "192.0.2.25",
      userAgent: "Socket Browser",
    });
  });
});
