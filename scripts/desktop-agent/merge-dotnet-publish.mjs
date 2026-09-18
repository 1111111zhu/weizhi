#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const excludedSuffixes = new Set([
  ".dbg",
  ".exp",
  ".ilk",
  ".iobj",
  ".ipdb",
  ".lib",
  ".obj",
  ".pdb",
]);
const excludedDirectories = new Set([".dSYM"]);

class ArgumentError extends Error {
  name = "ArgumentError";
}

export function digest(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function publishFiles(source) {
  return listFiles(source).filter((filePath) => {
    const relativeParts = filePath.split(path.sep);
    return (
      !excludedSuffixes.has(path.extname(filePath).toLowerCase()) &&
      !relativeParts.some((part) => excludedDirectories.has(part))
    );
  });
}

export function mergeFile(source, destination, preferFirst) {
  if (existsSync(destination)) {
    if (statSync(source).size !== statSync(destination).size) {
      if (preferFirst.has(path.basename(destination))) {
        return "preferred";
      }
      throw new Error(
        `Conflicting publish file: ${path.basename(destination)}`
      );
    }
    if (digest(source) !== digest(destination)) {
      if (preferFirst.has(path.basename(destination))) {
        return "preferred";
      }
      throw new Error(
        `Conflicting publish file: ${path.basename(destination)}`
      );
    }
    return "duplicate";
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return "copied";
}

export function mergePublishDirectories(
  destination,
  sources,
  preferFirst = new Set()
) {
  const report = {
    copiedBytes: 0,
    copiedFiles: 0,
    deduplicatedBytes: 0,
    preferredConflicts: [],
  };
  for (const source of sources) {
    if (!isDirectory(source)) {
      throw new Error(`Publish directory is missing: ${source}`);
    }
    for (const filePath of publishFiles(source)) {
      const target = path.join(destination, path.relative(source, filePath));
      const result = mergeFile(filePath, target, preferFirst);
      if (result === "copied") {
        report.copiedBytes += statSync(filePath).size;
        report.copiedFiles += 1;
      } else if (result === "duplicate") {
        report.deduplicatedBytes += statSync(filePath).size;
      } else {
        report.preferredConflicts.push(path.basename(target));
      }
    }
  }
  report.preferredConflicts = [...new Set(report.preferredConflicts)].sort();
  return report;
}

export function requireFiles(destination, required) {
  const missing = required.filter(
    (name) => !isFile(path.join(destination, name))
  );
  if (missing.length > 0) {
    throw new Error(`Required merged files are missing: ${missing.join(", ")}`);
  }
}

export function parseArgs(argumentsList) {
  const args = {
    destination: undefined,
    source: [],
    required: [],
    preferFirst: [],
    report: undefined,
  };
  const options = new Map([
    ["--destination", "destination"],
    ["--source", "source"],
    ["--required", "required"],
    ["--prefer-first", "preferFirst"],
    ["--report", "report"],
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const key = options.get(argumentsList[index]);
    if (!key) {
      throw new ArgumentError(`Unknown argument: ${argumentsList[index]}`);
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ArgumentError(
        `Argument requires a value: ${argumentsList[index]}`
      );
    }
    index += 1;
    if (key === "source" || key === "required" || key === "preferFirst") {
      args[key].push(value);
    } else {
      args[key] = value;
    }
  }
  if (!args.destination || args.source.length === 0) {
    throw new ArgumentError(
      "--destination and at least one --source are required"
    );
  }
  return args;
}

export function main(argumentsList = process.argv.slice(2)) {
  const args = parseArgs(argumentsList);
  mkdirSync(args.destination, { recursive: true });
  const report = mergePublishDirectories(
    args.destination,
    args.source,
    new Set(args.preferFirst)
  );
  requireFiles(args.destination, args.required);
  const output = {
    ...report,
    destination: args.destination,
    sources: args.source,
  };
  const serialized = JSON.stringify(output, null, 2);
  console.log(serialized);
  if (args.report) {
    mkdirSync(path.dirname(args.report), { recursive: true });
    writeFileSync(args.report, `${serialized}\n`, "utf-8");
  }
  return output;
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    compareNames
  )) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(filePath));
    } else if (isFile(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function compareNames(left, right) {
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

if (process.argv[1] === import.meta.filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = error instanceof ArgumentError ? 2 : 1;
  }
}
