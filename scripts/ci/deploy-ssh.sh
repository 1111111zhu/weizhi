#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
if [[ -z "${action}" ]]; then
  echo "Usage: deploy-ssh.sh <configure|ssh|scp|fetch> [arguments...]" >&2
  exit 2
fi
shift

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"

if [[ ! "${DEPLOY_HOST}" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  echo "DEPLOY_HOST contains unsupported characters." >&2
  exit 2
fi
if [[ ! "${DEPLOY_USER}" =~ ^[a-z_][a-z0-9_-]*$ ]]; then
  echo "DEPLOY_USER contains unsupported characters." >&2
  exit 2
fi

ssh_dir="${PROJECTWING_DEPLOY_SSH_DIR:-${HOME}/.ssh}"
key_file="${PROJECTWING_DEPLOY_SSH_KEY_FILE:-${ssh_dir}/projectwing_deploy}"
known_hosts_file="${PROJECTWING_DEPLOY_KNOWN_HOSTS_FILE:-${ssh_dir}/projectwing_known_hosts}"
connect_timeout="${PROJECTWING_DEPLOY_SSH_CONNECT_TIMEOUT_SECONDS:-15}"
configure_attempts="${PROJECTWING_DEPLOY_SSH_CONFIGURE_ATTEMPTS:-18}"
configure_delay="${PROJECTWING_DEPLOY_SSH_CONFIGURE_DELAY_SECONDS:-5}"
server_alive_count_max="${PROJECTWING_DEPLOY_SSH_SERVER_ALIVE_COUNT_MAX:-4}"
control_persist_seconds="${PROJECTWING_DEPLOY_SSH_CONTROL_PERSIST_SECONDS:-600}"
ssh_port="${PROJECTWING_DEPLOY_SSH_PORT:-22}"
ssh_command="${PROJECTWING_DEPLOY_SSH_COMMAND:-ssh}"
scp_command="${PROJECTWING_DEPLOY_SCP_COMMAND:-scp}"
ssh_keyscan_command="${PROJECTWING_DEPLOY_SSH_KEYSCAN_COMMAND:-ssh-keyscan}"
pinned_known_hosts="${PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS:-}"
temp_known_hosts=""
temp_scan_errors=""

cleanup() {
  if [[ -n "${temp_known_hosts}" ]]; then
    rm -f -- "${temp_known_hosts}"
  fi
  if [[ -n "${temp_scan_errors}" ]]; then
    rm -f -- "${temp_scan_errors}"
  fi
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

for integer_setting in connect_timeout configure_attempts configure_delay server_alive_count_max control_persist_seconds; do
  value="${!integer_setting}"
  if [[ ! "${value}" =~ ^[1-9][0-9]*$ ]]; then
    echo "${integer_setting} must be a positive integer." >&2
    exit 2
  fi
done
if [[ ! "${ssh_port}" =~ ^[0-9]+$ ]] || ((ssh_port < 1 || ssh_port > 65535)); then
  echo "PROJECTWING_DEPLOY_SSH_PORT must be an integer from 1 through 65535." >&2
  exit 2
fi

# A deployment performs many short SSH and SCP operations against the same two
# hosts. Keep one authenticated transport per host alive for the duration of
# the job so a temporarily saturated sshd does not have to accept a fresh
# handshake for every file and state probe. The job-specific SSH directory is
# hashed into a short /tmp path to avoid Unix-domain socket path limits and to
# prevent concurrent runner jobs from sharing a control socket.
control_token="$(printf '%s' "${ssh_dir}" | sha256sum | cut -d ' ' -f1 | cut -c1-16)"
control_dir="/tmp/projectwing-ssh-${control_token}"
control_path="${control_dir}/%C"
[[ "${control_dir}" =~ ^/tmp/projectwing-ssh-[a-f0-9]{16}$ ]]
mkdir -p "${control_dir}"
chmod 700 "${control_dir}"

common_options=(
  -F /dev/null
  -i "${key_file}"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o PreferredAuthentications=publickey
  -o PasswordAuthentication=no
  -o KbdInteractiveAuthentication=no
  -o NumberOfPasswordPrompts=0
  -o ProxyCommand=none
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=${known_hosts_file}"
  -o GlobalKnownHostsFile=/dev/null
  -o CheckHostIP=yes
  -o "ConnectTimeout=${connect_timeout}"
  -o ConnectionAttempts=1
  -o ServerAliveInterval=15
  -o "ServerAliveCountMax=${server_alive_count_max}"
  -o ForwardAgent=no
  -o ClearAllForwardings=yes
  -o RequestTTY=no
  -o ControlMaster=auto
  -o "ControlPersist=${control_persist_seconds}"
  -o "ControlPath=${control_path}"
)
ssh_options=(-p "${ssh_port}" "${common_options[@]}")
scp_options=(-P "${ssh_port}" "${common_options[@]}")
destination="${DEPLOY_USER}@${DEPLOY_HOST}"

require_key() {
  if [[ ! -s "${key_file}" ]]; then
    echo "Deployment SSH private key is missing or empty: ${key_file}." >&2
    exit 2
  fi
}

require_known_hosts() {
  if [[ ! -s "${known_hosts_file}" ]]; then
    echo "Deployment SSH known-hosts file is missing or empty: ${known_hosts_file}." >&2
    exit 2
  fi
}

verify_direct_openssh_contract() {
  local proxy_command
  proxy_command="$("${ssh_command}" "${ssh_options[@]}" -G "${destination}" 2>/dev/null \
    | sed -n 's/^proxycommand //p' | head -n 1)"
  if [[ -n "${proxy_command}" && "${proxy_command}" != "none" ]]; then
    echo "Deployment SSH unexpectedly selected a proxy command: ${proxy_command}." >&2
    return 1
  fi
}

configure_ssh() {
  local attempt host_key_mismatch_seen=false
  mkdir -p "${ssh_dir}"
  chmod 700 "${ssh_dir}"
  require_key
  chmod 600 "${key_file}"
  verify_direct_openssh_contract

  temp_known_hosts="$(mktemp "${ssh_dir}/projectwing_known_hosts.XXXXXX")"
  temp_scan_errors="$(mktemp "${ssh_dir}/projectwing_keyscan.XXXXXX")"
  for attempt in $(seq 1 "${configure_attempts}"); do
    : >"${temp_known_hosts}"
    : >"${temp_scan_errors}"
    "${ssh_keyscan_command}" -T 5 -p "${ssh_port}" -H "${DEPLOY_HOST}" \
      >"${temp_known_hosts}" 2>"${temp_scan_errors}" || true
    if grep -Fq "NetBird-SSH-Server" "${temp_scan_errors}" \
      || grep -Fq "NetBird-SSH-Server" "${temp_known_hosts}"; then
      echo "Deployment target port ${ssh_port} is still served by NetBird JWT SSH; disable the target peer's SSH Access feature or select a separate system sshd port." >&2
      return 1
    fi
    if [[ -s "${temp_known_hosts}" ]] && ssh-keygen -l -f "${temp_known_hosts}" >/dev/null 2>&1; then
      if [[ -n "${pinned_known_hosts}" ]]; then
        printf '%s\n' "${pinned_known_hosts}" >"${known_hosts_file}"
        chmod 600 "${known_hosts_file}"
        if ! ssh-keygen -l -f "${known_hosts_file}" >/dev/null 2>&1; then
          echo "Pinned deployment SSH known-hosts data is invalid." >&2
          return 1
        fi
        local pinned_fingerprints scanned_fingerprints
        pinned_fingerprints="$(mktemp "${ssh_dir}/projectwing_pinned_fingerprints.XXXXXX")"
        scanned_fingerprints="$(mktemp "${ssh_dir}/projectwing_scanned_fingerprints.XXXXXX")"
        ssh-keygen -lf "${known_hosts_file}" | cut -d ' ' -f2 | sort -u >"${pinned_fingerprints}"
        ssh-keygen -lf "${temp_known_hosts}" | cut -d ' ' -f2 | sort -u >"${scanned_fingerprints}"
        if ! comm -12 "${pinned_fingerprints}" "${scanned_fingerprints}" | grep -q .; then
          rm -f -- "${pinned_fingerprints}" "${scanned_fingerprints}"
          host_key_mismatch_seen=true
          echo "Deployment SSH host key scan did not match pinned data (${attempt}/${configure_attempts}); retrying." >&2
          (( attempt < configure_attempts )) && sleep "${configure_delay}"
          continue
        fi
        rm -f -- "${pinned_fingerprints}" "${scanned_fingerprints}"
      else
        echo "No pinned deployment SSH host key was provided; falling back to one-run trust on first use." >&2
        install -m 600 "${temp_known_hosts}" "${known_hosts_file}"
      fi
      if "${ssh_command}" "${ssh_options[@]}" "${destination}" true </dev/null; then
        echo "Direct batch-mode OpenSSH authentication succeeded over the NetBird tunnel."
        return 0
      fi
    fi
    echo "Waiting for direct deployment SSH authentication (${attempt}/${configure_attempts})..." >&2
    sleep "${configure_delay}"
  done
  if [[ "${host_key_mismatch_seen}" == true ]]; then
    echo "Deployment SSH host key did not match DEPLOY_SSH_KNOWN_HOSTS in any scan." >&2
    return 1
  fi
  echo "Direct deployment SSH authentication did not become ready." >&2
  return 1
}

case "${action}" in
  configure)
    if [[ "$#" -ne 0 ]]; then
      echo "deploy-ssh.sh configure does not accept arguments." >&2
      exit 2
    fi
    configure_ssh
    ;;
  ssh)
    if [[ "$#" -eq 0 ]]; then
      echo "deploy-ssh.sh ssh requires a non-interactive remote command." >&2
      exit 2
    fi
    require_key
    require_known_hosts
    verify_direct_openssh_contract
    exec "${ssh_command}" "${ssh_options[@]}" "${destination}" "$@"
    ;;
  scp)
    if [[ "$#" -ne 2 ]]; then
      echo "Usage: deploy-ssh.sh scp <local-file> <absolute-remote-path>" >&2
      exit 2
    fi
    source_file="$1"
    remote_path="$2"
    if [[ ! -f "${source_file}" ]]; then
      echo "Deployment upload source is not a regular file: ${source_file}." >&2
      exit 2
    fi
    if [[ ! "${remote_path}" =~ ^/opt/projectwing/[A-Za-z0-9._/-]+$ ]] \
      || [[ "${remote_path}" =~ /\.\.?(/|$) ]]; then
      echo "Deployment upload destination is outside /opt/projectwing or contains unsupported characters." >&2
      exit 2
    fi
    require_key
    require_known_hosts
    verify_direct_openssh_contract
    exec "${scp_command}" "${scp_options[@]}" "${source_file}" "${destination}:${remote_path}"
    ;;
  fetch)
    if [[ "$#" -ne 2 ]]; then
      echo "Usage: deploy-ssh.sh fetch <absolute-remote-path> <local-file>" >&2
      exit 2
    fi
    remote_path="$1"
    destination_file="$2"
    if [[ ! "${remote_path}" =~ ^/opt/projectwing/[A-Za-z0-9._/-]+$ ]] \
      || [[ "${remote_path}" =~ /\.\.?(/|$) ]]; then
      echo "Deployment download source is outside /opt/projectwing or contains unsupported characters." >&2
      exit 2
    fi
    if [[ "${destination_file}" != /* ]]; then
      echo "Deployment download destination must be absolute." >&2
      exit 2
    fi
    require_key
    require_known_hosts
    verify_direct_openssh_contract
    exec "${scp_command}" "${scp_options[@]}" "${destination}:${remote_path}" "${destination_file}"
    ;;
  *)
    echo "Unsupported deploy SSH action: ${action}." >&2
    exit 2
    ;;
esac
