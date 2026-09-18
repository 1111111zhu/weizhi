#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
target="${root}/scripts/ci/edge-recovery-node.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
project="${tmp}/project"; edge="${project}/edge"
mkdir -p "${edge}/config/dynamic" "${project}/releases"
heartbeat="${tmp}/edge-ha-health.status"
keepalived_script="${root}/scripts/ci/edge-ha-health.sh"

old='{"schemaVersion":4,"activeColor":"green","activeGateway":"http://172.19.143.158:18080","releaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-10-1","version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sourceCommitSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","imageSourceSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","buildRunId":10,"buildRunAttempt":1,"deployRunId":20,"deployRunAttempt":1,"generation":16,"degraded":false,"routeMode":"serving","transactionId":null,"pendingReleaseKey":null,"pendingSourceCommitSha":null,"pendingImageSourceSha":null}'
new='{"schemaVersion":4,"activeColor":"blue","activeGateway":"http://172.19.143.157:18080","releaseKey":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-11-1","version":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sourceCommitSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","imageSourceSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","buildRunId":11,"buildRunAttempt":1,"deployRunId":21,"deployRunAttempt":1,"generation":17,"degraded":true,"routeMode":"serving","transactionId":null,"pendingReleaseKey":null,"pendingSourceCommitSha":null,"pendingImageSourceSha":null,"previousColor":"green","previousGateway":"http://172.19.143.158:18080","previousReleaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-10-1","previousVersion":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","previousGeneration":16}'
release="${project}/releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-11-1"
mkdir -p "${release}/deploy/traefik/dynamic"
printf 'url: "__PROJECTWING_ACTIVE_GATEWAY__"\n' >"${release}/deploy/traefik/dynamic/edge-routing.yml"
printf '%s\n' "${old}" >"${edge}/release.json"
printf 'url: "http://172.19.143.158:18080"\n' >"${edge}/config/dynamic/edge-routing.yml"

cat >"${tmp}/verify" <<'VERIFY'
#!/usr/bin/env bash
set -Eeuo pipefail
grep -Fq "${PROJECTWING_ACTIVE_GATEWAY}" "${PW_EDGE_ROOT}/config/dynamic/edge-routing.yml"
if [[ "${PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER}" == true \
  && "${PW_BLOCK_RECOVERY:-false}" == true && ! -e "${PW_BLOCKED_ONCE}" ]]; then
  : >"${PW_BLOCKED_ONCE}"
  : >"${PW_BLOCK_READY}"
  for _ in $(seq 1 100); do
    [[ -e "${PW_BLOCK_RELEASE}" ]] && break
    sleep 0.1
  done
  test -e "${PW_BLOCK_RELEASE}"
fi
if [[ "${PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER}" == false ]]; then
  previous="$(awk -F= '$1 == "checked_at" { print $2 }' "${PW_HEARTBEAT}")"
  while (( $(date +%s) <= previous )); do sleep 1; done
  printf 'script_sha256=%s\nchecked_at=%s\nkeepalived_pid=%s\nkeepalived_start=%s\nbinding=projectwing_edge_health\n' \
    "$(sha256sum "${PW_KEEPALIVED_SCRIPT}" | awk '{print $1}')" "$(date +%s)" \
    "${PW_KEEPALIVED_PID}" "${PW_KEEPALIVED_START}" >"${PW_HEARTBEAT}"
fi
VERIFY
chmod +x "${tmp}/verify"

write_heartbeat() {
  printf 'script_sha256=%s\nchecked_at=%s\nkeepalived_pid=%s\nkeepalived_start=%s\nbinding=projectwing_edge_health\n' \
    "$(sha256sum "${keepalived_script}" | awk '{print $1}')" "$(date +%s)" "$$" \
    "$(awk '{print $22}' "/proc/$$/stat")" >"${heartbeat}"
}
write_heartbeat

run_node() {
    PROJECTWING_ROOT="${project}" PROJECTWING_EDGE_ROOT="${edge}" \
    PROJECTWING_DEPLOY_LOCK_FILE="${project}/deployment.lock" PROJECTWING_RECOVERY_TEST_MODE=true \
    PROJECTWING_KEEPALIVED_HEALTH_SCRIPT="${keepalived_script}" PROJECTWING_KEEPALIVED_HEARTBEAT="${heartbeat}" \
    PROJECTWING_RECOVERY_MARKER_GRACE_SECONDS=0 PROJECTWING_RECOVERY_MARKER_QUIET_SECONDS=0 \
    PROJECTWING_RECOVERY_HEARTBEAT_ATTEMPTS="${PW_HEARTBEAT_ATTEMPTS:-12}" \
    PROJECTWING_RECOVERY_HEARTBEAT_INTERVAL_SECONDS="${PW_HEARTBEAT_INTERVAL:-1}" \
    PROJECTWING_RECONCILE_TRANSACTION_ID="$1" \
    PROJECTWING_RECOVERY_VERIFY_SCRIPT="${PROJECTWING_RECOVERY_VERIFY_SCRIPT_OVERRIDE:-${tmp}/verify}" \
    PW_EDGE_ROOT="${edge}" PW_HEARTBEAT="${heartbeat}" PW_KEEPALIVED_SCRIPT="${keepalived_script}" \
    PW_KEEPALIVED_PID="$$" PW_KEEPALIVED_START="$(awk '{print $22}' "/proc/$$/stat")" \
    PW_BLOCK_RECOVERY="${PW_BLOCK_RECOVERY:-false}" PW_BLOCKED_ONCE="${tmp}/blocked-once" \
    PW_BLOCK_READY="${tmp}/block-ready" PW_BLOCK_RELEASE="${tmp}/block-release" \
    PROJECTWING_EXPECTED_STATE_B64="$(printf '%s\n' "${old}" | base64 -w0)" \
    PROJECTWING_DESIRED_STATE_B64="$(printf '%s\n' "${new}" | base64 -w0)" bash "${target}" "$2"
}

PW_BLOCK_RECOVERY=true run_node 99-1 recover &
recovery_pid="$!"
for _ in $(seq 1 100); do
  [[ -e "${tmp}/block-ready" ]] && break
  sleep 0.1
done
test -e "${tmp}/block-ready"
! flock -n "${project}/deployment.lock" -c true
: >"${tmp}/block-release"
wait "${recovery_pid}"
run_node 99-1 forget
printf '%s\n' "${old}" >"${edge}/release.json"
printf 'url: "http://172.19.143.158:18080"\n' >"${edge}/config/dynamic/edge-routing.yml"
write_heartbeat

run_node 100-1 recover
jq -e '.generation == 17 and .degraded == true' "${edge}/release.json" >/dev/null
grep -Fq '172.19.143.157:18080' "${edge}/config/dynamic/edge-routing.yml"
test ! -e "${edge}/reconcile.in-progress"
run_node 100-1 forget
test ! -e "${edge}/recovery/100-1"

printf '%s\n' "${old}" >"${edge}/release.json"
printf 'url: "http://172.19.143.158:18080"\n' >"${edge}/config/dynamic/edge-routing.yml"
write_heartbeat
run_node 101-1 recover
run_node 101-1 rollback
cmp -s <(printf '%s\n' "${old}") "${edge}/release.json"
grep -Fq '172.19.143.158:18080' "${edge}/config/dynamic/edge-routing.yml"
test -e "${edge}/reconcile.in-progress"

cat >"${tmp}/fail-verify" <<'FAIL'
#!/usr/bin/env bash
exit 1
FAIL
chmod +x "${tmp}/fail-verify"
set +e
PROJECTWING_ROOT="${project}" PROJECTWING_EDGE_ROOT="${edge}" \
  PROJECTWING_DEPLOY_LOCK_FILE="${project}/deployment.lock" PROJECTWING_RECOVERY_TEST_MODE=true \
  PROJECTWING_KEEPALIVED_HEALTH_SCRIPT="${keepalived_script}" PROJECTWING_KEEPALIVED_HEARTBEAT="${heartbeat}" \
  PROJECTWING_RECONCILE_TRANSACTION_ID=102-1 PROJECTWING_RECOVERY_VERIFY_SCRIPT="${tmp}/fail-verify" \
  PROJECTWING_EXPECTED_STATE_B64="$(printf '%s\n' "${old}" | base64 -w0)" \
  PROJECTWING_DESIRED_STATE_B64="$(printf '%s\n' "${new}" | base64 -w0)" bash "${target}" recover
status="$?"
set -e
[[ "${status}" -ne 0 ]]
cmp -s <(printf '%s\n' "${old}") "${edge}/release.json"
grep -Fq '172.19.143.158:18080' "${edge}/config/dynamic/edge-routing.yml"
test -e "${edge}/reconcile.in-progress"

printf 'script_sha256=%064d\nchecked_at=%s\nkeepalived_pid=%s\nkeepalived_start=%s\nbinding=projectwing_edge_health\n' \
  0 "$(date +%s)" "$$" "$(awk '{print $22}' "/proc/$$/stat")" >"${heartbeat}"
set +e
run_node 103-1 recover
status="$?"
set -e
[[ "${status}" -ne 0 ]]
test ! -e "${edge}/recovery/103-1"

write_heartbeat
cat >"${tmp}/no-heartbeat-verify" <<'NO_HEARTBEAT'
#!/usr/bin/env bash
set -Eeuo pipefail
grep -Fq "${PROJECTWING_ACTIVE_GATEWAY}" "${PW_EDGE_ROOT}/config/dynamic/edge-routing.yml"
NO_HEARTBEAT
chmod +x "${tmp}/no-heartbeat-verify"
set +e
PW_HEARTBEAT_ATTEMPTS=1 PW_HEARTBEAT_INTERVAL=0 \
  PROJECTWING_RECOVERY_VERIFY_SCRIPT_OVERRIDE="${tmp}/no-heartbeat-verify" run_node 104-1 recover
status="$?"
set -e
[[ "${status}" -ne 0 ]]
cmp -s <(printf '%s\n' "${old}") "${edge}/release.json"
test -e "${edge}/reconcile.in-progress"

echo 'Edge recovery node tests passed.'
