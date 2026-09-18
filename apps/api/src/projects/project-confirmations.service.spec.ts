import { Prisma } from "@prisma/client";

import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
} from "../common/api-error";
import type { ConfirmationImportLinkGuardService } from "./confirmation-import-link-guard.service";
import { ProjectConfirmationCodeService } from "./project-confirmation-code.service";
import { ProjectConfirmationsService } from "./project-confirmations.service";

const templateRegistryMocks = vi.hoisted(() => ({
  isConfirmationTemplateAvailableForNewDrafts: vi.fn(() => true),
}));

vi.mock("./confirmation-template-registry", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("./confirmation-template-registry")
  >()),
  isConfirmationTemplateAvailableForNewDrafts:
    templateRegistryMocks.isConfirmationTemplateAvailableForNewDrafts,
}));

const prisma = {
  confirmationInformationLibraryEntry: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  project: {
    findUnique: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
  },
  projectConfirmationSequence: {
    upsert: vi.fn(),
  },
  projectConfirmation: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  projectConfirmationDefaults: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  confirmationTemplateLibraryBuiltInOverride: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  confirmationTemplateLibraryFile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  confirmationArtifact: {
    findUnique: vi.fn(),
  },
  projectConfirmationDispatch: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  confirmationDispatchEvent: {
    create: vi.fn(),
  },
  confirmationFollowUpEvent: {
    create: vi.fn(),
  },
  confirmationLogisticsReadState: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
};
const access = {
  requireProjectMember: vi.fn(),
  requireMutableProject: vi.fn(),
};
const auditLogs = {
  log: vi.fn(),
};
const confirmationDocuments = {
  renderPreviewPdf: vi.fn(),
  renderPreviewDocx: vi.fn(),
  renderFilledDocx: vi.fn(),
  getStoredPdf: vi.fn(),
  getStoredFile: vi.fn(),
};
const confirmationDerivedData = {
  resolve: vi.fn(),
};
const storage = {
  getObjectBuffer: vi.fn(),
  putConfirmationDispatchAttachment: vi.fn(),
  deleteObject: vi.fn(),
};
const userMail = {
  send: vi.fn(),
};
const shipmentTracking = {
  registerDispatch: vi.fn(),
  refreshTracking: vi.fn(),
};
const sourceStateGuard = {
  assertCanInvalidateSource: vi.fn(),
};
const user = { id: "user-1", globalRole: "MANAGER" } as never;
const confirmationOfficer = {
  id: "confirmation-officer-1",
  globalRole: "CONFIRMATION_OFFICER",
} as never;
const source = { ipAddress: "127.0.0.1" };

function uploadedConfirmationResponse() {
  return {
    id: "confirmation-1",
    projectId: "project-1",
    responses: [],
    currentArtifact: {
      id: "artifact-1",
      docxObjectKey: "private/source-object",
      structuredSnapshot: {
        source: "UPLOAD",
        objectKey: "private/source-object",
        fileName: "evidence.msg",
        mimeType: "application/vnd.ms-outlook",
        size: 18,
        sha256: "source-sha256",
        previewIsPdf: false,
        previewMimeType: "application/vnd.ms-outlook",
      },
    },
  };
}

function expectNoConfirmationStorageKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoConfirmationStorageKeys);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    expect([
      "objectKey",
      "attachmentObjectKey",
      "docxObjectKey",
      "pdfObjectKey",
      "structuredSnapshot",
    ]).not.toContain(key);
    expectNoConfirmationStorageKeys(nested);
  }
}

function templateTextField(id: string, binding?: "referenceCode") {
  return {
    id,
    kind: "TEXT" as const,
    name: id,
    placeholder: id,
    page: 1,
    x: 0.1,
    y: 0.1,
    width: 0.3,
    height: 0.04,
    ...(binding ? { binding } : {}),
  };
}

function validSourceRange(overrides: Record<string, unknown> = {}) {
  return {
    end: 15,
    paragraphId: "1A2B3C4D",
    paragraphOrdinal: 4,
    paragraphXmlSha256: "a".repeat(64),
    part: "word/document.xml",
    sourceText: "____",
    start: 11,
    ...overrides,
  };
}

function createService(
  codeService = new ProjectConfirmationCodeService(prisma as never),
  importLinkGuard:
    | Pick<ConfirmationImportLinkGuardService, "assertCanInvalidateSource">
    | undefined = sourceStateGuard
) {
  return new ProjectConfirmationsService(
    prisma as never,
    access as never,
    auditLogs as never,
    confirmationDocuments as never,
    codeService,
    confirmationDerivedData as never,
    storage as never,
    userMail as never,
    shipmentTracking as never,
    importLinkGuard as never,
    {
      projectValues: vi.fn((values = []) => Promise.resolve(values)),
      validateProjectValues: vi.fn((values) => Promise.resolve(values)),
    } as never
  );
}

describe(ProjectConfirmationsService, () => {
  beforeEach(() => {
    prisma.confirmationInformationLibraryEntry.findUnique.mockResolvedValue({
      requiresBankTemplate: false,
      isActive: true,
    });
    vi.clearAllMocks();
    templateRegistryMocks.isConfirmationTemplateAvailableForNewDrafts.mockReturnValue(
      true
    );
    prisma.projectConfirmation.findFirst.mockReset();
    prisma.projectConfirmation.updateMany.mockReset();
    prisma.projectConfirmationDefaults.findUnique.mockReset();
    prisma.projectConfirmationDefaults.upsert.mockReset();
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockReset();
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockReset();
    prisma.confirmationTemplateLibraryFile.findUnique.mockReset();
    prisma.confirmationTemplateLibraryFile.findMany.mockReset();
    prisma.projectConfirmationDispatch.findFirst.mockReset();
    prisma.projectConfirmationDispatch.create.mockReset();
    prisma.projectConfirmationDispatch.updateMany.mockReset();
    prisma.confirmationDispatchEvent.create.mockReset();
    prisma.confirmationLogisticsReadState.findMany.mockReset();
    prisma.confirmationLogisticsReadState.upsert.mockReset();
    sourceStateGuard.assertCanInvalidateSource.mockReset();
    shipmentTracking.registerDispatch.mockReset();
    shipmentTracking.refreshTracking.mockReset();
    storage.getObjectBuffer.mockReset();
    userMail.send.mockReset();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      projectCode: "AUD-2026-0003",
    });
    prisma.projectConfirmation.findFirst.mockResolvedValue(null);
    prisma.confirmationLogisticsReadState.findMany.mockResolvedValue([]);
    prisma.confirmationLogisticsReadState.upsert.mockResolvedValue({});
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue(null);
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValue(
      null
    );
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      []
    );
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue(null);
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValue([]);
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
    });
    prisma.projectConfirmationDispatch.findUnique.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.update.mockResolvedValue({
      id: "dispatch-1",
    });
    prisma.projectConfirmationDispatch.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.confirmationDispatchEvent.create.mockResolvedValue({
      id: "dispatch-event-1",
    });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    shipmentTracking.registerDispatch.mockResolvedValue({
      carrierCode: 100_003,
      ok: true,
      registeredAt: new Date("2026-07-05T08:00:00Z"),
    });
    confirmationDerivedData.resolve.mockResolvedValue({
      clientCode: "C-ORC",
      clientName: "Orchid Holdings",
      projectCode: "AUD-2026-0003",
      projectName: "Orchid Audit 2026",
      picName: "Engagement PIC",
      fiscalYear: 2026,
      balanceSheetDate: "2026-12-31",
      contactUserId: "user-1",
      contactName: "Project Member",
      contactEmail: "member@example.test",
      confirmationCode: "AUD-2026-0003-YH-001",
    });
  });

  it("lists project confirmations only after project membership is verified", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      { id: "confirmation-1" },
    ]);

    await expect(
      service.listForProject("project-1", user)
    ).resolves.toStrictEqual([{ id: "confirmation-1" }]);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: "project-1" } })
    );
  });

  it("lets confirmation officers read a project from the global confirmation center", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([]);

    await expect(
      service.listForProject("project-1", confirmationOfficer)
    ).resolves.toStrictEqual([]);
    await expect(
      service.getProjectConfirmationDefaults("project-1", confirmationOfficer)
    ).resolves.toStrictEqual(
      expect.objectContaining({ projectId: "project-1", clientName: null })
    );

    expect(access.requireProjectMember).not.toHaveBeenCalled();
  });

  it("adds the enabled template snapshot to a historical blank draft", async () => {
    const service = createService();
    const availableCodes = [
      "STANDARD_FINANCIAL_INSTITUTION",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    ];
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValueOnce(
      [
        {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          designStatus: "ENABLED",
        },
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "DISABLED",
        },
        {
          templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
          designStatus: "ENABLED",
        },
        {
          templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
          designStatus: "DRAFT",
        },
      ]
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "historical-blank-draft",
        projectId: "project-1",
        status: "DRAFT",
        draftPayload: { clientName: "Legacy client" },
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual({
      clientName: "Legacy client",
      templateAvailableCodes: availableCodes,
    });
  });

  it("omits retired built-ins from draft availability snapshots", async () => {
    templateRegistryMocks.isConfirmationTemplateAvailableForNewDrafts.mockReturnValue(
      false
    );
    const service = createService();
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      []
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "historical-blank-draft",
        projectId: "project-1",
        status: "DRAFT",
        draftPayload: {},
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual({
      templateAvailableCodes: [],
    });
  });

  it("loads one template snapshot for 21 project drafts and keeps a disabled current template visible", async () => {
    const service = createService();
    const frozenDesignSchema = { version: 1, fields: [] };
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "DISABLED",
          designSchema: { version: 1, fields: [{ id: "new-field" }] },
        },
      ]
    );
    prisma.projectConfirmation.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => ({
        id: `draft-${index + 1}`,
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          marker: index + 1,
          templateDesignSchema: frozenDesignSchema,
        },
      }))
    );

    const result = await service.listForProject("project-1", user);

    expect(result).toHaveLength(21);
    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findMany
    ).toHaveBeenCalledOnce();
    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
    ).not.toHaveBeenCalled();
    expect(result[0]).toStrictEqual(
      expect.objectContaining({
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: expect.objectContaining({
          templateDesignSchema: frozenDesignSchema,
          templateAvailableCodes: expect.not.arrayContaining([
            "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          ]),
        }),
      })
    );
  });

  it("loads one template snapshot for 21 office drafts", async () => {
    const service = createService();
    const designSchema = { version: 1, fields: [] };
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "ENABLED",
          designSchema,
        },
      ]
    );
    prisma.projectConfirmation.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => ({
        id: `office-draft-${index + 1}`,
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {},
      }))
    );

    const result = await service.listForOffice(confirmationOfficer);

    expect(result).toHaveLength(21);
    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findMany
    ).toHaveBeenCalledOnce();
    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
    ).not.toHaveBeenCalled();
    expect(result[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({ templateDesignSchema: designSchema })
    );
  });

  it("attaches the latest enabled custom template design to existing drafts", async () => {
    const service = createService();
    const code = "CTPL-123456789ABC";
    const designSchema = { version: 1, fields: [] };
    prisma.confirmationTemplateLibraryFile.findMany.mockResolvedValue([
      {
        code,
        designStatus: "ENABLED",
        designSchema,
        fileName: "latest.docx",
        objectKey: "confirmation-templates/latest.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ]);
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "custom-draft",
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: code,
        draftPayload: {
          templateDesignSchema: { version: 1, fields: [{ id: "old" }] },
          templateLibrarySource: {
            code,
            fileName: "old.docx",
            objectKey: "confirmation-templates/old.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        },
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        templateAvailableCodes: expect.arrayContaining([code]),
        templateDesignSchema: designSchema,
        templateLibrarySource: expect.objectContaining({
          fileName: "latest.docx",
        }),
      })
    );
  });

  it("preserves text bindings and checkbox behavior in an enabled design snapshot", async () => {
    const service = createService();
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "linked-client",
          kind: "TEXT",
          name: "Client Name",
          placeholder: "Choose client",
          options: [],
          baseInformationBinding: "clientName",
          informationLibraryBinding: "bankName",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
        {
          defaultValueSource: {
            binding: "auditorAddress",
            source: "BASE_INFORMATION",
          },
          height: 0.1,
          id: "linked-address",
          kind: "MULTILINE",
          name: "Address",
          options: [],
          page: 1,
          placeholder: "Address",
          width: 0.4,
          x: 0.1,
          y: 0.2,
        },
        {
          defaultValueSource: {
            binding: "recipientName",
            source: "INFORMATION_LIBRARY",
          },
          height: 0.04,
          id: "linked-library-contact",
          kind: "TEXT",
          name: "Library contact",
          options: [],
          page: 1,
          placeholder: "Contact",
          width: 0.3,
          x: 0.1,
          y: 0.3,
        },
        {
          defaultChecked: true,
          height: 0.04,
          id: "authorization",
          kind: "CHECKBOX",
          name: "Authorization",
          options: [],
          page: 1,
          placeholder: "Confirm authorization",
          required: true,
          width: 0.3,
          x: 0.1,
          y: 0.2,
        },
        {
          defaultValueSource: {
            source: "SYSTEM",
            value: "CURRENT_DATE",
          },
          height: 0.04,
          id: "current-date",
          kind: "DATE",
          name: "Current date",
          options: [],
          page: 1,
          placeholder: "Current date",
          width: 0.25,
          x: 0.1,
          y: 0.3,
        },
        {
          defaultValueSource: { source: "CUSTOM", value: "123.45" },
          height: 0.04,
          id: "custom-number",
          kind: "NUMBER",
          name: "Custom number",
          options: [],
          page: 1,
          placeholder: "Custom number",
          width: 0.25,
          x: 0.1,
          y: 0.4,
        },
        {
          height: 0.06,
          id: "fixed-instructions",
          kind: "STATIC_TEXT",
          name: "Fixed instructions",
          options: [],
          page: 1,
          placeholder: "Return directly to the auditor.",
          width: 0.4,
          x: 0.1,
          y: 0.5,
        },
      ],
    } as const;
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "ENABLED",
          designSchema,
        },
      ]
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "linked-draft",
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {},
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        templateDesignSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              baseInformationBinding: "clientName",
              informationLibraryBinding: "bankName",
            }),
            expect.objectContaining({
              baseInformationBinding: "auditorAddress",
              kind: "MULTILINE",
            }),
            expect.objectContaining({
              informationLibraryBinding: "recipientName",
              kind: "TEXT",
            }),
            expect.objectContaining({
              defaultChecked: true,
              kind: "CHECKBOX",
              required: true,
            }),
            expect.objectContaining({
              defaultValueSource: {
                source: "SYSTEM",
                value: "CURRENT_DATE",
              },
              kind: "DATE",
            }),
            expect.objectContaining({
              defaultValueSource: { source: "CUSTOM", value: "123.45" },
              kind: "NUMBER",
            }),
            expect.objectContaining({
              kind: "STATIC_TEXT",
              placeholder: "Return directly to the auditor.",
            }),
          ],
        }),
      })
    );
  });

  it("skips template snapshots when project and office lists have no drafts", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "prepared-confirmation",
        projectId: "project-1",
        status: "PREPARED",
      },
    ]);

    await service.listForProject("project-1", user);
    await service.listForOffice(confirmationOfficer);

    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findMany
    ).not.toHaveBeenCalled();
    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
    ).not.toHaveBeenCalled();
  });

  it("fills missing draft fields from project defaults without restoring explicitly cleared values", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "draft-1",
        projectId: "project-1",
        status: "DRAFT",
        draftPayload: {
          clientName: "Explicit client",
          officeDate: "Existing office date",
          referenceCode: "",
        },
      },
      {
        id: "frozen-1",
        projectId: "project-1",
        status: "PREPARED",
        draftPayload: { clientName: "Frozen client" },
      },
      {
        id: "type-2-draft-1",
        projectId: "project-1",
        status: "DRAFT",
        draftPayload: {
          micName: "Explicit MIC",
          micNameAndInitial: "Explicit MIC / A.",
        },
      },
    ]);
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: "Default client",
      confirmationDate: "2026-12-31",
      reference: "REF-001",
      pic: "Default PIC",
      mic: "Default MIC",
      reportDate: "2026-06-30",
    });

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        clientName: "Explicit client",
        officeDate: "Existing office date",
        referenceCode: "",
        picName: "Default PIC",
        micName: "Default MIC",
        micNameAndInitial: "Default MIC",
        reportDate: "2026-06-30",
      })
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "draft-2",
        projectId: "project-1",
        status: "DRAFT",
        draftPayload: { officeDate: "" },
      },
    ]);

    const blankOfficeDateResult = await service.listForProject(
      "project-1",
      user
    );

    expect(blankOfficeDateResult[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        clientName: "Default client",
        officeDate: "",
        picName: "Default PIC",
        micName: "Default MIC",
        micNameAndInitial: "Default MIC",
        referenceCode: "REF-001",
        reportDate: "2026-06-30",
      })
    );
    expect(result[1]?.draftPayload).toStrictEqual({
      clientName: "Frozen client",
    });
    expect(result[2]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        micName: "Explicit MIC",
        micNameAndInitial: "Explicit MIC / A.",
      })
    );
  });

  it("returns project defaults immediately when creating a new draft", async () => {
    const service = createService();
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "DRAFT",
      counterpartyName: "Broker Limited",
      confirmationCode: "AUD-2026-0003-YH-002",
      type: "OTHER",
      draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      draftPayload: {
        reportDate: "project-report-date",
        officeDate: "",
        clientName: "",
        referenceCode: "",
        picName: "",
        micName: "",
        micNameAndInitial: "",
      },
    });
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: "Default client",
      confirmationDate: "2026-12-31",
      reference: "C-HBR-010/Edric Han",
      pic: "Default PIC",
      mic: "Default MIC",
      reportDate: "2026-06-30",
    });

    const result = await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
        draftPayload: {
          reportDate: "project-report-date",
          officeDate: "",
          clientName: "",
          referenceCode: "",
          picName: "",
          micName: "",
          micNameAndInitial: "",
        },
      } as never,
      user,
      source
    );

    expect(result.draftPayload).toStrictEqual(
      expect.objectContaining({
        clientName: "Default client",
        officeDate: "2026-12-31",
        referenceCode: "",
        picName: "Default PIC",
        micName: "Default MIC",
        micNameAndInitial: "Default MIC",
        reportDate: "project-report-date",
      })
    );
    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftPayload: expect.objectContaining({
            clientName: "Default client",
            micName: "Default MIC",
            officeDate: "2026-12-31",
            picName: "Default PIC",
            reportDate: "project-report-date",
          }),
        }),
      })
    );
  });

  it("stores the enabled template snapshot when creating a blank draft", async () => {
    const service = createService();
    const availableCodes = [
      "STANDARD_FINANCIAL_INSTITUTION",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    ];
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValueOnce(
      [
        {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          designStatus: "ENABLED",
        },
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "DISABLED",
        },
        {
          templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
          designStatus: "ENABLED",
        },
        {
          templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
          designStatus: "DRAFT",
        },
      ]
    );
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "DRAFT",
      type: "BANK",
      draftTemplateCode: null,
      counterpartyName: "",
      draftPayload: {
        templateAvailableCodes: availableCodes,
      },
    });

    const result = await service.createForProject(
      "project-1",
      {
        type: "BANK",
        draftPayload: { clientName: "Blank draft" },
      } as never,
      user,
      source
    );

    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          templateCode: true,
          designStatus: true,
        }),
      })
    );
    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftTemplateCode: null,
          draftPayload: {
            clientName: "Blank draft",
            templateAvailableCodes: availableCodes,
          },
        }),
      })
    );
    expect(result.draftPayload).toStrictEqual(
      expect.objectContaining({ templateAvailableCodes: availableCodes })
    );
  });

  it("does not inject the project reference default into managed template drafts", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "standard-draft-1",
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: { referenceCode: "" },
      },
      {
        id: "overlay-draft-1",
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: { referenceCode: "USER-REF-2026" },
      },
    ]);
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: "C-HBR-010/Edric Han",
      pic: null,
      mic: null,
    });

    const result = await service.listForProject("project-1", user);

    expect(
      result.map((confirmation) => confirmation.draftPayload)
    ).toStrictEqual([
      expect.objectContaining({ referenceCode: "" }),
      expect.objectContaining({ referenceCode: "USER-REF-2026" }),
    ]);
  });

  it.each([
    { expectedReference: "", referenceCode: "" },
    { expectedReference: "USER-REF-2026", referenceCode: "USER-REF-2026" },
  ])(
    "keeps the managed template Ref $expectedReference when switching templates",
    async ({ expectedReference, referenceCode }) => {
      const service = createService();
      prisma.projectConfirmation.findFirst
        .mockResolvedValueOnce({
          id: "confirmation-1",
          status: "DRAFT",
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        })
        .mockResolvedValueOnce({
          id: "confirmation-1",
          projectId: "project-1",
          status: "DRAFT",
          counterpartyName: "HSBC Hong Kong",
          draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          draftPayload: {
            bankName: "HSBC Hong Kong",
            referenceCode,
          },
        });
      prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
        id: "defaults-1",
        projectId: "project-1",
        clientName: null,
        confirmationDate: null,
        reference: "C-HBR-010/Edric Han",
        pic: null,
        mic: null,
      });
      prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          patchSource: "MANUAL",
          draftPayload: {
            bankName: "HSBC Hong Kong",
            referenceCode,
          },
        },
        user,
        source
      );

      expect(result.draftPayload).toStrictEqual(
        expect.objectContaining({ referenceCode: expectedReference })
      );
      expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            draftPayload: expect.objectContaining({ referenceCode }),
          }),
        })
      );
    }
  );

  it("persists project confirmation defaults and records an audit event", async () => {
    const service = createService();
    const defaults = {
      id: "defaults-1",
      projectId: "project-1",
      clientName: "Orchid Holdings",
      confirmationDate: "2026-12-31",
      reference: "REF-001",
      pic: "Bonnie Su",
      mic: "Michael Chan",
      reportDate: "2026-08-15",
      createdAt: new Date("2026-08-12T08:00:00Z"),
      updatedAt: new Date("2026-08-12T08:00:00Z"),
    };
    prisma.projectConfirmationDefaults.upsert.mockResolvedValue(defaults);

    const result = await service.updateProjectConfirmationDefaults(
      "project-1",
      {
        clientName: "Orchid Holdings",
        confirmationDate: "2026-12-31",
        reference: "REF-001",
        pic: "Bonnie Su",
        mic: "Michael Chan",
        reportDate: "2026-08-15",
      },
      user,
      source
    );

    expect(result).toStrictEqual(defaults);
    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmationDefaults.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "project-1" },
        create: expect.objectContaining({
          projectId: "project-1",
          clientName: "Orchid Holdings",
          confirmationDate: "2026-12-31",
          reference: "REF-001",
          pic: "Bonnie Su",
          mic: "Michael Chan",
          reportDate: "2026-08-15",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_DEFAULTS_UPDATED",
        targetType: "PROJECT_CONFIRMATION_DEFAULTS",
        targetId: "defaults-1",
        projectId: "project-1",
      })
    );
  });

  it("repairs a prepared confirmation after a successful redispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-1",
        projectId: "project-1",
        status: "PREPARED",
        dispatches: [
          {
            id: "dispatch-10",
            sequence: 10,
            executionStatus: "SENT",
          },
        ],
      },
    ]);

    await expect(
      service.listForProject("project-1", user)
    ).resolves.toStrictEqual([
      expect.objectContaining({ status: "AWAITING_RESPONSE" }),
    ]);

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          projectId: "project-1",
          status: "PREPARED",
        }),
        data: { status: "AWAITING_RESPONSE" },
      })
    );
  });

  it("repairs legacy mojibake response file names when listing confirmations", async () => {
    const service = createService();
    const expectedFileName = "银行回函扫描件.pdf";
    const mojibakeFileName = Buffer.from(expectedFileName, "utf-8").toString(
      "latin1"
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-1",
        responses: [
          {
            attachmentName: mojibakeFileName,
            artifacts: [{ id: "artifact-1", fileName: mojibakeFileName }],
          },
        ],
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.responses[0]).toStrictEqual(
      expect.objectContaining({
        attachmentName: expectedFileName,
        artifacts: [expect.objectContaining({ fileName: expectedFileName })],
      })
    );
  });

  it("projects safe original upload metadata when listing confirmations", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      uploadedConfirmationResponse(),
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]).toStrictEqual(
      expect.objectContaining({
        attachment: {
          originalFileName: "evidence.msg",
          originalMimeType: "application/vnd.ms-outlook",
          previewability: "DOWNLOAD_ONLY",
          downloadUrl:
            "/engagement/project-1/confirmations/confirmation-1/preview.pdf",
        },
      })
    );
    expect(result[0]?.currentArtifact).not.toHaveProperty("docxObjectKey");
    expect(result[0]?.currentArtifact).not.toHaveProperty("structuredSnapshot");
  });

  it("lists every confirmation for confirmation officers without project membership", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "confirmation-1",
        projectId: "project-1",
        project: { id: "project-1", name: "Project A" },
      },
      {
        id: "confirmation-2",
        projectId: "project-2",
        project: { id: "project-2", name: "Project B" },
      },
    ]);

    await expect(
      service.listForOffice(confirmationOfficer)
    ).resolves.toHaveLength(2);

    expect(access.requireProjectMember).not.toHaveBeenCalled();
    expect(access.requireMutableProject).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it("renders a confirmation preview after project membership is verified", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      counterpartyName: "HSBC Hong Kong",
      confirmationCode: "AUD-2026-0003-YH-001",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { clientName: "Orchid", bankName: "HSBC Hong Kong" },
      project: { id: "project-1", name: "Project A", projectCode: "AUD-1" },
    };
    const preview = {
      absolutePath: "C:/tmp/preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    confirmationDocuments.renderPreviewPdf.mockResolvedValue(preview);

    await expect(
      service.previewPdfForProject("project-1", "confirmation-1", user)
    ).resolves.toBe(preview);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "confirmation-1", projectId: "project-1" },
      })
    );
    expect(confirmationDerivedData.resolve).toHaveBeenCalledWith(
      "project-1",
      user,
      "AUD-2026-0003-YH-001"
    );
    expect(confirmationDocuments.renderPreviewPdf).toHaveBeenCalledWith({
      confirmation,
      derivedSnapshot: expect.objectContaining({
        clientName: "Orchid Holdings",
        contactUserId: "user-1",
      }),
    });
  });

  it("attaches the enabled managed design before rendering a draft preview", async () => {
    const service = createService();
    const designSchema = {
      version: 1,
      fields: [
        {
          id: "manager",
          kind: "TEXT",
          name: "Manager",
          placeholder: "To the Manager",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.3,
          height: 0.04,
        },
      ],
    };
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
      confirmationCode: "AUD-2026-0003-YH-001",
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { clientName: "Orchid" },
    };
    const preview = {
      absolutePath: "C:/tmp/preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "STANDARD_FINANCIAL_INSTITUTION",
          designStatus: "ENABLED",
          designSchema,
        },
      ]
    );
    confirmationDocuments.renderPreviewPdf.mockResolvedValue(preview);

    await expect(
      service.previewPdfForProject("project-1", "confirmation-1", user)
    ).resolves.toBe(preview);

    expect(confirmationDocuments.renderPreviewPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: expect.objectContaining({
          draftPayload: expect.objectContaining({
            templateDesignSchema: designSchema,
          }),
        }),
      })
    );
  });

  it("renders a current unsaved draft payload through the filled DOCX path", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
      confirmationCode: "AUD-2026-0003-YH-001",
      draftTemplateCode: "CTPL-123456789ABC",
      draftPayload: { bankName: "HSBC Hong Kong" },
    };
    const draftOverride = {
      draftTemplateCode: "CTPL-123456789ABC" as const,
      patchSource: "MANUAL" as const,
      draftPayload: {
        bankName: "HSBC Hong Kong",
        templateFieldValues: { "dynamic-reference": "Download value" },
      },
    };
    const preview = {
      body: Buffer.from("PK docx"),
      fileName: "confirmation.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    confirmationDocuments.renderFilledDocx.mockResolvedValue(preview);

    await expect(
      service.previewDocxForProject(
        "project-1",
        "confirmation-1",
        user,
        draftOverride
      )
    ).resolves.toBe(preview);

    expect(confirmationDocuments.renderFilledDocx).toHaveBeenCalledWith({
      confirmation: expect.objectContaining({
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: expect.objectContaining({
          templateFieldValues: { "dynamic-reference": "Download value" },
        }),
      }),
      derivedSnapshot: expect.any(Object),
    });
    expect(confirmationDocuments.renderPreviewDocx).not.toHaveBeenCalled();
  });

  it("streams an uploaded confirmation PDF after project membership is verified", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      attachmentName: "bank-response.docx",
      currentArtifact: {
        id: "artifact-1",
        templateCode: "UPLOADED_DOCUMENT",
      },
    };
    const preview = {
      body: Buffer.from("%PDF-1.4 uploaded"),
      fileName: "bank-response.pdf",
      mimeType: "application/pdf",
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    prisma.confirmationArtifact.findUnique.mockResolvedValue({
      pdfObjectKey: "confirmations/project-1/artifact-1/document.pdf",
    });
    confirmationDocuments.getStoredPdf.mockResolvedValue(preview);

    await expect(
      service.previewPdfForProject("project-1", "confirmation-1", user)
    ).resolves.toBe(preview);

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(confirmationDocuments.getStoredPdf).toHaveBeenCalledWith(
      "confirmations/project-1/artifact-1/document.pdf",
      "bank-response.pdf"
    );
    expect(confirmationDerivedData.resolve).not.toHaveBeenCalled();
    expect(confirmationDocuments.renderPreviewPdf).not.toHaveBeenCalled();
  });

  it("streams an unsupported uploaded confirmation from its original object", async () => {
    const service = createService();
    const sourceBody = Buffer.from("opaque message bytes");
    const sourceKey =
      "confirmation-artifacts/project-1/artifact-1/document.docx";
    const sourceMime = "application/vnd.ms-outlook";
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      attachmentName: "evidence.msg",
      currentArtifact: {
        id: "artifact-1",
        templateCode: "UPLOADED_DOCUMENT",
      },
    };
    const delivered = {
      body: sourceBody,
      fileName: "evidence.msg",
      mimeType: sourceMime,
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    prisma.confirmationArtifact.findUnique.mockResolvedValue({
      pdfObjectKey: "confirmation-artifacts/project-1/artifact-1/document.pdf",
      docxObjectKey: sourceKey,
      structuredSnapshot: {
        source: "UPLOAD",
        objectKey: sourceKey,
        fileName: "evidence.msg",
        mimeType: sourceMime,
        size: sourceBody.byteLength,
        sha256: "source-sha256",
        previewIsPdf: false,
        previewMimeType: sourceMime,
      },
    });
    confirmationDocuments.getStoredFile.mockResolvedValue(delivered);

    const result = await service.previewPdfForProject(
      "project-1",
      "confirmation-1",
      user
    );

    expect(result).toStrictEqual({
      body: sourceBody,
      fileName: "evidence.msg",
      mimeType: "application/octet-stream",
    });

    expect(confirmationDocuments.getStoredFile).toHaveBeenCalledWith(
      sourceKey,
      "evidence.msg",
      sourceMime
    );
    expect(confirmationDocuments.getStoredPdf).not.toHaveBeenCalled();
  });

  it("limits the global confirmation ledger to joined projects for project users", async () => {
    const service = createService();
    prisma.projectConfirmation.findMany.mockResolvedValue([
      { id: "confirmation-1", projectId: "project-1" },
    ]);

    await expect(service.listForOffice(user)).resolves.toStrictEqual([
      { id: "confirmation-1", projectId: "project-1" },
    ]);

    expect(prisma.projectConfirmation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project: {
            members: {
              some: {
                userId: "user-1",
                status: "ACTIVE",
              },
            },
          },
        },
      })
    );
  });

  it("creates a draft confirmation from template-derived identity and logs the action", async () => {
    const service = createService();
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      confirmationCode: "AUD-2026-0003-BANK-002",
      typeSequence: 2,
    });

    await expect(
      service.createForProject(
        "project-1",
        {
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
          draftPayload: {
            bankName: "  HSBC Hong Kong  ",
            clientName: "Structured Client",
            counterpartyContact: "Structured contact",
            counterpartyAddress: "Structured address",
            picName: "Structured PIC",
          },
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ counterpartyName: "HSBC Hong Kong" })
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.projectConfirmationSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_type: { projectId: "project-1", type: "BANK" } },
      })
    );
    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          type: "BANK",
          confirmationCode: "AUD-2026-0003-BANK-002",
          typeSequence: 2,
          counterpartyName: "HSBC Hong Kong",
          counterpartyContact: "Structured contact",
          counterpartyAddress: "Structured address",
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
          createdBy: "user-1",
          responsibleUserId: "user-1",
        }),
      })
    );
    expect(
      prisma.projectConfirmation.create.mock.calls[0][0].data
    ).toStrictEqual(
      expect.not.objectContaining({
        responsibleUserId: "manager-1",
        clientName: "Legacy Client",
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_CREATED",
        projectId: "project-1",
        targetId: "confirmation-1",
      })
    );
  });

  it("projects safe original upload metadata when creating a confirmation", async () => {
    const service = createService();
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue(
      uploadedConfirmationResponse()
    );

    const result = await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: { bankName: "HSBC Hong Kong" },
      },
      user,
      source
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        attachment: expect.objectContaining({
          originalFileName: "evidence.msg",
          originalMimeType: "application/vnd.ms-outlook",
          previewability: "DOWNLOAD_ONLY",
        }),
      })
    );
    expect(result.currentArtifact).not.toHaveProperty("docxObjectKey");
    expect(result.currentArtifact).not.toHaveProperty("structuredSnapshot");
  });

  it("rejects retired templates when creating a new confirmation", async () => {
    templateRegistryMocks.isConfirmationTemplateAvailableForNewDrafts.mockReturnValue(
      false
    );
    const service = createService();

    await expect(
      service.createForProject(
        "project-1",
        {
          draftTemplateCode: "PRC_BANK_TEMPLATE_1",
          draftPayload: { bankName: "HSBC Hong Kong" },
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "该函证模板已停用，不能用于新建函证",
      },
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.create).not.toHaveBeenCalled();
  });

  it("persists a project Ref alongside its managed TEXT binding value", async () => {
    const service = createService();
    const sourceRange = validSourceRange();
    const designSchema = {
      version: 1,
      fields: [
        {
          ...templateTextField("dynamic-reference", "referenceCode"),
          sourceRanges: [sourceRange],
        },
      ],
    } as const;
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValueOnce(
      {
        designStatus: "ENABLED",
        designSchema,
      }
    );
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: "GENERAL-REF-001",
      pic: null,
      mic: null,
      reportDate: null,
    });
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        bankName: "HSBC Hong Kong",
        referenceCode: "GENERAL-REF-001",
        templateDesignSchema: designSchema,
        templateFieldValues: { "dynamic-reference": "Saved reference" },
      },
    });

    const result = await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          referenceCode: "",
          templateFieldValues: { "dynamic-reference": "Saved reference" },
        },
      } as never,
      user,
      source
    );

    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        },
      })
    );
    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftPayload: expect.objectContaining({
            referenceCode: "GENERAL-REF-001",
            templateDesignSchema: designSchema,
            templateFieldValues: { "dynamic-reference": "Saved reference" },
          }),
        }),
      })
    );
    expect(result.draftPayload).toStrictEqual(
      expect.objectContaining({
        referenceCode: "GENERAL-REF-001",
        templateDesignSchema: designSchema,
        templateFieldValues: { "dynamic-reference": "Saved reference" },
      })
    );
  });

  it("preserves explicit dual associations alongside a custom initial value", async () => {
    const service = createService();
    const designSchema = {
      version: 1,
      fields: [
        {
          ...templateTextField("dual-source-with-initial"),
          baseInformationBinding: "clientName",
          defaultValueSource: {
            source: "CUSTOM",
            value: "Optional initial value",
          },
          informationLibraryBinding: "recipientName",
        },
      ],
    } as const;
    prisma.confirmationTemplateLibraryBuiltInOverride.findMany.mockResolvedValue(
      [
        {
          templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          designStatus: "ENABLED",
          designSchema,
        },
      ]
    );
    prisma.projectConfirmation.findMany.mockResolvedValue([
      {
        id: "dual-source-draft",
        projectId: "project-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {},
      },
    ]);

    const result = await service.listForProject("project-1", user);

    expect(result[0]?.draftPayload).toStrictEqual(
      expect.objectContaining({
        templateDesignSchema: {
          version: 1,
          fields: [
            expect.objectContaining({
              baseInformationBinding: "clientName",
              defaultValueSource: {
                source: "CUSTOM",
                value: "Optional initial value",
              },
              informationLibraryBinding: "recipientName",
            }),
          ],
        },
      })
    );
  });

  it.each([
    [
      "a legacy paragraphText source anchor",
      {
        end: 15,
        paragraphText: "Reference: ____",
        sourceText: "____",
        start: 11,
      },
      {},
    ],
    [
      "a legacy paragraphIndex source anchor",
      { end: 15, paragraphIndex: 4, sourceText: "____", start: 11 },
      {},
    ],
    ["an extra source anchor property", validSourceRange({ extra: true }), {}],
    [
      "an unsupported source part",
      validSourceRange({ part: "word/header1.xml" }),
      {},
    ],
    [
      "an invalid paragraph hash",
      validSourceRange({ paragraphXmlSha256: "invalid" }),
      {},
    ],
    [
      "a negative paragraph ordinal",
      validSourceRange({ paragraphOrdinal: -1 }),
      {},
    ],
    ["an empty paragraph id", validSourceRange({ paragraphId: "" }), {}],
    ["an empty source range", validSourceRange({ end: 11 }), {}],
    ["a source range length mismatch", validSourceRange({ end: 14 }), {}],
    [
      "a binding on a SELECT field",
      validSourceRange(),
      { binding: "referenceCode", kind: "SELECT", options: ["Option A"] },
    ],
  ] as const)(
    "rejects an enabled template manifest with %s",
    async (_reason, sourceRange, fieldOverrides) => {
      const designSchema = {
        version: 1,
        fields: [
          {
            ...templateTextField("dynamic-reference"),
            sourceRanges: [sourceRange],
            ...fieldOverrides,
          },
        ],
      };
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValueOnce(
        {
          designStatus: "ENABLED",
          designSchema,
        }
      );
      prisma.projectConfirmationSequence.upsert.mockResolvedValue({
        nextValue: 3,
      });
      prisma.projectConfirmation.create.mockResolvedValue({
        id: "confirmation-1",
        status: "DRAFT",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {},
      });

      await expect(
        createService().createForProject(
          "project-1",
          {
            draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
            draftPayload: { bankName: "HSBC Hong Kong" },
          } as never,
          user,
          source
        )
      ).rejects.toBeInstanceOf(ApiBadRequestException);
      expect(prisma.projectConfirmation.create).not.toHaveBeenCalled();
    }
  );

  it("keeps non-empty manually entered general-fill values when creating a managed draft", async () => {
    const service = createService();
    const designSchema = {
      version: 1,
      fields: [templateTextField("dynamic-reference", "referenceCode")],
    } as const;
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValueOnce(
      {
        designStatus: "ENABLED",
        designSchema,
      }
    );
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: "Default client",
      confirmationDate: "2026-12-31",
      reference: "DEFAULT-REF",
      pic: "Default PIC",
      mic: "Default MIC",
      reportDate: "2026-06-30",
    });
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
    });

    await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          clientName: "Manual client",
          officeDate: "2026-08-15",
          referenceCode: "MANUAL-REF",
          picName: "Manual PIC",
          micName: "Manual MIC",
          reportDate: "2026-03-31",
        },
      } as never,
      user,
      source
    );

    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftPayload: expect.objectContaining({
            clientName: "Manual client",
            officeDate: "2026-08-15",
            referenceCode: "MANUAL-REF",
            picName: "Manual PIC",
            micName: "Manual MIC",
            reportDate: "2026-03-31",
          }),
        }),
      })
    );
  });

  it("persists template values while excluding unknown field values", async () => {
    const service = createService();
    const designSchema = {
      version: 1,
      fields: [
        templateTextField("dynamic-reference", "referenceCode"),
        templateTextField("dynamic-note"),
      ],
    } as const;
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValueOnce(
      {
        designStatus: "ENABLED",
        designSchema,
      }
    );
    prisma.projectConfirmationDefaults.findUnique.mockResolvedValue({
      id: "defaults-1",
      projectId: "project-1",
      clientName: null,
      confirmationDate: null,
      reference: "GENERAL-REF-001",
      pic: null,
      mic: null,
      reportDate: null,
    });
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
    });

    await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          referenceCode: "",
          templateFieldValues: {
            "dynamic-reference": "Duplicate reference",
            "dynamic-note": "Persist this note",
            unknown: "Drop this value",
          },
        },
      } as never,
      user,
      source
    );

    const savedDraft = prisma.projectConfirmation.create.mock.calls[0]?.[0].data
      .draftPayload as Record<string, unknown>;
    expect(savedDraft).toStrictEqual(
      expect.objectContaining({
        referenceCode: "GENERAL-REF-001",
        templateDesignSchema: designSchema,
        templateFieldValues: {
          "dynamic-note": "Persist this note",
          "dynamic-reference": "Duplicate reference",
        },
      })
    );
  });

  it("drops a forged MASK schema when creating a managed draft and restores the built-in design", async () => {
    const service = createService();
    const forgedMaskSchema = {
      version: 1,
      fields: [
        {
          id: "forged-full-page-mask",
          kind: "MASK",
          page: 1,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
    } as const;
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 3,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
    });

    await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          templateDesignSchema: forgedMaskSchema,
          templateFieldValues: { "forged-full-page-mask": "ignored" },
        },
      } as never,
      user,
      source
    );

    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftPayload: expect.objectContaining({
            templateDesignSchema: expect.objectContaining({
              version: 1,
              fields: expect.arrayContaining([
                expect.objectContaining({
                  binding: "recipientName",
                  id: "confirmation-to-the-manager",
                }),
              ]),
            }),
          }),
        }),
      })
    );
    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          draftPayload: expect.objectContaining({ templateFieldValues: {} }),
        }),
      })
    );
  });

  it("rejects a database template row that is not currently ENABLED", async () => {
    const service = createService();
    prisma.projectConfirmation.create.mockReset();
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 4,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-2",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
    });
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValueOnce(
      {
        designStatus: "DRAFT",
        designSchema: null,
      }
    );

    await expect(
      service.createForProject(
        "project-1",
        {
          draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          draftPayload: { bankName: "HSBC Hong Kong" },
        } as never,
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "该函证模板已停用，不能用于新建函证",
      },
    });

    expect(prisma.projectConfirmation.create).not.toHaveBeenCalled();
  });

  it("creates a draft confirmation with a blank third-party name when the structured field is absent", async () => {
    const service = createService();
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 2,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "",
    });

    await expect(
      service.createForProject(
        "project-1",
        {
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ counterpartyName: "" }));

    expect(prisma.projectConfirmation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "BANK",
          counterpartyName: "",
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        }),
      })
    );
  });

  it("retries recognized confirmation type-sequence allocation races", async () => {
    const service = createService();
    const uniqueRace = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["projectId", "type", "typeSequence"] },
      }
    );
    prisma.$transaction
      .mockRejectedValueOnce(uniqueRace)
      .mockImplementationOnce((callback) => callback(prisma));
    prisma.projectConfirmationSequence.upsert.mockResolvedValue({
      nextValue: 4,
    });
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      confirmationCode: "AUD-2026-0003-YH-003",
      typeSequence: 3,
    });

    await expect(
      service.createForProject(
        "project-1",
        {
          draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
          draftPayload: { bankName: "HSBC Hong Kong" },
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        confirmationCode: "AUD-2026-0003-YH-003",
        typeSequence: 3,
      })
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.projectConfirmation.create).toHaveBeenCalledOnce();
  });

  it("advances past stale sequence rows without retrying the transaction", async () => {
    const service = createService();
    prisma.projectConfirmationSequence.upsert
      .mockResolvedValueOnce({ nextValue: 2 })
      .mockResolvedValueOnce({ nextValue: 3 });
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({ id: "legacy-confirmation" })
      .mockResolvedValueOnce(null);
    prisma.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-2",
      counterpartyName: "",
      confirmationCode: "AUD-2026-0003-YH-002",
      typeSequence: 2,
    });

    await expect(
      service.createForProject(
        "project-1",
        { draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION" },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        confirmationCode: "AUD-2026-0003-YH-002",
        typeSequence: 2,
      })
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.projectConfirmationSequence.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.projectConfirmation.create).toHaveBeenCalledOnce();
  });

  it("does not retry unrelated unique conflicts", async () => {
    const service = createService();
    const unrelatedConflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["confirmationCode"] },
      }
    );
    prisma.$transaction.mockRejectedValue(unrelatedConflict);

    await expect(
      service.createForProject(
        "project-1",
        { draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION" },
        user,
        source
      )
    ).rejects.toBe(unrelatedConflict);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("stops retrying persistent type-sequence conflicts after three attempts", async () => {
    const service = createService();
    const persistentConflict = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["projectId", "type", "typeSequence"] },
      }
    );
    prisma.$transaction.mockRejectedValue(persistentConflict);

    await expect(
      service.createForProject(
        "project-1",
        { draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION" },
        user,
        source
      )
    ).rejects.toBe(persistentConflict);

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("allocates and creates through the same transaction callback", async () => {
    const transactionClient = {
      projectConfirmationSequence: { upsert: vi.fn() },
      projectConfirmation: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const codeService = {
      allocate: vi.fn(),
      allocateInTransaction: vi.fn().mockResolvedValue({
        confirmationCode: "AUD-2026-0003-YH-001",
        sequence: 1,
      }),
    };
    const service = createService(codeService as never);
    prisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient)
    );
    transactionClient.projectConfirmation.create.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
    });

    await service.createForProject(
      "project-1",
      {
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: { bankName: "HSBC Hong Kong" },
      },
      user,
      source
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(codeService.allocateInTransaction).toHaveBeenCalledWith(
      transactionClient,
      "project-1",
      "AUD-2026-0003",
      "BANK"
    );
    expect(transactionClient.projectConfirmation.create).toHaveBeenCalledOnce();
    expect(codeService.allocate).not.toHaveBeenCalled();
  });

  it("does not write authoritative fields injected into a generic update", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "Legal Counsel",
    });

    await expect(
      service.updateForProject(
        "project-1",
        "confirmation-1",
        {
          confirmationType: "LAWYER",
          status: "PREPARED",
          clientName: "Legacy Client",
          counterpartyName: "Legal Counsel",
          confirmationCode: "LC-001",
          auditPeriod: "2026",
          respondingEntityName: "Responding Entity",
          thirdPartyName: "Third Party",
          subjectName: "Subject",
          attachmentName: "Attachment",
          counterpartyContact: "Contact",
          counterpartyAddress: "Address",
          responsibleUserId: "manager-1",
          differenceStatus: "MATCHED",
          notes: "Allowed review note",
        } as never,
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "confirmation-1" }));

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "confirmation-1" },
        data: { notes: "Allowed review note" },
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_UPDATED",
        projectId: "project-1",
        targetId: "confirmation-1",
      })
    );
  });

  it("removes storage internals from generic mutation responses recursively", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      currentArtifact: {
        docxObjectKey: "private/source.docx",
        pdfObjectKey: "private/preview.pdf",
        structuredSnapshot: { objectKey: "private/source.docx" },
      },
      responses: [
        {
          artifacts: [
            { objectKey: "private/response.pdf", fileName: "response.pdf" },
          ],
        },
      ],
      dispatches: [{ attachmentObjectKey: "private/sent.pdf" }],
    });

    const result = await service.updateForProject(
      "project-1",
      "confirmation-1",
      { notes: "safe update" } as never,
      user,
      source
    );

    expect(result).toBeDefined();
    expectNoConfirmationStorageKeys(result);
  });

  it("reclassifies a confirmation and allocates the destination category sequence", async () => {
    const transactionClient = {
      projectConfirmation: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const codeService = {
      allocateInTransaction: vi.fn().mockResolvedValue({
        confirmationCode: "AUD-2026-0003-ZJJG-003",
        sequence: 3,
      }),
    };
    const service = createService(codeService as never);
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      type: "BANK",
      status: "DRAFT",
      project: { projectCode: "AUD-2026-0003" },
    });
    prisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient)
    );
    transactionClient.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      counterpartyName: "HSBC Hong Kong",
      type: "INTERMEDIARY",
    });

    await service.updateForProject(
      "project-1",
      "confirmation-1",
      { type: "INTERMEDIARY" },
      user,
      source
    );

    expect(codeService.allocateInTransaction).toHaveBeenCalledWith(
      transactionClient,
      "project-1",
      "AUD-2026-0003",
      "INTERMEDIARY"
    );
    expect(transactionClient.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          type: "INTERMEDIARY",
          confirmationCode: "AUD-2026-0003-ZJJG-003",
          typeSequence: 3,
        },
      })
    );
  });

  it("skips occupied destination sequences inside one reclassification transaction", async () => {
    const transactionClient = {
      projectConfirmation: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    const codeService = {
      allocateInTransaction: vi
        .fn()
        .mockResolvedValueOnce({
          confirmationCode: "AUD-2026-0003-ZJJG-001",
          sequence: 1,
        })
        .mockResolvedValueOnce({
          confirmationCode: "AUD-2026-0003-ZJJG-002",
          sequence: 2,
        })
        .mockResolvedValueOnce({
          confirmationCode: "AUD-2026-0003-ZJJG-003",
          sequence: 3,
        }),
    };
    const service = createService(codeService as never);
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      type: "BANK",
      status: "DRAFT",
      project: { projectCode: "AUD-2026-0003" },
    });
    prisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient)
    );
    transactionClient.projectConfirmation.findFirst
      .mockResolvedValueOnce({ id: "existing-intermediary-1" })
      .mockResolvedValueOnce({ id: "existing-intermediary-2" })
      .mockResolvedValueOnce(null);
    transactionClient.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      confirmationCode: "AUD-2026-0003-ZJJG-003",
      counterpartyName: "HSBC Hong Kong",
      type: "INTERMEDIARY",
    });

    await service.updateForProject(
      "project-1",
      "confirmation-1",
      { type: "INTERMEDIARY" },
      user,
      source
    );

    expect(codeService.allocateInTransaction).toHaveBeenCalledTimes(3);
    expect(transactionClient.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "INTERMEDIARY",
          confirmationCode: "AUD-2026-0003-ZJJG-003",
          typeSequence: 3,
        }),
      })
    );
  });

  it("moves a confirmation to the recycle bin and remembers its prior status", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "PREPARED",
      counterpartyName: "HSBC Hong Kong",
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "VOIDED",
      voidedFromStatus: "PREPARED",
    });

    await expect(
      service.voidProjectConfirmation(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      id: "confirmation-1",
      status: "VOIDED",
      voidedFromStatus: "PREPARED",
    });

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        projectId: "project-1",
        status: "PREPARED",
      },
      data: {
        status: "VOIDED",
        voidedFromStatus: "PREPARED",
      },
    });
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationId: "confirmation-1",
        projectId: "project-1",
        actorId: "user-1",
      }),
      "VOID_CONFIRMATION"
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_VOIDED",
        targetId: "confirmation-1",
        projectId: "project-1",
      })
    );
  });

  it("blocks moving a confirmation to the recycle bin when EMP still owns its source", async () => {
    const service = createService(
      new ProjectConfirmationCodeService(prisma as never),
      sourceStateGuard
    );
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "CLOSED",
      counterpartyName: "HSBC Hong Kong",
    });
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：GROUPED 导入 import-job-1（2026/Confirmation responses）。请先从 EMP 撤回该导入后，再将函证移入回收站。"
      )
    );

    await expect(
      service.voidProjectConfirmation(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("先从 EMP 撤回"),
      },
    });
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationId: "confirmation-1",
        projectId: "project-1",
        actorId: "user-1",
      }),
      "VOID_CONFIRMATION"
    );
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetId: "confirmation-1",
        projectId: "project-1",
      })
    );
  });

  it("keeps the EMP source block when the blocked-attempt audit write fails", async () => {
    const service = createService(
      new ProjectConfirmationCodeService(prisma as never),
      sourceStateGuard
    );
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：FLAT 导入 import-job-1（EMP/WP-001）。请先从 EMP 撤回该导入后，再将函证移入回收站。"
      )
    );
    auditLogs.log.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      service.voidProjectConfirmation(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("请先从 EMP 撤回"),
      },
    });
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("rechecks the source guard with the transaction client before voiding", async () => {
    const service = createService(
      new ProjectConfirmationCodeService(prisma as never),
      sourceStateGuard
    );
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "PREPARED",
      counterpartyName: "HSBC Hong Kong",
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "VOIDED",
      voidedFromStatus: "PREPARED",
    });
    sourceStateGuard.assertCanInvalidateSource.mockResolvedValue(
      undefined as never
    );

    await service.voidProjectConfirmation(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledTimes(2);
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ confirmationId: "confirmation-1" }),
      "VOID_CONFIRMATION",
      prisma
    );
  });

  it("restores a confirmation to the status it had before entering the recycle bin", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "VOIDED",
      voidedFromStatus: "AWAITING_RESPONSE",
      counterpartyName: "HSBC Hong Kong",
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      voidedFromStatus: null,
    });

    await expect(
      service.restoreProjectConfirmation(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      voidedFromStatus: null,
    });

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        projectId: "project-1",
        status: "VOIDED",
      },
      data: {
        status: "AWAITING_RESPONSE",
        voidedFromStatus: null,
      },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESTORED",
        targetId: "confirmation-1",
        projectId: "project-1",
      })
    );
  });

  it("does not reclassify a confirmation after it leaves draft status", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      type: "BANK",
      status: "AWAITING_RESPONSE",
      project: { projectCode: "AUD-2026-0003" },
    });

    await expect(
      service.updateForProject(
        "project-1",
        "confirmation-1",
        { type: "INTERMEDIARY" },
        user,
        source
      )
    ).rejects.toThrow("Only draft confirmations can be reclassified");

    expect(prisma.projectConfirmation.update).not.toHaveBeenCalled();
  });

  it.each(["create", "update"])(
    "rejects a restricted bank source during draft %s",
    async (operation) => {
      prisma.confirmationInformationLibraryEntry.findUnique.mockResolvedValue({
        requiresBankTemplate: true,
        isActive: true,
      });
      const input = {
        draftTemplateCode: "PRC_BANK_TEMPLATE_1" as const,
        patchSource: "MANUAL" as const,
        draftPayload: { confirmationInformationLibraryEntryId: "hk-bank-004" },
      };
      const service = createService();
      const result =
        operation === "create"
          ? service.createForProject("project-1", input as never, user, source)
          : service.updateDraftForProject(
              "project-1",
              "confirmation-1",
              input,
              user,
              source
            );
      await expect(result).rejects.toThrow("该银行要求使用银行指定格式");
      expect(prisma.projectConfirmation.create).not.toHaveBeenCalled();
      expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    }
  );

  it("stores structured draft payloads and derives authoritative ledger identity", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "DRAFT",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "DRAFT",
        projectId: "project-1",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        draftPayload: {
          clientName: "Orchid Holdings",
          bankName: "  HSBC Hong Kong  ",
          confirmationInformationLibraryEntryId: "hk-bank-012",
          counterpartyAddress: "1 Queen's Road Central",
          counterpartyAttention: "Bank confirmation",
          counterpartyContact: "Confirmation desk",
          picName: "Client-provided PIC",
          draftNotes: "Use template 1",
        },
      });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode: "PRC_BANK_TEMPLATE_1",
          patchSource: "BANK_MASTER",
          draftPayload: {
            clientName: "Orchid Holdings",
            bankName: "  HSBC Hong Kong  ",
            confirmationInformationLibraryEntryId: "hk-bank-012",
            counterpartyAddress: "1 Queen's Road Central",
            counterpartyAttention: "Bank confirmation",
            counterpartyContact: "Confirmation desk",
            picName: "Client-provided PIC",
            draftNotes: "Use template 1",
          },
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        draftPayload: expect.objectContaining({
          confirmationInformationLibraryEntryId: "hk-bank-012",
          counterpartyAddress: "1 Queen's Road Central",
          counterpartyAttention: "Bank confirmation",
          counterpartyContact: "Confirmation desk",
        }),
      })
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "confirmation-1",
          projectId: "project-1",
          status: "DRAFT",
        },
        data: expect.objectContaining({
          draftTemplateCode: "PRC_BANK_TEMPLATE_1",
          draftPayload: expect.objectContaining({
            clientName: "Orchid Holdings",
            bankName: "  HSBC Hong Kong  ",
            confirmationInformationLibraryEntryId: "hk-bank-012",
            counterpartyAddress: "1 Queen's Road Central",
            counterpartyAttention: "Bank confirmation",
            counterpartyContact: "Confirmation desk",
          }),
          draftUpdatedAt: expect.any(Date),
          counterpartyName: "HSBC Hong Kong",
          counterpartyAddress: "1 Queen's Road Central",
          counterpartyContact: "Confirmation desk",
        }),
      })
    );
    expect(
      prisma.projectConfirmation.updateMany.mock.calls[0][0].data
    ).toStrictEqual(
      expect.not.objectContaining({
        clientName: "Orchid Holdings",
        notes: "Use template 1",
        responsibleUserId: expect.anything(),
        type: expect.anything(),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_DRAFT_UPDATED",
        projectId: "project-1",
        targetId: "confirmation-1",
        description: expect.stringContaining("BANK_MASTER"),
      })
    );
  });

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)(
    "keeps the frozen design and filters dynamic values on a same-template save for %s",
    async (draftTemplateCode) => {
      const service = createService();
      const frozenDesignSchema = {
        version: 1,
        fields: [
          {
            id: "approved-text",
            kind: "TEXT",
            name: "Approved text",
            placeholder: "",
            options: [],
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.04,
          },
        ],
      } as const;
      const forgedMaskSchema = {
        version: 1,
        fields: [
          {
            id: "forged-mask",
            kind: "MASK",
            name: "",
            placeholder: "",
            options: [],
            page: 1,
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ],
      } as const;
      prisma.projectConfirmation.findFirst
        .mockResolvedValueOnce({
          id: "confirmation-1",
          status: "DRAFT",
          draftTemplateCode,
          draftPayload: {
            templateDesignSchema: frozenDesignSchema,
            templateFieldValues: { "approved-text": "Previous value" },
          },
        })
        .mockResolvedValueOnce({
          id: "confirmation-1",
          projectId: "project-1",
          status: "DRAFT",
          counterpartyName: "HSBC Hong Kong",
          draftTemplateCode,
          draftPayload: {},
        });

      await service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode,
          patchSource: "MANUAL",
          draftPayload: {
            bankName: "HSBC Hong Kong",
            recipientName: "HSBC Hong Kong",
            templateDesignSchema: forgedMaskSchema,
            templateFieldValues: {
              "approved-text": "Accepted value",
              "forged-mask": "Injected value",
              unknown: "Injected value",
            },
          },
        } as never,
        user,
        source
      );

      expect(prisma.projectConfirmation.findFirst).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          select: expect.objectContaining({ draftPayload: true }),
        })
      );
      expect(
        prisma.projectConfirmation.updateMany.mock.calls[0][0].data.draftPayload
      ).toStrictEqual(
        expect.objectContaining({
          templateDesignSchema: frozenDesignSchema,
          templateFieldValues: { "approved-text": "Accepted value" },
        })
      );
    }
  );

  it("keeps the latest custom design geometry and source while saving instance text formatting", async () => {
    const service = createService();
    const code = "CTPL-123456789ABC";
    const latestDesignSchema = {
      version: 1,
      fields: [
        {
          ...templateTextField("new-field"),
          placeholder: "New field",
        },
      ],
    } as const;
    prisma.confirmationTemplateLibraryFile.findUnique.mockResolvedValue({
      code,
      name: "Latest custom template",
      confirmationType: "BANK",
      designStatus: "ENABLED",
      designSchema: latestDesignSchema,
      fileName: "latest.docx",
      objectKey: "confirmation-templates/latest.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "DRAFT",
        draftTemplateCode: code,
        draftPayload: {
          templateDesignSchema: {
            version: 1,
            fields: [templateTextField("old-field")],
          },
        },
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        projectId: "project-1",
        status: "DRAFT",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: code,
        draftPayload: {},
      });

    await service.updateDraftForProject(
      "project-1",
      "confirmation-1",
      {
        draftTemplateCode: code,
        patchSource: "MANUAL",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                ...templateTextField("new-field"),
                height: 0.8,
                textStyle: {
                  bold: true,
                  fontFamily: "Arial",
                  fontSize: 18,
                  italic: false,
                  textColor: "#166534",
                  underline: true,
                },
                width: 0.9,
                x: 0,
                y: 0,
              },
            ],
          },
          templateFieldValues: { "new-field": "Accepted value" },
        },
      } as never,
      user,
      source
    );

    expect(
      prisma.projectConfirmation.updateMany.mock.calls[0][0].data.draftPayload
    ).toStrictEqual(
      expect.objectContaining({
        templateLibrarySource: expect.objectContaining({
          objectKey: "confirmation-templates/latest.docx",
          fileName: "latest.docx",
        }),
        templateDesignSchema: {
          version: 1,
          fields: [
            expect.objectContaining({
              height: latestDesignSchema.fields[0].height,
              id: "new-field",
              textStyle: {
                bold: true,
                fontFamily: "Arial",
                fontSize: 18,
                italic: false,
                textColor: "#166534",
                underline: true,
              },
              width: latestDesignSchema.fields[0].width,
              x: latestDesignSchema.fields[0].x,
              y: latestDesignSchema.fields[0].y,
            }),
          ],
        },
        templateFieldValues: { "new-field": "Accepted value" },
      })
    );
  });

  it("rejects a same-template save when the frozen managed manifest uses a legacy source anchor", async () => {
    const service = createService();
    const frozenDesignSchema = {
      version: 1,
      fields: [
        {
          ...templateTextField("approved-text"),
          sourceRanges: [
            {
              end: 15,
              paragraphText: "Reference: ____",
              sourceText: "____",
              start: 11,
            },
          ],
        },
      ],
    };
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "DRAFT",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          templateDesignSchema: frozenDesignSchema,
          templateFieldValues: { "approved-text": "Previous value" },
        },
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        projectId: "project-1",
        status: "DRAFT",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {},
      });

    await expect(
      service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
          patchSource: "MANUAL",
          draftPayload: {
            bankName: "HSBC Hong Kong",
            templateFieldValues: { "approved-text": "Accepted value" },
          },
        } as never,
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "PRC_BANK_TEMPLATE_1",
    "PRC_BANK_TEMPLATE_2",
    "SHINEWING_ENG_BANK",
  ] as const)(
    "strips dynamic template properties from the legacy template %s",
    async (draftTemplateCode) => {
      const service = createService();
      prisma.projectConfirmation.findFirst
        .mockResolvedValueOnce({
          id: "confirmation-1",
          status: "DRAFT",
          draftTemplateCode,
          draftPayload: { bankName: "HSBC Hong Kong" },
        })
        .mockResolvedValueOnce({
          id: "confirmation-1",
          projectId: "project-1",
          status: "DRAFT",
          counterpartyName: "HSBC Hong Kong",
          draftTemplateCode,
          draftPayload: {},
        });

      await service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode,
          patchSource: "MANUAL",
          draftPayload: {
            bankName: "HSBC Hong Kong",
            templateDesignSchema: {
              version: 1,
              fields: [],
            },
            templateFieldValues: { injected: "Injected value" },
          },
        } as never,
        user,
        source
      );

      const savedDraft =
        prisma.projectConfirmation.updateMany.mock.calls[0][0].data
          .draftPayload;
      expect(savedDraft).not.toHaveProperty("templateDesignSchema");
      expect(savedDraft).not.toHaveProperty("templateFieldValues");
    }
  );

  it("rejects switching a draft from an active template to a retired template", async () => {
    templateRegistryMocks.isConfirmationTemplateAvailableForNewDrafts.mockReturnValue(
      false
    );
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
    });

    await expect(
      service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode: "PRC_BANK_TEMPLATE_1",
          patchSource: "MANUAL",
          draftPayload: { bankName: "HSBC Hong Kong" },
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "该函证模板已停用，不能切换到此模板",
      },
    });

    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects draft updates once the confirmation is no longer a draft", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "PREPARED",
    });

    await expect(
      service.updateDraftForProject(
        "project-1",
        "confirmation-1",
        {
          draftTemplateCode: "PRC_BANK_TEMPLATE_1",
          patchSource: "MANUAL",
          draftPayload: {
            bankName: "HSBC Hong Kong",
          },
        },
        user,
        source
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);

    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a draft update race when the conditional write affects no rows", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
    });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 0 });

    const result = service.updateDraftForProject(
      "project-1",
      "confirmation-1",
      {
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        patchSource: "MANUAL",
        draftPayload: { bankName: "HSBC Hong Kong" },
      },
      user,
      source
    );

    await expect(result).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "Only draft confirmations can be updated",
      },
    });
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "confirmation-1",
          projectId: "project-1",
          status: "DRAFT",
        },
      })
    );
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("creates the next dispatch attempt and moves the confirmation to awaiting response", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "PREPARED",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 2,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-3",
      trackingNumber: "SF123456",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          method: "COURIER",
          sentAt: "2026-07-05",
          recipientName: "Confirmation desk",
          recipientPhone: "+852 1234 5678",
          courierName: "SF Express",
          trackingNumber: "SF123456",
          trackingCarrierCode: 191_222,
          followUpDate: "2026-07-20",
          notes: "Second reminder was sent by courier",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
      })
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-1",
          sequence: 3,
          method: "COURIER",
          recipientName: "Confirmation desk",
          recipientPhone: "+852 1234 5678",
          courierName: "SF Express",
          trackingNumber: "SF123456",
          trackingProvider: "17TRACK",
          trackingCarrierCode: 191_222,
          executionStatus: "STARTED",
          createdBy: "user-1",
          events: {
            create: expect.arrayContaining([
              expect.objectContaining({ eventType: "STARTED" }),
            ]),
          },
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "confirmation-1", status: "PREPARED" },
        data: {
          status: "AWAITING_RESPONSE",
          queueClaimedBy: null,
          queueClaimedAt: null,
        },
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_DISPATCH_CREATED",
        projectId: "project-1",
        targetId: "dispatch-3",
      })
    );
    expect(shipmentTracking.registerDispatch).toHaveBeenCalledWith(
      "dispatch-3",
      "SF123456",
      191_222
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-3" },
        data: expect.objectContaining({
          executionStatus: "SENT",
          trackingCarrierCode: 100_003,
          trackingError: null,
          events: {
            create: expect.objectContaining({ eventType: "SENT" }),
          },
        }),
      })
    );
  });

  it("records a manual follow-up event while awaiting a response", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
    });

    await service.createFollowUpEventForConfirmation(
      "project-1",
      "confirmation-1",
      {
        eventType: "COUNTERPARTY_RECEIVED",
        notes: "Confirmed receipt by phone",
      },
      user,
      source
    );

    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-1",
        eventType: "COUNTERPARTY_RECEIVED",
        actorId: "user-1",
        source: "PROJECT_TEAM_MANUAL",
        notes: "Confirmed receipt by phone",
      }),
    });
  });

  it("allows one redispatch after a newer redispatch request without changing the workflow status", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      trackingNumber: "SF-REDISPATCH-2",
    });

    await service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        method: "COURIER",
        isRedispatch: true,
        sentAt: "2026-07-06",
        trackingNumber: "SF-REDISPATCH-2",
      },
      user,
      source
    );

    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-1",
          sequence: 2,
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          status: { in: ["AWAITING_RESPONSE", "PREPARED"] },
          differenceStatus: "EXCEPTION",
        }),
        data: {
          queueClaimedBy: expect.any(String),
          queueClaimedAt: expect.any(Date),
        },
      })
    );
  });

  it("sends a revised frozen draft as the next redispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "PREPARED",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-2",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      trackingNumber: "SF-REDISPATCH-2",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "12121212-1212-4121-8121-121212121212",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-2",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          status: { in: ["AWAITING_RESPONSE", "PREPARED"] },
        }),
        data: expect.objectContaining({
          status: "AWAITING_RESPONSE",
          queueClaimedBy: null,
          queueClaimedAt: null,
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["AWAITING_RESPONSE", "PREPARED"] },
          differenceStatus: "EXCEPTION",
        }),
      })
    );
    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactId: "artifact-2",
          sequence: 2,
        }),
      })
    );
  });

  it("sends a newly frozen replacement even when the review request event is missing", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "PREPARED",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-3",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-8",
          artifactId: "artifact-2",
          sequence: 8,
          sentAt: new Date("2026-08-06T06:20:00.000Z"),
          createdAt: new Date("2026-08-06T06:20:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 8,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-9",
      trackingNumber: "SF-REDISPATCH-9",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "13131313-1313-4131-8131-131313131313",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-08-07",
          trackingNumber: "SF-REDISPATCH-9",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );

    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifactId: "artifact-3",
          sequence: 9,
        }),
      })
    );
  });

  it("allows only one redispatch reservation for different idempotency keys before calling the courier", async () => {
    const service = createService();
    const existing = {
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(existing);
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockImplementation(
      async ({ data }) => {
        await Promise.resolve();
        return {
          id:
            data.idempotencyKey === "11111111-1111-4111-8111-111111111111"
              ? "dispatch-first"
              : "dispatch-second",
          trackingNumber: data.trackingNumber,
        };
      }
    );
    let reservationActive = false;
    prisma.projectConfirmation.updateMany.mockImplementation(
      async ({ where }) => {
        await Promise.resolve();
        if (where.dispatches?.none) {
          if (reservationActive) {
            return { count: 0 };
          }
          reservationActive = true;
        }
        return { count: 1 };
      }
    );
    let markExternalStarted!: () => void;
    let releaseExternal!: () => void;
    const externalStarted = new Promise<void>((resolve) => {
      markExternalStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseExternal = resolve;
    });
    let externalCalls = 0;
    shipmentTracking.registerDispatch.mockImplementation(async () => {
      externalCalls += 1;
      markExternalStarted();
      if (externalCalls === 1) {
        await release;
      }
      return {
        carrierCode: 100_003,
        ok: true,
        registeredAt: new Date("2026-07-06T08:00:00Z"),
      };
    });

    const first = service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        method: "COURIER",
        isRedispatch: true,
        sentAt: "2026-07-06",
        trackingNumber: "SF-REDISPATCH-1",
      },
      user,
      source
    );
    await externalStarted;

    const second = service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        method: "COURIER",
        isRedispatch: true,
        sentAt: "2026-07-06",
        trackingNumber: "SF-REDISPATCH-2",
      },
      user,
      source
    );
    const secondResult = await second.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, error })
    );

    expect(shipmentTracking.registerDispatch).toHaveBeenCalledOnce();
    releaseExternal();
    await expect(first).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );
    expect(secondResult).toMatchObject({
      status: "rejected",
      error: { response: { code: "CONFIRMATION_STATE_CONFLICT" } },
    });
  });

  it("does not write a late follow-up event when response registration wins", async () => {
    const service = createService();
    const responseRegistrationWon = new Error("response registration won");
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createFollowUpEventForConfirmation(
        "project-1",
        "confirmation-1",
        { eventType: "COUNTERPARTY_RECEIVED" },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(responseRegistrationWon).toBeInstanceOf(Error);
  });

  it("does not call the courier when the redispatch reservation loses its state CAS", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "33333333-3333-4333-8333-333333333333",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-3",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
    expect(shipmentTracking.registerDispatch).not.toHaveBeenCalled();
  });

  it("allows only one redispatch reservation for different idempotency keys before sending email", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: {
        disposition: "ACTIVE",
        pdfObjectKey: "confirmations/frozen.pdf",
      },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockImplementation(
      async ({ data }) => {
        await Promise.resolve();
        return {
          id:
            data.idempotencyKey === "55555555-5555-4555-8555-555555555555"
              ? "dispatch-email-first"
              : "dispatch-email-second",
          sequence: data.sequence,
        };
      }
    );
    prisma.projectConfirmation.updateMany.mockImplementation(
      async ({ where }) => {
        await Promise.resolve();
        if (
          where.dispatches?.none &&
          prisma.confirmationDispatchEvent.create.mock.calls.length > 0
        ) {
          return { count: 0 };
        }
        return { count: 1 };
      }
    );
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("frozen-pdf"));
    let emailCalls = 0;
    let markEmailStarted!: () => void;
    let releaseEmail!: () => void;
    const emailStarted = new Promise<void>((resolve) => {
      markEmailStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseEmail = resolve;
    });
    userMail.send.mockImplementation(async () => {
      emailCalls += 1;
      markEmailStarted();
      if (emailCalls === 1) {
        await release;
      }
      return {
        providerName: "WECOM_EXMAIL_SMTP",
        providerReference: `<message-${emailCalls}@example.test>`,
        senderEmail: "member@example.test",
      };
    });

    const first = service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
        method: "EMAIL",
        isRedispatch: true,
        sentAt: "2026-07-06",
        recipientContact: "confirmations@hsbc.example",
        emailSubject: "Redispatch confirmation",
        emailBody: "Please review the updated confirmation.",
      },
      user,
      source
    );
    await emailStarted;
    const second = service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "66666666-6666-4666-8666-666666666666",
        method: "EMAIL",
        isRedispatch: true,
        sentAt: "2026-07-06",
        recipientContact: "confirmations@hsbc.example",
        emailSubject: "Redispatch confirmation",
        emailBody: "Please review the updated confirmation.",
      },
      user,
      source
    );
    const secondResult = await second.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error) => ({ status: "rejected" as const, error })
    );

    releaseEmail();
    await expect(first).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );
    expect(secondResult).toMatchObject({
      status: "rejected",
      error: { response: { code: "CONFIRMATION_STATE_CONFLICT" } },
    });
    expect(userMail.send).toHaveBeenCalledOnce();
  });

  it("conditionally compensates a failed email redispatch reservation", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: {
        disposition: "ACTIVE",
        pdfObjectKey: "confirmations/frozen.pdf",
      },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-email-1",
      sequence: 2,
    });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("frozen-pdf"));
    userMail.send.mockRejectedValue(new Error("mail failed"));

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "77777777-7777-4777-8777-777777777777",
          method: "EMAIL",
          isRedispatch: true,
          sentAt: "2026-07-06",
          recipientContact: "confirmations@hsbc.example",
          emailSubject: "Redispatch confirmation",
          emailBody: "Please review the updated confirmation.",
        },
        user,
        source
      )
    ).rejects.toThrow("mail failed");

    expect(prisma.projectConfirmationDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-email-1", executionStatus: "QUEUED" },
        data: expect.objectContaining({ executionStatus: "FAILED" }),
      })
    );
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dispatchId: "dispatch-email-1",
        eventType: "FAILED",
      }),
    });
    expect(prisma.projectConfirmation.update).not.toHaveBeenCalled();
  });

  it("conditionally compensates a redispatch reservation when frozen storage read fails", async () => {
    const service = createService();
    const readError = new Error("frozen file unavailable");
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      confirmationCode: "AUD-2026-0003-YH-001",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: {
        disposition: "ACTIVE",
        pdfObjectKey: "confirmations/frozen.pdf",
      },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-email-read-failure",
      sequence: 2,
    });
    storage.getObjectBuffer.mockRejectedValue(readError);

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "99999999-9999-4999-8999-999999999999",
          method: "EMAIL",
          isRedispatch: true,
          sentAt: "2026-07-06",
          recipientContact: "confirmations@hsbc.example",
          emailSubject: "Redispatch confirmation",
          emailBody: "Please review the updated confirmation.",
        },
        user,
        source
      )
    ).rejects.toBe(readError);

    expect(userMail.send).not.toHaveBeenCalled();
    expect(prisma.projectConfirmationDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-email-read-failure", executionStatus: "QUEUED" },
        data: expect.objectContaining({ executionStatus: "FAILED" }),
      })
    );
    expect(prisma.confirmationDispatchEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dispatchId: "dispatch-email-read-failure",
        eventType: "FAILED",
      }),
    });
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "confirmation-1",
        queueClaimedBy: expect.any(String),
      }),
      data: { queueClaimedBy: null, queueClaimedAt: null },
    });
  });

  it("completes a redispatch with unavailable tracking and does not allow a second dispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockImplementation(
      async ({ data }) => {
        await Promise.resolve();
        return {
          id:
            data.idempotencyKey === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
              ? "dispatch-failed"
              : "dispatch-retry",
          sequence: data.sequence,
          trackingNumber: data.trackingNumber,
        };
      }
    );
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    shipmentTracking.registerDispatch
      .mockResolvedValueOnce({
        errorCode: "-18019903",
        errorMessage: "Carrier cannot be detected",
        ok: false,
      })
      .mockResolvedValueOnce({
        carrierCode: 100_003,
        ok: true,
        registeredAt: new Date("2026-07-06T08:00:00Z"),
      });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-FAILED",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-failed",
          sequence: 2,
          createdAt: new Date("2026-07-06T09:00:00Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [],
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-RETRY",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledOnce();
    expect(shipmentTracking.registerDispatch).toHaveBeenCalledOnce();
    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "REDISPATCH_REQUESTED" }),
      })
    );
  });

  it("does not finalize a redispatch after the confirmation state CAS is lost", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      trackingNumber: "SF-REDISPATCH-5",
    });
    let stateChecks = 0;
    prisma.projectConfirmation.updateMany.mockImplementation(async () => {
      await Promise.resolve();
      stateChecks += 1;
      return { count: stateChecks === 1 ? 1 : 0 };
    });
    shipmentTracking.registerDispatch.mockResolvedValue({
      carrierCode: 100_003,
      ok: true,
      registeredAt: new Date("2026-07-06T08:00:00Z"),
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-5",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(shipmentTracking.registerDispatch).toHaveBeenCalledOnce();
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
    expect(prisma.projectConfirmationDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-2", executionStatus: "STARTED" },
        data: expect.objectContaining({ executionStatus: "SENT" }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "confirmation-1",
        queueClaimedBy: expect.any(String),
      }),
      data: { queueClaimedBy: null, queueClaimedAt: null },
    });
  });

  it("finalizes a courier redispatch while preserving tracking failure details", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [{ id: "response-1" }],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      sequence: 1,
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      trackingNumber: "SF-REDISPATCH-4",
    });
    prisma.projectConfirmation.updateMany.mockImplementation(
      async ({ where }) => {
        await Promise.resolve();
        return {
          count: where.dispatches?.some ? 1 : 1,
        };
      }
    );
    shipmentTracking.registerDispatch.mockResolvedValue({
      errorCode: "-18019903",
      errorMessage: "Carrier cannot be detected",
      ok: false,
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-4",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );

    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-2" },
        data: expect.objectContaining({
          executionStatus: "SENT",
          trackingError: "Carrier cannot be detected",
          trackingRegisteredAt: null,
        }),
      })
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          events: { create: expect.objectContaining({ eventType: "SENT" }) },
        }),
      })
    );
    expect(prisma.projectConfirmation.update).not.toHaveBeenCalled();
  });

  it("rejects redispatch when the exception has no routed response", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-1",
          sequence: 1,
          sentAt: new Date("2026-07-05T08:00:00.000Z"),
          createdAt: new Date("2026-07-05T08:01:00.000Z"),
        },
      ],
      responses: [],
      followUpEvents: [
        {
          occurredAt: new Date("2026-07-06T08:00:00.000Z"),
          payload: { responseId: "response-1", action: "REDISPATCH" },
        },
      ],
    });
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      trackingNumber: "SF-REDISPATCH-2",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "66666666-6666-4666-8666-666666666666",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-2",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
  });

  it("does not reuse a redispatch request that predates the latest dispatch record", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [
        {
          id: "dispatch-2",
          sequence: 2,
          sentAt: new Date("2026-07-06T08:00:00.000Z"),
          createdAt: new Date("2026-07-06T08:05:00.000Z"),
        },
      ],
      followUpEvents: [{ occurredAt: new Date("2026-07-06T08:02:00.000Z") }],
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "55555555-5555-4555-8555-555555555555",
          method: "COURIER",
          isRedispatch: true,
          sentAt: "2026-07-06",
          trackingNumber: "SF-REDISPATCH-3",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
  });

  it("completes the program only after a response has been recorded", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
      responses: [{ id: "response-1" }],
    });

    await service.completeConfirmationProgram(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(prisma.projectConfirmation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          responses: {
            where: { routingStatus: "ROUTED" },
            orderBy: { createdAt: "desc" },
            select: { id: true },
            take: 1,
          },
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
        differenceStatus: "PENDING_FOLLOW_UP",
        responses: {
          some: { id: "response-1", routingStatus: "ROUTED" },
        },
      },
      data: { status: "CLOSED" },
    });
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confirmationId: "confirmation-1",
        eventType: "PROGRAM_COMPLETED",
        actorId: "user-1",
        source: "PROJECT_TEAM_MANUAL",
        payload: expect.objectContaining({
          resolution: "ALTERNATIVE_PROCEDURE",
          transition: "COMPLETION",
          responseId: "response-1",
        }),
      }),
    });
  });

  it("does not record redispatch requests through the generic follow-up endpoint", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
    });

    await expect(
      service.createFollowUpEventForConfirmation(
        "project-1",
        "confirmation-1",
        { eventType: "REDISPATCH_REQUESTED" },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
  });

  it("rejects completion for an unreviewed response", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-1" }],
    });

    await expect(
      service.completeConfirmationProgram(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects alternative completion when the conditional state guard loses", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.completeConfirmationProgram(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("reviews a matched response and completes the confirmation", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
    });

    await service.reviewProjectConfirmationResponse(
      "project-1",
      "confirmation-1",
      { result: "MATCHED" },
      user,
      source
    );

    expect(prisma.projectConfirmation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          responses: expect.objectContaining({
            where: { routingStatus: "ROUTED" },
            orderBy: { createdAt: "desc" },
            take: 1,
          }),
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        responses: {
          some: { id: "response-1", routingStatus: "ROUTED" },
        },
      },
      data: { status: "CLOSED", differenceStatus: "MATCHED" },
    });
    expect(prisma.projectConfirmation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ differenceStatus: true }),
      })
    );
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "REVIEW_RECORDED",
        payload: expect.objectContaining({
          responseId: "response-1",
          result: "MATCHED",
          transition: "REVIEW",
        }),
      }),
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESPONSE_REVIEWED",
        targetId: "confirmation-1",
      })
    );
  });

  it("rejects review before reading a confirmation when project access fails", async () => {
    const service = createService();
    const forbidden = new ApiForbiddenException(
      "FORBIDDEN",
      "Project access denied"
    );
    access.requireMutableProject.mockRejectedValueOnce(forbidden);

    await expect(
      service.reviewProjectConfirmationResponse(
        "other-project",
        "confirmation-1",
        { result: "MATCHED" },
        user,
        source
      )
    ).rejects.toBe(forbidden);

    expect(prisma.projectConfirmation.findFirst).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a matched review when the conditional state guard loses", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.reviewProjectConfirmationResponse(
        "project-1",
        "confirmation-1",
        { result: "MATCHED" },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("rejects a duplicate matched review after the response has been resolved", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      responses: [{ id: "response-1" }],
    });

    await expect(
      service.reviewProjectConfirmationResponse(
        "project-1",
        "confirmation-1",
        { result: "MATCHED" },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });

    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("uses the newest routed response selected by the database for review", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-latest" }],
    });

    await service.reviewProjectConfirmationResponse(
      "project-1",
      "confirmation-1",
      { result: "MATCHED" },
      user,
      source
    );

    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          responseId: "response-latest",
          result: "MATCHED",
          transition: "REVIEW",
        }),
      }),
    });
  });

  it("returns a mismatched response to draft for redispatch editing", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      currentArtifactId: "artifact-1",
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      differenceStatus: "EXCEPTION",
    });

    await service.reviewProjectConfirmationResponse(
      "project-1",
      "confirmation-1",
      {
        result: "MISMATCHED",
        action: "REDISPATCH",
        notes: "Request an updated confirmation",
      },
      user,
      source
    );

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        responses: {
          some: { id: "response-1", routingStatus: "ROUTED" },
        },
      },
      data: {
        status: "DRAFT",
        differenceStatus: "EXCEPTION",
        queuedAt: null,
        queueClaimedBy: null,
        queueClaimedAt: null,
        notes: "Request an updated confirmation",
      },
    });
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "REDISPATCH_REQUESTED",
        notes: "Request an updated confirmation",
        payload: expect.objectContaining({
          responseId: "response-1",
          action: "REDISPATCH",
          result: "MISMATCHED",
          transition: "REVIEW",
        }),
      }),
    });
  });

  it("returns a legacy pending redispatch to draft for editing", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      counterpartyName: "HSBC Hong Kong",
      dispatches: [
        { sequence: 1, createdAt: new Date("2026-07-12T09:00:00.000Z") },
      ],
      followUpEvents: [{ occurredAt: new Date("2026-07-13T09:00:00.000Z") }],
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      differenceStatus: "EXCEPTION",
    });

    await expect(
      service.startRedispatchEditing(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      status: "DRAFT",
      differenceStatus: "EXCEPTION",
    });

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        projectId: "project-1",
        status: "AWAITING_RESPONSE",
        differenceStatus: "EXCEPTION",
      },
      data: {
        status: "DRAFT",
        queuedAt: null,
        queueClaimedBy: null,
        queueClaimedAt: null,
      },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_REDISPATCH_EDITING_STARTED",
        targetId: "confirmation-1",
      })
    );
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledTimes(2);
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        confirmationId: "confirmation-1",
        projectId: "project-1",
      }),
      "REDISPATCH_EDITING",
      prisma
    );
  });

  it("blocks redispatch editing while an active EMP linkage exists and audits the attempt", async () => {
    const service = createService();
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：FLAT 导入 import-job-1（EMP/WP-001）。请先从 EMP 撤回该导入后，再开始重发编辑。"
      )
    );

    await expect(
      service.startRedispatchEditing(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("先从 EMP 撤回"),
      },
    });

    expect(
      sourceStateGuard.assertCanInvalidateSource
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        confirmationId: "confirmation-1",
        projectId: "project-1",
        actorId: "user-1",
      }),
      "REDISPATCH_EDITING"
    );

    expect(prisma.projectConfirmation.findFirst).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetId: "confirmation-1",
        projectId: "project-1",
      })
    );
  });

  it("keeps an alternative procedure pending without inventing a follow-up event", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-1" }],
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
    });

    await service.reviewProjectConfirmationResponse(
      "project-1",
      "confirmation-1",
      {
        result: "MISMATCHED",
        action: "ALTERNATIVE_PROCEDURE",
        notes: "Inspect the bank statement instead",
      },
      user,
      source
    );

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "confirmation-1",
        status: "RESPONSE_RECEIVED",
        differenceStatus: null,
        responses: {
          some: { id: "response-1", routingStatus: "ROUTED" },
        },
      },
      data: {
        status: "RESPONSE_RECEIVED",
        differenceStatus: "PENDING_FOLLOW_UP",
        notes: "Inspect the bank statement instead",
      },
    });
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "REVIEW_RECORDED",
          payload: expect.objectContaining({
            responseId: "response-1",
            action: "ALTERNATIVE_PROCEDURE",
            transition: "REVIEW",
          }),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_RESPONSE_REVIEWED",
        description: expect.stringContaining("ALTERNATIVE_PROCEDURE"),
      })
    );
  });

  it("blocks undoing a matched review while EMP still owns its source", async () => {
    const service = createService(
      new ProjectConfirmationCodeService(prisma as never),
      sourceStateGuard
    );
    sourceStateGuard.assertCanInvalidateSource.mockRejectedValue(
      new ApiConflictException(
        "CONFIRMATION_STATE_CONFLICT",
        "来源状态受 EMP 导入保护：ZIP 导入 import-job-1（2026/confirmation.zip）。请先从 EMP 撤回该导入后，再撤回复核结论。"
      )
    );

    await expect(
      service.undoProjectConfirmationReview(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: {
        code: "CONFIRMATION_STATE_CONFLICT",
        message: expect.stringContaining("先从 EMP 撤回"),
      },
    });
    expect(sourceStateGuard.assertCanInvalidateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationId: "confirmation-1",
        projectId: "project-1",
        actorId: "user-1",
      }),
      "UNDO_REVIEW"
    );
    expect(prisma.projectConfirmation.findFirst).not.toHaveBeenCalled();
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_SOURCE_STATE_BLOCKED",
        targetId: "confirmation-1",
        projectId: "project-1",
      })
    );
  });

  it("restores a matched review to an unreviewed response without deleting it", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      notes: "matched note",
      counterpartyName: "HSBC Hong Kong",
      responses: [{ id: "response-1", routingStatus: "ROUTED" }],
      dispatches: [],
      followUpEvents: [
        {
          id: "review-event-1",
          eventType: "REVIEW_RECORDED",
          payload: {
            responseId: "response-1",
            result: "MATCHED",
            previous: {
              status: "RESPONSE_RECEIVED",
              differenceStatus: null,
              notes: null,
            },
            next: {
              status: "CLOSED",
              differenceStatus: "MATCHED",
              notes: "matched note",
            },
          },
          occurredAt: new Date("2026-08-04T10:00:00Z"),
          createdAt: new Date("2026-08-04T10:00:00Z"),
        },
      ],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      responses: [{ id: "response-1" }],
    });

    await expect(
      service.undoProjectConfirmationReview(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
    });

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
          notes: null,
        },
      })
    );
    expect(prisma.confirmationFollowUpEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "REVIEW_RETRACTED",
          payload: expect.objectContaining({ targetEventId: "review-event-1" }),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_REVIEW_RETRACTED",
      })
    );
  });

  it("restores a matched legacy review event without a transition snapshot", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "MATCHED",
      notes: "imported data note",
      counterpartyName: "HSBC Hong Kong",
      responses: [{ id: "response-1", routingStatus: "ROUTED" }],
      dispatches: [],
      followUpEvents: [
        {
          id: "legacy-review-event-1",
          eventType: "PROGRAM_COMPLETED",
          notes: null,
          payload: {
            responseId: "response-1",
            result: "MATCHED",
          },
          occurredAt: new Date("2026-08-04T10:00:00Z"),
          createdAt: new Date("2026-08-04T10:00:00Z"),
        },
      ],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: null,
      notes: "imported data note",
      responses: [{ id: "response-1" }],
    });

    await service.undoProjectConfirmationReview(
      "project-1",
      "confirmation-1",
      user,
      source
    );

    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "RESPONSE_RECEIVED",
          differenceStatus: null,
          notes: "imported data note",
        },
      })
    );
  });

  it("steps an alternative completion back to the pending follow-up stage", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "CLOSED",
      differenceStatus: "PENDING_FOLLOW_UP",
      notes: "Use the bank statement",
      counterpartyName: "HSBC Hong Kong",
      responses: [{ id: "response-1", routingStatus: "ROUTED" }],
      dispatches: [],
      followUpEvents: [
        {
          id: "completion-event-1",
          eventType: "PROGRAM_COMPLETED",
          payload: {
            responseId: "response-1",
            resolution: "ALTERNATIVE_PROCEDURE",
            previous: {
              status: "RESPONSE_RECEIVED",
              differenceStatus: "PENDING_FOLLOW_UP",
              notes: "Use the bank statement",
            },
            next: {
              status: "CLOSED",
              differenceStatus: "PENDING_FOLLOW_UP",
              notes: "Use the bank statement",
            },
          },
          occurredAt: new Date("2026-08-04T10:00:00Z"),
          createdAt: new Date("2026-08-04T10:00:00Z"),
        },
      ],
    });
    prisma.projectConfirmation.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
    });

    await expect(
      service.undoProjectConfirmationReview(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).resolves.toMatchObject({
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
    });
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "RESPONSE_RECEIVED",
          differenceStatus: "PENDING_FOLLOW_UP",
          notes: "Use the bank statement",
        },
      })
    );
  });

  it("does not undo a redispatch review after a redispatch record exists", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      projectId: "project-1",
      status: "AWAITING_RESPONSE",
      differenceStatus: "EXCEPTION",
      notes: null,
      counterpartyName: "HSBC Hong Kong",
      responses: [{ id: "response-1", routingStatus: "ROUTED" }],
      dispatches: [
        { sequence: 2, createdAt: new Date("2026-08-04T10:05:00Z") },
      ],
      followUpEvents: [
        {
          id: "redispatch-review-1",
          eventType: "REDISPATCH_REQUESTED",
          payload: {
            responseId: "response-1",
            result: "MISMATCHED",
            action: "REDISPATCH",
            previous: {
              status: "RESPONSE_RECEIVED",
              differenceStatus: null,
              notes: null,
            },
            next: {
              status: "AWAITING_RESPONSE",
              differenceStatus: "EXCEPTION",
              notes: null,
            },
          },
          occurredAt: new Date("2026-08-04T10:00:00Z"),
          createdAt: new Date("2026-08-04T10:00:00Z"),
        },
      ],
    });

    await expect(
      service.undoProjectConfirmationReview(
        "project-1",
        "confirmation-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(prisma.confirmationFollowUpEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a second review after an alternative procedure was selected", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "RESPONSE_RECEIVED",
      differenceStatus: "PENDING_FOLLOW_UP",
      responses: [{ id: "response-1" }],
    });

    await expect(
      service.reviewProjectConfirmationResponse(
        "project-1",
        "confirmation-1",
        {
          result: "MISMATCHED",
          action: "ALTERNATIVE_PROCEDURE",
          notes: "Duplicate submission",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "CONFIRMATION_STATE_CONFLICT" },
    });
    expect(prisma.projectConfirmation.updateMany).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it.each(["missing details", "network failure"])(
    "records a physical dispatch despite %s in tracking",
    async (failure) => {
      const service = createService();
      prisma.projectConfirmation.findFirst.mockResolvedValue({
        id: "confirmation-1",
        counterpartyName: "HSBC Hong Kong",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        currentArtifact: { disposition: "ACTIVE" },
        dispatches: [],
      });
      prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
      prisma.projectConfirmationDispatch.create.mockResolvedValue({
        id: "dispatch-1",
        trackingNumber: "JD123456",
      });
      const message = "The 'phone_number_last_4' field is required";
      if (failure === "network failure") {
        shipmentTracking.registerDispatch.mockRejectedValue(
          new Error("Connection timed out")
        );
      } else {
        shipmentTracking.registerDispatch.mockResolvedValue({
          errorCode: "-18010023",
          errorMessage: message,
          ok: false,
        });
      }
      await expect(
        service.createDispatchForConfirmation(
          "project-1",
          "confirmation-1",
          {
            idempotencyKey: "33333333-3333-4333-8333-333333333333",
            method: "COURIER",
            sentAt: "2026-07-05",
            trackingNumber: "JD123456",
          },
          user,
          source
        )
      ).resolves.toStrictEqual(
        expect.objectContaining({ status: "AWAITING_RESPONSE" })
      );
      expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dispatch-1" },
          data: expect.objectContaining({
            executionStatus: "SENT",
            trackingRegisteredAt: null,
            trackingError:
              failure === "network failure" ? "Connection timed out" : message,
            events: { create: expect.objectContaining({ eventType: "SENT" }) },
          }),
        })
      );
      expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledOnce();
      expect(auditLogs.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PROJECT_CONFIRMATION_DISPATCH_CREATED",
        })
      );
    }
  );

  it("records a non-tracking confirmation without calling the tracking bridge", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "PREPARED",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-1",
      trackingNumber: null,
    });
    shipmentTracking.registerDispatch.mockRejectedValue(
      new Error("tracking bridge should not be called")
    );

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
          method: "OTHER",
          sentAt: "2026-07-05",
          recipientContact: "manual@example.test",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );

    expect(shipmentTracking.registerDispatch).not.toHaveBeenCalled();
    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trackingProvider: null }),
      })
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1" },
        data: expect.objectContaining({
          executionStatus: "SENT",
        }),
      })
    );
  });

  it("registers corrected tracking before replacing the current shipment", async () => {
    const service = createService();
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
      method: "COURIER",
      executionStatus: "SENT",
      trackingNumber: "OLD123",
      trackingStoppedAt: null,
    });
    shipmentTracking.registerDispatch.mockResolvedValue({
      carrierCode: 191_222,
      ok: true,
      registeredAt: new Date("2026-07-16T08:00:00Z"),
      snapshot: {
        carrierName: "WHWDT",
        description: "Parcel has been delivered.(Front door)",
        events: [
          {
            at: "2026-04-12T14:21:09Z",
            description: "Parcel has been delivered.(Front door)",
            location: "GA",
            stage: "Delivered",
            substatus: "Delivered_Other",
          },
        ],
        lastEventAt: new Date("2026-04-12T14:21:09Z"),
        location: "GA",
        retrievedAt: new Date("2026-07-16T08:00:01Z"),
        status: "Delivered",
        substatus: "Delivered_Other",
      },
    });

    await expect(
      service.correctTrackingForConfirmation(
        "project-1",
        "confirmation-1",
        "dispatch-1",
        {
          trackingNumber: "R26062747635767",
          trackingCarrierCode: 191_222,
          courierName: "武汉沃德通",
          reason: "首次自动识别到了错误运输商",
        },
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "confirmation-1" }));

    expect(shipmentTracking.registerDispatch).toHaveBeenCalledWith(
      "dispatch-1",
      "R26062747635767",
      191_222
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1" },
        data: expect.objectContaining({
          trackingNumber: "R26062747635767",
          courierName: "武汉沃德通",
          trackingCarrierCode: 191_222,
          trackingCarrierName: "WHWDT",
          trackingStatus: "Delivered",
          trackingDescription: "Parcel has been delivered.(Front door)",
          trackingLocation: "GA",
          trackingEvents: expect.arrayContaining([
            expect.objectContaining({ location: "GA" }),
          ]),
          executionStatus: "DELIVERED",
          deliveredAt: new Date("2026-04-12T14:21:09Z"),
          trackingError: null,
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_TRACKING_CORRECTED",
        targetId: "dispatch-1",
      })
    );
  });

  it("keeps the current shipment when corrected tracking is rejected", async () => {
    const service = createService();
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
      method: "COURIER",
      executionStatus: "SENT",
      trackingNumber: "OLD123",
    });
    shipmentTracking.registerDispatch.mockResolvedValue({
      errorCode: "-18019903",
      errorMessage: "Carrier cannot be detected",
      ok: false,
    });

    await expect(
      service.correctTrackingForConfirmation(
        "project-1",
        "confirmation-1",
        "dispatch-1",
        {
          trackingNumber: "UNKNOWN123",
          reason: "修正单号",
        },
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "TRACKING_REGISTRATION_FAILED" },
    });
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
  });

  it("refreshes tracking details for an existing physical dispatch", async () => {
    const service = createService();
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
      method: "COURIER",
      executionStatus: "SENT",
      trackingCarrierCode: 100_003,
      trackingNumber: "SF123456",
    });
    shipmentTracking.refreshTracking.mockResolvedValue({
      ok: true,
      snapshot: {
        carrierName: "SF Express",
        description: "Delivered to recipient",
        events: [
          {
            at: "2026-07-17T08:00:00Z",
            description: "Delivered to recipient",
            location: "Shanghai",
            stage: "Delivered",
            substatus: "Delivered_Other",
          },
        ],
        lastEventAt: new Date("2026-07-17T08:00:00Z"),
        location: "Shanghai",
        retrievedAt: new Date("2026-07-17T08:01:00Z"),
        status: "Delivered",
        substatus: "Delivered_Other",
      },
    });

    await expect(
      service.refreshTrackingForConfirmation(
        "project-1",
        "confirmation-1",
        "dispatch-1",
        user,
        source
      )
    ).resolves.toStrictEqual(expect.objectContaining({ id: "confirmation-1" }));

    expect(shipmentTracking.refreshTracking).toHaveBeenCalledWith(
      "SF123456",
      100_003
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith({
      where: { id: "dispatch-1" },
      data: expect.objectContaining({
        trackingCarrierName: "SF Express",
        trackingStatus: "Delivered",
        trackingEvents: expect.arrayContaining([
          expect.objectContaining({ description: "Delivered to recipient" }),
        ]),
        executionStatus: "DELIVERED",
        deliveredAt: new Date("2026-07-17T08:00:00Z"),
        trackingError: null,
      }),
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_TRACKING_REFRESHED",
        targetId: "dispatch-1",
      })
    );
  });

  it("keeps stored tracking details when 17TRACK refresh is unavailable", async () => {
    const service = createService();
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
      method: "COURIER",
      executionStatus: "SENT",
      trackingCarrierCode: 100_003,
      trackingNumber: "SF123456",
    });
    shipmentTracking.refreshTracking.mockResolvedValue({
      errorCode: "17TRACK_TRACK_INFO_UNAVAILABLE",
      errorMessage: "17TRACK 暂未返回该运单的物流信息，请稍后重试",
      ok: false,
    });

    await expect(
      service.refreshTrackingForConfirmation(
        "project-1",
        "confirmation-1",
        "dispatch-1",
        user,
        source
      )
    ).rejects.toMatchObject({
      response: { code: "TRACKING_REFRESH_FAILED" },
    });
    expect(prisma.projectConfirmationDispatch.update).not.toHaveBeenCalled();
    expect(auditLogs.log).not.toHaveBeenCalled();
  });

  it("requires project membership when a confirmation officer records a dispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "PREPARED",
      currentArtifactId: "artifact-1",
      currentArtifact: { disposition: "ACTIVE" },
      dispatches: [],
    });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-1",
      trackingNumber: "SF654321",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "AWAITING_RESPONSE",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
          method: "COURIER",
          sentAt: "2026-07-05",
          trackingNumber: "SF654321",
        },
        confirmationOfficer,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "AWAITING_RESPONSE",
      })
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "confirmation-officer-1"
    );
    expect(prisma.projectConfirmationDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationId: "confirmation-1",
          sequence: 1,
          method: "COURIER",
          createdBy: "confirmation-officer-1",
        }),
      })
    );
  });

  it("sends a frozen PDF by the user's mailbox before advancing the status", async () => {
    const service = createService();
    const emailUser = {
      id: "user-1",
      name: "Project Member",
      email: "member@example.test",
      globalRole: "MANAGER",
    } as never;
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC Hong Kong",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        currentArtifact: {
          disposition: "ACTIVE",
          pdfObjectKey: "confirmations/frozen.pdf",
        },
        dispatches: [],
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
      });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-1",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      status: "AWAITING_RESPONSE",
    });
    prisma.projectConfirmation.updateMany.mockResolvedValue({ count: 1 });
    storage.getObjectBuffer.mockResolvedValue(Buffer.from("frozen-pdf"));
    userMail.send.mockResolvedValue({
      providerName: "WECOM_EXMAIL_SMTP",
      providerReference: "<message-1@example.test>",
      senderEmail: "member@example.test",
    });

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "44444444-4444-4444-8444-444444444444",
          method: "EMAIL",
          sentAt: "2026-07-05",
          recipientContact: "confirmations@hsbc.example",
          emailSubject: "Audit confirmation",
          emailBody: "Please find the frozen confirmation attached.",
        },
        emailUser,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({ status: "AWAITING_RESPONSE" })
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmations/frozen.pdf"
    );
    expect(userMail.send).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        html: expect.stringMatching(
          /cid:project-wing-brand[\s\S]*Audit confirmation/
        ),
        to: "confirmations@hsbc.example",
        subject: "Audit confirmation",
        attachment: expect.objectContaining({
          fileName: "AUD-2026-0003-YH-001-confirmation.pdf",
          content: Buffer.from("frozen-pdf"),
        }),
      })
    );
    expect(prisma.projectConfirmationDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1" },
        data: expect.objectContaining({
          executionStatus: "SENT",
          senderEmail: "member@example.test",
          providerReference: "<message-1@example.test>",
        }),
      })
    );
    expect(prisma.projectConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "confirmation-1",
          status: "PREPARED",
        }),
        data: expect.objectContaining({ status: "AWAITING_RESPONSE" }),
      })
    );
  });

  it("emails an unsupported uploaded confirmation with original bytes and MIME", async () => {
    const service = createService();
    const emailUser = {
      id: "user-1",
      name: "Project Member",
      email: "member@example.test",
      globalRole: "MANAGER",
    } as never;
    const sourceBody = Buffer.from("opaque message bytes");
    const sourceKey =
      "confirmation-artifacts/project-1/artifact-1/document.docx";
    const sourceMime = "application/vnd.ms-outlook";
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC Hong Kong",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        currentArtifact: {
          disposition: "ACTIVE",
          pdfObjectKey:
            "confirmation-artifacts/project-1/artifact-1/document.pdf",
          docxObjectKey: sourceKey,
          structuredSnapshot: {
            source: "UPLOAD",
            objectKey: sourceKey,
            fileName: "evidence.msg",
            mimeType: sourceMime,
            size: sourceBody.byteLength,
            sha256: "source-sha256",
            previewIsPdf: false,
            previewMimeType: sourceMime,
          },
        },
        dispatches: [],
        responses: [],
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
      });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-unsupported",
    });
    storage.getObjectBuffer.mockResolvedValue(sourceBody);
    userMail.send.mockResolvedValue({
      providerName: "WECOM_EXMAIL_SMTP",
      providerReference: "<message-unsupported@example.test>",
      senderEmail: "member@example.test",
    });

    await service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
        method: "EMAIL",
        sentAt: "2026-07-05",
        recipientContact: "confirmations@hsbc.example",
        emailSubject: "Audit confirmation",
        emailBody: "Please find the original confirmation attached.",
        attachmentName: "report.pdf",
      },
      emailUser,
      source
    );

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(sourceKey);
    expect(userMail.send).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        attachment: {
          fileName: "evidence.msg",
          content: sourceBody,
          contentType: sourceMime,
        },
      })
    );
  });

  it("uses a PDF name and MIME for a successfully converted uploaded docx", async () => {
    const service = createService();
    const emailUser = {
      id: "user-1",
      name: "Project Member",
      email: "member@example.test",
      globalRole: "MANAGER",
    } as never;
    const convertedBody = Buffer.from("%PDF-1.4 converted docx");
    const sourceKey =
      "confirmation-artifacts/project-1/artifact-1/document.docx";
    prisma.projectConfirmation.findFirst
      .mockResolvedValueOnce({
        id: "confirmation-1",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC Hong Kong",
        status: "PREPARED",
        currentArtifactId: "artifact-1",
        currentArtifact: {
          disposition: "ACTIVE",
          pdfObjectKey:
            "confirmation-artifacts/project-1/artifact-1/document.pdf",
          docxObjectKey: sourceKey,
          structuredSnapshot: {
            source: "UPLOAD",
            objectKey: sourceKey,
            fileName: "evidence.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: 18,
            sha256: "source-sha256",
            previewIsPdf: true,
            previewMimeType: "application/pdf",
          },
        },
        dispatches: [],
        responses: [],
      })
      .mockResolvedValueOnce({
        id: "confirmation-1",
        status: "AWAITING_RESPONSE",
      });
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue(null);
    prisma.projectConfirmationDispatch.create.mockResolvedValue({
      id: "dispatch-converted",
    });
    storage.getObjectBuffer.mockResolvedValue(convertedBody);
    userMail.send.mockResolvedValue({
      providerName: "WECOM_EXMAIL_SMTP",
      providerReference: "<message-converted@example.test>",
      senderEmail: "member@example.test",
    });

    await service.createDispatchForConfirmation(
      "project-1",
      "confirmation-1",
      {
        idempotencyKey: "56565656-5656-4565-8565-565656565656",
        method: "EMAIL",
        sentAt: "2026-07-05",
        recipientContact: "confirmations@hsbc.example",
        emailSubject: "Audit confirmation",
        emailBody: "Please find the converted confirmation attached.",
        attachmentName: "report.docx",
      },
      emailUser,
      source
    );

    expect(userMail.send).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        attachment: {
          fileName: "report.pdf",
          content: convertedBody,
          contentType: "application/pdf",
        },
      })
    );
  });

  it("saves prepared dispatch details without creating an actual dispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "DRAFT",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      status: "DRAFT",
      counterpartyName: "HSBC Hong Kong",
      preparedDispatchMethod: "EMAIL",
      preparedRecipientContact: "confirmations@hsbc.example",
    });

    await expect(
      service.prepareDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          method: "EMAIL",
          recipientContact: "confirmations@hsbc.example",
          markReady: false,
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "DRAFT",
        preparedDispatchMethod: "EMAIL",
      })
    );

    expect(access.requireMutableProject).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "confirmation-1" },
        data: expect.objectContaining({
          preparedDispatchMethod: "EMAIL",
          preparedRecipientContact: "confirmations@hsbc.example",
        }),
      })
    );
    expect(
      prisma.projectConfirmation.update.mock.calls[0][0].data
    ).not.toHaveProperty("status");
  });

  it("marks prepared dispatch details ready without recording a sent dispatch", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue({
      id: "confirmation-1",
      counterpartyName: "HSBC Hong Kong",
      status: "DRAFT",
    });
    prisma.projectConfirmation.update.mockResolvedValue({
      id: "confirmation-1",
      status: "PREPARED",
      counterpartyName: "HSBC Hong Kong",
      preparedDispatchMethod: "COURIER",
    });

    await expect(
      service.prepareDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          method: "COURIER",
          courierName: "SF Express",
          trackingNumber: "SF123456",
          markReady: true,
        },
        user,
        source
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: "PREPARED",
        preparedDispatchMethod: "COURIER",
      })
    );

    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
    expect(prisma.projectConfirmation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "confirmation-1" },
        data: expect.objectContaining({
          status: "PREPARED",
          preparedDispatchMethod: "COURIER",
          preparedCourierName: "SF Express",
          preparedTrackingNumber: "SF123456",
          preparedDispatchReadyBy: "user-1",
          preparedDispatchReadyAt: expect.any(Date),
        }),
      })
    );
  });

  it("rejects dispatch attempts for confirmations outside the project", async () => {
    const service = createService();
    prisma.projectConfirmation.findFirst.mockResolvedValue(null);

    await expect(
      service.createDispatchForConfirmation(
        "project-1",
        "confirmation-1",
        {
          idempotencyKey: "33333333-3333-4333-8333-333333333333",
          method: "EMAIL",
          sentAt: "2026-07-05",
        },
        user,
        source
      )
    ).rejects.toThrow("Confirmation record was not found");

    expect(prisma.projectConfirmationDispatch.create).not.toHaveBeenCalled();
  });

  it("stores an optional scan against the created dispatch record", async () => {
    const service = createService();
    const file = {
      buffer: Buffer.from("scan"),
      mimetype: "application/pdf",
      originalname: "sent-confirmation.pdf",
      size: 4,
    };
    prisma.projectConfirmationDispatch.findFirst.mockResolvedValue({
      id: "dispatch-1",
      attachmentObjectKey: null,
    });
    prisma.projectConfirmationDispatch.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.projectConfirmation.findUniqueOrThrow.mockResolvedValue({
      id: "confirmation-1",
      dispatches: [
        {
          id: "dispatch-1",
          attachmentName: "sent-confirmation.pdf",
        },
      ],
    });
    storage.putConfirmationDispatchAttachment.mockResolvedValue({
      objectKey:
        "confirmation-dispatch-attachments/project-1/confirmation-1/dispatch-1/scan.pdf",
      fileName: "scan.pdf",
    });

    await expect(
      service.uploadDispatchAttachment(
        "project-1",
        "confirmation-1",
        "dispatch-1",
        file,
        user,
        source
      )
    ).resolves.toMatchObject({ id: "confirmation-1" });

    expect(storage.putConfirmationDispatchAttachment).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "dispatch-1",
      "sent-confirmation.pdf",
      file.buffer,
      file.mimetype
    );
    expect(prisma.projectConfirmationDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "dispatch-1",
          confirmationId: "confirmation-1",
          attachmentObjectKey: null,
        },
        data: expect.objectContaining({
          attachmentName: "sent-confirmation.pdf",
          attachmentMimeType: "application/pdf",
          attachmentSize: 4,
          attachmentObjectKey:
            "confirmation-dispatch-attachments/project-1/confirmation-1/dispatch-1/scan.pdf",
          attachmentSha256: expect.any(String),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_CONFIRMATION_DISPATCH_ATTACHMENT_UPLOADED",
        targetId: "dispatch-1",
        projectId: "project-1",
      })
    );
  });

  it("lists delivered logistics updates only for visible unacknowledged confirmations", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      dispatches: [
        {
          id: "dispatch-1",
          method: "COURIER",
          executionStatus: "DELIVERED",
          trackingStatus: "Delivered",
          trackingNumber: "TN-1",
          deliveredAt: new Date("2026-09-11T10:00:00Z"),
          trackingLastEventAt: null,
          trackingEvents: null,
        },
      ],
      followUpEvents: [],
    };
    prisma.projectConfirmation.findMany.mockResolvedValue([confirmation]);
    prisma.confirmationLogisticsReadState.findMany.mockResolvedValue([]);

    await expect(service.listLogisticsUnread(user)).resolves.toStrictEqual([
      {
        projectId: "project-1",
        confirmationId: "confirmation-1",
        type: "BANK",
        version: '[["out:dispatch-1","TN-1","2026-09-11T10:00:00.000Z"]]',
      },
    ]);
  });

  it("acknowledges only the current logistics version", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      dispatches: [
        {
          id: "dispatch-1",
          method: "POST",
          executionStatus: "DELIVERED",
          trackingStatus: "Delivered",
          trackingNumber: "TN-1",
          deliveredAt: new Date("2026-09-11T10:00:00Z"),
          trackingLastEventAt: null,
          trackingEvents: null,
        },
      ],
      followUpEvents: [],
    };
    prisma.projectConfirmation.findFirst.mockResolvedValue(confirmation);
    const version = '[["out:dispatch-1","TN-1","2026-09-11T10:00:00.000Z"]]';

    await expect(
      service.acknowledgeLogisticsRead(
        "project-1",
        "confirmation-1",
        version,
        user
      )
    ).resolves.toStrictEqual({ acknowledged: true, version });
    expect(
      prisma.confirmationLogisticsReadState.upsert
    ).toHaveBeenCalledExactlyOnceWith({
      where: {
        userId_confirmationId: {
          userId: "user-1",
          confirmationId: "confirmation-1",
        },
      },
      create: { userId: "user-1", confirmationId: "confirmation-1", version },
      update: { version },
    });

    await expect(
      service.acknowledgeLogisticsRead(
        "project-1",
        "confirmation-1",
        "stale-version",
        user
      )
    ).resolves.toStrictEqual({ acknowledged: false, version });
    expect(prisma.confirmationLogisticsReadState.upsert).toHaveBeenCalledOnce();
  });
});
