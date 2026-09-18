#!/usr/bin/env bash
set -Eeuo pipefail

runtime_env="${1:-}"
foundation_env="${2:-}"

fail() {
  echo "edge-ha-image: $*" >&2
  exit 1
}

read_single_setting() {
  local file="$1" key="$2"
  local -a matches=()
  test -r "${file}" || fail "missing readable settings file: ${file}"
  mapfile -t matches < <(sed -n "s/^${key}=//p" "${file}")
  [[ "${#matches[@]}" == 1 && -n "${matches[0]}" ]] \
    || fail "${key} must be defined exactly once"
  printf '%s\n' "${matches[0]}"
}

desired_image="$(read_single_setting "${runtime_env}" PROJECTWING_TRAEFIK_IMAGE)"
source_image="$(read_single_setting "${foundation_env}" PROJECTWING_TRAEFIK_SOURCE_IMAGE)"
expected_id="$(read_single_setting "${foundation_env}" PROJECTWING_TRAEFIK_IMAGE_ID)"

[[ "${desired_image}" =~ ^projectwing-traefik:([a-f0-9]{64})$ ]] \
  || fail "PROJECTWING_TRAEFIK_IMAGE must be one deterministic local Traefik alias"
desired_digest="${BASH_REMATCH[1]}"
[[ "${source_image}" =~ ^traefik:[A-Za-z0-9][A-Za-z0-9_.-]*@sha256:([a-f0-9]{64})$ ]] \
  || fail "PROJECTWING_TRAEFIK_SOURCE_IMAGE must be one pinned official Traefik image"
source_digest="${BASH_REMATCH[1]}"
[[ "${desired_digest}" == "${source_digest}" ]] \
  || fail "Traefik alias and pinned source digest do not match"
[[ "${expected_id}" =~ ^sha256:[a-f0-9]{64}$ ]] \
  || fail "PROJECTWING_TRAEFIK_IMAGE_ID must be one pinned Docker image ID"

if actual_id="$(docker image inspect --format '{{.Id}}' "${desired_image}" 2>/dev/null)"; then
  [[ "${actual_id}" == "${expected_id}" ]] \
    || fail "local Traefik alias points to an unexpected image ID"
else
  docker image inspect "${expected_id}" >/dev/null 2>&1 \
    || fail "pinned Traefik image ID is not present locally: ${expected_id}"
  docker image tag "${expected_id}" "${desired_image}"
  actual_id="$(docker image inspect --format '{{.Id}}' "${desired_image}" 2>/dev/null)" \
    || fail "restored Traefik alias cannot be inspected"
  [[ "${actual_id}" == "${expected_id}" ]] \
    || fail "restored Traefik alias points to an unexpected image ID"
  echo "Restored pinned Edge image alias from local image ${expected_id}."
fi
