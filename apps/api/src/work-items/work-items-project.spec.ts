import type { WorkItem } from "@project-wing/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { buildOpsWorkItems } from "./work-items-ops";
import {
  isPersonalProjectItem,
  projectPersonalProjection,
  buildProjectTeamWorkItems,
  buildProjectPersonalWorkItems,
} from "./work-items-project";

describe(isPersonalProjectItem, () => {
  it("keeps incomplete SmartForms in the project team view", () => {
    expect(
      isPersonalProjectItem(
        projectItem({
          ruleId: "PRJ-010",
          assignedTo: {
            id: "smart-form-creator",
            name: "SmartForm creator",
            email: "creator@example.com",
          },
        }),
        "smart-form-creator"
      )
    ).toBeFalsy();
  });

  it("keeps explicitly assigned project work in the personal view", () => {
    expect(
      isPersonalProjectItem(
        projectItem({
          ruleId: "PRJ-001",
          assignedTo: {
            id: "assignee-1",
            name: "Assignee",
            email: "assignee@example.com",
          },
        }),
        "assignee-1"
      )
    ).toBeTruthy();
  });

  it("excludes legacy preview infrastructure tasks even when assigned to the user", () => {
    expect(
      isPersonalProjectItem(
        projectItem({
          ruleId: "PRJ-015",
          assignedTo: {
            id: "assignee-1",
            name: "Assignee",
            email: "assignee@example.com",
          },
        }),
        "assignee-1"
      )
    ).toBeFalsy();
  });

  it("routes terminal preview failures only to operations without hiding signoff tasks", async () => {
    const user = {
      id: "assignee-1",
      name: "Assignee",
      email: "assignee@example.com",
      globalRole: "STAFF" as const,
    };
    const now = new Date("2026-09-06T00:00:00Z");
    const project = {
      id: "project-1",
      name: "Audit project",
      projectCode: "AUD-1",
      status: "ACTIVE",
      archiveDeadline: new Date(Date.now() + 30 * 86_400_000),
      members: [],
      createdAt: now,
      updatedAt: now,
    };
    const attachment = {
      id: "attachment-1",
      fileName: "minutes.docx",
      workingPaperId: "paper-1",
      projectId: project.id,
      project,
      createdAt: now,
      updatedAt: now,
      previewUpdatedAt: now,
      previewStatus: "FAILED",
      previewAttemptCount: 5,
      previewError:
        "EACCES: permission denied, mkdir /data/uploads/document-previews/id",
      preparer: user,
      lastModifier: user,
      signoffs: [],
    };
    const empty = () => ({ findMany: vi.fn().mockResolvedValue([]) });
    const prisma = {
      project: { findUnique: vi.fn().mockResolvedValue(project) },
      attachment: { findMany: vi.fn().mockResolvedValue([attachment]) },
      workingPaperQuestion: empty(),
      zipMasterSession: empty(),
      auditLog: empty(),
      tmsPendingLinkSubmission: empty(),
      userMailConnection: empty(),
      systemConnection: empty(),
      projectArchiveJob: empty(),
      projectFileExportJob: empty(),
    } as unknown as PrismaService;

    const team = await buildProjectTeamWorkItems(
      prisma,
      user,
      project.id,
      "zh-CN"
    );
    const personal = await buildProjectPersonalWorkItems(
      prisma,
      user,
      "zh-CN",
      project.id
    );
    expect(team.map((item) => item.ruleId)).toStrictEqual([
      "PRJ-001",
      "PRJ-002",
      "EMP-005",
    ]);
    expect(personal.map((item) => item.ruleId)).toStrictEqual(["PRJ-001"]);
    expect(JSON.stringify([...team, ...personal])).not.toMatch(
      /EACCES|document-previews|PRJ-015/
    );
    await expect(
      buildOpsWorkItems(prisma, user, "zh-CN")
    ).resolves.toStrictEqual([]);
    const ops = await buildOpsWorkItems(
      prisma,
      { ...user, globalRole: "SUPER_ADMIN" },
      "zh-CN"
    );
    expect(ops).toStrictEqual([
      expect.objectContaining({
        ruleId: "OPS-005",
        domain: "OPS",
        view: "OPS",
        assignedTo: null,
        description: attachment.previewError,
      }),
    ]);
    expect(prisma.workingPaperQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: project.id,
          status: { not: "CLEARED" },
          OR: [
            { attachmentId: null },
            { attachment: { is: { deletedAt: null } } },
          ],
        },
      })
    );
    expect(prisma.zipMasterSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ attachment: { deletedAt: null } }),
      })
    );
  });

  it("explains why an invalid sign-off sequence is assigned to the reviewer", () => {
    const item = projectPersonalProjection(
      projectItem({
        ruleId: "PRJ-003",
        assignedTo: {
          id: "reviewer-1",
          name: "Reviewer",
          email: "reviewer@example.com",
        },
      }),
      "zh-CN",
      "reviewer-1"
    );

    expect(item.view).toBe("PERSONAL");
    expect(item.title).toBe(
      "你已复核签核的文件“Audit Programme.sf”签核顺序已失效，请重新完成复核签核。"
    );
  });

  it("distinguishes questions opened by the user from questions assigned to them", () => {
    const opened = projectPersonalProjection(
      projectItem({
        ruleId: "PRJ-005",
        assignedTo: null,
        createdBy: {
          id: "creator-1",
          name: "Creator",
          email: "creator@example.com",
        },
      }),
      "zh-CN",
      "creator-1"
    );
    const assigned = projectPersonalProjection(
      projectItem({
        ruleId: "PRJ-005",
        assignedTo: {
          id: "assignee-1",
          name: "Assignee",
          email: "assignee@example.com",
        },
      }),
      "zh-CN",
      "assignee-1"
    );

    expect(opened.title).toContain("你在文件“Audit Programme.sf”下发起");
    expect(assigned.title).toContain("已分配给你");
  });
});

function projectItem({
  ruleId,
  assignedTo,
  createdBy = null,
}: {
  ruleId: WorkItem["ruleId"];
  assignedTo: WorkItem["assignedTo"];
  createdBy?: WorkItem["createdBy"];
}): WorkItem {
  return {
    id: `${ruleId}:attachment-1`,
    ruleId,
    domain: "PROJECT",
    view: "TEAM",
    category: "SMART_FORM",
    state: "BLOCKED",
    severity: "BLOCKER",
    priority: "HIGH",
    title: "Incomplete SmartForm",
    description: "Required rules are incomplete",
    subjectType: "ATTACHMENT",
    subjectId: "attachment-1",
    project: {
      id: "project-1",
      projectCode: "AUD-2026-001",
      name: "Audit project",
    },
    reference: null,
    objectLabel: "Audit Programme.sf",
    responsibleLabel: assignedTo?.name ?? "Project team",
    assignedTo,
    createdBy,
    dueAt: null,
    openedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    actionTarget: {
      app: "PROJECT",
      resourceType: "ATTACHMENT",
      resourceId: "attachment-1",
      params: { projectId: "project-1" },
    },
  };
}
