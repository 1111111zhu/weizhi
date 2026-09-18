# Mobile directory management — 2026-09-12

## Scope

Actual EMP app in `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. **Mobile only**: workspace passes the optional `mobileLocale` presentation to `WorkbenchDirectory` only while `isPhone` is true. Desktop keeps the existing tree, sidebar, context menus and form presentation. No prototype, dependency, backend contract, commit, push or deployment change.

Existing Material 3 public buttons, inputs and bottom sheets are composed into an EMP-specific directory browser. CSS is scoped below 48rem. No shared component registry/approval state was changed.

## Changes

- One directory level at a time; open at the selected folder's parent so siblings and current selection are visible.
- Up-one-level and ancestor/root navigation, readable wrapped names, restrained current-location highlighting; no repeated nested row surfaces or tree indentation on the phone.
- Optional directory search accepts stored codes (such as `A1-1000`) as well as formatted names and shows ancestor context.
- Explicit per-directory action buttons reuse the existing menu builder, clipboard rules and mutation callbacks. Existing file-row handling remains available where file rows are enabled.
- Open current-level files explicitly. Selecting a folder for its files closes the management sheet and enters the real workspace file pane.
- Reuse the existing code-generation/normalization and form state. Mobile creation requires explicit confirmation; tapping outside or cancelling no longer implicitly creates a directory. Desktop's existing inline creation behavior is unchanged.
- Mobile rename uses a bottom sheet, single-column inputs, localized cancel text and equal touch-sized actions. Corrected the inherited desktop footer negative margins that initially caused horizontal scrolling in the new phone sheet.
- Read-only restrictions and same-node/descendant paste guards stay in the original action logic.

Files: `emp-mobile-directory.tsx`, `workbench-directory.tsx`, `workbench-directory-row.tsx`, new `workbench-directory-mobile.tsx`, its colocated test/CSS, `i18n/directory-mobile.ts`, and the mobile opt-in/callback wiring in `views/workspace.tsx`.

## Validation

Commands ran from the worktree with bundled Node 24:

```powershell
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
corepack pnpm exec ultracite check apps/emp/src/components/workbench-directory-mobile.tsx apps/emp/src/components/workbench-directory-mobile.test.tsx apps/emp/src/components/workbench-directory-row.tsx apps/emp/src/components/workbench-directory.tsx apps/emp/src/components/emp-mobile-directory.tsx apps/emp/src/views/workspace.tsx apps/emp/src/components/workbench-directory-mobile.module.css apps/emp/src/i18n/directory-mobile.ts
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-directory-mobile.test.tsx src/components/emp-mobile-navigation.test.tsx src/components/workbench-directory.test.tsx src/components/workbench-directory-row-styles.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/views/workspace.test.tsx -t 'selects the newly created directory node|cuts project files by pasting into a target folder menu|clears copied project file clipboard after pasting from a target folder menu|clears the directory highlight after deleting the selected folder' --maxWorkers=1
```

Scoped lint/format, types and registry passed. The combined directory command passed **79 tests**. Workspace integration selection passed **4 tests**, with 65 unrelated cases skipped: 83 distinct targeted tests total. Initial new test failures exposed spaced display codes and concatenated accessible labels; assertions were aligned to the existing formatting contract and explicit mobile accessible names were added without changing stored codes.

After the mobile rename sheet follow-up, its mobile and desktop directory regressions were rerun successfully (71 tests):

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-directory-mobile.test.tsx src/components/workbench-directory.test.tsx --maxWorkers=1
```

Final CSS formatting passed (CSS-only checking reports no lintable JS/TS). Final Mock production build passed with 77 generated pages:

```powershell
corepack pnpm exec ultracite check apps/emp/src/components/workbench-directory-mobile.module.css
$env:NEXT_DIST_DIR = '.next/emp-mobile-confirmations-build'
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/emp build
git diff --check -- apps/emp/src/components/workbench-directory-row.tsx apps/emp/src/components/workbench-directory.tsx apps/emp/src/views/workspace.tsx
```

Whitespace check passed with LF/CRLF notices only.

## Actual-app interaction

Headed Chrome, Playwright CLI session `intranet-live-mobile`, tab 2:

`http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026`

Path: project More actions → Manage directories. This is the real EMP workspace in **local Mock mode**, not port 3047.

Verified at 390px and 320px: current-level siblings, current selection, touch action sheet, opening the selected folder's files (zero remaining dialogs afterward), stored-code search, opening/cancelling creation and rename, dark mode. No actual create, rename, paste, export or delete was submitted. The final 320px manager and rename sheet have no horizontal overflow; the rename sheet measured clientWidth=scrollWidth=320, form width 288.

At 1440px, verified the desktop tree still renders (one tree, zero mobile manager), captured it, then returned to the 390px light mobile manager.

Inspected artifacts in `output/playwright/`:

- `emp-directory-manager-390.png`
- `emp-directory-manager-320.png`
- `emp-directory-actions-320.png`
- `emp-directory-create-320.png`
- `emp-directory-rename-320.png`
- `emp-directory-manager-dark.png`
- `emp-directory-desktop-preserved.png`

Limits: backend-attached persistence/permissions acceptance, real Android keyboard behavior, and all temporary-file management combinations were not exercised. The local Desktop Agent manifest connection failures remain; nested-sheet transitions also emitted focus/aria-hidden warnings, so those are not claimed fully accessibility-validated. Root tests, unrelated PDF tests and deployment were not run. The emulator was not controlled.
