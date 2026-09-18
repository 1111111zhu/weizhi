import { ApiForbiddenException } from "../common/api-error";
import { DesktopService } from "./desktop.service";

const defaultUser = {
  id: "user-1",
  globalRole: "STAFF",
};

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock() {
  const mock = {
    desktopFolder: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    desktopProjectPlacement: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(
    async (callback: (tx: typeof mock) => unknown) => {
      await Promise.resolve();
      return callback(mock);
    }
  );
  return mock;
}

let prisma: PrismaMock;

describe(DesktopService, () => {
  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([]);
  });

  it("includes the CMP client and member grades for project permissions on returned placements", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.desktopFolder.findMany.mockResolvedValue([]);
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    expect(prisma.desktopProjectPlacement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          project: {
            include: expect.objectContaining({
              cmpClient: { select: expect.objectContaining({ id: true }) },
              members: {
                where: { status: "ACTIVE" },
                include: {
                  user: {
                    select: { id: true, name: true, email: true, globalRole: true },
                  },
                },
              },
            }),
          },
        },
      })
    );
  });

  it("creates a default folder on first desktop load", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValueOnce(null);
    prisma.desktopFolder.create.mockResolvedValue({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.desktopFolder.findMany.mockResolvedValue([]);
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    expect(prisma.desktopFolder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        isDefault: true,
      }),
    });
  });

  it("materializes accessible projects into the default folder", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        projectCode: "AUD-2026-0001",
        name: "ABC Group",
        reportingDate: new Date("2026-12-31"),
      },
    ]);
    prisma.desktopProjectPlacement.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "placement-1",
          folderId: "folder-default",
          projectId: "project-1",
          desktopX: 24,
          desktopY: 24,
          sortOrder: 0,
          project: {
            id: "project-1",
            projectCode: "AUD-2026-0001",
            name: "ABC Group",
            reportingDate: new Date("2026-12-31"),
          },
        },
      ]);
    prisma.desktopFolder.findMany.mockResolvedValue([
      {
        id: "folder-default",
        ownerId: "user-1",
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    ]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    expect(prisma.desktopProjectPlacement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-1",
          projectId: "project-1",
          folderId: "folder-default",
          desktopX: 24,
          desktopY: 24,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("keeps pending final check projects visible on the desktop", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-pending",
        projectCode: "AUD-2026-0003",
        name: "Pending Project",
        status: "PENDING_FINAL_CHECK",
      },
    ]);
    prisma.desktopProjectPlacement.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "placement-pending",
          folderId: "folder-default",
          projectId: "project-pending",
          desktopX: 24,
          desktopY: 24,
          sortOrder: 0,
          project: {
            id: "project-pending",
            status: "PENDING_FINAL_CHECK",
          },
        },
      ]);
    prisma.desktopFolder.findMany.mockResolvedValue([
      {
        id: "folder-default",
        ownerId: "user-1",
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    ]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["ACTIVE", "PENDING_FINAL_CHECK", "ARCHIVED"],
          },
        }),
      })
    );
    expect(prisma.desktopProjectPlacement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-1",
          projectId: "project-pending",
          folderId: "folder-default",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("keeps archived projects in their existing desktop folder", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValueOnce({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-active",
        projectCode: "AUD-2026-0001",
        name: "Active Project",
        status: "ACTIVE",
      },
      {
        id: "project-archived",
        projectCode: "AUD-2026-0002",
        name: "Archived Project",
        status: "ARCHIVED",
      },
    ]);
    prisma.desktopProjectPlacement.findMany
      .mockResolvedValueOnce([
        {
          id: "placement-archived",
          projectId: "project-archived",
          folderId: "folder-default",
          desktopX: 24,
          desktopY: 24,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "placement-active",
          folderId: "folder-default",
          projectId: "project-active",
          desktopX: 24,
          desktopY: 24,
          sortOrder: 0,
          project: { id: "project-active", status: "ACTIVE" },
        },
        {
          id: "placement-archived",
          folderId: "folder-default",
          projectId: "project-archived",
          desktopX: 156,
          desktopY: 24,
          sortOrder: 0,
          project: { id: "project-archived", status: "ARCHIVED" },
        },
      ]);
    prisma.desktopFolder.findMany.mockResolvedValue([
      {
        id: "folder-default",
        ownerId: "user-1",
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
    ]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    expect(prisma.desktopFolder.create).not.toHaveBeenCalled();
    expect(prisma.desktopProjectPlacement.update).not.toHaveBeenCalled();
    expect(prisma.desktopProjectPlacement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "user-1",
          projectId: "project-active",
          folderId: "folder-default",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("keeps archived projects in their existing custom desktop folder", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValueOnce({
      id: "folder-default",
      ownerId: "user-1",
      name: "Default",
      isDefault: true,
      sortOrder: 0,
    });
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-active",
        projectCode: "AUD-2026-0001",
        name: "Active Project",
        status: "ACTIVE",
      },
      {
        id: "project-archived",
        projectCode: "AUD-2026-0002",
        name: "Archived Project",
        status: "ARCHIVED",
      },
    ]);
    prisma.desktopProjectPlacement.findMany
      .mockResolvedValueOnce([
        {
          id: "placement-active",
          projectId: "project-active",
          folderId: "folder-client",
          desktopX: 24,
          desktopY: 24,
        },
        {
          id: "placement-archived",
          projectId: "project-archived",
          folderId: "folder-client",
          desktopX: 156,
          desktopY: 24,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "placement-active",
          folderId: "folder-client",
          projectId: "project-active",
          desktopX: 24,
          desktopY: 24,
          sortOrder: 0,
          project: { id: "project-active", status: "ACTIVE" },
        },
        {
          id: "placement-archived",
          folderId: "folder-client",
          projectId: "project-archived",
          desktopX: 156,
          desktopY: 24,
          sortOrder: 0,
          project: { id: "project-archived", status: "ARCHIVED" },
        },
      ]);
    prisma.desktopFolder.findMany.mockResolvedValue([
      {
        id: "folder-default",
        ownerId: "user-1",
        name: "Default",
        isDefault: true,
        sortOrder: 0,
      },
      {
        id: "folder-client",
        ownerId: "user-1",
        name: "Client",
        isDefault: false,
        sortOrder: 1,
      },
    ]);
    const service = new DesktopService(prisma as never);

    await service.getDesktop(defaultUser as never);

    const updateCalls = prisma.desktopProjectPlacement.update.mock.calls;
    expect(
      updateCalls.some(([call]) => call.where.id === "placement-active")
    ).toBeFalsy();
    expect(
      updateCalls.some(([call]) => call.where.id === "placement-archived")
    ).toBeFalsy();
    expect(prisma.desktopProjectPlacement.createMany).not.toHaveBeenCalled();
  });

  it("persists desktop coordinates and returns member grades for project permissions", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "project-1" });
    prisma.desktopProjectPlacement.findFirst.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-default",
    });
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-default",
      desktopX: 320,
      desktopY: 180,
      project: { id: "project-1", projectCode: "AUD-2026-0001" },
    });
    const service = new DesktopService(prisma as never);

    await service.updateProjectPlacement("project-1", defaultUser as never, {
      desktopX: 320,
      desktopY: 180,
    });

    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          desktopX: 320,
          desktopY: 180,
        }),
        include: {
          project: {
            include: expect.objectContaining({
              members: {
                where: { status: "ACTIVE" },
                include: {
                  user: {
                    select: { id: true, name: true, email: true, globalRole: true },
                  },
                },
              },
            }),
          },
        },
        where: {
          userId_projectId: {
            userId: "user-1",
            projectId: "project-1",
          },
        },
      })
    );
  });

  it("moves a placement to the next free cell when the requested cell is occupied", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "project-1" });
    prisma.desktopProjectPlacement.findFirst.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-default",
      desktopX: 24,
      desktopY: 24,
    });
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([
      {
        id: "placement-2",
        userId: "user-1",
        projectId: "project-2",
        folderId: "folder-default",
        desktopX: 156,
        desktopY: 24,
      },
    ]);
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-default",
      desktopX: 288,
      desktopY: 24,
      project: { id: "project-1", projectCode: "AUD-2026-0001" },
    });
    const service = new DesktopService(prisma as never);

    await service.updateProjectPlacement("project-1", defaultUser as never, {
      desktopX: 156,
      desktopY: 24,
    });

    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          desktopX: 288,
          desktopY: 24,
        }),
      })
    );
  });

  it("moves a project to a folder owned by the current user", async () => {
    prisma.project.findFirst.mockResolvedValue({ id: "project-1" });
    prisma.desktopFolder.findFirstOrThrow.mockResolvedValue({
      id: "folder-2",
      ownerId: "user-1",
    });
    prisma.desktopProjectPlacement.findFirst.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-default",
    });
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({
      id: "placement-1",
      userId: "user-1",
      projectId: "project-1",
      folderId: "folder-2",
      desktopX: 64,
      desktopY: 72,
      project: { id: "project-1", projectCode: "AUD-2026-0001" },
    });
    const service = new DesktopService(prisma as never);

    await service.updateProjectPlacement("project-1", defaultUser as never, {
      folderId: "folder-2",
      desktopX: 64,
      desktopY: 72,
    });

    expect(prisma.desktopFolder.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "folder-2", ownerId: "user-1" },
    });
    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ folderId: "folder-2" }),
      })
    );
  });

  it("deletes an empty non-default folder", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-2",
      ownerId: "user-1",
      isDefault: false,
    });
    prisma.desktopProjectPlacement.count.mockResolvedValue(0);
    const service = new DesktopService(prisma as never);

    await service.deleteFolder("folder-2", defaultUser as never);

    expect(prisma.desktopProjectPlacement.count).toHaveBeenCalledWith({
      where: { userId: "user-1", folderId: "folder-2" },
    });
    expect(prisma.desktopFolder.delete).toHaveBeenCalledWith({
      where: { id: "folder-2" },
    });
  });

  it("rejects deletion when a folder still contains projects", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-2",
      ownerId: "user-1",
      isDefault: false,
    });
    prisma.desktopProjectPlacement.count.mockResolvedValue(1);
    const service = new DesktopService(prisma as never);

    await expect(
      service.deleteFolder("folder-2", defaultUser as never)
    ).rejects.toMatchObject({
      response: {
        code: "BAD_REQUEST",
        message: "Folder must be empty before deletion",
      },
    });
    expect(prisma.desktopFolder.delete).not.toHaveBeenCalled();
  });

  it("reorders folder placements in one transaction without collision avoidance", async () => {
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-default",
      ownerId: "user-1",
    });
    prisma.project.findMany.mockResolvedValue([
      { id: "project-1" },
      { id: "project-2" },
    ]);
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([
      { projectId: "project-1" },
      { projectId: "project-2" },
    ]);
    prisma.desktopProjectPlacement.updateMany.mockResolvedValue({ count: 1 });
    const service = new DesktopService(prisma as never);

    await service.reorderProjectPlacements(
      "folder-default",
      defaultUser as never,
      {
        placements: [
          {
            projectId: "project-2",
            desktopX: 24,
            desktopY: 24,
            sortOrder: 0,
          },
          {
            projectId: "project-1",
            desktopX: 156,
            desktopY: 24,
            sortOrder: 1,
          },
        ],
      }
    );

    expect(prisma.desktopProjectPlacement.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          userId: "user-1",
          folderId: "folder-default",
          projectId: "project-2",
        },
        data: { desktopX: 24, desktopY: 24, sortOrder: 0 },
      }
    );
    expect(prisma.desktopProjectPlacement.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        where: {
          userId: "user-1",
          folderId: "folder-default",
          projectId: "project-1",
        },
        data: { desktopX: 156, desktopY: 24, sortOrder: 1 },
      }
    );
  });

  it("rejects placement updates for inaccessible projects", async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new DesktopService(prisma as never);

    await expect(
      service.updateProjectPlacement("project-2", defaultUser as never, {
        desktopX: 1,
        desktopY: 1,
      })
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });
});
