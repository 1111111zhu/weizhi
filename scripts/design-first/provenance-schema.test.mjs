import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const { join, resolve } = path;
const REPO_ROOT = resolve(import.meta.dirname, "../..");

test("schema covers the inventory contract and only permits unreviewed governance", () => {
  const schema = JSON.parse(
    readFileSync(join(REPO_ROOT, "docs/ui-provenance.schema.json"), "utf-8")
  );
  for (const field of [
    "schemaVersion",
    "sourceRevision",
    "lifecycle",
    "disposition",
    "implementationRoots",
    "files",
    "implementations",
    "families",
    "consumers",
    "tokens",
    "dependencies",
    "unresolvedImports",
    "summary",
  ]) {
    assert.ok(schema.required.includes(field));
  }
  assert.equal(schema.additionalProperties, false);
  for (const definition of [
    "family",
    "implementation",
    "consumer",
    "tokens",
    "dependency",
    "unresolvedImport",
  ]) {
    assert.equal(schema.$defs[definition].additionalProperties, false);
  }
  assert.equal(schema.$defs.unreviewed.const, "unreviewed");
  assert.ok(schema.$defs.tokenConflict.required.includes("evidence"));
});
