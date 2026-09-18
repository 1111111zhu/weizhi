import { requirePicRecoveryInvitation } from "./pic-recovery-invitation";

function fixture() {
  const actor = { globalRole: "SUPER_ADMIN", status: "ACTIVE" };
  const recipient = {
    globalRole: "PRINCIPAL",
    status: "ACTIVE",
    email: "candidate@example.test",
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE" }) },
    user: {
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(where.id === "admin" ? actor : recipient)
      ),
    },
    projectMember: { findMany: vi.fn().mockResolvedValue([]) },
    projectInvitation: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const run = () =>
    requirePicRecoveryInvitation(
      tx as never,
      "project",
      "admin",
      "candidate",
      "candidate@example.test"
    );
  return { tx, actor, recipient, run };
}

describe("PIC recovery invitation authorization", () => {
  it("allows an active administrator to invite an eligible unjoined candidate under project/account locks", async () => {
    const { tx, run } = fixture();
    await expect(run()).resolves.toBeUndefined();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.projectInvitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING" }),
      })
    );
  });

  it.each(["MANAGER", "PARTNER", "STAFF"])(
    "denies %s rather than granting ordinary invitation rights",
    async (role) => {
      const { actor, run } = fixture();
      actor.globalRole = role;
      await expect(run()).rejects.toThrow("当前不能发起 PIC 恢复邀请");
    }
  );

  it.each(["STAFF", "MANAGER", "SUPER_ADMIN"])(
    "denies an ineligible %s recipient",
    async (role) => {
      const { recipient, run } = fixture();
      recipient.globalRole = role;
      await expect(run()).rejects.toThrow(
        "请选择未加入项目的 Partner 或 Principal"
      );
    }
  );

  it("rejects disabled or changed-email recipients", async () => {
    const { recipient, run } = fixture();
    recipient.status = "DISABLED";
    await expect(run()).rejects.toThrow(
      "请选择未加入项目的 Partner 或 Principal"
    );
    recipient.status = "ACTIVE";
    recipient.email = "changed@example.test";
    await expect(run()).rejects.toThrow(
      "请选择未加入项目的 Partner 或 Principal"
    );
  });

  it.each(["PARTNER_IN_CHARGE", null])(
    "rejects an existing eligible joined member with leadership %s",
    async (inChargeRole) => {
      const { tx, run } = fixture();
      tx.projectMember.findMany.mockResolvedValue([
        {
          userId: "joined",
          projectRole: "PARTNER",
          inChargeRole,
          user: { globalRole: "PARTNER", status: "ACTIVE" },
        },
      ]);
      await expect(run()).rejects.toThrow(
        inChargeRole ? "项目已有有效 PIC" : "请从已加入的合资格成员中恢复 PIC"
      );
    }
  );

  it("rejects duplicate pending invitations and deleted projects", async () => {
    const { tx, run } = fixture();
    tx.projectInvitation.findFirst.mockResolvedValue({ id: "pending" });
    await expect(run()).rejects.toThrow("该用户已有待处理邀请");
    tx.projectInvitation.findFirst.mockResolvedValue(null);
    tx.project.findUnique.mockResolvedValue({ status: "DELETED" });
    await expect(run()).rejects.toThrow("当前不能发起 PIC 恢复邀请");
  });
});
