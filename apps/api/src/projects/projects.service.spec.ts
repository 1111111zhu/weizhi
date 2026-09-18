import { Prisma } from "@prisma/client";
import { DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE } from "@project-wing/shared";

import { ProjectsService } from "./projects.service";

const prisma = {
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  cmpEngagement: {
    findFirst: vi.fn(),
  },
  frameworkTemplate: {
    findFirst: vi.fn(),
  },
  projectTemplate: {
    findFirst: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  workspace: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  projectInvitation: {
    create: vi.fn(),
  },
  inboxMessage: {
    create: vi.fn(),
  },
  projectWorkspacePlacement: {
    create: vi.fn(),
  },
  desktopFolder: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  desktopProjectPlacement: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  workflowNode: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  attachment: {
    create: vi.fn(),
    update: vi.fn(),
  },
  attachmentVersion: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  smartFormInstance: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
  logInTransaction: vi.fn(),
};
const access = {
  requireProjectMember: vi.fn(),
  requireProjectRole: vi.fn(),
  requireProjectAction: vi.fn(),
};
const archiveChecks = {
  report: vi.fn(),
  startJob: vi.fn(),
  getJob: vi.fn(),
  assertReadyForArchive: vi.fn(),
};
const storage = {
  copyObjectToWorkingPaper: vi.fn(),
  putObject: vi.fn(),
};

describe(ProjectsService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.project.findMany.mockResolvedValue([]);
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => unknown) => {
        await Promise.resolve();
        return callback(prisma);
      }
    );
  });

  const publishedProjectTemplate = {
    id: "project-template-cas-audit",
    code: "CAS-AUDIT",
    name: "CAS audit template",
    language: "zh-CN",
    frameworkTemplateId: "framework-cas",
    status: "PUBLISHED",
    nodes: [
      {
        id: "template-node-a1-1000-01",
        code: "A1-1000-01",
        title: "Cash",
        level: 4,
        files: [
          {
            id: "template-file-cash",
            projectTemplateId: "project-template-cas-audit",
            templateNodeId: "template-node-a1-1000-01",
            code: "A1-1000-01-F001",
            title: "A4 - 1000 - 01 - F009 - Cash and bank.xlsx",
            fileName: "cash-template.xlsx",
            originalName: "Cash and bank.xlsx",
            fileUrl:
              "project-templates/project-template-cas-audit/template-file-cash/cash-template.xlsx",
            fileSize: 4096,
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            paperType: "WORKING_PAPER",
            sortOrder: 1,
            templateItemId: null,
          },
        ],
      },
    ],
  };

  function mockProjectTemplateApplyContext() {
    prisma.projectTemplate.findFirst.mockResolvedValue(
      publishedProjectTemplate
    );
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-a1-1000-01",
      code: "A1-1000-01",
      title: "Cash",
      level: 4,
      project: {
        id: "project-1",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
  }

  function mockSuccessfulProjectCreate(ownerId: string) {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId,
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId,
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue(null);
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
      name: "ABC Holdings 2026 audit",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "node-1" });
    access.requireProjectMember.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
  }

  it("lists visible projects where the user is an active project member", async () => {
    prisma.project.findMany.mockResolvedValue([]);
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      { createCollaborationMessage: prisma.inboxMessage.create } as never
    );

    await service.list({
      id: "staff-1",
      globalRole: "STAFF",
    } as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["ACTIVE", "PENDING_FINAL_CHECK", "ARCHIVED"] },
          members: {
            some: {
              userId: "staff-1",
              status: "ACTIVE",
            },
          },
        },
        include: expect.objectContaining({
          cmpClient: {
            select: expect.objectContaining({
              clientCode: true,
              nameEn: true,
              nameZh: true,
            }),
          },
          cmpEngagement: {
            select: expect.objectContaining({
              engagementCode: true,
              pic: true,
              reportDate: true,
            }),
          },
        }),
      })
    );
    const [listQuery] = prisma.project.findMany.mock.calls[0] ?? [];
    expect(listQuery?.include?.cmpClient?.select).not.toHaveProperty(
      "contacts"
    );
    expect(listQuery?.include?.cmpClient?.select).not.toHaveProperty(
      "addresses"
    );
  });

  it("loads live CMP client and engagement details only for one project", async () => {
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      desktopPlacements: [],
      members: [],
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.get("project-1", {
      id: "staff-1",
      globalRole: "STAFF",
    } as never);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "staff-1"
    );
    expect(prisma.project.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          cmpClient: {
            select: expect.objectContaining({
              addresses: expect.objectContaining({
                select: expect.objectContaining({ address: true, type: true }),
              }),
              companyNumber: true,
              contacts: expect.objectContaining({
                select: expect.objectContaining({ email: true, name: true }),
              }),
              group: expect.objectContaining({
                select: expect.objectContaining({ groupCode: true }),
              }),
              reportingGaap: true,
              updatedAt: true,
            }),
          },
          cmpEngagement: {
            select: expect.objectContaining({
              deliverables: true,
              engagementDate: true,
              eqReviewer: true,
              updatedAt: true,
            }),
          },
        }),
      })
    );
    const [detailQuery] = prisma.project.findFirstOrThrow.mock.calls[0] ?? [];
    expect(detailQuery?.include?.cmpEngagement?.select).not.toHaveProperty(
      "agreedFee"
    );
    expect(detailQuery?.include?.cmpEngagement?.select).not.toHaveProperty(
      "budgetedHours"
    );
    expect(detailQuery?.include?.cmpEngagement?.select).not.toHaveProperty(
      "amlRiskClassification"
    );
  });

  it("lets project partners submit projects for final archive review", async () => {
    access.requireProjectAction.mockResolvedValue({
      id: "member-1",
      projectRole: "PARTNER",
    });
    prisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026-AUD",
      name: "ABC Holdings 2026 audit",
      status: "PENDING_FINAL_CHECK",
    });
    access.requireProjectMember.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
      name: "ABC Holdings 2026 audit",
      status: "PENDING_FINAL_CHECK",
      placements: [{ workspaceId: "workspace-default" }],
      desktopPlacements: [],
      members: [],
    });
    const ProjectsServiceCtor = ProjectsService as unknown as new (
      ...args: unknown[]
    ) => ProjectsService;
    const service = new ProjectsServiceCtor(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      { createCollaborationMessage: prisma.inboxMessage.create } as never
    );

    await expect(
      service.submitArchive("project-1", {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never)
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "PENDING_FINAL_CHECK" })
    );

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "partner-1",
      "archiveProject"
    );
    expect(archiveChecks.assertReadyForArchive).toHaveBeenCalledWith(
      "project-1"
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "PENDING_FINAL_CHECK" },
      select: { id: true, projectCode: true, name: true },
    });
    expect(prisma.desktopProjectPlacement.deleteMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "partner-1",
        action: "PROJECT_SUBMITTED_FOR_ARCHIVE",
        projectId: "project-1",
      })
    );
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "admin-1",
        senderId: "partner-1",
        projectId: "project-1",
        type: "SYSTEM_NOTIFICATION",
      })
    );
  });

  it("lets super admins reopen pending final check projects", async () => {
    prisma.project.findFirstOrThrow
      .mockResolvedValueOnce({
        id: "project-1",
        projectCode: "ABC-2026-AUD",
        name: "ABC Holdings 2026 audit",
        status: "PENDING_FINAL_CHECK",
      })
      .mockResolvedValueOnce({
        id: "project-1",
        workspaceId: "workspace-default",
        projectCode: "ABC-2026-AUD",
        name: "ABC Holdings 2026 audit",
        status: "ACTIVE",
        placements: [{ workspaceId: "workspace-default" }],
        desktopPlacements: [],
        members: [],
      });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      status: "ACTIVE",
    });
    prisma.projectMember.findMany.mockResolvedValue([
      { userId: "partner-1" },
      { userId: "staff-1" },
    ]);

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      { createCollaborationMessage: prisma.inboxMessage.create } as never
    );

    await expect(
      service.reopen("project-1", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).resolves.toStrictEqual(expect.objectContaining({ status: "ACTIVE" }));

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "ACTIVE" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_REOPENED",
        actorId: "admin-1",
        projectId: "project-1",
      })
    );
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "partner-1",
        senderId: "admin-1",
        projectId: "project-1",
        type: "SYSTEM_NOTIFICATION",
        title: "Archive review returned for revision: ABC-2026-AUD",
        body: "ABC Holdings 2026 audit was returned from final archive review. The project is editable again.",
        actionUrl: "/engagement/project-1",
      })
    );
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "staff-1",
        senderId: "admin-1",
        projectId: "project-1",
        type: "SYSTEM_NOTIFICATION",
        title: "Archive review returned for revision: ABC-2026-AUD",
        body: "ABC Holdings 2026 audit was returned from final archive review. The project is editable again.",
        actionUrl: "/engagement/project-1",
      })
    );
  });

  it("lets super admins confirm archive and start the archive job", async () => {
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026-AUD",
      status: "PENDING_FINAL_CHECK",
    });
    archiveChecks.assertReadyForArchive.mockResolvedValue(undefined as never);
    const archiveJobs = {
      startJob: vi.fn().mockResolvedValue({
        jobId: "archive-job-1",
        projectId: "project-1",
        status: "queued",
      }),
      getJob: vi.fn(),
      latestArtifact: vi.fn(),
      downloadLatestArtifact: vi.fn(),
    };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      undefined,
      archiveJobs as never
    );

    await expect(
      service.confirmArchive("project-1", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        projectId: "project-1",
      })
    );

    expect(archiveChecks.assertReadyForArchive).not.toHaveBeenCalled();
    expect(archiveJobs.startJob).toHaveBeenCalledWith("project-1", {
      id: "admin-1",
      globalRole: "SUPER_ADMIN",
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_FINAL_ARCHIVE_CONFIRMED",
        projectId: "project-1",
      })
    );
  });

  it("soft deletes projects without running archive checks", async () => {
    access.requireProjectAction.mockResolvedValue({
      id: "member-1",
      projectRole: "PARTNER",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectCode: "AUD-2026-0001",
      status: "DELETED",
    });
    prisma.desktopProjectPlacement.deleteMany.mockResolvedValue({ count: 1 });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.deleteProject("project-1", {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never)
    ).resolves.toStrictEqual(expect.objectContaining({ status: "DELETED" }));

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "partner-1",
      "deleteProject"
    );
    expect(archiveChecks.assertReadyForArchive).not.toHaveBeenCalled();
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "DELETED" },
    });
    expect(prisma.desktopProjectPlacement.deleteMany).toHaveBeenCalledWith({
      where: { projectId: "project-1" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "partner-1",
        action: "PROJECT_DELETED",
        projectId: "project-1",
      })
    );
  });

  it("lists deleted projects for the project recycle bin", async () => {
    prisma.project.findMany.mockResolvedValue([]);
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.listDeleted({
      id: "partner-1",
      globalRole: "PARTNER",
    } as never);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "DELETED",
          members: {
            some: {
              userId: "partner-1",
              status: "ACTIVE",
            },
          },
        },
      })
    );
  });

  it("restores deleted projects from the project recycle bin", async () => {
    access.requireProjectAction.mockResolvedValue({
      id: "member-1",
      projectRole: "PARTNER",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectCode: "AUD-2026-0001",
      status: "ACTIVE",
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.restoreProject("project-1", {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never)
    ).resolves.toStrictEqual(expect.objectContaining({ status: "ACTIVE" }));

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "partner-1",
      "restoreProject"
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { status: "ACTIVE" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "partner-1",
        action: "PROJECT_RESTORED",
        projectId: "project-1",
      })
    );
  });

  it("starts archive check jobs through the archive check service", async () => {
    archiveChecks.startJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "queued",
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      service.startArchiveCheckJob("project-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "queued",
      })
    );

    expect(archiveChecks.startJob).toHaveBeenCalledWith("project-1", user);
  });

  it("returns archive check job snapshots through the archive check service", async () => {
    archiveChecks.getJob.mockResolvedValue({
      jobId: "archive-job-1",
      projectId: "project-1",
      status: "running",
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    const user = { id: "partner-1", globalRole: "PARTNER" } as never;

    await expect(
      service.archiveCheckJob("project-1", "archive-job-1", user)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        jobId: "archive-job-1",
        status: "running",
      })
    );

    expect(archiveChecks.getJob).toHaveBeenCalledWith(
      "project-1",
      "archive-job-1",
      user
    );
  });

  it("returns the current user's desktop folder with project details", async () => {
    access.requireProjectMember.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
      name: "TereC",
      placements: [{ workspaceId: "workspace-default" }],
      desktopPlacements: [
        {
          folder: {
            id: "folder-abc",
            ownerId: "staff-1",
            name: "ABC Group",
            sortOrder: 1,
            isDefault: false,
          },
        },
      ],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.get("project-1", {
        id: "staff-1",
        globalRole: "STAFF",
      } as never)
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "project-1",
        workspaceId: "workspace-default",
        desktopFolder: expect.objectContaining({
          id: "folder-abc",
          name: "ABC Group",
        }),
      })
    );
    expect(prisma.project.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          cmpClient: expect.objectContaining({
            select: expect.objectContaining({ nameZh: true }),
          }),
          cmpEngagement: expect.objectContaining({
            select: expect.objectContaining({ reportDate: true }),
          }),
          desktopPlacements: {
            where: { userId: "staff-1" },
            include: { folder: true },
          },
        }),
      })
    );
  });

  it("lets confirmation officers open visible projects from the global confirmation center", async () => {
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
      name: "ABC Holdings 2026 audit",
      desktopPlacements: [],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.get("project-1", {
        id: "confirmation-officer-1",
        globalRole: "CONFIRMATION_OFFICER",
      } as never)
    ).resolves.toStrictEqual(expect.objectContaining({ id: "project-1" }));
    expect(access.requireProjectMember).not.toHaveBeenCalled();
  });

  it("creates unlinked projects with a generated code and desktop placement", async () => {
    prisma.workspace.findFirst.mockResolvedValue(null);
    prisma.workspace.create.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue(null);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectNumber: 1_000_027,
      projectCode: "UNLINKED-PENDING-ABC123DEF456",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectNumber: 1_000_027,
      name: "ABC Holdings 2026 audit",
      projectCode: "EMP-1000027",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.projectWorkspacePlacement.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "node-1" });
    access.requireProjectMember.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "partner-1",
      }),
    });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "ABC Holdings 2026 audit",
        projectCode: expect.stringMatching(/^UNLINKED-PENDING-[A-F0-9]{12}$/),
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        workspaceId: "workspace-default",
        yearEndDate: new Date("2026-12-31"),
        reportDate: new Date("2027-03-31"),
        archiveDeadline: new Date("2027-06-29"),
      }),
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { projectCode: "EMP-1000027" },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 120_000,
    });
    expect(prisma.project.create.mock.calls[0][0].data).not.toHaveProperty(
      "companyName"
    );
    expect(prisma.project.create.mock.calls[0][0].data).not.toHaveProperty(
      "companyRegion"
    );
    expect(prisma.project.create.mock.calls[0][0].data).not.toHaveProperty(
      "listingStatus"
    );
    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          folderId: "desktop-default",
          projectId: "project-1",
          userId: "partner-1",
        }),
      })
    );
    expect(
      prisma.workflowNode.create.mock.calls.map(([call]) => call.data.code)
    ).toStrictEqual(["1000", "2000", "3000"]);
  });

  it("adds an independently selected active PIC to an unlinked project", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      projectNumber: 1_000_029,
      projectCode: "pending",
      name: "Independent audit",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectNumber: 1_000_029,
      projectCode: "EMP-1000029",
      name: "Independent audit",
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "pic-1",
      status: "ACTIVE",
      globalRole: "PRINCIPAL",
    });

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Independent audit",
        projectPicUserId: "  pic-1  ",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-1", globalRole: "STAFF" } as never
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "pic-1" },
      select: { id: true, status: true, globalRole: true },
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "pic-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      },
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { projectCode: "EMP-1000029" },
    });
  });

  it("rejects an inactive or non-leadership PIC for an unlinked project", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.user.findUnique.mockResolvedValue({
      id: "pic-1",
      status: "ACTIVE",
      globalRole: "MANAGER",
    });

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.create(
        {
          name: "Independent audit",
          projectPicUserId: "pic-1",
          language: "en-US",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "creator-1", globalRole: "STAFF" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
  });

  it("adds an independently selected active MIC to an unlinked project", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.user.findUnique.mockResolvedValue({
      id: "mic-1",
      status: "ACTIVE",
      globalRole: "MANAGER",
    });

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Independent audit",
        projectMicUserId: "  mic-1  ",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-1", globalRole: "STAFF" } as never
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "mic-1" },
      select: { id: true, status: true, globalRole: true },
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "mic-1",
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      },
    });
  });

  it("rejects an inactive or non-manager MIC for an unlinked project", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.user.findUnique.mockResolvedValue({
      id: "mic-1",
      status: "ACTIVE",
      globalRole: "PARTNER",
    });

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.create(
        {
          name: "Independent audit",
          projectMicUserId: "mic-1",
          language: "en-US",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "creator-1", globalRole: "STAFF" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
  });

  it("validates and persists every independently selected PIC and MIC", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.user.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        status: "ACTIVE",
        globalRole: where.id.startsWith("pic") ? "PARTNER" : "MANAGER",
      })
    );

    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Independent audit",
        projectPicUserIds: ["  pic-1  ", "pic-2"],
        projectMicUserIds: [" mic-1 ", "mic-2"],
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-1", globalRole: "STAFF" } as never
    );

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(4);
    for (const [userId, projectRole, inChargeRole] of [
      ["pic-1", "PARTNER", "PARTNER_IN_CHARGE"],
      ["pic-2", "PARTNER", "PARTNER_IN_CHARGE"],
      ["mic-1", "REVIEWER", "MANAGER_IN_CHARGE"],
      ["mic-2", "REVIEWER", "MANAGER_IN_CHARGE"],
    ]) {
      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId: "project-1",
          userId,
          projectRole,
          inChargeRole,
        },
      });
    }
  });

  it("rejects a duplicate archived project code without renumbering history", async () => {
    mockSuccessfulProjectCreate("partner-1");
    prisma.project.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique project code", {
        clientVersion: "test",
        code: "P2002",
      })
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    await expect(
      service.create(
        {
          name: "New audit",
          projectCode: "ARCHIVED-CODE",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "partner-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toThrow("项目代码已存在");
    expect(prisma.project.update).not.toHaveBeenCalled();
    expect(prisma.project.create).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({ projectCode: "ARCHIVED-CODE" }),
    });
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("adds the CMP engagement PIC and MIC when creating a project", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Client 2026 audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        projectMicUserId: "different-mic",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-1", globalRole: "STAFF" } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledTimes(3);
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "manager-1",
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      },
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "partner-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      },
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("uses the CMP PIC role once when the project creator is also the PIC", async () => {
    mockSuccessfulProjectCreate("partner-1");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Client 2026 audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledTimes(2);
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "partner-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      },
    });
  });

  it("keeps a different partner creator as a regular member when CMP defines the PIC", async () => {
    mockSuccessfulProjectCreate("creator-partner");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "Client 2026 audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-partner", globalRole: "PARTNER" } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "creator-partner",
        projectRole: "PARTNER",
      },
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "partner-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      },
    });
  });

  it("generates an independent code when a CMP-linked creation leaves it blank", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      projectNumber: 1_000_028,
      name: "New audit",
      projectCode: "pending",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectNumber: 1_000_028,
      name: "New audit",
      projectCode: "EMP-1000028",
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    await service.create(
      {
        name: "New audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        projectCode: "  ",
        language: "en-US",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      { id: "creator-1", globalRole: "STAFF" } as never
    );
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectCode: expect.stringMatching(/^UNLINKED-PENDING-/),
        cmpEngagementId: "engagement-1",
      }),
    });
    expect(prisma.project.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: "project-1" },
      data: { projectCode: "EMP-1000028" },
    });
    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "partner-1",
        inChargeRole: "PARTNER_IN_CHARGE",
      }),
    });
  });

  it("reports a duplicate manual code instead of silently adding an engagement suffix", async () => {
    mockSuccessfulProjectCreate("creator-1");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    await expect(
      service.create(
        {
          name: "New audit",
          projectCode: "MANUAL-2026",
          cmpClientId: "client-1",
          cmpEngagementId: "engagement-1",
          language: "en-US",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "creator-1", globalRole: "STAFF" } as never
      )
    ).rejects.toThrow("项目代码已存在");
    expect(prisma.project.create).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({ projectCode: "MANUAL-2026" }),
    });
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "preserves a trimmed user project code with CMP linked: %s",
    async (linked) => {
      mockSuccessfulProjectCreate("creator-1");
      prisma.cmpEngagement.findFirst.mockResolvedValue({
        id: "engagement-1",
        clientId: "client-1",
        engagementCode: "CMP-DIFFERENT",
        picUserId: "partner-1",
        micUserId: "manager-1",
        picUser: { status: "ACTIVE", globalRole: "PARTNER" },
        micUser: { status: "ACTIVE", globalRole: "MANAGER" },
      });
      const service = new ProjectsService(
        prisma as never,
        auditLogs as never,
        access as never,
        archiveChecks as never
      );
      await service.create(
        {
          name: "New audit",
          projectCode: "  USER-PROJECT-001  ",
          ...(linked
            ? { cmpClientId: "client-1", cmpEngagementId: "engagement-1" }
            : {}),
          language: "en-US",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "creator-1", globalRole: "STAFF" } as never
      );
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectCode: "USER-PROJECT-001",
          cmpEngagementId: linked ? "engagement-1" : null,
        }),
      });
      expect(prisma.project.update).not.toHaveBeenCalled();
    }
  );

  it("rejects CMP project creation when responsible users are missing", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "C001-2026-AUD",
      picUserId: null,
      micUserId: null,
      picUser: null,
      micUser: null,
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.create(
        {
          name: "Client 2026 audit",
          cmpClientId: "client-1",
          cmpEngagementId: "engagement-1",
          language: "en-US",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "partner-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("rolls forward archived projects with workflow, papers, files, versions, and members", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-2027",
      clientId: "client-1",
      engagementCode: "C001-2027-AUD",
      picUserId: "partner-2",
      micUserId: "manager-2",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue({
      id: "source-project",
      projectCode: "SRC-2026",
      name: "Source 2026 audit",
      status: "ARCHIVED",
      members: [
        {
          id: "member-source-partner",
          projectId: "source-project",
          userId: "partner-1",
          projectRole: "PARTNER",
          inChargeRole: null,
          status: "ACTIVE",
        },
        {
          id: "member-source-manager",
          projectId: "source-project",
          userId: "manager-1",
          projectRole: "REVIEWER",
          inChargeRole: "MANAGER",
          status: "ACTIVE",
        },
      ],
      workflowNodes: [
        {
          id: "source-node",
          projectId: "source-project",
          parentId: null,
          level: 1,
          code: "A",
          title: "Planning",
          nodeType: "PHASE",
          sortOrder: 1,
          createdBy: "partner-1",
        },
      ],
      workingPapers: [
        {
          id: "source-paper",
          projectId: "source-project",
          workflowNodeId: "source-node",
          code: "A1000",
          title: "Planning memo",
          paperType: "WORKING_PAPER",
          bucket: "CURRENT",
          templateItemId: null,
          createdBy: "partner-1",
        },
      ],
      attachments: [
        {
          id: "source-attachment",
          projectId: "source-project",
          workingPaperId: "source-paper",
          workflowNodeId: null,
          bucket: "CURRENT",
          code: "A1000",
          title: "Planning memo",
          templateItemId: null,
          fileKind: "SUPPORTING",
          fileName: "planning.docx",
          originalName: "planning.docx",
          fileUrl: "source/head.docx",
          fileSize: 128,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          version: 2,
          headVersionId: "source-version-2",
          workDate: new Date("2026-12-31"),
          deletedAt: null,
          versions: [
            {
              id: "source-version-1",
              attachmentId: "source-attachment",
              projectId: "source-project",
              version: 1,
              parentVersionId: null,
              sourceVersionId: null,
              fileKind: "SUPPORTING",
              fileName: "planning-v1.docx",
              originalName: "planning.docx",
              fileUrl: "source/v1.docx",
              fileSize: 100,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              workDate: new Date("2026-12-30"),
              uploadedBy: "partner-1",
              uploadedAt: new Date("2026-12-30T00:00:00.000Z"),
              archivedBy: "partner-1",
              action: "INITIAL",
              message: null,
              isCurrent: false,
              createdAt: new Date("2026-12-30T00:00:00.000Z"),
            },
            {
              id: "source-version-2",
              attachmentId: "source-attachment",
              projectId: "source-project",
              version: 2,
              parentVersionId: "source-version-1",
              sourceVersionId: null,
              fileKind: "SUPPORTING",
              fileName: "planning-v2.docx",
              originalName: "planning.docx",
              fileUrl: "source/v2.docx",
              fileSize: 128,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              workDate: new Date("2026-12-31"),
              uploadedBy: "manager-1",
              uploadedAt: new Date("2026-12-31T00:00:00.000Z"),
              archivedBy: "manager-1",
              action: "CHECK_IN",
              message: null,
              isCurrent: true,
              createdAt: new Date("2026-12-31T00:00:00.000Z"),
            },
          ],
          smartFormInstance: {
            id: "source-smart-form-instance",
            projectId: "source-project",
            attachmentId: "source-attachment",
            smartFormTemplateId: "smart-form-template-1",
            smartFormTemplateVersionId: "smart-form-template-version-1",
            schemaHash: "schema-hash",
            answerHash: "answer-hash",
            status: "COMPLETED",
            completedAt: new Date("2026-12-31T09:00:00.000Z"),
            lastSavedBy: "manager-1",
            lastSavedAt: new Date("2026-12-31T09:00:00.000Z"),
          },
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectCode: "TGT-2027",
      name: "Target 2027 audit",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "target-node" });
    prisma.workingPaper.create.mockResolvedValue({ id: "target-paper" });
    prisma.attachment.create.mockResolvedValue({ id: "target-attachment" });
    prisma.attachmentVersion.create
      .mockResolvedValueOnce({ id: "target-version-1" })
      .mockResolvedValueOnce({ id: "target-version-2" });
    prisma.attachment.update.mockResolvedValue({});
    prisma.smartFormInstance.create.mockResolvedValue({});
    storage.copyObjectToWorkingPaper
      .mockResolvedValueOnce({
        fileName: "planning-v2.docx",
        objectKey: "target/head.docx",
      })
      .mockResolvedValueOnce({
        fileName: "planning-v1.docx",
        objectKey: "target/v1.docx",
      });
    access.requireProjectMember.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectCode: "TGT-2027",
      members: [],
      desktopPlacements: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await service.create(
      {
        name: "Target 2027 audit",
        cmpClientId: "client-1",
        projectCode: "TGT-2027",
        cmpEngagementId: "engagement-2027",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        rollForwardFromProjectId: "source-project",
        inheritMembers: true,
        yearEndDate: "2027-12-31",
        reportDate: "2028-03-31",
        archiveDeadline: "2028-06-29",
      },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectCode: "TGT-2027",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-2027",
        rolledForwardFromProjectId: "source-project",
      }),
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        userId: "partner-2",
        projectRole: "PARTNER",
      }),
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        userId: "manager-2",
        projectRole: "REVIEWER",
      }),
    });
    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        userId: "manager-1",
        projectRole: "REVIEWER",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        code: "A",
      }),
    });
    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        workflowNodeId: "target-node",
        code: "A1000",
        bucket: "PRIOR",
      }),
    });
    expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledTimes(2);
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bucket: "PRIOR",
        fileName: "planning-v2.docx",
        fileUrl: "target/head.docx",
      }),
    });
    expect(prisma.attachmentVersion.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        fileName: "planning-v1.docx",
        fileUrl: "target/v1.docx",
      }),
    });
    expect(prisma.attachmentVersion.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        fileName: "planning-v2.docx",
        fileUrl: "target/head.docx",
      }),
    });
    expect(prisma.attachmentVersion.create).toHaveBeenCalledTimes(2);
    expect(prisma.attachment.update).toHaveBeenCalledWith({
      where: { id: "target-attachment" },
      data: { headVersionId: "target-version-2" },
    });
    expect(prisma.smartFormInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        attachmentId: "target-attachment",
        smartFormTemplateId: "smart-form-template-1",
        smartFormTemplateVersionId: "smart-form-template-version-1",
        schemaHash: "schema-hash",
        answerHash: "answer-hash",
        status: "COMPLETED",
      }),
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_ROLLED_FORWARD",
        projectId: "target-project",
      })
    );
  });

  it("generates a code for unlinked roll forward without inheriting members", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.project.findFirst.mockResolvedValue({
      id: "source-project",
      workspaceId: "workspace-default",
      status: "ARCHIVED",
      members: [
        {
          id: "source-owner-member",
          userId: "partner-1",
          projectRole: "PARTNER",
          status: "ACTIVE",
        },
        {
          id: "source-reviewer-member",
          userId: "manager-1",
          projectRole: "REVIEWER",
          status: "ACTIVE",
        },
      ],
      workflowNodes: [],
      workingPapers: [],
      attachments: [],
    });
    prisma.project.create.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectNumber: 1_000_031,
      projectCode: "UNLINKED-PENDING-ABC123DEF456",
      name: "Target 2027 audit",
    });
    prisma.project.update.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectNumber: 1_000_031,
      projectCode: "EMP-1000031",
      name: "Target 2027 audit",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectCode: "EMP-1000031",
      members: [],
      desktopPlacements: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await service.create(
      {
        name: "Target 2027 audit",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        rollForwardFromProjectId: "source-project",
        inheritMembers: false,
        yearEndDate: "2027-12-31",
        reportDate: "2028-03-31",
        archiveDeadline: "2028-06-29",
      },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledExactlyOnceWith({
      data: expect.objectContaining({
        projectId: "target-project",
        userId: "partner-1",
        projectRole: "PARTNER",
      }),
    });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Target 2027 audit",
        projectCode: expect.stringMatching(/^UNLINKED-PENDING-[A-F0-9]{12}$/),
        rolledForwardFromProjectId: "source-project",
      }),
    });
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "target-project" },
      data: { projectCode: "EMP-1000031" },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 120_000,
    });
  });

  it("rolls back roll forward creation when copying a source file fails", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.project.findFirst.mockResolvedValue({
      id: "source-project",
      workspaceId: "workspace-default",
      status: "ARCHIVED",
      members: [],
      workflowNodes: [
        {
          id: "source-node",
          code: "A",
          title: "Planning",
          level: 1,
          parentId: null,
          sortOrder: 0,
          templateItemId: null,
        },
      ],
      workingPapers: [],
      attachments: [
        {
          id: "source-attachment",
          projectId: "source-project",
          workingPaperId: null,
          workflowNodeId: "source-node",
          bucket: "CURRENT",
          code: "A1000",
          title: "Planning memo",
          templateItemId: null,
          fileKind: "SUPPORTING",
          fileName: "planning.docx",
          originalName: "planning.docx",
          fileUrl: "source/head.docx",
          fileSize: 128,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          version: 1,
          headVersionId: null,
          workDate: null,
          deletedAt: null,
          versions: [],
          smartFormInstance: null,
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "target-project",
      workspaceId: "workspace-default",
      projectCode: "TGT-2027",
      name: "Target 2027 audit",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "target-node" });
    storage.copyObjectToWorkingPaper.mockRejectedValue(
      new Error("copy failed")
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await expect(
      service.create(
        {
          name: "Target 2027 audit",
          projectCode: "TGT-2027",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          rollForwardFromProjectId: "source-project",
          yearEndDate: "2027-12-31",
          reportDate: "2028-03-31",
          archiveDeadline: "2028-06-29",
        },
        { id: "partner-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toThrow("copy failed");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROJECT_ROLLED_FORWARD" })
    );
    expect(prisma.project.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it("rejects roll forward from non-archived or inaccessible projects", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.create(
        {
          name: "Target 2027 audit",
          projectCode: "TGT-2027",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          rollForwardFromProjectId: "active-project",
          inheritMembers: true,
          yearEndDate: "2027-12-31",
          reportDate: "2028-03-31",
          archiveDeadline: "2028-06-29",
        },
        { id: "partner-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toThrow(
      "Only accessible archived projects can be rolled forward"
    );
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("reconciles pending TMS submissions after linking an EMP project", async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: "project-a",
      projectCode: "EMP-A",
      cmpEngagementId: null,
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
    });
    prisma.project.update.mockResolvedValue({});
    const tmsTimesheets = {
      reconcileProjectLink: vi.fn().mockResolvedValue(undefined as never),
    };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      undefined,
      undefined,
      tmsTimesheets as never
    );
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await service.linkEngagement(
      "project-a",
      { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
      { id: "staff-1", globalRole: "STAFF" } as never
    );

    expect(tmsTimesheets.reconcileProjectLink).toHaveBeenCalledWith(
      "project-a",
      "engagement-a"
    );
  });

  it("synchronizes the CMP PIC and MIC into the linked EMP project team", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "partner-1", globalRole: "PARTNER", status: "ACTIVE" },
      { id: "manager-1", globalRole: "MANAGER", status: "ACTIVE" },
    ]);
    prisma.projectMember.findUnique.mockResolvedValue({
      status: "ACTIVE",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
    });
    prisma.project.findFirst.mockResolvedValueOnce({
      id: "project-a",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.update.mockResolvedValue({});
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await service.linkEngagement(
      "project-a",
      { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(prisma.projectMember.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-a",
        inChargeRole: "PARTNER_IN_CHARGE",
        userId: { not: "partner-1" },
      },
      data: { inChargeRole: null },
    });
    expect(prisma.projectMember.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-a",
        inChargeRole: "MANAGER_IN_CHARGE",
        userId: { not: "manager-1" },
      },
      data: { inChargeRole: null },
    });
    expect(prisma.projectMember.upsert).toHaveBeenCalledWith({
      where: {
        projectId_userId: {
          projectId: "project-a",
          userId: "partner-1",
        },
      },
      update: {
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
        authorizationSuspendedAt: null,
        status: "ACTIVE",
      },
      create: {
        projectId: "project-a",
        userId: "partner-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
        status: "ACTIVE",
      },
    });
    expect(prisma.projectMember.upsert).toHaveBeenCalledWith({
      where: {
        projectId_userId: {
          projectId: "project-a",
          userId: "manager-1",
        },
      },
      update: {
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
        authorizationSuspendedAt: null,
        status: "ACTIVE",
      },
      create: {
        projectId: "project-a",
        userId: "manager-1",
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
        status: "ACTIVE",
      },
    });
  });

  it.each(["MANAGER", "SUPER_ADMIN"])(
    "does not let %s reset leadership through CMP linking",
    async (globalRole) => {
      prisma.project.findFirst.mockResolvedValue({
        id: "p",
        projectCode: "EMP",
        cmpEngagementId: null,
      });
      prisma.cmpEngagement.findFirst.mockResolvedValue({
        id: "e",
        clientId: "c",
        engagementCode: "CMP",
        picUserId: "pic",
        micUserId: "mic",
        picUser: { status: "ACTIVE", globalRole: "PARTNER" },
        micUser: { status: "ACTIVE", globalRole: "MANAGER" },
      });
      prisma.projectMember.findUnique.mockResolvedValue({
        status: "ACTIVE",
        projectRole: "REVIEWER",
        inChargeRole: null,
        user: { globalRole, status: "ACTIVE" },
      });
      const service = new ProjectsService(
        prisma as never,
        auditLogs as never,
        access as never,
        archiveChecks as never
      );
      await expect(
        service.linkEngagement(
          "p",
          { cmpClientId: "c", cmpEngagementId: "e" },
          { id: "caller", globalRole } as never
        )
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      });
      expect(prisma.projectMember.upsert).not.toHaveBeenCalled();
      expect(auditLogs.logInTransaction).not.toHaveBeenCalled();
    }
  );

  it("preserves the existing project code when linking an engagement", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-a",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
    });
    prisma.project.findMany.mockResolvedValue([
      { projectCode: "A-2026-AUD" },
      { projectCode: "A-2026-AUD-2" },
    ]);
    prisma.project.update.mockResolvedValue({});
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await service.linkEngagement(
      "project-a",
      { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
      { id: "staff-1", globalRole: "STAFF" } as never
    );

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-a" },
      data: {
        cmpClientId: "client-a",
        cmpEngagementId: "engagement-a",
      },
    });
    expect(auditLogs.logInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        action: "PROJECT_ENGAGEMENT_LINKED",
        description:
          "项目 DUMMY-EMP-1000027 绑定 Engagement Code A-2026-AUD，保留项目编号",
      })
    );
  });

  it("retries a concurrent link conflict without changing the project code", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-a",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
    });
    prisma.project.findMany
      .mockResolvedValueOnce([{ projectCode: "A-2026-AUD" }])
      .mockResolvedValueOnce([
        { projectCode: "A-2026-AUD" },
        { projectCode: "A-2026-AUD-2" },
      ]);
    prisma.project.update
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Unique conflict", {
          clientVersion: "test",
          code: "P2002",
        })
      )
      .mockResolvedValueOnce({});
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await service.linkEngagement(
      "project-a",
      { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
      { id: "staff-1", globalRole: "STAFF" } as never
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.project.update).toHaveBeenLastCalledWith({
      where: { id: "project-a" },
      data: {
        cmpClientId: "client-a",
        cmpEngagementId: "engagement-a",
      },
    });
  });

  it("keeps a successful CMP link when follow-up TMS reconciliation fails", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-a",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.update.mockResolvedValue({});
    const tmsTimesheets = {
      reconcileProjectLink: vi.fn().mockRejectedValue(new Error("TMS down")),
    };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      undefined,
      undefined,
      tmsTimesheets as never
    );
    vi.spyOn(service, "get").mockResolvedValue({ id: "project-a" } as never);
    (service as unknown as { logger: { error: () => void } }).logger = {
      error: vi.fn(),
    };

    await expect(
      service.linkEngagement(
        "project-a",
        { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
        { id: "staff-1", globalRole: "STAFF" } as never
      )
    ).resolves.toStrictEqual({ id: "project-a" });
  });

  it("does not start TMS reconciliation when the transactional audit log fails", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-a",
      projectCode: "DUMMY-EMP-1000027",
      cmpEngagementId: null,
    });
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-a",
      clientId: "client-a",
      engagementCode: "A-2026-AUD",
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.update.mockResolvedValue({});
    auditLogs.logInTransaction.mockRejectedValueOnce(
      new Error("audit unavailable")
    );
    const tmsTimesheets = { reconcileProjectLink: vi.fn() };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      undefined,
      undefined,
      tmsTimesheets as never
    );

    await expect(
      service.linkEngagement(
        "project-a",
        { cmpClientId: "client-a", cmpEngagementId: "engagement-a" },
        { id: "staff-1", globalRole: "STAFF" } as never
      )
    ).rejects.toThrow("audit unavailable");
    expect(tmsTimesheets.reconcileProjectLink).not.toHaveBeenCalled();
  });

  it("preserves the project code and refreshes TMS rows when unlinking CMP", async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: "project-a",
      projectNumber: 1_000_027,
      projectCode: "A-2026-AUD",
      cmpEngagementId: "engagement-a",
    });
    prisma.project.update.mockResolvedValue({});
    const tmsTimesheets = {
      refreshProjectLink: vi.fn().mockResolvedValue(undefined as never),
    };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      undefined,
      undefined,
      tmsTimesheets as never
    );
    vi.spyOn(service, "get").mockResolvedValue({} as never);

    await service.unlinkEngagement("project-a", {
      id: "staff-1",
      globalRole: "STAFF",
    } as never);

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-a" },
      data: {
        cmpClientId: null,
        cmpEngagementId: null,
      },
    });
    expect(tmsTimesheets.refreshProjectLink).toHaveBeenCalledWith("project-a");
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_ENGAGEMENT_UNLINKED",
        projectId: "project-a",
      })
    );
  });

  it("creates initial invitations and inbox messages during project creation", async () => {
    mockSuccessfulProjectCreate("partner-1");
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-staff-2",
        email: "sam.lu@projectwing.local",
        name: "Sam Lu",
        globalRole: "STAFF",
        status: "ACTIVE",
        preferredLocale: "en-US",
      },
    ]);
    prisma.projectInvitation.create.mockResolvedValue({
      id: "invitation-1",
      projectId: "project-1",
      recipientEmail: "sam.lu@projectwing.local",
      invitedRole: "PREPARER",
    });
    prisma.inboxMessage.create.mockResolvedValue({});
    const inbox = {
      deliverMessageEmail: vi.fn().mockResolvedValue({ skipped: false }),
    };
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      inbox as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
        invitations: [
          {
            recipientUserId: "user-staff-2",
            invitedRole: "PREPARER",
            expiresInDays: 7,
          },
        ],
      } as never,
      {
        id: "partner-1",
        name: "Partner",
        email: "partner@projectwing.local",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["user-staff-2"] },
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        status: true,
        preferredLocale: true,
      },
    });
    expect(prisma.projectInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        recipientEmail: "sam.lu@projectwing.local",
        invitedRole: "PREPARER",
        invitedBy: "partner-1",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientId: "user-staff-2",
        senderId: "partner-1",
        projectInvitationId: "invitation-1",
        projectId: "project-1",
        type: "PROJECT_INVITATION",
        contentKey: "PROJECT_INVITATION",
        contentParams: {
          actor: "Partner",
          projectCode: "ABC-2026-AUD",
          projectName: "ABC Holdings 2026 audit",
          role: "PREPARER",
        },
        actionUrl: expect.stringMatching(/^\/invitations\//),
      }),
    });
    expect(inbox.deliverMessageEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        recipientId: "user-staff-2",
        recipientEmail: "sam.lu@projectwing.local",
        preferredLocale: "en-US",
        contentKey: "PROJECT_INVITATION",
      })
    );
    // Invitations and their Inbox messages are now written through the same
    // Project transaction. The project-created audit record remains separate.
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CREATED",
        projectId: "project-1",
      })
    );
  });

  it("initializes workflow nodes and current files from a project template", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
      code: "CAS",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "project-template-cas-audit",
      code: "CAS-AUDIT",
      language: "en-US",
      frameworkTemplateId: "framework-ifrs",
      nodes: [
        {
          id: "template-node-planning",
          parentId: null,
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          files: [],
        },
        {
          id: "template-node-a1",
          parentId: "template-node-planning",
          code: "A1",
          title: "A1",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          files: [],
        },
        {
          id: "template-node-a1-1000",
          parentId: "template-node-a1",
          code: "A1-1000",
          title: "A1 - 1000 - Revenue",
          level: 3,
          nodeType: "WORKING_PAPER",
          sortOrder: 1,
          files: [],
        },
        {
          id: "template-node-a1-1000-01",
          parentId: "template-node-a1-1000",
          code: "A1-1000-01",
          title: "Bank reconciliation",
          level: 4,
          nodeType: "WORKING_PAPER",
          sortOrder: 1,
          files: [
            {
              id: "template-file-cash",
              code: "A1-1000-01-F001",
              title: "A4 - 1000 - 01 - F009 - Cash and bank.xlsx",
              fileName: "cash-template.xlsx",
              originalName: "Cash and bank.xlsx",
              fileUrl:
                "project-templates/project-template-cas-audit/template-file-cash/cash-template.xlsx",
              fileSize: 4096,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              paperType: "WORKING_PAPER",
              sortOrder: 1,
              templateItemId: null,
            },
          ],
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    const createdNodeIdsByCode: Record<string, string> = {
      "1000": "node-planning",
      "1100": "node-a1",
      "1110": "node-a1-1000",
      "1111": "node-a1-1000-01",
    };
    prisma.workflowNode.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: createdNodeIdsByCode[data.code] })
    );
    prisma.workingPaper.create.mockResolvedValue({ id: "paper-cash" });
    storage.copyObjectToWorkingPaper.mockResolvedValue({
      fileName: "copied-cash-template.xlsx",
      objectKey:
        "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-cash",
      version: 1,
      headVersionId: null,
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "attachment-version-cash",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-cash",
      projectId: "project-1",
      workingPaperId: "paper-cash",
      fileKind: "SUPPORTING",
      fileName: "copied-cash-template.xlsx",
      originalName: "Cash and bank.xlsx",
      fileUrl: "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
      fileSize: 4096,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 1,
      headVersionId: "attachment-version-cash",
    });
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const ProjectsServiceCtor = ProjectsService as unknown as new (
      ...args: unknown[]
    ) => ProjectsService;
    const service = new ProjectsServiceCtor(
      prisma,
      auditLogs,
      access,
      archiveChecks,
      undefined,
      storage
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        projectTemplateId: "project-template-cas-audit",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      } as never,
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.projectTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "project-template-cas-audit",
          status: "PUBLISHED",
        }),
      })
    );
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: null,
        code: "1000",
        title: "Planning",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: "node-planning",
        code: "1100",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: "node-a1",
        code: "1110",
        title: "Revenue",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: "node-a1-1000",
        code: "1111",
        level: 4,
      }),
    });
    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workflowNodeId: "node-a1-1000-01",
        code: "1111.1",
        title: "Cash and bank.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy: "partner-1",
      }),
    });
    expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledWith(
      "project-1",
      "paper-cash",
      "Cash and bank.xlsx",
      "project-templates/project-template-cas-audit/template-file-cash/cash-template.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workingPaperId: "paper-cash",
        fileKind: "SUPPORTING",
        fileName: "copied-cash-template.xlsx",
        originalName: "Cash and bank.xlsx",
        fileUrl:
          "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
        fileSize: 4096,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedBy: "partner-1",
        lastModifiedBy: "partner-1",
      }),
      include: expect.any(Object),
    });
    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-cash",
        projectId: "project-1",
        version: 1,
        fileKind: "SUPPORTING",
        fileName: "copied-cash-template.xlsx",
        originalName: "Cash and bank.xlsx",
        fileUrl:
          "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
        fileSize: 4096,
        uploadedBy: "partner-1",
        archivedBy: "partner-1",
        action: "INITIAL",
        isCurrent: true,
      }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith({
      where: { id: "attachment-cash" },
      data: { headVersionId: "attachment-version-cash" },
      include: expect.any(Object),
    });
  });

  it("returns an actionable error when project template content cannot be initialized", async () => {
    mockSuccessfulProjectCreate("partner-1");
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-missing-source",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue(
      publishedProjectTemplate
    );
    storage.copyObjectToWorkingPaper.mockRejectedValue(
      new Error("NoSuchKey: project template source object is missing")
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await expect(
      service.create(
        {
          name: "Template project",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          projectTemplateId: publishedProjectTemplate.id,
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        { id: "partner-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PROJECT_TEMPLATE_INITIALIZATION_FAILED",
        message: expect.stringContaining("verify its files"),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 120_000,
    });
    expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledOnce();
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROJECT_CREATED" })
    );
  });

  it("restores SME root titles when creating a project from a code-only template", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
      code: "CAS",
    });
    const rootCodes = ["A", "B", "C", "D", "E", "F", "G"];
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "project-template-sme",
      code: "SME",
      language: "en-US",
      frameworkTemplateId: "framework-cas",
      nodes: [
        ...rootCodes.map((code, index) => ({
          id: `template-node-${code}`,
          parentId: null,
          code,
          title: code,
          level: 1,
          nodeType: "PHASE",
          sortOrder: index + 1,
          files: [],
        })),
        ...rootCodes.map((code) => ({
          id: `template-node-${code}1`,
          parentId: `template-node-${code}`,
          code: `${code}1`,
          title: code === "C" ? "C - Cash and cash equivalents" : `${code}1`,
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          files: [],
        })),
        {
          id: "template-node-c1-leaf",
          parentId: "template-node-C1",
          code: "C1-01",
          title: "C1-01",
          level: 3,
          nodeType: "WORKING_PAPER",
          sortOrder: 1,
          files: [],
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `created-${data.code}` })
    );
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      storage as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        projectTemplateId: "project-template-sme",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      } as never,
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(
      prisma.workflowNode.create.mock.calls
        .filter(([call]) => call.data.parentId === null)
        .map(([call]) => `${call.data.code} - ${call.data.title}`)
    ).toStrictEqual([
      "1000 - Planning",
      "2000 - General Procedures",
      "3000 - Execution",
      "4000 - Reporting",
      "5000 - Completion",
      "6000 - Continued Connected Transactions (CCT)",
      "7000 - Other Audit Programmes",
    ]);
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "created-3000",
        code: "3100",
        title: "Cash and cash equivalents",
      }),
    });
  });

  it("imports the live SME template folder names when the zip stored names as root codes", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
      code: "CAS",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "project-template-sme",
      code: "AUD_TEMPLATE1",
      language: "zh-CN",
      frameworkTemplateId: "framework-hkfrs",
      nodes: [
        {
          id: "template-node-planning",
          parentId: null,
          code: "Planning",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          files: [],
        },
        {
          id: "template-node-general",
          parentId: null,
          code: "General Procedures",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 2,
          files: [],
        },
        {
          id: "template-node-execution",
          parentId: null,
          code: "Execution",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 3,
          files: [],
        },
        {
          id: "template-node-reporting",
          parentId: null,
          code: "Reporting",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 4,
          files: [],
        },
        {
          id: "template-node-completion",
          parentId: null,
          code: "Completion",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 5,
          files: [],
        },
        {
          id: "template-node-cct",
          parentId: null,
          code: "Continued Connected Transactions (CCT)",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 6,
          files: [],
        },
        {
          id: "template-node-other",
          parentId: null,
          code: "Other Audit Programmes",
          title: "新阶段",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 7,
          files: [],
        },
        {
          id: "template-node-a1",
          parentId: "template-node-planning",
          code: "A1 - Client acceptance or continuance",
          title: "A1",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          files: [],
        },
        {
          id: "template-node-a2",
          parentId: "template-node-planning",
          code: "A2 - Engagement letter",
          title: "A2",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 2,
          files: [],
        },
        {
          id: "template-node-a3",
          parentId: "template-node-planning",
          code: "A3 - Understanding the entity and its environment",
          title: "A3",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 3,
          files: [],
        },
        {
          id: "template-node-a5",
          parentId: "template-node-planning",
          code: "A5 - Planning materiality",
          title: "A5",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 4,
          files: [],
        },
        {
          id: "template-node-a6",
          parentId: "template-node-planning",
          code: "A6 - Audit planning programme",
          title: "A6",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 5,
          files: [],
        },
        {
          id: "template-node-c1",
          parentId: "template-node-execution",
          code: "C-Cash and cash equivalents",
          title: "C-Cash and cash equivalents",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          files: [],
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `created-${data.code}` })
    );
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      storage as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
        projectTemplateId: "project-template-sme",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      } as never,
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(
      prisma.workflowNode.create.mock.calls
        .filter(([call]) => call.data.parentId === null)
        .map(([call]) => `${call.data.code} - ${call.data.title}`)
    ).toStrictEqual([
      "1000 - Planning",
      "2000 - General Procedures",
      "3000 - Execution",
      "4000 - Reporting",
      "5000 - Completion",
      "6000 - Continued Connected Transactions (CCT)",
      "7000 - Other Audit Programmes",
    ]);
    expect(
      prisma.workflowNode.create.mock.calls
        .filter(([call]) => call.data.parentId === "created-1000")
        .map(([call]) => `${call.data.code} - ${call.data.title}`)
    ).toStrictEqual([
      "1100 - Client acceptance or continuance",
      "1200 - Engagement letter",
      "1300 - Understanding the entity and its environment",
      "1400 - Planning materiality",
      "1500 - Audit planning programme",
    ]);
    expect(prisma.workflowNode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "created-3000",
        code: "3100",
        title: "Cash and cash equivalents",
      }),
    });
  });

  it("creates mixed template files, placeholders and Smart Forms with the project language", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "desktop-default",
      ownerId: "partner-1",
      isDefault: true,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-cas",
      code: "CAS",
    });
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "project-template-smart-form",
      code: "SF-TEMPLATE",
      name: "Smart Form template",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      status: "PUBLISHED",
      nodes: [
        {
          id: "template-node-a1-1000",
          code: "A1-1000",
          title: "A1-1000",
          level: 3,
          nodeType: "FOLDER",
          parentId: null,
          sortOrder: 1,
          files: [
            {
              id: "template-file-1",
              projectTemplateId: "project-template-smart-form",
              templateNodeId: "template-node-a1-1000",
              code: "A1-1000-F001",
              title: "Risk support.xlsx",
              fileName: "risk-support.xlsx",
              originalName: "Risk support.xlsx",
              fileUrl: "project-templates/risk-support.xlsx",
              fileSize: 256,
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              paperType: "WORKING_PAPER",
              sortOrder: 1,
              templateItemId: null,
            },
            {
              id: "template-placeholder-1",
              projectTemplateId: "project-template-smart-form",
              templateNodeId: "template-node-a1-1000",
              code: "A1-1000-F003",
              title: "Evidence to obtain",
              fileName: "Evidence to obtain",
              originalName: "Evidence to obtain",
              fileUrl: "",
              fileSize: 0,
              mimeType: "application/octet-stream",
              placeholderType: "GENERIC",
              paperType: "WORKING_PAPER",
              sortOrder: 3,
              templateItemId: "source-library-item",
            },
          ],
          smartForms: [
            {
              id: "template-smart-form-1",
              projectTemplateId: "project-template-smart-form",
              templateNodeId: "template-node-a1-1000",
              smartFormTemplateId: "smart-form-template-1",
              smartFormTemplateVersionId: "smart-form-version-1",
              code: "A1-1000-F001",
              title: "Risk assessment",
              fileName: "Risk assessment.sf",
              sortOrder: 2,
              smartFormTemplate: {
                id: "smart-form-template-1",
                code: "SF-RISK",
                name: "Risk assessment",
              },
              smartFormTemplateVersion: {
                id: "smart-form-version-1",
                templateId: "smart-form-template-1",
                version: 1,
                publishedAt: new Date("2026-06-01T00:00:00.000Z"),
                definitionJson: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
                template: {
                  id: "smart-form-template-1",
                  code: "SF-RISK",
                  name: "Risk assessment",
                },
              },
            },
          ],
        },
      ],
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "node-a1-1000" });
    prisma.workingPaper.create
      .mockResolvedValueOnce({
        id: "paper-file",
        code: "1000.1",
      })
      .mockResolvedValueOnce({
        id: "paper-smart-form",
        code: "1000.2",
      })
      .mockResolvedValueOnce({
        id: "paper-placeholder",
        code: "1000.3",
      });
    storage.copyObjectToWorkingPaper.mockResolvedValue({
      fileName: "risk-support.xlsx",
      objectKey: "working-papers/project-1/paper-file/risk-support.xlsx",
    });
    storage.putObject.mockResolvedValue({
      fileName: "Risk assessment.sf",
      objectKey: "working-papers/project-1/paper-smart-form/Risk assessment.sf",
    });
    prisma.attachment.create
      .mockResolvedValueOnce({
        id: "attachment-file",
        headVersionId: null,
      })
      .mockResolvedValueOnce({
        id: "attachment-smart-form",
        headVersionId: null,
      })
      .mockResolvedValueOnce({
        id: "attachment-placeholder",
        headVersionId: null,
      });
    prisma.attachmentVersion.create
      .mockResolvedValueOnce({
        id: "attachment-version-file",
      })
      .mockResolvedValueOnce({
        id: "attachment-version-smart-form",
      });
    prisma.attachment.update
      .mockResolvedValueOnce({ id: "attachment-file" })
      .mockResolvedValueOnce({ id: "attachment-smart-form" });
    prisma.smartFormInstance.create.mockResolvedValue({
      id: "smart-form-instance-1",
    });
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "en-US",
        frameworkTemplateId: "framework-cas",
        projectTemplateId: "project-template-smart-form",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      } as never,
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    const storedPackage = JSON.parse(
      (storage.putObject.mock.calls[0][3] as Buffer).toString("utf-8")
    );
    expect(storedPackage.template.language).toBe("en-US");
    expect(prisma.projectTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "project-template-smart-form", status: "PUBLISHED" },
      })
    );
    expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledOnce();
    expect(prisma.attachmentVersion.create).toHaveBeenCalledTimes(2);
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workingPaperId: "paper-placeholder",
        placeholderType: "GENERIC",
        fileUrl: "",
        fileSize: 0,
        templateItemId: "source-library-item",
      }),
      include: expect.any(Object),
    });
    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "1000.3", templateItemId: null }),
    });
    expect(storage.putObject).toHaveBeenCalledWith(
      "project-1",
      "paper-smart-form",
      "Risk assessment.sf",
      expect.any(Buffer),
      "application/vnd.project-wing.smart-form+json"
    );
    expect(prisma.workingPaper.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ code: "1000.1" }),
      })
    );
    expect(prisma.workingPaper.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ code: "1000.2" }),
      })
    );
    expect(prisma.smartFormInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        attachmentId: "attachment-smart-form",
        smartFormTemplateId: "smart-form-template-1",
        smartFormTemplateVersionId: "smart-form-version-1",
        status: "INCOMPLETE",
        lastSavedBy: "partner-1",
      }),
    });
  });

  it("previews applying project template files into the current workpaper folder", async () => {
    mockProjectTemplateApplyContext();
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );
    const preview = await service.previewApplyProjectTemplate(
      "project-1",
      "project-template-cas-audit",
      {
        workflowNodeId: "node-a1-1000-01",
        bucket: "CURRENT",
        selectedTemplateFileIds: ["template-file-cash"],
      },
      { id: "preparer-1", globalRole: "STAFF" } as never
    );

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "preparer-1",
      "PREPARER"
    );
    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "preparer-1",
      "useLibrary"
    );
    expect(preview.plan.summary).toStrictEqual({
      total: 1,
      create: 1,
      existing: 0,
    });
    expect(preview.plan.items[0]).toStrictEqual(
      expect.objectContaining({
        templateFileId: "template-file-cash",
        title: "Cash and bank.xlsx",
        plannedCode: "A1-1000-01-F001",
        status: "CREATE",
      })
    );
  });

  it("requires library permission before applying project templates", async () => {
    access.requireProjectAction.mockRejectedValue(
      new Error("library permission denied")
    );
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );

    await expect(
      service.applyProjectTemplate(
        "project-1",
        "project-template-cas-audit",
        {
          workflowNodeId: "node-a1-1000-01",
          bucket: "CURRENT",
          selectedTemplateFileIds: ["template-file-cash"],
        },
        { id: "eqcr-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toThrow("library permission denied");

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "eqcr-1",
      "useLibrary"
    );
    expect(access.requireProjectRole).not.toHaveBeenCalled();
    expect(prisma.projectTemplate.findFirst).not.toHaveBeenCalled();
  });

  it("applies selected project template files and copies their attachments", async () => {
    mockProjectTemplateApplyContext();
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-cash",
      projectId: "project-1",
      workflowNodeId: "node-a1-1000-01",
      code: "A1-1000-01-F001",
      title: "Cash and bank.xlsx",
      paperType: "WORKING_PAPER",
      bucket: "CURRENT",
      templateItemId: null,
    });
    storage.copyObjectToWorkingPaper.mockResolvedValue({
      fileName: "copied-cash-template.xlsx",
      objectKey:
        "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-cash",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "attachment-version-cash",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-cash",
      projectId: "project-1",
      workingPaperId: "paper-cash",
      fileKind: "SUPPORTING",
      fileName: "copied-cash-template.xlsx",
      originalName: "Cash and bank.xlsx",
      fileUrl: "working-papers/project-1/paper-cash/copied-cash-template.xlsx",
      fileSize: 4096,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 1,
      headVersionId: "attachment-version-cash",
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );
    const result = await service.applyProjectTemplate(
      "project-1",
      "project-template-cas-audit",
      {
        workflowNodeId: "node-a1-1000-01",
        bucket: "CURRENT",
        selectedTemplateFileIds: ["template-file-cash"],
      },
      { id: "preparer-1", globalRole: "STAFF" } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workflowNodeId: "node-a1-1000-01",
        code: "A1-1000-01-F001",
        title: "Cash and bank.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy: "preparer-1",
      }),
    });
    expect(storage.copyObjectToWorkingPaper).toHaveBeenCalledWith(
      "project-1",
      "paper-cash",
      "Cash and bank.xlsx",
      "project-templates/project-template-cas-audit/template-file-cash/cash-template.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workingPaperId: "paper-cash",
        fileKind: "SUPPORTING",
        fileName: "copied-cash-template.xlsx",
        originalName: "Cash and bank.xlsx",
        uploadedBy: "preparer-1",
        lastModifiedBy: "preparer-1",
      }),
      include: expect.any(Object),
    });
    expect(result.createdWorkingPapers).toHaveLength(1);
    expect(result.createdWorkingPapers[0]).toStrictEqual(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            id: "attachment-cash",
            workingPaperId: "paper-cash",
            originalName: "Cash and bank.xlsx",
          }),
        ],
      })
    );
    expect(result.skippedTemplateFileIds).toHaveLength(0);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "preparer-1",
        action: "PROJECT_TEMPLATE_APPLIED",
        targetType: "PROJECT_TEMPLATE",
        targetId: "project-template-cas-audit",
        projectId: "project-1",
      })
    );
  });

  it("applies folder-only project templates as workflow nodes", async () => {
    const folderOnlyTemplate = {
      id: "project-template-folder-only",
      code: "FOLDER-ONLY",
      name: "Folder only template",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      status: "PUBLISHED",
      nodes: [
        {
          id: "template-node-planning",
          parentId: null,
          projectTemplateId: "project-template-folder-only",
          code: "Planning",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          files: [],
        },
        {
          id: "template-node-a1",
          parentId: "template-node-planning",
          projectTemplateId: "project-template-folder-only",
          code: "A1",
          title: "A1 - Client acceptance or continuance",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          createdAt: new Date("2026-01-01T00:00:01.000Z"),
          files: [],
        },
      ],
    };
    prisma.projectTemplate.findFirst.mockResolvedValue(folderOnlyTemplate);
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-a1-1000-01",
      code: "A1-1000-01",
      title: "Cash",
      level: 4,
      project: {
        id: "project-1",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.workflowNode.create.mockImplementation(async ({ data }) => {
      await Promise.resolve();
      return {
        id:
          data.code === "Planning"
            ? "created-node-planning"
            : "created-node-a1",
        ...data,
      };
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      undefined,
      storage as never
    );
    const result = await service.applyProjectTemplate(
      "project-1",
      "project-template-folder-only",
      {
        workflowNodeId: "node-a1-1000-01",
        bucket: "CURRENT",
        selectedTemplateFileIds: [],
      },
      { id: "preparer-1", globalRole: "STAFF" } as never
    );

    expect(prisma.workflowNode.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: "node-a1-1000-01",
        code: "Planning",
        title: "Planning",
        level: 5,
        nodeType: "WORKING_PAPER",
        sortOrder: 1,
        createdBy: "preparer-1",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        projectId: "project-1",
        parentId: "created-node-planning",
        code: "A1",
        title: "Client acceptance or continuance",
        level: 6,
        nodeType: "WORKING_PAPER",
        sortOrder: 1,
        createdBy: "preparer-1",
      }),
    });
    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(storage.copyObjectToWorkingPaper).not.toHaveBeenCalled();
    expect(result.createdWorkflowNodes).toHaveLength(2);
    expect(result.createdWorkingPapers).toHaveLength(0);
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "preparer-1",
        action: "PROJECT_TEMPLATE_APPLIED",
        targetType: "PROJECT_TEMPLATE",
        targetId: "project-template-folder-only",
        projectId: "project-1",
      })
    );
  });

  it("strips legacy codes from imported folder-only template node titles", async () => {
    const folderOnlyTemplate = {
      id: "project-template-folder-only",
      code: "FOLDER-ONLY",
      name: "Folder only template",
      language: "zh-CN",
      frameworkTemplateId: "framework-cas",
      status: "PUBLISHED",
      nodes: [
        {
          id: "template-node-execution",
          parentId: null,
          projectTemplateId: "project-template-folder-only",
          code: "Execution",
          title: "Execution",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          files: [],
        },
        {
          id: "template-node-c1",
          parentId: "template-node-execution",
          projectTemplateId: "project-template-folder-only",
          code: "C1",
          title: "C - Cash and cash equivalents",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          createdAt: new Date("2026-01-01T00:00:01.000Z"),
          files: [],
        },
        {
          id: "template-node-c2",
          parentId: "template-node-execution",
          projectTemplateId: "project-template-folder-only",
          code: "C2",
          title: "C2\uFF1AD - Trade and other receivables",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 2,
          createdAt: new Date("2026-01-01T00:00:02.000Z"),
          files: [],
        },
        {
          id: "template-node-c3",
          parentId: "template-node-execution",
          projectTemplateId: "project-template-folder-only",
          code: "C3",
          title: "C3",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 3,
          createdAt: new Date("2026-01-01T00:00:03.000Z"),
          files: [],
        },
      ],
    };
    prisma.projectTemplate.findFirst.mockResolvedValue(folderOnlyTemplate);
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-execution",
      code: "Execution",
      title: "Execution",
      level: 1,
      project: {
        id: "project-1",
        language: "zh-CN",
        frameworkTemplateId: "framework-cas",
      },
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.workflowNode.create.mockImplementation(async ({ data }) => {
      await Promise.resolve();
      return {
        id:
          data.code === "Execution"
            ? "created-node-execution"
            : `created-${data.code}`,
        ...data,
      };
    });
    const service = new (ProjectsService as new (
      ...args: unknown[]
    ) => ProjectsService)(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never,
      storage as never
    );

    await service.applyProjectTemplate(
      "project-1",
      "project-template-folder-only",
      {
        workflowNodeId: "node-execution",
        bucket: "CURRENT",
        selectedTemplateFileIds: [],
      },
      { id: "preparer-1", globalRole: "STAFF" } as never
    );

    expect(prisma.workflowNode.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        code: "C1",
        title: "Cash and cash equivalents",
      }),
    });
    expect(prisma.workflowNode.create).toHaveBeenNthCalledWith(3, {
      data: expect.objectContaining({
        code: "C2",
        title: "Trade and other receivables",
      }),
    });
    expect(prisma.workflowNode.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "C3",
      }),
    });
  });

  it.each(["MANAGER", "SENIOR_MANAGER", "PRINCIPAL"] as const)(
    "lets %s create projects as general project members",
    async (globalRole) => {
      mockSuccessfulProjectCreate("manager-1");
      const service = new ProjectsService(
        prisma as never,
        auditLogs as never,
        access as never,
        archiveChecks as never
      );

      await service.create(
        {
          name: "ABC Holdings 2026 audit",
          projectCode: "ABC-2026-AUD",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        {
          id: "manager-1",
          globalRole,
        } as never
      );

      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId: "project-1",
          userId: "manager-1",
          projectRole: "PREPARER",
        },
      });
    }
  );

  it("marks the creating partner as partner in charge", async () => {
    mockSuccessfulProjectCreate("partner-1");
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "partner-1",
        projectRole: "PARTNER",
        inChargeRole: "PARTNER_IN_CHARGE",
      },
    });
  });

  it("lets staff-grade firm users create projects", async () => {
    mockSuccessfulProjectCreate("staff-1");
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      {
        id: "staff-1",
        globalRole: "STAFF",
      } as never
    );

    expect(prisma.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        userId: "staff-1",
        projectRole: "PREPARER",
      },
    });
  });

  it("keeps external experts from creating projects", async () => {
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await expect(
      service.create(
        {
          name: "ABC Holdings 2026 audit",
          projectCode: "ABC-2026-AUD",
          language: "zh-CN",
          frameworkTemplateId: "framework-hkfrs",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          archiveDeadline: "2027-06-29",
        },
        {
          id: "expert-1",
          globalRole: "TAX_EXPERT",
        } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("updates basic project information without changing the selected framework", async () => {
    access.requireProjectAction.mockResolvedValue({
      id: "member-1",
      projectRole: "PARTNER",
    });
    prisma.project.update.mockResolvedValue({
      id: "project-1",
      projectCode: "ABC-2026-UPDATED",
    });
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-UPDATED",
      name: "ABC Holdings 2026 revised audit",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.update(
      "project-1",
      {
        name: "ABC Holdings 2026 revised audit",
        projectCode: "ABC-2026-UPDATED",
        yearEndDate: "2026-12-31",
        reportDate: "2027-04-15",
        archiveDeadline: "2027-07-14",
        notes: "Updated reporting timeline",
      },
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "partner-1",
      "updateProjectInfo"
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: {
        name: "ABC Holdings 2026 revised audit",
        projectCode: "ABC-2026-UPDATED",
        reportingDate: new Date("2027-04-15"),
        yearEndDate: new Date("2026-12-31"),
        reportDate: new Date("2027-04-15"),
        archiveDeadline: new Date("2027-07-14"),
        notes: "Updated reporting timeline",
      },
    });
    expect(prisma.frameworkTemplate.findFirst).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "partner-1",
        action: "PROJECT_UPDATED",
        projectId: "project-1",
      })
    );
  });

  it("creates only selected audit-area template subtrees for wizard projects", async () => {
    mockSuccessfulProjectCreate("partner-1");
    const createdAt = new Date("2026-08-03T00:00:00.000Z");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "ABC-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      status: "PUBLISHED",
      frameworkTemplateId: "framework-hkfrs",
      language: "zh-CN",
      nodes: [
        {
          id: "root",
          parentId: null,
          code: "1000",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          auditAreaCode: null,
          files: [],
          smartForms: [],
          createdAt,
        },
        {
          id: "cash",
          parentId: "root",
          code: "1100",
          title: "Cash",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          auditAreaCode: "CASH",
          files: [],
          smartForms: [],
          createdAt,
        },
        {
          id: "tax",
          parentId: "root",
          code: "1200",
          title: "Tax",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 2,
          auditAreaCode: "TAXATION",
          files: [],
          smartForms: [],
          createdAt,
        },
      ],
    });
    prisma.workflowNode.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `node-${data.code}` })
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        projectTemplateId: "template-1",
        industryCode: "FINANCIAL_SERVICES",
        auditAreaCodes: ["CASH"],
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-05-30",
      },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          industryCode: "FINANCIAL_SERVICES",
          auditAreaCodes: ["CASH"],
        }),
      })
    );
    expect(
      prisma.workflowNode.create.mock.calls.map(([call]) => call.data.code)
    ).toStrictEqual(["1000", "1100"]);
  });

  it("creates only common template content when audit areas are skipped", async () => {
    mockSuccessfulProjectCreate("partner-1");
    const createdAt = new Date("2026-08-03T00:00:00.000Z");
    prisma.cmpEngagement.findFirst.mockResolvedValue({
      id: "engagement-1",
      clientId: "client-1",
      engagementCode: "ABC-2026-AUD",
      picUserId: "partner-1",
      micUserId: "manager-1",
      picUser: { status: "ACTIVE", globalRole: "PARTNER" },
      micUser: { status: "ACTIVE", globalRole: "MANAGER" },
    });
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.projectTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      status: "PUBLISHED",
      frameworkTemplateId: "framework-hkfrs",
      language: "zh-CN",
      nodes: [
        {
          id: "root",
          parentId: null,
          code: "1000",
          title: "Planning",
          level: 1,
          nodeType: "PHASE",
          sortOrder: 1,
          auditAreaCode: null,
          files: [],
          smartForms: [],
          createdAt,
        },
        {
          id: "cash",
          parentId: "root",
          code: "1100",
          title: "Cash",
          level: 2,
          nodeType: "ACCOUNT",
          sortOrder: 1,
          auditAreaCode: "CASH",
          files: [],
          smartForms: [],
          createdAt,
        },
      ],
    });
    prisma.workflowNode.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `node-${data.code}` })
    );
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC audit",
        cmpClientId: "client-1",
        cmpEngagementId: "engagement-1",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        projectTemplateId: "template-1",
        industryCode: "FINANCIAL_SERVICES",
        auditAreaCodes: [],
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-05-30",
      },
      { id: "partner-1", globalRole: "PARTNER" } as never
    );

    expect(
      prisma.workflowNode.create.mock.calls.map(([call]) => call.data.code)
    ).toStrictEqual(["1000"]);
  });

  it("places new projects in the requested desktop folder", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-client",
      ownerId: "partner-1",
      isDefault: false,
    });
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.projectWorkspacePlacement.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "node-1" });
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        folderId: "folder-client",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.desktopFolder.findFirst).toHaveBeenCalledWith({
      where: { id: "folder-client", ownerId: "partner-1" },
    });
    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          folderId: "folder-client",
          projectId: "project-1",
          userId: "partner-1",
        }),
        update: expect.objectContaining({
          folderId: "folder-client",
        }),
      })
    );
  });

  it("places new projects at the next free desktop position", async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-default",
      ownerId: "partner-1",
    });
    prisma.desktopFolder.findFirst.mockResolvedValue({
      id: "folder-client",
      ownerId: "partner-1",
      isDefault: false,
    });
    prisma.desktopProjectPlacement.findMany.mockResolvedValue([
      {
        projectId: "project-existing",
        folderId: "folder-client",
        desktopX: 24,
        desktopY: 24,
      },
    ]);
    prisma.frameworkTemplate.findFirst.mockResolvedValue({
      id: "framework-hkfrs",
      code: "HKFRS",
    });
    prisma.project.create.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      projectCode: "ABC-2026-AUD",
    });
    prisma.projectMember.create.mockResolvedValue({});
    prisma.projectWorkspacePlacement.create.mockResolvedValue({});
    prisma.desktopProjectPlacement.upsert.mockResolvedValue({});
    prisma.workflowNode.create.mockResolvedValue({ id: "node-1" });
    prisma.project.findFirstOrThrow.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-default",
      placements: [{ workspaceId: "workspace-default" }],
      members: [],
    });
    const service = new ProjectsService(
      prisma as never,
      auditLogs as never,
      access as never,
      archiveChecks as never
    );

    await service.create(
      {
        name: "ABC Holdings 2026 audit",
        projectCode: "ABC-2026-AUD",
        language: "zh-CN",
        frameworkTemplateId: "framework-hkfrs",
        folderId: "folder-client",
        yearEndDate: "2026-12-31",
        reportDate: "2027-03-31",
        archiveDeadline: "2027-06-29",
      },
      {
        id: "partner-1",
        globalRole: "PARTNER",
      } as never
    );

    expect(prisma.desktopProjectPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          folderId: "folder-client",
          desktopX: 156,
          desktopY: 24,
        }),
      })
    );
  });
});
