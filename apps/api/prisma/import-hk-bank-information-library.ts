import "dotenv/config";
import { basename, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { XLSX } from "../src/common/xlsx";

const sourcePath = resolve(
  process.argv[2] ?? "E:/ProjiectWing/函证中心文件/香港银行函证信息库.xlsx"
);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const workbook = XLSX.readFile(sourcePath, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
if (!sheet) throw new Error("The workbook does not contain a worksheet");

const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
  header: 1,
  defval: "",
  raw: false,
});
const [header, ...dataRows] = rows;
if (!header?.length) throw new Error("The workbook header row is empty");

const normalizeHeader = (value: unknown) =>
  String(value).replace(/\s+/g, "").trim();
const columns = new Map(
  header.map((value, index) => [normalizeHeader(value), index])
);
const requiredColumns = [
  "银行代码(BankCode)",
  "银行英文名称",
  "银行中文名称",
  "银行类型",
  "香港主要营业地址",
  "函证寄送地址",
  "联系人",
  "注意(Attn)",
  "备注",
  "背景介绍",
];
for (const column of requiredColumns) {
  if (!columns.has(normalizeHeader(column)))
    throw new Error(`Missing workbook column: ${column}`);
}

function value(row: unknown[], column: string) {
  return String(row[columns.get(normalizeHeader(column))!] ?? "").trim();
}

async function main() {
  let imported = 0;
  await prisma.$transaction(async (tx) => {
    for (const [index, row] of dataRows.entries()) {
      const bankCode = value(row, "银行代码(BankCode)").padStart(3, "0");
      const bankNameEn = value(row, "银行英文名称");
      const bankNameZh = value(row, "银行中文名称");
      const businessAddress = value(row, "香港主要营业地址");
      const mailingAddress = value(row, "函证寄送地址");
      const notes = value(row, "备注");
      const mailingAddressSameAsBusiness = notes.includes(
        "函证寄送地址同营业地址"
      );
      if (
        !/^\d{3}$/.test(bankCode) ||
        !bankNameEn ||
        !bankNameZh ||
        !businessAddress
      ) {
        throw new Error(`Invalid bank row ${index + 2}`);
      }
      await tx.confirmationInformationLibraryEntry.upsert({
        where: { bankCode },
        create: {
          bankCode,
          bankNameEn,
          bankNameZh,
          bankType: value(row, "银行类型"),
          businessAddress,
          mailingAddress: mailingAddressSameAsBusiness
            ? null
            : mailingAddress || null,
          mailingAddressSameAsBusiness,
          contactName: value(row, "联系人") || bankNameZh,
          attention: value(row, "注意(Attn)") || null,
          notes: mailingAddressSameAsBusiness ? null : notes || null,
          background: value(row, "背景介绍") || null,
          sourceLabel: basename(sourcePath),
          sourceRow: index + 2,
          isActive: true,
        },
        update: {
          bankNameEn,
          bankNameZh,
          bankType: value(row, "银行类型"),
          businessAddress,
          mailingAddress: mailingAddressSameAsBusiness
            ? null
            : mailingAddress || null,
          mailingAddressSameAsBusiness,
          contactName: value(row, "联系人") || bankNameZh,
          attention: value(row, "注意(Attn)") || null,
          notes: mailingAddressSameAsBusiness ? null : notes || null,
          background: value(row, "背景介绍") || null,
          sourceLabel: basename(sourcePath),
          sourceRow: index + 2,
          isActive: true,
        },
      });
      imported += 1;
    }
  });
  console.log(`Imported ${imported} bank information rows from ${sourcePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
