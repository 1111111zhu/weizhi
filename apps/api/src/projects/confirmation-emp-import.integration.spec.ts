import { createHash, randomUUID } from "node:crypto";

import "dotenv/config";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import JSZip from "jszip";

import { AuditLogsService } from "../audit-logs/audit-logs.service";
import type { RequestUser } from "../auth/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ConfirmationEmpImportArchiveService } from "./confirmation-emp-import-archive.service";
import { ConfirmationEmpImportWithdrawalService } from "./confirmation-emp-import-withdrawal.service";
import type { ConfirmationEmpImportRestoreScope } from "./confirmation-emp-import-withdrawal.service";
import { PrismaConfirmationEmpImportWithdrawalStore } from "./confirmation-emp-import-withdrawal.store";
import { ConfirmationEmpImportService } from "./confirmation-emp-import.service";
import { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";
import { ProjectAccessService } from "./project-access.service";

vi.setConfig({ testTimeout: 120_000 });

const runRealIntegration = /^(1|true|yes)$/i.test(
  process.env.RUN_CONFIRMATION_EMP_IMPORT_INTEGRATION ?? ""
);
const describeRealIntegration = runRealIntegration ? describe : describe.skip;

describeRealIntegration(
  "ConfirmationEmpImportService real PostgreSQL integration",
  () => {
    let archiveService: ConfirmationEmpImportArchiveService;
    let fixture: Fixture;
    let prisma: PrismaService;
    let service: ConfirmationEmpImportService;
    let storage: StorageService;
    let uploadRoot: string;

    beforeAll(async () => {
      uploadRoot = await mkdtemp(
        pathModule.join(tmpdir(), "project-wing-confirmation-emp-integration-")
      );
      process.env.STORAGE_DRIVER = "local";
      process.env.UPLOAD_DIR = uploadRoot;

      prisma = new PrismaService();
      await prisma.$connect();
      storage = new StorageService();
      archiveService = new ConfirmationEmpImportArchiveService(storage);
      service = new ConfirmationEmpImportService(
        prisma,
        new ProjectAccessService(prisma),
        storage,
        new AuditLogsService(prisma),
        archiveService
      );
      fixture = await createFixture(prisma, storage);
    });

    afterAll(async () => {
      try {
        if (fixture) {
          await cleanupFixture(prisma, fixture);
        }
      } finally {
        await prisma?.$disconnect();
        if (uploadRoot) {
          await rm(uploadRoot, { force: true, recursive: true });
        }
        delete process.env.STORAGE_DRIVER;
        delete process.env.UPLOAD_DIR;
      }
    });

    it.each(["ZIP", "FLAT", "GROUPED"] as const)(
      "round trips %s single and batch withdrawal with real files and timeline",
      async (mode) => {
        const confirmationId = await createSupplementalConfirmation(
          prisma,
          storage,
          fixture.projectId,
          `${fixture.suffix}-cycle-${mode}`,
          {
            label: `cycle-${mode}`,
            confirmationCode: `CYCLE-${mode}`,
            counterpartyName: "Cycle Bank",
            createdBy: fixture.preparer,
            reviewer: fixture.reviewer,
            outgoing: {
              fileName: "outgoing.pdf",
              mimeType: "application/pdf",
              body: Buffer.from("outgoing"),
            },
            responses: [1, 2, 3].map((n) => ({
              fileName: `response-${n}.pdf`,
              mimeType: "application/pdf",
              body: Buffer.from(`response body ${n}`),
            })),
          }
        );
        const withdrawal = new ConfirmationEmpImportWithdrawalService(
          new PrismaConfirmationEmpImportWithdrawalStore(prisma, storage),
          new ProjectAccessService(prisma),
          new AuditLogsService(prisma)
        );
        const active = () =>
          prisma.confirmationEmpImportItem.findMany({
            where: { confirmationId, status: "SUCCEEDED", withdrawnAt: null },
          });
        const verifyFiles = async (expected: number) => {
          const items = await active();
          expect(items).toHaveLength(expected);
          for (const item of items) {
            const attachment = await prisma.attachment.findUniqueOrThrow({
              where: { id: item.attachmentId! },
            });
            expect(attachment.deletedAt).toBeNull();
            const body = await storage.getObjectBuffer(attachment.fileUrl);
            if (mode === "ZIP") {
              const zip = await JSZip.loadAsync(body);
              const entries = await Promise.all(
                Object.values(zip.files)
                  .filter((f) => !f.dir && f.name.endsWith(".pdf"))
                  .map((f) => f.async("nodebuffer"))
              );
              expect(entries).toHaveLength(expected);
              expect(entries.map(sha256)).toContain(item.sourceSha256);
            } else expect(sha256(body)).toBe(item.sourceSha256);
          }
        };
        for (let cycle = 0; cycle < 2; cycle++) {
          const preview = await service.preview(
            fixture.projectId,
            fixture.preparer,
            {
              confirmationIds: [confirmationId],
              targetWorkflowNodeId: fixture.accountNodeId,
              mode,
            }
          );
          expect(preview.issues).toEqual([]);
          const created = await service.createJob(
            fixture.projectId,
            fixture.preparer,
            {
              confirmationIds: [confirmationId],
              targetWorkflowNodeId: fixture.accountNodeId,
              mode,
              batchCode: `CYCLE-${mode}-${cycle}`,
              batchTitle: `Cycle archive ${mode}`,
              previewFingerprint: preview.fingerprint,
              idempotencyKey: randomUUID(),
            }
          );
          expect((await waitForTerminalJob(prisma, created.id)).status).toBe(
            "COMPLETED"
          );
          await verifyFiles(3);
          const items = await active();
          const checkPreview = () =>
            service.preview(fixture.projectId, fixture.preparer, {
              confirmationIds: [confirmationId],
              targetWorkflowNodeId: fixture.accountNodeId,
              mode,
            });
          const targetId = items[0]!.attachmentId!;
          await prisma.attachment.update({
            where: { id: targetId },
            data: { deletedAt: new Date() },
          });
          const deletedPreview = await checkPreview();
          expect(
            deletedPreview.sources.some(
              (item) => item.activeLinkKey === items[0]!.activeLinkKey
            )
          ).toBe(true);
          await prisma.attachment.update({
            where: { id: targetId },
            data: { deletedAt: null },
          });
          expect(
            (await checkPreview()).skipped.every(
              (item) => item.targetState === "AVAILABLE"
            )
          ).toBe(true);
          const withdrawOne = (id: string) =>
            withdrawal.withdraw(
              fixture.projectId,
              created.id,
              undefined,
              fixture.preparer as RequestUser,
              { ipAddress: "127.0.0.1", userAgent: "roundtrip-integration" },
              undefined,
              false,
              id
            );
          await withdrawOne(items[0]!.id);
          await verifyFiles(2);
          if (mode === "GROUPED") {
            expect(await prisma.workflowNode.findUnique({ where: { id: items[0]!.empWorkflowNodeId! } })).not.toBeNull();
          }
          for (const item of items.slice(1)) await withdrawOne(item.id);
          await verifyFiles(0);
          if (mode === "GROUPED") {
            expect(await prisma.workflowNode.findUnique({ where: { id: items[0]!.empWorkflowNodeId! } })).toBeNull();
          }
          const withdrawnTargets = await prisma.attachment.findMany({
            where: { id: { in: items.map((item) => item.attachmentId!) } },
          });
          expect(
            withdrawnTargets.every(
              (attachment) => attachment.deletedAt !== null
            )
          ).toBe(true);
          for (const item of items)
            expect(
              sha256(await storage.getObjectBuffer(item.sourceObjectKey))
            ).toBe(item.sourceSha256);
          const events = await prisma.confirmationFollowUpEvent.findMany({
            where: { confirmationId },
            orderBy: { occurredAt: "asc" },
          });
          const archives = events.filter(
            (e) =>
              e.eventType === "PROGRAM_COMPLETED" &&
              (e.payload as { operation?: string })?.operation ===
                "RESPONSE_ARCHIVED_TO_EMP"
          );
          expect(archives).toHaveLength((cycle + 1) * 3);
          expect(
            events.filter((e) => e.eventType === "IMPORT_WITHDRAWN")
          ).toHaveLength(mode === "GROUPED" ? cycle * 9 + 3 : (cycle + 1) * 3);
          expect(events.at(-1)?.eventType).toBe("IMPORT_WITHDRAWN");
          const confirmation =
            await prisma.projectConfirmation.findUniqueOrThrow({
              where: { id: confirmationId },
            });
          expect(confirmation.differenceStatus).toBe("MATCHED");
          if (mode === "GROUPED") {
            await withdrawal.restore(
              fixture.projectId, created.id, { scope: "SOURCE_CONFIRMATION", sourceConfirmationId: confirmationId },
              fixture.preparer as RequestUser,
              { ipAddress: "127.0.0.1", userAgent: "grouped-restore-integration" }
            );
            await verifyFiles(3);
            const restored = await active();
            const restoredNodeId = restored[0]!.empWorkflowNodeId!;
            expect(restoredNodeId).not.toBe(items[0]!.empWorkflowNodeId);
            const child = await prisma.workflowNode.create({ data: {
              projectId: fixture.projectId, parentId: restoredNodeId,
              code: "MANUAL", title: "User child directory", level: 4,
              nodeType: "WORKING_PAPER", sortOrder: 1, createdBy: fixture.preparer.id,
            } });
            for (const item of restored) await withdrawOne(item.id);
            expect(await prisma.workflowNode.findUnique({ where: { id: restoredNodeId } })).not.toBeNull();
            expect(await prisma.workflowNode.findUnique({ where: { id: child.id } })).not.toBeNull();
            await prisma.workflowNode.delete({ where: { id: child.id } });
            await withdrawal.restore(
              fixture.projectId, created.id, { scope: "SOURCE_CONFIRMATION", sourceConfirmationId: confirmationId },
              fixture.preparer as RequestUser, { ipAddress: "127.0.0.1" }
            );
            await verifyFiles(3);
            for (const item of await active()) await withdrawOne(item.id);
            expect(await prisma.workflowNode.findUnique({ where: { id: restoredNodeId } })).toBeNull();
          }
        }
      }
    );

    it("imports a routed response and excludes the uploaded outgoing source", async () => {
      const preview = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
        }
      );

      expect(preview.issues).toStrictEqual([]);
      expect(preview.sources).toHaveLength(1);
      expect(preview.sources.map((source) => source.sourceKind)).toStrictEqual([
        "RESPONSE_ARTIFACT",
      ]);
      expect(preview.sources[0]?.mimeType).toBe("application/pdf");
      expect(preview.sources[0]?.originalFileName).toBe("bank-response.pdf");

      const created = await service.createJob(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
          previewFingerprint: preview.fingerprint,
          idempotencyKey: `emp-integration-${fixture.suffix}`,
        }
      );
      fixture.flatJobId = created.id;
      fixture.flatIdempotencyKey = `emp-integration-${fixture.suffix}`;
      const completed = await waitForTerminalJob(prisma, created.id);

      expect(completed.status).toBe("COMPLETED");
      expect(completed.items).toHaveLength(1);
      expect(
        completed.items.every((item) => item.status === "SUCCEEDED")
      ).toBeTruthy();

      const papers = await prisma.workingPaper.findMany({
        where: {
          projectId: fixture.projectId,
          workflowNodeId: fixture.accountNodeId,
        },
        include: { attachments: true },
        orderBy: { code: "asc" },
      });
      expect(papers).toHaveLength(1);
      expect(
        papers.every((paper) => paper.paperType === "WORKING_PAPER")
      ).toBeTruthy();
      expect(papers.every((paper) => paper.preparerId === null)).toBeTruthy();
      expect(
        papers.every((paper) => paper.reviewerId === fixture.reviewer.id)
      ).toBeTruthy();
      expect(papers.flatMap((paper) => paper.attachments)).toHaveLength(1);
      expect(
        papers.every((paper) => paper.attachments[0]?.code === paper.code)
      ).toBeTruthy();
      expect(
        papers.every((paper) => paper.attachments[0]?.title === paper.title)
      ).toBeTruthy();
      expect(
        papers.every((paper) => paper.attachments[0]?.fileName !== paper.code)
      ).toBeTruthy();
      const attachmentByFileName = papers
        .flatMap((paper) => paper.attachments)
        .find((attachment) => attachment.fileName.endsWith(".pdf"));
      expect(attachmentByFileName).toMatchObject({
        mimeType: "application/pdf",
        originalName: expect.stringContaining("Acme_Bank-Response-01"),
      });
    });

    it("blocks a missing source, detects same-size replacement bytes, and retries after repair", async () => {
      const integrityConfirmationId = await createSupplementalConfirmation(
        prisma,
        storage,
        fixture.projectId,
        `${fixture.suffix}-integrity`,
        {
          label: "integrity",
          confirmationCode: "CONF-INTEGRITY",
          counterpartyName: "Integrity Bank",
          createdBy: fixture.preparer,
          reviewer: fixture.reviewer,
          outgoing: {
            fileName: "integrity-outgoing.bin",
            mimeType: "application/octet-stream",
            body: Buffer.from("integrity outgoing"),
          },
          responses: [
            {
              fileName: "integrity-response-1.pdf",
              mimeType: "application/pdf",
              body: Buffer.from("integrity response one"),
            },
            {
              fileName: "integrity-response-2.bin",
              mimeType: "application/octet-stream",
              body: Buffer.from("integrity response two"),
            },
          ],
        }
      );
      const confirmation = await prisma.projectConfirmation.findUnique({
        where: { id: integrityConfirmationId },
        include: {
          responses: {
            include: { artifacts: { orderBy: { sequence: "asc" } } },
          },
        },
      });
      const responseArtifact = confirmation?.responses[0]?.artifacts[0];
      expect(responseArtifact).toBeDefined();
      const sourceObjectKey = assertPresentValue(responseArtifact).objectKey;
      const originalBody = await storage.getObjectBuffer(sourceObjectKey);

      await storage.deleteObject(sourceObjectKey);
      const originalGetObjectMetadata = storage.getObjectMetadata.bind(storage);
      const metadataSpy = vi
        .spyOn(storage, "getObjectMetadata")
        .mockImplementation(async (objectKey: string) => {
          await Promise.resolve();
          return objectKey === sourceObjectKey
            ? (undefined as never)
            : originalGetObjectMetadata(objectKey);
        });
      const blocked = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [integrityConfirmationId],
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "FLAT",
        }
      );
      expect(blocked.issues).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SOURCE_OBJECT_UNAVAILABLE",
            sourceKey: expect.stringContaining(
              assertPresentValue(responseArtifact).id
            ),
          }),
        ])
      );
      expect(
        blocked.issues.some((issue) => issue.message.includes(sourceObjectKey))
      ).toBeFalsy();
      await expect(
        service.createJob(fixture.projectId, fixture.preparer, {
          confirmationIds: [integrityConfirmationId],
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "FLAT",
          previewFingerprint: blocked.fingerprint,
          idempotencyKey: `missing-before-repair-${fixture.suffix}`,
        })
      ).rejects.toMatchObject({
        response: {
          message: "The confirmation preview contains blocking issues.",
        },
      });
      metadataSpy.mockRestore();

      await storage.putCacheObject(
        sourceObjectKey,
        originalBody,
        assertPresentValue(responseArtifact).mimeType
      );
      const validPreview = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [integrityConfirmationId],
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "FLAT",
        }
      );
      expect(validPreview.issues).toStrictEqual([]);

      const executeSpy = vi
        .spyOn(service, "executeJob")
        .mockResolvedValue(null);
      const created = await service.createJob(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [integrityConfirmationId],
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "FLAT",
          previewFingerprint: validPreview.fingerprint,
          idempotencyKey: `same-size-replacement-${fixture.suffix}`,
        }
      );
      executeSpy.mockRestore();

      const replacementBody = Buffer.from(originalBody);
      replacementBody[0] = replacementBody[0] === 0 ? 1 : 0;
      expect(replacementBody).toHaveLength(originalBody.length);
      await storage.putCacheObject(
        sourceObjectKey,
        replacementBody,
        assertPresentValue(responseArtifact).mimeType
      );

      const partial = await service.executeJob(
        created.id,
        fixture.projectId,
        fixture.preparer.id
      );
      expect(partial?.status).toBe("PARTIAL_FAILURE");
      const partialJob = await prisma.confirmationEmpImportJob.findUnique({
        where: { id: created.id },
        include: { items: true },
      });
      expect(
        partialJob?.items.filter((item) => item.status === "FAILED")
      ).toHaveLength(1);
      const failedItem = partialJob?.items.find(
        (item) => item.status === "FAILED"
      );
      expect(failedItem?.errorCode).toBe("FINGERPRINT_CHANGED");
      expect(failedItem?.errorMessage).not.toContain(sourceObjectKey);
      expect(
        partialJob?.items.filter((item) => item.status === "SUCCEEDED")
      ).toHaveLength(1);

      await storage.putCacheObject(
        sourceObjectKey,
        originalBody,
        assertPresentValue(responseArtifact).mimeType
      );
      await service.retryJob(fixture.projectId, fixture.preparer, created.id);
      const completed = await waitForTerminalJob(prisma, created.id);
      expect(completed.status).toBe("COMPLETED");
      expect(
        completed.items.every((item) => item.status === "SUCCEEDED")
      ).toBeTruthy();
    });

    it("keeps the default eligible preview deterministic and ignores non-eligible statuses", async () => {
      const first = await service.preview(fixture.projectId, fixture.preparer, {
        targetWorkflowNodeId: fixture.accountNodeId,
        mode: "FLAT",
      });
      const second = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
        }
      );

      expect(first.issues).toStrictEqual([]);
      expect(second.issues).toStrictEqual([]);
      expect(first.fingerprint).toBe(second.fingerprint);
      expect(first.sources.map((source) => source.activeLinkKey)).toStrictEqual(
        second.sources.map((source) => source.activeLinkKey)
      );
      expect(
        first.sources
          .map((source) => source.confirmationCode ?? "")
          .every(
            (code, index, codes) =>
              index === 0 || assertPresentValue(codes[index - 1]) <= code
          )
      ).toBeTruthy();
      for (const confirmationId of new Set(
        first.sources.map((source) => source.confirmationId)
      )) {
        const sources = first.sources.filter(
          (source) => source.confirmationId === confirmationId
        );
        expect(
          sources.every((source) => source.sourceKind === "RESPONSE_ARTIFACT")
        ).toBeTruthy();
      }
      expect(
        first.sources.some((source) =>
          fixture.ineligibleConfirmationIds.includes(source.confirmationId)
        )
      ).toBeFalsy();
      expect(
        first.skipped.some((item) =>
          fixture.ineligibleConfirmationIds.includes(item.confirmationId)
        )
      ).toBeFalsy();
    });

    it("returns shared-contract progress and exposes idempotent skip metadata", async () => {
      expect(fixture.flatJobId).toBeDefined();
      expect(fixture.flatIdempotencyKey).toBeDefined();

      const preview = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
        }
      );
      expect(preview.sources).toStrictEqual([]);
      expect(preview.skipped).toHaveLength(1);
      expect(
        preview.skipped.every(
          (item) =>
            item.existingWorkingPaperCode &&
            item.existingWorkingPaperTitle &&
            item.existingWorkflowLocation &&
            item.existingWorkflowLocation.code === fixture.accountNodeCode
        )
      ).toBeTruthy();

      const idempotent = (await service.createJob(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
          previewFingerprint: preview.fingerprint,
          idempotencyKey: assertPresentValue(fixture.flatIdempotencyKey),
        }
      )) as unknown as {
        id: string;
        items: {
          status: string;
          empWorkflowNode?: { id: string } | null;
        }[];
        targetWorkflowNode?: { id: string } | null;
      };
      expect(idempotent.id).toBe(fixture.flatJobId);
      expect(idempotent.items).toHaveLength(1);
      expect(
        idempotent.items.every((item) => item.status === "SUCCEEDED")
      ).toBeTruthy();
      expect(
        idempotent.items.every(
          (item) => item.empWorkflowNode?.id === fixture.accountNodeId
        )
      ).toBeTruthy();
      expect(idempotent.targetWorkflowNode?.id).toBe(fixture.accountNodeId);
      await expect(
        prisma.confirmationEmpImportJob.count({
          where: {
            idempotencyKey: assertPresentValue(fixture.flatIdempotencyKey),
          },
        })
      ).resolves.toBe(1);

      const listed = await service.listJobs(
        fixture.projectId,
        fixture.preparer
      );
      const listedJob = listed.find((job) => job.id === fixture.flatJobId);
      expect(listedJob).toMatchObject({
        id: fixture.flatJobId,
        status: "COMPLETED",
        total: 1,
        completed: 1,
        failed: 0,
        retryable: false,
      });
      expect(
        listedJob?.items.every(
          (item) =>
            item.status === "COMPLETED" &&
            item.targetCode &&
            item.targetLocation
        )
      ).toBeTruthy();

      const progress = await service.getJobProgress(
        fixture.projectId,
        fixture.preparer,
        assertPresentValue(fixture.flatJobId)
      );
      expect(progress).toMatchObject({
        id: fixture.flatJobId,
        status: "COMPLETED",
        total: 1,
        completed: 1,
        failed: 0,
      });
    });

    it("imports GROUPED physical files into one flat child directory with no same-actor reviewer", async () => {
      const preview = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.groupedConfirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "GROUPED",
        }
      );
      expect(preview.issues).toStrictEqual([]);
      expect(preview.sources).toHaveLength(2);
      expect(
        preview.sources.every((source) => source.prepareUserId === null)
      ).toBeTruthy();
      expect(
        preview.sources.every((source) => source.reviewUserId === null)
      ).toBeTruthy();

      const batchCode = `GROUP-${fixture.suffix}`;
      const batchTitle = "Grouped confirmation files";
      const created = await service.createJob(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.groupedConfirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "GROUPED",
          batchCode,
          batchTitle,
          previewFingerprint: preview.fingerprint,
          idempotencyKey: `emp-grouped-${fixture.suffix}`,
        }
      );
      const completed = await waitForTerminalJob(prisma, created.id);
      expect(completed.status).toBe("COMPLETED");
      expect(completed.items).toHaveLength(2);
      expect(
        completed.items.every((item) => item.status === "SUCCEEDED")
      ).toBeTruthy();

      const job = await prisma.confirmationEmpImportJob.findUnique({
        where: { id: created.id },
        include: { items: true, batchWorkflowNode: true },
      });
      expect(job?.batchWorkflowNode).toMatchObject({
        parentId: fixture.accountNodeId,
        level: 3,
        code: batchCode,
        title: batchTitle,
      });
      const papers = await prisma.workingPaper.findMany({
        where: {
          projectId: fixture.projectId,
          workflowNodeId: job?.batchWorkflowNodeId ?? "",
        },
        include: { attachments: true, signoffs: true },
        orderBy: { code: "asc" },
      });
      expect(papers).toHaveLength(2);
      expect(new Set(papers.map((paper) => paper.id)).size).toBe(2);
      expect(papers.every((paper) => paper.preparerId === null)).toBeTruthy();
      expect(papers.every((paper) => paper.reviewerId === null)).toBeTruthy();
      expect(papers.every((paper) => paper.title !== paper.code)).toBeTruthy();
      expect(papers.flatMap((paper) => paper.attachments)).toHaveLength(2);
      expect(
        papers.every(
          (paper) =>
            paper.attachments.length === 1 &&
            paper.attachments[0]?.code === paper.code &&
            paper.attachments[0]?.title === paper.title &&
            paper.attachments[0]?.fileName !== paper.code
        )
      ).toBeTruthy();
      expect(
        papers
          .flatMap((paper) => paper.signoffs)
          .every((signoff) => signoff.type === "REVIEWER")
      ).toBeTruthy();
      expect(papers.flatMap((paper) => paper.signoffs)).toHaveLength(0);
    });

    it("creates one deterministic unsigned ZIP package for the whole selection", async () => {
      const preview = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: fixture.zipConfirmationIds,
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "ZIP",
        }
      );
      const repeated = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: fixture.zipConfirmationIds,
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "ZIP",
        }
      );
      expect(preview.issues).toStrictEqual([]);
      expect(preview.sources).toHaveLength(2);
      expect(preview.fingerprint).toBe(repeated.fingerprint);
      expect(
        preview.sources.map((source) => source.zipEntryName)
      ).toStrictEqual(repeated.sources.map((source) => source.zipEntryName));
      expect(preview.sources[0]?.packageSequence).toBe(1);
      expect(preview.sources[1]?.packageSequence).toBe(2);

      const created = await service.createJob(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: fixture.zipConfirmationIds,
          targetWorkflowNodeId: fixture.leafNodeId,
          mode: "ZIP",
          batchCode: `ZIP-${fixture.suffix}`,
          batchTitle: "ZIP confirmation package",
          previewFingerprint: preview.fingerprint,
          idempotencyKey: `emp-zip-${fixture.suffix}`,
        }
      );
      const completed = await waitForTerminalJob(prisma, created.id);
      expect(completed.status).toBe("COMPLETED");
      expect(completed.items).toHaveLength(2);

      const items = await prisma.confirmationEmpImportItem.findMany({
        where: { jobId: created.id },
        orderBy: { packageSequence: "asc" },
      });
      const paperIds = new Set(items.map((item) => item.workingPaperId));
      const attachmentIds = new Set(items.map((item) => item.attachmentId));
      expect(paperIds.size).toBe(1);
      expect(attachmentIds.size).toBe(1);
      const paper = await prisma.workingPaper.findUnique({
        where: { id: assertPresentValue([...paperIds][0]) },
        include: { signoffs: true },
      });
      const attachment = await prisma.attachment.findUnique({
        where: { id: assertPresentValue([...attachmentIds][0]) },
      });
      expect(paper).toMatchObject({
        preparerId: null,
        reviewerId: null,
        title: "ZIP confirmation package",
      });
      expect(paper?.signoffs).toStrictEqual([]);
      expect(attachment).toMatchObject({
        mimeType: "application/zip",
        originalName: "ZIP confirmation package",
      });
      expect(attachment?.fileName).toMatch(/\.zip$/);
      const archiveBuffer = await storage.getObjectBuffer(
        assertPresentValue(attachment).fileUrl
      );
      const zip = await JSZip.loadAsync(archiveBuffer);
      const names = Object.keys(zip.files).sort();
      expect(names).toHaveLength(2);
      expect(names).not.toContain("confirmation-file-manifest.csv");

      const repeatedArchive = await archiveService.createArchive(
        items.map((item, index) => ({
          internalSequence: item.packageSequence ?? index + 1,
          sourceConfirmationCode: item.sourceConfirmationCode ?? "",
          counterparty: item.sourceCounterpartyName ?? "Counterparty",
          role:
            item.sourceKind === "OUTGOING_ARTIFACT"
              ? "OUTGOING"
              : "RESPONSE_ORIGINAL",
          responseSequence:
            item.sourceKind === "RESPONSE_ARTIFACT"
              ? Number(item.zipEntryName?.match(/Response-(\d+)-/i)?.[1] ?? 1)
              : undefined,
          originalName: item.sourceFileName,
          zipEntryName: item.zipEntryName ?? undefined,
          size: item.sourceSize,
          checksum: item.sourceSha256,
          objectKey: item.sourceObjectKey,
        }))
      );
      expect(repeatedArchive.manifestCsv).toContain("checksum");
      for (const item of items) {
        expect(repeatedArchive.manifestCsv).toContain(item.sourceSha256);
      }
      expect(repeatedArchive.sha256).toBe(attachment?.contentHash);
    });

    it("guards active links and supports real source-level withdraw then restore", async () => {
      expect(fixture.flatJobId).toBeDefined();
      const access = new ProjectAccessService(prisma);
      const auditLogs = new AuditLogsService(prisma);
      const withdrawal = new ConfirmationEmpImportWithdrawalService(
        new PrismaConfirmationEmpImportWithdrawalStore(prisma),
        access,
        auditLogs
      );
      const guard = new ConfirmationImportLinkGuardService(prisma);
      const auditSource = { ipAddress: "127.0.0.1", userAgent: "integration" };

      await expect(
        guard.assertCanInvalidateSource(
          { confirmationId: fixture.confirmationId },
          "VOID_CONFIRMATION"
        )
      ).rejects.toMatchObject({
        response: {
          code: "CONFIRMATION_STATE_CONFLICT",
          message: expect.stringContaining("先从 EMP 撤回"),
        },
      });

      const withdrawn = await withdrawal.withdraw(
        fixture.projectId,
        assertPresentValue(fixture.flatJobId),
        fixture.confirmationId,
        fixture.preparer as RequestUser,
        auditSource,
        "integration withdrawal"
      );
      expect(withdrawn.linkIds).toHaveLength(1);
      const withdrawnItems = await prisma.confirmationEmpImportItem.findMany({
        where: { id: { in: withdrawn.linkIds } },
        select: { workingPaperId: true },
      });
      const withdrawnPaperIds = withdrawnItems
        .map((item) => item.workingPaperId)
        .filter((id): id is string => Boolean(id));
      await expect(
        prisma.workingPaper.count({
          where: { id: { in: withdrawnPaperIds } },
        })
      ).resolves.toBe(0);
      await expect(
        prisma.workingPaperSignoff.count({
          where: { workingPaperId: { in: withdrawnPaperIds } },
        })
      ).resolves.toBe(0);
      const afterWithdraw = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
        }
      );
      expect(afterWithdraw.sources).toHaveLength(1);
      expect(afterWithdraw.skipped).toStrictEqual([]);

      const restoreScope: ConfirmationEmpImportRestoreScope = {
        scope: "SOURCE_CONFIRMATION",
        sourceConfirmationId: fixture.confirmationId,
      };
      const restored = await withdrawal.restore(
        fixture.projectId,
        assertPresentValue(fixture.flatJobId),
        restoreScope,
        fixture.preparer as RequestUser,
        auditSource
      );
      expect(restored.linkIds).toHaveLength(1);
      const restoredItems = await prisma.confirmationEmpImportItem.findMany({
        where: { id: { in: restored.linkIds } },
        include: {
          workingPaper: { include: { signoffs: true } },
          attachment: true,
        },
        orderBy: { id: "asc" },
      });
      expect(restoredItems).toHaveLength(1);
      for (const item of restoredItems) {
        expect(item.workingPaper).toMatchObject({
          id: item.workingPaperId,
          code: item.workingPaperCode,
          title: item.workingPaperTitle,
          preparerId: null,
          reviewerId: fixture.reviewer.id,
          preparedAt: null,
          reviewedAt: expect.any(Date),
        });
        expect(item.attachment).toMatchObject({
          workingPaperId: item.workingPaperId,
          code: item.workingPaperCode,
          title: item.workingPaperTitle,
          preparerId: null,
          reviewerId: fixture.reviewer.id,
          preparedAt: null,
          reviewedAt: expect.any(Date),
        });
        expect(item.workingPaper?.signoffs).toHaveLength(1);
        expect(item.workingPaper?.signoffs[0]).toMatchObject({
          userId: fixture.reviewer.id,
          type: "REVIEWER",
          signedAt: expect.any(Date),
        });
      }
      const afterRestore = await service.preview(
        fixture.projectId,
        fixture.preparer,
        {
          confirmationIds: [fixture.confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode: "FLAT",
        }
      );
      expect(afterRestore.sources).toStrictEqual([]);
      expect(afterRestore.skipped).toHaveLength(1);
      expect(
        afterRestore.skipped.every(
          (item) =>
            item.existingWorkingPaperCode &&
            item.existingWorkingPaperTitle &&
            item.existingWorkflowLocation
        )
      ).toBeTruthy();
      await expect(
        guard.assertCanInvalidateSource(
          { confirmationId: fixture.confirmationId },
          "UNDO_REVIEW"
        )
      ).rejects.toMatchObject({
        response: { code: "CONFIRMATION_STATE_CONFLICT" },
      });
    });

    it("blocks grouped withdrawal after generated target changes or a foreign directory entry appears", async () => {
      const groupedJob = await prisma.confirmationEmpImportJob.findFirst({
        where: { idempotencyKey: `emp-grouped-${fixture.suffix}` },
        include: { items: true },
      });
      expect(groupedJob).toBeTruthy();
      const groupedAttachment = await prisma.attachment.findFirst({
        where: {
          projectId: fixture.projectId,
          workflowNodeId: groupedJob?.batchWorkflowNodeId ?? "",
        },
      });
      expect(groupedAttachment).toBeTruthy();
      const withdrawal = new ConfirmationEmpImportWithdrawalService(
        new PrismaConfirmationEmpImportWithdrawalStore(prisma),
        new ProjectAccessService(prisma),
        new AuditLogsService(prisma)
      );
      const auditSource = { ipAddress: "127.0.0.1", userAgent: "integration" };
      await prisma.attachment.update({
        where: { id: assertPresentValue(groupedAttachment).id },
        data: { title: "foreign-modified-title" },
      });
      await expect(
        withdrawal.withdraw(
          fixture.projectId,
          assertPresentValue(groupedJob).id,
          undefined,
          fixture.preparer as RequestUser,
          auditSource
        )
      ).rejects.toMatchObject({
        response: { code: "CONFIRMATION_STATE_CONFLICT" },
      });
      await prisma.attachment.update({
        where: { id: assertPresentValue(groupedAttachment).id },
        data: {},
      });

      const foreignAttachment = await prisma.attachment.create({
        data: {
          id: `foreign-attachment-${fixture.suffix}`,
          projectId: fixture.projectId,
          workflowNodeId: assertPresentValue(
            assertPresentValue(groupedJob).batchWorkflowNodeId
          ),
          code: `FOREIGN-${fixture.suffix}`,
          title: "Foreign directory file",
          fileKind: "SUPPORTING",
          fileName: "foreign.txt",
          originalName: "foreign.txt",
          fileUrl: "foreign-object",
          fileSize: 7,
          mimeType: "text/plain",
          uploadedBy: fixture.preparer.id,
        },
      });
      await expect(
        withdrawal.withdraw(
          fixture.projectId,
          assertPresentValue(groupedJob).id,
          undefined,
          fixture.preparer as RequestUser,
          auditSource
        )
      ).rejects.toMatchObject({
        response: { code: "CONFIRMATION_STATE_CONFLICT" },
      });
      await prisma.attachment.delete({ where: { id: foreignAttachment.id } });
    });
    it.each(["ZIP", "FLAT", "GROUPED"] as const)(
      "reimports one deleted %s source in its original directory",
      async (mode) => {
        const confirmationId = await createSupplementalConfirmation(
          prisma,
          storage,
          fixture.projectId,
          `${fixture.suffix}-reimport-${mode}`,
          {
            label: `cycle-${mode}`,
            confirmationCode: `REIMPORT-${mode}`,
            counterpartyName: "Cycle Bank",
            createdBy: fixture.preparer,
            reviewer: fixture.reviewer,
            outgoing: {
              fileName: "outgoing.pdf",
              mimeType: "application/pdf",
              body: Buffer.from("outgoing"),
            },
            responses: [1, 2, 3].map((n) => ({
              fileName: `response-${n}.pdf`,
              mimeType: "application/pdf",
              body: Buffer.from(`response body ${n}`),
            })),
          }
        );
        const withdrawal = new ConfirmationEmpImportWithdrawalService(
          new PrismaConfirmationEmpImportWithdrawalStore(prisma, storage),
          new ProjectAccessService(prisma),
          new AuditLogsService(prisma)
        );

        const input = {
          confirmationIds: [confirmationId],
          targetWorkflowNodeId: fixture.accountNodeId,
          mode,
        };
        const firstPreview = await service.preview(
          fixture.projectId,
          fixture.preparer,
          input
        );
        const first = await service.createJob(
          fixture.projectId,
          fixture.preparer,
          {
            ...input,
            previewFingerprint: firstPreview.fingerprint,
            idempotencyKey: randomUUID(),
          }
        );
        await waitForTerminalJob(prisma, first.id);
        const old = await prisma.confirmationEmpImportItem.findMany({
          where: { jobId: first.id },
        });
        await prisma.attachment.update({
          where: { id: old[0]!.attachmentId! },
          data: { deletedAt: new Date() },
        });
        const preview = await service.preview(
          fixture.projectId,
          fixture.preparer,
          { ...input, activeLinkKeys: [old[0]!.activeLinkKey] }
        );
        expect(
          preview.sources.find(
            (item) => item.activeLinkKey === old[0]!.activeLinkKey
          )?.reimportTargetDirectoryId
        ).toBe(fixture.accountNodeId);
        const second = await service.createJob(
          fixture.projectId,
          fixture.preparer,
          {
            ...input,
            activeLinkKeys: [old[0]!.activeLinkKey],
            previewFingerprint: preview.fingerprint,
            idempotencyKey: randomUUID(),
          }
        );
        expect((await waitForTerminalJob(prisma, second.id)).status).toBe(
          "COMPLETED"
        );
        const replacement = await prisma.confirmationEmpImportItem.findMany({
          where: { jobId: second.id },
        });
        expect(replacement).toHaveLength(1);
        expect(replacement[0]!.sourceObjectKey).toBe(old[0]!.sourceObjectKey);
        expect(
          (
            await prisma.confirmationEmpImportItem.findUniqueOrThrow({
              where: { id: old[0]!.id },
            })
          ).withdrawnAt
        ).not.toBeNull();
        for (const item of old.slice(1))
          expect(
            (
              await prisma.confirmationEmpImportItem.findUniqueOrThrow({
                where: { id: item.id },
              })
            ).withdrawnAt
          ).toBeNull();
        await withdrawal.withdraw(
          fixture.projectId,
          second.id,
          undefined,
          fixture.preparer as RequestUser,
          { ipAddress: "127.0.0.1" },
          undefined,
          false,
          replacement[0]!.id
        );
      }
    );
  }
);

type FixtureUser = {
  id: string;
  email: string;
  name: string;
  globalRole: "MANAGER" | "STAFF";
};

type Fixture = {
  suffix: string;
  projectId: string;
  workspaceId: string;
  frameworkTemplateId: string;
  userIds: string[];
  confirmationId: string;
  groupedConfirmationId: string;
  zipConfirmationIds: string[];
  ineligibleConfirmationIds: string[];
  accountNodeId: string;
  accountNodeCode: string;
  leafNodeId: string;
  preparer: FixtureUser;
  reviewer: FixtureUser;
  flatJobId?: string;
  flatIdempotencyKey?: string;
};

async function createFixture(
  prisma: PrismaService,
  storage: StorageService
): Promise<Fixture> {
  const suffix = randomUUID().replaceAll("-", "");
  const owner = createUser(`owner-${suffix}`, "Project Owner");
  const preparer = createUser(`preparer-${suffix}`, "Project Preparer");
  const reviewer = createUser(`reviewer-${suffix}`, "Project Reviewer");

  await prisma.user.createMany({
    data: [owner, preparer, reviewer].map((user) => ({
      ...user,
      globalRole: user.globalRole,
    })),
  });

  const frameworkTemplate = await prisma.frameworkTemplate.create({
    data: {
      id: `framework-${suffix}`,
      code: `EMP-INT-FRAMEWORK-${suffix}`,
      name: "EMP integration framework",
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      id: `workspace-${suffix}`,
      name: "EMP integration workspace",
      clientName: "EMP integration client",
      ownerId: owner.id,
    },
  });
  const project = await prisma.project.create({
    data: {
      id: `project-${suffix}`,
      workspaceId: workspace.id,
      projectCode: `EMP-INT-${suffix}`,
      name: "EMP integration project",
      frameworkTemplateId: frameworkTemplate.id,
      reportingDate: new Date("2026-06-30T00:00:00.000Z"),
      yearEndDate: new Date("2026-06-30T00:00:00.000Z"),
      reportDate: new Date("2026-08-01T00:00:00.000Z"),
      archiveDeadline: new Date("2027-02-01T00:00:00.000Z"),
      ownerId: owner.id,
      status: "ACTIVE",
    },
  });
  await prisma.projectMember.createMany({
    data: [
      {
        id: `member-preparer-${suffix}`,
        projectId: project.id,
        userId: preparer.id,
        projectRole: "PREPARER",
        status: "ACTIVE",
      },
      {
        id: `member-reviewer-${suffix}`,
        projectId: project.id,
        userId: reviewer.id,
        projectRole: "REVIEWER",
        status: "ACTIVE",
      },
    ],
  });

  const root = await prisma.workflowNode.create({
    data: {
      id: `workflow-root-${suffix}`,
      projectId: project.id,
      level: 1,
      code: `ROOT-${suffix}`,
      title: "Root",
      nodeType: "PHASE",
      sortOrder: 1,
      createdBy: owner.id,
    },
  });
  const account = await prisma.workflowNode.create({
    data: {
      id: `workflow-account-${suffix}`,
      projectId: project.id,
      parentId: root.id,
      level: 2,
      code: `ACCOUNT-${suffix}`,
      title: "Confirmation account",
      nodeType: "ACCOUNT",
      sortOrder: 1,
      createdBy: owner.id,
    },
  });
  const leaf = await prisma.workflowNode.create({
    data: {
      id: `workflow-leaf-${suffix}`,
      projectId: project.id,
      parentId: account.id,
      level: 3,
      code: `EMP-${suffix}`,
      title: "EMP confirmations",
      nodeType: "WORKING_PAPER",
      sortOrder: 1,
      createdBy: owner.id,
    },
  });
  const confirmationId = `confirmation-${suffix}`;
  const confirmation = await prisma.projectConfirmation.create({
    data: {
      id: confirmationId,
      projectId: project.id,
      type: "BANK",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      confirmationCode: "CONF-002",
      counterpartyName: "Acme Bank",
      createdBy: preparer.id,
    },
  });
  const outgoingBody = Buffer.from("uploaded outgoing document");
  const outgoing = await storage.putObject(
    project.id,
    `fixture-${confirmation.id}`,
    "bank-confirmation.docx",
    outgoingBody,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  const outgoingHash = sha256(outgoingBody);
  const artifact = await prisma.confirmationArtifact.create({
    data: {
      id: `artifact-${suffix}`,
      confirmationId: confirmation.id,
      version: 1,
      disposition: "ACTIVE",
      templateCode: "UPLOADED_DOCUMENT",
      templateVersion: "integration",
      docxObjectKey: outgoing.objectKey,
      docxSize: outgoingBody.length,
      pdfObjectKey: outgoing.objectKey,
      pdfSize: outgoingBody.length,
      pdfSha256: outgoingHash,
      structuredSnapshot: {
        source: "UPLOAD",
        fileName: "bank-confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: outgoingBody.length,
        sha256: outgoingHash,
      },
      derivedSnapshot: {},
      submissionKey: `submission-${suffix}`,
      submittedBy: preparer.id,
      submittedAt: new Date("2026-07-01T09:00:00.000Z"),
    },
  });
  await prisma.projectConfirmation.update({
    where: { id: confirmation.id },
    data: { currentArtifactId: artifact.id },
  });

  const responseBody = Buffer.from("routed response document");
  const responseObject = await storage.putObject(
    project.id,
    `fixture-${confirmation.id}`,
    "bank-response.pdf",
    responseBody,
    "application/pdf"
  );
  const response = await prisma.projectConfirmationResponse.create({
    data: {
      id: `response-${suffix}`,
      confirmationId: confirmation.id,
      responseStatus: "RECEIVED",
      routingStatus: "ROUTED",
      receivedAt: new Date("2026-07-02T09:00:00.000Z"),
      receivedBy: reviewer.id,
      attachmentName: "bank-response.pdf",
    },
  });
  await prisma.confirmationResponseArtifact.create({
    data: {
      id: `response-artifact-${suffix}`,
      responseId: response.id,
      sequence: 1,
      objectKey: responseObject.objectKey,
      fileName: "bank-response.pdf",
      mimeType: "application/pdf",
      fileSize: responseBody.length,
      sha256: sha256(responseBody),
      uploadedBy: reviewer.id,
      capturedAt: new Date("2026-07-02T09:00:00.000Z"),
    },
  });
  await prisma.confirmationFollowUpEvent.create({
    data: {
      id: `review-event-${suffix}`,
      confirmationId: confirmation.id,
      eventType: "PROGRAM_COMPLETED",
      actorId: reviewer.id,
      source: "integration",
      payload: {
        transition: "REVIEW",
        result: "MATCHED",
        responseId: response.id,
      },
      occurredAt: new Date("2026-07-03T09:00:00.000Z"),
    },
  });

  const groupedConfirmationId = await createSupplementalConfirmation(
    prisma,
    storage,
    project.id,
    suffix,
    {
      label: "grouped",
      confirmationCode: "CONF-003",
      counterpartyName: "Beta Bank",
      createdBy: reviewer,
      outgoing: {
        fileName: "beta-confirmation.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("beta outgoing spreadsheet"),
      },
      responses: [
        {
          fileName: "beta-response.pdf",
          mimeType: "application/pdf",
          body: Buffer.from("beta response one"),
        },
        {
          fileName: "beta-response-2.pdf",
          mimeType: "application/pdf",
          body: Buffer.from("beta response two"),
        },
      ],
      reviewer,
    }
  );
  const zipConfirmationIds = await Promise.all([
    createSupplementalConfirmation(prisma, storage, project.id, suffix, {
      label: "zip-alpha",
      confirmationCode: "CONF-001",
      counterpartyName: "Alpha Bank",
      createdBy: preparer,
      outgoing: {
        fileName: "alpha-confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("alpha outgoing document"),
      },
      responses: [
        {
          fileName: "alpha-response.pdf",
          mimeType: "application/pdf",
          body: Buffer.from("alpha response"),
        },
      ],
      reviewer,
    }),
    createSupplementalConfirmation(prisma, storage, project.id, suffix, {
      label: "zip-zeta",
      confirmationCode: "CONF-004",
      counterpartyName: "Zeta Bank",
      createdBy: preparer,
      outgoing: {
        fileName: "zeta-confirmation.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: Buffer.from("zeta outgoing document"),
      },
      responses: [
        {
          fileName: "zeta-response.pdf",
          mimeType: "application/pdf",
          body: Buffer.from("zeta response"),
        },
      ],
      reviewer,
    }),
  ]);
  const ineligibleConfirmationIds = await Promise.all(
    (["DRAFT", "PREPARED", "VOIDED"] as const).map(async (status) => {
      const createdConfirmation = await prisma.projectConfirmation.create({
        data: {
          id: `confirmation-${status.toLowerCase()}-${suffix}`,
          projectId: project.id,
          type: "BANK",
          status,
          differenceStatus: "MATCHED",
          confirmationCode: `${status}-ONLY`,
          counterpartyName: `${status} only`,
          createdBy: preparer.id,
        },
      });
      return createdConfirmation.id;
    })
  );

  return {
    suffix,
    projectId: project.id,
    workspaceId: workspace.id,
    frameworkTemplateId: frameworkTemplate.id,
    userIds: [owner.id, preparer.id, reviewer.id],
    confirmationId,
    groupedConfirmationId,
    zipConfirmationIds,
    ineligibleConfirmationIds,
    accountNodeId: account.id,
    accountNodeCode: account.code,
    leafNodeId: leaf.id,
    preparer,
    reviewer,
  };
}

type SupplementalFile = {
  fileName: string;
  mimeType: string;
  body: Buffer;
};

type SupplementalConfirmationOptions = {
  label: string;
  confirmationCode: string;
  counterpartyName: string;
  createdBy: FixtureUser;
  reviewer: FixtureUser;
  outgoing: SupplementalFile;
  responses: SupplementalFile[];
};

async function createSupplementalConfirmation(
  prisma: PrismaService,
  storage: StorageService,
  projectId: string,
  suffix: string,
  options: SupplementalConfirmationOptions
) {
  const prefix = `${options.label}-${suffix}`;
  const confirmation = await prisma.projectConfirmation.create({
    data: {
      id: `confirmation-${prefix}`,
      projectId,
      type: "BANK",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      confirmationCode: options.confirmationCode,
      counterpartyName: options.counterpartyName,
      createdBy: options.createdBy.id,
      attachmentName: options.outgoing.fileName,
    },
  });
  const outgoing = await storage.putObject(
    projectId,
    `fixture-${confirmation.id}`,
    options.outgoing.fileName,
    options.outgoing.body,
    options.outgoing.mimeType
  );
  const outgoingHash = sha256(options.outgoing.body);
  const artifact = await prisma.confirmationArtifact.create({
    data: {
      id: `artifact-${prefix}`,
      confirmationId: confirmation.id,
      version: 1,
      disposition: "ACTIVE",
      templateCode: "UPLOADED_DOCUMENT",
      templateVersion: "integration",
      docxObjectKey: outgoing.objectKey,
      docxSize: options.outgoing.body.length,
      pdfObjectKey: outgoing.objectKey,
      pdfSize: options.outgoing.body.length,
      pdfSha256: outgoingHash,
      structuredSnapshot: {
        source: "UPLOAD",
        fileName: options.outgoing.fileName,
        mimeType: options.outgoing.mimeType,
        size: options.outgoing.body.length,
        sha256: outgoingHash,
      },
      derivedSnapshot: {},
      submissionKey: `submission-${prefix}`,
      submittedBy: options.createdBy.id,
      submittedAt: new Date("2026-07-01T09:00:00.000Z"),
    },
  });
  await prisma.projectConfirmation.update({
    where: { id: confirmation.id },
    data: { currentArtifactId: artifact.id },
  });

  const response = await prisma.projectConfirmationResponse.create({
    data: {
      id: `response-${prefix}`,
      confirmationId: confirmation.id,
      responseStatus: "RECEIVED",
      routingStatus: "ROUTED",
      receivedAt: new Date("2026-07-02T09:00:00.000Z"),
      receivedBy: options.reviewer.id,
      attachmentName: options.responses[0]?.fileName,
    },
  });
  for (const [index, responseFile] of options.responses.entries()) {
    const responseObject = await storage.putObject(
      projectId,
      `fixture-${confirmation.id}`,
      responseFile.fileName,
      responseFile.body,
      responseFile.mimeType
    );
    await prisma.confirmationResponseArtifact.create({
      data: {
        id: `response-artifact-${prefix}-${index + 1}`,
        responseId: response.id,
        sequence: index + 1,
        objectKey: responseObject.objectKey,
        fileName: responseFile.fileName,
        mimeType: responseFile.mimeType,
        fileSize: responseFile.body.length,
        sha256: sha256(responseFile.body),
        uploadedBy: options.reviewer.id,
        capturedAt: new Date("2026-07-02T09:00:00.000Z"),
      },
    });
  }
  await prisma.confirmationFollowUpEvent.create({
    data: {
      id: `review-event-${prefix}`,
      confirmationId: confirmation.id,
      eventType: "PROGRAM_COMPLETED",
      actorId: options.reviewer.id,
      source: "integration",
      payload: {
        transition: "REVIEW",
        result: "MATCHED",
        responseId: response.id,
      },
      occurredAt: new Date("2026-07-03T09:00:00.000Z"),
    },
  });
  return confirmation.id;
}

function createUser(label: string, name: string) {
  return {
    id: `user-${label}`,
    email: `${label}@example.test`,
    name,
    globalRole: label.startsWith("preparer-")
      ? ("STAFF" as const)
      : ("MANAGER" as const),
  };
}

async function waitForTerminalJob(prisma: PrismaService, jobId: string) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const job = await prisma.confirmationEmpImportJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });
    if (
      job &&
      ["COMPLETED", "PARTIAL_FAILURE", "FAILED"].includes(job.status)
    ) {
      return job;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(`Timed out waiting for import job ${jobId}`);
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture) {
  await prisma.auditLog.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.confirmationEmpImportItem.deleteMany({
    where: { job: { projectId: fixture.projectId } },
  });
  await prisma.confirmationEmpImportJob.deleteMany({
    where: { projectId: fixture.projectId },
  });
  await prisma.workspace.delete({ where: { id: fixture.workspaceId } });
  await prisma.frameworkTemplate.delete({
    where: { id: fixture.frameworkTemplateId },
  });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: fixture.userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } });
}

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
