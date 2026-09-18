/* eslint-disable unicorn/prefer-export-from -- this module also consumes the re-exported helpers below. */

import {
  compareText,
  conflictMatchesScope,
  familyRecord,
  getProvenanceInventory,
  implementationSignalKinds,
  mergeVariants,
  rawStyleCounts,
  selectImplementations,
  scopeForPath,
  sortedUnique,
} from "./showroom-provenance-core.server";
import { getReviewSignals } from "./showroom-provenance-review.server";
import { getTokenOverview } from "./showroom-provenance-token.server";
import type {
  FamilyDetail,
  FamilySummary,
  ImplementationDetail,
  ProvenanceDimensionSummary,
  ProvenanceImplementation,
  ProvenanceLibrarySummary,
  ProvenanceOverview,
  ProvenanceQuery,
  ProvenanceSummary,
  ProvenanceTokenConflict,
  ReviewSignalKind,
  TokenOverview,
} from "./showroom-provenance.types";

export type {
  FamilyDetail,
  FamilySummary,
  ImplementationDetail,
  ProvenanceQuery,
  ProvenanceOverview,
  ReviewSignal,
  TokenOverview,
} from "./showroom-provenance.types";
export {
  getProvenanceIdentity,
  getProvenanceInventory,
  getShowroomProvenance,
} from "./showroom-provenance-core.server";
export { getReviewSignals };
export { getTokenSummary } from "./showroom-provenance-token.server";
export { getTokenOverview };

function dimensionSummaries(
  implementations: ProvenanceImplementation[],
  field: "scope" | "kind"
): ProvenanceDimensionSummary[] {
  const counts = new Map<string, ProvenanceDimensionSummary>();
  for (const implementation of implementations) {
    const value = implementation[field];
    if (!value) {
      continue;
    }
    const current = counts.get(value) ?? {
      value,
      implementationCount: 0,
      publicImplementationCount: 0,
    };
    current.implementationCount += 1;
    if (implementation.public) {
      current.publicImplementationCount += 1;
    }
    counts.set(value, current);
  }
  return [...counts.values()].sort((a, b) => compareText(a.value, b.value));
}

function librarySummaries(
  implementations: ProvenanceImplementation[]
): ProvenanceLibrarySummary[] {
  const summaries = new Map<string, ProvenanceLibrarySummary>();
  for (const implementation of implementations) {
    for (const library of implementation.libraries) {
      const current = summaries.get(library.package) ?? {
        value: library.package,
        implementationCount: 0,
        publicImplementationCount: 0,
        versions: [],
      };
      current.implementationCount += 1;
      if (implementation.public) {
        current.publicImplementationCount += 1;
      }
      current.versions.push(...library.versions);
      summaries.set(library.package, current);
    }
  }
  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      versions: sortedUnique(summary.versions),
    }))
    .sort((a, b) => compareText(a.value, b.value));
}

interface FamilySummaryInput {
  name: string;
  implementations: ProvenanceImplementation[];
  rawStyles: Map<string, number>;
  conflicts: ProvenanceTokenConflict[];
}

function summarizeFamily(input: FamilySummaryInput): FamilySummary {
  const record = familyRecord(input.name);
  const signalKinds = new Set<ReviewSignalKind>();
  for (const implementation of input.implementations) {
    for (const kind of implementationSignalKinds(
      implementation,
      input.rawStyles,
      input.conflicts
    )) {
      signalKinds.add(kind);
    }
  }
  return {
    name: input.name,
    implementationIds: input.implementations
      .map((item) => item.id)
      .sort(compareText),
    implementationCount: input.implementations.length,
    publicImplementationCount: input.implementations.filter(
      (item) => item.public
    ).length,
    scopes: sortedUnique(
      input.implementations.flatMap((item) => (item.scope ? [item.scope] : []))
    ),
    kinds: sortedUnique(
      input.implementations.flatMap((item) => (item.kind ? [item.kind] : []))
    ),
    libraries: sortedUnique(
      input.implementations.flatMap((item) =>
        item.libraries.map((library) => library.package)
      )
    ),
    variants: mergeVariants(input.implementations),
    lifecycle: record?.lifecycle ?? "unreviewed",
    disposition: record?.disposition ?? "unreviewed",
    reviewSignalKinds: [...signalKinds].sort(compareText),
  };
}

export function getFamilySummaries(query?: ProvenanceQuery): FamilySummary[] {
  const implementations = selectImplementations(query);
  const byFamily = new Map<string, ProvenanceImplementation[]>();
  for (const implementation of implementations) {
    byFamily.set(implementation.family, [
      ...(byFamily.get(implementation.family) ?? []),
      implementation,
    ]);
  }
  const rawStyles = rawStyleCounts(query);
  const conflicts = getProvenanceInventory().tokens.conflicts.filter((item) =>
    conflictMatchesScope(item, query?.scope)
  );
  return [...byFamily.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([name, familyImplementations]) =>
      summarizeFamily({
        name,
        implementations: familyImplementations,
        rawStyles,
        conflicts,
      })
    );
}

function implementationDetail(
  implementation: ProvenanceImplementation,
  rawStyles: Map<string, number>,
  conflicts: ProvenanceTokenConflict[]
): ImplementationDetail {
  return {
    ...implementation,
    rawStyleCount: rawStyles.get(implementation.file) ?? 0,
    tokenConflictCount: conflicts.filter((conflict) =>
      conflict.files.includes(implementation.file)
    ).length,
    reviewSignalKinds: implementationSignalKinds(
      implementation,
      rawStyles,
      conflicts
    ),
  };
}

export function getFamilyDetail(
  name: string,
  query?: ProvenanceQuery
): FamilyDetail | null {
  const implementations = selectImplementations(query).filter(
    (item) => item.family === name
  );
  if (implementations.length === 0) {
    return null;
  }
  const rawStyles = rawStyleCounts(query);
  const conflicts = getProvenanceInventory().tokens.conflicts.filter((item) =>
    conflictMatchesScope(item, query?.scope)
  );
  const details = implementations.map((item) =>
    implementationDetail(item, rawStyles, conflicts)
  );
  return {
    family: summarizeFamily({ name, implementations, rawStyles, conflicts }),
    implementations: details,
    consumerFiles: sortedUnique(details.flatMap((item) => item.consumers)),
  };
}

function selectedSummary(
  implementations: ProvenanceImplementation[],
  tokens: TokenOverview,
  query?: ProvenanceQuery
): ProvenanceSummary {
  const consumerFiles = sortedUnique(
    implementations.flatMap((item) => item.consumers)
  );
  const dependencies = new Set(
    implementations.flatMap((item) =>
      item.libraries.map((library) => library.package)
    )
  );
  const unresolvedImports = getProvenanceInventory().unresolvedImports.filter(
    (item) => !query?.scope || scopeForPath(item.file) === query.scope
  );
  return {
    files: new Set(implementations.map((item) => item.file)).size,
    implementationFiles: new Set(implementations.map((item) => item.file)).size,
    implementations: implementations.length,
    families: new Set(implementations.map((item) => item.family)).size,
    dependencies: dependencies.size,
    consumers: consumerFiles.length,
    unresolvedImports: unresolvedImports.length,
    tokenDefinitions: tokens.definitionCount,
    tokenConflicts: tokens.conflictCount,
  };
}

export function getProvenanceOverview(
  query?: ProvenanceQuery
): ProvenanceOverview {
  const inventory = getProvenanceInventory();
  const implementations = selectImplementations(query);
  const tokenOverview = getTokenOverview(query);
  const summary = query
    ? selectedSummary(implementations, tokenOverview, query)
    : inventory.summary;
  const signals = getReviewSignals(query);
  return {
    sourceRevision: inventory.sourceRevision,
    lifecycle: inventory.lifecycle,
    disposition: inventory.disposition,
    summary,
    scopes: dimensionSummaries(implementations, "scope"),
    kinds: dimensionSummaries(implementations, "kind"),
    libraries: librarySummaries(implementations),
    publicImplementationCount: implementations.filter((item) => item.public)
      .length,
    familyCount: new Set(implementations.map((item) => item.family)).size,
    tokenOverview,
    reviewSignalCount: signals.length,
    aestheticApproval: "unreviewed" as const,
  };
}
