import { ConfirmationWorkspaceService } from "./confirmation-workspace.service";

const prisma = {
  project: {
    findMany: vi.fn(),
  },
};

function createService() {
  return new ConfirmationWorkspaceService(prisma as never);
}

describe(ConfirmationWorkspaceService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Orchid Audit",
        projectCode: "AUD-001",
        reportDate: new Date("2026-12-31T00:00:00.000Z"),
        confirmations: [
          { status: "DRAFT", createdBy: "user-1" },
          { status: "AWAITING_RESPONSE", createdBy: "user-2" },
          { status: "VOIDED", createdBy: "user-1" },
        ],
      },
      {
        id: "project-2",
        name: "Undated Project",
        projectCode: "AUD-002",
        reportDate: null,
        confirmations: [],
      },
    ]);
  });

  it("returns compact per-project counts for a project member", async () => {
    const service = createService();
    const result = await service.list({
      id: "user-1",
      globalRole: "STAFF",
    } as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: {
            some: { userId: "user-1", status: "ACTIVE" },
          },
        }),
        select: expect.objectContaining({
          confirmations: {
            select: { status: true, createdBy: true },
          },
        }),
      })
    );
    expect(result).toStrictEqual([
      {
        projectId: "project-1",
        projectName: "Orchid Audit",
        projectCode: "AUD-001",
        reportDate: "2026-12-31T00:00:00.000Z",
        totalConfirmationCount: 3,
        ownConfirmationCount: 2,
        awaitingResponseCount: 1,
        statusCounts: {
          DRAFT: 1,
          PREPARED: 0,
          AWAITING_RESPONSE: 1,
          RESPONSE_RECEIVED: 0,
          CLOSED: 0,
          VOIDED: 1,
        },
      },
      {
        projectId: "project-2",
        projectName: "Undated Project",
        projectCode: "AUD-002",
        reportDate: null,
        totalConfirmationCount: 0,
        ownConfirmationCount: 0,
        awaitingResponseCount: 0,
        statusCounts: {
          DRAFT: 0,
          PREPARED: 0,
          AWAITING_RESPONSE: 0,
          RESPONSE_RECEIVED: 0,
          CLOSED: 0,
          VOIDED: 0,
        },
      },
    ]);
  });

  it("excludes archived projects from the confirmation center", async () => {
    const service = createService();

    await service.list({
      id: "officer-1",
      globalRole: "CONFIRMATION_OFFICER",
    } as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: ["ACTIVE", "PENDING_FINAL_CHECK"],
          },
        },
      })
    );
  });
});
