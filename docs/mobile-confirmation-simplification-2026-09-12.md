# EMP mobile confirmation refinement — 2026-09-12

## Scope and implementation

Actual application: `apps/emp`, worktree `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. No showroom/prototype implementation, new dependency, backend contract change, push or deployment.

This is a domain-specific adaptation of the existing mobile Material 3 direction. It reuses public `@project-wing/ui` buttons, inputs and sheets and existing semantic tokens; no new shared design-system primitive or approval state is introduced.

- Basic information: remove nested mobile card shells; group a bank's configured name/account/address fields together; one removal action per bank; hide removal controls for the last required row; focus newly added rows; support multiline mailing addresses. Labels, custom definitions, legacy bindings, read-only/saving locks and the existing defaults mutation remain in place. Mobile fallback uses the same field renderer when no configured layout is available. Desktop retains its original layout and controls.
- Directory: a `FolderTree` icon is integrated into the current mobile heading, instead of a separate “Confirmation views / 函证目录” row. The existing directory sheet, navigation callbacks and desktop sidebar remain. The current icon receives focus after directory dismissal/navigation. Confirmation detail includes the same directory action in its existing toolbar.
- Register: keep search and a simple status selector; remove the six-field mobile filter form, user-selectable sorting and page-size controls. Default to latest update and explicit “Load more”, preserving loaded rows and selection. Creation and lifecycle selection remain in a separate action sheet with existing permissions, confirmation dialogs and callbacks.
- Selected status appears directly in the status button, not in a second chip row. “All statuses” clears it. Other inherited filters (including overview age/outcome drilldowns and desktop filters) remain visible and individually removable, rather than silently affecting results.

## Validation commands and results

Commands ran from the worktree with bundled Node 24 on PATH:

```powershell
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
```

Scoped lint/format check: passed on these 15 touched files:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/confirmations/confirmation-base-information-layout.tsx apps/emp/src/components/confirmations/confirmation-base-information-layout.test.tsx apps/emp/src/components/confirmations/confirmation-base-information-fallback.ts apps/emp/src/components/confirmations/confirmation-base-information-mobile.module.css apps/emp/src/components/confirmations/confirmation-mobile-heading.tsx apps/emp/src/components/confirmations/confirmation-mobile-heading.test.tsx apps/emp/src/components/confirmations/confirmation-mobile-heading.module.css apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx apps/emp/src/components/confirmations/confirmation-register-mobile.test.tsx apps/emp/src/components/confirmations/confirmation-register-mobile.module.css apps/emp/src/components/confirmations/confirmation-library-mobile.tsx apps/emp/src/components/confirmations/confirmation-overview-matrix.tsx apps/emp/src/components/confirmations/confirmation-project-mobile.module.css apps/emp/src/components/project-confirmations-panel.tsx apps/emp/src/i18n/confirmation-register-mobile.ts
```

The three files changed by the final status-button follow-up were checked again and passed:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx apps/emp/src/components/confirmations/confirmation-register-mobile.test.tsx apps/emp/src/i18n/confirmation-register-mobile.ts
```

Type check and registry validation: passed. Final Mock production build: passed, 77 generated pages, separate output from the running dev server.

```powershell
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
$env:NEXT_DIST_DIR = '.next/emp-mobile-confirmations-build'
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/emp build
```

Targeted tests: 51 distinct tests passed across these commands (27 + 12 + 12; 100 unrelated panel tests skipped):

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-register-mobile.test.tsx src/components/confirmations/confirmation-overview-mobile.test.tsx src/components/confirmations/confirmation-base-information-layout.test.tsx src/components/confirmations/confirmation-library-mobile.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-mobile-heading.test.tsx src/components/confirmations/confirmation-register-model.test.ts src/components/confirmations/confirmation-overview-matrix.test.tsx src/components/confirmations/confirmation-overview-matrix-styles.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx -t 'opens base information below overview|only fills global fields|saves mobile base information|navigates from a matrix cell|uses the active confirmation category|moves lifecycle actions|keeps failed confirmations selected|uses toolbar selection mode|fluid DataGrid|right scroll owner|returns to the register|searches the visible fallback' --maxWorkers=1
```

After merging selected status into the button, the nine register tests were rerun and passed:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-register-mobile.test.tsx --maxWorkers=1
```

Whitespace check passed (only existing LF/CRLF conversion notices):

```powershell
git diff --check -- apps/emp/src/components/confirmations/confirmation-base-information-layout.tsx apps/emp/src/components/confirmations/confirmation-base-information-layout.test.tsx apps/emp/src/components/confirmations/confirmation-register-data-grid.tsx apps/emp/src/components/confirmations/confirmation-overview-matrix.tsx apps/emp/src/components/project-confirmations-panel.tsx apps/emp/src/components/project-confirmations-panel.test.tsx
```

Initial test-writing issues (incorrect English directory label, matchMedia test restoration and an unsupported role-query option) were corrected and rerun. They were test harness issues, not ignored failures. Existing unrelated PDF regression tests and whole-repository validation were not rerun. The existing large panel test file was not blanket-formatted/linted; its added integration scenario was typechecked and executed.

## Real application browser checks

Headed Chrome via Playwright CLI session `intranet-live-mobile`, tab 2:

`http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026?workspace=confirmations&returnTo=%2Fconfirmations`

This is the actual EMP app in **local Mock mode**, not the old port-3047 prototype. Android uses host alias `10.0.2.2:3048`. The emulator was not controlled during this verification.

Exercised:

- Basic information: add a second bank, edit its name/account/multiline address, remove that newly added unsaved bank and confirm the first is unchanged. No browser save or business mutation submitted.
- Directory icon → overview/base information/register, with icon and title in one 44px row.
- Register actions contain only creation and lifecycle selection, no sort/page-size/advanced filter controls.
- Status → Frozen: trigger displays “已冻结”, zero duplicate status chips; All statuses restores the record.
- Overview → sent aging → 46+ days: HSBC record appears, status shows in its button and aging remains an individually removable chip.
- 320px and 390px mobile widths, light and dark. Document width equals viewport; inputs retain 16px text and approximately 44px targets. Reduced-height form viewport was also inspected; this does not replace Android keyboard acceptance.
- 1440px desktop basic information remains the existing multi-column card layout, without the mobile directory icon or mobile save footer.

Screenshot evidence (all under `output/playwright/`):

- `emp-base-information-final-390.png`
- `emp-base-information-final-dark.png`
- `emp-base-information-mobile-bank-edit.png`
- `emp-base-information-short-viewport.png`
- `emp-base-information-desktop-preserved.png`
- `emp-confirmation-overview-merged.png`
- `emp-confirmation-register-simple-390.png`
- `emp-confirmation-actions-simple.png`
- `emp-confirmation-status-merged-320.png`
- `emp-confirmation-status-merged-dark.png`
- `emp-confirmation-overview-drilldown.png`

Limitations: backend-attached authentication/permissions/storage acceptance and real Android keyboard behavior were not run. Existing `localhost:3000/downloads/desktop-agent/windows/manifest` connection errors remain in the local browser console; no new UI runtime error was observed in the exercised flow. Not all confirmation lifecycle states or auxiliary library workflows were exercised. No production-readiness claim is made for those unverified paths.
