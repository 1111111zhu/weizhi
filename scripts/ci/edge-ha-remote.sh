#!/usr/bin/env bash

# Sourceable dual-Edge promotion helpers. The caller owns shell options and
# provides remote_ssh plus the validated host, release, and color variables.

edge_active_state=''
edge_blue_state=''
edge_green_state=''
edge_active_color=''
edge_candidate_color=''
edge_generation=''
edge_state_library="${root_dir:?root_dir is required}/scripts/ci/edge-ha-remote-state.sh"
test -r "${edge_state_library}"
# shellcheck source=edge-ha-remote-state.sh
. "${edge_state_library}"
edge_ha_node() {
  local host="$1" known_hosts="$2" operation="$3" degraded="${4:-false}" mode="${5:-serving}"
  local previous_color previous_gateway previous_release previous_version previous_generation
  local expected_release expected_source expected_mode expected_generation
  previous_color="$(jq -r '.activeColor // empty' <<<"${edge_active_state}")"
  previous_gateway="$(jq -r '.activeGateway // empty' <<<"${edge_active_state}")"
  previous_release="$(jq -r '.releaseKey // empty' <<<"${edge_active_state}")"
  previous_version="$(jq -r '.version // empty' <<<"${edge_active_state}")"
  previous_generation="$(jq -r '.generation // 0' <<<"${edge_active_state}")"
  expected_release="$(jq -r '.releaseKey // empty' <<<"${edge_active_state}")"
  expected_source="$(jq -r '(.sourceCommitSha // .version) // empty' <<<"${edge_active_state}")"
  expected_mode="$(jq -r '.routeMode // "serving"' <<<"${edge_active_state}")"
  expected_generation="$(jq -r '.generation // 0' <<<"${edge_active_state}")"
  remote_ssh "${host}" "${known_hosts}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release_key}' PROJECTWING_EDGE_GATEWAY='http://${candidate_address}:18080' PROJECTWING_EDGE_ROUTE_MODE='${mode}' PROJECTWING_COLOR='${candidate_color}' PROJECTWING_RELEASE_KEY='${release_key}' PROJECTWING_TRANSACTION_ID='${release_key}' PROJECTWING_VERSION='${version}' PROJECTWING_SOURCE_COMMIT_SHA='${version}' PROJECTWING_IMAGE_SOURCE_SHA='${image_source_sha}' PROJECTWING_BUILD_RUN_ID='${build_run_id}' PROJECTWING_BUILD_RUN_ATTEMPT='${build_run_attempt}' PROJECTWING_DEPLOY_RUN_ID='${deploy_run_id}' PROJECTWING_DEPLOY_RUN_ATTEMPT='${deploy_run_attempt}' PROJECTWING_GENERATION='${edge_generation}' PROJECTWING_DEGRADED='${degraded}' PROJECTWING_EXPECTED_GENERATION='${expected_generation}' PROJECTWING_EXPECTED_RELEASE_KEY='${expected_release}' PROJECTWING_EXPECTED_SOURCE_COMMIT_SHA='${expected_source}' PROJECTWING_EXPECTED_ROUTE_MODE='${expected_mode}' PROJECTWING_PREVIOUS_COLOR='${previous_color}' PROJECTWING_PREVIOUS_GATEWAY='${previous_gateway}' PROJECTWING_PREVIOUS_RELEASE_KEY='${previous_release}' PROJECTWING_PREVIOUS_VERSION='${previous_version}' PROJECTWING_PREVIOUS_GENERATION='${previous_generation}' bash '/opt/projectwing/releases/${release_key}/scripts/ci/edge-ha-node.sh' '${operation}'"
}
edge_ha_verify_node() {
  local host="$1" known_hosts="$2"
  local timeout_seconds="${PROJECTWING_EDGE_VERIFY_TIMEOUT_SECONDS:-900}"
  [[ "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]] \
    || { echo 'PROJECTWING_EDGE_VERIFY_TIMEOUT_SECONDS must be a positive integer.' >&2; return 2; }
  PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="${timeout_seconds}" remote_ssh "${host}" "${known_hosts}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release_key}' bash -s" <<'REMOTE'
set -Eeuo pipefail
. "${PROJECTWING_RELEASE_DIR}/scripts/ci/deployment-health.sh"
export PROJECTWING_EMP_URL=https://wing.superfx.cn PROJECTWING_AUTH_URL=https://auth.superfx.cn
export PROJECTWING_CMP_URL=https://cmp.superfx.cn PROJECTWING_SHOWROOM_URL=https://showroom.superfx.cn
export PROJECTWING_TMS_URL=https://tms.superfx.cn PROJECTWING_INTRANET_URL=https://intranet.superfx.cn
export PROJECTWING_IB_URL=https://ib.superfx.cn PROJECTWING_DB_URL=https://db.superfx.cn
sleep 10
pw_wait_for_full_edge_stack 4 10 1
for attempt in 1 2 3 4; do
  if pw_verify_api_route 'Auth API' "${PROJECTWING_AUTH_URL}/auth/ok" '"ok":true' \
    && pw_verify_api_route 'Prisma Studio' "${PROJECTWING_DB_URL}" 'window.__STUDIO_CONFIG__'; then break; fi
  [[ "${attempt}" != 4 ]] || { echo 'Edge admin routes failed verification after 4 attempts.' >&2; exit 1; }
  echo "Edge admin routes are not ready (attempt ${attempt}/4); retrying in 10s."
  sleep 10
done
sleep "${PROJECTWING_EDGE_SETTLE_SECONDS:-60}"
minimum_mib="${PROJECTWING_EDGE_MIN_AVAILABLE_MIB:-256}"
[[ "${minimum_mib}" =~ ^[1-9][0-9]*$ ]]
available_mib="$(( $(awk '/MemAvailable:/ {print $2}' /proc/meminfo) / 1024 ))"
echo "Edge host safety margin: ${available_mib} MiB available."
(( available_mib >= minimum_mib ))
netbird_status="$(netbird status --json 2>/dev/null)"
jq -e '.daemonStatus == "Connected" and .management.connected == true and
  .signal.connected == true' <<<"${netbird_status}" >/dev/null
REMOTE
}

edge_ha_wait_verify_node() {
  local host="$1" known_hosts="$2" attempt attempts
  attempts="${PROJECTWING_EDGE_VERIFY_ATTEMPTS:-18}"
  for attempt in $(seq 1 "${attempts}"); do
    if remote_ssh "${host}" "${known_hosts}" true; then
      if [[ "${host}" == "${candidate_host}" ]]; then
        remote_ssh "${candidate_host}" "${candidate_known_hosts}" \
          "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release_key}' bash '/opt/projectwing/releases/${release_key}/scripts/ci/render-candidate-admin-route.sh'"
        sleep 2
      fi
      edge_ha_verify_node "${host}" "${known_hosts}"
      return
    fi
    echo "Waiting for Edge host recovery (${attempt}/${attempts})..." >&2
    (( attempt < attempts )) || return 1
    sleep 5
  done
  return 1
}

edge_ha_retry_rollback_node() {
  local host="$1" known_hosts="$2" attempt attempts timeout_seconds
  attempts="${PROJECTWING_EDGE_ROLLBACK_ATTEMPTS:-18}"
  timeout_seconds="${PROJECTWING_EDGE_ROLLBACK_TIMEOUT_SECONDS:-300}"
  [[ "${timeout_seconds}" =~ ^[1-9][0-9]*$ ]] || { echo 'PROJECTWING_EDGE_ROLLBACK_TIMEOUT_SECONDS must be a positive integer.' >&2; return 2; }
  for attempt in $(seq 1 "${attempts}"); do
    PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS="${timeout_seconds}" edge_ha_node "${host}" "${known_hosts}" rollback && return 0
    echo "Waiting to restore an Edge node (${attempt}/${attempts})..." >&2
    (( attempt < attempts )) || return 1
    sleep 5
  done
  return 1
}

edge_ha_node_has_vip() {
  local host="$1" known_hosts="$2" havip="$3"
  remote_ssh "${host}" "${known_hosts}" "ip -4 -o addr show | grep -Fq ' ${havip}/'"
}

edge_ha_require_keepalived() {
  local host="$1" known_hosts="$2" havip="$3"
  remote_ssh "${host}" "${known_hosts}" \
    "systemctl is-active --quiet keepalived.service && test -x /opt/projectwing/edge/health/edge-ha-health.sh && grep -Fxq 'PROJECTWING_HAVIP_ADDRESS=${havip}' /opt/projectwing/edge/keepalived.env"
}

edge_ha_order_nodes() {
  local havip="${PROJECTWING_HAVIP_ADDRESS:-}" bootstrap="${PROJECTWING_EDGE_HA_BOOTSTRAP:-false}"
  local blue_has=false green_has=false status
  edge_first_host="${blue_host}"; edge_first_known_hosts="${blue_known_hosts}"
  edge_second_host="${green_host}"; edge_second_known_hosts="${green_known_hosts}"
  [[ "${bootstrap}" == true || "${bootstrap}" == false ]] || { echo 'PROJECTWING_EDGE_HA_BOOTSTRAP must be true or false.' >&2; return 2; }
  if [[ -z "${havip}" ]]; then
    [[ "${bootstrap}" == true ]] || { echo 'HaVip is required after the one-time Edge HA bootstrap.' >&2; return 2; }
    echo 'Running the explicitly authorized one-time dual Edge bootstrap without a HaVip.' >&2
    return 0
  fi
  [[ "${havip}" =~ ^172\.19\.143\.[0-9]{1,3}$ ]] || { echo 'PROJECTWING_HAVIP_ADDRESS must be a VPC IPv4 address.' >&2; return 2; }
  if edge_ha_require_keepalived "${blue_host}" "${blue_known_hosts}" "${havip}"; then :; else
    status="$?"
    echo 'Blue Keepalived is not ready for the configured HaVip.' >&2
    return "${status}"
  fi
  if edge_ha_require_keepalived "${green_host}" "${green_known_hosts}" "${havip}"; then :; else
    status="$?"
    echo 'Green Keepalived is not ready for the configured HaVip.' >&2
    return "${status}"
  fi
  if edge_ha_node_has_vip "${blue_host}" "${blue_known_hosts}" "${havip}"; then
    blue_has=true
  else
    status="$?"
    [[ "${status}" == 1 ]] || return "${status}"
  fi
  if edge_ha_node_has_vip "${green_host}" "${green_known_hosts}" "${havip}"; then
    green_has=true
  else
    status="$?"
    [[ "${status}" == 1 ]] || return "${status}"
  fi
  [[ "${blue_has}" != "${green_has}" ]] || { echo 'Exactly one Edge node must currently hold the HaVip.' >&2; return 1; }
  if [[ "${blue_has}" == true ]]; then
    edge_first_host="${green_host}"; edge_first_known_hosts="${green_known_hosts}"
    edge_second_host="${blue_host}"; edge_second_known_hosts="${blue_known_hosts}"
  fi
}

edge_ha_rollback_both() {
  local failed=0
  edge_ha_retry_rollback_node "${edge_second_host}" "${edge_second_known_hosts}" || failed=1
  edge_ha_retry_rollback_node "${edge_first_host}" "${edge_first_known_hosts}" || failed=1
  edge_ha_verify_rollback_node "${blue_host}" "${blue_known_hosts}" "${edge_blue_state}" || failed=1
  edge_ha_verify_rollback_node "${green_host}" "${green_known_hosts}" "${edge_green_state}" || failed=1
  if (( failed != 0 )); then
    echo 'CRITICAL: dual Edge rollback did not restore the pre-attempt state.' >&2
    return 2
  fi
}

edge_ha_verify_rollback_node() {
  local host="$1" known_hosts="$2" expected_state="$3" current_state gateway mode
  current_state="$(edge_ha_read_node "${host}" "${known_hosts}")"
  if [[ -z "${expected_state}" ]]; then
    [[ -z "${current_state}" ]] || return 1
    remote_ssh "${host}" "${known_hosts}" \
      'test ! -e /opt/projectwing/edge/config/dynamic/edge-routing.yml && test -z "$(docker ps -q --filter label=com.docker.compose.project=projectwing-edge --filter label=com.docker.compose.service=reverse-proxy)"'
    return
  fi
  edge_ha_validate_state "${current_state}" || return 1
  [[ "$(edge_ha_canonical_state "${current_state}")" == "$(edge_ha_canonical_state "${expected_state}")" ]] || return 1
  mode="$(jq -r '.routeMode // "serving"' <<<"${expected_state}")"
  if [[ "${mode}" == maintenance ]]; then
    remote_ssh "${host}" "${known_hosts}" \
      "grep -Fq 'url: \"http://maintenance:8080\"' /opt/projectwing/edge/config/dynamic/edge-routing.yml"
  else
    gateway="$(jq -r '.activeGateway' <<<"${expected_state}")"
    remote_ssh "${host}" "${known_hosts}" \
      "grep -Fq 'url: \"${gateway}\"' /opt/projectwing/edge/config/dynamic/edge-routing.yml"
  fi
}

edge_ha_promote_dual() {
  edge_ha_order_nodes
  edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" prepare
  edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" prepare
  if ! edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" switch; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  if ! edge_ha_wait_verify_node "${edge_first_host}" "${edge_first_known_hosts}"; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  if ! edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" switch; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  if ! edge_ha_wait_verify_node "${edge_second_host}" "${edge_second_known_hosts}"; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  if ! edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" commit \
    || ! edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" commit; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  if ! edge_ha_assert_committed; then
    edge_ha_rollback_both || return 2
    return 1
  fi
}

edge_ha_assert_committed() {
  local blue_state green_state
  blue_state="$(edge_ha_read_node "${blue_host}" "${blue_known_hosts}")"
  green_state="$(edge_ha_read_node "${green_host}" "${green_known_hosts}")"
  [[ "$(edge_ha_canonical_state "${blue_state}")" == "$(edge_ha_canonical_state "${green_state}")" ]] || {
    echo 'Dual Edge commit did not converge to identical state.' >&2
    return 1
  }
  jq -e --arg color "${candidate_color}" --argjson generation "${edge_generation}" \
    '.schemaVersion == 4 and .activeColor == $color and .generation == $generation and
      .degraded == false and .routeMode == "serving"' \
    <<<"${blue_state}" >/dev/null
}

edge_ha_promote_single() {
  local host known_hosts committed_state havip="${PROJECTWING_HAVIP_ADDRESS:-}"
  if [[ "${single_host_color}" == blue ]]; then
    host="${blue_host}"; known_hosts="${blue_known_hosts}"
  else
    host="${green_host}"; known_hosts="${green_known_hosts}"
  fi
  [[ "${havip}" =~ ^172\.19\.143\.[0-9]{1,3}$ ]] || { echo 'Single-host recovery requires the configured private HaVip.' >&2; return 2; }
  edge_ha_require_keepalived "${host}" "${known_hosts}" "${havip}" \
    || { echo 'Single-host recovery target Keepalived is not ready.' >&2; return 1; }
  edge_ha_node_has_vip "${host}" "${known_hosts}" "${havip}" \
    || { echo 'Single-host recovery target does not hold the HaVip.' >&2; return 1; }
  edge_ha_node "${host}" "${known_hosts}" prepare true
  if ! edge_ha_node "${host}" "${known_hosts}" switch true; then
    edge_ha_rollback_single "${host}" "${known_hosts}"
    return $?
  fi
  if ! edge_ha_wait_verify_node "${host}" "${known_hosts}"; then
    edge_ha_rollback_single "${host}" "${known_hosts}"
    return $?
  fi
  if ! edge_ha_node "${host}" "${known_hosts}" commit true; then
    edge_ha_rollback_single "${host}" "${known_hosts}"
    return $?
  fi
  committed_state="$(edge_ha_read_node "${host}" "${known_hosts}")"
  if ! jq -e --arg color "${candidate_color}" --argjson generation "${edge_generation}" \
    '.schemaVersion == 4 and .activeColor == $color and .generation == $generation and
      .degraded == true and .routeMode == "serving"' \
    <<<"${committed_state}" >/dev/null; then
    edge_ha_rollback_single "${host}" "${known_hosts}"
    return $?
  fi
}

edge_ha_rollback_single() {
  local host="$1" known_hosts="$2"
  if ! edge_ha_node "${host}" "${known_hosts}" rollback true \
    || ! edge_ha_verify_rollback_node "${host}" "${known_hosts}" "${edge_active_state}"; then
    echo 'CRITICAL: single-host Edge rollback did not restore the pre-attempt state.' >&2
    return 2
  fi
  return 1
}

edge_ha_promote_candidate() {
  if [[ -n "${single_host_color}" ]]; then
    edge_ha_promote_single
  else
    edge_ha_promote_dual
  fi
}
