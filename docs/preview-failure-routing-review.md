# Preview failure routing fix — 2026-09-06

## Behavior

- Removed PRJ-015 from project/team generation and excluded legacy PRJ-015 from personal projection. Preparer/reviewer signoff and other actionable business tasks remain.
- Retained OPS-005 for super administrators, including diagnostic error details. No new user-facing toast system was introduced: the existing cached-preview failure toast and retry UI remain the interaction point.
- Existing persisted PRJ-015 records close during normal synchronization with a RESOLVED event and `ROUTED_TO_OPS` reason. This records retirement of a business task, not recovery of the underlying infrastructure. Historical records are not deleted. The rule ID remains in shared contracts for history compatibility.
- Office conversion PDF caching and invalidation now use StorageService rather than writing directly under UPLOAD_DIR. Local storage retains the existing file-based download contract; OSS returns converted PDF bytes for preview/rasterization without a local upload-directory cache. Raster workers consume those PDF bytes rather than re-reading the original Office file.
- Cache version keys and existing invalidation behavior remain. Storage access errors propagate to the worker/operations path rather than silently becoming cache misses.
- Small existing lint issues in the touched conversion module/tests were corrected without weakening assertions (explicit callback type, preserved error cause, equivalent byte literals/encoding names).

## Validation

All commands ran in `D:/Project_wing/.worktrees/preview-failure-routing` on branch `codex/preview-failure-routing`, based on main `6193de80`.

- `corepack pnpm install --offline --frozen-lockfile --ignore-scripts`: passed. No dependency manifest changes.
- `corepack pnpm --filter @project-wing/shared build`: passed.
- `corepack pnpm --filter @project-wing/api prisma:generate`: first attempt failed because DATABASE_URL was absent; passed with a local test-only datasource URL. No database migration or connection was performed by generation.
- `corepack pnpm --filter @project-wing/api exec vitest run src/work-items src/workflow/workflow.service.spec.ts src/workflow/document-conversion.service.spec.ts src/workflow/pdf-raster-preview.service.spec.ts src/workflow/attachment-preview-worker.service.spec.ts --maxWorkers=2`: 13 files passed, 257 tests passed, 1 PostgreSQL integration test skipped because its explicit database gate was not enabled. Earlier fixture failures were corrected by supplying real required project/attachment fields and retaining the expected missing-responsibility business task.
- `corepack pnpm --filter @project-wing/api lint`: passed TypeScript checking.
- `corepack pnpm --filter @project-wing/api build`: passed again after final corrections.
- `corepack pnpm exec ultracite check` with the eight changed API TypeScript files: passed after the corrections; no baseline exemptions were added.
- `git diff --check`: passed.

## Remaining verification / rollout

No push, merge, deployment, production permissions change, or production data mutation was performed.

Backend-attached browser acceptance is not complete: no local PostgreSQL listener was available and `docker info --format '{{.ServerVersion}}'` failed because Docker Desktop's Linux engine pipe was absent. No mock-browser screenshot is presented as proof of authorization, persistence or live cache recovery.

After deployment, verify the user's failing DOCX with the actual storage driver and converter, check that the business task is gone and OPS diagnostics remain administrator-only, and confirm synchronization retires the old PRJ-015 record. Opening/retrying the preview uses the existing requeue path. If an environment uses local storage, its UPLOAD_DIR still requires appropriate service-user permissions; this patch does not claim to repair a live host's ownership or mount settings. Do not use broad chmod/chown as a substitute for verifying the configured storage driver.
