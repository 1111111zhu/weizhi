import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";

import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { UsersService } from "../users/users.service";
import { MembersService } from "./members.service";

const enabled = process.env.RUN_PROJECT_PERMISSION_INTEGRATION === "1";

describe.skipIf(!enabled)("project permissions on isolated PostgreSQL", () => {
  let prisma: PrismaService;
  let members: MembersService;
  let access: ProjectAccessService;
  let users: UsersService;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/permission_hardening_qa"
    ) {
      throw new Error(
        "Use the explicitly isolated permission_hardening_qa database on 127.0.0.1"
      );
    }
    prisma = new PrismaService();
    await prisma.$connect();
    const audit = new AuditLogsService(prisma);
    access = new ProjectAccessService(prisma);
    users = new UsersService(prisma, audit);
    members = new MembersService(
      prisma,
      access,
      audit,
      new ConfigService({ FRONTEND_URL: "http://127.0.0.1:3046" })
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function fixture(withPic = false) {
    const suffix = randomUUID();
    const admin = await prisma.user.create({
      data: {
        email: `admin-${suffix}@example.test`,
        name: "QA Admin",
        globalRole: "SUPER_ADMIN",
      },
    });
    const pic = await prisma.user.create({
      data: {
        email: `pic-${suffix}@example.test`,
        name: "QA Partner",
        globalRole: "PARTNER",
      },
    });
    const manager = await prisma.user.create({
      data: {
        email: `manager-${suffix}@example.test`,
        name: "QA Manager",
        globalRole: "MANAGER",
      },
    });
    const workspace = await prisma.workspace.create({
      data: { name: "Permission QA", clientName: "Synthetic", ownerId: pic.id },
    });
    const date = new Date("2026-12-31T00:00:00Z");
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        ownerId: pic.id,
        projectCode: `QA-${suffix}`,
        name: "Permission QA",
        reportingDate: date,
        yearEndDate: date,
        reportDate: date,
        archiveDeadline: date,
      },
    });
    const managerMember = await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: manager.id,
        projectRole: "REVIEWER",
        inChargeRole: "MANAGER_IN_CHARGE",
      },
    });
    const picMember = withPic
      ? await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: pic.id,
            projectRole: "PARTNER",
            inChargeRole: "PARTNER_IN_CHARGE",
          },
        })
      : null;
    return { admin, pic, manager, project, managerMember, picMember };
  }

  it("serializes duplicate recovery invitations, requires acceptance, then explicitly recovers PIC", async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        members.createPicRecoveryInvitation(f.project.id, f.admin, {
          recipientUserId: f.pic.id,
          reason: "No eligible joined member",
        })
      )
    );
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected")
    ).toHaveLength(1);
    const success = results.find((result) => result.status === "fulfilled");
    if (success?.status !== "fulfilled") {
      throw new Error("Recovery invitation was not created");
    }
    await expect(
      prisma.projectMember.count({
        where: { projectId: f.project.id, userId: f.pic.id },
      })
    ).resolves.toBe(0);
    await expect(
      members.recoverProjectPic(f.project.id, "not-joined", f.admin, {
        reason: "Recovery",
      })
    ).rejects.toThrow("项目成员不存在");
    const joined = await members.acceptInvitation(
      success.value.token,
      f.pic,
      {}
    );
    expect(joined.inChargeRole).toBeNull();
    const recovered = await members.recoverProjectPic(
      f.project.id,
      joined.id,
      f.admin,
      { reason: "Accepted recovery invitation" }
    );
    expect(recovered.inChargeRole).toBe("PARTNER_IN_CHARGE");
    await expect(
      prisma.auditLog.count({
        where: {
          projectId: f.project.id,
          action: "PROJECT_PIC_RECOVERY_INVITATION_CREATED",
        },
      })
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: { projectId: f.project.id, action: "PROJECT_PIC_RECOVERED" },
      })
    ).resolves.toBe(1);
    await expect(
      members.createInvitation(f.project.id, f.admin, {
        recipientUserId: f.manager.id,
        invitedRole: "REVIEWER",
        expiresInDays: 7,
      })
    ).rejects.toThrow("系统管理员仅可查看项目");
  });

  it("allows only one competing administrator recovery to establish PIC", async () => {
    const f = await fixture();
    const other = await prisma.user.create({
      data: {
        email: `other-${randomUUID()}@example.test`,
        name: "Other Partner",
        globalRole: "PRINCIPAL",
      },
    });
    const first = await prisma.projectMember.create({
      data: {
        projectId: f.project.id,
        userId: f.pic.id,
        projectRole: "PARTNER",
      },
    });
    const second = await prisma.projectMember.create({
      data: {
        projectId: f.project.id,
        userId: other.id,
        projectRole: "PARTNER",
      },
    });
    const results = await Promise.allSettled(
      [first, second].map((member) =>
        members.recoverProjectPic(f.project.id, member.id, f.admin, {
          reason: "Concurrent recovery",
        })
      )
    );
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1);
    await expect(
      prisma.projectMember.count({
        where: { projectId: f.project.id, inChargeRole: "PARTNER_IN_CHARGE" },
      })
    ).resolves.toBe(1);
  });

  it("persists suspension across grade reversal and requires PIC reauthorization without rewriting declarations", async () => {
    const f = await fixture(true);
    const declaration = await prisma.independenceDeclaration.create({
      data: {
        userId: f.manager.id,
        projectId: f.project.id,
        declarationVersion: "v1",
        source: "QA",
      },
    });
    await expect(
      users.update(f.manager.id, { globalRole: "STAFF" }, f.admin.id)
    ).rejects.toThrow("项目授权影响已变化");
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: f.manager.id } })
    ).resolves.toMatchObject({ globalRole: "MANAGER" });
    const impact = await users.roleImpact(f.manager.id, "STAFF");
    await users.update(
      f.manager.id,
      { globalRole: "STAFF", projectAuthorizationImpactToken: impact.token },
      f.admin.id
    );
    const paused = await prisma.projectMember.findUniqueOrThrow({
      where: { id: f.managerMember.id },
    });
    expect(paused.authorizationSuspendedAt).not.toBeNull();
    expect(paused.projectRole).toBe("REVIEWER");
    await users.update(f.manager.id, { globalRole: "MANAGER" }, f.admin.id);
    await expect(
      access.requireProjectAction(
        f.project.id,
        f.manager.id,
        "uploadWorkingPapers"
      )
    ).rejects.toThrow("项目授权与当前职级不一致");
    await members.reauthorizeMember(
      f.project.id,
      f.managerMember.id,
      f.pic as RequestUser,
      {
        projectRole: "REVIEWER",
        reason: "Confirmed current project responsibility",
      }
    );
    await expect(
      access.requireProjectAction(
        f.project.id,
        f.manager.id,
        "uploadWorkingPapers"
      )
    ).resolves.toMatchObject({ userId: f.manager.id });
    const restored = await prisma.projectMember.findUniqueOrThrow({
      where: { id: f.managerMember.id },
    });
    expect(restored.authorizationSuspendedAt).toBeNull();
    expect(restored.inChargeRole).toBeNull();
    expect(restored.joinedAt).toStrictEqual(f.managerMember.joinedAt);
    await expect(
      prisma.independenceDeclaration.findUnique({
        where: { id: declaration.id },
      })
    ).resolves.toMatchObject({ acceptedAt: declaration.acceptedAt });
  });

  it("keeps administrators read-only and rejects last-PIC removal and self assignment", async () => {
    const f = await fixture(true);
    await expect(
      access.requireProjectMember(f.project.id, f.admin.id)
    ).resolves.toMatchObject({ isVirtualSuperAdmin: true });
    await expect(
      access.requireProjectAction(
        f.project.id,
        f.admin.id,
        "uploadWorkingPapers"
      )
    ).rejects.toThrow("系统管理员仅可查看项目");
    if (!f.picMember) {
      throw new Error("Expected a PIC fixture");
    }
    await expect(
      members.updateMemberInChargeRole(f.project.id, f.picMember.id, f.pic, {
        inChargeRole: null,
      })
    ).rejects.toThrow("请先指定另一位有效 PIC");
    await expect(
      members.updateMemberInChargeRole(f.project.id, f.picMember.id, f.pic, {
        inChargeRole: "PARTNER_IN_CHARGE",
      })
    ).rejects.toThrow("不能为自己设置");
  });
});
