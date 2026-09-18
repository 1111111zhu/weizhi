# EMP mobile list actions — 2026-09-12

## Change

The actual EMP mobile list-action sheet now groups controls in this order:

1. Equal-width Current / Prior / Temporary tabs.
2. Matching Upload and Create and paste actions.
3. A labelled Show information entry for the existing visibility menu.
4. Sort and filter: a compact two-column field grid, with an odd last field spanning the row. Field labels and sort indicators are aligned across 44px targets.

Uses the existing Material tokens and controls. The upload input/ref, bucket callbacks, directory-upload attribute, creation/template/SmartForm/paste menu, visibility persistence, and original sort/filter components remain connected. The mobile DataGrid receives the existing UI locale for localized sorting copy. Desktop control order and classes are retained. Q and Word preview UI are not changed.

## Validation

Worktree `D:/Project_wing/.worktrees/mobile-app-experience`, bundled Node 24.19.0:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'mobile list tools|sorts mobile file rows|uses the mobile file list|places bulk upload' --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/emp-mobile-navigation.css apps/emp/src/i18n/mobile-navigation.ts apps/emp/src/components/workbench-content.test.tsx
node scripts/design-first/cli.mjs validate-registry
```

Results: 4 targeted tests passed, followed by the full 190-test workbench component suite. All 9 mobile CSS/theme tests passed. Typecheck, scoped lint/formatting and registry validation passed. Regression tests cover PRIOR-bucket upload, visibility and persistence, ascending/descending/clear sorting, mobile entry points, and unchanged desktop bulk toolbar ordering.

Interactive environment: actual local Mock EMP on port 3048, engagement → default folder → Orchid → Planning → Client acceptance or continuance → A1-1000 → List actions. At 390px, four field targets measured 175×44px and the last 358×44px. At 320px, sheet width and scroll width were both 320px. Prior/current switching, real file sorting and clearing, visibility menu, creation menu and disabled empty-clipboard paste were checked. No real uploads, creates, pastes or deletions were performed.

The existing dark theme was checked through its `.dark` class, then restored. At 1440px, the original desktop upload/columns/tabs remained visible and the mobile Show information control was absent.

Screenshots in `output/playwright/`: `emp-list-tools-refined.png`, `emp-list-tools-320.png`, `emp-list-tools-dark.png`, `emp-list-tools-desktop-header.png`.

Not run: production build, full repository validation, real backend or Android emulator interaction. The existing unavailable local Desktop Agent manifest request remains a console error. No deployment was performed.
