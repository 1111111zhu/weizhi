#!/usr/bin/env bash
set -Eeuo pipefail

release_dir="${PROJECTWING_RELEASE_DIR:?PROJECTWING_RELEASE_DIR is required}"
color="${PROJECTWING_COLOR:?PROJECTWING_COLOR is required}"
gateway="${PROJECTWING_CANDIDATE_GATEWAY:?PROJECTWING_CANDIDATE_GATEWAY is required}"
edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
state_file="${edge_root}/release.json"
compose_file="${release_dir}/docker-compose.development.yml"
edge_compose_file="${release_dir}/deploy/blue-green/docker-compose.edge.yml"
route_source="${release_dir}/deploy/traefik/dynamic/edge-routing.yml"
route_target="${edge_root}/dynamic/edge-routing.yml"
admin_source="${release_dir}/deploy/traefik/dynamic/edge-admin.yml"
admin_target="${edge_root}/dynamic/edge-admin.yml"
renderer="${release_dir}/scripts/ci/render-edge-routing.sh"
runtime_env="${edge_root}/edge.env"
app_env="${PROJECTWING_APP_ENV_FILE:-${release_dir}/secrets/projectwing.env}"
oss_env="${PROJECTWING_OSS_ENV_FILE:-${release_dir}/secrets/projectwing-oss.env}"
registry_env="${PROJECTWING_REGISTRY_ENV_FILE:-${release_dir}/secrets/projectwing-registry.env}"
acme_access_key="${PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE:-${release_dir}/secrets/traefik-alidns-access-key}"
acme_secret_key="${PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE:-${release_dir}/secrets/traefik-alidns-secret-key}"

if [[ "${color}" != blue && "${color}" != green ]]; then
  echo "PROJECTWING_COLOR must be blue or green." >&2
  exit 2
fi
if [[ ! "${gateway}" =~ ^http://172\.19\.143\.(157|158):18080$ ]]; then
  echo "PROJECTWING_CANDIDATE_GATEWAY must be an approved VPC backend gateway." >&2
  exit 2
fi

for file in "${compose_file}" "${route_source}" "${admin_source}" "${renderer}" "${app_env}" "${oss_env}" "${registry_env}" "${acme_access_key}" "${acme_secret_key}"; do
  test -r "${file}"
done

edge_compose() {
  docker compose --project-name projectwing-edge --env-file "${runtime_env}" -f "${compose_file}" -f "${edge_compose_file}" "$@"
}

read_state() {
  if [[ ! -r "${state_file}" ]]; then
    printf '{}\n'
    return
  fi
  cat "${state_file}"
}

active_gateway() {
  jq -r '.activeGateway // empty'
}

write_edge_env() {
  local temporary_env

  install -d -m 700 "${edge_root}/secrets" "${edge_root}/dynamic"
  install -m 600 "${app_env}" "${edge_root}/secrets/projectwing.env"
  install -m 600 "${oss_env}" "${edge_root}/secrets/projectwing-oss.env"
  install -m 600 "${acme_access_key}" "${edge_root}/secrets/traefik-alidns-access-key"
  install -m 600 "${acme_secret_key}" "${edge_root}/secrets/traefik-alidns-secret-key"
  temporary_env="$(mktemp "${edge_root}/.edge.env.XXXXXX")"
  {
    cat "${registry_env}"
    printf 'PROJECTWING_PROXY_NETWORK=projectwing-proxy\n'
    printf 'PROJECTWING_TRAEFIK_DYNAMIC_DIR=%s\n' "${edge_root}/dynamic"
    printf 'PROJECTWING_TRAEFIK_CONFIG_FILE=%s\n' "${release_dir}/deploy/traefik/traefik.yml"
    printf 'PROJECTWING_TRAEFIK_SECRETS_DIR=%s\n' "${edge_root}/secrets"
  } > "${temporary_env}"
  chmod 600 "${temporary_env}"
  mv -f "${temporary_env}" "${runtime_env}"
  install -m 644 "${admin_source}" "${admin_target}"
}

legacy_edge_ids=()

bootstrap_edge() {
  local id project
  edge_compose ps -q reverse-proxy | grep -q . && return 0
  if [[ "${PROJECTWING_EDGE_BOOTSTRAP:-false}" != true ]]; then
    echo "The stable Edge is absent. Set PROJECTWING_EDGE_BOOTSTRAP=true for the one-time controlled replacement." >&2
    return 1
  fi
  while IFS= read -r id; do
    project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${id}")"
    if [[ "${project}" == projectwing || "${project}" =~ ^projectwing-[a-f0-9]{7,40}$ ]]; then
      legacy_edge_ids+=("${id}")
      docker stop --time 15 "${id}"
    fi
  done < <(docker ps -q --filter label=com.docker.compose.service=reverse-proxy)
  if ! edge_compose up -d --no-build reverse-proxy; then
    restore_legacy_edge
    return 1
  fi
}

restore_legacy_edge() {
  local id
  [[ "${#legacy_edge_ids[@]}" -gt 0 ]] || return 0
  edge_compose down --remove-orphans || true
  for id in "${legacy_edge_ids[@]}"; do
    docker start "${id}" >/dev/null || true
  done
}

wait_for_edge() {
  local attempt id state
  for attempt in $(seq 1 18); do
    id="$(edge_compose ps -q reverse-proxy)"
    if [[ -n "${id}" ]]; then
      state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${id}")"
      [[ "${state}" == healthy ]] && return 0
    fi
    sleep 5
  done
  return 1
}

verify_edge() {
  local host
  for host in wing.superfx.cn cmp.superfx.cn showroom.superfx.cn tms.superfx.cn intranet.superfx.cn ib.superfx.cn; do
    curl --noproxy '*' --fail --silent --show-error --insecure --connect-timeout 5 --max-time 15 \
      --resolve "${host}:443:127.0.0.1" "https://${host}/" >/dev/null
  done
}

write_state() {
  local previous="$1" temporary
  temporary="$(mktemp "${edge_root}/.release.XXXXXX")"
  jq -n \
    --arg color "${color}" \
    --arg gateway "${gateway}" \
    --arg previous "${previous}" \
    --arg release "${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}" \
    --arg version "${PROJECTWING_VERSION:?PROJECTWING_VERSION is required}" \
    '{schemaVersion: 2, activeColor: $color, activeGateway: $gateway, previousGateway: $previous, releaseKey: $release, version: $version}' > "${temporary}"
  mv -f "${temporary}" "${state_file}"
  chgrp ops "${state_file}"
  chmod 640 "${state_file}"
}

previous_state="$(read_state)"
if jq -e '(.schemaVersion // 0) >= 4' <<<"${previous_state}" >/dev/null; then
  echo 'Legacy direct promotion is disabled after transactional Edge state activation.' >&2
  exit 2
fi
write_edge_env
docker network inspect projectwing-proxy >/dev/null 2>&1 || docker network create projectwing-proxy >/dev/null
previous_gateway="$(printf %s "${previous_state}" | active_gateway)"
"${renderer}" "${route_source}" "${route_target}" "${gateway}"
bootstrap_edge
if ! wait_for_edge || ! verify_edge; then
  if [[ -n "${previous_gateway}" ]]; then
    "${renderer}" "${route_source}" "${route_target}" "${previous_gateway}"
  fi
  restore_legacy_edge
  exit 1
fi
write_state "${previous_gateway}"
printf 'active_color=%s\n' "${color}"
printf 'active_gateway=%s\n' "${gateway}"
