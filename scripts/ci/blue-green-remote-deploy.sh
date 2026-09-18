#!/usr/bin/env bash
set -Eeuo pipefail
trap 'status=$?; echo "Blue/Green remote deployment failed at line ${LINENO} (exit ${status})." >&2' ERR
echo 'Starting Blue/Green remote deployment controller.'
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ssh_helper="${root_dir}/scripts/ci/deploy-ssh.sh"
edge_ha_library="${root_dir}/scripts/ci/edge-ha-remote.sh"
edge_maintenance_library="${root_dir}/scripts/ci/edge-maintenance-remote.sh"
remote_functions_library="${root_dir}/scripts/ci/blue-green-remote-functions.sh"
order_guard="${root_dir}/scripts/ci/deployment-order-guard.sh"
candidate_cleanup_name="cleanup-blue-green-candidate.sh"
release_key="${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"
version="${PROJECTWING_VERSION:?PROJECTWING_VERSION is required}"
blue_host="${PROJECTWING_BLUE_NETBIRD_HOST:?PROJECTWING_BLUE_NETBIRD_HOST is required}"
green_host="${PROJECTWING_GREEN_NETBIRD_HOST:?PROJECTWING_GREEN_NETBIRD_HOST is required}"
blue_known_hosts="${PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS:?PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS is required}"
green_known_hosts="${PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS:?PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS is required}"
deploy_user="${PROJECTWING_DEPLOY_USER:-ops}"
deploy_archive="${PROJECTWING_DEPLOY_ARCHIVE_FILE:?PROJECTWING_DEPLOY_ARCHIVE_FILE is required}"
app_env="${PROJECTWING_APP_ENV_FILE:?PROJECTWING_APP_ENV_FILE is required}"
oss_env="${PROJECTWING_OSS_ENV_FILE:?PROJECTWING_OSS_ENV_FILE is required}"
registry_env="${PROJECTWING_REGISTRY_ENV_FILE:?PROJECTWING_REGISTRY_ENV_FILE is required}"
acme_access_key="${PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE:?PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE is required}"
acme_secret_key="${PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE:?PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE is required}"
single_host_color="${PROJECTWING_SINGLE_HOST_COLOR:-}"
image_source_sha="${PROJECTWING_IMAGE_SOURCE_SHA:?PROJECTWING_IMAGE_SOURCE_SHA is required}"
build_run_id="${PROJECTWING_BUILD_RUN_ID:-0}"
build_run_attempt="${PROJECTWING_BUILD_RUN_ATTEMPT:-0}"
deploy_run_id="${PROJECTWING_DEPLOY_RUN_ID:?PROJECTWING_DEPLOY_RUN_ID is required}"
deploy_run_attempt="${PROJECTWING_DEPLOY_RUN_ATTEMPT:?PROJECTWING_DEPLOY_RUN_ATTEMPT is required}"
for host in "${blue_host}" "${green_host}"; do
  [[ "${host}" =~ ^100\.113\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || {
    echo "Deployment hosts must be NetBird IPv4 addresses." >&2
    exit 2
  }
done
[[ "${release_key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]] || {
  echo "PROJECTWING_RELEASE_KEY has an unexpected format." >&2
  exit 2
}
[[ "${version}" =~ ^[a-f0-9]{40}$ ]] || {
  echo "PROJECTWING_VERSION must be a git SHA." >&2
  exit 2
}
case "${single_host_color}" in
  '') ;;
  blue|green) ;;
  *)
    echo "PROJECTWING_SINGLE_HOST_COLOR must be blue or green when set." >&2
    exit 2
    ;;
esac
[[ "${image_source_sha}" =~ ^[a-f0-9]{40}$ ]]
for value in "${build_run_id}" "${build_run_attempt}" "${deploy_run_id}" "${deploy_run_attempt}"; do
  [[ "${value}" =~ ^[0-9]+$ ]]
done
echo 'Validated Blue/Green remote deployment contract.'
remote_ssh() {
  local host="$1" known_hosts="$2"
  shift 2
  local timeout_seconds="${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-120}"
  DEPLOY_HOST="${host}" DEPLOY_USER="${deploy_user}" PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${known_hosts}" \
    PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE="${PROJECTWING_DEPLOY_SSH_DIR}/known-hosts-${host}" \
    timeout --foreground "${timeout_seconds}" bash "${ssh_helper}" ssh "$@"
}
remote_scp() {
  local host="$1" known_hosts="$2" source="$3" destination="$4"
  local timeout_seconds="${PROJECTWING_REMOTE_SCP_TIMEOUT_SECONDS:-120}" output status
  if output="$(
    DEPLOY_HOST="${host}" DEPLOY_USER="${deploy_user}" PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${known_hosts}" \
      PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE="${PROJECTWING_DEPLOY_SSH_DIR}/known-hosts-${host}" \
      timeout --foreground "${timeout_seconds}" bash "${ssh_helper}" scp "${source}" "${destination}" 2>&1
  )"; then
    [[ -z "${output}" ]] || printf '%s\n' "${output}" >&2
    return 0
  else
    status="$?"
  fi
  [[ -z "${output}" ]] || printf '%s\n' "${output}" >&2
  if normalize_scp_transport_status "${status}" "${output}"; then return 0; else return "$?"; fi
}
configure_target() {
  local host="$1" known_hosts="$2"
  DEPLOY_HOST="${host}" DEPLOY_USER="${deploy_user}" PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${known_hosts}" \
    PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE="${PROJECTWING_DEPLOY_SSH_DIR}/known-hosts-${host}" \
    bash "${ssh_helper}" configure
}
test -r "${edge_ha_library}"
# shellcheck source=edge-ha-remote.sh
. "${edge_ha_library}"
test -r "${edge_maintenance_library}" -a -r "${remote_functions_library}" -a -x "${order_guard}"
# shellcheck source=edge-maintenance-remote.sh
. "${edge_maintenance_library}"
# shellcheck source=blue-green-remote-functions.sh
. "${remote_functions_library}"

global_lock_held=false
maintenance_entered=false
migration_started=false
deployment_committed=false
allow_stale_maintenance_resume=false
resuming_maintenance=false

cleanup_deployment() {
  local status="$?"
  trap - EXIT
  if [[ "${status}" -ne 0 && "${maintenance_entered}" == true \
    && "${migration_started}" == false && "${deployment_committed}" == false ]]; then
    echo 'Failure occurred before migration; restoring the serving Edge route.' >&2
    edge_ha_exit_maintenance || status=2
  fi
  if [[ "${global_lock_held}" == true ]]; then global_lock release || status=2; fi
  exit "${status}"
}

finish_superseded() {
  if [[ "${maintenance_entered}" == true && "${migration_started}" == false ]]; then
    echo 'Deployment became stale before migration; restoring the serving Edge route.'
    edge_ha_exit_maintenance
    maintenance_entered=false
  fi
  echo "Deployment ${release_key} is superseded; no further production state was changed."
  if [[ -n "${candidate_host:-}" ]]; then cleanup_failed_promotion_candidate || true; fi
  exit 0
}

require_deployable_order() {
  local status
  status="$(deployment_order_status)"
  case "${status}" in
    proceed|resume|recover-maintenance) return 0 ;;
    already-active|superseded) finish_superseded ;;
    maintenance-stale)
      echo 'A stale release owns the maintenance window; refusing an ambiguous takeover.' >&2
      return 1
      ;;
    *) echo "Unknown deployment order status: ${status}" >&2; return 1 ;;
  esac
}

trap cleanup_deployment EXIT

suffix="${release_key#${version}-}"
case "${single_host_color}" in
  blue)
    echo "Single-host recovery: configuring only Blue (${blue_host})."
    configure_target "${blue_host}" "${blue_known_hosts}"
    ;;
  green)
    echo "Single-host recovery: configuring only Green (${green_host})."
    configure_target "${green_host}" "${green_known_hosts}"
    ;;
  '')
    echo "Configuring pinned SSH for Blue (${blue_host})."
    configure_target "${blue_host}" "${blue_known_hosts}"
    echo "Configuring pinned SSH for Green (${green_host})."
    configure_target "${green_host}" "${green_known_hosts}"
    ;;
esac
retry_remote_transport 'Resolve the current dual-Edge state' edge_ha_resolve_state
candidate_color="${edge_candidate_color}"
if [[ -n "${single_host_color}" && "${single_host_color}" != "${candidate_color}" ]]; then
  echo "Single-host recovery target ${single_host_color} does not match inactive Edge color ${candidate_color}." >&2
  exit 1
fi
if [[ "${candidate_color}" == blue ]]; then
  candidate_host="${blue_host}"
  candidate_address="172.19.143.157"
  candidate_known_hosts="${blue_known_hosts}"
else
  candidate_host="${green_host}"
  candidate_address="172.19.143.158"
  candidate_known_hosts="${green_known_hosts}"
fi
prepare_maintenance_resume
require_deployable_order
if [[ "${resuming_maintenance}" == false ]]; then
  retry_remote_transport "Preflight ${candidate_color} candidate" \
    preflight_candidate_host "${candidate_host}" "${candidate_known_hosts}" "${candidate_color}"
fi
if [[ -z "${single_host_color}" && "${resuming_maintenance}" == false ]]; then
  echo 'Staging release inputs on Blue.'
  stage_target "${blue_host}" "${blue_known_hosts}" "${suffix}"
  echo 'Staging release inputs on Green.'
  stage_target "${green_host}" "${green_known_hosts}" "${suffix}"
  echo 'Preparing immutable release directory on Blue.'
  retry_remote_transport 'Prepare the immutable Blue release directory' \
    prepare_release "${blue_host}" "${blue_known_hosts}" "${suffix}"
  echo 'Preparing immutable release directory on Green.'
  retry_remote_transport 'Prepare the immutable Green release directory' \
    prepare_release "${green_host}" "${green_known_hosts}" "${suffix}"
  retry_remote_transport 'Clean Blue staged inputs' \
    cleanup_staged_inputs "${blue_host}" "${blue_known_hosts}"
  retry_remote_transport 'Clean Green staged inputs' \
    cleanup_staged_inputs "${green_host}" "${green_known_hosts}"
elif [[ "${resuming_maintenance}" == false ]]; then
  echo "Staging release inputs on ${single_host_color^} for single-host recovery."
  stage_target "${candidate_host}" "${candidate_known_hosts}" "${suffix}"
  echo "Preparing immutable release directory on ${single_host_color^}."
  retry_remote_transport "Prepare the immutable ${single_host_color^} release directory" \
    prepare_release "${candidate_host}" "${candidate_known_hosts}" "${suffix}"
  retry_remote_transport "Clean ${single_host_color^} staged inputs" \
    cleanup_staged_inputs "${candidate_host}" "${candidate_known_hosts}"
fi
start_candidate_job inspect
wait_for_candidate_job inspect
schema_status="$(retry_remote_transport 'Read candidate database schema status' read_schema_status)"
[[ "${schema_status}" == current || "${schema_status}" == pending ]]

global_lock acquire
global_lock_held=true
initial_candidate_color="${candidate_color}"
retry_remote_transport 'Re-read the current dual-Edge state' edge_ha_resolve_state
candidate_color="${edge_candidate_color}"
[[ "${candidate_color}" == "${initial_candidate_color}" ]] || finish_superseded
require_deployable_order

current_route_mode="$(jq -r '.routeMode // "serving"' <<<"${edge_active_state}")"
if [[ "${schema_status}" == pending ]]; then
  [[ -z "${single_host_color}" ]] || {
    echo 'Pending migrations require both Edge nodes; single-host recovery is not eligible.' >&2
    exit 1
  }
  if [[ "${current_route_mode}" != maintenance ]]; then
    require_deployable_order
    edge_ha_enter_maintenance
    maintenance_entered=true
    require_deployable_order
  else
    maintenance_entered=true
  fi
  global_lock assert
  retry_remote_transport 'Stop previous writers' stop_previous_writers
  sleep "${PROJECTWING_MAINTENANCE_DRAIN_SECONDS:-10}"
  global_lock assert
  migration_started=true
  start_candidate_job migrate-and-activate true
  wait_for_candidate_job migrate-and-activate
else
  require_deployable_order
  start_candidate_job activate
  wait_for_candidate_job activate
fi

global_lock assert
if [[ "${migration_started}" == false ]]; then require_deployable_order; fi
echo "Promoting healthy ${candidate_color} candidate through the available Edge nodes."
set +e
edge_ha_promote_candidate
promotion_status=$?
set -e
if (( promotion_status != 0 )); then
  if (( promotion_status == 1 )); then
    echo 'Edge rollback was verified; cleaning the failed promotion candidate.' >&2
    cleanup_failed_promotion_candidate || { echo 'CRITICAL: failed promotion candidate cleanup did not complete.' >&2; exit 2; }
  else
    echo 'CRITICAL: preserving the candidate because Edge rollback was not verified.' >&2
  fi
  exit "${promotion_status}"
fi
deployment_committed=true
maintenance_entered=false
if [[ -z "${single_host_color}" ]] && ! retry_remote_transport 'Retire previous application stack' retire_previous_active_stack; then
  echo 'CRITICAL: Edge promotion committed, but the previous application stack was not retired.' >&2
  exit 3
fi
echo "Available Edge nodes now route to the ${candidate_color} candidate."
printf 'candidate_color=%s\n' "${candidate_color}"
printf 'candidate_gateway=http://%s:18080\n' "${candidate_address}"
