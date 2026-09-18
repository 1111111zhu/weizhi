import type { WorkItem, WorkItemDomain } from "@project-wing/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../auth/request-user";
import type { PrismaService } from "../prisma/prisma.service";
import type { WorkItemsSynchronizerService } from "./work-items-synchronizer.service";
import { WorkItemsService } from "./work-items.service";

const builders = vi.hoisted(() => ({
  cmp: vi.fn(),
  emp: vi.fn(),
  ops: vi.fn(),
  projectPersonal: vi.fn(),
  projectTeam: vi.fn(),
  tms: vi.fn(),
}));

vi.mock("./work-items-cmp", () => ({
  buildCmpPersonalWorkItems: builders.cmp,
}));
vi.mock("./work-items-emp", () => ({
  buildEmpPersonalWorkItems: builders.emp,
}));
vi.mock("./work-items-ops", () => ({
  buildOpsWorkItems: builders.ops,
}));
vi.mock("./work-items-project", () => ({
  buildProjectPersonalWorkItems: builders.projectPersonal,
  buildProjectTeamWorkItems: builders.projectTeam,
}));
vi.mock("./work-items-tms", () => ({
  buildTmsPersonalWorkItems: builders.tms,
}));

const user: RequestUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  globalRole: "STAFF",
};

describe(WorkItemsService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const builder of Object.values(builders)) {
      builder.mockResolvedValue([]);
    }
  });

  it.each([
    ["EMP", builders.emp],
    ["PROJECT", builders.projectPersonal],
    ["CMP", builders.cmp],
    ["TMS", builders.tms],
  ] as const)(
    "builds only the requested %s personal scope",
    async (scope, builder) => {
      builder.mockResolvedValue([workItem(scope)]);
      const { service, synchronizer } = createService();

      const response = await service.list(user, {
        view: "PERSONAL",
        scope,
        locale: "zh-CN",
      });

      expect(builder).toHaveBeenCalledOnce();
      const unrequestedBuilders = [
        builders.emp,
        builders.projectPersonal,
        builders.cmp,
        builders.tms,
        builders.ops,
      ].filter((candidate) => candidate !== builder);
      expect(
        unrequestedBuilders.every(
          (candidate) => candidate.mock.calls.length === 0
        )
      ).toBeTruthy();
      expect(response.counts).toMatchObject({ total: 1, [scope]: 1 });
      expect(synchronizer.syncForRead).toHaveBeenCalledOnce();
    }
  );

  it("limits a project scope to the requested project", async () => {
    const projectId = "project-1";
    const { service } = createService();

    await service.list(
      { ...user, globalRole: "SUPER_ADMIN" },
      {
        view: "PERSONAL",
        scope: "PROJECT",
        projectId,
        locale: "zh-CN",
      }
    );

    expect(builders.projectPersonal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: user.id }),
      "zh-CN",
      projectId
    );
  });

  it("rejects an unscoped personal query instead of generating every scope", async () => {
    const { service } = createService();

    await expect(
      service.list(user, { view: "PERSONAL", locale: "zh-CN" })
    ).rejects.toThrow("scope is required for personal work items");

    for (const builder of Object.values(builders)) {
      expect(builder).not.toHaveBeenCalled();
    }
  });
});

function createService() {
  const prisma = {} as PrismaService;
  const synchronizer = {
    syncForRead: vi.fn(),
  } as unknown as WorkItemsSynchronizerService;
  return {
    service: new WorkItemsService(prisma, synchronizer),
    synchronizer: synchronizer as unknown as {
      syncForRead: ReturnType<typeof vi.fn>;
    },
  };
}

function workItem(domain: WorkItemDomain): WorkItem {
  return {
    id: `${domain}-001:item-1`,
    ruleId: `${domain}-001`,
    domain,
    view: "PERSONAL",
    category: "TEST",
    state: "OPEN",
    severity: "ACTION_REQUIRED",
    priority: "NORMAL",
    title: `${domain} task`,
    description: `${domain} task`,
    subjectType: "TEST",
    subjectId: "item-1",
    project: null,
    reference: null,
    objectLabel: null,
    responsibleLabel: user.name,
    assignedTo: { id: user.id, name: user.name, email: user.email },
    createdBy: null,
    dueAt: null,
    openedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    actionTarget: {
      app: domain,
      resourceType: "TEST",
      resourceId: "item-1",
      params: {},
    },
  };
}
