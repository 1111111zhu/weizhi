import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import ts from "typescript";

import { collectExports } from "./provenance-ast.mjs";
import { literalText, repoPath, sourceFile } from "./provenance-utils.mjs";

function resolveCandidate(file) {
  const candidates = [
    file,
    ...[".ts", ".tsx", ".js", ".jsx", ".css"].map(
      (extension) => `${file}${extension}`
    ),
  ];
  for (const candidate of candidates)
    if (existsSync(candidate)) return candidate;
  for (const extension of [".ts", ".tsx", ".js", ".jsx"]) {
    const index = resolve(file, `index${extension}`);
    if (existsSync(index)) return index;
  }
  return null;
}
function publicEntryFile(rootDir, root) {
  if (!root.publicImport || !root.publicEntry) return null;
  const entry = root.publicEntry.startsWith(root.path)
    ? resolve(rootDir, root.publicEntry)
    : resolve(rootDir, root.path, root.publicEntry);
  return resolveCandidate(entry);
}
function namedMappings(statement) {
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause))
    return [];
  return statement.exportClause.elements.map((element) => ({
    imported: element.propertyName?.text ?? element.name.text,
    exported: element.name.text,
  }));
}
function collectPublicFile({ file, rootDir, root, map, seen }) {
  if (!file || seen.has(file)) return;
  seen.add(file);
  const parsed = sourceFile(file, readFileSync(file, "utf8"));
  const exports = collectExports(parsed);
  for (const name of exports.names)
    map.set(`${root.publicImport}\0${name}`, {
      file: repoPath(rootDir, file),
      name,
    });
  for (const statement of parsed.statements.filter((node) =>
    ts.isExportDeclaration(node)
  )) {
    const target = literalText(statement.moduleSpecifier);
    if (!target) continue;
    const resolved = resolveCandidate(resolve(dirname(file), target));
    if (!resolved) continue;
    const mappings = namedMappings(statement);
    if (mappings.length) {
      for (const mapping of mappings)
        map.set(`${root.publicImport}\0${mapping.exported}`, {
          file: repoPath(rootDir, resolved),
          name: mapping.imported,
        });
      continue;
    }
    for (const name of collectExports(
      sourceFile(resolved, readFileSync(resolved, "utf8"))
    ).names)
      map.set(`${root.publicImport}\0${name}`, {
        file: repoPath(rootDir, resolved),
        name,
      });
    collectPublicFile({ file: resolved, rootDir, root, map, seen });
  }
}
export function buildPublicMap(rootDir, roots) {
  const map = new Map();
  for (const root of roots) {
    const entry = publicEntryFile(rootDir, root);
    if (entry) {
      map.set(`${root.publicImport}\0*`, {
        file: repoPath(rootDir, entry),
        name: "*",
      });
      collectPublicFile({
        file: entry,
        rootDir,
        root,
        map,
        seen: new Set(),
      });
    }
  }
  return map;
}
