import { canProjectMemberPerformAction } from "@project-wing/shared";
import type { ProjectPermissionSubject } from "@project-wing/shared";
import { z } from "zod";

export const mobileSignoffSchema = z.object({
  id: z.string(),
  target: z.string(),
  type: z.enum(["P", "R"]),
  round: z.number().int().positive(),
  userId: z.string(),
  userName: z.string(),
  signedAt: z.string(),
  revokedAt: z.string().optional(),
  revokedBy: z.string().optional(),
});
export type MobileSignoff = z.infer<typeof mobileSignoffSchema>;
export type MobileSignoffActor = ProjectPermissionSubject & {
  id: string;
  name: string;
};

export function currentMobileSignoffs(records: MobileSignoff[]) {
  const round = Math.max(1, ...records.map((item) => item.round));
  return records.filter((item) => item.round === round && !item.revokedAt);
}

/** Local specimen transition only; the real API must own authorization/version validation. */
export function applyMobileSignoff(
  records: MobileSignoff[],
  input: {
    target: string;
    actor: MobileSignoffActor;
    type: "P" | "R";
    now: string;
    id: string;
    confirmSelfReview?: boolean;
    mutable: boolean;
    complete: boolean;
  }
): { records: MobileSignoff[]; error?: string } {
  const { target, actor, type, now } = input;
  const scoped = records.filter((item) => item.target === target);
  const current = currentMobileSignoffs(scoped);
  const fail = (error: string) => ({ records, error });
  if (
    !input.mutable ||
    !canProjectMemberPerformAction(
      actor,
      type === "P" ? "signPreparer" : "reviewSignoff"
    )
  ) {
    return fail("当前没有签署权限");
  }
  if (!input.complete) {
    return fail("请先完成必填内容");
  }
  if (type === "R" && !current.some((item) => item.type === "P")) {
    return fail("请先完成 P 签署");
  }
  if (
    type === "R" &&
    current.some((item) => item.type === "P" && item.userId === actor.id) &&
    !input.confirmSelfReview
  ) {
    return fail("请确认自我复核");
  }
  if (
    type === "R" &&
    scoped.some(
      (item) =>
        item.type === "R" &&
        item.userId === actor.id &&
        !item.revokedAt &&
        Date.parse(now) - Date.parse(item.signedAt) < 86_400_000
    )
  ) {
    return fail("同一复核人需间隔 24 小时再次签署 R");
  }
  let round = Math.max(1, ...scoped.map((item) => item.round));
  if (
    type === "P" &&
    current.some((item) => item.type === "P") &&
    current.some((item) => item.type === "R")
  ) {
    round += 1;
  }
  return {
    records: [
      ...records,
      {
        id: input.id,
        target,
        type,
        round,
        userId: actor.id,
        userName: actor.name,
        signedAt: now,
      },
    ],
  };
}

export function canRevokeMobileSignoff(
  item: MobileSignoff,
  actor: MobileSignoffActor,
  mutable: boolean
) {
  return (
    mutable &&
    !item.revokedAt &&
    canProjectMemberPerformAction(
      actor,
      item.type === "P" ? "signPreparer" : "reviewSignoff"
    ) &&
    (item.type === "P" ||
      item.userId === actor.id ||
      actor.projectRole === "PARTNER")
  );
}

export function revokeMobileSignoff(
  records: MobileSignoff[],
  id: string,
  target: string,
  actor: MobileSignoffActor,
  now: string,
  mutable: boolean
) {
  const record = records.find(
    (item) => item.id === id && item.target === target
  );
  if (!record || !canRevokeMobileSignoff(record, actor, mutable)) {
    return { records, error: "当前无法撤销这条签署" };
  }
  return {
    records: records.map((item) =>
      item.id === id ? { ...item, revokedAt: now, revokedBy: actor.name } : item
    ),
  };
}
