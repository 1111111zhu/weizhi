#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
resolver="${repo_root}/scripts/ci/resolve-edge-runtime-secrets.sh"
fixture_root="$(mktemp -d)"
trap 'rm -rf "${fixture_root}"' EXIT
mkdir -p "${fixture_root}/bin" "${fixture_root}/ssh"

cat > "${fixture_root}/bin/deploy-ssh" <<'FAKE_SSH'
#!/usr/bin/env bash
set -Eeuo pipefail
color=blue
[[ "${DEPLOY_HOST}" == 100.113.0.2 ]] && color=green
state_dir="${PW_FAKE_STATE_DIR:?}"
flag_name="PW_FAKE_UNREACHABLE_${color^^}"
[[ -z "${!flag_name:-}" ]] || exit 40
action="${1:-}"
shift
case "${action}" in
  configure) exit 0 ;;
  ssh)
    command="${1:-}"
    if [[ "${command}" == *release.json* ]]; then
      state_name="PW_FAKE_STATE_${color^^}"
      state="${!state_name:-}"
      [[ -n "${state}" ]] || exit 41
      printf '%s\n' "${state}"
      exit 0
    fi
    if [[ "${command}" == *REMOTE_FILE=* ]]; then
      remote_file="$(sed -n "s/.*REMOTE_FILE='\\([^']*\\)'.*/\\1/p" <<< "${command}")"
      persistent="$(sed -n "s/.*PERSISTENT_ONLY='\\([^']*\\)'.*/\\1/p" <<< "${command}")"
      remote_script="$(cat)"
      [[ "${remote_script}" == *'label=com.docker.compose.service=api'* ]] || exit 46
      [[ -n "${remote_file}" ]] || exit 42
      if [[ "${persistent}" == true ]]; then
        database='postgres://persistent.example/projectwing'
        secret='persistent-secret'
      else
        database='postgres://running.example/projectwing'
        secret='running-secret'
      fi
      umask 077
      printf 'DATABASE_URL_B64=%s\nBETTER_AUTH_SECRET_B64=%s\n' \
        "$(printf '%s' "${database}" | base64 | tr -d '\n')" \
        "$(printf '%s' "${secret}" | base64 | tr -d '\n')" > "${state_dir}/${color}.remote"
      chmod 600 "${state_dir}/${color}.remote"
      exit 0
    fi
    if [[ "${command}" == rm\ -f* ]]; then
      rm -f "${state_dir}/${color}.remote"
      exit 0
    fi
    exit 43
    ;;
  fetch)
    remote_path="${1:?}"; local_path="${2:?}"
    [[ "${remote_path}" == /opt/projectwing/inherited-runtime-* ]] || exit 44
    cp "${state_dir}/${color}.remote" "${local_path}"
    chmod 600 "${local_path}"
    ;;
  *) exit 45 ;;
esac
FAKE_SSH
chmod +x "${fixture_root}/bin/deploy-ssh"

run_case() {
  local name="$1"; shift
  local state_dir="${fixture_root}/${name}" output="${fixture_root}/${name}/result.env" stdout="${fixture_root}/${name}/stdout"
  mkdir -p "${state_dir}"
  : > "${stdout}"
  set +e
  env PATH="${PATH}" PW_FAKE_STATE_DIR="${state_dir}" \
    PROJECTWING_DEPLOY_SSH_HELPER="${fixture_root}/bin/deploy-ssh" PROJECTWING_DEPLOY_SSH_DIR="${fixture_root}/ssh" \
    PROJECTWING_BLUE_NETBIRD_HOST=100.113.0.1 PROJECTWING_GREEN_NETBIRD_HOST=100.113.0.2 \
    PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS=blue PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS=green \
    PROJECTWING_RUNTIME_SECRETS_OUTPUT_FILE="${output}" RUNNER_TEMP="${state_dir}" GITHUB_RUN_ID=123 GITHUB_RUN_ATTEMPT=1 \
    PROJECTWING_STATE_ROOT="${state_dir}" "$@" "${resolver}" >"${stdout}"
  status=$?
  set -e
  printf '%s\n' "${status}" > "${state_dir}/status"
}

state='{"schemaVersion":2,"activeColor":"blue","activeGateway":"http://172.19.143.157:18080","releaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1","version":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
run_case both PW_FAKE_STATE_BLUE="${state}" PW_FAKE_STATE_GREEN="${state}"
[[ "$(cat "${fixture_root}/both/status")" == 0 ]]
grep -Fxq 'DATABASE_URL=postgres://running.example/projectwing' "${fixture_root}/both/result.env"
grep -Fxq 'BETTER_AUTH_SECRET=running-secret' "${fixture_root}/both/result.env"
[[ "$(stat -c '%a' "${fixture_root}/both/result.env")" == 600 ]]
! grep -q 'secret\|postgres' "${fixture_root}/both/stdout"
[[ ! -e "${fixture_root}/both/blue.remote" && ! -e "${fixture_root}/both/green.remote" ]]

run_case blue-down PW_FAKE_STATE_GREEN="${state}" PW_FAKE_UNREACHABLE_BLUE=1
[[ "$(cat "${fixture_root}/blue-down/status")" == 0 ]]
grep -Fxq 'PROJECTWING_SINGLE_HOST_COLOR=green' "${fixture_root}/blue-down/stdout"
grep -Fxq 'DATABASE_URL=postgres://persistent.example/projectwing' "${fixture_root}/blue-down/result.env"
[[ ! -e "${fixture_root}/blue-down/green.remote" ]]

green_state='{"schemaVersion":2,"activeColor":"green","activeGateway":"http://172.19.143.158:18080","releaseKey":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1","version":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'
run_case green-down PW_FAKE_STATE_BLUE="${green_state}" PW_FAKE_UNREACHABLE_GREEN=1
[[ "$(cat "${fixture_root}/green-down/status")" == 0 ]]
grep -Fxq 'PROJECTWING_SINGLE_HOST_COLOR=blue' "${fixture_root}/green-down/stdout"
grep -Fxq 'DATABASE_URL=postgres://persistent.example/projectwing' "${fixture_root}/green-down/result.env"

state_v4='{"schemaVersion":4,"activeColor":"blue","activeGateway":"http://172.19.143.157:18080","releaseKey":"dddddddddddddddddddddddddddddddddddddddd-4-1","version":"dddddddddddddddddddddddddddddddddddddddd","sourceCommitSha":"dddddddddddddddddddddddddddddddddddddddd","imageSourceSha":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buildRunId":123,"buildRunAttempt":1,"deployRunId":456,"deployRunAttempt":1,"generation":4,"degraded":false,"routeMode":"serving"}'
run_case schema-v4 PW_FAKE_STATE_BLUE="${state_v4}" PW_FAKE_STATE_GREEN="${state_v4}"
[[ "$(cat "${fixture_root}/schema-v4/status")" == 0 ]]
grep -Fxq 'DATABASE_URL=postgres://running.example/projectwing' "${fixture_root}/schema-v4/result.env"
grep -Fxq 'BETTER_AUTH_SECRET=running-secret' "${fixture_root}/schema-v4/result.env"

transactional_state='{"schemaVersion":4,"activeColor":"blue","activeGateway":"http://172.19.143.157:18080","releaseKey":"dddddddddddddddddddddddddddddddddddddddd-4-1","version":"dddddddddddddddddddddddddddddddddddddddd","sourceCommitSha":"dddddddddddddddddddddddddddddddddddddddd","imageSourceSha":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","buildRunId":123,"buildRunAttempt":1,"deployRunId":456,"deployRunAttempt":1,"generation":4,"degraded":false,"routeMode":"maintenance","transactionId":"dddddddddddddddddddddddddddddddddddddddd-5-1","pendingReleaseKey":"dddddddddddddddddddddddddddddddddddddddd-5-1","pendingSourceCommitSha":"dddddddddddddddddddddddddddddddddddddddd","pendingImageSourceSha":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}'
run_case transactional-mismatch PW_FAKE_STATE_BLUE="${state_v4}" PW_FAKE_STATE_GREEN="${transactional_state}"
[[ "$(cat "${fixture_root}/transactional-mismatch/status")" != 0 ]]
[[ ! -e "${fixture_root}/transactional-mismatch/result.env" ]]

mismatch='{"schemaVersion":2,"activeColor":"green","activeGateway":"http://172.19.143.158:18080","releaseKey":"cccccccccccccccccccccccccccccccccccccccc-3-1","version":"cccccccccccccccccccccccccccccccccccccccc"}'
run_case mismatch PW_FAKE_STATE_BLUE="${state}" PW_FAKE_STATE_GREEN="${mismatch}"
[[ "$(cat "${fixture_root}/mismatch/status")" != 0 ]]
[[ ! -e "${fixture_root}/mismatch/result.env" ]]
! grep -q 'secret\|postgres' "${fixture_root}/mismatch/stdout"

run_case invalid-path PW_FAKE_STATE_BLUE="${state}" PROJECTWING_EDGE_ROOT=/tmp/projectwing-edge
[[ "$(cat "${fixture_root}/invalid-path/status")" != 0 ]]
[[ ! -e "${fixture_root}/invalid-path/result.env" ]]

echo 'Edge runtime secret resolution tests passed.'
