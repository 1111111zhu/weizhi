import { describe, it, expect } from "vitest";

import { projectAuthorizationImpact } from "./project-authorization-impact";

const grant = {
  id: "m1",
  projectId: "p1",
  projectRole: "PARTNER" as const,
  inChargeRole: "PARTNER_IN_CHARGE" as const,
  updatedAt: new Date("2026-09-01"),
  project: { projectCode: "P1", name: "Project one" },
};
describe("grade-change authorization impact", () => {
  it("includes incompatible grants and binds confirmation to the selected grade and grant version", () => {
    const impact = projectAuthorizationImpact("STAFF", [grant]);
    expect(impact.projects).toStrictEqual([
      {
        memberId: "m1",
        projectId: "p1",
        projectCode: "P1",
        projectName: "Project one",
      },
    ]);
    expect(projectAuthorizationImpact("MANAGER", [grant]).token).not.toBe(
      impact.token
    );
    expect(
      projectAuthorizationImpact("STAFF", [
        { ...grant, updatedAt: new Date("2026-09-02") },
      ]).token
    ).not.toBe(impact.token);
  });

  it("does not restore already suspended grants or flag compatible responsibilities", () => {
    expect(
      projectAuthorizationImpact("PARTNER", [grant]).projects
    ).toHaveLength(0);
    expect(
      projectAuthorizationImpact("STAFF", [
        { ...grant, authorizationSuspendedAt: new Date() },
      ]).projects
    ).toHaveLength(0);
  });

  it("does not revive a pre-migration invalid grant just by changing the grade back", () => {
    expect(
      projectAuthorizationImpact("PARTNER", [grant], "STAFF").projects
    ).toHaveLength(1);
  });
});
