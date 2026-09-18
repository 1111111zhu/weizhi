import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  ConfirmationDraftPayload,
  ConfirmationDraftTemplateCode,
} from "@project-wing/shared";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument } from "pdf-lib";

import { DocumentConversionService } from "../workflow/document-conversion.service";
import { ConfirmationDocumentService } from "./confirmation-document.service";

const runRegression = process.env.RUN_CONFIRMATION_RENDER_REGRESSION === "1";
const regression = runRegression ? describe : describe.skip;

function createRegressionTemplate() {
  return Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  bold: true,
                  text: "B2CONF generated confirmation template",
                }),
              ],
            }),
          ],
        },
      ],
    })
  );
}

async function extractPageWords(pdfPath: string): Promise<
  {
    text: string;
    x0: number;
    top: number;
    x1: number;
    bottom: number;
  }[]
> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(await readFile(pdfPath)),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  try {
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    return content.items.flatMap((item) => {
      if (!("str" in item) || item.str.length === 0) {
        return [];
      }
      const x0 = item.transform.at(4) ?? 0;
      const bottom = viewport.height - item.transform[5];
      const height =
        item.height || Math.hypot(item.transform[2], item.transform[3]);
      return [
        {
          text: item.str,
          x0,
          top: bottom - height,
          x1: x0 + item.width,
          bottom,
        },
      ];
    });
  } finally {
    await loadingTask.destroy();
  }
}

function groupWordsByLine(
  words: Awaited<ReturnType<typeof extractPageWords>>,
  tolerance = 2
) {
  const lines: { top: number; words: typeof words }[] = [];
  for (const word of [...words].sort(
    (left, right) => left.top - right.top || left.x0 - right.x0
  )) {
    const line = lines.find(
      (candidate) => Math.abs(candidate.top - word.top) <= tolerance
    );
    if (line) {
      line.words.push(word);
    } else {
      lines.push({ top: word.top, words: [word] });
    }
  }
  return lines.map((line) =>
    line.words
      .sort((left, right) => left.x0 - right.x0)
      .map((word) => word.text)
      .join("")
  );
}

regression("confirmation DOCX render regression", () => {
  vi.setConfig({ testTimeout: 120_000 });

  const previousGotenbergUrl = process.env.GOTENBERG_URL;
  const previousLibreOfficePath = process.env.LIBREOFFICE_PATH;

  beforeAll(() => {
    process.env.GOTENBERG_URL = "";
    process.env.LIBREOFFICE_PATH =
      "C:\\Program Files\\LibreOffice\\program\\soffice.com";
  });

  afterAll(() => {
    if (previousGotenbergUrl === undefined) {
      delete process.env.GOTENBERG_URL;
    } else {
      process.env.GOTENBERG_URL = previousGotenbergUrl;
    }
    if (previousLibreOfficePath === undefined) {
      delete process.env.LIBREOFFICE_PATH;
    } else {
      process.env.LIBREOFFICE_PATH = previousLibreOfficePath;
    }
  });

  it("keeps a long placed value intact inside its field box after DOCX conversion", async () => {
    const source = await createRegressionTemplate();
    const storage = {
      getObjectBuffer: vi.fn().mockResolvedValue(source),
    };
    const conversion = new DocumentConversionService();
    const service = new ConfirmationDocumentService(
      storage as never,
      conversion
    );
    const templateCode = "CTPL-42EE80005D40" as ConfirmationDraftTemplateCode;
    const draftPayload = {
      bankName: "E2E Test Bank",
      sections: {},
      templateLibrarySource: {
        objectKey:
          "confirmation-template-library/B2CONF-render-regression.docx",
        fileName: "B2CONF-render-regression.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      templateDesignSchema: {
        version: 1,
        fields: [
          {
            id: "field-1",
            kind: "TEXT",
            name: "Recipient",
            page: 1,
            x: 0.1245410737,
            y: 0.115864514,
            width: 0.2523047808,
            height: 0.018,
            placeholder: "Recipient",
            options: [],
          },
          {
            id: "field-2",
            kind: "SELECT",
            name: "Bank",
            page: 1,
            x: 0.1234256927,
            y: 0.1697514504,
            width: 0.2523047808,
            height: 0.018,
            placeholder: "Bank",
            options: ["E2E Test Bank"],
          },
          {
            id: "field-3",
            kind: "TEXT",
            name: "Date",
            page: 1,
            x: 0.636726401,
            y: 0.1697514504,
            width: 0.2541080335,
            height: 0.018,
            placeholder: "Date",
            options: [],
          },
          {
            id: "field-4",
            kind: "TEXT",
            name: "Reference",
            page: 1,
            x: 0.636726401,
            y: 0.2049037433,
            width: 0.2541080335,
            height: 0.018,
            placeholder: "Reference",
            options: [],
          },
          {
            id: "field-5",
            kind: "TEXT",
            name: "Office",
            page: 1,
            x: 0.1234256927,
            y: 0.1428079822,
            width: 0.2523047808,
            height: 0.018,
            placeholder: "Office",
            options: [],
          },
          {
            id: "field-7",
            kind: "SELECT",
            name: "Bank code",
            page: 1,
            x: 0.6241970879,
            y: 0.4056755875,
            width: 0.2468513854,
            height: 0.012,
            placeholder: "Bank code",
            options: ["HBR"],
            textStyle: {
              bold: false,
              fontFamily: "Arial",
              fontSize: 10,
              italic: false,
              underline: false,
            },
          },
          {
            id: "field-8",
            kind: "TEXT",
            name: "Export proof",
            page: 1,
            x: 0.1245410737,
            y: 0.5227272863,
            width: 0.176322495,
            height: 0.0192513695,
            placeholder: "Export proof",
            options: [],
          },
          {
            id: "field-9",
            kind: "TEXT",
            name: "Second proof",
            page: 1,
            x: 0.1245410737,
            y: 0.548239764,
            width: 0.176322495,
            height: 0.0192513695,
            placeholder: "Second proof",
            options: [],
          },
          {
            id: "field-10",
            kind: "SELECT",
            name: "Choice",
            page: 1,
            x: 0.1269678841,
            y: 0.5925022472,
            width: 0.6206548965,
            height: 0.0235294335,
            placeholder: "Choice",
            options: ["选项值"],
          },
        ],
      },
      templateFieldValues: {
        "field-1": "To the Manager - SuperAdmin E2E",
        "field-2": "E2E Test Bank",
        "field-3": "2026-08-26",
        "field-4": "REF-E2E-20260826",
        "field-5": "琶洲",
        "field-7": "HBR",
        "field-8": "EXPORT_PROOF_20260826",
        "field-9": "SECOND_PROOF_20260826",
        "field-10": "选项值",
      },
    } as unknown as ConfirmationDraftPayload;

    const artifact = await service.renderArtifactFiles({
      confirmation: {
        id: "confirmation-render-regression",
        projectId: "project-1",
        type: "BANK",
        confirmationCode: "HBR-2026-ACC-YH-013",
        counterpartyName: "E2E Test Bank",
        draftTemplateCode: templateCode,
        draftPayload,
      },
    });
    const configuredOutputDir =
      process.env.CONFIRMATION_RENDER_REGRESSION_OUTPUT_DIR?.trim();
    const outputDir =
      configuredOutputDir ??
      (await mkdtemp(path.join(tmpdir(), "project-wing-render-regression-")));
    if (configuredOutputDir) {
      await mkdir(outputDir, { recursive: true });
    }
    const outputPdf = path.join(outputDir, artifact.pdfFileName);
    const outputDocx = path.join(outputDir, artifact.docxFileName);
    try {
      await writeFile(outputPdf, artifact.pdf);
      await writeFile(outputDocx, artifact.docx);
      const words = await extractPageWords(outputPdf);
      const fieldBox = {
        bottom: 0.5227272863 + 0.0192513695,
        left: 0.1245410737,
        right: 0.1245410737 + 0.176322495,
        top: 0.5227272863,
      };
      const document = await PDFDocument.load(artifact.pdf);
      const [page] = document.getPages();
      const relevantWords = words.filter(
        (word) =>
          word.x0 >= fieldBox.left * page.getWidth() - 2 &&
          word.x1 <= fieldBox.right * page.getWidth() + 2 &&
          word.top >= fieldBox.top * page.getHeight() - 2 &&
          word.bottom <= fieldBox.bottom * page.getHeight() + 2
      );

      expect(relevantWords.map((word) => word.text)).toContain(
        "EXPORT_PROOF_20260826"
      );

      const roundTripPdf = await conversion.convertOfficeBufferToPdf({
        fileName: artifact.docxFileName,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: artifact.docx,
      });
      const roundTripPdfPath = path.join(
        outputDir,
        `${artifact.docxFileName}.roundtrip.pdf`
      );
      await writeFile(roundTripPdfPath, roundTripPdf);
      const roundTripWords = await extractPageWords(roundTripPdfPath);
      const roundTripDocument = await PDFDocument.load(roundTripPdf);
      const [roundTripPage] = roundTripDocument.getPages();
      const roundTripWordsInFieldBox = roundTripWords.filter(
        (word) =>
          word.x0 >= fieldBox.left * roundTripPage.getWidth() - 2 &&
          word.x1 <= fieldBox.right * roundTripPage.getWidth() + 2 &&
          word.top >= fieldBox.top * roundTripPage.getHeight() - 2 &&
          word.bottom <= fieldBox.bottom * roundTripPage.getHeight() + 2
      );
      expect(groupWordsByLine(roundTripWordsInFieldBox)).toContain(
        "EXPORT_PROOF_20260826"
      );
    } finally {
      if (!configuredOutputDir) {
        await rm(outputDir, { force: true, recursive: true });
      }
    }
  });
});
