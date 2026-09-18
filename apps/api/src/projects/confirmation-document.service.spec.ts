import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type * as FsPromises from "node:fs/promises";
import pathModule, { join } from "node:path";

import type {
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
} from "@project-wing/shared";
import JSZip from "jszip";
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";

import { ApiBadRequestException } from "../common/api-error";
import {
  ConfirmationDocumentService,
  applyDerivedSnapshotForRendering,
  replaceStandardTemplateContentControls,
} from "./confirmation-document.service";
import type { ConfirmationTemplateValues } from "./confirmation-document.service";
import { getDefaultConfirmationTemplateDesign } from "./confirmation-template-design-defaults";

const confirmationTemplatesRoot = existsSync(
  pathModule.join(
    process.cwd(),
    "src/projects/__fixtures__/legacy-confirmation-templates"
  )
)
  ? pathModule.join(
      process.cwd(),
      "src/projects/__fixtures__/legacy-confirmation-templates"
    )
  : pathModule.join(
      process.cwd(),
      "apps/api/src/projects/__fixtures__/legacy-confirmation-templates"
    );

const legacyTemplateFileNames = new Set([
  "standard-financial-institution-pdf-twin.docx",
  "bank-confirmation-hk-standard-english.docx",
  "securities-confirmation-english-type-1.docx",
  "securities-confirmation-english-type-2.docx",
]);

function resolveLegacyTemplateFixture(
  filePath: Parameters<typeof readFile>[0]
) {
  const fileName = pathModule.basename(String(filePath));
  return legacyTemplateFileNames.has(fileName)
    ? pathModule.join(confirmationTemplatesRoot, fileName)
    : filePath;
}

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const path = await vi.importActual<typeof import("node:path")>("node:path");
  const fixtureRoot = actual.existsSync(
    path.join(
      process.cwd(),
      "src/projects/__fixtures__/legacy-confirmation-templates"
    )
  )
    ? path.join(
        process.cwd(),
        "src/projects/__fixtures__/legacy-confirmation-templates"
      )
    : path.join(
        process.cwd(),
        "apps/api/src/projects/__fixtures__/legacy-confirmation-templates"
      );
  const fileNames = new Set([
    "standard-financial-institution-pdf-twin.docx",
    "bank-confirmation-hk-standard-english.docx",
    "securities-confirmation-english-type-1.docx",
    "securities-confirmation-english-type-2.docx",
  ]);
  return {
    ...actual,
    existsSync: vi.fn((filePath: import("node:fs").PathLike) => {
      const fileName = path.basename(String(filePath));
      return actual.existsSync(
        fileNames.has(fileName) ? path.join(fixtureRoot, fileName) : filePath
      );
    }),
  };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof FsPromises>("node:fs/promises");
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

let actualReadFile: typeof readFile;

function readActualFile(filePath: Parameters<typeof readFile>[0]) {
  return actualReadFile(resolveLegacyTemplateFixture(filePath));
}

const storage = {
  putCacheObject: vi.fn(),
  getCacheObjectBuffer: vi.fn(),
  getDownloadObject: vi.fn(),
  getObjectBuffer: vi.fn(),
};
const documentConversion = {
  getAttachmentPreviewPdf: vi.fn(),
  convertPdfBufferToDocx: vi.fn(),
  convertOfficeBufferToPdf: vi.fn(),
};

function createService() {
  return new ConfirmationDocumentService(
    storage as never,
    documentConversion as never
  );
}

async function createTestPdf(pageCount = 1) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    document.addPage([595.45, 841.7]);
  }
  return Buffer.from(await document.save());
}

function renderDynamicArtifact({
  fieldValues = {},
  fields,
  templateCode = "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
}: {
  fieldValues?: Record<string, unknown>;
  fields: Record<string, unknown>[];
  templateCode?: ConfirmationDraftTemplateCode;
}) {
  return createService().renderArtifactFiles({
    confirmation: {
      id: "confirmation-dynamic-fields",
      projectId: "project-1",
      type: templateCode.startsWith("SECURITIES") ? "INTERMEDIARY" : "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: templateCode,
      draftPayload: {
        auditorAddress: "Auditor line 1\nAuditor line 2",
        bankName: "HSBC",
        recipientAddress: "Bank line 1\nBank line 2",
        recipientName: "Custodian",
        sections: {},
        templateDesignSchema: { version: 1, fields },
        templateFieldValues: fieldValues,
      } as unknown as ConfirmationDraftPayload,
    },
  });
}

const standardTemplateValues: ConfirmationTemplateValues = {
  accountNumber: "",
  auditPeriodText: "2026",
  auditorAddress: "17/F, Central Tower",
  auditorName: "Wing CPA Limited",
  authorizationAccount: "001-123456",
  bankDisplayName: "HSBC Hong Kong",
  bankName: "HSBC Hong Kong",
  clientCode: "C-ORC",
  clientName: "Orchid Holdings",
  companyHandlerName: "",
  companyHandlerPhone: "",
  companyHandlerTitle: "",
  companySignatureDateText: "",
  counterpartyAddress: "",
  customerName: "Orchid Holdings",
  englishReportDate: "31 December 2026",
  officeDate: "04 August 2026",
  micEmail: "",
  micName: "",
  micNameAndInitial: "",
  picName: "Server PIC",
  projectCode: "AUD-2026-0003",
  recipientAddress: "",
  recipientName: "",
  receivingSupplement: "",
  referenceCode: "C-ORC/Server PIC",
  replyAddress: "",
  replyContact: "",
  replyEmail: "",
  replyFax: "",
  replyPhone: "",
  replyPostalCode: "",
  reportDateText: "2026年12月31日",
  salutation: "",
  yearEndDate: "31 December 2026",
};

async function readStandardTemplateXml() {
  const buffer = await readFile(
    pathModule.join(
      confirmationTemplatesRoot,
      "standard-financial-institution-pdf-twin.docx"
    )
  );
  const zip = await JSZip.loadAsync(buffer);
  return assertPresentValue(zip.file("word/document.xml")).async("string");
}

async function readHkTemplateXml() {
  const buffer = await readFile(
    pathModule.join(
      confirmationTemplatesRoot,
      "bank-confirmation-hk-standard-english.docx"
    )
  );
  const zip = await JSZip.loadAsync(buffer);
  return assertPresentValue(zip.file("word/document.xml")).async("string");
}

async function buildHkTemplateVariant(transform: (xml: string) => string) {
  const buffer = await readActualFile(
    pathModule.join(
      confirmationTemplatesRoot,
      "bank-confirmation-hk-standard-english.docx"
    )
  );
  const zip = await JSZip.loadAsync(buffer);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("HK template is missing word/document.xml");
  }
  const xml = transform(await document.async("string"));
  zip.file("word/document.xml", xml);
  return {
    docx: await zip.generateAsync({ type: "nodebuffer" }),
    xml,
  };
}

function getSourceRangeAnchor(xml: string, sourceText: string) {
  const paragraphs = Array.from(
    xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g),
    (match) => match[0]
  );
  const paragraphOrdinal = paragraphs.findIndex((paragraph) =>
    getWordParagraphText(paragraph).includes(sourceText)
  );
  const paragraphXml = paragraphs[paragraphOrdinal];
  if (!paragraphXml) {
    throw new Error(`Unable to find source text: ${sourceText}`);
  }
  const paragraphText = getWordParagraphText(paragraphXml);
  const start = paragraphText.indexOf(sourceText);
  if (start === -1) {
    throw new Error(`Unable to locate source text range: ${sourceText}`);
  }

  const paragraphId = paragraphXml
    .match(/\bw14:paraId\s*=\s*["']([\dA-Fa-f]{8})["']/)?.[1]
    ?.toUpperCase();
  return {
    end: start + sourceText.length,
    ...(paragraphId ? { paragraphId } : {}),
    paragraphOrdinal,
    paragraphXmlSha256: createHash("sha256").update(paragraphXml).digest("hex"),
    part: "word/document.xml" as const,
    sourceText,
    start,
  };
}

function getWordParagraphText(paragraphXml: string) {
  return Array.from(
    paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => unescapeXml(match[1] ?? "")
  ).join("");
}

describe(ConfirmationDocumentService, () => {
  beforeAll(async () => {
    const actual = await vi.importActual<{ readFile: typeof readFile }>(
      "node:fs/promises"
    );
    actualReadFile = actual.readFile;
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockImplementation((filePath, options) =>
      actualReadFile(resolveLegacyTemplateFixture(filePath), options as never)
    );
    storage.getCacheObjectBuffer.mockResolvedValue(null);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(
      await createTestPdf(5)
    );
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(
      Buffer.from("converted-docx")
    );
    storage.getDownloadObject.mockReturnValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });
  });

  it("materializes dynamic template fields and masks into the formal document before PDF conversion", async () => {
    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-dynamic-fields",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          bankName: "HSBC",
          sections: {},
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "mask-source",
                kind: "MASK",
                name: "Remove source field",
                page: 1,
                x: 0.1,
                y: 0.2,
                width: 0.3,
                height: 0.04,
                placeholder: "",
                options: [],
              },
              {
                id: "custom-reference",
                kind: "TEXT",
                name: "Custom reference",
                page: 1,
                x: 0.12,
                y: 0.21,
                width: 0.28,
                height: 0.035,
                placeholder: "Never render this prompt",
                options: [],
              },
              {
                id: "page-two-choice",
                kind: "SELECT",
                name: "Page two choice",
                page: 2,
                x: 0.25,
                y: 0.3,
                width: 0.2,
                height: 0.04,
                placeholder: "Choose one",
                options: ["Option A", "Option B"],
              },
            ],
          },
          templateFieldValues: {
            "custom-reference": "Custom & <reference>",
            "page-two-choice": "Option B",
          },
        } as unknown as ConfirmationDraftPayload,
      },
    });
    const baseXml = await extractLastOfficeConversionXml();

    expect(baseXml).not.toContain("Never render this prompt");
    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer) })
    );
  });

  it.each([false, true])("exports underline and synthetic italic with upright Unicode fonts (%s)", async (styled) => {
    const fontPath = "C:\\Windows\\Fonts\\NotoSansSC-VF.ttf";
    const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs");
  vi.mocked(existsSync).mockImplementation((value) => String(value) === fontPath || actualFs.existsSync(resolveLegacyTemplateFixture(value) as import("node:fs").PathLike));
    vi.mocked(readFile).mockImplementation((value, options) =>
      actualReadFile(String(value) === fontPath ? pathModule.resolve(confirmationTemplatesRoot, "../../../../../emp/public/pdfjs/standard_fonts/LiberationSans-Regular.ttf") : resolveLegacyTemplateFixture(value), options as never)
    );
    const artifact = await renderDynamicArtifact({
      fields: [{ id: "style", kind: "MULTILINE", name: "Style", page: 1,
        x: 0.1, y: 0.2, width: 0.7, height: 0.15, options: [],
        textStyle: { fontFamily: "Noto Sans SC", fontSize: 14, bold: false, italic: styled, underline: styled },
      }],
      fieldValues: { style: "Confirmation style\nSecond line" },
    });
    const pdf = await PDFDocument.load(artifact.pdf);
    const contents = pdf.getPage(0).node.Contents() as PDFArray;
    const operators = Array.from({ length: contents.size() }, (_, index) =>
      Buffer.from(decodePDFRawStream(contents.lookup(index, PDFRawStream)).decode()).toString()
    ).join("\n");
    expect(operators.match(/\nS\n/g)?.length ?? 0).toBe(styled ? 2 : 0);
    expect(/1 0 0\.212[0-9]+ 1 .* Tm/.test(operators)).toBe(styled);
    if (process.env.CONFIRMATION_STYLE_EVIDENCE) {
      const { writeFile } = await vi.importActual<typeof FsPromises>("node:fs/promises");
      await writeFile(`${process.env.CONFIRMATION_STYLE_EVIDENCE}-${styled ? "styled" : "plain"}.pdf`, artifact.pdf);
    }
  });

  it("carries configured text styles into the rendered Word field", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          id: "styled-field",
          kind: "TEXT",
          name: "Styled field",
          page: 1,
          x: 0.12,
          y: 0.21,
          width: 0.28,
          height: 0.035,
          placeholder: "Styled prompt",
          options: [],
          textStyle: {
            backgroundColor: "#FFF59D",
            bold: true,
            fontFamily: "Arial",
            fontSize: 14,
            italic: true,
            textColor: "#123456",
            underline: true,
          },
          textAlign: "center",
        },
      ],
      fieldValues: { "styled-field": "Styled value" },
    });
    const xml = await extractDocumentXml(artifact.docx);
    expect(xml).toContain(
      '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/>'
    );
    expect(xml).toContain('<w:sz w:val="28"/><w:szCs w:val="28"/>');
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
    expect(xml).toContain('<w:color w:val="123456"/>');
    expect(xml).toContain(
      '<w:shd w:val="clear" w:color="auto" w:fill="FFF59D"/>'
    );
    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
  });

  it("preserves the configured Word font size for long multiline values", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          id: "multiline-font",
          kind: "MULTILINE",
          name: "Address",
          options: [],
          page: 1,
          x: 0.1,
          y: 0.4,
          width: 0.2,
          height: 0.3,
          textStyle: {
            fontFamily: "Arial",
            fontSize: 12,
            bold: false,
            italic: false,
            underline: false,
          },
        },
      ],
      fieldValues: { "multiline-font": "x".repeat(100) },
    });
    const xml = await extractDocumentXml(artifact.docx);
    const shape = xml.match(
      /<v:rect id="PW_DYNAMIC_multiline-font"[\s\S]*?<\/v:rect>/u
    )?.[0];
    expect(shape).toContain('<w:sz w:val="24"/>');
    expect(shape).toContain("x".repeat(100));
  });

  it("materializes multiline, number, date, checkbox, and radio values", async () => {
    const kinds = [
      ["multiline", "MULTILINE", [], "Line one\nLine two"],
      ["number", "NUMBER", [], "123.45"],
      ["date", "DATE", [], "2026-12-31"],
      ["checkbox", "CHECKBOX", [], "true"],
      ["radio", "RADIO", ["Option A", "Option B"], "Option B"],
    ] as const;
    const artifact = await renderDynamicArtifact({
      fields: kinds.map(([id, kind, options], index) => ({
        height: kind === "MULTILINE" ? 0.08 : 0.04,
        id,
        kind,
        name: `${kind} field`,
        options: [...options],
        page: 1,
        placeholder: `${kind} prompt`,
        width: 0.25,
        x: 0.1,
        y: 0.35 + index * 0.11,
      })),
      fieldValues: Object.fromEntries(
        kinds.map(([id, , , value]) => [id, value])
      ),
    });
    const xml = await extractDocumentXml(artifact.docx);
    expect(xml).toContain("Line one");
    expect(xml).toContain("<w:br/>");
    expect(xml).toContain("Line two");
    expect(xml).toContain("123.45");
    expect(xml).toContain("2026-12-31");
    expect(xml).toContain("☒");
    expect(xml).toContain("◉ Option B");
  });

  it("renders the configured default state for an unset checkbox", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          defaultChecked: true,
          height: 0.04,
          id: "default-checkbox",
          kind: "CHECKBOX",
          name: "Default checkbox",
          options: [],
          page: 1,
          placeholder: "Default checkbox",
          required: true,
          width: 0.25,
          x: 0.1,
          y: 0.35,
        },
      ],
      fieldValues: {},
    });
    const xml = await extractDocumentXml(artifact.docx);
    expect(xml).toContain("☒");
  });

  it("leaves legacy relation values blank until a template value is selected", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          defaultValueSource: {
            binding: "auditorAddress",
            source: "BASE_INFORMATION",
          },
          height: 0.1,
          id: "auditor-address",
          kind: "MULTILINE",
          name: "Auditor address",
          options: [],
          page: 1,
          placeholder: "Auditor address",
          width: 0.35,
          x: 0.1,
          y: 0.2,
        },
        {
          height: 0.1,
          id: "bank-address",
          defaultValueSource: {
            binding: "recipientAddress",
            source: "INFORMATION_LIBRARY",
          },
          kind: "MULTILINE",
          name: "Bank address",
          options: [],
          page: 1,
          placeholder: "Bank address",
          width: 0.35,
          x: 0.1,
          y: 0.35,
        },
      ],
    });
    const xml = await extractDocumentXml(artifact.docx);
    const dynamicXml = ["auditor-address", "bank-address"]
      .map((id) => extractDynamicFieldXml(xml, id))
      .join("");
    expect(dynamicXml).not.toContain("Auditor line 1");
    expect(dynamicXml).not.toContain("Auditor line 2");
    expect(dynamicXml).not.toContain("Bank line 1");
    expect(dynamicXml).not.toContain("Bank line 2");
  });

  it("renders an explicitly selected value before binding or custom defaults", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          baseInformationBinding: "auditorAddress",
          defaultValueSource: { source: "CUSTOM", value: "Initial value" },
          height: 0.1,
          id: "explicit-selected-value",
          informationLibraryBinding: "recipientAddress",
          kind: "MULTILINE",
          name: "Explicit selected value",
          options: [],
          page: 1,
          placeholder: "Choose a value",
          width: 0.35,
          x: 0.1,
          y: 0.2,
        },
      ],
      fieldValues: { "explicit-selected-value": "Chosen template value" },
    });
    const xml = await extractDocumentXml(artifact.docx);
    const dynamicXml = extractDynamicFieldXml(xml, "explicit-selected-value");

    expect(dynamicXml).toContain("Chosen template value");
    expect(dynamicXml).not.toContain("Auditor line 1");
    expect(dynamicXml).not.toContain("Bank line 1");
    expect(dynamicXml).not.toContain("Initial value");
  });

  it("leaves an explicitly associated field blank until a template value is selected", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          baseInformationBinding: "auditorAddress",
          height: 0.1,
          id: "explicit-unselected-value",
          informationLibraryBinding: "recipientAddress",
          kind: "MULTILINE",
          name: "Explicit unselected value",
          options: [],
          page: 1,
          placeholder: "Choose a value",
          width: 0.35,
          x: 0.1,
          y: 0.2,
        },
      ],
      fieldValues: {},
    });
    const xml = await extractDocumentXml(artifact.docx);
    const dynamicXml = extractDynamicFieldXml(xml, "explicit-unselected-value");

    expect(dynamicXml).not.toContain("Auditor line 1");
    expect(dynamicXml).not.toContain("Bank line 1");
  });

  it.each([
    ["baseInformationBinding", { baseInformationBinding: "recipientName" }],
    ["informationLibraryBinding", { informationLibraryBinding: "clientName" }],
  ])("rejects cross-source %s during rendering", async (_binding, binding) => {
    await expect(
      renderDynamicArtifact({
        fields: [
          {
            ...binding,
            height: 0.1,
            id: "cross-source-binding",
            kind: "MULTILINE",
            name: "Cross-source binding",
            options: [],
            page: 1,
            placeholder: "Choose a value",
            width: 0.35,
            x: 0.1,
            y: 0.2,
          },
        ],
      })
    ).rejects.toThrow(
      'dynamic field "cross-source-binding" has invalid binding or source ranges'
    );
  });

  it("renders the current date default when a date field has no edited value", async () => {
    const now = new Date();
    const expectedToday = new Date(
      now.getTime() - now.getTimezoneOffset() * 60_000
    )
      .toISOString()
      .slice(0, 10);
    const artifact = await renderDynamicArtifact({
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
          y: 0.35,
        },
      ],
    });
    await expect(extractDocumentXml(artifact.docx)).resolves.toContain(
      expectedToday
    );
  });

  it("renders static text as fixed content and ignores submitted field values", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          height: 0.08,
          id: "fixed-instructions",
          kind: "STATIC_TEXT",
          name: "Fixed instructions",
          options: [],
          page: 1,
          placeholder:
            "Return directly to the auditor.\nDo not send to the client.",
          width: 0.5,
          x: 0.1,
          y: 0.35,
        },
      ],
      fieldValues: {
        "fixed-instructions": "User attempted to replace the fixed text",
      },
    });
    const xml = await extractDocumentXml(artifact.docx);
    expect(xml).toContain("Return directly to the auditor.");
    expect(xml).toContain("Do not send to the client.");
    expect(xml).toContain("<w:br/>");
    expect(xml).not.toContain("User attempted to replace the fixed text");
  });

  it("renders type-safe custom defaults when fields have no edited values", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          defaultValueSource: { source: "CUSTOM", value: "Custom text" },
          height: 0.04,
          id: "custom-text",
          kind: "TEXT",
          name: "Custom text",
          options: [],
          page: 1,
          placeholder: "Custom text",
          width: 0.25,
          x: 0.1,
          y: 0.2,
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
          y: 0.3,
        },
        {
          defaultValueSource: { source: "CUSTOM", value: "Option B" },
          height: 0.06,
          id: "custom-radio",
          kind: "RADIO",
          name: "Custom radio",
          options: ["Option A", "Option B"],
          page: 1,
          placeholder: "Custom radio",
          width: 0.3,
          x: 0.1,
          y: 0.4,
        },
      ],
    });
    const xml = await extractDocumentXml(artifact.docx);
    expect(xml).toContain("Custom text");
    expect(xml).toContain("123.45");
    expect(xml).toContain("◉ Option B");
  });

  it.each([
    ["NUMBER", "not-a-number", [], "NUMBER field"],
    ["DATE", "2026-99-99", [], "DATE field"],
    ["RADIO", "Option C", ["Option A", "Option B"], "RADIO field"],
  ] as const)(
    "rejects an invalid %s value before document conversion",
    async (kind, value, options, expectedMessage) => {
      await expect(
        renderDynamicArtifact({
          fields: [
            {
              height: 0.04,
              id: `invalid-${kind.toLowerCase()}`,
              kind,
              name: `${kind} field`,
              options: [...options],
              page: 1,
              placeholder: `${kind} field`,
              width: 0.25,
              x: 0.1,
              y: 0.35,
            },
          ],
          fieldValues: { [`invalid-${kind.toLowerCase()}`]: value },
        })
      ).rejects.toThrow(expectedMessage);
    }
  );

  it("keeps dynamic field shapes above document text in Word renderers", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          id: "front-field",
          kind: "TEXT",
          name: "Front field",
          page: 1,
          x: 0.12,
          y: 0.52,
          width: 0.18,
          height: 0.02,
          placeholder: "Front field",
          options: [],
        },
      ],
      fieldValues: { "front-field": "Visible value" },
    });

    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
  });

  it("removes selected source text from document.xml when a dynamic TEXT field declares sourceRanges", async () => {
    const replacementText = "CUSTOM AUDIT CONFIRMATION TITLE";
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const sourceRange = getSourceRangeAnchor(
      await readHkTemplateXml(),
      sourceText
    );
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          id: "replacement-title",
          kind: "TEXT",
          name: "Replacement title",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.5,
          height: 0.04,
          placeholder: "",
          options: [],
          sourceRanges: [sourceRange],
        },
      ],
      fieldValues: { "replacement-title": replacementText },
    });
    const conversionXml = await extractLastOfficeConversionXml();

    expect(conversionXml).not.toContain(sourceText);
    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("removes To The Manager before writing the replacement value", async () => {
    const replacementText = "Operations Manager";
    const sourceText = "(To The Manager)";
    const sourceRange = getSourceRangeAnchor(
      await readStandardTemplateXml(),
      sourceText
    );
    const artifact = await renderDynamicArtifact({
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      fields: [
        {
          id: "manager-recipient",
          kind: "TEXT",
          name: "Manager recipient",
          page: 1,
          x: 0.122,
          y: 0.138,
          width: 0.32,
          height: 0.018,
          placeholder: sourceText,
          options: [],
          sourceRanges: [sourceRange],
        },
      ],
      fieldValues: { "manager-recipient": replacementText },
    });
    const conversionXml = await extractLastOfficeConversionXml();

    expect(conversionXml).not.toContain(sourceText);
    expect(conversionXml).not.toContain("To The Manager");
    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("clears a known legacy source when its anchor is missing", async () => {
    const artifact = await renderDynamicArtifact({
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      fields: [
        {
          id: "unanchored-manager-recipient",
          kind: "TEXT",
          name: "Manager recipient",
          page: 1,
          x: 0.122,
          y: 0.138,
          width: 0.32,
          height: 0.018,
          placeholder: "To The Manager",
          options: [],
        },
      ],
      fieldValues: { "unanchored-manager-recipient": "Operations Manager" },
    });
    const text = await extractLastOfficeConversionText();

    expect(text).not.toContain("(To The Manager)");
  });

  it("clears every standard source field represented by a legacy placeholder", async () => {
    const replacements = [
      ["manager", "To the Manager", "Operations Manager", "(To The Manager)"],
      ["bank", "Bank Office", "HSBC Hong Kong", "(Name of bank)"],
      ["date", "Date", "12 August 2026", "(Date)"],
      ["reference", "Ref", "REF-2026", "(Reference)"],
      [
        "customer",
        "Custer‘s name",
        "Harbour Retail Limited",
        "(Customer’s Name)",
      ],
    ] as const;
    await renderDynamicArtifact({
      templateCode: "STANDARD_FINANCIAL_INSTITUTION",
      fields: replacements.map(([id, placeholder]) => ({
        id: `legacy-${id}`,
        kind: "TEXT",
        name: id,
        page: 1,
        x: 0.1,
        y: 0.1,
        width: 0.3,
        height: 0.04,
        placeholder,
        options: [],
      })),
      fieldValues: Object.fromEntries(
        replacements.map(([id, , value]) => [`legacy-${id}`, value])
      ),
    });
    const text = await extractLastOfficeConversionText();

    for (const [, , , sourceText] of replacements) {
      expect(text).not.toContain(sourceText);
    }
  });

  it("resolves source range offsets from decimal and hexadecimal XML entities", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const template = await buildHkTemplateVariant((xml) =>
      xml.replace("REQUEST", "&#82;&#x45;QUEST")
    );
    const sourceRange = getSourceRangeAnchor(template.xml, sourceText);
    vi.mocked(readFile).mockResolvedValueOnce(template.docx as never);

    await renderDynamicArtifact({
      fields: [
        {
          id: "numeric-entity-source-range",
          kind: "TEXT",
          name: "Replacement title",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.5,
          height: 0.04,
          placeholder: "",
          options: [],
          sourceRanges: [sourceRange],
        },
      ],
      fieldValues: {
        "numeric-entity-source-range": "CUSTOM AUDIT CONFIRMATION TITLE",
      },
    });

    await expect(extractLastOfficeConversionText()).resolves.not.toContain(
      sourceText
    );
  });

  it("matches w14:paraId anchors across valid attribute syntax and hex casing", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const template = await buildHkTemplateVariant((xml) => {
      const paragraph = Array.from(
        xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g),
        (match) => match[0]
      ).find((candidate) =>
        getWordParagraphText(candidate).includes(sourceText)
      );
      if (!paragraph) {
        throw new Error("Unable to find anchored HK paragraph");
      }
      const updatedParagraph = paragraph.replace(
        /\bw14:paraId="([\dA-Fa-f]{8})"/,
        (_attribute, paragraphId: string) =>
          `w14:paraId = '${paragraphId.toLowerCase()}'`
      );
      if (updatedParagraph === paragraph) {
        throw new Error("Anchored HK paragraph is missing w14:paraId");
      }
      return xml.replace(paragraph, updatedParagraph);
    });
    const sourceRange = getSourceRangeAnchor(template.xml, sourceText);
    expect(sourceRange.paragraphId).toMatch(/^[\dA-F]{8}$/);
    vi.mocked(readFile).mockResolvedValueOnce(template.docx as never);

    await renderDynamicArtifact({
      fields: [
        {
          id: "normalized-paragraph-id",
          kind: "TEXT",
          name: "Replacement title",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.5,
          height: 0.04,
          placeholder: "",
          options: [],
          sourceRanges: [sourceRange],
        },
      ],
      fieldValues: {
        "normalized-paragraph-id": "CUSTOM AUDIT CONFIRMATION TITLE",
      },
    });

    await expect(extractLastOfficeConversionText()).resolves.not.toContain(
      sourceText
    );
  });

  it("rejects a different w14:paraId after case normalization", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const sourceRange = getSourceRangeAnchor(
      await readHkTemplateXml(),
      sourceText
    );

    await expect(
      renderDynamicArtifact({
        fields: [
          {
            id: "mismatched-paragraph-id",
            kind: "TEXT",
            name: "Replacement title",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.5,
            height: 0.04,
            placeholder: "",
            options: [],
            sourceRanges: [
              {
                ...sourceRange,
                paragraphId:
                  sourceRange.paragraphId === "00000000"
                    ? "FFFFFFFF"
                    : "00000000",
              },
            ],
          },
        ],
      })
    ).rejects.toThrow("source paragraph no longer matches its saved anchor");
  });

  it("rejects source ranges that mix the retired paragraph index with the stable anchor", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";

    await expect(
      renderDynamicArtifact({
        fields: [
          {
            id: "mixed-source-range",
            kind: "TEXT",
            name: "Replacement title",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.5,
            height: 0.04,
            placeholder: "",
            options: [],
            sourceRanges: [
              {
                end: sourceText.length,
                paragraphIndex: 38,
                paragraphText: sourceText,
                sourceText,
                start: 0,
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(
      'dynamic field "mixed-source-range" has invalid binding or source ranges'
    );
  });

  it("rejects a source range when its anchored paragraph XML has changed", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const sourceRange = {
      ...getSourceRangeAnchor(await readHkTemplateXml(), sourceText),
      paragraphXmlSha256: "0".repeat(64),
    };

    await expect(
      renderDynamicArtifact({
        fields: [
          {
            id: "changed-source-range",
            kind: "TEXT",
            name: "Replacement title",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.5,
            height: 0.04,
            placeholder: "",
            options: [],
            sourceRanges: [sourceRange],
          },
        ],
      })
    ).rejects.toThrow("source paragraph no longer matches its saved anchor");
  });

  it("filters XML 1.0 forbidden control characters from dynamic field values", async () => {
    const artifact = await renderDynamicArtifact({
      fields: [
        {
          id: "controlled-text",
          kind: "TEXT",
          name: "Controlled text",
          page: 1,
          x: 0.1,
          y: 0.1,
          width: 0.2,
          height: 0.04,
          placeholder: "",
          options: [],
        },
      ],
      fieldValues: {
        "controlled-text": "Before\u0001middle\u000Bafter",
      },
    });
    const artifactXml = await extractDocumentXml(artifact.docx);
    const artifactText = await extractDocxText(artifact.docx);

    const containsForbiddenControl = [...artifactXml].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31)
      );
    });
    expect(containsForbiddenControl).toBeFalsy();
    expect(artifactText).toContain("Beforemiddleafter");

    const conversionXml = await extractLastOfficeConversionXml();

    expect(conversionXml).not.toMatch(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/
    );
    expect(artifact.pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("rejects SELECT values outside the configured options", async () => {
    await expect(
      renderDynamicArtifact({
        fields: [
          {
            id: "delivery-method",
            kind: "SELECT",
            name: "Delivery method",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.04,
            placeholder: "",
            options: ["Email", "Post"],
          },
        ],
        fieldValues: { "delivery-method": "Courier" },
      })
    ).rejects.toThrow(
      'SELECT field "delivery-method" value must match one of its options'
    );
  });

  it("rejects invalid dynamic fields instead of silently omitting them", async () => {
    await expect(
      renderDynamicArtifact({
        fields: [
          {
            id: "zero-width",
            kind: "TEXT",
            name: "Invalid field",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0,
            height: 0.04,
            placeholder: "",
            options: [],
          },
        ],
      })
    ).rejects.toThrow('dynamic field "zero-width" is invalid');
  });

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)(
    "rejects a dynamic page beyond the source PDF for %s",
    async (templateCode) => {
      const page = 6;
      await expect(
        renderDynamicArtifact({
          templateCode,
          fields: [
            {
              id: "unanchored-field",
              kind: "TEXT",
              name: "Unanchored field",
              page,
              x: 0.1,
              y: 0.1,
              width: 0.2,
              height: 0.04,
              placeholder: "",
              options: [],
            },
          ],
        })
      ).rejects.toThrow(
        `dynamic field "unanchored-field" page ${page} cannot be rendered`
      );
    }
  );

  it("rejects dynamic fields for unsupported legacy templates", async () => {
    await expect(
      renderDynamicArtifact({
        templateCode: "PRC_BANK_TEMPLATE_1",
        fields: [
          {
            id: "legacy-overlay",
            kind: "MASK",
            name: "Legacy overlay",
            page: 1,
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.04,
            placeholder: "",
            options: [],
          },
        ],
      })
    ).rejects.toThrow(
      "dynamic fields are not supported for PRC_BANK_TEMPLATE_1"
    );
  });

  it("keeps editable client names for the HK English overlay while overriding authoritative identity fields", () => {
    const authoritative = applyDerivedSnapshotForRendering(
      {
        clientCode: "spoofed-client-code",
        clientName: "Spoofed Client",
        customerName: "Spoofed Customer",
        projectCode: "spoofed-project-code",
        projectName: "Spoofed Project",
        picName: "Spoofed PIC",
        fiscalYear: "2099",
        balanceSheetDate: "2099-01-01",
        reportDate: "2099-01-01",
        contactUserId: "spoofed-user",
        contactName: "Spoofed Contact",
        contactEmail: "spoofed@example.test",
        confirmationCode: "SPOOFED-CODE",
        replyContact: "Spoofed Reply Contact",
        replyEmail: "spoofed-reply@example.test",
      },
      {
        clientCode: "C-ORC",
        clientName: "Orchid Holdings",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Spoofed PIC",
        fiscalYear: 2026,
        balanceSheetDate: "2026-12-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
      "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
    );

    expect(authoritative).toStrictEqual(
      expect.objectContaining({
        clientCode: "C-ORC",
        clientName: "Spoofed Client",
        customerName: "Spoofed Customer",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Spoofed PIC",
        fiscalYear: "2026年度",
        balanceSheetDate: "2026-12-31",
        reportDate: "2099-01-01",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
        replyContact: "Project Member",
        replyEmail: "member@example.test",
      })
    );
  });

  it("restores authoritative client, PIC, and reference semantics for the standard template", () => {
    const authoritative = applyDerivedSnapshotForRendering(
      {
        clientName: "Spoofed Client",
        customerName: "Spoofed Customer",
        picName: "Spoofed PIC",
        sections: {},
      },
      {
        clientCode: "C-ORC",
        clientName: "Orchid Holdings",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Server PIC",
        fiscalYear: 2026,
        balanceSheetDate: "2026-12-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
      "STANDARD_FINANCIAL_INSTITUTION"
    );

    expect(authoritative).toStrictEqual(
      expect.objectContaining({
        clientName: "Orchid Holdings",
        customerName: "Orchid Holdings",
        picName: "Server PIC",
      })
    );
  });

  it.each(["BANK_CONFIRMATION_HK_STANDARD_ENGLISH"])(
    "renders %s without inventing a Ref value",
    async (draftTemplateCode) => {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: "confirmation-1",
          projectId: "project-1",
          type: "BANK",
          confirmationCode: "AUD-2026-0003-YH-001",
          counterpartyName: "HSBC",
          draftTemplateCode,
          draftPayload: {
            clientCode: "spoofed-client",
            clientName: "Spoofed Client",
            projectCode: "spoofed-project",
            picName: "Spoofed PIC",
            fiscalYear: "2099",
            balanceSheetDate: "2099-01-01",
            contactName: "Spoofed Contact",
            contactEmail: "spoofed@example.test",
            replyContact: "Spoofed Reply Contact",
            replyEmail: "spoofed-reply@example.test",
            customerName: "Spoofed Customer",
            bankName: "HSBC",
            sections: {},
          },
        },
        derivedSnapshot: {
          clientCode: "C-ORC",
          clientName: "Orchid Holdings",
          projectCode: "AUD-2026-0003",
          projectName: "Orchid Audit 2026",
          picName: "Server PIC",
          fiscalYear: 2026,
          balanceSheetDate: "2026-12-31",
          contactUserId: "user-1",
          contactName: "Project Member",
          contactEmail: "member@example.test",
          confirmationCode: "AUD-2026-0003-YH-001",
        },
      });
      const text = await extractDocxText(artifact.docx);

      expect(text).not.toContain("C-ORC/Server PIC");
      expect(text).not.toContain("spoofed-client");
      expect(text).not.toContain("Spoofed PIC");
      expect(text).not.toContain("2099");
      expect(text).not.toContain("Spoofed Reply Contact");
      expect(text).not.toContain("spoofed-reply@example.test");
      expect(text).toContain("Spoofed Customer");
    }
  );

  it.each([
    "STANDARD_FINANCIAL_INSTITUTION",
    "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
    "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
  ] as const)(
    "does not render the project identity reference as an editable Ref for %s",
    async (draftTemplateCode) => {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: `confirmation-default-reference-${draftTemplateCode}`,
          projectId: "project-1",
          type: draftTemplateCode.startsWith("SECURITIES")
            ? "INTERMEDIARY"
            : "BANK",
          confirmationCode: "AUD-2026-0003-YH-001",
          counterpartyName: "HSBC",
          draftTemplateCode,
          draftPayload: {
            clientCode: "C-HBR-010",
            picName: "Edric Han",
            referenceCode: "C-HBR-010/Edric Han",
            bankName: "HSBC",
            sections: {},
          },
        },
        derivedSnapshot: {
          clientCode: "C-HBR-010",
          clientName: "Harbour Retail Limited",
          projectCode: "AUD-2026-0003",
          projectName: "Harbour Audit 2026",
          picName: "Edric Han",
          fiscalYear: 2026,
          balanceSheetDate: "2026-12-31",
          contactUserId: "user-1",
          contactName: "Project Member",
          contactEmail: "member@example.test",
          confirmationCode: "AUD-2026-0003-YH-001",
        },
      });
      const text = await extractDocxText(artifact.docx);

      expect(text).not.toContain("C-HBR-010/Edric Han");
    }
  );

  it("does not backfill the standard Ref with the project identity when referenceCode is empty", async () => {
    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-standard-empty-reference",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "Helmholtz Bank",
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: {
          clientCode: "C-HBR-010",
          picName: "Edric Han",
          referenceCode: "",
          bankName: "Helmholtz Bank",
          sections: {},
        },
      },
      derivedSnapshot: {
        clientCode: "C-HBR-010",
        clientName: "Harbour Retail Limited",
        projectCode: "HBR-2026-ACC",
        projectName: "Harbour accounting support",
        picName: "Edric Han",
        fiscalYear: 2026,
        balanceSheetDate: "2026-03-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
    });
    const text = await extractDocxText(artifact.docx);

    expect(text).not.toContain("C-HBR-010/Edric Han");
  });

  it.each([
    {
      code: "STANDARD_FINANCIAL_INSTITUTION",
      staticGreeting: "Dear Sirs,",
    },
    {
      code: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      staticGreeting: "Dear Sirs,",
    },
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      staticGreeting: "Dear Sir / Madam,",
    },
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      staticGreeting: "Dear Sirs/Madam,",
    },
  ] as const)(
    "renders the explicit salutation and recipient for %s",
    async ({ code, staticGreeting }) => {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: `confirmation-salutation-${code}`,
          projectId: "project-1",
          type: code.startsWith("SECURITIES") ? "INTERMEDIARY" : "BANK",
          confirmationCode: "AUD-2026-0003-YH-001",
          counterpartyName: "HSBC",
          draftTemplateCode: code,
          draftPayload: {
            recipientName: "Attention Manager",
            salutation: "Madam",
            referenceCode: "CUSTOM-REF-2026",
            bankName: "HSBC",
            sections: {},
          } as unknown as ConfirmationDraftPayload,
        },
      });
      const text = await extractDocxText(artifact.docx);

      expect(text).toContain("Dear Madam,");
      expect(text).not.toContain(staticGreeting);
      expect(text).toContain("Attention Manager");
      expect(text).toContain("CUSTOM-REF-2026");
    }
  );

  it.each([
    ["Sirs/Madam", "Sir/Madam"],
    ["Sir / Madam", "Sir/Madam"],
    ["Sir", "Sir"],
    ["Madam", "Madam"],
    ["Sir/Madam", "Sir/Madam"],
  ] as const)(
    "normalizes %s to %s in every managed English DOCX template",
    async (salutation, expectedSalutation) => {
      for (const draftTemplateCode of [
        "STANDARD_FINANCIAL_INSTITUTION",
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
        "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      ] as const) {
        const artifact = await createService().renderArtifactFiles({
          confirmation: {
            id: `confirmation-salutation-normalization-${draftTemplateCode}`,
            projectId: "project-1",
            type: draftTemplateCode.startsWith("SECURITIES")
              ? "INTERMEDIARY"
              : "BANK",
            confirmationCode: "AUD-2026-0003-YH-001",
            counterpartyName: "HSBC",
            draftTemplateCode,
            draftPayload: {
              recipientName: "Attention Manager",
              salutation,
              sections: {},
            } as unknown as ConfirmationDraftPayload,
          },
        });
        const text = await extractDocxText(artifact.docx);

        expect(text).toContain(`Dear ${expectedSalutation},`);
        expect(text).not.toContain("Dear Sirs/Madam,");
        expect(text).not.toContain("Dear Sir / Madam,");
      }
    }
  );

  it("does not use the mapped bank contact as the salutation", async () => {
    for (const draftTemplateCode of [
      "STANDARD_FINANCIAL_INSTITUTION",
      "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
    ] as const) {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: `confirmation-contact-salutation-${draftTemplateCode}`,
          projectId: "project-1",
          type: draftTemplateCode.startsWith("SECURITIES")
            ? "INTERMEDIARY"
            : "BANK",
          confirmationCode: "AUD-2026-0003-YH-001",
          counterpartyName: "HSBC",
          draftTemplateCode,
          draftPayload: {
            counterpartyAttention: "HSBC Audit Confirmation Team",
            recipientName: "HSBC Audit Confirmation Team",
            sections: {},
          } as unknown as ConfirmationDraftPayload,
        },
      });
      const text = await extractDocxText(artifact.docx);

      expect(text).toContain("Dear Sir/Madam,");
      expect(text).not.toContain("Dear HSBC Audit Confirmation Team,");
    }
  });

  it("uses the HK Standard draft reportDate before derived balanceSheetDate", async () => {
    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-hk-standard-report-date",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC",
        draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
        draftPayload: {
          bankName: "HSBC",
          reportDate: "2026-11-30",
          salutation: "Madam",
          sections: {},
        },
      },
      derivedSnapshot: {
        clientCode: "C-ORC",
        clientName: "Orchid Holdings",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Server PIC",
        fiscalYear: 2026,
        balanceSheetDate: "2026-12-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
    });
    const text = await extractDocxText(artifact.docx);

    expect(text).toContain("30 November 2026");
    expect(text).not.toContain("31 December 2026");
  });

  it("fills the standard financial institution template without leaving business placeholders", async () => {
    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-standard",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC Hong Kong",
        draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
        draftPayload: {
          bankName: "HSBC Hong Kong",
          officeDate: "2026-12-31",
          referenceCode: "CUSTOM-REF-2026",
          reportDate: "2026-11-30",
          auditorName: "Wing CPA Limited",
          auditorAddress: "17/F, Central Tower",
          authorizationAccount: "001-123456",
          sections: {},
        },
      },
      derivedSnapshot: {
        clientCode: "C-ORC",
        clientName: "Orchid Holdings",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Server PIC",
        fiscalYear: 2026,
        balanceSheetDate: "2026-12-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
    });
    const text = await extractDocxText(artifact.docx);

    expect(text).toContain("HSBC Hong Kong");
    expect(text).not.toContain("C-ORC/Server PIC");
    expect(text).toContain("Orchid Holdings");
    expect(text).not.toContain("A/CA/C");
    expect(text).toContain("close of business on 30 November 2026.");
    expect(text).toContain("31 December 2026");
    expect(text).toContain("Office");
    expect(text).toContain("Date");
    expect(text).toContain("Ref");
    expect(text).toContain("Wing CPA Limited");
    expect(text).toContain("17/F, Central Tower");
    expect(text).toContain("001-123456");
    expect(text).not.toContain("(Name of bank)");
    expect(text).not.toContain("(Auditor Name)");
    expect(text).not.toContain("(Auditor Address)");

    const packageZip = await JSZip.loadAsync(artifact.docx);
    const documentXml = await packageZip
      .file("word/document.xml")
      ?.async("string");
    for (const tag of [
      "PW_AUDITOR_ADDRESS",
      "PW_AUDITOR_NAME",
      "PW_AUTHORIZATION_ACCOUNT",
      "PW_BANK_NAME",
      "PW_CUSTOMER_NAME",
      "PW_OFFICE_DATE",
      "PW_REFERENCE_CODE",
      "PW_REPORT_DATE",
    ]) {
      expect(documentXml).not.toContain(`<w:tag w:val="${tag}"/>`);
    }
    const templateTables = Array.from(
      documentXml?.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) ?? [],
      (match) => match[0]
    );
    expect(templateTables).toHaveLength(8);
    expect(templateTables[0]?.match(/<w:tr\b/g)).toHaveLength(3);
    expect(templateTables[1]?.match(/<w:tr\b/g)).toHaveLength(6);
    const headerXml = templateTables.slice(0, 2).join("");
    const headerMarkerPositions = [
      "HSBC Hong Kong",
      ">Office<",
      ">Date<",
      "31 December 2026",
      ">Ref<",
      "CUSTOM-REF-2026",
    ].map((marker) => headerXml.indexOf(marker));
    expect(headerMarkerPositions).toStrictEqual(
      [...headerMarkerPositions].sort((left, right) => left - right)
    );
    expect(
      headerMarkerPositions.every((position) => position >= 0)
    ).toBeTruthy();
    const scheduleTables = templateTables.filter(
      (table) =>
        table.includes("Deposits, Fixed or at Call held in your books") ||
        table.includes("Acceptances Outstanding in your books")
    );
    expect(scheduleTables).toHaveLength(2);
    expect(scheduleTables[0]?.match(/<w:tr\b/g)).toHaveLength(30);
    expect(scheduleTables[1]?.match(/<w:tr\b/g)).toHaveLength(28);
    expect(
      Object.keys(packageZip.files).some((name) =>
        name.startsWith("customXml/")
      )
    ).toBeFalsy();
    const packageMetadataParts = await Promise.all(
      ["docProps/core.xml", "docProps/app.xml"].map(async (name) => {
        await Promise.resolve();
        return packageZip.file(name)?.async("string");
      })
    );
    const packageMetadata = packageMetadataParts.join("\n");
    expect(packageMetadata).toContain("Project Wing");
    expect(packageMetadata).not.toContain("Ruby");
    expect(packageMetadata).not.toContain("Jony Ma");
    expect(packageMetadata).not.toContain("Nelson Wheeler");
  });

  it.each([
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      draftPayload: {
        accountNumber: "SEC-001",
        auditorAddress: "17/F, Central Tower",
        auditorName: "Wing CPA Limited",
        clientName: "Orchid Securities Limited",
        micName: "Alice Manager",
        officeDate: "2026-08-12",
        recipientAddress: "1 Finance Street, Hong Kong",
        recipientName: "Custodian Limited",
        yearEndDate: "2026-12-31",
      },
      expectedValues: ["SEC-001", "Alice Manager"],
      placeholders: [
        "[Recipient Name]",
        "[Recipient Address]",
        "[Auditor Name]",
        "[Year end date]",
        "[Auditor Address]",
        "[MIC Name]",
        "[Client Name]",
      ],
    },
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      draftPayload: {
        auditorAddress: "17/F, Central Tower",
        auditorName: "Wing CPA Limited",
        clientName: "Orchid Securities Limited",
        micEmail: "mic@example.com",
        micNameAndInitial: "A. Manager",
        officeDate: "2026-08-12",
        recipientAddress: "2 Exchange Square, Hong Kong",
        recipientName: "Broker Limited",
        yearEndDate: "2026-12-31",
      },
      expectedValues: ["mic@example.com", "A. Manager"],
      placeholders: [
        "[Recipient Name]",
        "[Recipient Address]",
        "[Client’s Name]",
        "[Auditor Name]",
        "[Auditor Address]",
        "[MIC Email]",
        "[MIC Name and Initial]",
        "[Year end date]",
      ],
    },
  ] as const)(
    "fills $code from structured fields and leaves Ref blank when unset",
    async ({ code, draftPayload, expectedValues, placeholders }) => {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: `confirmation-${code}`,
          projectId: "project-1",
          type: "INTERMEDIARY",
          confirmationCode: "AUD-2026-0003-ZJJG-001",
          counterpartyName: draftPayload.recipientName,
          draftTemplateCode: code,
          draftPayload: { ...draftPayload, sections: {} },
        },
      });
      const text = await extractDocxText(artifact.docx);

      for (const expected of [
        draftPayload.recipientName,
        draftPayload.recipientAddress,
        draftPayload.clientName,
        draftPayload.auditorName,
        draftPayload.auditorAddress,
        "12 August 2026",
        "31 December 2026",
        ...expectedValues,
      ]) {
        expect(text).toContain(expected);
      }
      expect(text).not.toContain("AUD-2026-0003/AUD-2026-0003");
      for (const placeholder of placeholders) {
        expect(text).not.toContain(placeholder);
      }
      expect(text).not.toContain("Dear Sir / Madam,");
      expect(text).not.toContain("Dear Sirs/Madam,");
      expect(text).toContain("Dear Sir/Madam,");

      const loadedDocument = await JSZip.loadAsync(artifact.docx);
      const documentXml = loadedDocument
        .file("word/document.xml")
        ?.async("string");
      expect(documentXml).not.toContain('<w:tag w:val="PW_');
    }
  );

  it.each([
    ["SECURITIES_CONFIRMATION_ENGLISH_TYPE_1", undefined, "30 November 2026"],
    ["SECURITIES_CONFIRMATION_ENGLISH_TYPE_1", "2027-01-31", "31 January 2027"],
    ["SECURITIES_CONFIRMATION_ENGLISH_TYPE_2", undefined, "30 November 2026"],
    ["SECURITIES_CONFIRMATION_ENGLISH_TYPE_2", "2027-01-31", "31 January 2027"],
  ] as const)(
    "uses draft reportDate for %s yearEndDate and prefers explicit yearEndDate",
    async (code, yearEndDate, expectedDate) => {
      const artifact = await createService().renderArtifactFiles({
        confirmation: {
          id: `confirmation-year-end-${code}-${yearEndDate ?? "report-date"}`,
          projectId: "project-1",
          type: "INTERMEDIARY",
          confirmationCode: "AUD-2026-0003-ZJJG-001",
          counterpartyName: "Custodian Limited",
          draftTemplateCode: code,
          draftPayload: {
            clientName: "Orchid Securities Limited",
            reportDate: "2026-11-30",
            ...(yearEndDate ? { yearEndDate } : {}),
            recipientName: "Custodian Limited",
            sections: {},
          },
        },
        derivedSnapshot: {
          clientCode: "C-ORC",
          clientName: "Orchid Securities Limited",
          projectCode: "AUD-2026-0003",
          projectName: "Orchid Audit 2026",
          picName: "Server PIC",
          fiscalYear: 2026,
          balanceSheetDate: "2026-12-31",
          contactUserId: "user-1",
          contactName: "Project Member",
          contactEmail: "member@example.test",
          confirmationCode: "AUD-2026-0003-ZJJG-001",
        },
      });
      const text = await extractDocxText(artifact.docx);

      expect(text).toContain(expectedDate);
      expect(text).not.toContain(
        yearEndDate ? "30 November 2026" : "31 December 2026"
      );
    }
  );

  it("fills the standard template by OOXML tag even when visible placeholder text changes", async () => {
    const sourceXml = await readStandardTemplateXml();
    const tagIndex = sourceXml.indexOf('<w:tag w:val="PW_BANK_NAME"/>');
    const contentStart = sourceXml.indexOf("<w:sdtContent>", tagIndex);
    const contentEnd = sourceXml.indexOf("</w:sdtContent>", contentStart);
    expect(tagIndex).toBeGreaterThan(-1);
    expect(contentStart).toBeGreaterThan(tagIndex);
    expect(contentEnd).toBeGreaterThan(contentStart);
    const taggedContent = sourceXml
      .slice(contentStart, contentEnd)
      .replace(
        "</w:p>",
        "<w:r><w:t>Visible placeholder wording changed</w:t></w:r></w:p>"
      );
    const templateXml =
      sourceXml.slice(0, contentStart) +
      taggedContent +
      sourceXml.slice(contentEnd);
    const filled = replaceStandardTemplateContentControls(
      templateXml,
      standardTemplateValues
    );

    expect(filled).toContain("HSBC Hong Kong");
    expect(filled).not.toContain("Visible placeholder wording changed");
    expect(filled).toContain("C-ORC/Server PIC");
    expect(filled).toContain("Orchid Holdings");
    expect(filled).toContain("04 August 2026");
    expect(filled).toContain("31 December 2026");
    expect(filled).toContain("Wing CPA Limited");
    expect(filled).toContain("17/F, Central Tower");
    expect(filled).toContain("001-123456");
  });

  it("limits the report-date OOXML control to the inline date segment", async () => {
    const templateXml = await readStandardTemplateXml();
    const reportDateTagIndex = templateXml.indexOf(
      '<w:tag w:val="PW_REPORT_DATE"/>'
    );
    const reportDateControlStart = templateXml.lastIndexOf(
      "<w:sdt>",
      reportDateTagIndex
    );
    const reportDateContentStart = templateXml.indexOf(
      "<w:sdtContent>",
      reportDateTagIndex
    );
    const reportDateContentEnd = templateXml.indexOf(
      "</w:sdtContent>",
      reportDateContentStart
    );
    const reportDateControl = templateXml.slice(
      reportDateControlStart,
      reportDateContentEnd + "</w:sdtContent></w:sdt>".length
    );

    expect(reportDateTagIndex).toBeGreaterThan(-1);
    expect(reportDateControl).not.toContain("<w:p");
    expect(reportDateControl).toContain("<w:r");
    expect(reportDateControl).not.toContain("For the purposes of our audit");

    const filled = replaceStandardTemplateContentControls(
      templateXml,
      standardTemplateValues
    );
    expect(filled).toContain(
      "For the purposes of our audit please complete the attached form"
    );
    expect(filled).toContain("31 December 2026");
    expect(filled).toContain("For each item, please state any factors");
  });

  it("rejects a standard template with a missing or duplicate OOXML tag", async () => {
    const templateXml = await readStandardTemplateXml();
    const missing = templateXml.replace(
      '<w:tag w:val="PW_BANK_NAME"/>',
      '<w:tag w:val="IGNORED_BANK_NAME"/>'
    );
    expect(() =>
      replaceStandardTemplateContentControls(missing, standardTemplateValues)
    ).toThrow("缺少 OOXML 占位符：PW_BANK_NAME");

    const duplicate = templateXml.replace(
      '<w:tag w:val="PW_REFERENCE_CODE"/>',
      '<w:tag w:val="PW_BANK_NAME"/>'
    );
    expect(() =>
      replaceStandardTemplateContentControls(duplicate, standardTemplateValues)
    ).toThrow("重复 OOXML 占位符：PW_BANK_NAME");
  });

  it("does not cross-match adjacent unknown controls and rejects nested controls", async () => {
    const templateXml = await readStandardTemplateXml();
    const unknownControl =
      '<w:sdt><w:sdtPr><w:tag w:val="THIRD_PARTY_FIELD"/></w:sdtPr>' +
      "<w:sdtContent><w:p><w:r><w:t>Third party</w:t></w:r></w:p>" +
      "</w:sdtContent></w:sdt>";
    const withAdjacentUnknown = templateXml.replace(
      /(<w:body\b[^>]*>)/,
      `$1${unknownControl}`
    );
    expect(
      replaceStandardTemplateContentControls(
        withAdjacentUnknown,
        standardTemplateValues
      )
    ).toContain("Third party");

    const bankTagIndex = templateXml.indexOf('<w:tag w:val="PW_BANK_NAME"/>');
    const bankContentOpenIndex = templateXml.indexOf(
      "<w:sdtContent>",
      bankTagIndex
    );
    const bankContentStart = bankContentOpenIndex + "<w:sdtContent>".length;
    const nested =
      templateXml.slice(0, bankContentStart) +
      unknownControl +
      templateXml.slice(bankContentStart);
    expect(() =>
      replaceStandardTemplateContentControls(nested, standardTemplateValues)
    ).toThrow("占位符不允许嵌套内容控件：PW_BANK_NAME");

    const bankControl = templateXml.match(
      /<w:sdt><w:sdtPr>[\s\S]*?<w:tag w:val="PW_BANK_NAME"\/>[\s\S]*?<\/w:sdt>/
    )?.[0];
    expect(bankControl).toBeDefined();
    const wrappedBank = templateXml.replace(
      assertPresentValue(bankControl),
      unknownControl.replace(
        "<w:p><w:r><w:t>Third party</w:t></w:r></w:p>",
        assertPresentValue(bankControl)
      )
    );
    expect(() =>
      replaceStandardTemplateContentControls(
        wrappedBank,
        standardTemplateValues
      )
    ).toThrow("占位符不允许嵌套内容控件：PW_BANK_NAME");
  });

  it("requires the managed tag to be the only direct tag child", async () => {
    const templateXml = await readStandardTemplateXml();
    const indirect = templateXml.replace(
      '<w:tag w:val="PW_BANK_NAME"/>',
      '<w:wrapper><w:tag w:val="PW_BANK_NAME"/></w:wrapper>'
    );
    expect(() =>
      replaceStandardTemplateContentControls(indirect, standardTemplateValues)
    ).toThrow("tag 必须是唯一的 w:sdtPr 直接子节点");

    const duplicateInProperties = templateXml.replace(
      '<w:tag w:val="PW_BANK_NAME"/>',
      '<w:tag w:val="PW_BANK_NAME"/><w:tag w:val="PW_BANK_NAME"/>'
    );
    expect(() =>
      replaceStandardTemplateContentControls(
        duplicateInProperties,
        standardTemplateValues
      )
    ).toThrow("tag 必须是唯一的 w:sdtPr 直接子节点");

    const directAndIndirect = templateXml.replace(
      '<w:tag w:val="PW_BANK_NAME"/>',
      '<w:tag w:val="PW_BANK_NAME"/>' +
        '<w:wrapper><w:tag w:val="PW_BANK_NAME"/></w:wrapper>'
    );
    expect(() =>
      replaceStandardTemplateContentControls(
        directAndIndirect,
        standardTemplateValues
      )
    ).toThrow("tag 必须是唯一的 w:sdtPr 直接子节点");
  });

  it("renders artifact DOCX and PDF with server-derived values overriding draft fields", async () => {
    documentConversion.convertOfficeBufferToPdf.mockResolvedValueOnce(
      Buffer.from("%PDF-1.4 rendered")
    );
    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-2026-0003-YH-001",
        counterpartyName: "HSBC",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        draftPayload: {
          clientCode: "draft-client",
          clientName: "Draft Client",
          projectCode: "draft-project",
          picName: "Draft PIC",
          fiscalYear: "2030",
          balanceSheetDate: "2030-01-01",
          replyContact: "Editable Reply Contact",
          bankName: "HSBC",
          sections: {},
        },
      },
      derivedSnapshot: {
        clientCode: "C-ORC",
        clientName: "Orchid Holdings",
        projectCode: "AUD-2026-0003",
        projectName: "Orchid Audit 2026",
        picName: "Server PIC",
        fiscalYear: 2026,
        balanceSheetDate: "2026-12-31",
        contactUserId: "user-1",
        contactName: "Project Member",
        contactEmail: "member@example.test",
        confirmationCode: "AUD-2026-0003-YH-001",
      },
    });
    const text = await extractDocxText(artifact.docx);

    expect(text).toContain("参考编号 : C-ORC/Draft PIC");
    expect(text).toContain("联系人：Project Member");
    expect(text).not.toContain("Editable Reply Contact");
    expect(text).toContain("2026年12月31日");
    expect(text).not.toContain("draft-client");
    expect(text).toContain("Draft PIC");
    expect(artifact.pdf).toStrictEqual(Buffer.from("%PDF-1.4 rendered"));
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ body: artifact.docx })
    );
  }, 15_000);

  it("renders only the PDF path for a preview request", async () => {
    const service = createService();
    const render = vi.spyOn(service, "renderArtifactFiles");
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await service.renderPreviewPdf({
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
      project: { id: "project-1", name: "Orchid", projectCode: "AUD-1" },
    });

    expect(render).not.toHaveBeenCalled();
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledOnce();
  });

  it("renders a dynamic-field preview without creating a DOCX artifact", async () => {
    const service = createService();

    const preview = await service.renderPreviewPdf({
      id: "confirmation-dynamic-preview",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        bankName: "HSBC",
        sections: {},
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "dynamic-preview-value",
              kind: "TEXT",
              name: "Dynamic preview value",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "",
              options: [],
            },
          ],
        },
        templateFieldValues: {
          "dynamic-preview-value": "Preview value",
        },
      } as unknown as ConfirmationDraftPayload,
    });

    expect(preview.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledOnce();
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
  });

  it("reuses the cached canonical PDF for an identical preview", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
      project: { id: "project-1", name: "Orchid", projectCode: "AUD-1" },
    };
    const cachedPdf = Buffer.from("%PDF-1.4 cached");
    storage.getObjectBuffer
      .mockRejectedValueOnce(
        Object.assign(new Error("cache miss"), { code: "ENOENT" })
      )
      .mockResolvedValueOnce(cachedPdf);

    await service.renderPreviewPdf(confirmation);
    const render = vi.spyOn(service, "renderArtifactFiles");
    await expect(service.renderPreviewPdf(confirmation)).resolves.toMatchObject(
      {
        body: cachedPdf,
        fileName: "AUD-1-HSBC-confirmation.pdf",
        mimeType: "application/pdf",
      }
    );

    expect(render).not.toHaveBeenCalled();
    expect(storage.putCacheObject).toHaveBeenCalledTimes(1);
  });

  it("separates PDF and DOCX preview cache keys across local dates for unfilled CURRENT_DATE", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-current-date-cache",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        bankName: "HSBC",
        sections: {},
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "preview-date",
              kind: "DATE",
              name: "Preview date",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "",
              options: [],
              defaultValueSource: {
                source: "SYSTEM",
                value: "CURRENT_DATE",
              },
            },
          ],
        },
        templateFieldValues: {},
      } as unknown as ConfirmationDraftPayload,
    };
    const cacheKeys: string[] = [];
    const readCachedPreview = async (key: string) => {
      cacheKeys.push(key);
      return Buffer.from(key.endsWith(".pdf") ? "%PDF cached" : "PK cached");
    };
    storage.getObjectBuffer.mockImplementation(readCachedPreview);
    storage.getCacheObjectBuffer.mockImplementation(readCachedPreview);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
      await service.renderPreviewPdf(confirmation);
      await service.renderPreviewDocx(confirmation);
      vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
      await service.renderPreviewPdf(confirmation);
      await service.renderPreviewDocx(confirmation);
    } finally {
      vi.useRealTimers();
    }

    const pdfKeys = cacheKeys.filter((key) => key.endsWith(".pdf"));
    const docxKeys = cacheKeys.filter((key) => key.endsWith(".docx"));
    expect(pdfKeys).toHaveLength(2);
    expect(docxKeys).toHaveLength(2);
    expect(pdfKeys[0]).not.toBe(pdfKeys[1]);
    expect(docxKeys[0]).not.toBe(docxKeys[1]);
  });

  it("falls back and records non-missing preview cache read failures", async () => {
    const service = createService();
    const warn = vi.spyOn(
      (
        service as unknown as {
          logger: { warn: (...args: unknown[]) => void };
        }
      ).logger,
      "warn"
    );
    const failure = Object.assign(new Error("cache unavailable"), {
      code: "AccessDenied",
      status: 403,
    });
    storage.getObjectBuffer.mockRejectedValue(failure);
    storage.getCacheObjectBuffer.mockRejectedValue(failure);

    const confirmation = {
      id: "confirmation-cache-read-failure",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
    };

    const pdf = await service.renderPreviewPdf(confirmation);
    const docx = await service.renderPreviewDocx(confirmation);

    expect(pdf.body).toBeInstanceOf(Buffer);
    expect(docx.body).toBeInstanceOf(Buffer);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("Confirmation preview cache read failed"),
      expect.stringContaining("Confirmation preview cache read failed"),
    ]);
  });

  it("returns generated previews when cache writes fail", async () => {
    const service = createService();
    const warn = vi.spyOn(
      (
        service as unknown as {
          logger: { warn: (...args: unknown[]) => void };
        }
      ).logger,
      "warn"
    );
    const failure = new Error("cache write unavailable");
    storage.getObjectBuffer.mockResolvedValue(null);
    storage.getCacheObjectBuffer.mockResolvedValue(null);
    storage.putCacheObject.mockRejectedValue(failure);

    const confirmation = {
      id: "confirmation-cache-write-failure",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
    };

    const pdf = await service.renderPreviewPdf(confirmation);
    const docx = await service.renderPreviewDocx(confirmation);

    expect(pdf.body).toBeInstanceOf(Buffer);
    expect(docx.body).toBeInstanceOf(Buffer);
    expect(storage.putCacheObject).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining("Confirmation preview cache write failed"),
      expect.stringContaining("Confirmation preview cache write failed"),
    ]);
  });

  it("returns a cached DOCX preview without rendering the document again", async () => {
    const cachedDocx = Buffer.from("PK cached docx");
    storage.getCacheObjectBuffer.mockResolvedValue(cachedDocx);

    const preview = await createService().renderPreviewDocx({
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
    });

    expect(preview.body).toBe(cachedDocx);
    expect(preview.fileName).toBe("AUD-1-HSBC-confirmation.docx");
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(storage.putCacheObject).not.toHaveBeenCalled();
  });

  it("renders a DOCX preview without requiring Office conversion", async () => {
    const preview = await createService().renderPreviewDocx({
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
    });

    expect(preview.fileName).toBe("AUD-1-HSBC-confirmation.docx");
    expect(preview.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(preview.body.length).toBeGreaterThan(0);
    expect(documentConversion.convertOfficeBufferToPdf).not.toHaveBeenCalled();
    expect(storage.putCacheObject).toHaveBeenCalledWith(
      expect.stringContaining("/AUD-1-HSBC-confirmation.docx"),
      preview.body,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("materializes dynamic fields in the downloadable DOCX", async () => {
    const sourceDocx = await readActualFile(
      join(
        __dirname,
        "../../confirmation-templates/bank-confirmation-hk-standard-english.docx"
      )
    );
    const sourcePdf = await createTestPdf();
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(sourcePdf);

    const download = await createService().renderFilledDocx({
      confirmation: {
        id: "confirmation-custom-download",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: {
          bankName: "HSBC",
          sections: {},
          templateLibrarySource: { objectKey: "custom/test.docx" },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "custom-download-field",
                kind: "TEXT",
                name: "Custom download field",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Download field",
                options: [],
              },
            ],
          },
          templateFieldValues: {
            "custom-download-field": "Download value",
          },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    expect(download.body).toBeInstanceOf(Buffer);
    await expect(extractDocxText(download.body)).resolves.toContain(
      "Download value"
    );
    await expect(extractDocumentXml(download.body)).resolves.toContain(
      'fillcolor="#FFFFFF"'
    );
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
  });

  it("materializes filled custom-template fields in the DOCX export", async () => {
    const sourceDocx = await readActualFile(
      join(
        __dirname,
        "../../confirmation-templates/bank-confirmation-hk-standard-english.docx"
      )
    );
    const sourcePdf = await createTestPdf();
    const convertedDocx = Buffer.from("PK converted-custom-export-docx");
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(sourcePdf);
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(convertedDocx);

    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-custom-export",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: {
          bankName: "HSBC",
          sections: {},
          templateLibrarySource: { objectKey: "custom/test.docx" },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "custom-export-field",
                kind: "TEXT",
                name: "Custom export field",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Export field",
                options: [],
              },
            ],
          },
          templateFieldValues: {
            "custom-export-field": "Exported custom value",
          },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    expect(artifact.docx).toBeInstanceOf(Buffer);
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(artifact.pdf).not.toStrictEqual(sourcePdf);
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer) })
    );
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
  });

  it("renders uploaded DOCX templates from one canonical overlaid PDF", async () => {
    const sourceDocx = await readActualFile(
      join(
        __dirname,
        "../../confirmation-templates/bank-confirmation-hk-standard-english.docx"
      )
    );
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([595.45, 841.7]);
    const basePdf = Buffer.from(await sourcePdf.save());
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(basePdf);

    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-custom-canonical-render",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: {
          bankName: "HSBC",
          sections: {},
          templateLibrarySource: {
            objectKey: "custom/test.docx",
            fileName: "test.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "canonical-field",
                kind: "TEXT",
                name: "Canonical field",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Canonical field",
                options: [],
              },
            ],
          },
          templateFieldValues: { "canonical-field": "Canonical value" },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer) })
    );
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(artifact.docx).toBeInstanceOf(Buffer);
    expect(artifact.pdf).not.toStrictEqual(basePdf);
  });

  it("renders PDF custom templates with field values and converts them to DOCX", async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([612, 792]);
    storage.getObjectBuffer.mockResolvedValue(
      Buffer.from(await sourcePdf.save())
    );
    const convertedDocx = Buffer.from("PK converted-docx");
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(convertedDocx);

    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-pdf-export",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-BANK-2026-000001",
        draftPayload: {
          bankName: "HSBC",
          templateLibrarySource: {
            objectKey: "custom/test.pdf",
            fileName: "test.pdf",
            mimeType: "application/pdf",
          },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "pdf-reference",
                kind: "TEXT",
                name: "PDF reference",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Reference",
                options: [],
              },
            ],
          },
          templateFieldValues: { "pdf-reference": "招商银行" },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    const renderedPdf = await PDFDocument.load(artifact.pdf);
    const hasEmbeddedUnicodeFont = [
      ...renderedPdf.context.enumerateIndirectObjects(),
    ].some(([, object]) => object.toString().includes("/Subtype /Type0"));
    expect(hasEmbeddedUnicodeFont).toBeTruthy();
    expect(documentConversion.convertPdfBufferToDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "AUD-1-HSBC-confirmation.pdf",
        mimeType: "application/pdf",
        body: expect.any(Buffer),
      })
    );
    expect(artifact.docx).toBe(convertedDocx);
    expect(artifact.pdfFileName).toBe("AUD-1-HSBC-confirmation.pdf");
  });

  it("renders the custom-template DOCX preview from the canonical PDF", async () => {
    const sourceDocx = await readActualFile(
      join(
        __dirname,
        "../../confirmation-templates/bank-confirmation-hk-standard-english.docx"
      )
    );
    const sourcePdf = await createTestPdf();
    const convertedDocx = Buffer.from("PK converted-custom-preview-docx");
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(sourcePdf);
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(convertedDocx);

    const preview = await createService().renderPreviewDocx({
      id: "confirmation-custom-preview",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "CTPL-123456789ABC",
      draftPayload: {
        bankName: "HSBC",
        sections: {},
        templateLibrarySource: { objectKey: "custom/test.docx" },
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "custom-preview-field",
              kind: "TEXT",
              name: "Custom preview field",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "Preview field",
              options: [],
            },
          ],
        },
        templateFieldValues: {
          "custom-preview-field": "Preview value",
        },
      } as unknown as ConfirmationDraftPayload,
    });

    expect(preview.body).toBe(convertedDocx);
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer) })
    );
    expect(documentConversion.convertPdfBufferToDocx).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer) })
    );
  });

  it("removes custom DOCX source ranges before canonical PDF conversion", async () => {
    const sourceText =
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES";
    const sourceXml = await readHkTemplateXml();
    const sourceRange = getSourceRangeAnchor(sourceXml, sourceText);
    const sourceDocx = (await buildHkTemplateVariant((xml) => xml)).docx;
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(
      Buffer.from("PK canonical-custom-source-range-docx")
    );

    await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-custom-source-range",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: {
          bankName: "HSBC",
          sections: {},
          templateLibrarySource: {
            objectKey: "custom/test.docx",
            fileName: "test.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "custom-source-range",
                kind: "TEXT",
                name: "Custom source range",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.5,
                height: 0.04,
                placeholder: "",
                options: [],
                sourceRanges: [sourceRange],
              },
            ],
          },
          templateFieldValues: {
            "custom-source-range": "Replacement title",
          },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    await expect(extractLastOfficeConversionText()).resolves.not.toContain(
      sourceText
    );
  });

  it("materializes a retained value when a bound dynamic field has an empty draft binding", async () => {
    const sourceDocx = await readActualFile(
      join(
        __dirname,
        "../../confirmation-templates/bank-confirmation-hk-standard-english.docx"
      )
    );
    const sourcePdf = await createTestPdf();
    const convertedDocx = Buffer.from("PK converted-bound-custom-docx");
    storage.getObjectBuffer.mockResolvedValue(sourceDocx);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValue(sourcePdf);
    documentConversion.convertPdfBufferToDocx.mockResolvedValue(convertedDocx);

    const artifact = await createService().renderArtifactFiles({
      confirmation: {
        id: "confirmation-bound-custom-export",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "CTPL-123456789ABC",
        draftPayload: {
          bankName: "HSBC",
          clientName: "",
          sections: {},
          templateLibrarySource: { objectKey: "custom/test.docx" },
          templateDesignSchema: {
            version: 1,
            fields: [
              {
                id: "bound-client",
                kind: "TEXT",
                name: "Bound client",
                page: 1,
                x: 0.1,
                y: 0.1,
                width: 0.3,
                height: 0.04,
                placeholder: "Client",
                options: [],
                baseInformationBinding: "clientName",
              },
            ],
          },
          templateFieldValues: { "bound-client": "Retained bound value" },
        } as unknown as ConfirmationDraftPayload,
      },
    });

    expect(artifact.docx).toBeInstanceOf(Buffer);
    expect(documentConversion.convertPdfBufferToDocx).not.toHaveBeenCalled();
    expect(artifact.pdf).not.toStrictEqual(sourcePdf);
  });

  it.each([
    ["BANK_CONFIRMATION_HK_STANDARD_ENGLISH", "(Name of bank)", "HSBC Filled"],
    [
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      "[Recipient Name]",
      "Custodian Filled",
    ],
    [
      "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
      "[Recipient Name]",
      "Broker Filled",
    ],
  ] as const)(
    "serves stable source geometry for editable %s previews",
    async (draftTemplateCode, placeholder, filledValue) => {
      const preview = await createService().renderPreviewDocx({
        id: "confirmation-managed-preview",
        projectId: "project-1",
        type: draftTemplateCode.startsWith("SECURITIES")
          ? "INTERMEDIARY"
          : "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: filledValue,
        draftTemplateCode,
        draftPayload: {
          bankName: filledValue,
          recipientName: filledValue,
          sections: {},
        },
      });
      const text = await extractDocxText(preview.body);

      expect(text).toContain(placeholder);
      expect(text).not.toContain(filledValue);
      expect(
        documentConversion.convertOfficeBufferToPdf
      ).not.toHaveBeenCalled();
    }
  );

  it("clears dynamic source text from a managed DOCX preview", async () => {
    const sourceText = "(Name of bank)";
    const sourceRange = getSourceRangeAnchor(
      await readHkTemplateXml(),
      sourceText
    );
    const preview = await createService().renderPreviewDocx({
      id: "confirmation-managed-dynamic-preview",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        bankName: "HSBC",
        sections: {},
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "dynamic-bank-name",
              kind: "TEXT",
              name: "Bank name",
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.3,
              height: 0.04,
              placeholder: "Bank Office",
              options: [],
              sourceRanges: [sourceRange],
            },
          ],
        },
      } as unknown as ConfirmationDraftPayload,
    });
    const text = await extractLastOfficeConversionText();

    expect(text).not.toContain(sourceText);
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalled();
    expect(documentConversion.convertPdfBufferToDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.any(Buffer),
        preserveLayout: true,
      })
    );
  });

  it.each([
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1" as const,
      markers: [
        "[Recipient Name]",
        "[Recipient Address]",
        "[Auditor Name]",
        "[Year end date]",
        "[Auditor Address]",
        "[MIC Name]",
        "[Client Name]",
      ],
    },
    {
      code: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2" as const,
      markers: [
        "[Recipient Name]",
        "[Recipient Address]",
        "[Client’s Name]",
        "[Auditor Name]",
        "[Auditor Address]",
        "[MIC Email]",
        "[MIC Name and Initial]",
        "[Year end date]",
      ],
    },
  ])(
    "clears built-in securities source markers from the editable DOCX preview for $code",
    async ({ code, markers }) => {
      const preview = await createService().renderPreviewDocx({
        id: `confirmation-securities-source-cleanup-${code}`,
        projectId: "project-1",
        type: "INTERMEDIARY",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: code,
        draftPayload: {
          accountNumber: "001-123456",
          auditorAddress: "17/F, Central Tower",
          auditorName: "Wing CPA Limited",
          clientName: "Orchid Holdings",
          micEmail: "mic@example.test",
          micName: "MIC One",
          micNameAndInitial: "MIC One (MO)",
          officeDate: "2026-08-04",
          recipientAddress: "1 Harbour Road",
          recipientName: "Custodian",
          referenceCode: "REF-2026",
          salutation: "Sir/Madam",
          sections: {},
          templateDesignSchema: getDefaultConfirmationTemplateDesign(code),
          yearEndDate: "2026-12-31",
        } as unknown as ConfirmationDraftPayload,
      });
      const text = await extractLastOfficeConversionText();

      for (const marker of markers) {
        expect(text).not.toContain(marker);
      }
      expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalled();
    }
  );

  it("does not restore deleted securities source fields when the saved design is empty", async () => {
    const preview = await createService().renderPreviewDocx({
      id: "confirmation-securities-empty-design",
      projectId: "project-1",
      type: "INTERMEDIARY",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
      draftPayload: {
        sections: {},
        templateDesignSchema: { version: 1, fields: [] },
      } as unknown as ConfirmationDraftPayload,
    });
    const text = await extractDocxText(preview.body);

    expect(text).not.toContain("[Recipient Name]");
    expect(text).not.toContain("[Auditor Name]");
    expect(text).not.toContain("[Client Name]");
  });

  it("clears built-in HK source markers from the editable DOCX preview", async () => {
    const preview = await createService().renderPreviewDocx({
      id: "confirmation-hk-default-design",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        bankName: "HSBC",
        clientName: "Orchid Holdings",
        officeDate: "2026-08-04",
        recipientName: "Operations Manager",
        referenceCode: "REF-2026",
        sections: {},
        templateDesignSchema: getDefaultConfirmationTemplateDesign(
          "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
        ),
      } as unknown as ConfirmationDraftPayload,
    });
    const text = await extractLastOfficeConversionText();

    expect(text).not.toContain("(To The Manager)");
    expect(text).not.toContain("(Name of bank)");
    expect(text).not.toContain("(Date)");
    expect(text).not.toContain("(Reference)");
    expect(text).not.toContain("(Customer’s Name)");
    expect(documentConversion.convertOfficeBufferToPdf).toHaveBeenCalled();
  });

  it("keeps the restored standard preview on the filled PDF-digital-twin document path", async () => {
    const preview = await createService().renderPreviewDocx({
      id: "confirmation-standard-preview",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC Filled",
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { bankName: "HSBC Filled", sections: {} },
    });
    const text = await extractDocxText(preview.body);

    expect(text).toContain("HSBC Filled");
    expect(text).not.toContain("(Name of bank)");
    expect(documentConversion.convertOfficeBufferToPdf).not.toHaveBeenCalled();
  });

  it("keeps STANDARD and HK English on independent resources and render paths", async () => {
    const standardTemplatePath = pathModule.join(
      confirmationTemplatesRoot,
      "standard-financial-institution-pdf-twin.docx"
    );
    const hkTemplatePath = pathModule.join(
      confirmationTemplatesRoot,
      "bank-confirmation-hk-standard-english.docx"
    );
    const [standardTemplate, hkTemplate] = await Promise.all([
      readFile(standardTemplatePath),
      readFile(hkTemplatePath),
    ]);

    expect(standardTemplatePath).not.toBe(hkTemplatePath);
    expect(Buffer.compare(standardTemplate, hkTemplate)).not.toBe(0);

    const service = createService();
    const standardPreview = await service.renderPreviewDocx({
      id: "confirmation-standard-resource",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "STANDARD Filled",
      draftTemplateCode: "STANDARD_FINANCIAL_INSTITUTION",
      draftPayload: { bankName: "STANDARD Filled", sections: {} },
    });
    const hkPreview = await service.renderPreviewDocx({
      id: "confirmation-hk-resource",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HK Filled",
      draftTemplateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: { bankName: "HK Filled", sections: {} },
    });
    const standardText = await extractDocxText(standardPreview.body);
    const hkText = await extractDocxText(hkPreview.body);

    expect(standardText).toContain(
      "REQUEST FOR BANK CONFIRMATION OF INFORMATION FOR AUDIT PURPOSES"
    );
    expect(standardText).toContain("STANDARD Filled");
    expect(standardText).not.toContain("(Name of bank)");
    expect(Buffer.compare(hkPreview.body, hkTemplate)).toBe(0);
    expect(hkText).toContain("(Name of bank)");
  });

  it("keeps STANDARD punctuation and HK English bare control values", async () => {
    const sourceXml = await readStandardTemplateXml();
    const standardDefaultXml = replaceStandardTemplateContentControls(
      sourceXml,
      standardTemplateValues
    );
    const standardExplicitXml = replaceStandardTemplateContentControls(
      sourceXml,
      standardTemplateValues,
      "STANDARD_FINANCIAL_INSTITUTION"
    );
    const hkXml = replaceStandardTemplateContentControls(
      sourceXml,
      standardTemplateValues,
      "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
    );
    const xmlText = (xml: string) =>
      [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((match) => unescapeXml(match[1] ?? ""))
        .join("");
    const expectedAuthorization =
      "You are hereby authorised to debit any charge for this service to our account number 001-123456.";
    const standardDefaultText = xmlText(standardDefaultXml);
    const standardExplicitText = xmlText(standardExplicitXml);
    const hkText = xmlText(hkXml);

    for (const standardText of [standardDefaultText, standardExplicitText]) {
      expect(standardText).toContain("Wing CPA Limited,");
      expect(standardText).toContain("17/F, Central Tower.");
      expect(standardText).toContain(expectedAuthorization);
    }
    expect(standardExplicitXml).toBe(standardDefaultXml);

    expect(hkText).toContain("Wing CPA Limited");
    expect(hkText).not.toContain("Wing CPA Limited,");
    expect(hkText).toContain("17/F, Central Tower");
    expect(hkText).not.toContain("17/F, Central Tower.");
    expect(hkText).toContain("001-123456");
    expect(hkText).not.toContain(expectedAuthorization);
  });

  it.each([
    ["Wing CPA Limited,", "17/F, Central Tower."],
    ["Wing CPA Limited，", "17/F, Central Tower。"],
    ["Wing CPA Limited,   ", "17/F, Central Tower,   "],
  ])(
    "normalizes STANDARD terminal punctuation without duplication",
    async (auditorName, auditorAddress) => {
      const sourceXml = await readStandardTemplateXml();
      const filled = replaceStandardTemplateContentControls(sourceXml, {
        ...standardTemplateValues,
        auditorName,
        auditorAddress,
      });
      const text = Array.from(
        filled.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => unescapeXml(match[1] ?? "")
      ).join("");

      expect(text).toContain("Wing CPA Limited,");
      expect(text).not.toContain("Wing CPA Limited,,");
      expect(text).toContain("17/F, Central Tower.");
      expect(text).not.toContain("17/F, Central Tower..");
      expect(text).not.toContain("Tower，.");
      expect(text).not.toContain("Tower。.");
      expect(text).not.toContain("Tower,.");
    }
  );

  it("uses the authorization placeholder for a direct empty STANDARD value", async () => {
    const sourceXml = await readStandardTemplateXml();
    const filled = replaceStandardTemplateContentControls(sourceXml, {
      ...standardTemplateValues,
      authorizationAccount: "",
    });
    const text = Array.from(
      filled.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
      (match) => unescapeXml(match[1] ?? "")
    ).join("");

    expect(text).toContain(
      "You are hereby authorised to debit any charge for this service to our account number __________."
    );
  });

  it.each(["Wing CPA Limited,", "Wing CPA Limited，"])(
    "removes HK auditor-name terminal commas before the template comma",
    async (auditorName) => {
      const sourceXml = await readHkTemplateXml();
      const filled = replaceStandardTemplateContentControls(
        sourceXml,
        { ...standardTemplateValues, auditorName },
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      );
      const text = Array.from(
        filled.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => unescapeXml(match[1] ?? "")
      ).join("");

      expect(text).toContain("Wing CPA Limited,");
      expect(text).not.toContain("Wing CPA Limited,,");
      expect(text).not.toContain("Wing CPA Limited，,");
    }
  );

  it.each(["17/F, Central Tower.", "17/F, Central Tower。"])(
    "removes HK auditor-address terminal periods before the template period",
    async (auditorAddress) => {
      const sourceXml = await readHkTemplateXml();
      const filled = replaceStandardTemplateContentControls(
        sourceXml,
        { ...standardTemplateValues, auditorAddress },
        "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
      );
      const text = Array.from(
        filled.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
        (match) => unescapeXml(match[1] ?? "")
      ).join("");

      expect(text).toContain("17/F, Central Tower.");
      expect(text).not.toContain("17/F, Central Tower..");
      expect(text).not.toContain("17/F, Central Tower。.");
    }
  );

  it("uses the authorization placeholder for a direct empty HK value", async () => {
    const sourceXml = await readHkTemplateXml();
    const filled = replaceStandardTemplateContentControls(
      sourceXml,
      { ...standardTemplateValues, authorizationAccount: "" },
      "BANK_CONFIRMATION_HK_STANDARD_ENGLISH"
    );
    const text = Array.from(
      filled.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g),
      (match) => unescapeXml(match[1] ?? "")
    ).join("");

    expect(text).toContain(
      "You are hereby authorised to debit any charge for this service to our account number __________"
    );
  });

  it("uses authoritative derived data in the preview cache key", async () => {
    const service = createService();
    const confirmation = {
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1-YH-001",
      counterpartyName: "HSBC",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: { bankName: "HSBC", sections: {} },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
    };
    const derivedSnapshot = {
      clientCode: "C-ORC",
      clientName: "Orchid Holdings",
      projectCode: "AUD-1",
      projectName: "Orchid Audit",
      picName: "Server PIC",
      fiscalYear: 2026,
      balanceSheetDate: "2026-12-31",
      contactUserId: "user-1",
      contactName: "First Member",
      contactEmail: "first@example.test",
      confirmationCode: "AUD-1-YH-001",
    };

    await service.renderPreviewPdf({ confirmation, derivedSnapshot });
    await service.renderPreviewPdf({
      confirmation,
      derivedSnapshot: {
        ...derivedSnapshot,
        contactUserId: "user-2",
        contactName: "Second Member",
        contactEmail: "second@example.test",
      },
    });

    const firstPdfKey = storage.putCacheObject.mock.calls[1]?.[0];
    const secondPdfKey = storage.putCacheObject.mock.calls[3]?.[0];
    expect(firstPdfKey).not.toBe(secondPdfKey);
  });

  it("renders a confirmation draft docx into the shared preview conversion pipeline", async () => {
    const preview = {
      body: Buffer.from("%PDF-1.4 rendered"),
      fileName: "AUD-1-HSBC-confirmation.pdf",
      mimeType: "application/pdf",
    };
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.convertOfficeBufferToPdf.mockResolvedValueOnce(
      preview.body
    );

    await expect(
      createService().renderPreviewPdf({
        id: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "AUD-1",
        counterpartyName: "HSBC",
        draftTemplateCode: "PRC_BANK_TEMPLATE_1",
        draftPayload: {
          clientName: "Orchid Holdings",
          projectCode: "AUD-1",
          picName: "Jony Ma",
          reportDate: "2026-12-31",
          bankName: "HSBC",
          sections: {
            deposits: [],
            loans: [],
            closedAccounts: [],
            guarantees: [],
            bills: [],
            lettersOfCredit: [],
            derivatives: [],
            custodyItems: [],
            wealthProducts: [],
            otherItems: [],
          },
        },
        updatedAt: "2026-07-09T00:00:00.000Z",
        draftUpdatedAt: "2026-07-09T00:00:00.000Z",
        project: {
          id: "project-1",
          name: "Orchid Holdings",
          projectCode: "AUD-1",
        },
      })
    ).resolves.toStrictEqual(preview);

    expect(storage.putCacheObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^confirmation-preview-cache\/project-1\/confirmation-1\/confirmation-docx-v13-[a-f0-9]{16}\/AUD-1-HSBC-confirmation\.pdf$/
      ),
      Buffer.from("%PDF-1.4 rendered"),
      "application/pdf"
    );
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
    expect(documentConversion.getAttachmentPreviewPdf).not.toHaveBeenCalled();

    expect(storage.putCacheObject).toHaveBeenCalledTimes(1);
  });

  it("streams a stored PDF through the API origin", async () => {
    const pdf = Buffer.from("%PDF-1.4 uploaded");
    storage.getObjectBuffer.mockResolvedValue(pdf);

    await expect(
      createService().getStoredPdf(
        "confirmations/project-1/uploaded.pdf",
        "uploaded.pdf"
      )
    ).resolves.toStrictEqual({
      body: pdf,
      fileName: "uploaded.pdf",
      mimeType: "application/pdf",
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmations/project-1/uploaded.pdf"
    );
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
  });

  it("streams an unsupported uploaded file with its original name and MIME", async () => {
    const body = Buffer.from("opaque evidence");
    storage.getObjectBuffer.mockResolvedValue(body);

    await expect(
      createService().getStoredFile(
        "confirmation-artifacts/project-1/artifact-1/document.docx",
        "evidence.msg",
        "application/vnd.ms-outlook"
      )
    ).resolves.toStrictEqual({
      body,
      fileName: "evidence.msg",
      mimeType: "application/vnd.ms-outlook",
    });
    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "confirmation-artifacts/project-1/artifact-1/document.docx"
    );
  });

  it("fills PRC format one reply details and strips template highlighting", async () => {
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await createService().renderPreviewPdf({
      id: "confirmation-1",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "招商银行",
      draftTemplateCode: "PRC_BANK_TEMPLATE_1",
      draftPayload: {
        clientCode: "C-ORC-2026",
        clientName: "奥奇控股",
        projectCode: "AUD-1",
        picName: "Engagement PIC",
        reportDate: "2027-03-31",
        bankName: "招商银行",
        bankBranch: "深圳分行",
        replyAddress: "深圳市福田区鹏程一路广电金融中心20楼",
        replyContact: "李幈",
        replyPhone: "86-755-82900800",
        replyFax: "86-755-82900815",
        replyPostalCode: "518033",
        replyEmail: "audit-confirm@example.test",
        authorizationAccount: "755000001234",
        sections: {},
      },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
      project: {
        id: "project-1",
        name: "奥奇控股",
        projectCode: "AUD-1",
      },
    });

    const renderedDocx = getLastOfficeConversionBody();
    const renderedText = await extractDocxText(renderedDocx);
    const renderedXml = await extractDocumentXml(renderedDocx);
    const renderedPackageXml = await extractWordPackageXml(renderedDocx);
    const firstTitleIndex = renderedXml.indexOf("银行询证函");
    const bodyStartIndex = renderedXml.indexOf("<w:body");

    expect(renderedText).toContain("参考编号 : C-ORC-2026/Engagement PIC");
    expect(renderedText).toContain(
      "招商银行深圳分行（以下简称“贵行”，即“函证收件人”）："
    );
    expect(renderedText).toContain(
      "回函地址：深圳市福田区鹏程一路广电金融中心20楼"
    );
    expect(renderedText).toContain(
      "联系人：李幈    电话：86-755-82900800   传真：86-755-82900815"
    );
    expect(renderedText).toContain("邮编：518033");
    expect(renderedText).toContain("[电子邮箱: audit-confirm@example.test]");
    expect(renderedText).toContain("本公司[755000001234]账户");
    expect(renderedText).not.toContain("银行询证函（格式一）的使用说明");
    expect(renderedXml.slice(bodyStartIndex, firstTitleIndex)).not.toMatch(
      /<w:br\b[^>]*w:type="page"/
    );
    expect(renderedPackageXml).not.toContain("<w:highlight");
    expect(renderedPackageXml).not.toMatch(/<w:shd\b[^>]*w:fill="FFFF00"/);
  });

  it("fills PRC format two acceptance and company handler details", async () => {
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await createService().renderPreviewPdf({
      id: "confirmation-2",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "中国银行",
      draftTemplateCode: "PRC_BANK_TEMPLATE_2",
      draftPayload: {
        clientCode: "C-ORC-2026",
        clientName: "奥奇控股",
        projectCode: "AUD-1",
        picName: "Engagement PIC",
        reportDate: "2027-03-31",
        bankName: "中国银行",
        bankBranch: "深圳中心区支行",
        replyAddress: "深圳市福田区鹏程一路广电金融中心20楼",
        replyContact: "李幈",
        replyPhone: "86-755-82900800",
        replyFax: "86-755-82900815",
        replyPostalCode: "518033",
        replyEmail: "audit-confirm@example.test",
        authorizationAccount: "755000001234",
        receivingSupplement: "请通过网银函证平台受理",
        companySignatureDate: "2026-07-09",
        companyHandlerName: "王审计",
        companyHandlerTitle: "财务经理",
        companyHandlerPhone: "13800138000",
        sections: {},
      },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
      project: {
        id: "project-1",
        name: "奥奇控股",
        projectCode: "AUD-1",
      },
    });

    const renderedDocx = getLastOfficeConversionBody();
    const renderedText = await extractDocxText(renderedDocx);
    const renderedPackageXml = await extractWordPackageXml(renderedDocx);

    expect(renderedText).toContain("参考编号 : C-ORC-2026/Engagement PIC");
    expect(renderedText).toContain(
      "中国银行深圳中心区支行（以下简称“贵行”，即“函证收件人”）："
    );
    expect(renderedText).toContain(
      "回函地址：深圳市福田区鹏程一路广电金融中心20楼"
    );
    expect(renderedText).toContain(
      "联系人：李幈    电话：86-755-82900800   传真：86-755-82900815"
    );
    expect(renderedText).toContain("[电子邮箱: audit-confirm@example.test]");
    expect(renderedText).toContain(
      "補充其他受理信息（如适用）: 请通过网银函证平台受理"
    );
    expect(renderedText).toContain("2026年07月09日");
    expect(renderedText).toContain("公司经办人：王审计");
    expect(renderedText).toContain("职  务：财务经理");
    expect(renderedText).toContain("电  话：13800138000");
    expect(renderedText).not.toContain("银行询证函（格式二）的使用说明");
    expect(renderedPackageXml).not.toContain("<w:highlight");
    expect(renderedPackageXml).not.toMatch(/<w:shd\b[^>]*w:fill="FFFF00"/);
  });

  it("uses manually entered fiscal year and balance sheet date in PRC templates", async () => {
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await createService().renderPreviewPdf({
      id: "confirmation-2",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "中国银行",
      draftTemplateCode: "PRC_BANK_TEMPLATE_2",
      draftPayload: {
        clientCode: "C-ORC-2026",
        clientName: "奥奇控股",
        fiscalYear: "2026年度",
        balanceSheetDate: "2026-12-31",
        projectCode: "AUD-1",
        picName: "Engagement PIC",
        reportDate: "2027-03-31",
        bankName: "中国银行",
        sections: {},
      },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
      project: {
        id: "project-1",
        name: "奥奇控股",
        projectCode: "AUD-1",
        reportDate: "2027-03-31",
      },
    });

    const renderedDocx = getLastOfficeConversionBody();
    const renderedText = await extractDocxText(renderedDocx);

    expect(renderedText).toContain("本公司2026年度的财务报表");
    expect(renderedText).toContain("截至2026年12月31日（即“函证基准日”）");
    expect(renderedText).not.toContain("截至2027年03月31日");
  });

  it("fills the Hong Kong template office date and customer name", async () => {
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await createService().renderPreviewPdf({
      id: "confirmation-3",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC Hong Kong",
      draftTemplateCode: "SHINEWING_ENG_BANK",
      draftPayload: {
        clientCode: "C-ORC-2026",
        clientName: "Orchid Holdings",
        customerName: "Orchid Holdings Limited",
        projectCode: "AUD-1",
        picName: "Engagement PIC",
        reportDate: "2027-03-31",
        officeDate: "9 July 2026",
        authorizationAccount: "001-123456-789",
        sections: {},
      },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
      project: {
        id: "project-1",
        name: "Orchid Holdings",
        projectCode: "AUD-1",
      },
    });

    const renderedDocx = getLastOfficeConversionBody();
    const renderedText = await extractDocxText(renderedDocx);
    const renderedPackageXml = await extractWordPackageXml(renderedDocx);

    expect(renderedText).toContain("Office Date 9 July 2026");
    expect(renderedText).toContain("Ref C-ORC-2026/Engagement PIC");
    expect(renderedText).toContain("A/C Orchid Holdings Limited");
    expect(renderedText).toContain(
      "You are hereby authorized to debit any charge for this service to our account number 001-123456-789."
    );
    expect(renderedPackageXml).not.toContain("<w:highlight");
    expect(renderedPackageXml).not.toMatch(/<w:shd\b[^>]*w:fill="FFFF00"/);
  });

  it("uses draft auditor details instead of hardcoded firm text", async () => {
    storage.putCacheObject.mockResolvedValue(undefined as never);
    documentConversion.getAttachmentPreviewPdf.mockResolvedValue({
      absolutePath: "C:/tmp/confirmation-preview.pdf",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
    });

    await createService().renderPreviewPdf({
      id: "confirmation-4",
      projectId: "project-1",
      type: "BANK",
      confirmationCode: "AUD-1",
      counterpartyName: "HSBC Hong Kong",
      draftTemplateCode: "SHINEWING_ENG_BANK",
      draftPayload: {
        clientCode: "C-ORC-2026",
        clientName: "Orchid Holdings",
        customerName: "Orchid Holdings Limited",
        projectCode: "AUD-1",
        picName: "Engagement PIC",
        reportDate: "2027-03-31",
        auditorName: "Wing Zenith CPA Limited",
        auditorAddress: "21/F, Example Tower, Hong Kong",
        sections: {},
      },
      updatedAt: "2026-07-09T00:00:00.000Z",
      draftUpdatedAt: "2026-07-09T00:00:00.000Z",
      project: {
        id: "project-1",
        name: "Orchid Holdings",
        projectCode: "AUD-1",
      },
    });

    const renderedDocx = getLastOfficeConversionBody();
    const renderedText = await extractDocxText(renderedDocx);

    expect(renderedText).toContain("Wing Zenith CPA Limited");
    expect(renderedText).toContain("21/F, Example Tower, Hong Kong");
    expect(renderedText).not.toContain("SHINEWING (HK) CPA LIMITED");
    expect(renderedText).not.toContain("17/F, Chubb Tower");
  });

  it("rejects previews before a draft has been saved", async () => {
    await expect(
      createService().renderPreviewPdf({
        id: "confirmation-1",
        projectId: "project-1",
        type: "BANK",
        counterpartyName: "HSBC",
      })
    ).rejects.toBeInstanceOf(ApiBadRequestException);

    expect(storage.putCacheObject).not.toHaveBeenCalled();
    expect(storage.getDownloadObject).not.toHaveBeenCalled();
    expect(documentConversion.getAttachmentPreviewPdf).not.toHaveBeenCalled();
  });
});

async function extractDocxText(docx: Buffer) {
  const xml = await extractDocumentXml(docx);
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => unescapeXml(match[1] ?? ""))
    .join("");
}

async function extractDocumentXml(docx: Buffer) {
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file("word/document.xml")?.async("string");
  return xml ?? "";
}

function extractDynamicFieldXml(xml: string, id: string) {
  const escapedId = id.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    xml.match(
      new RegExp(`<v:rect id="PW_DYNAMIC_${escapedId}"[\\s\\S]*?</v:rect>`, "u")
    )?.[0] ?? ""
  );
}

async function extractLastOfficeConversionXml() {
  return extractDocumentXml(getLastOfficeConversionBody());
}

function getLastOfficeConversionBody() {
  const input = documentConversion.convertOfficeBufferToPdf.mock.calls.at(
    -1
  )?.[0] as { body?: Buffer } | undefined;
  if (!input?.body) {
    throw new Error("Office conversion input was not captured");
  }
  return input.body;
}

async function extractLastOfficeConversionText() {
  const xml = await extractLastOfficeConversionXml();
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => unescapeXml(match[1] ?? ""))
    .join("");
}

async function extractWordPackageXml(docx: Buffer) {
  const zip = await JSZip.loadAsync(docx);
  const parts = await Promise.all(
    Object.entries(zip.files)
      .filter(
        ([name, entry]) =>
          !entry.dir && name.startsWith("word/") && name.endsWith(".xml")
      )
      .map(([, entry]) => entry.async("string"))
  );
  return parts.join("\n");
}

function unescapeXml(value: string) {
  return value.replaceAll(
    /&(?:amp|apos|gt|lt|quot|#\d+|#x[\dA-Fa-f]+);/g,
    (entity) => {
      switch (entity) {
        case "&amp;": {
          return "&";
        }
        case "&apos;": {
          return "'";
        }
        case "&gt;": {
          return ">";
        }
        case "&lt;": {
          return "<";
        }
        case "&quot;": {
          return '"';
        }
        default: {
          const radix = entity.startsWith("&#x") ? 16 : 10;
          const digits = entity.slice(radix === 16 ? 3 : 2, -1);
          const codePoint = Number.parseInt(digits, radix);
          return Number.isSafeInteger(codePoint) && codePoint <= 0x10_ff_ff
            ? String.fromCodePoint(codePoint)
            : entity;
        }
      }
    }
  );
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
