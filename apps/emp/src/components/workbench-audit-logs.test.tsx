import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { AuditLog } from "../api/client";
import { WorkbenchAuditLogs } from "./workbench-audit-logs";

describe("lint test setup", () => {
  afterEach(cleanup);

  describe(WorkbenchAuditLogs, () => {
    it("renders the shared DataGrid with actor grade before the actor column", () => {
      render(createElement(WorkbenchAuditLogs, { copy: zhCopy, logs }));

      expect(screen.getByTestId("workbench-audit-logs-data-grid")).toBeTruthy();
      const headers = screen
        .getAllByRole("columnheader")
        .filter((header) => header.textContent?.trim());
      expect(headers.map((header) => header.textContent)).toStrictEqual([
        "时间",
        "动作",
        "描述",
        "职级",
        "操作者",
      ]);

      const dataRows = screen.getAllByRole("row").slice(1);
      expect(within(dataRows[0]).getByText("项目已创建")).toBeTruthy();
      expect(within(dataRows[0]).queryByText("Project Created")).toBeNull();
      expect(within(dataRows[0]).getByText("合伙人")).toBeTruthy();
      expect(within(dataRows[0]).getByText("Jony Ma")).toBeTruthy();
    });

    it("uses system for actor grade and actor when no actor exists", () => {
      const { container } = render(
        createElement(WorkbenchAuditLogs, {
          copy: zhCopy,
          logs: [
            {
              id: "log-system",
              action: "SYSTEM_CREATED",
              targetType: "SYSTEM",
              description: "系统创建项目",
              createdAt: "2026-05-28T09:00:00.000Z",
              actor: null,
            },
          ],
        })
      );
      // Scope to table body — filter dropdown also contains "系统" option.
      const tbody = container.querySelector("tbody");
      expect(tbody).not.toBeNull();
      expect(within(tbody as HTMLElement).getAllByText("系统")).toHaveLength(2);
    });

    it("filters records with the shadcn select controls", async () => {
      render(
        createElement(WorkbenchAuditLogs, {
          copy: zhCopy,
          logs: [
            ...logs,
            {
              id: "log-2",
              action: "LOGIN_SUCCESS",
              targetType: "USER",
              description: "经理登录",
              createdAt: "2026-05-28T10:00:00.000Z",
              actor: {
                id: "user-manager",
                name: "Mandy Chan",
                email: "manager@projectwing.local",
                globalRole: "MANAGER",
              },
            },
          ],
        })
      );

      fireEvent.click(screen.getByRole("combobox", { name: "操作者" }));
      fireEvent.click(
        await screen.findByRole("option", { name: "Mandy Chan" })
      );

      expect(screen.getByText("登录成功")).toBeTruthy();
      expect(screen.queryByText("项目已创建")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));

      expect(screen.getByText("登录成功")).toBeTruthy();
      expect(screen.getByText("项目已创建")).toBeTruthy();
    });
  });

  const zhCopy = {
    actor: "操作者",
    allActors: "全部操作者",
    role: "职级",
    allRoles: "全部职级",
    clearFilters: "清除筛选",
    recordSuffix: "条记录",
    time: "时间",
    action: "动作",
    description: "描述",
    noMatches: "没有匹配的记录",
    empty: "暂无审计日志",
    system: "系统",
    roleLabels: {
      PRINCIPAL: "Principal",
      TAX_EXPERT: "N/A",
      ASSISTANT: "Assistant",
      EQCR: "N/A",
      SUPER_ADMIN: "系统管理员",
      CONFIRMATION_OFFICER: "函证行政",
      PARTNER: "合伙人",
      MANAGER: "经理",
      SENIOR: "高级审计员",
      STAFF: "审计员",
    },
    actionLabels: {
      ATTACHMENT_LOCKED: "附件已锁定",
      ATTACHMENT_DELETED: "附件已删除",
      ATTACHMENT_RESTORED: "附件已恢复",
      ATTACHMENT_UNLOCKED: "附件已解锁",
      ATTACHMENT_UPLOADED: "附件已上传",
      ATTACHMENT_VERSION_UPLOADED: "附件版本已上传",
      ATTACHMENT_VERSION_DOWNLOADED: "Attachment version downloaded",
      ATTACHMENT_VERSION_RESTORED: "Attachment version restored",
      DECLARATION_ACCEPTED: "独立性声明已确认",
      INVITATION_CREATED: "邀请已创建",
      LOGIN_SUCCESS: "登录成功",
      PASSWORD_RESET: "密码已重置",
      PROJECT_ARCHIVED: "项目已归档",
      PROJECT_SUBMITTED_FOR_ARCHIVE: "提交归档审核",
      PROJECT_REOPENED: "打回归档项目",
      PROJECT_FINAL_ARCHIVE_CONFIRMED: "确认完成归档",
      PROJECT_CREATED: "项目已创建",
      PROJECT_JOINED: "项目已加入",
      PROJECT_MEMBER_IN_CHARGE_UPDATED: "项目成员 In Charge 已更新",
      PROJECT_MEMBER_REMOVED: "项目成员已移除",
      PROJECT_MEMBER_ROLE_UPDATED: "项目成员职责已更新",
      PROJECT_PLACEMENT_MOVED: "项目位置已移动",
      USER_CREATED: "用户已创建",
      USER_UPDATED: "用户已更新",
      WORKFLOW_NODE_CREATED: "目录节点已创建",
      WORKFLOW_NODE_DELETED: "目录节点已删除",
      WORKFLOW_NODE_UPDATED: "目录节点已更新",
      WORKING_PAPER_ASSIGNEES_UPDATED: "底稿负责人已更新",
      WORKING_PAPER_CREATED: "底稿已创建",
      WORKING_PAPER_PREPARED: "底稿已编制",
      WORKING_PAPER_QUESTION_CLEARED: "复核问题已清除",
      WORKING_PAPER_QUESTION_CREATED: "复核问题已创建",
      WORKING_PAPER_QUESTION_FOLLOWED_UP: "复核问题已追问",
      WORKING_PAPER_QUESTION_REOPENED: "复核问题已重开",
      WORKING_PAPER_QUESTION_REPLIED: "复核问题已回复",
      WORKING_PAPER_RETURNED: "底稿已退回",
      WORKING_PAPER_REVIEWED: "底稿已复核",
      WORKSPACE_CREATED: "工作区已创建",
      WORKSPACE_UPDATED: "工作区已更新",
    },
  };
  const logs: AuditLog[] = [
    {
      id: "log-1",
      action: "PROJECT_CREATED",
      targetType: "PROJECT",
      description: "创建项目 AUD-2026-0001",
      createdAt: "2026-05-28T09:00:00.000Z",
      actor: {
        id: "user-partner",
        name: "Jony Ma",
        email: "partner@projectwing.local",
        globalRole: "PARTNER",
      },
    },
  ];
});
