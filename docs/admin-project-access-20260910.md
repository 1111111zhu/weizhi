# Local administrator project access repair

System administrators can operate existing active projects without business membership. Shared action authorization, EMP workbench and project/member controls, API project mutation/restoration, workflow lock administration, and leadership/reauthorization actor checks were aligned. Ordinary member eligibility, valid target leadership roles, audit logging, and project lifecycle constraints remain enforced.

## Validation

- Shared: `node node_modules/vitest/vitest.mjs run src/project-permission-consistency.spec.ts src/index.spec.ts` — 102 passed.
- EMP: `node node_modules/vitest/vitest.mjs run src/views/workspace.test.tsx src/lib/project-permissions.test.ts` — 73 passed.
- EMP leadership and reauthorization component suites — 8 passed; `node node_modules/vitest/vitest.mjs run src/views/members.test.tsx` — 6 passed.
- API: project-access.service.spec.ts, workflow.service.spec.ts, project-leadership.spec.ts — 230 passed (backend agent).
- EMP: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false` — passed after building shared in the isolated worktree.
- API local Nest watch compilation — zero errors; `/healthz` returned 200.
- `git diff --check` — passed.
- Real in-app browser, local EMP, administrator account: opened HBR-2026-ACC-YH-013, clicked Archive to project, loaded workflow directory and all 3 response files with passing preview validation. Left the confirmation dialog open; no actual archive was submitted. Screenshot captured in conversation.

## Limits and delivery

Changes live in this isolated worktree and were copied to the existing local visualization checkout for runtime verification. No commit, push, or remote deployment. Full repository tests were not run. Administrator project creation remains excluded by a separate rule and requires a follow-up covering project owner/PIC initialization; this is not a claim of unrestricted permissions throughout every subsystem.

Budget: approximately 12 minutes. One Luna Max backend implementation agent plus one bounded independent reviewer; main thread owned frontend/shared changes and integration. No additional subtasks were assigned once validation became the critical path. Initial member UI test targeted a button absent in the sheet layout; corrected it to exercise the actual searchable invitation control. Initial isolated typecheck lacked built shared declarations; building shared resolved that setup failure.
