import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { Prisma } from "@prisma/client";
import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import JSZip from "jszip";
import type { MockedFunction } from "vitest";

import { ApiForbiddenException } from "../common/api-error";
import { XLSX } from "../common/xlsx";
import { spreadsheetWorkbookReader } from "./spreadsheet-workbook-reader";
import {
  buildAttachmentZipEntryPath,
  buildSmartFormPdfPreviewCacheKey,
  buildTree,
  buildUniqueWorkflowNodeTitle,
  canDeleteWorkflowNodeLevel,
  getCreatableChildLevel,
  WorkflowService,
} from "./workflow.service";

const { join, posix } = pathModule;

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof XLSX>("xlsx");
  return {
    ...actual,
    readFile: vi.fn((...args: Parameters<typeof actual.readFile>) =>
      actual.readFile(...args)
    ),
  };
});

let actualXlsx: typeof XLSX;

describe("xlsx setup", () => {
  beforeAll(async () => {
    actualXlsx = await vi.importActual<typeof XLSX>("xlsx");
  });

  it("loads the xlsx module", () => {
    expect(actualXlsx).toBeDefined();
  });
});

describe(buildTree, () => {
  it("nests workflow nodes under their parents", () => {
    const roots = buildTree([
      {
        id: "phase",
        projectId: "p1",
        parentId: null,
        level: 1,
        code: "Planning",
        title: "Planning",
        nodeType: "PHASE",
        sortOrder: 1,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "account",
        projectId: "p1",
        parentId: "phase",
        level: 2,
        code: "A01",
        title: "A01",
        nodeType: "ACCOUNT",
        sortOrder: 1,
        createdBy: "u1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0].children?.[0].code).toBe("A01");
  });
});

describe(buildAttachmentZipEntryPath, () => {
  it("sanitizes unsafe names and stops cyclic workflow ancestry", () => {
    const entryPath = buildAttachmentZipEntryPath({
      attachment: {
        workflowNodeId: "child",
        workingPaper: { code: "A1-F001", workflowNodeId: "child" },
      },
      project: {
        projectCode: "ENG/../2026",
        name: "Audit:*?<>|",
      },
      workflowNodes: [
        {
          id: "parent",
          parentId: "child",
          code: "..",
          title: "Planning",
        },
        {
          id: "child",
          parentId: "parent",
          code: "A/1000",
          title: "Cash",
        },
      ],
      fileName: "../report?.xlsx",
    });

    expect(entryPath).not.toContain("\\");
    expect(entryPath.split("/")).not.toContain("..");
    expect(entryPath).toBe("ENG_.._2026 - Audit______/_/A_1000/file");
  });
});

describe(buildSmartFormPdfPreviewCacheKey, () => {
  it("changes when a review question changes without changing the SmartForm", () => {
    const question = {
      id: "question-1",
      body: "Explain the variance.",
      status: "OPEN",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    expect(
      buildSmartFormPdfPreviewCacheKey({ version: 3 }, null, [question])
    ).not.toBe(
      buildSmartFormPdfPreviewCacheKey({ version: 3 }, null, [
        {
          ...question,
          status: "REPLIED",
          updatedAt: "2026-08-01T01:00:00.000Z",
        },
      ])
    );
  });

  it("changes when the current PDF sign-off roster changes", () => {
    const preparer = {
      type: "PREPARER" as const,
      userName: "Jony Ma",
      signedAt: "2026-09-01T08:00:00.000Z",
    };

    expect(
      buildSmartFormPdfPreviewCacheKey({ version: 3 }, null, [], [preparer])
    ).not.toBe(
      buildSmartFormPdfPreviewCacheKey(
        { version: 3 },
        null,
        [],
        [
          preparer,
          {
            type: "REVIEWER",
            userName: "Eden Chan",
            signedAt: "2026-09-02T08:00:00.000Z",
          },
        ]
      )
    );
  });
});

describe("workflow node edit rules", () => {
  it("allows all directory levels to be deleted", () => {
    expect(canDeleteWorkflowNodeLevel(1)).toBeTruthy();
    expect(canDeleteWorkflowNodeLevel(2)).toBeTruthy();
    expect(canDeleteWorkflowNodeLevel(3)).toBeTruthy();
    expect(canDeleteWorkflowNodeLevel(4)).toBeTruthy();
  });

  it("allows creating folders at arbitrary depth", () => {
    expect(getCreatableChildLevel(null)).toBe(1);
    expect(getCreatableChildLevel(1)).toBe(2);
    expect(getCreatableChildLevel(2)).toBe(3);
    expect(getCreatableChildLevel(3)).toBe(4);
    expect(getCreatableChildLevel(7)).toBe(8);
  });
});

describe(buildUniqueWorkflowNodeTitle, () => {
  it("keeps a title that is not already used by a sibling", () => {
    expect(buildUniqueWorkflowNodeTitle("Planning", ["Execution"])).toBe(
      "Planning"
    );
  });

  it("adds the next full-width numeric suffix for duplicate sibling titles", () => {
    expect(
      buildUniqueWorkflowNodeTitle("Planning", ["Planning", "Planning（2）"])
    ).toBe("Planning（3）");
  });
});

type PrivateWorkflowService = Record<string, (...args: unknown[]) => unknown>;

let signoffEvents: Record<string, unknown>[] = [];

const prisma = {
  confirmationEmpImportItem: { findMany: vi.fn(), findFirst: vi.fn() },
  confirmationFollowUpEvent: { createMany: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  workItemRecord: { findMany: vi.fn(), update: vi.fn() },
  project: {
    findUnique: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
  },
  workingPaper: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  workflowNode: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  workingPaperSignoff: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  workingPaperQuestion: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  workingPaperQuestionMessage: {
    create: vi.fn(),
  },
  workingPaperQuestionMessageImage: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  attachment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  attachmentVersion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  smartFormInstance: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  desktopMasterGrant: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  desktopCheckInIdempotency: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

const access = {
  requireProjectMember: vi.fn(),
  requireMutableProject: vi.fn(),
  requireProjectRole: vi.fn(),
  requireProjectAction: vi.fn(),
  requireActiveProject: vi.fn(),
};

const auditLogs = {
  log: vi.fn(),
};

const documentConversion = {
  getAttachmentPreviewPdf: vi.fn(),
  clearAttachmentPreviewCache: vi.fn(),
};

const pdfRasterPreview = {
  getAttachmentRasterPreviewManifest: vi.fn(),
  getAttachmentRasterPreviewPage: vi.fn(),
  readCachedAttachmentRasterPreviewManifest: vi.fn(),
  readCachedAttachmentRasterPreviewPage: vi.fn(),
};

const smartFormPdf = {
  renderSmartFormV2Pdf: vi.fn(),
};

const inbox = {
  createCollaborationMessage: vi.fn(),
};

function hashTestSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildWorkflowSmartFormPackage() {
  return {
    packageType: "PROJECT_WING_SMART_FORM",
    formatVersion: 2,
    template: {
      id: "template-1",
      versionId: "version-1",
      code: "SF-1",
      title: "Daily living form",
      publishedAt: "2026-06-01T00:00:00.000Z",
      language: "en-US",
    },
    definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
    response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
  };
}

describe("working paper document workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    signoffEvents = [];
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([]);
    access.requireActiveProject.mockResolvedValue(undefined as never);
    access.requireProjectAction.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.confirmationEmpImportItem.findMany.mockResolvedValue([
      {
        id: "import-1",
        confirmationId: "confirmation-1",
        sourceFileName: "reply.pdf",
      },
    ]);
    prisma.workItemRecord.findMany.mockResolvedValue([]);
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.desktopMasterGrant.updateMany.mockResolvedValue({ count: 1 });
    prisma.desktopCheckInIdempotency.updateMany.mockResolvedValue({ count: 1 });
    access.requireMutableProject.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.attachmentVersion.create.mockImplementation((input) =>
      Promise.resolve({
        id: `attachment-version-${input.data.attachmentId}-${input.data.version}`,
        ...input.data,
      })
    );
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        id: input.where.id,
        projectId: "project-1",
        workingPaperId: "paper-1",
        fileName: "mock-file.pdf",
        originalName: "mock-file.pdf",
        ...input.data,
      })
    );
    smartFormPdf.renderSmartFormV2Pdf.mockResolvedValue(
      Buffer.from("%PDF-1.7\n% Smart Form snapshot\n", "utf-8")
    );
    const getCurrentSignoffs = () => Promise.resolve([...signoffEvents]);
    prisma.workingPaperSignoff.findMany.mockImplementation(getCurrentSignoffs);
    prisma.workingPaperSignoff.create.mockImplementation((input) => {
      const event = {
        id: `signoff-${signoffEvents.length + 1}`,
        ...input.data,
      };
      signoffEvents.push(event);
      return Promise.resolve(event);
    });
    prisma.workingPaperSignoff.updateMany.mockImplementation((input) => {
      for (const event of signoffEvents) {
        if (
          (!input.where.attachmentId ||
            event.attachmentId === input.where.attachmentId) &&
          (input.where.isCurrent === undefined ||
            event.isCurrent === input.where.isCurrent) &&
          (input.where.roundNumber === undefined ||
            event.roundNumber === input.where.roundNumber) &&
          (input.where.revokedAt === undefined ||
            (input.where.revokedAt === null && event.revokedAt === null))
        ) {
          Object.assign(event, input.data);
        }
      }
      return Promise.resolve({ count: signoffEvents.length });
    });
    prisma.workingPaperSignoff.update.mockImplementation((input) => {
      const event = signoffEvents.find((item) => item.id === input.where.id);
      if (event) {
        Object.assign(event, input.data);
      }
      return Promise.resolve(event ?? { id: input.where.id, ...input.data });
    });
    prisma.workingPaperQuestion.findMany.mockResolvedValue([]);
    (XLSX.readFile as MockedFunction<typeof XLSX.readFile>).mockImplementation(
      (...args: Parameters<typeof XLSX.readFile>) =>
        actualXlsx.readFile(...args)
    );
    process.env.UPLOAD_DIR = join(tmpdir(), "project-wing-tests");
  });

  it("rejects a duplicate root folder code before creating the node", async () => {
    prisma.workflowNode.findFirst.mockResolvedValue({ id: "existing-root" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.createNode("project-1", { id: "user-1" } as never, {
        parentId: null,
        code: "2100",
        title: "Duplicate reporting",
      })
    ).rejects.toThrow("同一父级下编号已存在");

    expect(prisma.workflowNode.create).not.toHaveBeenCalled();
  });

  it("creates directories below the second level", async () => {
    prisma.workflowNode.findFirst
      .mockResolvedValueOnce({
        id: "second-level-folder",
        level: 2,
      })
      .mockResolvedValueOnce(null);
    prisma.workflowNode.findMany.mockResolvedValue([]);
    prisma.workflowNode.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    prisma.workflowNode.create.mockResolvedValue({
      id: "third-level-folder",
      projectId: "project-1",
      parentId: "second-level-folder",
      code: "A01-01",
      title: "Supporting documents",
      level: 3,
      nodeType: "WORKING_PAPER",
      sortOrder: 1,
      workingPapers: [],
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createNode("project-1", { id: "user-1" } as never, {
      parentId: "second-level-folder",
      code: "A01-01",
      title: "Supporting documents",
    });

    expect(prisma.workflowNode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: "second-level-folder",
          level: 3,
          nodeType: "WORKING_PAPER",
        }),
      })
    );
  });

  it("normalizes workflow tree code sequences without duplicates", async () => {
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "phase",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "Planning",
        title: "Planning",
        nodeType: "PHASE",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-a4",
        projectId: "project-1",
        parentId: "phase",
        level: 2,
        code: "A4",
        title: "A4",
        nodeType: "ACCOUNT",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [
          {
            id: "paper-f004",
            code: "A4-F004",
            title: "A4-F004",
            attachments: [],
          },
          {
            id: "paper-f005",
            code: "A4-F005",
            title: "A4-F005",
            attachments: [],
          },
        ],
      },
      {
        id: "node-a5",
        projectId: "project-1",
        parentId: "phase",
        level: 2,
        code: "A5",
        title: "A5",
        nodeType: "ACCOUNT",
        sortOrder: 2,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-a4-4000",
        projectId: "project-1",
        parentId: "node-a4",
        level: 3,
        code: "A4-4000",
        title: "A4-4000",
        nodeType: "WORKING_PAPER",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-a4-5000",
        projectId: "project-1",
        parentId: "node-a4",
        level: 3,
        code: "A4-5000",
        title: "A4-5000",
        nodeType: "WORKING_PAPER",
        sortOrder: 2,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const tree = await service.tree("project-1", { id: "user-1" } as never);

    expect(tree[0]?.children?.[0]).toStrictEqual(
      expect.objectContaining({ code: "A5", title: "A5" })
    );
    expect(tree[0]?.children?.[1]).toStrictEqual(
      expect.objectContaining({ code: "A6", title: "A6" })
    );
    expect(
      tree[0]?.children?.[0]?.children?.map((node) => node.code)
    ).toStrictEqual(["A5-5000", "A5-6000"]);
    expect(
      tree[0]?.children?.[0]?.workingPapers?.map((paper) => paper.code)
    ).toStrictEqual(["A5-F005", "A5-F006"]);
    expect(tree[0]?.children?.[0]?.workingPapers?.[0]).toStrictEqual(
      expect.objectContaining({ code: "A5-F005", title: "A5-F005" })
    );
  });

  it("normalizes working paper codes before storing them", async () => {
    access.requireProjectRole.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-a5",
      projectId: "project-1",
      level: 3,
    });
    prisma.workingPaper.create.mockImplementation((input) =>
      Promise.resolve({ id: "paper-1", ...input.data })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createWorkingPaper(
      "project-1",
      { id: "user-1" } as never,
      {
        workflowNodeId: "node-a5",
        code: "A4-F004",
        title: "A4-F004",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "A5-F005",
          title: "A5-F005",
        }),
      })
    );
  });

  it("strips legacy code prefixes from uploaded working paper titles", async () => {
    access.requireProjectRole.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-a1",
      projectId: "project-1",
      level: 3,
    });
    prisma.workingPaper.create.mockImplementation((input) =>
      Promise.resolve({ id: "paper-1", ...input.data })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createWorkingPaper(
      "project-1",
      { id: "user-1" } as never,
      {
        workflowNodeId: "node-a1",
        code: "A1-1000-F001",
        title: "A4 - 1000 - F777 - Uploaded support.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
      } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "A1-1000-F001",
          title: "Uploaded support.xlsx",
        }),
      })
    );
  });

  it("strips nested legacy prefixes from workflow node titles", async () => {
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-execution",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "Execution",
        title: "Execution",
        nodeType: "PHASE",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-c1",
        projectId: "project-1",
        parentId: "node-execution",
        level: 2,
        code: "C1",
        title: "C - Cash and cash equivalents",
        nodeType: "ACCOUNT",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-c2",
        projectId: "project-1",
        parentId: "node-execution",
        level: 2,
        code: "C2",
        title: "C2 - D - Trade and other receivables",
        nodeType: "ACCOUNT",
        sortOrder: 2,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-c3",
        projectId: "project-1",
        parentId: "node-execution",
        level: 2,
        code: "C3",
        title: "C3：E - Inventories",
        nodeType: "ACCOUNT",
        sortOrder: 3,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-c5",
        projectId: "project-1",
        parentId: "node-execution",
        level: 2,
        code: "C5",
        title: "C5 —— F —— Other current assets",
        nodeType: "ACCOUNT",
        sortOrder: 4,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const tree = await service.tree("project-1", { id: "user-1" } as never);

    expect(tree[0]?.children?.[0]).toStrictEqual(
      expect.objectContaining({
        code: "C1",
        title: "Cash and cash equivalents",
      })
    );
    expect(tree[0]?.children?.[1]).toStrictEqual(
      expect.objectContaining({
        code: "C2",
        title: "Trade and other receivables",
      })
    );
    expect(tree[0]?.children?.[2]).toStrictEqual(
      expect.objectContaining({
        code: "C3",
        title: "Inventories",
      })
    );
    expect(tree[0]?.children?.[3]).toStrictEqual(
      expect.objectContaining({
        code: "C5",
        title: "Other current assets",
      })
    );
  });

  it("restores SME root folder titles when imported nodes only stored codes", async () => {
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-a",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "A",
        title: "A",
        nodeType: "PHASE",
        sortOrder: 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-b",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "B",
        title: "B",
        nodeType: "PHASE",
        sortOrder: 2,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-c",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "C",
        title: "C",
        nodeType: "PHASE",
        sortOrder: 3,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-d",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "D",
        title: "D",
        nodeType: "PHASE",
        sortOrder: 4,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-e",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "E",
        title: "E",
        nodeType: "PHASE",
        sortOrder: 5,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-f",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "F",
        title: "F",
        nodeType: "PHASE",
        sortOrder: 6,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
      {
        id: "node-g",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "G",
        title: "G",
        nodeType: "PHASE",
        sortOrder: 7,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const tree = await service.tree("project-1", { id: "user-1" } as never);

    expect(tree.map((node) => `${node.code} - ${node.title}`)).toStrictEqual([
      "A - Planning",
      "B - General Procedures",
      "C - Execution",
      "D - Reporting",
      "E - Completion",
      "F - Continued Connected Transactions (CCT)",
      "G - Other Audit Programmes",
    ]);
  });

  it("restores SME root folder titles when imported nodes stored names as codes", async () => {
    prisma.workflowNode.findMany.mockResolvedValue(
      [
        "Planning",
        "General Procedures",
        "Execution",
        "Reporting",
        "Completion",
        "Continued Connected Transactions (CCT)",
        "Other Audit Programmes",
      ].map((code, index) => ({
        id: `node-${index + 1}`,
        projectId: "project-1",
        parentId: null,
        level: 1,
        code,
        title: "新阶段",
        nodeType: "PHASE",
        sortOrder: index + 1,
        createdBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        workingPapers: [],
      }))
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const tree = await service.tree("project-1", { id: "user-1" } as never);

    expect(tree.map((node) => `${node.code} - ${node.title}`)).toStrictEqual([
      "A - Planning",
      "B - General Procedures",
      "C - Execution",
      "D - Reporting",
      "E - Completion",
      "F - Continued Connected Transactions (CCT)",
      "G - Other Audit Programmes",
    ]);
  });

  it("returns an existing PDF attachment as the preview PDF", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const relativeDir = posix.join("working-papers", "project-1", "paper-1");
    const fileUrl = posix.join(relativeDir, "support.pdf");
    await mkdir(join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(join(uploadRoot, fileUrl), Buffer.from("%PDF-1.4"));
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl,
      fileName: "support",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 1,
    });
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "support.pdf",
      mimeType: "application/pdf",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const preview = await service.previewAttachmentPdf(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(documentConversion.getAttachmentPreviewPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attachment-1",
        fileUrl,
        mimeType: "application/pdf",
      })
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_LOCKED" })
    );
    expect(preview).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      cacheControl: "private, no-cache, no-transform",
      eTag: expect.stringMatching(/^"[A-Za-z0-9_-]+"$/),
      fileName: "support",
      mimeType: "application/pdf",
    });
  });

  it("does not reuse a legacy redirect validator and still revalidates cached PDF bytes", async () => {
    const attachment = {
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/file.pdf",
      fileName: "file.pdf",
      mimeType: "application/pdf",
      version: 1,
    };
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      body: Buffer.from("%PDF-1.4"),
      fileName: "file.pdf",
      mimeType: "application/pdf",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );
    const legacy = `"${createHash("sha256").update("attachment-1:1::pdf").digest("base64url")}"`;
    const first = await service.previewAttachmentPdf(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      legacy,
      1
    );
    expect(first.eTag).not.toBe(legacy);
    expect(first).not.toHaveProperty("notModified");
    expect(first).toHaveProperty("body", Buffer.from("%PDF-1.4"));
    const second = await service.previewAttachmentPdf(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      first.eTag,
      1
    );
    expect(second).toHaveProperty("notModified", true);
    expect(documentConversion.getAttachmentPreviewPdf).toHaveBeenCalledOnce();
    access.requireProjectMember.mockRejectedValueOnce(
      new Error("access revoked")
    );
    await expect(
      service.previewAttachmentPdf(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        first.eTag,
        1
      )
    ).rejects.toThrow("access revoked");
  });

  it("returns raster preview metadata for a PDF attachment", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/paper-1/support.pdf",
      fileName: "support.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 3,
      previewStatus: "QUEUED",
      previewVersion: null,
    });
    pdfRasterPreview.readCachedAttachmentRasterPreviewManifest.mockResolvedValue(
      {
        attachmentId: "attachment-1",
        version: 3,
        pageCount: 12,
        pageWidth: 612,
        pageHeight: 792,
        dpi: 150,
        mimeType: "image/png",
      }
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      undefined,
      pdfRasterPreview as never
    );

    const manifest = await service.previewAttachmentRasterPdfManifest(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(
      pdfRasterPreview.readCachedAttachmentRasterPreviewManifest
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attachment-1",
        fileUrl: "working-papers/project-1/paper-1/support.pdf",
      })
    );
    expect(manifest).toStrictEqual({
      attachmentId: "attachment-1",
      version: 3,
      pageCount: 12,
      pageWidth: 612,
      pageHeight: 792,
      dpi: 150,
      mimeType: "image/png",
    });
  });

  it("requeues a missing document preview cache instead of rendering in the API", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/paper-1/support.pdf",
      fileName: "support.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 3,
      previewStatus: "READY",
      previewVersion: 3,
    });
    pdfRasterPreview.readCachedAttachmentRasterPreviewManifest.mockResolvedValue(
      null
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      undefined,
      pdfRasterPreview as never
    );

    await expect(
      service.previewAttachmentRasterPdfManifest("project-1", "attachment-1", {
        id: "user-1",
      } as never)
    ).rejects.toMatchObject({
      response: {
        code: "PREVIEW_PROCESSING",
        message: "Preview is being prepared.",
      },
    });
    expect(
      pdfRasterPreview.getAttachmentRasterPreviewManifest
    ).not.toHaveBeenCalled();
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: { id: "attachment-1", version: 3 },
      data: expect.objectContaining({
        previewStatus: "QUEUED",
        previewVersion: null,
        previewError: null,
      }),
    });
  });

  it("returns one raster preview page for a PDF attachment", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/paper-1/support.pdf",
      fileName: "support.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
      version: 3,
    });
    pdfRasterPreview.getAttachmentRasterPreviewPage.mockResolvedValue({
      absolutePath: join(tmpdir(), "page-2.png"),
      fileName: "page-2.png",
      mimeType: "image/png",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      undefined,
      pdfRasterPreview as never
    );

    const page = await service.previewAttachmentRasterPdfPage(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { pageNumber: 2 }
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(
      pdfRasterPreview.getAttachmentRasterPreviewPage
    ).toHaveBeenCalledWith(expect.objectContaining({ id: "attachment-1" }), {
      pageNumber: 2,
    });
    expect(page).toStrictEqual({
      absolutePath: join(tmpdir(), "page-2.png"),
      cacheControl: "private, no-cache, no-transform",
      eTag: expect.stringMatching(/^"[A-Za-z0-9_-]+"$/),
      fileName: "page-2.png",
      mimeType: "image/png",
    });
  });

  it.each(["local", "oss"])(
    "returns Smart Form attachments as generated preview PDF content (%s)",
    async (transport) => {
      prisma.project.findUnique.mockResolvedValue({
        name: "Example Audit",
        yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
        workspace: { clientName: "Workspace Client" },
        cmpClient: { nameZh: "示例客户", nameEn: "Example Client" },
        cmpEngagement: { engagementCode: "EX-2026-AUD" },
      });
      const storage = {
        getObjectBuffer: vi.fn((key: string) =>
          Promise.resolve(
            key.startsWith("smart-form-pdf-cache/")
              ? Buffer.from("%PDF-1.4 cached smart form")
              : Buffer.from(JSON.stringify(buildWorkflowSmartFormPackage()))
          )
        ),
        putCacheObject: vi.fn().mockResolvedValue({
          fileName: "daily-living-form.pdf",
          objectKey: "smart-form-pdf-cache/project-1/attachment-smart-form/pdf",
        }),
        getObjectMetadata: vi
          .fn()
          .mockRejectedValueOnce(new Error("not cached"))
          .mockResolvedValue({}),
        getDownloadObject: vi.fn().mockReturnValue(
          transport === "oss"
            ? {
                redirectUrl: "https://storage.invalid/preview.pdf?Expires=1",
                fileName: "daily-living-form.pdf",
                mimeType: "application/pdf",
              }
            : {
                absolutePath: join(tmpdir(), "daily-living-form.pdf"),
                fileName: "daily-living-form.pdf",
                mimeType: "application/pdf",
              }
        ),
      };
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-smart-form",
        projectId: "project-1",
        fileKind: "SMART_FORM",
        fileUrl: "working-papers/project-1/paper-1/daily-living-form.sf",
        fileName: "daily-living-form.sf",
        originalName: "daily-living-form.sf",
        mimeType: "application/vnd.project-wing.smart-form+json",
        version: 3,
        workingPaperId: "paper-1",
      });
      prisma.smartFormInstance.findUnique.mockResolvedValue({
        status: "COMPLETE",
        lastSavedAt: new Date("2026-07-03T06:49:00.000Z"),
        updatedAt: new Date("2026-07-03T06:49:30.000Z"),
        completedAt: new Date("2026-07-03T06:51:00.000Z"),
      });
      prisma.workingPaperQuestion.findMany.mockResolvedValue([
        {
          id: "question-1",
          smartFormNodeId: "deferred-income-general-procedures",
          smartFormRowId: "deferred-income-procedure-2-a",
          smartFormTargetLabel: "Procedure 2(a)",
          body: "Explain the variance.",
          status: "OPEN",
          createdAt: new Date("2026-07-03T06:52:00.000Z"),
          updatedAt: new Date("2026-07-03T06:52:00.000Z"),
          createdBy: { name: "Jony Ma", email: "jony@example.test" },
          messages: [],
        },
      ]);
      prisma.workingPaperSignoff.findMany.mockResolvedValue([
        {
          type: "PREPARER",
          signedAt: new Date("2026-07-03T06:50:00.000Z"),
          createdAt: new Date("2026-07-03T06:50:00.000Z"),
          userId: "user-1",
          user: { name: "Jony Ma", email: "jony@example.test" },
        },
      ]);
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never,
        undefined,
        storage as never,
        undefined,
        smartFormPdf as never
      );

      const preview = await service.previewAttachmentPdf(
        "project-1",
        "attachment-smart-form",
        {
          id: "user-1",
        } as never,
        undefined,
        3
      );
      const cachedPreview = await service.previewAttachmentPdf(
        "project-1",
        "attachment-smart-form",
        {
          id: "user-1",
        } as never
      );

      expect(preview).not.toHaveProperty("redirectUrl");
      expect("body" in preview ? preview.body : undefined).toStrictEqual(
        transport === "oss"
          ? Buffer.from("%PDF-1.4 cached smart form")
          : undefined
      );
      expect(
        storage.getObjectBuffer.mock.calls.some(([key]) =>
          String(key).startsWith("smart-form-pdf-cache/")
        )
      ).toBe(transport === "oss");

      expect(documentConversion.getAttachmentPreviewPdf).not.toHaveBeenCalled();
      expect(smartFormPdf.renderSmartFormV2Pdf).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
          response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
          locale: "en-US",
          fileName: "daily-living-form.sf",
          documentVersion: "v3",
          engagementDetails: {
            clientName: "Example Client",
            engagementCode: "EX-2026-AUD",
            financialStatementDate: new Date("2026-12-31T00:00:00.000Z"),
          },
          reviewQuestions: [expect.objectContaining({ id: "question-1" })],
        })
      );
      expect(storage.putCacheObject).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(
          /^smart-form-pdf-cache\/project-1\/attachment-smart-form\/v3-[a-f0-9]{12}\/daily-living-form\.pdf$/
        ),
        expect.any(Buffer),
        "application/pdf"
      );
      expect(smartFormPdf.renderSmartFormV2Pdf).toHaveBeenCalledOnce();
      expect(storage.putCacheObject).toHaveBeenCalledOnce();
      expect(preview).toStrictEqual(
        expect.objectContaining({
          fileName: "daily-living-form",
          mimeType: "application/pdf",
        })
      );
      expect(cachedPreview).toStrictEqual({
        ...preview,
        cacheControl: "private, no-cache, no-transform",
      });
    }
  );

  it("returns Smart Form raster previews from generated PDF snapshots", async () => {
    const storage = {
      getObjectBuffer: vi
        .fn()
        .mockResolvedValue(
          Buffer.from(JSON.stringify(buildWorkflowSmartFormPackage()))
        ),
      putCacheObject: vi.fn().mockResolvedValue({
        fileName: "daily-living-form.pdf",
        objectKey: "smart-form-pdf-cache/project-1/attachment-smart-form/pdf",
      }),
      getObjectMetadata: vi.fn().mockRejectedValue(new Error("not cached")),
      getDownloadObject: vi.fn().mockReturnValue({
        absolutePath: join(tmpdir(), "daily-living-form.pdf"),
        fileName: "daily-living-form.pdf",
        mimeType: "application/pdf",
      }),
    };
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-smart-form",
      projectId: "project-1",
      fileKind: "SMART_FORM",
      fileUrl: "working-papers/project-1/paper-1/daily-living-form.sf",
      fileName: "daily-living-form.sf",
      originalName: "daily-living-form.sf",
      mimeType: "application/vnd.project-wing.smart-form+json",
      version: 3,
      workingPaperId: "paper-1",
    });
    prisma.smartFormInstance.findUnique.mockResolvedValue({
      status: "COMPLETE",
      lastSavedAt: new Date("2026-07-03T06:49:00.000Z"),
      updatedAt: new Date("2026-07-03T06:49:30.000Z"),
      completedAt: new Date("2026-07-03T06:51:00.000Z"),
    });
    pdfRasterPreview.getAttachmentRasterPreviewManifest.mockResolvedValue({
      attachmentId: "attachment-smart-form",
      version: 3,
      pageCount: 2,
      pageWidth: 595,
      pageHeight: 842,
      dpi: 150,
      mimeType: "image/png",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never,
      pdfRasterPreview as never,
      smartFormPdf as never
    );

    const manifest = await service.previewAttachmentRasterPdfManifest(
      "project-1",
      "attachment-smart-form",
      { id: "user-1" } as never
    );

    expect(
      pdfRasterPreview.getAttachmentRasterPreviewManifest
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attachment-smart-form",
        fileUrl: expect.stringMatching(
          /^smart-form-pdf-cache\/project-1\/attachment-smart-form\/v3-[a-f0-9]{12}\/daily-living-form\.pdf$/
        ),
        fileName: "daily-living-form.pdf",
        originalName: "daily-living-form.pdf",
        mimeType: "application/pdf",
        previewCacheKey: expect.stringMatching(/^v3-[a-f0-9]{12}$/),
      })
    );
    expect(manifest).toStrictEqual(
      expect.objectContaining({
        attachmentId: "attachment-smart-form",
        pageCount: 2,
      })
    );
  });

  it("converts DOCX attachments to cached preview PDFs", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const relativeDir = posix.join("working-papers", "project-1", "paper-1");
    const fileUrl = posix.join(relativeDir, "minutes.docx");
    const convertedPath = join(
      uploadRoot,
      "document-previews",
      "attachment-1",
      "v2.pdf"
    );
    await mkdir(join(uploadRoot, relativeDir), { recursive: true });
    await writeFile(join(uploadRoot, fileUrl), Buffer.from("docx"));
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl,
      fileName: "minutes.docx",
      originalName: "会议纪要.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 2,
    });
    documentConversion.getAttachmentPreviewPdf.mockImplementation(async () => {
      await mkdir(join(uploadRoot, "document-previews", "attachment-1"), {
        recursive: true,
      });
      await writeFile(convertedPath, Buffer.from("%PDF-1.4 converted"));
      return {
        absolutePath: convertedPath,
        fileName: "会议纪要.pdf",
        mimeType: "application/pdf",
      };
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const preview = await service.previewAttachmentPdf(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );
    const cachedPdf = await readFile(convertedPath, "utf-8");

    expect(documentConversion.getAttachmentPreviewPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "attachment-1",
        originalName: "会议纪要.docx",
        version: 2,
      })
    );
    expect(preview.fileName).toBe("会议纪要");
    expect(preview.mimeType).toBe("application/pdf");
    expect(cachedPdf).toBe("%PDF-1.4 converted");
  });

  it("returns file status and history for one attachment", async () => {
    const lockedAt = new Date("2026-06-01T08:30:00.000Z");
    const lockExpiresAt = new Date("2026-06-01T10:30:00.000Z");
    const attachment = {
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      fileUrl: "working-papers/project-1/paper-1/stored.xlsx",
      fileSize: 2048,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 3,
      uploadedBy: "uploader-1",
      lockedBy: "lock-holder-1",
      lockedAt,
      lockExpiresAt,
      createdAt: new Date("2026-06-01T08:00:00.000Z"),
      updatedAt: new Date("2026-06-01T08:30:00.000Z"),
      uploader: {
        id: "uploader-1",
        name: "Uploader",
        email: "uploader@projectwing.local",
      },
      lockHolder: {
        id: "lock-holder-1",
        name: "Lock Holder",
        email: "lock@projectwing.local",
      },
    };
    const events = [
      {
        id: "log-1",
        action: "ATTACHMENT_LOCKED",
        targetType: "ATTACHMENT",
        targetId: "attachment-1",
        projectId: "project-1",
        description: "锁定表格文件 cash.xlsx",
        createdAt: lockedAt,
        actor: {
          id: "lock-holder-1",
          name: "Lock Holder",
          email: "lock@projectwing.local",
          globalRole: "SENIOR",
        },
      },
    ];
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    prisma.auditLog.findMany.mockResolvedValue(events);
    prisma.attachmentVersion.findMany.mockResolvedValue([
      {
        id: "version-1",
        attachmentId: "attachment-1",
        projectId: "project-1",
        version: 1,
        fileName: "cash-v1.xlsx",
        originalName: "cash-v1.xlsx",
        fileUrl: "working-papers/project-1/paper-1/cash-v1.xlsx",
        fileSize: 10,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedAt: new Date("2026-06-01T08:00:00.000Z"),
        archivedBy: "lock-holder-1",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const history = await service.attachmentHistory(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1", projectId: "project-1" },
        include: expect.objectContaining({
          uploader: { select: { id: true, name: true, email: true } },
          lockHolder: { select: { id: true, name: true, email: true } },
        }),
      })
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "project-1",
          targetType: "ATTACHMENT",
          targetId: "attachment-1",
        },
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, globalRole: true },
          },
        },
      })
    );
    expect(prisma.attachmentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-1", attachmentId: "attachment-1" },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      })
    );
    expect(history).toStrictEqual({
      attachment,
      versions: [
        expect.objectContaining({
          id: "version-1",
          originalName: "cash-v1.xlsx",
        }),
      ],
      events,
    });
  });

  it("lists deleted attachments for the project recycle bin", async () => {
    const deletedAt = new Date("2026-06-01T09:00:00.000Z");
    prisma.attachment.findMany.mockResolvedValue([
      {
        id: "attachment-1",
        projectId: "project-1",
        fileName: "stored.xlsx",
        originalName: "cash.xlsx",
        deletedAt,
        deletedFromWorkingPaperId: "paper-1",
        deletedFromWorkingPaperCode: "A01-0001-F001",
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const deleted = await service.deletedAttachments("project-1", {
      id: "user-1",
    } as never);

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "viewRecycleBin"
    );
    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-1", deletedAt: { not: null } },
        orderBy: [{ deletedAt: "desc" }, { updatedAt: "desc" }],
      })
    );
    expect(deleted).toStrictEqual([
      expect.objectContaining({
        id: "attachment-1",
        deletedAt,
        deletedFromWorkingPaperId: "paper-1",
      }),
    ]);
  });

  it("lists active project files with their workpaper path and lock metadata", async () => {
    prisma.attachment.findMany.mockResolvedValue([
      {
        id: "attachment-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        fileKind: "SMART_FORM",
        fileName: "stored.sf",
        originalName: "cash.sf",
        fileSize: 2048,
        version: 2,
        lockedBy: "user-2",
        lastModifiedAt: new Date("2026-06-01T09:00:00.000Z"),
        lockHolder: {
          id: "user-2",
          name: "Lock Holder",
          email: "l@example.com",
        },
        smartFormInstance: { status: "COMPLETE" },
        workingPaper: {
          id: "paper-1",
          code: "A01-0001-F001",
          title: "Cash paper",
          bucket: "CURRENT",
          signoffs: [
            {
              id: "signoff-1",
              type: "PREPARER",
              signedAt: new Date("2026-06-01T08:00:00.000Z"),
              user: {
                id: "user-preparer",
                name: "Preparer One",
                email: "preparer@example.com",
              },
            },
          ],
          reviewQuestions: [
            {
              id: "question-1",
              body: "Please explain the variance.",
              status: "OPEN",
              assignedToId: "user-preparer",
              createdById: "user-reviewer",
            },
          ],
          workflowNode: {
            id: "node-3",
            code: "A01-0001",
            title: "Cash",
            level: 3,
            parent: {
              id: "node-2",
              code: "A01",
              title: "Assets",
              level: 2,
              parent: {
                id: "node-1",
                code: "Execution",
                title: "Execution",
                level: 1,
              },
            },
          },
        },
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const files = await service.projectAttachments("project-1", {
      id: "user-1",
    } as never);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "project-1",
          deletedAt: null,
          OR: [
            { workingPaperId: { not: null } },
            { workflowNodeId: { not: null } },
          ],
        },
        include: expect.objectContaining({
          smartFormInstance: { select: { status: true } },
        }),
      })
    );
    expect(files).toStrictEqual([
      expect.objectContaining({
        id: "attachment-1",
        smartFormInstance: { status: "COMPLETE" },
        workingPaper: expect.objectContaining({
          id: "paper-1",
          attachmentId: "attachment-1",
          workflowNodeId: "node-3",
          signoffs: [
            expect.objectContaining({
              id: "signoff-1",
              type: "PREPARER",
              user: expect.objectContaining({ name: "Preparer One" }),
            }),
          ],
          reviewQuestions: [
            expect.objectContaining({
              id: "question-1",
              status: "OPEN",
            }),
          ],
          path: [
            expect.objectContaining({ code: "Execution", level: 1 }),
            expect.objectContaining({ code: "A01", level: 2 }),
            expect.objectContaining({ code: "A01-0001", level: 3 }),
          ],
        }),
      }),
    ]);
  });

  it("maps attachment-first project files into the legacy workpaper response shape", async () => {
    prisma.attachment.findMany.mockResolvedValue([
      {
        id: "attachment-direct",
        projectId: "project-1",
        workingPaperId: null,
        workflowNodeId: "node-3",
        code: "A01-0001-F009",
        title: "Direct attachment",
        bucket: "CURRENT",
        fileKind: "SPREADSHEET",
        fileName: "stored-direct.xlsx",
        originalName: "direct.xlsx",
        signoffs: [
          {
            id: "signoff-direct",
            type: "REVIEWER",
            signedAt: new Date("2026-06-01T08:00:00.000Z"),
            user: {
              id: "user-reviewer",
              name: "Reviewer One",
              email: "reviewer@example.com",
            },
          },
        ],
        reviewQuestions: [
          {
            id: "question-direct",
            body: "Please explain.",
            status: "OPEN",
          },
        ],
        workingPaper: null,
        workflowNode: {
          id: "node-3",
          code: "A01-0001",
          title: "Cash",
          level: 3,
          parent: {
            id: "node-2",
            code: "A01",
            title: "Assets",
            level: 2,
            parent: {
              id: "node-1",
              code: "Execution",
              title: "Execution",
              level: 1,
            },
          },
        },
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const files = await service.projectAttachments("project-1", {
      id: "user-1",
    } as never);

    expect(files).toStrictEqual([
      expect.objectContaining({
        id: "attachment-direct",
        workingPaper: expect.objectContaining({
          id: "attachment-direct",
          attachmentId: "attachment-direct",
          code: "A01-0001-F009",
          title: "Direct attachment",
          bucket: "CURRENT",
          workflowNodeId: "node-3",
          signoffs: [expect.objectContaining({ id: "signoff-direct" })],
          reviewQuestions: [expect.objectContaining({ id: "question-direct" })],
          path: [
            expect.objectContaining({ code: "Execution", level: 1 }),
            expect.objectContaining({ code: "A01", level: 2 }),
            expect.objectContaining({ code: "A01-0001", level: 3 }),
          ],
        }),
      }),
    ]);
  });

  it("uses attachment identity instead of paper identity for project file rows", async () => {
    const paperLocation = {
      id: "paper-shared",
      code: "A01-0001-F001",
      title: "Shared shell",
      bucket: "CURRENT",
      signoffs: [
        {
          id: "paper-signoff",
          type: "PREPARER",
          signedAt: new Date("2026-06-01T08:00:00.000Z"),
          user: {
            id: "user-preparer",
            name: "Preparer One",
            email: "preparer@example.com",
          },
        },
      ],
      reviewQuestions: [
        {
          id: "paper-question",
          body: "Legacy question.",
          status: "OPEN",
        },
      ],
      workflowNode: {
        id: "node-3",
        code: "A01-0001",
        title: "Cash",
        level: 3,
        parent: {
          id: "node-2",
          code: "A01",
          title: "Assets",
          level: 2,
          parent: {
            id: "node-1",
            code: "Execution",
            title: "Execution",
            level: 1,
          },
        },
      },
    };
    prisma.attachment.findMany.mockResolvedValue([
      {
        id: "attachment-first",
        projectId: "project-1",
        workingPaperId: "paper-shared",
        workflowNodeId: "node-3",
        code: "A01-0001-F001",
        title: "First file",
        bucket: "CURRENT",
        fileKind: "SPREADSHEET",
        fileName: "stored-first.xlsx",
        originalName: "first.xlsx",
        signoffs: [
          {
            id: "attachment-signoff",
            type: "PREPARER",
            signedAt: new Date("2026-06-01T08:00:00.000Z"),
            user: {
              id: "user-preparer",
              name: "Preparer One",
              email: "preparer@example.com",
            },
          },
        ],
        reviewQuestions: [],
        workingPaper: paperLocation,
        workflowNode: null,
      },
      {
        id: "attachment-second",
        projectId: "project-1",
        workingPaperId: "paper-shared",
        workflowNodeId: "node-3",
        code: "A4 free text",
        title: "A4 free text",
        bucket: "CURRENT",
        fileKind: "SPREADSHEET",
        fileName: "stored-second.xlsx",
        originalName: "second.xlsx",
        signoffs: [],
        reviewQuestions: [],
        workingPaper: paperLocation,
        workflowNode: null,
      },
    ]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const files = await service.projectAttachments("project-1", {
      id: "user-1",
    } as never);

    expect(files).toStrictEqual([
      expect.objectContaining({
        id: "attachment-first",
        workingPaper: expect.objectContaining({
          id: "paper-shared",
          attachmentId: "attachment-first",
          code: "A01-0001-F001",
          title: "First file",
          signoffs: [expect.objectContaining({ id: "attachment-signoff" })],
          reviewQuestions: [],
        }),
      }),
      expect.objectContaining({
        id: "attachment-second",
        workingPaper: expect.objectContaining({
          id: "paper-shared",
          attachmentId: "attachment-second",
          code: "A4 free text",
          title: "A4 free text",
          signoffs: [],
          reviewQuestions: [],
        }),
      }),
    ]);
  });

  it("marks stale desktop Master heartbeats before listing project files", async () => {
    prisma.attachment.findMany.mockResolvedValue([]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.projectAttachments("project-1", { id: "user-1" } as never);

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: "project-1",
        deletedAt: null,
        lockedBy: { not: null },
        lockSessionId: { not: null },
        lockRevokedAt: null,
        lockStaleAt: null,
      }),
      data: { lockStaleAt: expect.any(Date) },
    });
    expect(
      prisma.attachment.updateMany.mock.calls[0]?.[0]?.data
    ).not.toStrictEqual(
      expect.objectContaining({
        lockedBy: null,
        lockSessionId: null,
      })
    );
  });

  it("soft deletes attachments, deletes the empty paper row, and keeps the original paper snapshot", async () => {
    prisma.workItemRecord.findMany.mockResolvedValue([
      {
        id: "file-task-1",
        actionTarget: {
          app: "PROJECT",
          resourceType: "ATTACHMENT",
          resourceId: "attachment-1",
          params: { projectId: "project-1" },
        },
      },
    ]);
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      code: "A01-0001-F001",
      title: "Cash paper",
      workflowNodeId: "node-1",
    });
    prisma.attachment.count.mockResolvedValue(0);
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        id: "attachment-1",
        fileName: "stored.xlsx",
        originalName: "cash.xlsx",
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const deleted = await service.deleteAttachment(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );

    expect(prisma.confirmationFollowUpEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          eventType: "IMPORT_TARGET_CHANGED",
          payload: expect.objectContaining({
            operation: "IMPORT_TARGET_DELETED",
          }),
        }),
      ],
    });
    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1", projectId: "project-1", deletedAt: null },
      })
    );
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          workingPaperId: null,
          deletedAt: expect.any(Date),
          deletedBy: "user-1",
          deletedFromWorkingPaperId: "paper-1",
          deletedFromWorkflowNodeId: "node-1",
          deletedFromWorkingPaperCode: "A01-0001-F001",
          deletedFromWorkingPaperTitle: "Cash paper",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
        }),
      })
    );
    expect(prisma.attachment.count).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        workingPaperId: "paper-1",
        deletedAt: null,
      },
    });
    expect(prisma.workingPaper.delete).toHaveBeenCalledWith({
      where: { id: "paper-1" },
    });
    expect(prisma.workItemRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "file-task-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          resolutionReason: "ATTACHMENT_DELETED",
          events: {
            create: expect.objectContaining({
              type: "CANCELLED",
              actorUserId: "user-1",
            }),
          },
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "ATTACHMENT_DELETED",
        targetId: "attachment-1",
      })
    );
    expect(deleted).toStrictEqual(
      expect.objectContaining({
        workingPaperId: null,
        deletedBy: "user-1",
        deletedFromWorkingPaperId: "paper-1",
        deletedFromWorkflowNodeId: "node-1",
      })
    );
  });

  it("restores deleted attachments into their original directory as a new paper", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      deletedAt: new Date("2026-06-01T09:00:00.000Z"),
      deletedFromWorkingPaperId: "paper-1",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      code: "A01-0001-F001",
      workflowNodeId: "node-1",
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-1",
      projectId: "project-1",
      code: "A01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "A01-0001-F001" }]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "A01-0001-F002",
      title: "cash.xlsx",
      bucket: "CURRENT",
    });
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        id: "attachment-1",
        fileName: "stored.xlsx",
        originalName: "cash.xlsx",
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const restored = await service.restoreAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      {}
    );

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "attachment-1",
          projectId: "project-1",
          deletedAt: { not: null },
        },
      })
    );
    expect(prisma.workflowNode.findFirst).toHaveBeenCalledWith({
      where: { id: "node-1", projectId: "project-1" },
      select: { id: true, code: true, level: true },
    });
    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workflowNodeId: "node-1",
        code: "A01-0001-F002",
        title: "cash.xlsx",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy: "user-1",
      }),
      select: expect.objectContaining({ id: true, code: true }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          workingPaperId: "paper-restored",
          workflowNodeId: "node-1",
          code: "A01-0001-F002",
          title: "cash.xlsx",
          bucket: "CURRENT",
          deletedAt: null,
          deletedBy: null,
          deletedFromWorkingPaperId: null,
          restoredAt: expect.any(Date),
          restoredBy: "user-1",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_RESTORED",
        targetId: "attachment-1",
      })
    );
    expect(restored).toStrictEqual(
      expect.objectContaining({
        workingPaperId: "paper-restored",
        deletedAt: null,
        restoredBy: "user-1",
      })
    );
  });

  it("restores deleted attachments into the stored original directory when the original paper is gone", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      deletedAt: new Date("2026-06-01T09:00:00.000Z"),
      deletedFromWorkingPaperId: "paper-deleted",
      deletedFromWorkflowNodeId: "node-1",
    });
    prisma.workingPaper.findFirst.mockResolvedValue(null);
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-1",
      projectId: "project-1",
      code: "A01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "A01-0001-F001" }]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-restored",
      code: "A01-0001-F002",
    });
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        id: "attachment-1",
        fileName: "stored.xlsx",
        originalName: "cash.xlsx",
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const restored = await service.restoreAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      {}
    );

    expect(prisma.workflowNode.findFirst).toHaveBeenCalledWith({
      where: { id: "node-1", projectId: "project-1" },
      select: { id: true, code: true, level: true },
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-restored",
          deletedFromWorkflowNodeId: null,
        }),
      })
    );
    expect(restored).toStrictEqual(
      expect.objectContaining({
        workingPaperId: "paper-restored",
        deletedAt: null,
      })
    );
  });

  it("restores deleted attachments into a selected folder at any level", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileName: "stored.pdf",
      originalName: "support.pdf",
      deletedAt: new Date("2026-06-01T09:00:00.000Z"),
      deletedFromWorkingPaperId: "deleted-paper",
    });
    prisma.workingPaper.findFirst.mockResolvedValue(null);
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "A01-0001-01-01",
      title: "Bank",
      level: 5,
    });
    prisma.workingPaper.findMany.mockResolvedValue([
      { code: "A01-0001-01-01-F001" },
      { code: "A01-0001-01-01-F004" },
    ]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "restored-paper",
      workflowNodeId: "node-5",
      code: "A01-0001-01-01-F005",
      title: "support.pdf",
      bucket: "CURRENT",
    });
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        id: "attachment-1",
        fileName: "stored.pdf",
        originalName: "support.pdf",
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const restored = await service.restoreAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5" } as never
    );

    expect(prisma.workflowNode.findFirst).toHaveBeenCalledWith({
      where: { id: "node-5", projectId: "project-1" },
      select: { id: true, code: true, level: true },
    });
    expect(prisma.workingPaper.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        workflowNodeId: "node-5",
        code: "A01-0001-01-01-F006",
        title: "support.pdf",
        paperType: "WORKING_PAPER",
        bucket: "CURRENT",
        createdBy: "user-1",
      }),
      select: expect.objectContaining({ id: true, code: true }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "restored-paper",
          workflowNodeId: "node-5",
          code: "A01-0001-01-01-F005",
          title: "support.pdf",
          bucket: "CURRENT",
          deletedAt: null,
          deletedFromWorkingPaperId: null,
          restoredBy: "user-1",
        }),
      })
    );
    expect(restored).toStrictEqual(
      expect.objectContaining({
        workingPaperId: "restored-paper",
        deletedAt: null,
      })
    );
  });

  it("rejects recycle-bin restore targets that are not project folders", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileName: "stored.pdf",
      originalName: "support.pdf",
      deletedAt: new Date("2026-06-01T09:00:00.000Z"),
      deletedFromWorkingPaperId: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue(null);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.restoreAttachment(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        { workflowNodeId: "node-missing" } as never
      )
    ).rejects.toThrow("restore location");
    expect(prisma.workflowNode.findFirst).toHaveBeenCalledWith({
      where: { id: "node-missing", projectId: "project-1" },
      select: { id: true, code: true, level: true },
    });
    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
  });

  it("blocks regular attachment operations after soft delete", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 0 });
    prisma.attachment.findFirst.mockResolvedValue(null);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.downloadAttachment("project-1", "attachment-1", {
        id: "user-1",
      } as never)
    ).rejects.toThrow("附件不存在");

    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1", projectId: "project-1", deletedAt: null },
      })
    );
  });

  it("locks an attachment atomically before returning a download", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const fileUrl = posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "cash.xlsx"
    );
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl,
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await service.downloadAttachment("project-1", "attachment-1", {
      id: "user-1",
    } as never);

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "uploadWorkingPapers"
    );
    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          projectId: "project-1",
          deletedAt: null,
          lockedBy: null,
        }),
        data: expect.objectContaining({
          lockedBy: "user-1",
          lockSessionId: expect.any(String),
          lockExpiresAt: expect.any(Date),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_LOCKED",
        targetId: "attachment-1",
      })
    );
    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  });

  it("rejects download locking when another user holds the active lock", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 0 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      lockedBy: "user-2",
      lockHolder: {
        id: "user-2",
        name: "Lock Holder",
        email: "lock@example.com",
      },
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.downloadAttachment("project-1", "attachment-1", {
        id: "user-1",
      } as never)
    ).rejects.toThrow("Lock Holder");
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_LOCKED" })
    );
  });

  it("downloads a historical attachment version without locking current files", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const fileUrl = posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "cash-v1.xlsx"
    );
    prisma.attachmentVersion.findFirst.mockResolvedValue({
      id: "version-1",
      attachmentId: "attachment-1",
      projectId: "project-1",
      version: 1,
      fileUrl,
      fileName: "stored-v1.xlsx",
      originalName: "cash-v1.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await service.downloadAttachmentVersion(
      "project-1",
      "attachment-1",
      "version-1",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "cash-v1.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_VERSION_DOWNLOADED" })
    );
  });

  it("downloads the latest attachment read-only without taking the master lock", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const fileUrl = posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "cash.xlsx"
    );
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl,
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await service.downloadAttachmentReadOnly(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "ATTACHMENT_READONLY_DOWNLOADED",
        projectId: "project-1",
        targetId: "attachment-1",
      })
    );
  });

  it("exports a Word attachment as PDF without taking the master lock", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      workflowNodeId: null,
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/paper-1/memo.docx",
      fileName: "stored.docx",
      originalName: "memo.docx",
      fileSize: 128,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      code: null,
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      workingPaper: { code: "A1-F001", workflowNodeId: "node-a1000" },
    });
    prisma.project.findUnique.mockResolvedValue({
      projectCode: "ENG-2026",
      name: "Example audit",
    });
    prisma.workflowNode.findMany.mockResolvedValue([]);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "D:\\previews\\memo.pdf",
      fileName: "memo.pdf",
      mimeType: "application/pdf",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await service.exportAttachment(
      "project-1",
      "attachment-1",
      "pdf",
      {
        id: "user-1",
      } as never
    );

    expect(file).toStrictEqual({
      absolutePath: "D:\\previews\\memo.pdf",
      fileName: "A1-F001 memo.pdf",
      mimeType: "application/pdf",
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_EXPORTED",
        description: "Exported attachment A1-F001 memo.docx as pdf",
      })
    );
  });

  it("exports one current attachment in a ZIP with its project folder path", async () => {
    const attachment = {
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      workflowNodeId: null,
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/paper-1/cash.xlsx",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      fileSize: 128,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      code: null,
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      workingPaper: { code: "A1-F001", workflowNodeId: "node-a1000" },
    };
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    prisma.project.findUnique.mockResolvedValue({
      projectCode: "ENG-2026",
      name: "Example/Audit",
    });
    prisma.workflowNode.findMany.mockResolvedValue([
      { id: "planning", parentId: null, code: "Planning", title: "Planning" },
      { id: "a1", parentId: "planning", code: "A1", title: "Audit" },
      {
        id: "node-a1000",
        parentId: "a1",
        code: "A1000",
        title: "Cash",
      },
    ]);
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("workbook")),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    const file = await service.exportAttachment(
      "project-1",
      "attachment-1",
      "zip",
      {
        id: "user-1",
      } as never
    );
    if (!file.body) {
      throw new Error("Expected buffered ZIP export");
    }
    const zip = await JSZip.loadAsync(file.body);
    const entryPath =
      "ENG-2026 - Example_Audit/Planning/A1/A1000/A1-F001 cash.xlsx";

    expect(file.fileName).toBe("A1-F001 cash-export.zip");
    expect(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.name)
    ).toStrictEqual([entryPath]);
    await expect(zip.file(entryPath)?.async("string")).resolves.toBe(
      "workbook"
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("puts attachments without a workflow location under Unassigned", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: null,
      workflowNodeId: null,
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/orphan.pdf",
      fileName: "orphan.pdf",
      originalName: "orphan.pdf",
      fileSize: 64,
      mimeType: "application/pdf",
      code: null,
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      workingPaper: null,
    });
    prisma.project.findUnique.mockResolvedValue({
      projectCode: "ENG-2026",
      name: "Example audit",
    });
    prisma.workflowNode.findMany.mockResolvedValue([]);
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("pdf")),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    const file = await service.exportAttachment(
      "project-1",
      "attachment-1",
      "zip",
      {
        id: "user-1",
      } as never
    );
    if (!file.body) {
      throw new Error("Expected buffered ZIP export");
    }
    const zip = await JSZip.loadAsync(file.body);

    expect(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.name)
    ).toStrictEqual(["ENG-2026 - Example audit/Unassigned/orphan.pdf"]);
  });

  it("exports Smart Forms inside ZIP as PDF without exposing the source package", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      workflowNodeId: null,
      fileKind: "SMART_FORM",
      fileUrl: "working-papers/project-1/paper-1/form.sf",
      fileName: "form.sf",
      originalName: "form.sf",
      fileSize: 128,
      mimeType: "application/vnd.project-wing.smart-form+json",
      code: null,
      version: 1,
      previewCacheKey: null,
      contentHash: null,
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      workingPaper: { code: "A1-F001", workflowNodeId: "node-a1000" },
    });
    prisma.project.findUnique.mockResolvedValue({
      projectCode: "ENG-2026",
      name: "Example audit",
    });
    prisma.workflowNode.findMany.mockResolvedValue([
      { id: "node-a1000", parentId: null, code: "A1000", title: "Cash" },
    ]);
    prisma.smartFormInstance.findUnique.mockResolvedValue(null);
    const storage = {
      getObjectBuffer: vi
        .fn()
        .mockResolvedValueOnce(
          Buffer.from(JSON.stringify(buildWorkflowSmartFormPackage()))
        )
        .mockResolvedValueOnce(Buffer.from("%PDF-1.7\n")),
      getObjectMetadata: vi.fn().mockRejectedValue(new Error("not cached")),
      putCacheObject: vi.fn().mockResolvedValue({}),
      getDownloadObject: vi.fn((objectKey, fileName, mimeType) => ({
        fileName,
        mimeType,
        absolutePath: objectKey,
      })),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never,
      undefined,
      smartFormPdf as never
    );

    const file = await service.exportAttachment(
      "project-1",
      "attachment-1",
      "zip",
      {
        id: "user-1",
      } as never
    );
    if (!file.body) {
      throw new Error("Expected buffered ZIP export");
    }
    const zip = await JSZip.loadAsync(file.body);
    const entries = Object.values(zip.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name);

    expect(entries).toStrictEqual([
      "ENG-2026 - Example audit/A1000/A1-F001 form.pdf",
    ]);
    expect(entries.some((entry) => entry.endsWith(".sf"))).toBeFalsy();
    const [firstEntry] = entries;
    expect(firstEntry).toBeDefined();
    await expect(
      zip.file(firstEntry ?? "")?.async("string")
    ).resolves.toContain("%PDF-1.7");
  });

  it("streams preview content through the API without taking the master lock", async () => {
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("preview")),
    };
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: "working-papers/project-1/paper-1/cash.xlsx",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 3,
      contentHash: "preview-content-hash",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    const file = await service.previewAttachmentContent(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never,
      undefined,
      undefined,
      3
    );

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "working-papers/project-1/paper-1/cash.xlsx"
    );
    expect(file).toStrictEqual({
      body: Buffer.from("preview"),
      cacheControl: "private, max-age=604800, immutable, no-transform",
      eTag: expect.stringMatching(/^"[A-Za-z0-9_-]+"$/),
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  });

  it("returns preview metadata without reading storage when the ETag matches", async () => {
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(Buffer.from("preview")),
    };
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: "working-papers/project-1/paper-1/cash.xlsx",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 3,
      contentHash: "preview-content-hash",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );
    const initial = await service.previewAttachmentContent(
      "project-1",
      "attachment-1",
      {
        id: "user-1",
      } as never,
      undefined,
      undefined,
      3
    );
    storage.getObjectBuffer.mockClear();

    const cached = await service.previewAttachmentContent(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      undefined,
      initial.eTag,
      3
    );

    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(cached).toStrictEqual({
      cacheControl: "private, max-age=604800, immutable, no-transform",
      eTag: initial.eTag,
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      notModified: true,
    });
  });

  it.each([
    ["downloadAttachment", "download"],
    ["downloadAttachmentReadOnly", "read-only download"],
  ] as const)(
    "exports Smart Forms as PDFs for %s",
    async (methodName, _label) => {
      const smartFormPackage = buildWorkflowSmartFormPackage();
      const storage = {
        getObjectBuffer: vi
          .fn()
          .mockResolvedValue(Buffer.from(JSON.stringify(smartFormPackage))),
        getObjectMetadata: vi.fn().mockRejectedValue(new Error("not found")),
        putCacheObject: vi.fn().mockResolvedValue({
          fileName: "daily-living-form.pdf",
          objectKey:
            "smart-form-pdf-cache/project-1/attachment-smart-form/v3/daily-living-form.pdf",
        }),
        getDownloadObject: vi.fn().mockReturnValue({
          absolutePath: join(
            tmpdir(),
            "project-wing-tests",
            "smart-form-pdf-cache/project-1/attachment-smart-form/v3/daily-living-form.pdf"
          ),
          fileName: "daily-living-form.pdf",
          mimeType: "application/pdf",
        }),
      };
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-smart-form",
        projectId: "project-1",
        fileKind: "SMART_FORM",
        fileUrl: "working-papers/project-1/paper-1/daily-living-form.sf",
        fileName: "daily-living-form.sf",
        originalName: "daily-living-form.sf",
        mimeType: "application/vnd.project-wing.smart-form+json",
        version: 3,
        workingPaperId: "paper-1",
        lockedBy: null,
      });
      prisma.smartFormInstance.findUnique.mockResolvedValue({
        status: "COMPLETE",
        lastSavedAt: new Date("2026-07-03T06:49:00.000Z"),
        updatedAt: new Date("2026-07-03T06:49:30.000Z"),
        completedAt: new Date("2026-07-03T06:51:00.000Z"),
      });
      prisma.workingPaperSignoff.findMany.mockResolvedValue([
        {
          type: "PREPARER",
          signedAt: new Date("2026-07-03T06:50:00.000Z"),
          createdAt: new Date("2026-07-03T06:50:00.000Z"),
          userId: "user-1",
          user: { name: "Jony Ma", email: "jony@example.test" },
        },
        {
          type: "REVIEWER",
          signedAt: new Date("2026-07-03T06:55:00.000Z"),
          createdAt: new Date("2026-07-03T06:55:00.000Z"),
          userId: "user-2",
          user: { name: "Leo Li", email: "leo@example.test" },
        },
      ]);
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never,
        undefined,
        storage as never,
        undefined,
        smartFormPdf as never
      );

      const file = await service[methodName](
        "project-1",
        "attachment-smart-form",
        {
          id: "user-1",
        } as never
      );

      expect(storage.getObjectBuffer).toHaveBeenCalledWith(
        "working-papers/project-1/paper-1/daily-living-form.sf"
      );
      expect(smartFormPdf.renderSmartFormV2Pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          definition: DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
          response: DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
          locale: "en-US",
          fileName: "daily-living-form.sf",
          documentVersion: "v3",
          generatedAt: expect.any(Date),
        })
      );
      expect(prisma.smartFormInstance.findUnique).toHaveBeenCalledWith({
        where: { attachmentId: "attachment-smart-form" },
        select: {
          status: true,
          lastSavedAt: true,
          updatedAt: true,
          completedAt: true,
        },
      });
      expect(storage.putCacheObject).toHaveBeenCalledWith(
        expect.stringMatching(
          /^smart-form-pdf-cache\/project-1\/attachment-smart-form\/v3-[a-f0-9]{12}\/daily-living-form\.pdf$/
        ),
        expect.any(Buffer),
        "application/pdf"
      );
      const cachedPdf = storage.putCacheObject.mock.calls[0][1] as Buffer;
      expect(cachedPdf.toString("utf-8")).toContain("%PDF");
      expect(storage.getDownloadObject).toHaveBeenCalledWith(
        expect.stringMatching(
          /^smart-form-pdf-cache\/project-1\/attachment-smart-form\/v3-[a-f0-9]{12}\/daily-living-form\.pdf$/
        ),
        "daily-living-form.pdf",
        "application/pdf"
      );
      expect(file).toStrictEqual(
        expect.objectContaining({
          fileName: "daily-living-form.pdf",
          mimeType: "application/pdf",
        })
      );
      expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      originalName: "planning-memo.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    { originalName: "legacy-memo.doc", mimeType: "application/msword" },
    {
      originalName: "board-deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    {
      originalName: "archive-deck.ppt",
      mimeType: "application/vnd.ms-powerpoint",
    },
  ])(
    "downloads Office attachment $originalName read-only without taking the master lock",
    async ({ originalName, mimeType }) => {
      const uploadRoot = join(tmpdir(), "project-wing-tests");
      const fileUrl = posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        originalName
      );
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        fileKind: "SUPPORTING",
        fileUrl,
        fileName: originalName,
        originalName,
        mimeType,
      });
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never
      );

      const file = await service.downloadAttachmentReadOnly(
        "project-1",
        "attachment-1",
        {
          id: "user-1",
        } as never
      );

      expect(access.requireProjectMember).toHaveBeenCalledWith(
        "project-1",
        "user-1"
      );
      expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
      expect(file).toStrictEqual({
        absolutePath: join(uploadRoot, fileUrl),
        fileName: originalName,
        mimeType,
      });
      expect(auditLogs.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "ATTACHMENT_READONLY_DOWNLOADED",
          projectId: "project-1",
          targetId: "attachment-1",
        })
      );
    }
  );

  it("continues from a historical version as a new current revision when Master is unlocked", async () => {
    const attachment = {
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 20,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 2,
      workDate: new Date("2026-02-28T00:00:00.000Z"),
      uploadedBy: "user-1",
      lastModifiedBy: "user-1",
      lastModifiedAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: null,
      lockExpiresAt: null,
      headVersionId: "version-2",
    };
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    prisma.attachmentVersion.findFirst.mockResolvedValue({
      id: "version-1",
      attachmentId: "attachment-1",
      projectId: "project-1",
      version: 1,
      fileKind: "SPREADSHEET",
      fileName: "cash-v1.xlsx",
      originalName: "cash-v1.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v1.xlsx"
      ),
      fileSize: 10,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      workDate: new Date("2026-01-31T00:00:00.000Z"),
      parentVersionId: null,
      sourceVersionId: null,
      isCurrent: false,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      fileName: "cash-v1.xlsx",
      version: 1,
      originalName: "cash-v1.xlsx",
      headVersionId: "version-1",
      lockedBy: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.restoreAttachmentVersion(
      "project-1",
      "attachment-1",
      "version-1",
      {
        id: "user-1",
      } as never
    );

    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(prisma.attachmentVersion.updateMany).toHaveBeenCalledWith({
      where: { attachmentId: "attachment-1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(prisma.attachmentVersion.update).toHaveBeenCalledWith({
      where: { id: "version-1" },
      data: { isCurrent: true },
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          version: 1,
          originalName: "cash-v1.xlsx",
          workDate: new Date("2026-01-31T00:00:00.000Z"),
          headVersionId: "version-1",
          lockedBy: null,
          lockReleaseReason: null,
          previewStatus: "QUEUED",
          previewVersion: null,
        }),
      })
    );
    expect(
      documentConversion.clearAttachmentPreviewCache
    ).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_VERSION_RESTORED" })
    );
  });

  it("rejects reset head while any Master lock is active", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 20,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 2,
      workDate: new Date("2026-02-28T00:00:00.000Z"),
      uploadedBy: "user-1",
      lastModifiedBy: "user-1",
      lastModifiedAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockRevokedAt: null,
      headVersionId: "version-2",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.restoreAttachmentVersion(
        "project-1",
        "attachment-1",
        "version-1",
        {
          id: "user-1",
        } as never
      )
    ).rejects.toThrow("Release Master before resetting the head");
    expect(prisma.attachmentVersion.findFirst).not.toHaveBeenCalled();
  });

  it("changes a working paper refcode", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      workflowNodeId: "node-3",
      code: "A1001",
      title: "Cash paper",
    });
    prisma.workingPaper.update.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      workflowNodeId: "node-3",
      code: "A1002",
      title: "Cash paper",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.updateWorkingPaper(
      "project-1",
      "paper-1",
      { id: "user-1" } as never,
      {
        code: "A1002",
      }
    );

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.workingPaper.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "paper-1" },
        data: { code: "A1002" },
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        workingPaperId: "paper-1",
        deletedAt: null,
        placeholderType: { not: null },
      },
      data: { code: "A1002" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_UPDATED",
        targetId: "paper-1",
      })
    );
  });

  it("changes one attachment refcode without updating the paper shell", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      workflowNodeId: "node-3",
      code: "A1001",
      title: "Second file",
      fileName: "stored-second.xlsx",
      originalName: "second.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-3",
      code: "A01-0001",
    });
    prisma.attachment.count.mockResolvedValue(1);
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      code: "A01-0001-F002",
      title: "Second file",
      fileName: "stored-second.xlsx",
      originalName: "second.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.updateAttachmentIdentity(
      "project-1",
      "attachment-2",
      { id: "user-1" } as never,
      {
        code: "A01-0001-F002",
      }
    );

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-2" },
        data: expect.objectContaining({
          code: "A01-0001-F002",
          lastModifiedBy: "user-1",
          lastModifiedAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
  });

  it("updates a placeholder refcode through its linked working paper", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-placeholder",
      projectId: "project-1",
      workingPaperId: "paper-placeholder",
      workflowNodeId: "node-3",
      code: "A01-0001",
      title: "Audit report.docx",
      fileName: "Audit report.docx",
      originalName: "Audit report.docx",
      placeholderType: "WORD",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workingPaper.update.mockResolvedValue({
      id: "paper-placeholder",
      code: "A01-0002",
    });
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-placeholder",
      projectId: "project-1",
      workingPaperId: "paper-placeholder",
      code: "A01-0002",
      title: "Audit report.docx",
      fileName: "Audit report.docx",
      originalName: "Audit report.docx",
      placeholderType: "WORD",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.updateAttachmentIdentity(
      "project-1",
      "attachment-placeholder",
      { id: "user-1" } as never,
      { code: "A01-0002" }
    );

    expect(prisma.workingPaper.update).toHaveBeenCalledWith({
      where: { id: "paper-placeholder" },
      data: { code: "A01-0002" },
    });
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: "project-1",
        workingPaperId: "paper-placeholder",
        placeholderType: { not: null },
      }),
      data: { code: "A01-0002" },
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-placeholder" },
        data: expect.objectContaining({ code: "A01-0002" }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_UPDATED",
        targetId: "paper-placeholder",
      })
    );
  });

  it("rejects attachment refcodes outside the current folder code", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      workflowNodeId: "node-3",
      code: "A01-0001-F002",
      title: "Second file",
      fileName: "stored-second.xlsx",
      originalName: "second.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-3",
      code: "1100",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.updateAttachmentIdentity(
      "project-1",
      "attachment-2",
      { id: "user-1" } as never,
      {
        code: "1100.1",
      }
    );
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "1100.1" }),
      })
    );
    prisma.attachment.update.mockClear();

    await expect(
      service.updateAttachmentIdentity(
        "project-1",
        "attachment-2",
        { id: "user-1" } as never,
        {
          code: "9999.1",
        }
      )
    ).rejects.toThrow("File code must use 1100.1 format");

    expect(prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("renames an attachment display name without creating a new version", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "stored.xlsx",
      originalName: "old.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      fileName: "stored.xlsx",
      originalName: "renamed.xlsx",
      version: 2,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.renameAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      {
        originalName: "renamed.xlsx",
      }
    );

    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          originalName: "renamed.xlsx",
          lastModifiedBy: "user-1",
          lastModifiedAt: expect.any(Date),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_RENAMED" })
    );
  });

  it("renames a placeholder while preserving its expected type extension", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      placeholderType: "WORD",
      fileName: "Old name.docx",
      originalName: "Old name.docx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.renameAttachment(
      "project-1",
      "placeholder-1",
      { id: "user-1" } as never,
      { originalName: "Renamed evidence.pdf" }
    );

    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "placeholder-1" },
        data: expect.objectContaining({
          originalName: "Renamed evidence.docx",
        }),
      })
    );
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
  });

  it("rejects moving an attachment to a working paper target", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.moveAttachment(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          workingPaperId: "paper-2",
        }
      )
    ).rejects.toThrow("project folder");

    expect(prisma.workingPaper.findFirst).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_MOVED" })
    );
  });

  it("rejects copying an attachment to a working paper target", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "stored.pdf",
      originalName: "support.pdf",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "stored.pdf"
      ),
      fileSize: 1234,
      mimeType: "application/pdf",
      version: 4,
      workDate: new Date("2026-06-01T00:00:00.000Z"),
      uploadedBy: "other-user",
      lockedBy: null,
      lockExpiresAt: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.copyAttachment(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          workingPaperId: "paper-2",
        }
      )
    ).rejects.toThrow("project folder");

    expect(prisma.workingPaper.findFirst).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_COPIED" })
    );
  });

  it("blocks direct movement of imported files before creating a target, including administrators", async () => {
    prisma.confirmationEmpImportItem.findFirst.mockResolvedValue({
      id: "import-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );
    await expect(
      service.moveAttachment(
        "project-1",
        "attachment-1",
        { id: "admin", globalRole: "SYSTEM_ADMIN" } as never,
        { workflowNodeId: "other-node" } as never
      )
    ).rejects.toThrow("请回到函证归档处撤回导入");
    expect(prisma.workingPaper.create).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("moves an attachment into a selected workflow folder and bucket", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.attachment.findMany.mockResolvedValue([{ code: "B01-0001-F001" }]);
    prisma.attachment.count.mockResolvedValue(0);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-target",
      projectId: "project-1",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "cash.xlsx",
      bucket: "PRIOR",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      workingPaperId: "paper-target",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "cash.xlsx",
      bucket: "PRIOR",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.moveAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "PRIOR" } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "node-5",
          code: "B01-0001-F002",
          title: "cash.xlsx",
          bucket: "PRIOR",
        }),
      })
    );
    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          workflowNodeId: "node-5",
          deletedAt: null,
        }),
      })
    );
    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
    expect(prisma.workingPaper.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "paper-1" },
      })
    );
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          workingPaperId: "paper-target",
          workflowNodeId: "node-5",
          code: "B01-0001-F002",
          title: "cash.xlsx",
          bucket: "PRIOR",
          lastModifiedBy: "user-1",
        }),
      })
    );
  });

  it("moves one attachment without moving a shared legacy paper shell", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      workflowNodeId: "node-1",
      code: "A01-1000-F002",
      title: "second.xlsx",
      fileKind: "SUPPORTING",
      fileName: "stored-second.xlsx",
      originalName: "second.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.attachment.findMany.mockResolvedValue([{ code: "B01-0001-F001" }]);
    prisma.attachment.count.mockResolvedValue(1);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-target",
      projectId: "project-1",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "second.xlsx",
      bucket: "PRIOR",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-2",
      workingPaperId: "paper-target",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "second.xlsx",
      bucket: "PRIOR",
      fileName: "stored-second.xlsx",
      originalName: "second.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.moveAttachment(
      "project-1",
      "attachment-2",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "PRIOR" } as never
    );

    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
    expect(prisma.workingPaper.delete).not.toHaveBeenCalled();
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-2" },
        data: expect.objectContaining({
          workingPaperId: "paper-target",
          workflowNodeId: "node-5",
          code: "B01-0001-F002",
          title: "second.xlsx",
          bucket: "PRIOR",
        }),
      })
    );
  });

  it("retries relocation paper creation when a generated code collides", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ code: "B01-0001-F001" }]);
    prisma.attachment.findMany.mockResolvedValue([]);
    prisma.attachment.count.mockResolvedValue(1);
    prisma.workingPaper.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`workflow_node_id`,`code`)",
          {
            code: "P2002",
            clientVersion: "test",
          }
        )
      )
      .mockResolvedValueOnce({
        id: "paper-target",
        projectId: "project-1",
        workflowNodeId: "node-5",
        code: "B01-0001-F002",
        title: "cash.xlsx",
        bucket: "CURRENT",
      });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      workingPaperId: "paper-target",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "cash.xlsx",
      bucket: "CURRENT",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.moveAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "CURRENT" } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ code: "B01-0001-F001" }),
      })
    );
    expect(prisma.workingPaper.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ code: "B01-0001-F002" }),
      })
    );
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-target",
          code: "B01-0001-F002",
        }),
      })
    );
  });

  it("copies an attachment into a selected workflow folder and bucket", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "stored.pdf",
      originalName: "support.pdf",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "stored.pdf"
      ),
      fileSize: 1234,
      mimeType: "application/pdf",
      version: 4,
      workDate: new Date("2026-06-01T00:00:00.000Z"),
      uploadedBy: "other-user",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([{ code: "B01-0001-F001" }]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-new",
      projectId: "project-1",
      workflowNodeId: "node-5",
      code: "B01-0001-F002",
      title: "support.pdf",
      bucket: "TEMPORARY",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-copy",
      workingPaperId: "paper-new",
      fileName: "stored.pdf",
      originalName: "support.pdf",
      version: 1,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.copyAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "TEMPORARY" } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          workflowNodeId: "node-5",
          code: "B01-0001-F002",
          title: "support.pdf",
          paperType: "WORKING_PAPER",
          bucket: "TEMPORARY",
          createdBy: "user-1",
        }),
      })
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          workingPaperId: "paper-new",
          workflowNodeId: "node-5",
          code: "B01-0001-F002",
          title: "support.pdf",
          bucket: "TEMPORARY",
          originalName: "support.pdf",
          version: 1,
          uploadedBy: "user-1",
          lastModifiedBy: "user-1",
        }),
      })
    );
  });

  it("copies an unfilled placeholder without creating a file version", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      placeholderType: "WORD",
      fileName: "Audit report.docx",
      originalName: "Audit report.docx",
      fileUrl: "",
      fileSize: 0,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version: 0,
      headVersionId: null,
      workDate: new Date("2026-06-01T00:00:00.000Z"),
      uploadedBy: "user-1",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-new",
      projectId: "project-1",
      workflowNodeId: "node-5",
      code: "B01-0001-F001",
      title: "Audit report.docx",
      bucket: "CURRENT",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "placeholder-copy",
      projectId: "project-1",
      workingPaperId: "paper-new",
      placeholderType: "WORD",
      fileName: "Audit report.docx",
      originalName: "Audit report.docx",
      fileUrl: "",
      fileSize: 0,
      version: 0,
      headVersionId: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.copyAttachment(
      "project-1",
      "placeholder-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "CURRENT" } as never
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placeholderType: "WORD",
          fileUrl: "",
          fileSize: 0,
          version: 0,
          previewStatus: "UNSUPPORTED",
        }),
      })
    );
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("copies a Smart Form attachment with its instance metadata", async () => {
    const completedAt = new Date("2026-06-20T12:00:00.000Z");
    const lastSavedAt = new Date("2026-06-20T12:05:00.000Z");
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "daily-life.sf",
      originalName: "Daily life.sf",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "daily-life.sf"
      ),
      fileSize: 1234,
      mimeType: "application/vnd.project-wing.smart-form+json",
      version: 4,
      headVersionId: "attachment-version-source-4",
      workDate: new Date("2026-06-01T00:00:00.000Z"),
      uploadedBy: "other-user",
      lockedBy: null,
      lockExpiresAt: null,
    });
    prisma.smartFormInstance.findUnique.mockResolvedValue({
      id: "smart-form-instance-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      smartFormTemplateId: "template-1",
      smartFormTemplateVersionId: "template-version-1",
      schemaHash: "schema-hash",
      answerHash: "answer-hash",
      status: "COMPLETE",
      completedAt,
      lastSavedBy: "other-user",
      lastSavedAt,
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-5",
      projectId: "project-1",
      code: "B01-0001",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    prisma.attachment.findMany.mockResolvedValue([]);
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-new",
      projectId: "project-1",
      workflowNodeId: "node-5",
      code: "B01-0001-F001",
      title: "Daily life.sf",
      bucket: "TEMPORARY",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-copy",
      projectId: "project-1",
      workingPaperId: "paper-new",
      fileKind: "SMART_FORM",
      fileName: "daily-life.sf",
      originalName: "Daily life.sf",
      version: 1,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.copyAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { workflowNodeId: "node-5", bucket: "TEMPORARY" } as never
    );

    expect(prisma.smartFormInstance.findUnique).toHaveBeenCalledWith({
      where: { attachmentId: "attachment-1" },
    });
    expect(prisma.smartFormInstance.create).toHaveBeenCalledWith({
      data: {
        projectId: "project-1",
        attachmentId: "attachment-copy",
        smartFormTemplateId: "template-1",
        smartFormTemplateVersionId: "template-version-1",
        schemaHash: "schema-hash",
        answerHash: "answer-hash",
        status: "COMPLETE",
        completedAt,
        lastSavedBy: "other-user",
        lastSavedAt,
      },
    });
    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-copy",
        projectId: "project-1",
        version: 1,
        parentVersionId: null,
        sourceVersionId: "attachment-version-source-4",
        fileKind: "SMART_FORM",
        fileName: "daily-life.sf",
        originalName: "Daily life.sf",
        fileUrl: posix.join(
          "working-papers",
          "project-1",
          "paper-1",
          "daily-life.sf"
        ),
        fileSize: 1234,
        mimeType: "application/vnd.project-wing.smart-form+json",
        action: "INITIAL",
        isCurrent: true,
      }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-copy" },
        data: expect.objectContaining({
          headVersionId: expect.stringContaining(
            "attachment-version-attachment-copy-1"
          ),
        }),
      })
    );
  });

  it("archives descendant attachments before deleting a workflow group", async () => {
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-2",
      projectId: "project-1",
      level: 2,
      code: "A01",
    });
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-2",
        workingPapers: [],
      },
      {
        id: "node-3",
        code: "A01-0001",
        workingPapers: [
          {
            id: "paper-1",
            code: "A01-0001-F001",
            title: "Cash paper",
            attachments: [
              {
                id: "attachment-1",
                fileName: "stored.xlsx",
                originalName: "cash.xlsx",
              },
            ],
          },
        ],
      },
    ]);
    prisma.workflowNode.delete.mockResolvedValue({ id: "node-2" });
    prisma.attachment.update.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.deleteNode("project-1", "node-2", {
      id: "user-1",
    } as never);

    expect(prisma.workflowNode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "project-1",
          OR: [{ id: "node-2" }, { parentId: "node-2" }],
        },
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          workingPaperId: null,
          deletedAt: expect.any(Date),
          deletedBy: "user-1",
          deletedFromWorkingPaperId: "paper-1",
          deletedFromWorkingPaperCode: "A01-0001-F001",
          deletedFromWorkingPaperTitle: "Cash paper",
          lockedBy: null,
        }),
      })
    );
    expect(prisma.workflowNode.delete).toHaveBeenCalledWith({
      where: { id: "node-2" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_DELETED",
        targetId: "attachment-1",
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKFLOW_NODE_DELETED",
        targetId: "node-2",
      })
    );
  });

  it("stores the selected file bucket when creating a working paper under any directory level", async () => {
    access.requireProjectRole.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-4",
      projectId: "project-1",
      level: 4,
    });
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      workflowNodeId: "node-4",
      code: "A01-0001-F001",
      title: "上年底稿.xlsx",
      paperType: "SUPPLEMENT",
      bucket: "PRIOR",
      createdBy: "user-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createWorkingPaper(
      "project-1",
      { id: "user-1" } as never,
      {
        workflowNodeId: "node-4",
        code: "A01-0001-F001",
        title: "上年底稿.xlsx",
        paperType: "SUPPLEMENT",
        bucket: "PRIOR",
      } as never
    );

    expect(prisma.workingPaper.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bucket: "PRIOR",
        }),
      })
    );
  });

  it("locks spreadsheet attachments and records who holds the lock", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.lockAttachment("project-1", "attachment-1", {
      id: "user-1",
    } as never);

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "attachment-1" }),
        data: expect.objectContaining({ lockedBy: "user-1" }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "ATTACHMENT_LOCKED",
        projectId: "project-1",
      })
    );
  });

  it("locks document attachments so supporting files can be version controlled", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-doc",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      originalName: "support.pdf",
      fileName: "stored.pdf",
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.lockAttachment("project-1", "attachment-doc", {
      id: "user-1",
    } as never);

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "attachment-doc" }),
        data: expect.objectContaining({ lockedBy: "user-1" }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_LOCKED",
        description: "锁定文件 support.pdf",
      })
    );
  });

  it("rejects new spreadsheet versions unless the current user holds the lock", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      version: 1,
      lockedBy: "other-user",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.uploadNewAttachmentVersion(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          originalname: "cash.xlsx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 12,
          buffer: Buffer.from("xlsx"),
        }
      )
    ).rejects.toThrow("该文件已被其他成员锁定");
  });

  it("blocks server-side version changes while a desktop Master session is active", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      version: 1,
      lockedBy: "user-1",
      lockSessionId: "desktop-master-session",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.uploadNewAttachmentVersion(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          originalname: "cash.xlsx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 12,
          buffer: Buffer.from("xlsx"),
        }
      )
    ).rejects.toThrow(
      "A desktop Master session is active. Check in or release it before changing the server version."
    );
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
  });

  it("uploads new versions for document attachments after the user locks them", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-doc",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "support-v1.pdf",
      originalName: "support-v1.pdf",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "support-v1.pdf"
      ),
      fileSize: 10,
      mimeType: "application/pdf",
      version: 1,
      workDate: new Date("2026-01-31T00:00:00.000Z"),
      uploadedBy: "user-1",
      lastModifiedBy: "user-1",
      lastModifiedAt: new Date("2026-02-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
      headVersionId: "version-doc-1",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "version-doc-2",
      attachmentId: "attachment-doc",
      projectId: "project-1",
      version: 2,
      originalName: "support-v2.pdf",
      isCurrent: true,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-doc",
      originalName: "support-v2.pdf",
      version: 2,
      headVersionId: "version-doc-2",
      lockedBy: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.uploadNewAttachmentVersion(
      "project-1",
      "attachment-doc",
      { id: "user-1" } as never,
      {
        originalname: "support-v2.pdf",
        mimetype: "application/pdf",
        size: 12,
        buffer: Buffer.from("%PDF-1.4"),
      }
    );

    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-doc",
        projectId: "project-1",
        version: 2,
        originalName: "support-v2.pdf",
        parentVersionId: "version-doc-1",
        sourceVersionId: null,
        action: "UPLOAD",
        isCurrent: true,
        uploadedBy: "user-1",
      }),
    });
    expect(prisma.attachmentVersion.updateMany).toHaveBeenCalledWith({
      where: { attachmentId: "attachment-doc", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-doc" },
        data: expect.objectContaining({
          originalName: "support-v2.pdf",
          mimeType: "application/pdf",
          version: 2,
          headVersionId: "version-doc-2",
          lockedBy: null,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_VERSION_UPLOADED",
        description: "上传文件新版本 support-v2.pdf",
      })
    );
  });

  it("normalizes mojibake UTF-8 names before storing uploaded attachments", async () => {
    const mojibakeName = Buffer.from(
      "银行函证控制表202605.xlsx",
      "utf-8"
    ).toString("latin1");
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      workflowNodeId: "node-1",
      bucket: "CURRENT",
      code: "A01-0001-F001",
      title: "Cash paper",
    });
    let createdAttachment: Record<string, unknown> = {};
    prisma.attachment.create.mockImplementation((input) => {
      createdAttachment = {
        id: "attachment-1",
        version: 1,
        ...input.data,
      };
      return Promise.resolve(createdAttachment);
    });
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        ...createdAttachment,
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.uploadAttachment(
      "project-1",
      "paper-1",
      { id: "user-1" } as never,
      { fileKind: "SPREADSHEET" },
      {
        originalname: mojibakeName,
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 12,
        buffer: Buffer.from("xlsx"),
      }
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "node-1",
          bucket: "CURRENT",
          code: "A01-0001-F001",
          title: "Cash paper",
          originalName: "银行函证控制表202605.xlsx",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "上传底稿文件 银行函证控制表202605.xlsx",
      })
    );
    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-1",
        version: 1,
        parentVersionId: null,
        sourceVersionId: null,
        action: "INITIAL",
        isCurrent: true,
      }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          headVersionId: "attachment-version-attachment-1-1",
        }),
      })
    );
  });

  it("creates an empty typed attachment placeholder without a file version", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      workflowNodeId: "node-1",
      bucket: "CURRENT",
      code: "A01-0001-F001",
      title: "Cash paper",
    });
    prisma.attachment.findFirst.mockResolvedValue(null);
    prisma.attachment.create.mockImplementation((input) =>
      Promise.resolve({ id: "placeholder-1", ...input.data })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await service.createAttachmentPlaceholder(
      "project-1",
      "paper-1",
      { id: "user-1" } as never,
      { name: "Audit report", placeholderType: "WORD" }
    );

    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placeholderType: "WORD",
          fileName: "Audit report.docx",
          originalName: "Audit report.docx",
          fileUrl: "",
          fileSize: 0,
          version: 0,
        }),
      })
    );
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(result).toStrictEqual(
      expect.objectContaining({
        id: "placeholder-1",
        placeholderType: "WORD",
      })
    );
  });

  it("replaces a placeholder with a matching file and creates version one", async () => {
    const placeholder = {
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      workflowNodeId: "node-1",
      bucket: "CURRENT",
      fileKind: "SUPPORTING",
      placeholderType: "SPREADSHEET",
      fileName: "Audit report.xlsx",
      originalName: "Audit report.xlsx",
      fileUrl: "",
      headVersionId: null,
      deletedAt: null,
    };
    prisma.attachment.findFirst
      .mockResolvedValueOnce(placeholder)
      .mockResolvedValueOnce(placeholder);
    const storage = {
      getObjectMetadata: vi.fn().mockResolvedValue({
        contentLength: 2048,
        contentType: "text/csv",
      }),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.confirmAttachmentPlaceholderUpload(
      "project-1",
      "placeholder-1",
      { id: "user-1" } as never,
      {
        fileName: "replacement.csv",
        fileSize: 2048,
        mimeType: "text/csv",
        objectKey: "working-papers/project-1/paper-1/stored-replacement.csv",
      }
    );

    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "placeholder-1",
        version: 1,
        parentVersionId: null,
        originalName: "Audit report.csv",
        action: "INITIAL",
      }),
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "placeholder-1" },
        data: expect.objectContaining({
          placeholderType: null,
          version: 1,
          originalName: "Audit report.csv",
          fileName: "stored-replacement.csv",
          headVersionId: "attachment-version-placeholder-1-1",
        }),
      })
    );
  });

  it("rejects a replacement from a different file family before storage access", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      placeholderType: "WORD",
      deletedAt: null,
    });
    const storage = { getObjectMetadata: vi.fn() };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.confirmAttachmentPlaceholderUpload(
        "project-1",
        "placeholder-1",
        { id: "user-1" } as never,
        {
          fileName: "replacement.pdf",
          fileSize: 2048,
          mimeType: "application/pdf",
          objectKey: "working-papers/project-1/paper-1/replacement.pdf",
        }
      )
    ).rejects.toThrow("Select a word file");
    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
  });

  it("removes the uploaded object when placeholder replacement cannot commit", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      placeholderType: "PDF",
      fileName: "Evidence.pdf",
      originalName: "Evidence.pdf",
      fileUrl: "",
      headVersionId: null,
      deletedAt: null,
    });
    prisma.$transaction.mockRejectedValueOnce(new Error("transaction failed"));
    const storage = {
      getObjectMetadata: vi.fn().mockResolvedValue({
        contentLength: 2048,
        contentType: "application/pdf",
      }),
      deleteObject: vi.fn().mockResolvedValue(undefined as never),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );
    const objectKey = "working-papers/project-1/paper-1/stored-replacement.pdf";

    await expect(
      service.confirmAttachmentPlaceholderUpload(
        "project-1",
        "placeholder-1",
        { id: "user-1" } as never,
        {
          fileName: "replacement.pdf",
          fileSize: 2048,
          mimeType: "application/pdf",
          objectKey,
        }
      )
    ).rejects.toThrow("transaction failed");

    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it.each([
    ["PDF", "support.pdf", "application/pdf"],
    [
      "PPTX",
      "board-deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["PPT", "archive-deck.ppt", "application/vnd.ms-powerpoint"],
  ])(
    "creates a direct upload grant for a working paper %s attachment",
    async (_label, fileName, mimeType) => {
      prisma.workingPaper.findFirst.mockResolvedValue({
        id: "paper-1",
        projectId: "project-1",
      });
      const storage = {
        createUploadGrant: vi.fn().mockReturnValue({
          objectKey: `working-papers/project-1/paper-1/${fileName}`,
          fileName: `stored-${fileName}`,
          uploadUrl: "https://oss.example/upload",
          method: "PUT",
          headers: { "Content-Type": mimeType },
          expiresAt: "2026-06-12T12:00:00.000Z",
        }),
      };
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never,
        undefined,
        storage as never
      );

      const grant = await service.createAttachmentUploadGrant(
        "project-1",
        "paper-1",
        { id: "user-1" } as never,
        {
          fileKind: "SUPPORTING",
          fileName,
          fileSize: 1024,
          mimeType,
        }
      );

      expect(access.requireProjectRole).toHaveBeenCalledWith(
        "project-1",
        "user-1",
        "PREPARER"
      );
      expect(storage.createUploadGrant).toHaveBeenCalledWith(
        "project-1",
        "paper-1",
        fileName,
        mimeType
      );
      expect(grant.uploadUrl).toBe("https://oss.example/upload");
    }
  );

  it.each([
    [
      "PPTX",
      "board-deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ["PDF", "lease-contract.pdf", "application/pdf"],
  ])(
    "creates a direct upload grant for a %s attachment without file-kind semantics",
    async (_label, fileName, mimeType) => {
      prisma.workingPaper.findFirst.mockResolvedValue({
        id: "paper-1",
        projectId: "project-1",
      });
      const storage = {
        createUploadGrant: vi.fn().mockReturnValue({
          objectKey: `working-papers/project-1/paper-1/${fileName}`,
          fileName: `stored-${fileName}`,
          uploadUrl: "https://oss.example/upload",
          method: "PUT",
          headers: { "Content-Type": mimeType },
          expiresAt: "2026-06-12T12:00:00.000Z",
        }),
      };
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never,
        undefined,
        storage as never
      );

      const grant = await service.createAttachmentUploadGrant(
        "project-1",
        "paper-1",
        { id: "user-1" } as never,
        {
          fileName,
          fileSize: 1024,
          mimeType,
        }
      );

      expect(storage.createUploadGrant).toHaveBeenCalledWith(
        "project-1",
        "paper-1",
        fileName,
        mimeType
      );
      expect(grant.uploadUrl).toBe("https://oss.example/upload");
    }
  );

  it("deletes an empty working paper created during a failed upload", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-empty",
      projectId: "project-1",
      code: "A01-0001-F099",
      title: "sample-upload.pptx",
    });
    prisma.attachment.count.mockResolvedValue(0);
    prisma.workingPaperSignoff.count.mockResolvedValue(0);
    prisma.workingPaperQuestion.count.mockResolvedValue(0);
    prisma.workingPaper.delete.mockResolvedValue({ id: "paper-empty" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const deleted = await service.deleteWorkingPaper(
      "project-1",
      "paper-empty",
      {
        id: "user-1",
      } as never
    );

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      "project-1",
      "user-1",
      "PREPARER"
    );
    expect(prisma.attachment.count).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        workingPaperId: "paper-empty",
        deletedAt: null,
      },
    });
    expect(prisma.workingPaper.delete).toHaveBeenCalledWith({
      where: { id: "paper-empty" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_DELETED",
        targetId: "paper-empty",
      })
    );
    expect(deleted).toStrictEqual({ id: "paper-empty" });
  });

  it("does not delete a working paper that already has an attachment", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-with-file",
      projectId: "project-1",
      code: "A01-0001-F100",
      title: "sample-upload.pptx",
    });
    prisma.attachment.count.mockResolvedValue(1);
    prisma.workingPaperSignoff.count.mockResolvedValue(0);
    prisma.workingPaperQuestion.count.mockResolvedValue(0);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.deleteWorkingPaper("project-1", "paper-with-file", {
        id: "user-1",
      } as never)
    ).rejects.toThrow("Only empty working papers can be deleted");

    expect(prisma.workingPaper.delete).not.toHaveBeenCalled();
  });

  it("allows another direct upload when the working paper has an active file", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-existing",
      workingPaperId: "paper-1",
      deletedAt: null,
    });
    const storage = {
      createUploadGrant: vi.fn().mockReturnValue({
        objectKey: "working-papers/project-1/paper-1/support.pdf",
        fileName: "support.pdf",
        uploadUrl: "https://oss.example/upload",
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        expiresAt: "2026-07-27T00:00:00.000Z",
      }),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.createAttachmentUploadGrant(
        "project-1",
        "paper-1",
        { id: "user-1" } as never,
        {
          fileKind: "SUPPORTING",
          fileName: "support.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
        }
      )
    ).resolves.toMatchObject({ fileName: "support.pdf" });
    expect(storage.createUploadGrant).toHaveBeenCalledOnce();
  });

  it.each(["cash-macro.xlsm", "cash-model.xlsb"])(
    "creates a direct upload grant for spreadsheet %s",
    async (fileName) => {
      prisma.workingPaper.findFirst.mockResolvedValue({
        id: "paper-1",
        projectId: "project-1",
      });
      const storage = {
        createUploadGrant: vi.fn().mockReturnValue({
          objectKey: `working-papers/project-1/paper-1/${fileName}`,
          fileName,
          uploadUrl: "https://oss.example/upload",
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          expiresAt: "2026-06-12T12:00:00.000Z",
        }),
      };
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never,
        undefined,
        storage as never
      );

      const grant = await service.createAttachmentUploadGrant(
        "project-1",
        "paper-1",
        { id: "user-1" } as never,
        {
          fileKind: "SPREADSHEET",
          fileName,
          fileSize: 1024,
          mimeType: "application/octet-stream",
        }
      );

      expect(storage.createUploadGrant).toHaveBeenCalledWith(
        "project-1",
        "paper-1",
        fileName,
        "application/octet-stream"
      );
      expect(grant.uploadUrl).toBe("https://oss.example/upload");
    }
  );

  it("confirms a directly uploaded object before creating attachment metadata", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
    });
    const storage = {
      getObjectMetadata: vi.fn().mockResolvedValue({
        contentLength: 1024,
        contentType: "application/pdf",
      }),
    };
    let createdAttachment: Record<string, unknown> = {};
    prisma.attachment.create.mockImplementation((input) => {
      createdAttachment = {
        id: "attachment-1",
        version: 1,
        ...input.data,
      };
      return Promise.resolve(createdAttachment);
    });
    prisma.attachment.update.mockImplementation((input) =>
      Promise.resolve({
        ...createdAttachment,
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.confirmAttachmentUpload(
      "project-1",
      "paper-1",
      { id: "user-1" } as never,
      {
        fileKind: "SUPPORTING",
        fileName: "support.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        objectKey: "working-papers/project-1/paper-1/stored-support.pdf",
      }
    );

    expect(storage.getObjectMetadata).toHaveBeenCalledWith(
      "working-papers/project-1/paper-1/stored-support.pdf"
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalName: "support.pdf",
          fileName: "stored-support.pdf",
          fileUrl: "working-papers/project-1/paper-1/stored-support.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
        }),
      })
    );
    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-1",
        version: 1,
        fileUrl: "working-papers/project-1/paper-1/stored-support.pdf",
        action: "INITIAL",
      }),
    });
  });

  it("rejects direct upload confirmations with escaping object keys", async () => {
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
    });
    const storage = {
      getObjectMetadata: vi.fn(),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.confirmAttachmentUpload(
        "project-1",
        "paper-1",
        { id: "user-1" } as never,
        {
          fileKind: "SUPPORTING",
          fileName: "package.json",
          fileSize: 1024,
          mimeType: "application/json",
          objectKey:
            "working-papers/project-1/paper-1/../../../../package.json",
        }
      )
    ).rejects.toThrow("Uploaded object does not belong");
    expect(storage.getObjectMetadata).not.toHaveBeenCalled();
  });

  it("normalizes stored mojibake names when returning working paper details", async () => {
    const mojibakeName = Buffer.from(
      "收入循环底稿202605.xlsx",
      "utf-8"
    ).toString("latin1");
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      title: mojibakeName,
      attachments: [
        {
          id: "attachment-1",
          fileName: "stored.xlsx",
          originalName: mojibakeName,
        },
      ],
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const paper = (await service.getWorkingPaper("project-1", "paper-1", {
      id: "user-1",
    } as never)) as unknown as {
      title: string;
      attachments: { originalName: string | null }[];
    };

    expect(paper.title).toBe("收入循环底稿202605.xlsx");
    expect(paper.attachments[0].originalName).toBe("收入循环底稿202605.xlsx");
  });

  it("returns spreadsheet preview rows in chunks", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const relativeDir = posix.join("working-papers", "project-1", "paper-1");
    const fileUrl = posix.join(relativeDir, "preview.xlsx");
    const absoluteDir = join(uploadRoot, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["科目", "金额"],
      ["现金", 100],
      ["银行存款", 200],
      ["应收账款", 300],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "余额表");
    XLSX.writeFile(workbook, join(uploadRoot, fileUrl));
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl,
      fileName: "preview.xlsx",
      originalName: "【科目余额表】202605.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const preview = await service.previewAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { sheetIndex: 0, offset: 1, limit: 2 }
    );

    expect(preview.fileName).toBe("【科目余额表】202605.xlsx");
    expect(preview.sheetNames).toStrictEqual(["余额表"]);
    expect(preview.totalRows).toBe(4);
    expect(preview.rows).toStrictEqual([
      { rowNumber: 2, cells: ["现金", "100"] },
      { rowNumber: 3, cells: ["银行存款", "200"] },
    ]);
    expect(preview.hasMore).toBeTruthy();
  });

  it("serves ready spreadsheet previews from persistent cache", async () => {
    const attachment = {
      id: "attachment-cached-sheet",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: "working-papers/project-1/paper-1/cached.xlsx",
      fileName: "cached.xlsx",
      originalName: "cached.xlsx",
      fileSize: 1024,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 2,
      previewStatus: "READY",
      previewVersion: 2,
      previewNextAttemptAt: null,
    };
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    const cachedPreview = {
      attachmentId: attachment.id,
      fileName: attachment.originalName,
      sheetNames: ["Sheet1"],
      sheetIndex: 0,
      sheetName: "Sheet1",
      offset: 0,
      limit: 50,
      totalRows: 1,
      totalColumns: 1,
      rows: [{ rowNumber: 1, cells: ["cached"] }],
      hasMore: false,
    };
    const spreadsheetPreview = {
      getManifest: vi.fn().mockResolvedValue({ version: 2 }),
      readPreview: vi.fn().mockResolvedValue(cachedPreview),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      undefined,
      undefined,
      undefined,
      spreadsheetPreview as never
    );

    await expect(
      service.previewAttachment(
        "project-1",
        attachment.id,
        { id: "user-1" } as never,
        {
          offset: 0,
          limit: 50,
        }
      )
    ).resolves.toStrictEqual(cachedPreview);
    expect(spreadsheetPreview.readPreview).toHaveBeenCalledWith(attachment, {
      offset: 0,
      limit: 50,
    });
  });

  it("queues background spreadsheet preview generation on a cache miss", async () => {
    const attachment = {
      id: "attachment-missing-cache",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: "working-papers/project-1/paper-1/missing-cache.xlsx",
      fileName: "missing-cache.xlsx",
      originalName: "missing-cache.xlsx",
      fileSize: 1024,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 4,
      previewStatus: "QUEUED",
      previewVersion: null,
      previewNextAttemptAt: null,
    };
    prisma.attachment.findFirst.mockResolvedValue(attachment);
    const spreadsheetPreview = {
      getManifest: vi.fn().mockResolvedValue(null),
      readPreview: vi.fn(),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      undefined,
      undefined,
      undefined,
      spreadsheetPreview as never
    );

    await expect(
      service.previewAttachment(
        "project-1",
        attachment.id,
        { id: "user-1" } as never,
        {
          offset: 0,
          limit: 50,
        }
      )
    ).rejects.toMatchObject({
      response: {
        code: "PREVIEW_PROCESSING",
        message: "Preview is being prepared.",
      },
    });
    expect(spreadsheetPreview.readPreview).not.toHaveBeenCalled();
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("reuses a parsed workbook when loading adjacent preview chunks", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const relativeDir = posix.join("working-papers", "project-1", "paper-1");
    const fileUrl = posix.join(relativeDir, "preview-cache.xlsx");
    const absoluteDir = join(uploadRoot, relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Account", "Amount"],
      ["Cash", 100],
      ["Revenue", 200],
      ["Receivable", 300],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, join(uploadRoot, fileUrl));
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl,
      fileName: "preview-cache.xlsx",
      originalName: "preview-cache.xlsx",
    });
    const readWorkbookFile = vi.spyOn(spreadsheetWorkbookReader, "readFile");
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.previewAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      {
        offset: 0,
        limit: 2,
      }
    );
    const secondPreview = await service.previewAttachment(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      { offset: 2, limit: 2 }
    );

    expect(secondPreview.rows).toStrictEqual([
      { rowNumber: 3, cells: ["Revenue", "200"] },
      { rowNumber: 4, cells: ["Receivable", "300"] },
    ]);
    expect(readWorkbookFile).toHaveBeenCalledOnce();
  });

  it("reuses a parsed workbook from object storage preview chunks", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Account", "Amount"],
      ["Cash", 100],
      ["Revenue", 200],
      ["Receivable", 300],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-buffer-cache",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: "oss/preview-cache.xlsx",
      fileName: "preview-cache.xlsx",
      originalName: "preview-cache.xlsx",
      fileSize: buffer.byteLength,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 1,
      updatedAt: new Date("2026-06-01T08:00:00.000Z"),
      lastModifiedAt: new Date("2026-06-01T08:00:00.000Z"),
    });
    const storage = {
      getDownloadObject: vi.fn().mockReturnValue({
        fileName: "preview-cache.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        redirectUrl: "https://oss.example/preview-cache.xlsx",
      }),
      getObjectBuffer: vi.fn().mockResolvedValue(buffer),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.previewAttachment(
      "project-1",
      "attachment-buffer-cache",
      { id: "user-1" } as never,
      { offset: 0, limit: 2 }
    );
    const secondPreview = await service.previewAttachment(
      "project-1",
      "attachment-buffer-cache",
      { id: "user-1" } as never,
      { offset: 2, limit: 2 }
    );

    expect(secondPreview.rows).toStrictEqual([
      { rowNumber: 3, cells: ["Revenue", "200"] },
      { rowNumber: 4, cells: ["Receivable", "300"] },
    ]);
    expect(storage.getObjectBuffer).toHaveBeenCalledOnce();
  });

  it("reports a clear error when the stored preview file is missing", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "missing.xlsx"
      ),
      fileName: "missing.xlsx",
      originalName: "缺失文件.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.previewAttachment(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          offset: 0,
          limit: 50,
        }
      )
    ).rejects.toThrow("原始文件不存在，请重新上传");
  });

  it("uploads a new version for the lock holder and releases the lock", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 10,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      version: 2,
      workDate: new Date("2026-02-28T00:00:00.000Z"),
      uploadedBy: "user-1",
      lastModifiedBy: "user-1",
      lastModifiedAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
      headVersionId: "version-2",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "version-3",
      attachmentId: "attachment-1",
      projectId: "project-1",
      version: 3,
      originalName: "cash-v3.xlsx",
      isCurrent: true,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      headVersionId: "version-3",
      lockedBy: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.uploadNewAttachmentVersion(
      "project-1",
      "attachment-1",
      { id: "user-1" } as never,
      {
        originalname: "cash-v3.xlsx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 12,
        buffer: Buffer.from("xlsx"),
      },
      { workDate: "2026-03-31" }
    );

    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attachmentId: "attachment-1",
        version: 3,
        originalName: "cash-v3.xlsx",
        workDate: new Date("2026-03-31T00:00:00.000Z"),
        parentVersionId: "version-2",
        action: "UPLOAD",
        isCurrent: true,
      }),
    });
    expect(prisma.attachmentVersion.updateMany).toHaveBeenCalledWith({
      where: { attachmentId: "attachment-1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          version: 3,
          workDate: new Date("2026-03-31T00:00:00.000Z"),
          headVersionId: "version-3",
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          previewStatus: "QUEUED",
          previewVersion: null,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "ATTACHMENT_VERSION_UPLOADED",
      })
    );
    expect(documentConversion.clearAttachmentPreviewCache).toHaveBeenCalledWith(
      "attachment-1"
    );
  });

  it("opens a desktop Master session with a scoped grant and lock session id", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockedBy: null,
      lockSessionId: null,
    });
    prisma.desktopMasterGrant.create.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).openAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "http", host: "localhost:3000" }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        projectId: "project-1",
        fileName: "cash.xlsx",
        version: 2,
        contentToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        lockSessionId: expect.any(String),
        grantSecret: expect.any(String),
        downloadUrl:
          "http://localhost:3000/engagement/project-1/workflow/attachments/attachment-1/master/download",
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: null,
        }),
        data: expect.objectContaining({
          lockedBy: "user-1",
          lockSessionId: expect.any(String),
          lockHeartbeatAt: expect.any(Date),
          lockExpiresAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.desktopMasterGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          projectId: "project-1",
          userId: "user-1",
          lockSessionId: expect.any(String),
          secretHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("reclaims a Master lease only after expiry plus grace and fences the old session", async () => {
    prisma.attachment.findFirst
      .mockResolvedValueOnce({
        id: "attachment-1",
        projectId: "project-1",
        fileKind: "SPREADSHEET",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        version: 2,
        lockEpoch: 4,
        lockedBy: "user-old",
        lockSessionId: "lock-session-old",
        lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        lockRevokedAt: null,
      })
      .mockResolvedValueOnce({
        id: "attachment-1",
        projectId: "project-1",
        fileKind: "SPREADSHEET",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        version: 2,
        lockEpoch: 5,
        lockedBy: null,
        lockSessionId: null,
        lockExpiresAt: null,
        lockRevokedAt: new Date(),
      });
    prisma.attachment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (service as unknown as PrivateWorkflowService).openAttachmentMaster(
        "project-1",
        "attachment-1",
        { id: "user-1" },
        { protocol: "http", host: "localhost:3000" }
      )
    ).resolves.toMatchObject({ ok: true, lockEpoch: 6 });

    expect(prisma.attachment.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          lockSessionId: "lock-session-old",
          lockEpoch: 4,
          OR: expect.arrayContaining([
            { lockExpiresAt: { lt: expect.any(Date) } },
          ]),
        }),
        data: expect.objectContaining({
          lockEpoch: { increment: 1 },
          lockedBy: null,
          lockReleaseReason: "LEASE_EXPIRED",
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lockSessionId: "lock-session-old",
          revokedAt: null,
        },
      })
    );
  });

  it("reclaims a stale legacy Master lock whose expiry was never populated", async () => {
    const staleLockedAt = new Date(Date.now() - 4 * 60 * 60_000);
    prisma.attachment.findFirst
      .mockResolvedValueOnce({
        id: "attachment-1",
        projectId: "project-1",
        fileKind: "SPREADSHEET",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        version: 2,
        lockEpoch: 4,
        lockedBy: "user-old",
        lockedAt: staleLockedAt,
        lockHeartbeatAt: null,
        lockSessionId: "legacy-lock-session",
        lockExpiresAt: null,
        lockRevokedAt: null,
      })
      .mockResolvedValueOnce({
        id: "attachment-1",
        projectId: "project-1",
        fileKind: "SPREADSHEET",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        version: 2,
        lockEpoch: 5,
        lockedBy: null,
        lockSessionId: null,
        lockExpiresAt: null,
        lockRevokedAt: new Date(),
      });
    prisma.attachment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.openAttachmentMaster(
        "project-1",
        "attachment-1",
        { id: "user-1" } as never,
        {
          protocol: "http",
          host: "localhost:3000",
        }
      )
    ).resolves.toMatchObject({ ok: true, lockEpoch: 6 });

    expect(prisma.attachment.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          lockSessionId: "legacy-lock-session",
          OR: expect.arrayContaining([
            {
              lockExpiresAt: null,
              lockHeartbeatAt: null,
              lockedAt: { lt: expect.any(Date) },
            },
          ]),
        }),
        data: expect.objectContaining({
          lockReleaseReason: "LEASE_EXPIRED",
        }),
      })
    );
  });

  it("keeps an expired Master lease during its recovery grace period", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockEpoch: 4,
      lockedBy: "user-old",
      lockSessionId: "lock-session-old",
      lockExpiresAt: new Date(Date.now() - 5 * 60_000),
      lockRevokedAt: null,
      lockHolder: { name: "Old User" },
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (service as unknown as PrivateWorkflowService).openAttachmentMaster(
        "project-1",
        "attachment-1",
        { id: "user-1" },
        { protocol: "http", host: "localhost:3000" }
      )
    ).resolves.toStrictEqual({
      ok: false,
      code: "LOCKED_BY_OTHER",
      holderName: "Old User",
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "cash-macro.xlsm",
    "cash-model.xlsb",
    "board-deck.pptx",
    "archive-deck.ppt",
    "support.pdf",
  ])("opens a desktop Master session for %s", async (originalName) => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileName: "stored.xlsx",
      originalName,
      version: 2,
      lockedBy: null,
      lockSessionId: null,
    });
    prisma.desktopMasterGrant.create.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).openAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "http", host: "localhost:3000" }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        fileName: originalName,
        lockSessionId: expect.any(String),
        grantSecret: expect.any(String),
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledOnce();
    expect(prisma.desktopMasterGrant.create).toHaveBeenCalledOnce();
  });

  it("rejects unsupported desktop Master files before granting a lock", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-zip",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileName: "stored.zip",
      originalName: "support.zip",
      version: 1,
      lockedBy: null,
      lockSessionId: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (service as unknown as PrivateWorkflowService).openAttachmentMaster(
        "project-1",
        "attachment-zip",
        { id: "user-1" },
        { protocol: "http", host: "localhost:3000" }
      )
    ).rejects.toThrow(
      "Desktop Agent currently supports xlsx, xls, xlsm, xlsb, csv, docx, doc, pptx, ppt, and pdf files only."
    );
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.desktopMasterGrant.create).not.toHaveBeenCalled();
  });

  it("downloads PDF attachments as read-only desktop copies", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const fileUrl = posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "support.pdf"
    );
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-pdf",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl,
      fileName: "stored.pdf",
      originalName: "support.pdf",
      mimeType: "application/pdf",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await (
      service as unknown as PrivateWorkflowService
    ).downloadAttachmentReadOnly("project-1", "attachment-pdf", {
      id: "user-1",
    } as never);

    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "support.pdf",
      mimeType: "application/pdf",
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ATTACHMENT_READONLY_DOWNLOADED" })
    );
  });

  it("downloads unsupported attachments as read-only copies without taking the master lock", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-zip",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileUrl: "working-papers/project-1/support.zip",
      fileName: "stored.zip",
      originalName: "support.zip",
      mimeType: "application/zip",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await (
      service as unknown as PrivateWorkflowService
    ).downloadAttachmentReadOnly("project-1", "attachment-zip", {
      id: "user-1",
    } as never);

    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, "working-papers/project-1/support.zip"),
      fileName: "support.zip",
      mimeType: "application/zip",
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACHMENT_READONLY_DOWNLOADED",
        targetId: "attachment-zip",
      })
    );
  });

  it("includes the external API path prefix in desktop Master download URLs", async () => {
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockedBy: null,
      lockSessionId: null,
    });
    prisma.desktopMasterGrant.create.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = (await (
      service as unknown as PrivateWorkflowService
    ).openAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "https", host: "wing.superfx.cn", pathPrefix: "/api" }
    )) as { downloadUrl: string };

    expect(result.downloadUrl).toBe(
      "https://wing.superfx.cn/api/engagement/project-1/workflow/attachments/attachment-1/master/download"
    );
  });

  it("downloads a file for the active desktop Master without claiming another lock", async () => {
    const uploadRoot = join(tmpdir(), "project-wing-tests");
    const fileUrl = posix.join(
      "working-papers",
      "project-1",
      "paper-1",
      "cash.xlsx"
    );
    process.env.UPLOAD_DIR = uploadRoot;
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SPREADSHEET",
      fileUrl,
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const file = await (
      service as unknown as PrivateWorkflowService
    ).downloadAttachmentForActiveMaster("project-1", "attachment-1", {
      id: "user-1",
    } as never);

    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(file).toStrictEqual({
      absolutePath: join(uploadRoot, fileUrl),
      fileName: "cash.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  });

  it("returns already master instead of creating a duplicate same-user session", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockedBy: "user-1",
      lockSessionId: "lock-session-existing",
      lockHolder: { id: "user-1", name: "Current User" },
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).openAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "http", host: "localhost:3000" }
    );

    expect(result).toStrictEqual({
      ok: false,
      code: "ALREADY_MASTER",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-existing",
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.desktopMasterGrant.create).not.toHaveBeenCalled();
  });

  it("recovers an existing desktop Master by reissuing a scoped grant", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "stored.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockedBy: "user-1",
      lockSessionId: "lock-session-existing",
    });
    prisma.desktopMasterGrant.create.mockResolvedValue({
      id: "grant-recovered",
      lockSessionId: "lock-session-existing",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).recoverAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "http", host: "localhost:3000" }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        projectId: "project-1",
        lockSessionId: "lock-session-existing",
        fileName: "cash.xlsx",
        version: 2,
        contentToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        grantSecret: expect.any(String),
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "user-1",
          lockSessionId: "lock-session-existing",
        }),
        data: expect.objectContaining({
          lockHeartbeatAt: expect.any(Date),
          lockExpiresAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.desktopMasterGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockSessionId: "lock-session-existing",
          attachmentId: "attachment-1",
          projectId: "project-1",
          userId: "user-1",
          allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
        }),
      })
    );
  });

  it("checks in a desktop Master version without releasing the active lock and reuses an unchanged preview", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "DOCUMENT",
      fileName: "cash-v2.pdf",
      originalName: "cash-v2.pdf",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.pdf"
      ),
      fileSize: 10,
      mimeType: "application/pdf",
      version: 2,
      contentHash: hashTestSecret("xlsx"),
      previewStatus: "READY",
      previewVersion: 2,
      previewUpdatedAt: new Date("2026-03-01T08:00:00.000Z"),
      uploadedBy: "user-1",
      lastModifiedBy: "user-1",
      lastModifiedAt: new Date("2026-03-01T08:00:00.000Z"),
      lockEpoch: 1,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-1",
      status: "IN_PROGRESS",
    });
    prisma.desktopCheckInIdempotency.update.mockResolvedValue({
      id: "idem-1",
      status: "SUCCEEDED",
      responseJson: { version: 3 },
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).checkInDesktopMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        baseVersion: 2,
        localContentHash: hashTestSecret("xlsx"),
        idempotencyKey: "lock-session-1:hash-v3",
      },
      {
        originalname: "cash-v3.pdf",
        mimetype: "application/pdf",
        size: 12,
        buffer: Buffer.from("xlsx"),
      }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        version: 3,
        uploaded: true,
        localContentHash: hashTestSecret("xlsx"),
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
          OR: expect.arrayContaining([
            { lockExpiresAt: { gte: expect.any(Date) } },
          ]),
        }),
        data: expect.objectContaining({
          version: 3,
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
          previewStatus: "READY",
          previewVersion: 3,
        }),
      })
    );
  });

  it("rolls back check-in when the Master fencing CAS loses a race", async () => {
    const uploadedHash = hashTestSecret("updated");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: "working-papers/project-1/paper-1/cash-v2.xlsx",
      fileSize: 10,
      mimeType: "application/octet-stream",
      version: 2,
      headVersionId: "version-2",
      lockEpoch: 7,
      uploadedBy: "user-1",
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
      lockRevokedAt: null,
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-1",
      status: "IN_PROGRESS",
    });
    prisma.attachment.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          baseVersionId: "version-2",
          lockEpoch: 7,
          localContentHash: uploadedHash,
          idempotencyKey: "lock-session-1:fenced-race",
        },
        {
          originalname: "cash-v3.xlsx",
          mimetype: "application/octet-stream",
          size: 7,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow(
      "Desktop Master session changed while the check-in was committing."
    );

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lockEpoch: 7,
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
        }),
      })
    );
    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenCalledWith({
      where: {
        idempotencyKey: "lock-session-1:fenced-race",
        status: "IN_PROGRESS",
        attemptToken: expect.any(String),
      },
      data: { status: "FAILED", leaseExpiresAt: null },
    });
  });

  it("preserves a stale desktop check-in without clearing a newer Master lock", async () => {
    const uploadedHash = hashTestSecret("offline changes");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "stale-session",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: new Date("2026-07-22T00:00:00.000Z"),
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SPREADSHEET",
      fileName: "server-v3.xlsx",
      originalName: "server-v3.xlsx",
      fileUrl: "working-papers/project-1/paper-1/server-v3.xlsx",
      fileSize: 10,
      mimeType: "application/octet-stream",
      version: 3,
      headVersionId: "server-v3",
      lockEpoch: 2,
      conflictFrozenAt: null,
      workDate: null,
      uploadedBy: "user-2",
      lockedBy: "user-2",
      lockSessionId: "new-session",
      lockExpiresAt: new Date("2026-07-24T10:00:00.000Z"),
      lockHeartbeatAt: new Date("2026-07-24T08:00:00.000Z"),
      lockStaleAt: null,
      lockRevokedAt: null,
    });
    prisma.attachmentVersion.findFirst
      .mockResolvedValueOnce({ id: "server-v3", version: 3 })
      .mockResolvedValueOnce({ id: "base-v2" });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "candidate-v4",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-conflict",
      status: "IN_PROGRESS",
    });
    prisma.desktopCheckInIdempotency.update.mockResolvedValue({
      id: "idem-conflict",
      status: "SUCCEEDED",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await service.checkInDesktopMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "stale-session",
        grantSecret: "grant-secret",
        baseVersion: 2,
        baseVersionId: "base-v2",
        lockEpoch: 1,
        localContentHash: uploadedHash,
        idempotencyKey: "stale-session:offline",
      },
      {
        originalname: "offline-v3.xlsx",
        mimetype: "application/octet-stream",
        size: 15,
        buffer: Buffer.from("offline changes"),
      }
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        conflict: true,
        candidateVersionId: "candidate-v4",
        serverVersionId: "server-v3",
        version: 3,
      })
    );
    expect(prisma.attachmentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 4,
        parentVersionId: "base-v2",
        sourceVersionId: "server-v3",
        contentHash: uploadedHash,
        conflictState: "OPEN",
        isCurrent: false,
      }),
    });
    const conflictUpdate = prisma.attachment.update.mock.calls.find(
      ([call]) => call.data.conflictCandidateVersionId === "candidate-v4"
    )?.[0];
    expect(conflictUpdate).toStrictEqual(
      expect.objectContaining({
        where: { id: "attachment-1" },
        data: expect.objectContaining({
          conflictCandidateVersionId: "candidate-v4",
          conflictFrozenAt: expect.any(Date),
        }),
      })
    );
    expect(conflictUpdate?.data).not.toHaveProperty("lockedBy");
    expect(conflictUpdate?.data).not.toHaveProperty("lockSessionId");
    expect(conflictUpdate?.data).not.toHaveProperty("lockEpoch");
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith({
      where: { lockSessionId: "stale-session", revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
      },
    });
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lockSessionId: "new-session" }),
      })
    );
    expect(prisma.attachmentVersion.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      actorId: "pic-1",
      globalRole: "USER",
      projectRole: "PARTNER",
      label: "the project PIC",
    },
    {
      actorId: "admin-1",
      globalRole: "SUPER_ADMIN",
      projectRole: "PREPARER",
      label: "a system administrator",
    },
  ])(
    "lets $label choose a preserved conflict candidate as the new head",
    async ({ actorId, globalRole, projectRole }) => {
      access.requireProjectMember.mockResolvedValue({ projectRole });
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        conflictFrozenAt: new Date("2026-07-22T00:00:00.000Z"),
        conflictCandidateVersionId: "candidate-v4",
        headVersionId: "server-v3",
        version: 3,
        lockedBy: null,
      });
      const candidate = {
        id: "candidate-v4",
        attachmentId: "attachment-1",
        projectId: "project-1",
        version: 4,
        fileKind: "SPREADSHEET",
        fileName: "candidate.xlsx",
        originalName: "candidate.xlsx",
        fileUrl: "working-papers/project-1/paper-1/candidate.xlsx",
        fileSize: 15,
        mimeType: "application/octet-stream",
        contentHash: hashTestSecret("candidate"),
        workDate: null,
        uploadedBy: "user-1",
        conflictState: "OPEN",
        conflictBaseVersionId: "base-v2",
      };
      prisma.attachmentVersion.findFirst
        .mockResolvedValueOnce(candidate)
        .mockResolvedValueOnce(candidate);
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never
      );

      await service.resolveAttachmentConflict(
        "project-1",
        "attachment-1",
        "candidate-v4",
        "USE_CANDIDATE",
        { id: actorId, globalRole } as never
      );

      expect(prisma.attachmentVersion.update).toHaveBeenCalledWith({
        where: { id: "candidate-v4" },
        data: expect.objectContaining({
          conflictState: "RESOLVED",
          conflictResolvedBy: actorId,
          conflictResolution: "USE_CANDIDATE",
        }),
      });
      expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "attachment-1",
            lockedBy: null,
            lockSessionId: null,
          }),
          data: expect.objectContaining({
            headVersionId: "candidate-v4",
            version: 4,
            contentHash: hashTestSecret("candidate"),
            conflictFrozenAt: null,
            conflictCandidateVersionId: null,
            lockEpoch: { increment: 1 },
          }),
        })
      );
    }
  );

  it("does not resolve a conflict while a desktop Master is active", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PARTNER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      conflictFrozenAt: new Date("2026-07-22T00:00:00.000Z"),
      conflictCandidateVersionId: "candidate-v4",
      headVersionId: "server-v3",
      version: 3,
      lockEpoch: 8,
      lockedBy: "user-2",
      lockSessionId: "new-session",
      lockRevokedAt: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.resolveAttachmentConflict(
        "project-1",
        "attachment-1",
        "candidate-v4",
        "KEEP_SERVER",
        { id: "pic-1", globalRole: "USER" } as never
      )
    ).rejects.toThrow(
      "A desktop Master session is active. Check in or release it before changing the server version."
    );

    expect(prisma.attachmentVersion.update).not.toHaveBeenCalled();
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("keeps an attachment frozen while another conflict candidate remains open", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PARTNER" });
    const frozenAt = new Date("2026-07-22T00:00:00.000Z");
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      conflictFrozenAt: frozenAt,
      conflictCandidateVersionId: "candidate-v4",
      headVersionId: "server-v3",
      version: 3,
      lockEpoch: 8,
      lockedBy: null,
      lockSessionId: null,
    });
    const candidate = {
      id: "candidate-v4",
      attachmentId: "attachment-1",
      projectId: "project-1",
      version: 4,
      fileKind: "SPREADSHEET",
      fileName: "candidate.xlsx",
      originalName: "candidate.xlsx",
      fileUrl: "working-papers/project-1/paper-1/candidate.xlsx",
      fileSize: 15,
      mimeType: "application/octet-stream",
      contentHash: hashTestSecret("candidate"),
      workDate: null,
      uploadedBy: "user-1",
      conflictState: "OPEN",
      conflictBaseVersionId: "base-v2",
    };
    prisma.attachmentVersion.findFirst
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce(candidate)
      .mockResolvedValueOnce({ id: "candidate-v5" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.resolveAttachmentConflict(
      "project-1",
      "attachment-1",
      "candidate-v4",
      "USE_CANDIDATE",
      { id: "pic-1", globalRole: "USER" } as never
    );

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lockedBy: null,
          lockSessionId: null,
          lockEpoch: 8,
        }),
        data: expect.objectContaining({
          conflictFrozenAt: frozenAt,
          conflictCandidateVersionId: "candidate-v5",
        }),
      })
    );
  });

  it("recovers a timed-out desktop upload from its succeeded idempotency record", async () => {
    const contentHash = hashTestSecret("updated");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: new Date("2026-07-23T00:00:00.000Z"),
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "CHECK_IN,RELEASE",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue({
      status: "SUCCEEDED",
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      localContentHash: contentHash,
    });
    const storage = { createResumableUploadGrant: vi.fn() };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.prepareDesktopMasterUpload({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        baseVersion: 2,
        localContentHash: contentHash,
        idempotencyKey: `lock-session-1:${contentHash}`,
        fileName: "cash.xlsx",
        fileSize: 12,
        mimeType: "application/octet-stream",
        uploadAttemptId: "attempt-1",
      })
    ).resolves.toStrictEqual({
      ok: true,
      mode: "ALREADY_UPLOADED",
      objectKey: `desktop-master-check-ins/project-1/attachment-1/lock-session-1/attempt-1/${contentHash}.xlsx`,
    });
    expect(storage.createResumableUploadGrant).not.toHaveBeenCalled();
  });

  it("allows a revoked desktop grant to upload bytes for conflict preservation", async () => {
    const contentHash = hashTestSecret("conflict candidate");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: new Date("2026-07-23T00:00:00.000Z"),
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "CHECK_IN,RELEASE",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    const storage = {
      createResumableUploadGrant: vi.fn().mockResolvedValue({
        ok: true,
        mode: "DIRECT_PUT",
      }),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.prepareDesktopMasterUpload({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      grantSecret: "grant-secret",
      baseVersion: 2,
      localContentHash: contentHash,
      idempotencyKey: `lock-session-1:${contentHash}`,
      fileName: "cash.xlsx",
      fileSize: 12,
      mimeType: "application/octet-stream",
      uploadAttemptId: "attempt-2",
    });

    expect(storage.createResumableUploadGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: `desktop-master-check-ins/project-1/attachment-1/lock-session-1/attempt-2/${contentHash}.xlsx`,
        fileSize: 12,
        contentSha256: contentHash,
      })
    );
  });

  it("marks desktop check-in idempotency failed when upload persistence fails", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 10,
      mimeType: "application/octet-stream",
      workDate: null,
      version: 2,
      uploadedBy: "user-1",
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-1",
      status: "IN_PROGRESS",
    });
    prisma.$transaction.mockRejectedValueOnce(new Error("db failed"));
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (
        service as unknown as PrivateWorkflowService
      ).checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          localContentHash: hashTestSecret("updated"),
          idempotencyKey: "lock-session-1:hash-v3",
        },
        {
          originalname: "cash-v3.xlsx",
          mimetype: "application/octet-stream",
          size: 12,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow("db failed");
    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenCalledWith({
      where: {
        idempotencyKey: "lock-session-1:hash-v3",
        status: "IN_PROGRESS",
        attemptToken: expect.any(String),
      },
      data: { status: "FAILED", leaseExpiresAt: null },
    });
  });

  it("retries failed desktop check-in idempotency records", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 10,
      mimeType: "application/octet-stream",
      workDate: null,
      version: 2,
      uploadedBy: "user-1",
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue({
      id: "idem-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      localContentHash: hashTestSecret("updated"),
      status: "FAILED",
      responseJson: null,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await (
      service as unknown as PrivateWorkflowService
    ).checkInDesktopMasterSession(
      {
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        baseVersion: 2,
        localContentHash: hashTestSecret("updated"),
        idempotencyKey: "lock-session-1:hash-v3",
      },
      {
        originalname: "cash-v3.xlsx",
        mimetype: "application/octet-stream",
        size: 12,
        buffer: Buffer.from("updated"),
      }
    );

    expect(prisma.desktopCheckInIdempotency.create).not.toHaveBeenCalled();
    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          idempotencyKey: "lock-session-1:hash-v3",
          status: "FAILED",
        },
        data: {
          status: "IN_PROGRESS",
          responseJson: Prisma.DbNull,
          attemptToken: expect.any(String),
          leaseExpiresAt: expect.any(Date),
        },
      }
    );
  });

  it("does not take over an active desktop check-in attempt lease", async () => {
    const contentHash = hashTestSecret("updated");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "CHECK_IN",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      fileName: "cash.xlsx",
      version: 2,
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue({
      id: "idem-1",
      lockSessionId: "lock-session-1",
      idempotencyKey: "lock-session-1:active-attempt",
      projectId: "project-1",
      attachmentId: "attachment-1",
      localContentHash: contentHash,
      status: "IN_PROGRESS",
      attemptToken: "active-attempt",
      leaseExpiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });
    prisma.desktopCheckInIdempotency.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          localContentHash: contentHash,
          idempotencyKey: "lock-session-1:active-attempt",
        },
        {
          originalname: "cash.xlsx",
          mimetype: "application/octet-stream",
          size: 7,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow("Desktop check-in is already in progress.");

    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idempotencyKey: "lock-session-1:active-attempt",
          status: "IN_PROGRESS",
          OR: expect.any(Array),
        }),
      })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("atomically takes over an expired desktop check-in attempt lease", async () => {
    const contentHash = hashTestSecret("updated");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "CHECK_IN",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "cash.xlsx",
      version: 2,
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue({
      id: "idem-1",
      lockSessionId: "lock-session-1",
      idempotencyKey: "lock-session-1:expired-attempt",
      projectId: "project-1",
      attachmentId: "attachment-1",
      localContentHash: contentHash,
      status: "IN_PROGRESS",
      attemptToken: "expired-attempt",
      leaseExpiresAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(Date.now() - 60_000),
    });
    prisma.desktopCheckInIdempotency.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.$transaction.mockRejectedValueOnce(new Error("stop after takeover"));
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          localContentHash: contentHash,
          idempotencyKey: "lock-session-1:expired-attempt",
        },
        {
          originalname: "cash.xlsx",
          mimetype: "application/octet-stream",
          size: 7,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow("stop after takeover");

    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          idempotencyKey: "lock-session-1:expired-attempt",
          status: "IN_PROGRESS",
          OR: expect.arrayContaining([
            { leaseExpiresAt: { lt: expect.any(Date) } },
          ]),
        }),
        data: expect.objectContaining({
          attemptToken: expect.not.stringMatching(/^expired-attempt$/),
          leaseExpiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("prevents an attempt that lost its lease from committing check-in", async () => {
    const contentHash = hashTestSecret("updated");
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "CHECK_IN",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: "working-papers/project-1/paper-1/cash-v2.xlsx",
      fileSize: 10,
      mimeType: "application/octet-stream",
      version: 2,
      headVersionId: "version-2",
      lockEpoch: 7,
      uploadedBy: "user-1",
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockExpiresAt: new Date(Date.now() + 60_000),
      lockRevokedAt: null,
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-1",
      status: "IN_PROGRESS",
    });
    prisma.desktopCheckInIdempotency.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          baseVersionId: "version-2",
          lockEpoch: 7,
          localContentHash: contentHash,
          idempotencyKey: "lock-session-1:lost-attempt",
        },
        {
          originalname: "cash-v3.xlsx",
          mimetype: "application/octet-stream",
          size: 7,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow(
      "Desktop check-in attempt lease was taken over by a newer request."
    );

    const completionCall =
      prisma.desktopCheckInIdempotency.updateMany.mock.calls[0]?.[0];
    const failureCall =
      prisma.desktopCheckInIdempotency.updateMany.mock.calls[1]?.[0];
    expect(completionCall).toStrictEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "IN_PROGRESS",
          attemptToken: expect.any(String),
        }),
        data: expect.objectContaining({ status: "SUCCEEDED" }),
      })
    );
    expect(failureCall?.where.attemptToken).toBe(
      completionCall?.where.attemptToken
    );
  });

  it("keeps successful desktop check-in idempotency when audit logging fails", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SUPPORTING",
      fileName: "cash-v2.xlsx",
      originalName: "cash-v2.xlsx",
      fileUrl: posix.join(
        "working-papers",
        "project-1",
        "paper-1",
        "cash-v2.xlsx"
      ),
      fileSize: 10,
      mimeType: "application/octet-stream",
      workDate: null,
      version: 2,
      uploadedBy: "user-1",
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    prisma.desktopCheckInIdempotency.create.mockResolvedValue({
      id: "idem-1",
      status: "IN_PROGRESS",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    auditLogs.log.mockRejectedValueOnce(new Error("audit failed"));
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (
        service as unknown as PrivateWorkflowService
      ).checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          localContentHash: hashTestSecret("updated"),
          idempotencyKey: "lock-session-1:hash-v3",
        },
        {
          originalname: "cash-v3.xlsx",
          mimetype: "application/octet-stream",
          size: 12,
          buffer: Buffer.from("updated"),
        }
      )
    ).rejects.toThrow("audit failed");

    expect(prisma.desktopCheckInIdempotency.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idempotencyKey: "lock-session-1:hash-v3",
          status: "IN_PROGRESS",
          attemptToken: expect.any(String),
        }),
        data: expect.objectContaining({ status: "SUCCEEDED" }),
      })
    );
    expect(
      prisma.desktopCheckInIdempotency.updateMany
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("returns successful desktop check-in idempotency before version conflict checks", async () => {
    const previousResponse = {
      ok: true,
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      version: 3,
      uploaded: true,
      localContentHash: "hash-v3",
    };
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue({
      id: "idem-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      localContentHash: "hash-v3",
      status: "SUCCEEDED",
      responseJson: previousResponse,
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SUPPORTING",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (
        service as unknown as PrivateWorkflowService
      ).checkInDesktopMasterSession(
        {
          projectId: "project-1",
          attachmentId: "attachment-1",
          lockSessionId: "lock-session-1",
          grantSecret: "grant-secret",
          baseVersion: 2,
          localContentHash: "hash-v3",
          idempotencyKey: "lock-session-1:hash-v3",
        },
        {
          originalname: "cash-v3.xlsx",
          mimetype: "application/octet-stream",
          size: 12,
          buffer: Buffer.from("updated"),
        }
      )
    ).resolves.toStrictEqual(previousResponse);
    expect(prisma.desktopCheckInIdempotency.create).not.toHaveBeenCalled();
    expect(prisma.attachment.update).not.toHaveBeenCalled();
  });

  it("opens desktop Master lock and scoped grant in one transaction", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 2,
      lockedBy: null,
      lockSessionId: null,
    });
    prisma.attachment.updateMany.mockResolvedValue({ count: 1 });
    prisma.desktopMasterGrant.create.mockResolvedValue({ id: "grant-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await (service as unknown as PrivateWorkflowService).openAttachmentMaster(
      "project-1",
      "attachment-1",
      { id: "user-1" },
      { protocol: "http", host: "localhost:3000" }
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.attachment.updateMany).toHaveBeenCalledOnce();
    expect(prisma.desktopMasterGrant.create).toHaveBeenCalledOnce();
  });

  it("releases only the matching desktop Master session", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      lockedBy: null,
      lockSessionId: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).releaseDesktopMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      grantSecret: "grant-secret",
      reason: "CHECKED_IN",
    });

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
        }),
        data: expect.objectContaining({
          lockedBy: null,
          lockedAt: null,
          lockSessionId: null,
          lockReleaseReason: "CHECKED_IN",
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lockSessionId: "lock-session-1", revokedAt: null },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      })
    );
  });

  it("does not revoke a grant when release loses the lock fencing race", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockEpoch: 7,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockRevokedAt: null,
    });
    prisma.attachment.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.releaseDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lockEpoch: 7,
        reason: "CHECKED_IN",
      })
    ).rejects.toThrow(
      "Desktop Master session changed while it was being released."
    );

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lockEpoch: 7,
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
  });

  it.each([null, "replacement-session"])(
    "confirms recovery of an old grant without touching the current lock %s",
    async (lockSessionId) => {
      prisma.desktopMasterGrant.findFirst.mockResolvedValue({
        id: "grant-1",
        lockSessionId: "old",
        projectId: "project-1",
        attachmentId: "attachment-1",
        userId: "user-1",
        revokedAt: new Date(),
        secretHash: hashTestSecret("secret"),
        allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
      });
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        fileName: "file.xlsx",
        lockSessionId,
      });
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never
      );
      const result = await service.releaseDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "old",
        grantSecret: "secret",
        reason: "RECOVERY_ENDED",
      });
      expect(result).toMatchObject({ ok: true, recoveryEnded: true });
      expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
      expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
    }
  );

  it("ends local recovery tracking after the server file was removed", async () => {
    access.requireProjectAction.mockRejectedValue(
      new ApiForbiddenException("FORBIDDEN", "Project access suspended")
    );
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-removed",
      lockSessionId: "removed-session",
      projectId: "project-1",
      attachmentId: "attachment-removed",
      userId: "user-1",
      revokedAt: new Date(),
      secretHash: hashTestSecret("secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-removed",
      deletedAt: new Date(),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.releaseDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-removed",
        lockSessionId: "removed-session",
        grantSecret: "secret",
        reason: "RECOVERY_ENDED",
      })
    ).resolves.toMatchObject({ ok: true, recoveryEnded: true });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
  });

  it("does not dismiss an unknown recovery grant as a released lease", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      lockSessionId: "old",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );
    await expect(
      service.releaseDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "old",
        grantSecret: "secret",
        reason: "RECOVERY_ENDED",
      })
    ).rejects.toThrow("could not be verified");
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("treats a retry after a confirmed desktop release as successful", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      revokedAt: new Date("2026-06-05T02:20:00.000Z"),
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: null,
      lockSessionId: null,
      lockReleaseReason: "CHECKED_IN",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).releaseDesktopMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      grantSecret: "grant-secret",
      reason: "CHECKED_IN",
    });

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
      })
    );
    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
  });

  it("looks up recovered desktop Master grants by grant secret", async () => {
    prisma.desktopMasterGrant.findFirst.mockImplementation((query) => {
      if (
        query?.where?.secretHash !== hashTestSecret("grant-secret-recovered")
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: "grant-2",
        lockSessionId: "lock-session-1",
        projectId: "project-1",
        attachmentId: "attachment-1",
        userId: "user-1",
        issuedAt: new Date(),
        revokedAt: null,
        secretHash: hashTestSecret("grant-secret-recovered"),
        allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
      });
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (
        service as unknown as PrivateWorkflowService
      ).heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret-recovered",
      })
    ).resolves.toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
      })
    );
    expect(prisma.desktopMasterGrant.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        secretHash: hashTestSecret("grant-secret-recovered"),
      }),
    });
  });

  it("heartbeats a matching desktop Master session without releasing the lock", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      issuedAt: new Date(),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockStaleAt: new Date("2026-06-05T02:00:00.000Z"),
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 3,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).heartbeatDesktopMasterSession({
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      grantSecret: "grant-secret",
    });

    expect(result).toStrictEqual(
      expect.objectContaining({
        ok: true,
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        version: 3,
      })
    );
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
          OR: expect.arrayContaining([
            { lockExpiresAt: { gte: expect.any(Date) } },
          ]),
        }),
        data: expect.objectContaining({
          lockHeartbeatAt: expect.any(Date),
          lockExpiresAt: expect.any(Date),
          lockStaleAt: null,
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
          lastUsedAt: expect.any(Date),
        }),
      })
    );
  });

  it("reports a removed project file separately from an expired edit grant", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-removed",
      lockSessionId: "lock-session-removed",
      projectId: "project-1",
      attachmentId: "attachment-removed",
      userId: "user-1",
      revokedAt: new Date(),
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-removed",
      deletedAt: new Date(),
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      (
        service as unknown as PrivateWorkflowService
      ).heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-removed",
        lockSessionId: "lock-session-removed",
        grantSecret: "grant-secret",
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SERVER_FILE_REMOVED" }),
    });
  });

  it("upgrades a recent legacy null lease during heartbeat", async () => {
    const recent = new Date(Date.now() - 60_000);
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "legacy-grant",
      lockSessionId: "legacy-session",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      issuedAt: recent,
      lastUsedAt: recent,
      expiresAt: null,
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 3,
      lockEpoch: 7,
      lockedBy: "user-1",
      lockedAt: recent,
      lockSessionId: "legacy-session",
      lockHeartbeatAt: recent,
      lockExpiresAt: null,
      lockRevokedAt: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "legacy-session",
        grantSecret: "grant-secret",
        lockEpoch: 7,
      })
    ).resolves.toMatchObject({ ok: true, lockSessionId: "legacy-session" });

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              lockExpiresAt: null,
              lockHeartbeatAt: { gte: expect.any(Date) },
            },
          ]),
        }),
        data: expect.objectContaining({
          lockExpiresAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              expiresAt: null,
              lastUsedAt: { gte: expect.any(Date) },
            },
          ]),
        }),
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      })
    );
  });

  it("rejects a stale legacy null grant instead of reviving it", async () => {
    const stale = new Date(Date.now() - 4 * 60 * 60_000);
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "legacy-grant",
      lockSessionId: "legacy-session",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      issuedAt: stale,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "legacy-session",
        grantSecret: "grant-secret",
        lockEpoch: 7,
      })
    ).rejects.toThrow("Desktop Master grant has expired.");

    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a heartbeat after the grant expiry grace boundary", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-expired",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lockEpoch: 7,
      })
    ).rejects.toThrow("Desktop Master grant has expired.");

    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
  });

  it("cannot revive an attachment lease that expired during heartbeat", async () => {
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      lockSessionId: "lock-session-1",
      projectId: "project-1",
      attachmentId: "attachment-1",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      secretHash: hashTestSecret("grant-secret"),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      version: 3,
      lockEpoch: 7,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      lockRevokedAt: null,
    });
    prisma.attachment.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.heartbeatDesktopMasterSession({
        projectId: "project-1",
        attachmentId: "attachment-1",
        lockSessionId: "lock-session-1",
        grantSecret: "grant-secret",
        lockEpoch: 7,
      })
    ).rejects.toThrow("Desktop Master lease has expired or changed.");

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lockEpoch: 7,
          OR: expect.arrayContaining([
            { lockExpiresAt: { gte: expect.any(Date) } },
          ]),
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
  });

  it("rechecks current permissions for an otherwise valid Desktop Master grant", async () => {
    const input = {
      projectId: "project-1",
      attachmentId: "attachment-1",
      lockSessionId: "lock-session-1",
      grantSecret: "grant-secret",
    };
    prisma.desktopMasterGrant.findFirst.mockResolvedValue({
      id: "grant-1",
      ...input,
      userId: "user-1",
      secretHash: hashTestSecret(input.grantSecret),
      expiresAt: new Date(Date.now() + 60_000),
      allowedActions: "HEARTBEAT,CHECK_IN,RELEASE",
    });
    prisma.desktopCheckInIdempotency.findUnique.mockResolvedValue(null);
    access.requireProjectAction.mockRejectedValue(
      new ApiForbiddenException("FORBIDDEN", "Project access suspended")
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );
    await expect(
      service.heartbeatDesktopMasterSession(input)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    await expect(
      service.checkInDesktopMasterSession({
        ...input,
        baseVersion: 3,
        localContentHash: "a".repeat(64),
        idempotencyKey: "blocked-checkin",
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(prisma.attachment.updateMany).not.toHaveBeenCalled();
    expect(prisma.desktopCheckInIdempotency.create).not.toHaveBeenCalled();
  });

  it("force releases desktop Master and revokes matching grants", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PARTNER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockedBy: null,
      lockSessionId: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await (
      service as unknown as PrivateWorkflowService
    ).forceReleaseAttachmentMaster("project-1", "attachment-1", {
      id: "manager-1",
      globalRole: "SENIOR",
    });

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "manager-1"
    );
    expect(result).toStrictEqual(expect.objectContaining({ lockedBy: null }));
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "user-1",
          lockSessionId: "lock-session-1",
        }),
        data: expect.objectContaining({
          lockedBy: null,
          lockSessionId: null,
          lockRevokedAt: expect.any(Date),
          lockRevokedBy: "manager-1",
          lockReleaseReason: "FORCE_RELEASED",
        }),
      })
    );
    expect(prisma.desktopMasterGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lockSessionId: "lock-session-1", revokedAt: null },
      })
    );
  });

  it("lets system administrators unlock another member's attachment lock", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    const locked = {
      id: "attachment-1",
      projectId: "project-1",
      originalName: "cash.xlsx",
      fileName: "cash.xlsx",
      placeholderType: null,
      lockedBy: "member-1",
      lockSessionId: "lock-session-1",
      lockEpoch: 2,
    };
    prisma.attachment.findFirst
      .mockResolvedValueOnce(locked)
      .mockResolvedValueOnce({
        ...locked,
        lockedBy: null,
        lockSessionId: null,
      });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.unlockAttachment("project-1", "attachment-1", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).resolves.toMatchObject({ id: "attachment-1", lockedBy: null });
    expect(prisma.attachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attachment-1",
          lockedBy: "member-1",
          lockSessionId: "lock-session-1",
          lockEpoch: 2,
        }),
      })
    );
  });

  it("does not revoke a newer Master grant when force release loses its CAS", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PARTNER" });
    const originalLock = {
      id: "attachment-1",
      projectId: "project-1",
      fileName: "cash.xlsx",
      originalName: "cash.xlsx",
      lockEpoch: 7,
      lockedBy: "user-1",
      lockSessionId: "lock-session-1",
      lockRevokedAt: null,
    };
    prisma.attachment.findFirst.mockResolvedValue(originalLock);
    prisma.attachment.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.forceReleaseAttachmentMaster("project-1", "attachment-1", {
        id: "manager-1",
        globalRole: "SENIOR",
      } as never)
    ).resolves.toStrictEqual(expect.objectContaining(originalLock));

    expect(prisma.desktopMasterGrant.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(["MANAGER", "SENIOR_MANAGER", "PRINCIPAL", "SUPER_ADMIN"] as const)(
    "allows %s accounts to force release desktop Master locks",
    async (globalRole) => {
      access.requireProjectMember.mockResolvedValue({
        projectRole: "REVIEWER",
      });
      prisma.attachment.findFirst.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        lockedBy: "user-1",
        lockSessionId: "lock-session-1",
      });
      prisma.attachment.update.mockResolvedValue({
        id: "attachment-1",
        projectId: "project-1",
        fileName: "cash.xlsx",
        originalName: "cash.xlsx",
        lockedBy: null,
        lockSessionId: null,
      });
      const service = new WorkflowService(
        prisma as never,
        access as never,
        auditLogs as never,
        documentConversion as never
      );

      const result = await (
        service as unknown as PrivateWorkflowService
      ).forceReleaseAttachmentMaster("project-1", "attachment-1", {
        id: "manager-1",
        globalRole,
      });

      expect(result).toStrictEqual(expect.objectContaining({ lockedBy: null }));
      expect(access.requireProjectMember).toHaveBeenCalledWith(
        "project-1",
        "manager-1"
      );
      expect(access.requireProjectRole).not.toHaveBeenCalled();
    }
  );

  it("updates assignees while signoffs avoid mutating paper status", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "PREPARER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        preparerId: "user-1",
        reviewerId: "reviewer-1",
      })
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        preparerId: "user-1",
        reviewerId: "reviewer-1",
      })
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        preparerId: "user-1",
        reviewerId: "reviewer-1",
      });
    prisma.workingPaper.update.mockResolvedValueOnce({
      id: "paper-1",
      preparerId: "user-1",
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.updateWorkingPaperAssignees(
      "project-1",
      "paper-1",
      { id: "manager-1" } as never,
      { preparerId: "user-1", reviewerId: "reviewer-1" }
    );
    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "user-1",
    } as never);
    await service.reviewWorkingPaper("project-1", "paper-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaper.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: { preparerId: "user-1", reviewerId: "reviewer-1" },
      })
    );
    expect(prisma.workingPaper.update).toHaveBeenCalledOnce();
  });

  it("records the actor as signer when a paper is prepared and reviewed", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "PREPARER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        preparerId: null,
      })
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        reviewerId: null,
      });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "user-1",
    } as never);
    await service.reviewWorkingPaper("project-1", "paper-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledTimes(2);
  });

  it("allows a reviewer to remove their own review signoff", async () => {
    prisma.workingPaperSignoff.findFirst.mockResolvedValue({
      id: "review-signoff-1",
      type: "REVIEWER",
      userId: "reviewer-1",
      attachmentId: "attachment-1",
      workingPaper: { code: "A01-0001-F001" },
    });
    prisma.workingPaperSignoff.delete.mockResolvedValue({
      id: "review-signoff-1",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.removeWorkingPaperSignoff("project-1", "review-signoff-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaperSignoff.delete).toHaveBeenCalledWith({
      where: { id: "review-signoff-1" },
    });
    expect(access.requireProjectAction).not.toHaveBeenCalled();
    expect(access.requireProjectRole).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_REVIEW_SIGNOFF_REMOVED",
        targetId: "attachment-1",
      })
    );
  });

  it("allows any project member to prepare or review a working paper", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "PREPARER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "reviewer-acting-as-preparer",
    } as never);
    await service.reviewWorkingPaper("project-1", "paper-1", {
      id: "preparer-acting-as-reviewer",
    } as never);

    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "reviewer-acting-as-preparer",
          type: "PREPARER",
        }),
      })
    );
    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "preparer-acting-as-reviewer",
          type: "REVIEWER",
        }),
      })
    );
  });

  it("signs the selected attachment instead of the shared paper shell", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      code: "A01-0001-F002",
      title: "Sibling.xlsx",
      originalName: "Sibling.xlsx",
      fileName: "Sibling.xlsx",
      preparerId: null,
      reviewerId: "reviewer-1",
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareAttachment("project-1", "attachment-2", {
      id: "user-1",
    } as never);

    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-shared",
          attachmentId: "attachment-2",
          userId: "user-1",
          type: "PREPARER",
        }),
      })
    );
    expect(prisma.attachment.update).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_PREPARED",
        targetType: "ATTACHMENT",
        targetId: "attachment-2",
      })
    );
  });

  it("allows preparation and review signoffs before a placeholder file is uploaded", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "placeholder-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      code: "1100.17",
      title: "Engagement letter.docx",
      originalName: "Engagement letter.docx",
      fileName: "Engagement letter.docx",
      fileUrl: "",
      fileSize: 0,
      version: 0,
      placeholderType: "WORD",
      preparerId: null,
      reviewerId: null,
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.smartFormInstance.findUnique.mockResolvedValue(null);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareAttachment("project-1", "placeholder-1", {
      id: "user-1",
    } as never);
    await service.reviewAttachment("project-1", "placeholder-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-1",
          attachmentId: "placeholder-1",
          userId: "user-1",
          type: "PREPARER",
        }),
      })
    );
    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-1",
          attachmentId: "placeholder-1",
          userId: "reviewer-1",
          type: "REVIEWER",
        }),
      })
    );
  });

  it("blocks signing incomplete Smart Forms", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-smart-form",
      projectId: "project-1",
      workingPaperId: "paper-smart-form",
      code: "A01-0001-F010",
      title: "Independence.sf",
      originalName: "Independence.sf",
      fileName: "Independence.sf",
      preparerId: null,
      reviewerId: "reviewer-1",
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.smartFormInstance.findUnique.mockResolvedValue({
      status: "INCOMPLETE",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.prepareAttachment("project-1", "attachment-smart-form", {
        id: "user-1",
      } as never)
    ).rejects.toThrow("Complete the Smart Form before signing it.");
    expect(prisma.workingPaperSignoff.create).not.toHaveBeenCalled();
  });

  it("appends another preparation signoff when the same action is clicked again", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
    });
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "user-1",
    } as never);

    expect(prisma.workingPaperSignoff.delete).not.toHaveBeenCalled();
    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "user-1",
          type: "PREPARER",
          roundNumber: 1,
        }),
      })
    );
  });

  it("allows multiple preparers to sign the same working paper", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaper.findFirst
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        preparerId: null,
      })
      .mockResolvedValueOnce({
        id: "paper-1",
        projectId: "project-1",
        code: "A01-0001-F001",
        preparerId: "preparer-1",
      });
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    prisma.workingPaperSignoff.create.mockImplementation((input) =>
      Promise.resolve({
        id: `signoff-${input.data.userId}`,
        ...input.data,
      })
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "preparer-1",
    } as never);
    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "preparer-2",
    } as never);

    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledTimes(2);
    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "preparer-1",
          type: "PREPARER",
        }),
      })
    );
    expect(prisma.workingPaperSignoff.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "preparer-2",
          type: "PREPARER",
        }),
      })
    );
    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
  });

  it("starts a new signoff round when preparation follows a completed round", async () => {
    const signedAt = new Date("2026-08-17T08:00:00.000Z");
    signoffEvents = [
      {
        id: "p-1",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        type: "PREPARER",
        roundNumber: 1,
        isCurrent: true,
        signedAt,
      },
      {
        id: "r-1",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        type: "REVIEWER",
        roundNumber: 1,
        isCurrent: true,
        signedAt: new Date(signedAt.getTime() + 1000),
      },
    ];
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "cash.xlsx",
      version: 4,
      headVersionId: "version-4",
      contentHash: "hash-v4",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareAttachment("project-1", "attachment-1", {
      id: "preparer-2",
    } as never);

    expect(prisma.workingPaperSignoff.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { attachmentId: "attachment-1", isCurrent: true },
        data: { isCurrent: false },
      })
    );
    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          type: "PREPARER",
          roundNumber: 2,
          attachmentVersionId: "version-4",
          attachmentVersion: 4,
          contentHash: "hash-v4",
        }),
      })
    );
  });

  it("returns append-only attachment signoff history grouped by round", async () => {
    signoffEvents = [
      {
        id: "p-1",
        attachmentId: "attachment-1",
        type: "PREPARER",
        roundNumber: 1,
        isCurrent: false,
        signedAt: new Date("2026-08-17T08:00:00.000Z"),
        user: { id: "preparer-1", name: "Preparer" },
      },
      {
        id: "p-2",
        attachmentId: "attachment-1",
        type: "PREPARER",
        roundNumber: 2,
        isCurrent: true,
        signedAt: new Date("2026-08-17T09:00:00.000Z"),
        user: { id: "preparer-2", name: "Preparer two" },
      },
    ];
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await service.attachmentSignoffHistory(
      "project-1",
      "attachment-1",
      { id: "viewer-1" } as never
    );

    expect(result.currentRoundNumber).toBe(2);
    expect(result.currentStatus).toBe("PENDING_REVIEW");
    expect(result.rounds).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ roundNumber: 2, status: "PENDING_REVIEW" }),
        expect.objectContaining({ roundNumber: 1, status: "SUPERSEDED" }),
      ])
    );
  });

  it("allows the signer to revoke a signoff with a reason and recomputes the active round", async () => {
    signoffEvents = [
      {
        id: "p-1",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        userId: "preparer-1",
        type: "PREPARER",
        roundNumber: 1,
        isCurrent: true,
        signedAt: new Date("2026-08-17T08:00:00.000Z"),
        user: { id: "preparer-1", name: "Preparer" },
      },
    ];
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(signoffEvents[0]);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    const result = await service.revokeAttachmentSignoff(
      "project-1",
      "attachment-1",
      "p-1",
      { id: "preparer-1" } as never,
      { reason: "Signed in error" }
    );

    expect(prisma.workingPaperSignoff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-1" },
        data: expect.objectContaining({
          isCurrent: false,
          revokedById: "preparer-1",
          revocationReason: "Signed in error",
        }),
      })
    );
    expect(result.currentRoundNumber).toBeNull();
    expect(result.rounds[0]).toStrictEqual(
      expect.objectContaining({ status: "REVOKED" })
    );
  });

  it("creates review questions on the selected attachment", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: "project-1",
      userId: "preparer-1",
      status: "ACTIVE",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      code: "A01-0001-F002",
      title: "Sibling.xlsx",
      originalName: "Sibling.xlsx",
      fileName: "Sibling.xlsx",
      fileKind: "SMART_FORM",
      fileUrl: "project-1/paper-shared/sibling.sf",
    });
    prisma.workingPaperQuestion.create.mockResolvedValue({
      id: "question-attachment",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      attachmentId: "attachment-2",
      status: "OPEN",
      assignedToId: "preparer-1",
    });
    prisma.workingPaperQuestionMessage.create.mockResolvedValue({
      id: "message-attachment",
      questionId: "question-attachment",
      body: "Please explain this file.",
    });
    const storage = {
      getObjectBuffer: vi
        .fn()
        .mockResolvedValue(
          Buffer.from(JSON.stringify(buildWorkflowSmartFormPackage()), "utf-8")
        ),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.createAttachmentQuestion(
      "project-1",
      "attachment-2",
      { id: "reviewer-1" } as never,
      {
        body: "Please explain this file.",
        assignedToId: "preparer-1",
        smartFormNodeId: "deferred-income-general-procedures",
        smartFormRowId: "deferred-income-procedure-2-a",
        smartFormTargetLabel: "Compare the current and prior periods",
      }
    );

    expect(prisma.workingPaperQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          workingPaperId: "paper-shared",
          attachmentId: "attachment-2",
          body: "Please explain this file.",
          assignedToId: "preparer-1",
          smartFormNodeId: "deferred-income-general-procedures",
          smartFormRowId: "deferred-income-procedure-2-a",
          smartFormTargetLabel: "Compare the current and prior periods",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_QUESTION_CREATED",
        targetType: "WORKING_PAPER_QUESTION",
        targetId: "question-attachment",
      })
    );
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "project-1/paper-shared/sibling.sf"
    );
  });

  it("returns a created review question without waiting for notification delivery", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      code: "A01-0001-F002",
      title: "Sibling.xlsx",
      originalName: "Sibling.xlsx",
      fileName: "Sibling.xlsx",
      fileKind: "SUPPORTING",
      fileUrl: "project-1/paper-shared/sibling.xlsx",
    });
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: "project-1",
      userId: "preparer-1",
      status: "ACTIVE",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
    });
    prisma.workingPaperQuestion.create.mockResolvedValue({
      id: "question-attachment",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      attachmentId: "attachment-2",
      status: "OPEN",
      assignedToId: "preparer-1",
      body: "Please explain this file.",
    });
    prisma.workingPaperQuestionMessage.create.mockResolvedValue({
      id: "message-attachment",
      questionId: "question-attachment",
      body: "Please explain this file.",
    });
    inbox.createCollaborationMessage.mockRejectedValueOnce(
      new Error("notification service unavailable")
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      inbox as never
    );

    await expect(
      service.createAttachmentQuestion(
        "project-1",
        "attachment-2",
        { id: "reviewer-1", name: "Reviewer" } as never,
        { body: "Please explain this file.", assignedToId: "preparer-1" }
      )
    ).resolves.toMatchObject({ id: "question-attachment" });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledOnce();
  });

  it("rejects Smart Form locators on the generic working-paper question endpoint", async () => {
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.createWorkingPaperQuestion(
        "project-1",
        "paper-1",
        { id: "reviewer-1" } as never,
        {
          body: "Please explain this row.",
          smartFormNodeId: "deferred-income-general-procedures",
        }
      )
    ).rejects.toMatchObject({ response: { code: "BAD_REQUEST" } });
    expect(prisma.workingPaperQuestion.create).not.toHaveBeenCalled();
  });

  it("rejects Smart Form locators that do not match the selected Smart Form", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      fileKind: "SMART_FORM",
      fileUrl: "project-1/paper-shared/sibling.sf",
    });
    const storage = {
      getObjectBuffer: vi
        .fn()
        .mockResolvedValue(
          Buffer.from(JSON.stringify(buildWorkflowSmartFormPackage()), "utf-8")
        ),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.createAttachmentQuestion(
        "project-1",
        "attachment-2",
        { id: "reviewer-1" } as never,
        {
          body: "Please explain this row.",
          smartFormNodeId: "deferred-income-general-procedures",
          smartFormRowId: "missing-row",
        }
      )
    ).rejects.toMatchObject({ response: { code: "BAD_REQUEST" } });
    expect(prisma.workingPaperQuestion.create).not.toHaveBeenCalled();
  });

  it("rejects Smart Form locators on a non-Smart Form attachment", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-2",
      projectId: "project-1",
      workingPaperId: "paper-shared",
      fileKind: "SUPPORTING",
      fileUrl: "project-1/paper-shared/support.xlsx",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.createAttachmentQuestion(
        "project-1",
        "attachment-2",
        { id: "reviewer-1" } as never,
        {
          body: "Please explain this row.",
          smartFormNodeId: "deferred-income-general-procedures",
        }
      )
    ).rejects.toMatchObject({ response: { code: "BAD_REQUEST" } });
    expect(prisma.workingPaperQuestion.create).not.toHaveBeenCalled();
  });

  it("moves review questions through open, replied, cleared, and reopened states", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "PREPARER" })
      .mockResolvedValueOnce({ projectRole: "PREPARER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
    });
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: "project-1",
      userId: "preparer-1",
      status: "ACTIVE",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
    });
    prisma.workingPaperQuestion.create.mockResolvedValue({
      id: "question-1",
      status: "OPEN",
      assignedToId: "preparer-1",
    });
    prisma.workingPaperQuestion.findFirst
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "OPEN",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "OPEN",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "REPLIED",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "CLEARED",
      });
    prisma.workingPaperQuestion.update
      .mockResolvedValueOnce({ id: "question-1", status: "OPEN" })
      .mockResolvedValueOnce({ id: "question-1", status: "REPLIED" })
      .mockResolvedValueOnce({ id: "question-1", status: "CLEARED" })
      .mockResolvedValueOnce({ id: "question-1", status: "OPEN" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createWorkingPaperQuestion(
      "project-1",
      "paper-1",
      { id: "reviewer-1" } as never,
      { body: "Please explain the bank variance.", assignedToId: "preparer-1" }
    );
    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "preparer-1" } as never,
      { replyBody: "Variance support uploaded." }
    );
    await service.markWorkingPaperQuestionReplied("project-1", "question-1", {
      id: "preparer-1",
    } as never);
    await service.clearWorkingPaperQuestion("project-1", "question-1", {
      id: "reviewer-1",
    } as never);
    await service.reopenWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "reviewer-1" } as never,
      { body: "Reopen after later review." }
    );

    expect(prisma.workingPaperQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: "Please explain the bank variance.",
          status: "OPEN",
          assignedToId: "preparer-1",
          createdById: "reviewer-1",
        }),
      })
    );
    expect(prisma.workingPaperQuestion.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      })
    );
    expect(
      prisma.workingPaperQuestion.update.mock.calls[0][0].data
    ).not.toHaveProperty("status");
    expect(prisma.workingPaperQuestion.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REPLIED",
          repliedById: "preparer-1",
        }),
      })
    );
    expect(prisma.workingPaperQuestion.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLEARED",
          clearedById: "reviewer-1",
        }),
      })
    );
    expect(prisma.workingPaperQuestion.update).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OPEN",
          reopenedById: "reviewer-1",
        }),
      })
    );
    expect(
      auditLogs.log.mock.calls.map(([entry]) => entry.action)
    ).toStrictEqual([
      "WORKING_PAPER_QUESTION_CREATED",
      "WORKING_PAPER_QUESTION_REPLIED",
      "WORKING_PAPER_QUESTION_REPLIED",
      "WORKING_PAPER_QUESTION_CLEARED",
      "WORKING_PAPER_QUESTION_REOPENED",
    ]);
    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
  });

  it("allows the question creator to clear an open review question", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "CLEARED",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.clearWorkingPaperQuestion("project-1", "question-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaperQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLEARED",
          clearedById: "reviewer-1",
        }),
      })
    );
  });

  it("keeps a review question open when the creator adds another message", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "OPEN",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "reviewer-1" } as never,
      { replyBody: "Adding one more detail." }
    );

    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "reviewer-1",
          messageType: "REPLY",
          body: "Adding one more detail.",
        }),
      })
    );
    const [[updateInput]] = prisma.workingPaperQuestion.update.mock.calls;
    expect(updateInput.data).toMatchObject({
      updatedAt: expect.any(Date),
    });
    expect(updateInput.data).not.toHaveProperty("status");
    expect(updateInput.data).not.toHaveProperty("replyBody");
    expect(updateInput.data).not.toHaveProperty("repliedById");
    expect(updateInput.data).not.toHaveProperty("repliedAt");
  });

  it("keeps a review question open when a respondent sends a message", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "OPEN",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "preparer-1" } as never,
      { replyBody: "Support has been added." }
    );

    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "preparer-1",
          messageType: "REPLY",
          body: "Support has been added.",
        }),
      })
    );
    const [[updateInput]] = prisma.workingPaperQuestion.update.mock.calls;
    expect(updateInput.data).toMatchObject({
      updatedAt: expect.any(Date),
    });
    expect(updateInput.data).not.toHaveProperty("status");
    expect(updateInput.data).not.toHaveProperty("replyBody");
    expect(updateInput.data).not.toHaveProperty("repliedById");
    expect(updateInput.data).not.toHaveProperty("repliedAt");
  });

  it("marks an open review question as replied without adding a message", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "REPLIED",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.markWorkingPaperQuestionReplied("project-1", "question-1", {
      id: "preparer-1",
    } as never);

    expect(prisma.workingPaperQuestionMessage.create).not.toHaveBeenCalled();
    expect(prisma.workingPaperQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "question-1" },
        data: expect.objectContaining({
          status: "REPLIED",
          repliedById: "preparer-1",
          repliedAt: expect.any(Date),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "preparer-1",
        action: "WORKING_PAPER_QUESTION_REPLIED",
      })
    );
  });

  it("creates a direct image upload grant for a review question message", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
    });
    const storage = {
      createReviewQuestionImageUploadGrant: vi.fn().mockReturnValue({
        objectKey:
          "review-question-images/project-1/question-1/stored-screenshot.png",
        fileName: "stored-screenshot.png",
        uploadUrl: "https://oss.example/question-image",
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        expiresAt: "2026-06-14T12:00:00.000Z",
      }),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    const grant = await service.createReviewQuestionImageUploadGrant(
      "project-1",
      "question-1",
      { id: "preparer-1" } as never,
      {
        fileName: "screenshot.png",
        fileSize: 2048,
        mimeType: "image/png",
      }
    );

    expect(storage.createReviewQuestionImageUploadGrant).toHaveBeenCalledWith(
      "project-1",
      "question-1",
      "screenshot.png",
      "image/png"
    );
    expect(grant.objectKey).toBe(
      "review-question-images/project-1/question-1/stored-screenshot.png"
    );
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("proxies review question image downloads through the API", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaperQuestionMessageImage.findFirst.mockResolvedValue({
      id: "image-1",
      fileName: "stored-screenshot.png",
      originalName: "screenshot.png",
      objectKey:
        "review-question-images/project-1/question-1/stored-screenshot.png",
      mimeType: "image/png",
    });
    const body = Buffer.from("image-bytes");
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(body),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await expect(
      service.downloadReviewQuestionImage("project-1", "image-1", {
        id: "preparer-1",
      } as never)
    ).resolves.toStrictEqual({
      fileName: "screenshot.png",
      mimeType: "image/png",
      body,
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "review-question-images/project-1/question-1/stored-screenshot.png"
    );
  });

  it("sends a review question image message without creating project attachments", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
    });
    prisma.workingPaperQuestionMessage.create.mockResolvedValue({
      id: "message-1",
      questionId: "question-1",
      authorId: "preparer-1",
      messageType: "REPLY",
      body: "",
      createdAt: new Date("2026-06-14T12:00:00.000Z"),
      images: [
        {
          id: "image-1",
          messageId: "message-1",
          fileName: "stored-screenshot.png",
          originalName: "screenshot.png",
          objectKey:
            "review-question-images/project-1/question-1/stored-screenshot.png",
          fileSize: 2048,
          mimeType: "image/png",
          width: 640,
          height: 480,
          createdAt: new Date("2026-06-14T12:00:00.000Z"),
        },
      ],
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "OPEN",
    });
    const storage = {
      getObjectMetadata: vi.fn().mockResolvedValue({
        contentLength: 2048,
        contentType: "image/png",
      }),
    };
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      undefined,
      storage as never
    );

    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "preparer-1" } as never,
      {
        replyBody: "",
        images: [
          {
            objectKey:
              "review-question-images/project-1/question-1/stored-screenshot.png",
            fileName: "screenshot.png",
            fileSize: 2048,
            mimeType: "image/png",
            width: 640,
            height: 480,
          },
        ],
      }
    );

    expect(storage.getObjectMetadata).toHaveBeenCalledWith(
      "review-question-images/project-1/question-1/stored-screenshot.png"
    );
    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "preparer-1",
          messageType: "REPLY",
          body: "",
          images: {
            create: [
              expect.objectContaining({
                objectKey:
                  "review-question-images/project-1/question-1/stored-screenshot.png",
                originalName: "screenshot.png",
                fileSize: 2048,
                mimeType: "image/png",
                width: 640,
                height: 480,
              }),
            ],
          },
        }),
      })
    );
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("records creator messages on replied questions as follow-ups", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "REPLIED",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "OPEN",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      inbox as never
    );

    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "reviewer-1", name: "Reviewer" } as never,
      { replyBody: "Please add one more support." }
    );

    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "reviewer-1",
          messageType: "FOLLOW_UP",
          body: "Please add one more support.",
        }),
      })
    );
    expect(prisma.workingPaperQuestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      })
    );
    expect(
      prisma.workingPaperQuestion.update.mock.calls[0][0].data
    ).not.toHaveProperty("status");
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "preparer-1",
        senderId: "reviewer-1",
        type: "REVIEW_FOLLOW_UP",
      })
    );
  });

  it("rejects stale review actions when the owning file was deleted", async () => {
    prisma.workingPaperQuestion.findFirst.mockResolvedValue(null);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );
    await expect(
      Reflect.get(service, "requireReviewQuestion").call(
        service,
        "project-1",
        "q-1"
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });
    expect(prisma.workingPaperQuestion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "q-1",
        projectId: "project-1",
        OR: [
          { attachmentId: null },
          { attachment: { is: { deletedAt: null } } },
        ],
      },
    });
    expect(prisma.workingPaperQuestion.update).not.toHaveBeenCalled();
  });

  it("sends inbox messages for review questions and replies", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "PREPARER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
      preparerId: "preparer-1",
      reviewerId: "reviewer-1",
    });
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: "project-1",
      userId: "preparer-1",
      status: "ACTIVE",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
    });
    prisma.workingPaperQuestion.create.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
    });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
      body: "Please explain the bank variance.",
    });
    prisma.workingPaperQuestion.update.mockResolvedValue({
      id: "question-1",
      status: "REPLIED",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      inbox as never
    );

    await service.createWorkingPaperQuestion(
      "project-1",
      "paper-1",
      {
        id: "reviewer-1",
        name: "Reviewer",
      } as never,
      { body: "Please explain the bank variance.", assignedToId: "preparer-1" }
    );
    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      {
        id: "preparer-1",
        name: "Preparer",
      } as never,
      { replyBody: "Variance support uploaded." }
    );

    expect(prisma.workingPaperQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
        }),
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipientId: "preparer-1",
        senderId: "reviewer-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        reviewQuestionId: "question-1",
        type: "REVIEW_QUESTION",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        recipientId: "reviewer-1",
        senderId: "preparer-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        reviewQuestionId: "question-1",
        type: "REVIEW_REPLY",
      })
    );
  });

  it("sends inbox messages when working papers are signed off", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "PREPARER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      title: "Cash testing",
      preparerId: "preparer-1",
      reviewerId: "reviewer-1",
    });
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      inbox as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "preparer-1",
      name: "Preparer",
    } as never);

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "reviewer-1",
        senderId: "preparer-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        type: "SIGNOFF",
        contentKey: "WORKING_PAPER_PREPARED",
        contentParams: {
          actor: "Preparer",
          paperCode: "A01-0001-F001",
          paperTitle: "Cash testing",
        },
      })
    );
  });

  it("only allows the question creator to clear or reopen it", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" });
    prisma.workingPaperQuestion.findFirst
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-creator",
        status: "REPLIED",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-creator",
        status: "CLEARED",
      });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.clearWorkingPaperQuestion("project-1", "question-1", {
        id: "reviewer-other",
      } as never)
    ).rejects.toThrow("只有提出该复核意见的人可以标记已解决");
    await expect(
      service.reopenWorkingPaperQuestion(
        "project-1",
        "question-1",
        { id: "reviewer-other" } as never,
        { body: "Reopen after later review." }
      )
    ).rejects.toThrow("只有提出该复核意见的人可以重新打开");

    expect(prisma.workingPaperQuestion.update).not.toHaveBeenCalled();
  });

  it("records review question messages across replies, follow-ups, and reopen", async () => {
    access.requireProjectMember
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "PREPARER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" })
      .mockResolvedValueOnce({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
    });
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: "project-1",
      userId: "preparer-1",
      status: "ACTIVE",
      projectRole: "PREPARER",
      user: { globalRole: "STAFF", status: "ACTIVE" },
    });
    prisma.workingPaperQuestion.create.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "OPEN",
    });
    prisma.workingPaperQuestion.findFirst
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "OPEN",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "REPLIED",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "REPLIED",
      })
      .mockResolvedValueOnce({
        id: "question-1",
        projectId: "project-1",
        workingPaperId: "paper-1",
        assignedToId: "preparer-1",
        createdById: "reviewer-1",
        status: "CLEARED",
      });
    prisma.workingPaperQuestion.update
      .mockResolvedValueOnce({ id: "question-1", status: "REPLIED" })
      .mockResolvedValueOnce({ id: "question-1", status: "OPEN" })
      .mockResolvedValueOnce({ id: "question-1", status: "CLEARED" })
      .mockResolvedValueOnce({ id: "question-1", status: "OPEN" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.createWorkingPaperQuestion(
      "project-1",
      "paper-1",
      { id: "reviewer-1" } as never,
      { body: "Please explain the bank variance.", assignedToId: "preparer-1" }
    );
    await service.replyWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "preparer-1" } as never,
      { replyBody: "Variance support uploaded." }
    );
    await service.followUpWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "reviewer-1" } as never,
      { body: "Please add the bank confirmation copy." }
    );
    await service.clearWorkingPaperQuestion("project-1", "question-1", {
      id: "reviewer-1",
    } as never);
    await service.reopenWorkingPaperQuestion(
      "project-1",
      "question-1",
      { id: "reviewer-1" } as never,
      { body: "Reopened after partner review." }
    );

    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "reviewer-1",
          messageType: "QUESTION",
          body: "Please explain the bank variance.",
        }),
      })
    );
    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "preparer-1",
          messageType: "REPLY",
          body: "Variance support uploaded.",
        }),
      })
    );
    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "reviewer-1",
          messageType: "FOLLOW_UP",
          body: "Please add the bank confirmation copy.",
        }),
      })
    );
    expect(prisma.workingPaperQuestionMessage.create).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question-1",
          authorId: "reviewer-1",
          messageType: "REOPEN",
          body: "Reopened after partner review.",
        }),
      })
    );
  });

  it("does not reopen a question that has not been cleared", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaperQuestion.findFirst.mockResolvedValue({
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      assignedToId: "preparer-1",
      createdById: "reviewer-1",
      status: "REPLIED",
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.reopenWorkingPaperQuestion(
        "project-1",
        "question-1",
        { id: "reviewer-1" } as never,
        {
          body: "This should be a follow-up instead.",
        }
      )
    ).rejects.toThrow("只有已解决的复核意见可以重新打开");
  });

  it("allows reviewers to submit preparation signoff", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.prepareWorkingPaper("project-1", "paper-1", {
      id: "reviewer-1",
    } as never);

    expect(prisma.workingPaper.update).not.toHaveBeenCalled();
    expect(prisma.workingPaperSignoff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachmentId: "attachment-1",
          userId: "reviewer-1",
          type: "PREPARER",
        }),
      })
    );
  });

  it("blocks review signoff before preparation signoff", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      reviewerId: null,
    });
    prisma.workingPaperSignoff.findFirst.mockResolvedValue(null);
    prisma.attachment.findFirst.mockResolvedValue({ id: "attachment-1" });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await expect(
      service.reviewWorkingPaper("project-1", "paper-1", {
        id: "reviewer-1",
      } as never)
    ).rejects.toThrow("Preparation signoff is required before review signoff.");
    expect(prisma.workingPaperSignoff.create).not.toHaveBeenCalled();
  });

  it("enforces a 24-hour cooldown for the same reviewer on the same attachment", async () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    signoffEvents = [
      {
        id: "preparer-1",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        userId: "preparer-1",
        type: "PREPARER",
        roundNumber: 1,
        isCurrent: true,
        revokedAt: null,
        signedAt: new Date("2026-08-31T10:00:00.000Z"),
      },
      {
        id: "reviewer-1",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        userId: "reviewer-1",
        type: "REVIEWER",
        roundNumber: 1,
        isCurrent: true,
        revokedAt: null,
        signedAt: new Date("2026-08-31T11:00:00.000Z"),
      },
    ];
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "evidence.pdf",
    });
    prisma.workingPaperSignoff.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        signoffEvents
          .filter(
            (signoff) =>
              signoff.attachmentId === where.attachmentId &&
              signoff.userId === where.userId &&
              signoff.type === where.type &&
              signoff.revokedAt === null
          )
          .sort(
            (left, right) =>
              new Date(String(right.signedAt)).getTime() -
              new Date(String(left.signedAt)).getTime()
          )[0] ?? null
      )
    );
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    try {
      await expect(
        service.reviewAttachment("project-1", "attachment-1", {
          id: "reviewer-1",
        } as never)
      ).rejects.toMatchObject({
        response: { code: "REVIEW_SIGNOFF_COOLDOWN_ACTIVE" },
      });
      expect(prisma.workingPaperSignoff.create).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows a reviewer to sign again exactly 24 hours later", async () => {
    const latestReview = {
      id: "reviewer-1",
      attachmentId: "attachment-1",
      workingPaperId: "paper-1",
      userId: "reviewer-1",
      type: "REVIEWER",
      roundNumber: 1,
      isCurrent: false,
      revokedAt: null,
      signedAt: new Date("2026-08-30T12:00:00.000Z"),
    };
    signoffEvents = [
      {
        id: "preparer-2",
        attachmentId: "attachment-1",
        workingPaperId: "paper-1",
        userId: "preparer-1",
        type: "PREPARER",
        roundNumber: 2,
        isCurrent: true,
        revokedAt: null,
        signedAt: new Date("2026-08-31T11:00:00.000Z"),
      },
      latestReview,
    ];
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileName: "evidence.pdf",
      preparerId: "preparer-1",
    });
    prisma.workingPaperSignoff.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        signoffEvents
          .filter(
            (signoff) =>
              signoff.attachmentId === where.attachmentId &&
              signoff.userId === where.userId &&
              signoff.type === where.type &&
              signoff.revokedAt === null
          )
          .sort(
            (left, right) =>
              new Date(String(right.signedAt)).getTime() -
              new Date(String(left.signedAt)).getTime()
          )[0] ?? null
      )
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    inbox.createCollaborationMessage.mockRejectedValueOnce(
      new Error("notification service unavailable")
    );
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never,
      inbox as never
    );

    try {
      await service.reviewAttachment("project-1", "attachment-1", {
        id: "reviewer-1",
        name: "Reviewer",
      } as never);
      expect(prisma.workingPaperSignoff.create).toHaveBeenCalledOnce();
      expect(inbox.createCollaborationMessage).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows review notes before preparation signoff", async () => {
    access.requireProjectMember.mockResolvedValue({ projectRole: "REVIEWER" });
    prisma.workingPaper.findFirst.mockResolvedValue({
      id: "paper-1",
      projectId: "project-1",
      code: "A01-0001-F001",
      reviewerId: null,
    });
    const service = new WorkflowService(
      prisma as never,
      access as never,
      auditLogs as never,
      documentConversion as never
    );

    await service.returnWorkingPaper(
      "project-1",
      "paper-1",
      { id: "reviewer-1" } as never,
      {
        reviewNote: "请补充银行回函差异说明",
      }
    );

    expect(prisma.workingPaperSignoff.findFirst).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WORKING_PAPER_RETURNED",
        targetId: "paper-1",
      })
    );
  });
});
