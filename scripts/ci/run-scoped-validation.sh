#!/usr/bin/env bash
set -euo pipefail

systems="${1:-${PROJECTWING_DEPLOY_SYSTEMS:-}}"
vitest_max_workers="${PROJECTWING_VITEST_MAX_WORKERS:-2}"
vitest_timeout_ms="${PROJECTWING_VITEST_TIMEOUT_MS:-30000}"
validation_base_ref="${PROJECTWING_VALIDATION_BASE_REF:-HEAD}"
test_only="${PROJECTWING_TEST_ONLY:-false}"
api_validation_mode="${PROJECTWING_API_VALIDATION_MODE:-fast}"
skip_ui_governance="false"

case "${api_validation_mode}" in
  fast|ci) ;;
  *)
    echo "Unknown PROJECTWING_API_VALIDATION_MODE=${api_validation_mode}; expected fast or ci." >&2
    exit 2
    ;;
esac

if [[ "${2:-}" == "--skip-ui-governance" ]]; then
  skip_ui_governance="true"
elif [[ -n "${2:-}" ]]; then
  echo "Usage: $0 [systems] [--skip-ui-governance]" >&2
  exit 2
fi

if [ -z "${systems}" ]; then
  echo "No deploy systems selected for validation."
  exit 0
fi

has_system() {
  case ",${systems}," in
    *,"$1",*) return 0 ;;
    *) return 1 ;;
  esac
}

has_frontend_system() {
  for system in emp cmp showroom tms intranet ib; do
    has_system "${system}" && return 0
  done
  return 1
}

vitest_command_args=()

configure_vitest_args() {
  vitest_command_args=(run --passWithNoTests --maxWorkers="${vitest_max_workers}" --testTimeout="${vitest_timeout_ms}")
  echo "Vitest scope: full suite for the selected deployment system."
}

run_vitest() {
  local package="$1"
  configure_vitest_args
  corepack pnpm --config.verify-deps-before-run=false --filter "${package}" exec vitest "${vitest_command_args[@]}"
}

validate_frontend_governance() {
  if ! git rev-parse --verify "${validation_base_ref}^{commit}" >/dev/null 2>&1; then
    validation_base_ref="HEAD"
  fi

  node scripts/ui-stack-baseline-monotonic.mjs --base-ref "${validation_base_ref}"
  node --test \
    scripts/design-first-baseline.test.mjs \
    scripts/ui-stack-baseline-monotonic.test.mjs \
    scripts/ui-stack-guardrails.test.mjs
  corepack pnpm --config.verify-deps-before-run=false test:ui-stack
  node scripts/design-first-baseline.mjs --base-ref "${validation_base_ref}"
}

if has_system api; then
  bash scripts/ci/run-cmp-api-validation.sh "${api_validation_mode}"
elif has_system cmp; then
  bash scripts/ci/run-cmp-ui-validation.sh
else
  if [[ "${test_only}" != "true" ]]; then
    corepack pnpm --config.verify-deps-before-run=false --filter @project-wing/shared build
  fi
fi

IFS="," read -r -a selected_systems <<< "${systems}"
for system in "${selected_systems[@]}"; do
  case "${system}" in
    api|cmp|reverse-proxy) continue ;;
    showroom)
      if [[ "${test_only}" != "true" ]]; then
        corepack pnpm --config.verify-deps-before-run=false --filter @project-wing/ui-showroom lint
      fi
      continue
      ;;
    emp) package="@project-wing/emp" ;;
    tms) package="@project-wing/tms" ;;
    intranet) package="@project-wing/intranet" ;;
    ib) package="@project-wing/ib" ;;
    ib-api) package="@project-wing/ib-api" ;;
    *)
      echo "Unsupported deploy system for validation: ${system}" >&2
      exit 1
      ;;
  esac

  if [[ "${test_only}" != "true" ]]; then
    corepack pnpm --config.verify-deps-before-run=false --filter "${package}" lint
  fi
  case "${system}" in
    emp|tms|intranet|ib)
      # The deploy runner validates several large browser suites back-to-back.
      # Browser-heavy suites render full application pages. Two workers keep
      # the shared runner below its CPU/memory saturation point; automatic
      # deploys further limit Vitest to tests changed since the validation base.
      run_vitest "${package}"
      ;;
    *)
      corepack pnpm --config.verify-deps-before-run=false --filter "${package}" test
      ;;
  esac
done

if has_frontend_system && [[ "${test_only}" != "true" ]]; then
  if [[ "${skip_ui_governance}" != "true" ]]; then
    validate_frontend_governance
  fi
fi
