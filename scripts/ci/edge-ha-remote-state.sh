#!/usr/bin/env bash

edge_ha_read_node() {
  remote_ssh "$1" "$2" 'test ! -e /opt/projectwing/edge/release.json || cat /opt/projectwing/edge/release.json'
}

edge_ha_validate_state() {
  local state="$1"
  [[ -z "${state}" ]] && return 0
  jq -e '
    (.schemaVersion == 2 or .schemaVersion == 3 or .schemaVersion == 4) and
    (.activeColor == "blue" or .activeColor == "green") and
    (.activeGateway == "http://172.19.143.157:18080" or .activeGateway == "http://172.19.143.158:18080") and
    (.releaseKey | type == "string" and (. == "" or test("^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$"))) and
    (.version | type == "string" and (. == "" or test("^[a-f0-9]{40}$"))) and
    ((.generation // 0) | type == "number" and . >= 0 and floor == .) and
    ((.degraded // false) | type == "boolean") and
    ((.routeMode // "serving") == "serving" or .routeMode == "maintenance") and
    (if .schemaVersion == 4 then
      (.sourceCommitSha | type == "string" and test("^[a-f0-9]{40}$")) and
      (.imageSourceSha | type == "string" and test("^[a-f0-9]{40}$")) and
      ((.buildRunId // 0) | type == "number") and ((.deployRunId // 0) | type == "number")
    else true end)' <<<"${state}" >/dev/null
}

edge_ha_canonical_state() {
  jq -cS '{schemaVersion,activeColor,activeGateway,releaseKey,version,
    generation:(.generation//0),degraded:(.degraded//false),previousColor:(.previousColor//null),
    previousGateway:(.previousGateway//null),previousReleaseKey:(.previousReleaseKey//null),
    previousVersion:(.previousVersion//null),previousGeneration:(.previousGeneration//null),
    sourceCommitSha:(.sourceCommitSha//.version),imageSourceSha:(.imageSourceSha//null),
    buildRunId:(.buildRunId//0),buildRunAttempt:(.buildRunAttempt//0),deployRunId:(.deployRunId//0),
    deployRunAttempt:(.deployRunAttempt//0),routeMode:(.routeMode//"serving"),
    transactionId:(.transactionId//null),pendingReleaseKey:(.pendingReleaseKey//null),
    pendingSourceCommitSha:(.pendingSourceCommitSha//null),pendingImageSourceSha:(.pendingImageSourceSha//null)}' <<<"$1"
}

edge_ha_select_consensus() {
  local blue_state="$1" green_state="$2"
  edge_ha_validate_state "${blue_state}" || { echo 'Blue Edge state is invalid.' >&2; return 1; }
  edge_ha_validate_state "${green_state}" || { echo 'Green Edge state is invalid.' >&2; return 1; }
  if [[ -n "${blue_state}" && -n "${green_state}" ]] \
    && [[ "$(edge_ha_canonical_state "${blue_state}")" != "$(edge_ha_canonical_state "${green_state}")" ]]; then
    echo 'Blue and Green Edge state disagree; refusing an ambiguous promotion.' >&2
    return 1
  fi
  edge_active_state="${blue_state:-${green_state}}"
  if [[ -z "${edge_active_state}" ]]; then
    edge_active_state='{"schemaVersion":3,"activeColor":"green","activeGateway":"http://172.19.143.158:18080","releaseKey":"","version":"","generation":0}'
    echo 'No Edge state exists; using the one-time Green bootstrap baseline.' >&2
  fi
}

edge_ha_resolve_state() {
  local blue_state='' green_state=''
  if [[ -n "${single_host_color}" ]]; then
    if [[ "${single_host_color}" == blue ]]; then
      blue_state="$(edge_ha_read_node "${blue_host}" "${blue_known_hosts}")"
    else
      green_state="$(edge_ha_read_node "${green_host}" "${green_known_hosts}")"
    fi
    [[ -n "${blue_state}${green_state}" ]] || { echo 'Single-host recovery requires readable Edge state.' >&2; return 1; }
  else
    blue_state="$(edge_ha_read_node "${blue_host}" "${blue_known_hosts}")"
    green_state="$(edge_ha_read_node "${green_host}" "${green_known_hosts}")"
  fi
  edge_blue_state="${blue_state}"; edge_green_state="${green_state}"
  edge_ha_select_consensus "${blue_state}" "${green_state}"
  edge_active_color="$(jq -r '.activeColor' <<<"${edge_active_state}")"
  edge_generation="$(( $(jq -r '.generation // 0' <<<"${edge_active_state}") + 1 ))"
  [[ "${edge_active_color}" == blue ]] && edge_candidate_color=green || edge_candidate_color=blue
  echo "Resolved Edge generation ${edge_generation}: ${edge_active_color} -> ${edge_candidate_color}." >&2
}
