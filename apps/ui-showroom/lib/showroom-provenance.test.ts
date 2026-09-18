import assert from "node:assert";
import { readFileSync } from "node:fs";

import { describe, it } from "vitest";

import {
  getFamilyDetail,
  getFamilySummaries,
  getProvenanceIdentity,
  getProvenanceInventory,
  getProvenanceOverview,
  getReviewSignals,
  getTokenOverview,
} from "./showroom-provenance.server";

describe("lib/showroom-provenance contracts", () => {
  it("loads the generated inventory at runtime instead of importing JSON", () => {
    const inventory = getProvenanceInventory();
    assert.strictEqual(inventory.schemaVersion, 1);
    assert.strictEqual(
      inventory.summary.implementations,
      inventory.implementations.length
    );
    assert.strictEqual(inventory.summary.families, inventory.families.length);
    const source = readFileSync(
      new URL("showroom-provenance-core.server.ts", import.meta.url),
      "utf-8"
    );
    assert.match(source, /readFileSync/);
    assert.doesNotMatch(source, /from ["'].*ui-provenance\.generated\.json/);
  });

  it("returns stable, dimension-preserving overview data", () => {
    const first = getProvenanceOverview();
    const second = getProvenanceOverview();
    assert.deepStrictEqual(first, second);
    assert.ok(first.scopes.some((item) => item.value === "shared"));
    assert.ok(first.kinds.some((item) => item.value === "showroom-wrapper"));
    assert.ok(first.libraries.some((item) => item.value === "@base-ui/react"));
    assert.strictEqual(first.aestheticApproval, "unreviewed");
    assert.strictEqual(first.disposition, "unreviewed");
  });

  it("exposes complete family and implementation provenance", () => {
    const families = getFamilySummaries();
    const button = families.find((family) => family.name === "Button");
    const dialog = families.find((family) => family.name === "Dialog");
    const contextMenu = families.find(
      (family) => family.name === "ContextMenu"
    );
    assert.ok(button && dialog && contextMenu);
    assert.ok(button.scopes.includes("shared"));
    assert.ok(button.kinds.includes("showroom-wrapper"));
    assert.ok(button.libraries.includes("@base-ui/react"));
    assert.ok(button.variants.some((variant) => variant.name === "variant"));
    assert.strictEqual(button.lifecycle, "unreviewed");
    assert.strictEqual(button.disposition, "unreviewed");
    assert.notStrictEqual(button.implementationCount, 0);
    assert.notStrictEqual(dialog.implementationCount, 0);
    assert.notStrictEqual(contextMenu.implementationCount, 0);

    const detail = getFamilyDetail("Button");
    assert.ok(detail);
    const shared = detail.implementations.find(
      (implementation) => implementation.publicImport === "@project-wing/ui"
    );
    const showroom = detail.implementations.find(
      (implementation) => implementation.scope === "showroom"
    );
    assert.ok(shared && showroom);
    assert.ok(shared.variants.length > 0);
    assert.strictEqual(showroom.lifecycle, "unreviewed");
    assert.strictEqual(getFamilyDetail("MissingFamily"), null);
  });

  it("supports scoped, kind, library, and public filters", () => {
    const shared = getFamilySummaries({ scope: "shared" });
    assert.ok(shared.length > 0);
    assert.ok(
      shared.every(
        (family) => family.scopes.length === 1 && family.scopes[0] === "shared"
      )
    );
    const baseUi = getProvenanceOverview({ library: "@base-ui/react" });
    assert.ok(
      baseUi.libraries.some((library) => library.value === "@base-ui/react")
    );
    const publicOnly = getProvenanceOverview({ public: true });
    assert.ok(publicOnly.publicImplementationCount > 0);
    assert.strictEqual(
      publicOnly.summary.implementations,
      publicOnly.publicImplementationCount
    );
    const registry = getFamilySummaries({ kind: "vendored-registry" });
    assert.ok(registry.length > 0);
    assert.ok(
      registry.every(
        (family) =>
          family.kinds.length === 1 && family.kinds[0] === "vendored-registry"
      )
    );
  });

  it("returns token evidence and review debt without approving aesthetics", () => {
    const tokens = getTokenOverview();
    assert.ok(tokens.definitionCount > 0);
    assert.ok(tokens.usageCount > 0);
    assert.ok(tokens.conflictCount > 0);
    assert.ok(tokens.rawValueCount > 0);
    assert.ok(
      tokens.conflicts.every(
        (conflict) => conflict.autoAestheticApproval === false
      )
    );
    assert.ok(
      tokens.conflicts.every(
        (conflict) => conflict.disposition === "unreviewed"
      )
    );

    const signals = getReviewSignals();
    const kinds = new Set(signals.map((signal) => signal.kind));
    const hasRadixImplementation =
      getProvenanceInventory().implementations.some((implementation) =>
        implementation.libraries.some(
          (library) =>
            library.package === "radix-ui" ||
            library.package.startsWith("@radix-ui/")
        )
      );
    assert.strictEqual(kinds.has("radix-library"), hasRadixImplementation);
    assert.ok(kinds.has("vendored-registry"));
    assert.ok(kinds.has("custom-raw-style"));
    assert.ok(kinds.has("token-conflict"));
    assert.strictEqual(
      kinds.has("unresolved-import"),
      getProvenanceInventory().unresolvedImports.length > 0
    );
    assert.ok(
      signals.every((signal) => signal.autoAestheticApproval === false)
    );
    assert.ok(signals.every((signal) => signal.disposition === "unreviewed"));
    const sorted = [...signals].sort((a, b) => a.id.localeCompare(b.id));
    assert.strictEqual(signals.length, sorted.length);
  });

  it("binds review state to the exact inventory content", () => {
    const first = getProvenanceIdentity();
    const second = getProvenanceIdentity();
    assert.deepStrictEqual(first, second);
    assert.match(first.inventoryHash, /^[a-f0-9]{64}$/);
    assert.strictEqual(
      first.sourceRevision,
      getProvenanceInventory().sourceRevision
    );
  });

  it("rejects client-runtime access", () => {
    const globalObject = globalThis as { window?: unknown };
    const previousWindow = globalObject.window;
    globalObject.window = {};
    assert.throws(() => getProvenanceInventory(), /server runtime/);
    if (previousWindow === undefined) {
      delete globalObject.window;
    } else {
      globalObject.window = previousWindow;
    }
  });
});
