import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";

import { GLOBAL_ROLES_KEY } from "../auth/global-roles.decorator";
import { GlobalRolesGuard } from "../auth/global-roles.guard";
import { ApiBadRequestException } from "../common/api-error";
import { ConfirmationsController } from "./confirmations.controller";

vi.mock("@project-wing/shared", async () => {
  const informationLibrary = await vi.importActual<Record<string, unknown>>(
    "../../../../packages/shared/src/confirmation-information-library.ts"
  );
  const templateDesign = await vi.importActual<Record<string, unknown>>(
    "../../../../packages/shared/src/confirmation-template-design.ts"
  );
  return {
    CONFIRMATION_TEMPLATE_MANAGER_GLOBAL_ROLES: ["SUPER_ADMIN"],
    ConfirmationInformationLibraryCreateInputSchema:
      informationLibrary.ConfirmationInformationLibraryCreateInputSchema,
    ConfirmationInformationLibraryUpdateInputSchema:
      informationLibrary.ConfirmationInformationLibraryUpdateInputSchema,
    ...templateDesign,
  };
});

const informationLibrary = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  restore: vi.fn(),
};
const responseLibrary = {
  listForProject: vi.fn(),
  preview: vi.fn(),
};
const templateLibrary = {
  bulkSetStatus: vi.fn(),
  list: vi.fn(),
  saveDesign: vi.fn(),
  setStatus: vi.fn(),
  upload: vi.fn(),
};

function createController() {
  return new ConfirmationsController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    templateLibrary as never,
    responseLibrary as never,
    {} as never,
    informationLibrary as never
  );
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

function templateDesignBodyWithSourceRange(sourceRange: unknown) {
  return {
    designSchema: {
      version: 1,
      fields: [
        {
          id: "reference-field",
          kind: "TEXT",
          name: "Reference",
          page: 1,
          x: 0.1,
          y: 0.2,
          width: 0.25,
          height: 0.04,
          placeholder: "Enter reference",
          options: [],
          binding: "referenceCode",
          sourceRanges: [sourceRange],
        },
      ],
    },
    designStatus: "DRAFT",
  };
}

describe("confirmationsController information library routes", () => {
  const user = { id: "user-1" } as never;
  const source = { ipAddress: "127.0.0.1" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    "createInformationLibraryEntry",
    "updateInformationLibraryEntry",
    "deactivateInformationLibraryEntry",
    "restoreInformationLibraryEntry",
  ] as const)("restricts %s to Super Admin", (method) => {
    expect(
      Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        ConfirmationsController.prototype[method]
      )
    ).toStrictEqual(["SUPER_ADMIN"]);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ConfirmationsController.prototype[method]
      )
    ).toContain(GlobalRolesGuard);
  });

  it("keeps information-library search available to unknown authenticated user", () => {
    expect(
      Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        ConfirmationsController.prototype.listInformationLibrary
      )
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ConfirmationsController.prototype.listInformationLibrary
      ) ?? []
    ).not.toContain(GlobalRolesGuard);
  });

  it.each([
    "uploadTemplateLibraryFile",
    "saveTemplateLibraryDesign",
    "bulkSetTemplateLibraryStatus",
    "setTemplateLibraryStatus",
    "deleteTemplateLibraryFile",
  ] as const)("restricts template-library %s to Super Admin", (method) => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ConfirmationsController.prototype[method]
      ) ?? []
    ).toContain(GlobalRolesGuard);
    expect(
      Reflect.getMetadata(
        GLOBAL_ROLES_KEY,
        ConfirmationsController.prototype[method]
      )
    ).toStrictEqual(["SUPER_ADMIN"]);
  });

  it("validates and forwards template workbench manifests", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });

    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                id: "field-1",
                kind: "SELECT",
                name: "salutation",
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.25,
                height: 0.04,
                placeholder: "Choose a salutation",
                options: ["Sir/Madam", "Sir", "Madam"],
              },
            ],
          },
          designStatus: "ENABLED",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });

    expect(templateLibrary.saveDesign).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({
        designStatus: "ENABLED",
        designSchema: expect.objectContaining({ version: 1 }),
      }),
      user,
      source
    );
  });

  it.each([
    "TEXT",
    "MULTILINE",
    "NUMBER",
    "DATE",
    "CHECKBOX",
    "SELECT",
    "RADIO",
    "STATIC_TEXT",
  ] as const)("accepts the %s template field kind", async (kind) => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });
    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                ...(kind === "CHECKBOX"
                  ? {
                      defaultChecked: true,
                      required: true,
                    }
                  : {}),
                id: `field-${kind.toLowerCase()}`,
                kind,
                name: `${kind} field`,
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.25,
                height: kind === "MULTILINE" ? 0.1 : 0.04,
                placeholder: `${kind} prompt`,
                options:
                  kind === "SELECT" || kind === "RADIO"
                    ? ["Option A", "Option B"]
                    : [],
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });
  });

  it("accepts and forwards field formatting and alignment", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });

    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                height: 0.04,
                id: "styled-field",
                kind: "TEXT",
                name: "Styled field",
                options: [],
                page: 1,
                placeholder: "Styled prompt",
                textAlign: "center",
                textStyle: {
                  backgroundColor: "#FFF59D",
                  bold: true,
                  fontFamily: "Noto Sans SC",
                  fontSize: 14,
                  italic: true,
                  textColor: "#123456",
                  underline: true,
                },
                width: 0.25,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });

    expect(templateLibrary.saveDesign).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({
        designSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              textAlign: "center",
              textStyle: expect.objectContaining({
                backgroundColor: "#FFF59D",
                textColor: "#123456",
              }),
            }),
          ],
        }),
      }),
      user,
      source
    );
  });

  it("accepts and forwards a text-field general-fill binding and source range", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });
    const sourceRange = validSourceRange();

    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        templateDesignBodyWithSourceRange(sourceRange),
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });

    expect(templateLibrary.saveDesign).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({
        designSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              binding: "referenceCode",
              sourceRanges: [sourceRange],
            }),
          ],
        }),
      }),
      user,
      source
    );
  });

  it("accepts a default fill source on a multiline field", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });
    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                defaultValueSource: {
                  binding: "recipientAddress",
                  source: "INFORMATION_LIBRARY",
                },
                height: 0.1,
                id: "multiline-address",
                kind: "MULTILINE",
                name: "Address",
                options: [],
                page: 1,
                placeholder: "Address",
                width: 0.4,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });

    expect(templateLibrary.saveDesign).toHaveBeenCalledWith(
      "template-1",
      expect.objectContaining({
        designSchema: expect.objectContaining({
          fields: [
            expect.objectContaining({
              informationLibraryBinding: "recipientAddress",
              kind: "MULTILINE",
            }),
          ],
        }),
      }),
      user,
      source
    );
    const savedBody = templateLibrary.saveDesign.mock.calls[0]?.[1] as {
      designSchema?: { fields?: unknown[] };
    };
    expect(savedBody.designSchema?.fields?.[0]).not.toHaveProperty(
      "defaultValueSource"
    );
  });

  it("accepts a custom initial value alongside explicit dual associations", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });

    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                baseInformationBinding: "clientName",
                defaultValueSource: {
                  source: "CUSTOM",
                  value: "Optional initial value",
                },
                height: 0.04,
                id: "dual-source-with-initial",
                informationLibraryBinding: "recipientName",
                kind: "TEXT",
                name: "Dual source with initial",
                options: [],
                page: 1,
                placeholder: "Choose a value",
                width: 0.35,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });
  });

  it("accepts the current date default fill on a date field", async () => {
    templateLibrary.saveDesign.mockResolvedValue({ id: "template-1" });
    await expect(
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
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
                y: 0.2,
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).resolves.toStrictEqual({ id: "template-1" });
  });

  it.each([
    ["baseInformationBinding", { baseInformationBinding: "recipientName" }],
    ["informationLibraryBinding", { informationLibraryBinding: "clientName" }],
  ] as const)("rejects a cross-source %s", (_name, binding) => {
    expect(() =>
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                ...binding,
                height: 0.04,
                id: "cross-source-binding",
                kind: "TEXT",
                name: "Cross source binding",
                options: [],
                page: 1,
                placeholder: "Choose a value",
                width: 0.35,
                x: 0.1,
                y: 0.2,
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.saveDesign).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a legacy paragraphText anchor",
      {
        end: 15,
        paragraphText: "Reference: ____",
        sourceText: "____",
        start: 11,
      },
    ],
    [
      "a legacy paragraphIndex anchor",
      { end: 15, paragraphIndex: 4, sourceText: "____", start: 11 },
    ],
    ["an extra source anchor property", validSourceRange({ extra: true })],
    [
      "an unsupported source part",
      validSourceRange({ part: "word/header1.xml" }),
    ],
    [
      "an invalid paragraph hash",
      validSourceRange({ paragraphXmlSha256: "invalid" }),
    ],
    [
      "a negative paragraph ordinal",
      validSourceRange({ paragraphOrdinal: -1 }),
    ],
    ["an empty paragraph id", validSourceRange({ paragraphId: "" })],
    ["an empty source range", validSourceRange({ end: 11 })],
    ["a source range length mismatch", validSourceRange({ end: 14 })],
  ] as const)("rejects %s", (_reason, sourceRange) => {
    expect(() =>
      createController().saveTemplateLibraryDesign(
        "template-1",
        templateDesignBodyWithSourceRange(sourceRange),
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.saveDesign).not.toHaveBeenCalled();
  });

  it("rejects a general-fill binding on a non-text workbench field", () => {
    expect(() =>
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                id: "invalid-binding",
                kind: "SELECT",
                name: "Salutation",
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.25,
                height: 0.04,
                placeholder: "Choose salutation",
                options: ["Sir", "Madam"],
                binding: "referenceCode",
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.saveDesign).not.toHaveBeenCalled();
  });

  it.each(["DRAFT", "ENABLED", "DISABLED"] as const)(
    "validates and forwards a single template status: %s",
    async (status) => {
      templateLibrary.setStatus.mockResolvedValue({
        id: "template-1",
        designStatus: status,
      });

      await expect(
        createController().setTemplateLibraryStatus(
          "template-1",
          { designStatus: status },
          user,
          source
        )
      ).resolves.toStrictEqual({ id: "template-1", designStatus: status });

      expect(templateLibrary.setStatus).toHaveBeenCalledWith(
        "template-1",
        status,
        user,
        source
      );
    }
  );

  it("rejects an invalid or non-strict single template status body", () => {
    const controller = createController();

    expect(() =>
      controller.setTemplateLibraryStatus(
        "template-1",
        { designStatus: "ARCHIVED" },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(() =>
      controller.setTemplateLibraryStatus(
        "template-1",
        { designStatus: "ENABLED", extra: true },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.setStatus).not.toHaveBeenCalled();
  });

  it("validates and forwards a bulk template status update", async () => {
    templateLibrary.bulkSetStatus.mockResolvedValue([
      { id: "template-1", designStatus: "ENABLED" },
      { id: "template-2", designStatus: "ENABLED" },
    ]);

    await expect(
      createController().bulkSetTemplateLibraryStatus(
        {
          templateIds: [" template-1 ", "template-2"],
          designStatus: "ENABLED",
        },
        user,
        source
      )
    ).resolves.toStrictEqual([
      { id: "template-1", designStatus: "ENABLED" },
      { id: "template-2", designStatus: "ENABLED" },
    ]);

    expect(templateLibrary.bulkSetStatus).toHaveBeenCalledWith(
      ["template-1", "template-2"],
      "ENABLED",
      user,
      source
    );
  });

  it.each([
    { templateIds: [], designStatus: "ENABLED" },
    {
      templateIds: Array.from(
        { length: 101 },
        (_, index) => `template-${index}`
      ),
      designStatus: "ENABLED",
    },
    {
      templateIds: ["template-1", " template-1 "],
      designStatus: "DISABLED",
    },
    { templateIds: ["template-1"], designStatus: "ARCHIVED" },
    { templateIds: ["template-1"], designStatus: "ENABLED", extra: true },
  ])("rejects invalid bulk template status input %#", (body) => {
    expect(() =>
      createController().bulkSetTemplateLibraryStatus(body, user, source)
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.bulkSetStatus).not.toHaveBeenCalled();
  });

  it("registers the bulk status route before the single-template route", () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        ConfirmationsController.prototype.bulkSetTemplateLibraryStatus
      )
    ).toBe("template-library/status");
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        ConfirmationsController.prototype.setTemplateLibraryStatus
      )
    ).toBe("template-library/:templateId/status");
  });

  it("does not expose internal template locations in public responses", async () => {
    const internalFields = {
      filePath: "C:\\private\\template.docx",
      objectKey: "confirmation-template-library/template.docx",
    };
    templateLibrary.list.mockResolvedValue([
      {
        id: "template-1",
        uploader: { id: "user-1", name: "Uploader" },
        fileName: "template.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ...internalFields,
      },
    ]);
    templateLibrary.upload.mockResolvedValue({
      id: "template-1",
      uploader: { id: "user-1", name: "Uploader" },
      ...internalFields,
    });
    templateLibrary.saveDesign.mockResolvedValue({
      id: "builtin-template-1",
      designStatus: "DRAFT",
      ...internalFields,
    });
    templateLibrary.setStatus.mockResolvedValue({
      id: "builtin-template-1",
      designStatus: "ENABLED",
      ...internalFields,
    });
    templateLibrary.bulkSetStatus.mockResolvedValue([
      {
        id: "builtin-template-1",
        designStatus: "DISABLED",
        ...internalFields,
      },
    ]);

    await expect(
      createController().listTemplateLibrary()
    ).resolves.toStrictEqual([
      {
        id: "template-1",
        uploader: { id: "user-1", name: "Uploader" },
        fileName: "template.pdf",
        mimeType: "application/pdf",
      },
    ]);
    await expect(
      createController().uploadTemplateLibraryFile(
        { name: "Template", confirmationType: "BANK" },
        { originalname: "template.docx" } as never,
        user,
        source
      )
    ).resolves.toStrictEqual({
      id: "template-1",
      uploader: { id: "user-1", name: "Uploader" },
    });
    await expect(
      createController().saveTemplateLibraryDesign(
        "builtin-template-1",
        { designSchema: { version: 1, fields: [] }, designStatus: "DRAFT" },
        user,
        source
      )
    ).resolves.toStrictEqual({
      id: "builtin-template-1",
      designStatus: "DRAFT",
    });
    await expect(
      createController().setTemplateLibraryStatus(
        "builtin-template-1",
        { designStatus: "ENABLED" },
        user,
        source
      )
    ).resolves.toStrictEqual({
      id: "builtin-template-1",
      designStatus: "ENABLED",
    });
    await expect(
      createController().bulkSetTemplateLibraryStatus(
        { templateIds: ["builtin-template-1"], designStatus: "DISABLED" },
        user,
        source
      )
    ).resolves.toStrictEqual([
      { id: "builtin-template-1", designStatus: "DISABLED" },
    ]);
  });

  it("rejects out-of-page template workbench geometry", () => {
    expect(() =>
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                id: "field-1",
                kind: "TEXT",
                name: "reference",
                page: 1,
                x: 0.9,
                y: 0.2,
                width: 0.2,
                height: 0.04,
                placeholder: "Ref",
                options: [],
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(templateLibrary.saveDesign).not.toHaveBeenCalled();
  });

  it.each(["TEXT", "SELECT"] as const)(
    "rejects %s workbench fields without a name",
    (kind) => {
      expect(() =>
        createController().saveTemplateLibraryDesign(
          "template-1",
          {
            designSchema: {
              version: 1,
              fields: [
                {
                  id: "field-1",
                  kind,
                  name: "   ",
                  page: 1,
                  x: 0.1,
                  y: 0.2,
                  width: 0.25,
                  height: 0.04,
                  placeholder: "Field",
                  options: [],
                },
              ],
            },
            designStatus: "DRAFT",
          },
          user,
          source
        )
      ).toThrow(ApiBadRequestException);
    }
  );

  it("rejects a SELECT workbench field without a non-empty option", () => {
    expect(() =>
      createController().saveTemplateLibraryDesign(
        "template-1",
        {
          designSchema: {
            version: 1,
            fields: [
              {
                id: "field-1",
                kind: "SELECT",
                name: "status",
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.25,
                height: 0.04,
                placeholder: "Choose a status",
                options: [],
              },
            ],
          },
          designStatus: "DRAFT",
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
  });

  it.each(["TEXT", "MASK"] as const)(
    "rejects %s workbench fields with options",
    (kind) => {
      expect(() =>
        createController().saveTemplateLibraryDesign(
          "template-1",
          {
            designSchema: {
              version: 1,
              fields: [
                {
                  id: "field-1",
                  kind,
                  name: "field",
                  page: 1,
                  x: 0.1,
                  y: 0.2,
                  width: 0.25,
                  height: 0.04,
                  placeholder: "Field",
                  options: ["Option A"],
                },
              ],
            },
            designStatus: "DRAFT",
          },
          user,
          source
        )
      ).toThrow(ApiBadRequestException);
    }
  );

  it("parses the active filter and forwards the search query", async () => {
    informationLibrary.list.mockResolvedValue([]);

    await createController().listInformationLibrary({
      query: " 012 ",
      includeInactive: "false",
    });

    expect(informationLibrary.list).toHaveBeenCalledWith({
      query: "012",
      includeInactive: false,
    });
  });

  it("forwards an applied information-library entry id", async () => {
    informationLibrary.list.mockResolvedValue([]);

    await createController().listInformationLibrary({
      entryId: "bank-012",
      includeInactive: "true",
    });

    expect(informationLibrary.list).toHaveBeenCalledWith({
      entryId: "bank-012",
      includeInactive: true,
    });
  });

  it("forwards the project and authenticated user for the project response warehouse", async () => {
    responseLibrary.listForProject.mockResolvedValue([]);

    await expect(
      createController().listProjectResponseWarehouse("project-1", user)
    ).resolves.toStrictEqual([]);

    expect(responseLibrary.listForProject).toHaveBeenCalledWith(
      "project-1",
      user
    );
  });

  it("forwards the authenticated user for response previews", async () => {
    responseLibrary.preview.mockRejectedValue(new Error("delegated"));
    const controller = createController();

    await expect(
      controller.previewResponseLibraryFile("response-1", user, {} as never)
    ).rejects.toThrow("delegated");

    expect(responseLibrary.preview).toHaveBeenCalledWith("response-1", user);
  });

  it("normalizes create input in the controller before calling the service", async () => {
    informationLibrary.create.mockResolvedValue({ id: "bank-003" });

    await createController().createInformationLibraryEntry(
      {
        bankCode: " 3 ",
        bankNameEn: " New Bank ",
        bankNameZh: " 新银行 ",
        bankType: " Local ",
        businessAddress: " Hong Kong ",
        mailingAddress: " ",
        mailingAddressSameAsBusiness: true,
        contactName: " ",
      },
      user,
      source
    );

    expect(informationLibrary.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bankCode: "003",
        bankNameEn: "New Bank",
        bankNameZh: "新银行",
        bankType: "Local",
        businessAddress: "Hong Kong",
        mailingAddress: null,
        contactName: null,
      }),
      user,
      source
    );
  });

  it("rejects provenance and status fields at the PATCH boundary", () => {
    const controller = createController();

    expect(() =>
      controller.updateInformationLibraryEntry(
        "bank-012",
        {
          bankNameEn: "Updated",
          sourceLabel: "forged-source",
          sourceRow: 99,
          isActive: false,
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(informationLibrary.update).not.toHaveBeenCalled();
  });

  it("rejects provenance and status fields at the POST boundary", () => {
    expect(() =>
      createController().createInformationLibraryEntry(
        {
          bankCode: "012",
          bankNameEn: "Bank",
          bankNameZh: "银行",
          bankType: "Local",
          businessAddress: "Hong Kong",
          sourceDescription: "forged-source",
          sourceLabel: "forged-source",
          sourceRow: 99,
          isActive: false,
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
    expect(informationLibrary.create).not.toHaveBeenCalled();
  });

  it("rejects overlong text at the controller boundary", () => {
    expect(() =>
      createController().createInformationLibraryEntry(
        {
          bankCode: "012",
          bankNameEn: "x".repeat(301),
          bankNameZh: "银行",
          bankType: "Local",
          businessAddress: "Hong Kong",
          mailingAddressSameAsBusiness: false,
        },
        user,
        source
      )
    ).toThrow(ApiBadRequestException);
  });

  it("routes update, deactivate, and restore to the matching service methods", async () => {
    const controller = createController();

    await controller.updateInformationLibraryEntry(
      "bank-012",
      { bankNameEn: "Updated" },
      user,
      source
    );
    await controller.deactivateInformationLibraryEntry(
      "bank-012",
      user,
      source
    );
    await controller.restoreInformationLibraryEntry("bank-012", user, source);

    expect(informationLibrary.update).toHaveBeenCalledWith(
      "bank-012",
      { bankNameEn: "Updated" },
      user,
      source
    );
    expect(informationLibrary.deactivate).toHaveBeenCalledWith(
      "bank-012",
      user,
      source
    );
    expect(informationLibrary.restore).toHaveBeenCalledWith(
      "bank-012",
      user,
      source
    );
  });
});
