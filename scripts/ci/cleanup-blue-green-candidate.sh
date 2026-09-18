#!/usr/bin/env bash
set -Eeuo pipefail

release_dir="${PROJECTWING_RELEASE_DIR:?PROJECTWING_RELEASE_DIR is required}"
release_key="${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"
color="${PROJECTWING_COLOR:?PROJECTWING_COLOR is required}"
cleanup_reason="${PROJECTWING_CLEANUP_REASON:-failed-candidate}"
runtime_env="${release_dir}/.env.runtime"
registry_env="${release_dir}/secrets/projectwing-registry.env"
compose_file="${release_dir}/docker-compose.development.yml"
color_file="${release_dir}/deploy/blue-green/docker-compose.color.yml"
backend_file="${release_dir}/deploy/blue-green/docker-compose.backend.yml"

[[ "${color}" == blue || "${color}" == green ]] || { echo 'Cleanup color must be blue or green.' >&2; exit 2; }
[[ "${cleanup_reason}" == failed-candidate || "${cleanup_reason}" == retired-previous ]] \
  || { echo 'Cleanup reason must be failed-candidate or retired-previous.' >&2; exit 2; }
[[ "${release_key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]] || { echo 'Cleanup release key is invalid.' >&2; exit 2; }
[[ "$(basename "${release_dir}")" == "${release_key}" && "$(dirname "${release_dir}")" == /opt/projectwing/releases ]] \
  || { echo 'Cleanup release directory is outside the immutable release root.' >&2; exit 2; }
for file in "${runtime_env}" "${registry_env}" "${compose_file}" "${color_file}" "${backend_file}"; do
  [[ -f "${file}" && -r "${file}" && ! -L "${file}" ]] || { echo "Cleanup input is unsafe: ${file}." >&2; exit 2; }
done

docker compose --project-name "projectwing-${color}" --env-file "${runtime_env}" \
  -f "${compose_file}" -f "${color_file}" -f "${backend_file}" down --remove-orphans

failed=0
while IFS= read -r image; do
  [[ -n "${image}" ]] || continue
  if [[ ! "${image}" =~ ^projectwing-(api|emp|cmp|showroom|tms|intranet|ib|ib-api):[a-f0-9]{40}$ \
    && ! "${image}" =~ ^projectwing-gotenberg:([a-f0-9]{40}|[a-f0-9]{64})$ ]]; then
    continue
  fi
  docker image inspect "${image}" >/dev/null 2>&1 || continue
  docker image rm --no-prune "${image}" || failed=1
done < <(sed -nE 's/^PROJECTWING_(API|EMP|CMP|SHOWROOM|TMS|INTRANET|IB|IB_API|GOTENBERG)_IMAGE=//p' "${registry_env}")

(( failed == 0 )) || { echo 'Candidate cleanup left one or more immutable image tags in use.' >&2; exit 1; }
echo "Removed ${cleanup_reason} ${color} containers and unreferenced immutable image tags."
