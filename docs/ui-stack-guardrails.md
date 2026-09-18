# UI Stack Guardrails

Frontend UI work must use the repo UI stack instead of ad hoc component systems. The guardrail covers these product frontends:

- `apps/emp`
- `apps/cmp`
- `apps/tms`
- `apps/ib`
- `apps/intranet`
- `apps/ui-showroom`

## Required Stack

- Next.js and TypeScript for application structure.
- shadcn/ui wrappers in each app's `src/components/ui` directory for UI primitives. ReUI primitives installed through the app-local shadcn CLI live in `src/components/reui` and are treated as the same wrapper layer.
- Select controls must use the app-local shadcn `Select` wrapper. Do not use `NativeSelect` in product UI.
- Base UI only inside shadcn wrapper components, shadcn-installed ReUI primitives, explicitly approved shared primitives, or the exact source files installed from an approved registry such as BeUI.
- Tailwind CSS v4 utilities and semantic CSS variables from each app's style entrypoint.
- `lucide-react` for icons.
- React Hook Form and Zod for form state and validation.

## Enforced Rules

`node scripts/ui-stack-guardrails.mjs` scans frontend source files and compares each finding with the checked-in baseline in `scripts/ui-stack-baseline.json`. Baseline v2 fingerprints the file, rule, and normalized evidence, then counts repeated occurrences of that exact fingerprint. Moving an unchanged finding to another line remains allowed, while replacing one legacy violation with a different violation in the same file fails even when the file's total finding count is unchanged. General linting and formatting are handled by Ultracite presets on Oxlint and Oxfmt.

Local pre-commit validates UI governance for matching production source, package manifest, guardrail, and baseline changes. After a frontend change reaches `main`, Deploy runs the same repository scan and monotonic baseline checks once through `scripts/ci/run-scoped-validation.sh`; there is no separate pull-request validation workflow.

The checked-in debt baseline is monotonic. `scripts/ui-stack-baseline-monotonic.mjs` compares the pull request's baseline with the event base by exact fingerprint and occurrence count. Existing entries may remain, decrease, or disappear; a new fingerprint, a higher occurrence count, moving debt to another file, or downgrading/removing the exact baseline structures fails even when the current repository scan would pass against the edited baseline. Local pre-commit compares with `HEAD`, and remote CI compares with the pull request base SHA.

The broader DesignFirst boundary scan has its own exact low-water mark in `scripts/design-first-baseline.json`. `scripts/design-first-baseline.mjs` fingerprints normalized `path + rule + message` evidence while ignoring line numbers and preserving occurrence counts. The checked-in baseline must exactly equal the current scan, and it must not grow relative to the pull request base. This blocks a new finding, a duplicated occurrence, or a one-for-one replacement even when the aggregate warning count stays flat. The same workflow runs for matching `main` pushes as a post-merge integrity check.

The guardrail scanner preserves the previous rule categories:

- `no-restricted-imports` blocks direct imports from unapproved UI stacks.
- `no-restricted-syntax` blocks native JSX controls, inline `style=`, and raw hex color literals.
- The guardrail wrapper independently scans native interactive/form controls so `<button>`, `<input>`, `<select>`, and `<textarea>` cannot slip through as new product UI debt.
- The guardrail wrapper scans date selection controls. New date selection UI must compose the app-local shadcn `Calendar` directly with `captionLayout="dropdown"` for month/year selection and a bottom Today/今日/roday action.
- The guardrail wrapper adds a component-level scan for nested shadcn `Card` composition, card-like shadow surfaces inside a `Card`, and shadcn `Card` components inside overlay content such as `DialogContent` and `SheetContent`, including local wrapper components that return `Card`.
- The guardrail wrapper also scans for adjacent shadcn `Button` components that are not composed through `ButtonGroup` or `TabsList`.
- The guardrail wrapper blocks known decorative title copy keys in product TSX during local pre-commit. Add a title only when it identifies content not already established by the route, selected item, or nearby control. This semantic guard is intentionally skipped in GitHub Actions to avoid consuming CI minutes.
- The guardrail wrapper reports `i18n-static-copy` for static JSX text, user-visible attributes, values routed through JSX variables, and user-visible TypeScript view-model fields outside an app's `src/i18n` module. It covers every product frontend and uses a fingerprint baseline, so replacing or adding hardcoded copy fails before legacy copy is migrated.

The guardrails currently block new instances of:

- Direct imports from alternative UI stacks such as Radix, MUI, Chakra, Headless UI, Heroicons, Ant Design, and react-icons. Radix UI is prohibited repository-wide, including both `radix-ui` and `@radix-ui/*` packages.
- Direct Base UI imports outside app-local `src/components/ui` wrappers or shadcn-installed `src/components/reui` primitives. When a primitive is required, Base UI is the preferred implementation.
- The scanner treats only explicitly registered BeUI component source files as vendored wrapper code. It does not exempt arbitrary files in the same directory, so product UI remains subject to the normal stack rules.
- Native `<button>`, `<input>`, `<select>`, and `<textarea>` controls in product UI outside shadcn wrapper files, including hidden file inputs. Use shadcn `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, and related wrappers instead.
- `NativeSelect` wrapper imports in product UI; use the shadcn `Select` wrapper instead.
- Date picker wrappers, native date inputs, and custom date picker components in product UI. Use shadcn `Calendar` directly, enable month/year selection with `captionLayout="dropdown"`, and include a bottom Today/今日/roday action.
- Inline `style=` usage in product UI.
- Raw hex color literals in product UI source.
- Nested shadcn `<Card>` components, card-like shadow surfaces inside a `Card`, and shadcn `<Card>` components inside overlay content in product UI. Use unframed layout, `Separator`, `FieldGroup`, or a non-card section instead.
- Adjacent shadcn `<Button>` components in product UI. Use `ButtonGroup` for grouped actions and `Tabs`/`TabsList`/`TabsTrigger` for mutually exclusive option sets.
- Deprecated decorative copy keys such as `projectsViewTitle` and `directoryTitle` in product TSX. The rule protects against reintroducing removed, context-free titles; it does not replace design review for new title semantics.
- New hardcoded Chinese or English UI copy. Put static copy in the owning app's i18n module. Use Title Case for short English labels and sentence case for full prose; do not mechanically transform product names, acronyms, or user data.
- Unsupported UI dependencies in frontend package manifests, including every Radix UI package.

The baseline is a debt freeze, not an allowlist for new work. Existing entries may remain temporarily, but new UI work should reduce the baseline over time. The aggregate per-file counts remain in baseline v2 for reporting and compatibility; the exact fingerprint baseline is the merge gate.

## Local Workflow

Run the guardrails directly:

```bash
corepack pnpm test:ui-stack
```

Run the guardrail unit tests:

```bash
corepack pnpm test:ui-stack:logic
```

Run the exact DesignFirst baseline check:

```bash
node scripts/design-first-baseline.mjs
```

The normal pre-commit gate also runs the guardrails when staged changes touch any frontend app, shared contracts, root package configuration, or the guardrail files:

```bash
corepack pnpm test:precommit
```

## Updating The Baseline

Only update the baseline when intentionally removing, reclassifying, or accepting existing debt as part of a reviewed change:

```bash
node scripts/ui-stack-guardrails.mjs --update-baseline
node scripts/design-first-baseline.mjs --update-baseline
```

The update commands remove fingerprints that no longer exist, so fixed debt cannot be reintroduced silently. Review both baseline diffs together with the product change. Do not update a baseline to make new custom UI pass; replace the new UI with repo primitives instead. DesignFirst baseline updates are additionally compared with the event base, so a new fingerprint or higher occurrence count remains blocked after regeneration.

## Common Alternatives

Common repository-level solutions include linter restricted imports, AST syntax selectors, custom rules, dependency boundary tools, and CI checks. This repo uses Oxlint/Oxfmt for general code quality and a small Node scanner for baseline comparison plus package manifest dependency checks.
