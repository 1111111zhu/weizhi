import assert from "node:assert/strict";

function family(inventory, id) {
  const result = inventory.families.find((entry) => entry.name === id);
  assert.ok(result, `missing family ${id}`);
  return result;
}

export function assertInventoryHeader(inventory) {
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.sourceRevision, "fixture-revision");
  assert.equal(inventory.lifecycle, "unreviewed");
  assert.equal(inventory.disposition, "unreviewed");
  assert.deepEqual(
    inventory.families.map((entry) => entry.name),
    ["Button", "ContextMenu", "Dialog", "Mixed"]
  );
  assert.ok(
    inventory.families.every(
      (entry) =>
        entry.lifecycle === "unreviewed" && entry.disposition === "unreviewed"
    )
  );
}

export function assertButtonProvenance(inventory) {
  const button = family(inventory, "Button");
  assert.ok(button.implementations.every((id) => id.includes("#Button")));
  const implementation = inventory.implementations.find(
    (entry) =>
      entry.id.endsWith("#Button") &&
      entry.file === "packages/ui/src/button.tsx"
  );
  assert.ok(implementation);
  assert.equal(implementation.scope, "shared");
  assert.ok(
    implementation.libraries.some(
      (library) =>
        library.package === "class-variance-authority" &&
        library.versions.includes("0.7.1")
    )
  );
  assert.deepEqual(
    implementation.libraries.find((library) => library.package === "react")
      .versions,
    ["19.1.0"]
  );
  assert.deepEqual(implementation.variants, [
    { name: "size", values: ["md", "sm"] },
    { name: "variant", values: ["primary", "quiet"] },
  ]);
  assert.deepEqual(implementation.consumers, ["apps/emp/src/page.tsx"]);
}

export function assertPublicExports(inventory) {
  assert.equal(
    inventory.implementations.find((entry) => entry.name === "PublicThing")
      .public,
    true
  );
  assert.equal(
    inventory.implementations.find((entry) => entry.name === "HiddenThing")
      .public,
    false
  );
  const consumer = inventory.consumers.find(
    (entry) => entry.source === "@project-wing/ui"
  );
  assert.deepEqual(consumer.specifiers, [
    "Button as PrimaryButton",
    "projectWingToast as toast",
  ]);
  assert.deepEqual(consumer.symbols?.PrimaryButton, {
    file: "packages/ui/src/button.tsx",
    name: "Button",
  });
  assert.deepEqual(consumer.symbols?.toast, {
    file: "packages/ui/src/toast.ts",
    name: "projectWingToast",
  });
  assert.equal(consumer.resolved, null);
  const toastFile = inventory.files.find(
    (file) => file.file === "packages/ui/src/toast.ts"
  );
  assert.deepEqual(toastFile.publicExports, [
    "projectWingToast",
    "ToastOptions",
  ]);
  assert.equal(
    inventory.implementations.some(
      (implementation) => implementation.file === toastFile.file
    ),
    false
  );
}

export function assertDialogProvenance(inventory) {
  const dialog = family(inventory, "Dialog");
  const implementation = inventory.implementations.find((entry) =>
    entry.id.endsWith("#Dialog")
  );
  assert.ok(dialog.implementations.includes(implementation.id));
  assert.equal(implementation.scope, "app-local");
  assert.ok(
    implementation.libraries.some(
      (library) =>
        library.package === "@base-ui/react" &&
        library.versions.includes("1.2.0")
    )
  );
  assert.deepEqual(
    implementation.libraries.find((library) => library.package === "react")
      .versions,
    ["19.2.0"]
  );
  const consumer = inventory.consumers.find(
    (entry) => entry.source === "@/components/dialog"
  );
  assert.deepEqual(consumer.specifiers, ["Dialog"]);
  assert.ok(consumer.symbols?.Dialog);
  assert.deepEqual(implementation.consumers, ["apps/emp/src/page.tsx"]);
}

export function assertTokenDefinitions(inventory) {
  const definitions = inventory.tokens.definitions.filter(
    (token) => token.name === "--color-primary"
  );
  assert.equal(definitions.length, 2);
  assert.deepEqual(
    definitions.map((definition) => definition.selector).sort(),
    [".dark", ":root"]
  );
  assert.equal(
    inventory.tokens.usages.some((usage) => usage.name === "--space-sm"),
    false
  );
  assert.equal(
    inventory.tokens.definitions.find(
      (definition) => definition.name === "--color-theme"
    ).selector,
    "@theme inline"
  );
  assert.equal(
    inventory.tokens.definitions.find(
      (definition) => definition.name === "--font-sans"
    ).value,
    "Inter, sans-serif"
  );
  assert.ok(
    inventory.tokens.conflicts.some(
      (conflict) =>
        conflict.name === "--color-primary" && conflict.values.length === 2
    )
  );
}

export function assertRawColors(inventory) {
  const appColors = inventory.tokens.rawValues.filter(
    (color) => color.file === "apps/emp/src/globals.css"
  );
  assert.ok(appColors.some((color) => color.value === "#ff0000"));
  assert.equal(appColors.filter((color) => color.value === "blue").length, 1);
  assert.ok(appColors.some((color) => color.value === "oklch(0.5 0.1 30)"));
}

export function assertUnresolvedImport(inventory) {
  assert.ok(
    inventory.unresolvedImports.some(
      (entry) =>
        entry.kind === "import" &&
        entry.source === "@/components/missing" &&
        entry.file === "apps/emp/src/page.tsx"
    )
  );
  assert.ok(
    inventory.files.some(
      (entry) => entry.file === "apps/emp/src/content/guide.mdx"
    )
  );
  assert.equal(
    inventory.unresolvedImports.some((entry) =>
      entry.source.includes("guide.mdx?collection=docs")
    ),
    false
  );
  assert.ok(
    inventory.consumers.some(
      (entry) =>
        entry.source === "./globals.css?layer=app" &&
        entry.resolved === "apps/emp/src/globals.css"
    )
  );
  assert.ok(
    inventory.unresolvedImports.some(
      (entry) => entry.source === "./missing-side-effect.css"
    )
  );
}
