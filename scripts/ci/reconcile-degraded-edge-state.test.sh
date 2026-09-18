#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
target="${root}/scripts/ci/reconcile-degraded-edge-state.sh"
grep -Fqx 'grep -Fq "${ACTIVE_GATEWAY}" /opt/projectwing/edge/config/dynamic/edge-routing.yml' "${target}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
mkdir -p "${tmp}/bin" "${tmp}/ssh"

cat > "${tmp}/bin/deploy-ssh" <<'FAKE'
#!/usr/bin/env bash
set -Eeuo pipefail
color=blue; [[ "${DEPLOY_HOST}" == 100.113.0.2 ]] && color=green
case "$1" in
  configure) exit 0 ;;
  ssh)
    shift
    command="$1"
    state_var="PW_STATE_${color^^}"
    state="${!state_var}"
    [[ ! -f "${PW_STATE_DIR}/${color}.written" ]] || state="$(cat "${PW_STATE_DIR}/${color}.written")"
    if [[ "${command}" == *"cat '/opt/projectwing/edge/release.json'"* ]]; then printf '%s\n' "${state}"; exit 0; fi
    if [[ "${command}" == *"ip -4 -o addr show"* ]]; then [[ "${color}" == "${PW_VIP_COLOR}" ]]; exit; fi
    if [[ "${command}" == *"deployment-lock-remote.sh"* ]]; then
      for action in acquire assert release; do
        if [[ "${command}" == *"'${action}'"* ]]; then
          printf '%s\n' "${action}" >>"${PW_STATE_DIR}/global-lock"
          if [[ "${action}" == acquire && "${PW_DRIFT_COLOR:-}" == "${color}" ]]; then
            jq -c '.generation += 1' <<<"${state}" >"${PW_STATE_DIR}/${color}.written"
          fi
          if [[ "${action}" == acquire && "${PW_UNCERTAIN_ACQUIRE:-false}" == true ]]; then exit 255; fi
          if [[ "${action}" == assert && "${PW_FAIL_LEASE_DURING:-false}" == true \
            && -e "${PW_STATE_DIR}/recovering" ]]; then exit 1; fi
        fi
      done
      exit 0
    fi
    if [[ "${command}" == *"bash -s 'recover'"* ]]; then
      cat >/dev/null
      expected_b64="${command#*PROJECTWING_EXPECTED_STATE_B64=\'}"; expected_b64="${expected_b64%%\'*}"
      new_b64="${command#*PROJECTWING_DESIRED_STATE_B64=\'}"; new_b64="${new_b64%%\'*}"
      printf '%s\n' "${state}" > "${PW_STATE_DIR}/${color}.current"
      printf '%s' "${expected_b64}" | base64 -d > "${PW_STATE_DIR}/${color}.expected"
      cmp -s "${PW_STATE_DIR}/${color}.current" "${PW_STATE_DIR}/${color}.expected" \
        || { echo 'Lagging Edge state changed before reconciliation.' >&2; exit 1; }
      cp "${PW_STATE_DIR}/${color}.current" "${PW_STATE_DIR}/${color}.before"
      : >"${PW_STATE_DIR}/recovering"
      if [[ "${PW_RECOVERY_DELAY_SECONDS:-0}" != 0 ]]; then sleep "${PW_RECOVERY_DELAY_SECONDS}"; fi
      printf '%s' "${new_b64}" | base64 -d > "${PW_STATE_DIR}/${color}.written"
      rm -f "${PW_STATE_DIR}/recovering"
      printf 'finalized\n' >"${PW_STATE_DIR}/${color}.recovery"
      if [[ "${PW_UNCERTAIN_RECOVERY:-false}" == true ]]; then exit 255; fi
      exit 0
    fi
    if [[ "${command}" == *"bash -s 'rollback'"* ]]; then
      cat >/dev/null
      [[ "${PW_FAIL_ROLLBACK:-false}" != true ]] || exit 255
      cp "${PW_STATE_DIR}/${color}.before" "${PW_STATE_DIR}/${color}.written"
      exit 0
    fi
    if [[ "${command}" == *"bash -s 'forget'"* ]]; then cat >/dev/null; exit 0; fi
    if [[ "${command}" == *"RELEASE_KEY="* ]]; then
      cat >/dev/null || true
      if [[ "${PW_FAIL_POSTCHECK_COLOR:-}" == "${color}" && -f "${PW_STATE_DIR}/${color}.written" ]]; then exit 1; fi
      exit 0
    fi
    if [[ "${command}" == *"flock -n /opt/projectwing/deployment.lock"* ]]; then cat >/dev/null || true; exit 0; fi
    exit 71
    ;;
  *) exit 72 ;;
esac
FAKE
command -v chmod >/dev/null 2>&1 && chmod +x "${tmp}/bin/deploy-ssh" || true

old='{"schemaVersion":4,"activeColor":"green","activeGateway":"http://172.19.143.158:18080","releaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-10-1","version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceCommitSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","imageSourceSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","buildRunId":10,"buildRunAttempt":1,"deployRunId":20,"deployRunAttempt":1,"generation":16,"degraded":false,"routeMode":"serving","transactionId":null,"pendingReleaseKey":null,"pendingSourceCommitSha":null,"pendingImageSourceSha":null}'
new='{"schemaVersion":4,"activeColor":"blue","activeGateway":"http://172.19.143.157:18080","releaseKey":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-11-1","version":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sourceCommitSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","imageSourceSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","buildRunId":11,"buildRunAttempt":1,"deployRunId":21,"deployRunAttempt":1,"generation":17,"degraded":true,"routeMode":"serving","transactionId":null,"pendingReleaseKey":null,"pendingSourceCommitSha":null,"pendingImageSourceSha":null,"previousColor":"green","previousGateway":"http://172.19.143.158:18080","previousReleaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-10-1","previousVersion":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","previousGeneration":16}'

run_case() {
  local name="$1" blue="$2" green="$3" vip="$4" mode="${5:-auto}" drift="${6:-}" uncertain="${7:-false}" fail_postcheck="${8:-}" uncertain_acquire="${9:-false}" fail_rollback="${10:-false}" fail_lease="${11:-false}" recovery_delay="${12:-0}"
  mkdir -p "${tmp}/${name}"
  set +e
  PW_STATE_DIR="${tmp}/${name}" PW_STATE_BLUE="${blue}" PW_STATE_GREEN="${green}" PW_VIP_COLOR="${vip}" PW_DRIFT_COLOR="${drift}" \
    PW_UNCERTAIN_RECOVERY="${uncertain}" PW_FAIL_POSTCHECK_COLOR="${fail_postcheck}" PW_UNCERTAIN_ACQUIRE="${uncertain_acquire}" \
    PW_FAIL_ROLLBACK="${fail_rollback}" PW_FAIL_LEASE_DURING="${fail_lease}" PW_RECOVERY_DELAY_SECONDS="${recovery_delay}" \
    PROJECTWING_RECONCILE_AUTHORITY_COLOR="${mode}" \
    PROJECTWING_DEPLOY_SSH_HELPER="${tmp}/bin/deploy-ssh" PROJECTWING_DEPLOY_SSH_DIR="${tmp}/ssh" \
    PROJECTWING_BLUE_NETBIRD_HOST=100.113.0.1 PROJECTWING_GREEN_NETBIRD_HOST=100.113.0.2 \
    PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS=blue PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS=green \
    PROJECTWING_RECOVERY_RUN_ID=123 PROJECTWING_RECOVERY_RUN_ATTEMPT=1 \
    PROJECTWING_RECOVERY_LEASE_WATCH_SECONDS=0.1 \
    PROJECTWING_HAVIP_ADDRESS=172.19.143.164 bash "${target}" >"${tmp}/${name}/out" 2>"${tmp}/${name}/err"
  echo $? >"${tmp}/${name}/status"
  set -e
}

run_case recover "${new}" "${old}" blue
[[ "$(cat "${tmp}/recover/status")" == 0 ]]
cmp -s <(printf '%s\n' "${new}") "${tmp}/recover/green.written"
grep -Fxq 'Reconciled Green Edge route and state from the verified degraded Blue authority; runtime was verified.' "${tmp}/recover/out"
grep -Fxq acquire "${tmp}/recover/global-lock"
grep -Fxq release "${tmp}/recover/global-lock"

run_case equal "${new}" "${new}" blue
[[ "$(cat "${tmp}/equal/status")" == 0 ]]
[[ ! -e "${tmp}/equal/green.written" ]]
grep -Fxq 'Blue and Green Edge states, live routes, and runtimes already agree.' "${tmp}/equal/out"

run_case wrong-vip "${new}" "${old}" green
[[ "$(cat "${tmp}/wrong-vip/status")" != 0 ]]
[[ ! -e "${tmp}/wrong-vip/green.written" ]]

unrelated="$(jq -c '.previousReleaseKey="cccccccccccccccccccccccccccccccccccccccc-9-1"' <<<"${new}")"
run_case unrelated "${unrelated}" "${old}" blue
[[ "$(cat "${tmp}/unrelated/status")" != 0 ]]
[[ ! -e "${tmp}/unrelated/green.written" ]]

run_case authority-drift "${new}" "${old}" blue auto blue
[[ "$(cat "${tmp}/authority-drift/status")" != 0 ]]
[[ ! -e "${tmp}/authority-drift/green.recovery" ]]
grep -Fxq release "${tmp}/authority-drift/global-lock"

run_case rollback-orphan "${new}" "${old}" green green
[[ "$(cat "${tmp}/rollback-orphan/status")" == 0 ]]
cmp -s <(printf '%s\n' "${old}") "${tmp}/rollback-orphan/blue.written"
grep -Fxq 'Rolled back orphaned Blue Edge route and state to the verified healthy Green VIP authority; runtime was verified.' "${tmp}/rollback-orphan/out"

run_case rollback-wrong-vip "${new}" "${old}" blue green
[[ "$(cat "${tmp}/rollback-wrong-vip/status")" != 0 ]]
[[ ! -e "${tmp}/rollback-wrong-vip/blue.written" ]]

run_case uncertain-recovery "${new}" "${old}" blue auto '' true
[[ "$(cat "${tmp}/uncertain-recovery/status")" != 0 ]]
cmp -s <(printf '%s\n' "${old}") "${tmp}/uncertain-recovery/green.written"
grep -Fxq release "${tmp}/uncertain-recovery/global-lock"

run_case postcheck-failure "${new}" "${old}" blue auto '' false green
[[ "$(cat "${tmp}/postcheck-failure/status")" != 0 ]]
cmp -s <(printf '%s\n' "${old}") "${tmp}/postcheck-failure/green.written"

run_case uncertain-acquire "${new}" "${old}" blue auto '' false '' true
[[ "$(cat "${tmp}/uncertain-acquire/status")" != 0 ]]
[[ ! -e "${tmp}/uncertain-acquire/green.written" ]]
grep -Fxq release "${tmp}/uncertain-acquire/global-lock"

run_case rollback-unconfirmed "${new}" "${old}" blue auto '' true '' false true
[[ "$(cat "${tmp}/rollback-unconfirmed/status")" == 2 ]]
! grep -Fxq release "${tmp}/rollback-unconfirmed/global-lock"
grep -Fq 'retaining the global deployment lease until its safety timeout' "${tmp}/rollback-unconfirmed/err"

run_case lease-lost "${new}" "${old}" blue auto '' false '' false false true 1
[[ "$(cat "${tmp}/lease-lost/status")" != 0 ]]
cmp -s <(printf '%s\n' "${old}") "${tmp}/lease-lost/green.written"
grep -Fxq release "${tmp}/lease-lost/global-lock"

echo 'Degraded Edge reconciliation tests passed.'
