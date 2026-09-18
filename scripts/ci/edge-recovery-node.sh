#!/usr/bin/env bash
set -Eeuo pipefail

operation="${1:-}"
edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
project_root="${PROJECTWING_ROOT:-/opt/projectwing}"
lock_file="${PROJECTWING_DEPLOY_LOCK_FILE:-${project_root}/deployment.lock}"
state_file="${edge_root}/release.json"
route_file="${edge_root}/config/dynamic/edge-routing.yml"
marker_file="${edge_root}/reconcile.in-progress"
keepalived_health_script="${PROJECTWING_KEEPALIVED_HEALTH_SCRIPT:-/usr/local/libexec/projectwing/edge-ha-health.sh}"
keepalived_heartbeat="${PROJECTWING_KEEPALIVED_HEARTBEAT:-/run/projectwing/edge-ha-health.status}"
transaction_id="${PROJECTWING_RECONCILE_TRANSACTION_ID:?PROJECTWING_RECONCILE_TRANSACTION_ID is required}"
transaction_root="${edge_root}/recovery"
transaction_dir="${transaction_root}/${transaction_id}"
expected_file="${transaction_dir}/expected.json"
desired_file="${transaction_dir}/desired.json"
state_snapshot="${transaction_dir}/release.before.json"
route_snapshot="${transaction_dir}/route.before.yml"
route_absent="${transaction_dir}/route.before.absent"

fail() { echo "edge-recovery-node: $*" >&2; exit 1; }

validate_inputs() {
  [[ "${transaction_id}" =~ ^[0-9]+-[1-9][0-9]*$ ]] || fail 'transaction ID is invalid'
  [[ "${edge_root}" == /opt/projectwing/edge || "${PROJECTWING_RECOVERY_TEST_MODE:-false}" == true ]] \
    || fail 'only the production Edge root may be recovered'
  command -v flock >/dev/null
  command -v jq >/dev/null
  test -r "${keepalived_health_script}" || fail 'installed Keepalived health script is unreadable'
  grep -Fq 'reconcile.in-progress' "${keepalived_health_script}" \
    || fail 'installed Keepalived health script cannot fail closed during recovery'
  grep -Fq 'PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER' "${keepalived_health_script}" \
    || fail 'installed Keepalived health script lacks the internal recovery bypass'
}

heartbeat_value() { awk -F= -v key="$1" '$1 == key { print $2 }' "${keepalived_heartbeat}"; }

validate_keepalived_heartbeat() {
  local actual_sha binding checked_at current_comm current_start expected_comm expected_sha keepalived_pid keepalived_start now
  [[ -f "${keepalived_heartbeat}" && ! -L "${keepalived_heartbeat}" ]] \
    || fail 'Keepalived health heartbeat is unavailable'
  expected_sha="$(sha256sum "${keepalived_health_script}" | awk '{print $1}')"
  actual_sha="$(heartbeat_value script_sha256)"
  checked_at="$(heartbeat_value checked_at)"
  keepalived_pid="$(heartbeat_value keepalived_pid)"
  keepalived_start="$(heartbeat_value keepalived_start)"
  binding="$(heartbeat_value binding)"
  [[ "${actual_sha}" == "${expected_sha}" && "${checked_at}" =~ ^[0-9]+$ \
    && "${keepalived_pid}" =~ ^[1-9][0-9]*$ && "${keepalived_start}" =~ ^[0-9]+$ \
    && "${binding}" == projectwing_edge_health ]] \
    || fail 'Keepalived health heartbeat does not match the installed script'
  current_comm="$(cat "/proc/${keepalived_pid}/comm" 2>/dev/null || true)"
  current_start="$(awk '{print $22}' "/proc/${keepalived_pid}/stat" 2>/dev/null || true)"
  expected_comm=keepalived
  if [[ "${PROJECTWING_RECOVERY_TEST_MODE:-false}" == true ]]; then
    expected_comm="${PROJECTWING_KEEPALIVED_EXPECTED_COMM:-${current_comm}}"
  fi
  [[ "${current_comm}" == "${expected_comm}"* && "${current_start}" == "${keepalived_start}" ]] \
    || fail 'Keepalived heartbeat writer is not the active Keepalived process'
  now="$(date +%s)"
  (( checked_at <= now && now - checked_at <= 15 )) \
    || fail 'Keepalived health heartbeat is stale'
  printf '%s\n' "${checked_at}"
}

assert_marker_blocks_keepalived() {
  local baseline final grace_seconds quiet_seconds
  grace_seconds="${PROJECTWING_RECOVERY_MARKER_GRACE_SECONDS:-5}"
  quiet_seconds="${PROJECTWING_RECOVERY_MARKER_QUIET_SECONDS:-3}"
  [[ "${grace_seconds}" =~ ^[0-9]+$ && "${quiet_seconds}" =~ ^[0-9]+$ ]] \
    || fail 'Keepalived marker timing is invalid'
  sleep "${grace_seconds}"
  baseline="$(heartbeat_value checked_at)"
  sleep "${quiet_seconds}"
  final="$(heartbeat_value checked_at)"
  [[ "${baseline}" =~ ^[0-9]+$ && "${final}" == "${baseline}" ]] \
    || fail 'Keepalived continued to report healthy while the recovery marker existed'
}

wait_for_new_keepalived_heartbeat() {
  local previous="$1" attempt attempts current interval
  attempts="${PROJECTWING_RECOVERY_HEARTBEAT_ATTEMPTS:-12}"
  interval="${PROJECTWING_RECOVERY_HEARTBEAT_INTERVAL_SECONDS:-1}"
  for attempt in $(seq 1 "${attempts}"); do
    current="$(validate_keepalived_heartbeat 2>/dev/null || true)"
    if [[ "${current}" =~ ^[0-9]+$ ]] && (( current > previous )); then return 0; fi
    sleep "${interval}"
  done
  fail 'Keepalived did not confirm the recovered Edge after marker removal'
}

validate_state_file() {
  local file="$1"
  jq -e '
    .schemaVersion == 4 and (.activeColor == "blue" or .activeColor == "green") and
    (.activeGateway == "http://172.19.143.157:18080" or
      .activeGateway == "http://172.19.143.158:18080") and
    (.releaseKey | type == "string" and test("^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$")) and
    (.sourceCommitSha | type == "string" and test("^[a-f0-9]{40}$")) and
    (.imageSourceSha | type == "string" and test("^[a-f0-9]{40}$")) and
    (.generation | type == "number" and . >= 1 and floor == .) and
    (.degraded | type == "boolean") and .routeMode == "serving" and
    .transactionId == null and .pendingReleaseKey == null and
    .pendingSourceCommitSha == null and .pendingImageSourceSha == null' "${file}" >/dev/null
}

canonical_file() { jq -cS . "$1"; }

assert_state_matches() {
  local expected="$1"
  test -r "${state_file}" || fail 'lagging Edge state is unreadable'
  [[ "$(canonical_file "${state_file}")" == "$(canonical_file "${expected}")" ]] \
    || fail 'lagging Edge state changed during recovery'
}

decode_state() {
  local encoded="$1" target="$2"
  printf '%s' "${encoded}" | base64 -d >"${target}"
  validate_state_file "${target}" || fail "invalid recovery state: ${target}"
}

desired_release_dir() {
  local release
  release="$(jq -r .releaseKey "${desired_file}")"
  printf '%s/releases/%s\n' "${project_root}" "${release}"
}

render_desired_route() {
  local release_dir source gateway temporary
  release_dir="$(desired_release_dir)"
  source="${release_dir}/deploy/traefik/dynamic/edge-routing.yml"
  gateway="$(jq -r .activeGateway "${desired_file}")"
  test -r "${source}" || fail "authority release route template is missing: ${source}"
  temporary="$(mktemp "${route_file}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  sed "s|__PROJECTWING_ACTIVE_GATEWAY__|${gateway}|g" "${source}" >"${temporary}"
  grep -Fq "url: \"${gateway}\"" "${temporary}" || fail 'rendered recovery route is invalid'
  chmod 640 "${temporary}"
  mv -f "${temporary}" "${route_file}"
  trap - RETURN
}

verify_runtime() {
  local state="$1" allow_marker="${2:-true}" release_dir gateway verifier health_script netbird_status
  release_dir="${project_root}/releases/$(jq -r .releaseKey "${state}")"
  gateway="$(jq -r .activeGateway "${state}")"
  grep -Fq "url: \"${gateway}\"" "${route_file}" || return 1
  verifier="${PROJECTWING_RECOVERY_VERIFY_SCRIPT:-}"
  if [[ -n "${verifier}" ]]; then
    PROJECTWING_RELEASE_DIR="${release_dir}" PROJECTWING_ACTIVE_GATEWAY="${gateway}" \
      PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER="${allow_marker}" \
      bash "${verifier}"
    return
  fi
  health_script="${edge_root}/health/edge-ha-health.sh"
  test -x "${health_script}" -a -r "${release_dir}/scripts/ci/deployment-health.sh"
  PROJECTWING_EDGE_ROOT="${edge_root}" PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER="${allow_marker}" bash "${health_script}"
  # shellcheck source=deployment-health.sh
  . "${release_dir}/scripts/ci/deployment-health.sh"
  export PROJECTWING_RELEASE_DIR="${release_dir}"
  export PROJECTWING_EMP_URL=https://wing.superfx.cn PROJECTWING_AUTH_URL=https://auth.superfx.cn
  export PROJECTWING_CMP_URL=https://cmp.superfx.cn PROJECTWING_SHOWROOM_URL=https://showroom.superfx.cn
  export PROJECTWING_TMS_URL=https://tms.superfx.cn PROJECTWING_INTRANET_URL=https://intranet.superfx.cn
  export PROJECTWING_IB_URL=https://ib.superfx.cn PROJECTWING_DB_URL=https://db.superfx.cn
  pw_wait_for_full_edge_stack 3 5 4
  pw_verify_api_route 'Prisma Studio' "${PROJECTWING_DB_URL}" 'window.__STUDIO_CONFIG__'
  systemctl is-active --quiet keepalived.service
  netbird_status="$(netbird status --json 2>/dev/null)"
  jq -e '.daemonStatus == "Connected" and .management.connected == true and
    .signal.connected == true' <<<"${netbird_status}" >/dev/null
}

write_desired_state() {
  local temporary
  assert_state_matches "${expected_file}"
  temporary="$(mktemp "${state_file}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  install -m 640 "${desired_file}" "${temporary}"
  mv -f "${temporary}" "${state_file}"
  trap - RETURN
}

snapshot_current() {
  [[ ! -L "${transaction_root}" ]] || fail 'recovery transaction root is a symbolic link'
  install -d -m 750 "${transaction_root}"
  [[ ! -e "${transaction_dir}" && ! -L "${transaction_dir}" ]] \
    || fail 'recovery transaction already exists'
  install -d -m 700 "${transaction_dir}"
  decode_state "${PROJECTWING_EXPECTED_STATE_B64:?}" "${expected_file}"
  decode_state "${PROJECTWING_DESIRED_STATE_B64:?}" "${desired_file}"
  assert_state_matches "${expected_file}"
  install -m 640 "${state_file}" "${state_snapshot}"
  if [[ -r "${route_file}" ]]; then
    install -m 640 "${route_file}" "${route_snapshot}"
  else
    : >"${route_absent}"
  fi
}

restore_snapshot() {
  local temporary
  test -r "${state_snapshot}" || return 1
  temporary="$(mktemp "${state_file}.XXXXXX")"
  install -m 640 "${state_snapshot}" "${temporary}"
  mv -f "${temporary}" "${state_file}"
  if [[ -r "${route_snapshot}" ]]; then
    temporary="$(mktemp "${route_file}.XXXXXX")"
    install -m 640 "${route_snapshot}" "${temporary}"
    mv -f "${temporary}" "${route_file}"
  elif [[ -e "${route_absent}" ]]; then
    rm -f -- "${route_file}"
  else
    return 1
  fi
}

write_recovery_marker() {
  local temporary
  [[ ! -L "${marker_file}" ]] || fail 'recovery marker is a symbolic link'
  temporary="$(mktemp "${edge_root}/.reconcile.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  chmod 640 "${temporary}"
  mv -f "${temporary}" "${marker_file}"
  trap - RETURN
}

recover_node() {
  local heartbeat_before
  heartbeat_before="$(validate_keepalived_heartbeat)"
  snapshot_current
  trap rollback_failed_apply EXIT
  write_recovery_marker
  assert_marker_blocks_keepalived
  render_desired_route
  verify_runtime "${desired_file}" true
  write_desired_state
  assert_state_matches "${desired_file}"
  verify_runtime "${desired_file}" true
  rm -f -- "${marker_file}"
  verify_runtime "${desired_file}" false
  wait_for_new_keepalived_heartbeat "${heartbeat_before}"
  printf 'finalized\n' >"${transaction_dir}/status"
  trap - EXIT
}

rollback_failed_apply() {
  local status="$?"
  trap - EXIT
  set +e
  write_recovery_marker || status=2
  restore_snapshot || status=2
  printf 'failed\n' >"${transaction_dir}/status"
  exit "${status}"
}

rollback_recovery() {
  [[ -d "${transaction_dir}" && ! -L "${transaction_dir}" ]] || return 0
  [[ "$(cat "${transaction_dir}/status" 2>/dev/null || true)" != rolled-back ]] || return 0
  write_recovery_marker
  restore_snapshot || fail 'recovery snapshot could not be restored'
  assert_state_matches "${state_snapshot}"
  verify_runtime "${state_snapshot}" true || fail 'restored Edge runtime is not healthy'
  printf 'rolled-back\n' >"${transaction_dir}/status"
}

forget_recovery() {
  test "$(cat "${transaction_dir}/status")" = finalized
  assert_state_matches "${desired_file}"
  find "${transaction_dir}" -xdev -mindepth 1 -maxdepth 1 -type f -delete
  rmdir "${transaction_dir}"
}

validate_inputs
mkdir -p "$(dirname "${lock_file}")"
exec 9>"${lock_file}"
if [[ "${operation}" == rollback ]]; then
  flock --wait 180 9 || fail 'timed out waiting for the lagging Edge deployment lock'
else
  flock --nonblock 9 || fail 'lagging Edge deployment lock is busy'
fi
case "${operation}" in
  recover) recover_node ;;
  rollback) rollback_recovery ;;
  forget) forget_recovery ;;
  *) fail 'usage: edge-recovery-node.sh {recover|rollback|forget}' ;;
esac
