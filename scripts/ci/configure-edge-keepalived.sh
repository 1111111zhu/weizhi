#!/usr/bin/env bash
set -Eeuo pipefail

template="${PROJECTWING_KEEPALIVED_TEMPLATE:?PROJECTWING_KEEPALIVED_TEMPLATE is required}"
health_source="${PROJECTWING_EDGE_HEALTH_SOURCE:?PROJECTWING_EDGE_HEALTH_SOURCE is required}"
source_ip="${PROJECTWING_KEEPALIVED_SOURCE_IP:?PROJECTWING_KEEPALIVED_SOURCE_IP is required}"
peer_ip="${PROJECTWING_KEEPALIVED_PEER_IP:?PROJECTWING_KEEPALIVED_PEER_IP is required}"
havip="${PROJECTWING_HAVIP_ADDRESS:?PROJECTWING_HAVIP_ADDRESS is required}"
state="${PROJECTWING_KEEPALIVED_STATE:?PROJECTWING_KEEPALIVED_STATE is required}"
priority="${PROJECTWING_KEEPALIVED_PRIORITY:?PROJECTWING_KEEPALIVED_PRIORITY is required}"
auth_pass="${PROJECTWING_KEEPALIVED_AUTH_PASS:?PROJECTWING_KEEPALIVED_AUTH_PASS is required}"
interface="${PROJECTWING_KEEPALIVED_INTERFACE:-}"
health_target="/usr/local/libexec/projectwing/edge-ha-health.sh"
config_target="/etc/keepalived/keepalived.conf"
marker_target="/opt/projectwing/edge/keepalived.env"

fail() {
  echo "configure-edge-keepalived: $*" >&2
  exit 1
}

validate() {
  [[ "${EUID}" == 0 ]] || fail 'must run as root'
  [[ "${source_ip}" =~ ^172\.19\.143\.(157|158)$ ]] || fail 'source IP is not an approved Edge address'
  [[ "${peer_ip}" =~ ^172\.19\.143\.(157|158)$ && "${peer_ip}" != "${source_ip}" ]] || fail 'peer IP is invalid'
  [[ "${havip}" =~ ^172\.19\.143\.[0-9]{1,3}$ && "${havip}" != "${source_ip}" && "${havip}" != "${peer_ip}" ]] || fail 'HaVip is invalid'
  [[ "${state}" == MASTER || "${state}" == BACKUP ]] || fail 'state must be MASTER or BACKUP'
  [[ "${priority}" =~ ^[1-9][0-9]{1,2}$ && "${priority}" -le 254 ]] || fail 'priority must be 10..254'
  [[ "${auth_pass}" =~ ^[A-Za-z0-9]{8}$ ]] || fail 'auth pass must be exactly 8 alphanumeric characters'
  test -r "${template}" || fail "template is unreadable: ${template}"
  test -x "${health_source}" || fail "health script is not executable: ${health_source}"
}

resolve_interface() {
  if [[ -z "${interface}" ]]; then
    interface="$(ip -4 route get "${peer_ip}" | awk 'NR == 1 { for (i=1; i<=NF; i++) if ($i == "dev") { print $(i+1); exit } }')"
  fi
  [[ "${interface}" =~ ^[A-Za-z0-9_.:-]+$ ]] || fail 'could not resolve a safe private interface'
  ip -4 address show dev "${interface}" | grep -F " ${source_ip}/" >/dev/null || fail 'source IP is absent from the selected interface'
}

install_keepalived() {
  if command -v keepalived >/dev/null; then
    return
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends keepalived
}

configure_swap_policy() {
  local minimum_kib="${PROJECTWING_MIN_SWAP_KIB:-4194304}" target temporary total_kib
  target=/etc/sysctl.d/99-projectwing-swap.conf
  [[ "${minimum_kib}" =~ ^[1-9][0-9]*$ ]] || fail 'minimum swap must be a positive KiB value'
  total_kib="$(awk 'NR > 1 { total += $3 } END { print total + 0 }' /proc/swaps)"
  (( total_kib >= minimum_kib )) || fail 'active swap is below the 4 GiB host baseline'
  temporary="$(mktemp /etc/sysctl.d/.projectwing-swap.XXXXXX)"
  trap 'rm -f "${temporary}"' RETURN
  printf 'vm.swappiness=10\n' > "${temporary}"
  chmod 644 "${temporary}"
  mv -f "${temporary}" "${target}"
  sysctl -w vm.swappiness=10 >/dev/null
  trap - RETURN
}

render_config() {
  local temporary
  install -d -o root -g root -m 755 /usr/local/libexec/projectwing /etc/keepalived
  install -o root -g root -m 755 "${health_source}" "${health_target}"
  temporary="$(mktemp /etc/keepalived/.projectwing.XXXXXX)"
  trap 'rm -f "${temporary}"' RETURN
  sed \
    -e "s|__KEEPALIVED_TRACK_SCRIPT__|${health_target}|g" \
    -e 's|__KEEPALIVED_CHECK_INTERVAL__|2|g' \
    -e 's|__KEEPALIVED_CHECK_TIMEOUT__|3|g' \
    -e 's|__KEEPALIVED_CHECK_FALL__|2|g' \
    -e 's|__KEEPALIVED_CHECK_RISE__|3|g' \
    -e 's|__KEEPALIVED_CHECK_WEIGHT__|0|g' \
    -e "s|__KEEPALIVED_STATE__|${state}|g" \
    -e "s|__KEEPALIVED_INTERFACE__|${interface}|g" \
    -e 's|__KEEPALIVED_ROUTER_ID__|73|g' \
    -e "s|__KEEPALIVED_PRIORITY__|${priority}|g" \
    -e 's|__KEEPALIVED_ADVERT_INT__|1|g' \
    -e "s|__KEEPALIVED_AUTH_PASS__|${auth_pass}|g" \
    -e "s|__KEEPALIVED_SOURCE_IP__|${source_ip}|g" \
    -e "s|__KEEPALIVED_PEER_IP__|${peer_ip}|g" \
    -e "s|__PROJECTWING_HAVIP__|${havip}|g" \
    "${template}" > "${temporary}"
  if grep -q '__[A-Z0-9_]\+__' "${temporary}"; then
    fail 'rendered Keepalived config contains unresolved placeholders'
  fi
  keepalived --config-test --use-file="${temporary}"
  install -m 600 "${temporary}" "${config_target}"
  trap - RETURN
}

write_runtime_marker() {
  local temporary
  install -d -o root -g root -m 755 "$(dirname "${marker_target}")"
  temporary="$(mktemp "${marker_target}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  printf 'PROJECTWING_HAVIP_ADDRESS=%s\n' "${havip}" > "${temporary}"
  chmod 644 "${temporary}"
  mv -f "${temporary}" "${marker_target}"
  trap - RETURN
}

activate() {
  systemctl enable keepalived.service
  systemctl restart keepalived.service
  systemctl is-active --quiet keepalived.service || fail 'keepalived.service did not become active'
  ip -4 -o address show dev "${interface}"
}

validate
resolve_interface
configure_swap_policy
install_keepalived
render_config
write_runtime_marker
activate
