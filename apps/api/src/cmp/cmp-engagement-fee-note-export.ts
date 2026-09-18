import type {
  CmpEngagementFeeNote,
  CmpFeeNoteLocale,
} from "@project-wing/shared";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const labels = {
  "zh-CN": {
    title: "收费单",
    number: "收费单编号",
    reference: "业务参考编号",
    date: "开立日期",
    recipient: "收款对象",
    attention: "收件人称谓",
    address: "客户地址",
    openingBefore: "本所非常荣幸有机会为",
    openingAfter: "提供专业服务如下：",
    services: "专业服务内容",
    item: "服务项目",
    amount: "金额",
    total: "总金额",
    signatory: "签署人",
    issuer: "经办参考",
    remittance: "付款资料",
    paymentNotice: "敬请见票付款。",
    paymentInstructions: "请按以下银行资料付款，并于付款时注明收费单编号。",
    payee: "收款方名称",
    bank: "银行名称",
    firm: "事务所资料",
    firmName: "事务所法定名称",
    firmAddress: "事务所地址",
    phone: "电话",
    email: "电邮",
    website: "网站",
  },
  "en-US": {
    title: "Fee Note",
    number: "Fee note number",
    reference: "Engagement reference",
    date: "Issue date",
    recipient: "Recipient",
    attention: "Attention",
    address: "Recipient address",
    openingBefore: "We are pleased to provide professional services to",
    openingAfter: "as follows:",
    services: "Professional services",
    item: "Service item",
    amount: "Amount",
    total: "Total amount",
    signatory: "Signatory",
    issuer: "Issuer reference",
    remittance: "Remittance",
    paymentNotice: "This fee note is due upon presentation.",
    paymentInstructions:
      "Please make payment to the following bank accounts and quote the fee note number for reference.",
    payee: "Payee name",
    bank: "Bank name",
    firm: "Firm details",
    firmName: "Firm legal name",
    firmAddress: "Firm address",
    phone: "Telephone",
    email: "Email",
    website: "Website",
  },
} as const;

export type FeeNoteExportDocument = ReturnType<
  typeof buildFeeNoteExportDocument
>;

export function buildFeeNoteExportDocument(
  note: CmpEngagementFeeNote,
  locale: CmpFeeNoteLocale
) {
  const copy = labels[locale];
  const content = note.localizedContent[locale];
  const lineItems = note.lineItems.map((item) => ({
    description: content.lineItemDescriptions[item.id] ?? item.description,
    amount: item.amount,
  }));
  const total = lineItems.reduce((sum, item) => sum + money(item.amount), 0);
  return {
    locale,
    copy,
    note,
    content,
    lineItems,
    total: formatAmount(total, note.currency, locale),
    bankLines: (
      [
        ["CNY", note.cnyAccountNumber, note.cnySwiftCode],
        ["HKD", note.hkdAccountNumber, note.hkdSwiftCode],
        ["USD", note.usdAccountNumber, note.usdSwiftCode],
      ] as [string, string, string][]
    ).filter((line) => line[1] || line[2]),
  };
}

export function buildFeeNotePdfSource(document: FeeNoteExportDocument) {
  const { copy, note, content, lineItems, total, bankLines } = document;
  const itemRows = lineItems
    .map(
      (item) =>
        `[${typstText(item.description)}], [#align(right)[${typstText(formatAmount(money(item.amount), note.currency, document.locale))}]]`
    )
    .join(",\n  ");
  const bankRows = [
    [copy.payee, content.bankPayeeName],
    [copy.bank, content.bankName],
    ...bankLines.map(([currency, account, swift]) => [
      `${currency} account`,
      `${account}${swift ? `  SWIFT: ${swift}` : ""}`,
    ]),
  ]
    .map(([label, value]) => `[${typstText(label)}], [${typstText(value)}]`)
    .join(",\n  ");
  const attention = content.recipientAttention
    ? `#v(0.8mm)\n#text(size: 8pt)[${typstText(`${copy.attention}: ${content.recipientAttention}`)}]`
    : "";

  return `#set page(paper: "a4", margin: (left: 15mm, right: 15mm, top: 9mm, bottom: 9mm))
#set text(size: 9pt)
#text(size: 26pt, weight: "bold")[WZ]
#v(5mm)
#grid(columns: (1fr, 1fr, 1fr), column-gutter: 10mm,
  [#text(size: 7.5pt, fill: rgb(95, 95, 95))[${typstText(copy.number)}]#linebreak()#text(size: 10pt)[${typstText(note.feeNoteNumber)}]],
  [#text(size: 7.5pt, fill: rgb(95, 95, 95))[${typstText(copy.reference)}]#linebreak()#text(size: 10pt)[${typstText(note.engagementReference)}]],
  [#align(right)[#text(size: 7.5pt, fill: rgb(95, 95, 95))[${typstText(copy.date)}]#linebreak()#text(size: 10pt)[${typstText(note.issueDate)}]]]
)
#v(5mm)
#box(width: 82mm)[
  #text(weight: "semibold")[${typstLines(content.recipientName)}]
  #v(0.8mm)
  #text(size: 8.5pt)[${typstLines(content.recipientAddress)}]
  ${attention}
]
#v(7mm)
#grid(columns: (1fr, 38mm),
  [],
  [#align(right)[#text(size: 8pt, fill: rgb(95, 95, 95))[${typstText(document.locale === "zh-CN" ? "币种" : "Currency")}]#linebreak()#text(size: 10pt)[${typstText(note.currency)}]]]
)
#v(1.5mm)
#grid(columns: (1fr, 38mm), row-gutter: 1.2mm,
  [#text(size: 8pt, fill: rgb(95, 95, 95))[${typstText(copy.item)}]], [#align(right)[#text(size: 8pt, fill: rgb(95, 95, 95))[${typstText(copy.amount)}]]],
  ${itemRows},
  [#text(weight: "bold")[${typstText(copy.total)}]], [#align(right)[#box(width: 38mm)[#line(length: 100%, stroke: rgb(42, 42, 42))#v(0.6mm)#text(weight: "bold")[${typstText(total)}]#v(0.5mm)#line(length: 100%, stroke: rgb(42, 42, 42))#v(0.25mm)#line(length: 100%, stroke: rgb(42, 42, 42))]]]
)
#v(4mm)
#align(right)[${typstText(copy.signatory)}: ${typstText(content.signatoryName)}]
#v(7mm)
#line(length: 100%, stroke: (paint: rgb(70, 70, 70), dash: "dashed"))
#v(1.5mm)
#grid(columns: (1fr, 1fr),
  [${typstText(copy.issuer)}: ${typstText(note.issuerReference)}],
  [#align(right)[${typstText(copy.number)}: ${typstText(note.feeNoteNumber)}]]
)
#v(2.5mm)
#text(size: 8pt, weight: "bold")[${typstText(copy.remittance)}]
#v(0.8mm)
#text(size: 7.8pt)[${typstText(copy.paymentNotice)}]
#linebreak()
#text(size: 7.8pt)[${typstText(copy.paymentInstructions)}]
#v(1.5mm)
#grid(columns: (32mm, 1fr), row-gutter: 0.7mm,
  ${bankRows}
)
#v(3mm)
#grid(columns: (1fr, 1.35fr, 1fr), column-gutter: 5mm,
  [#text(size: 7.5pt)[${typstLines(content.firmLegalName)}]],
  [#text(size: 7.5pt)[${typstLines(content.firmAddress)}]],
  [#text(size: 7.5pt)[${typstText(note.firmPhone)}]#linebreak()${typstText(note.firmEmail)}#linebreak()${typstText(note.firmWebsite)}]
)`;
}

export async function buildFeeNoteDocx(document: FeeNoteExportDocument) {
  await Promise.resolve();
  const { copy, note, content, lineItems, total, bankLines } = document;
  const table = (rows: [string, string][]) => plainTable(rows);
  const itemTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          cell(copy.item, false, 70, undefined, { size: 16, color: "666666" }),
          cell(copy.amount, false, 30, AlignmentType.RIGHT, {
            size: 16,
            color: "666666",
          }),
        ],
      }),
      ...lineItems.map(
        (item) =>
          new TableRow({
            children: [
              cell(item.description, false, 70),
              cell(
                formatAmount(
                  money(item.amount),
                  note.currency,
                  document.locale
                ),
                false,
                30,
                AlignmentType.RIGHT
              ),
            ],
          })
      ),
      new TableRow({
        children: [
          cell(copy.total, true, 70),
          cell(total, true, 30, AlignmentType.RIGHT, {
            topBorder: { style: BorderStyle.SINGLE, size: 6, color: "2A2A2A" },
            bottomBorder: {
              style: BorderStyle.DOUBLE,
              size: 10,
              color: "2A2A2A",
            },
          }),
        ],
      }),
    ],
  });

  return Packer.toBuffer(
    new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11_906, height: 16_838 },
              margin: { top: 510, right: 850, bottom: 510, left: 850 },
            },
          },
          children: [
            paragraph("WZ", {
              size: 40,
              bold: true,
              spacingAfter: 120,
            }),
            metadataTable([
              [copy.number, note.feeNoteNumber],
              [copy.reference, note.engagementReference],
              [copy.date, note.issueDate],
            ]),
            paragraph(content.recipientName, {
              bold: true,
              spacingBefore: 180,
            }),
            ...multilineParagraphs(content.recipientAddress),
            ...(content.recipientAttention
              ? [
                  paragraph(
                    `${copy.attention}: ${content.recipientAttention}`,
                    { size: 16, spacingBefore: 40 }
                  ),
                ]
              : []),
            paragraph(note.currency, {
              size: 18,
              alignment: AlignmentType.RIGHT,
              spacingBefore: 180,
              spacingAfter: 80,
            }),
            itemTable,
            paragraph(`${copy.signatory}: ${content.signatoryName}`, {
              alignment: AlignmentType.RIGHT,
              spacingBefore: 120,
            }),
            dottedDivider(),
            metadataTable(
              [
                [copy.issuer, note.issuerReference],
                [copy.number, note.feeNoteNumber],
              ],
              [50, 50]
            ),
            paragraph(copy.remittance, {
              bold: true,
              size: 16,
              spacingBefore: 100,
            }),
            paragraph(copy.paymentNotice, { size: 16 }),
            paragraph(copy.paymentInstructions, { size: 16, spacingAfter: 80 }),
            table([
              [copy.payee, content.bankPayeeName],
              [copy.bank, content.bankName],
              ...bankLines.map(
                ([currency, account, swift]): [string, string] => [
                  `${currency} account`,
                  `${account}${swift ? `  SWIFT: ${swift}` : ""}`,
                ]
              ),
            ]),
            footerTable(content, note),
          ],
        },
      ],
    })
  );
}

function paragraph(
  value: string,
  options: {
    size?: number;
    bold?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingBefore?: number;
    spacingAfter?: number;
    color?: string;
  } = {}
) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { before: options.spacingBefore, after: options.spacingAfter },
    children: [
      new TextRun({
        text: value || " ",
        size: options.size,
        bold: options.bold,
        color: options.color,
      }),
    ],
  });
}

function cell(
  value: string,
  bold: boolean,
  width: number,
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType],
  options: {
    size?: number;
    color?: string;
    topBorder?: {
      style: (typeof BorderStyle)[keyof typeof BorderStyle];
      size: number;
      color: string;
    };
    bottomBorder?: {
      style: (typeof BorderStyle)[keyof typeof BorderStyle];
      size: number;
      color: string;
    };
  } = {}
) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: {
      top: options.topBorder ?? {
        style: BorderStyle.NONE,
        size: 0,
        color: "FFFFFF",
      },
      bottom: options.bottomBorder ?? {
        style: BorderStyle.NONE,
        size: 0,
        color: "FFFFFF",
      },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: [
      paragraph(value, {
        bold,
        alignment,
        size: options.size,
        color: options.color,
      }),
    ],
  });
}

function plainTable(
  rows: [string, string][],
  widths: [number, number] = [30, 70]
) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            cell(label, true, widths[0], undefined, { size: 16 }),
            cell(value, false, widths[1], undefined, { size: 16 }),
          ],
        })
    ),
  });
}

function metadataTable(
  rows: [string, string][],
  widths: [number, number, number] | [number, number] = [33, 34, 33]
) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: rows.map(
          ([label, value], index) =>
            new TableCell({
              width: {
                size: widths[index] ?? Math.floor(100 / rows.length),
                type: WidthType.PERCENTAGE,
              },
              borders: TableBorders.NONE,
              children: [
                paragraph(label, { size: 15, color: "666666" }),
                paragraph(value, {
                  size: 20,
                  alignment:
                    index === rows.length - 1 ? AlignmentType.RIGHT : undefined,
                }),
              ],
            })
        ),
      }),
    ],
  });
}

function dottedDivider() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.DOTTED, size: 6, color: "4A4A4A" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [paragraph(" ", { spacingBefore: 180 })],
          }),
        ],
      }),
    ],
  });
}

function footerTable(
  content: FeeNoteExportDocument["content"],
  note: FeeNoteExportDocument["note"]
) {
  const divider = { style: BorderStyle.SINGLE, size: 2, color: "8A8A8A" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows: [
      new TableRow({
        children: [
          stackedCell(multilineParagraphs(content.firmLegalName), 30),
          stackedCell(multilineParagraphs(content.firmAddress), 40, divider),
          stackedCell(
            [note.firmPhone, note.firmEmail, note.firmWebsite]
              .filter(Boolean)
              .map((value) => paragraph(value, { size: 16 })),
            30,
            divider
          ),
        ],
      }),
    ],
  });
}

function stackedCell(
  children: Paragraph[],
  width: number,
  leftBorder?: {
    style: (typeof BorderStyle)[keyof typeof BorderStyle];
    size: number;
    color: string;
  }
) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: leftBorder ?? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: children.length ? children : [paragraph(" ", { size: 16 })],
  });
}

function multilineParagraphs(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .filter(
      (line, index, lines) => Boolean(line) || lines.length === 1 || index > 0
    )
    .map((line) => paragraph(line || " ", { size: 16 }));
}

function typstText(value: string) {
  return `#text(${JSON.stringify(value || "")})`;
}

function typstLines(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => typstText(line))
    .join("#linebreak()");
}

function money(value: string) {
  const parsed = Number(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(
  value: number,
  currency: string,
  locale: CmpFeeNoteLocale
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
