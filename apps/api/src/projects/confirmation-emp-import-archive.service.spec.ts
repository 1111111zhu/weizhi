import { createHash } from "node:crypto";

import JSZip from "jszip";

import { ConfirmationEmpImportArchiveService } from "./confirmation-emp-import-archive.service";
import type { ConfirmationEmpImportArchiveSource } from "./confirmation-emp-import-archive.service";

const storage = {
  getObjectBuffer: vi.fn(),
};

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

const defaultOutgoingBytes = Buffer.from("outgoing-bytes");

function createService() {
  return new ConfirmationEmpImportArchiveService(storage as never);
}

function source(
  overrides: Partial<ConfirmationEmpImportArchiveSource> = {}
): ConfirmationEmpImportArchiveSource {
  return {
    internalSequence: 1,
    sourceConfirmationCode: "EMP-2026-001",
    counterparty: "Acme / Bank",
    role: "OUTGOING",
    originalName: "outgoing.pdf",
    size: defaultOutgoingBytes.byteLength,
    checksum: sha256(defaultOutgoingBytes),
    objectKey: "objects/outgoing",
    ...overrides,
  };
}

async function readZip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const contents = new Map<string, string>();
  for (const name of names) {
    const file = zip.file(name);
    if (!file) {
      throw new Error(`Missing ZIP entry ${name}`);
    }
    contents.set(name, await file.async("string"));
  }
  return { names, contents };
}

describe(ConfirmationEmpImportArchiveService, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves editable child codes in real ZIP entries and safely deduplicates them", async () => {
    storage.getObjectBuffer.mockResolvedValue(defaultOutgoingBytes);
    const result = await createService().createArchive([
      source({ zipEntryName: "1000.1.01-Bank.pdf" }),
      source({ internalSequence: 2, zipEntryName: "CUSTOM.02-Reply.pdf" }),
      source({ internalSequence: 3, zipEntryName: "CUSTOM.02-Reply.pdf" }),
      source({ internalSequence: 4, zipEntryName: "../1000.1.05-Unsafe.pdf" }),
    ]);
    const zip = await readZip(result.buffer);
    expect(zip.names).toStrictEqual([
      "1000.1.01-Bank.pdf",
      "CUSTOM.02-Reply.pdf",
      "CUSTOM.02-Reply-02.pdf",
      "_1000.1.05-Unsafe.pdf",
    ]);
    expect(zip.names).toStrictEqual(result.entries);
    expect([...zip.contents.values()]).toStrictEqual(
      Array(4).fill(defaultOutgoingBytes.toString())
    );
  });

  it("creates a deterministic flat archive and preserves every manifest field", async () => {
    const outgoingBytes = Buffer.from("outgoing-bytes");
    const responseOneBytes = Buffer.from("response-one-bytes");
    const responseTwoBytes = Buffer.from("response-two-bytes");
    const sources = [
      source({
        role: "RESPONSE_ORIGINAL",
        responseSequence: 2,
        originalName: "reply-two.msg",
        size: responseTwoBytes.byteLength,
        checksum: sha256(responseTwoBytes),
        objectKey: "objects/response-02",
      }),
      source({
        originalName: "outgoing.pdf",
        size: outgoingBytes.byteLength,
        checksum: sha256(outgoingBytes),
        objectKey: "objects/outgoing",
      }),
      source({
        role: "RESPONSE_ORIGINAL",
        responseSequence: 1,
        originalName: "reply-one.msg",
        size: responseOneBytes.byteLength,
        checksum: sha256(responseOneBytes),
        objectKey: "objects/response-01",
      }),
    ];
    const contents = new Map([
      ["objects/outgoing", outgoingBytes],
      ["objects/response-01", responseOneBytes],
      ["objects/response-02", responseTwoBytes],
    ]);
    storage.getObjectBuffer.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      const buffer = contents.get(objectKey);
      if (!buffer) {
        throw new Error(`Missing fixture ${objectKey}`);
      }
      return buffer;
    });

    const first = await createService().createArchive(sources);
    const reversedSources = sources.reduceRight<typeof sources>(
      (reversed, itemSource) => {
        reversed.push(itemSource);
        return reversed;
      },
      []
    );
    const second = await createService().createArchive(reversedSources);
    const zip = await readZip(first.buffer);

    expect(first.buffer).toStrictEqual(second.buffer);
    expect(first.sha256).toBe(
      createHash("sha256").update(first.buffer).digest("hex")
    );
    expect(first.byteLength).toBe(first.buffer.byteLength);
    expect(first.entries).toStrictEqual([
      "001-Acme-Bank-Outgoing.pdf",
      "001-Acme-Bank-Response-01-Original.msg",
      "001-Acme-Bank-Response-02-Original.msg",
    ]);
    expect(zip.names).toStrictEqual(first.entries);
    expect(zip.names.every((name) => !/[\\/]/.test(name))).toBeTruthy();
    expect(zip.contents.has("confirmation-file-manifest.csv")).toBeFalsy();
    expect(first.manifestCsv).toContain(
      "内部序号,源函证代码,对方,角色,最终名,原名,大小,checksum"
    );
    expect(first.manifestCsv).toContain(
      `001,EMP-2026-001,Acme / Bank,Outgoing,001-Acme-Bank-Outgoing.pdf,outgoing.pdf,${outgoingBytes.byteLength},${sha256(outgoingBytes)}`
    );
    expect(first.manifestCsv).toContain(
      `001,EMP-2026-001,Acme / Bank,Response-01-Original,001-Acme-Bank-Response-01-Original.msg,reply-one.msg,${responseOneBytes.byteLength},${sha256(responseOneBytes)}`
    );
    expect(first.manifestCsv).toContain(
      `001,EMP-2026-001,Acme / Bank,Response-02-Original,001-Acme-Bank-Response-02-Original.msg,reply-two.msg,${responseTwoBytes.byteLength},${sha256(responseTwoBytes)}`
    );
  });

  it("suffixes duplicate flat names deterministically", async () => {
    const duplicateA = Buffer.from("a");
    const duplicateB = Buffer.from("b");
    const sources = [
      source({
        originalName: "same.pdf",
        size: duplicateA.byteLength,
        checksum: sha256(duplicateA),
        objectKey: "objects/duplicate-a",
      }),
      source({
        originalName: "same.pdf",
        size: duplicateB.byteLength,
        checksum: sha256(duplicateB),
        objectKey: "objects/duplicate-b",
      }),
    ];
    storage.getObjectBuffer.mockImplementation(async (objectKey: string) => {
      await Promise.resolve();
      return objectKey.endsWith("-a") ? duplicateA : duplicateB;
    });

    const result = await createService().createArchive(sources);

    expect(result.entries).toStrictEqual([
      "001-Acme-Bank-Outgoing.pdf",
      "001-Acme-Bank-Outgoing-02.pdf",
    ]);
    expect(result.manifestCsv).toContain(
      `001,EMP-2026-001,Acme / Bank,Outgoing,001-Acme-Bank-Outgoing.pdf,same.pdf,${duplicateA.byteLength},${sha256(duplicateA)}`
    );
    expect(result.manifestCsv).toContain(
      `001,EMP-2026-001,Acme / Bank,Outgoing,001-Acme-Bank-Outgoing-02.pdf,same.pdf,${duplicateB.byteLength},${sha256(duplicateB)}`
    );
  });

  it("keeps path traversal and illegal source names out of ZIP entry paths", async () => {
    const safeBytes = Buffer.from("safe-bytes");
    const unsafeSource = source({
      counterparty: "../Acme\\North:*?",
      originalName: "../../evil.pdf",
      objectKey: "../../objects/evil",
      size: safeBytes.byteLength,
      checksum: sha256(safeBytes),
    });
    storage.getObjectBuffer.mockResolvedValue(safeBytes);

    const result = await createService().createArchive([unsafeSource]);
    const zip = await readZip(result.buffer);
    const fileEntries = zip.names;

    expect(storage.getObjectBuffer).toHaveBeenCalledWith("../../objects/evil");
    expect(fileEntries).toHaveLength(1);
    expect(fileEntries[0]).not.toMatch(/[\\/]/);
    expect(fileEntries[0]).not.toContain("..");
    expect(fileEntries[0]).not.toMatch(/[<>:"|?*\p{Cc}]/u);
  });

  it("rejects an object size mismatch before generating unknown archive", async () => {
    const generateAsync = vi.spyOn(JSZip.prototype, "generateAsync");
    const body = Buffer.from("actual-size");
    const objectKey = "objects/outgoing";
    storage.getObjectBuffer.mockResolvedValue(body);

    try {
      let error: unknown;
      try {
        await createService().createArchive([
          source({
            objectKey,
            size: body.byteLength + 1,
            checksum: sha256(body),
          }),
        ]);
      } catch (caughtError) {
        error = caughtError;
      }
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/size mismatch/i);
      expect(message).not.toContain(objectKey);
      expect(JSON.stringify({ errorMessage: message })).not.toContain(
        objectKey
      );
      expect(generateAsync).not.toHaveBeenCalled();
    } finally {
      generateAsync.mockRestore();
    }
  });

  it("rejects an object checksum mismatch before generating unknown archive", async () => {
    const generateAsync = vi.spyOn(JSZip.prototype, "generateAsync");
    const body = Buffer.from("actual-checksum");
    const objectKey = "objects/outgoing";

    storage.getObjectBuffer.mockResolvedValue(body);

    try {
      let error: unknown;
      try {
        await createService().createArchive([
          source({
            objectKey,
            size: body.byteLength,
            checksum: sha256(Buffer.from("other")),
          }),
        ]);
      } catch (caughtError) {
        error = caughtError;
      }
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/checksum mismatch/i);
      expect(message).not.toContain(objectKey);
      expect(JSON.stringify({ errorMessage: message })).not.toContain(
        objectKey
      );
      expect(generateAsync).not.toHaveBeenCalled();
    } finally {
      generateAsync.mockRestore();
    }
  });

  it("does not generate a partial archive when an object is missing", async () => {
    const generateAsync = vi.spyOn(JSZip.prototype, "generateAsync");
    storage.getObjectBuffer.mockRejectedValue(new Error("object not found"));

    try {
      await expect(
        createService().createArchive([
          source({ objectKey: "objects/missing" }),
        ])
      ).rejects.toThrow("object not found");
      expect(generateAsync).not.toHaveBeenCalled();
    } finally {
      generateAsync.mockRestore();
    }
  });

  it("does not generate a partial archive when storage returns no object buffer", async () => {
    const generateAsync = vi.spyOn(JSZip.prototype, "generateAsync");
    const objectKey = "objects/outgoing";
    storage.getObjectBuffer.mockResolvedValue(undefined as never);

    try {
      let error: unknown;
      try {
        await createService().createArchive([source({ objectKey })]);
      } catch (caughtError) {
        error = caughtError;
      }
      expect(error).toBeInstanceOf(Error);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/archive source/i);
      expect(message).not.toContain(objectKey);
      expect(JSON.stringify({ errorMessage: message })).not.toContain(
        objectKey
      );
      expect(generateAsync).not.toHaveBeenCalled();
    } finally {
      generateAsync.mockRestore();
    }
  });

  it("propagates storage read failures without returning an artifact", async () => {
    storage.getObjectBuffer.mockRejectedValue(new Error("storage read failed"));

    await expect(createService().createArchive([source()])).rejects.toThrow(
      "storage read failed"
    );
  });
});
