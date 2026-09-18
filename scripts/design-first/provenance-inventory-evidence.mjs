import { extname, resolve } from "node:path";

import {
  aggregateDependencies,
  aggregateFamilies,
  aggregateTokens,
} from "./provenance-aggregate.mjs";
import { makeFileRecord, makeImplementations } from "./provenance-build.mjs";
import { loadManifests } from "./provenance-import.mjs";
import { buildPublicMap } from "./provenance-public.mjs";
import { makeTokenRecord } from "./provenance-token.mjs";
import {
  CODE_EXTENSIONS,
  makeExcluder,
  pathInside,
  sortBy,
  sortStrings,
  walkFiles,
} from "./provenance-utils.mjs";

function scanPaths(rootDir, config) {
  const exclude = makeExcluder(config.excludeGlobs);
  const roots = [
    ...config.implementationRoots,
    ...config.consumerRoots.map((path) => ({ path })),
  ];
  const files = sortStrings(
    roots.flatMap((entry) => walkFiles(rootDir, entry.path, exclude))
  );
  const tokenFiles = sortStrings([
    ...files,
    ...config.tokenRoots.flatMap((path) => walkFiles(rootDir, path, exclude)),
  ]);
  return { roots, files, tokenFiles };
}

function isImplementation(file, rootDir, roots) {
  return (
    file.scope !== null ||
    file.kind !== null ||
    roots.some((entry) =>
      pathInside(resolve(rootDir, file.file), resolve(rootDir, entry.path))
    )
  );
}

function specifierParts(specifier) {
  if (specifier.startsWith("default:")) {
    return { imported: "default", local: specifier.slice("default:".length) };
  }
  if (specifier.startsWith("*:")) {
    return { imported: "*", local: specifier.slice(2) };
  }
  const [imported, local = imported] = specifier.split(" as ");
  return { imported, local };
}

function consumerRecord(file, item) {
  return {
    file: file.file,
    source: item.source,
    publicImport: item.publicImport,
    resolved: item.resolved,
    line: item.line,
    kind: item.kind,
    specifiers: item.specifiers,
    symbols: item.symbols,
    broad: item.specifiers.some(
      (specifier) => specifierParts(specifier).imported === "*"
    ),
  };
}

function consumerRecords(files) {
  return files.flatMap((file) =>
    file.imports
      .filter((item) => item.workspace)
      .map((item) => consumerRecord(file, item))
  );
}

function missingEvidenceRecords(files) {
  const trackedFiles = new Set(files.map((file) => file.file));
  const records = new Map();
  for (const file of files) {
    for (const item of file.imports.filter((entry) => entry.workspace)) {
      const targets = sortStrings([
        item.resolved,
        ...Object.values(item.symbols).map((symbol) => symbol.file),
      ]);
      if (!targets.some((target) => !trackedFiles.has(target))) continue;
      const record = {
        file: file.file,
        kind: item.kind,
        line: item.line,
        source: item.source,
      };
      records.set(JSON.stringify(record), record);
    }
  }
  return [...records.values()];
}

function makeRecords({
  rootDir,
  paths,
  manifests,
  implementationRoots,
  publicMap,
}) {
  const records = new Map();
  for (const file of paths.files) {
    if (!CODE_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const metadata =
      implementationRoots
        .map((entry) => ({ entry, absolute: resolve(rootDir, entry.path) }))
        .filter(({ absolute }) => pathInside(file, absolute))
        .sort((a, b) => b.absolute.length - a.absolute.length)[0] ?? null;
    records.set(
      file,
      makeFileRecord({
        file,
        rootDir,
        metadata,
        manifests,
        roots: implementationRoots,
        publicMap,
      })
    );
  }
  for (const file of paths.tokenFiles)
    if (!records.has(file)) records.set(file, makeTokenRecord(file, rootDir));
  return [...records.values()].sort((a, b) => a.file.localeCompare(b.file));
}

function publicizeFiles(files, publicMap) {
  return files.map((file) => ({
    ...file,
    publicExports: file.exports.filter(
      (name) =>
        file.publicImport &&
        publicMap.get(`${file.publicImport}\0${name}`)?.file === file.file
    ),
  }));
}

export function buildEvidence(rootDir, config) {
  const paths = scanPaths(rootDir, config);
  const manifests = loadManifests(rootDir, config.manifestPaths);
  const publicMap = buildPublicMap(rootDir, config.implementationRoots);
  const files = publicizeFiles(
    makeRecords({
      rootDir,
      paths,
      manifests,
      implementationRoots: config.implementationRoots,
      publicMap,
    }),
    publicMap
  );
  const implementationFiles = files.filter((file) =>
    isImplementation(file, rootDir, config.implementationRoots)
  );
  const consumers = sortBy(consumerRecords(files), "file");
  const implementations = sortBy(
    makeImplementations(implementationFiles, consumers, publicMap),
    "id"
  );
  const families = aggregateFamilies(implementations);
  const tokens = aggregateTokens(files);
  const dependencies = aggregateDependencies(files);
  const unresolvedImports = sortBy(
    [
      ...files.flatMap((file) => file.unresolvedImports),
      ...missingEvidenceRecords(files),
    ],
    "file"
  );
  return {
    files,
    implementationFiles,
    implementations,
    families,
    consumers,
    tokens,
    dependencies,
    unresolvedImports,
  };
}
