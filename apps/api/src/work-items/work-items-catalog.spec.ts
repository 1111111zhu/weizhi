import { readFileSync } from "node:fs";

import {
  IMPLEMENTED_WORK_ITEM_RULE_IDS,
  NON_WORK_ITEM_RULE_IDS,
} from "@project-wing/shared";
import { describe, expect, it } from "vitest";

const PROJECTOR_FILES = [
  "work-items-emp.ts",
  "work-items-project.ts",
  "work-items-cmp.ts",
  "work-items-tms.ts",
  "work-items-ops.ts",
];

describe("work-item projector catalog", () => {
  const source = PROJECTOR_FILES.map((file) =>
    readFileSync(`src/work-items/${file}`, "utf-8")
  ).join("\n");
  const projectedRuleIds = new Set(
    source.match(/\b(?:EMP|PRJ|CMP|TMS|OPS)-\d{3}\b/g)
  );

  it("implements every approved rule in a domain projector", () => {
    expect([...projectedRuleIds].sort()).toStrictEqual(
      [...IMPLEMENTED_WORK_ITEM_RULE_IDS].sort()
    );
  });

  it("does not create work items for merged findings or warnings", () => {
    expect(
      NON_WORK_ITEM_RULE_IDS.filter((ruleId) => projectedRuleIds.has(ruleId))
    ).toStrictEqual([]);
  });

  it("keeps work-item copy action-led and avoids middle-dot object separators", () => {
    expect(source).not.toContain(" · ");
    expect(source).not.toContain("请尽快处理");
    expect(source).not.toContain("Please address it promptly");
    expect(source).not.toMatch(/承接申请等待 (?:MIC|PIC|IT) 审批/);
  });
});
