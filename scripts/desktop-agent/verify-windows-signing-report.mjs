#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

class ArgumentError extends Error {
  name = "ArgumentError";
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function verifyWindowsSigningReport(installer, reportPath) {
  requireCondition(isFile(installer), "Signed Windows installer is missing.");
  requireCondition(
    isFile(reportPath),
    "Windows installer signing report is missing."
  );
  const report = JSON.parse(
    readFileSync(reportPath, "utf-8").replace(/^\uFEFF/, "")
  );
  const { files } = report;
  requireCondition(
    Array.isArray(files) && files.length === 1,
    "Signing report must contain exactly one installer."
  );
  const [signedFile] = files;
  requireCondition(
    signedFile.fileName === basename(installer),
    "Signing report installer name does not match."
  );
  requireCondition(
    signedFile.sha256 === sha256File(installer),
    "Signing report SHA-256 does not match the installer."
  );
  requireCondition(
    signedFile.status === "Valid",
    "Installer signature status is not valid."
  );
  requireCondition(
    signedFile.timestamped === true,
    "Installer signature is not timestamped."
  );
  requireCondition(
    report.timestampRequired === true,
    "Signing report did not require a timestamp."
  );
  requireCondition(
    Boolean(report.certificateThumbprint),
    "Signing report publisher thumbprint is missing."
  );
  requireCondition(
    Boolean(report.expectedSubject),
    "Signing report expected publisher is missing."
  );
  requireCondition(
    signedFile.signerSubject === report.expectedSubject,
    "Signing report publisher subject does not match."
  );
  requireCondition(
    signedFile.signerThumbprint === report.certificateThumbprint,
    "Signing report publisher thumbprint does not match."
  );
  return {
    ok: true,
    fileName: basename(installer),
    sha256: signedFile.sha256,
    signerThumbprint: signedFile.signerThumbprint,
  };
}

export function parseArgs(argumentsList) {
  const args = { installer: undefined, report: undefined };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    if (!["--installer", "--report"].includes(option)) {
      throw new ArgumentError(`Unknown argument: ${option}`);
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ArgumentError(`Argument requires a value: ${option}`);
    }
    index += 1;
    args[option.slice(2)] = value;
  }
  if (!args.installer || !args.report) {
    throw new ArgumentError("--installer and --report are required");
  }
  return args;
}

export function main(argumentsList = process.argv.slice(2)) {
  const args = parseArgs(argumentsList);
  const result = verifyWindowsSigningReport(args.installer, args.report);
  console.log(JSON.stringify(result));
  return result;
}

function basename(filePath) {
  return filePath.replaceAll("\\", "/").split("/").pop();
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
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
