# Mobile confirmation center — implementation and verification

## Scope

Implemented in the real EMP application on `codex/mobile-app-experience`, not the port-3047 showroom. The user approved the project-list → confirmation-list → existing confirmation-workspace flow and then requested a cleaner detail toolbar. Desktop presentation is retained above the phone breakpoint.

The design-first approach here reuses the existing Material 3 tokens and public MobileScaffold, MobilePageHeader, MobileListItem, MobileActionSheet, ViewSwitcher, Button and CollectionState APIs. New compositions are confirmation-domain code; no additional UI dependency, global theme, or parallel prototype was introduced.

## Changes

- `views/confirmations.tsx`: mounts the phone composition while retaining the original desktop table/sidebar, queries, sorting and scope filtering.
- `confirmation-center-mobile`: project cards with status drill-down, search, sorting sheet, project-specific list, loading/error/retry, progressive project display and URL-backed navigation. Return URLs preserve the selected project.
- `confirmation-library-mobile`: phone record presentation for template, information and response libraries. Owner-supplied filters, permission-aware actions and bulk selection remain available; empty lists no longer mount a wide table or pagination row.
- `project-confirmations-panel`: reuses the same business content in a phone column; category navigation moves to a sheet. Desktop resizable panels remain.
- `confirmation-workflow-tracker`: a denser phone timeline, scoped through the project mobile stylesheet.
- Detail toolbar: equal-width stage tabs; category selection moves to a menu only when reclassification is allowed; the duplicate disabled `BANK` selector is absent on a frozen phone record. Template selection opens a bottom sheet. Bank lookup and document actions fit within the available width; secondary document operations move to a sheet without changing their disabled rules.
- `mock-confirmation-library`: supplies the previously absent general-fields, layout, information-library and project-defaults methods. Local changes use the existing Mock store, permission checks and audit mechanism. Production API implementations and backend persistence were not changed.

## Interactive verification

Environment: actual EMP in local **Mock mode**, headed Chrome through Playwright CLI session `intranet-live-mobile`; viewport widths 320 and 390, desktop 1440. The existing development account and Orchid fixture were used. No business document was published, uploaded, deleted or dispatched during browser checks. The Android emulator was not taken over after the user stopped Computer Use.

Routes exercised:

1. `http://127.0.0.1:3048/zh-CN/confirmations`
2. Open Orchid → open HSBC confirmation → return to the same project list. The encoded `returnTo` and restored project hash were verified.
3. Open template library, information library and response warehouse, then back.
4. Switch between the confirmation document and tracking tabs.
5. Check light/dark center appearance and return to desktop table/sidebar.

Observed results:

- Project center and library pages had no document-level horizontal overflow at the checked phone widths. Template and response phone lists mounted no table.
- The phone navigation selector appeared at the bottom of the viewport.
- The three detail tabs measured equal widths, approximately 119.4px each, with 44px touch targets at 390px.
- Detail action region `scrollWidth === clientWidth`: 366px at 390px viewport, 296px at 320px. The unwanted horizontal toolbar scrollbar is gone.
- Desktop still mounted the confirmation table and navigation sidebar.
- The missing-query-function/library-loading failures no longer appeared on the checked local paths. The unavailable Desktop Agent manifest at `localhost:3000` still logs a connection error; a clean console is not claimed.

Artifacts under `output/playwright/`:

- `emp-confirmations-mobile-320.png`, `emp-confirmations-mobile-390.png`
- `emp-confirmations-mobile-dark.png`, `emp-confirmations-desktop-preserved.png`
- `emp-confirmation-list-mobile-updated.png`
- `emp-confirmation-information-mobile-updated.png`
- `emp-confirmation-templates-mobile-updated.png`
- `emp-confirmation-responses-mobile-updated.png`
- `emp-confirmation-toolbar-tracking.png`
- `emp-confirmation-toolbar-document.png`, `emp-confirmation-toolbar-320.png`

## Commands and results

Commands ran from `D:\Project_wing\.worktrees\mobile-app-experience` using the existing bundled Node runtime and pnpm workspaces.

Type check and registry validation passed:

```powershell
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
```

Production compilation of the Mock configuration passed, including TypeScript and 77 generated pages. A separate output directory kept development available:

```powershell
$env:NEXT_DIST_DIR = '.next/emp-mobile-confirmations-build'
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/emp build
```

Focused tests:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-center-mobile.test.tsx src/api/mock-confirmation-library.test.ts src/views/confirmations.test.tsx src/components/confirmations/confirmation-information-library.test.tsx src/components/confirmation-response-warehouse.test.tsx src/components/project-confirmation-template-library.test.tsx --maxWorkers=1
```

101 passed at the initial center/library checkpoint.

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/api/mock-confirmation-library.test.ts src/components/confirmations/confirmation-center-mobile.test.tsx src/components/confirmations/confirmation-library-mobile.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/views/workspace.test.tsx -t 'returns to the folder|returns confirmation workspaces|preserves the mobile confirmation|does not load project file APIs' --maxWorkers=1
```

13 passed; 4 passed with 65 unrelated workspace cases skipped, respectively.

The editor's new mobile tests cover template selection through a sheet, the custom-upload callback and preserved read-only restrictions. The existing editor test mock was extended to retain real public UI exports. Formatter-made no-argument save assertions were replaced with explicit expected payload checks, not relaxed assertions. Final targeted editor rerun: 4 passed, 97 unrelated editor cases skipped:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/project-confirmation-editor-mobile.test.tsx src/components/confirmations/project-confirmation-editor.test.tsx -t 'mobile confirmation editor toolbar|blocks submission until a required checkbox|binds multiline fields to project and confirmation information' --maxWorkers=1
```

The center/library changes passed `ultracite check` over the 19 touched files. The later toolbar-specific scoped check also passed:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/confirmations/project-confirmation-editor-mobile.test.tsx apps/emp/src/components/confirmations/confirmation-project-mobile.module.css apps/emp/src/components/confirmations/project-confirmation-editor.module.css apps/emp/src/components/project-confirmations-panel.tsx
```

Full lint of the large existing editor and its existing test file does **not** pass: unused declarations, shadowed variables, effect dependencies, accessibility and legacy test-style findings remain outside the changed toolbar sections. They were not suppressed or represented as passing.

## Outstanding verification / limitations

- Project-panel regression run: 107 of 111 passed; four PDF cases failed again in an isolated rerun. Three assert a single `File` while the current upload call supplies `File[]`; one cannot find the expected response-preview label. The upload/preview behavior was not rewritten to force these tests to pass.
- Actual backend-attached upload, dispatch, restore, cross-user permissions and populated library acceptance remain required. The running Mock libraries have no user-provided bank/template/response records; automated tests provide the corresponding record/action coverage.
- Template design workbench, all confirmation categories and every lifecycle state were not exhaustively exercised on a real phone.
- No root-wide test run, remote deployment, push or merge was performed.
- The previously reported Intranet Fluent-dialog accessibility/focus issue is separate and remains outstanding; this change does not claim to resolve it.

## Follow-up: project-internal register

The project-internal register also now has a phone presentation, not merely the organization-level center. This addresses the follow-up screenshot showing a cramped multi-column register and permanent pagination on a one-record page.

The same controller still owns filtering, paging, selection and mutation callbacks. Below 768px it uses the existing confirmation mobile list composition: counterparty and responding-entity names have the full row width; code, type and status form a secondary line. Dates and waiting time remain in the record's details sheet. Renaming has explicit Save/Cancel and cancels when its sheet closes. Read-only and in-flight lifecycle restrictions remain enforced.

Sorting, all existing column filters and page size are accessible in bottom sheets. Batch mode exposes its selection and confirmation controls after closing the menu; page changes clear selected rows. One-page lists have no pagination bar. The original desktop DataGrid, column renderers and pagination remain.

Files for this follow-up:

- `apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx`
- `apps/emp/src/components/confirmations/confirmation-register-mobile.module.css`
- `apps/emp/src/components/confirmations/confirmation-register-mobile.test.tsx`
- `apps/emp/src/components/confirmations/confirmation-library-mobile.tsx`
- `apps/emp/src/i18n/confirmation-register-mobile.ts`

Validation commands (same worktree/runtime as above):

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx apps/emp/src/components/confirmations/confirmation-register-mobile.test.tsx apps/emp/src/components/confirmations/confirmation-register-mobile.module.css apps/emp/src/components/confirmations/confirmation-library-mobile.tsx apps/emp/src/i18n/confirmation-register-mobile.ts
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-register-mobile.test.tsx src/components/confirmations/confirmation-register-model.test.ts src/components/confirmations/confirmation-library-mobile.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx -t 'uses the active confirmation category|moves lifecycle actions|keeps failed confirmations selected|uses toolbar selection mode|fluid DataGrid|right scroll owner|returns to the register|searches the visible fallback' --maxWorkers=1
```

Scoped lint, type checking and registry validation passed. Desktop-focused regressions: 8 passed, 103 unrelated cases skipped. The isolated phone register suite passed all 8 cases, including sorting, rename cancellation, filters, read-only state, restore, batch selection and pagination. The combined final register/model/library run passed all 14 tests across 3 files.

The same `NEXT_DIST_DIR=.next/emp-mobile-confirmations-build`, `NEXT_PUBLIC_API_MODE=mock` production build was rerun and passed with 77 pages.

Interactive checks used the actual project confirmation workspace at `http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026?workspace=confirmations`. Exercised category filtering, record details, sorting and batch selection followed by cancellation. No delete/restore/rename business mutation was submitted in the browser. Checked 320px/390px without horizontal overflow, dark appearance, and the preserved desktop table at 1440px. This remains local Mock verification, not backend-attached acceptance; the earlier unrelated PDF/lint findings above were not rerun or reclassified as passing.

Additional screenshots in `output/playwright/`:

- `emp-register-mobile-320.png`, `emp-register-mobile-390.png`
- `emp-register-mobile-dark.png`, `emp-register-desktop-preserved.png`
- `emp-register-mobile-controls.png`, `emp-register-mobile-filter.png`
- `emp-register-mobile-details.png`

## Follow-up: overview layout and display controls

The phone overview no longer mounts the wide sticky-column matrix. It provides a full-width category selector, six primary stage metrics and the total, with sent-aging and received-detail metrics in bottom sheets. Every existing category, subtype, unclassified scope and metric remains selectable. This is a presentation change only: both layouts use the original `buildMatrixRows`, `formatValue`, count/intensity helpers and `onCellSelect` contract. Percentages still use the selected row's total; an empty denominator displays a dash.

Count/Percentage now use the existing public SegmentedButtonGroup with equal touch targets and a bounded selected state. The phone legend has its own localized sheet instead of the generic English overflow menu. Legend content is shared with desktop, while phone swatches use the same semantic color roles as its metric tiles. Desktop table sizing, grouping, toggles and calculations are retained. All new layout rules are phone-scoped; no public component or dependency was added.

Changed files:

- `apps/emp/src/components/confirmations/confirmation-overview-matrix.tsx`
- `apps/emp/src/components/confirmations/confirmation-overview-mobile.module.css`
- `apps/emp/src/components/confirmations/confirmation-overview-mobile.test.tsx`
- `apps/emp/src/i18n/confirmation-overview-mobile.ts`

Validation:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/confirmations/confirmation-overview-matrix.tsx apps/emp/src/components/confirmations/confirmation-overview-mobile.test.tsx apps/emp/src/components/confirmations/confirmation-overview-mobile.module.css apps/emp/src/i18n/confirmation-overview-mobile.ts
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-overview-mobile.test.tsx src/components/confirmations/confirmation-overview-matrix.test.tsx src/components/confirmations/confirmation-overview-matrix-styles.test.ts src/components/confirmations/confirmation-register-model.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx -t 'shows a project overview computed|navigates from a matrix cell' --maxWorkers=1
```

Scoped lint, type check and registry validation passed. The first test command passed 16 tests; the integration selection passed 2, with 109 unrelated cases skipped. The existing Mock production build command was rerun successfully with 77 generated pages; its output remains `.next/emp-mobile-confirmations-build`.

Actual-app interactive path: Orchid project → Confirmation views / 函证目录 → Overview / 概览. Selected Bank, switched to percentages, opened the localized legend and the sent-aging sheet, and selected the 46+ day metric. The matching HSBC record appeared in the project register. No business data was mutated. At 320px and 390px there was no horizontal document overflow; the mode controls were equally sized, approximately 44px tall, and fully within their container. Dark appearance and the unchanged desktop matrix at 1440px were inspected.

Screenshots in `output/playwright/`: `emp-overview-mobile-320.png`, `emp-overview-mobile-390.png`, `emp-overview-mobile-dark.png`, `emp-overview-mobile-legend.png`, `emp-overview-mobile-aging.png`, and `emp-overview-desktop-preserved.png`.

This remains local Mock UI verification. Backend-attached acceptance and the earlier unrelated whole-editor/PDF findings were not rerun or declared passing by this scoped update.
