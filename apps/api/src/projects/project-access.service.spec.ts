import { ProjectAccessService } from "./project-access.service";

const prisma = {
  projectMember: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

describe(ProjectAccessService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function service() {
    return new ProjectAccessService(prisma as never);
  }

  it("keeps deleted projects immutable except for the explicit restore action", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      status: "ACTIVE",
      projectRole: "PREPARER",
      inChargeRole: null,
      user: { globalRole: "STAFF", status: "ACTIVE" },
      project: { status: "DELETED" },
    });
    await expect(
      service().requireProjectAction("p", "u", "uploadWorkingPapers")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    await expect(
      service().requireProjectAction("p", "u", "restoreProject")
    ).resolves.toMatchObject({ project: { status: "DELETED" } });
  });

  it.each([
    { globalRole: "STAFF", projectRole: "PARTNER", inChargeRole: null },
    {
      globalRole: "HR",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
    },
    {
      globalRole: "STAFF",
      projectRole: "PREPARER",
      inChargeRole: "MANAGER_IN_CHARGE",
    },
    {
      globalRole: "PARTNER",
      projectRole: "EQCR",
      inChargeRole: "PARTNER_IN_CHARGE",
    },
  ])(
    "rejects obsolete grants through every access entry: %j",
    async (subject) => {
      prisma.projectMember.findUnique.mockResolvedValue({
        id: "old-grant",
        projectId: "project-1",
        userId: "user-1",
        status: "ACTIVE",
        projectRole: subject.projectRole,
        inChargeRole: subject.inChargeRole,
        user: { globalRole: subject.globalRole, status: "ACTIVE" },
        project: { status: "ACTIVE" },
      });
      const access = service();
      for (const request of [
        () => access.requireProjectMember("project-1", "user-1"),
        () => access.requireMutableProject("project-1", "user-1"),
        () => access.requireProjectRole("project-1", "user-1", "PREPARER"),
        () =>
          access.requireProjectAction("project-1", "user-1", "deleteProject"),
      ]) {
        await expect(request()).rejects.toMatchObject({
          response: expect.objectContaining({ code: "FORBIDDEN" }),
        });
      }
    }
  );

  it("rejects a disabled account even when the membership remains active", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member",
      status: "ACTIVE",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
      user: { globalRole: "PARTNER", status: "DISABLED" },
      project: { status: "ACTIVE" },
    });
    await expect(
      service().requireProjectAction("project-1", "user-1", "deleteProject")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("keeps a suspended grant denied even after the user's grade becomes compatible again", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      status: "ACTIVE",
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
      authorizationSuspendedAt: new Date(),
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      project: { status: "ACTIVE" },
    });
    await expect(
      service().requireProjectAction("p", "u", "deleteProject")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("lets tax reviewers perform reviewer actions without preparer write access", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-tax",
      projectId: "project-1",
      userId: "tax-1",
      projectRole: "TAX_REVIEWER",
      user: { globalRole: "TAX_EXPERT", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectRole("project-1", "tax-1", "REVIEWER")
    ).resolves.toMatchObject({ projectRole: "TAX_REVIEWER" });

    await expect(
      service().requireProjectRole("project-1", "tax-1", "PREPARER")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("keeps general project members from performing reviewer-only actions", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-staff",
      projectId: "project-1",
      userId: "staff-1",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectRole("project-1", "staff-1", "REVIEWER")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("keeps partners eligible for all project actions", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-partner",
      projectId: "project-1",
      userId: "partner-1",
      projectRole: "PARTNER",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectRole("project-1", "partner-1", "PREPARER")
    ).resolves.toMatchObject({ projectRole: "PARTNER" });
    await expect(
      service().requireProjectRole("project-1", "partner-1", "REVIEWER")
    ).resolves.toMatchObject({ projectRole: "PARTNER" });
    await expect(
      service().requireProjectRole("project-1", "partner-1", "PARTNER")
    ).resolves.toMatchObject({ projectRole: "PARTNER" });
  });

  it("lets active administrators perform project actions and restore deleted projects", async () => {
    prisma.projectMember.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "ACTIVE",
    });
    await expect(
      service().requireProjectMember("project-1", "admin-1")
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true, inChargeRole: null });
    await expect(
      service().requireProjectAction("project-1", "admin-1", "viewRecycleBin")
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true });
    for (const action of [
      "useLibrary",
      "deleteProject",
      "signPreparer",
      "reviewSignoff",
    ] as const) {
      await expect(
        service().requireProjectAction("project-1", "admin-1", action)
      ).resolves.toMatchObject({ isVirtualSuperAdmin: true });
    }
    await expect(
      service().requireMutableProject("project-1", "admin-1")
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true });
    await expect(
      service().requireProjectRole("project-1", "admin-1", "PREPARER")
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true });

    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      status: "DELETED",
    });
    await expect(
      service().requireProjectAction("project-1", "admin-1", "restoreProject")
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true });
    await expect(
      service().requireProjectAction("project-1", "admin-1", "deleteProject")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it.each(["ARCHIVED", "PENDING_FINAL_CHECK"] as const)(
    "keeps administrators read-only while a project is %s",
    async (status) => {
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        globalRole: "SUPER_ADMIN",
        status: "ACTIVE",
      });
      prisma.project.findUnique.mockResolvedValue({ id: "project-1", status });

      await expect(
        service().requireMutableProject("project-1", "admin-1")
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: status === "ARCHIVED" ? "PROJECT_ARCHIVED" : "FORBIDDEN",
        }),
      });
    }
  );

  it("still rejects non-admin users without a project membership", async () => {
    prisma.projectMember.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ globalRole: "STAFF" });

    await expect(
      service().requireProjectMember("project-1", "staff-1")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_NOT_FOUND" }),
    });
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it("checks explicit project actions against the engagement permission matrix", async () => {
    prisma.projectMember.findUnique.mockResolvedValueOnce({
      id: "member-staff",
      projectId: "project-1",
      userId: "staff-1",
      projectRole: "PREPARER",
      inChargeRole: null,
      status: "ACTIVE",
      user: { globalRole: "STAFF", status: "ACTIVE" },
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectAction(
        "project-1",
        "staff-1",
        "updateProjectInfo"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });

    prisma.projectMember.findUnique.mockResolvedValueOnce({
      id: "member-partner",
      projectId: "project-1",
      userId: "partner-1",
      projectRole: "PARTNER",
      inChargeRole: null,
      status: "ACTIVE",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectAction("project-1", "partner-1", "archiveProject")
    ).resolves.toMatchObject({ projectRole: "PARTNER" });

    prisma.projectMember.findUnique.mockResolvedValueOnce({
      id: "member-assistant",
      projectId: "project-1",
      userId: "assistant-1",
      projectRole: "PREPARER",
      inChargeRole: null,
      status: "ACTIVE",
      user: { globalRole: "ASSISTANT", status: "ACTIVE" },
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectAction(
        "project-1",
        "assistant-1",
        "archiveProject"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });

    prisma.projectMember.findUnique.mockResolvedValueOnce({
      id: "member-eqr",
      projectId: "project-1",
      userId: "eqr-1",
      projectRole: "EQCR",
      inChargeRole: null,
      status: "ACTIVE",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      project: { status: "ACTIVE" },
    });

    await expect(
      service().requireProjectAction("project-1", "eqr-1", "modifyIndex")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("blocks write-role actions once the project is archived", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-partner",
      projectId: "project-1",
      userId: "partner-1",
      projectRole: "PARTNER",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "ARCHIVED" },
    });

    await expect(
      service().requireProjectRole("project-1", "partner-1", "PARTNER")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_ARCHIVED" }),
    });
  });

  it("blocks member-level mutations once the project is archived", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-preparer",
      projectId: "project-1",
      userId: "preparer-1",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "ARCHIVED" },
    });

    await expect(
      service().requireMutableProject("project-1", "preparer-1")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PROJECT_ARCHIVED" }),
    });
  });

  it("blocks write-role actions while the project is pending final check", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-partner",
      projectId: "project-1",
      userId: "partner-1",
      projectRole: "PARTNER",
      user: { globalRole: "PARTNER", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "PENDING_FINAL_CHECK" },
    });

    await expect(
      service().requireProjectRole("project-1", "partner-1", "PARTNER")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("blocks member-level mutations while the project is pending final check", async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: "member-preparer",
      projectId: "project-1",
      userId: "preparer-1",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
      status: "ACTIVE",
      project: { status: "PENDING_FINAL_CHECK" },
    });

    await expect(
      service().requireMutableProject("project-1", "preparer-1")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });
});
