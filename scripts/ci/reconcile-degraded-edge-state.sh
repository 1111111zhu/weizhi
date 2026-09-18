#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ssh_helper="${PROJECTWING_DEPLOY_SSH_HELPER:-${root_dir}/scripts/ci/deploy-ssh.sh}"
deploy_user="${PROJECTWING_DEPLOY_USER:-ops}"
ssh_dir="${PROJECTWING_DEPLOY_SSH_DIR:?PROJECTWING_DEPLOY_SSH_DIR is required}"
havip="${PROJECTWING_HAVIP_ADDRESS:?PROJECTWING_HAVIP_ADDRESS is required}"
edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
recovery_node_script="${root_dir}/scripts/ci/edge-recovery-node.sh"
recovery_run_id="${PROJECTWING_RECOVERY_RUN_ID:?PROJECTWING_RECOVERY_RUN_ID is required}"
recovery_run_attempt="${PROJECTWING_RECOVERY_RUN_ATTEMPT:?PROJECTWING_RECOVERY_RUN_ATTEMPT is required}"

[[ "${havip}" =~ ^172\.19\.143\.[0-9]{1,3}$ ]] || { echo 'HaVip must be a private ProjectWing VPC address.' >&2; exit 2; }
[[ "${edge_root}" == /opt/projectwing/edge ]] || { echo 'Only the production Edge root may be reconciled.' >&2; exit 2; }
[[ "${recovery_run_id}" =~ ^[0-9]+$ && "${recovery_run_attempt}" =~ ^[1-9][0-9]*$ ]] \
  || { echo 'Recovery run metadata is invalid.' >&2; exit 2; }
test -r "${recovery_node_script}"

host_for() { [[ "$1" == blue ]] && printf '%s\n' "${PROJECTWING_BLUE_NETBIRD_HOST:?}" || printf '%s\n' "${PROJECTWING_GREEN_NETBIRD_HOST:?}"; }
known_for() { [[ "$1" == blue ]] && printf '%s\n' "${PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS:?}" || printf '%s\n' "${PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS:?}"; }
remote_env() {
  local color="$1" host known; shift
  host="$(host_for "${color}")"; known="$(known_for "${color}")"
  DEPLOY_HOST="${host}" DEPLOY_USER="${deploy_user}" PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${known}" \
    PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE="${ssh_dir}/known-hosts-${host}" PROJECTWING_DEPLOY_SSH_DIR="${ssh_dir}" "$@"
}
run_helper() { [[ -x "${ssh_helper}" ]] && "${ssh_helper}" "$@" || bash "${ssh_helper}" "$@"; }
configure() { remote_env "$1" run_helper configure >/dev/null; }
remote_ssh() { local color="$1"; shift; remote_env "${color}" run_helper ssh "$@"; }
read_state() { remote_ssh "$1" "cat '${edge_root}/release.json'"; }

validate() {
  jq -e '
    .schemaVersion == 4 and (.activeColor == "blue" or .activeColor == "green") and
    (.activeGateway == "http://172.19.143.157:18080" or .activeGateway == "http://172.19.143.158:18080") and
    (.releaseKey|type=="string" and test("^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$")) and
    (.version|type=="string" and test("^[a-f0-9]{40}$")) and
    (.sourceCommitSha|type=="string" and test("^[a-f0-9]{40}$")) and
    (.imageSourceSha|type=="string" and test("^[a-f0-9]{40}$")) and
    (.generation|type=="number" and .>=1 and floor==.) and (.degraded|type=="boolean") and
    .routeMode == "serving" and .transactionId == null and .pendingReleaseKey == null and
    .pendingSourceCommitSha == null and .pendingImageSourceSha == null' <<<"$1" >/dev/null
}
canonical() {
  jq -cS '{schemaVersion,activeColor,activeGateway,releaseKey,version,generation,degraded,
    previousColor:(.previousColor//null),previousGateway:(.previousGateway//null),
    previousReleaseKey:(.previousReleaseKey//null),previousVersion:(.previousVersion//null),
    previousGeneration:(.previousGeneration//null),sourceCommitSha,imageSourceSha,buildRunId,buildRunAttempt,
    deployRunId,deployRunAttempt,routeMode,transactionId,pendingReleaseKey,pendingSourceCommitSha,pendingImageSourceSha}' <<<"$1"
}
holds_vip() { remote_ssh "$1" "ip -4 -o addr show | grep -Fq ' ${havip}/'"; }
verify_quiescent_edge() {
  local color="$1" state="$2" release gateway
  release="$(jq -r .releaseKey <<<"${state}")"; gateway="$(jq -r .activeGateway <<<"${state}")"
  remote_ssh "${color}" "RELEASE_KEY='${release}' ACTIVE_GATEWAY='${gateway}' bash -s" <<'REMOTE'
set -Eeuo pipefail
test -d "/opt/projectwing/releases/${RELEASE_KEY}"
test -r /opt/projectwing/edge/release.json
grep -Fq "${ACTIVE_GATEWAY}" /opt/projectwing/edge/config/dynamic/edge-routing.yml
systemctl is-active --quiet keepalived.service
/opt/projectwing/edge/health/edge-ha-health.sh >/dev/null
flock -n /opt/projectwing/deployment.lock -c true
REMOTE
}

global_lock() {
  local action="$1" release color
  release="$(jq -r .releaseKey <<<"${authority_state}")"
  color="$(jq -r .activeColor <<<"${authority_state}")"
  remote_ssh "${authority}" \
    "PROJECTWING_RELEASE_DIR='/opt/projectwing/releases/${release}' PROJECTWING_RELEASE_KEY='${release}' PROJECTWING_COLOR='${color}' PROJECTWING_DEPLOY_RUN_ID='${recovery_run_id}' PROJECTWING_DEPLOY_RUN_ATTEMPT='${recovery_run_attempt}' bash '/opt/projectwing/releases/${release}/scripts/ci/deployment-lock-remote.sh' '${action}'"
}

run_recovery_node() {
  local operation="$1" expected_b64="$2" desired_b64="$3"
  remote_ssh "${lagging}" \
    "PROJECTWING_RECONCILE_TRANSACTION_ID='${recovery_run_id}-${recovery_run_attempt}' PROJECTWING_EXPECTED_STATE_B64='${expected_b64}' PROJECTWING_DESIRED_STATE_B64='${desired_b64}' bash -s '${operation}'" \
    <"${recovery_node_script}"
}

watch_global_lock() {
  local recovery_pid="$1" failure_file="$2" interval
  interval="${PROJECTWING_RECOVERY_LEASE_WATCH_SECONDS:-5}"
  while kill -0 "${recovery_pid}" 2>/dev/null; do
    sleep "${interval}"
    kill -0 "${recovery_pid}" 2>/dev/null || return 0
    if ! global_lock assert >/dev/null 2>&1; then
      : >"${failure_file}"
      kill -TERM "${recovery_pid}" 2>/dev/null || true
      return 0
    fi
  done
}

recover_with_lease_watchdog() {
  local expected_b64="$1" desired_b64="$2" failure_file recovery_pid recovery_status watchdog_pid
  failure_file="${ssh_dir}/recovery-lease-lost"
  rm -f -- "${failure_file}"
  run_recovery_node recover "${expected_b64}" "${desired_b64}" &
  recovery_pid="$!"
  watch_global_lock "${recovery_pid}" "${failure_file}" &
  watchdog_pid="$!"
  set +e
  wait "${recovery_pid}"
  recovery_status="$?"
  wait "${watchdog_pid}"
  set -e
  [[ ! -e "${failure_file}" ]] || fail_recovery 'global deployment lease was lost during node recovery'
  (( recovery_status == 0 )) || return "${recovery_status}"
}

fail_recovery() { echo "CRITICAL: $*." >&2; return 2; }

global_lock_may_be_held=false
recovery_may_have_started=false
recovery_committed=false
cleanup_reconciliation() {
  local status="$?" rollback_confirmed=true
  trap - EXIT
  set +e
  if [[ "${status}" -ne 0 && "${recovery_may_have_started}" == true && "${recovery_committed}" == false ]]; then
    if ! global_lock assert >/dev/null 2>&1; then global_lock acquire >/dev/null 2>&1 || rollback_confirmed=false; fi
    if [[ "${rollback_confirmed}" == true ]]; then
      run_recovery_node rollback '' '' || rollback_confirmed=false
    fi
    if [[ "${rollback_confirmed}" == false ]]; then
      echo 'CRITICAL: recovery rollback is unconfirmed; retaining the global deployment lease until its safety timeout.' >&2
      status=2
    fi
  fi
  if [[ "${global_lock_may_be_held}" == true && "${rollback_confirmed}" == true ]]; then
    global_lock release || status=2
  fi
  exit "${status}"
}
trap cleanup_reconciliation EXIT

configure blue; configure green
blue_state="$(read_state blue)"; green_state="$(read_state green)"
validate "${blue_state}" || { echo 'Blue Edge state is invalid.' >&2; exit 1; }
validate "${green_state}" || { echo 'Green Edge state is invalid.' >&2; exit 1; }
if [[ "$(canonical "${blue_state}")" == "$(canonical "${green_state}")" ]]; then
  verify_quiescent_edge blue "${blue_state}" \
    || { echo 'Blue Edge state agrees but its live route or runtime is not healthy.' >&2; exit 1; }
  verify_quiescent_edge green "${green_state}" \
    || { echo 'Green Edge state agrees but its live route or runtime is not healthy.' >&2; exit 1; }
  blue_holds_vip=false; green_holds_vip=false
  holds_vip blue && blue_holds_vip=true
  holds_vip green && green_holds_vip=true
  [[ "${blue_holds_vip}" != "${green_holds_vip}" ]] \
    || { echo 'Exactly one agreeing Edge must hold the HaVip.' >&2; exit 1; }
  echo 'Blue and Green Edge states, live routes, and runtimes already agree.'
  exit 0
fi

blue_generation="$(jq -r .generation <<<"${blue_state}")"; green_generation="$(jq -r .generation <<<"${green_state}")"
requested_authority="${PROJECTWING_RECONCILE_AUTHORITY_COLOR:-auto}"
case "${requested_authority}" in
  auto)
    reconcile_mode=forward
    if (( blue_generation > green_generation )); then authority=blue; lagging=green; authority_state="${blue_state}"; lagging_state="${green_state}"
    elif (( green_generation > blue_generation )); then authority=green; lagging=blue; authority_state="${green_state}"; lagging_state="${blue_state}"
    else echo 'Split Edge states have the same generation; refusing reconciliation.' >&2; exit 1; fi
    [[ "$(jq -r .degraded <<<"${authority_state}")" == true && "$(jq -r .degraded <<<"${lagging_state}")" == false ]] \
      || { echo 'Automatic recovery requires a newer degraded authority and an older healthy state.' >&2; exit 1; }
    jq -e --argjson old "${lagging_state}" '
      .previousGeneration == $old.generation and .previousReleaseKey == $old.releaseKey and
      .previousVersion == $old.version and .previousColor == $old.activeColor and
      .previousGateway == $old.activeGateway' <<<"${authority_state}" >/dev/null \
      || { echo 'The Edge states do not form a direct single-host recovery lineage.' >&2; exit 1; }
    ;;
  blue|green)
    reconcile_mode=rollback
    authority="${requested_authority}"
    if [[ "${authority}" == blue ]]; then lagging=green; authority_state="${blue_state}"; lagging_state="${green_state}"
    else lagging=blue; authority_state="${green_state}"; lagging_state="${blue_state}"; fi
    authority_generation="$(jq -r .generation <<<"${authority_state}")"
    lagging_generation="$(jq -r .generation <<<"${lagging_state}")"
    (( lagging_generation == authority_generation + 1 )) \
      || { echo 'Explicit rollback requires an orphaned degraded state exactly one generation ahead.' >&2; exit 1; }
    [[ "$(jq -r .degraded <<<"${authority_state}")" == false && "$(jq -r .degraded <<<"${lagging_state}")" == true ]] \
      || { echo 'Explicit rollback requires a healthy authority and a degraded successor.' >&2; exit 1; }
    [[ "$(jq -r .activeColor <<<"${lagging_state}")" == "${lagging}" ]] \
      || { echo 'The orphaned degraded state does not match its Edge color.' >&2; exit 1; }
    jq -e --argjson old "${authority_state}" '
      .previousGeneration == $old.generation and .previousReleaseKey == $old.releaseKey and
      .previousVersion == $old.version and .previousColor == $old.activeColor and
      .previousGateway == $old.activeGateway' <<<"${lagging_state}" >/dev/null \
      || { echo 'The degraded successor is not a direct descendant of the requested authority.' >&2; exit 1; }
    ;;
  *) echo 'PROJECTWING_RECONCILE_AUTHORITY_COLOR must be auto, blue, or green.' >&2; exit 2 ;;
esac

[[ "$(jq -r .activeColor <<<"${authority_state}")" == "${authority}" ]] \
  || { echo 'The authority does not match its active Edge color.' >&2; exit 1; }
expected_gateway=http://172.19.143.157:18080; [[ "${authority}" == green ]] && expected_gateway=http://172.19.143.158:18080
[[ "$(jq -r .activeGateway <<<"${authority_state}")" == "${expected_gateway}" ]] \
  || { echo 'The authority gateway does not match its Edge color.' >&2; exit 1; }
holds_vip "${authority}" || { echo 'The degraded authority is not the HaVip holder.' >&2; exit 1; }
if holds_vip "${lagging}"; then echo 'The lagging Edge also holds the HaVip.' >&2; exit 1; fi
verify_quiescent_edge "${authority}" "${authority_state}" \
  || { echo 'The degraded authority is not a healthy, quiescent Edge.' >&2; exit 1; }
remote_ssh "${lagging}" "flock -n /opt/projectwing/deployment.lock -c true" \
  || { echo 'The lagging Edge has an active deployment writer.' >&2; exit 1; }

expected_b64="$(printf '%s\n' "${lagging_state}" | base64 | tr -d '\n')"
new_b64="$(printf '%s\n' "${authority_state}" | base64 | tr -d '\n')"

global_lock_may_be_held=true
global_lock acquire
global_lock assert || { echo 'The global deployment lease was lost before reconciliation.' >&2; exit 2; }
blue_locked="$(read_state blue)"; green_locked="$(read_state green)"
[[ "$(canonical "${blue_locked}")" == "$(canonical "${blue_state}")" \
  && "$(canonical "${green_locked}")" == "$(canonical "${green_state}")" ]] \
  || { echo 'Edge state changed while acquiring the global deployment lease.' >&2; exit 1; }
holds_vip "${authority}" || { echo 'The authority lost the HaVip before reconciliation.' >&2; exit 1; }
if holds_vip "${lagging}"; then echo 'The lagging Edge gained the HaVip before reconciliation.' >&2; exit 1; fi
recovery_may_have_started=true
recover_with_lease_watchdog "${expected_b64}" "${new_b64}"

blue_after="$(read_state blue)"; green_after="$(read_state green)"
[[ "$(canonical "${blue_after}")" == "$(canonical "${green_after}")" ]] \
  || { echo 'CRITICAL: Edge state reconciliation did not converge.' >&2; exit 2; }
[[ "$(canonical "$(read_state "${authority}")")" == "$(canonical "${authority_state}")" ]] \
  || { echo 'CRITICAL: authority state changed during reconciliation.' >&2; exit 2; }
verify_quiescent_edge "${lagging}" "${authority_state}" \
  || { echo 'CRITICAL: lagging Edge route or runtime did not converge.' >&2; exit 2; }
holds_vip "${authority}" || { echo 'CRITICAL: authority lost the HaVip after reconciliation.' >&2; exit 2; }
if holds_vip "${lagging}"; then echo 'CRITICAL: lagging Edge gained the HaVip after reconciliation.' >&2; exit 2; fi
verify_quiescent_edge "${lagging}" "${authority_state}" \
  || { echo 'CRITICAL: recovered lagging Edge is not healthy.' >&2; exit 2; }
holds_vip "${authority}" || { echo 'CRITICAL: authority lost the HaVip after finalization.' >&2; exit 2; }
if holds_vip "${lagging}"; then echo 'CRITICAL: lagging Edge gained the HaVip after finalization.' >&2; exit 2; fi
global_lock assert || { echo 'CRITICAL: global deployment lease was lost during reconciliation.' >&2; exit 2; }
recovery_committed=true
run_recovery_node forget '' '' || echo 'WARNING: recovered Edge transaction metadata was not removed.' >&2
if [[ "${reconcile_mode}" == rollback ]]; then
  echo "Rolled back orphaned ${lagging^} Edge route and state to the verified healthy ${authority^} VIP authority; runtime was verified."
else
  echo "Reconciled ${lagging^} Edge route and state from the verified degraded ${authority^} authority; runtime was verified."
fi
