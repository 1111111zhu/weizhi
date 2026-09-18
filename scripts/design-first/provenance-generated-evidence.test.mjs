import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("retains generated showroom color datasets as provenance evidence", async () => {
  const outputPath = join(process.cwd(), "docs/ui-provenance.generated.json");
  const inventory = JSON.parse(await readFile(outputPath, "utf8"));
  const colorFiles = new Set(
    inventory.tokens.rawValues.map((value) => value.file)
  );
  const inventoryFiles = new Set(inventory.files.map((file) => file.file));
  assert.ok(inventoryFiles.has("apps/ui-showroom/lib/registry-base-colors.ts"));
  assert.ok(inventoryFiles.has("apps/ui-showroom/lib/registry-colors.ts"));
  assert.ok(
    [...colorFiles].some((file) =>
      file.startsWith("apps/ui-showroom/lib/registry-base-colors-")
    )
  );
  assert.ok(
    [...colorFiles].some((file) =>
      file.startsWith("apps/ui-showroom/lib/registry-colors-")
    )
  );
});
