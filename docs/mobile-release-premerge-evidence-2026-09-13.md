# Mobile release pre-merge evidence

This is a validation snapshot, not a claim that the integration has already been deployed. The original integration and closeout records remain historical evidence.

## Approved scope

The user explicitly approved deferring unused whole-site capabilities while retaining all mobile business, security and deployment checks. See [scope approval](mobile-release-scope-approval-2026-09-13.md). The registry records the unused CommandPalette, AuditTrailView and ExternalRequestWorkspace deferrals; global approval remains `proposed`. This release does not declare the whole component library Ready.

## Code and governance

- Actual application changes remain in EMP, CMP, TMS and Intranet, backed by shared `packages/ui` controls. The catalog demonstrates the real exports; it is not a replacement product.
- All 72 previously unaccepted design-boundary groups were resolved. No historical baseline grew. Dynamic document coordinates, authored typography and measured progress are classified narrowly, with paired tests rejecting unrelated or fixed styling.
- Native controls now use shared controls. Locale-independent unit notation is shared; actual interface copy remains in app i18n modules. Synthetic API business records are distinguished from translatable interface copy without excluding real API adapters.
- Archive reimport restoration, field visibility persistence, linked-field selection, readonly/disabled behavior, optimistic version requirements and existing permissions are preserved in tests.
- No Prisma migration, production API service change, deployment workflow change or native-build approval change is part of these closeout repairs. API changes beyond the prior mobile fixture are test corrections; shared code adds the authored-document highlight default.

## Validation already completed

All commands ran from `D:/Project_wing/.worktrees/mobile-app-integration` using bundled Node 24.19.0.

| Command | Result |
| --- | --- |
| `node scripts/design-first/cli.mjs validate-registry` | Passed registry integrity. Global `--require-ready --require-approved` is not claimed passed. |
| `node scripts/ui-stack-guardrails.mjs` | Passed: no unaccepted boundary findings. |
| `node scripts/ui-stack-baseline-monotonic.mjs --base-ref HEAD` | Passed: no baseline growth. |
| `node scripts/volatile-test-assertions.mjs` | Passed with historical assertion allowances unchanged. |
| `node --test scripts/run-workspace-tests.test.mjs scripts/design-first/*.test.mjs scripts/volatile-test-assertions.test.mjs scripts/i18n-static-copy.test.mjs` | 44 passed. A Windows file-URL conversion defect in the provenance test was corrected without changing its assertions. |
| `corepack pnpm --filter @project-wing/ui-showroom test --maxWorkers=1` | 12 files / 78 passed after registering its four legacy suites with Vitest and configuring the existing `@` alias. Assertions were retained. The showroom is now included in the root test task list. |
| `corepack pnpm --filter @project-wing/ui-showroom exec vitest run 'app/pdf-template-fonts/[fileName]/route.test.ts' --maxWorkers=1` | 5 passed: allowlisted files, rejection without filesystem access, and bounded missing-file failure. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/response-warehouse-date-range.test.tsx --maxWorkers=1` | 10 passed. The calendar has an explicit keyboard-accessible trigger; input drafts still follow external changes without an effect reset. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmation-response-warehouse.test.tsx -t 'keeps claimed and matched\|opens the themed calendar' --maxWorkers=1` | 2 passed / 35 skipped after replacing ambiguous label queries with explicit group/button queries. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmations/confirmation-template-workbench.test.tsx -t 'renders the field prompt inside\|changes an existing field type' --maxWorkers=1` | 2 passed / 102 skipped. Tests load the real CSS module rules in jsdom, retaining the original 4 px geometry assertion. |
| `corepack pnpm --filter @project-wing/cmp exec vitest run src/components/cmp-aml-screening-section.test.tsx -t 'lets a reviewer update' --maxWorkers=1` | Passed; keyboard selection is verified before asserting the unchanged server mutation payload. |

Production builds used `NEXT_DIST_DIR=.next-release` and `NEXT_PUBLIC_API_MODE=local`, not Mock mode:

```powershell
corepack pnpm --filter @project-wing/cmp build
corepack pnpm --filter @project-wing/emp build
corepack pnpm --filter @project-wing/tms build
corepack pnpm --filter @project-wing/intranet build
corepack pnpm --filter @project-wing/ui-showroom build
```

All five builds passed. Showroom was rebuilt after bounding the font route to `../emp/public/pdfjs/standard_fonts`. The dynamic-whole-project tracing warning disappeared; the font route manifest decreased from 471 files to 138, with zero local database/runtime artifacts. Existing Node shell deprecation notices remain disclosed. Build-generated `next-env.d.ts` and temporary tsconfig includes are not release changes.

## Backend-attached browser readiness

The existing development deployment is reachable at `https://cmp.superfx.cn`, `https://tms.superfx.cn` and the other configured `*.superfx.cn` application domains. `https://emp.superfx.cn/api/healthz` returned HTTP 200 with `{ "ok": true }`.

Headed Playwright session `release-backend` used the application's existing developer-account picker to select the synthetic Manager account (`manager@projectwing.local`). This is the configured development login flow, not password-login verification or a network mock. Observed requests included:

- `POST https://auth.superfx.cn/auth/development/impersonate` — 200;
- `GET https://cmp.superfx.cn/api/account/me` — 200;
- client groups, clients, users and personal CMP work items — 200.

Business checks were read-only: the client list loaded, searching Orchid returned the seeded Orchid client, and TMS loaded the same authenticated account's current period. Login also produced the application's normal session and account-preference writes. Initial 401 responses occurred before login and are not described as an error-free session.

These observations concern the **existing main deployment**, not the unmerged mobile code. After merging, the deployed image generation and the changed phone flows still require verification. Do not use these baseline observations as post-deployment evidence.

The current branch's CMP phone list was also exercised at `http://127.0.0.1:3082/zh-CN/client` using a fresh Mock preview after a stale development PostCSS worker timed out. At 390×844 the document width was exactly 390 px and four card records were present. [Current phone rendering](evidence/mobile-app-experience/release-cmp-current-mobile.png) was visually inspected. This image is explicitly Mock-mode UI evidence, not backend acceptance. Its console contained favicon 404s and development preload warnings, with no application exception in that path.

`corepack pnpm exec lint-staged --concurrent false` passed all 15 chunks after the full test run completed; it did not overlap test execution. Build-only generated declarations were restored after preview startup. Final commit hooks still run independently.

## Local-environment limitation

Docker Desktop's engine failed during startup with an inference-socket error. No Docker reset, container deletion or database deletion was performed. Official PostgreSQL 16.15 binaries were downloaded from [EDB's binary distribution](https://www.enterprisedb.com/download-postgresql-binaries), linked from [PostgreSQL's Windows download page](https://www.postgresql.org/download/windows/), and extracted only under the ignored `.local/mobile-release-db` directory. Archive SHA-256: `5e8afffe67daf949aeeb03b74951f1ec2324e1888f73fbd036ab0e567ab004d9`.

The subsequent local database initialization/bootstrap command was rejected by tool policy before execution. No local database, migration or seed was created. That rejected initialization was not retried through another execution mechanism; unused temporary credentials were discarded. Backend readiness was instead checked through the already-running development environment.

## Remaining delivery record

The full test run in `output/validation/release-full-tests.log` initially found the two now-corrected date-range selectors. Its results must not be presented as a full pass. A successful final full run through normal commit hooks, final staged review, PR publication, squash merge, Build/Deploy completion and live generation checks remain separate evidence. Exact final results will be added to the PR and completion report only after they occur.
