# Project permission hardening - local phase 1

## Implemented

- Shared eligibility predicate checks the current grade against the persisted project role, then checks leadership grade and project-duty compatibility. A stale PIC marker no longer bypasses these checks in the ordinary action matrix.
- All four ProjectAccessService member/mutable/legacy-role/action entry points now load the current account grade and status and pass through the same eligibility boundary. Disabled accounts and inconsistent ordinary memberships fail closed, including read access through this boundary.
- Existing virtual Super Admin behavior for an active administrator without active membership is retained pending a separate administrator policy decision; it is not treated as a valid persisted business role.
- No user, membership, signature, declaration or audit history is deleted or rewritten. Existing legitimate action policy (including Staff invitation and archive submission) is unchanged. Tests of invalid Manager/Principal PREPARER combinations now explicitly require rejection; positive fixtures use assignable REVIEWER memberships.

## Phase 2 - approved leadership policy implemented locally

- After the user confirmed that leadership assignment is distinct from invitation, added a shared effective-PIC predicate and an independent project leadership transaction.
- Only a current, eligible PIC may set/cancel leadership through the ordinary endpoint. Self-assignment is rejected; removing the final effective PIC is rejected until another is assigned. An explicit PIC/MIC assignment reconciles the target's internal role to PARTNER/REVIEWER as part of that authorized action and records both old and new values.
- Added an administrator-only `POST /engagement/:projectId/members/:memberId/recover-pic` route with a required reason. It cannot override any current effective PIC and cannot operate on non-active projects.
- Leadership transactions lock the project, relevant accounts and membership rows, re-read account eligibility, and commit the audit entry with the update. This is an implementation safeguard, not a claim of tested real-database concurrency.
- Ordinary member-role updates/removal reject leadership-bearing members and use an `inChargeRole: null` write condition to prevent a concurrent assignment being overwritten. Invitation acceptance locks the project, rejects replacing an active member, and clears historical leadership when rejoining.
- Linking an existing EMP project to CMP must pass an effective-PIC check before it can synchronize/reset PIC/MIC. Initial project creation remains unchanged.
- The actual members page now has a separate leadership dialog and, only when appropriate, an administrator recovery dialog. Invitation remains separate. Existing Button, Dialog, Field and Select primitives are reused under design-first guidance; bilingual copy uses the existing dictionary.

## Still pending - not a completed permissions redesign

This is the historical phase-1/2 checkpoint. The implemented lifecycle and administrator-policy follow-up, current validation and remaining deployment gates are recorded in [phase 3](project-permission-hardening-phase-3.md).

- Grade-change impact reporting and reauthorization workflow. The current patch denies inconsistent combinations but does not reconcile or migrate persisted grants.
- Unifying legacy role capabilities and action policies, deciding invitation/review/archive and system-administrator boundaries, and updating UI labels to that model.
- A read-only inventory of existing production conflicts and a rollout/rollback plan. This patch must not be described as deployment-ready without that assessment: existing inconsistent memberships would lose access.
- Authenticated backend-attached browser acceptance and real database concurrency/role-change testing. No live accounts or permissions were inspected or changed.

## Checks

Run with bundled Node 24 from the isolated worktree:

```powershell
corepack pnpm install --filter @project-wing/emp... --filter @project-wing/api... --frozen-lockfile --ignore-scripts
corepack pnpm --filter @project-wing/api exec prisma generate
corepack pnpm --filter @project-wing/shared build
corepack pnpm --filter @project-wing/shared test
corepack pnpm --filter @project-wing/api test:ci src/projects/project-access.service.spec.ts src/members/members.service.spec.ts src/users/users.service.spec.ts
corepack pnpm --filter @project-wing/emp test src/lib/project-permissions.test.ts
corepack pnpm --filter @project-wing/api lint
corepack pnpm --filter @project-wing/emp lint
corepack pnpm exec ultracite check packages/shared/src/index.ts packages/shared/src/project-permission-consistency.spec.ts apps/api/src/projects/project-access.service.ts apps/api/src/projects/project-access.service.spec.ts apps/emp/src/lib/project-permissions.test.ts
git diff --check
```

Shared: 273 passed; API selection: 63 passed (15 access-boundary tests); EMP permission wrapper: 5 passed. API and EMP typechecks passed. Prisma generation used a dummy URL and did not connect to a database. Members/Users tests still mock access and shared-role helpers; they are regression checks, not independent proof of authorization correctness. The access-boundary tests and exhaustive grade/role/action mismatch checks exercise the actual shared predicate. No full repository tests, build, PR, merge or deployment was performed.

## Phase 2 interactive acceptance

Playwright CLI session `project-leadership`, actual EMP members route at `http://127.0.0.1:3045/zh-CN/engagement/project-orchid-2026/members`, isolated preview-mode data. Verified PIC -> MIC selection -> confirmation -> member table change and disappearance of ordinary removal; ordinary Manager has no leadership control; administrator has no recovery control while PIC exists; seeded only this isolated browser's mock state without a PIC -> administrator chooses an eligible member, must supply a reason, confirms -> PIC restored and recovery control disappears. No real project, user or invitation was mutated.

The browser checks used mocked persistence, not an authenticated real backend. Existing local Desktop Agent manifest requests failed because that API was not running; Next development instant-navigation diagnostics were also observed. No clean-console or production acceptance claim is made.

Design-first scoped boundary audit for the new control and members page passed. Repository-wide audit/registry checks did not pass (120 boundary groups / 756 registry errors in the broad runs); no baseline or approval state was relaxed. No new shared UI primitive or registry Ready status was introduced.

Screenshots: [leadership confirmation](evidence/project-permission-hardening/leadership-confirm.png), [administrator recovery](evidence/project-permission-hardening/leadership-recovery.png).

Final phase-2 results: API selection 137 passed; EMP selection 78 passed; API/EMP typechecks and changed-source static checks passed. Per user feedback the recovery explanatory paragraph was removed; the reason field, server authorization and transactional audit remain intact. The recovery-control tests were rerun after this display-only change. Neither phase has been pushed, merged or deployed.

Additional regression commands:

```powershell
corepack pnpm --filter @project-wing/api test:ci src/members/project-leadership.spec.ts src/members/members.service.spec.ts src/members/members.controller.spec.ts src/projects/projects.service.spec.ts src/projects/project-access.service.spec.ts src/users/users.service.spec.ts
corepack pnpm --filter @project-wing/emp test src/components/project-leadership-controls.test.tsx src/lib/project-permissions.test.ts src/views/members.test.tsx src/api/mock-api.test.ts
```
