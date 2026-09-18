import { createHash } from "node:crypto";

import JSZip from "jszip";
import type { Mock } from "vitest";

import type { ConfirmationEmpImportSnapshot } from "./confirmation-emp-import-withdrawal.service";
import { PrismaConfirmationEmpImportWithdrawalStore } from "./confirmation-emp-import-withdrawal.store";

type TestMockMethod = Mock<(...args: never[]) => unknown>;
type TestMockModel = Record<string, TestMockMethod>;
type TestQuery = { values?: readonly unknown[] };
type TestQueryRawMock = Mock<(query: TestQuery) => Promise<unknown[]>>;
type TestPrisma = {
  $transaction: TestMockMethod;
  $queryRaw: TestQueryRawMock;
  confirmationEmpImportItem: TestMockModel;
  attachment: TestMockModel;
  workingPaper: TestMockModel;
  workingPaperSignoff: TestMockModel;
  projectConfirmation: TestMockModel;
  workflowNode: TestMockModel;
  auditLog: TestMockModel;
  confirmationFollowUpEvent: TestMockModel;
};
type ItemFindManyWhere = {
  confirmationId?: string;
  id?: { in?: readonly string[] };
  status?: string;
  withdrawnAt?: null | { not?: null };
};
type ConfirmationWhere = { id: string };
type TestUpdateInput = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

describe(PrismaConfirmationEmpImportWithdrawalStore, () => {
  it("rebuilds a ZIP after withdrawing one item and synchronizes the remaining head", async () => {
    const state = createFlatState({ mode: "ZIP", itemCount: 2 });
    const first = state.items[0];
    const second = state.items[1];
    Object.assign(first, {
      zipEntryName: "1000.1.01-A.pdf",
      sourceFileName: "A.pdf",
    });
    Object.assign(second, {
      zipEntryName: "1000.1.02-B.pdf",
      sourceFileName: "B.pdf",
    });
    Object.assign(first, { attachment: state.attachment });
    Object.assign(second, { attachment: state.attachment });

    const original = new JSZip();
    original.file("1000.1.01-A.pdf", "A");
    original.file("1000.1.02-B.pdf", "B");
    const originalZip = await original.generateAsync({ type: "nodebuffer" });
    const zipHash = createHash("sha256").update(originalZip).digest("hex");
    Object.assign(first, {
      sourceSha256: createHash("sha256").update("A").digest("hex"),
    });
    Object.assign(second, {
      sourceSha256: createHash("sha256").update("B").digest("hex"),
    });
    state.attachment.contentHash = zipHash;
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(originalZip),
      putObject: vi.fn().mockResolvedValue({
        fileName: "confirmation-responses.zip",
        objectKey: "emp/response-v2.zip",
      }),
      deleteObjectIfPresent: vi.fn().mockResolvedValue(undefined),
    };
    const versionCreate = vi.fn().mockResolvedValue({
      id: "version-2",
      version: 2,
    });
    const versionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    Object.assign(state.prisma, {
      attachmentVersion: {
        create: versionCreate,
        updateMany: versionUpdateMany,
      },
    });
    state.prisma.confirmationEmpImportItem.updateMany = vi
      .fn()
      .mockImplementation(async (input: TestUpdateInput) => {
        const ids = Array.isArray((input.where.id as { in?: string[] })?.in)
          ? (input.where.id as { in: string[] }).in
          : [input.where.id as string];
        const matches = state.items.filter(
          (item) => ids.includes(item.id) && item.withdrawnAt === null
        );
        for (const item of matches) {
          Object.assign(item, input.data);
        }
        return { count: matches.length };
      });

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never,
      storage as never
    );
    await store.withdrawZipItem({
      importJobId: "job-1",
      linkId: "item-1",
      actorId: "user-1",
      withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
      reason: "单文件撤回",
      expectedTarget: {
        linkId: "item-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          location: "",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: zipHash,
          versionId: "version-1",
        },
      },
    });

    expect(state.prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "IMPORT_WITHDRAWN",
          actorId: "user-1",
        }),
      })
    );
    const body = storage.putObject.mock.calls
      .flat()
      .find((value): value is Buffer => Buffer.isBuffer(value));
    expect(body).toBeInstanceOf(Buffer);
    const rebuilt = await JSZip.loadAsync(body as Buffer);
    expect(Object.keys(rebuilt.files)).toStrictEqual(["1000.1.02-B.pdf"]);
    const rebuiltHash = createHash("sha256")
      .update(body as Buffer)
      .digest("hex");
    expect(versionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          fileUrl: "emp/response-v2.zip",
          contentHash: rebuiltHash,
        }),
      })
    );
    expect(state.items[0]?.withdrawnAt).toStrictEqual(
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(state.items[1]).toMatchObject({
      withdrawnAt: null,
      targetHeadVersionId: "version-2",
      targetHeadHash: rebuiltHash,
    });
    expect(state.attachment).toMatchObject({
      version: 2,
      headVersionId: "version-2",
      fileUrl: "emp/response-v2.zip",
      contentHash: rebuiltHash,
    });
  });

  it("rejects a ZIP rebuild when an active remaining entry is missing", async () => {
    const state = createFlatState({ mode: "ZIP", itemCount: 2 });
    const [first, second] = state.items;
    const original = new JSZip();
    original.file("1000.1.01-A.pdf", "A");
    const originalZip = await original.generateAsync({ type: "nodebuffer" });
    state.attachment.contentHash = createHash("sha256")
      .update(originalZip)
      .digest("hex");
    Object.assign(first, {
      attachment: state.attachment,
      zipEntryName: "1000.1.01-A.pdf",
      sourceSha256: createHash("sha256").update("A").digest("hex"),
    });
    Object.assign(second, {
      attachment: state.attachment,
      zipEntryName: "1000.1.02-B.pdf",
      sourceSha256: createHash("sha256").update("B").digest("hex"),
    });
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(originalZip),
      putObject: vi.fn(),
      deleteObjectIfPresent: vi.fn(),
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never,
      storage as never
    );

    await expect(
      store.withdrawZipItem({
        importJobId: "job-1",
        linkId: "item-1",
        actorId: "user-1",
        withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
        reason: null,
        expectedTarget: {
          linkId: "item-1",
          snapshot: {
            workflowNodeId: "node-1",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
            location: "",
            code: "WP-001",
            title: "Confirmation response",
            version: 1,
            hash: state.attachment.contentHash,
            versionId: "version-1",
          },
        },
      })
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("maps a succeeded persisted item to an active withdrawal snapshot", async () => {
    const item = {
      id: "item-1",
      jobId: "job-1",
      confirmationId: "confirmation-1",
      outgoingArtifactId: "outgoing-1",
      responseId: "response-1",
      responseArtifactId: "response-artifact-1",
      status: "SUCCEEDED",
      withdrawnAt: null,
      empWorkflowNodeId: "node-1",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      workingPaperCode: "WP-001",
      workingPaperTitle: "Confirmation response",
      targetHeadVersionId: "version-1",
      targetHeadHash: "sha256:target",
      job: { projectId: "project-1", mode: "FLAT" },
      empWorkflowNode: {
        id: "node-1",
        projectId: "project-1",
        code: "EMP",
        title: "EMP",
        parentId: null,
        level: 2,
      },
      workingPaper: {
        id: "paper-1",
        workflowNodeId: "node-1",
        code: "WP-001",
        title: "Confirmation response",
        signoffs: [{ id: "signoff-1", type: "REVIEWER" }],
      },
      attachment: {
        id: "attachment-1",
        workingPaperId: "paper-1",
        workflowNodeId: "node-1",
        code: "WP-001",
        title: "Confirmation response",
        version: 1,
        headVersionId: "version-1",
        contentHash: "sha256:target",
        deletedAt: null,
        versions: [
          {
            id: "version-1",
            version: 1,
            contentHash: "sha256:target",
            isCurrent: true,
          },
        ],
      },
    };
    const prisma = {
      confirmationEmpImportItem: {
        findMany: vi.fn().mockResolvedValue([item]),
      },
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      prisma as never
    );

    await expect(
      store.findLinkages({
        projectId: "project-1",
        importJobId: "job-1",
        state: "ACTIVE",
      })
    ).resolves.toMatchObject([
      {
        id: "item-1",
        importJobId: "job-1",
        projectId: "project-1",
        sourceConfirmationId: "confirmation-1",
        sourceArtifactId: "outgoing-1",
        sourceResponseId: "response-1",
        responseArtifactId: "response-artifact-1",
        mode: "FLAT",
        active: true,
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: "sha256:target",
        },
      },
    ]);
    expect(prisma.confirmationEmpImportItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobId: "job-1",
          job: { projectId: "project-1" },
          withdrawnAt: null,
          status: "SUCCEEDED",
        },
      })
    );
    const activeLinkages = await store.findLinkages({
      projectId: "project-1",
      importJobId: "job-1",
      state: "ACTIVE",
    });
    const [activeLinkage] = activeLinkages;
    expect(activeLinkage?.snapshot.signoffs).toStrictEqual([
      {
        id: "signoff-1",
        userId: null,
        type: "REVIEWER",
        signedAt: null,
      },
    ]);
  });

  it("soft-deletes a flat attachment, deletes only its empty paper, and audits the transition", async () => {
    const state = createFlatState();
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );

    await store.withdrawLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-1",
      withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
      reason: "撤回测试",
      recycleDirectory: false,
    });

    expect(state.attachment).toMatchObject({
      workingPaperId: null,
      deletedBy: "user-1",
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
      restoredAt: null,
      restoredBy: null,
    });
    expect(state.attachment.deletedAt).toStrictEqual(
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(state.paperDelete).toHaveBeenCalledWith({
      where: { id: "paper-1" },
    });
    expect(state.item).toMatchObject({
      status: "SUCCEEDED",
      withdrawnBy: "user-1",
      withdrawalReason: "撤回测试",
    });
    expect(state.item.withdrawnAt).toStrictEqual(
      new Date("2026-08-05T10:00:00.000Z")
    );
    expect(state.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_WITHDRAWN",
          targetId: "item-1",
          projectId: "project-1",
        }),
      })
    );
  });

  it("withdraws a changed target after the caller confirms the warning", async () => {
    const state = createFlatState();
    state.attachment.version = 2;
    state.attachment.contentHash = "sha256:changed";
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );

    await store.withdrawLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-1",
      withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
      reason: null,
      recycleDirectory: false,
      force: true,
      expectedTargets: [
        {
          linkId: "item-1",
          snapshot: {
            workflowNodeId: "node-1",
            workingPaperId: "paper-1",
            attachmentId: "attachment-1",
            location: "",
            code: "WP-001",
            title: "Confirmation response",
            version: 1,
            hash: "sha256:target",
            versionId: "version-1",
          },
        },
      ],
    });

    expect(state.attachmentUpdateMany).toHaveBeenCalledOnce();
    expect(state.item.withdrawnAt).toStrictEqual(
      new Date("2026-08-05T10:00:00.000Z")
    );
  });

  it("withdraws a ZIP shared attachment once and is idempotent on repeat", async () => {
    const state = createFlatState({ mode: "ZIP", itemCount: 2 });
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    const input = {
      importJobId: "job-1",
      linkIds: ["item-1", "item-2"],
      actorId: "user-1",
      withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
      reason: null,
      recycleDirectory: false,
    };

    await store.withdrawLinkages(input);
    await store.withdrawLinkages(input);

    expect(state.attachmentUpdateMany).toHaveBeenCalledOnce();
    expect(state.paperDelete).toHaveBeenCalledOnce();
    expect(state.itemUpdate).toHaveBeenCalledTimes(2);
    expect(state.auditCreate).toHaveBeenCalledTimes(4);
    expect(state.items.every((item) => item.withdrawnAt !== null)).toBeTruthy();
  });

  it("accepts a response-only linkage when the active outgoing artifact is not stored on the link", async () => {
    const confirmationFindFirst = vi.fn().mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      currentArtifact: { id: "outgoing-current", disposition: "ACTIVE" },
      responses: [
        {
          id: "response-1",
          routingStatus: "ROUTED",
          receivedAt: new Date("2026-08-05T10:00:00.000Z"),
          artifacts: [
            { id: "response-artifact-1", objectKey: "response-1.pdf" },
          ],
        },
      ],
    });
    const store = new PrismaConfirmationEmpImportWithdrawalStore({
      projectConfirmation: { findFirst: confirmationFindFirst },
    } as never);

    await expect(
      store.readSourceState({
        id: "item-1",
        importJobId: "job-1",
        projectId: "project-1",
        sourceConfirmationId: "confirmation-1",
        sourceArtifactId: null,
        responseArtifactId: "response-artifact-1",
        mode: "FLAT",
        active: false,
        withdrawnAt: new Date("2026-08-05T11:00:00.000Z"),
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          location: "EMP",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: "sha256:target",
        },
      })
    ).resolves.toMatchObject({
      valid: true,
      matched: true,
      artifactValid: true,
      status: "CLOSED",
      differenceStatus: "MATCHED",
    });
  });

  it("aborts the whole transaction when the target snapshot changes before recycle", async () => {
    const state = createFlatState();
    const expectedSnapshot = {
      workflowNodeId: "node-1",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      location: "",
      code: "WP-001",
      title: "Confirmation response",
      version: 1,
      hash: "sha256:target",
      versionId: "version-1",
    };
    state.attachmentUpdateMany.mockImplementationOnce(async () => {
      await Promise.resolve();
      state.attachment.contentHash = "sha256:changed-inside-transaction";
      return { count: 0 };
    });

    await expect(
      new PrismaConfirmationEmpImportWithdrawalStore(
        state.prisma as never
      ).withdrawLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-1",
        withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
        reason: null,
        recycleDirectory: false,
        expectedTargets: [{ linkId: "item-1", snapshot: expectedSnapshot }],
      } as never)
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(state.item.withdrawnAt).toBeNull();
    expect(state.auditCreate).not.toHaveBeenCalled();
  });

  it("requires the current CLOSED/MATCHED confirmation artifacts to restore a linkage", async () => {
    const confirmationFindFirst = vi.fn().mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      currentArtifact: { id: "outgoing-1", disposition: "ACTIVE" },
      responses: [
        {
          id: "response-old",
          routingStatus: "ROUTED",
          receivedAt: new Date("2026-08-04T10:00:00.000Z"),
          artifacts: [{ id: "response-artifact-old", objectKey: "old.pdf" }],
        },
        {
          id: "response-new",
          routingStatus: "ROUTED",
          receivedAt: new Date("2026-08-05T10:00:00.000Z"),
          artifacts: [{ id: "response-artifact-new", objectKey: "new.pdf" }],
        },
      ],
    });
    const store = new PrismaConfirmationEmpImportWithdrawalStore({
      projectConfirmation: { findFirst: confirmationFindFirst },
    } as never);

    await expect(
      store.readSourceState({
        id: "item-1",
        importJobId: "job-1",
        projectId: "project-1",
        sourceConfirmationId: "confirmation-1",
        sourceArtifactId: "outgoing-1",
        responseArtifactId: "response-artifact-new",
        mode: "FLAT",
        active: false,
        withdrawnAt: new Date(),
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          location: "EMP",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: "sha256:target",
        },
      })
    ).resolves.toMatchObject({
      valid: true,
      matched: true,
      artifactValid: true,
      status: "CLOSED",
      differenceStatus: "MATCHED",
    });

    confirmationFindFirst.mockResolvedValueOnce({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      currentArtifact: { id: "outgoing-2", disposition: "ACTIVE" },
      responses: [],
    });
    await expect(
      store.readSourceState({
        id: "item-1",
        importJobId: "job-1",
        projectId: "project-1",
        sourceConfirmationId: "confirmation-1",
        sourceArtifactId: "outgoing-1",
        responseArtifactId: "response-artifact-new",
        mode: "FLAT",
        active: false,
        withdrawnAt: new Date(),
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          location: "EMP",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: "sha256:target",
        },
      })
    ).resolves.toMatchObject({ valid: false, artifactValid: false });
  });

  it("marks generated group entries separately from an external item", async () => {
    const generated = {
      id: "attachment-1",
      code: "WP-001",
      title: "Generated response",
      fileName: "generated.pdf",
      originalName: "generated.pdf",
      version: 1,
      contentHash: "hash-1",
      workingPaperId: "paper-1",
    };
    const external = {
      id: "attachment-foreign",
      code: "WP-999",
      title: "Foreign note",
      fileName: "note.txt",
      originalName: "note.txt",
      version: 2,
      contentHash: "hash-foreign",
      workingPaperId: "paper-foreign",
    };
    const item = {
      id: "item-1",
      jobId: "job-1",
      confirmationId: "confirmation-1",
      status: "SUCCEEDED",
      withdrawnAt: null,
      empWorkflowNodeId: "node-group",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      workingPaperCode: "WP-001",
      workingPaperTitle: "Generated response",
      targetHeadVersionId: "version-1",
      targetHeadHash: "hash-1",
      job: { projectId: "project-1", mode: "GROUPED" },
      empWorkflowNode: {
        id: "node-group",
        code: "EMP-01",
        title: "Batch folder",
        parentId: null,
        level: 2,
      },
      workingPaper: {
        id: "paper-1",
        workflowNodeId: "node-group",
        code: "WP-001",
        title: "Generated response",
        signoffs: [],
      },
      attachment: {
        ...generated,
        workflowNodeId: "node-group",
        deletedAt: null,
      },
    };
    const prisma = {
      confirmationEmpImportItem: {
        findMany: vi.fn().mockResolvedValue([item]),
      },
      attachment: {
        findMany: vi.fn().mockResolvedValue([
          { ...generated, workflowNodeId: "node-group" },
          { ...external, workflowNodeId: "node-group" },
        ]),
      },
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      prisma as never
    );

    await expect(
      store.findLinkages({
        projectId: "project-1",
        importJobId: "job-1",
        state: "ACTIVE",
      })
    ).resolves.toMatchObject([
      {
        snapshot: {
          directoryEntries: [
            { id: "attachment-1", kind: "GENERATED" },
            { id: "attachment-foreign", kind: "EXTERNAL" },
          ],
        },
      },
    ]);
  });

  it("restores attachment recycle fields and reactivates persisted linkage", async () => {
    const state = createFlatState();
    state.item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.deletedBy = "user-1";
    state.attachment.deletedFromWorkingPaperId = "paper-1";
    state.attachment.deletedFromWorkflowNodeId = "node-1";
    state.attachment.deletedFromWorkingPaperCode = "WP-001";
    state.attachment.deletedFromWorkingPaperTitle = "Confirmation response";
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    await store.restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(state.paperCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowNodeId: "node-1",
          code: "WP-001",
          bucket: "CURRENT",
        }),
      })
    );
    expect(state.attachment).toMatchObject({
      workingPaperId: "paper-restored",
      workflowNodeId: "node-1",
      deletedAt: null,
      deletedBy: null,
      deletedFromWorkingPaperId: null,
      deletedFromWorkflowNodeId: null,
      restoredBy: "user-2",
    });
    expect(state.item).toMatchObject({
      status: "SUCCEEDED",
      withdrawnAt: null,
      withdrawnBy: null,
      withdrawalReason: null,
      workingPaperId: "paper-restored",
    });
    expect(state.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PROJECT_CONFIRMATION_EMP_IMPORT_RESTORED",
          targetId: "item-1",
        }),
      })
    );
    await expect(
      store.findLinkages({
        projectId: "project-1",
        importJobId: "job-1",
        state: "ACTIVE",
      })
    ).resolves.toMatchObject([
      { id: "item-1", active: true, withdrawnAt: null },
    ]);
  });

  it("restores the original paper metadata and automatic signoffs after withdrawal", async () => {
    const state = createFlatState();
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    const preparedAt = new Date("2026-08-05T08:30:00.000Z");
    const reviewedAt = new Date("2026-08-05T09:30:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      prepareUserId: "preparer-1",
      preparedAt,
      reviewUserId: "reviewer-1",
      reviewedAt,
      workingPaperCode: "ORIGINAL-001",
      workingPaperTitle: "Original response title",
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "ORIGINAL-001",
      deletedFromWorkingPaperTitle: "Original response title",
    });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "ORIGINAL-001",
      title: "Original response title",
    });
    const signoffFindMany = vi.fn().mockResolvedValue([]);
    const signoffCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    state.prisma.workingPaperSignoff = {
      findMany: signoffFindMany,
      createMany: signoffCreateMany,
    };

    await new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    ).restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(state.paperCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "ORIGINAL-001",
          title: "Original response title",
          preparerId: "preparer-1",
          preparedAt,
          reviewerId: "reviewer-1",
          reviewedAt,
        }),
      })
    );
    expect(signoffFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workingPaperId: "paper-restored",
          attachmentId: "attachment-1",
        },
      })
    );
    expect(signoffCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          workingPaperId: "paper-restored",
          attachmentId: "attachment-1",
          userId: "preparer-1",
          type: "PREPARER",
          signedAt: preparedAt,
        }),
        expect.objectContaining({
          workingPaperId: "paper-restored",
          attachmentId: "attachment-1",
          userId: "reviewer-1",
          type: "REVIEWER",
          signedAt: reviewedAt,
        }),
      ],
    });
    expect(state.attachmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          preparerId: "preparer-1",
          preparedAt,
          reviewerId: "reviewer-1",
          reviewedAt,
        }),
      })
    );
  });

  it("keeps ZIP restore manual with zero signoffs", async () => {
    const state = createFlatState({ mode: "ZIP" });
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      prepareUserId: "preparer-1",
      preparedAt: new Date("2026-08-05T08:30:00.000Z"),
      reviewUserId: "reviewer-1",
      reviewedAt: new Date("2026-08-05T09:30:00.000Z"),
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    const signoffCreateMany = vi.fn().mockResolvedValue({ count: 0 });
    state.prisma.workingPaperSignoff = {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: signoffCreateMany,
    };

    await new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    ).restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(signoffCreateMany).not.toHaveBeenCalled();
    expect(state.paperCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ preparerId: null, reviewerId: null }),
      })
    );
    expect(state.attachmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          preparerId: null,
          preparedAt: null,
          reviewerId: null,
          reviewedAt: null,
        }),
      })
    );
  });

  it("does not recreate a reviewer signoff when preparer and reviewer are the same", async () => {
    const state = createFlatState();
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    const preparedAt = new Date("2026-08-05T08:30:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      prepareUserId: "same-user",
      preparedAt,
      reviewUserId: "same-user",
      reviewedAt: new Date("2026-08-05T09:30:00.000Z"),
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    const signoffCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    state.prisma.workingPaperSignoff = {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: signoffCreateMany,
    };

    await new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    ).restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(state.paperCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewerId: null, reviewedAt: null }),
      })
    );
    expect(state.attachmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          preparerId: "same-user",
          preparedAt,
          reviewerId: null,
          reviewedAt: null,
        }),
      })
    );
    expect(signoffCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "same-user",
          type: "PREPARER",
          signedAt: preparedAt,
        }),
      ],
    });
  });

  it("does not duplicate signoffs or papers when restore is replayed", async () => {
    const state = createFlatState();
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      prepareUserId: "preparer-1",
      preparedAt: new Date("2026-08-05T08:30:00.000Z"),
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    const itemFindMany = vi
      .fn()
      .mockImplementation(async ({ where }: { where: ItemFindManyWhere }) => {
        await Promise.resolve();
        return state.items.filter(
          (item) =>
            item.id === where.id?.in?.[0] &&
            item.status === where.status &&
            item.withdrawnAt !== null
        );
      });
    const signoffCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    state.prisma.confirmationEmpImportItem.findMany = itemFindMany;
    state.prisma.workingPaperSignoff = {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: signoffCreateMany,
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    const input = {
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    };

    await store.restoreLinkages(input);
    await store.restoreLinkages(input);

    expect(state.paperCreate).toHaveBeenCalledOnce();
    expect(signoffCreateMany).toHaveBeenCalledOnce();
    expect(state.itemUpdate).toHaveBeenCalledOnce();
  });

  it("rolls back restore when the original paper code is occupied", async () => {
    const state = createFlatState();
    state.item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.deletedFromWorkingPaperId = "paper-1";
    state.attachment.deletedFromWorkflowNodeId = "node-1";
    state.attachment.deletedFromWorkingPaperCode = "WP-001";
    state.attachment.deletedFromWorkingPaperTitle = "Confirmation response";
    vi.spyOn(state.prisma.workingPaper, "findMany").mockResolvedValue([
      { code: "WP-001" },
    ]);
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );

    await expect(
      store.restoreLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-2",
        restoredAt: new Date("2026-08-05T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("WP-001"),
      },
    });
    expect(state.paperCreate).not.toHaveBeenCalled();
    expect(state.attachmentUpdate).not.toHaveBeenCalled();
    expect(state.itemUpdate).not.toHaveBeenCalled();
    expect(state.auditCreate).not.toHaveBeenCalled();
    expect(state.item.withdrawnAt).not.toBeNull();
    expect(state.attachment.deletedAt).not.toBeNull();
  });

  it("rebuilds a grouped node with the original batch code and title", async () => {
    const state = createFlatState({ mode: "GROUPED" });
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      empWorkflowNodeId: null,
      job: {
        projectId: "project-1",
        mode: "GROUPED",
        targetWorkflowNodeId: "group-parent",
        batchWorkflowNodeId: null,
        batchCode: "EMP-BATCH-B007",
        batchTitle: "Original grouped batch",
      },
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkflowNodeId: "withdrawn-group",
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "group-restored",
      code: "WP-001",
      title: "Confirmation response",
    });
    const nodeCreate = vi.fn().mockResolvedValue({
      id: "group-restored",
      code: "EMP-BATCH-B007",
      title: "Original grouped batch",
    });
    state.prisma.workflowNode = {
      findUnique: vi.fn().mockResolvedValue({
        id: "group-parent",
        projectId: "project-1",
        level: 2,
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: nodeCreate,
    };

    await new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    ).restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(nodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: "group-parent",
        level: 3,
        code: "EMP-BATCH-B007",
        title: "Original grouped batch",
      }),
    });
    expect(state.attachment.workflowNodeId).toBe("group-restored");
    expect(state.item.empWorkflowNodeId).toBe("group-restored");
  });

  it("restores one grouped source while an active sibling from the same job remains generated", async () => {
    const state = createFlatState({ mode: "GROUPED", itemCount: 2 });
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    const [source, sibling] = state.items;
    Object.assign(source, {
      id: "item-a",
      confirmationId: "confirmation-a",
      withdrawnAt,
      empWorkflowNodeId: "group-node",
      attachmentId: "attachment-a",
      job: {
        projectId: "project-1",
        mode: "GROUPED",
        targetWorkflowNodeId: "group-parent",
        batchWorkflowNodeId: "group-node",
        batchCode: "EMP-BATCH-B007",
        batchTitle: "Original grouped batch",
      },
    });
    Object.assign(sibling, {
      id: "item-b",
      confirmationId: "confirmation-b",
      empWorkflowNodeId: "group-node",
      attachmentId: "attachment-b",
      job: source.job,
    });
    Object.assign(state.attachment, {
      id: "attachment-a",
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkflowNodeId: "group-node",
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    Object.assign(source, { attachment: state.attachment });
    vi.spyOn(
      state.prisma.confirmationEmpImportItem,
      "findMany"
    ).mockImplementation(async ({ where }: { where: ItemFindManyWhere }) => {
      await Promise.resolve();
      return state.items.filter((item) => {
        if (
          where.confirmationId &&
          item.confirmationId !== where.confirmationId
        ) {
          return false;
        }
        if (where.id?.in && !where.id.in.includes(item.id)) {
          return false;
        }
        if (where.withdrawnAt === null && item.withdrawnAt !== null) {
          return false;
        }
        if (where.withdrawnAt?.not === null && item.withdrawnAt === null) {
          return false;
        }
        return true;
      });
    });
    vi.spyOn(state.prisma.attachment, "findMany").mockResolvedValue([
      {
        id: "attachment-b",
        code: "WP-002",
        title: "Sibling response",
        fileName: "sibling.pdf",
        originalName: "sibling.pdf",
        version: 1,
        contentHash: "sha256:sibling",
        workingPaperId: "paper-2",
        workingPaper: { code: "WP-002", title: "Sibling response" },
      },
    ]);
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "group-node",
      code: "WP-001",
      title: "Confirmation response",
    });
    state.prisma.workflowNode = {
      findUnique: vi.fn().mockResolvedValue({
        id: "group-node",
        projectId: "project-1",
        code: "EMP-BATCH-B007",
        title: "Original grouped batch",
      }),
    };

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    const withdrawn = await store.findLinkages({
      projectId: "project-1",
      importJobId: "job-1",
      sourceConfirmationId: "confirmation-a",
      state: "WITHDRAWN",
    });

    expect(withdrawn).toHaveLength(1);
    expect(
      assertPresentValue(withdrawn[0]).snapshot.directoryEntries
    ).toStrictEqual([
      expect.objectContaining({
        id: "attachment-b",
        kind: "GENERATED",
      }),
    ]);

    await store.restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-a"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
      expectedTargets: [
        {
          linkId: "item-a",
          snapshot: assertPresentValue(withdrawn[0]).snapshot,
        },
      ],
    });

    expect(source.withdrawnAt).toBeNull();
    expect(sibling.withdrawnAt).toBeNull();
    expect(state.itemUpdate).toHaveBeenCalledOnce();
  });

  it("blocks grouped restore when a foreign directory entry appears in the transaction", async () => {
    const state = createFlatState({ mode: "GROUPED" });
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      empWorkflowNodeId: "group-node",
      job: {
        projectId: "project-1",
        mode: "GROUPED",
        targetWorkflowNodeId: "group-parent",
        batchWorkflowNodeId: "group-node",
        batchCode: "EMP-BATCH-B007",
        batchTitle: "Original grouped batch",
      },
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkflowNodeId: "group-node",
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    vi.spyOn(state.prisma.attachment, "findMany").mockResolvedValue([
      {
        id: "foreign-attachment",
        code: "FOREIGN-001",
        title: "Foreign entry",
        fileName: "foreign.txt",
        originalName: "foreign.txt",
        version: 1,
        contentHash: "sha256:foreign",
        workingPaperId: "foreign-paper",
        workingPaper: { code: "FOREIGN-001", title: "Foreign paper" },
      },
    ]);
    state.prisma.workflowNode = {
      findUnique: vi.fn().mockResolvedValue({
        id: "group-node",
        projectId: "project-1",
        level: 3,
        code: "EMP-BATCH-B007",
        title: "Original grouped batch",
      }),
    };
    const expected: ConfirmationEmpImportSnapshot = {
      workflowNodeId: "group-node",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      location: "",
      code: "WP-001",
      title: "Confirmation response",
      version: 1,
      hash: "sha256:target",
      versionId: "version-1",
      directoryEntries: [
        {
          id: "attachment-1",
          path: "WP-001",
          kind: "GENERATED",
          version: 1,
          hash: "sha256:target",
        },
      ],
    };

    await expect(
      new PrismaConfirmationEmpImportWithdrawalStore(
        state.prisma as never
      ).restoreLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-2",
        restoredAt: new Date("2026-08-05T11:00:00.000Z"),
        expectedTargets: [{ linkId: "item-1", snapshot: expected }],
      })
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("目录"),
      },
    });
    expect(state.paperCreate).not.toHaveBeenCalled();
    expect(state.attachmentUpdate).not.toHaveBeenCalled();
    expect(state.itemUpdate).not.toHaveBeenCalled();
    expect(state.auditCreate).not.toHaveBeenCalled();
  });

  it("blocks grouped node rebuild when the original batch code is occupied", async () => {
    const state = createFlatState({ mode: "GROUPED" });
    const withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    Object.assign(state.item, {
      withdrawnAt,
      empWorkflowNodeId: null,
      job: {
        projectId: "project-1",
        mode: "GROUPED",
        targetWorkflowNodeId: "group-parent",
        batchWorkflowNodeId: null,
        batchCode: "EMP-BATCH-B007",
        batchTitle: "Original grouped batch",
      },
    });
    Object.assign(state.attachment, {
      workingPaperId: null,
      workflowNodeId: null,
      deletedAt: withdrawnAt,
      deletedFromWorkflowNodeId: "withdrawn-group",
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
    });
    const nodeCreate = vi.fn();
    state.prisma.workflowNode = {
      findUnique: vi.fn().mockResolvedValue({
        id: "group-parent",
        projectId: "project-1",
        level: 2,
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "foreign-group",
          sortOrder: 1,
          code: "EMP-BATCH-B007",
          title: "Other grouped batch",
        },
      ]),
      create: nodeCreate,
    };

    await expect(
      new PrismaConfirmationEmpImportWithdrawalStore(
        state.prisma as never
      ).restoreLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-2",
        restoredAt: new Date("2026-08-05T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("EMP-BATCH-B007"),
      },
    });
    expect(nodeCreate).not.toHaveBeenCalled();
    expect(state.paperCreate).not.toHaveBeenCalled();
    expect(state.attachmentUpdate).not.toHaveBeenCalled();
    expect(state.itemUpdate).not.toHaveBeenCalled();
    expect(state.auditCreate).not.toHaveBeenCalled();
    expect(state.item.withdrawnAt).toBe(withdrawnAt);
  });

  it("locks and re-reads every source in stable order before restoring targets", async () => {
    const state = createFlatState({ itemCount: 2 });
    Object.assign(assertPresentValue(state.items[0]), {
      confirmationId: "confirmation-b",
      outgoingArtifactId: "outgoing-b",
      responseId: "response-b",
      responseArtifactId: "response-artifact-b",
    });
    Object.assign(assertPresentValue(state.items[1]), {
      confirmationId: "confirmation-a",
      outgoingArtifactId: "outgoing-a",
      responseId: "response-a",
      responseArtifactId: "response-artifact-a",
    });
    for (const item of state.items) {
      item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    }
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.deletedFromWorkingPaperId = "paper-1";
    state.attachment.deletedFromWorkflowNodeId = "node-1";
    state.attachment.deletedFromWorkingPaperCode = "WP-001";
    state.attachment.deletedFromWorkingPaperTitle = "Confirmation response";
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    for (const item of state.items) {
      Object.assign(item, { attachment: state.attachment });
    }
    const events: string[] = [];
    vi.spyOn(state.prisma, "$queryRaw").mockImplementation(
      async (query: TestQuery) => {
        await Promise.resolve();
        events.push(`lock:${query.values?.[0]}`);
        return [];
      }
    );
    state.prisma.projectConfirmation = {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }: { where: ConfirmationWhere }) => {
          await Promise.resolve();
          events.push(`read:${where.id}`);
          const suffix = where.id.endsWith("-a") ? "a" : "b";
          return {
            id: where.id,
            projectId: "project-1",
            status: "CLOSED",
            differenceStatus: "MATCHED",
            currentArtifact: {
              id: `outgoing-${suffix}`,
              disposition: "ACTIVE",
            },
            responses: [
              {
                id: `response-${suffix}`,
                routingStatus: "ROUTED",
                receivedAt: new Date("2026-08-05T09:00:00.000Z"),
                artifacts: [
                  {
                    id: `response-artifact-${suffix}`,
                    objectKey: `response-${suffix}.pdf`,
                  },
                ],
              },
            ],
          };
        }),
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    const withdrawn = await store.findLinkages({
      projectId: "project-1",
      importJobId: "job-1",
      state: "WITHDRAWN",
    });

    await store.restoreLinkages({
      importJobId: "job-1",
      linkIds: withdrawn.map((link) => link.id),
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
      expectedTargets: withdrawn.map((link) => ({
        linkId: link.id,
        snapshot: link.snapshot,
      })),
    });

    expect(events).toStrictEqual([
      "lock:confirmation-a",
      "lock:confirmation-b",
      "read:confirmation-a",
      "read:confirmation-b",
    ]);
  });

  it("rejects a source invalidated before restore without mutating targets", async () => {
    const state = createFlatState();
    state.item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    const events: string[] = [];
    vi.spyOn(state.prisma, "$queryRaw").mockImplementation(
      async (query: TestQuery) => {
        await Promise.resolve();
        events.push(`lock:${query.values?.[0]}`);
        return [];
      }
    );
    state.prisma.projectConfirmation = {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }: { where: ConfirmationWhere }) => {
          await Promise.resolve();
          events.push(`read:${where.id}`);
          return {
            id: where.id,
            projectId: "project-1",
            status: "DRAFT",
            differenceStatus: "MATCHED",
            currentArtifact: null,
            responses: [],
          };
        }),
    };
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );

    await expect(
      store.restoreLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-2",
        restoredAt: new Date("2026-08-05T11:00:00.000Z"),
      })
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(events).toStrictEqual([
      "lock:confirmation-1",
      "read:confirmation-1",
    ]);
    expect(state.attachmentUpdate).not.toHaveBeenCalled();
    expect(state.itemUpdate).not.toHaveBeenCalled();
    expect(state.auditCreate).not.toHaveBeenCalled();
  });

  it("rebuilds a withdrawn snapshot from recycle metadata before a guarded restore", async () => {
    const state = createFlatState();
    state.item.workingPaperId = null;
    state.item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.deletedFromWorkingPaperId = "paper-1";
    state.attachment.deletedFromWorkflowNodeId = "node-1";
    state.attachment.deletedFromWorkingPaperCode = "WP-001";
    state.attachment.deletedFromWorkingPaperTitle = "Confirmation response";
    Object.assign(state.item, { attachment: state.attachment });
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    const withdrawn = await store.findLinkages({
      projectId: "project-1",
      importJobId: "job-1",
      state: "WITHDRAWN",
    });

    expect(withdrawn[0]?.snapshot).toMatchObject({
      workflowNodeId: "node-1",
      workingPaperId: "paper-1",
      code: "WP-001",
      title: "Confirmation response",
    });
    await expect(
      store.restoreLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-2",
        restoredAt: new Date("2026-08-05T11:00:00.000Z"),
        expectedTargets: withdrawn.map((link) => ({
          linkId: link.id,
          snapshot: link.snapshot,
        })),
      })
    ).resolves.toBeUndefined();
  });

  it("restores a ZIP shared attachment once while reactivating every item", async () => {
    const state = createFlatState({ mode: "ZIP", itemCount: 2 });
    for (const item of state.items) {
      item.withdrawnAt = new Date("2026-08-05T10:00:00.000Z");
    }
    state.attachment.workingPaperId = null;
    state.attachment.workflowNodeId = null;
    state.attachment.deletedAt = new Date("2026-08-05T10:00:00.000Z");
    state.attachment.deletedFromWorkflowNodeId = "node-1";
    state.paperCreate.mockResolvedValue({
      id: "paper-restored",
      workflowNodeId: "node-1",
      code: "WP-001",
      title: "Confirmation response",
    });

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    await store.restoreLinkages({
      importJobId: "job-1",
      linkIds: ["item-1", "item-2"],
      actorId: "user-2",
      restoredAt: new Date("2026-08-05T11:00:00.000Z"),
    });

    expect(state.paperCreate).toHaveBeenCalledOnce();
    expect(state.attachmentUpdate).toHaveBeenCalledOnce();
    expect(state.itemUpdate).toHaveBeenCalledTimes(2);
    expect(state.items.every((item) => item.withdrawnAt === null)).toBeTruthy();
  });

  it("recycles an empty grouped node only after its generated contents are removed", async () => {
    const state = createFlatState({ mode: "GROUPED" });
    const nodeDelete = vi.fn().mockResolvedValue({ id: "node-1" });
    vi.spyOn(state.prisma.attachment, "findMany").mockResolvedValue([
      { id: "attachment-1" },
    ]);
    vi.spyOn(state.prisma.workingPaper, "findMany").mockResolvedValue([
      { id: "paper-1" },
    ]);
    state.prisma.workflowNode = {
      delete: nodeDelete,
    };

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    await store.withdrawLinkages({
      importJobId: "job-1",
      linkIds: ["item-1"],
      actorId: "user-1",
      withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
      reason: null,
      recycleDirectory: true,
    });

    expect(nodeDelete).toHaveBeenCalledWith({ where: { id: "node-1" } });
  });

  it("rejects grouped recycle before mutation when a foreign attachment is present", async () => {
    const state = createFlatState({ mode: "GROUPED" });
    vi.spyOn(state.prisma.attachment, "findMany").mockResolvedValue([
      { id: "attachment-1" },
      { id: "attachment-foreign" },
    ]);
    vi.spyOn(state.prisma.workingPaper, "findMany").mockResolvedValue([
      { id: "paper-1" },
    ]);

    const store = new PrismaConfirmationEmpImportWithdrawalStore(
      state.prisma as never
    );
    await expect(
      store.withdrawLinkages({
        importJobId: "job-1",
        linkIds: ["item-1"],
        actorId: "user-1",
        withdrawnAt: new Date("2026-08-05T10:00:00.000Z"),
        reason: null,
        recycleDirectory: true,
      })
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("外来项"),
      },
    });
    expect(state.attachmentUpdateMany).not.toHaveBeenCalled();
  });

  it("reads changed target version, hash, name, and recycle state from real attachment fields", async () => {
    const attachmentFindFirst = vi.fn().mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-2",
      workflowNodeId: "node-2",
      code: "WP-002",
      title: "Renamed response",
      version: 2,
      headVersionId: "version-2",
      contentHash: "sha256:changed",
      deletedAt: new Date("2026-08-05T12:00:00.000Z"),
      deletedFromWorkingPaperId: "paper-1",
      deletedFromWorkflowNodeId: "node-1",
      deletedFromWorkingPaperCode: "WP-001",
      deletedFromWorkingPaperTitle: "Confirmation response",
      versions: [
        { id: "version-2", version: 2, contentHash: "sha256:changed" },
      ],
      workingPaper: {
        id: "paper-2",
        workflowNodeId: "node-2",
        code: "WP-002",
        title: "Renamed response",
        signoffs: [],
      },
      workflowNode: {
        id: "node-2",
        code: "EMP-02",
        title: "Moved folder",
        parent: { id: "parent-1", code: "2026", title: "Responses" },
      },
    });
    const store = new PrismaConfirmationEmpImportWithdrawalStore({
      attachment: { findFirst: attachmentFindFirst },
    } as never);

    await expect(
      store.readTarget({
        id: "item-1",
        importJobId: "job-1",
        projectId: "project-1",
        sourceConfirmationId: "confirmation-1",
        mode: "FLAT",
        active: true,
        workflowNodeId: "node-1",
        workingPaperId: "paper-1",
        attachmentId: "attachment-1",
        snapshot: {
          workflowNodeId: "node-1",
          workingPaperId: "paper-1",
          attachmentId: "attachment-1",
          location: "2026 Responses / EMP-01 folder",
          code: "WP-001",
          title: "Confirmation response",
          version: 1,
          hash: "sha256:original",
        },
      })
    ).resolves.toMatchObject({
      workflowNodeId: "node-2",
      workingPaperId: "paper-2",
      code: "WP-002",
      title: "Renamed response",
      version: 2,
      hash: "sha256:changed",
      versionId: "version-2",
      inRecycleBin: true,
    });
  });
});

function createFlatState(
  input: { mode?: "FLAT" | "GROUPED" | "ZIP"; itemCount?: number } = {}
) {
  const mode = input.mode ?? "FLAT";
  const itemCount = input.itemCount ?? 1;
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `item-${index + 1}`,
    jobId: "job-1",
    confirmationId: `confirmation-${index + 1}`,
    outgoingArtifactId: `outgoing-${index + 1}`,
    responseId: `response-${index + 1}`,
    responseArtifactId: `response-artifact-${index + 1}`,
    status: "SUCCEEDED",
    withdrawnAt: null as Date | null,
    withdrawnBy: null as string | null,
    withdrawalReason: null as string | null,
    empWorkflowNodeId: "node-1",
    workingPaperId: "paper-1" as string | null,
    attachmentId: "attachment-1",
    workingPaperCode: "WP-001",
    workingPaperTitle: "Confirmation response",
    targetHeadVersionId: "version-1",
    targetHeadHash: "sha256:target",
    job: { projectId: "project-1", mode },
  }));
  const attachment = {
    id: "attachment-1",
    projectId: "project-1",
    workingPaperId: "paper-1" as string | null,
    workflowNodeId: "node-1" as string | null,
    code: "WP-001",
    title: "Confirmation response",
    version: 1,
    headVersionId: "version-1",
    contentHash: "sha256:target",
    fileUrl: "emp/response.pdf",
    deletedAt: null as Date | null,
    deletedBy: null as string | null,
    deletedFromWorkingPaperId: null as string | null,
    deletedFromWorkflowNodeId: null as string | null,
    deletedFromWorkingPaperCode: null as string | null,
    deletedFromWorkingPaperTitle: null as string | null,
    restoredAt: null as Date | null,
    restoredBy: null as string | null,
  };
  const paper = {
    id: "paper-1",
    projectId: "project-1",
    workflowNodeId: "node-1",
    code: "WP-001",
    title: "Confirmation response",
  };
  const itemFindMany = vi.fn().mockImplementation(async () => {
    await Promise.resolve();
    return items;
  });
  const itemUpdate = vi
    .fn()
    .mockImplementation(async (updateInput: TestUpdateInput) => {
      await Promise.resolve();
      const target = items.find((item) => item.id === updateInput.where.id);
      if (
        target &&
        target.status === updateInput.where.status &&
        (updateInput.where.withdrawnAt === null
          ? target.withdrawnAt === null
          : target.withdrawnAt !== null)
      ) {
        Object.assign(target, updateInput.data);
        return { count: 1 };
      }
      return { count: 0 };
    });
  const attachmentUpdate = vi
    .fn()
    .mockImplementation(async (updateInput: TestUpdateInput) => {
      await Promise.resolve();
      Object.assign(attachment, updateInput.data);
      return attachment;
    });
  const attachmentUpdateMany = vi
    .fn()
    .mockImplementation(async (updateInput: TestUpdateInput) => {
      await Promise.resolve();
      if (
        attachment.id !== updateInput.where.id ||
        attachment.deletedAt !== null
      ) {
        return { count: 0 };
      }
      Object.assign(attachment, updateInput.data);
      return { count: 1 };
    });
  const paperDelete = vi.fn().mockResolvedValue(paper);
  const paperCreate = vi.fn();
  const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
  const projectConfirmationFindFirst = vi
    .fn()
    .mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        await Promise.resolve();
        const item =
          items.find((candidate) => candidate.confirmationId === where.id) ??
          assertPresentValue(items[0]);
        return {
          id: item.confirmationId,
          projectId: "project-1",
          status: "CLOSED",
          differenceStatus: "MATCHED",
          currentArtifact: {
            id: item.outgoingArtifactId,
            disposition: "ACTIVE",
          },
          responses: [
            {
              id: item.responseId,
              routingStatus: "ROUTED",
              receivedAt: new Date("2026-08-05T09:00:00.000Z"),
              artifacts: [
                {
                  id: item.responseArtifactId,
                  objectKey: `${item.responseArtifactId}.pdf`,
                },
              ],
            },
          ],
        };
      }
    );
  const prisma: TestPrisma = {
    $transaction: vi.fn(
      async (callback: (client: TestPrisma) => Promise<unknown>) => {
        await Promise.resolve();
        return callback(prisma);
      }
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    confirmationEmpImportItem: {
      findMany: itemFindMany,
      updateMany: itemUpdate,
    },
    attachment: {
      findUnique: vi.fn().mockResolvedValue(attachment),
      findMany: vi.fn().mockResolvedValue([]),
      update: attachmentUpdate,
      updateMany: attachmentUpdateMany,
      count: vi.fn().mockResolvedValue(0),
    },
    workingPaper: {
      findUnique: vi.fn().mockResolvedValue(paper),
      findMany: vi.fn().mockResolvedValue([]),
      create: paperCreate,
      delete: paperDelete,
      count: vi.fn().mockResolvedValue(0),
    },
    projectConfirmation: {
      findFirst: projectConfirmationFindFirst,
    },
    workingPaperSignoff: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    workflowNode: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: auditCreate },
    confirmationFollowUpEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    prisma,
    items,
    item: assertPresentValue(items[0]),
    attachment,
    attachmentUpdate,
    attachmentUpdateMany,
    itemUpdate,
    paperDelete,
    paperCreate,
    auditCreate,
  };
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
