import {
  DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE,
  DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE,
} from "@project-wing/shared";
import type { SmartFormV2Response } from "@project-wing/shared";

import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectAccessService } from "../projects/project-access.service";
import { StorageService } from "../storage/storage.service";
import { SmartFormsService } from "./smart-forms.service";

const prisma = {
  $transaction: vi.fn(),
  frameworkTemplate: {
    findUnique: vi.fn(),
  },
  smartFormTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  smartFormTemplateVersion: {
    aggregate: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  workflowNode: {
    findFirst: vi.fn(),
  },
  workingPaper: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  attachment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  attachmentVersion: {
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  smartFormInstance: {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
};
const auditLogs = {
  log: vi.fn(),
};
const storage = {
  getObjectBuffer: vi.fn(),
  putObject: vi.fn(),
};
const access = {
  requireProjectMember: vi.fn(),
  requireProjectRole: vi.fn(),
  requireProjectAction: vi.fn(),
};
const validDefinition = DEFERRED_INCOME_SMART_FORM_V2_COMPILED_FIXTURE;

function buildPackage(response?: SmartFormV2Response) {
  const resolvedResponse = response ?? {
    kind: "smartFormResponse" as const,
    schemaVersion: 2 as const,
    definitionVersionId: validDefinition.id,
    responseLocale: "en-US",
    updatedAt: "2026-06-22T00:00:00.000Z",
    fields: {},
    sheets: {},
  };
  return {
    packageType: "PROJECT_WING_SMART_FORM" as const,
    formatVersion: 2 as const,
    template: {
      id: "template-1",
      versionId: "version-1",
      code: "SF-001",
      title: "Engagement profile",
      publishedAt: "2026-06-22T00:00:00.000Z",
    },
    definition: validDefinition,
    response: resolvedResponse,
    createdAt: "2026-06-22T00:00:00.000Z",
    updatedAt: "2026-06-22T00:00:00.000Z",
  };
}

describe(SmartFormsService, () => {
  let service: SmartFormsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    access.requireProjectMember.mockResolvedValue({ id: "member-1" });
    access.requireProjectRole.mockResolvedValue({ id: "member-1" });
    access.requireProjectAction.mockResolvedValue({ id: "member-1" });
    prisma.attachmentVersion.deleteMany.mockResolvedValue({ count: 0 });
    prisma.attachmentVersion.updateMany.mockResolvedValue({ count: 0 });
    service = new SmartFormsService(
      prisma as never,
      auditLogs as never,
      storage as never,
      access as never
    );
  });

  it("emits concrete Nest provider metadata", () => {
    expect(
      Reflect.getMetadata("design:paramtypes", SmartFormsService)
    ).toStrictEqual([
      PrismaService,
      AuditLogsService,
      StorageService,
      ProjectAccessService,
    ]);
  });

  it("loads PDF engagement details from the project database record", async () => {
    prisma.project.findUnique.mockResolvedValue({
      name: "Fallback engagement name",
      yearEndDate: new Date("2026-03-31T00:00:00.000Z"),
      reportingDate: new Date("2026-04-30T00:00:00.000Z"),
      workspace: { clientName: "Workspace client" },
      cmpClient: {
        nameZh: "武汉沃得通供应链科技有限公司",
        nameEn: "Wuhan Wodetong Supply Chain Technology Co., Ltd",
      },
      cmpEngagement: {
        engagementCode: "WDT-2026-AUD",
        yearEndDate: new Date("2026-05-31T00:00:00.000Z"),
      },
    });

    await expect(
      service.getSmartFormV2PdfEngagementDetails(
        "project-1",
        { id: "user-1" } as never,
        "en-US"
      )
    ).resolves.toStrictEqual({
      clientName: "Wuhan Wodetong Supply Chain Technology Co., Ltd",
      engagementCode: "WDT-2026-AUD",
      financialStatementDate: new Date("2026-03-31T00:00:00.000Z"),
    });
    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
  });

  it("does not query PDF engagement details for a non-member", async () => {
    access.requireProjectMember.mockRejectedValueOnce(
      new Error("not a member")
    );

    await expect(
      service.getSmartFormV2PdfEngagementDetails(
        "project-1",
        { id: "user-2" } as never,
        "en-US"
      )
    ).rejects.toThrow("not a member");
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });

  it("rejects non-super-admin template creation", async () => {
    await expect(
      service.createTemplate(
        {
          code: "SF-001",
          name: "Engagement profile",
          frameworkTemplateId: "framework-1",
          definition: validDefinition,
        },
        { id: "user-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });

    expect(prisma.smartFormTemplate.create).not.toHaveBeenCalled();
  });

  it("creates draft templates for super admins", async () => {
    prisma.frameworkTemplate.findUnique.mockResolvedValue({
      id: "framework-1",
    });
    prisma.smartFormTemplate.create.mockResolvedValue({
      id: "template-1",
      code: "SF-001",
      name: "Engagement profile",
    });

    await service.createTemplate(
      {
        code: "SF-001",
        name: "Engagement profile",
        frameworkTemplateId: "framework-1",
        definition: validDefinition,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.smartFormTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "SF-001",
          name: "Engagement profile",
          frameworkTemplateId: "framework-1",
          status: "DRAFT",
          createdBy: "admin-1",
        }),
      })
    );
    expect(
      prisma.smartFormTemplate.create.mock.calls[0]?.[0].data
    ).not.toHaveProperty("language");
  });

  it("creates public draft templates without an applicable standard", async () => {
    prisma.smartFormTemplate.create.mockResolvedValue({
      id: "template-public",
      code: "SF-PUBLIC",
      name: "Public profile",
    });

    await service.createTemplate(
      {
        code: "SF-PUBLIC",
        name: "Public profile",
        frameworkTemplateId: null,
        definition: validDefinition,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.frameworkTemplate.findUnique).not.toHaveBeenCalled();
    expect(prisma.smartFormTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          frameworkTemplateId: null,
        }),
      })
    );
  });

  it("lists only published templates for project users", async () => {
    prisma.smartFormTemplate.findMany.mockResolvedValue([]);

    await service.listPublishedTemplates({
      frameworkTemplateId: "framework-1",
    });

    expect(prisma.smartFormTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { frameworkTemplateId: "framework-1" },
            { frameworkTemplateId: null },
          ],
          status: "PUBLISHED",
          currentPublishedVersionId: { not: null },
        }),
      })
    );
    expect(
      prisma.smartFormTemplate.findMany.mock.calls[0]?.[0].where
    ).not.toHaveProperty("language");
  });

  it("clears the applicable standard on template update", async () => {
    prisma.smartFormTemplate.update.mockResolvedValue({
      id: "template-1",
      code: "SF-002",
    });

    await service.updateTemplate(
      "template-1",
      {
        frameworkTemplateId: "",
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.frameworkTemplate.findUnique).not.toHaveBeenCalled();
    expect(prisma.smartFormTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          frameworkTemplateId: null,
          updatedBy: "admin-1",
        }),
      })
    );
  });

  it("updates editable draft template fields", async () => {
    prisma.frameworkTemplate.findUnique.mockResolvedValue({
      id: "framework-2",
    });
    prisma.smartFormTemplate.update.mockResolvedValue({
      id: "template-1",
      code: "SF-002",
    });

    await service.updateTemplate(
      "template-1",
      {
        code: "SF-002",
        frameworkTemplateId: "framework-2",
        definition: validDefinition,
      },
      { id: "admin-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.smartFormTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: expect.objectContaining({
          code: "SF-002",
          frameworkTemplateId: "framework-2",
          draftDefinitionJson: validDefinition,
          updatedBy: "admin-1",
        }),
      })
    );
  });

  it("publishes an immutable version and keeps editable draft separate", async () => {
    prisma.smartFormTemplate.findFirst.mockResolvedValue({
      id: "template-1",
      code: "SF-001",
      name: "Engagement profile",
      frameworkTemplateId: "framework-1",
      status: "DRAFT",
      draftDefinitionJson: validDefinition,
      currentPublishedVersionId: null,
    });
    prisma.smartFormTemplateVersion.aggregate.mockResolvedValue({
      _max: { version: null },
    });
    prisma.smartFormTemplateVersion.create.mockResolvedValue({
      id: "version-1",
      templateId: "template-1",
      version: 1,
      definitionJson: validDefinition,
      definitionHash: "hash-1",
      publishedBy: "admin-1",
    });
    prisma.smartFormTemplate.update.mockResolvedValue({
      id: "template-1",
      status: "PUBLISHED",
      currentPublishedVersionId: "version-1",
    });

    const result = await service.publishTemplate("template-1", {
      id: "admin-1",
      globalRole: "SUPER_ADMIN",
    } as never);

    expect(prisma.smartFormTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "template-1",
          version: 1,
          definitionJson: validDefinition,
          publishedBy: "admin-1",
        }),
      })
    );
    expect(result.currentPublishedVersionId).toBe("version-1");
  });

  it("archives templates so they are absent from the public list", async () => {
    prisma.smartFormTemplate.update.mockResolvedValue({
      id: "template-1",
      status: "ARCHIVED",
    });

    await expect(
      service.archiveTemplate("template-1", {
        id: "admin-1",
        globalRole: "SUPER_ADMIN",
      } as never)
    ).resolves.toMatchObject({ status: "ARCHIVED" });
  });

  it("creates an independent .sf attachment from a published template version", async () => {
    prisma.smartFormTemplateVersion.findFirst.mockResolvedValue({
      id: "version-1",
      templateId: "template-1",
      version: 1,
      definitionJson: validDefinition,
      template: {
        id: "template-1",
        code: "SF-001",
        name: "Engagement profile",
      },
      publishedAt: new Date("2026-06-22T00:00:00.000Z"),
    });
    prisma.workflowNode.findFirst.mockResolvedValue({
      id: "node-1",
      code: "A1-1000",
      level: 3,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);
    storage.putObject.mockResolvedValue({
      fileName: "stored.sf",
      objectKey: "working-papers/project-1/paper-1/stored.sf",
    });
    prisma.workingPaper.create.mockResolvedValue({
      id: "paper-1",
      code: "A1-1000-F001",
      title: "Engagement profile.sf",
    });
    prisma.attachment.create.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Engagement profile.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      fileSize: 100,
      mimeType: "application/vnd.project-wing.smart-form+json",
      version: 1,
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "attachment-version-1",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      headVersionId: "attachment-version-1",
    });
    prisma.smartFormInstance.create.mockResolvedValue({
      id: "instance-1",
      status: "INCOMPLETE",
    });

    await expect(
      service.createProjectSmartForm(
        "project-1",
        "node-1",
        { smartFormTemplateVersionId: "version-1", language: "en-US" },
        { id: "user-1", globalRole: "SENIOR" } as never
      )
    ).resolves.toMatchObject({ id: "attachment-1" });

    expect(storage.putObject).toHaveBeenCalledWith(
      "project-1",
      expect.any(String),
      "Engagement profile.sf",
      expect.any(Buffer),
      "application/vnd.project-wing.smart-form+json"
    );
    const storedPackage = JSON.parse(
      (storage.putObject.mock.calls[0][3] as Buffer).toString("utf-8")
    );
    expect(storedPackage.template.language).toBe("en-US");
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          fileKind: "SMART_FORM",
          originalName: "Engagement profile.sf",
          mimeType: "application/vnd.project-wing.smart-form+json",
          uploadedBy: "user-1",
        }),
      })
    );
    expect(prisma.smartFormInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          attachmentId: "attachment-1",
          smartFormTemplateId: "template-1",
          smartFormTemplateVersionId: "version-1",
          status: "INCOMPLETE",
        }),
      })
    );
  });

  it("requires library permission before adding a Smart Form to a project", async () => {
    access.requireProjectAction.mockRejectedValue(
      new Error("library permission denied")
    );

    await expect(
      service.createProjectSmartForm(
        "project-1",
        "node-1",
        { smartFormTemplateVersionId: "version-1", language: "en-US" },
        { id: "eqr-1", globalRole: "PARTNER" } as never
      )
    ).rejects.toThrow("library permission denied");

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "eqr-1",
      "useLibrary"
    );
    expect(prisma.smartFormTemplateVersion.findFirst).not.toHaveBeenCalled();
  });

  it("requires upload permission before opening Smart Form Master", async () => {
    access.requireProjectAction.mockRejectedValue(
      new Error("upload permission denied")
    );

    await expect(
      service.openMaster("project-1", "attachment-1", {
        id: "eqr-1",
        globalRole: "PARTNER",
      } as never)
    ).rejects.toThrow("upload permission denied");

    expect(access.requireProjectAction).toHaveBeenCalledWith(
      "project-1",
      "eqr-1",
      "uploadWorkingPapers"
    );
    expect(prisma.attachment.findFirst).not.toHaveBeenCalled();
  });

  it("returns persisted review questions when reopening a Smart Form read-only", async () => {
    const smartFormPackage = buildPackage();
    const persistedQuestion = {
      id: "question-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      attachmentId: "attachment-1",
      body: "Please support this procedure.",
      status: "OPEN",
      createdById: "reviewer-1",
      smartFormNodeId: "procedure-table",
      smartFormRowId: "procedure-row-1",
      smartFormTargetLabel: "Obtain the lead schedule.",
      createdAt: new Date("2026-08-02T01:00:00.000Z"),
      updatedAt: new Date("2026-08-02T01:00:00.000Z"),
      messages: [],
    };
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Audit Programme.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      version: 1,
      reviewQuestions: [persistedQuestion],
    });
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(JSON.stringify(smartFormPackage), "utf-8")
    );

    await expect(
      service.readOnly("project-1", "attachment-1", {
        id: "user-1",
      } as never)
    ).resolves.toMatchObject({
      mode: "READ_ONLY",
      attachment: { reviewQuestions: [persistedQuestion] },
    });
    expect(prisma.attachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          reviewQuestions: expect.objectContaining({
            include: expect.any(Object),
          }),
        }),
      })
    );
  });

  it("returns a lock conflict when another user owns Smart Form Master", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Engagement profile.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      version: 1,
      lockedBy: "other-user",
      lockSessionId: "lock-other",
      lockRevokedAt: null,
      lockHolder: { name: "Other User" },
    });

    await expect(
      service.openMaster("project-1", "attachment-1", {
        id: "user-1",
        globalRole: "SENIOR",
      } as never)
    ).resolves.toMatchObject({
      ok: false,
      code: "LOCKED_BY_OTHER",
      holderName: "Other User",
    });
  });

  it("saves a Smart Form package as a new attachment version without releasing the lock", async () => {
    const completedPackage = buildPackage(
      DEFERRED_INCOME_SMART_FORM_V2_RESPONSE_FIXTURE
    );
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Engagement profile.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      fileSize: 100,
      mimeType: "application/vnd.project-wing.smart-form+json",
      version: 1,
      headVersionId: "attachment-version-1",
      lockedBy: "user-1",
      lockSessionId: "lock-1",
      lockRevokedAt: null,
    });
    storage.putObject.mockResolvedValue({
      fileName: "stored-v2.sf",
      objectKey: "working-papers/project-1/paper-1/stored-v2.sf",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "attachment-version-2",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 2,
      fileName: "stored-v2.sf",
      lockSessionId: "lock-1",
    });
    prisma.smartFormInstance.upsert.mockResolvedValue({ status: "INCOMPLETE" });
    prisma.workingPaper.findMany.mockResolvedValue([
      { id: "working-paper-deferred-income-lead-schedule" },
      { id: "working-paper-deferred-income-analytics" },
    ]);

    await expect(
      service.save(
        "project-1",
        "attachment-1",
        { lockSessionId: "lock-1", package: completedPackage },
        { id: "user-1", globalRole: "SENIOR" } as never
      )
    ).resolves.toMatchObject({
      ok: true,
      mode: "MASTER",
      lockSessionId: "lock-1",
    });

    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 2,
          headVersionId: "attachment-version-2",
          lockedBy: "user-1",
          lockSessionId: "lock-1",
        }),
      })
    );
    expect(prisma.smartFormInstance.upsert).toHaveBeenCalledWith({
      where: { attachmentId: "attachment-1" },
      update: expect.objectContaining({ status: "INCOMPLETE" }),
      create: expect.objectContaining({
        projectId: "project-1",
        attachmentId: "attachment-1",
        smartFormTemplateId: "template-1",
        smartFormTemplateVersionId: "version-1",
        status: "INCOMPLETE",
      }),
    });
  });

  it("rejects working paper references that do not belong to the project", async () => {
    const auditPackage = buildPackage({
      kind: "smartFormResponse",
      schemaVersion: 2,
      definitionVersionId: validDefinition.id,
      responseLocale: "en-US",
      updatedAt: "2026-06-22T00:00:00.000Z",
      fields: {
        "external-reference": {
          type: "reference",
          references: [
            {
              targetType: "projectWing.workingPaper",
              targetId: "paper-from-another-project",
              labelSnapshot: "3200.1 External paper",
            },
          ],
        },
        "embedded-reference": {
          type: "richText",
          document: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                id: "embedded-reference-paragraph",
                content: [
                  {
                    type: "entityReference",
                    id: "embedded-reference-inline",
                    entityType: "workingPaper",
                    entityId: "embedded-paper-from-another-project",
                    labelSnapshot: "3200.2 Embedded external paper",
                  },
                ],
              },
            ],
          },
        },
      },
      sheets: {},
    });
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Loans.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      version: 1,
      lockedBy: "user-1",
      lockSessionId: "lock-1",
      lockRevokedAt: null,
    });
    prisma.workingPaper.findMany.mockResolvedValue([]);

    await expect(
      service.save(
        "project-1",
        "attachment-1",
        { lockSessionId: "lock-1", package: auditPackage },
        { id: "user-1", globalRole: "SENIOR" } as never
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "BAD_REQUEST" }),
    });

    expect(prisma.workingPaper.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        id: {
          in: [
            "paper-from-another-project",
            "embedded-paper-from-another-project",
          ],
        },
      },
      select: { id: true },
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("closes and checks in a Smart Form package by releasing the lock", async () => {
    const packagePayload = buildPackage();
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      workingPaperId: "paper-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Engagement profile.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      fileSize: 100,
      mimeType: "application/vnd.project-wing.smart-form+json",
      version: 1,
      headVersionId: "attachment-version-1",
      lockedBy: "user-1",
      lockSessionId: "lock-1",
      lockRevokedAt: null,
    });
    storage.putObject.mockResolvedValue({
      fileName: "stored-v2.sf",
      objectKey: "working-papers/project-1/paper-1/stored-v2.sf",
    });
    prisma.attachmentVersion.create.mockResolvedValue({
      id: "attachment-version-2",
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      version: 2,
      lockedBy: null,
      lockSessionId: null,
    });
    prisma.smartFormInstance.upsert.mockResolvedValue({ status: "INCOMPLETE" });

    await service.close(
      "project-1",
      "attachment-1",
      { lockSessionId: "lock-1", package: packagePayload },
      { id: "user-1", globalRole: "SENIOR" } as never
    );

    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedBy: null,
          lockSessionId: null,
          lockReleaseReason: "CHECKED_IN",
        }),
      })
    );
  });

  it("discards a Smart Form Master lock without writing a new version", async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: "attachment-1",
      projectId: "project-1",
      fileKind: "SMART_FORM",
      fileName: "stored.sf",
      originalName: "Engagement profile.sf",
      fileUrl: "working-papers/project-1/paper-1/stored.sf",
      version: 1,
      lockedBy: "user-1",
      lockSessionId: "lock-1",
      lockRevokedAt: null,
    });
    prisma.attachment.update.mockResolvedValue({
      id: "attachment-1",
      lockedBy: null,
      lockSessionId: null,
    });

    await service.discard(
      "project-1",
      "attachment-1",
      { lockSessionId: "lock-1" },
      { id: "user-1", globalRole: "SENIOR" } as never
    );

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.attachmentVersion.create).not.toHaveBeenCalled();
    expect(prisma.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedBy: null,
          lockSessionId: null,
          lockReleaseReason: "UNCHANGED_RELEASE",
        }),
      })
    );
  });
});
