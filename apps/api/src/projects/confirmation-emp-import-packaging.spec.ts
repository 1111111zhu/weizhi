import {
  CONFIRMATION_EMP_MANIFEST_FILE_NAME,
  MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH,
  buildConfirmationEmpImportFileName,
  buildConfirmationEmpImportManifestCsv,
  buildConfirmationEmpImportZipPlan,
  decodeConfirmationEmpImportManifestCell,
} from "./confirmation-emp-import-packaging";

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\r" && csv[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

describe("confirmation EMP import packaging", () => {
  it("uses the ZIP child code and business name for the entry name", () => {
    const plan = buildConfirmationEmpImportZipPlan([
      {
        internalSequence: 1,
        sourceConfirmationCode: "EMP-2026-001",
        counterparty: "Acme",
        zipEntryName: "1000.1.01-Acme-Outgoing.pdf",
        role: "OUTGOING",
        originalName: "outgoing.pdf",
        size: 1,
        checksum: "sha",
      },
    ]);

    expect(plan.files[0]?.zipPath).toBe("1000.1.01-Acme-Outgoing.pdf");
  });

  it("creates flat outgoing and response names from the internal sequence", () => {
    const plan = buildConfirmationEmpImportZipPlan([
      {
        internalSequence: 1,
        sourceConfirmationCode: "EMP-2026-YH-901",
        counterparty: "ACME*North",
        role: "OUTGOING",
        originalName: "outgoing.pdf",
        size: 123,
        checksum: "sha-outgoing",
      },
      {
        internalSequence: 2,
        sourceConfirmationCode: "EMP-2026-YH-902",
        counterparty: "ACME*North",
        role: "RESPONSE_ORIGINAL",
        responseSequence: 1,
        originalName: "reply.msg",
        size: 456,
        checksum: "sha-response",
      },
    ]);

    expect(plan.files.map((file) => file.zipPath)).toStrictEqual([
      "001-ACME-North-Outgoing.pdf",
      "002-ACME-North-Response-01-Original.msg",
    ]);
    expect(plan.files[0]?.zipPath).not.toContain("EMP-2026-YH-901");
    expect(plan.manifestFileName).toBe(CONFIRMATION_EMP_MANIFEST_FILE_NAME);
    expect(plan.manifestCsv).toContain(
      "内部序号,源函证代码,对方,角色,最终名,原名,大小,checksum"
    );
    expect(plan.manifestCsv).toContain(
      "001,EMP-2026-YH-901,ACME*North,Outgoing,001-ACME-North-Outgoing.pdf,outgoing.pdf,123,sha-outgoing"
    );
  });

  it("normalizes illegal and overlong names and suffixes duplicates deterministically", () => {
    const input = {
      internalSequence: 7,
      sourceConfirmationCode: "EMP-2026-OTHER-7",
      counterparty: `${"A".repeat(300)}<>:/\\|?*`,
      role: "RESPONSE_ORIGINAL" as const,
      responseSequence: 3,
      originalName: "reply.pdf",
      size: 1,
      checksum: "sha",
    };
    const first = buildConfirmationEmpImportFileName(input);
    const second = buildConfirmationEmpImportFileName(input, [first]);

    expect(first).toMatch(/^007-A+-Response-03-Original\.pdf$/);
    expect(first.length).toBeLessThanOrEqual(
      MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH
    );
    expect(first).not.toMatch(/[<>:"/\\|?*\p{Cc}]/u);
    expect(second).toMatch(/-02\.pdf$/);
    expect(second).not.toBe(first);
    expect(second.length).toBeLessThanOrEqual(
      MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH
    );
    expect(buildConfirmationEmpImportFileName(input, [first])).toBe(second);
  });

  it("caps an overlong extension while keeping the flat name within the limit", () => {
    const name = buildConfirmationEmpImportFileName({
      internalSequence: 8,
      sourceConfirmationCode: "EMP-2026-OTHER-8",
      counterparty: "Counterparty",
      role: "OUTGOING",
      originalName: `evidence.${"x".repeat(300)}`,
      size: 1,
      checksum: "sha",
    });

    expect(name).toMatch(/^008-Counterparty-Outgoing\.x{1,32}$/);
    expect(name.length).toBeLessThanOrEqual(
      MAX_CONFIRMATION_EMP_FILE_NAME_LENGTH
    );
  });

  it("uses bin for extensionless, hidden, and empty suffix names", () => {
    const files = [
      {
        internalSequence: 1,
        sourceConfirmationCode: "EMP-1",
        counterparty: "Counterparty",
        role: "OUTGOING" as const,
        originalName: "README",
        size: 1,
        checksum: "sha-readme",
      },
      {
        internalSequence: 2,
        sourceConfirmationCode: "EMP-2",
        counterparty: "Counterparty",
        role: "OUTGOING" as const,
        originalName: ".gitignore",
        size: 2,
        checksum: "sha-hidden",
      },
      {
        internalSequence: 3,
        sourceConfirmationCode: "EMP-3",
        counterparty: "Counterparty",
        role: "OUTGOING" as const,
        originalName: "reply.",
        size: 3,
        checksum: "sha-empty-suffix",
      },
      {
        internalSequence: 4,
        sourceConfirmationCode: "EMP-4",
        counterparty: "Counterparty",
        role: "OUTGOING" as const,
        originalName: "reply.tar.gz",
        size: 4,
        checksum: "sha-gz",
      },
    ];
    const plan = buildConfirmationEmpImportZipPlan(files);

    expect(plan.files.map((file) => file.finalName)).toStrictEqual([
      "001-Counterparty-Outgoing.bin",
      "002-Counterparty-Outgoing.bin",
      "003-Counterparty-Outgoing.bin",
      "004-Counterparty-Outgoing.gz",
    ]);
    expect(plan.files.map((file) => file.zipPath)).toStrictEqual(
      plan.files.map((file) => file.finalName)
    );
    expect(plan.manifestCsv).toContain(
      "001,EMP-1,Counterparty,Outgoing,001-Counterparty-Outgoing.bin,README,1,sha-readme"
    );
  });

  it("quotes manifest values that contain CSV delimiters or quotes", () => {
    const plan = buildConfirmationEmpImportZipPlan([
      {
        internalSequence: 1,
        sourceConfirmationCode: "EMP,001",
        counterparty: 'ACME, "North"',
        role: "OUTGOING",
        originalName: "reply,final.txt",
        size: 8,
        checksum: 'sha"quoted',
      },
    ]);

    expect(plan.manifestCsv).toContain(
      '001,"EMP,001","ACME, ""North""",Outgoing,001-ACME-North-Outgoing.txt,"reply,final.txt",8,"sha""quoted"'
    );
  });

  it("marks formula-like manifest cells with a visible reversible text marker", () => {
    const values = {
      sourceConfirmationCode: "=2+2",
      counterparty: " \t+Acme",
      originalName: "@mail.msg",
      entryName: " \t-entry.msg",
    };
    const csv = buildConfirmationEmpImportManifestCsv([
      {
        internalSequence: 1,
        sourceConfirmationCode: values.sourceConfirmationCode,
        counterparty: values.counterparty,
        role: "OUTGOING",
        originalName: values.originalName,
        size: 1,
        checksum: "sha",
        finalName: values.entryName,
        zipPath: values.entryName,
      },
    ]);
    const row = assertPresentValue(parseCsv(csv)[1]);
    const textMarker = "[TEXT]";

    expect(row[1]).toBe(`${textMarker}${values.sourceConfirmationCode}`);
    expect(row[2]).toBe(`${textMarker}${values.counterparty}`);
    expect(row[4]).toBe(`${textMarker}${values.entryName}`);
    expect(row[5]).toBe(`${textMarker}${values.originalName}`);
    expect(
      decodeConfirmationEmpImportManifestCell(assertPresentValue(row[1]))
    ).toBe(values.sourceConfirmationCode);
    expect(
      decodeConfirmationEmpImportManifestCell(assertPresentValue(row[2]))
    ).toBe(values.counterparty);
    expect(
      decodeConfirmationEmpImportManifestCell(assertPresentValue(row[4]))
    ).toBe(values.entryName);
    expect(
      decodeConfirmationEmpImportManifestCell(assertPresentValue(row[5]))
    ).toBe(values.originalName);
    expect(row.slice(1, 6).some((value) => /^[=+\-@]/.test(value))).toBeFalsy();
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
