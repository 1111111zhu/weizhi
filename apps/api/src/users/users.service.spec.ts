import type { RequestUser } from "../auth/request-user";
import {
  ApiBadRequestException,
  ApiForbiddenException,
} from "../common/api-error";
import { UsersService } from "./users.service";

const prisma = {
  $transaction: vi.fn(),
  authAccount: {
    upsert: vi.fn(),
  },
  authSession: {
    deleteMany: vi.fn(),
  },
  user: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  projectMember: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
};
const auditLogs = {
  log: vi.fn(),
  logInTransaction: vi.fn(),
};

describe(UsersService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.projectMember.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  it("requires current impact confirmation before suspending old project grants during a grade change", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    const grant = {
      id: "m1",
      projectId: "p1",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
      authorizationSuspendedAt: null,
      updatedAt: new Date(),
      project: { projectCode: "P1", name: "Project one" },
    };
    prisma.projectMember.findMany.mockResolvedValue([grant]);
    const service = new UsersService(prisma as never, auditLogs as never);
    const impact = await service.roleImpact("user-1", "STAFF");
    await expect(
      service.update("user-1", { globalRole: "STAFF" }, "admin")
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(prisma.projectMember.updateMany).not.toHaveBeenCalled();
    await service.update(
      "user-1",
      { globalRole: "STAFF", projectAuthorizationImpactToken: impact.token },
      "admin"
    );
    expect(prisma.projectMember.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1"] } },
      data: { authorizationSuspendedAt: expect.any(Date) },
    });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        action: "PROJECT_AUTHORIZATION_SUSPENDED",
        projectId: "p1",
        targetId: "m1",
      })
    );
  });

  it("lists users with search and role/status filters", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.list({
        q: "staff",
        globalRole: "STAFF",
        status: "ACTIVE",
      })
    ).resolves.toStrictEqual([]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: { contains: "staff", mode: "insensitive" } },
          { name: { contains: "staff", mode: "insensitive" } },
        ],
        globalRole: "STAFF",
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        staffNo: true,
        hourlyRate: true,
        globalRole: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it("keeps the invite directory limited to active business-grade accounts", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(service.directory()).resolves.toStrictEqual([]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", globalRole: { not: "SUPER_ADMIN" } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
      },
    });
  });

  it("requires a search for ordinary users and restricts full-list browsing to Partners", async () => {
    const service = new UsersService(prisma as never, auditLogs as never);
    const staff: RequestUser = {
      id: "staff-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
    };
    const partner: RequestUser = { ...staff, globalRole: "PARTNER" };

    await expect(
      service.projectInvitees({ q: "a" }, staff)
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    await expect(
      service.projectInvitees({ browseAll: true }, staff)
    ).rejects.toBeInstanceOf(ApiForbiddenException);

    prisma.$transaction.mockResolvedValueOnce([0, []]);
    await expect(
      service.projectInvitees({ browseAll: true, page: 1 }, partner)
    ).resolves.toMatchObject({ users: [], total: 0 });
  });

  it("creates a user when the email is not already registered", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([
      { staffNo: "000" },
      { staffNo: "002" },
    ]);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New User",
      globalRole: "STAFF",
      staffNo: "003",
      hourlyRate: "600.00",
      status: "ACTIVE",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.create(
        {
          email: "new@example.com",
          name: "New User",
          password: "User12345!",
          globalRole: "STAFF",
        },
        "admin-1"
      )
    ).resolves.toMatchObject({
      id: "user-1",
      email: "new@example.com",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "new@example.com" },
      select: { id: true },
    });
    const createInput = prisma.user.create.mock.calls[0]?.[0];
    expect(createInput.data).toMatchObject({
      staffNo: "003",
      hourlyRate: 600,
      emailVerified: true,
      authAccounts: {
        create: {
          providerId: "credential",
        },
      },
    });
    expect(createInput.data.authAccounts.create.accountId).toBe(
      createInput.data.id
    );
    expect(createInput.data.authAccounts.create.password).toMatch(
      /^\$2[aby]\$/
    );
    expect(createInput.data).not.toHaveProperty("passwordHash");
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "USER_CREATED",
        targetType: "USER",
        targetId: "user-1",
      })
    );
  });

  it("rejects duplicate user emails before hashing or writing", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
    });
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.create(
        {
          email: "used@example.com",
          name: "Used User",
          password: "User12345!",
          globalRole: "STAFF",
        },
        "admin-1"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "EMAIL_ALREADY_EXISTS" }),
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("updates a user and revokes sessions when disabling the account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "MANAGER",
      status: "DISABLED",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    prisma.authSession.deleteMany.mockResolvedValue({ count: 2 });
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.update(
        "user-1",
        {
          globalRole: "MANAGER",
          status: "DISABLED",
        },
        "admin-1"
      )
    ).resolves.toMatchObject({
      id: "user-1",
      globalRole: "MANAGER",
      status: "DISABLED",
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: {
          globalRole: "MANAGER",
          status: "DISABLED",
          hourlyRate: 1800,
        },
      })
    );
    expect(prisma.projectMember.updateMany).not.toHaveBeenCalled();
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        actorId: "admin-1",
        action: "USER_UPDATED",
        targetType: "USER",
        targetId: "user-1",
      })
    );
  });

  it("updates the standard hourly rate when a user changes grade", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
      status: "ACTIVE",
      staffNo: null,
      hourlyRate: null,
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "SENIOR",
      status: "ACTIVE",
      staffNo: "000",
      hourlyRate: "900.00",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const service = new UsersService(prisma as never, auditLogs as never);

    await service.update("user-1", { globalRole: "SENIOR" }, "admin-1");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { globalRole: "SENIOR", hourlyRate: 900 },
      })
    );
  });

  it("prevents a super administrator from disabling their own account", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.update("admin-1", { status: "DISABLED" }, "admin-1")
    ).rejects.toBeInstanceOf(ApiBadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("keeps at least one active super administrator", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "admin-2",
      email: "admin2@example.com",
      name: "Admin 2",
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    prisma.user.count.mockResolvedValue(1);
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.update("admin-2", { status: "DISABLED" }, "admin-1")
    ).rejects.toBeInstanceOf(ApiBadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns not found when resetting a missing user password", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.resetPassword("missing-user", "admin-1")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("resets the credential account and revokes existing sessions", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
    });
    prisma.authAccount.upsert.mockResolvedValue({ id: "account-1" });
    prisma.authSession.deleteMany.mockResolvedValue({ count: 2 });
    const service = new UsersService(prisma as never, auditLogs as never);

    await expect(
      service.resetPassword("user-1", "admin-1")
    ).resolves.toStrictEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-1" }),
        temporaryPassword: expect.any(String),
      })
    );

    expect(prisma.authAccount.upsert).toHaveBeenCalledWith({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: "user-1",
        },
      },
      create: expect.objectContaining({
        userId: "user-1",
        providerId: "credential",
        accountId: "user-1",
        password: expect.stringMatching(/^\$2[aby]\$/),
      }),
      update: {
        password: expect.stringMatching(/^\$2[aby]\$/),
      },
    });
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
