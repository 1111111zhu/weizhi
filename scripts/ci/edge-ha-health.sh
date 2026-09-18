#!/usr/bin/env bash
set -Eeuo pipefail

edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
keepalived_runtime_dir="${PROJECTWING_KEEPALIVED_RUNTIME_DIR:-/run/projectwing}"
keepalived_heartbeat="${PROJECTWING_KEEPALIVED_HEARTBEAT:-${keepalived_runtime_dir}/edge-ha-health.status}"

fail() {
  echo "edge-ha-health: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null || fail "required command is missing: $1"
}

container_id() {
  docker ps -q \
    --filter label=com.docker.compose.project=projectwing-edge \
    --filter label=com.docker.compose.service=reverse-proxy | head -n 1
}

check_docker() {
  systemctl is-active --quiet docker.service || fail 'docker.service is not active'
}

check_recovery_marker() {
  if [[ -e "${edge_root}/reconcile.in-progress" \
    && "${PROJECTWING_ALLOW_EDGE_RECONCILE_MARKER:-false}" != true ]]; then
    fail 'Edge reconciliation is still in progress'
  fi
}

check_keepalived_binding() {
  (( EUID == 0 )) || return 0
  awk '
    function delta(value, opened, closed, copy) {
      copy=value; opened=gsub(/{/, "", copy)
      copy=value; closed=gsub(/}/, "", copy)
      return opened-closed
    }
    !in_health && $1=="vrrp_script" && $2=="projectwing_edge_health" {
      health_blocks++; in_health=1; health_depth=0
    }
    in_health && $1=="script" && $2=="\"/usr/local/libexec/projectwing/edge-ha-health.sh\"" { health_paths++ }
    in_health { health_depth+=delta($0); if (health_depth==0) in_health=0 }
    !in_instance && $1=="vrrp_instance" && $2=="PROJECTWING_EDGE" {
      instance_blocks++; in_instance=1; instance_depth=0
    }
    in_instance && !in_track && $1=="track_script" { track_blocks++; in_track=1; track_depth=0 }
    in_track && $1=="projectwing_edge_health" { track_refs++ }
    in_track { track_depth+=delta($0); if (track_depth==0) in_track=0 }
    in_instance { instance_depth+=delta($0); if (instance_depth==0) in_instance=0 }
    END { exit !(health_blocks==1 && health_paths==1 && instance_blocks==1 && track_blocks==1 && track_refs==1) }
  ' /etc/keepalived/keepalived.conf || fail 'Keepalived does not track the installed ProjectWing health script'
}

check_traefik() {
  local id="$1" snapshot
  snapshot="$(docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{json (index .NetworkSettings.Ports "443/tcp")}}' "${id}")"
  [[ "${snapshot}" == running\|healthy\|* ]] || fail "Edge container is not running and healthy: ${snapshot}"
  [[ "${snapshot}" == *'"HostPort":"443"'* ]] || fail 'Traefik does not publish TCP 443'
}

record_keepalived_heartbeat() {
  local caller_comm caller_start checked_at script_sha temporary
  (( EUID == 0 )) || return 0
  caller_comm="$(cat "/proc/${PPID}/comm" 2>/dev/null || true)"
  [[ "${caller_comm}" == keepalived* ]] || return 0
  caller_start="$(awk '{print $22}' "/proc/${PPID}/stat" 2>/dev/null || true)"
  [[ "${caller_start}" =~ ^[0-9]+$ ]] || return 0
  checked_at="$(date +%s)"
  script_sha="$(sha256sum "${BASH_SOURCE[0]}" | awk '{print $1}')"
  install -d -o root -g root -m 755 "${keepalived_runtime_dir}"
  [[ ! -L "${keepalived_heartbeat}" ]] || fail 'Keepalived heartbeat is a symbolic link'
  temporary="$(mktemp "${keepalived_heartbeat}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  printf 'script_sha256=%s\nchecked_at=%s\nkeepalived_pid=%s\nkeepalived_start=%s\nbinding=projectwing_edge_health\n' \
    "${script_sha}" "${checked_at}" "${PPID}" "${caller_start}" >"${temporary}"
  chmod 644 "${temporary}"
  mv -f "${temporary}" "${keepalived_heartbeat}"
  trap - RETURN
}

main() {
  local id
  require_command systemctl
  require_command docker
  test -d "${edge_root}" || fail "Edge root does not exist: ${edge_root}"
  check_recovery_marker
  check_keepalived_binding
  check_docker
  id="$(container_id)"
  [[ -n "${id}" ]] || fail 'projectwing-edge reverse-proxy container is absent'
  check_traefik "${id}"
  record_keepalived_heartbeat
  printf 'edge_health=ok\ncontainer=%s\n' "${id}"
}

main "$@"
