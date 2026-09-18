#!/usr/bin/env node

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

class ArgumentError extends Error {
  name = "ArgumentError";
}

export function archiveSizes(archive) {
  if (!archive) {
    return null;
  }
  const bytes = readFileSync(archive);
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = bytes.lastIndexOf(signature);
  if (endOffset === -1 || endOffset + 22 > bytes.length) {
    throw new Error(`Invalid ZIP archive: ${archive}`);
  }
  const centralDirectorySize = bytes.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = bytes.readUInt32LE(endOffset + 16);
  const end = centralDirectoryOffset + centralDirectorySize;
  if (end > bytes.length) {
    throw new Error(`Invalid ZIP archive: ${archive}`);
  }

  const sizes = new Map();
  let offset = centralDirectoryOffset;
  while (offset < end) {
    if (bytes.readUInt32LE(offset) !== 0x02_01_4b_50) {
      throw new Error(`Invalid ZIP central directory: ${archive}`);
    }
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = bytes
      .subarray(nameStart, nameStart + nameLength)
      .toString("utf-8");
    if (!name.endsWith("/")) {
      sizes.set(name.replaceAll("\\", "/"), compressedSize);
    }
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return Object.fromEntries(sizes);
}

export function buildReport(root, archive) {
  const compressed = archiveSizes(archive);
  const groups = new Map();
  const files = [];
  for (const filePath of listFiles(root)) {
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    const { size } = statSync(filePath);
    const compressedSize =
      compressed === null ? null : (compressed[relative] ?? 0);
    const [group] = relative.split("/", 1);
    const summary = groups.get(group) ?? {
      bytes: 0,
      compressedBytes: 0,
      files: 0,
    };
    summary.bytes += size;
    if (compressedSize !== null) {
      summary.compressedBytes += compressedSize;
    }
    summary.files += 1;
    groups.set(group, summary);
    files.push({
      path: relative,
      bytes: size,
      compressedBytes: compressedSize,
    });
  }
  const groupReport = Object.fromEntries(
    [...groups].sort(([left], [right]) => compareStrings(left, right))
  );
  if (compressed === null) {
    for (const group of Object.values(groupReport)) {
      group.compressedBytes = null;
    }
  }
  return {
    root: String(root),
    archive: archive ? String(archive) : null,
    bytes: files.reduce((total, item) => total + item.bytes, 0),
    compressedBytes:
      compressed === null
        ? null
        : files.reduce((total, item) => total + item.compressedBytes, 0),
    groups: groupReport,
    files: files.sort((left, right) => right.bytes - left.bytes),
  };
}

export function printSummary(report) {
  console.log(
    JSON.stringify(
      {
        bytes: report.bytes,
        compressedBytes: report.compressedBytes,
        groups: report.groups,
      },
      null,
      2
    )
  );
  console.log("Largest payload files:");
  for (const item of report.files.slice(0, 30)) {
    const compressedText =
      item.compressedBytes === null
        ? "           -"
        : String(item.compressedBytes).padStart(12);
    console.log(
      `  ${String(item.bytes).padStart(12)}  ${compressedText}  ${item.path}`
    );
  }
}

export function parseArgs(argumentsList) {
  const args = { root: undefined, archive: undefined, report: undefined };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    if (!["--root", "--archive", "--report"].includes(option)) {
      throw new ArgumentError(`Unknown argument: ${option}`);
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ArgumentError(`Argument requires a value: ${option}`);
    }
    index += 1;
    args[option.slice(2)] = value;
  }
  if (!args.root || !args.report) {
    throw new ArgumentError("--root and --report are required");
  }
  return args;
}

export function main(argumentsList = process.argv.slice(2)) {
  const args = parseArgs(argumentsList);
  const report = buildReport(args.root, args.archive);
  mkdirSync(path.dirname(args.report), { recursive: true });
  writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  printSummary(report);
  return report;
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    compareNames
  )) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(filePath));
    } else if (statSync(filePath).isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function compareNames(left, right) {
  return compareStrings(left.name, right.name);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

if (process.argv[1] === import.meta.filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = error instanceof ArgumentError ? 2 : 1;
  }
}
