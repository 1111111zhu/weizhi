import { ApiNotFoundException } from "../common/api-error";
import { AuditLogsController } from "./audit-logs.controller";

const auditLogs = {
  listForProject: vi.fn(),
};
const prisma = {
  project: {
    findFirst: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
  },
};

describe(AuditLogsController, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createController() {
    return new AuditLogsController(auditLogs as never, prisma as never);
  }

  it("lets super administrators read active project audit logs without project membership", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "project-1" });
    auditLogs.listForProject.mockResolvedValue([{ id: "log-1" }]);
    const controller = createController();

    await expect(
      controller.list(
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never,
        "project-1"
      )
    ).resolves.toStrictEqual([{ id: "log-1" }]);

    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
    expect(auditLogs.listForProject).toHaveBeenCalledWith("project-1");
  });

  it("requires active project membership for non-admin audit log readers", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "project-1" });
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-1",
      status: "ACTIVE",
    });
    auditLogs.listForProject.mockResolvedValue([{ id: "log-1" }]);
    const controller = createController();

    await expect(
      controller.list(
        { id: "staff-1", globalRole: "STAFF" } as never,
        "project-1"
      )
    ).resolves.toStrictEqual([{ id: "log-1" }]);

    expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
      where: {
        projectId_userId: { projectId: "project-1", userId: "staff-1" },
      },
    });
  });

  it("hides inactive projects and non-member access behind not found", async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);
    const controller = createController();

    await expect(
      controller.list(
        { id: "staff-1", globalRole: "STAFF" } as never,
        "missing-project"
      )
    ).rejects.toBeInstanceOf(ApiNotFoundException);

    prisma.project.findFirst.mockResolvedValueOnce({ id: "project-1" });
    prisma.projectMember.findUnique.mockResolvedValueOnce({
      id: "member-1",
      status: "DISABLED",
    });

    await expect(
      controller.list(
        { id: "staff-1", globalRole: "STAFF" } as never,
        "project-1"
      )
    ).rejects.toBeInstanceOf(ApiNotFoundException);
  });
});
