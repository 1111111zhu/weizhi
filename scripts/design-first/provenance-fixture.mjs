import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export async function writeFixtureFile(rootDir, relativePath, content) {
  const path = join(rootDir, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function fixturePackageManifests() {
  return {
    "package.json": {
      name: "fixture-root",
      private: true,
      dependencies: { "@project-wing/ui": "workspace:*" },
    },
    "packages/ui/package.json": {
      name: "@project-wing/ui",
      version: "2.4.0",
      dependencies: {
        "class-variance-authority": "0.7.1",
        react: "19.1.0",
        sonner: "2.0.0",
      },
    },
    "apps/emp/package.json": {
      name: "@project-wing/emp",
      version: "3.0.0",
      dependencies: {
        "@base-ui/react": "1.2.0",
        "@project-wing/ui": "workspace:*",
        react: "19.2.0",
      },
    },
  };
}

function fixtureConfig() {
  return {
    "provenance.config.json": {
      implementationRoots: [
        {
          path: "packages/ui/src",
          scope: "shared",
          kind: "component",
          publicImport: "@project-wing/ui",
          publicEntry: "packages/ui/src/index.ts",
        },
        {
          path: "apps/emp/src/components",
          scope: "app-local",
          kind: "component",
        },
      ],
      consumerRoots: ["apps/emp/src"],
      tokenRoots: ["packages/ui/src", "apps/emp/src"],
      manifestPaths: [
        "package.json",
        "packages/ui/package.json",
        "apps/emp/package.json",
      ],
    },
  };
}

async function writeManifestFixtures(rootDir) {
  const files = { ...fixturePackageManifests(), ...fixtureConfig() };
  for (const [path, value] of Object.entries(files)) {
    await writeFixtureFile(rootDir, path, JSON.stringify(value));
  }
}

async function writeButtonFixture(rootDir) {
  await writeFixtureFile(
    rootDir,
    "packages/ui/src/button.tsx",
    `import { cva } from "class-variance-authority";
import * as React from "react";

export const buttonVariants = cva("inline-flex", {
  variants: {
    variant: {
      primary: "bg-primary",
      quiet: "bg-transparent",
    },
    size: {
      sm: "h-8",
      md: "h-10",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export function Button() { return null; }
`
  );
}

async function writeSharedExportFixtures(rootDir) {
  await writeFixtureFile(
    rootDir,
    "packages/ui/src/index.ts",
    `export { Button, buttonVariants } from "./button";
export { PublicThing } from "./mixed";
export * from "./toast";
`
  );
}

async function writeMixedFixture(rootDir) {
  await writeFixtureFile(
    rootDir,
    "packages/ui/src/mixed.tsx",
    `export function PublicThing() { return null; }
export function HiddenThing() { return null; }
`
  );
}

async function writeToastFixture(rootDir) {
  await writeFixtureFile(
    rootDir,
    "packages/ui/src/toast.ts",
    `export type ToastOptions = { title: string };
export { toast as projectWingToast } from "sonner";
`
  );
}

async function writeSharedStyleFixture(rootDir) {
  await writeFixtureFile(
    rootDir,
    "packages/ui/src/styles.css",
    `@import "tailwindcss";
@theme inline {
  --color-theme: var(--color-primary);
}
:root {
  --color-primary: #123456;
  --space-sm: 8px;
}
`
  );
}

async function writeAppComponentFixtures(rootDir) {
  await writeFixtureFile(
    rootDir,
    "apps/emp/src/components/dialog.tsx",
    `import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as React from "react";

export const Dialog = BaseDialog;
`
  );
}

async function writeAppStyleFixture(rootDir) {
  await writeFixtureFile(
    rootDir,
    "apps/emp/src/content/guide.mdx",
    "# Generated-content fixture\n"
  );
  await writeFixtureFile(
    rootDir,
    "apps/emp/src/components/context-menu.tsx",
    `export function ContextMenu() { return null; }
`
  );
  await writeFixtureFile(
    rootDir,
    "apps/emp/src/page.tsx",
    `import { Button as PrimaryButton, projectWingToast as toast } from "@project-wing/ui";
import { Dialog } from "@/components/dialog";
import { MissingLocal } from "@/components/missing";
import { Missing } from "@missing/ui";
import guide from "./content/guide.mdx?collection=docs";
import "./globals.css?layer=app";
import "./missing-side-effect.css";

export function Page() { toast(); return <><PrimaryButton /><Dialog /><MissingLocal /><Missing />{guide}</>; }
`
  );
  await writeFixtureFile(
    rootDir,
    "apps/emp/src/globals.css",
    `.dark {
  --color-primary: #abcdef;
  --color-danger: var(--color-primary);
  --font-sans:
    Inter, sans-serif;
  --chart: var(--color-blue-300);
  color: #ff0000;
  border-color: blue;
  background: oklch(0.5 0.1 30);
}
`
  );
}

async function createFixture() {
  const rootDir = await mkdtemp(join(tmpdir(), "project-wing-provenance-"));
  await writeManifestFixtures(rootDir);
  await writeButtonFixture(rootDir);
  await writeSharedExportFixtures(rootDir);
  await writeMixedFixture(rootDir);
  await writeToastFixture(rootDir);
  await writeSharedStyleFixture(rootDir);
  await writeAppComponentFixtures(rootDir);
  await writeAppStyleFixture(rootDir);
  return {
    rootDir,
    configPath: join(rootDir, "provenance.config.json"),
  };
}

export async function withFixture(callback) {
  const fixture = await createFixture();
  try {
    return await callback(fixture);
  } finally {
    await rm(fixture.rootDir, { recursive: true, force: true });
  }
}
