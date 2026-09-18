import { sortBy, sortStrings } from "./provenance-utils.mjs";

function uniqueRecords(values) {
  const records = new Map();
  for (const value of values) records.set(JSON.stringify(value), value);
  return [...records.values()];
}

export function aggregateDependencies(files) {
  const map = new Map();
  for (const file of files)
    for (const item of file.imports)
      if (item.package) {
        const group = map.get(item.package) ?? {
          package: item.package,
          versions: [],
          sources: [],
          files: [],
        };
        group.versions.push(...item.versions);
        group.sources.push(item.source);
        group.files.push(file.file);
        map.set(item.package, group);
      }
  return [...map.values()]
    .map((item) => ({
      package: item.package,
      versions: sortStrings(item.versions),
      sources: sortStrings(item.sources),
      files: sortStrings(item.files),
    }))
    .sort((a, b) => a.package.localeCompare(b.package));
}

export function aggregateTokens(files) {
  const definitions = uniqueRecords(
    files.flatMap((file) => file.styles.definitions)
  );
  const usages = uniqueRecords(files.flatMap((file) => file.styles.usages));
  const rawValues = uniqueRecords(
    files.flatMap((file) => file.styles.rawValues)
  );
  const groups = new Map();
  for (const item of definitions) {
    const values = groups.get(item.name) ?? new Map();
    const paths = values.get(item.value) ?? [];
    paths.push(item.file);
    values.set(item.value, paths);
    groups.set(item.name, values);
  }
  const conflicts = [...groups.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([name, values]) => ({
      name,
      values: [...values.keys()].sort(),
      files: sortStrings([...values.values()].flat()),
      evidence: definitions
        .filter((definition) => definition.name === name)
        .sort(
          (left, right) =>
            left.file.localeCompare(right.file) || left.line - right.line
        ),
    }));
  return {
    definitions: sortBy(definitions, "name"),
    usages: sortBy(usages, "name"),
    conflicts: sortBy(conflicts, "name"),
    rawValues: sortBy(rawValues, "value"),
  };
}

export function aggregateFamilies(implementations) {
  const groups = new Map();
  for (const item of implementations) {
    const family = groups.get(item.family) ?? {
      name: item.family,
      implementations: [],
      scopes: [],
      kinds: [],
      lifecycle: "unreviewed",
      disposition: "unreviewed",
    };
    family.implementations.push(item.id);
    if (item.scope) family.scopes.push(item.scope);
    if (item.kind) family.kinds.push(item.kind);
    groups.set(item.family, family);
  }
  return [...groups.values()]
    .map((item) => ({
      ...item,
      implementations: sortStrings(item.implementations),
      scopes: sortStrings(item.scopes),
      kinds: sortStrings(item.kinds),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
