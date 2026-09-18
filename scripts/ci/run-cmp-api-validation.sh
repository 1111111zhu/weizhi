#!/usr/bin/env bash

set -euo pipefail

mode="${1:-fast}"
ui_guardrails="false"
vitest_max_workers="${PROJECTWING_VITEST_MAX_WORKERS:-2}"
vitest_timeout_ms="${PROJECTWING_VITEST_TIMEOUT_MS:-30000}"
test_only="${PROJECTWING_TEST_ONLY:-false}"
export PRISMA_HIDE_UPDATE_MESSAGE="${PRISMA_HIDE_UPDATE_MESSAGE:-1}"

if [[ "${2:-}" == "--ui" ]]; then
  ui_guardrails="true"
fi

case "${mode}" in
  fast|ci)
    ;;
  *)
    echo "Usage: $0 [fast|ci] [--ui]" >&2
    exit 2
    ;;
esac

pnpm_run() {
  corepack pnpm --config.verify-deps-before-run=false "$@"
}

vitest_command_args=()

configure_vitest_args() {
  vitest_command_args=(run --maxWorkers="${vitest_max_workers}" --testTimeout="${vitest_timeout_ms}")
  echo "Vitest scope: full suite for the selected deployment system."
}

run_vitest() {
  local package="$1"
  configure_vitest_args
  pnpm_run --filter "${package}" exec vitest "${vitest_command_args[@]}"
}

echo "CMP/API validation mode: ${mode}"

# Prisma's config reads DATABASE_URL even when generating types. Fast mode never
# connects to PostgreSQL, but keeps generation on the same path as CI.
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://projectwing:projectwing@127.0.0.1:5432/projectwing"
  if [[ "${mode}" == "fast" ]]; then
    echo "No DATABASE_URL supplied; using a local-only Prisma config URL."
  fi
fi

pnpm_run --filter @project-wing/api prisma:generate

if [[ "${mode}" == "ci" ]]; then
  pnpm_run --filter @project-wing/api prisma:migrate:deploy
else
  echo "Fast validation mode: PostgreSQL migration execution is deferred to deployment."
fi

if [[ "${test_only}" != "true" ]]; then
  pnpm_run --filter @project-wing/shared build
fi
pnpm_run --filter @project-wing/shared test:ci
if [[ "${test_only}" != "true" ]]; then
  pnpm_run --filter @project-wing/api lint
fi
run_vitest @project-wing/api
if [[ "${test_only}" != "true" ]]; then
  pnpm_run --filter @project-wing/cmp exec tsc --noEmit
fi
run_vitest @project-wing/cmp

if [[ "${ui_guardrails}" == "true" ]]; then
  node scripts/ui-stack-baseline-monotonic.mjs --base-ref HEAD
  node --test \
    scripts/design-first-baseline.test.mjs \
    scripts/ui-stack-baseline-monotonic.test.mjs \
    scripts/ui-stack-guardrails.test.mjs
  pnpm_run test:ui-stack
  node scripts/design-first-baseline.mjs --base-ref HEAD
else
  echo "Frontend governance files unchanged; skipping UI stack guardrails."
fi
