import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { pathInside, repoPath, sortStrings } from "./provenance-utils.mjs";

function resolveCandidate(file) {
  const candidates = [
    file,
    ...[".ts", ".tsx", ".js", ".jsx", ".css"].map(
      (extension) => `${file}${extension}`
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of [".ts", ".tsx", ".js", ".jsx"]) {
    const index = resolve(file, `index${extension}`);
    if (existsSync(index)) return index;
  }
  return null;
}

function packageName(source) {
  return source.startsWith("@")
    ? source.split("/").slice(0, 2).join("/")
    : source.split("/")[0];
}

function moduleSpecifierPath(source) {
  return source.replace(/[?#].*$/, "");
}

function addManifestVersions(target, manifest) {
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    for (const [name, version] of Object.entries(manifest[field] ?? {})) {
      const values = target.get(name) ?? new Set();
      values.add(String(version));
      target.set(name, values);
    }
  }
}

export function loadManifests(rootDir, paths = []) {
  const versions = new Map();
  const entries = [];
  for (const manifest of paths) {
    const file = resolve(rootDir, manifest);
    if (!existsSync(file)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(
        `Cannot read package manifest at ${file}: ${error.message}`
      );
    }
    const localVersions = new Map();
    addManifestVersions(versions, data);
    addManifestVersions(localVersions, data);
    entries.push({ directory: dirname(file), versions: localVersions });
  }
  return { versions, entries };
}

function dependencyVersions(manifests, dependency, file) {
  const entry = manifests.entries
    .filter((item) => pathInside(file, item.directory))
    .sort((a, b) => b.directory.length - a.directory.length)
    .find((item) => item.versions.has(dependency));
  return entry?.versions.get(dependency) ?? manifests.versions.get(dependency);
}

function importIsPublic(source, roots) {
  const sourcePath = moduleSpecifierPath(source);
  return (
    roots
      .filter(
        (entry) =>
          entry.publicImport &&
          (sourcePath === entry.publicImport ||
            sourcePath.startsWith(`${entry.publicImport}/`))
      )
      .sort((a, b) => b.publicImport.length - a.publicImport.length)[0] ?? null
  );
}

function aliasCandidates(source, file) {
  if (!source.startsWith("@/")) return [];
  const match = file.match(/^(.*[/\\]apps[/\\][^/\\]+)(?:[/\\]src)?[/\\]/i);
  if (!match) return [];
  const appRoot = match[1];
  return [
    resolve(appRoot, "src", source.slice(2)),
    resolve(appRoot, source.slice(2)),
  ];
}

export function resolveImport({ source, file, roots, publicMap = new Map() }) {
  const publicRoot = importIsPublic(source, roots);
  const sourcePath = moduleSpecifierPath(source);
  if (publicRoot) return publicMap.get(`${sourcePath}\0*`)?.file ?? null;
  const candidates = sourcePath.startsWith(".")
    ? [resolve(dirname(file), sourcePath)]
    : aliasCandidates(sourcePath, file);
  for (const candidate of candidates) {
    const resolved = resolveCandidate(candidate);
    if (resolved) return resolved;
  }
  return null;
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

function importSymbols({
  item,
  publicRoot,
  localResolved,
  rootDir,
  publicMap,
}) {
  const resolvedFile = localResolved
    ? publicRoot
      ? localResolved
      : repoPath(rootDir, localResolved)
    : null;
  return Object.fromEntries(
    item.specifiers.map((specifier) => {
      const { imported, local } = specifierParts(specifier);
      const publicTarget = publicRoot
        ? publicMap.get(`${publicRoot.publicImport}\0${imported}`)
        : null;
      return [
        local,
        {
          file: publicTarget?.file ?? resolvedFile,
          name: publicTarget?.name ?? imported,
        },
      ];
    })
  );
}

function localTargetPath({ localResolved, publicRoot, rootDir }) {
  if (!localResolved) return null;
  return publicRoot ? localResolved : repoPath(rootDir, localResolved);
}

function importedDependencyVersions({ dependency, manifests, file }) {
  if (!dependency) return [];
  return sortStrings([
    ...(dependencyVersions(manifests, dependency, file) ?? []),
  ]);
}

export function makeImportInfo({
  item,
  file,
  rootDir,
  roots,
  manifests,
  publicMap,
}) {
  const publicRoot = importIsPublic(item.source, roots);
  const localResolved = resolveImport({
    source: item.source,
    file,
    roots,
    publicMap,
  });
  const symbols = importSymbols({
    item,
    publicRoot,
    localResolved,
    rootDir,
    publicMap,
  });
  const targetFiles = sortStrings(
    Object.values(symbols).map((symbol) => symbol.file)
  );
  const resolvedTarget = localTargetPath({
    localResolved,
    publicRoot,
    rootDir,
  });
  const workspace =
    item.source.startsWith(".") ||
    item.source.startsWith("@/") ||
    Boolean(publicRoot);
  const dependency = workspace ? null : packageName(item.source);
  return {
    ...item,
    resolved:
      targetFiles.length === 1
        ? targetFiles[0]
        : item.specifiers.length === 0
          ? resolvedTarget
          : null,
    symbols,
    workspace,
    publicImport: publicRoot?.publicImport ?? null,
    package: dependency,
    versions: importedDependencyVersions({ dependency, manifests, file }),
  };
}
