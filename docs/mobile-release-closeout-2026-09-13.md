# Mobile release closeout — 2026-09-13

This is the pre-approval closeout record. See [the subsequent scope approval](mobile-release-scope-approval-2026-09-13.md) and [pre-merge evidence](mobile-release-premerge-evidence-2026-09-13.md) for later repairs and validation.

## Delivery state

Not merge-ready and not deployed. The user authorized remaining repairs, PR, merge and deployment verification. No release commit, remote push, PR, merge or deployment dispatch has been made for this integration. Existing successful GitHub Build/Deploy runs concern main `1ee97a4c0303c657634034a34669058b78feeee3`, **not these changes**.

Working directory: `D:/Project_wing/.worktrees/mobile-app-integration`, branch `feat/integrate-mobile-app-experience`. `git fetch origin main` and `git rev-list --left-right --count HEAD...origin/main` still returned `0 0` on this date. The original mobile worktree and previews remain intact. No audit baseline, hook policy or registry approval was expanded or bypassed.

## Repairs completed during closeout

- Phone file-list visibility controls now persist and apply the actual selection, including folder views without explicitly supplied preferences.
- Archive reimport restoration is checked by its displayed selection **and submitted file ID / target directory**. History is captured outside mutable-ref render reads; preview invalidation remains explicit after imports and withdrawals.
- English confirmation editors no longer display a hardcoded Chinese empty-choice message. Stored scalar values still cannot become selectable linked-source options.
- CSS geometry tests distinguish pixel values from percentage coordinates. Mutable mocks keep invocation-time semantics, and exact boolean / call-count assertions remain strict.
- API template-code assertions now match main's intentional English codes for newly created drafts; historical stored-code fixtures remain unchanged. Prisma Client was generated using the documented development configuration, without connecting to or migrating a database.
- Native cache eviction tests use synthetic isolated StateRoot/CacheRoot directories and deterministic disk capacity; a low-disk test verifies that dirty evidence is retained. No installed Agent, Office process or user cache was used for fault injection.
- Shared form, selection, overlay and navigation contracts were exercised. Render-function fields retain caller-owned refs and explicit accessible metadata. Search retry callbacks no longer leak UI event objects. A real-browser check found and corrected long-description overflow in SelectionCard.
- CMP billing / AML copy moved to app-owned i18n modules. Archive billing summaries and fee schedules now use localized labels, including desktop and phone views, without changing financial calculations or persistence.
- The assertion analyzer now distinguishes data, accessibility and lifecycle assertions from decorative snapshots. Paired regression tests still reject cosmetic assertions, unsafe markup is tested as hostile input, and historical allowances remain monotonic.

## Current validation evidence

Commands were run in the integration worktree with bundled Node 24.19.0 and the workspace binaries on PATH. A targeted pass is not a full-suite or deployment pass.

| Command | Result |
| --- | --- |
| `corepack pnpm test` | Completed with one failing task: EMP shard 2/2. See breakdown below. This root invocation is **not green**. |
| `node scripts/volatile-test-assertions.mjs` | Passed, including after the new tests were staged. |
| `node --test scripts/volatile-test-assertions.test.mjs scripts/i18n-static-copy.test.mjs` | 12 passed. |
| `corepack pnpm --filter @project-wing/ui exec tsc --noEmit` | Passed. |
| `corepack pnpm --filter @project-wing/emp exec tsc --noEmit` | Passed. |
| `corepack pnpm --filter @project-wing/cmp exec tsc --noEmit` | Passed, including after billing-copy extraction. |
| `corepack pnpm --filter @project-wing/ui-showroom exec tsc --noEmit` | Passed after the new public form contracts. |
| `corepack pnpm --filter @project-wing/ui exec vitest run src/form-primitives.test.tsx src/content-primitives.test.tsx src/choice-controls.test.tsx src/action-menu.test.tsx src/combobox-field.test.tsx src/overlay-primitives.test.tsx src/layout-primitives.test.tsx --maxWorkers=1` | 7 files / 25 passed. |
| `corepack pnpm --filter @project-wing/ui exec vitest run src/navigation-layout.test.tsx --maxWorkers=1` | 4 passed after correcting retry callback ownership. |
| `corepack pnpm --filter @project-wing/ui exec vitest run src/form-primitives.test.tsx src/settings-mobile-navigation.test.tsx --maxWorkers=1` | 8 passed. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-response-warehouse.test.tsx --maxWorkers=1` | Final full archive-warehouse regression: 25 passed after history and invalidation cleanup. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-response-warehouse.test.tsx src/components/confirmations/project-confirmation-editor.test.tsx -t 'restores the archive scroll\|does not add the current scalar binding\|does not retain edited linked values' --maxWorkers=1` | 3 passed / 121 skipped. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/views/projects.test.tsx src/components/confirmations/confirmation-datagrid-migration.test.ts src/components/confirmations/confirmation-response-warehouse.test.tsx -t 'opens the Smart Form admin workspace from query params\|grouped import summary\|shared DataGrid resizing' --maxWorkers=1` | 3 passed / 107 skipped. The timed-out Smart Form test passed without increasing its timeout. |
| `corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-billing-page.test.tsx src/components/cmp-engagement-archive-page.test.tsx src/components/cmp-engagement-fee-note-page.test.tsx --maxWorkers=1` | 20 passed. |
| `node scripts/repository-policy-guardrails.mjs` | Staged repository constraints passed. |
| `node node_modules/ultracite/dist/index.js check <explicit batches of staged source paths>` | Found formatting issues and 8 diagnostics; they were subsequently corrected. A final full-batch rerun is still required. The corrected API service test, archive warehouse and settings test passed a focused check. |
| `node node_modules/oxfmt/bin/oxfmt --config oxfmt.config.ts <explicit staged source batches>` | Completed successfully. No lint-staged temporary checkout manipulation overlapped tests. |
| `node scripts/design-first/cli.mjs audit --json` | Failed: 390 findings / 72 unaccepted fingerprint groups at the latest audit. Reduced from 448 / 117; baseline unchanged. |
| `node scripts/design-first/cli.mjs validate-registry --require-ready --require-approved` | Failed with 724 verification / readiness / approval errors. These are incomplete design-system acceptance obligations, not 724 demonstrated runtime defects. Registry approval remains `proposed`. |

Root test breakdown: EMP shard 1/2: 814 passed; shard 2/2: 1149 passed, 4 failed, 2 skipped. The four failures were two stale English-locale expectations, one source-format-dependent assertion and one Smart Form query-entry timeout. All four subsequently passed targeted reruns; the complete shard has not been rerun after those corrections. Other root tasks passed: shared 277, shared UI 302, Desktop Agent 323, native desktop 165 (2 skipped), desktop UI 8, API 1972 (24 skipped), CMP 315, TMS 250, Intranet 68. The root run reported simulated failure-path warnings and jsdom navigation notices; it was not warning-free.

Local logs are under `output/validation/closeout-root-retest.log`, `closeout-staged-lint.log`, `closeout-boundary-status.json` and `closeout-registry-status.log`. A failed Node command piped through a display-only PowerShell filter is recorded as failed here regardless of the pipeline's final exit code.

## Interactive and visual evidence

Headed Playwright CLI session `mobile-closeout-catalog`; integration showroom at `http://127.0.0.1:3080`. This is a catalog of actual shared exports, not a second product prototype or backend acceptance environment.

- `/specimens/MobileMaterialSystem`: at 390×844, opened the team chooser, searched `quality`, selected the long team with ArrowDown/Enter and verified focus restoration. At 1366×900, verified empty options. Disabled, read-only, loading and validation examples were inspected.
- `/specimens/FormControls`: toggled Notifications and edited the named field to `Mobile closeout draft`; inspected 390×844 and 1366×900. The first mobile screenshot exposed SelectionCard overflow. After the shared fix, all three cards reported `scrollWidth === clientWidth` (292 px) and normal wrapping. Final screenshots were visually inspected.
- Browser file-picker button text is native to the browser/OS locale, not an application translation.

Evidence:

- [Chooser, phone](evidence/mobile-app-experience/closeout-combobox-mobile-states.png)
- [Chooser, wide](evidence/mobile-app-experience/closeout-combobox-wide-states.png)
- [Form controls, phone — corrected](evidence/mobile-app-experience/closeout-form-controls-mobile-fixed.png)
- [Form controls, wide — corrected](evidence/mobile-app-experience/closeout-form-controls-wide-fixed.png)

No application exception was observed during the catalog interactions; the console contains development/HMR messages. The earlier backend-free CMP path and its screenshots remain in `mobile-main-integration-2026-09-13.md`. New business flows have not been accepted against an authenticated real backend. No new emulator acceptance, production build, remote migration, deployment or post-deploy verification is claimed.

## Scope and remaining release gate

The existing design-first contract permits scoped product adoption but the strict registry gate requires the entire long-lived baseline to be Ready and globally approved. It still contains 47 planned entries, including command palette, audit-trail view and external-request workspace, as well as incompletely registered existing primitives. Completing that entire baseline is materially broader than releasing the user-confirmed mobile presentation. Shared baseline work begun during closeout is preserved as unfinished work; it is not certified for adoption.

The design-first skill requires explicit approval for baseline exceptions and prohibits the implementation author from self-approving the system. A scope decision is needed: continue full component-library completion and a subsequent rendered approval checkpoint, or explicitly defer unused baseline capabilities from this mobile release. Deferral must **not** exempt touched product behavior, security, tests or actual boundary violations. No such exception has been applied.

Regardless of that decision, the 72 remaining boundary groups, final lint/shard reruns, production builds, authenticated backend acceptance and normal commit/push hooks must be handled before merge. After an authorized squash merge, follow the exact merge SHA through Build, immutable-image publication, automatic Deploy and live ingress/version checks; a green build alone is not deployment success.
