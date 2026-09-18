#!/usr/bin/env bash
set -Eeuo pipefail

release_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
project_root="${PROJECTWING_ROOT:-/opt/projectwing}"
bundle_dir="${release_dir}/.oss-image-bundle"
bundle_path="${bundle_dir}/images.tar.gz"
health_library="${release_dir}/scripts/ci/deployment-health.sh"
expected_sha256="${PROJECTWING_OSS_IMAGE_BUNDLE_SHA256:?PROJECTWING_OSS_IMAGE_BUNDLE_SHA256 is required}"
object_key="${PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY:?PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY is required}"
operation="${PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION:-deploy}"
oss_env_file="${PROJECTWING_OSS_ENV_FILE:?PROJECTWING_OSS_ENV_FILE is required}"
registry_env_file="${PROJECTWING_REGISTRY_ENV_FILE:-}"
deploy_archive_file="${PROJECTWING_DEPLOY_ARCHIVE_FILE:?PROJECTWING_DEPLOY_ARCHIVE_FILE is required}"
deployment_lock_file="${PROJECTWING_DEPLOY_LOCK_FILE:-${project_root}/deployment.lock}"
blue_green_controller="${release_dir}/scripts/ci/blue-green-controller.sh"
capacity_reclaimer="${release_dir}/scripts/ci/reclaim-blue-green-capacity.sh"
provenance_library="${release_dir}/scripts/ci/image-bundle-provenance.sh"
bundle_size_expected="${PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES:-}"
bundle_uncompressed_size="${PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES:-}"

: "${PROJECTWING_VERSION:?PROJECTWING_VERSION is required}"
: "${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"

if [[ ! "${expected_sha256}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "PROJECTWING_OSS_IMAGE_BUNDLE_SHA256 must be a lowercase SHA-256." >&2
  exit 2
fi
if [[ ! "${object_key}" =~ ^ci-images/[a-f0-9]{40}/images\.tar\.gz$ ]]; then
  echo "PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY has an unexpected format." >&2
  exit 2
fi
if [[ "${operation}" != load-only && "${operation}" != deploy && "${operation}" != activate-preloaded ]]; then
  echo "PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION must be load-only, deploy, or activate-preloaded." >&2
  exit 2
fi
if [[ ! "${PROJECTWING_RELEASE_KEY}" =~ ^${PROJECTWING_VERSION}-[0-9]+-[1-9][0-9]*$ \
  || "$(basename "${release_dir}")" != "${PROJECTWING_RELEASE_KEY}" ]]; then
  echo "OSS activation requires a unique <git-sha>-<run-id>-<run-attempt> release directory." >&2
  exit 2
fi
session_suffix="${PROJECTWING_RELEASE_KEY#${PROJECTWING_VERSION}-}"

test -r "${health_library}"
# shellcheck source=deployment-health.sh
. "${health_library}"
if [[ "${operation}" == deploy || "${operation}" == activate-preloaded ]]; then
  : "${registry_env_file:?PROJECTWING_REGISTRY_ENV_FILE is required for deploy operation}"
  test -f "${registry_env_file}"
  set -a
  # shellcheck source=/dev/null
  . "${registry_env_file}"
  set +a
  pw_require_full_deploy_scope "${PROJECTWING_DEPLOY_SYSTEMS:-}"
  test -r "${blue_green_controller}"
  test -x "${capacity_reclaimer}"
fi
if [[ "${operation}" == deploy || "${operation}" == activate-preloaded ]]; then
  : "${PROJECTWING_IMAGE_SOURCE_SHA:?PROJECTWING_IMAGE_SOURCE_SHA is required for image activation}"
  test -r "${provenance_library}"
  # shellcheck source=image-bundle-provenance.sh
  . "${provenance_library}"
fi

cleanup_bundle() {
  rm -rf "${bundle_dir}"
}

cleanup_ephemeral_session_file() {
  local actual="$1"
  local expected="$2"
  shift 2
  local actual_path canonical canonical_path expected_path

  if [[ -z "${actual}" ]]; then
    return 0
  fi
  actual_path="$(realpath -ms "${actual}")"
  expected_path="$(realpath -ms "${expected}")"
  for canonical in "$@"; do
    [[ -n "${canonical}" ]] || continue
    canonical_path="$(realpath -ms "${canonical}")"
    if [[ "${actual_path}" == "${canonical_path}" ]]; then
      return 0
    fi
  done
  if [[ "${actual_path}" != "${expected_path}" ]]; then
    echo "Refusing to remove unexpected deployment session file: ${actual_path}." >&2
    return 1
  fi
  rm -f -- "${expected_path}"
}

cleanup_wrapper() {
  local status="$?"
  trap - EXIT
  set +e
  cleanup_bundle
  cleanup_ephemeral_session_file "${deploy_archive_file}" \
    "${project_root}/projectwing-oss-image-bundle-deploy-${session_suffix}.tar.gz" \
    "${release_dir}/docker-compose.development.yml"
  cleanup_ephemeral_session_file "${PROJECTWING_APP_ENV_FILE-}" \
    "${project_root}/projectwing-${session_suffix}.env" "${project_root}/secrets/projectwing.env" \
    "${release_dir}/secrets/projectwing.env"
  cleanup_ephemeral_session_file "${oss_env_file}" \
    "${project_root}/projectwing-oss-${session_suffix}.env" "${project_root}/secrets/projectwing-oss.env" \
    "${release_dir}/secrets/projectwing-oss.env"
  cleanup_ephemeral_session_file "${registry_env_file}" \
    "${project_root}/projectwing-images-${session_suffix}.env" "${project_root}/secrets/projectwing-registry.env" \
    "${release_dir}/secrets/projectwing-registry.env"
  cleanup_ephemeral_session_file "${PROJECTWING_TRAEFIK_ACME_ACCESS_KEY_FILE-}" \
    "${project_root}/projectwing-traefik-access-key-${session_suffix}" "${project_root}/secrets/traefik-alidns-access-key" \
    "${release_dir}/secrets/traefik-alidns-access-key"
  cleanup_ephemeral_session_file "${PROJECTWING_TRAEFIK_ACME_SECRET_KEY_FILE-}" \
    "${project_root}/projectwing-traefik-secret-key-${session_suffix}" "${project_root}/secrets/traefik-alidns-secret-key" \
    "${release_dir}/secrets/traefik-alidns-secret-key"
  exit "${status}"
}

acquire_deployment_lock() {
  command -v flock >/dev/null
  mkdir -p "$(dirname "${deployment_lock_file}")"
  exec 9>"${deployment_lock_file}"
  if ! flock --nonblock 9; then
    echo "Another ProjectWing deployment holds ${deployment_lock_file}; refusing concurrent bundle preparation." >&2
    exit 75
  fi
  export PROJECTWING_DEPLOY_LOCK_FILE="${deployment_lock_file}"
  export PROJECTWING_DEPLOY_LOCK_INHERITED="${PROJECTWING_RELEASE_KEY}"
  echo "Acquired exclusive ProjectWing deployment lock before capacity reclamation and bundle import: ${deployment_lock_file}."
}

require_candidate_capacity() {
  local available_kib minimum_mib minimum_kib
  minimum_mib="${PROJECTWING_BLUE_GREEN_MIN_AVAILABLE_MIB:-768}"
  if [[ ! "${minimum_mib}" =~ ^[1-9][0-9]*$ ]]; then
    echo "PROJECTWING_BLUE_GREEN_MIN_AVAILABLE_MIB must be a positive integer." >&2
    exit 2
  fi

  available_kib="$(grep '^MemAvailable:' /proc/meminfo | tr -cd '0-9')"
  if [[ ! "${available_kib}" =~ ^[0-9]+$ ]]; then
    echo 'Cannot determine host MemAvailable before candidate activation.' >&2
    exit 1
  fi
  minimum_kib=$((minimum_mib * 1024))

  if ! systemctl is-active --quiet docker.service; then
    echo 'Docker must be active before candidate activation.' >&2
    exit 1
  fi
  if ! systemctl is-active --quiet netbird.service; then
    echo 'NetBird must be active before candidate activation.' >&2
    exit 1
  fi
  if ! netbird status 2>&1 | grep -q 'Management: Connected'; then
    echo 'NetBird management must be connected before candidate activation.' >&2
    exit 1
  fi
  if (( available_kib < minimum_kib )); then
    echo "Refusing candidate activation: host has $((available_kib / 1024)) MiB available; ${minimum_mib} MiB host safety margin is required for remote operations." >&2
    exit 1
  fi
  echo "Candidate capacity preflight passed: $((available_kib / 1024)) MiB available (minimum ${minimum_mib} MiB)."
}

reclaim_candidate_capacity() {
  local mode="${1:-bundle}" reserve_bytes minimum_bytes
  reserve_bytes="${PROJECTWING_DISK_SAFETY_RESERVE_BYTES:-2147483648}"
  for value_name in bundle_size_expected bundle_uncompressed_size reserve_bytes; do
    value="${!value_name}"
    [[ "${value}" =~ ^[1-9][0-9]*$ && "${#value}" -le 18 ]] || {
      echo "${value_name} must be a positive byte count." >&2
      return 2
    }
  done
  if [[ "${mode}" == preloaded ]]; then
    minimum_bytes="${reserve_bytes}"
  elif [[ "${mode}" == bundle ]]; then
    minimum_bytes=$((bundle_size_expected + bundle_uncompressed_size + reserve_bytes))
    (( minimum_bytes > bundle_size_expected && minimum_bytes > bundle_uncompressed_size )) || {
      echo 'Computed disk capacity requirement overflowed.' >&2
      return 2
    }
  else
    echo 'Candidate capacity mode must be preloaded or bundle.' >&2
    return 2
  fi
  echo "Reclaiming stopped candidate resources; requiring ${minimum_bytes} available bytes for ${mode} delivery."
  PROJECTWING_MIN_AVAILABLE_BYTES="${minimum_bytes}" bash "${capacity_reclaimer}"
}

download_bundle() {
  local attempt date_value endpoint signature

  mkdir -p "${bundle_dir}"
  set -a
  # shellcheck source=/dev/null
  . "${oss_env_file}"
  set +a
  endpoint="${OSS_ENDPOINT}"
  if [[ "${OSS_USE_INTERNAL_ENDPOINT:-false}" == "true" ]]; then
    endpoint="${OSS_INTERNAL_ENDPOINT:-${OSS_ENDPOINT}}"
  fi
  endpoint="${endpoint#https://}"
  endpoint="${endpoint#http://}"
  endpoint="${endpoint%/}"

  for attempt in $(seq 1 3); do
    rm -f "${bundle_path}"
    echo "OSS image bundle download: object=${object_key}, attempt=${attempt}/3."
    date_value="$(LC_ALL=C TZ=GMT date '+%a, %d %b %Y %H:%M:%S GMT')"
    signature="$(
      printf 'GET\n\n\n%s\n/%s/%s' "${date_value}" "${OSS_BUCKET}" "${object_key}" \
        | openssl dgst -sha1 -hmac "${OSS_ACCESS_KEY_SECRET}" -binary \
        | base64
    )"
    if curl --fail --show-error --progress-bar --location \
      --connect-timeout 15 --max-time 900 \
      --header "Date: ${date_value}" \
      --header "Authorization: OSS ${OSS_ACCESS_KEY_ID}:${signature}" \
      "https://${OSS_BUCKET}.${endpoint}/${object_key}" \
      --output "${bundle_path}" \
      --write-out "OSS image bundle download completed: %{size_download} bytes in %{time_total}s.\n"; then
      return 0
    fi
    echo "OSS image bundle download failed on attempt ${attempt}/3." >&2
    sleep $((attempt * 2))
  done
  return 1
}

trap cleanup_wrapper EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

test -f "${oss_env_file}"
acquire_deployment_lock
if [[ "${operation}" == activate-preloaded ]]; then
  reclaim_candidate_capacity preloaded
  require_candidate_capacity
  verified_required_images_present || {
    echo 'Preloaded images no longer match the verified bundle provenance.' >&2
    exit 1
  }
  export PROJECTWING_IMAGE_DELIVERY=preloaded
  export PROJECTWING_RELEASE_DIR="${release_dir}"
  bash "${blue_green_controller}"
  exit 0
fi
if [[ "${operation}" == "deploy" ]]; then
  reclaim_candidate_capacity preloaded
  require_candidate_capacity
  if verified_required_images_present; then
    echo 'All release images match verified local bundle provenance; skipping OSS download and Docker import.'
    export PROJECTWING_IMAGE_DELIVERY=preloaded
    export PROJECTWING_RELEASE_DIR="${release_dir}"
    bash "${blue_green_controller}"
    exit 0
  fi
  echo 'Verified local image provenance is absent or stale; loading the immutable OSS bundle.'
  export PROJECTWING_RELEASE_DIR="${release_dir}"
  reclaim_candidate_capacity bundle
  require_candidate_capacity
fi
download_bundle
actual_sha256="$(sha256sum "${bundle_path}" | cut -d ' ' -f1)"
if [[ "${actual_sha256}" != "${expected_sha256}" ]]; then
  echo "OSS image bundle checksum mismatch: expected ${expected_sha256}, got ${actual_sha256}." >&2
  exit 1
fi
echo "OSS image bundle checksum verified: sha256 ${actual_sha256}."
bundle_size_bytes="$(stat -c '%s' "${bundle_path}")"
if [[ -n "${bundle_size_expected}" && "${bundle_size_bytes}" != "${bundle_size_expected}" ]]; then
  echo "OSS image bundle size mismatch: expected ${bundle_size_expected}, got ${bundle_size_bytes}." >&2
  exit 1
fi
echo "OSS image bundle image import: starting."
gzip -dc "${bundle_path}" | docker load
echo "OSS image bundle image import: completed."
rm -f "${bundle_path}"
echo "Removed ${bundle_size_bytes}-byte compressed bundle immediately after successful image import."

if [[ "${operation}" == deploy ]]; then
  record_verified_image_bundle
  verified_required_images_present || {
    echo 'Loaded images did not match the recorded verified bundle provenance.' >&2
    exit 1
  }
fi

if [[ "${operation}" == "load-only" ]]; then
  echo "OSS image bundle downloaded, verified, and loaded without activating services."
  exit 0
fi

export PROJECTWING_IMAGE_DELIVERY=preloaded
export PROJECTWING_RELEASE_DIR="${release_dir}"
bash "${blue_green_controller}"
