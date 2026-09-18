# Mobile members and new-Q footer — 2026-09-12

## Scope

Actual EMP screens, not a specimen. Existing Material components/tokens and MobileActionSheet are reused. Desktop presentation and business callbacks remain.

Members are shown as single-column records with name/email, distinct rank and engagement-role labels, authorization badges, and row actions. Management actions move to a labelled menu. Following the user's additional feedback, the inner member content card has no separate background, border, radius, shadow or padding; spacing is tighter and only the settings shell's one 16px content gutter remains. The outer settings navigation/close controls are retained.

New Q uses two equal configuration entries (references and respondent), then a full-width primary submit button. Pickers use existing bottom sheets. The parent still owns allowed respondents, selected IDs, drafts, errors and submission. No change was made to the reply footer, rich-text toolbar or desktop create footer.

## Validation

Worktree: `D:/Project_wing/.worktrees/mobile-app-experience`; bundled Node 24.19.0.

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/views/members.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx src/components/emp-mobile-review-question-footer.test.tsx --maxWorkers=1
corepack pnpm --filter @project-wing/emp exec tsc --noEmit
corepack pnpm exec ultracite check apps/emp/src/views/members.tsx apps/emp/src/views/members-mobile.module.css apps/emp/src/views/members.test.tsx apps/emp/src/components/workbench-paper-section.tsx apps/emp/src/components/emp-mobile-review-question-footer.tsx apps/emp/src/components/emp-mobile-review-question-footer.module.css apps/emp/src/components/emp-mobile-review-question-footer.test.tsx apps/emp/src/components/workbench-content.test.tsx
node scripts/design-first/cli.mjs validate-registry
```

Results: members 8 passed; workbench and footer 195 passed (203 unique tests). Typecheck, scoped lint/formatting and registry validation passed. New tests cover configuration callbacks without premature submission, pending/error/empty states, unassignment, references and complete create payloads, exclusion of explicit raw disabled/suspended/inconsistent members, and invalidating a previously selected respondent when their authorization flag changes.

Playwright used the actual local Mock application at `http://127.0.0.1:3048/zh-CN/engagement/project-orchid-2026`:

- More → Settings → settings overview → Members: checked all three records, search for Leo and clearing it, management menu and row details without invoking management mutations. At 320px the list measured 262px width and scroll width.
- Planning → Client acceptance or continuance → A1-1000 → first file's Q → New: checked reference selection/deselection, respondent picker, nonempty-draft submit enablement, and empty-draft disablement. No Q was submitted. The temporary QA draft was discarded; reopening showed an empty editor, also verified after keyboard select-all/delete.
- At 390px the Q footer measured 364px width/scroll width; configuration targets were 166×44px and submit was 340×44px. At 320px footer width/scroll width were 294px.
- Both surfaces were checked with the existing `.dark` class and restored. At 1440px members retained the six-column table and the mobile list was absent.

Artifacts in `output/playwright/`: `emp-members-mobile-flat.png`, `emp-members-mobile-320.png`, `emp-members-mobile-dark.png`, `emp-members-desktop.png`, `emp-new-q-footer-mobile.png`, `emp-new-q-footer-320.png`, `emp-new-q-footer-dark.png`.

## Existing discrepancy requiring separate business review

The member screen recomputes role consistency from global rank and project role, while the Q assignee filter currently uses raw status, authorizationSuspendedAt and roleConsistent flags. The local Mock data gives Leo/Sam roles that fail the member-screen consistency check but supplies roleConsistent=true, so the badge and picker disagree. Both calculations predate this change (verified against HEAD). This UI-only task did not change that business policy or reauthorize anyone.

Not run: production build, full repository validation, real backend acceptance or Android-native keyboard testing. No real invitations, removals, reauthorization, file uploads or Q submissions were performed. The existing unavailable local Desktop Agent manifest request remains a console error. No deployment occurred.
