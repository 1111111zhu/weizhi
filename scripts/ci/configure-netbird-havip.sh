#!/usr/bin/env bash
set -Eeuo pipefail

network_description="${PROJECTWING_NETBIRD_NETWORK_DESCRIPTION:-}"
management_url="${NETBIRD_MANAGEMENT_URL:-https://netbird.superfx.cn}"
token_file="${NETBIRD_API_TOKEN_FILE:?NETBIRD_API_TOKEN_FILE is required}"
havip="${PROJECTWING_HAVIP_ADDRESS:?PROJECTWING_HAVIP_ADDRESS is required}"
network_name="${PROJECTWING_NETBIRD_NETWORK_NAME:-ProjectWing Development Edge}"
resource_name="${PROJECTWING_NETBIRD_RESOURCE_NAME:-ProjectWing Edge HaVip}"
router_name="${PROJECTWING_NETBIRD_ROUTER_NAME:-ProjectWing Edge Router}"
resource_group_name="${PROJECTWING_NETBIRD_RESOURCE_GROUP_NAME:-All}"
peer_group_name="${PROJECTWING_NETBIRD_PEER_GROUP_NAME:-Development Server}"
resource_description="${PROJECTWING_NETBIRD_RESOURCE_DESCRIPTION:-}"
api_base=''
token=''

fail() {
  echo "configure-netbird-havip: $*" >&2
  exit 1
}

validate_name() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._[:space:]-]{0,127}$ ]] || fail "invalid name: $2"
}

validate_ipv4() {
  local octet
  local -a octets=()
  [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail 'HaVip must be an IPv4 address'
  IFS=. read -r -a octets <<< "$1"
  for octet in "${octets[@]}"; do
    (( 10#${octet} <= 255 )) || fail 'HaVip contains an invalid IPv4 octet'
  done
}

validate_inputs() {
  command -v curl >/dev/null || fail 'curl is required'
  command -v jq >/dev/null || fail 'jq is required'
  if [[ ! "$management_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?(/api)?/?$ ]] \
    && [[ ! "$management_url" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+(/api)?/?$ ]]; then
    fail 'management URL must use HTTPS or fixture-local HTTP'
  fi
  [[ -f "$token_file" && ! -L "$token_file" ]] || fail 'API token file must be a regular file'
  [[ "$(stat -c '%a' "$token_file")" == 600 ]] || fail 'API token file must have mode 0600'
  token="$(<"$token_file")"
  [[ -n "$token" && "$token" != *[[:space:]]* ]] || fail 'API token file is empty or contains whitespace'
  validate_ipv4 "$havip"
  [[ "$havip" =~ ^172\.19\.143\.([1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$ ]] \
    || fail 'HaVip must be an address in the ProjectWing application vSwitch'
  [[ "$havip" != 172.19.143.157 && "$havip" != 172.19.143.158 ]] \
    || fail 'HaVip must not reuse an Edge host address'
  validate_name "$network_name" network
  validate_name "$resource_name" resource
  validate_name "$router_name" router
  validate_name "$resource_group_name" resource-group
  validate_name "$peer_group_name" peer-group
  api_base="${management_url%/}"
  [[ "$api_base" == */api ]] || api_base="$api_base/api"
}

api_call() {
  local method="$1" path="$2" payload="${3:-}"
  local -a args=(--silent --show-error --fail-with-body --connect-timeout 10 --max-time 30)
  args+=(--header 'Accept: application/json' --header 'Authorization: Token '"$token")
  if [[ "$method" == GET ]]; then
    curl "${args[@]}" --retry 2 "${api_base}${path}"
  else
    curl "${args[@]}" --request "$method" --header 'Content-Type: application/json' \
      --data-binary "$payload" "${api_base}${path}"
  fi
}

url_encode() {
  jq -rn --arg value "$1" '$value | @uri'
}

named_matches() {
  local name="$1"
  jq -c --arg name "$name" '
    if . == null then [] elif (type != "array") then error("API response is not an array or null") else
      [.[] | select(.name? == $name)]
    end
  '
}

array_response() {
  jq -c 'if . == null then [] elif type == "array" then . else error("API response is not an array or null") end'
}

object_id() {
  jq -er '.id | strings | select(test("^[A-Za-z0-9_-]+$"))'
}

find_group_id() {
  local name="$1" encoded response matches count object
  encoded="$(url_encode "$name")"
  response="$(api_call GET "/groups?name=${encoded}")" || fail "cannot read NetBird group: $name"
  matches="$(named_matches "$name" <<< "$response")" || fail "invalid NetBird group response: $name"
  count="$(jq -r 'length' <<< "$matches")"
  (( count == 1 )) || fail "NetBird group is missing or ambiguous: $name"
  object="$(jq -c '.[0]' <<< "$matches")"
  object_id <<< "$object" || fail "NetBird group has no id: $name"
}

ensure_network() {
  local response matches count object payload
  response="$(api_call GET /networks)" || fail 'cannot read NetBird networks'
  matches="$(named_matches "$network_name" <<< "$response")" || fail 'invalid NetBird network response'
  count="$(jq -r 'length' <<< "$matches")"
  (( count <= 1 )) || fail "NetBird network is ambiguous: $network_name"
  if (( count == 1 )); then
    object="$(jq -c '.[0]' <<< "$matches")"
    jq -e --arg description "$network_description" '(.description // "") == $description' <<< "$object" >/dev/null ||
      fail "NetBird network $network_name conflicts with the requested network"
    object_id <<< "$object" || fail 'existing NetBird network has no id'
    return
  fi
  payload="$(jq -cn --arg name "$network_name" --arg description "$network_description" '{name:$name,description:$description}')"
  api_call POST /networks "$payload" | object_id || fail 'cannot create NetBird network'
}

ensure_resource() {
  local network_id="$1" group_id="$2" response matches count object payload expected_address
  expected_address="${havip}/32"
  response="$(api_call GET "/networks/${network_id}/resources")" || fail 'cannot read NetBird resources'
  matches="$(named_matches "$resource_name" <<< "$response")" || fail 'invalid NetBird resource response'
  count="$(jq -r 'length' <<< "$matches")"
  (( count <= 1 )) || fail "NetBird resource is ambiguous: $resource_name"
  if (( count == 1 )); then
    object="$(jq -c '.[0]' <<< "$matches")"
    jq -e --arg address "$expected_address" --arg group "$group_id" --arg description "$resource_description" '
      (.type == "host") and (.address == $address) and (.enabled == true) and ((.description // "") == $description) and
      ([.groups[]? | if type == "object" then .id else . end] | sort) == [$group]
    ' <<< "$object" >/dev/null || fail "NetBird resource $resource_name conflicts with the requested HaVip"
    object_id <<< "$object" || fail 'existing NetBird resource has no id'
    return
  fi
  payload="$(jq -cn --arg name "$resource_name" --arg description "$resource_description" \
    --arg address "$expected_address" --arg group "$group_id" \
    '{name:$name,description:$description,address:$address,enabled:true,groups:[$group]}')"
  api_call POST "/networks/${network_id}/resources" "$payload" | object_id || fail 'cannot create NetBird resource'
}

ensure_router() {
  local network_id="$1" group_id="$2" response object payload named_count
  response="$(api_call GET "/networks/${network_id}/routers")" || fail 'cannot read NetBird routers'
  response="$(array_response <<< "$response")" || fail 'invalid NetBird router response'
  named_count="$(jq -r --arg name "$router_name" '[.[] | select(.name? == $name)] | length' <<< "$response")"
  if (( named_count > 0 )); then
    (( named_count == 1 )) || fail "NetBird router is ambiguous: $router_name"
    object="$(jq -c --arg name "$router_name" '[.[] | select(.name? == $name)][0]' <<< "$response")"
  else
    # NetBird v0.77 routers have no name field; use the peer-group tuple as identity.
    tuple_count="$(jq -r --arg group "$group_id" '[.[] | select(((.peer // "") == "") and ((.peer_groups // []) | sort) == [$group])] | length' <<< "$response")"
    (( tuple_count <= 1 )) || fail "multiple NetBird routers use peer group: $peer_group_name"
    if (( tuple_count == 1 )); then
      object="$(jq -c --arg group "$group_id" '[.[] | select(((.peer // "") == "") and ((.peer_groups // []) | sort) == [$group])][0]' <<< "$response")"
    else
      object=''
    fi
  fi
  if [[ -n "${object:-}" ]]; then
    jq -e --arg group "$group_id" '
      ((.peer // "") == "") and ((.peer_groups // []) | sort) == [$group] and
      (.metric == 100) and (.masquerade == true) and (.enabled == true)
    ' <<< "$object" >/dev/null || fail "NetBird router $router_name conflicts with the requested route"
    object_id <<< "$object" || fail 'existing NetBird router has no id'
    return
  fi
  payload="$(jq -cn --arg group "$group_id" '{peer_groups:[$group],metric:100,masquerade:true,enabled:true}')"
  api_call POST "/networks/${network_id}/routers" "$payload" | object_id || fail 'cannot create NetBird router'
}

main() {
  local network_id resource_group_id peer_group_id resource_id router_id
  validate_inputs
  network_id="$(ensure_network)"
  resource_group_id="$(find_group_id "$resource_group_name")"
  peer_group_id="$(find_group_id "$peer_group_name")"
  resource_id="$(ensure_resource "$network_id" "$resource_group_id")"
  router_id="$(ensure_router "$network_id" "$peer_group_id")"
  jq -cn --arg network "$network_id" --arg resource "$resource_id" --arg router "$router_id" \
    --arg resource_group "$resource_group_name" --arg peer_group "$peer_group_name" \
    '{networkId:$network,resourceId:$resource,routerId:$router,resourceGroup:$resource_group,peerGroup:$peer_group}'
}

main "$@"
