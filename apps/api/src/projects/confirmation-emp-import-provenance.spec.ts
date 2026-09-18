import { randomUUID } from "node:crypto";

import "dotenv/config";

import { PrismaService } from "../prisma/prisma.service";

vi.setConfig({ testTimeout: 120_000 });

const runRealIntegration = /^(1|true|yes)$/i.test(
  process.env.RUN_CONFIRMATION_EMP_IMPORT_PROVENANCE_INTEGRATION ?? ""
);
const describeRealIntegration = runRealIntegration ? describe : describe.skip;

describeRealIntegration(
  "Confirmation EMP import provenance constraints real PostgreSQL integration",
  () => {
    let fixture: Fixture | undefined;
    let prisma: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
      fixture = await createFixture(prisma);
    });

    afterAll(async () => {
      try {
        if (fixture) {
          await cleanupFixture(prisma, fixture);
        }
      } finally {
        await prisma?.$disconnect();
      }
    });

    it("accepts legal outgoing and response provenance rows", async () => {
      const outgoing = await prisma.confirmationEmpImportItem.create({
        data: itemData(assertPresentValue(fixture), {
          id: `item-outgoing-${assertPresentValue(fixture).suffix}`,
          confirmationId: assertPresentValue(
            assertPresentValue(fixture).confirmationIds[0]
          ),
          sourceKind: "OUTGOING_ARTIFACT",
          outgoingArtifactId:
            assertPresentValue(fixture).outgoingArtifactIds[0],
        }),
      });
      const response = await prisma.confirmationEmpImportItem.create({
        data: itemData(assertPresentValue(fixture), {
          id: `item-response-${assertPresentValue(fixture).suffix}`,
          confirmationId: assertPresentValue(
            assertPresentValue(fixture).confirmationIds[0]
          ),
          sourceKind: "RESPONSE_ARTIFACT",
          responseId: assertPresentValue(fixture).responseIds[0],
          responseArtifactId:
            assertPresentValue(fixture).responseArtifactIds[0],
        }),
      });

      expect(outgoing.id).toBe(
        `item-outgoing-${assertPresentValue(fixture).suffix}`
      );
      expect(response.id).toBe(
        `item-response-${assertPresentValue(fixture).suffix}`
      );
    });

    it("rejects a response linked to a different confirmation", async () => {
      await expect(
        prisma.confirmationEmpImportItem.create({
          data: itemData(assertPresentValue(fixture), {
            id: `item-cross-confirmation-${assertPresentValue(fixture).suffix}`,
            confirmationId: assertPresentValue(
              assertPresentValue(fixture).confirmationIds[1]
            ),
            sourceKind: "RESPONSE_ARTIFACT",
            responseId: assertPresentValue(fixture).responseIds[0],
            responseArtifactId:
              assertPresentValue(fixture).responseArtifactIds[0],
          }),
        })
      ).rejects.toThrow(/./);
    });

    it("rejects a response artifact linked to a different response and invalid source shape", async () => {
      await expect(
        prisma.confirmationEmpImportItem.create({
          data: itemData(assertPresentValue(fixture), {
            id: `item-cross-response-${assertPresentValue(fixture).suffix}`,
            confirmationId: assertPresentValue(
              assertPresentValue(fixture).confirmationIds[0]
            ),
            sourceKind: "RESPONSE_ARTIFACT",
            responseId: assertPresentValue(fixture).responseIds[0],
            responseArtifactId:
              assertPresentValue(fixture).responseArtifactIds[1],
          }),
        })
      ).rejects.toThrow(/./);

      await expect(
        prisma.confirmationEmpImportItem.create({
          data: itemData(assertPresentValue(fixture), {
            id: `item-invalid-shape-${assertPresentValue(fixture).suffix}`,
            confirmationId: assertPresentValue(
              assertPresentValue(fixture).confirmationIds[0]
            ),
            sourceKind: "OUTGOING_ARTIFACT",
            responseId: assertPresentValue(fixture).responseIds[0],
            responseArtifactId:
              assertPresentValue(fixture).responseArtifactIds[0],
          }),
        })
      ).rejects.toThrow(/./);
    });
  }
);

type Fixture = {
  suffix: string;
  userIds: string[];
  workspaceId: string;
  frameworkTemplateId: string;
  projectId: string;
  workflowNodeId: string;
  jobId: string;
  confirmationIds: string[];
  responseIds: string[];
  responseArtifactIds: string[];
  outgoingArtifactIds: string[];
};

type ItemOverrides = {
  id: string;
  confirmationId: string;
  sourceKind: "OUTGOING_ARTIFACT" | "RESPONSE_ARTIFACT";
  outgoingArtifactId?: string;
  responseId?: string;
  responseArtifactId?: string;
};

function itemData(fixture: Fixture, overrides: ItemOverrides) {
  return {
    id: overrides.id,
    jobId: fixture.jobId,
    confirmationId: overrides.confirmationId,
    sourceKind: overrides.sourceKind,
    outgoingArtifactId: overrides.outgoingArtifactId ?? null,
    responseId: overrides.responseId ?? null,
    responseArtifactId: overrides.responseArtifactId ?? null,
    sourceObjectKey: `provenance/${overrides.id}.pdf`,
    sourceFileName: `${overrides.id}.pdf`,
    sourceMimeType: "application/pdf",
    sourceSize: 1,
    sourceSha256: "a".repeat(64),
    activeLinkKey: `active-${overrides.id}`,
  };
}

async function createFixture(prisma: PrismaService): Promise<Fixture> {
  const suffix = randomUUID().replaceAll("-", "");
  const ownerId = `provenance-owner-${suffix}`;
  const actorId = `provenance-actor-${suffix}`;
  const workspaceId = `provenance-workspace-${suffix}`;
  const frameworkTemplateId = `provenance-framework-${suffix}`;
  const projectId = `provenance-project-${suffix}`;
  const workflowNodeId = `provenance-node-${suffix}`;
  const jobId = `provenance-job-${suffix}`;

  await prisma.user.createMany({
    data: [
      {
        id: ownerId,
        email: `${ownerId}@example.test`,
        name: "Provenance Owner",
        globalRole: "MANAGER",
      },
      {
        id: actorId,
        email: `${actorId}@example.test`,
        name: "Provenance Actor",
        globalRole: "MANAGER",
      },
    ],
  });
  await prisma.frameworkTemplate.create({
    data: {
      id: frameworkTemplateId,
      code: `PROVENANCE-${suffix}`,
      name: "EMP provenance fixture",
    },
  });
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "EMP provenance workspace",
      clientName: "EMP provenance client",
      ownerId,
    },
  });
  await prisma.project.create({
    data: {
      id: projectId,
      workspaceId,
      projectCode: `PROVENANCE-${suffix}`,
      name: "EMP provenance project",
      frameworkTemplateId,
      reportingDate: new Date("2026-06-30T00:00:00.000Z"),
      yearEndDate: new Date("2026-06-30T00:00:00.000Z"),
      reportDate: new Date("2026-08-01T00:00:00.000Z"),
      archiveDeadline: new Date("2027-02-01T00:00:00.000Z"),
      ownerId,
      status: "ACTIVE",
    },
  });
  await prisma.workflowNode.create({
    data: {
      id: workflowNodeId,
      projectId,
      level: 1,
      code: `PROVENANCE-${suffix}`,
      title: "EMP provenance target",
      nodeType: "PHASE",
      sortOrder: 1,
      createdBy: ownerId,
    },
  });

  const confirmationIds = [0, 1].map(
    (index) => `provenance-confirmation-${index}-${suffix}`
  );
  const responseIds = [0, 1].map(
    (index) => `provenance-response-${index}-${suffix}`
  );
  const responseArtifactIds = [0, 1].map(
    (index) => `provenance-response-artifact-${index}-${suffix}`
  );
  const outgoingArtifactIds = [0, 1].map(
    (index) => `provenance-outgoing-artifact-${index}-${suffix}`
  );

  for (const [index, confirmationId] of confirmationIds.entries()) {
    await prisma.projectConfirmation.create({
      data: {
        id: confirmationId,
        projectId,
        type: "BANK",
        status: "CLOSED",
        differenceStatus: "MATCHED",
        confirmationCode: `PROVENANCE-${index}-${suffix}`,
        counterpartyName: `Provenance Counterparty ${index}`,
        createdBy: actorId,
      },
    });
    await prisma.confirmationArtifact.create({
      data: {
        id: assertPresentValue(outgoingArtifactIds[index]),
        confirmationId,
        version: 1,
        disposition: "ACTIVE",
        templateCode: "UPLOADED_DOCUMENT",
        templateVersion: "provenance",
        docxObjectKey: `provenance/${outgoingArtifactIds[index]}.docx`,
        docxSize: 1,
        pdfObjectKey: `provenance/${outgoingArtifactIds[index]}.pdf`,
        pdfSize: 1,
        pdfSha256: "b".repeat(64),
        structuredSnapshot: { source: "PROVENANCE_TEST" },
        derivedSnapshot: {},
        submissionKey: `provenance-submission-${index}-${suffix}`,
        submittedBy: actorId,
        submittedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    });
    await prisma.projectConfirmationResponse.create({
      data: {
        id: assertPresentValue(responseIds[index]),
        confirmationId,
        responseStatus: "RECEIVED",
        routingStatus: "ROUTED",
        receivedAt: new Date("2026-07-02T00:00:00.000Z"),
        receivedBy: actorId,
        attachmentName: `provenance-response-${index}.pdf`,
      },
    });
    await prisma.confirmationResponseArtifact.create({
      data: {
        id: assertPresentValue(responseArtifactIds[index]),
        responseId: assertPresentValue(responseIds[index]),
        sequence: 1,
        objectKey: `provenance/${responseArtifactIds[index]}.pdf`,
        fileName: `provenance-response-${index}.pdf`,
        mimeType: "application/pdf",
        fileSize: 1,
        sha256: "c".repeat(64),
        uploadedBy: actorId,
        capturedAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    });
  }

  await prisma.confirmationEmpImportJob.create({
    data: {
      id: jobId,
      projectId,
      targetWorkflowNodeId: workflowNodeId,
      mode: "FLAT",
      idempotencyKey: `provenance-idempotency-${suffix}`,
      previewFingerprint: "d".repeat(64),
      previewedAt: new Date("2026-07-03T00:00:00.000Z"),
      createdBy: actorId,
    },
  });

  return {
    suffix,
    userIds: [ownerId, actorId],
    workspaceId,
    frameworkTemplateId,
    projectId,
    workflowNodeId,
    jobId,
    confirmationIds,
    responseIds,
    responseArtifactIds,
    outgoingArtifactIds,
  };
}

async function cleanupFixture(prisma: PrismaService, fixture: Fixture) {
  await prisma.confirmationEmpImportItem.deleteMany({
    where: { jobId: fixture.jobId },
  });
  await prisma.confirmationEmpImportJob.deleteMany({
    where: { id: fixture.jobId },
  });
  await prisma.confirmationResponseArtifact.deleteMany({
    where: { responseId: { in: fixture.responseIds } },
  });
  await prisma.projectConfirmationResponse.deleteMany({
    where: { id: { in: fixture.responseIds } },
  });
  await prisma.confirmationArtifact.deleteMany({
    where: { id: { in: fixture.outgoingArtifactIds } },
  });
  await prisma.projectConfirmation.deleteMany({
    where: { id: { in: fixture.confirmationIds } },
  });
  await prisma.workflowNode.deleteMany({
    where: { id: fixture.workflowNodeId },
  });
  await prisma.project.deleteMany({ where: { id: fixture.projectId } });
  await prisma.workspace.deleteMany({ where: { id: fixture.workspaceId } });
  await prisma.frameworkTemplate.deleteMany({
    where: { id: fixture.frameworkTemplateId },
  });
  await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } });
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
