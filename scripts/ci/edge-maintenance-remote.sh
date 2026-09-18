#!/usr/bin/env bash

# Sourceable maintenance routing helpers. The caller provides the dual-Edge
# functions and deployment variables from edge-ha-remote.sh.

maintenance_previous_blue_state=''
maintenance_previous_green_state=''
maintenance_previous_active_state=''

edge_ha_verify_maintenance_node() {
  local host="$1" known_hosts="$2"
  remote_ssh "${host}" "${known_hosts}" bash -s <<'REMOTE'
set -Eeuo pipefail
for name in wing emp auth cmp showroom tms intranet ib; do
  domain="${name}.superfx.cn"
  [[ "${name}" == wing ]] && domain=wing.superfx.cn
  body="$(mktemp)"
  trap 'rm -f "${body}"' RETURN
  status="$(curl --noproxy '*' --silent --show-error --insecure \
    --resolve "${domain}:443:127.0.0.1" --output "${body}" --write-out '%{http_code}' \
    "https://${domain}/maintenance-healthz")"
  [[ "${status}" == 503 ]]
  grep -Fq '"code":"DEPLOYMENT_MAINTENANCE"' "${body}"
  rm -f "${body}"
  trap - RETURN
done
REMOTE
}

edge_ha_wait_maintenance_node() {
  local host="$1" known_hosts="$2" attempt
  for attempt in $(seq 1 "${PROJECTWING_MAINTENANCE_VERIFY_ATTEMPTS:-12}"); do
    edge_ha_verify_maintenance_node "${host}" "${known_hosts}" && return 0
    (( attempt < ${PROJECTWING_MAINTENANCE_VERIFY_ATTEMPTS:-12} )) || return 1
    sleep 2
  done
}

edge_ha_assert_maintenance() {
  local blue_state green_state
  blue_state="$(edge_ha_read_node "${blue_host}" "${blue_known_hosts}")"
  green_state="$(edge_ha_read_node "${green_host}" "${green_known_hosts}")"
  [[ "$(edge_ha_canonical_state "${blue_state}")" == "$(edge_ha_canonical_state "${green_state}")" ]]
  jq -e --arg transaction "${release_key}" \
    '.schemaVersion == 4 and .routeMode == "maintenance" and
      .transactionId == $transaction and .pendingReleaseKey == $transaction' \
    <<<"${blue_state}" >/dev/null
}

edge_ha_verify_maintenance_vip() {
  local havip="${PROJECTWING_HAVIP_ADDRESS:?PROJECTWING_HAVIP_ADDRESS is required}"
  remote_ssh "${edge_first_host}" "${edge_first_known_hosts}" \
    "body=\$(mktemp); trap 'rm -f \"\${body}\"' EXIT; status=\$(curl --noproxy '*' --silent --show-error --insecure --resolve 'wing.superfx.cn:443:${havip}' --output \"\${body}\" --write-out '%{http_code}' 'https://wing.superfx.cn/maintenance-healthz'); test \"\${status}\" = 503; grep -Fq '\"code\":\"DEPLOYMENT_MAINTENANCE\"' \"\${body}\""
}

edge_ha_enter_maintenance() {
  maintenance_previous_blue_state="${edge_blue_state}"
  maintenance_previous_green_state="${edge_green_state}"
  maintenance_previous_active_state="${edge_active_state}"
  edge_ha_order_nodes
  edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" prepare false maintenance
  edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" prepare false maintenance
  if ! edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" switch false maintenance \
    || ! edge_ha_wait_maintenance_node "${edge_first_host}" "${edge_first_known_hosts}" \
    || ! edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" switch false maintenance \
    || ! edge_ha_wait_maintenance_node "${edge_second_host}" "${edge_second_known_hosts}" \
    || ! edge_ha_verify_maintenance_vip \
    || ! edge_ha_node "${edge_first_host}" "${edge_first_known_hosts}" commit false maintenance \
    || ! edge_ha_node "${edge_second_host}" "${edge_second_known_hosts}" commit false maintenance \
    || ! edge_ha_assert_maintenance; then
    edge_ha_rollback_both || return 2
    return 1
  fi
  edge_ha_resolve_state
}

edge_ha_exit_maintenance() {
  edge_blue_state="${maintenance_previous_blue_state}"
  edge_green_state="${maintenance_previous_green_state}"
  edge_active_state="${maintenance_previous_active_state}"
  edge_ha_rollback_both
  edge_ha_wait_verify_node "${blue_host}" "${blue_known_hosts}"
  edge_ha_wait_verify_node "${green_host}" "${green_known_hosts}"
  edge_ha_resolve_state
}
