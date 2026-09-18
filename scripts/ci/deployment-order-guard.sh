#!/usr/bin/env bash
set -Eeuo pipefail

repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
source_commit="${PROJECTWING_SOURCE_COMMIT_SHA:?PROJECTWING_SOURCE_COMMIT_SHA is required}"
active_state="${PROJECTWING_ACTIVE_EDGE_STATE:-}"
[[ -n "${active_state}" ]] || active_state='{}'

[[ "${source_commit}" =~ ^[a-f0-9]{40}$ ]]
jq -e 'type == "object"' <<<"${active_state}" >/dev/null

main_head="$(gh api "/repos/${repository}/commits/main" --jq .sha)"
[[ "${main_head}" =~ ^[a-f0-9]{40}$ ]]

active_commit="$(jq -r '(.sourceCommitSha // .version) // empty' <<<"${active_state}")"
route_mode="$(jq -r '.routeMode // "serving"' <<<"${active_state}")"
pending_commit="$(jq -r '.pendingSourceCommitSha // empty' <<<"${active_state}")"
allow_stale_resume="${PROJECTWING_ALLOW_STALE_MAINTENANCE_RESUME:-false}"
allow_completed_recovery="${PROJECTWING_ALLOW_COMPLETED_MAINTENANCE_RECOVERY:-false}"
pending_image_source="${PROJECTWING_PENDING_IMAGE_SOURCE_SHA:-}"
image_source="${PROJECTWING_IMAGE_SOURCE_SHA:-}"

if [[ "${route_mode}" == maintenance && -n "${pending_commit}" && "${pending_commit}" != "${source_commit}" ]]; then
  if [[ "${allow_completed_recovery}" == true && "${source_commit}" == "${main_head}" \
    && "${pending_image_source}" =~ ^[a-f0-9]{40}$ \
    && "${image_source}" =~ ^[a-f0-9]{40}$ \
    && "${pending_image_source}" == "${image_source}" ]]; then
    printf 'recover-maintenance\n'
    exit 0
  fi
  echo "Maintenance belongs to ${pending_commit}; refusing ${source_commit}." >&2
  exit 1
fi
if [[ "${source_commit}" != "${main_head}" ]]; then
  if [[ "${route_mode}" == maintenance && "${pending_commit}" == "${source_commit}" ]]; then
    if [[ "${allow_stale_resume}" == true ]]; then printf 'resume\n'; else printf 'maintenance-stale\n'; fi
  else
    printf 'superseded\n'
  fi
  exit 0
fi
if [[ "${route_mode}" == maintenance && "${pending_commit}" == "${source_commit}" ]]; then
  printf 'resume\n'
  exit 0
fi
if [[ -z "${active_commit}" ]]; then
  printf 'proceed\n'
  exit 0
fi
if [[ "${active_commit}" == "${source_commit}" ]]; then
  printf 'already-active\n'
  exit 0
fi

comparison="$(gh api "/repos/${repository}/compare/${active_commit}...${source_commit}" --jq .status)"
if [[ "${comparison}" != ahead ]]; then
  printf 'superseded\n'
  exit 0
fi
printf 'proceed\n'
