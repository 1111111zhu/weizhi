#!/usr/bin/env bash

set -euo pipefail

node --test scripts/ci/next-app-build-contract.test.mjs

declare -a BUILD_NAMES=()
declare -a BUILD_PIDS=()
declare -a BUILDX_BUILD_ARGS=()
MAX_BUILD_CONCURRENCY="${PROJECTWING_REGISTRY_BUILD_CONCURRENCY:-1}"
MAX_BUILD_ATTEMPTS="${PROJECTWING_REGISTRY_BUILD_ATTEMPTS:-3}"
BUILD_RETRY_DELAY_SECONDS="${PROJECTWING_REGISTRY_BUILD_RETRY_DELAY_SECONDS:-10}"
IMAGE_EXPORT="${PROJECTWING_IMAGE_EXPORT:-push}"
PERSISTENT_BUILDX_BUILDER=""

if ! [[ "${MAX_BUILD_CONCURRENCY}" =~ ^[1-9][0-9]*$ ]]; then
  echo "PROJECTWING_REGISTRY_BUILD_CONCURRENCY must be a positive integer." >&2
  exit 2
fi
if ! [[ "${MAX_BUILD_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "PROJECTWING_REGISTRY_BUILD_ATTEMPTS must be a positive integer." >&2
  exit 2
fi
if ! [[ "${BUILD_RETRY_DELAY_SECONDS}" =~ ^[0-9]+$ ]]; then
  echo "PROJECTWING_REGISTRY_BUILD_RETRY_DELAY_SECONDS must be a non-negative integer." >&2
  exit 2
fi
if [[ "${IMAGE_EXPORT}" != "push" && "${IMAGE_EXPORT}" != "load" ]]; then
  echo "PROJECTWING_IMAGE_EXPORT must be either push or load." >&2
  exit 2
fi

setup_buildx_builder() {
  if [[ "${RUNNER_ENVIRONMENT:-}" != "self-hosted" ]]; then
    return
  fi

  PERSISTENT_BUILDX_BUILDER="${PROJECTWING_PERSISTENT_BUILDX_BUILDER:-projectwing-oss-persistent}"
  if docker buildx inspect "${PERSISTENT_BUILDX_BUILDER}" >/dev/null 2>&1; then
    echo "Reusing persistent BuildKit builder ${PERSISTENT_BUILDX_BUILDER}."
  else
    echo "Creating persistent BuildKit builder ${PERSISTENT_BUILDX_BUILDER}."
    docker buildx create \
      --driver docker-container \
      --name "${PERSISTENT_BUILDX_BUILDER}" >/dev/null
  fi

  if ! docker buildx inspect "${PERSISTENT_BUILDX_BUILDER}" --bootstrap >/dev/null; then
    echo "Persistent BuildKit builder ${PERSISTENT_BUILDX_BUILDER} is unhealthy; recreating it." >&2
    docker buildx rm "${PERSISTENT_BUILDX_BUILDER}" || true
    docker buildx create \
      --driver docker-container \
      --name "${PERSISTENT_BUILDX_BUILDER}" >/dev/null
    docker buildx inspect "${PERSISTENT_BUILDX_BUILDER}" --bootstrap >/dev/null
  fi

  BUILDX_BUILD_ARGS=(--builder "${PERSISTENT_BUILDX_BUILDER}")
}

bound_persistent_buildkit_cache() {
  if [[ "${RUNNER_ENVIRONMENT:-}" != "self-hosted" ]] || [[ -z "${PERSISTENT_BUILDX_BUILDER}" ]]; then
    return 0
  fi

  local max_used_space="${PROJECTWING_BUILDKIT_CACHE_MAX_USED_SPACE:-20GB}"
  local min_free_space="${PROJECTWING_BUILDKIT_CACHE_MIN_FREE_SPACE:-30GB}"
  local reserved_space="${PROJECTWING_BUILDKIT_CACHE_RESERVED_SPACE:-10GB}"

  echo "Bounding persistent BuildKit cache for ${PERSISTENT_BUILDX_BUILDER}: max=${max_used_space}, min-free=${min_free_space}, reserved=${reserved_space}."
  docker buildx du --builder "${PERSISTENT_BUILDX_BUILDER}" || true
  if ! docker buildx prune \
    --builder "${PERSISTENT_BUILDX_BUILDER}" \
    --force \
    --max-used-space "${max_used_space}" \
    --min-free-space "${min_free_space}" \
    --reserved-space "${reserved_space}"; then
    echo "::warning::Persistent BuildKit cache maintenance failed; the build result is unaffected."
  fi
  docker buildx du --builder "${PERSISTENT_BUILDX_BUILDER}" || true
  return 0
}

setup_buildx_builder
if [[ "${RUNNER_ENVIRONMENT:-}" = "self-hosted" ]]; then
  trap bound_persistent_buildkit_cache EXIT
  bound_persistent_buildkit_cache
fi

has_system() {
  case ",${PROJECTWING_DEPLOY_SYSTEMS}," in
    *,"$1",*) return 0 ;;
    *) return 1 ;;
  esac
}

showroom_source_revision() {
  local revision="${GITHUB_SHA:-}"
  if [[ -z "${revision}" ]]; then
    revision="$(git rev-parse --verify HEAD)"
    if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
      revision="${revision}-dirty"
    fi
  fi
  printf '%s\n' "${revision}"
}

cache_arguments() {
  local image_name="$1"

  if [[ "${RUNNER_ENVIRONMENT:-}" = "self-hosted" ]]; then
    # The fixed self-hosted builder keeps its internal BuildKit cache across runs.
    return
  fi

  printf '%s\n' "--cache-from" "type=gha,scope=projectwing-${image_name}" \
    "--cache-to" "type=gha,mode=max,scope=projectwing-${image_name}"
}

export_argument() {
  if [[ "${IMAGE_EXPORT}" = "load" ]]; then
    printf '%s\n' "--load"
    return
  fi
  printf '%s\n' "--push"
}
tag_arguments() {
  local primary_image="$1"
  local additional_images="${2:-}"
  local image

  printf '%s\n' "--tag" "${primary_image}"
  additional_images="${additional_images//$'\n'/,}"
  IFS=',' read -r -a images <<< "${additional_images}"
  for image in "${images[@]}"; do
    image="${image#"${image%%[![:space:]]*}"}"
    image="${image%"${image##*[![:space:]]}"}"
    if [ -n "${image}" ]; then
      printf '%s\n' "--tag" "${image}"
    fi
  done
}

start_build() {
  local image_name="$1"
  shift
  local -a cache_args=()

  if (( ${#BUILD_PIDS[@]} >= MAX_BUILD_CONCURRENCY )); then
    wait_for_builds
  fi

  mapfile -t cache_args < <(cache_arguments "${image_name}")
  echo "::notice title=Registry build::Starting ${image_name}"
  (
    set -o pipefail
    for attempt in $(seq 1 "${MAX_BUILD_ATTEMPTS}"); do
      if docker buildx build "${BUILDX_BUILD_ARGS[@]}" --progress=plain "${cache_args[@]}" "$@" 2>&1 \
        | sed -u "s/^/[${image_name}] /"; then
        exit 0
      fi
      if (( attempt == MAX_BUILD_ATTEMPTS )); then
        exit 1
      fi
      echo "[${image_name}] Build attempt ${attempt}/${MAX_BUILD_ATTEMPTS} failed; retrying in ${BUILD_RETRY_DELAY_SECONDS}s."
      sleep "${BUILD_RETRY_DELAY_SECONDS}"
    done
  ) &
  BUILD_NAMES+=("${image_name}")
  BUILD_PIDS+=("$!")
}

wait_for_builds() {
  local -a build_names=("${BUILD_NAMES[@]}")
  local -a build_pids=("${BUILD_PIDS[@]}")
  local index
  local failed=0

  BUILD_NAMES=()
  BUILD_PIDS=()
  for index in "${!build_pids[@]}"; do
    if wait "${build_pids[${index}]}"; then
      echo "::notice title=Registry build::Completed ${build_names[${index}]}"
    else
      echo "::error title=Registry build::Failed ${build_names[${index}]}" >&2
      failed=1
    fi
  done

  bound_persistent_buildkit_cache

  return "${failed}"
}

build_api_images() {
  local -a api_tag_args=()
  local export_arg
  export_arg="$(export_argument)"
  mapfile -t api_tag_args < <(tag_arguments "${PROJECTWING_API_IMAGE}" "${PROJECTWING_API_ADDITIONAL_TAGS:-}")
  start_build api \
    --file apps/api/Dockerfile \
    --build-arg "NODE_IMAGE=${PROJECTWING_NODE_IMAGE}" \
    "${api_tag_args[@]}" \
    "${export_arg}" .
}

build_gotenberg_foundation() {
  local -a tag_args=()
  local export_arg
  if [[ "${IMAGE_EXPORT}" == push ]] && docker manifest inspect "${PROJECTWING_GOTENBERG_IMAGE}" >/dev/null 2>&1; then
    echo "::notice title=Foundation image::Reusing ${PROJECTWING_GOTENBERG_IMAGE}"
    return
  fi
  export_arg="$(export_argument)"
  mapfile -t tag_args < <(tag_arguments "${PROJECTWING_GOTENBERG_IMAGE}" "${PROJECTWING_GOTENBERG_ADDITIONAL_TAGS:-}")
  start_build gotenberg \
    --file deploy/docker/Dockerfile.gotenberg \
    --build-arg "GOTENBERG_IMAGE=${PROJECTWING_GOTENBERG_BASE_IMAGE}" \
    "${tag_args[@]}" "${export_arg}" .
}

build_emp_image() {
  local -a tag_args=()
  local export_arg
  export_arg="$(export_argument)"
  mapfile -t tag_args < <(tag_arguments "${PROJECTWING_EMP_IMAGE}" "${PROJECTWING_EMP_ADDITIONAL_TAGS:-}")
  start_build emp --file deploy/docker/Dockerfile.next-app \
    --build-arg "NODE_IMAGE=${PROJECTWING_NODE_IMAGE}" \
    --build-arg APP_NAME=emp \
    --build-arg APP_PACKAGE=@project-wing/emp --build-arg APP_PORT=3001 \
    --build-arg "NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_EMP_API_BASE_URL}" \
    --build-arg "NEXT_PUBLIC_AUTH_BASE_URL=${NEXT_PUBLIC_AUTH_BASE_URL}" \
    --build-arg "NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX=${PROJECTWING_DOMAIN_SUFFIX}" \
    --build-arg "NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL=${NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL}" \
    --build-arg "NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL=${NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL}" \
    --build-arg "NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION=${NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION}" \
    --build-arg "NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION=${NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION}" \
    "${tag_args[@]}" "${export_arg}" .
}

build_next_image() {
  local image_name="$1"
  local app_name="$2"
  local app_package="$3"
  local app_port="$4"
  local api_base_url="$5"
  local image="$6"
  local include_auth_base_url="$7"
  local include_domain_suffix="$8"
  local -a build_args=(
    --file deploy/docker/Dockerfile.next-app
    --build-arg "NODE_IMAGE=${PROJECTWING_NODE_IMAGE}"
    --build-arg "APP_NAME=${app_name}"
    --build-arg "APP_PACKAGE=${app_package}"
    --build-arg "APP_PORT=${app_port}"
    --build-arg "NEXT_PUBLIC_API_BASE_URL=${api_base_url}"
  )
  local additional_tags_variable
  local -a tag_args=()
  local export_arg

  additional_tags_variable="PROJECTWING_$(printf '%s' "${image_name}" | tr '[:lower:]-' '[:upper:]_')_ADDITIONAL_TAGS"
  mapfile -t tag_args < <(tag_arguments "${image}" "${!additional_tags_variable:-}")
  export_arg="$(export_argument)"

  if [[ "${include_auth_base_url}" = true ]]; then
    build_args+=(--build-arg "NEXT_PUBLIC_AUTH_BASE_URL=${NEXT_PUBLIC_AUTH_BASE_URL}")
  fi
  if [[ "${include_domain_suffix}" = true ]]; then
    build_args+=(--build-arg "NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX=${PROJECTWING_DOMAIN_SUFFIX}")
  fi
  if [[ "${image_name}" = showroom && -n "${NEXT_PUBLIC_SHOWROOM_BASE_PATH:-}" ]]; then
    build_args+=(--build-arg "NEXT_PUBLIC_SHOWROOM_BASE_PATH=${NEXT_PUBLIC_SHOWROOM_BASE_PATH}")
  fi
  if [[ "${image_name}" = showroom ]]; then
    build_args+=(--build-arg "SOURCE_REVISION=$(showroom_source_revision)")
  fi
  start_build "${image_name}" "${build_args[@]}" "${tag_args[@]}" "${export_arg}" .
}

build_ib_api_image() {
  local -a tag_args=()
  local export_arg
  export_arg="$(export_argument)"
  mapfile -t tag_args < <(tag_arguments "${PROJECTWING_IB_API_IMAGE}" "${PROJECTWING_IB_API_ADDITIONAL_TAGS:-}")
  start_build ib-api --file apps/ib-api/Dockerfile \
    --build-arg "NODE_IMAGE=${PROJECTWING_NODE_IMAGE}" \
    "${tag_args[@]}" "${export_arg}" .
}

if has_system api; then build_gotenberg_foundation; build_api_images; fi
if has_system emp; then build_emp_image; fi
if has_system cmp; then build_next_image cmp cmp @project-wing/cmp 3003 "${NEXT_PUBLIC_CMP_API_BASE_URL}" "${PROJECTWING_CMP_IMAGE}" true true; fi
if has_system showroom; then
  build_next_image showroom ui-showroom @project-wing/ui-showroom 3008 "${NEXT_PUBLIC_CMP_API_BASE_URL}" "${PROJECTWING_SHOWROOM_IMAGE}" false true
fi
if has_system tms; then build_next_image tms tms @project-wing/tms 3004 "${NEXT_PUBLIC_TMS_API_BASE_URL}" "${PROJECTWING_TMS_IMAGE}" true true; fi
if has_system intranet; then build_next_image intranet intranet @project-wing/intranet 3002 "${NEXT_PUBLIC_EMP_API_BASE_URL}" "${PROJECTWING_INTRANET_IMAGE}" false true; fi
if has_system ib; then build_next_image ib ib @project-wing/ib 3005 "${NEXT_PUBLIC_IB_API_BASE_URL}" "${PROJECTWING_IB_IMAGE}" false false; fi
if has_system ib-api; then build_ib_api_image; fi

wait_for_builds
