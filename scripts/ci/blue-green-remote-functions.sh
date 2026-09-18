#!/usr/bin/env bash

# Sourceable staging, candidate, and global-lock helpers. The caller owns shell
# options and provides remote_ssh/remote_scp plus validated deployment globals.

deployment_order_status() {
  local pending_image_source
  pending_image_source="$(jq -r '.pendingImageSourceSha // empty' <<<"${edge_active_state}")"
  PROJECTWING_SOURCE_COMMIT_SHA="${version}" PROJECTWING_ACTIVE_EDGE_STATE="${edge_active_state}" \
    PROJECTWING_ALLOW_STALE_MAINTENANCE_RESUME="${allow_stale_maintenance_resume:-false}" \
    PROJECTWING_ALLOW_COMPLETED_MAINTENANCE_RECOVERY="${recovering_completed_maintenance:-false}" \
    PROJECTWING_PENDING_IMAGE_SOURCE_SHA="${pending_image_source}" PROJECTWING_IMAGE_SOURCE_SHA="${image_source_sha}" \
    bash "${order_guard}"
}

prepare_maintenance_resume() {
  local route_mode pending_release pending_source pending_image transaction_id marker completion_marker schema_status_file
  route_mode="$(jq -r '.routeMode // "serving"' <<<"${edge_active_state}")"
  pending_release="$(jq -r '.pendingReleaseKey // empty' <<<"${edge_active_state}")"
  pending_source="$(jq -r '.pendingSourceCommitSha // empty' <<<"${edge_active_state}")"
  pending_image="$(jq -r '.pendingImageSourceSha // empty' <<<"${edge_active_state}")"
  transaction_id="$(jq -r '.transactionId // empty' <<<"${edge_active_state}")"
  [[ "${route_mode}" == maintenance ]] || return 0
  if [[ "${pending_source}" != "${version}" ]]; then
    [[ "${pending_source}" =~ ^[a-f0-9]{40}$ ]] || {
      echo 'Maintenance state has an invalid pending source commit.' >&2
      return 1
    }
    [[ "${pending_release}" =~ ^${pending_source}-[0-9]+-[1-9][0-9]*$ ]] || {
      echo 'Maintenance state has an invalid pending release key.' >&2
      return 1
    }
    [[ "${transaction_id}" == "${pending_release}" && "${pending_image}" == "${image_source_sha}" ]] || return 0
    completion_marker="/opt/projectwing/releases/${pending_release}/database-migration.completed"
    schema_status_file="/opt/projectwing/releases/${pending_release}/database-schema.status"
    if remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
      "test -r '${completion_marker}' && grep -Fxq '${pending_release}' '${completion_marker}' && test -r '${schema_status_file}' && grep -Fxq 'current' '${schema_status_file}'"; then
      recovering_completed_maintenance=true
      echo "Recovering completed maintenance transaction ${pending_release} with current main ${version}."
    fi
    return 0
  fi
  [[ "${pending_release}" =~ ^${version}-[0-9]+-[1-9][0-9]*$ ]] || {
    echo 'Maintenance state has an invalid pending release key.' >&2
    return 1
  }
  marker="/opt/projectwing/releases/${pending_release}/database-migration.started"
  if remote_ssh "${candidate_host}" "${candidate_known_hosts}" "test -r '${marker}'"; then
    migration_started=true
    allow_stale_maintenance_resume=true
  fi
  release_key="${pending_release}"
  suffix="${release_key#${version}-}"
  resuming_maintenance=true
  maintenance_entered=true
  echo "Resuming the pinned maintenance transaction ${release_key}."
}

retry_remote_transport() {
  local label="$1" attempt status attempts="${PROJECTWING_STAGING_TRANSPORT_ATTEMPTS:-4}" delay="${PROJECTWING_STAGING_TRANSPORT_DELAY_SECONDS:-5}"
  shift
  [[ "${attempts}" =~ ^[1-9][0-9]*$ && "${delay}" =~ ^[1-9][0-9]*$ ]] \
    || { echo 'Staging transport retry settings must be positive integers.' >&2; return 2; }
  for attempt in $(seq 1 "${attempts}"); do
    if "$@"; then return 0; else status="$?"; fi
    if [[ "${status}" != 124 && "${status}" != 255 ]]; then return "${status}"; fi
    echo "${label} hit a transient SSH transport failure (${attempt}/${attempts}, exit ${status})." >&2
    (( attempt < attempts )) && sleep "${delay}"
  done
  echo "${label} exhausted SSH transport retries." >&2
  return "${status}"
}

retry_staging_transport() {
  retry_remote_transport "$@"
}

normalize_scp_transport_status() {
  local status="$1" output="${2:-}"
  if [[ "${status}" == 1 ]]; then
    case "${output}" in
      *'Connection timed out'*|*'Operation timed out'*|*'Connection reset by peer'*|*'Connection closed by'*|\
      *'Connection refused'*|*'No route to host'*|*'Network is unreachable'*|*'kex_exchange_identification'*|\
      *'lost connection'*) return 255 ;;
    esac
  fi
  return "${status}"
}

stage_target() {
  local host="$1" known_hosts="$2" suffix="$3"
  retry_staging_transport "Create staging directories on ${host}" \
    remote_ssh "${host}" "${known_hosts}" "mkdir -p /opt/projectwing/releases /opt/projectwing/secrets"
  retry_staging_transport "Copy deployment archive to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${deploy_archive}" "/opt/projectwing/projectwing-oss-image-bundle-deploy-${suffix}.tar.gz"
  retry_staging_transport "Copy application environment to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${app_env}" "/opt/projectwing/projectwing-${suffix}.env"
  retry_staging_transport "Copy OSS environment to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${oss_env}" "/opt/projectwing/projectwing-oss-${suffix}.env"
  retry_staging_transport "Copy image references to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${registry_env}" "/opt/projectwing/projectwing-images-${suffix}.env"
  retry_staging_transport "Copy ACME access key to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${acme_access_key}" "/opt/projectwing/projectwing-traefik-access-key-${suffix}"
  retry_staging_transport "Copy ACME secret key to ${host}" \
    remote_scp "${host}" "${known_hosts}" "${acme_secret_key}" "/opt/projectwing/projectwing-traefik-secret-key-${suffix}"
  retry_staging_transport "Protect staged files on ${host}" \
    remote_ssh "${host}" "${known_hosts}" "chmod 600 /opt/projectwing/projectwing-*-${suffix}* /opt/projectwing/projectwing-${suffix}.env"
}

prepare_release() {
  local host="$1" known_hosts="$2" suffix="$3"
  remote_ssh "${host}" "${known_hosts}" \
    "PROJECTWING_RELEASE_KEY='${release_key}' PROJECTWING_STAGE_SUFFIX='${suffix}' bash -s" <<'REMOTE'
set -Eeuo pipefail
release_dir="/opt/projectwing/releases/${PROJECTWING_RELEASE_KEY}"
[[ "${PROJECTWING_RELEASE_KEY}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]]
[[ "${PROJECTWING_STAGE_SUFFIX}" =~ ^[0-9]+-[1-9][0-9]*$ ]]
rm -rf -- "${release_dir}"
mkdir -p "${release_dir}"
tar -xzf "/opt/projectwing/projectwing-oss-image-bundle-deploy-${PROJECTWING_STAGE_SUFFIX}.tar.gz" -C "${release_dir}"
install -d -m 700 "${release_dir}/secrets"
install -m 600 "/opt/projectwing/projectwing-${PROJECTWING_STAGE_SUFFIX}.env" "${release_dir}/secrets/projectwing.env"
install -m 600 "/opt/projectwing/projectwing-oss-${PROJECTWING_STAGE_SUFFIX}.env" "${release_dir}/secrets/projectwing-oss.env"
install -m 600 "/opt/projectwing/projectwing-images-${PROJECTWING_STAGE_SUFFIX}.env" "${release_dir}/secrets/projectwing-registry.env"
install -m 600 "/opt/projectwing/projectwing-traefik-access-key-${PROJECTWING_STAGE_SUFFIX}" "${release_dir}/secrets/traefik-alidns-access-key"
install -m 600 "/opt/projectwing/projectwing-traefik-secret-key-${PROJECTWING_STAGE_SUFFIX}" "${release_dir}/secrets/traefik-alidns-secret-key"
find "${release_dir}/scripts/ci" -maxdepth 1 -type f -name '*.sh' -exec chmod 755 {} +
REMOTE
}

cleanup_staged_inputs() {
  remote_ssh "$1" "$2" \
    "PROJECTWING_RELEASE_KEY='${release_key}' bash '/opt/projectwing/releases/${release_key}/scripts/ci/cleanup-blue-green-staged-inputs.sh'"
}

preflight_candidate_host() {
  local host="$1" known_hosts="$2" color="$3" minimum_mib="${PROJECTWING_BLUE_GREEN_MIN_AVAILABLE_MIB:-768}"
  [[ "${minimum_mib}" =~ ^[1-9][0-9]*$ ]]
  remote_ssh "${host}" "${known_hosts}" \
    "PROJECTWING_BLUE_GREEN_MIN_AVAILABLE_MIB='${minimum_mib}' PROJECTWING_COLOR='${color}' bash -s" <<'REMOTE'
set -Eeuo pipefail
ids="$(docker ps -q --filter "label=com.docker.compose.project=projectwing-${PROJECTWING_COLOR}")"
[[ -z "${ids}" ]] || docker stop --time 30 ${ids}
available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
[[ "${available_kib}" =~ ^[0-9]+$ ]]
systemctl is-active --quiet docker.service
systemctl is-active --quiet netbird.service
netbird status 2>&1 | grep -q 'Management: Connected'
(( available_kib >= PROJECTWING_BLUE_GREEN_MIN_AVAILABLE_MIB * 1024 ))
REMOTE
}

start_candidate_job() {
  local action="$1" maintenance_confirmed="${2:-false}"
  local status_file="/opt/projectwing/releases/${release_key}/candidate-${candidate_color}-${action}.status"
  remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
    "PROJECTWING_VERSION='${version}' PROJECTWING_SOURCE_COMMIT_SHA='${version}' PROJECTWING_IMAGE_SOURCE_SHA='${image_source_sha}' PROJECTWING_BUILD_RUN_ID='${build_run_id}' PROJECTWING_BUILD_RUN_ATTEMPT='${build_run_attempt}' PROJECTWING_DEPLOY_RUN_ID='${deploy_run_id}' PROJECTWING_DEPLOY_RUN_ATTEMPT='${deploy_run_attempt}' PROJECTWING_RELEASE_KEY='${release_key}' PROJECTWING_COLOR='${candidate_color}' PROJECTWING_BACKEND_BIND_ADDRESS='${candidate_address}' PROJECTWING_CANDIDATE_ACTION='${action}' PROJECTWING_MAINTENANCE_CONFIRMED='${maintenance_confirmed}' PROJECTWING_DEPLOY_SYSTEMS='api,emp,cmp,showroom,tms,intranet,ib,ib-api,reverse-proxy' PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION='deploy' PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY='${PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY}' PROJECTWING_OSS_IMAGE_BUNDLE_SHA256='${PROJECTWING_OSS_IMAGE_BUNDLE_SHA256}' PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES='${PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES}' PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES='${PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES}' PROJECTWING_DEPLOY_ARCHIVE_FILE='/opt/projectwing/releases/${release_key}/docker-compose.development.yml' PROJECTWING_APP_ENV_FILE='/opt/projectwing/releases/${release_key}/secrets/projectwing.env' PROJECTWING_OSS_ENV_FILE='/opt/projectwing/releases/${release_key}/secrets/projectwing-oss.env' PROJECTWING_REGISTRY_ENV_FILE='/opt/projectwing/releases/${release_key}/secrets/projectwing-registry.env' PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE='/opt/projectwing/releases/${release_key}/secrets/traefik-alidns-access-key' PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE='/opt/projectwing/releases/${release_key}/secrets/traefik-alidns-secret-key' PROJECTWING_STATUS_FILE='${status_file}' bash -s" <<'REMOTE'
set -Eeuo pipefail
release_dir="/opt/projectwing/releases/${PROJECTWING_RELEASE_KEY}"
log_file="${PROJECTWING_STATUS_FILE%.status}.log"
rm -f -- "${PROJECTWING_STATUS_FILE}"
nohup bash -s >"${log_file}" 2>&1 </dev/null <<'WORK' &
set +e
write_status() { status="$?"; trap - EXIT; printf '%s\n' "${status}" >"${PROJECTWING_STATUS_FILE}"; exit "${status}"; }
trap write_status EXIT
cd "/opt/projectwing/releases/${PROJECTWING_RELEASE_KEY}"
if [[ "${PROJECTWING_CANDIDATE_ACTION}" != inspect ]]; then
  export PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION=activate-preloaded
fi
scripts/ci/remote-oss-image-bundle-deploy.sh
WORK
printf 'candidate_pid=%s\n' "$!"
REMOTE
}

wait_for_candidate_job() {
  local action="$1" attempt result
  local attempts="${PROJECTWING_CANDIDATE_STATUS_ATTEMPTS:-720}"
  local poll_seconds="${PROJECTWING_CANDIDATE_STATUS_POLL_SECONDS:-5}"
  local base="/opt/projectwing/releases/${release_key}/candidate-${candidate_color}-${action}"
  [[ "${attempts}" =~ ^[1-9][0-9]*$ && "${poll_seconds}" =~ ^[1-9][0-9]*$ ]] || {
    echo 'Candidate status polling settings must be positive integers.' >&2
    return 2
  }
  echo "Waiting up to $((attempts * poll_seconds)) seconds for candidate ${candidate_color} ${action}."
  for attempt in $(seq 1 "${attempts}"); do
    if result="$(PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS=20 remote_ssh "${candidate_host}" "${candidate_known_hosts}" "test -r '${base}.status' && cat '${base}.status'")"; then
      if [[ "${result}" == 0 ]]; then
        PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS=20 remote_ssh "${candidate_host}" "${candidate_known_hosts}" "tail -n 100 '${base}.log'" || true
        return 0
      fi
      PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS=20 remote_ssh "${candidate_host}" "${candidate_known_hosts}" "tail -n 180 '${base}.log'" || true
      return 1
    fi
    sleep "${poll_seconds}"
  done
  echo "Candidate ${candidate_color} ${action} timed out after $((attempts * poll_seconds)) seconds; showing its latest log output." >&2
  PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS=20 remote_ssh "${candidate_host}" "${candidate_known_hosts}" "tail -n 180 '${base}.log'" || true
  return 1
}

read_schema_status() {
  remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
    "cat '/opt/projectwing/releases/${release_key}/database-schema.status'"
}

global_lock() {
  local action="$1"
  remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release_key}' PROJECTWING_RELEASE_KEY='${release_key}' PROJECTWING_COLOR='${candidate_color}' PROJECTWING_DEPLOY_RUN_ID='${deploy_run_id}' PROJECTWING_DEPLOY_RUN_ATTEMPT='${deploy_run_attempt}' bash '/opt/projectwing/releases/${release_key}/scripts/ci/deployment-lock-remote.sh' '${action}'"
}

stop_previous_writers() {
  local color release host known_hosts ids
  local timeout_seconds="${PROJECTWING_STOP_PREVIOUS_WRITERS_TIMEOUT_SECONDS:-600}"
  [[ "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]] \
    || { echo 'PROJECTWING_STOP_PREVIOUS_WRITERS_TIMEOUT_SECONDS must be a positive integer.' >&2; return 2; }
  IFS=$'\t' read -r color release < <(jq -r '[.activeColor, .releaseKey] | @tsv' <<<"${edge_active_state}")
  host="${green_host}"; known_hosts="${green_known_hosts}"
  [[ "${color}" == blue ]] && { host="${blue_host}"; known_hosts="${blue_known_hosts}"; }
  echo "Stopping the previous ${color} writer stack with a ${timeout_seconds}-second remote budget."
  PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="${timeout_seconds}" \
    remote_ssh "${host}" "${known_hosts}" "color='${color}' bash -s" <<'REMOTE'
set -Eeuo pipefail
ids="$(docker ps -q --filter "label=com.docker.compose.project=projectwing-${color}")"
[[ -z "${ids}" ]] || docker stop --timeout 30 ${ids}
test -z "$(docker ps -q --filter "label=com.docker.compose.project=projectwing-${color}")"
REMOTE
  echo "Previous ${color} writer stack is stopped."
}

cleanup_failed_promotion_candidate() {
  local timeout_seconds="${PROJECTWING_FAILED_CANDIDATE_CLEANUP_TIMEOUT_SECONDS:-600}"
  [[ "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]] \
    || { echo 'PROJECTWING_FAILED_CANDIDATE_CLEANUP_TIMEOUT_SECONDS must be a positive integer.' >&2; return 2; }
  echo "Cleaning the failed ${candidate_color} candidate with a ${timeout_seconds}-second remote budget."
  PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="${timeout_seconds}" remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release_key}' PROJECTWING_RELEASE_KEY='${release_key}' PROJECTWING_COLOR='${candidate_color}' bash '/opt/projectwing/releases/${release_key}/scripts/ci/${candidate_cleanup_name}'"
}

retire_previous_active_stack() {
  local color release host known_hosts
  local timeout_seconds="${PROJECTWING_RETIRE_PREVIOUS_STACK_TIMEOUT_SECONDS:-600}"
  [[ "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]] \
    || { echo 'PROJECTWING_RETIRE_PREVIOUS_STACK_TIMEOUT_SECONDS must be a positive integer.' >&2; return 2; }
  IFS=$'\t' read -r color release < <(jq -r '[.previousColor, .previousReleaseKey] | @tsv' <<<"$(edge_ha_read_node "${candidate_host}" "${candidate_known_hosts}")")
  host="${green_host}"; known_hosts="${green_known_hosts}"
  [[ "${color}" == blue ]] && { host="${blue_host}"; known_hosts="${blue_known_hosts}"; }
  echo "Retiring the previous ${color} application stack with a ${timeout_seconds}-second remote budget."
  PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="${timeout_seconds}" \
    remote_ssh "${host}" "${known_hosts}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release}' PROJECTWING_RELEASE_KEY='${release}' PROJECTWING_COLOR='${color}' PROJECTWING_CLEANUP_REASON='retired-previous' bash '/opt/projectwing/releases/${release_key}/scripts/ci/${candidate_cleanup_name}'"
  echo "Previous ${color} application stack is retired."
}
