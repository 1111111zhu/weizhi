import { describe, expect, it } from "vitest";

import {
  applyMobileSignoff,
  currentMobileSignoffs,
  revokeMobileSignoff,
} from "./mobile-signoff-model";
import type { MobileSignoff, MobileSignoffActor } from "./mobile-signoff-model";
import { decodeMobileState, emptyMobileState } from "./mobile-workspace-model";

const actor: MobileSignoffActor = {
  id: "alex",
  name: "Alex",
  globalRole: "MANAGER",
  projectRole: "REVIEWER",
};
const input = {
  target: "orchid:bank-reply",
  actor,
  type: "P" as const,
  id: "p1",
  now: "2026-09-10T00:00:00.000Z",
  mutable: true,
  complete: true,
};
const prepared = () => applyMobileSignoff([], input).records;

describe("isolated mobile signoff preview", () => {
  it("appends repeated P signatures and revokes only the selected record", () => {
    const first = prepared();
    const second = applyMobileSignoff(first, {
      ...input,
      id: "p2",
      now: "2026-09-10T00:01:00.000Z",
    });
    expect(second.error).toBeUndefined();
    expect(second.records).toHaveLength(2);
    expect(second.records[0]).toStrictEqual(first[0]);
    expect(currentMobileSignoffs(second.records)).toHaveLength(2);
    const revoked = revokeMobileSignoff(
      second.records,
      "p2",
      input.target,
      actor,
      input.now,
      true
    );
    expect(
      currentMobileSignoffs(revoked.records).map((record) => record.id)
    ).toStrictEqual(["p1"]);
    expect(revoked.records).toHaveLength(2);
  });

  it("migrates old preview data without treating viewed files as signatures", () => {
    const old = { ...emptyMobileState(), reviewed: [input.target] };
    delete (old as { signoffs?: MobileSignoff[] }).signoffs;
    expect(decodeMobileState(JSON.stringify(old)).signoffs).toStrictEqual([]);
  });

  it("blocks review without P and requires explicit self-review confirmation", () => {
    expect(applyMobileSignoff([], { ...input, type: "R" }).error).toBe(
      "请先完成 P 签署"
    );
    expect(applyMobileSignoff(prepared(), { ...input, type: "R" }).error).toBe(
      "请确认自我复核"
    );
    expect(
      applyMobileSignoff(prepared(), {
        ...input,
        type: "R",
        id: "r1",
        confirmSelfReview: true,
      }).error
    ).toBeUndefined();
  });

  it("keeps files and projects isolated", () => {
    expect(
      applyMobileSignoff(prepared(), {
        ...input,
        target: "harbour:bank-reply",
        type: "R",
        confirmSelfReview: true,
      }).error
    ).toBe("请先完成 P 签署");
  });

  it("checks permissions, project mutability and completion again at submission", () => {
    expect(
      applyMobileSignoff([], { ...input, mutable: false }).error
    ).toBeTruthy();
    expect(
      applyMobileSignoff([], { ...input, complete: false }).error
    ).toBeTruthy();
    expect(
      applyMobileSignoff([], {
        ...input,
        actor: { ...actor, authorizationSuspended: true },
      }).error
    ).toBeTruthy();
  });

  it("preserves previous rounds and enforces the same reviewer cooldown", () => {
    const reviewed = applyMobileSignoff(prepared(), {
      ...input,
      type: "R",
      id: "r1",
      confirmSelfReview: true,
    }).records;
    expect(
      applyMobileSignoff(reviewed, {
        ...input,
        type: "R",
        confirmSelfReview: true,
      }).error
    ).toContain("24 小时");
    const next = applyMobileSignoff(reviewed, { ...input, id: "p2" }).records;
    expect(next).toHaveLength(3);
    expect(currentMobileSignoffs(next)).toMatchObject([{ id: "p2", round: 2 }]);
  });

  it("checks revoke ownership and retains a revoked record", () => {
    const reviewed = applyMobileSignoff(prepared(), {
      ...input,
      type: "R",
      id: "r1",
      confirmSelfReview: true,
    }).records;
    expect(
      revokeMobileSignoff(
        reviewed,
        "r1",
        input.target,
        { ...actor, id: "other" },
        input.now,
        true
      ).error
    ).toBeTruthy();
    expect(
      revokeMobileSignoff(reviewed, "r1", "other:file", actor, input.now, true)
        .error
    ).toBeTruthy();
    const revoked = revokeMobileSignoff(
      reviewed,
      "r1",
      input.target,
      actor,
      input.now,
      true
    );
    expect(revoked.records.find((item) => item.id === "r1")?.revokedAt).toBe(
      input.now
    );
    expect(currentMobileSignoffs(revoked.records)).toHaveLength(1);
  });
});
