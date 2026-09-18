# Mobile UI production-readiness audit

Date: 2026-09-11. **Status: local hardening verified; not production-release approved.**

Worktree: `D:\Project_wing\.worktrees\mobile-app-experience`, branch `codex/mobile-app-experience`. The existing mobile Material design is retained; no desktop visual redesign, API migration, dependency addition or deployment was performed. Design-first was used for ownership and verification discipline, not to self-promote the component registry to Ready.

## Defects fixed in this pass

1. **Rich-text identity collisions.** Paragraph/list splitting can copy `smartFormNodeId`. The editor previously trusted every incoming ID, producing duplicate React keys and risking review-target identity errors. The converter now reserves incoming identities, keeps the original ID with unchanged matching content when possible, assigns unique IDs only to collisions, and reuses repaired IDs on later edits. Text and marks are preserved; input JSON is not mutated. Existing valid IDs and desktop appearance remain unchanged. No persisted data migration was run.
2. **Unsaved phone draft loss on mode switching.** The preview shell previously unmounted the editor and reopened from the saved response. Phone sessions now retain a separate local draft. Read-only mode displays that draft, and returning to edit restores it against the original saved baseline, so the interface still says unsaved. `initialDraft` is an optional editor restoration input; callers without it retain the original initialization. A desktop-only session retains the previous mode behavior.
3. **Missed keyboard tracking for delayed portals.** A surface ref could still be null when its owner effect ran, permanently skipping viewport subscription. The hook now waits for the portal node through a short-lived MutationObserver, disconnects immediately after attachment, and cleans up on unmount. It does not poll continuously.
4. **Keyboard transition/focus handling.** Moving focus from an editor to an in-panel control retains geometry until the visual viewport recovers. Outside blur, pinch zoom and unmount still clear the transient styles. Mobile scroll padding/margins leave clearance for the fixed save bar.
5. **Scrollbar-gutter overflow.** EMP and TMS inherited a 320px body minimum; a 320px viewport with a non-overlay vertical scrollbar has less than 320px of usable content width. The phone-only styles remove that minimum. Follow-up checks compare root scroll width with root client width, not just `innerWidth`.

## Evidence

### Regression tests

The three initial identity regressions failed before the fix. They cover a split paragraph, insertion before unchanged evidence, and nested list/paragraph IDs. A fourth case covers a 100-paragraph pasted sequence and subsequent editing without identity churn.

The mobile mode-switch test failed before the fix because the changed value disappeared from preview. It now verifies preview retention, restored unsaved state, enabled saving and successful local save feedback.

The delayed-surface keyboard test failed before the fix because no viewport style was attached. It now verifies delayed mounting and cleanup. The existing test additionally verifies focus moving to an in-panel action and back, pinch zoom, viewport recovery and outside blur.

### Real browser interaction

- Local EMP `3048/en-US/dev/smart-form-v2/deferred-income?production-ui-check=1`, 390px: opened the actual rich-text editor, used Enter to split a paragraph, inserted a temporary test line, switched Read only → Fill, and verified the line and unsaved status remained. No new duplicate-key console errors occurred during this flow.
- 320px with temporary 20px root text: root/body width remained within the viewport. Temporary font overrides were restored. This is a text-size stress check, not an OS-zoom or complete WCAG certification.
- Chrome Accessibility tree checks found no unnamed non-ignored interactive controls in the checked EMP view and the current CMP/TMS/Intranet primary views. These checks do not substitute for a full screen-reader audit.
- Android AVD `ProjectWing_Pixel7_API36` / `emulator-5554`, actual Chrome: the portal timing defect was confirmed with missing inline viewport variables while the keyboard was visible. After a fresh reload of the fixed code, the variables attached correctly. Bold activation and close succeeded without a forced DOM click; the panel stayed inside the keyboard-visible viewport. Native input-method diagnostics showed the keyboard open during editing and closed after dismissal.
- Some attempts against an already-open hot-reloaded Android panel reported backdrop interception. They were not counted as successful checks. A fresh-load run exercised the corrected attachment lifecycle and passed.

Inspected screenshots are under `docs/evidence/mobile-app-experience/production-*.png`. Test edits were confined to separate local fixture tabs and were not submitted to a real backend.

## Commands run

All commands used the existing bundled Node runtime on PATH.

- `corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-editor.test.tsx src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-preview.test.tsx src/components/smart-form-v2-rich-text-identity.test.ts src/components/review-note-rich-text.test.tsx --maxWorkers=2`: **51 passed**.
- `corepack pnpm --filter @project-wing/ui --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --workspace-concurrency=1 -r test --maxWorkers=2`: shared UI **270**, CMP **301**, TMS **236**, Intranet **47**, all passed. Together with the 51 EMP targeted tests, **905 related tests passed**.
- `corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-keyboard-viewport.test.tsx src/responsive-dialog-surface.test.tsx --maxWorkers=2`: **5 passed** after the portal fix.
- `corepack pnpm --filter @project-wing/emp --filter @project-wing/ui -r exec tsc --noEmit`: passed, with follow-up UI/EMP checks after the final hook changes.
- `corepack pnpm exec ultracite check apps/emp/src/components/smart-form-v2-editor.tsx apps/emp/src/components/smart-form-v2-preview.tsx apps/emp/src/components/smart-form-v2-rich-text-identity.test.ts apps/emp/src/components/smart-form-v2-preview.test.tsx packages/ui/src/mobile-keyboard-viewport.ts packages/ui/src/mobile-keyboard-viewport.test.tsx`: passed.
- `node scripts/design-first/cli.mjs validate-registry`: passed. Scoped `runAudit` on the editor, preview, mobile preview CSS and keyboard hook: zero findings, no baseline changed.
- `corepack pnpm lint`: **failed** repository-wide formatting/lint findings across unrelated modules, tooling and documentation. The command does not reach its chained full typecheck.
- `corepack pnpm test`: **failed** before workspace tests at the volatile-assertion guard, with **70 findings**. Assertions were not weakened and baselines were not refreshed to hide this.
- With `NEXT_DIST_DIR=.next/material-mobile-build` and `NEXT_PUBLIC_API_MODE=mock`, `corepack pnpm --filter @project-wing/emp --filter @project-wing/cmp --filter @project-wing/tms --filter @project-wing/intranet --filter @project-wing/ui-showroom --workspace-concurrency=1 -r build` completed with exit 0 for all five apps. The existing Showroom PDF-font filesystem-tracing warning remains.
- After the scrollbar-gutter fix, `corepack pnpm --filter @project-wing/emp --filter @project-wing/tms --workspace-concurrency=1 -r build` also passed in the same environment. The targeted keyboard/style test run passed 10 tests, and strict root-client-width checks passed for EMP, CMP, TMS and Intranet.

## Release gates still open

| Gate | Status |
| --- | --- |
| Reproduced draft/identity/portal defects | Fixed and locally verified |
| Related regression tests, scoped lint and typecheck | Passed |
| Representative mobile rendering and Android keyboard | Verified on local fixtures |
| Repository-wide lint/test gates | Not green; needs scoped triage before release |
| Real backend save/retry, permissions, uploads/downloads, publication/approval | Not verified |
| iPhone Safari, physical devices, broader accessibility and release sign-off | Not verified |

A real test environment and test login were requested. Local checks found no listener on the default API/PostgreSQL/Redis ports, and `docker ps` failed because the Docker Desktop Linux engine was unavailable. The repository demo backend requires database services. No existing database was started, seeded, reset or migrated merely to obtain a green result.

**Do not describe this audit as production readiness, a deployment, or global design-system approval.** The next acceptance step requires an approved backend-attached test environment and resolution/triage of the remaining repository gates.
