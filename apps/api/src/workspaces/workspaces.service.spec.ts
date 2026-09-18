import { WorkspacesService } from "./workspaces.service";

const prisma = {
  workspace: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const auditLogs = {
  log: vi.fn(),
};

describe(WorkspacesService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only workspaces owned by the current user with privately placed projects", async () => {
    prisma.workspace.findMany.mockResolvedValue([]);
    const service = new WorkspacesService(prisma as never, auditLogs as never);

    await service.list({
      id: "user-1",
      globalRole: "STAFF",
    } as never);

    expect(prisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "user-1" },
        include: expect.objectContaining({
          placements: expect.objectContaining({
            where: { project: { status: "ACTIVE" } },
          }),
        }),
      })
    );
  });

  it("updates only workspaces owned by the current user", async () => {
    prisma.workspace.update.mockResolvedValue({
      id: "workspace-1",
      ownerId: "user-1",
      name: "Updated Workspace",
      clientName: "Updated Client",
      description: "Updated note",
      placements: [],
    });
    const service = new WorkspacesService(prisma as never, auditLogs as never);

    await service.update(
      "workspace-1",
      {
        id: "user-1",
        globalRole: "STAFF",
      } as never,
      {
        name: "Updated Workspace",
        clientName: "Updated Client",
        description: "Updated note",
      }
    );

    expect(prisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "workspace-1",
          ownerId: "user-1",
        },
        data: {
          name: "Updated Workspace",
          clientName: "Updated Client",
          description: "Updated note",
        },
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "WORKSPACE_UPDATED",
        targetId: "workspace-1",
      })
    );
  });
});
