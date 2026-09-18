#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const GENERATED_PREFIXES = ["Merge ", 'Revert "'];
const TRAILER_PATTERN = /^Co-authored-by: ([^<>\r\n]+) <([^<>\s]+@[^<>\s]+)>$/i;

function parseGitTrailers(contents) {
  const result = spawnSync("git", ["interpret-trailers", "--parse"], {
    encoding: "utf-8",
    input: contents,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "Unable to parse Git trailers.");
  }
  return result.stdout.split("\n").filter(Boolean);
}

export function commitMessageViolations(contents) {
  const header = contents.replaceAll("\r\n", "\n").split("\n")[0]?.trim() ?? "";
  const violations = [];

  if (!header) {
    return ["Commit message header is empty."];
  }
  if (!GENERATED_PREFIXES.some((prefix) => header.startsWith(prefix))) {
    const normalizedHeader = header.replace(/^(?:fixup|squash)! /, "");
    const [, summary] = normalizedHeader.split(": ", 2);
    if (summary && /[.!?。！？]$/.test(summary)) {
      violations.push("Commit summary must not end with punctuation.");
    }
    if (summary && /(?![A-Za-z])\p{Letter}/u.test(summary)) {
      violations.push("Commit summary must use English letters.");
    }
  }

  const trailers = parseGitTrailers(contents).filter((line) =>
    /^Co-authored-by:/i.test(line)
  );
  const normalizedTrailers = new Set();
  for (const trailer of trailers) {
    const trailerMatch = TRAILER_PATTERN.exec(trailer);
    if (!trailerMatch) {
      violations.push(
        `Invalid Co-authored-by trailer: ${trailer || "<empty>"}.`
      );
      continue;
    }
    const normalized = `${trailerMatch[1].trim().toLowerCase()} <${trailerMatch[2].toLowerCase()}>`;
    if (normalizedTrailers.has(normalized)) {
      violations.push(`Duplicate Co-authored-by trailer: ${trailer}.`);
    }
    normalizedTrailers.add(normalized);
  }

  return violations;
}

function main() {
  const messageFile = process.argv.at(2);
  if (!messageFile) {
    console.error("commit-message: missing commit message file argument");
    process.exitCode = 1;
    return;
  }

  const violations = commitMessageViolations(
    readFileSync(messageFile, "utf-8")
  );
  if (violations.length === 0) {
    return;
  }

  console.error("commit-message: commit blocked\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === import.meta.filename) {
  main();
}
