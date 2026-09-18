# Mobile Q list and conversation navigation

## User-requested change (2026-09-12)

The user requested separate Q selection and Q content on phones, like a mobile conversation app, while retaining desktop split panes. This adapts the existing EMP `ReviewQuestionsPanel` through the established design system; there is no separate prototype or new shared component API.

Below 768px, the review-note dialog fills the available visual viewport. Opening notes shows the status-filtered list, selecting a Q shows its conversation, and Back restores the list. New Q uses the detail pane. Existing explicit Q deep links continue to select the requested conversation. Desktop retains the original 19rem list column and fluid detail column.

Both panes stay mounted; hidden panes are excluded from display and accessibility. Returning restores focus and keeps list scroll, status filter and unsent drafts. The mobile detail uses the existing contextual rich-text composer and public `useMobileKeyboardViewport` hook. Status changes do not silently switch the active mobile conversation. Existing replies, attachments, references, permissions and business mutations remain unchanged.

## Validation

Worktree: `D:/Project_wing/.worktrees/mobile-app-experience`. Bundled Node 24.19.0.

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'separates mobile Q|keeps a reply row mounted' --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'separates mobile Q' --maxWorkers=1
corepack pnpm --filter @project-wing/ui exec vitest run src/mobile-color-palette.test.ts src/mobile-keyboard-viewport.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/workbench-content.test.tsx apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/emp-mobile-navigation.css
node scripts/design-first/cli.mjs validate-registry
```

Results: 188 component tests passed; focused follow-up passed after the final focus-return adjustment. Shared mobile theme and keyboard tests: 11 passed. Typecheck passed after removing unsupported Testing Library `exact` options. Formatting/lint and registry validation passed after formatting the modified tests.

Interactive environment: actual local Mock EMP at `http://127.0.0.1:3048/zh-CN/engagement`, default folder → Orchid → Planning → Client acceptance or continuance → A1-1000 → first file's notes.

Verified list → detail → Back, and typed an unsent QA draft, returned to the list, reopened the conversation and confirmed preservation. The QA draft was cleared without sending. At 390px the dialog measured 390×844; at 320px its scroll width was also 320px. Existing `.dark` class was applied for visual inspection and then removed. At 1440px, reopening notes showed both desktop panes (approximately 304px and 974px wide).

Screenshots under `output/playwright/`:

- `emp-q-list-mobile.png`
- `emp-q-detail-mobile.png`
- `emp-q-detail-320.png`
- `emp-q-detail-dark.png`
- `emp-q-desktop-split.png`

Not verified in this turn: Android software keyboard interaction, hardware Back, backend-attached workflows, production build or full repository validation. No Q was submitted, resolved or deleted during the browser walkthrough. The pre-existing unavailable local Desktop Agent manifest request still logs a console error. No deployment was performed.

## Toolbar-only follow-up and 3×3 format picker

The user clarified that only the formatting toolbar should change, not the reference, status or send actions. Q create/reply now opt into `toolbarDensity="compact"` on mobile, with the original full toolbar remaining the default. Bold, italic, underline, attachment, mention and more form one row. The nine additional formatting actions use the existing MobileActionSheet in a three-column, equal-height grid. Icons have a fixed height and labels reserve two lines, so longer translations do not change tile alignment. Chinese and English copy were updated at the existing Q dictionary boundary.

The toolbar retains selection and stored marks across sheet transitions. A new continuous-typing regression also exposed a pre-existing controlled-value race: a stale passive-effect value could overwrite a later character. The same value comparison/parsing synchronization now runs in a layout effect. No submit or business mutation logic changed.

Additional commands and results:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/review-note-rich-text.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'separates mobile Q' --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/components/review-note-rich-text.tsx apps/emp/src/components/review-note-rich-text.module.css apps/emp/src/components/review-note-rich-text.test.tsx apps/emp/src/components/workbench-content.test.tsx apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/i18n/dictionaries.ts
node scripts/design-first/cli.mjs validate-registry
```

Composer: 24 passed, including partial selection, cancellation, link focus, subsequent typing with marks, attachment persistence, disabled/capability states, and both mention entry paths. Mobile Q integration: 1 passed, 187 unselected; assertions cover create/reply opt-in and unchanged status/send controls. Final typecheck, formatting/lint and registry validation passed.

In the actual local Mock EMP browser, compact toolbar height measured 52px versus 72px before, with six approximately 44px targets on one row. At 320px, toolbar width and scroll width both measured 296px. A partial selection changed only `Beta` in `Alpha Beta Gamma`; applying inline code at the caret and typing `Beta` produced `<p>Alpha <code>Beta</code></p>`. QA drafts were cleared without sending. The format grid measured 3×3 equal 114×91px tiles at 390px and 91×91px at 320px. Both light and existing dark themes were visually checked. At 1440px, reopening the actual Q dialog confirmed `data-toolbar-density="full"` and the original 11 toolbar buttons, including the paragraph selector; `emp-q-toolbar-desktop.png` records this check.

Screenshots: `emp-q-toolbar-only.png`, `emp-q-toolbar-compact.png`, `emp-q-toolbar-320.png`, `emp-q-more-grid.png`, `emp-q-more-grid-320.png`, `emp-q-more-grid-dark.png` under `output/playwright/`. This follow-up did not run the full workbench suite or production build, or exercise Android's native keyboard. The earlier environment limitations still apply.
