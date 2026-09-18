#!/usr/bin/env bash
set -euo pipefail

if (( $# == 0 )); then
  echo "Usage: $0 <command> [args...]" >&2
  exit 2
fi

postgres_image="${PROJECTWING_VALIDATION_POSTGRES_IMAGE:-postgres:16-alpine}"
container_name="projectwing-validation-postgres-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-$$"
stale_after_seconds="${PROJECTWING_VALIDATION_POSTGRES_STALE_SECONDS:-21600}"

[[ "${stale_after_seconds}" =~ ^[1-9][0-9]*$ ]] || {
  echo 'PROJECTWING_VALIDATION_POSTGRES_STALE_SECONDS must be a positive integer.' >&2
  exit 2
}

cleanup_stale_containers() {
  local id name created created_epoch age now
  now="$(date +%s)"
  while IFS= read -r id; do
    [[ -n "${id}" ]] || continue
    name="$(docker inspect --format '{{.Name}}' "${id}")"
    name="${name#/}"
    [[ "${name}" == projectwing-validation-postgres-* && "${name}" != "${container_name}" ]] || continue
    created="$(docker inspect --format '{{.Created}}' "${id}")"
    created_epoch="$(date -d "${created}" +%s)" || continue
    age="$((now - created_epoch))"
    if (( age >= stale_after_seconds )); then
      echo "Removing stale validation PostgreSQL container ${name} (${age}s old)."
      docker rm --force --volumes "${id}" >/dev/null
    fi
  done < <(docker ps --all --quiet --filter 'name=^/projectwing-validation-postgres-')
}

cleanup() {
  docker rm --force "${container_name}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup_stale_containers

echo "Starting ephemeral PostgreSQL for migration validation."
docker run --detach --rm \
  --name "${container_name}" \
  --label com.projectwing.ci.resource=validation-postgres \
  --label "com.projectwing.ci.run-id=${GITHUB_RUN_ID:-local}" \
  --label "com.projectwing.ci.run-attempt=${GITHUB_RUN_ATTEMPT:-1}" \
  --env POSTGRES_USER=projectwing \
  --env POSTGRES_PASSWORD=projectwing \
  --env POSTGRES_DB=projectwing \
  --publish 127.0.0.1::5432 \
  "${postgres_image}" >/dev/null

port_binding="$(docker port "${container_name}" 5432/tcp)"
postgres_port="${port_binding##*:}"
if [[ ! "${postgres_port}" =~ ^[0-9]+$ ]]; then
  echo "Unable to resolve the ephemeral PostgreSQL port from: ${port_binding}" >&2
  exit 1
fi

host_port_ready() {
  if exec 3<>"/dev/tcp/127.0.0.1/${postgres_port}"; then
    exec 3>&-
    exec 3<&-
    return 0
  fi
  return 1
}

for attempt in {1..30}; do
  if docker exec "${container_name}" pg_isready --username projectwing --dbname projectwing >/dev/null 2>&1 &&
    host_port_ready 2>/dev/null; then
    break
  fi
  if (( attempt == 30 )); then
    echo "Ephemeral PostgreSQL did not become ready." >&2
    docker logs "${container_name}" >&2
    exit 1
  fi
  sleep 1
done

export DATABASE_URL="postgresql://projectwing:projectwing@127.0.0.1:${postgres_port}/projectwing?schema=public"
echo "Ephemeral PostgreSQL is ready; running migration validation."
"$@"
