import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  ProvenanceFamily,
  ProvenanceImplementation,
  ProvenanceInventory,
  ProvenanceQuery,
  ProvenanceTokenConflict,
  ReviewSignalKind,
} from "./showroom-provenance.types";

const INVENTORY_FILE = "docs/ui-provenance.generated.json";
let cachedInventory: ProvenanceInventory | undefined;
let cachedInventoryText: string | undefined;

export function compareText(left: string, right: string): number {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b ? (left < right ? -1 : left > right ? 1 : 0) : a < b ? -1 : 1;
}

export function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new TypeError(
      "Showroom provenance can only be read in a server runtime."
    );
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function readCandidate(candidate: string): string | null {
  try {
    return readFileSync(candidate, "utf-8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

function readInventoryText(): string {
  if (cachedInventoryText) {
    return cachedInventoryText;
  }
  const configuredPath = process.env.SHOWROOM_PROVENANCE_PATH;
  const candidates = configuredPath
    ? [path.resolve(configuredPath)]
    : [
        path.resolve(process.cwd(), INVENTORY_FILE),
        path.resolve(process.cwd(), "../../", INVENTORY_FILE),
      ];

  for (const candidate of candidates) {
    const content = readCandidate(candidate);
    if (!content) {
      continue;
    }
    cachedInventoryText = content;
    return content;
  }
  throw new Error(`Unable to locate ${INVENTORY_FILE}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseInventory(serialized: string): ProvenanceInventory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new Error(
      `Invalid provenance JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    !Array.isArray(parsed.implementations)
  ) {
    throw new Error(
      "Invalid provenance inventory: expected schemaVersion 1 and implementations."
    );
  }
  if (!isRecord(parsed.tokens) || !Array.isArray(parsed.tokens.definitions)) {
    throw new Error("Invalid provenance inventory: expected token evidence.");
  }
  return parsed as unknown as ProvenanceInventory;
}

export function getProvenanceInventory(): ProvenanceInventory {
  assertServerRuntime();
  if (!cachedInventory) {
    cachedInventory = parseInventory(readInventoryText());
  }
  return cachedInventory;
}

export function getProvenanceIdentity() {
  const inventory = getProvenanceInventory();
  return {
    inventoryHash: createHash("sha256")
      .update(readInventoryText())
      .digest("hex"),
    sourceRevision: inventory.sourceRevision,
  };
}

export const getShowroomProvenance = getProvenanceInventory;

function matchesSourceDimensions(
  implementation: ProvenanceImplementation,
  query: ProvenanceQuery
) {
  if (query.scope && implementation.scope !== query.scope) {
    return false;
  }
  return !(query.kind && implementation.kind !== query.kind);
}

function matchesLibraryAndAccess(
  implementation: ProvenanceImplementation,
  query: ProvenanceQuery
) {
  const libraryMatch =
    !query.library ||
    implementation.libraries.some(
      (library) => library.package === query.library
    );
  const publicMatch =
    query.public === undefined || implementation.public === query.public;
  return libraryMatch && publicMatch;
}

function matchesGovernance(
  implementation: ProvenanceImplementation,
  query: ProvenanceQuery
) {
  const lifecycleMatch =
    !query.lifecycle || implementation.lifecycle === query.lifecycle;
  const dispositionMatch =
    !query.disposition || implementation.disposition === query.disposition;
  return lifecycleMatch && dispositionMatch;
}

export function matchesQuery(
  implementation: ProvenanceImplementation,
  query?: ProvenanceQuery
): boolean {
  if (!query) {
    return true;
  }
  return (
    matchesSourceDimensions(implementation, query) &&
    matchesLibraryAndAccess(implementation, query) &&
    matchesGovernance(implementation, query)
  );
}

export function selectImplementations(
  query?: ProvenanceQuery
): ProvenanceImplementation[] {
  return getProvenanceInventory()
    .implementations.filter((item) => matchesQuery(item, query))
    .sort((a, b) => compareText(a.id, b.id));
}

export function scopeForPath(file: string): string | null {
  if (file.startsWith("packages/ui/")) {
    return "shared";
  }
  const match = /^apps\/([^/]+)\//.exec(file);
  return match?.[1] ?? null;
}

export function tokenMatchesScope(file: string, scope?: string): boolean {
  return !scope || scopeForPath(file) === scope;
}

export function conflictMatchesScope(
  conflict: ProvenanceTokenConflict,
  scope?: string
): boolean {
  return (
    !scope || conflict.files.some((file) => tokenMatchesScope(file, scope))
  );
}

export function rawStyleCounts(query?: ProvenanceQuery): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of getProvenanceInventory().tokens.rawValues) {
    if (!tokenMatchesScope(raw.file, query?.scope)) {
      continue;
    }
    counts.set(raw.file, (counts.get(raw.file) ?? 0) + 1);
  }
  return counts;
}

export function hasRadix(implementation: ProvenanceImplementation): boolean {
  return implementation.libraries.some(
    (library) =>
      library.package === "radix-ui" || library.package.startsWith("@radix-ui/")
  );
}

export function implementationSignalKinds(
  implementation: ProvenanceImplementation,
  rawStyles: Map<string, number>,
  conflicts: ProvenanceTokenConflict[]
): ReviewSignalKind[] {
  const kinds: ReviewSignalKind[] = [];
  if (hasRadix(implementation)) {
    kinds.push("radix-library");
  }
  if (implementation.kind === "vendored-registry") {
    kinds.push("vendored-registry");
  }
  if (rawStyles.has(implementation.file)) {
    kinds.push("custom-raw-style");
  }
  if (
    conflicts.some((conflict) => conflict.files.includes(implementation.file))
  ) {
    kinds.push("token-conflict");
  }
  return kinds;
}

export function mergeVariants(implementations: ProvenanceImplementation[]) {
  const values = new Map<string, string[]>();
  for (const implementation of implementations) {
    for (const variant of implementation.variants) {
      values.set(variant.name, [
        ...(values.get(variant.name) ?? []),
        ...variant.values,
      ]);
    }
  }
  return [...values.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([name, variantValues]) => ({
      name,
      values: sortedUnique(variantValues),
    }));
}

export function familyRecord(name: string): ProvenanceFamily | undefined {
  return getProvenanceInventory().families.find(
    (family) => family.name === name
  );
}
