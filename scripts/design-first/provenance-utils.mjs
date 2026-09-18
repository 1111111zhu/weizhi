import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";

import ts from "typescript";
export const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".json",
  ".mdx",
]);
export const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
export function posix(value) {
  return String(value).replaceAll("\\", "/").replace(/^\.\//, "");
}
export function repoPath(rootDir, file) {
  return posix(relative(rootDir, file)) || ".";
}
export function sortStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) =>
    a.localeCompare(b)
  );
}
export function sortBy(values, key) {
  return [...values].sort((a, b) =>
    String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? ""))
  );
}
function stableArray(values) {
  const key = values.every((item) => item && typeof item === "object")
    ? ["name", "id", "file", "package", "source", "value"].find((field) =>
        values.every((item) => field in item)
      )
    : null;
  return values.sort((a, b) => {
    const primary = key ? String(a[key]).localeCompare(String(b[key])) : 0;
    return primary || JSON.stringify(a).localeCompare(JSON.stringify(b));
  });
}
export function deepSort(value) {
  if (Array.isArray(value)) return stableArray(value.map(deepSort));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, deepSort(item)])
  );
}
export function readJson(file, label) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${label} at ${file}: ${error.message}`);
  }
}
function strings(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`${field} must be an array of strings`);
  return sortStrings(value);
}
function rootEntry(entry, field) {
  if (typeof entry === "string") return { path: posix(entry) };
  if (!entry || typeof entry !== "object" || typeof entry.path !== "string")
    throw new Error(`${field} entries must contain a path`);
  return Object.fromEntries(
    Object.entries({
      path: posix(entry.path),
      scope: entry.scope,
      kind: entry.kind,
      publicImport: entry.publicImport,
      publicEntry: entry.publicEntry,
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, key === "path" ? value : String(value)])
  );
}
export function normalizeConfig(input) {
  if (!input || typeof input !== "object")
    throw new Error("Provenance config must be an object");
  if (
    input.implementationRoots !== undefined &&
    !Array.isArray(input.implementationRoots)
  )
    throw new Error("implementationRoots must be an array");
  return {
    schemaVersion: input.schemaVersion ?? 1,
    implementationRoots: (input.implementationRoots ?? []).map((entry) =>
      rootEntry(entry, "implementationRoots")
    ),
    consumerRoots: strings(input.consumerRoots, "consumerRoots"),
    tokenRoots: strings(input.tokenRoots, "tokenRoots"),
    manifestPaths: strings(input.manifestPaths, "manifestPaths"),
    excludeGlobs: strings(input.excludeGlobs, "excludeGlobs"),
    outputPath: input.outputPath ? posix(input.outputPath) : undefined,
  };
}
export function loadConfig(
  rootDir,
  configPath = "design-first.provenance.json"
) {
  const file = resolve(rootDir, configPath);
  if (!existsSync(file))
    throw new Error(`Provenance config not found: ${file}`);
  return normalizeConfig(readJson(file, "provenance config"));
}
function globRegex(pattern) {
  let out = "";
  const text = posix(pattern).replace(/^\.\//, "");
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "*" && text[i + 1] === "*") {
      out += text[i + 2] === "/" ? "(?:.*/)?" : ".*";
      if (text[i + 2] === "/") i += 2;
    } else if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}
export function makeExcluder(patterns = []) {
  const regexes = patterns.map(globRegex);
  return (file) => regexes.some((regex) => regex.test(posix(file)));
}
export function walkFiles(rootDir, rootPath, exclude) {
  const absolute = resolve(rootDir, rootPath);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) {
    const relativeFile = repoPath(rootDir, absolute);
    const supported = SOURCE_EXTENSIONS.has(extname(absolute).toLowerCase());
    return supported && !exclude(relativeFile) ? [absolute] : [];
  }
  const result = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const file = resolve(directory, entry.name);
      const relativeFile = repoPath(rootDir, file);
      if (exclude(relativeFile)) continue;
      if (entry.isDirectory()) visit(file);
      else if (SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
        result.push(file);
    }
  }
  visit(absolute);
  return result;
}
export function pathInside(file, root) {
  const child = relative(root, file);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}
export function chooseRoot(file, roots, rootDir) {
  return (
    roots
      .map((entry) => ({ entry, absolute: resolve(rootDir, entry.path) }))
      .filter(({ absolute }) => pathInside(file, absolute))
      .sort(
        (a, b) =>
          b.absolute.length - a.absolute.length ||
          a.entry.path.localeCompare(b.entry.path)
      )[0] ?? null
  );
}
export function sourceFile(file, source) {
  const extension = extname(file).toLowerCase();
  const kind =
    extension === ".tsx" || extension === ".jsx"
      ? ts.ScriptKind.TSX
      : extension === ".js"
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}
export function lineOf(sourceFile, position) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}
export function staticName(name) {
  if (!name) return null;
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : null;
}
export function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
    return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
  return null;
}
export function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name ?? "");
}
