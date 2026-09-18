#!/usr/bin/env bash

set -euo pipefail

ui_guardrails="false"
vitest_max_workers="${PROJECTWING_VITEST_MAX_WORKERS:-2}"
vitest_timeout_ms="${PROJECTWING_VITEST_TIMEOUT_MS:-30000}"
test_only="${PROJECTWING_TEST_ONLY:-false}"

if [[ "${1:-}" == "--ui" ]]; then
  ui_guardrails="true"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--ui]" >&2
  exit 2
fi

pnpm_run() {
  corepack pnpm --config.verify-deps-before-run=false "$@"
}

vitest_command_args=()

configure_vitest_args() {
  vitest_command_args=(run --passWithNoTests --maxWorkers="${vitest_max_workers}" --testTimeout="${vitest_timeout_ms}")
  echo "Vitest scope: full suite for the selected deployment system."
}

run_vitest() {
  configure_vitest_args
  pnpm_run --filter @project-wing/cmp exec vitest "${vitest_command_args[@]}"
}

echo "CMP UI validation"

if [[ "${test_only}" != "true" ]]; then
  pnpm_run --filter @project-wing/shared build
fi
if [[ "${test_only}" != "true" ]]; then
  pnpm_run --filter @project-wing/cmp exec tsc --noEmit
fi
run_vitest

if [[ "${ui_guardrails}" == "true" && "${test_only}" != "true" ]]; then
  node scripts/ui-stack-baseline-monotonic.mjs --base-ref HEAD
  node --test \
    scripts/design-first-baseline.test.mjs \
    scripts/ui-stack-baseline-monotonic.test.mjs \
    scripts/ui-stack-guardrails.test.mjs
  pnpm_run test:ui-stack
  node scripts/design-first-baseline.mjs --base-ref HEAD
else
  echo "Product UI files unchanged; skipping UI stack guardrails."
fi
