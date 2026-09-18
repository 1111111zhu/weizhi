import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const frontendApps = ["cmp", "emp", "tms", "ib", "intranet"];
const sharedSourceRoot = path.join(repoRoot, "packages", "shared", "src");
const sharedEntrySource = fs.readFileSync(
  path.join(sharedSourceRoot, "index.ts"),
  "utf-8"
);

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function resolveTypeScriptSource(specifier) {
  const relativeStem = specifier.slice(2, -3);
  const candidates = [`${relativeStem}.ts`, `${relativeStem}.tsx`];
  return candidates.find((candidate) =>
    fs.existsSync(path.join(sharedSourceRoot, candidate))
  );
}

const sharedRelativeJsSpecifiers = [
  ...new Set(
    [...sharedEntrySource.matchAll(/\bfrom\s+["'](\.\/[^"']+\.js)["']/g)].map(
      (match) => match[1]
    )
  ),
].sort();

test("all frontend Next configs resolve shared TypeScript entrypoint .js imports in Turbopack", () => {
  assert.ok(
    sharedRelativeJsSpecifiers.length > 0,
    "packages/shared/src/index.ts should expose at least one relative .js import"
  );

  for (const specifier of sharedRelativeJsSpecifiers) {
    const sourceTarget = resolveTypeScriptSource(specifier);
    if (!sourceTarget) {
      continue;
    }

    const expectedAliasTarget = `../../packages/shared/src/${sourceTarget}`;
    const aliasPattern = new RegExp(
      `${escapeRegExp(JSON.stringify(specifier))}:\\s*${escapeRegExp(
        JSON.stringify(expectedAliasTarget)
      )}`
    );

    for (const app of frontendApps) {
      const configPath = path.join(repoRoot, "apps", app, "next.config.ts");
      const source = fs.readFileSync(configPath, "utf-8");

      assert.match(
        source,
        aliasPattern,
        `${app}/next.config.ts must alias ${specifier} to ${expectedAliasTarget} for Turbopack`
      );
    }
  }
});
