import { InboxService } from "./inbox.service";

const prisma = {
  user: {
    findUnique: vi.fn(),
  },
  inboxMessage: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
};

describe(InboxService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists recipient messages with collaboration context", async () => {
    prisma.inboxMessage.findMany.mockResolvedValue([]);
    const service = new InboxService(prisma as never);

    await service.list("user-1");

    expect(prisma.inboxMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientId: "user-1",
          OR: [
            { actionUrl: null },
            { actionUrl: { not: { startsWith: "/cmp/" } } },
          ],
        },
        orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
        include: expect.objectContaining({
          project: expect.any(Object),
          workingPaper: expect.any(Object),
          reviewQuestion: expect.any(Object),
          projectInvitation: expect.any(Object),
        }),
      })
    );
    const query = prisma.inboxMessage.findMany.mock.calls[0]?.[0];
    expect(query.include.reviewQuestion.select).toStrictEqual(
      expect.objectContaining({
        workingPaperId: true,
        attachmentId: true,
        smartFormNodeId: true,
        smartFormRowId: true,
        smartFormTargetLabel: true,
      })
    );
  });

  it("marks only owned messages as read", async () => {
    const readAt = new Date("2026-06-08T08:00:00.000Z");
    prisma.inboxMessage.findFirst.mockResolvedValue({
      id: "message-1",
      recipientId: "user-1",
      readAt,
    });
    prisma.inboxMessage.update.mockResolvedValue({ id: "message-1", readAt });
    const service = new InboxService(prisma as never);

    await service.markRead("message-1", "user-1");

    expect(prisma.inboxMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: "message-1",
        recipientId: "user-1",
        OR: [
          { actionUrl: null },
          { actionUrl: { not: { startsWith: "/cmp/" } } },
        ],
      },
    });
    expect(prisma.inboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "message-1" },
        data: { readAt },
      })
    );
  });

  it("marks only owned messages as unread", async () => {
    prisma.inboxMessage.findFirst.mockResolvedValue({
      id: "message-1",
      recipientId: "user-1",
      readAt: new Date("2026-06-08T08:00:00.000Z"),
    });
    prisma.inboxMessage.update.mockResolvedValue({
      id: "message-1",
      readAt: null,
    });
    const service = new InboxService(prisma as never);

    await service.markUnread("message-1", "user-1");

    expect(prisma.inboxMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: "message-1",
        recipientId: "user-1",
        OR: [
          { actionUrl: null },
          { actionUrl: { not: { startsWith: "/cmp/" } } },
        ],
      },
    });
    expect(prisma.inboxMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "message-1" },
        data: { readAt: null },
      })
    );
  });

  it("marks all unread recipient messages in one update", async () => {
    prisma.inboxMessage.updateMany.mockResolvedValue({ count: 3 });
    const service = new InboxService(prisma as never);
    const result = await service.markAllRead("user-1");

    expect(prisma.inboxMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientId: "user-1",
          readAt: null,
        }),
        data: { readAt: expect.any(Date) },
      })
    );
    expect(result.count).toBe(3);
  });

  it("keeps CMP and EMP inbox queries in separate scopes", async () => {
    prisma.inboxMessage.findMany.mockResolvedValue([]);
    const service = new InboxService(prisma as never);

    await service.list("user-1", "CMP");

    expect(prisma.inboxMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientId: "user-1",
          actionUrl: { startsWith: "/cmp/" },
        },
      })
    );
  });

  it("deletes only owned messages", async () => {
    prisma.inboxMessage.findFirst.mockResolvedValue({ id: "message-1" });
    prisma.inboxMessage.delete.mockResolvedValue({ id: "message-1" });
    const service = new InboxService(prisma as never);

    await expect(service.delete("message-1", "user-1")).resolves.toStrictEqual({
      id: "message-1",
    });
    expect(prisma.inboxMessage.delete).toHaveBeenCalledWith({
      where: { id: "message-1" },
    });
  });

  it("rejects deleting messages outside the recipient scope", async () => {
    prisma.inboxMessage.findFirst.mockResolvedValue(null);
    const service = new InboxService(prisma as never);

    await expect(service.delete("message-1", "user-2")).rejects.toThrow(
      "消息不存在或无权访问"
    );
    expect(prisma.inboxMessage.delete).not.toHaveBeenCalled();
  });

  it("creates collaboration messages and skips self notifications", async () => {
    prisma.inboxMessage.create.mockResolvedValue({ id: "message-1" });
    const service = new InboxService(prisma as never);

    await service.createCollaborationMessage({
      recipientId: "reviewer-1",
      senderId: "preparer-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      reviewQuestionId: "question-1",
      type: "REVIEW_REPLY",
      title: "Review question replied",
      body: "Variance support uploaded.",
      contentKey: "REVIEW_QUESTION_REPLIED",
      contentParams: {
        actor: "Preparer",
        paperCode: "C-01",
        paperTitle: "Cash testing",
        question: "Variance support uploaded.",
      },
    });
    const skipped = await service.createCollaborationMessage({
      recipientId: "preparer-1",
      senderId: "preparer-1",
      projectId: "project-1",
      type: "SIGNOFF",
      title: "Signed",
      body: "Signed by the same user.",
    });

    expect(prisma.inboxMessage.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: "reviewer-1",
          senderId: "preparer-1",
          actionUrl: "/engagement/project-1",
          contentKey: "REVIEW_QUESTION_REPLIED",
          contentParams: {
            actor: "Preparer",
            paperCode: "C-01",
            paperTitle: "Cash testing",
            question: "Variance support uploaded.",
          },
        }),
      })
    );
    expect(skipped).toBeNull();
  });

  it("emails the recipient after creating an inbox message", async () => {
    vi.stubEnv("FRONTEND_URL", "http://localhost:3001");
    prisma.inboxMessage.create.mockResolvedValue({ id: "message-1" });
    prisma.user.findUnique.mockResolvedValue({
      email: "reviewer@example.com",
      preferredLocale: "en-US",
    });
    const email = { send: vi.fn().mockResolvedValue({ skipped: false }) };
    const service = new InboxService(prisma as never, email as never);

    await service.createCollaborationMessage({
      recipientId: "reviewer-1",
      senderId: "preparer-1",
      projectId: "project-1",
      type: "REVIEW_QUESTION",
      title: "Review note needs reply",
      body: "Please review the attached support.",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "reviewer-1" },
      select: { email: true, preferredLocale: true },
    });
    expect(email.send).toHaveBeenCalledOnce();
    const sent = email.send.mock.calls[0]?.[0];
    expect(sent).toStrictEqual(
      expect.objectContaining({
        to: "reviewer@example.com",
        subject: "[Project Wing] Review note needs reply",
      })
    );
    expect(sent.html).toContain("Project Wing");
    expect(sent.html).toContain("Review note needs reply");
    expect(sent.html).toContain(
      'href="http://localhost:3001/en-US/engagement/project-1"'
    );
    expect(sent.text).toContain("Please review the attached support.");
    expect(sent.text).toBe(
      [
        "Please review the attached support.",
        "",
        "View details：http://localhost:3001/en-US/engagement/project-1",
      ].join("\n")
    );
  });

  it("keeps inbox creation successful when email delivery fails", async () => {
    prisma.inboxMessage.create.mockResolvedValue({ id: "message-1" });
    prisma.user.findUnique.mockResolvedValue({
      email: "reviewer@example.com",
      preferredLocale: "en-US",
    });
    const email = { send: vi.fn().mockRejectedValue(new Error("SMTP down")) };
    const service = new InboxService(prisma as never, email as never);

    await expect(
      service.createCollaborationMessage({
        recipientId: "reviewer-1",
        senderId: "preparer-1",
        type: "REVIEW_QUESTION",
        title: "Review note needs reply",
        body: "Please review the attached support.",
      })
    ).resolves.toStrictEqual({ id: "message-1" });
  });

  it("renders one email in the recipient's preferred language", async () => {
    prisma.inboxMessage.create.mockResolvedValue({ id: "message-1" });
    prisma.user.findUnique.mockResolvedValue({
      email: "reviewer@example.com",
      preferredLocale: "en-US",
    });
    const email = { send: vi.fn().mockResolvedValue({ skipped: false }) };
    const service = new InboxService(prisma as never, email as never);

    await service.createCollaborationMessage({
      recipientId: "reviewer-1",
      senderId: "preparer-1",
      projectId: "project-1",
      type: "SIGNOFF",
      title: "底稿已完成编制：C-01",
      body: "Sam 已编制签署底稿 C-01 Cash。",
      contentKey: "WORKING_PAPER_PREPARED",
      contentParams: {
        actor: "Sam",
        paperCode: "C-01",
        paperTitle: "Cash",
      },
    });

    expect(email.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        html: expect.stringContaining("Workpaper prepared: C-01"),
        subject: "[Project Wing] Workpaper prepared: C-01",
        text: expect.stringContaining(
          "Sam completed the preparer sign-off for C-01 Cash."
        ),
      })
    );
  });

  it("does not duplicate email when a producer owns specialized delivery", async () => {
    prisma.inboxMessage.create.mockResolvedValue({ id: "message-1" });
    const email = { send: vi.fn() };
    const service = new InboxService(prisma as never, email as never);

    await service.createCollaborationMessage({
      recipientId: "reviewer-1",
      type: "SYSTEM_NOTIFICATION",
      title: "Specialized notification",
      body: "Delivered by the producer.",
      suppressEmail: true,
    });

    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
