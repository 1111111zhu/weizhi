# Mobile project archive UI — 2026-09-12

## Scope

Actual EMP application, `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. Mobile-only presentation changes; no prototype, new dependency, backend contract change, commit, push or deployment.

Files:

- `apps/emp/src/views/workbench-settings-panel.tsx`
- `apps/emp/src/views/workbench-archive-mobile.module.css`
- `apps/emp/src/views/workbench-settings-panel.test.tsx`
- `apps/emp/src/i18n/archive-mobile.ts`

The existing Material 3 tokens and public Button/ViewSwitcher are reused. This is domain composition, not a new shared design-system primitive or approval-state change.

## Changes

- Remove the mobile fixed-height desktop grid that stretched setup/checking sections apart.
- Render the calculated archive deadline as readable metadata, rather than a disabled date input. Preserve the existing report-date calculation.
- Keep the password control full-width, including its existing visibility toggle and form registration.
- Place the check description and primary action together; show truthful idle copy instead of “checking” before a job starts.
- Show mobile failed-check feedback and retry for request/polling/job failures, rather than indefinite progress.
- Present check counts in a 2×2 grid and switch result categories through one selector instead of six wrapped tabs. Keep issue navigation, report export, readiness gates and final confirmation callbacks.
- Keep project deletion visually secondary, with its existing permission checks and separate confirmation dialog.
- All layout overrides are scoped below 48rem. Desktop layout, disabled calendar, tabs and controls remain.

## Commands and results

From the worktree, using bundled Node 24:

```powershell
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
corepack pnpm exec oxfmt apps/emp/src/views/workbench-settings-panel.test.tsx
corepack pnpm exec ultracite check apps/emp/src/views/workbench-settings-panel.tsx apps/emp/src/views/workbench-settings-panel.test.tsx apps/emp/src/views/workbench-archive-mobile.module.css apps/emp/src/i18n/archive-mobile.ts
corepack pnpm --filter @project-wing/emp exec vitest run src/views/workbench-settings-panel.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
$env:NEXT_DIST_DIR = '.next/emp-mobile-confirmations-build'
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/emp build
git diff --check -- apps/emp/src/views/workbench-settings-panel.tsx apps/emp/src/views/workbench-settings-panel.test.tsx
```

Results: scoped lint/format passed; all 34 settings tests passed (8 mobile scenarios plus existing settings/archive tests); typecheck passed; registry validation passed; build passed with 77 generated pages; whitespace check passed with LF/CRLF notices only.

The initial full test run exposed an incomplete existing Members dictionary fixture while testing section switching. Added its actual `memberCount` contract without changing production Members code, and reran the full file successfully. Mobile tests cover idle state, password visibility, permissions, request failure/retry, failed-job reporting, blockers/navigation, clean-check confirmations and separate deletion confirmation.

## Browser verification

Headed Chrome, Playwright CLI session `intranet-live-mobile`, tab 2, actual local Mock EMP:

`http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026?workspace=confirmations&returnTo=%2Fconfirmations`

Path: project More actions → Settings → settings index → Archive.

Checked 390px setup, 320px setup/results, dark appearance, category switching and closing results back to setup. Started a **Mock file-check job only**: it returned 66 attachments and 135 blockers. Switched to Office document checks and verified the no-issues result. No final archive, package generation, download or project deletion was performed. At 320px, the document and archive content had no horizontal overflow.

At 1440px the original desktop archive layout and disabled deadline picker were inspected. Returned the browser to the 390px light archive page. The Android emulator was not operated.

Screenshots under `output/playwright/`:

- `emp-archive-mobile-390.png`
- `emp-archive-mobile-dark-320.png`
- `emp-archive-check-mobile-320.png`
- `emp-archive-check-dark-320.png`
- `emp-archive-desktop-preserved.png`

Limitations: this is local Mock UI verification, not backend-attached acceptance. Actual archive/password persistence and Android keyboard behavior were not exercised. The local Desktop Agent manifest connection error and settings-entry nested-dialog focus warning remain; transient missing-CSS HMR errors during editing cleared once the new module was created. Root tests, unrelated PDF regression tests and deployment were not run.
