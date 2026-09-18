#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ssh_helper="${PROJECTWING_DEPLOY_SSH_HELPER:-${root_dir}/scripts/ci/deploy-ssh.sh}"
deploy_user="${PROJECTWING_DEPLOY_USER:-ops}"
ssh_dir="${PROJECTWING_DEPLOY_SSH_DIR:?PROJECTWING_DEPLOY_SSH_DIR is required}"
output_file="${PROJECTWING_RUNTIME_SECRETS_OUTPUT_FILE:-${RUNNER_TEMP:-/tmp}/projectwing-runtime-secrets.env}"
edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
remote_root="/opt/projectwing"
session_suffix="${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
remote_file="${remote_root}/inherited-runtime-${session_suffix}.env"
local_tmp=""
remote_created=0
source_color=""
declare -A edge_state=()
declare -A edge_canonical_state=()
declare -A edge_reachable=()

[[ -x "${ssh_helper}" ]] || { echo 'deploy-ssh.sh is missing or not executable.' >&2; exit 2; }
[[ "${output_file}" == /* && "${output_file}" != *$'\n'* ]] || { echo 'Runtime secrets output path must be absolute.' >&2; exit 2; }
[[ "${edge_root}" =~ ^/opt/projectwing/[A-Za-z0-9._/-]+$ && ! "${edge_root}" =~ /\.\.?(/|$) ]] || { echo 'Edge release path is outside /opt/projectwing.' >&2; exit 2; }
[[ "${session_suffix}" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Deployment session suffix contains unsupported characters.' >&2; exit 2; }

host_for_color() {
  case "$1" in
    blue) printf '%s\n' "${PROJECTWING_BLUE_NETBIRD_HOST:?PROJECTWING_BLUE_NETBIRD_HOST is required}" ;;
    green) printf '%s\n' "${PROJECTWING_GREEN_NETBIRD_HOST:?PROJECTWING_GREEN_NETBIRD_HOST is required}" ;;
    *) return 2 ;;
  esac
}

known_hosts_for_color() {
  case "$1" in
    blue) printf '%s\n' "${PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS:?PROJECTWING_BLUE_NETBIRD_SSH_KNOWN_HOSTS is required}" ;;
    green) printf '%s\n' "${PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS:?PROJECTWING_GREEN_NETBIRD_SSH_KNOWN_HOSTS is required}" ;;
    *) return 2 ;;
  esac
}

validate_host() { [[ "$1" =~ ^100\.113\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; }

remote_env() {
  local color="$1" host known_hosts
  shift
  host="$(host_for_color "${color}")"
  known_hosts="$(known_hosts_for_color "${color}")"
  validate_host "${host}" || { echo "${color} host is not a NetBird IPv4 address." >&2; return 2; }
  DEPLOY_HOST="${host}" DEPLOY_USER="${deploy_user}" PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${known_hosts}" PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE="${ssh_dir}/known-hosts-${host}" PROJECTWING_DEPLOY_SSH_DIR="${ssh_dir}" "$@"
}

configure_edge() { remote_env "$1" timeout --foreground "${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-120}" bash "${ssh_helper}" configure >/dev/null 2>&1; }
remote_ssh() { local color="$1"; shift; remote_env "${color}" timeout --foreground "${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-120}" bash "${ssh_helper}" ssh "$@"; }
remote_fetch() { local color="$1" remote_path="$2" local_path="$3"; remote_env "${color}" timeout --foreground "${PROJECTWING_REMOTE_SCP_TIMEOUT_SECONDS:-120}" bash "${ssh_helper}" fetch "${remote_path}" "${local_path}"; }

cleanup() {
  local status="$?"
  trap - EXIT
  if [[ "${remote_created}" == 1 && -n "${source_color}" ]]; then remote_ssh "${source_color}" "rm -f -- '${remote_file}'" >/dev/null 2>&1 || true; fi
  [[ -z "${local_tmp}" ]] || rm -f -- "${local_tmp}"
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

read_edge_state() {
  local color="$1" raw canonical
  configure_edge "${color}" || return 1
  raw="$(remote_ssh "${color}" "cat '${edge_root}/release.json'")" || return 1
  canonical="$(jq -ceS '
    if type == "object" and (.schemaVersion == 2 or .schemaVersion == 3 or .schemaVersion == 4) and
      (.activeColor == "blue" or .activeColor == "green") and
      (.activeGateway == "http://172.19.143.157:18080" or .activeGateway == "http://172.19.143.158:18080") and
      (.releaseKey | type == "string" and test("^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$")) and
      (.version | type == "string" and test("^[a-f0-9]{40}$")) and
      ((.generation // 0) | type == "number" and . >= 0 and floor == .) and
      ((.degraded // false) | type == "boolean") and
      (if .schemaVersion == 4 then
        (.sourceCommitSha | type == "string" and test("^[a-f0-9]{40}$")) and
        (.imageSourceSha | type == "string" and test("^[a-f0-9]{40}$")) and
        ((.buildRunId // 0) | type == "number") and
        ((.buildRunAttempt // 0) | type == "number") and
        ((.deployRunId // 0) | type == "number") and
        ((.deployRunAttempt // 0) | type == "number") and
        ((.routeMode // "serving") == "serving" or .routeMode == "maintenance")
      else true end)
    then {schemaVersion,activeColor,activeGateway,releaseKey,version,
      generation:(.generation//0),degraded:(.degraded//false),previousColor:(.previousColor//null),
      previousGateway:(.previousGateway//null),previousReleaseKey:(.previousReleaseKey//null),
      previousVersion:(.previousVersion//null),previousGeneration:(.previousGeneration//null),
      sourceCommitSha:(.sourceCommitSha//.version),imageSourceSha:(.imageSourceSha//null),
      buildRunId:(.buildRunId//0),buildRunAttempt:(.buildRunAttempt//0),deployRunId:(.deployRunId//0),
      deployRunAttempt:(.deployRunAttempt//0),routeMode:(.routeMode//"serving"),
      transactionId:(.transactionId//null),pendingReleaseKey:(.pendingReleaseKey//null),
      pendingSourceCommitSha:(.pendingSourceCommitSha//null),pendingImageSourceSha:(.pendingImageSourceSha//null)}
    else error("invalid edge state") end
  ' <<< "${raw}")" || return 1
  edge_state["${color}"]="${raw}"
  edge_canonical_state["${color}"]="${canonical}"
  edge_reachable["${color}"]=1
}

read_canonical_states() {
  local color
  for color in blue green; do read_edge_state "${color}" || true; done
  [[ -n "${edge_reachable[blue]:-}" || -n "${edge_reachable[green]:-}" ]] || { echo 'Neither Edge state is reachable.' >&2; return 1; }
  if [[ -n "${edge_reachable[blue]:-}" && -n "${edge_reachable[green]:-}" ]] && [[ "${edge_canonical_state[blue]}" != "${edge_canonical_state[green]}" ]]; then
    echo 'Blue and Green Edge states disagree; refusing runtime secret resolution.' >&2
    return 1
  fi
}

active_color_from_state() {
  local color
  for color in blue green; do
    if [[ -n "${edge_reachable[${color}]:-}" ]]; then jq -er '.activeColor' <<< "${edge_state[${color}]}"; return 0; fi
  done
  return 1
}

create_remote_secret_file() {
  local color="$1" persistent_only="$2" expected_release
  expected_release="$(jq -er '.releaseKey' <<< "${edge_active_state}")"
  source_color="${color}"
  remote_created=1
  remote_ssh "${color}" "REMOTE_FILE='${remote_file}' EXPECTED_COLOR='${color}' EXPECTED_RELEASE_KEY='${expected_release}' PERSISTENT_ONLY='${persistent_only}' bash -s" <<'REMOTE'
set -Eeuo pipefail
umask 077
remote_file="${REMOTE_FILE}"
expected_color="${EXPECTED_COLOR}"
expected_release_key="${EXPECTED_RELEASE_KEY}"
persistent_only="${PERSISTENT_ONLY}"
environment=""
[[ "${expected_release_key}" =~ ^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$ ]]
if [[ "${persistent_only}" != true ]]; then
  container="$(docker ps -q --filter "label=com.docker.compose.project=projectwing-${expected_color}" --filter "label=com.docker.compose.service=api" --filter status=running | head -n 1)"
  if [[ -n "${container}" ]]; then environment="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${container}")"; fi
fi
if [[ -z "${environment}" ]]; then
  release_root="${REMOTE_ROOT:-/opt/projectwing}/releases"
  source_file="${release_root}/${expected_release_key}/secrets/projectwing.env"
  [[ -f "${source_file}" && -r "${source_file}" && ! -L "${source_file}" ]] \
    || { echo 'The committed ProjectWing runtime environment is unavailable.' >&2; exit 1; }
  environment="$(cat "${source_file}")"
fi
database_url="$(printf '%s\n' "${environment}" | sed -n 's/^DATABASE_URL=//p' | head -n 1)"
better_auth_secret="$(printf '%s\n' "${environment}" | sed -n 's/^BETTER_AUTH_SECRET=//p' | head -n 1)"
[[ -n "${database_url}" && -n "${better_auth_secret}" ]] || { echo 'Required ProjectWing runtime values are missing.' >&2; exit 1; }
[[ "${database_url}" != *$'\n'* && "${better_auth_secret}" != *$'\n'* ]] || { echo 'Runtime values contain unsupported newlines.' >&2; exit 1; }
database_url_b64="$(printf '%s' "${database_url}" | base64 | tr -d '\n')"
better_auth_secret_b64="$(printf '%s' "${better_auth_secret}" | base64 | tr -d '\n')"
install -m 600 /dev/null "${remote_file}"
printf 'DATABASE_URL_B64=%s\nBETTER_AUTH_SECRET_B64=%s\n' "${database_url_b64}" "${better_auth_secret_b64}" > "${remote_file}"
chmod 600 "${remote_file}"
REMOTE
  remote_created=1
}

decode_remote_secret_file() {
  local value database_url better_auth_secret temporary_output
  [[ -f "${local_tmp}" && ! -L "${local_tmp}" ]] || return 1
  [[ "$(grep -c '^DATABASE_URL_B64=' "${local_tmp}")" == 1 && "$(grep -c '^BETTER_AUTH_SECRET_B64=' "${local_tmp}")" == 1 ]] || return 1
  if grep -qEv '^(DATABASE_URL_B64|BETTER_AUTH_SECRET_B64)=[A-Za-z0-9+/=]+$' "${local_tmp}"; then echo 'Remote runtime secret file contains an unexpected field.' >&2; return 1; fi
  value="$(sed -n 's/^DATABASE_URL_B64=//p' "${local_tmp}")"; database_url="$(printf '%s' "${value}" | base64 -d)" || return 1
  value="$(sed -n 's/^BETTER_AUTH_SECRET_B64=//p' "${local_tmp}")"; better_auth_secret="$(printf '%s' "${value}" | base64 -d)" || return 1
  [[ -n "${database_url}" && -n "${better_auth_secret}" && "${database_url}" != *$'\n'* && "${better_auth_secret}" != *$'\n'* ]] || return 1
  mkdir -p "$(dirname "${output_file}")"; chmod 700 "$(dirname "${output_file}")"
  temporary_output="$(mktemp "$(dirname "${output_file}")/.runtime-secrets.XXXXXX")"; chmod 600 "${temporary_output}"
  printf 'DATABASE_URL=%q\nBETTER_AUTH_SECRET=%q\n' "${database_url}" "${better_auth_secret}" > "${temporary_output}"; chmod 600 "${temporary_output}"; mv -f "${temporary_output}" "${output_file}"
  local_tmp=""
}

mkdir -p "$(dirname "${output_file}")"
chmod 700 "$(dirname "${output_file}")"
read_canonical_states
edge_active_state="${edge_state[blue]:-${edge_state[green]}}"
active_color="$(active_color_from_state)"
if [[ -n "${edge_reachable[${active_color}]:-}" ]]; then
  create_remote_secret_file "${active_color}" false || {
    echo 'The active Edge is reachable but could not provide its committed runtime secrets; refusing an ambiguous fallback.' >&2
    exit 1
  }
fi
if [[ "${remote_created}" == 0 ]]; then
  fallback_color="green"; [[ "${active_color}" == green ]] && fallback_color="blue"
  [[ -n "${edge_reachable[${fallback_color}]:-}" ]] || { echo 'The active Edge is unavailable and no alternate Edge can provide runtime secrets.' >&2; exit 1; }
  create_remote_secret_file "${fallback_color}" true
  printf 'PROJECTWING_SINGLE_HOST_COLOR=%s\n' "${fallback_color}"
fi
local_tmp="$(mktemp "$(dirname "${output_file}")/.runtime-fetch.XXXXXX")"; chmod 600 "${local_tmp}"
remote_fetch "${source_color}" "${remote_file}" "${local_tmp}"
chmod 600 "${local_tmp}"
decode_remote_secret_file
printf 'PROJECTWING_RUNTIME_SECRETS_FILE=%s\n' "${output_file}"
