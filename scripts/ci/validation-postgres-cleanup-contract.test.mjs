import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./with-validation-postgres.sh", import.meta.url), "utf8");

test("validation PostgreSQL resources are labeled and stale runs are bounded", () => {
  assert.match(source, /cleanup_stale_containers/);
  assert.match(source, /PROJECTWING_VALIDATION_POSTGRES_STALE_SECONDS:-21600/);
  assert.match(source, /com\.projectwing\.ci\.resource=validation-postgres/);
  assert.match(source, /docker rm --force --volumes/);
  assert.doesNotMatch(source, /docker (?:system|volume) prune/);
});
