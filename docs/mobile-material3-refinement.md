# Mobile Material refinement and hands-on verification

2026-09-11. Scope: compatible refinement of the existing mobile Material presentation, not a desktop migration. Worktree: `D:\Project_wing\.worktrees\mobile-app-experience`, branch `codex/mobile-app-experience`.

## Changes

- SmartForm records now use a single row separator, consistent semantic spacing and quieter labels. Repeated field underlines were removed from mobile value previews; choice/date fields use a small tonal surface, not nested cards.
- Choice/date edit buttons cover the whole value surface. Current values are connected to their accessible button descriptions using stable React-generated IDs. Rich-text/reference links remain independently operable rather than being covered by a full-row click target.
- Phone page gutters are consistent; introductory guidance has less excess vertical padding. Long titles and English text wrap without truncating the document content.
- The existing save/status footer is fixed at the bottom only inside the mobile preview, with safe-area padding and sufficient content clearance. Desktop retains its original sticky footer and tables.
- Shared mobile bottom sheets keep their title/close area outside the scrolling body. Sheet options have spacious touch targets and tonal selection; focused wrapped inputs no longer draw two focus outlines.
- Incomplete-draft warnings on phones now say that outstanding responses do not prevent draft saving. This follows the existing `saveDraft` implementation; validation and saving logic were not changed. Desktop copy is retained.

The design-first skill guided reuse of existing semantic tokens and shared sheet behavior. No new public component, dependency, schema-specific column-name rule, route or API was added. Registry status remains experimental.

## Interactive verification

### Running browser / mock SmartForm

Chrome Playwright session `smartform-mobile`, `http://127.0.0.1:3048/zh-CN/dev/smart-form-v2/deferred-income`:

1. Clicked the left/value side of a choice field, not just its chevron; the correct bottom selector opened. Changed and reopened the selection.
2. Filled all required choice fields through their UI, reached **27/27**, saved, switched to read-only and back to filling, and verified 27/27 remained. This page's save callback is in-memory demo state, not backend persistence.
3. Opened working-paper references, searched for `analytics`, selected a result, searched for an absent value, inspected the empty state, cleared the query and undid the added selection.
4. Opened More → English. Inspected the hydrated page at **320px**, with full long title and wrapped text; checked document width against viewport width. Initial pre-hydration screenshots were discarded and recaptured after the mobile controls became visible.
5. Inspected **390px dark presentation** and a long English conclusion selector, including reduced motion. Dark CSS state was applied for this isolated rendering check; this does not establish user preference persistence.
6. At **1440px**, verified the new Material token is absent, the footer is not fixed and the original desktop table/mode tabs remain.

### Actual Android emulator / Chrome / keyboard

Verified target with `D:\Android\Sdk\platform-tools\adb.exe devices -l` and `adb -s emulator-5554 emu avd name`: **ProjectWing_Pixel7_API36**. Reused the existing device without wiping it. Forwarded Chrome's debugging socket on ephemeral localhost port 52454 and attached session `android-mobile`; host 3048 is mapped with ADB reverse. No account/privacy settings were changed.

- Opened a real SmartForm rich-text sheet. Android diagnostics reported `mInputShown=true` and `mIsInputViewShown=true`; native screenshots show the docked keyboard and the editor above it, with heading and close visible.
- Entered a temporary extra line and restored the original plain-text note. Original browser tab content was restored before handoff; test text was not submitted to an API.
- The attached old Chrome/CDP context does not expose Playwright's `hasTouch` option; `locator.tap` is unsupported. Mouse-style click also reported a backdrop interception while the keyboard was active. These were not counted as successful interactions.
- Repeated through **ADB native touch** using the current device screenshot. The panel closed and `mInputShown` became false; screenshot evidence confirms the keyboard/panel were dismissed. No forced DOM click was used to count this as passed.
- Opened a separate `?experience=mobile-refinement` tab for disposable edits. Changed a choice and saved the incomplete draft; the existing implementation accepts draft saving and reports outstanding requirements. This exposed the misleading warning copy corrected in this iteration.

Evidence: `docs/evidence/mobile-app-experience/refine-*.png` (copied from `output/playwright/` after inspection). Android page screenshots have device pixel dimensions; native screenshots include browser chrome and keyboard.

## Checks run

From the task worktree, using the bundled Node runtime on PATH:

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-editor.test.tsx src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-mobile-records.test.tsx --maxWorkers=2`: **32 passed**. The new choice-surface test covers accessible current value, selection retention and dismissal. The editor suite was rerun after extending the draft-copy assertion.
- `corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-workspace.test.tsx src/mobile-keyboard-viewport.test.tsx src/mobile-color-palette.test.ts src/material-controls.test.tsx --maxWorkers=2`: **18 passed**.
- Final `corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-editor.test.tsx --maxWorkers=1`: **19 passed**, including the incomplete-draft copy check. Final EMP and Showroom build rerun exited 0.
- `corepack pnpm --filter @project-wing/emp exec tsc --noEmit` and `corepack pnpm --filter @project-wing/ui exec tsc --noEmit`: passed before final copy polish; final EMP build/typecheck also covers the copy contract.
- `corepack pnpm exec ultracite check apps/emp/src/components/smart-form-v2-editor.tsx apps/emp/src/components/smart-form-v2-editor.test.tsx`: passed after correcting test-only lint/type issues. Targeted `oxfmt --check` over the five touched CSS files passed.
- `node scripts/design-first/cli.mjs validate-registry`: passed. Scoped `runAudit` over the editor and touched mobile CSS: **zero findings**, no baseline changed.
- `git diff --check`: passed. Desktop default palette, shared Button and EMP global CSS have no content diff attributable to this refinement.
- With `NEXT_DIST_DIR=.next/material-mobile-build` and `NEXT_PUBLIC_API_MODE=mock`: `corepack pnpm --filter @project-wing/emp --filter @project-wing/ui-showroom --workspace-concurrency=1 -r build`: passed before final copy polish and rerun for the final source. Showroom still warns about the existing broad PDF-font filesystem trace.

Early formatting attempts used system Node 22.14, which cannot load this repository's TypeScript formatter config. Retried with the existing bundled Node runtime; no dependencies or configuration were changed for that mismatch. An initial test added an unsupported Testing Library `exact` option; it was removed and typecheck/tests rerun.

## Remaining issues / limits

Follow-up: the duplicate-ID and mobile draft-retention defects below were subsequently fixed and regression-tested in [the production-readiness hardening pass](mobile-production-readiness.md). The observations here describe the earlier pass; no persisted-data migration was performed.

- **Resolved in the follow-up hardening pass — rich-text split/duplicate IDs:** this pass originally observed duplicate `smartFormNodeId` values after a newline. The later converter fix repairs collisions while preserving existing valid identities, with regression tests and a real browser editing check. See [mobile-production-readiness.md](mobile-production-readiness.md). No persisted-data migration was performed.
- iPhone Safari, physical hardware, rotation, every permission combination and real backend data were not exercised. No claim of all-page or production acceptance.
- Full repository lint/test were not rerun for this focused pass. Their previously recorded failures remain in `mobile-material3.md`; no assertions or baselines were weakened.
- No commit, push, merge, remote deployment or recurring automation was performed. The emulator and local previews remain available.
