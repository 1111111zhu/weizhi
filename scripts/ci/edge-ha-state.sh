#!/usr/bin/env bash

read_state() {
  if [[ ! -r "${state_file}" ]]; then printf '{}\n'; return; fi
  require_command jq
  jq -e '(.schemaVersion == 2 or .schemaVersion == 3 or .schemaVersion == 4)' \
    "${state_file}" >/dev/null || fail "unsupported or invalid Edge state"
  cat "${state_file}"
}

state_field() {
  local expression="$1" state
  state="$(read_state)"
  jq -r "${expression}" <<<"${state}"
}

assert_expected_state() {
  local state generation release version mode
  state="$(read_state)"
  generation="$(jq -r '.generation // 0' <<<"${state}")"
  release="$(jq -r '.releaseKey // empty' <<<"${state}")"
  version="$(jq -r '(.sourceCommitSha // .version) // empty' <<<"${state}")"
  mode="$(jq -r '.routeMode // "serving"' <<<"${state}")"
  [[ -z "${PROJECTWING_EXPECTED_GENERATION:-}" || "${generation}" == "${PROJECTWING_EXPECTED_GENERATION}" ]] \
    || fail "Edge generation changed before ${operation}"
  [[ -z "${PROJECTWING_EXPECTED_RELEASE_KEY+x}" || "${release}" == "${PROJECTWING_EXPECTED_RELEASE_KEY}" ]] \
    || fail "Edge release changed before ${operation}"
  [[ -z "${PROJECTWING_EXPECTED_SOURCE_COMMIT_SHA+x}" || "${version}" == "${PROJECTWING_EXPECTED_SOURCE_COMMIT_SHA}" ]] \
    || fail "Edge source commit changed before ${operation}"
  [[ -z "${PROJECTWING_EXPECTED_ROUTE_MODE:-}" || "${mode}" == "${PROJECTWING_EXPECTED_ROUTE_MODE}" ]] \
    || fail "Edge route mode changed before ${operation}"
}

next_generation() {
  local current
  if [[ -n "${PROJECTWING_GENERATION:-}" ]]; then printf '%s\n' "${PROJECTWING_GENERATION}"; return; fi
  current="$(state_field '(.generation // 0)')"
  [[ "${current}" =~ ^[0-9]+$ ]] || current=0
  printf '%s\n' "$((current + 1))"
}

require_run_metadata() {
  local name value
  for name in PROJECTWING_BUILD_RUN_ID PROJECTWING_BUILD_RUN_ATTEMPT PROJECTWING_DEPLOY_RUN_ID PROJECTWING_DEPLOY_RUN_ATTEMPT; do
    value="${!name:-0}"
    [[ "${value}" =~ ^[0-9]+$ ]] || fail "${name} must be a non-negative integer"
  done
}

write_serving_state_v4() {
  local color="$1" gateway="$2" state previous_color previous_gateway previous_release
  local previous_version previous_generation generation degraded temporary source_commit image_source
  state="$(read_state)"
  previous_color="${PROJECTWING_PREVIOUS_COLOR:-$(jq -r '.activeColor // empty' <<<"${state}")}"
  previous_gateway="${PROJECTWING_PREVIOUS_GATEWAY:-$(jq -r '.activeGateway // empty' <<<"${state}")}"
  previous_release="${PROJECTWING_PREVIOUS_RELEASE_KEY:-$(jq -r '.releaseKey // empty' <<<"${state}")}"
  previous_version="${PROJECTWING_PREVIOUS_VERSION:-$(jq -r '.version // empty' <<<"${state}")}"
  previous_generation="${PROJECTWING_PREVIOUS_GENERATION:-$(jq -r '.generation // empty' <<<"${state}")}"
  generation="$(next_generation)"; degraded="${PROJECTWING_DEGRADED:-false}"
  source_commit="${PROJECTWING_SOURCE_COMMIT_SHA:-${PROJECTWING_VERSION:?PROJECTWING_VERSION is required}}"
  image_source="${PROJECTWING_IMAGE_SOURCE_SHA:?PROJECTWING_IMAGE_SOURCE_SHA is required}"
  [[ "${generation}" =~ ^[0-9]+$ && "${source_commit}" =~ ^[a-f0-9]{40}$ && "${image_source}" =~ ^[a-f0-9]{40}$ ]]
  [[ "${degraded}" == true || "${degraded}" == false ]]; require_run_metadata
  temporary="$(mktemp "${state_file}.XXXXXX")"; trap 'rm -f "${temporary}"' RETURN
  jq -n --arg color "${color}" --arg gateway "${gateway}" --arg release "${PROJECTWING_RELEASE_KEY}" \
    --arg version "${source_commit}" --arg sourceCommitSha "${source_commit}" --arg imageSourceSha "${image_source}" \
    --arg generation "${generation}" --argjson degraded "${degraded}" \
    --arg buildRunId "${PROJECTWING_BUILD_RUN_ID:-0}" --arg buildRunAttempt "${PROJECTWING_BUILD_RUN_ATTEMPT:-0}" \
    --arg deployRunId "${PROJECTWING_DEPLOY_RUN_ID:-0}" --arg deployRunAttempt "${PROJECTWING_DEPLOY_RUN_ATTEMPT:-0}" \
    --arg previousColor "${previous_color}" --arg previousGateway "${previous_gateway}" \
    --arg previousReleaseKey "${previous_release}" --arg previousVersion "${previous_version}" \
    --arg previousGeneration "${previous_generation}" \
    '{schemaVersion:4,activeColor:$color,activeGateway:$gateway,releaseKey:$release,version:$version,
      sourceCommitSha:$sourceCommitSha,imageSourceSha:$imageSourceSha,buildRunId:($buildRunId|tonumber),
      buildRunAttempt:($buildRunAttempt|tonumber),deployRunId:($deployRunId|tonumber),
      deployRunAttempt:($deployRunAttempt|tonumber),generation:($generation|tonumber),degraded:$degraded,
      routeMode:"serving",transactionId:null,pendingReleaseKey:null,pendingSourceCommitSha:null,
      pendingImageSourceSha:null,previousColor:(if $previousColor=="" then null else $previousColor end),
      previousGateway:(if $previousGateway=="" then null else $previousGateway end),
      previousReleaseKey:(if $previousReleaseKey=="" then null else $previousReleaseKey end),
      previousVersion:(if $previousVersion=="" then null else $previousVersion end),
      previousGeneration:(if $previousGeneration=="" then null else ($previousGeneration|tonumber) end)}' >"${temporary}"
  chmod 640 "${temporary}"; mv -f "${temporary}" "${state_file}"; trap - RETURN
}

write_maintenance_state_v4() {
  local state temporary transaction source_commit generation
  state="$(read_state)"; transaction="${PROJECTWING_TRANSACTION_ID:?PROJECTWING_TRANSACTION_ID is required}"
  source_commit="${PROJECTWING_SOURCE_COMMIT_SHA:-${PROJECTWING_VERSION:?PROJECTWING_VERSION is required}}"
  generation="$(next_generation)"
  [[ "${transaction}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ && "${source_commit}" =~ ^[a-f0-9]{40}$ ]]
  [[ "${generation}" =~ ^[0-9]+$ ]]
  temporary="$(mktemp "${state_file}.XXXXXX")"; trap 'rm -f "${temporary}"' RETURN
  jq --arg transaction "${transaction}" --arg pendingRelease "${PROJECTWING_RELEASE_KEY}" \
    --arg pendingSource "${source_commit}" --arg pendingImage "${PROJECTWING_IMAGE_SOURCE_SHA}" \
    --arg generation "${generation}" \
    '.+{schemaVersion:4,sourceCommitSha:(.sourceCommitSha//.version),imageSourceSha:(.imageSourceSha//.version),
      buildRunId:(.buildRunId//0),buildRunAttempt:(.buildRunAttempt//0),deployRunId:(.deployRunId//0),
      deployRunAttempt:(.deployRunAttempt//0),generation:($generation|tonumber),routeMode:"maintenance",transactionId:$transaction,
      pendingReleaseKey:$pendingRelease,pendingSourceCommitSha:$pendingSource,pendingImageSourceSha:$pendingImage}' \
    <<<"${state}" >"${temporary}"
  chmod 640 "${temporary}"; mv -f "${temporary}" "${state_file}"; trap - RETURN
}
