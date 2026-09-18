# Project authorization lifecycle - local implementation

Date: 2026-09-10. Branch: `codex/project-permission-hardening`, base `55a0c4f0`.

## Confirmed policy

- Preserve legitimate members' existing invitation, review-signoff and archive-submission permissions.
- Only an effective PIC manages project leadership. Administrator recovery is a separate, audited operation, not an ordinary business membership.
- System administrators may inspect projects, perform final archive review and recover PIC; they may not edit workpapers, insert project-library content, sign workpapers or impersonate a project participant.
- Keep member and signoff history. Incompatible grade/role/leadership combinations stop authorizing access; recovery is an explicit PIC action, not an inferred role rewrite.

## Implemented after phases 1 and 2

1. A nullable `project_members.authorization_suspended_at` records suspension independently from the current grade. Returning to a compatible grade does not erase it.
2. Admin grade changes have a read-only impact preview and require its digest when projects will lose access. The digest includes the current/new grades and affected grant versions. The write recalculates impact, rejects stale confirmation, suspends incompatible grants, revokes sessions and records audit entries in the same transaction. Pre-existing inconsistent grants also require confirmation even if the proposed grade would otherwise make them compatible.
3. PIC reauthorization requires a selected, currently eligible role and a nonempty reason. It clears the suspension and obsolete leadership marker while retaining membership identity, join date, declarations and file-signoff history. Administrators cannot use this ordinary restoration path. Recovery/reauthorization can repair access metadata for archived projects without changing archive status or unlocking file writes.
4. Legacy role-check entry points delegate to the shared action engine. Review signoff has an explicit action. Administrator write bypasses in project update/link/unlink and the workspace UI were removed; recycle-bin viewing is separated from project restoration.
5. Mention descriptions use firm rank, not internal PREPARER/REVIEWER labels. Suspended/inconsistent recipients are omitted. Server review-question assignment also checks current authorization.
6. Membership tests now import the actual shared role rules instead of a duplicated, stale mock matrix.
7. Added `scripts/audit-project-authorizations.mjs`: explicit `--read-only`, no implicit dotenv loading, read-only transaction, no repair path, no credentials in reports. It supports pre-migration schemas by detecting the optional suspension column.
8. Existing Desktop Master and ZIP-entry grants now recheck current project edit permissions before uploading/checking in or renewing a write lease. Queued ZIP publication also rechecks. Idempotent receipts and explicit cleanup/discard paths do not gain publication rights; cleanup after authorization loss can still complete without changing file contents. These were server-side synthetic tests, not fault injection against an installed Agent or Office.
9. Deleted projects reject mutable actions except the distinct restore action. The initializer for normal new projects remains unchanged.

## Interactive checks

Actual EMP routes in isolated Edge/Playwright session `project-leadership`, preview mode at `http://127.0.0.1:3045`:

- `/zh-CN/admin/users`: changing the synthetic Manager to Staff opens the project-impact confirmation; cancellation retains Manager; confirmation records Staff and suspends the affected project grant.
- `/zh-CN/engagement/project-orchid-2026/members`: a pending-reauthorization badge appears. Switching the isolated mock session to its effective PIC, explicitly selecting Staff and providing a reason restores access; the prior MIC marker is removed and the signed declaration remains.
- `/zh-CN/engagement/project-orchid-2026`: the synthetic administrator can inspect the workspace; all 18 displayed refcode controls and 4 local-edit controls were disabled.
- Long-impact fixture: 41 affected projects; the keyboard-focusable confirmation region was 256px high with 1008px scroll content. The cancellation path restored the original isolated mock fixture afterward.
- Actual review-note mention menu: after the synthetic grade-change/reauthorization exercise, the menu showed the account's current Staff rank, not PREPARER/编制人 or REVIEWER/复核人. No message was sent.

Screenshots: [impact confirmation](evidence/project-permission-hardening/grade-impact-confirmation.png), [suspended access](evidence/project-permission-hardening/authorization-suspended.png), [explicit reauthorization](evidence/project-permission-hardening/reauthorization-confirmation.png), [administrator read-only](evidence/project-permission-hardening/administrator-readonly.png), [long impact list](evidence/project-permission-hardening/long-authorization-impact.png).

These browser checks used synthetic, locally persisted preview data, not a production database. Cold Next compilation caused one navigation timeout; the page subsequently loaded. Missing local Desktop Agent manifest requests and existing Next instant-navigation diagnostics were observed. No live account, project, declaration or invitation was changed.

## Commands and evidence

All from the isolated worktree, bundled Node 24 on PATH:

```powershell
corepack pnpm --filter @project-wing/shared build
corepack pnpm --filter @project-wing/shared test
corepack pnpm --filter @project-wing/api test:ci src/users/users.service.spec.ts src/users/project-authorization-impact.spec.ts src/projects/project-access.service.spec.ts src/projects/projects.service.spec.ts src/members/members.service.spec.ts src/members/project-leadership.spec.ts src/members/members.controller.spec.ts src/workflow/workflow.service.spec.ts
corepack pnpm --filter @project-wing/api test:ci src/declarations/declarations.service.spec.ts
corepack pnpm --filter @project-wing/emp test src/views/admin-users.test.tsx src/views/workspace.test.tsx src/views/members.test.tsx src/components/project-leadership-controls.test.tsx src/components/project-reauthorization-controls.test.tsx src/lib/member-role-labels.test.ts src/lib/project-permissions.test.ts src/api/mock-api.test.ts
corepack pnpm --filter @project-wing/emp test src/components/toast.test.tsx src/views/admin-users.test.tsx
corepack pnpm --filter @project-wing/api lint
corepack pnpm --filter @project-wing/emp lint
corepack pnpm --filter @project-wing/api exec prisma validate
node --check scripts/audit-project-authorizations.mjs
git diff --check
```

Evidence collected: shared 274 tests; API main selection 334 tests, declaration selection 7 tests; EMP main selection 160 tests, toast/admin selection 14 tests. Targeted membership rerun after removing the stale shared-role mock: 37 passed; workflow rerun after assignee authorization checks: 190 passed. Typechecks passed. Prisma validate passed with a dummy URL used only for schema validation; no database connection or migration was performed. The expected NoSuchKey and notification-failure fixture logs are negative tests, not production failures.

Scoped design-first checks passed for the changed control/pages and the final confirmation-scroll patch; the project-wide registry/boundary debt described in the earlier report was not waived or expanded. No new registry Ready status was declared. The existing confirmation dialog has a narrow documented `no-noninteractive-tabindex` exception: its named scroll region must be focusable for keyboard scrolling, consistent with the repository's existing member-directory scroll-region pattern.

## Database verification and rollout constraints

- Docker Desktop's Linux engine remained unavailable. An isolated portable PostgreSQL instance was subsequently started on `127.0.0.1:55439`, database `permission_hardening_qa`. Binaries came from the [EDB archive page](https://www.enterprisedb.com/download-postgresql-binaries), linked by the [PostgreSQL Windows download page](https://www.postgresql.org/download/windows/). No machine service, WSL configuration, production database, installed Agent or Office file was changed.
- `corepack pnpm --filter @project-wing/api exec prisma migrate deploy` applied all 212 migrations successfully, including the new suspension column. This proves fresh-database execution, not zero-lock production rollout.
- `RUN_PROJECT_PERMISSION_INTEGRATION=1` with the isolated `DATABASE_URL`, then `corepack pnpm --filter @project-wing/api test:ci src/members/project-permissions.integration.spec.ts`: **4 passed**, including duplicate-invitation serialization, competing PIC recovery, grade-update rollback without confirmation, persistent suspension across grade reversal, explicit reauthorization and administrator read-only enforcement. This suite refuses non-loopback or differently named databases and retains synthetic fixtures only in that dedicated QA database.
- The read-only audit utility ran against that isolated fixture database: migration detected, 10 active memberships, 0 conflicts at that checkpoint. This is **not** a production inventory.
- The read-only production authorization inventory has not been run. With an authorized connection supplied in the process environment, the audit command is:

```powershell
node scripts/audit-project-authorizations.mjs --read-only --connection-env=PROJECT_WING_AUDIT_DATABASE_URL
```

- Apply the nullable-column migration before the new API. `ALTER TABLE` still requires a table lock; schedule and test its lock/rollback behavior rather than claiming zero downtime. API and EMP must be released together. Old API versions do not understand the suspension marker; do not roll back to them while suspended grants exist without a separately reviewed access-preservation plan.
- Inventory existing inconsistent grants during rollout. Do not bulk guess new roles or delete signoff history. Existing invalid combinations fail closed; current valid business permissions are retained.
- User approved the dedicated recovery invitation. It is available only to an active administrator on a non-deleted project without an effective PIC or eligible joined Partner/Principal. It targets an active unjoined Partner/Principal, requires a reason, serializes on the project/account locks, checks pending invitations, and writes the recovery audit in the invitation transaction. Normal administrator invitations remain forbidden. Acceptance creates ordinary membership with no leadership marker; PIC recovery remains a separate explicit action.

PR/merge authorization was explicitly received. Merge and deployment status are reported separately in the task; this document records pre-merge evidence rather than claiming deployment.

Additional late regression command: `corepack pnpm --filter @project-wing/api test:ci src/workflow/workflow.service.spec.ts src/workflow/zip-master.service.spec.ts` passed 241 tests, including revocation of valid-but-old Desktop/ZIP grants and cleanup without publication. `corepack pnpm --filter @project-wing/api test:ci src/declarations/declarations.service.spec.ts` passed 7 tests, including rejection of a project-participant declaration by an administrator observer. The normal system-wide declaration requirement remains unchanged.

Final targeted follow-ups: project-access tests 17 passed; membership tests 38 passed (including refusal to repair an inconsistent grant through an ordinary role edit); latest member-label/confirmation tests 6 passed; members-page/reauthorization UI tests 7 passed. API and EMP typechecks passed after these changes. All changed TypeScript/JavaScript files passed the scoped formatting/static check. The read-only audit command's environment-variable argument is validated so mistakenly passing a connection string cannot echo it in an error.

## Final recovery-invitation verification

- Shared: `corepack pnpm --filter @project-wing/shared test` — 274 passed.
- API: `corepack pnpm --filter @project-wing/api test:ci src/users/users.service.spec.ts src/users/project-authorization-impact.spec.ts src/projects/project-access.service.spec.ts src/projects/projects.service.spec.ts src/members/members.service.spec.ts src/members/project-leadership.spec.ts src/members/members.controller.spec.ts src/members/pic-recovery-invitation.spec.ts src/declarations/declarations.service.spec.ts src/workflow/workflow.service.spec.ts src/workflow/zip-master.service.spec.ts` — 406 passed.
- Additional full API suite: `corepack pnpm --filter @project-wing/api test:ci --maxWorkers=4` — **1,938 passed, 18 skipped; 128 files passed, 5 skipped**. Opt-in database suites remain skipped in this normal run; the new PostgreSQL suite was separately enabled and all 4 tests passed.
- EMP: `corepack pnpm --filter @project-wing/emp test src/views/admin-users.test.tsx src/views/workspace.test.tsx src/views/members.test.tsx src/components/project-leadership-controls.test.tsx src/components/project-reauthorization-controls.test.tsx src/components/toast.test.tsx src/lib/member-role-labels.test.ts src/lib/project-permissions.test.ts src/api/mock-api.test.ts` — 165 passed.
- API `build`, API/EMP `lint` (TypeScript checks), scoped `ultracite check` (49 changed/new JS/TS files), `git diff --check` passed. Generated `.next-permission-live` files are test build artifacts and excluded from the change.
- `node scripts/repository-policy-guardrails.mjs` passed its staged policy check. `node scripts/volatile-test-assertions.mjs` reported 70 existing repository-wide findings; directly running its exported scanner on every changed/new test returned zero findings. No assertion baseline was expanded. The root all-workspace test suite was not run.
- Design-first scoped audit passed for leadership, reauthorization, member/admin pages and the confirmation dialog. No new visual primitives or new registry Ready claims.
- Live UI environment: EMP `http://127.0.0.1:3046`, API `http://127.0.0.1:3056`, isolated PostgreSQL above, background jobs disabled. Separate Playwright session `permission-live`; genuine password login, no mocked API/session. Project `cmtuyrpa6000dccta0vu9f9c7`, accounts `permission-ui-*@example.test`, all synthetic.
- Live flow: admin `/zh-CN/engagement/:id/members` → dedicated recovery invitation → pending invitation row (ordinary Invite disabled) → recipient login → invitation page → Confirm join → administrator login → select accepted member and provide recovery reason → PIC restored. Acceptance does not assign PIC. After recovery the recovery button disappears and ordinary admin invitation remains disabled. Screenshots are under `docs/evidence/project-permission-hardening/live-*.png`.
- Live grade-change flow: administrator `/zh-CN/admin/users` → search synthetic Manager → select Staff → affected-project confirmation → cancel retains Manager → repeat and confirm → member page shows `待重新授权`. This uses the actual role-impact digest and persisted suspension, not a mock response.
- Live restoration: log in as the recovered PIC → member page → Reauthorize → explicitly select the suspended member and Staff responsibility → provide reason → confirm. The pending-authorization badge disappears only after the real API transaction succeeds. Screenshots `live-reauthorization.png` and `live-authorization-restored.png` preserve this evidence.
- Console exceptions disclosed: local Agent health CORS, missing QA native-release manifest, and existing Next instant-navigation diagnostics. They were not misreported as a clean console or fixed by weakening production configuration.
