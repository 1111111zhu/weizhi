# Mobile Material 3 implementation record

Date: 2026-09-11. Status: implemented mobile foundation; experimental visual adoption, not global Ready approval or deployment.

## Scope and desktop protection

The user's latest instruction explicitly restricts this refactor to mobile. Next.js, React, routes, API contracts, state, permissions and business operations remain in place. No Flutter/Dart migration or external Material component library was added.

`material3-tokens.css` and `material3-components.css` contain only `(width < 48rem)` rules. Their tests reject any trailing desktop-active rule. Runtime theme/Snackbar adaptations use the compact viewport. The original `color-palette.css`, shared Button defaults and application global styles were restored after the scope clarification; Git reports no content difference for those desktop defaults. Existing earlier mobile work in this worktree is preserved. This is responsive presentation of the shared components, not duplicated application primitives.

The Material foundation follows [Material foundations](https://m3.material.io/foundations/) and the semantic [Material 3 ColorScheme](https://developer.android.com/reference/kotlin/androidx/compose/material3/ColorScheme). Product density and document semantics take precedence over decorative cards or large consumer-app controls.

## Repository inventory

The repository uses pnpm workspaces, Next.js App Router, React/TypeScript, Tailwind, Base UI, shared `@project-wing/ui`, Vitest and application-specific CSS. Intranet additionally uses Fluent UI; it now maps its mobile theme to shared semantic variables without replacing that dependency. Existing shared preview, grid, form, settings, navigation and overlay implementations remain canonical.

`node scripts/design-first/material-inventory.mjs --summary` scans the frontend source inventory, CSS declarations, hard-coded color occurrences, route/layout files and shared imports. The initial result is retained in `material3-inventory-before.json`. Counts describe source occurrences, not verified business workflows:

| Scope           | Source files | Route/layout files | Raw color occurrences |
| --------------- | -----------: | -----------------: | --------------------: |
| EMP             |          312 |                 30 |                    87 |
| CMP             |          196 |                 41 |                     1 |
| TMS             |           55 |                  5 |                     7 |
| Intranet        |           57 |                  7 |                     1 |
| IB              |            9 |                  2 |                     0 |
| UI Showroom     |          288 |                 19 |                  1940 |
| Shared UI       |          108 |                  — |                   347 |
| Document viewer |           27 |                  — |                    43 |

The scan found 161 repeated style declarations. Showroom counts include deliberate theme/demo metadata. Desktop-only legacy CSS is intentionally not cleaned up under this mobile-only instruction. Document rendering colors are not blindly converted into application UI colors.

## Unified mobile presentation

Three-application follow-up: [CMP, TMS and Intranet mobile adoption](mobile-enterprise-adoption.md), including the opt-in selector surface, responsive dialog adapters and hands-on verification.

Follow-up: [mobile density refinement and Android hands-on verification](mobile-material3-refinement.md), including full-surface choices, fixed mobile saving, stable sheet headers and known rich-text identity limitations.

- `packages/ui/src/material3-tokens.css`: independent light/dark semantic surface levels; primary deep green, secondary muted green, tertiary blue-gray; outline/error and success/warning/info roles; on-color pairs; typography, spacing, shapes, border, elevation, layer and motion tokens. Legacy variable names are compatibility aliases to the same mobile roles, not a competing mobile palette.
- `packages/ui/src/material3-components.css`: shared controls, state layers, selected/disabled/error/focus feedback, menus/dialogs, table surfaces, navigation, FAB and Snackbar presentation. Motion uses restrained 120–250ms timing and reduced-motion support. Dense/virtual grid geometry remains grid-owned.
- `mobile-color-palette.css`: replaces the earlier independent phone palette with the shared Material token entry. `mobile-material.css` exposes a plain CSS entry for IB.
- `MaterialSurface`, `SegmentedButtonGroup`, `FloatingActionButton`: public shared composition APIs. Segments use Base UI keyboard navigation, controlled selection, disabled/loading/error semantics and descriptive relationships. Existing Button provides async/disabled behavior; it is not reimplemented per application.
- EMP SmartForm uses the segmented control only in its mobile layout. Existing desktop Tabs, document content, schema-driven mobile projection and bottom input sheets remain unchanged in behavior.
- Intranet maps Fluent mobile surfaces, typography and strokes to the shared palette. Its desktop theme objects remain unchanged by default.
- CMP and TMS inherit shared mobile controls/surfaces while retaining enterprise table columns, horizontal table scrolling and actions.
- IB imports the internal shared CSS package; its existing placeholder stays a placeholder. No client-collaboration features were invented.
- Snackbar is bottom-center on mobile and remains top-center on desktop.

Showroom: `/specimens/MobileMaterialSystem`, also linked from `/mobile`. It has real controlled filtering, input, error/disabled/loading states, a shared data grid, bottom-sheet editing and Snackbar feedback. New registry entries remain `experimental`.

## Local verification

All commands ran in `D:\Project_wing\.worktrees\mobile-app-experience`, branch `codex/mobile-app-experience`. Previews use local mock API mode; no remote deployment, commit, push or merge was performed.

### Passed

- Final six-app build pass: with the same mock/output-directory environment, `corepack pnpm --filter @project-wing/emp --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ib --filter @project-wing/ui-showroom --workspace-concurrency=1 -r build` exited 0. The last touch-target token polish was verified by the subsequent browser/targeted test run; no business code changed during this pass.

- `corepack pnpm --filter @project-wing/ui test --maxWorkers=2`: final full UI suite, 34 files and 263 tests passed.

- `corepack pnpm --filter @project-wing/ui exec vitest run src/material-controls.test.tsx src/mobile-color-palette.test.ts`: 8 tests, including mobile-only CSS scope, light/dark tone contrast, controlled/keyboard selection and loading/error accessibility.
- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-mobile-sheet.test.ts src/components/smart-form-v2-mobile-records.test.tsx`: 7 tests.
- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-directory.test.tsx --maxWorkers=1`: 65 tests after repairing dependency peer links.
- `corepack pnpm --filter @project-wing/cmp test --maxWorkers=2`: 48 files, 299 tests.
- `corepack pnpm --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ib --workspace-concurrency=1 -r test --maxWorkers=2`: TMS 236 tests; Intranet 47 tests; IB has no test files and exits successfully with `--passWithNoTests` (not test coverage).
- `corepack pnpm --filter @project-wing/ui --filter @project-wing/emp --filter @project-wing/ui-showroom -r exec tsc --noEmit`, plus the equivalent CMP/TMS/Intranet/IB typecheck: exit 0.
- `corepack pnpm exec ultracite check packages/ui/src/material-controls.tsx packages/ui/src/material-controls.test.tsx packages/ui/src/mobile-color-palette.test.ts apps/ui-showroom/components/showroom/specimens/mobile-material-system.tsx apps/intranet/src/components/intranet-fluent-provider.tsx`: passed.
- `node scripts/design-first/cli.mjs validate-registry`: passed. Scoped `runAudit` over Material controls/tokens/component styles/showroom/Intranet provider: zero findings; no baseline relaxed.
- With `NEXT_DIST_DIR=.next/material-mobile-build` and `NEXT_PUBLIC_API_MODE=mock`, `corepack pnpm --filter @project-wing/emp build` and `corepack pnpm --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ib --filter @project-wing/ui-showroom --workspace-concurrency=1 -r build`: all six builds passed. CMP/TMS/Intranet now honor the optional output-directory variable, with the normal default unchanged. IB uses its normal build directory.

### Not green / not claimed complete

- `corepack pnpm lint`: fails existing repository-wide formatting/lint findings across unrelated code/docs/CI/native modules. These were not mass-rewritten.
- `corepack pnpm test`: stops at the volatile-assertion guard with 70 findings; tests were not weakened or baselines refreshed.
- Full scoped frontend tests reached EMP: 1797 passed, 5 failed, 2 skipped. Four failures are unchanged confirmation-panel workflows; the fifth is the Chinese-copy guard. The mobile fixture's offending copy was moved into the existing dictionary ownership; a targeted rerun of `src/i18n/no-hardcoded-chinese.test.ts` now identifies only six untouched confirmation/PDF-note modules and still fails. This does not establish those four business failures as harmless; they need separate diagnosis.
- One attempted i18n command used a nonexistent `src/views/workbench/...` path and found no tests; it was rerun at the actual `src/i18n/...` path above.
- Showroom production build reports an existing broad filesystem trace in `pdf-template-fonts/[fileName]/route.ts`. No suppression or unrelated route rewrite was added.
- CMP/Intranet mock root redirects can emit Next development instant-navigation diagnostics. Leaf pages rendered, and production builds passed; no routing behavior was altered to hide the diagnostic.

### Dependency diagnostic

Adding IB's internal UI dependency exposed inconsistent generated DnD peer links (React 19.2.6 core and 19.2.8 accessibility/utilities), causing invalid-hook test failures. The original lockfile peer relationships were restored without globally changing React versions. Offline frozen installs were run; two stale generated junctions were then backed up and relinked to the matching 19.2.6 peers. Core/utilities/accessibility resolve the same React instance afterward, and affected EMP/CMP tests pass. Recoverable old junctions are in `output/dependency-link-repair-2343c6edd3e0473ba3d3b10e0aaa3e5c`; no source or business data was deleted.

## Interactive evidence and limitations

Chrome Playwright session `smartform-mobile`, local running applications:

- Showroom `3047/specimens/MobileMaterialSystem`: phone light/dark, status filter, editable bottom sheet, completion Snackbar, no whole-page overflow.
- A separate Chromium mobile/touch context (`isMobile`, `hasTouch`, 412px) verifies at least 44 CSS-pixel layout height for the primary action. The target token has a pixel floor so user font-size settings cannot shrink it below 44px. Finite animations are allowed to settle for evidence screenshots; native virtual keyboard behavior is still not claimed.
- EMP `3048/zh-CN/dev/smart-form-v2/deferred-income`: canonical SmartForm reference, not a static recreated document.
- CMP `3052/zh-CN/client`: mock manager login, phone client grid and 1440px desktop regression. Material primary token is absent at desktop width.
- TMS `3054/zh-CN/timesheet`: mock Partner login, phone table layout; table scrolling stays inside each table region.
- Intranet `3057/zh-CN`: mock Staff login, knowledge tabs/settings, phone light/dark and desktop token isolation.
- IB `3055/zh-CN`: production-built placeholder rendered at 360px with no page overflow; no PBC workflow exists to exercise.

Screenshots are under `output/playwright/material-*.png`; selected evidence is copied into `docs/evidence/mobile-app-experience/` after visual inspection.

Remaining acceptance: real backend workflows, native Android/iOS keyboard and safe-area behavior on actual devices, long real datasets, all permission combinations, and every application-specific legacy overlay. Browser viewport checks are not a substitute for native soft-keyboard verification. Some existing local controls still retain their original anatomy while adopting the new mobile semantic palette; this delivery is not a claim that every page has been individually redesigned or inspected. Desktop production behavior was not exhaustively end-to-end tested, but new token/rule scope and representative desktop pages were checked. No desktop visual migration is authorized.
