import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WorkItemBoardItem } from "./work-item-board";
import {
  appendBeforeSentenceEnd,
  groupWorkItemsByTimeline,
  workItemActionLabel,
  workItemDetail,
  ProjectWingWorkItemList,
} from "./work-item-board";

describe("deleted work-item dependencies", () => {
  it("does not offer navigation for a deleted dependency", () => {
    const item = workItem("deleted-file-task", "2026-09-06T00:00:00Z");
    item.actionTarget.params.unavailable = true;
    const markup = renderToStaticMarkup(
      <ProjectWingWorkItemList items={[item]} locale="zh-CN" onOpen={vi.fn()} />
    );
    expect(markup).toContain("关联文件已删除");
    expect(markup).not.toContain("<button");
  });
});

function workItem(id: string, updatedAt: string): WorkItemBoardItem {
  return {
    id,
    ruleId: "PRJ-005",
    domain: "PROJECT",
    view: "PERSONAL",
    category: "REVIEW",
    state: "OPEN",
    severity: "ACTION_REQUIRED",
    priority: "NORMAL",
    title: id,
    description: id,
    subjectType: "REVIEW_QUESTION",
    subjectId: id,
    reference: null,
    objectLabel: null,
    responsibleLabel: "Current user",
    assignedTo: null,
    createdBy: null,
    dueAt: null,
    openedAt: updatedAt,
    updatedAt,
    project: null,
    actionTarget: {
      app: "PROJECT",
      resourceType: "REVIEW_QUESTION",
      resourceId: id,
      params: {},
    },
  };
}

describe(groupWorkItemsByTimeline, () => {
  it("groups lifecycle updates into decreasing recency buckets", () => {
    const groups = groupWorkItemsByTimeline(
      [
        workItem("earlier", "2026-08-20T09:00:00.000+08:00"),
        workItem("today", "2026-08-31T09:00:00.000+08:00"),
        workItem("last-week", "2026-08-26T09:00:00.000+08:00"),
        workItem("yesterday", "2026-08-30T09:00:00.000+08:00"),
      ],
      "zh-CN",
      new Date("2026-08-31T12:00:00.000+08:00")
    );

    expect(
      groups.map((group) => group.items.map((item) => item.id))
    ).toStrictEqual([["today"], ["yesterday"], ["last-week"], ["earlier"]]);
  });
});

describe(appendBeforeSentenceEnd, () => {
  it("keeps terminal punctuation after appended assignment context", () => {
    const result = appendBeforeSentenceEnd(
      "The review question remains open.",
      " (assigned to Jony Ma)",
      "en-US"
    );

    expect(result.endsWith(".")).toBeTruthy();
    expect(result.indexOf("assigned") < result.length - 1).toBeTruthy();
  });
});

describe(workItemDetail, () => {
  it("shows an explanation but suppresses repeated object text", () => {
    const item = workItem("CMP-003:item", "2026-08-31T09:00:00.000+08:00");
    item.title = "审批承接申请（客户承接申请，CA-001）";
    item.objectLabel = "客户承接申请";
    item.reference = "CA-001";
    item.description = "该申请正在等待你的 MIC 审批。";

    expect(workItemDetail(item)).toBe("该申请正在等待你的 MIC 审批。");
    item.description = item.objectLabel;
    expect(workItemDetail(item)).toBeNull();
  });
});

describe(workItemActionLabel, () => {
  it("uses a task-specific action instead of a generic go label", () => {
    const approval = workItem("CMP-003:item", "2026-08-31T09:00:00.000+08:00");
    approval.ruleId = "CMP-003";
    approval.domain = "CMP";
    expect(workItemActionLabel(approval, "zh-CN")).toBe("去审批");

    const timesheet = workItem("TMS-001:item", "2026-08-31T09:00:00.000+08:00");
    timesheet.ruleId = "TMS-001";
    timesheet.domain = "TMS";
    expect(workItemActionLabel(timesheet, "zh-CN")).toBe("去填报");

    const operations = workItem(
      "OPS-001:item",
      "2026-08-31T09:00:00.000+08:00"
    );
    operations.ruleId = "OPS-001";
    operations.domain = "OPS";
    expect(workItemActionLabel(operations, "zh-CN")).toBe("查看详情");
  });
});
