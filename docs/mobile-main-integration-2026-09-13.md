# Mobile / main integration — 2026-09-13

This is the historical integration record. See [the subsequent release closeout](mobile-release-closeout-2026-09-13.md) for the latest repairs, test results and unresolved release gates.

## Delivery state

Not merge-ready. No published commit, push, PR, merge, workflow dispatch or deployment was performed. The user authorized PR and merge after completion and confirmed reconciling against main while preserving the approved phone presentation. Repository-wide validation remains blocked; no hooks, assertions, audit baselines or registry approvals were waived.

- Integration: `D:/Project_wing/.worktrees/mobile-app-integration`, branch `feat/integrate-mobile-app-experience`, based on `1ee97a4c`.
- Original backup and previews: `D:/Project_wing/.worktrees/mobile-app-experience`, branch `codex/mobile-app-experience`. Left intact.
- The `feat/` branch follows the executable pre-push policy. The original `codex/` branch is not eligible under that policy.
- There are no remaining unmerged Git paths. Main has not been fetched again since the integration base was established; fetch/reconcile again before publishing.
- Final staged scope: 481 files, including accumulated mobile source, shared UI, documentation and visual evidence.

## Reconciliation

Resolved the twelve overlapping paths individually: the shared Select and Toaster; EMP response warehouse grid, confirmation editor/panel, project header/top bar, workpaper section, members view/test, projects and workspace.

Main's business logic, authorization, confirmation lifecycle, response claiming/returning, tablet navigation, Select alignment and toast lifecycle were retained. The task's phone navigation, lists, action sheets and mobile titles were retained below the phone breakpoint. The complete response warehouse retains archiving; the unmatched warehouse retains main's batch-return workflow. Tests assert the complete selected confirmation IDs at the actual archive entry point instead of demanding an obsolete archive action in the unmatched list.

Additional validation cleanup removed unused imports and obsolete private helpers, supplied accessible labels for render-slot anchors, stabilized effect dependencies and synchronized prop-derived form state without effects. Test fixtures preserve strict boolean checks and exact mock call counts. Mutable API fixtures must be evaluated at invocation, not converted into setup-time snapshots. The mobile viewport test restores the original mock implementation to avoid contaminating subsequent desktop tests.

One local lint exception documents why an inline dynamic SVG must keep its `img` role; no equivalent HTML image tag can contain the dynamic chart. Passive chart focus was removed, while its accessible name and image role remain tested. No global lint policy changed.

Generated `next-env.d.ts` local preview/build paths were restored to main, including the showroom. An unrelated pnpm-generated native-build approval placeholder was removed; native build approval policy was not expanded.

## Validation evidence

Commands ran in the integration worktree using bundled Node 24.19.0 on PATH. Results below are not production deployment evidence.

| Command | Result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | Dependencies linked, but exit 1 because `electron-winstaller` requires an unapproved native build. Web dependencies were usable. |
| `corepack pnpm --filter @project-wing/shared build` | Passed. |
| `corepack pnpm --filter @project-wing/emp exec tsc --noEmit` | Passed, including after the integration cleanup. |
| `corepack pnpm --filter @project-wing/cmp exec tsc --noEmit` | Passed, including after the integration cleanup. |
| `corepack pnpm --filter @project-wing/tms exec tsc --noEmit` | Passed earlier in this integration; not rerun after final formatting-only changes. |
| `corepack pnpm --filter @project-wing/ui exec vitest run --maxWorkers=1` | 35 files / 273 tests passed. |
| `corepack pnpm --filter @project-wing/cmp exec vitest run --maxWorkers=1` | 50 files / 315 tests passed. |
| EMP six-file regression command below | 6 files / 238 tests passed. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx src/components/confirmations/project-confirmation-editor.test.tsx --maxWorkers=1` | Editor: 99 passed. Panel initially failed due to viewport mock leakage; this run was not a pass. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx --maxWorkers=1` | After fixing leakage: 117 passed / 2 failed. The remaining failures were mutable fixture snapshots; subsequently corrected. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/project-confirmations-panel.test.tsx -t 'refreshes the template library\|keeps failed confirmations selected\|saves mobile base information\|only fills global fields' --maxWorkers=1` | Final targeted verification: 4 passed / 115 skipped. Full panel suite was not rerun after these last two fixture corrections. |
| `corepack pnpm --filter @project-wing/emp exec vitest run src/components/workbench-content.test.tsx -t 'uses the mobile file list' --maxWorkers=1` | 1 passed / 195 skipped after completing the navigation mock. Not a full workbench suite pass. |
| `node scripts/repository-policy-guardrails.mjs` | Passed on the staged integration. |
| `corepack pnpm exec lint-staged --concurrent false` | Initially failed on nested warehouse test hooks/non-null fixtures. Those were subsequently corrected; no hook bypass. Final full hook not claimed passed. |
| `corepack pnpm test` | Failed before workspace execution: 154 volatile assertion findings. |
| `corepack pnpm test:precommit` | Final staged verification failed at the same 154-finding assertion guard, exit 1. Workspace tests were not reached by this hook. |
| `node scripts/run-workspace-tests.mjs` | Diagnostic run started independently after the root guard failed, then stopped after failures. Not a full-suite pass. An earlier part overlapped lint-staged's temporary checkout manipulation and is not acceptance evidence; stable targeted reruns above supersede it. |
| `node scripts/design-first/cli.mjs validate-registry` | Basic schema validation passed. |
| `node scripts/design-first/cli.mjs audit --json` | Failed: 448 findings / 117 unaccepted groups. |
| `node scripts/design-first/cli.mjs validate-registry --require-ready --require-approved` | Failed: 816 errors, including absent approval and missing component verification/state evidence. |
| `git diff --check` and `git diff --cached --check` | Passed, with Windows LF/CRLF notices. |

EMP six-file regression:

```powershell
corepack pnpm --filter @project-wing/emp exec vitest run src/components/confirmation-response-warehouse.test.tsx src/components/confirmations/confirmation-response-warehouse.test.tsx src/components/project-wing-top-bar-controls.test.tsx src/views/members.test.tsx src/views/projects.test.tsx src/views/workspace.test.tsx --maxWorkers=1
```

The read-only static check was repeated in bounded file batches using the same installed Ultracite configuration, with `node_modules/.bin` and bundled Node on PATH:

```powershell
node node_modules/ultracite/dist/index.js check <explicit batch of integration paths>
```

The final scan's only remaining findings were two missing blank lines after showroom route imports; those lines were then added and checked. Earlier invocations failed because parentheses in Windows paths were interpreted by a command wrapper or because local binaries were missing from PATH. Those command-invocation failures were not reported as code passes.

## Running application and visual evidence

Integration CMP: `http://127.0.0.1:3072/zh-CN/client`. Started with:

```powershell
$env:NEXT_PUBLIC_API_MODE = 'mock'
corepack pnpm --filter @project-wing/cmp exec next dev -H 127.0.0.1 -p 3072
```

Used a separate headed Playwright CLI session, `mobile-integration`, signed in through the existing Mock development-account picker as Partner, opened Orchid from the phone list, inspected the detail and returned. Verified 390×844 phone and 1366×900 desktop layouts. This was a browser viewport check, not an Android-emulator acceptance run.

- [Phone list](evidence/mobile-app-experience/integration-cmp-mobile-list.png)
- [Phone detail](evidence/mobile-app-experience/integration-cmp-mobile-detail.png)
- [Desktop list](evidence/mobile-app-experience/integration-cmp-desktop-list.png)

Screenshots were captured first under `output/playwright/` and visually inspected. Console output contained three favicon 404 requests and unused-preload warnings; it was not error-free. No application JavaScript exception was observed during this path.

There is no local API or database listener on the expected ports, so backend-attached login, persistent business mutations and deployment acceptance remain unverified. Original EMP 3048, CMP 3052, TMS 3054 and Intranet 3057 servers were left running. Integration CMP 3072 remains available.

## Remaining work / scope decision

A read-only comparison of assertion fingerprints with `HEAD` confirmed 84 of the 154 root assertion findings already exist in main; 70 relate to the accumulated task changes. Existing findings include Desktop Agent files outside the mobile scope. The user was asked whether to include repository-wide check repair before publishing. That request is not authorization to weaken rules or self-approve the design registry.

The design-first skill kept reconciliation within the already selected mobile direction and surfaced the unfulfilled registry/boundary gates. Complete those gates with real evidence and the required approval; do not mark the registry approved from source code alone. No baseline or approval state was changed here.

Still required: resolve in-scope assertion findings, receive scope direction for inherited repository-wide blockers, complete design evidence/approval, rerun full checks and builds on stable final sources, perform backend-attached UI acceptance, fetch/reconcile latest main, pass normal commit/push hooks, create the authorized PR, inspect actual PR status and squash-merge only once ready. Build publication and automatic deployment must be reported separately from merge success. Do not manually dispatch deployment without authorization.
