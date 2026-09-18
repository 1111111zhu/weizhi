# Mobile Material adoption: CMP, TMS and Intranet

Date: 2026-09-11. Worktree: `D:\Project_wing\.worktrees\mobile-app-experience`, branch `codex/mobile-app-experience`.

## Scope

The user requested the same mobile treatment already demonstrated in SmartForm. This iteration adopts that direction for CMP, TMS and Intranet without changing desktop presentation, routes, data contracts, permissions, validation or approval rules. No Flutter runtime or new external UI dependency was added. Existing dirty work in this worktree was preserved.

The design-first skill guided shared ownership: reusable overlay behavior is in `packages/ui`; application composition stays with each application. Every new application stylesheet is enclosed in `(width < 48rem)`, protected by the shared mobile-style contract test. Wide-screen dialog classes and selection implementations remain the original defaults.

## Implemented

### Shared presentation

- `ResponsiveDialogSurface`: forwards the actual DOM ref and native/ARIA properties. The existing Dialog still owns open state, focus trapping, dismissal and permission-sensitive actions. On phones the surface uses bottom placement, bounded scrolling, safe-area padding and the existing visual-viewport keyboard hook; desktop placement is unchanged.
- `SelectContent` / `ViewSwitcher` gain opt-in `mobilePresentation="sheet"`. CMP, TMS and Intranet adapters opt in; default consumers remain anchored. Base UI retains selection, disabled options, outside dismissal and keyboard behavior.
- Dialog close actions retain their upper-right placement despite the shared button state-layer positioning. Wrapped inputs use one focus outline, not nested outlines.
- The interactive catalog `/specimens/MobileMaterialSystem` demonstrates the exported responsive surface with a nested bottom selector and a long label. Registry entries remain **experimental**, not globally Ready or approved.

### CMP

- Mobile form headers no longer inherit a desktop flex basis as a large vertical spacer. Title, draft name, save/assignment/step actions and close remain accessible in a compact header.
- Dense three-column form rows become one column on phones. Nested accordion framing and excess horizontal padding are reduced; read-only fields retain their content without decorative boxes.
- Mobile customer actions use a bottom action sheet, preserving history, material search, engagement and edit callbacks and permission conditions. Desktop compact dropdowns and full action rows are unchanged.
- Customer preview navigates to the existing **full detail route in the same tab** on mobile. Desktop keeps its existing safe new-tab behavior. An attempted reuse of the older profile-preview dialog required an unavailable Mock profile API, so it was removed rather than replacing the working full-detail route with an incomplete preview.
- Dialog and document-search sheet adapters use the responsive surface. CMP now reuses the shared Snackbar host: bottom-center on phones, original top-center on desktop.

### TMS

- Period filters have usable touch heights and balanced widths; the type filter occupies a separate compact row. Add/delete/submit targets are enlarged without changing table row mathematics or virtualization geometry.
- Timesheet board surfaces and returned-reason wrapping follow the shared semantics. Existing date columns, table scrolling, locks and submission rules are retained.
- Add-entry/dialog surfaces, local selects and personal settings adopt bottom presentation. Desktop settings remain an anchored popover.

### Intranet

- System shortcuts, department navigation, search/content spacing and knowledge containers use the shared mobile hierarchy. Administrative controls remain permission-gated.
- Settings, upload/manage dialogs and notification publishing adapt to bottom placement. Publishing fields become a single column, the content body scrolls within the surface, and the action area stays accessible.
- Publishing type/department/directory choices use shared mobile selectors while retaining the original Fluent controls on desktop. The original state-reset callbacks and option sets remain intact.
- Fluent portal stacking is bridged to the shared overlay layer on phones. This fixes the real interaction failure where the old million-level portal intercepted clicks intended for the new selector. Desktop portal stacking is not changed.

## Interactive verification

All business interaction below used **local Mock environments**, not a production account or backend:

| Application | Running entry | Checked |
| --- | --- | --- |
| CMP | `3052/zh-CN/client` | Search; new-client form layout; compact action sheet; full customer-detail route in the current tab; return/close; 390px phone and 1440px desktop isolation |
| TMS | `3054/zh-CN/timesheet` | Add non-chargeable row; category/type/detail selectors; description input; settings opening/closing and light/dark appearance; phone scrolling and desktop isolation |
| Intranet | `3057/zh-CN` | Staff/admin surfaces; department filtering; publishing title, department and body input; cancel without publishing; settings/dark mode; 390px and 1440px |
| Catalog | `3047/specimens/MobileMaterialSystem` | Actual responsive dialog, nested long-label selector, ArrowDown/Enter selection and completion |

The TMS check created one synthetic non-chargeable draft row labelled `Mobile layout check`; it was not submitted for approval. Intranet publishing used temporary content and was cancelled. The admin view was selected through the existing Mock-only identity endpoint, which returns 404 outside Mock mode. No production permission checks were bypassed or changed.

### Android

Verified existing AVD `ProjectWing_Pixel7_API36` / `emulator-5554` with `adb devices -l` and `adb ... emu avd name`. Reused its actual Chrome through Playwright CDP and `adb reverse tcp:3057 tcp:3057`.

Opened the Intranet publish sheet and entered a test title. Native diagnostics showed `mInputShown=true` and `mIsInputViewShown=true`; the device screenshot confirms the docked keyboard, editable field, and cancel/publish area remain above the keyboard. The test title was cleared and the page returned to the Intranet home. Nothing was published. Physical iPhone/Safari acceptance is not claimed.

Final inspected artifacts are in `docs/evidence/mobile-app-experience/`, including `intranet-android-keyboard.png`, `intranet-mobile-publish.png`, `cmp-mobile-detail.png`, `cmp-mobile-actions.png`, and `tms-mobile-workspace.png`. Development screenshots captured mid-animation were inspected and recaptured where needed; earlier trial/error artifacts are not approval evidence.

## Commands and results

Commands ran from this worktree with the existing bundled Node runtime on PATH:

- `corepack pnpm --filter @project-wing/ui --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --workspace-concurrency=1 -r test --maxWorkers=2`: **269 UI, 301 CMP, 236 TMS, 47 Intranet tests passed** (853 total).
- `corepack pnpm --filter @project-wing/cmp --filter @project-wing/intranet --filter @project-wing/tms --filter @project-wing/ui-showroom --filter @project-wing/ui -r exec tsc --noEmit`: passed.
- Focused `ultracite check` over the changed shared controls, application adapters, headers, publishing component and tests: passed after fixing import order, ref-reading in a new component, and test harness issues. `oxfmt` was run on changed source/CSS/docs.
- `node scripts/design-first/cli.mjs validate-registry`: passed. Scoped `runAudit` covering shared surface/select, the three app styles, CMP grid/actions, app headers, Intranet publisher and catalog: zero findings; no baseline relaxed.
- With `NEXT_DIST_DIR=.next/material-mobile-build` and `NEXT_PUBLIC_API_MODE=mock`, `corepack pnpm --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ui-showroom --workspace-concurrency=1 -r build`: four builds passed; a final polish rerun is recorded at handoff. Default build directories remain unchanged when the environment variable is absent.
- Final polish rerun of that four-app build completed with exit 0. No production deployment was performed.
- Subsequent long-label overflow polish was verified in the live catalog, the 11 targeted overlay/style tests, and a successful Showroom build. CMP's preview callback also checks viewport width at click time, so an early phone interaction does not use the desktop new-window behavior before the hydration-safe viewport hook updates.
- Final `corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-clients-data-grid.test.tsx --maxWorkers=1` passed 13 tests; `corepack pnpm --filter @project-wing/cmp build` also exited 0 after the click-time viewport safeguard.

## Limits and retained warnings

Subsequent shared keyboard and SmartForm data-integrity hardening is documented in [mobile-production-readiness.md](mobile-production-readiness.md). Release status remains unapproved pending real-backend and repository-wide gates.

- This is adoption of shared mobile patterns plus verified primary flows, not proof that every permission/data combination on every route has been exercised. Real backend upload/download, publication, approval and billing acceptance remain necessary.
- All dates and calculation cells in TMS remain available through the existing horizontally scrolling matrix. No columns were removed or business records flattened into lossy summaries.
- CMP Mock profile preview API was unavailable; the final implementation uses the existing full-detail route instead. No fake success response was added.
- Next development root-redirect diagnostics and the existing Showroom PDF-font broad filesystem trace warning remain. Production builds passing does not certify a deployment.
- Previous full-repository lint/test guard failures remain documented in `mobile-material3.md`; this pass did not weaken those checks or rewrite unrelated code.
- The prior SmartForm rich-text duplicate-ID concern is outside these three application adaptations and remains recorded in `mobile-material3-refinement.md`.
- No commits, pushes, merges, remote deployments, dependency upgrades or recurring automation were performed.
