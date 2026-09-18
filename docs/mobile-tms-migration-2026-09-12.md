# TMS mobile migration — 2026-09-12

## Scope and implementation

Actual TMS app in `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. This continues the approved EMP/Intranet mobile direction using the design-first workflow: reuse the public Material 3 buttons, inputs, collection states, list items and bottom sheets. No separate prototype, new dependency, shared registry/approval change or backend contract change.

Phone presentation is scoped below 48rem. Desktop keeps the original workspace navigation, three timesheet boards, approval matrix, query grid and overview table. Switching from phone back to desktop reapplies the saved board proportions.

- Compact workspace navigation and account/settings sheets reuse the existing permission-gated actions. Preference controls use equal-width, touch-sized buttons; desktop preferences remain unchanged.
- Timesheets show one day at a time, with period/date selectors, daily rows, hours summary, validation details and explicit selection/deletion mode. Add-row editing is progressive and uses a bottom sheet; chargeable project results use cards rather than a wide table on phones.
- Mobile hours, descriptions, project linking, autosave and submission call the existing handlers. Existing project access checks, period locks, revision checks, normal/OT limits and submission validation remain in the owning workspace.
- Approvals navigate business → EMP project/person → daily Normal/OT details. Editing, approval, return reasons, batch selection and undo use existing eligibility and mutation callbacks. Mobile period/status controls are disabled during editing or an action.
- Query results use readable cards plus a full details sheet. Primary query controls are in one sheet; less-used fields remain under Other filters. Pagination, detail/summary mode, export and reset retain their original handlers. Decimal-string query `total` is not mislabelled as hours.
- HR overview uses employee summaries and daily drilldown. TMS work items use a sheet and the original task-opening callback.
- Removed the old narrow-screen wide-table CSS fallback. Mobile styling uses semantic tokens and 44px minimum control targets, including narrow desktop-browser previews.
- Local service links can use `NEXT_PUBLIC_INTRANET_URL` and `NEXT_PUBLIC_EMP_URL`; Android's `10.0.2.2` maps configured loopback hosts without losing their ports. Production fallback behavior is retained. Narrow dev origins allow localhost, 127.0.0.1 and 10.0.2.2; no production authentication or CORS policy was relaxed.

Domain presentation files: `timesheet-mobile.tsx`, `approval-mobile.tsx`, `tms-mobile-header.tsx`, `tms-mobile-controls.tsx`, `tms-mobile.module.css`, `i18n/mobile.ts`. Integration changes are in the existing TMS workspaces, header and app. Existing unrelated dirty worktree changes were preserved.

## Local environment

Actual app URL: `http://127.0.0.1:3054/zh-CN/timesheet`. Workspace navigation changes the active TMS view within this route. Android host alias: `http://10.0.2.2:3054/zh-CN/timesheet` (not interactively verified on the emulator this turn).

Server command, with bundled Node on PATH:

```powershell
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
$env:NEXT_PUBLIC_API_MODE = 'mock'
$env:NEXT_DIST_DIR = '.next/tms-mobile-dev'
corepack pnpm --filter @project-wing/tms exec next dev -H 0.0.0.0 -p 3054
```

Ignored local `apps/tms/.env.local` sets only the Intranet URL to port 3057 and EMP URL to port 3048. No credentials were added. Next.js regenerated `next-env.d.ts` type-import paths during builds. No commit, push, merge, remote deployment or emulator operation was performed.

## Validation commands and results

All commands ran from this worktree with bundled Node 24.19.0 on PATH.

```powershell
corepack pnpm --filter @project-wing/tms exec vitest run --maxWorkers=1
```

Baseline: 14 files / 236 tests passed. Final full TMS run: **16 files / 250 tests passed**. New coverage includes phone autosave through `saveTimesheetDraft(year, month, payload)`, approval through the existing ID/revision callback, read-only fields, selection, statistics, query details, overview drilldown, deferred navigation, mobile preference callbacks and local/Android URL resolution.

Additional final targeted checks:

```powershell
corepack pnpm --filter @project-wing/tms exec vitest run src/components/tms-mobile.test.tsx src/components/timesheet-workspace.test.tsx src/components/approval-workspace.test.tsx src/lib/portal.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/tms exec vitest run src/components/tms-mobile.test.tsx src/components/tms-header.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/tms exec vitest run src/components/tms-mobile.test.tsx src/components/timesheet-workspace.test.tsx --maxWorkers=1
```

Passed: **137 tests**, then **13 tests** after the phone target-size CSS adjustment, then **73 tests** after fixing project-result text wrapping and the three-column period bar. These overlap the full suite and are not additional distinct tests. The final build was repeated successfully after those last changes.

```powershell
corepack pnpm exec ultracite check apps/tms/src/components/tms-mobile-header.tsx apps/tms/src/components/tms-mobile-controls.tsx apps/tms/src/components/timesheet-mobile.tsx apps/tms/src/components/approval-mobile.tsx apps/tms/src/components/tms-mobile.test.tsx apps/tms/src/components/tms-mobile.module.css apps/tms/src/components/tms-header.tsx apps/tms/src/components/tms-header.test.tsx apps/tms/src/components/tms-app.tsx apps/tms/src/components/timesheet-workspace.tsx apps/tms/src/components/approval-workspace.tsx apps/tms/src/components/query-workspace.tsx apps/tms/src/components/overview-workspace.tsx apps/tms/src/components/tasks-workspace.tsx apps/tms/src/i18n/mobile.ts apps/tms/src/lib/portal.ts apps/tms/src/lib/portal.test.ts apps/tms/next.config.ts apps/tms/src/styles.css apps/tms/src/mobile-material.css apps/tms/src/components/timesheet-workspace.test.tsx apps/tms/src/components/approval-workspace.test.tsx
corepack pnpm --filter @project-wing/tms exec tsc --noEmit
node scripts/design-first/cli.mjs validate-registry
git diff --check -- apps/tms
```

Scoped lint/format, TypeScript and registry checks passed. Whitespace check passed with LF/CRLF notices only. CSS-only Ultracite checks format successfully and report no JavaScript files to lint; the combined source check above is the lint evidence.

```powershell
$env:NEXT_PUBLIC_API_MODE = 'mock'
$env:NEXT_DIST_DIR = '.next/tms-mobile-build'
corepack pnpm --filter @project-wing/tms build
```

Final production compilation and TypeScript stage passed; **13 pages generated**. This is a local Mock-mode build, not proof of deployment or backend acceptance.

## Actual-app interaction and evidence

Headed Chrome, Playwright CLI session `intranet-live-mobile`, tab 4. Existing Mock Partner account, real TMS application route above. Browser automation used:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=intranet-live-mobile snapshot
npx --yes --package @playwright/cli playwright-cli -s=intranet-live-mobile run-code '<source-grounded page interactions>'
```

Verified:

- July 2026 / first half → Add row → Non-Chargeable / Normal / Internal Admin → description `Mobile UI validation` → July 1 hours `1.5` → saved feedback. One temporary Mock row was selected and deleted through the UI afterward; no real timesheet was submitted. The first test row also disappeared when development HMR reset the in-memory Mock store, before the final repeat-and-cleanup run.
- 320px and 390px phone layouts; 1440px original three-board desktop view. Phone document width equalled viewport width and rendered zero tables. Day controls and the add form were exercised.
- Function navigation → settings → dark/light preferences. Final sheet buttons measured approximately 44px. Phone query sheet clientWidth equalled scrollWidth at 320px and 390px.
- Navigation → approvals → July → Orchid Technology Limited → Group reporting / Jony Ma → daily details. Totals were Normal 8h, OT 0h. Opened the return-reason sheet without submitting a return or approval.
- Navigation → query → primary/other filters, responsive form and error/retry state. Query service connection failure is visible, not replaced with fabricated successful results.
- Navigation → TMS work items → overdue-half-month task presentation.
- Add row → Chargeable / Normal → EMP project search `Orchid`: matching project cards rendered with separate code, client and PIC/MIC lines; zero tables and sheet clientWidth=scrollWidth at 320px and 390px. Cancelled without adding/linking a record. Final view is light 390px timesheet, zero test rows, no open dialog; port 3054 remains running.

Screenshots in `output/playwright/` include:

- `tms-timesheet-mobile-390.png`, `tms-timesheet-mobile-320.png`, `tms-add-mobile-390.png`
- `tms-timesheet-desktop-1440.png`, `tms-timesheet-mobile-dark-390.png`
- `tms-approval-projects-390.png`, `tms-approval-records-390.png`, `tms-approval-detail-390.png`
- `tms-approval-projects-320.png`, `tms-approval-detail-320.png`, `tms-approval-return-320.png`
- `tms-query-filters-390.png`, `tms-query-filters-320.png`, `tms-query-error-320.png`
- `tms-settings-mobile-dark.png`, `tms-workitems-320.png`
- `tms-add-project-search-390.png`, `tms-add-project-search-320.png`, `tms-mobile-final-390.png`, `tms-mobile-final-320.png`

The 320px approval, final query/settings screenshots reflect the final touch-target adjustment; earlier screenshots also document the implementation/desktop comparison.

## Remaining acceptance limits

- **Backend-attached acceptance was not run.** The local API at `http://localhost:3000/tms/timesheets/query` refuses connections. Query result cards, complete detail fields, filtering callbacks and overview employee details have automated coverage, but successful live query results/export and HR overview require a running backend and an appropriate real account.
- The Mock login exposes a Partner account, not HR/SUPER_ADMIN. HR overview permissions were not bypassed for visual testing.
- Real Android keyboard behavior, production authentication, approval/return/undo persistence, export download and all project-link permission combinations were not interactively accepted this turn.
- A shared modal transition emitted an `aria-hidden`/retained-focus warning. Keyboard and assistive-technology behavior is not claimed fully validated.
- Root cross-workspace tests, unrelated EMP/Intranet suites and deployment were not run. Existing unrelated workspace changes/failures are not included in the TMS pass claim.
