# SmartForm mobile structural projection — 2026-09-11

## Latest mobile presentation and input contract

Follow-up user review supersedes the intermediate inline-editor screenshots:

- Mobile body/section/title/label typography uses shared semantic tokens (16/18/20/13px at the default root size) with a native sans-serif-first stack. Root text scaling is not disabled. Chrome's platform-font report confirmed Microsoft YaHei UI for the inspected Chinese text on the Windows QA host.
- Neutral surfaces retain semantic color: green active navigation/formatting, blue working-paper references, and existing warning/error roles. The shared mobile palette is applied only while this preview is narrow, including portals; it is removed on desktop/unmount without changing the user's dark preference.
- The mobile header is title + More, then mode switch + one completion count. Technical ID/draft chrome, permanent reset/language controls and duplicate progress presentation are removed from the main phone header. Reset remains confirmed inside More; language is available there as inline choices.
- Ordinary fields, descriptions, guidance and nested content are flush left. Decorative frames and badges are removed from the page. Source labels and full content are retained: the schema has no explicit section-to-field label alias, so duplicate labels are not deleted by comparing text.
- Number values are unchanged, with native sans-serif typography and aligned baselines rather than monospace or badges.
- Main-page values open the shared `MobileActionSheet` for choice, text, number, date, attachments and rich-text entry. Working-paper search/selection and More use the same bottom container. Rich-text link and block-format choices also use bottom sheets. Native OS file/date UI remains native.
- Input changes still update the original draft and original field/row/column identity; closing a field sheet is not a separate business save. The existing Save action owns persistence. Desktop popovers/editors are retained.
- The editor inside a sheet uses stable plain chrome, with formatting controls visible throughout that editing session. This fixes a pointer-close regression caught visually: hiding a focused toolbar on pointer-down moved the close button before pointer-up. The shared close control also avoids prematurely blurring a focused input. Keyboard inset/height follows the visual viewport and ignores pinch zoom; reduced-motion users do not get the entrance animation.
- Next.js `devIndicators: false` removes the N debug floater using the supported config. Compile/runtime errors are still surfaced. Toolbar selection uses a subtle green tint rather than a solid black shape.

Final evidence: `smartform-mobile-final-header.png`, `smartform-mobile-final-richtext-sheet.png`, `smartform-mobile-final-reference-sheet.png`, and `smartform-mobile-final-dark.png` under `docs/evidence/mobile-app-experience/`. These were inspected after the relevant transition settled; an intermediate partly transparent transition capture was replaced.

Current QA environment: local mock-mode EMP at 3048; headed Chrome Playwright CLI session `smartform-mobile`. Verified bottom alignment, absence of anchored reference popovers, single-choice selection, reference filtering, rich-text formatting and single-click dismissal, nested More → reset confirmation → Cancel, absence of N, dark surfaces, 360px overflow and restoration of desktop styling at 1440px. User-provided Android screenshots also show the native keyboard with the bottom editor above it, but comprehensive physical-device/IME testing is not claimed. No authenticated API save, full build, PR, merge or deployment was run.

Current result: EMP typecheck passed; 50 targeted EMP tests and 13 shared UI tests passed. Scoped lint/format, registry validation and the focused boundary audit passed. The `/mobile#overlays` catalog also includes an editable field inside the actual shared sheet, rather than documenting keyboard support only in prose. At 412px the catalog sheet accepted input, closed with Escape and retained its controlled draft after reopening. The inspected artifact is `docs/evidence/mobile-app-experience/mobile-sheet-input-catalog.png`.

Current targeted commands (same worktree):

```powershell
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm --filter @project-wing/emp exec vitest run src/components/review-note-rich-text.test.tsx src/components/smart-form-v2-editor.test.tsx src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-mobile-records.test.tsx src/components/smart-form-v2-mobile-appearance.test.tsx
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-keyboard-viewport.test.tsx src/mobile-workspace.test.tsx src/mobile-color-palette.test.ts
corepack pnpm exec ultracite check apps/emp/next.config.ts apps/emp/src/components/smart-form-v2-editor.tsx apps/emp/src/components/smart-form-v2-readonly.tsx apps/emp/src/components/smart-form-v2-mobile-header.tsx apps/emp/src/components/smart-form-v2-preview.tsx apps/emp/src/components/smart-form-v2-mobile-appearance.ts apps/emp/src/components/smart-form-v2-mobile-appearance.test.tsx apps/emp/src/components/review-note-rich-text.tsx apps/emp/src/components/review-note-rich-text.test.tsx packages/ui/src/mobile-workspace.tsx packages/ui/src/mobile-keyboard-viewport.ts packages/ui/src/mobile-keyboard-viewport.test.tsx
corepack pnpm exec oxfmt --check apps/emp/src/components/smart-form-v2-mobile-form.module.css apps/emp/src/components/smart-form-v2-mobile-input.module.css apps/emp/src/components/smart-form-v2-mobile-header.module.css apps/emp/src/components/smart-form-v2-mobile-preview.module.css apps/emp/src/components/review-note-rich-text.module.css packages/ui/src/mobile-workspace.css packages/ui/src/mobile-color-palette.css
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
corepack pnpm --filter @project-wing/ui-showroom typecheck
corepack pnpm exec ultracite check apps/ui-showroom/components/showroom/specimens/mobile-pattern-catalog.tsx
git diff --check
```

Scoped boundary audit uses the `runAudit` invocation below, with the editor, readonly renderer, mobile header, preview, rich-text composer and shared mobile workspace implementation as `stagedFiles`. An i18n finding on the existing `https://` placeholder was fixed by using a labeled native URL input without that placeholder; no audit baseline was relaxed. The old unconditional `.ms-9` assertion was updated to require desktop-only indentation plus full mobile width, matching the user's approved layout change rather than dropping the assertion.

User direction: use one general structure-based translation, not document-name or column-label special cases; phone content is flat, left aligned and not collapsible.

## Contract

- `smart-form-v2-mobile-sheet.ts` projects the existing AST column tree while retaining every leaf's ID, order and complete ancestor-header path.
- Existing `presentation.responsive` decides records (`cards`, the schema's legacy name) versus comparison table (`scroll`). Multiple row-label columns retain the table instead of guessing a single heading. No label/ID/filename heuristics.
- Field type and cardinality decide compact versus full-width placement. Numeric, date and single-choice values can share a row; multi-choice, text, rich text, references, attachments and content overrides take the full width. Original source order is retained. CSS dimensions describe layout, not business meaning.
- Empty overrides and conditionally invisible cells are not rendered as phantom fields. Required indicators preserve per-cell overrides. Grouped header paths also label editable field groups, so identically named columns remain distinct.
- Readonly and editor reuse one domain record renderer, original value/control renderers and original save callbacks. Review identity is unchanged. Review focus chooses the visible representation rather than a hidden desktop twin.
- Phone sections, guidance and row hierarchies are always expanded. Desktop disclosure state is preserved across viewport changes, but cannot hide phone content. Section descriptions and record headings share the left baseline.
- Desktop rendering is retained. This does not change the API, persistence, permissions, audit behavior or canonical fixture data.

## Scope and limits

This iteration connects existing **fixed-row sheets** to the new reading and filling projection. Repeatable-row editing/rendering limitations in the existing EMP renderer are not solved here; nor are arbitrary tables nested inside rich text automatically converted. The adapter is not a claim that every legal AST operation now works on a phone. Full authoring, live API saves, IME/device-wide acceptance and complete operation parity remain open. No deployment or Ready promotion was performed.

## Evidence

Local EMP mock-mode preview, port 3048:

- `/zh-CN/dev/smart-form-v2/deferred-income`: canonical production-shaped form.
- `/zh-CN/dev/smart-form-v2/mobile-structure`: different field IDs/types, nested row group, duplicate leaf labels with distinct ancestor headers, hidden and empty cells, content/required overrides, and explicit comparison-table mode.

Headed Chrome via Playwright CLI `smartform-mobile`: tested 412×783 and 360×780 without page overflow; no mobile expand/collapse controls; section-description left edge checked at <=16px. Entered `42` in the grouped numeric input of the fixture, saved through the preview's in-memory callback and verified the value in readonly mode. The explicit comparison table remained visible and scrollable. Collapsed at 1440px, resized to 360px and confirmed children reappeared with no disclosure controls. This save was fixture-only, not a business API write.

ADB read-only screenshot inspection also confirmed the running Pixel 7/API 36 emulator displayed the updated real EMP filling page, flat sections and aligned descriptions. No emulator navigation bypass was attempted after the earlier policy denial. Native keyboard behavior was not exercised in this iteration.

Inspected images under `docs/evidence/mobile-app-experience/`: `smartform-semantic-flat-reading.png`, `smartform-flat-description.png`, `smartform-mixed-schema.png`, `smartform-comparison-preserved.png`, and `android-smartform-flat-current.png`. The earlier table-only and collapsible screenshots are historical, not the current mobile design.

## Validation commands and results

Run from `D:/Project_wing/.worktrees/mobile-app-experience`:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-mobile-sheet.test.ts src/components/smart-form-v2-mobile-records.test.tsx src/components/smart-form-v2-readonly.test.tsx src/components/smart-form-v2-editor.test.tsx
corepack pnpm --filter @project-wing/emp exec vitest run src/components/smart-form-v2-review-questions.test.tsx
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/smart-form-v2-mobile-sheet.ts apps/emp/src/components/smart-form-v2-mobile-records.tsx apps/emp/src/components/smart-form-v2-mobile-sheet.fixture.ts apps/emp/src/components/smart-form-v2-mobile-sheet.test.ts apps/emp/src/components/smart-form-v2-mobile-records.test.tsx apps/emp/src/components/smart-form-v2-readonly.tsx apps/emp/src/components/smart-form-v2-editor.tsx apps/emp/src/components/smart-form-v2-editor.test.tsx apps/emp/src/components/smart-form-v2-expansion.tsx apps/emp/src/components/smart-form-v2-review-questions.tsx apps/emp/src/components/smart-form-v2-review-questions.test.tsx
corepack pnpm exec oxfmt --check apps/emp/src/components/smart-form-v2-mobile-records.module.css apps/emp/src/components/smart-form-v2-mobile-preview.module.css
```

35 tests in the four renderer/model/editor suites and one review-focus test passed. Typecheck and scoped lint/format passed. Initial new-fixture validation caught incorrect field-template labels and a number-answer `value`/`decimal` mismatch; these were corrected before the passing reruns. No assertions or audit baselines were relaxed. Full build, full repository tests, authenticated persistence and physical-device acceptance were not run.

Registry and scoped boundary validation also passed:

```powershell
node scripts/design-first/cli.mjs validate-registry docs/design-system.registry.json --project-root .
node --input-type=module -e 'import {runAudit} from "./scripts/design-first/cli.mjs"; const result=await runAudit({stagedFiles:["apps/emp/src/components/smart-form-v2-mobile-sheet.ts","apps/emp/src/components/smart-form-v2-mobile-records.tsx","apps/emp/src/components/smart-form-v2-editor.tsx","apps/emp/src/components/smart-form-v2-readonly.tsx","apps/emp/src/components/smart-form-v2-expansion.tsx","apps/emp/src/components/smart-form-v2-review-questions.tsx"]}); if(!result.success)process.exitCode=1;'
```

The new dev route was formatted with Ultracite; its lint phase reports no matching files under the current page ignore rules, so no page-specific lint pass is claimed. EMP typechecking covers the route.
