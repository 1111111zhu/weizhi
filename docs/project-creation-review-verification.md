# Project creation review refinement — 2026-09-06

## PR preparation

PR #1159 contains this UI work only. On 2026-09-06, `NEXT_DIST_DIR=.next-pr-validation corepack pnpm --filter @project-wing/emp build` completed successfully (optimized compilation, TypeScript and 74 generated pages). The isolated output directory was not committed and the dev type references were restored. This is a local build, not remote deployment evidence.

Touched-file Ultracite checks passed after replacing non-null test assertions with explicit required-value guards, using native fieldset/output semantics, and removing an unused type import. Shared GuidedForm tests (9) and typecheck passed; registry validation and scoped boundary audit passed. A final EMP rerun identified an incorrect no-argument expectation introduced by lint autofix; the assertion now checks the actual TanStack query context `queryKey: ["me"]`. No runtime API behavior was changed to satisfy it.

## Follow-up: completion accent

The complete setup summary now uses the shared Badge `success-light` presentation (pale green background and green status dot). Pending configuration remains neutral. `GuidedFormSummary.status` accepts ReactNode for caller-owned status composition; existing string callers remain compatible.

- `corepack pnpm --filter @project-wing/ui test src/guided-form.test.tsx` — 9 passed, including composed status content.
- `corepack pnpm --filter @project-wing/emp lint` and `corepack pnpm --filter @project-wing/ui lint` — passed after correcting the status badge import to the shared UI package.
- Actual mock EMP preview: Review → Edit, complete setup state. Screenshot captured showing the accent beside the summary heading. No data submitted. Full build and production-backed acceptance not run.

## Follow-up: member avatars

Added the existing `HeaderAvatar` to both direct-member and pending-invitation rows, at the same 40px size with no shadow. This uses the application's existing colored initials (JM / KS), not a new photo service. Names, roles, status badges and membership rules are unchanged.

- `corepack pnpm exec oxfmt apps/emp/src/views/new-project.tsx apps/emp/src/views/new-project.test.tsx` — passed.
- `corepack pnpm --filter @project-wing/emp test src/views/new-project.test.tsx engagement/new/page.test.tsx` — 18 passed; includes an accessible owner-avatar assertion.
- `corepack pnpm --filter @project-wing/emp lint` — passed.
- Actual mock EMP browser: existing review → Edit → Invite members → search King → select invitation locally → close → Review. Screenshot confirms avatars for both Jony Ma and King Su. No Create action or invitation delivery occurred. No production acceptance or full build was run for this small presentation change.

## Grouped layout refinement

User requested the same grouped visual language on the review screen. Reused the public `GuidedForm` grouped appearance and `GuidedFormSection`; no new shared API, tokens, or business rules. Details/dates and source/members form equal desktop columns and stack at narrow container widths. Read-only values use definition lists. Removed nested member-card borders. Footer keeps the existing neutral Edit / Create actions.

## Current validation

- `corepack pnpm exec oxfmt apps/emp/src/views/new-project.tsx apps/emp/src/views/new-project.test.tsx apps/ui-showroom/components/showroom/specimens/guided-form-specimen.tsx` — passed.
- `corepack pnpm --filter @project-wing/emp test src/views/new-project.test.tsx engagement/new/page.test.tsx` — 18 tests passed. Extended the existing quick-create test to verify that editing from review retains name and accounting standard, and only final confirmation submits.
- `corepack pnpm --filter @project-wing/emp lint` — passed.
- `corepack pnpm --filter @project-wing/ui-showroom lint` — passed.
- `node scripts/design-first/cli.mjs validate-registry` — structural validation passed; no new full-library readiness or approval claim.
- Scoped `runAudit({stagedFiles: ["apps/emp/src/views/new-project.tsx", "apps/ui-showroom/components/showroom/specimens/guided-form-specimen.tsx"]})` from `scripts/design-first/cli.mjs` — passed. No audit baseline changes.

Browser evidence: actual EMP mock preview at `http://127.0.0.1:3037/zh-CN/engagement/new`, Quick mode → blank project → HKFRS and dates → Review → Edit → Review. Desktop screenshot captured in the task. Showroom at `http://127.0.0.1:3036/specimens/GuidedForm`, narrow preview → quick project review; screenshot confirms stacked groups and wrapped label/value rows. Final Create was not activated. Browser mouse-driven calendar selection was unreliable in the automation surface; keyboard activation selected the report date correctly and populated the derived archive deadline.

Not run: production-backend acceptance, full production build, automated visual regression, complete library readiness/approval gates. No push, merge or deployment. Production template investigation is paused pending the separate read-only diagnostic workflow authorization.
