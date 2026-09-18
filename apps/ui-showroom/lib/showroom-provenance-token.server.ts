import {
  compareText,
  conflictMatchesScope,
  getProvenanceInventory,
  scopeForPath,
  sortedUnique,
  tokenMatchesScope,
} from "./showroom-provenance-core.server";
import type {
  ProvenanceDimensionSummary,
  ProvenanceQuery,
  ProvenanceTokenConflict,
  ProvenanceTokenDefinition,
  TokenConflictSummary,
  TokenDefinitionSummary,
  TokenOverview,
} from "./showroom-provenance.types";

function tokenDefinitionSummaries(
  definitions: ProvenanceTokenDefinition[]
): TokenDefinitionSummary[] {
  const grouped = new Map<string, TokenDefinitionSummary>();
  for (const definition of definitions) {
    const current = grouped.get(definition.name) ?? {
      name: definition.name,
      definitionCount: 0,
      values: [],
      files: [],
      selectors: [],
    };
    current.definitionCount += 1;
    current.values.push(definition.value);
    current.files.push(definition.file);
    if (definition.selector) {
      current.selectors.push(definition.selector);
    }
    grouped.set(definition.name, current);
  }
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      values: sortedUnique(item.values),
      files: sortedUnique(item.files),
      selectors: sortedUnique(item.selectors),
    }))
    .sort((a, b) => compareText(a.name, b.name));
}

function tokenConflictSummary(
  conflict: ProvenanceTokenConflict
): TokenConflictSummary {
  return {
    ...conflict,
    values: sortedUnique(conflict.values),
    files: sortedUnique(conflict.files),
    scopes: sortedUnique(
      conflict.files
        .map(scopeForPath)
        .filter((scope): scope is string => Boolean(scope))
    ),
    lifecycle: "unreviewed",
    disposition: "unreviewed",
    autoAestheticApproval: false,
  };
}

function rawValueSummaries(
  rawValues: { kind: string }[]
): ProvenanceDimensionSummary[] {
  const grouped = new Map<string, ProvenanceDimensionSummary>();
  for (const raw of rawValues) {
    const current = grouped.get(raw.kind) ?? {
      value: raw.kind,
      implementationCount: 0,
      publicImplementationCount: 0,
    };
    current.implementationCount += 1;
    grouped.set(raw.kind, current);
  }
  return [...grouped.values()].sort((a, b) => compareText(a.value, b.value));
}

export function getTokenOverview(query?: ProvenanceQuery): TokenOverview {
  const inventory = getProvenanceInventory();
  const definitions = inventory.tokens.definitions.filter((item) =>
    tokenMatchesScope(item.file, query?.scope)
  );
  const usages = inventory.tokens.usages.filter((item) =>
    tokenMatchesScope(item.file, query?.scope)
  );
  const conflicts = inventory.tokens.conflicts.filter((item) =>
    conflictMatchesScope(item, query?.scope)
  );
  const rawValues = inventory.tokens.rawValues.filter((item) =>
    tokenMatchesScope(item.file, query?.scope)
  );
  return {
    definitionCount: definitions.length,
    usageCount: usages.length,
    conflictCount: conflicts.length,
    rawValueCount: rawValues.length,
    definitions: tokenDefinitionSummaries(definitions),
    conflicts: conflicts
      .map(tokenConflictSummary)
      .sort((a, b) => compareText(a.name, b.name)),
    rawValuesByKind: rawValueSummaries(rawValues),
  };
}

export const getTokenSummary = getTokenOverview;
