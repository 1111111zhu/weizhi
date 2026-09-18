import type {
  GlobalRole,
  InChargeRole,
  ProjectRole,
} from "@project-wing/shared";
import type { RequestUser } from "../auth/request-user";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeProjectLeadership } from "./project-leadership";

const member = (
  id: string,
  grade: GlobalRole,
  role: ProjectRole,
  leadership: InChargeRole | null = null
) => ({
  id,
  projectId: "p",
  userId: id,
  status: "ACTIVE",
  projectRole: role,
  inChargeRole: leadership,
  user: {
    id,
    name: id,
    email: `${id}@example.com`,
    globalRole: grade,
    status: "ACTIVE",
  },
});
const tx = {
  $queryRaw: vi.fn(),
  project: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  projectMember: { findMany: vi.fn(), update: vi.fn() },
};
const prisma = { $transaction: vi.fn() };
const audit = { logInTransaction: vi.fn() };
const actor: RequestUser = {
  id: "pic",
  name: "PIC",
  email: "pic@example.com",
  globalRole: "PARTNER" as const,
};
let rows: ReturnType<typeof member>[];
function change(
  target = "manager",
  leadership: InChargeRole | null = "MANAGER_IN_CHARGE",
  who = actor,
  reason?: string
) {
  return changeProjectLeadership(
    prisma as never,
    audit as never,
    "p",
    target,
    who,
    leadership,
    undefined,
    reason
  );
}
describe("project leadership authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rows = [
      member("pic", "PARTNER", "PARTNER", "PARTNER_IN_CHARGE"),
      member("manager", "MANAGER", "REVIEWER"),
      member("principal", "PRINCIPAL", "PARTNER"),
    ];
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.project.findUnique.mockResolvedValue({ status: "ACTIVE" });
    tx.user.findUnique.mockResolvedValue({
      globalRole: "PARTNER",
      status: "ACTIVE",
    });
    tx.projectMember.findMany.mockResolvedValue(rows);
    tx.projectMember.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        ...rows.find((r) => r.id === where.id),
        ...data,
      })
    );
  });

  it("requires explicit PIC reauthorization and removes stale leadership without changing history", async () => {
    rows[1] = {
      ...rows[1],
      projectRole: "PARTNER",
      inChargeRole: "PARTNER_IN_CHARGE",
      user: { ...rows[1].user, globalRole: "STAFF" },
    };
    const suspended = { ...rows[1], authorizationSuspendedAt: new Date() };
    tx.projectMember.findMany.mockResolvedValue([rows[0], suspended]);
    await changeProjectLeadership(
      prisma as never,
      audit as never,
      "p",
      "manager",
      actor,
      null,
      undefined,
      undefined,
      { projectRole: "PREPARER", reason: "Grade changed; PIC confirmed access" }
    );
    expect(tx.projectMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "manager" },
        data: {
          projectRole: "PREPARER",
          inChargeRole: null,
          authorizationSuspendedAt: null,
        },
      })
    );
    expect(audit.logInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "PROJECT_AUTHORIZATION_RESTORED" })
    );
  });

  it("does not let a suspended PIC authorize themselves or anyone else", async () => {
    tx.projectMember.findMany.mockResolvedValue([
      { ...rows[0], authorizationSuspendedAt: new Date() },
      rows[1],
    ]);
    await expect(change()).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("allows a valid PIC to assign an eligible MIC and commits an audit record", async () => {
    await expect(change()).resolves.toMatchObject({
      inChargeRole: "MANAGER_IN_CHARGE",
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.projectMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "manager" },
        data: {
          inChargeRole: "MANAGER_IN_CHARGE",
          projectRole: "REVIEWER",
          authorizationSuspendedAt: null,
        },
      })
    );
    expect(audit.logInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "PROJECT_MEMBER_IN_CHARGE_UPDATED",
        actorId: "pic",
        projectId: "p",
      })
    );
  });

  it.each(["MANAGER", "SENIOR", "PRINCIPAL", "STAFF"] as const)(
    "does not let %s use ordinary member permissions for leadership",
    async (grade) => {
      tx.user.findUnique.mockResolvedValue({
        globalRole: grade,
        status: "ACTIVE",
      });
      rows[0] = member(
        "pic",
        grade,
        grade === "STAFF" ? "PREPARER" : "REVIEWER"
      );
      await expect(change()).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      });
      expect(tx.projectMember.update).not.toHaveBeenCalled();
    }
  );

  it("rejects stale PIC grants after a grade change", async () => {
    rows[0].user.globalRole = "STAFF";
    await expect(change()).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("lets a system administrator assign eligible leadership without project membership", async () => {
    tx.user.findUnique.mockResolvedValue({
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });

    await expect(
      change("manager", "MANAGER_IN_CHARGE", {
        ...actor,
        id: "admin",
        globalRole: "SUPER_ADMIN",
      })
    ).resolves.toMatchObject({ inChargeRole: "MANAGER_IN_CHARGE" });
    expect(tx.projectMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "manager" },
        data: expect.objectContaining({
          projectRole: "REVIEWER",
          inChargeRole: "MANAGER_IN_CHARGE",
        }),
      })
    );
  });

  it("requires current active account and target eligibility", async () => {
    rows[1].user.status = "DISABLED";
    await expect(change()).rejects.toMatchObject({
      response: expect.objectContaining({ code: "INVALID_IN_CHARGE_ROLE" }),
    });
    tx.user.findUnique.mockResolvedValue({
      globalRole: "PARTNER",
      status: "DISABLED",
    });
    await expect(change()).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("forbids self assignment and removal of the last effective PIC", async () => {
    await expect(change("pic", "PARTNER_IN_CHARGE")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    await expect(change("pic", null)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    rows.push(member("other-pic", "PRINCIPAL", "PARTNER", "PARTNER_IN_CHARGE"));
    await expect(change("pic", null)).resolves.toMatchObject({
      inChargeRole: null,
    });
  });

  it("recovers PIC only through the administrator path when no effective PIC exists", async () => {
    rows[0].user.status = "DISABLED";
    tx.user.findUnique.mockResolvedValue({
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    await expect(
      change(
        "principal",
        "PARTNER_IN_CHARGE",
        { ...actor, id: "admin" },
        "Former PIC unavailable"
      )
    ).resolves.toMatchObject({ inChargeRole: "PARTNER_IN_CHARGE" });
    expect(audit.logInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "PROJECT_PIC_RECOVERED",
        description: expect.stringContaining("Former PIC unavailable"),
      })
    );
  });

  it("denies recovery when a valid PIC remains or the caller is not an administrator", async () => {
    tx.user.findUnique.mockResolvedValue({
      globalRole: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    await expect(
      change(
        "principal",
        "PARTNER_IN_CHARGE",
        { ...actor, id: "admin" },
        "reason"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    rows[0].inChargeRole = null;
    tx.user.findUnique.mockResolvedValue({
      globalRole: "PRINCIPAL",
      status: "ACTIVE",
    });
    await expect(
      change(
        "principal",
        "PARTNER_IN_CHARGE",
        { ...actor, id: "admin" },
        "reason"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it.each(["ARCHIVED", "PENDING_FINAL_CHECK", "DELETED"])(
    "does not change leadership on %s projects",
    async (status) => {
      tx.project.findUnique.mockResolvedValue({ status });
      await expect(change()).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FORBIDDEN" }),
      });
      expect(tx.projectMember.update).not.toHaveBeenCalled();
    }
  );

  it("does not swallow an audit failure inside the transaction", async () => {
    audit.logInTransaction.mockRejectedValue(new Error("audit unavailable"));
    await expect(change()).rejects.toThrow("audit unavailable");
  });
});
