import {
  compareText,
  conflictMatchesScope,
  getProvenanceInventory,
  hasRadix,
  selectImplementations,
  sortedUnique,
  tokenMatchesScope,
} from "./showroom-provenance-core.server";
import type {
  ProvenanceQuery,
  ReviewSignal,
  ReviewSignalKind,
} from "./showroom-provenance.types";

interface SignalInput {
  kind: ReviewSignalKind;
  severity: ReviewSignal["severity"];
  title: string;
  count: number;
  implementationIds: string[];
  files: string[];
  evidence: string[];
}

function makeSignal(input: SignalInput): ReviewSignal {
  return {
    id: `${input.kind}:${input.title}`,
    kind: input.kind,
    severity: input.severity,
    title: input.title,
    count: input.count,
    implementationIds: sortedUnique(input.implementationIds),
    files: sortedUnique(input.files),
    evidence: sortedUnique(input.evidence),
    lifecycle: "unreviewed",
    disposition: "unreviewed",
    autoAestheticApproval: false,
  };
}

function radixSignal(
  implementations: ReturnType<typeof selectImplementations>
): ReviewSignal | null {
  const selected = implementations.filter(hasRadix);
  return selected.length
    ? makeSignal({
        kind: "radix-library",
        severity: "high",
        title: "Radix-backed implementation",
        count: selected.length,
        implementationIds: selected.map((item) => item.id),
        files: selected.map((item) => item.file),
        evidence: ["library dependency requires aesthetic review"],
      })
    : null;
}

function registrySignal(
  implementations: ReturnType<typeof selectImplementations>
): ReviewSignal | null {
  const selected = implementations.filter(
    (item) => item.kind === "vendored-registry"
  );
  return selected.length
    ? makeSignal({
        kind: "vendored-registry",
        severity: "high",
        title: "Vendored registry implementation",
        count: selected.length,
        implementationIds: selected.map((item) => item.id),
        files: selected.map((item) => item.file),
        evidence: ["registry source requires provenance review"],
      })
    : null;
}

function rawStyleSignal(
  rawValues: { file: string; kind: string }[]
): ReviewSignal | null {
  return rawValues.length
    ? makeSignal({
        kind: "custom-raw-style",
        severity: "medium",
        title: "Raw color/style evidence",
        count: rawValues.length,
        implementationIds: [],
        files: rawValues.map((item) => item.file),
        evidence: rawValues.map((item) => item.kind),
      })
    : null;
}

function conflictSignals(
  conflicts: { name: string; files: string[]; values: string[] }[]
): ReviewSignal[] {
  return conflicts.map((conflict) =>
    makeSignal({
      kind: "token-conflict",
      severity: "medium",
      title: `Token conflict ${conflict.name}`,
      count: 1,
      implementationIds: [],
      files: conflict.files,
      evidence: conflict.values,
    })
  );
}

function unresolvedSignal(
  unresolved: { file: string; source: string }[]
): ReviewSignal | null {
  return unresolved.length
    ? makeSignal({
        kind: "unresolved-import",
        severity: "low",
        title: "Unresolved provenance import",
        count: unresolved.length,
        implementationIds: [],
        files: unresolved.map((item) => item.file),
        evidence: unresolved.map((item) => item.source),
      })
    : null;
}

export function getReviewSignals(query?: ProvenanceQuery): ReviewSignal[] {
  const inventory = getProvenanceInventory();
  const implementations = selectImplementations(query);
  const rawValues = inventory.tokens.rawValues.filter((item) =>
    tokenMatchesScope(item.file, query?.scope)
  );
  const conflicts = inventory.tokens.conflicts.filter((item) =>
    conflictMatchesScope(item, query?.scope)
  );
  const unresolved = inventory.unresolvedImports.filter((item) =>
    tokenMatchesScope(item.file, query?.scope)
  );
  const signals = [
    radixSignal(implementations),
    registrySignal(implementations),
    rawStyleSignal(rawValues),
    ...conflictSignals(conflicts),
    unresolvedSignal(unresolved),
  ].filter((signal): signal is ReviewSignal => signal !== null);
  const rank = { high: 0, medium: 1, low: 2 };
  return signals.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || compareText(a.id, b.id)
  );
}
