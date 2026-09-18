import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import {
  CmpBillingInvoiceInputSchema,
  type CmpEngagementFeeNote,
} from "@project-wing/shared";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import {
  buildFeeNoteDocx,
  buildFeeNoteExportDocument,
  buildFeeNotePdfSource,
} from "./cmp-engagement-fee-note-export";
import { mergeLegacyFeeNoteLocalizedContent } from "./cmp.service";

const note: CmpEngagementFeeNote = {
  id: "fee-note-1",
  engagementId: "engagement-1",
  periodNumber: 1,
  plannedIssueDate: "2026-08-22",
  plannedAmount: "1200.00",
  receivedAmount: "",
  receivedDate: "",
  collectionStatus: "UNRECORDED",
  outstandingAmount: "1200.00",
  feeNoteNumber: "28505",
  engagementReference: "E001",
  issueDate: "2026-08-22",
  recipientName: "维致客户",
  recipientAttention: "董事",
  recipientSalutation: "贵公司",
  recipientAddress: "香港",
  currency: "HKD",
  serviceDescription: "专业服务",
  lineItems: [{ id: "service", description: "专业服务", amount: "1200.00" }],
  amount: "1200.00",
  disbursementAmount: "",
  totalAmount: "1200.00",
  issuerReference: "JMZ",
  signatoryName: "张三",
  bankPayeeName: "Wing Zenith",
  bankPayeeNameZh: "维致（香港）会计师事务所",
  bankName: "Hang Seng Bank",
  hkdAccountNumber: "123",
  cnyAccountNumber: "",
  usdAccountNumber: "",
  swiftCode: "",
  hkdSwiftCode: "HASEHKHH",
  cnySwiftCode: "",
  usdSwiftCode: "",
  firmLegalName: "维致（香港）会计师事务所",
  firmAddress: "香港",
  firmPhone: "(852) 53667568",
  firmFax: "",
  firmEmail: "info@wzcpa.hk",
  firmWebsite: "www.wzcpa.hk",
  localizedContent: {
    "zh-CN": {
      recipientName: "维致客户",
      recipientAttention: "董事",
      recipientSalutation: "贵公司",
      recipientAddress: "香港",
      serviceDescription: "专业服务",
      lineItemDescriptions: { service: "专业服务" },
      signatoryName: "张三",
      bankPayeeName: "维致（香港）会计师事务所",
      bankName: "恒生银行",
      firmLegalName: "维致（香港）会计师事务所",
      firmAddress: "香港灣仔",
    },
    "en-US": {
      recipientName: "Wing Client",
      recipientAttention: "Director",
      recipientSalutation: "Your company",
      recipientAddress: "Hong Kong",
      serviceDescription: "Professional services",
      lineItemDescriptions: { service: "Professional services" },
      signatoryName: "Jane Manager",
      bankPayeeName: "Wing Zenith",
      bankName: "Hang Seng Bank",
      firmLegalName: "Wing Zenith",
      firmAddress: "Wan Chai, Hong Kong",
    },
  },
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

describe("cMP Fee Note export", () => {
  it("builds independent Chinese and English document content", () => {
    const chinese = buildFeeNotePdfSource(
      buildFeeNoteExportDocument(note, "zh-CN")
    );
    const english = buildFeeNotePdfSource(
      buildFeeNoteExportDocument(note, "en-US")
    );

    expect(chinese).toContain("维致客户");
    expect(chinese).toContain("专业服务");
    expect(english).toContain("Wing Client");
    expect(english).toContain("Professional services");
    expect(english).not.toContain("维致客户");
    expect(english).toContain("margin: (left: 15mm, right: 15mm");
    expect(english).toContain('dash: "dashed"');
    expect(english).toContain("#grid(columns: (1fr, 38mm), row-gutter: 1.2mm");
    expect(english).toContain("#grid(columns: (32mm, 1fr), row-gutter: 0.7mm");
    expect(english).not.toContain("#align(center)");
  });

  it("creates an editable Word document", async () => {
    const body = await buildFeeNoteDocx(
      buildFeeNoteExportDocument(note, "en-US")
    );
    expect(body.subarray(0, 2).toString()).toBe("PK");
    const archive = await JSZip.loadAsync(body);
    const xml = await archive.file("word/document.xml")?.async("string");
    expect(xml).toContain("Wing Client");
    expect(xml).toContain("Professional services");
    expect(xml).toContain('w:pgSz w:w="11906"');
    expect(xml).not.toContain("D9E0E8");
  });

  it("accepts the legacy PDF invoice request and rejects invalid formats", () => {
    expect(
      CmpBillingInvoiceInputSchema.parse({
        expectedVersion: 1,
        locale: "zh-CN",
      }).format
    ).toBe("pdf");
    expect(
      CmpBillingInvoiceInputSchema.safeParse({
        expectedVersion: 1,
        locale: "en-US",
        format: "xlsx",
      }).success
    ).toBeFalsy();
  });

  it("compiles the bilingual Typst source into a single-page PDF", async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `service-${index + 1}`,
      description: `服务项目 ${index + 1}`,
      amount: "1200.00",
    }));
    const compiler = NodeCompiler.create();
    const compiled = compiler.compile({
      mainFileContent: buildFeeNotePdfSource(
        buildFeeNoteExportDocument(
          {
            ...note,
            recipientAddress: "香港湾仔港湾道88号\n港湾中心20楼",
            lineItems: items,
            localizedContent: {
              ...note.localizedContent,
              "zh-CN": {
                ...note.localizedContent!["zh-CN"],
                recipientAddress: "香港湾仔港湾道88号\n港湾中心20楼",
                lineItemDescriptions: Object.fromEntries(
                  items.map((item) => [item.id, item.description])
                ),
              },
            },
          },
          "zh-CN"
        )
      ),
    });
    expect(compiled.hasError()).toBeFalsy();
    expect(compiled.result).toBeDefined();
    const body = Buffer.from(compiler.pdf(assertPresentValue(compiled.result)));
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    expect((await PDFDocument.load(body)).getPageCount()).toBe(1);
  });

  it("keeps legacy PATCH text visible in both bilingual versions", () => {
    const merged = mergeLegacyFeeNoteLocalizedContent(
      {
        recipientName: "Updated recipient",
        serviceDescription: "Updated service",
        lineItems: [
          { id: "service", description: "Updated line", amount: "1200.00" },
        ],
      },
      note
    );

    expect(merged.localizedContent?.["zh-CN"].recipientName).toBe(
      "Updated recipient"
    );
    expect(merged.localizedContent?.["en-US"].serviceDescription).toBe(
      "Updated service"
    );
    expect(
      merged.localizedContent?.["zh-CN"].lineItemDescriptions.service
    ).toBe("Updated line");
    expect(
      merged.localizedContent?.["en-US"].lineItemDescriptions.service
    ).toBe("Updated line");
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
