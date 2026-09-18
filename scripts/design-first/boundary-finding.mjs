import { createHash } from "node:crypto";

import { normalizePath } from "./boundary-path-policy.mjs";

export function createFindingFingerprint(finding) {
  const file = normalizePath(finding.file);
  const evidence = String(finding.snippet ?? "")
    .trim()
    .replaceAll(/\s+/g, " ");
  return createHash("sha256")
    .update(`${file}\u0000${finding.rule}\u0000${evidence}`)
    .digest("hex");
}

export function createFinding({ file, rule, lineNumber, line }) {
  const evidence = line.trim().replaceAll(/\s+/g, " ");
  return {
    file: normalizePath(file),
    fingerprint: createFindingFingerprint({ file, rule, snippet: evidence }),
    rule,
    line: lineNumber,
    snippet: evidence.slice(0, 140),
  };
}

export function lineNumberAt(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

export function lineAt(source, index) {
  const start = source.lastIndexOf("\n", index) + 1;
  const end = source.indexOf("\n", index);
  return source.slice(start, end === -1 ? undefined : end);
}
