import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

import { auditedRuleOverrides } from "./oxlint.audited-exceptions.ts";

const vitestWithExplicitImports = {
  ...vitest,
  overrides: vitest.overrides?.map((override) => ({
    ...override,
    rules: {
      ...override.rules,
      "vitest/prefer-import-in-mock": "off",
      "vitest/prefer-importing-vitest-globals": "off",
    },
  })),
};

export default defineConfig({
  extends: [core, react, next, vitestWithExplicitImports],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "apps/emp/public/libarchive.js/worker-bundle.js",
    "**/*.d.ts",
  ],
  rules: {
    // Project conventions: declarations and intentional hoisting are used
    // Throughout the NestJS and React codebases.
    "func-style": "off",
    "no-use-before-define": "off",
    "react/function-component-definition": "off",
    "class-methods-use-this": "off",
    complexity: "off",
    "no-await-in-loop": "off",
    "no-bitwise": "off",
    "no-empty-function": "off",
    "no-nested-ternary": "off",
    "prefer-named-capture-group": "off",
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
    "react/no-unstable-nested-components": "off",
    // The React Compiler plugin reports its own unsupported HIR branches (for
    // example finally clauses and computed destructuring) as this TODO rule.
    "react/todo": "off",
    "require-unicode-regexp": "off",
    "typescript/parameter-properties": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-reduce": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-nested-ternary": "off",
    // These lists are also consumed for stable display/order semantics; do not
    // Replace them with Sets merely to optimize membership checks.
    "unicorn/prefer-set-has": "off",
    // `noUncheckedIndexedAccess` makes `.at(-1)` unnecessarily widen fixed
    // Option tuples; direct indexing preserves the known tuple element type.
    "unicorn/prefer-at": "off",
    // The codebase uses type aliases for data contracts, including mapped
    // Object contracts that are intentionally cast after Object.fromEntries.
    "typescript/consistent-type-definitions": "off",

    // Object key order can be part of serialized/API contracts; assertion
    // Count and mock generic verbosity do not improve these tests.
    "sort-keys": "off",
    "vitest/consistent-test-filename": "off",
    "vitest/max-expects": "off",
    // Type-only dynamic-import mocks caused factories to merge real modules,
    // leaking providers, timers, and network clients into isolated tests.
    "vitest/prefer-import-in-mock": "off",
    "vitest/prefer-importing-vitest-globals": "off",
    // Requiring generic parameters on every vi.fn/vi.spyOn call adds thousands
    // of annotations without improving the inferred mock signatures.
    "vitest/require-mock-type-parameters": "off",
  },
  overrides: [
    {
      files: ["apps/api/src/**/*.ts"],
      rules: {
        // Nest uses emitted design:paramtypes metadata for constructor
        // injection. Type-only imports erase those provider classes at
        // runtime, so automatic consistent-type-import fixes are unsafe here.
        "import/consistent-type-specifier-style": "off",
        "typescript/consistent-type-imports": "off",
      },
    },
    {
      files: [
        "**/*.{test,spec}.{ts,tsx,js,jsx}",
        "**/__tests__/**/*.{ts,tsx,js,jsx}",
      ],
      plugins: ["vitest"],
      rules: {
        "vitest/consistent-test-filename": "off",
        "vitest/max-expects": "off",
        "vitest/prefer-import-in-mock": "off",
        "vitest/prefer-importing-vitest-globals": "off",
        "vitest/require-mock-type-parameters": "off",
      },
    },
    ...auditedRuleOverrides,
  ],
});
