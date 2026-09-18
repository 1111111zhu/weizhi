import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import JSZip from "jszip";

import { StorageService } from "../storage/storage.service";
import { buildConfirmationEmpImportZipPlan } from "./confirmation-emp-import-packaging";
import type { ConfirmationEmpImportSourceFile } from "./confirmation-emp-import-packaging";

export type ConfirmationEmpImportArchiveSource =
  ConfirmationEmpImportSourceFile & {
    objectKey: string;
  };

export type ConfirmationEmpImportArchiveResult = {
  buffer: Buffer;
  sha256: string;
  byteLength: number;
  entries: string[];
  manifestCsv: string;
};

const ZIP_ENTRY_DATE = new Date(0);

@Injectable()
export class ConfirmationEmpImportArchiveService {
  constructor(private readonly storage: StorageService) {}

  async createArchive(
    sources: readonly ConfirmationEmpImportArchiveSource[]
  ): Promise<ConfirmationEmpImportArchiveResult> {
    const orderedSources = [...sources].sort(compareArchiveSources);
    const plan = buildConfirmationEmpImportZipPlan(
      orderedSources.map(({ objectKey: _objectKey, ...file }) => file)
    );
    const objectBuffers: Buffer[] = [];

    for (const source of orderedSources) {
      const buffer = await this.storage.getObjectBuffer(source.objectKey);
      if (!Buffer.isBuffer(buffer)) {
        throw new TypeError("Confirmation EMP archive source is unavailable");
      }
      const actualChecksum = createHash("sha256").update(buffer).digest("hex");
      if (buffer.byteLength !== source.size) {
        throw new Error("Confirmation EMP archive source size mismatch");
      }
      if (actualChecksum !== source.checksum.trim().toLowerCase()) {
        throw new Error("Confirmation EMP archive source checksum mismatch");
      }
      objectBuffers.push(buffer);
    }

    const zip = new JSZip();
    for (const [index, file] of plan.files.entries()) {
      zip.file(file.zipPath, assertPresentValue(objectBuffers[index]), {
        binary: true,
        createFolders: false,
        date: ZIP_ENTRY_DATE,
      });
    }
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return {
      buffer,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      byteLength: buffer.byteLength,
      entries: plan.files.map((file) => file.zipPath),
      manifestCsv: plan.manifestCsv,
    };
  }
}

function compareArchiveSources(
  left: ConfirmationEmpImportArchiveSource,
  right: ConfirmationEmpImportArchiveSource
) {
  return (
    compareNumbers(left.internalSequence, right.internalSequence) ||
    compareText(left.sourceConfirmationCode, right.sourceConfirmationCode) ||
    compareText(left.counterparty, right.counterparty) ||
    compareNumbers(roleRank(left.role), roleRank(right.role)) ||
    compareNumbers(left.responseSequence ?? 0, right.responseSequence ?? 0) ||
    compareText(left.originalName, right.originalName) ||
    compareText(left.objectKey, right.objectKey) ||
    compareNumbers(left.size, right.size) ||
    compareText(left.checksum, right.checksum)
  );
}

function roleRank(role: ConfirmationEmpImportSourceFile["role"]) {
  return role === "OUTGOING" ? 0 : 1;
}

function compareNumbers(left: number, right: number) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
