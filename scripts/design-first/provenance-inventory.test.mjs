import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { withFixture, writeFixtureFile } from "./provenance-fixture.mjs";
import {
  assertButtonProvenance,
  assertDialogProvenance,
  assertInventoryHeader,
  assertPublicExports,
  assertRawColors,
  assertTokenDefinitions,
  assertUnresolvedImport,
} from "./provenance-inventory-test-helpers.mjs";
import {
  buildProvenanceInventory,
  checkProvenanceInventory,
  serializeProvenanceInventory,
  validateProvenanceInventory,
  writeProvenanceInventory,
} from "./provenance-inventory.mjs";
test("builds families, implementations, exports, variants, libraries, consumers, tokens, and unresolved evidence", async () => {
  await withFixture(async ({ rootDir, configPath }) => {
    const inventory = await buildProvenanceInventory({
      rootDir,
      configPath,
      sourceRevision: "fixture-revision",
    });
    assertInventoryHeader(inventory);
    assertButtonProvenance(inventory);
    assertPublicExports(inventory);
    assertDialogProvenance(inventory);
    assertTokenDefinitions(inventory);
    assertRawColors(inventory);
    assertUnresolvedImport(inventory);
  });
});

test("sorts output and serializes deterministically", async () => {
  await withFixture(async ({ rootDir, configPath }) => {
    const first = await buildProvenanceInventory({
      rootDir,
      configPath,
      sourceRevision: "fixture-revision",
    });
    const second = await buildProvenanceInventory({
      rootDir,
      configPath,
      sourceRevision: "fixture-revision",
    });
    assert.deepEqual(first, second);
    const permuted = structuredClone(first);
    permuted.files.reverse();
    permuted.implementations.reverse();
    permuted.families.reverse();
    permuted.consumers.reverse();
    permuted.dependencies.reverse();
    permuted.tokens.definitions.reverse();
    permuted.tokens.usages.reverse();
    permuted.tokens.conflicts.reverse();
    permuted.tokens.rawValues.reverse();
    permuted.unresolvedImports.reverse();
    assert.equal(
      serializeProvenanceInventory(first),
      serializeProvenanceInventory(permuted)
    );
    assert.deepEqual(JSON.parse(serializeProvenanceInventory(first)), first);
  });
});

test("validates the contract and rejects approved or ready generated state", async () => {
  await withFixture(async ({ rootDir, configPath }) => {
    const inventory = await buildProvenanceInventory({
      rootDir,
      configPath,
      sourceRevision: "fixture-revision",
    });
    const valid = validateProvenanceInventory(inventory);
    assert.equal(valid.isValid, true);
    assert.deepEqual(valid.errors, []);
    const invalid = structuredClone(inventory);
    invalid.lifecycle = "ready";
    invalid.disposition = "approved";
    invalid.families[0].lifecycle = "ready";
    invalid.families[0].disposition = "approved";
    invalid.implementations[0].lifecycle = "ready";
    invalid.implementations[0].disposition = "approved";
    const report = validateProvenanceInventory(invalid);
    assert.equal(report.isValid, false);
    assert.ok(report.errors.some((error) => error.includes("unreviewed")));
  });
});

test("writes an inventory and detects source drift", async () => {
  await withFixture(async ({ rootDir, configPath }) => {
    const outputPath = join(rootDir, "artifacts/ui-provenance.json");
    const written = await writeProvenanceInventory({
      rootDir,
      configPath,
      outputPath,
      sourceRevision: "fixture-revision",
    });
    assert.equal(written.inventory.sourceRevision, "fixture-revision");
    assert.deepEqual(
      JSON.parse(await readFile(outputPath, "utf8")),
      written.inventory
    );
    const clean = await checkProvenanceInventory({
      rootDir,
      configPath,
      outputPath,
      sourceRevision: "fixture-revision",
    });
    assert.equal(clean.isValid, true);
    assert.equal(clean.drift, false);
    await writeFixtureFile(
      rootDir,
      "apps/emp/src/globals.css",
      `:root { --color-primary: #abcdef; --new-token: #123123; color: #ff0000; }\n`
    );
    const drift = await checkProvenanceInventory({
      rootDir,
      configPath,
      outputPath,
      sourceRevision: "fixture-revision",
    });
    assert.equal(drift.isValid, false);
    assert.equal(drift.drift, true);
  });
});
