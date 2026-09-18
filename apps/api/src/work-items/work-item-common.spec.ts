import type { WorkItem } from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import { finalizeWorkItems, workItem } from "./work-item-common";

function item(input: {
  id: string;
  domain?: "PROJECT" | "EMP";
  category?: string;
  severity?: "BLOCKER" | "ACTION_REQUIRED";
  updatedAt?: string;
}) {
  return workItem({
    id: input.id,
    ruleId: input.id.split(":")[0] as WorkItem["ruleId"],
    domain: input.domain ?? "PROJECT",
    view: "TEAM",
    category: input.category ?? "REVIEW",
    state: "OPEN",
    severity: input.severity ?? "BLOCKER",
    priority: "HIGH",
    title: input.id,
    description: input.id,
    subjectType: "TEST",
    subjectId: input.id,
    project: { id: "project-1", projectCode: "AUD-1", name: "Audit" },
    reference: null,
    objectLabel: null,
    responsibleLabel: "Project team",
    assignedTo: null,
    createdBy: null,
    dueAt: null,
    openedAt: "2026-08-20T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-08-21T00:00:00.000Z",
    actionTarget: {
      app: "PROJECT",
      resourceType: "TEST",
      resourceId: input.id,
      params: { projectId: "project-1" },
    },
  });
}

describe(finalizeWorkItems, () => {
  it("deduplicates projections and produces category and domain counts", () => {
    const response = finalizeWorkItems(
      [
        item({ id: "PRJ-005:q-1" }),
        item({
          id: "PRJ-005:q-1",
          updatedAt: "2026-08-22T00:00:00.000Z",
        }),
        item({
          id: "EMP-007:project-1",
          domain: "EMP",
          category: "PROJECT_PROCESS",
          severity: "ACTION_REQUIRED",
        }),
      ],
      "zh-CN"
    );

    expect(response.items).toHaveLength(2);
    expect(response.counts).toMatchObject({
      total: 2,
      PROJECT: 1,
      EMP: 1,
    });
    expect(response.categories).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "REVIEW", total: 1, blockers: 1 }),
        expect.objectContaining({
          category: "PROJECT_PROCESS",
          total: 1,
          blockers: 0,
        }),
      ])
    );
  });
});
