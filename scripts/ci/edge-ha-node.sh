#!/usr/bin/env bash
set -Eeuo pipefail

operation="${1:-}"
edge_root="${PROJECTWING_EDGE_ROOT:-/opt/projectwing/edge}"
config_dir="${edge_root}/config"
dynamic_dir="${config_dir}/dynamic"
secrets_dir="${config_dir}/secrets"
staged_dir="${edge_root}/staged"
health_dir="${edge_root}/health"
maintenance_dir="${config_dir}/maintenance"
state_file="${edge_root}/release.json"
runtime_env="${edge_root}/edge.env"
release_dir="${PROJECTWING_RELEASE_DIR:-${PWD}}"
compose_file="${PROJECTWING_EDGE_COMPOSE_FILE:-${release_dir}/docker-compose.development.yml}"
edge_compose_file="${PROJECTWING_EDGE_COMPOSE_OVERRIDE:-${release_dir}/deploy/blue-green/docker-compose.edge.yml}"
traefik_source="${PROJECTWING_EDGE_TRAEFIK_SOURCE:-${release_dir}/deploy/traefik/traefik.yml}"
route_source="${PROJECTWING_EDGE_ROUTE_SOURCE:-${release_dir}/deploy/traefik/dynamic/edge-routing.yml}"
maintenance_route_source="${PROJECTWING_EDGE_MAINTENANCE_ROUTE_SOURCE:-${release_dir}/deploy/traefik/dynamic/edge-maintenance.yml}"
maintenance_server_source="${PROJECTWING_EDGE_MAINTENANCE_SERVER_SOURCE:-${release_dir}/deploy/edge-ha/maintenance-server.sh}"
maintenance_response_source="${PROJECTWING_EDGE_MAINTENANCE_RESPONSE_SOURCE:-${release_dir}/deploy/edge-ha/maintenance-response.sh}"
admin_source="${PROJECTWING_EDGE_ADMIN_SOURCE:-${release_dir}/deploy/traefik/dynamic/edge-admin.yml}"
runtime_source="${PROJECTWING_EDGE_RUNTIME_ENV_SOURCE:-${release_dir}/secrets/projectwing-registry.env}"
acme_access_source="${PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE:-${release_dir}/secrets/traefik-alidns-access-key}"
acme_secret_source="${PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE:-${release_dir}/secrets/traefik-alidns-secret-key}"
route_target="${dynamic_dir}/edge-routing.yml"
legacy_route="${edge_root}/dynamic/edge-routing.yml"
admin_target="${dynamic_dir}/edge-admin.yml"
staged_route="${staged_dir}/edge-routing.yml"
rollback_route_file="${staged_dir}/edge-routing.rollback.yml"
rollback_state_file="${staged_dir}/release.rollback.json"
health_source="${PROJECTWING_EDGE_HEALTH_SOURCE:-${release_dir}/scripts/ci/edge-ha-health.sh}"
health_target="${health_dir}/edge-ha-health.sh"
route_mode="${PROJECTWING_EDGE_ROUTE_MODE:-serving}"
state_library="${release_dir}/scripts/ci/edge-ha-state.sh"
image_helper="${release_dir}/scripts/ci/edge-ha-image.sh"
foundation_env="${PROJECTWING_FOUNDATION_ENV:-${release_dir}/deploy/images/foundations.env}"

usage() {
  cat >&2 <<'EOF'
Usage: edge-ha-node.sh {prepare|switch|rollback|commit|read}

prepare stages the persistent Edge config and a candidate route without writing
release state. switch activates the staged route, rollback restores the
previous route, commit records the active candidate, and read prints state.
EOF
}

fail() {
  echo "edge-ha-node: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null || fail "required command is missing: $1"
}

test -r "${state_library}"
# shellcheck source=edge-ha-state.sh
. "${state_library}"

approved_gateway() {
  [[ "${1:-}" =~ ^http://172\.19\.143\.(157|158):18080$ ]]
}

approved_color() {
  [[ "${1:-}" == blue || "${1:-}" == green ]]
}

approved_route_mode() {
  [[ "${1:-}" == serving || "${1:-}" == maintenance ]]
}

require_gateway() {
  local gateway="${PROJECTWING_EDGE_GATEWAY:-${PROJECTWING_CANDIDATE_GATEWAY:-}}"
  approved_gateway "${gateway}" || fail "gateway must be an approved ProjectWing VPC backend URL"
  printf '%s\n' "${gateway}"
}

ensure_layout() {
  install -d -m 750 "${edge_root}" "${config_dir}" "${dynamic_dir}" "${secrets_dir}" "${staged_dir}" "${health_dir}" "${maintenance_dir}"
}

atomic_copy() {
  local source="$1" target="$2" mode="$3" temporary
  test -r "${source}" || fail "missing readable source: ${source}"
  temporary="$(mktemp "${target}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  install -m "${mode}" "${source}" "${temporary}"
  mv -f "${temporary}" "${target}"
  trap - RETURN
}

render_route() {
  local gateway="$1" target="$2" temporary
  test -r "${route_source}" || fail "missing route source: ${route_source}"
  temporary="$(mktemp "${target}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  sed "s|__PROJECTWING_ACTIVE_GATEWAY__|${gateway}|g" "${route_source}" > "${temporary}"
  chmod 640 "${temporary}"
  mv -f "${temporary}" "${target}"
  trap - RETURN
}

write_runtime_env() {
  local temporary
  temporary="$(mktemp "${runtime_env}.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  test -r "${runtime_source}" || fail "missing runtime env source: ${runtime_source}"
  cat "${runtime_source}" > "${temporary}"
  {
    printf 'PROJECTWING_PROXY_NETWORK=projectwing-proxy\n'
    printf 'PROJECTWING_TRAEFIK_CONFIG_FILE=%s\n' "${config_dir}/traefik.yml"
    printf 'PROJECTWING_TRAEFIK_DYNAMIC_DIR=%s\n' "${dynamic_dir}"
    printf 'PROJECTWING_TRAEFIK_SECRETS_DIR=%s\n' "${secrets_dir}"
    printf 'PROJECTWING_EDGE_MAINTENANCE_DIR=%s\n' "${maintenance_dir}"
    printf 'PROJECTWING_TRAEFIK_ACME_VOLUME=%s\n' "${PROJECTWING_TRAEFIK_ACME_VOLUME:-projectwing_traefik_acme}"
  } >> "${temporary}"
  chmod 600 "${temporary}"
  mv -f "${temporary}" "${runtime_env}"
  trap - RETURN
}

compose() {
  docker compose --project-name projectwing-edge --env-file "${runtime_env}" \
    -f "${compose_file}" -f "${edge_compose_file}" "$@"
}

ensure_acme_volume() {
  local volume="${PROJECTWING_TRAEFIK_ACME_VOLUME:-projectwing_traefik_acme}"
  [[ "${volume}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] \
    || fail "Traefik ACME volume name contains unsupported characters"
  docker volume inspect "${volume}" >/dev/null 2>&1 \
    || docker volume create --name "${volume}" >/dev/null
}

stage_config() {
  ensure_layout
  atomic_copy "${traefik_source}" "${config_dir}/traefik.yml" 640
  atomic_copy "${admin_source}" "${admin_target}" 640
  atomic_copy "${acme_access_source}" "${secrets_dir}/traefik-alidns-access-key" 600
  atomic_copy "${acme_secret_source}" "${secrets_dir}/traefik-alidns-secret-key" 600
  atomic_copy "${health_source}" "${health_target}" 755
  atomic_copy "${maintenance_server_source}" "${maintenance_dir}/maintenance-server.sh" 755
  atomic_copy "${maintenance_response_source}" "${maintenance_dir}/maintenance-response.sh" 755
  write_runtime_env
}

prepare() {
  require_command install
  require_command mktemp
  require_command sed
  local gateway=''
  approved_route_mode "${route_mode}" || fail "route mode must be serving or maintenance"
  assert_expected_state
  if [[ "${route_mode}" == serving ]]; then gateway="$(require_gateway)"; fi
  stage_config
  if [[ -r "${route_target}" ]]; then
    atomic_copy "${route_target}" "${rollback_route_file}" 640
  elif [[ -r "${legacy_route}" && ! -L "${legacy_route}" ]]; then
    atomic_copy "${legacy_route}" "${rollback_route_file}" 640
  else
    rm -f -- "${rollback_route_file}"
  fi
  if [[ -r "${state_file}" ]]; then
    atomic_copy "${state_file}" "${rollback_state_file}" 640
  else
    rm -f -- "${rollback_state_file}"
  fi
  if [[ "${route_mode}" == maintenance ]]; then
    atomic_copy "${maintenance_route_source}" "${staged_route}" 640
  else
    render_route "${gateway}" "${staged_route}"
  fi
  printf 'prepared_mode=%s\nprepared_gateway=%s\n' "${route_mode}" "${gateway}"
}

edge_health_script() {
  printf '%s\n' "${PROJECTWING_EDGE_HEALTH_SCRIPT:-${health_target}}"
}

activate_edge() {
  local health_script edge_start_timeout
  test -r "${runtime_env}" || fail "runtime env is not prepared"
  docker network inspect projectwing-proxy >/dev/null 2>&1 \
    || docker network create projectwing-proxy >/dev/null
  ensure_acme_volume
  test -x "${image_helper}" || fail "Edge image helper is not executable: ${image_helper}"
  bash "${image_helper}" "${runtime_env}" "${foundation_env}"
  compose up -d --no-build --pull never maintenance
  edge_start_timeout="${PROJECTWING_EDGE_START_TIMEOUT_SECONDS:-60}"
  [[ "${edge_start_timeout}" =~ ^[1-9][0-9]*$ ]] \
    || fail "Edge start timeout must be a positive integer"
  compose up -d --no-build --pull never --force-recreate --no-deps \
    --wait --wait-timeout "${edge_start_timeout}" reverse-proxy
  health_script="$(edge_health_script)"
  test -x "${health_script}" || fail "Edge health script is not executable: ${health_script}"
  PROJECTWING_EDGE_ROOT="${edge_root}" bash "${health_script}"
}

switch_route() {
  local gateway=''
  approved_route_mode "${route_mode}" || fail "route mode must be serving or maintenance"
  assert_expected_state
  if [[ "${route_mode}" == serving ]]; then gateway="$(require_gateway)"; fi
  test -r "${staged_route}" || fail "candidate route is not prepared"
  if [[ "${route_mode}" == maintenance ]]; then
    grep -Fq 'url: "http://maintenance:8080"' "${staged_route}" || fail "staged route is not maintenance"
  else
    grep -Fq "url: \"${gateway}\"" "${staged_route}" || fail "staged route does not match gateway"
  fi
  atomic_copy "${staged_route}" "${route_target}" 640
  if ! activate_edge; then
    if rollback_route; then
      fail "candidate Edge activation failed; the local snapshot was restored"
    fi
    fail "candidate Edge activation and local snapshot restoration both failed"
  fi
  printf 'switched_mode=%s\nswitched_gateway=%s\n' "${route_mode}" "${gateway}"
}

rollback_route() {
  if [[ -r "${rollback_route_file}" ]]; then
    atomic_copy "${rollback_route_file}" "${route_target}" 640
    activate_edge
    printf 'rolled_back_route=snapshot\n'
  else
    compose stop --timeout 15 reverse-proxy >/dev/null || true
    rm -f -- "${route_target}"
    printf 'rolled_back_route=absent\n'
  fi
  if [[ -r "${rollback_state_file}" ]]; then
    atomic_copy "${rollback_state_file}" "${state_file}" 640
  else
    rm -f -- "${state_file}"
  fi
}

commit() {
  local color="${PROJECTWING_COLOR:-}" gateway=''
  approved_route_mode "${route_mode}" || fail "route mode must be serving or maintenance"
  assert_expected_state
  if [[ "${route_mode}" == serving ]]; then
    approved_color "${color}" || fail "PROJECTWING_COLOR must be blue or green"
    gateway="$(require_gateway)"
  fi
  test -r "${route_target}" || fail "route is not prepared"
  if [[ "${route_mode}" == maintenance ]]; then
    grep -Fq 'url: "http://maintenance:8080"' "${route_target}" || fail "active route is not maintenance"
  else
    grep -Fq "url: \"${gateway}\"" "${route_target}" || fail "active route does not match gateway"
  fi
  PROJECTWING_EDGE_ROOT="${edge_root}" bash "$(edge_health_script)"
  if [[ "${route_mode}" == maintenance ]]; then
    write_maintenance_state_v4
  else
    write_serving_state_v4 "${color}" "${gateway}"
  fi
  rm -f -- "${staged_route}"
  printf 'committed_mode=%s\ncommitted_color=%s\ncommitted_gateway=%s\n' "${route_mode}" "${color}" "${gateway}"
}

case "${operation}" in
  prepare) prepare ;;
  switch) switch_route ;;
  rollback) rollback_route ;;
  commit) commit ;;
  read) read_state ;;
  *) usage; exit 2 ;;
esac
