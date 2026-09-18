import { createHash } from "node:crypto";

import { ConfirmationArtifactService } from "./confirmation-artifact.service";

const prisma = {
  confirmationArtifact: { create: vi.fn() },
  confirmationTemplateLibraryBuiltInOverride: { findUnique: vi.fn() },
};
const documents = { renderArtifactFiles: vi.fn() };
const storage = {
  putConfirmationArtifact: vi.fn(),
  deleteConfirmationArtifact: vi.fn(),
};
const derivedSnapshot = {
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
};
const confirmation = {
  id: "confirmation-1",
  projectId: "project-1",
  type: "BANK",
  confirmationCode: "AUD-2026-0003-YH-001",
  counterpartyName: "HSBC",
  draftTemplateCode: "PRC_BANK_TEMPLATE_1",
  draftPayload: {
    bankName: "HSBC",
    sections: { deposits: [{ account: "001" }] },
  },
};

function createService() {
  return new ConfirmationArtifactService(
    prisma as never,
    documents as never,
    storage as never
  );
}

describe(ConfirmationArtifactService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    documents.renderArtifactFiles.mockResolvedValue({
      docx: Buffer.from("docx-bytes"),
      pdf: Buffer.from("pdf-bytes"),
      docxFileName: "client-visible-name.docx",
      pdfFileName: "client-visible-name.pdf",
    });
    storage.putConfirmationArtifact
      .mockResolvedValueOnce({
        objectKey:
          "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.docx",
      })
      .mockResolvedValueOnce({
        objectKey:
          "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.pdf",
      });
    prisma.confirmationArtifact.create.mockImplementation(async ({ data }) => {
      await Promise.resolve();
      return data;
    });
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValue(
      null
    );
    storage.deleteConfirmationArtifact.mockResolvedValue(undefined as never);
  });

  it("deep-copies snapshots, hashes the PDF, stores both files, and persists schema metadata", async () => {
    const structuredSnapshot = structuredClone(confirmation.draftPayload);
    const derived = structuredClone(derivedSnapshot);
    const submittedAt = new Date("2026-07-11T03:00:00.000Z");
    const result = await createService().create({
      confirmation: { ...confirmation, draftPayload: structuredSnapshot },
      derivedSnapshot: derived,
      version: 1,
      submissionKey: "submission-key-1",
      submittedBy: "user-1",
      submittedAt,
      artifactId: "artifact-1",
    });

    (structuredSnapshot.sections.deposits[0] as { account: string }).account =
      "mutated";
    derived.clientName = "Mutated Client";

    expect(documents.renderArtifactFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: expect.objectContaining({
          draftPayload: expect.any(Object),
        }),
        derivedSnapshot: expect.objectContaining({
          clientName: "Orchid Holdings",
        }),
      })
    );
    expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
      1,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx",
      Buffer.from("docx-bytes"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf",
      Buffer.from("pdf-bytes"),
      "application/pdf"
    );
    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "artifact-1",
        confirmationId: "confirmation-1",
        version: 1,
        templateCode: "PRC_BANK_TEMPLATE_1",
        templateVersion: "bank-prc-v1",
        docxObjectKey: expect.stringContaining(
          "project-1/confirmation-1/artifact-1"
        ),
        docxSize: Buffer.byteLength("docx-bytes"),
        pdfObjectKey: expect.stringContaining(
          "project-1/confirmation-1/artifact-1"
        ),
        pdfSize: Buffer.byteLength("pdf-bytes"),
        pdfSha256: createHash("sha256").update("pdf-bytes").digest("hex"),
        structuredSnapshot: {
          bankName: "HSBC",
          sections: { deposits: [{ account: "001" }] },
        },
        derivedSnapshot: expect.objectContaining({
          clientName: "Orchid Holdings",
        }),
        submissionKey: "submission-key-1",
        submittedBy: "user-1",
        submittedAt,
      }),
    });
    expect(result).toStrictEqual(expect.objectContaining({ id: "artifact-1" }));
    expect(
      JSON.stringify(prisma.confirmationArtifact.create.mock.calls[0][0].data)
    ).not.toContain("mutated");
    expect(
      JSON.stringify(storage.putConfirmationArtifact.mock.calls)
    ).not.toContain("Orchid Holdings");
  });

  it("uses the enabled managed design when creating an artifact", async () => {
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
    prisma.confirmationTemplateLibraryBuiltInOverride.findUnique.mockResolvedValue(
      {
        designStatus: "ENABLED",
        designSchema,
      }
    );

    await createService().create({
      confirmation: {
        ...confirmation,
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      },
      derivedSnapshot,
      version: 1,
      submissionKey: "submission-key-managed-design",
      submittedBy: "user-1",
      artifactId: "artifact-1",
    });

    expect(
      prisma.confirmationTemplateLibraryBuiltInOverride.findUnique
    ).toHaveBeenCalledWith({
      where: { templateCode: "STANDARD_FINANCIAL_INSTITUTION" },
      select: { designStatus: true, designSchema: true },
    });
    expect(documents.renderArtifactFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: expect.objectContaining({
          draftPayload: expect.objectContaining({
            templateDesignSchema: designSchema,
          }),
        }),
      })
    );
    expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          structuredSnapshot: expect.objectContaining({
            templateDesignSchema: designSchema,
          }),
        }),
      })
    );
  });

  it("rejects submission when a required dynamic checkbox is not checked", async () => {
    await expect(
      createService().create({
        confirmation: {
          ...confirmation,
          draftPayload: {
            templateDesignSchema: {
              version: 1,
              fields: [
                {
                  defaultChecked: false,
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
                  y: 0.1,
                },
              ],
            },
            templateFieldValues: {},
          },
          draftTemplateCode: "CTPL-BANK-2026-000001",
        },
        derivedSnapshot,
        version: 1,
        submissionKey: "submission-key-required-checkbox",
        submittedBy: "user-1",
        artifactId: "artifact-1",
      })
    ).rejects.toThrow(
      "Required checkbox “Confirm authorization” must be checked"
    );
    expect(documents.renderArtifactFiles).not.toHaveBeenCalled();
  });

  it("accepts a required checkbox that is checked by default", async () => {
    await createService().create({
      confirmation: {
        ...confirmation,
        draftPayload: {
          templateDesignSchema: {
            version: 1,
            fields: [
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
                y: 0.1,
              },
            ],
          },
          templateFieldValues: {},
        },
        draftTemplateCode: "CTPL-BANK-2026-000001",
      },
      derivedSnapshot,
      version: 1,
      submissionKey: "submission-key-default-checkbox",
      submittedBy: "user-1",
      artifactId: "artifact-1",
    });

    expect(documents.renderArtifactFiles).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      templateVersion: "financial-institution-hk-standard-v1",
    },
    {
      templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      templateVersion: "bank-confirmation-hk-standard-english-v1",
    },
    {
      templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      templateVersion: "securities-english-type-1-v1",
    },
    {
      templateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      templateVersion: "securities-english-type-2-v1",
    },
  ] as const)(
    "creates an artifact for $templateCode",
    async ({ templateCode, templateVersion }) => {
      await createService().create({
        confirmation: {
          ...confirmation,
          draftTemplateCode: templateCode,
        },
        derivedSnapshot,
        version: 1,
        submissionKey: `submission-key-${templateCode}`,
        submittedBy: "user-1",
        artifactId: "artifact-1",
      });

      expect(documents.renderArtifactFiles).toHaveBeenCalledWith({
        confirmation: expect.objectContaining({
          draftTemplateCode: templateCode,
        }),
        derivedSnapshot: expect.objectContaining({
          contactUserId: "user-1",
        }),
      });
      expect(storage.putConfirmationArtifact).toHaveBeenCalledTimes(2);
      expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
        1,
        "project-1",
        "confirmation-1",
        "artifact-1",
        "docx",
        Buffer.from("docx-bytes"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(storage.putConfirmationArtifact).toHaveBeenNthCalledWith(
        2,
        "project-1",
        "confirmation-1",
        "artifact-1",
        "pdf",
        Buffer.from("pdf-bytes"),
        "application/pdf"
      );
      expect(prisma.confirmationArtifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "artifact-1",
          templateCode,
          templateVersion,
          docxObjectKey: expect.stringContaining(
            "project-1/confirmation-1/artifact-1"
          ),
          docxSize: Buffer.byteLength("docx-bytes"),
          pdfObjectKey: expect.stringContaining(
            "project-1/confirmation-1/artifact-1"
          ),
          pdfSize: Buffer.byteLength("pdf-bytes"),
          pdfSha256: createHash("sha256").update("pdf-bytes").digest("hex"),
        }),
      });
    }
  );

  it.each([
    [
      "renderer",
      () =>
        documents.renderArtifactFiles.mockRejectedValue(
          new Error("render failed")
        ),
    ],
    [
      "storage",
      () =>
        storage.putConfirmationArtifact
          .mockReset()
          .mockRejectedValue(new Error("storage failed")),
    ],
  ])(
    "does not persist partial metadata when %s fails",
    async (_label, fail) => {
      fail();

      await expect(
        createService().create({
          confirmation,
          derivedSnapshot,
          version: 1,
          submissionKey: "submission-key-1",
          submittedBy: "user-1",
          artifactId: "artifact-1",
        })
      ).rejects.toThrow(/./);

      expect(prisma.confirmationArtifact.create).not.toHaveBeenCalled();
    }
  );

  it("can persist through a caller-owned transaction client", async () => {
    const transaction = {
      confirmationArtifact: { create: vi.fn(({ data }) => data) },
    };

    await createService().create(
      {
        confirmation,
        derivedSnapshot,
        version: 1,
        submissionKey: "submission-key-1",
        submittedBy: "user-1",
        artifactId: "artifact-1",
      },
      transaction as never
    );

    expect(transaction.confirmationArtifact.create).toHaveBeenCalledOnce();
    expect(prisma.confirmationArtifact.create).not.toHaveBeenCalled();
  });

  it("rejects a submitter other than the authoritative contact before side effects", async () => {
    await expect(
      createService().create({
        confirmation,
        derivedSnapshot,
        version: 1,
        submissionKey: "submission-key-1",
        submittedBy: "spoofed-user",
        artifactId: "artifact-1",
      })
    ).rejects.toMatchObject({
      response: {
        code: "VALIDATION_FAILED",
        message: "Submitter must match the authoritative project contact",
      },
    });

    expect(documents.renderArtifactFiles).not.toHaveBeenCalled();
    expect(storage.putConfirmationArtifact).not.toHaveBeenCalled();
    expect(prisma.confirmationArtifact.create).not.toHaveBeenCalled();
  });

  it("deletes the DOCX when the second artifact write fails", async () => {
    const writeFailure = new Error("pdf write failed");
    storage.putConfirmationArtifact
      .mockReset()
      .mockResolvedValueOnce({
        objectKey:
          "confirmation-artifacts/project-1/confirmation-1/artifact-1/document.docx",
      })
      .mockRejectedValueOnce(writeFailure);

    await expect(
      createService().create({
        confirmation,
        derivedSnapshot,
        version: 1,
        submissionKey: "submission-key-1",
        submittedBy: "user-1",
        artifactId: "artifact-1",
      })
    ).rejects.toBe(writeFailure);

    expect(storage.deleteConfirmationArtifact).toHaveBeenCalledWith(
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx"
    );
    expect(prisma.confirmationArtifact.create).not.toHaveBeenCalled();
  });

  it("deletes both files when database persistence fails and preserves that failure", async () => {
    const persistenceFailure = new Error("database unavailable");
    prisma.confirmationArtifact.create.mockRejectedValue(persistenceFailure);
    storage.deleteConfirmationArtifact
      .mockRejectedValueOnce(new Error("cleanup failed"))
      .mockResolvedValueOnce(undefined as never);

    await expect(
      createService().create({
        confirmation,
        derivedSnapshot,
        version: 1,
        submissionKey: "submission-key-1",
        submittedBy: "user-1",
        artifactId: "artifact-1",
      })
    ).rejects.toBe(persistenceFailure);

    expect(storage.deleteConfirmationArtifact).toHaveBeenCalledTimes(2);
    expect(storage.deleteConfirmationArtifact).toHaveBeenNthCalledWith(
      1,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf"
    );
    expect(storage.deleteConfirmationArtifact).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx"
    );
  });

  it("deletes both stored formats for caller-owned transaction compensation", async () => {
    storage.deleteConfirmationArtifact
      .mockRejectedValueOnce(new Error("pdf cleanup failed"))
      .mockResolvedValueOnce(undefined as never);

    await expect(
      createService().deleteStoredFiles(
        "project-1",
        "confirmation-1",
        "artifact-1"
      )
    ).resolves.toBeUndefined();

    expect(storage.deleteConfirmationArtifact).toHaveBeenNthCalledWith(
      1,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "pdf"
    );
    expect(storage.deleteConfirmationArtifact).toHaveBeenNthCalledWith(
      2,
      "project-1",
      "confirmation-1",
      "artifact-1",
      "docx"
    );
  });
});
