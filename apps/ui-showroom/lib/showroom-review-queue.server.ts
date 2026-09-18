import type { ReviewDecision } from "@/components/showroom/review-queue.types";

import {
  getProvenanceInventory,
  getReviewSignals,
} from "./showroom-provenance.server";
import type {
  ProvenanceImplementation,
  ReviewSignalKind,
} from "./showroom-provenance.types.ts";

const reasonCopy: Record<ReviewSignalKind, string> = {
  "custom-raw-style":
    "Raw style values bypass or compete with semantic tokens.",
  "radix-library": "Radix is outside the approved Project Wing UI stack.",
  "token-conflict": "The implementation file participates in a token conflict.",
  "unresolved-import":
    "A source import could not be resolved by the inventory.",
  "vendored-registry":
    "Vendored registry code needs source and aesthetic review.",
};

function replacementFor(kinds: ReviewSignalKind[]) {
  if (kinds.includes("radix-library")) {
    return "Return to an app-local shadcn wrapper backed by Base UI.";
  }
  if (kinds.includes("custom-raw-style") || kinds.includes("token-conflict")) {
    return "Replace raw or conflicting values with the accepted semantic token set.";
  }
  if (kinds.includes("vendored-registry")) {
    return "Reconcile the registry source with an accepted shared implementation.";
  }
  return null;
}

function queueRecord(
  implementation: ProvenanceImplementation,
  signalKinds: ReviewSignalKind[]
) {
  const suggestedDisposition: ReviewDecision = signalKinds.length
    ? "technical-debt"
    : "unreviewed";
  return {
    family: implementation.family,
    file: implementation.file,
    id: implementation.id,
    kind: implementation.kind ?? "unknown",
    libraries: implementation.libraries.map((library) => library.package),
    name: implementation.name,
    reasons: signalKinds.length
      ? signalKinds.map((kind) => reasonCopy[kind])
      : ["No machine-detected debt; aesthetic review is still required."],
    replacement: replacementFor(signalKinds),
    scope: implementation.scope ?? "unknown",
    suggestedDisposition,
  };
}

export function getReviewQueueItems() {
  const inventory = getProvenanceInventory();
  const signals = getReviewSignals();
  const signalKindsByImplementation = new Map<string, Set<ReviewSignalKind>>();
  for (const signal of signals) {
    for (const implementation of inventory.implementations) {
      const matches =
        signal.implementationIds.includes(implementation.id) ||
        signal.files.includes(implementation.file);
      if (!matches) {
        continue;
      }
      const kinds =
        signalKindsByImplementation.get(implementation.id) ?? new Set();
      kinds.add(signal.kind);
      signalKindsByImplementation.set(implementation.id, kinds);
    }
  }
  return inventory.implementations.map((implementation) =>
    queueRecord(
      implementation,
      [...(signalKindsByImplementation.get(implementation.id) ?? [])].sort()
    )
  );
}
