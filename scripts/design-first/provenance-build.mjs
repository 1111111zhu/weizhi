import { readFileSync } from "node:fs";

import {
  collectClassTokens,
  collectExports,
  collectImports,
  collectVariants,
} from "./provenance-ast.mjs";
import { makeImportInfo } from "./provenance-import.mjs";
import { collectStyles } from "./provenance-style.mjs";
import { repoPath, sortStrings, sourceFile } from "./provenance-utils.mjs";
function isUnresolvedWorkspaceImport(item) {
  if (!item.workspace || item.resolved) return false;
  return (
    item.specifiers.length === 0 ||
    Object.values(item.symbols).some((symbol) => !symbol.file)
  );
}
export function makeFileRecord({
  file,
  rootDir,
  metadata,
  manifests,
  roots,
  publicMap,
}) {
  const source = readFileSync(file, "utf8");
  const parsed = sourceFile(file, source);
  const exports = collectExports(parsed);
  const imports = collectImports(parsed).map((item) =>
    makeImportInfo({ item, file, rootDir, roots, manifests, publicMap })
  );
  const unresolvedImports = imports
    .filter(isUnresolvedWorkspaceImport)
    .map((item) => ({
      file: repoPath(rootDir, file),
      source: item.source,
      line: item.line,
      kind: item.kind,
    }));
  return {
    file: repoPath(rootDir, file),
    scope: metadata?.entry.scope ?? null,
    kind: metadata?.entry.kind ?? null,
    publicImport: metadata?.entry.publicImport ?? null,
    publicExports: [],
    exports: exports.names,
    implementationExports: exports.componentNames,
    reexports: exports.reexports,
    imports,
    variants: collectVariants(parsed),
    classNameTokens: collectClassTokens(parsed),
    unresolvedImports,
    styles: collectStyles(repoPath(rootDir, file), source),
  };
}
function librariesFor(file) {
  const groups = new Map();
  for (const item of file.imports)
    if (item.package) {
      const group = groups.get(item.package) ?? {
        package: item.package,
        versions: [],
        sources: [],
      };
      group.versions.push(...item.versions);
      group.sources.push(item.source);
      groups.set(item.package, group);
    }
  return [...groups.values()]
    .map((group) => ({
      package: group.package,
      versions: sortStrings(group.versions),
      sources: sortStrings(group.sources),
    }))
    .sort((a, b) => a.package.localeCompare(b.package));
}
function familyName(file) {
  const base = file
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "");
  return base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

export function makeImplementations(files, consumerRecords, publicMap) {
  return files.flatMap((file) =>
    file.implementationExports.map((name) => {
      const id = `${file.file}#${name}`;
      const publicKey = file.publicImport
        ? publicMap.get(`${file.publicImport}\0${name}`)
        : null;
      const consumers = consumerRecords
        .filter(
          (item) =>
            item.publicImport === file.publicImport &&
            consumerTargets(item, file.file, name)
        )
        .map((item) => item.file);
      return {
        id,
        name,
        file: file.file,
        scope: file.scope,
        kind: file.kind,
        publicImport: file.publicImport,
        family: familyName(file.file),
        exports: [name],
        variants: file.variants,
        classNameTokens: file.classNameTokens,
        imports: sortStrings(file.imports.map((item) => item.source)),
        libraries: librariesFor(file),
        consumers: sortStrings(consumers),
        public: Boolean(publicKey),
        lifecycle: "unreviewed",
        disposition: "unreviewed",
      };
    })
  );
}
function consumerTargets(item, file, name) {
  if (item.broad) {
    return item.publicImport ? true : item.resolved === file;
  }
  return Object.values(item.symbols).some(
    (target) => target.file === file && target.name === name
  );
}
