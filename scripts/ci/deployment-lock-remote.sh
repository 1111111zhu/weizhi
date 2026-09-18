#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
release_dir="${PROJECTWING_RELEASE_DIR:?PROJECTWING_RELEASE_DIR is required}"
release_key="${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"
color="${PROJECTWING_COLOR:?PROJECTWING_COLOR is required}"
deploy_run_id="${PROJECTWING_DEPLOY_RUN_ID:?PROJECTWING_DEPLOY_RUN_ID is required}"
deploy_run_attempt="${PROJECTWING_DEPLOY_RUN_ATTEMPT:?PROJECTWING_DEPLOY_RUN_ATTEMPT is required}"
runtime_env="${release_dir}/.env.runtime"
compose_file="${release_dir}/docker-compose.development.yml"
color_file="${release_dir}/deploy/blue-green/docker-compose.color.yml"
backend_file="${release_dir}/deploy/blue-green/docker-compose.backend.yml"
holder="${release_dir}/scripts/ci/deployment-lock-holder.mjs"
lease_dir="${release_dir}/deployment-lock"
status_file="${lease_dir}/status.json"
container="projectwing-deploy-lock-${deploy_run_id}-${deploy_run_attempt}"
uploads_volume="${PROJECTWING_API_UPLOADS_VOLUME:-projectwing_api_uploads}"

[[ "${release_key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]]
[[ "${color}" == blue || "${color}" == green ]]
[[ "${deploy_run_id}" =~ ^[0-9]+$ && "${deploy_run_attempt}" =~ ^[1-9][0-9]*$ ]]
[[ "${uploads_volume}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]

compose() {
  docker compose --project-name "projectwing-${color}" --env-file "${runtime_env}" \
    -f "${compose_file}" -f "${color_file}" -f "${backend_file}" "$@"
}

lock_is_healthy() {
  local heartbeat now status_json
  docker inspect --format '{{.State.Running}}' "${container}" 2>/dev/null | grep -Fxq true
  [[ -f "${status_file}" && ! -L "${status_file}" ]] || return 1
  status_json="$(cat -- "${status_file}" 2>/dev/null)" || return 1
  jq -e --arg release "${release_key}" '.state == "acquired" and .releaseKey == $release' \
    <<<"${status_json}" >/dev/null
  heartbeat="$(jq -er '.heartbeat | numbers' <<<"${status_json}")"
  now="$(( $(date +%s) * 1000 ))"
  (( now - heartbeat < 45000 ))
}

acquire() {
  local attempt status_json
  install -d -m 700 "${lease_dir}"
  rm -f -- "${status_file}" "${status_file}.tmp"
  docker rm -f "${container}" >/dev/null 2>&1 || true
  docker volume inspect "${uploads_volume}" >/dev/null 2>&1 || docker volume create --name "${uploads_volume}" >/dev/null
  compose run -d --no-deps --name "${container}" \
    --user "$(id -u):$(id -g)" \
    -e PROJECTWING_RELEASE_KEY="${release_key}" \
    -v "${holder}:/deployment-lock-holder.mjs:ro" \
    -v "${lease_dir}:/deployment-lock" \
    --entrypoint node api /deployment-lock-holder.mjs >/dev/null
  for attempt in $(seq 1 72); do
    if lock_is_healthy; then
      printf 'deployment_lock_container=%s\n' "${container}"
      return 0
    fi
    status_json=''
    if [[ -f "${status_file}" && ! -L "${status_file}" ]] \
      && status_json="$(cat -- "${status_file}" 2>/dev/null)" \
      && jq -e '.state == "busy" or .state == "error"' <<<"${status_json}" >/dev/null; then
      printf '%s\n' "${status_json}" >&2
      return 1
    fi
    docker inspect --format '{{.State.Running}}' "${container}" 2>/dev/null | grep -Fxq true || {
      docker logs "${container}" >&2 || true
      return 1
    }
    sleep 5
  done
  echo 'Timed out waiting for the global deployment lock.' >&2
  return 1
}

release() {
  docker stop --time 15 "${container}" >/dev/null 2>&1 || true
  docker rm "${container}" >/dev/null 2>&1 || true
  rm -f -- "${status_file}" "${status_file}.tmp"
}

case "${action}" in
  acquire) acquire ;;
  assert) lock_is_healthy ;;
  release) release ;;
  *) echo 'Usage: deployment-lock-remote.sh {acquire|assert|release}' >&2; exit 2 ;;
esac
