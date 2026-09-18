# File-dependent work items and settings scrolling — 2026-09-06

## Implementation

- Single-file deletion cancels active attachment, attachment-preview, file-bound review-question and ZIP-session work items in the same transaction. Events carry the deleting actor and `ATTACHMENT_DELETED`; records retain their content/identity snapshot and are CANCELLED rather than completed.
- Cancellation uses the same transaction advisory lock as reconciliation. Reconciliation rechecks live attachments inside that lock so a projection collected before deletion cannot reopen a cancelled task. Missing/permanently removed attachments also cancel historical active tasks during reconciliation.
- Restoration does not resurrect every historical task. Only tasks still emitted by the current domain state are reopened, with a REOPENED audit event and a usable current action target.
- Dependency classification does not treat arbitrary file references as task ownership. Unbound review questions and independent project tasks remain unaffected.
- Project and operations projections exclude review questions/session tasks belonging to deleted files. Stale review actions recheck the owning attachment; file actions already use the non-deleted attachment guard.
- Deletion/restoration refresh the work-items query cache so active lists and counts are reloaded. Historical unavailable action targets render “关联文件已删除” / “Related file deleted” instead of a navigation button.
- EMP settings wrapper now propagates the dialog height. The shared settings body owns vertical scrolling without shrinking/clipping its children; title and navigation remain outside this scroll area. Existing theme and component styling are preserved.

## Browser evidence

Playwright CLI, local EMP mock application at `http://127.0.0.1:3032/zh-CN/engagement/project-orchid-2026`: Settings → 客户与业务 → 展开全部.

`playwright-cli -s=settings-scroll run-code --filename .codex/check-settings-scroll.js` exercised real mouse-wheel scrolling to the bottom. All three widths passed assertions that the last section is reachable, header position is unchanged and the main content has no horizontal overflow:

| Viewport   | Scroll viewport height | Content height | Bottom scrollTop |
| ---------- | ---------------------: | -------------: | ---------------: |
| 1366 × 768 |                    556 |           1358 |              802 |
| 900 × 768  |                    556 |           1782 |             1226 |
| 480 × 768  |                    694 |           2092 |             1398 |

Screenshots inspected: `output/playwright/client-details-1366.png`, `output/playwright/client-details-900.png`, `output/playwright/client-details-480.png`.

The mock preview has a known unavailable Desktop Agent manifest request at localhost:3000. No production/client records were modified. These screenshots validate layout, not database deletion/restore behavior.

## Validation

- `corepack pnpm --filter @project-wing/api exec vitest run src/work-items src/workflow/workflow.service.spec.ts --maxWorkers=2`: 219 passed; one PostgreSQL-gated integration case skipped.
- Combined final regression: `corepack pnpm --filter @project-wing/api exec vitest run src/work-items src/workflow/workflow.service.spec.ts src/workflow/document-conversion.service.spec.ts src/workflow/pdf-raster-preview.service.spec.ts src/workflow/attachment-preview-worker.service.spec.ts --maxWorkers=2`: 264 passed, one PostgreSQL-gated case skipped, 14 files passed.
- `corepack pnpm --filter @project-wing/ui test src/settings-dialog-shell.test.tsx src/work-item-board.test.tsx`: 7 passed.
- `corepack pnpm --filter @project-wing/emp test src/views/workbench-settings-panel.test.tsx`: 25 passed.
- `corepack pnpm --filter @project-wing/emp test src/views/workspace.test.tsx -t restore`: 4 passed, 62 excluded by name filter; the same command with `-t recycle`: 3 passed, 63 excluded. An initial combined regex invocation failed in Windows shell argument handling before tests ran; these separate invocations replaced it.
- `corepack pnpm --filter @project-wing/api lint`, `corepack pnpm --filter @project-wing/ui lint`, `corepack pnpm --filter @project-wing/emp lint`: TypeScript checks passed.
- `corepack pnpm --filter @project-wing/api build`: passed.
- `corepack pnpm exec ultracite check` on the attachment-lifecycle helper/tests, touched work-item projection/synchronizer files and shared settings/work-item components/tests: passed. `git diff --check`: passed.

## Limitations

No schema migration, push, merge, deployment or live data cleanup was performed. Full backend-attached browser acceptance remains unavailable because the local PostgreSQL/Docker engine was not running (see preview-failure-routing-review.md). Unit tests cover SQL predicate shapes, transactional cancellation, audit reasons, stale-projection prevention, restoration reevaluation, and removal of unavailable navigation; they do not replace that integration check. No claim of a new EMP production build is made in this follow-up.
