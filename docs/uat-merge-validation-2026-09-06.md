# UAT merge validation, 2026-09-06

The pre-commit pipeline completed repository-policy checks, lint-staged Ultracite/Oxfmt fixes, volatile-assertion checks, Prisma generation and all selected workspace test suites.

| Workspace | Passed | Skipped |
| --------- | -----: | ------: |
| Shared    |    260 |       0 |
| API       |  1,838 |      14 |
| CMP       |    299 |       0 |
| EMP       |  1,603 |       0 |
| TMS       |    235 |       0 |
| Intranet  |     47 |       0 |
| UI        |    222 |       0 |
| Total     |  4,504 |      14 |

Executed through `git commit` → `.husky/pre-commit` → `node scripts/repository-policy-guardrails.mjs`, `corepack pnpm exec lint-staged`, `corepack pnpm test:precommit`. That invoked `scripts/ci/run-cmp-api-validation.sh fast`, `scripts/ci/run-scoped-validation.sh` for remaining selected systems, and shared UI tests with `PROJECTWING_TEST_ONLY=true`. PostgreSQL migration execution is deferred by this configured fast mode.

After lint auto-fixes, reran `corepack pnpm --filter @project-wing/api lint`, `corepack pnpm --filter @project-wing/emp lint` and `corepack pnpm --filter @project-wing/ui lint`: all passed. No dependencies or migrations changed.

The original commit subject exceeded the 50-character subject limit after all tests completed. Corrected only the commit message, ran `corepack pnpm exec commitlint --edit .codex/commit-message.txt` and `node scripts/commit-message-guard.mjs .codex/commit-message.txt`, and verified the staged tree remained exactly `84becca3e2c0e1893c14e732d02caa0e5df75b56`. Reused that already-tested tree without rerunning the lengthy pre-commit suite. Subsequent evidence-only commit uses normal hooks.

The broader root format/design-boundary checks from feature development were not clean: the design-boundary audit reported 104 findings. No baselines were expanded, and no claim is made that the configured test-only pipeline ran those global checks. The repository currently has no automatic PR validation workflow.

See `uat-project-creation-and-file-actions.md` and the other `uat-*.md` reports for browser paths, screenshots, PDF rendering evidence and backend-attached validation limits. Template storage copies and intermittent production latency still require live acceptance testing. A PR merge, a successful Build, and completed host activation are distinct delivery states.
