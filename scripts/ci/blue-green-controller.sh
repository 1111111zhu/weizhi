#!/usr/bin/env bash
set -Eeuo pipefail

release_dir="${PROJECTWING_RELEASE_DIR:?PROJECTWING_RELEASE_DIR is required}"
color="${PROJECTWING_COLOR:?PROJECTWING_COLOR is required}"
backend_address="${PROJECTWING_BACKEND_BIND_ADDRESS:?PROJECTWING_BACKEND_BIND_ADDRESS is required}"
compose_file="${release_dir}/docker-compose.development.yml"
color_file="${release_dir}/deploy/blue-green/docker-compose.color.yml"
backend_file="${release_dir}/deploy/blue-green/docker-compose.backend.yml"
runtime_env="${release_dir}/.env.runtime"
candidate_dynamic_dir="${release_dir}/candidate-dynamic"
app_env="${PROJECTWING_APP_ENV_FILE:?PROJECTWING_APP_ENV_FILE is required}"
oss_env="${PROJECTWING_OSS_ENV_FILE:?PROJECTWING_OSS_ENV_FILE is required}"
registry_env="${PROJECTWING_REGISTRY_ENV_FILE:?PROJECTWING_REGISTRY_ENV_FILE is required}"
acme_access_key="${PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE:?PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE is required}"
acme_secret_key="${PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE:?PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE is required}"
backend_port="${PROJECTWING_BACKEND_HTTP_PORT:-18080}"
routing_renderer="${release_dir}/scripts/ci/render-candidate-admin-route.sh"
startup_minimum_mib="${PROJECTWING_CANDIDATE_STARTUP_MIN_AVAILABLE_MIB:-224}"
steady_minimum_mib="${PROJECTWING_CANDIDATE_MIN_AVAILABLE_MIB:-256}"
settle_seconds="${PROJECTWING_CANDIDATE_SETTLE_SECONDS:-60}"
uploads_volume="${PROJECTWING_API_UPLOADS_VOLUME:-projectwing_api_uploads}"
candidate_action="${PROJECTWING_CANDIDATE_ACTION:?PROJECTWING_CANDIDATE_ACTION is required}"
maintenance_confirmed="${PROJECTWING_MAINTENANCE_CONFIRMED:-false}"
schema_status_file="${release_dir}/database-schema.status"
migration_started_file="${release_dir}/database-migration.started"
migration_completed_file="${release_dir}/database-migration.completed"
schema_library="${release_dir}/scripts/ci/blue-green-schema.sh"
services=(gotenberg api preview-worker prisma-studio emp cmp showroom tms intranet ib-api ib backend-gateway)

if [[ "${color}" != blue && "${color}" != green ]]; then
  echo "PROJECTWING_COLOR must be blue or green." >&2
  exit 2
fi
if [[ ! "${backend_address}" =~ ^172\.19\.143\.(157|158)$ ]]; then
  echo "PROJECTWING_BACKEND_BIND_ADDRESS must be an approved ProjectWing VPC address." >&2
  exit 2
fi
if [[ ! "${backend_port}" =~ ^[1-9][0-9]{0,4}$ ]] || (( backend_port > 65535 )); then
  echo "PROJECTWING_BACKEND_HTTP_PORT must be a valid TCP port." >&2
  exit 2
fi
for setting in startup_minimum_mib steady_minimum_mib settle_seconds; do
  value="${!setting}"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || {
    echo "${setting} must be a positive integer." >&2
    exit 2
  }
done
[[ "${uploads_volume}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || {
  echo 'PROJECTWING_API_UPLOADS_VOLUME contains unsupported characters.' >&2
  exit 2
}
if (( startup_minimum_mib > steady_minimum_mib )); then
  echo 'Candidate startup safety margin cannot exceed the steady-state margin.' >&2
  exit 2
fi
case "${candidate_action}" in
  inspect|activate|migrate-and-activate) ;;
  *)
    echo "PROJECTWING_CANDIDATE_ACTION must be inspect, activate, or migrate-and-activate." >&2
    exit 2
    ;;
esac

for file in "${compose_file}" "${color_file}" "${backend_file}" "${release_dir}/deploy/traefik/dynamic/routing.yml" "${routing_renderer}" "${app_env}" "${oss_env}" "${registry_env}" "${acme_access_key}" "${acme_secret_key}"; do
  test -r "${file}"
done
test -r "${schema_library}"
# shellcheck source=blue-green-schema.sh
. "${schema_library}"
grep -q '^DATABASE_URL=' "${app_env}"
grep -q '^BETTER_AUTH_SECRET=' "${app_env}"

compose() {
  docker compose --project-name "projectwing-${color}" --env-file "${runtime_env}" \
    -f "${compose_file}" -f "${color_file}" -f "${backend_file}" "$@"
}

persist_secret() {
  local source="$1" target="$2" temporary
  [[ -f "${source}" && ! -L "${source}" ]] || {
    echo "Candidate secret source must be a regular non-symlink file: ${source}." >&2
    return 1
  }
  if [[ -e "${target}" ]]; then
    [[ -f "${target}" && ! -L "${target}" ]] || {
      echo "Candidate secret target must be a regular non-symlink file: ${target}." >&2
      return 1
    }
    if [[ "${source}" -ef "${target}" ]]; then
      chmod 600 "${target}"
      return
    fi
  fi
  temporary="$(mktemp "${release_dir}/secrets/.projectwing-secret.XXXXXX")"
  trap 'rm -f "${temporary}"' RETURN
  install -m 600 "${source}" "${temporary}"
  mv -f "${temporary}" "${target}"
  trap - RETURN
}

write_runtime_env() {
  install -d -m 700 "${release_dir}/secrets" "${candidate_dynamic_dir}"
  persist_secret "${app_env}" "${release_dir}/secrets/projectwing.env"
  persist_secret "${oss_env}" "${release_dir}/secrets/projectwing-oss.env"
  persist_secret "${registry_env}" "${release_dir}/secrets/projectwing-registry.env"
  persist_secret "${acme_access_key}" "${release_dir}/secrets/traefik-alidns-access-key"
  persist_secret "${acme_secret_key}" "${release_dir}/secrets/traefik-alidns-secret-key"
  PROJECTWING_RELEASE_DIR="${release_dir}" PROJECTWING_CANDIDATE_DYNAMIC_DIR="${candidate_dynamic_dir}" \
    bash "${routing_renderer}"
  {
    cat "${registry_env}"
    printf 'PROJECTWING_COLOR=%s\n' "${color}"
    printf 'PROJECTWING_PROXY_NETWORK=projectwing-proxy\n'
    printf 'PROJECTWING_TRAEFIK_DYNAMIC_DIR=%s\n' "${candidate_dynamic_dir}"
    printf 'PROJECTWING_TRAEFIK_CONFIG_FILE=%s\n' "${release_dir}/deploy/traefik/traefik.yml"
    printf 'PROJECTWING_BACKEND_TRAEFIK_CONFIG_FILE=%s\n' "${release_dir}/deploy/blue-green/traefik-backend.yml"
    printf 'PROJECTWING_BACKEND_BIND_ADDRESS=%s\n' "${backend_address}"
    printf 'PROJECTWING_BACKEND_HTTP_PORT=%s\n' "${backend_port}"
    printf 'PROJECTWING_API_UPLOADS_VOLUME=%s\n' "${uploads_volume}"
  } > "${runtime_env}"
  chmod 600 "${runtime_env}"
}

require_images() {
  set -a
  . "${registry_env}"
  set +a
  local image_var
  for image_var in PROJECTWING_TRAEFIK_IMAGE PROJECTWING_GOTENBERG_IMAGE PROJECTWING_API_IMAGE PROJECTWING_EMP_IMAGE PROJECTWING_CMP_IMAGE PROJECTWING_SHOWROOM_IMAGE PROJECTWING_TMS_IMAGE PROJECTWING_INTRANET_IMAGE PROJECTWING_IB_IMAGE PROJECTWING_IB_API_IMAGE; do
    docker image inspect "${!image_var}" >/dev/null
  done
}

container_ready() {
  local service="$1" id state
  id="$(compose ps -q "${service}")"
  [[ -n "${id}" ]] || return 1
  state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${id}")"
  [[ "${state}" == healthy || "${state}" == running ]]
}

wait_for_candidate() {
  local attempt service
  for attempt in $(seq 1 36); do
    for service in "${services[@]}"; do
      container_ready "${service}" || break
    done
    [[ "${service}" == backend-gateway ]] && return 0
    sleep 5
  done
  compose ps >&2 || true
  return 1
}

wait_for_service() {
  local service="$1" attempt
  for attempt in $(seq 1 36); do
    if container_ready "${service}"; then
      return 0
    fi
    sleep 5
  done
  echo "Candidate ${color} service ${service} did not become ready." >&2
  compose ps "${service}" >&2 || true
  return 1
}

require_host_safety_margin() {
  local minimum_mib="$1" phase="$2" available_kib
  available_kib="$(grep '^MemAvailable:' /proc/meminfo | tr -cd '0-9')"
  [[ "${available_kib}" =~ ^[0-9]+$ ]]
  if (( available_kib < minimum_mib * 1024 )); then
    echo "Candidate ${color} exhausted its ${phase} host safety margin: $((available_kib / 1024)) MiB available, minimum ${minimum_mib} MiB." >&2
    return 1
  fi
  systemctl is-active --quiet netbird.service
  timeout --foreground 15 netbird status 2>&1 | grep -q 'Management: Connected'
  echo "Candidate ${color} ${phase} host safety margin: $((available_kib / 1024)) MiB available."
}

verify_prisma_studio() {
  local asset_result asset_status asset_type status studio_body
  echo "Verifying candidate ${color} Prisma Studio route."
  studio_body="$(mktemp)"
  if ! status="$(curl --noproxy '*' --silent --show-error \
    --connect-timeout 5 --max-time 30 --retry 2 --retry-all-errors --retry-delay 2 \
    --header 'Host: db.superfx.cn' --header 'X-Forwarded-Proto: https' \
    --output "${studio_body}" --write-out '%{http_code}' "http://${backend_address}:${backend_port}/")"; then
    rm -f -- "${studio_body}"
    echo "Candidate ${color} Prisma Studio route was unavailable." >&2
    return 1
  fi
  if [[ "${status}" != 200 ]] \
    || ! grep -Fq 'window.__STUDIO_CONFIG__' "${studio_body}" \
    || ! grep -Eq '"adapter"[[:space:]]*:[[:space:]]*"postgres"' "${studio_body}" \
    || ! grep -Fq 'src="/studio.js"' "${studio_body}"; then
    rm -f -- "${studio_body}"
    echo "Candidate ${color} gateway failed Prisma Studio identity verification (HTTP ${status})." >&2
    return 1
  fi
  rm -f -- "${studio_body}"
  if ! asset_result="$(curl --noproxy '*' --silent --show-error \
    --connect-timeout 5 --max-time 30 --retry 2 --retry-all-errors --retry-delay 2 \
    --header 'Host: db.superfx.cn' --header 'X-Forwarded-Proto: https' \
    --output /dev/null --write-out '%{http_code} %{content_type}' "http://${backend_address}:${backend_port}/studio.js")"; then
    echo "Candidate ${color} Prisma Studio asset was unavailable." >&2
    return 1
  fi
  read -r asset_status asset_type <<<"${asset_result}"
  [[ "${asset_status}" == 200 && "${asset_type}" == *javascript* ]] || {
    echo "Candidate ${color} Prisma Studio asset returned ${asset_status} (${asset_type:-unknown})." >&2
    return 1
  }
  echo "Candidate ${color} Prisma Studio identity and asset returned 200."
}

verify_gateway() {
  local host status
  for host in wing.superfx.cn cmp.superfx.cn showroom.superfx.cn tms.superfx.cn intranet.superfx.cn ib.superfx.cn; do
    echo "Verifying candidate ${color} headers for ${host}."
    status="$(curl --noproxy '*' --silent --show-error --head --location --max-redirs 3 \
      --connect-timeout 5 --max-time 30 --retry 2 --retry-all-errors --retry-delay 2 \
      --header "Host: ${host}" --header 'X-Forwarded-Proto: https' \
      --output /dev/null --write-out '%{http_code}' "http://${backend_address}:${backend_port}/")"
    [[ "${status}" =~ ^2[0-9]{2}$ ]] || {
      echo "Candidate ${color} gateway returned ${status} for ${host}." >&2
      return 1
    }
    echo "Candidate ${color} gateway returned ${status} for ${host}."
  done
  verify_prisma_studio
  echo "Verifying candidate ${color} API health."
  status="$(curl --noproxy '*' --silent --show-error --location --max-redirs 3 \
    --connect-timeout 5 --max-time 30 --retry 2 --retry-all-errors --retry-delay 2 \
    --header 'Host: wing.superfx.cn' --header 'X-Forwarded-Proto: https' \
    --output /dev/null --write-out '%{http_code}' "http://${backend_address}:${backend_port}/api/healthz")"
  [[ "${status}" == 200 ]] || {
    echo "Candidate ${color} gateway returned ${status} for API health." >&2
    return 1
  }
  echo "Candidate ${color} API health returned ${status}."
}

cleanup_failed_candidate() {
  local status="$?" image_var
  trap - EXIT
  if [[ "${status}" -ne 0 ]]; then
    compose down --remove-orphans || true
    set -a
    . "${registry_env}"
    set +a
    for image_var in PROJECTWING_TRAEFIK_IMAGE PROJECTWING_GOTENBERG_IMAGE PROJECTWING_API_IMAGE PROJECTWING_EMP_IMAGE PROJECTWING_CMP_IMAGE PROJECTWING_SHOWROOM_IMAGE PROJECTWING_TMS_IMAGE PROJECTWING_INTRANET_IMAGE PROJECTWING_IB_IMAGE PROJECTWING_IB_API_IMAGE; do
      docker image rm "${!image_var}" >/dev/null 2>&1 || true
    done
    echo "Candidate ${color} failed; its containers were stopped and only its imported images were removed." >&2
  fi
  exit "${status}"
}

trap cleanup_failed_candidate EXIT
docker network inspect projectwing-proxy >/dev/null 2>&1 || docker network create projectwing-proxy >/dev/null
write_runtime_env
require_images
docker volume inspect "${uploads_volume}" >/dev/null 2>&1 || docker volume create --name "${uploads_volume}" >/dev/null
schema_status="$(inspect_database_schema)"
if [[ "${candidate_action}" == inspect ]]; then
  echo "Database schema status: ${schema_status}."
  trap - EXIT
  exit 0
fi
if [[ "${candidate_action}" == activate && "${schema_status}" != current ]]; then
  echo 'Candidate activation without maintenance requires a current database schema.' >&2
  exit 1
fi
if [[ "${candidate_action}" == migrate-and-activate ]]; then
  [[ "${schema_status}" == pending ]] || {
    echo 'Migrate-and-activate requires pending migrations.' >&2
    exit 1
  }
  migrate_database_schema
fi
echo "Starting candidate ${color} containers sequentially with a ${startup_minimum_mib} MiB startup safety margin."
for service in "${services[@]}"; do
  echo "Starting candidate ${color} service ${service}."
  compose up -d --no-build --pull never --force-recreate --no-deps "${service}"
  echo "Waiting for candidate ${color} service ${service} to become ready."
  wait_for_service "${service}"
  require_host_safety_margin "${startup_minimum_mib}" startup
done
wait_for_candidate
echo "Waiting ${settle_seconds}s before enforcing the ${steady_minimum_mib} MiB steady-state safety margin."
sleep "${settle_seconds}"
require_host_safety_margin "${steady_minimum_mib}" steady-state
verify_gateway
trap - EXIT
printf 'candidate_color=%s\n' "${color}"
printf 'candidate_gateway=http://%s:%s\n' "${backend_address}" "${backend_port}"
