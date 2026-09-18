import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { AuthGuard } from "../auth/auth.guard";
import { BETTER_AUTH_SESSION_READER } from "../auth/better-auth-session-reader";
import type { RequestUser } from "../auth/request-user";
import { ApiForbiddenException } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmationEmpImportArchiveService } from "./confirmation-emp-import-archive.service";
import {
  CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE,
  ConfirmationEmpImportWithdrawalService,
} from "./confirmation-emp-import-withdrawal.service";
import { PrismaConfirmationEmpImportWithdrawalStore } from "./confirmation-emp-import-withdrawal.store";
import { ConfirmationEmpImportService } from "./confirmation-emp-import.service";
import { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";
import { ConfirmationResponseService } from "./confirmation-response.service";
import { ConfirmationSubmissionService } from "./confirmation-submission.service";
import { ConfirmationUploadService } from "./confirmation-upload.service";
import { ProjectAccessService } from "./project-access.service";
import { ProjectConfirmationsService } from "./project-confirmations.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsModule } from "./projects.module";
import { ProjectsService } from "./projects.service";

const projects = { project: vi.fn() };
const confirmations = { project: vi.fn() };
const submissions = { project: vi.fn() };
const responses = { project: vi.fn() };
const uploads = { project: vi.fn() };
const empImport = {
  preview: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
  getJob: vi.fn(),
  retryJob: vi.fn(),
};
const withdrawal = { withdraw: vi.fn(), restore: vi.fn() };
const access = {
  requireProjectAction: vi.fn(),
  requireProjectMember: vi.fn(),
};
const prisma = {
  projectMember: { findMany: vi.fn() },
  projectConfirmation: { findMany: vi.fn() },
  workflowNode: { findMany: vi.fn() },
  confirmationEmpImportJob: { findMany: vi.fn() },
  confirmationEmpImportItem: { findMany: vi.fn() },
  workingPaper: { findMany: vi.fn() },
  attachment: { findMany: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn() },
};
const auditLogs = { log: vi.fn() };
const auth = { getSession: vi.fn() };

function createController() {
  return new (ProjectsController as unknown as new (
    ...args: unknown[]
  ) => ProjectsController)(
    projects,
    confirmations,
    submissions,
    responses,
    uploads,
    empImport,
    withdrawal,
    access,
    prisma,
    auditLogs
  );
}

function handler(name: string) {
  return (ProjectsController.prototype as unknown as Record<string, unknown>)[
    name
  ] as (...args: unknown[]) => unknown;
}

const user: RequestUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  globalRole: "CONFIRMATION_OFFICER",
};
const source = { ipAddress: "127.0.0.1" };
const rawJob = {
  id: "job-1",
  projectId: "project-1",
  mode: "FLAT",
  status: "QUEUED",
  previewFingerprint: "preview-fingerprint-1",
  createdAt: new Date("2026-08-05T01:00:00.000Z"),
  updatedAt: new Date("2026-08-05T01:00:00.000Z"),
  withdrawnAt: null,
  items: [
    {
      id: "item-1",
      confirmationId: "confirmation-1",
      sourceFileName: "Acme-Outgoing.pdf",
      status: "QUEUED",
      targetLocation: null,
      errorMessage: null,
    },
  ],
};
const rawPreview = {
  projectId: "project-1",
  targetWorkflowNodeId: "node-1",
  mode: "FLAT",
  sources: [
    {
      confirmationId: "confirmation-1",
      confirmationCode: "C-001",
      counterpartyName: "Acme",
      sourceKind: "OUTGOING_ARTIFACT",
      sourceArtifactId: "artifact-1",
      responseId: null,
      responseArtifactId: null,
      sourceObjectKey: "source/outgoing.pdf",
      originalFileName: "Acme-Outgoing.pdf",
      mimeType: "application/pdf",
      fileSize: 12,
      sourceSha256: "source-hash",
      activeLinkKey: "OUTGOING_ARTIFACT:confirmation-1:artifact-1",
      paperCode: "A-F001",
      businessName: "Acme-Outgoing.pdf",
      prepareUserId: "preparer-1",
      prepareAt: new Date("2026-08-04T01:00:00.000Z"),
      reviewUserId: "reviewer-1",
      reviewAt: new Date("2026-08-04T02:00:00.000Z"),
      packageSequence: null,
      zipEntryName: null,
    },
  ],
  skipped: [],
  issues: [],
  fingerprint: "preview-fingerprint-1",
};

function resetMocks() {
  vi.clearAllMocks();
  empImport.preview.mockResolvedValue(rawPreview);
  empImport.createJob.mockResolvedValue(rawJob);
  empImport.listJobs.mockResolvedValue([rawJob]);
  empImport.getJob.mockResolvedValue(rawJob);
  empImport.retryJob.mockResolvedValue(rawJob);
  withdrawal.withdraw.mockResolvedValue({
    importJobId: "job-1",
    linkIds: ["item-1"],
    mode: "FLAT",
    recycleDirectory: false,
  });
  withdrawal.restore.mockResolvedValue({
    importJobId: "job-1",
    linkIds: ["item-1"],
    mode: "FLAT",
  });
  access.requireProjectAction.mockResolvedValue({});
  access.requireProjectMember.mockResolvedValue({});
  prisma.projectMember.findMany.mockResolvedValue([]);
  prisma.projectConfirmation.findMany.mockResolvedValue([
    { id: "confirmation-1" },
  ]);
  prisma.workflowNode.findMany.mockResolvedValue([
    {
      id: "node-1",
      projectId: "project-1",
      parentId: null,
      level: 1,
      code: "A",
      title: "Target",
    },
  ]);
  prisma.confirmationEmpImportJob.findMany.mockResolvedValue([rawJob]);
  prisma.confirmationEmpImportItem.findMany.mockResolvedValue([]);
  prisma.workingPaper.findMany.mockResolvedValue([]);
  prisma.attachment.findMany.mockResolvedValue([]);
  prisma.user.findMany.mockResolvedValue([
    { id: "preparer-1", name: "Preparer" },
    { id: "reviewer-1", name: "Reviewer" },
  ]);
  prisma.user.findUnique.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
    status: "ACTIVE",
    independenceDeclarations: [{ id: "declaration-1" }],
  });
  auth.getSession.mockResolvedValue({ user: { id: user.id } });
  auditLogs.log.mockResolvedValue(undefined as never);
}

describe("projectsController confirmation EMP import routes", () => {
  beforeEach(resetMocks);

  it("exposes eligible projects on a static route before :id", () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        handler("listEligibleConfirmationEmpProjects")
      )
    ).toBe("confirmation-emp-imports/eligible-projects");
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        handler("listEligibleConfirmationEmpProjects")
      )
    ).toBe(RequestMethod.GET);
    const methodNames = Object.getOwnPropertyNames(
      ProjectsController.prototype
    );
    expect(
      methodNames.indexOf("listEligibleConfirmationEmpProjects")
    ).toBeLessThan(methodNames.indexOf("get"));
  });

  it("requires the authenticated request guard for all project routes", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toContain(
      AuthGuard
    );
  });

  it("lists only active members that pass modifyIndex", async () => {
    prisma.projectMember.findMany.mockResolvedValue([
      { project: { id: "project-1", projectCode: "P-001", name: "One" } },
      { project: { id: "project-2", projectCode: "P-002", name: "Two" } },
    ]);
    access.requireProjectAction.mockImplementation(
      async (projectId: string) => {
        await Promise.resolve();
        if (projectId === "project-2") {
          throw new ApiForbiddenException("FORBIDDEN", "no modifyIndex");
        }
        return {};
      }
    );

    await expect(
      createController().listEligibleConfirmationEmpProjects(user)
    ).resolves.toStrictEqual({
      projects: [{ id: "project-1", code: "P-001", name: "One" }],
    });
    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      user.id,
      "modifyIndex"
    );
    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-2",
      user.id,
      "modifyIndex"
    );
  });

  it("does not let a global admin without a real member row see projects", async () => {
    await expect(
      createController().listEligibleConfirmationEmpProjects({
        ...user,
        globalRole: "SUPER_ADMIN",
      })
    ).resolves.toStrictEqual({ projects: [] });
    expect(access.requireProjectAction).not.toHaveBeenCalled();
  });

  it("does not let a cross-project preview reach the import core", async () => {
    access.requireProjectAction.mockImplementation(
      async (projectId: string) => {
        await Promise.resolve();
        if (projectId === "project-2") {
          throw new ApiForbiddenException("FORBIDDEN", "not a project member");
        }
        return {};
      }
    );

    await expect(
      createController().previewConfirmationEmpImport(
        "project-2",
        { mode: "FLAT", targetDirectoryId: "node-1" },
        user
      )
    ).rejects.toThrow("not a project member");
    expect(empImport.preview).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.findMany).not.toHaveBeenCalled();
  });

  it("uses core default eligibility and the shared response contract for preview", async () => {
    const result = await createController().previewConfirmationEmpImport(
      "project-1",
      { mode: "FLAT", targetDirectoryId: "node-1" },
      user
    );

    expect(empImport.preview).toHaveBeenCalledWith("project-1", user, {
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
    });
    expect(result).toStrictEqual(
      expect.objectContaining({
        projectId: "project-1",
        mode: "FLAT",
        targetDirectoryId: "node-1",
        counts: { eligible: 1, imported: 0, blocked: 0 },
        items: [
          expect.objectContaining({
            confirmationId: "confirmation-1",
            role: "OUTGOING",
            status: "ELIGIBLE",
            sourceProposal: {
              sourceConfirmationId: "confirmation-1",
              empCode: "A-F001",
              businessName: "Acme-Outgoing.pdf",
            },
            signoff: {
              preparerName: "Preparer",
              reviewerName: "Reviewer",
              manual: false,
            },
          }),
        ],
      })
    );
    expect(prisma.projectConfirmation.findMany).not.toHaveBeenCalled();
  });

  it("passes a de-duplicated multi-confirmation selection to the import core", async () => {
    const controller = createController();

    await controller.previewConfirmationEmpImport(
      "project-1",
      {
        mode: "FLAT",
        targetDirectoryId: "node-1",
        confirmationIds: ["confirmation-1", "confirmation-1", "confirmation-2"],
      },
      user
    );

    expect(empImport.preview).toHaveBeenCalledWith("project-1", user, {
      targetWorkflowNodeId: "node-1",
      mode: "FLAT",
      confirmationIds: ["confirmation-1", "confirmation-2"],
    });
  });

  it.each(["FLAT", "GROUPED", "ZIP"] as const)(
    "keeps %s preview valid when the counterparty name is blank",
    async (mode) => {
      empImport.preview.mockResolvedValue({
        ...rawPreview,
        mode,
        sources: [{ ...rawPreview.sources[0], counterpartyName: "" }],
      });

      const result = await createController().previewConfirmationEmpImport(
        "project-1",
        { mode, targetDirectoryId: "node-1" },
        user
      );

      expect(result.items[0].counterparty).toBe("C-001");
    }
  );

  it("keeps every skipped physical source and exposes persisted EMP code and location", async () => {
    prisma.projectConfirmation.findMany.mockResolvedValue([]);
    empImport.preview.mockResolvedValue({
      ...rawPreview,
      sources: [],
      skipped: [
        {
          confirmationId: "confirmation-1",
          sourceKey: "OUTGOING_ARTIFACT:confirmation-1:outgoing-1",
          existingWorkingPaperId: "paper-1",
          existingJobId: "job-original",
          existingItemId: "item-original",
          existingMode: "GROUPED",
          sourceFileName: "original-name.pdf",
          existingAttachmentId: "attachment-1",
        },
        {
          confirmationId: "confirmation-1",
          sourceKey: "RESPONSE_ARTIFACT:confirmation-1:response-1:response-1",
          existingWorkingPaperId: "paper-2",
          existingAttachmentId: "attachment-2",
        },
      ],
    });
    prisma.workingPaper.findMany.mockResolvedValue([
      {
        id: "paper-1",
        code: "A-F001",
        title: "Outgoing",
        workflowNodeId: "node-1",
      },
      {
        id: "paper-2",
        code: "A-F002",
        title: "Response",
        workflowNodeId: "node-1",
      },
    ]);
    prisma.attachment.findMany.mockResolvedValue([
      {
        id: "attachment-1",
        fileName: "outgoing.pdf",
        workingPaperId: "paper-1",
      },
      {
        id: "attachment-2",
        fileName: "response.pdf",
        workingPaperId: "paper-2",
      },
    ]);

    const result = await createController().previewConfirmationEmpImport(
      "project-1",
      { mode: "FLAT", targetDirectoryId: "node-1" },
      user
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ existingJobId: "job-original", existingItemId: "item-original", existingMode: "GROUPED", sourceFileName: "original-name.pdf" });
    expect(
      result.items.map((item) => item.sourceProposal.empCode)
    ).toStrictEqual(["A-F001", "A-F002"]);
    expect(
      result.items.every((item) => item.existingLocation === "A Target")
    ).toBeTruthy();
    expect(
      result.items.map((item) => item.sourceProposal.empCode)
    ).not.toContain("paper-1");
  });

  it("serializes level-3 targets as valid targets for every archive mode", async () => {
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-1",
        projectId: "project-1",
        parentId: null,
        level: 3,
        code: "A-F",
        title: "Working papers",
      },
    ]);
    const controller = createController();
    const flat = await controller.previewConfirmationEmpImport(
      "project-1",
      { mode: "FLAT", targetDirectoryId: "node-1" },
      user
    );
    expect(flat.targetDirectories[0].canAcceptWorkflow).toBeTruthy();

    empImport.preview.mockResolvedValue({ ...rawPreview, mode: "GROUPED" });
    const grouped = await controller.previewConfirmationEmpImport(
      "project-1",
      { mode: "GROUPED", targetDirectoryId: "node-1" },
      user
    );
    expect(grouped.targetDirectories[0].canAcceptWorkflow).toBeTruthy();
  });

  it("uses the core source paper code for a ZIP working paper", async () => {
    empImport.preview.mockResolvedValue({
      ...rawPreview,
      mode: "ZIP",
      sources: [{ ...rawPreview.sources[0], paperCode: "A-F002" }],
    });
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-1",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "A",
        title: "Target",
      },
    ]);

    const result = await createController().previewConfirmationEmpImport(
      "project-1",
      { mode: "ZIP", targetDirectoryId: "node-1" },
      user
    );

    expect(result.zipWorkingPaper).toStrictEqual({
      code: "A-F002",
      name: "Confirmation responses-Import.zip",
    });
  });

  it("allocates the next grouped directory code under the target and skips digit four", async () => {
    empImport.preview.mockResolvedValue({ ...rawPreview, mode: "GROUPED" });
    prisma.workflowNode.findMany.mockResolvedValue([
      {
        id: "node-1",
        projectId: "project-1",
        parentId: null,
        level: 1,
        code: "A",
        title: "Target",
      },
      {
        id: "batch-1",
        projectId: "project-1",
        parentId: "node-1",
        level: 2,
        code: "A-B001",
        title: "Existing 1",
      },
      {
        id: "batch-2",
        projectId: "project-1",
        parentId: "node-1",
        level: 2,
        code: "A-B002",
        title: "Existing 2",
      },
      {
        id: "batch-3",
        projectId: "project-1",
        parentId: "node-1",
        level: 2,
        code: "A-B003",
        title: "Existing 3",
      },
    ]);

    const result = await createController().previewConfirmationEmpImport(
      "project-1",
      { mode: "GROUPED", targetDirectoryId: "node-1" },
      user
    );

    expect(result.batchDirectory).toStrictEqual({
      code: "A-B005",
      name: "Confirmation responses-Import",
    });
  });

  it("maps withdrawn items and a fully withdrawn job to shared recycle-bin state", async () => {
    empImport.getJob.mockResolvedValue({
      ...rawJob,
      status: "COMPLETED",
      withdrawnAt: null,
      items: [
        {
          ...rawJob.items[0],
          status: "SUCCEEDED",
          withdrawnAt: new Date("2026-08-05T03:00:00.000Z"),
          workingPaperCode: "A-F001",
          workingPaperTitle: "Acme outgoing",
          targetLocation: "A Target",
        },
      ],
    });

    const result = await createController().getConfirmationEmpImport(
      "project-1",
      "job-1",
      user
    );
    expect(result.status).toBe("WITHDRAWN");
    expect(result.withdrawnAt).toBe("2026-08-05T03:00:00.000Z");
    expect(result.items[0]).toStrictEqual(
      expect.objectContaining({
        status: "WITHDRAWN",
        targetLocation: "A Target",
      })
    );
  });

  it("backfills source confirmation and EMP target code consistently for every job response", async () => {
    const historicalJob = {
      ...rawJob,
      items: [
        {
          ...rawJob.items[0],
          sourceConfirmationId: undefined,
          targetCode: null,
          workingPaperCode: "A-F001",
        },
      ],
    };
    empImport.listJobs.mockResolvedValue([historicalJob]);
    empImport.getJob.mockResolvedValue(historicalJob);

    const controller = createController();
    const listedImports = await controller.listConfirmationEmpImports(
      "project-1",
      user
    );
    const responseResults = [
      listedImports[0],
      await controller.getConfirmationEmpImport("project-1", "job-1", user),
      await controller.withdrawConfirmationEmpImport(
        "project-1",
        "job-1",
        { mode: "FLAT", scope: "JOB" },
        user,
        source
      ),
      await controller.restoreConfirmationEmpImport(
        "project-1",
        "job-1",
        { mode: "FLAT", scope: "JOB" },
        user,
        source
      ),
    ];

    for (const response of responseResults) {
      expect(response.items[0]).toStrictEqual(
        expect.objectContaining({
          sourceConfirmationId: "confirmation-1",
          targetCode: "A-F001",
        })
      );
    }
  });

  it("rejects malformed mode and create bodies before core services", async () => {
    const controller = createController();

    await expect(
      controller.previewConfirmationEmpImport(
        "project-1",
        { mode: "NOT_A_MODE" },
        user
      )
    ).rejects.toThrow("Validation failed");
    await expect(
      controller.previewConfirmationEmpImport(
        "project-1",
        { mode: "FLAT", confirmationIds: [] },
        user
      )
    ).rejects.toThrow("Validation failed");
    await expect(
      controller.createConfirmationEmpImport(
        "project-1",
        { mode: "FLAT", targetDirectoryId: "node-1" },
        user,
        source
      )
    ).rejects.toThrow("Validation failed");
    await expect(
      controller.createConfirmationEmpImport(
        "project-1",
        {
          mode: "FLAT",
          targetDirectoryId: "node-1",
          previewFingerprint: "preview-fingerprint-1",
          items: [
            {
              id: "   ",
              empCode: "A-F001",
              businessName: "Response.pdf",
            },
          ],
          idempotencyKey: "00000000-0000-4000-8000-000000000001",
        },
        user,
        source
      )
    ).rejects.toThrow("Validation failed");
    expect(empImport.preview).not.toHaveBeenCalled();
    expect(empImport.createJob).not.toHaveBeenCalled();
  });

  it("maps canonical create input without pinning confirmation ids and returns a queued job with 202", async () => {
    const body = {
      mode: "FLAT",
      targetDirectoryId: "node-1",
      previewFingerprint: "preview-fingerprint-1",
      items: [
        {
          id: "confirmation-1:outgoing",
          sourceConfirmationId: "confirmation-1",
          empCode: "A-F001",
          businessName: "Acme-Outgoing.pdf",
        },
      ],
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    };
    const result = await createController().createConfirmationEmpImport(
      "project-1",
      body,
      user,
      source
    );
    expect(empImport.createJob).toHaveBeenCalledWith(
      "project-1",
      user,
      expect.objectContaining({
        targetWorkflowNodeId: "node-1",
        mode: "FLAT",
        previewFingerprint: body.previewFingerprint,
        idempotencyKey: body.idempotencyKey,
      }),
      source
    );
    expect(empImport.createJob.mock.calls[0][2]).not.toHaveProperty(
      "confirmationIds"
    );
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_EMP_IMPORT_JOB_CREATED_API",
      })
    );
    expect(result).toStrictEqual(
      expect.objectContaining({ id: "job-1", status: "QUEUED" })
    );
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        handler("createConfirmationEmpImport")
      )
    ).toBe(202);
  });

  it("passes every selected physical activeLinkKey to create", async () => {
    const body = {
      mode: "FLAT",
      targetDirectoryId: "node-1",
      previewFingerprint: "physical-selection",
      items: [
        {
          id: "OUTGOING_ARTIFACT:confirmation-1:outgoing-1",
          sourceConfirmationId: "confirmation-1",
          empCode: "A-F001",
          businessName: "Outgoing.pdf",
        },
        {
          id: "RESPONSE_ARTIFACT:confirmation-1:response-1:response-2",
          sourceConfirmationId: "confirmation-1",
          empCode: "A-F002",
          businessName: "Response-2.msg",
        },
        {
          id: "OUTGOING_ARTIFACT:confirmation-2:outgoing-2",
          sourceConfirmationId: "confirmation-2",
          empCode: "A-F003",
          businessName: "Second.pdf",
        },
      ],
      idempotencyKey: "00000000-0000-4000-8000-000000000004",
    };

    await createController().createConfirmationEmpImport(
      "project-1",
      body,
      user,
      source
    );

    expect(empImport.createJob.mock.calls[0][2]).toStrictEqual(
      expect.objectContaining({
        activeLinkKeys: body.items.map((item) => item.id),
      })
    );
  });

  it("keeps create fingerprint input stable when the preview contained skipped imports", async () => {
    const body = {
      mode: "FLAT",
      targetDirectoryId: "node-1",
      previewFingerprint: "preview-with-skipped",
      items: [
        {
          id: "OUTGOING_ARTIFACT:confirmation-2:artifact-2",
          sourceConfirmationId: "confirmation-2",
          empCode: "A-F002",
          businessName: "Remaining.pdf",
        },
      ],
      idempotencyKey: "00000000-0000-4000-8000-000000000005",
    };

    await createController().createConfirmationEmpImport(
      "project-1",
      body,
      user,
      source
    );

    expect(empImport.createJob.mock.calls[0][2]).not.toHaveProperty(
      "confirmationIds"
    );
  });

  it("returns the same serialized job for an idempotent replay", async () => {
    const controller = createController();
    const body = {
      mode: "FLAT",
      targetDirectoryId: "node-1",
      previewFingerprint: "preview-fingerprint-1",
      items: [
        {
          id: "confirmation-1:outgoing",
          sourceConfirmationId: "confirmation-1",
          empCode: "A-F001",
          businessName: "Acme-Outgoing.pdf",
        },
      ],
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    };
    const first = await controller.createConfirmationEmpImport(
      "project-1",
      body,
      user,
      source
    );
    const second = await controller.createConfirmationEmpImport(
      "project-1",
      body,
      user,
      source
    );
    expect(second).toStrictEqual(first);
    expect(empImport.createJob).toHaveBeenCalledTimes(2);
  });

  it("lists and gets jobs with project scoping", async () => {
    const controller = createController();
    await expect(
      controller.listConfirmationEmpImports("project-1", user)
    ).resolves.toStrictEqual([
      expect.objectContaining({ id: "job-1", projectId: "project-1" }),
    ]);
    expect(empImport.listJobs).toHaveBeenCalledWith("project-1", user);

    await expect(
      controller.getConfirmationEmpImport("project-2", "job-1", user)
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(empImport.getJob).toHaveBeenCalledWith("project-2", user, "job-1");
  });

  it("retries with a strict empty body and returns 202", async () => {
    const controller = createController();
    await expect(
      controller.retryConfirmationEmpImport(
        "project-1",
        "job-1",
        {},
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ id: "job-1", status: "QUEUED" })
    );
    expect(empImport.retryJob).toHaveBeenCalledWith(
      "project-1",
      user,
      "job-1",
      source
    );
    expect(auditLogs.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONFIRMATION_EMP_IMPORT_JOB_RETRY_API",
      })
    );
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        handler("retryConfirmationEmpImport")
      )
    ).toBe(202);
    await expect(
      controller.retryConfirmationEmpImport(
        "project-1",
        "job-1",
        { unexpected: true },
        user,
        source
      )
    ).rejects.toThrow("Validation failed");
  });

  it("rejects ZIP per-confirmation withdrawal and supports whole-job withdrawal", async () => {
    const controller = createController();
    empImport.getJob.mockResolvedValue({ ...rawJob, mode: "ZIP" });
    await expect(
      controller.withdrawConfirmationEmpImport(
        "project-1",
        "job-1",
        {
          mode: "ZIP",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).rejects.toThrow("Validation failed");
    await expect(
      controller.withdrawConfirmationEmpImport(
        "project-1",
        "job-1",
        { mode: "ZIP", scope: "JOB" },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(withdrawal.withdraw).toHaveBeenCalledWith(
      "project-1",
      "job-1",
      undefined,
      user,
      source
    );
  });

  it("withdraws one flat/group confirmation only after mode validation", async () => {
    const controller = createController();
    empImport.getJob.mockResolvedValue({ ...rawJob, mode: "GROUPED" });
    await expect(
      controller.withdrawConfirmationEmpImport(
        "project-1",
        "job-1",
        {
          mode: "GROUPED",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(withdrawal.withdraw).toHaveBeenCalledWith(
      "project-1",
      "job-1",
      "confirmation-1",
      user,
      source
    );
  });

  it("passes the explicit warning confirmation through for a non-blocking withdrawal", async () => {
    const controller = createController();
    empImport.getJob.mockResolvedValue({ ...rawJob, mode: "FLAT" });
    await expect(
      controller.withdrawConfirmationEmpImport(
        "project-1",
        "job-1",
        { mode: "FLAT", scope: "JOB", force: true },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(withdrawal.withdraw).toHaveBeenCalledWith(
      "project-1",
      "job-1",
      undefined,
      user,
      source,
      undefined,
      true
    );
  });

  it("restores a whole job or one flat/group confirmation without confusing ids", async () => {
    const controller = createController();
    await expect(
      controller.restoreConfirmationEmpImport(
        "project-1",
        "job-1",
        { mode: "FLAT", scope: "JOB" },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(withdrawal.restore).toHaveBeenCalledWith(
      "project-1",
      "job-1",
      { scope: "JOB" },
      user,
      source
    );
    await expect(
      controller.restoreConfirmationEmpImport(
        "project-1",
        "job-1",
        {
          mode: "FLAT",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "job-1" }));
    expect(withdrawal.restore).toHaveBeenLastCalledWith(
      "project-1",
      "job-1",
      {
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: "confirmation-1",
      },
      user,
      source
    );
    expect(withdrawal.restore).toHaveBeenCalledTimes(2);
    await expect(
      controller.restoreConfirmationEmpImport(
        "project-1",
        "job-1",
        {
          mode: "ZIP",
          scope: "SOURCE_CONFIRMATION",
          sourceConfirmationId: "confirmation-1",
        },
        user,
        source
      )
    ).rejects.toThrow("Validation failed");
  });

  it("registers production import providers and the withdrawal token alias", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ProjectsModule
    ) as unknown[];
    expect(providers).toContain(ConfirmationEmpImportService);
    expect(providers).toContain(ConfirmationEmpImportArchiveService);
    expect(providers).toContain(ConfirmationImportLinkGuardService);
    expect(providers).toContain(PrismaConfirmationEmpImportWithdrawalStore);
    expect(providers).toContain(ConfirmationEmpImportWithdrawalService);
    expect(providers).toContainEqual({
      provide: CONFIRMATION_EMP_IMPORT_WITHDRAWAL_STORE,
      useExisting: PrismaConfirmationEmpImportWithdrawalStore,
    });
  });
});

describe("projectsController confirmation EMP HTTP guard wiring", () => {
  let app: INestApplication;

  beforeEach(async () => {
    resetMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        AuthGuard,
        Reflector,
        { provide: BETTER_AUTH_SESSION_READER, useValue: auth },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projects },
        { provide: ProjectConfirmationsService, useValue: confirmations },
        { provide: ConfirmationSubmissionService, useValue: submissions },
        { provide: ConfirmationResponseService, useValue: responses },
        { provide: ConfirmationUploadService, useValue: uploads },
        { provide: ConfirmationEmpImportService, useValue: empImport },
        {
          provide: ConfirmationEmpImportWithdrawalService,
          useValue: withdrawal,
        },
        { provide: ProjectAccessService, useValue: access },
        { provide: AuditLogsService, useValue: auditLogs },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an unauthenticated request to the static eligible-project route", async () => {
    auth.getSession.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get("/engagement/confirmation-emp-imports/eligible-projects")
      .expect(401);
    expect(auth.getSession).toHaveBeenCalledOnce();
  });

  it("runs the static eligible-project route through AuthGuard and returns its contract", async () => {
    prisma.projectMember.findMany.mockResolvedValueOnce([
      { project: { id: "project-1", projectCode: "P-001", name: "One" } },
    ]);

    await request(app.getHttpServer())
      .get("/engagement/confirmation-emp-imports/eligible-projects")
      .set("Authorization", "Bearer token")
      .expect(200)
      .expect({
        projects: [{ id: "project-1", code: "P-001", name: "One" }],
      });
    expect(auth.getSession).toHaveBeenCalledOnce();
  });

  it("does not retain the removed projects API prefix", async () => {
    const response = await request(app.getHttpServer()).get(
      "/projects/confirmation-emp-imports/eligible-projects"
    );

    expect(response.status).toBe(404);
  });
});
