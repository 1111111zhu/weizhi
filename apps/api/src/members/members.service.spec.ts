import { MembersService } from "./members.service";

type ProjectMemberFindFirstArgs = {
  where: { id?: string; userId?: string };
};

const prisma = {
  $transaction: vi.fn(),
  projectMember: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  workspace: {
    findFirst: vi.fn(),
  },
  projectInvitation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  independenceDeclaration: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};
const access = {
  requireProjectMember: vi.fn(),
  requireProjectAction: vi.fn(),
};
const auditLogs = {
  logInTransaction: vi.fn(),
  log: vi.fn(),
};
const config = {
  get: vi.fn(),
};

describe(MembersService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue("http://localhost:3001");
    access.requireProjectAction.mockResolvedValue({
      id: "actor-member-1",
      projectId: "project-1",
      userId: "actor-1",
      projectRole: "PREPARER",
      inChargeRole: null,
      user: { globalRole: "MANAGER" },
    });
    prisma.projectInvitation.findFirst.mockResolvedValue(null);
    prisma.projectInvitation.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  function createService(inbox?: {
    deliverMessageEmail: ReturnType<typeof vi.fn>;
  }) {
    return new MembersService(
      prisma as never,
      access as never,
      auditLogs as never,
      config as never,
      inbox as never
    );
  }

  function mockProject() {
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      workspaceId: "workspace-1",
      projectCode: "AUD-001",
      name: "ABC Holdings",
      workspace: { name: "ABC Workspace" },
    });
  }

  function mockInvitingProjectManager() {
    access.requireProjectAction.mockResolvedValue({
      id: "manager-member-1",
      projectId: "project-1",
      userId: "manager-1",
      projectRole: "REVIEWER",
      inChargeRole: null,
      user: { globalRole: "MANAGER" },
    });
    prisma.projectMember.findFirst.mockResolvedValue({
      id: "manager-member-1",
      projectId: "project-1",
      userId: "manager-1",
      projectRole: "REVIEWER",
      user: {
        id: "manager-1",
        name: "Manager",
        email: "manager@example.com",
        globalRole: "MANAGER",
      },
    });
  }

  function mockInvitationTransaction(invitedRole = "PREPARER") {
    const tx = {
      projectInvitation: {
        create: vi.fn().mockResolvedValue({
          id: "invitation-1",
          projectId: "project-1",
          invitedRole,
          recipientEmail: "recipient@example.com",
          expiresAt: new Date("2026-06-08T00:00:00Z"),
        }),
      },
      inboxMessage: {
        create: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    return tx;
  }

  it.each([
    ["PARTNER", "PARTNER"],
    ["PRINCIPAL", "PARTNER"],
    ["PRINCIPAL", "REVIEWER"],
    ["SENIOR_MANAGER", "REVIEWER"],
    ["MANAGER", "REVIEWER"],
    ["SENIOR", "REVIEWER"],
    ["STAFF", "PREPARER"],
    ["TAX_EXPERT", "TAX_REVIEWER"],
  ] as const)(
    "allows an active %s account to be invited as %s",
    async (globalRole, invitedRole) => {
      mockInvitingProjectManager();
      mockProject();
      prisma.user.findFirst.mockResolvedValue({
        id: "recipient-1",
        email: "recipient@example.com",
        name: "Recipient",
        globalRole,
        status: "ACTIVE",
      });
      const tx = mockInvitationTransaction(invitedRole);
      const service = createService();

      await expect(
        service.createInvitation(
          "project-1",
          { id: "manager-1", name: "Manager", globalRole: "MANAGER" } as never,
          { recipientUserId: "recipient-1", invitedRole, expiresInDays: 7 }
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({
          id: "invitation-1",
          delivery: expect.objectContaining({ delivered: true }),
        })
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: "recipient-1", status: "ACTIVE" },
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          status: true,
          preferredLocale: true,
        },
      });
      expect(tx.projectInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invitedRole }),
        })
      );
      expect(tx.inboxMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientId: "recipient-1",
            projectInvitationId: "invitation-1",
            contentKey: "PROJECT_INVITATION",
            contentParams: {
              actor: "Manager",
              projectCode: "AUD-001",
              projectName: "ABC Holdings",
              role: invitedRole,
            },
            actionUrl: expect.stringMatching(/^\/invitations\//),
          }),
        })
      );
    }
  );

  it("emails an invitation once using the recipient's preferred locale", async () => {
    mockInvitingProjectManager();
    mockProject();
    prisma.user.findFirst.mockResolvedValue({
      id: "recipient-1",
      email: "recipient@example.com",
      name: "Recipient",
      globalRole: "STAFF",
      status: "ACTIVE",
      preferredLocale: "en-US",
    });
    mockInvitationTransaction("PREPARER");
    const inbox = {
      deliverMessageEmail: vi.fn().mockResolvedValue({ skipped: false }),
    };

    await createService(inbox).createInvitation(
      "project-1",
      { id: "manager-1", name: "Manager", globalRole: "MANAGER" } as never,
      {
        recipientUserId: "recipient-1",
        invitedRole: "PREPARER",
        expiresInDays: 7,
      }
    );

    expect(inbox.deliverMessageEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        recipientId: "recipient-1",
        preferredLocale: "en-US",
        contentKey: "PROJECT_INVITATION",
      })
    );
  });

  it("rejects duplicate pending invitations for the same project recipient", async () => {
    mockInvitingProjectManager();
    mockProject();
    prisma.user.findFirst.mockResolvedValue({
      id: "recipient-1",
      email: "recipient@example.com",
      name: "Recipient",
      globalRole: "STAFF",
      status: "ACTIVE",
    });
    prisma.projectInvitation.findFirst.mockResolvedValue({
      id: "pending-invitation-1",
    });
    const service = createService();

    await expect(
      service.createInvitation(
        "project-1",
        { id: "manager-1", name: "Manager", globalRole: "MANAGER" } as never,
        {
          recipientUserId: "recipient-1",
          invitedRole: "PREPARER",
          expiresInDays: 7,
        }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.projectInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        recipientEmail: "recipient@example.com",
        status: "PENDING",
        expiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["PARTNER", "REVIEWER"],
    ["SENIOR_MANAGER", "PARTNER"],
    ["MANAGER", "PARTNER"],
    ["SENIOR", "PARTNER"],
    ["STAFF", "PARTNER"],
    ["STAFF", "REVIEWER"],
    ["TAX_EXPERT", "PREPARER"],
    ["TAX_EXPERT", "REVIEWER"],
    ["SUPER_ADMIN", "PREPARER"],
  ] as const)(
    "rejects inviting a %s account as %s",
    async (globalRole, invitedRole) => {
      mockInvitingProjectManager();
      mockProject();
      prisma.user.findFirst.mockResolvedValue({
        id: "recipient-1",
        email: "recipient@example.com",
        name: "Recipient",
        globalRole,
        status: "ACTIVE",
      });
      const service = createService();

      await expect(
        service.createInvitation(
          "project-1",
          { id: "manager-1", name: "Manager", globalRole: "MANAGER" } as never,
          { recipientUserId: "recipient-1", invitedRole, expiresInDays: 7 }
        )
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "INVALID_PROJECT_ROLE" }),
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(auditLogs.log).not.toHaveBeenCalled();
    }
  );

  it("rechecks the current account grade before accepting an invitation", async () => {
    prisma.projectInvitation.findUnique.mockResolvedValue({
      id: "invitation-1",
      projectId: "project-1",
      recipientEmail: "admin@example.com",
      invitedRole: "PREPARER",
      status: "PENDING",
      usedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      project: { workspaceId: "workspace-1" },
      inboxMessage: null,
    });
    const service = createService();

    await expect(
      service.acceptInvitation(
        "preview-token",
        {
          id: "admin-1",
          email: "admin@example.com",
          name: "Admin",
          globalRole: "SUPER_ADMIN",
        } as never,
        {}
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INVALID_PROJECT_ROLE" }),
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("marks each project member with project-level declaration and role consistency state", async () => {
    prisma.projectMember.findMany.mockResolvedValue([
      {
        id: "member-1",
        projectId: "project-1",
        userId: "user-1",
        projectRole: "PARTNER",
        joinedAt: new Date("2026-06-01T00:00:00Z"),
        user: {
          id: "user-1",
          name: "Partner",
          email: "partner@example.com",
          globalRole: "PARTNER",
        },
      },
      {
        id: "member-2",
        projectId: "project-1",
        userId: "user-2",
        projectRole: "PARTNER",
        joinedAt: new Date("2026-06-06T03:38:50Z"),
        user: {
          id: "user-2",
          name: "Staff",
          email: "staff@example.com",
          globalRole: "STAFF",
        },
      },
      {
        id: "member-3",
        projectId: "project-1",
        userId: "user-3",
        projectRole: "PREPARER",
        joinedAt: new Date("2026-06-06T03:38:50Z"),
        user: {
          id: "user-3",
          name: "Rejoined Staff",
          email: "rejoined-staff@example.com",
          globalRole: "STAFF",
        },
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([
      { userId: "user-1", acceptedAt: new Date("2026-06-01T00:00:00Z") },
      { userId: "user-2", acceptedAt: new Date("2026-06-06T04:16:18Z") },
      { userId: "user-2", acceptedAt: new Date("2026-06-02T05:11:01Z") },
      { userId: "user-3", acceptedAt: new Date("2026-06-02T05:12:01Z") },
    ]);
    const service = new MembersService(
      prisma as never,
      access as never,
      auditLogs as never,
      config as never
    );

    await expect(
      service.list("project-1", {
        id: "viewer-1",
        globalRole: "STAFF",
      } as never)
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: "member-1",
        declarationAccepted: true,
        declarationAcceptedAt: new Date("2026-06-01T00:00:00Z"),
        roleConsistent: true,
      }),
      expect.objectContaining({
        id: "member-2",
        declarationAccepted: true,
        declarationAcceptedAt: new Date("2026-06-06T04:16:18Z"),
        roleConsistent: false,
        roleConflictReason: expect.stringContaining("STAFF"),
      }),
      expect.objectContaining({
        id: "member-3",
        declarationAccepted: false,
        declarationAcceptedAt: null,
        roleConsistent: true,
      }),
    ]);
    expect(prisma.independenceDeclaration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { acceptedAt: "desc" },
      })
    );
  });

  it("includes pending project invitations for system users in the member directory", async () => {
    prisma.projectMember.findMany.mockResolvedValue([
      {
        id: "member-1",
        projectId: "project-1",
        userId: "user-1",
        projectRole: "PARTNER",
        joinedAt: new Date("2026-06-01T00:00:00Z"),
        user: {
          id: "user-1",
          name: "Partner",
          email: "partner@example.com",
          globalRole: "PARTNER",
        },
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([]);
    prisma.projectInvitation.findMany.mockResolvedValue([
      {
        id: "invitation-1",
        recipientEmail: "senior@example.com",
        invitedRole: "PREPARER",
        expiresAt: new Date("2026-06-30T00:00:00Z"),
        createdAt: new Date("2026-06-01T01:00:00Z"),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-senior",
        name: "Senior",
        email: "senior@example.com",
        globalRole: "SENIOR",
      },
    ]);
    const service = createService();

    await expect(
      service.listDirectory("project-1", {
        id: "viewer-1",
        globalRole: "STAFF",
      } as never)
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: "member-1",
        membershipStatus: "ACTIVE",
      }),
      expect.objectContaining({
        id: "invitation:invitation-1",
        invitationId: "invitation-1",
        membershipStatus: "INVITED",
        projectRole: "PREPARER",
        declarationAccepted: false,
        user: expect.objectContaining({
          id: "user-senior",
          email: "senior@example.com",
        }),
      }),
    ]);
    expect(prisma.projectInvitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          status: "PENDING",
        }),
      })
    );
  });

  it("lets project managers update a non-partner member project role without changing private workspaces", async () => {
    prisma.projectMember.findFirst.mockImplementation(
      ({ where }: ProjectMemberFindFirstArgs) => {
        if (where.userId === "manager-1") {
          return Promise.resolve({
            id: "manager-member-1",
            projectId: "project-1",
            userId: "manager-1",
            projectRole: "REVIEWER",
            user: {
              id: "manager-1",
              name: "Manager",
              email: "manager@example.com",
              globalRole: "MANAGER",
            },
          });
        }
        return Promise.resolve({
          id: "member-1",
          projectId: "project-1",
          userId: "user-1",
          projectRole: "REVIEWER",
          project: { workspaceId: "workspace-1" },
          user: {
            id: "user-1",
            name: "Principal",
            email: "principal@example.com",
            globalRole: "PRINCIPAL",
          },
        });
      }
    );
    prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
    const tx = {
      $queryRaw: vi.fn(),
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ globalRole: "PRINCIPAL", status: "ACTIVE" }),
      },
      projectMember: {
        update: vi.fn().mockResolvedValue({
          id: "member-1",
          projectId: "project-1",
          userId: "user-1",
          projectRole: "PARTNER",
          user: {
            id: "user-1",
            name: "Principal",
            email: "principal@example.com",
            globalRole: "PRINCIPAL",
          },
        }),
        findMany: vi.fn().mockResolvedValue([{ projectRole: "PARTNER" }]),
      },
      workspaceMember: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      projectWorkspacePlacement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    const service = new MembersService(
      prisma as never,
      access as never,
      auditLogs as never,
      config as never
    );

    await service.updateMemberRole(
      "project-1",
      "member-1",
      { id: "manager-1", globalRole: "MANAGER" } as never,
      { projectRole: "PARTNER" }
    );

    expect(tx.projectMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "member-1",
          inChargeRole: null,
          authorizationSuspendedAt: null,
        },
        data: { projectRole: "PARTNER" },
      })
    );
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
    expect(tx.workspaceMember.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectWorkspacePlacement.upsert).not.toHaveBeenCalled();
    expect(tx.projectWorkspacePlacement.deleteMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "manager-1",
        action: "PROJECT_MEMBER_ROLE_UPDATED",
        projectId: "project-1",
      })
    );
  });

  it.each(["MANAGER", "SENIOR_MANAGER", "PRINCIPAL", "PARTNER"] as const)(
    "lets %s accounts maintain project members",
    async (globalRole) => {
      prisma.projectMember.findFirst.mockImplementation(
        ({ where }: ProjectMemberFindFirstArgs) => {
          if (where.userId === "actor-1") {
            return Promise.resolve({
              id: "actor-member-1",
              projectId: "project-1",
              userId: "actor-1",
              projectRole: globalRole === "PARTNER" ? "PARTNER" : "PREPARER",
              user: {
                id: "actor-1",
                name: "Actor",
                email: "actor@example.com",
                globalRole,
              },
            });
          }
          return Promise.resolve({
            id: "member-1",
            projectId: "project-1",
            userId: "user-1",
            projectRole: "PREPARER",
            project: { workspaceId: "workspace-1" },
            user: {
              id: "user-1",
              name: "Staff",
              email: "staff@example.com",
              globalRole: "STAFF",
            },
          });
        }
      );
      prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
      const tx = {
        $queryRaw: vi.fn(),
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ globalRole: "STAFF", status: "ACTIVE" }),
        },
        projectMember: {
          update: vi.fn().mockResolvedValue({
            id: "member-1",
            projectId: "project-1",
            userId: "user-1",
            projectRole: "PREPARER",
            user: {
              id: "user-1",
              name: "Staff",
              email: "staff@example.com",
              globalRole: "STAFF",
            },
          }),
          findMany: vi.fn().mockResolvedValue([{ projectRole: "PREPARER" }]),
        },
        workspaceMember: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
        projectWorkspacePlacement: {
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
      };
      prisma.$transaction.mockImplementation((callback) => callback(tx));
      const service = createService();

      await expect(
        service.updateMemberRole(
          "project-1",
          "member-1",
          { id: "actor-1", globalRole } as never,
          { projectRole: "PREPARER" }
        )
      ).resolves.toMatchObject({
        id: "member-1",
        projectRole: "PREPARER",
      });
    }
  );

  it("requires the PIC reauthorization path for an inconsistent grant rather than a normal role edit", async () => {
    prisma.projectMember.findFirst.mockResolvedValue({
      id: "m",
      projectId: "p",
      userId: "target",
      projectRole: "REVIEWER",
      inChargeRole: null,
      user: { globalRole: "STAFF" },
    });
    await expect(
      createService().updateMemberRole(
        "p",
        "m",
        { id: "actor-1", globalRole: "MANAGER" } as never,
        { projectRole: "PREPARER" }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(["MANAGER", "STAFF"] as const)(
    "checks leadership authority and target eligibility for %s",
    async (globalRole) => {
      const target = {
        id: "member-1",
        userId: "user-1",
        projectId: "project-1",
        status: "ACTIVE",
        projectRole: globalRole === "MANAGER" ? "REVIEWER" : "PREPARER",
        inChargeRole: null,
        joinedAt: new Date(),
        user: {
          id: "user-1",
          name: "Target",
          email: "target@example.com",
          globalRole,
          status: "ACTIVE",
        },
      };
      const tx = {
        $queryRaw: vi.fn(),
        project: {
          findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE" }),
        },
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ globalRole: "PARTNER", status: "ACTIVE" }),
        },
        projectMember: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "pic",
              userId: "actor-1",
              status: "ACTIVE",
              projectRole: "PARTNER",
              inChargeRole: "PARTNER_IN_CHARGE",
              user: { globalRole: "PARTNER", status: "ACTIVE" },
            },
            target,
          ]),
          update: vi.fn().mockResolvedValue({
            ...target,
            inChargeRole: "MANAGER_IN_CHARGE",
          }),
        },
      };
      prisma.$transaction.mockImplementation((callback) => callback(tx));
      prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
      const result = createService().updateMemberInChargeRole(
        "project-1",
        "member-1",
        { id: "actor-1", globalRole: "PARTNER" } as never,
        { inChargeRole: "MANAGER_IN_CHARGE" }
      );
      const outcome = await result.then(
        (value) => ({ role: value.inChargeRole, error: null }),
        (error) => ({ role: null, error: error.response.code })
      );
      expect(outcome).toStrictEqual(
        globalRole === "MANAGER"
          ? { role: "MANAGER_IN_CHARGE", error: null }
          : { role: null, error: "INVALID_IN_CHARGE_ROLE" }
      );
      expect(tx.projectMember.update).toHaveBeenCalledTimes(
        globalRole === "MANAGER" ? 1 : 0
      );
    }
  );

  it.each(["SENIOR", "STAFF", "TAX_EXPERT"] as const)(
    "rejects %s accounts when maintaining project members",
    async (globalRole) => {
      prisma.projectMember.findFirst.mockResolvedValue({
        id: "actor-member-1",
        projectId: "project-1",
        userId: "actor-1",
        projectRole: globalRole === "TAX_EXPERT" ? "TAX_REVIEWER" : "PREPARER",
        user: {
          id: "actor-1",
          name: "Actor",
          email: "actor@example.com",
          globalRole,
        },
      });
      const service = createService();

      await expect(
        service.removeMember("project-1", "member-1", {
          id: "actor-1",
          globalRole,
        } as never)
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      });
    }
  );

  it.each(["MANAGER", "SENIOR_MANAGER", "PRINCIPAL"] as const)(
    "prevents %s accounts from removing project partners",
    async (globalRole) => {
      prisma.projectMember.findFirst.mockImplementation(
        ({ where }: ProjectMemberFindFirstArgs) => {
          if (where.userId === "actor-1") {
            return Promise.resolve({
              id: "actor-member-1",
              projectId: "project-1",
              userId: "actor-1",
              projectRole: "PREPARER",
              user: {
                id: "actor-1",
                name: "Actor",
                email: "actor@example.com",
                globalRole,
              },
            });
          }
          return Promise.resolve({
            id: "partner-member-1",
            projectId: "project-1",
            userId: "partner-1",
            projectRole: "PARTNER",
            project: { workspaceId: "workspace-1" },
            user: {
              id: "partner-1",
              name: "Partner",
              email: "partner@example.com",
              globalRole: "PARTNER",
            },
          });
        }
      );
      prisma.projectMember.count.mockResolvedValue(2);
      const service = createService();

      await expect(
        service.removeMember("project-1", "partner-member-1", {
          id: "actor-1",
          globalRole,
        } as never)
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it("lets project managers soft-remove non-partner members without touching private workspace placement", async () => {
    prisma.projectMember.findFirst.mockImplementation(
      ({ where }: ProjectMemberFindFirstArgs) => {
        if (where.userId === "manager-1") {
          return Promise.resolve({
            id: "manager-member-1",
            projectId: "project-1",
            userId: "manager-1",
            projectRole: "REVIEWER",
            user: {
              id: "manager-1",
              name: "Manager",
              email: "manager@example.com",
              globalRole: "MANAGER",
            },
          });
        }
        return Promise.resolve({
          id: "member-1",
          projectId: "project-1",
          userId: "user-1",
          projectRole: "PREPARER",
          project: { workspaceId: "workspace-1" },
          user: {
            id: "user-1",
            name: "Staff",
            email: "staff@example.com",
            globalRole: "STAFF",
          },
        });
      }
    );
    const tx = {
      projectMember: {
        update: vi.fn().mockResolvedValue({ id: "member-1" }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      workspaceMember: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      projectWorkspacePlacement: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    const service = new MembersService(
      prisma as never,
      access as never,
      auditLogs as never,
      config as never
    );

    await service.removeMember("project-1", "member-1", {
      id: "manager-1",
      globalRole: "MANAGER",
    } as never);

    expect(tx.projectMember.update).toHaveBeenCalledWith({
      where: { id: "member-1", inChargeRole: null },
      data: { status: "DISABLED" },
    });
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
    expect(tx.workspaceMember.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectWorkspacePlacement.upsert).not.toHaveBeenCalled();
    expect(tx.projectWorkspacePlacement.deleteMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "manager-1",
        action: "PROJECT_MEMBER_REMOVED",
        projectId: "project-1",
      })
    );
  });

  it("accepts a rejoin without restoring historical leadership and rejects overwriting active membership", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.projectInvitation.findUnique.mockResolvedValue({
      id: "invitation-1",
      projectId: "project-1",
      recipientEmail: "staff@example.com",
      invitedRole: "PREPARER",
      status: "PENDING",
      usedAt: null,
      expiresAt,
      project: { id: "project-1" },
      inboxMessage: { id: "message-1", recipientId: "staff-1" },
    });
    prisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-staff",
      ownerId: "staff-1",
    });
    const tx = {
      $queryRaw: vi.fn(),
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ globalRole: "STAFF", status: "ACTIVE" }),
      },
      projectMember: {
        findUnique: vi.fn().mockResolvedValue({
          status: "DISABLED",
          inChargeRole: "PARTNER_IN_CHARGE",
        }),
        upsert: vi.fn().mockResolvedValue({
          id: "member-1",
          projectId: "project-1",
          userId: "staff-1",
          projectRole: "PREPARER",
        }),
      },
      projectWorkspacePlacement: {
        upsert: vi.fn(),
      },
      projectInvitation: {
        update: vi.fn(),
      },
      inboxMessage: {
        update: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    const service = new MembersService(
      prisma as never,
      access as never,
      auditLogs as never,
      config as never
    );

    await service.acceptInvitation(
      "token-1",
      {
        id: "staff-1",
        email: "staff@example.com",
        globalRole: "STAFF",
      } as never,
      {}
    );

    expect(tx.projectMember.upsert).toHaveBeenCalledWith({
      where: {
        projectId_userId: {
          projectId: "project-1",
          userId: "staff-1",
        },
      },
      update: {
        projectRole: "PREPARER",
        inChargeRole: null,
        status: "ACTIVE",
        joinedAt: expect.any(Date),
      },
      create: {
        projectId: "project-1",
        userId: "staff-1",
        projectRole: "PREPARER",
      },
    });
    tx.projectMember.findUnique.mockResolvedValue({
      status: "ACTIVE",
      inChargeRole: "PARTNER_IN_CHARGE",
    });
    tx.projectMember.upsert.mockClear();
    await expect(
      service.acceptInvitation(
        "token-1",
        {
          id: "staff-1",
          email: "staff@example.com",
          globalRole: "STAFF",
        } as never,
        {}
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(tx.projectMember.upsert).not.toHaveBeenCalled();
  });
});
