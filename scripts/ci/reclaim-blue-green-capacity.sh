#!/usr/bin/env bash
set -Eeuo pipefail

project_root="${PROJECTWING_ROOT:-/opt/projectwing}"
releases_root="${project_root}/releases"
deployment_lock_file="${PROJECTWING_DEPLOY_LOCK_FILE:-${project_root}/deployment.lock}"
candidate_color="${PROJECTWING_COLOR:?PROJECTWING_COLOR is required}"
candidate_release_key="${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"
candidate_release_dir="${PROJECTWING_RELEASE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
deployment_lock_fd=9
release_tree_validator="${PROJECTWING_RELEASE_TREE_VALIDATOR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/validate-blue-green-release-tree.sh}"
release_retention_count="${PROJECTWING_RELEASE_RETENTION_COUNT:-0}"
minimum_available_bytes="${PROJECTWING_MIN_AVAILABLE_BYTES:-5368709120}"
minimum_available_inodes="${PROJECTWING_MIN_AVAILABLE_INODES:-10000}"
declare -A protected_image_ids=()
declare -A protected_release_dirs=()

case "${candidate_color}" in
  blue|green) ;;
  *) echo "PROJECTWING_COLOR must be blue or green." >&2; exit 2 ;;
esac
[[ "${candidate_release_key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]] || {
  echo "PROJECTWING_RELEASE_KEY has an unexpected format." >&2
  exit 2
}
[[ "${release_retention_count}" =~ ^[0-9]+$ ]] || {
  echo "release_retention_count must be a non-negative integer." >&2
  exit 2
}
for value_name in minimum_available_bytes minimum_available_inodes; do
  value="${!value_name}"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || {
    echo "${value_name} must be a positive integer." >&2
    exit 2
  }
done
is_candidate_service() {
  case "$1" in
    gotenberg|api|prisma-studio|emp|cmp|showroom|tms|intranet|ib-api|ib|backend-gateway) return 0 ;;
    *) return 1 ;;
  esac
}
is_managed_project() {
  [[ "$1" == "projectwing-blue" || "$1" == "projectwing-green" || "$1" == "projectwing-edge" ]]
}
is_owned_immutable_image_ref() {
  local repository="$1" tag="$2"
  case "${repository}" in
    projectwing-api|projectwing-emp|projectwing-cmp|projectwing-showroom|projectwing-tms|projectwing-intranet|projectwing-ib|projectwing-ib-api)
      [[ "${tag}" =~ ^[a-f0-9]{40}$ ]] ;;
    projectwing-gotenberg)
      [[ "${tag}" =~ ^[a-f0-9]{40}$ || "${tag}" =~ ^[a-f0-9]{64}$ ]] ;;
    *) return 1 ;;
  esac
}
is_desired_image_ref() {
  local ref="$1" desired
  for desired in \
    "${PROJECTWING_API_IMAGE-}" "${PROJECTWING_EMP_IMAGE-}" \
    "${PROJECTWING_CMP_IMAGE-}" "${PROJECTWING_SHOWROOM_IMAGE-}" \
    "${PROJECTWING_TMS_IMAGE-}" "${PROJECTWING_INTRANET_IMAGE-}" \
    "${PROJECTWING_IB_IMAGE-}" "${PROJECTWING_IB_API_IMAGE-}" \
    "${PROJECTWING_GOTENBERG_IMAGE-}"; do
    [[ -n "${desired}" && "${ref}" == "${desired}" ]] && return 0
  done
  return 1
}

verify_inherited_deployment_lock() {
  local actual_target expected_target fd_path
  [[ "${PROJECTWING_DEPLOY_LOCK_INHERITED:-}" == "${candidate_release_key}" ]] || {
    echo 'Capacity reclamation requires the release-key-scoped deployment lock.' >&2
    return 1
  }
  command -v flock >/dev/null
  fd_path="/proc/$$/fd/${deployment_lock_fd}"
  [[ -e "${fd_path}" ]] || {
    echo "Capacity reclamation could not find inherited deployment lock fd ${deployment_lock_fd}." >&2
    return 1
  }
  actual_target="$(readlink -f "${fd_path}")"
  expected_target="$(readlink -f "${deployment_lock_file}")"
  [[ -n "${actual_target}" && "${actual_target}" == "${expected_target}" ]] || {
    echo 'Capacity reclamation inherited an unexpected deployment lock target.' >&2
    return 1
  }
  flock --nonblock "${deployment_lock_fd}" || {
    echo 'Capacity reclamation does not own the deployment lock.' >&2
    return 1
  }
}

release_dir_for_key() {
  local key="$1" resolved releases_path
  [[ "${key}" =~ ^[a-f0-9]{40}$ || "${key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]] || return 1
  resolved="$(realpath -m "${releases_root}/${key}")"
  releases_path="$(realpath -m "${releases_root}")"
  [[ "$(dirname "${resolved}")" == "${releases_path}" && "$(basename "${resolved}")" == "${key}" ]] || return 1
  printf '%s\n' "${resolved}"
}

verify_candidate_release_dir() {
  local expected actual
  expected="$(release_dir_for_key "${candidate_release_key}")" || return 1
  actual="$(realpath -m "${candidate_release_dir}")"
  [[ "${actual}" == "${expected}" && -d "${actual}" && ! -L "${candidate_release_dir}" ]] || {
    echo "Candidate release directory is outside the expected release key: ${candidate_release_dir}." >&2
    return 1
  }
}

protect_release_key() {
  local key="$1" resolved
  [[ -n "${key}" ]] || return 0
  resolved="$(release_dir_for_key "${key}")" || {
    echo "Refusing to trust unexpected release key: ${key}." >&2
    return 1
  }
  if [[ ! -e "${resolved}" && ! -L "${resolved}" ]]; then
    return 0
  fi
  [[ -d "${resolved}" && ! -L "${resolved}" ]] || {
    echo "Refusing to trust missing or symlinked release directory: ${resolved}." >&2
    return 1
  }
  protected_release_dirs["${resolved}"]=1
}

protect_working_dir() {
  local working_dir="$1" resolved releases_path
  [[ -n "${working_dir}" ]] || return 0
  resolved="$(realpath -m "${working_dir}")"
  releases_path="$(realpath -m "${releases_root}")"
  [[ "$(dirname "${resolved}")" == "${releases_path}" ]] || return 0
  [[ "$(basename "${resolved}")" =~ ^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$ ]] || return 0
  [[ -d "${resolved}" && ! -L "${working_dir}" ]] && protected_release_dirs["${resolved}"]=1
}

collect_retained_containers() {
  local id project service image_id working_dir running status
  local output
  output="$(docker ps -aq)" || { echo 'Could not enumerate containers.' >&2; return 1; }
  while IFS= read -r id; do
    [[ -n "${id}" ]] || continue
    project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${id}")"
    service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${id}")"
    image_id="$(docker inspect --format '{{.Image}}' "${id}")"
    [[ "${image_id}" =~ ^sha256:[a-f0-9]{64}$ ]] || {
      echo "Container ${id} exposed an unexpected image ID: ${image_id:-<missing>}." >&2
      return 1
    }
    running="$(docker inspect --format '{{.State.Running}}' "${id}")"
    status="$(docker inspect --format '{{.State.Status}}' "${id}")"
    [[ "${running}" == true || "${running}" == false ]] || {
      echo "Could not determine running state for ${project}/${service} (${id})." >&2
      return 1
    }
    if [[ "${project}" == "projectwing-${candidate_color}" && "${running}" == false ]]; then
      is_candidate_service "${service}" || {
        echo "Refusing cleanup for unknown candidate service ${project}/${service:-<missing>} (${id})." >&2
        return 1
      }
      [[ "${status}" == exited || "${status}" == created || "${status}" == dead ]] || {
        echo "Refusing cleanup for unexpected stopped state ${status} (${id})." >&2
        return 1
      }
      continue
    fi
    protected_image_ids["${image_id}"]=1
    if is_managed_project "${project}"; then
      working_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${id}")"
      protect_working_dir "${working_dir}"
    fi
  done <<< "${output}"
}

remove_stopped_candidate_containers() {
  local output id project service running status
  local -a remove_ids=()
  output="$(docker ps -aq --filter "label=com.docker.compose.project=projectwing-${candidate_color}")" || {
    echo 'Could not enumerate candidate containers.' >&2; return 1;
  }
  while IFS= read -r id; do
    [[ -n "${id}" ]] || continue
    project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${id}")"
    [[ "${project}" == "projectwing-${candidate_color}" ]] || { echo "Unexpected candidate project: ${project}." >&2; return 1; }
    service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${id}")"
    is_candidate_service "${service}" || { echo "Refusing unknown candidate service ${service}." >&2; return 1; }
    running="$(docker inspect --format '{{.State.Running}}' "${id}")"
    status="$(docker inspect --format '{{.State.Status}}' "${id}")"
    if [[ "${running}" == false && ( "${status}" == exited || "${status}" == created || "${status}" == dead ) ]]; then
      remove_ids+=("${id}")
    elif [[ "${running}" != true ]]; then
      echo "Could not classify candidate container ${id} (${status})." >&2
      return 1
    fi
  done <<< "${output}"
  if [[ "${#remove_ids[@]}" -gt 0 ]]; then
    echo "Removing ${#remove_ids[@]} stopped ${candidate_color} containers without force or volume deletion."
    docker rm "${remove_ids[@]}"
  fi
}

collect_protected_release_keys() {
  local state_file="${PROJECTWING_EDGE_STATE_FILE:-${project_root}/edge/release.json}" state
  protect_release_key "${candidate_release_key}"
  protect_release_key "${PROJECTWING_ACTIVE_RELEASE_KEY:-}"
  protect_release_key "${PROJECTWING_PREVIOUS_RELEASE_KEY:-}"
  if [[ -e "${state_file}" ]]; then
    [[ -f "${state_file}" && ! -L "${state_file}" ]] || { echo 'Edge state path is not a regular file.' >&2; return 1; }
    state="$(cat "${state_file}")"
    command -v jq >/dev/null
    jq -e . >/dev/null <<< "${state}" || { echo 'Edge state is invalid JSON.' >&2; return 1; }
    protect_release_key "$(jq -r '.releaseKey // .activeReleaseKey // empty' <<< "${state}")"
    protect_release_key "$(jq -r '.previousReleaseKey // empty' <<< "${state}")"
    protect_release_key "$(jq -r '.pendingReleaseKey // empty' <<< "${state}")"
  fi
}

protect_release_images() {
  local release_dir registry_file ref repository tag image_id
  for release_dir in "${!protected_release_dirs[@]}"; do
    registry_file="${release_dir}/secrets/projectwing-registry.env"
    [[ ! -e "${registry_file}" && ! -L "${registry_file}" ]] && continue
    [[ -f "${registry_file}" && -r "${registry_file}" && ! -L "${registry_file}" ]] \
      || { echo "Protected release registry file is unsafe: ${registry_file}." >&2; return 1; }
    while IFS= read -r ref; do
      [[ -n "${ref}" ]] || continue
      repository="${ref%%:*}"; tag="${ref#*:}"
      is_owned_immutable_image_ref "${repository}" "${tag}" || continue
      image_id="$(docker image inspect --format '{{.Id}}' "${ref}" 2>/dev/null)" || continue
      [[ "${image_id}" =~ ^sha256:[a-f0-9]{64}$ ]] || return 1
      protected_image_ids["${image_id}"]=1
    done < <(sed -nE 's/^PROJECTWING_(API|EMP|CMP|SHOWROOM|TMS|INTRANET|IB|IB_API|GOTENBERG)_IMAGE=//p' "${registry_file}")
  done
}

reclaim_images() {
  local output row repository tag ref image_id
  output="$(docker image ls --format '{{.Repository}}|{{.Tag}}')" || { echo 'Could not enumerate images.' >&2; return 1; }
  while IFS='|' read -r repository tag; do
    [[ -n "${repository}" && -n "${tag}" ]] || continue
    is_owned_immutable_image_ref "${repository}" "${tag}" || continue
    ref="${repository}:${tag}"
    is_desired_image_ref "${ref}" && continue
    image_id="$(docker image inspect --format '{{.Id}}' "${ref}")"
    [[ "${image_id}" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "Unexpected image ID for ${ref}." >&2; return 1; }
    [[ -z "${protected_image_ids[${image_id}]:-}" ]] || continue
    echo "Removing unreferenced ProjectWing image tag ${ref}."
    docker image rm --no-prune "${ref}"
  done <<< "${output}"
}

reclaim_old_releases() {
  local releases_path candidate resolved base row retained=0 output
  releases_path="$(realpath -m "${releases_root}")"
  mkdir -p "${releases_path}"
  output="$(find "${releases_path}" -mindepth 1 -maxdepth 1 -type d -printf '%T@|%p\n' | sort -nr)" || {
    echo 'Could not enumerate release directories.' >&2
    return 1
  }
  while IFS= read -r row; do
    [[ -n "${row}" ]] || continue
    candidate="${row#*|}"
    resolved="$(realpath -m "${candidate}")"
    base="$(basename "${resolved}")"
    [[ "$(dirname "${resolved}")" == "${releases_path}" && -d "${resolved}" && ! -L "${candidate}" ]] || continue
    [[ "${base}" =~ ^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$ ]] || continue
    [[ -n "${protected_release_dirs[${resolved}]:-}" ]] && continue
    if (( retained < release_retention_count )); then retained=$((retained + 1)); continue; fi
    echo "Removing old unreferenced release directory ${resolved}."
    rm -rf -- "${resolved}"
  done <<< "${output}"
}

check_disk_capacity() {
  local available_bytes available_inodes
  available_bytes="$(df -P -B1 "${project_root}" | awk 'NR == 2 { print $4 }')"
  available_inodes="$(df -P -i "${project_root}" | awk 'NR == 2 { print $4 }')"
  [[ "${available_bytes}" =~ ^[0-9]+$ && "${available_inodes}" =~ ^[0-9]+$ ]] || {
    echo 'Could not determine available disk bytes and inodes.' >&2
    return 1
  }
  echo "ProjectWing capacity: ${available_bytes} bytes and ${available_inodes} inodes available."
  if (( available_bytes < minimum_available_bytes || available_inodes < minimum_available_inodes )); then
    echo "ProjectWing capacity is below the configured safety thresholds (${minimum_available_bytes} bytes, ${minimum_available_inodes} inodes)." >&2
    return 1
  fi
}

verify_inherited_deployment_lock
verify_candidate_release_dir
test -x "${release_tree_validator}"
PROJECTWING_RELEASES_ROOT="${releases_root}" bash "${release_tree_validator}"
collect_protected_release_keys
protect_release_images
collect_retained_containers
remove_stopped_candidate_containers
reclaim_images
reclaim_old_releases
check_disk_capacity
