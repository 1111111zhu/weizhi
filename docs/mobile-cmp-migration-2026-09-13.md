# CMP mobile adaptation — 2026-09-13

## Scope

Actual CMP in `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. Continuation of the user-requested EMP/Intranet/TMS mobile direction. No separate prototype, new package, API schema, database migration, shared primitive, registry approval, commit, push or deployment was introduced. Existing unrelated changes in the dirty worktree were preserved.

Design-first classification: application-specific responsive adaptation using the existing public Material 3 controls, semantic tokens, mobile sheets and collection states. This is not a claim that the repository-wide design system has formal approval; its strict readiness/approval gate still fails, as detailed below.

## Implemented

- Compact CMP navigation, account sheet, mobile settings controls and work-item sheet. Existing billing-role restrictions, navigation callbacks, unsaved-form guards and preference handlers are retained. Navigation waits for its sheet to close before opening the destination and does not flash account content while closing.
- Client, engagement, acceptance and billing lists use record cards, concise status selection and an action sheet. Desktop tables remain. CMP's mobile adapter consumes the original table row model, filters, sorting, selection restrictions, cell renderers and callbacks; it does not create an alternative business data layer.
- Client preview keeps the existing accessible action name and opens the full detail route in the current app. Existing edit/history/search-document/engagement actions remain connected. Other CMP record previews also use same-window navigation on phones; desktop safe new-window behavior remains.
- Form steps become a current-step selector with missing/error information. Reduced nested padding and borders; retained fields, validation, draft saving, assignment and submission logic.
- Contacts, addresses, related entities, relationships, UBOs, associated projects, deliverables, search documents, fee planning and TMS summaries have phone presentations. Editable budget cells reuse the original controls/callbacks rather than rewriting calculations.
- Related-party and relationship views use phone rows; the map view selector and customer control fit narrow screens. Graph layout/data handling is unchanged.
- Read-only document tables retain labels beside values on phones. Version filters move into a sheet. Archive personnel budgets, actual costs, fee schedules and billing receipts become labeled records; totals still use existing formatting/calculation helpers.
- Billing collection overview is available on demand instead of pushing the list below a large desktop dashboard. Status-group filtering and amounts are unchanged. Fee-note tools move to a dedicated sheet; the primary save/workflow actions and capability checks remain. Screen-only mobile CSS makes fee-note fields single-column while leaving print CSS/DOM contracts intact.
- Local CMP portal navigation can use `NEXT_PUBLIC_INTRANET_URL`, preserves configured ports, and maps loopback to Android's `10.0.2.2`. Dev asset origins are limited to localhost, 127.0.0.1 and 10.0.2.2. Production auth/CORS policy is unchanged.

Core new domain files: `cmp-mobile-grid.tsx`, `cmp-mobile-header.tsx`, `cmp-mobile.module.css`, their mobile tests and `i18n/mobile.ts`. Integration lives with the existing CMP grids/forms/pages. Shared `packages/ui` changes already present before this turn were not rewritten.

## Running application

- Computer: `http://127.0.0.1:3052/zh-CN/client`
- Android host alias: `http://10.0.2.2:3052/zh-CN/client` (emulator interaction not performed this turn)
- Mode: local **Mock**, using the existing development-account picker / Partner account.
- Ignored `apps/cmp/.env.local` contains only `NEXT_PUBLIC_INTRANET_URL=http://127.0.0.1:3057/`.

Started from the worktree:

```powershell
$env:PATH = 'C:\Users\LHX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
$env:NEXT_PUBLIC_API_MODE = 'mock'
$env:NEXT_DIST_DIR = '.next/cmp-mobile-dev'
corepack pnpm --filter @project-wing/cmp exec next dev -H 0.0.0.0 -p 3052
```

Next.js regenerates `next-env.d.ts` type-import paths when switching the development/build output directories. No credentials were added. Existing EMP 3048, Intranet 3057 and TMS 3054 services were not replaced.

## Validation

Commands below ran from this worktree with bundled Node 24.19.0 on PATH.

```powershell
corepack pnpm --filter @project-wing/cmp exec vitest run --maxWorkers=1
```

Baseline: **48 files / 301 tests passed**. Full adapted CMP run: **50 files / 315 tests passed**. An earlier run had 312 passing tests and one version stylesheet-contract failure because the checker read only `styles.css`, not its imported mobile stylesheet. The check now first requires the mobile import and then verifies definitions across both actual stylesheets; its assertions were not removed.

Targeted iterations included:

```powershell
corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-mobile-grid.test.tsx src/components/cmp-clients-data-grid.test.tsx src/components/cmp-app-shell.test.tsx src/components/cmp-form-controls.test.tsx src/components/cmp-engagement-archive-page.test.tsx src/components/cmp-engagements-view.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-mobile-grid.test.tsx src/components/cmp-billing-page.test.tsx src/components/cmp-client-version-history-styles.test.ts --maxWorkers=1
corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-mobile-grid.test.tsx src/components/cmp-app-shell.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-engagement-archive-page.test.tsx src/components/cmp-mobile-grid.test.tsx --maxWorkers=1
```

These passed **78**, **20**, **26**, and **13** tests respectively. They overlap the full suite. The last two checks cover the final header transition and archive billing-record adjustments after the full run. New tests cover filtered row models, actual row-opening/edit callbacks, nonselectable records, mobile budgets, desktop retention, step selection, monthly worksheet totals, deferred navigation, billing-role gating, collection filters and local/Android portal URLs.

```powershell
corepack pnpm --filter @project-wing/cmp exec tsc --noEmit
corepack pnpm exec ultracite check apps/cmp/src/components/cmp-mobile-grid.tsx apps/cmp/src/components/cmp-mobile-header.tsx apps/cmp/src/components/cmp-mobile.module.css apps/cmp/src/components/cmp-mobile-grid.test.tsx apps/cmp/src/i18n/mobile.ts apps/cmp/src/components/cmp-master-data-grid.tsx apps/cmp/src/lib/portal.ts apps/cmp/src/lib/portal.test.ts
node scripts/design-first/cli.mjs validate-registry
git diff --check -- apps/cmp
```

TypeScript, the scoped mobile-core lint/format check and basic registry validation passed. Whitespace validation passed with LF/CRLF notices only. Formatting was also applied with `corepack pnpm exec oxfmt` to touched CMP files; existing large-page lint debt was not auto-fixed across unrelated business logic.

New mobile-core boundary check passed:

```powershell
node --input-type=module -e 'import {runAudit} from "./scripts/design-first/cli.mjs"; const result=await runAudit({stagedFiles:["apps/cmp/src/components/cmp-mobile-grid.tsx","apps/cmp/src/components/cmp-mobile-header.tsx","apps/cmp/src/components/cmp-mobile.module.css","apps/cmp/src/i18n/mobile.ts","apps/cmp/src/components/cmp-master-data-grid.tsx","apps/cmp/src/lib/portal.ts"]}); process.exitCode=result.success?0:1;'
```

Build command:

```powershell
$env:NEXT_PUBLIC_API_MODE = 'mock'
$env:NEXT_DIST_DIR = '.next/cmp-mobile-build'
corepack pnpm --filter @project-wing/cmp build
```

Production compilation/type stage passed and **105 pages generated**. The build repeated after the final archive billing-record adjustment also passed and generated 105 pages. These are local Mock builds, not deployment evidence.

### Gates that are not green

```powershell
node scripts/design-first/cli.mjs audit --json
node scripts/design-first/cli.mjs validate-registry --require-ready --require-approved
```

The full cross-workspace boundary scan reports **449 findings**, including **118 unaccepted finding groups**. Existing CMP billing/archive/AML/import/worksheet code and unrelated EMP/TMS changes contribute legacy native-control, static-copy and restricted-syntax debt. No baseline or exception was changed.

The strict registry gate reports **816 errors**, beginning with `Registry is not approved` and missing Ready-component state/showroom/test evidence. Basic schema validation passing is not strict readiness/approval passing. The current task does not supply formal project-wide approval or repair the entire shared showroom. Full touched-page Ultracite lint also continues to flag existing effect/ref/unused/legacy-accessibility issues in billing, archive, shell and settings; do not describe all repository lint/CI as passing.

## Actual-app browser checks

Headed Chrome / Playwright CLI session `intranet-live-mobile`, tab 5. Example commands used:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=intranet-live-mobile tab-new http://127.0.0.1:3052/zh-CN
npx --yes --package @playwright/cli playwright-cli -s=intranet-live-mobile snapshot
npx --yes --package @playwright/cli playwright-cli -s=intranet-live-mobile screenshot --filename output/playwright/cmp-client-detail-mobile-390.png
```

Verified paths:

- `/zh-CN/client` → existing Orchid preview action → `/zh-CN/client/client-orchid`; same tab, full record details.
- `/zh-CN/engagement` → list actions → New engagement → `/zh-CN/engagement/new` → step selector → Budget → open budget details. The automatically added blank local budget row was removed before closing. No draft was saved/submitted and no real record was deleted.
- `/zh-CN/billing` → Orchid invoice → `/zh-CN/billing/bill-orc-aud-002?source=finance&queue=PENDING_RECONCILIATION` → fee-note tools. Read-only fields and disabled export capability stayed disabled; no print, export, receipt, payment or billing mutation was submitted.
- `/zh-CN/acceptance` → `EA-2026-0038` → detail/workflow/history; closed without approval/return.
- `/zh-CN/client/client-orchid/versions` → filter sheet. Mock has zero version records, so a populated version detail/export was not accepted.
- Settings → dark/light; client list at 320px and 390px. 320px document width equalled scrollWidth and there were zero HTML tables.
- Client list at 1440px restored one desktop table and the existing desktop header/actions, then returned to phone width.
- `/zh-CN/maps` → related parties → party relationships. Populated phone records and the view selector rendered with document width=scrollWidth=390.
- `/zh-CN/engagement/eng-orc-aud/archive` → personnel/cost and live billing sections; final phone document rendered zero tables and did not overflow horizontally (390px viewport, 375px document excluding the vertical scrollbar). No save, submit, review or archive action was executed.

The browser was left on the light 390px client list at `/zh-CN/client`, with no open sheet. CMP's port 3052 remained running.

## Artifacts and limits

Screenshots under `output/playwright/` include client list/detail/dark/desktop, engagement list/form/budget, acceptance list/detail, billing list/detail/tools, version filters, settings, related parties/relationships and archive billing. Representative final artifacts:

- `cmp-clients-mobile-390.png`, `cmp-clients-dark-320.png`, `cmp-clients-desktop-1440.png`
- `cmp-billing-mobile-320.png`, `cmp-billing-detail-390.png`, `cmp-billing-tools-390.png`
- `cmp-acceptance-mobile-320.png`, `cmp-acceptance-detail-320.png`
- `cmp-versions-mobile-320.png`, `cmp-versions-filters-320.png`, `cmp-settings-dark-320.png`
- `cmp-parties-mobile-390.png`, `cmp-relationships-mobile-390.png`
- `cmp-archive-mobile-390.png`, `cmp-archive-billing-mobile-390.png`, `cmp-mobile-final-390.png`

Limits: this is local Mock validation, not backend-attached acceptance. Real authentication/persistence, approval/return/undo, payment/receipt entry, archive submission, PDF/print output, real Android keyboard behavior, all graph editing/import combinations and full assistive-technology behavior were not exercised. Development HMR produced transient compile/reload messages during edits, and a shared modal transition emitted an `aria-hidden`/retained-focus warning. No claim of an entirely clean console/accessibility audit is made. The emulator was not operated. Root cross-workspace tests and remote CI/deployment were not run.
