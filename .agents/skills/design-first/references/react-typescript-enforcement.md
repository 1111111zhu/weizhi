# React and TypeScript enforcement

Use these patterns when the target project is React-based. Adapt names to existing repository conventions instead of forcing this exact tree.

## Recommended dependency shape

```text
src/
  design-system/
    foundations/
    primitives/
    patterns/
    layouts/
    index.ts
  features/
  pages/ or app/
  showcase/
```

Expose product-safe APIs through `design-system/index.ts`. Product and feature files should normally import from `@/design-system`, not deep paths. Keep third-party UI imports inside `design-system/**` or narrowly scoped integration files.

Set the registry's `project.publicEntry` and component `publicExport` values to match this real boundary. A component is not `Ready` merely because its source file exists.

Do not re-export an entire third-party library. Wrap or adapt its components so product code depends on stable, semantic project APIs.

## ESLint boundary example

Discover the actual UI dependencies from `package.json` and the existing code. Add them explicitly to the restriction instead of copying placeholders blindly.

With flat ESLint configuration, use an override similar to:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/design-system/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "UNDERLYING_UI_PACKAGE",
            message: "Import UI through @/design-system."
          }
        ],
        patterns: [
          {
            group: ["UNDERLYING_UI_PACKAGE/*"],
            message: "Import UI through @/design-system."
          },
          {
            group: ["@/design-system/*"],
            message: "Use the design-system public entry point."
          }
        ]
      }
    ]
  }
}
```

If the project already has layered-boundary tooling, extend that configuration instead of adding a competing mechanism. Permit documented setup files only when the UI library requires top-level providers, CSS imports, or build integration.

For the strongest boundary, place the design system in a separate workspace package. Declare the underlying UI library only in that package and expose product-safe modules with `package.json` `exports`. Product packages should not be able to resolve the underlying library or internal design-system modules.

## Token enforcement

- Define foundations with CSS custom properties, a typed theme, or the framework's token mechanism.
- Map utility-framework configuration to semantic tokens.
- Avoid arbitrary-value utilities such as one-off colors and pixel values in product code.
- Prefer component variants over long repeated class strings in pages.
- Search for hex, rgb/hsl, arbitrary utility syntax, inline styles, and duplicated class groups during the audit. Review matches rather than assuming every match is wrong.

## Component API guidance

Use [component-api-contract.md](component-api-contract.md) as the normative contract. The points below are React-specific reminders.

- Name variants by intent: `primary`, `quiet`, `danger`, `success`.
- Keep layout responsibility clear. A primitive should not know the page it appears on.
- Forward accessibility attributes and refs when the underlying platform requires them.
- Preserve escape hatches sparingly. A universal `className` prop must not become the normal way to bypass the system.
- Separate business semantics from visual semantics. For example, an `InvoiceStatus` domain component may use design-system Badge and Tooltip primitives without becoming a generic primitive itself.

## Verification searches

Use repository search to inspect:

```text
imports from known UI packages outside design-system
deep imports from the design-system implementation
native button, input, select, textarea, dialog, and table elements outside the system
hex, rgb, hsl, and arbitrary-value utility syntax
inline style objects in product components
duplicated button, panel, modal, toolbar, and page-shell implementations
showcase CSS selectors that name product concepts rather than documentation chrome
```

Combine search results with lint, typecheck, tests, build output, and rendered inspection. Search alone is not proof of a violation.

Configure and run the native Node boundary audit for deterministic line-level checks. Treat its local-component-name findings as review prompts; treat direct library imports, deep imports, raw controls, and unapproved raw styles as CI errors.
