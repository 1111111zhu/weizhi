import { describe, it, expect, vi } from "vitest";

import { MembersController } from "./members.controller";

describe("explicit PIC recovery route", () => {
  it("rejects role injection and missing reasons on the dedicated recovery invitation route", () => {
    const createPicRecoveryInvitation = vi.fn();
    const controller = new MembersController({
      createPicRecoveryInvitation,
    } as never);
    for (const body of [
      { recipientUserId: "candidate", reason: " " },
      {
        recipientUserId: "candidate",
        reason: "Recovery",
        invitedRole: "REVIEWER",
      },
    ]) {
      expect(() =>
        controller.createPicRecoveryInvitation(
          "p",
          body,
          { id: "admin" } as never,
          {}
        )
      ).toThrow("请选择收件人并填写恢复原因");
    }
    expect(createPicRecoveryInvitation).not.toHaveBeenCalled();
  });

  it("requires a nonempty recovery reason before dispatch", () => {
    const recoverProjectPic = vi.fn();
    const controller = new MembersController({ recoverProjectPic } as never);
    expect(() =>
      controller.recoverProjectPic(
        "p",
        "m",
        { reason: " " },
        { id: "admin" } as never,
        {}
      )
    ).toThrow("请填写恢复 PIC 的原因");
    expect(recoverProjectPic).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and authenticated actor to the checked service", () => {
    const recoverProjectPic = vi.fn();
    const controller = new MembersController({ recoverProjectPic } as never);
    const actor = { id: "admin" };
    controller.recoverProjectPic(
      "p",
      "m",
      { reason: " recovery " },
      actor as never,
      {}
    );
    expect(recoverProjectPic).toHaveBeenCalledWith(
      "p",
      "m",
      actor,
      { reason: "recovery" },
      {}
    );
  });
});
