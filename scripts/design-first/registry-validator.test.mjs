import assert from "node:assert/strict";
import test from "node:test";

import {
  validateReadyComponent,
  validateRegistryData,
  ValidationReport,
} from "./registry-validator.mjs";

test("validates a compliant registry dataset", () => {
  const registry = {
    schemaVersion: 1,
    project: {
      name: "ProjectWing",
      scale: "compact",
      archetype: "Workbench",
      designSystemRoot: "packages/ui/src",
      publicEntry: "packages/ui/src/index.ts",
      showroomRoot: "apps/ui-showroom",
    },
    approval: {
      status: "proposed",
      approvedBy: null,
      approvedAt: null,
      provenanceHash: null,
    },
    components: [
      {
        id: "surface",
        name: "Surface",
        layer: "primitive",
        category: "layout",
        status: "planned",
        publicExport: null,
        sourcePath: null,
        showroomPath: null,
        showroomSource: null,
        requiredStates: ["default"],
        coveredStates: [],
        tests: {
          interaction: [],
          keyboard: [],
          accessibility: [],
          visual: [],
          responsive: [],
        },
        replacement: null,
        notes: "",
      },
    ],
    exceptions: [],
  };

  const report = validateRegistryData(registry, { projectRoot: null });
  assert.equal(report.isValid, true);
  assert.equal(report.errors.length, 0);
});

test("flags missing fields on component and approval", () => {
  const invalidRegistry = {
    schemaVersion: 1,
    project: {
      name: "ProjectWing",
      scale: "compact",
      archetype: "Workbench",
      designSystemRoot: "packages/ui/src",
      publicEntry: "packages/ui/src/index.ts",
      showroomRoot: "apps/ui-showroom",
    },
    approval: {
      status: "approved",
      approvedBy: null,
      approvedAt: null,
      provenanceHash: null,
    },
    components: [
      {
        id: "INVALID_ID",
        name: "",
        layer: "invalid-layer",
        category: "",
        status: "planned",
      },
    ],
    exceptions: [],
  };

  const report = validateRegistryData(invalidRegistry, { projectRoot: null });
  assert.equal(report.isValid, false);
  assert.ok(
    report.errors.some((e) =>
      e.includes("Approved registry requires approval.approvedBy")
    )
  );
  assert.ok(report.errors.some((e) => e.includes("approval.provenanceHash")));
  assert.ok(
    report.errors.some((e) => e.includes("id must be lower-case hyphen-case"))
  );
  assert.ok(
    report.errors.some((e) => e.includes("name must be a non-empty string"))
  );
  assert.ok(report.errors.some((e) => e.includes("layer must be one of")));
});

test("flags ready component without required exports or tests", () => {
  const report = new ValidationReport();
  const component = {
    id: "button",
    name: "Button",
    layer: "primitive",
    category: "actions",
    status: "ready",
    publicExport: null,
    sourcePath: null,
    showroomPath: null,
    showroomSource: null,
    requiredStates: ["default", "loading"],
    coveredStates: ["default"],
    tests: {
      interaction: [],
      keyboard: [],
      accessibility: [],
      visual: [],
      responsive: [],
    },
    replacement: null,
    notes: "",
  };

  validateReadyComponent(component, null, new Set(), report);
  assert.equal(report.isValid, false);
  assert.ok(report.errors.some((e) => e.includes("requires publicExport")));
  assert.ok(
    report.errors.some((e) => e.includes("missing covered states: loading"))
  );
  assert.ok(
    report.errors.some((e) =>
      e.includes("requires at least one interaction test path")
    )
  );
});

test("binds approved registry state to the current provenance hash", () => {
  const provenanceHash = "a".repeat(64);
  const registry = {
    schemaVersion: 1,
    project: {
      name: "ProjectWing",
      scale: "compact",
      archetype: "Workbench",
      designSystemRoot: "packages/ui/src",
      publicEntry: "packages/ui/src/index.ts",
      showroomRoot: "apps/ui-showroom",
    },
    approval: {
      status: "approved",
      approvedBy: "Design reviewer",
      approvedAt: "2026-08-24T00:00:00.000Z",
      provenanceHash,
    },
    components: [],
    exceptions: [],
  };

  const matching = validateRegistryData(registry, {
    expectedProvenanceHash: provenanceHash,
    projectRoot: null,
  });
  assert.equal(matching.isValid, true);

  const stale = validateRegistryData(registry, {
    expectedProvenanceHash: "b".repeat(64),
    projectRoot: null,
  });
  assert.ok(stale.errors.some((error) => error.includes("current inventory")));
});
