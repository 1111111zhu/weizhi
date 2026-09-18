import { ArchiveNotificationService } from "./archive-notification.service";

const prisma = {
  project: {
    findUnique: vi.fn(),
  },
};
const inbox = {
  createCollaborationMessage: vi.fn(),
};
describe(ArchiveNotificationService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026",
      name: "ABC Audit",
      owner: {
        id: "partner-1",
        name: "Jony Ma",
        email: "partner@projectwing.local",
      },
      members: [
        {
          user: {
            id: "partner-1",
            name: "Jony Ma",
            email: "partner@projectwing.local",
          },
        },
        {
          user: {
            id: "manager-1",
            name: "Leo Li",
            email: "manager@projectwing.local",
          },
        },
      ],
    });
    inbox.createCollaborationMessage.mockResolvedValue({});
  });

  function service() {
    return new ArchiveNotificationService(prisma as never, inbox as never);
  }

  it("notifies the project owner and active members through inbox", async () => {
    await service().notifyArchiveCompleted({
      projectId: "project-1",
      actorId: "partner-1",
      packageFileName: "ABC-2026-archive.zip",
    });

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: "project-1" },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          where: { status: "ACTIVE" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledTimes(2);
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith({
      recipientId: "partner-1",
      senderId: null,
      projectId: "project-1",
      type: "SYSTEM_NOTIFICATION",
      title: "Project successfully archived: ABC-2026",
      body: "ABC Audit has been successfully archived. Archive package: ABC-2026-archive.zip",
      contentKey: "PROJECT_ARCHIVE_COMPLETED",
      contentParams: {
        packageFileName: "ABC-2026-archive.zip",
        projectCode: "ABC-2026",
        projectName: "ABC Audit",
      },
      actionUrl: "/engagement/project-1",
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith({
      recipientId: "manager-1",
      senderId: "partner-1",
      projectId: "project-1",
      type: "SYSTEM_NOTIFICATION",
      title: "Project successfully archived: ABC-2026",
      body: "ABC Audit has been successfully archived. Archive package: ABC-2026-archive.zip",
      contentKey: "PROJECT_ARCHIVE_COMPLETED",
      contentParams: {
        packageFileName: "ABC-2026-archive.zip",
        projectCode: "ABC-2026",
        projectName: "ABC Audit",
      },
      actionUrl: "/engagement/project-1",
    });
  });
});
