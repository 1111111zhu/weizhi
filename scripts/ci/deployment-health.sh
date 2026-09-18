#!/usr/bin/env bash

# Sourceable health and deployment-scope helpers. This file deliberately does
# not change the caller's shell options.

pw_canonical_deploy_systems() {
  printf '%s\n' "api,emp,cmp,showroom,tms,intranet,ib,ib-api,reverse-proxy"
}

pw_require_full_deploy_scope() {
  local requested="${1:-}"
  local canonical
  local system
  local -a requested_systems=()
  local -A seen=()

  canonical="$(pw_canonical_deploy_systems)"
  if [[ "${requested}" == "all" ]]; then
    PROJECTWING_DEPLOY_SYSTEMS="${canonical}"
    export PROJECTWING_DEPLOY_SYSTEMS
    return 0
  fi

  IFS=',' read -r -a requested_systems <<< "${requested}"
  if [[ "${#requested_systems[@]}" -ne 9 ]]; then
    echo "Deployment scope must contain the complete ProjectWing stack; got: ${requested:-<empty>}." >&2
    return 1
  fi

  for system in "${requested_systems[@]}"; do
    case "${system}" in
      api|emp|cmp|showroom|tms|intranet|ib|ib-api|reverse-proxy) ;;
      *)
        echo "Deployment scope contains an unknown or malformed system: ${system:-<empty>}." >&2
        return 1
        ;;
    esac
    if [[ -n "${seen[${system}]:-}" ]]; then
      echo "Deployment scope contains a duplicate system: ${system}." >&2
      return 1
    fi
    seen["${system}"]=1
  done

  for system in api emp cmp showroom tms intranet ib ib-api reverse-proxy; do
    if [[ -z "${seen[${system}]:-}" ]]; then
      echo "Deployment scope is missing required system: ${system}." >&2
      return 1
    fi
  done

  PROJECTWING_DEPLOY_SYSTEMS="${canonical}"
  export PROJECTWING_DEPLOY_SYSTEMS
}

pw_url_host() {
  local url="$1"

  if [[ ! "${url}" =~ ^https?://([A-Za-z0-9.-]+)(:[0-9]+)?(/.*)?$ ]]; then
    echo "Deployment verification requires a valid HTTP(S) URL: ${url}" >&2
    return 1
  fi
  printf '%s\n' "${BASH_REMATCH[1]}"
}

pw_url_port() {
  local url="$1"

  if [[ ! "${url}" =~ ^(https?)://[A-Za-z0-9.-]+(:([0-9]+))?(/.*)?$ ]]; then
    echo "Deployment verification requires a valid HTTP(S) URL: ${url}" >&2
    return 1
  fi
  if [[ -n "${BASH_REMATCH[3]:-}" ]]; then
    printf '%s\n' "${BASH_REMATCH[3]}"
  elif [[ "${BASH_REMATCH[1]}" == "https" ]]; then
    printf '443\n'
  else
    printf '80\n'
  fi
}

pw_url_scheme() {
  local url="$1"

  if [[ ! "${url}" =~ ^(https?):// ]]; then
    echo "Deployment verification requires a valid HTTP(S) URL: ${url}" >&2
    return 1
  fi
  printf '%s\n' "${BASH_REMATCH[1]}"
}

pw_join_url() {
  local base_url="${1%/}"
  local path="$2"

  if [[ "${path}" != /* ]]; then
    path="/${path}"
  fi
  printf '%s%s\n' "${base_url}" "${path}"
}

pw_verify_api_route() {
  local label="$1"
  local url="$2"
  local expected_marker="$3"
  local host port scheme body_file
  local -a redirect_args=(--location)

  host="$(pw_url_host "${url}")" || return 1
  port="$(pw_url_port "${url}")" || return 1
  scheme="$(pw_url_scheme "${url}")" || return 1
  if [[ "${label}" == 'Prisma Studio' && "${host}" == 'db.superfx.cn' ]]; then
    test -n "${PROJECTWING_RELEASE_DIR:-}"
    bash "${PROJECTWING_RELEASE_DIR}/scripts/ci/verify-protected-edge-route.sh"
    return
  fi
  if [[ "${PROJECTWING_VERIFY_DISALLOW_REDIRECTS:-false}" == "true" ]]; then
    redirect_args=()
  fi
  body_file="$(mktemp "${TMPDIR:-/tmp}/projectwing-api-body.XXXXXX")"
  if ! curl --noproxy '*' --fail --silent --show-error "${redirect_args[@]}" --insecure \
    --connect-timeout 5 --max-time 15 \
    --resolve "${host}:${port}:127.0.0.1" \
    --header "X-Forwarded-Proto: ${PROJECTWING_VERIFY_FORWARDED_PROTO:-${scheme}}" \
    --output "${body_file}" "${url}"; then
    rm -f "${body_file}"
    echo "API verification failed for ${label}: ${url} was unavailable." >&2
    return 1
  fi
  if ! grep -Fq "${expected_marker}" "${body_file}"; then
    rm -f "${body_file}"
    echo "API verification failed for ${label}: response did not contain identity marker ${expected_marker}." >&2
    return 1
  fi
  rm -f "${body_file}"
  echo "Verified ${label}: ${url}"
}

pw_verify_frontend_route() {
  local label="$1"
  local base_url="$2"
  local path="$3"
  local expected_title="$4"
  local host port scheme url body_file
  local -a redirect_args=(--location)

  host="$(pw_url_host "${base_url}")" || return 1
  port="$(pw_url_port "${base_url}")" || return 1
  scheme="$(pw_url_scheme "${base_url}")" || return 1
  if [[ "${PROJECTWING_VERIFY_DISALLOW_REDIRECTS:-false}" == "true" ]]; then
    redirect_args=()
  fi
  url="$(pw_join_url "${base_url}" "${path}")"
  body_file="$(mktemp "${TMPDIR:-/tmp}/projectwing-edge-body.XXXXXX")"

  if ! curl --noproxy '*' --fail --silent --show-error "${redirect_args[@]}" --insecure \
    --connect-timeout 5 --max-time 30 \
    --resolve "${host}:${port}:127.0.0.1" \
    --header "X-Forwarded-Proto: ${PROJECTWING_VERIFY_FORWARDED_PROTO:-${scheme}}" \
    --output "${body_file}" "${url}"; then
    rm -f "${body_file}"
    echo "Frontend verification failed for ${label}: ${url} was unavailable." >&2
    return 1
  fi
  if grep -q '__STUDIO_CONFIG__' "${body_file}"; then
    rm -f "${body_file}"
    echo "Frontend verification failed for ${label}: Prisma Studio content was routed to ${url}." >&2
    return 1
  fi
  if ! grep -Eq '(/_next/static/|__next_f|__NEXT_DATA__)' "${body_file}"; then
    rm -f "${body_file}"
    echo "Frontend verification failed for ${label}: response did not contain a Next.js application marker." >&2
    return 1
  fi
  if ! grep -Fq "<title>${expected_title}" "${body_file}"; then
    rm -f "${body_file}"
    echo "Frontend verification failed for ${label}: expected title prefix ${expected_title} at ${url}." >&2
    return 1
  fi

  rm -f "${body_file}"
  echo "Verified ${label} identity: ${url}"
}

pw_wait_for_compose_service() {
  local compose_project="$1"
  local env_file="$2"
  local compose_file="$3"
  local service="$4"
  local attempts="$5"
  local delay_seconds="$6"
  local attempt container_id status

  status="missing"
  for attempt in $(seq 1 "${attempts}"); do
    container_id="$(docker compose \
      --project-name "${compose_project}" \
      --env-file "${env_file}" \
      -f "${compose_file}" ps -q "${service}" 2>/dev/null || true)"
    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "${container_id}" 2>/dev/null || true)"
    else
      status="missing"
    fi
    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      echo "Container health verified: ${service} (${status})."
      return 0
    fi
    if [[ "${attempt}" -lt "${attempts}" ]]; then
      sleep "${delay_seconds}"
    fi
  done

  echo "Service ${service} did not become healthy; status=${status:-missing}." >&2
  return 1
}

pw_wait_for_compose_services() {
  local compose_project="$1"
  local env_file="$2"
  local compose_file="$3"
  local max_parallel="$4"
  local attempts="$5"
  local delay_seconds="$6"
  shift 6

  local service pid index failed
  local -a pids=()
  local -a names=()

  failed=0
  for service in "$@"; do
    pw_wait_for_compose_service \
      "${compose_project}" "${env_file}" "${compose_file}" \
      "${service}" "${attempts}" "${delay_seconds}" &
    pids+=("$!")
    names+=("${service}")

    if [[ "${#pids[@]}" -ge "${max_parallel}" ]]; then
      for index in "${!pids[@]}"; do
        if ! wait "${pids[index]}"; then
          echo "Bounded health worker failed for ${names[index]}." >&2
          failed=1
        fi
      done
      pids=()
      names=()
    fi
  done

  for index in "${!pids[@]}"; do
    if ! wait "${pids[index]}"; then
      echo "Bounded health worker failed for ${names[index]}." >&2
      failed=1
    fi
  done
  return "${failed}"
}

pw_verify_edge_target() {
  local target="$1"
  local kind label base_url path expected_title url

  IFS='|' read -r kind label base_url path expected_title <<< "${target}"
  case "${kind}" in
    api)
      url="$(pw_join_url "${base_url}" "${path}")"
      pw_verify_api_route "${label}" "${url}" "${expected_title}"
      ;;
    frontend)
      pw_verify_frontend_route "${label}" "${base_url}" "${path}" "${expected_title}"
      ;;
    *)
      echo "Unknown edge verification kind: ${kind}." >&2
      return 1
      ;;
  esac
}

pw_verify_full_edge_stack() {
  local max_parallel="$1"
  local target pid index failed
  local -a targets=(
    'api|Primary API|'"${PROJECTWING_EMP_URL}"'|/api/healthz|"ok":true'
    'api|IB API|'"${PROJECTWING_IB_URL}"'|/api/health|"service":"ib-api"'
    "frontend|EMP|${PROJECTWING_EMP_URL}|/zh-CN/engagement|EMP"
    "frontend|CMP|${PROJECTWING_CMP_URL}|/zh-CN/dashboard|CMP"
    "frontend|Showroom|${PROJECTWING_SHOWROOM_URL}|/|Showroom"
    "frontend|TMS|${PROJECTWING_TMS_URL}|/zh-CN/timesheet|TMS"
    "frontend|Intranet|${PROJECTWING_INTRANET_URL}|/zh-CN|Intranet"
    "frontend|IB|${PROJECTWING_IB_URL}|/|IB"
  )
  local -a pids=()
  local -a names=()

  failed=0
  for target in "${targets[@]}"; do
    pw_verify_edge_target "${target}" &
    pids+=("$!")
    names+=("${target#*|}")
    if [[ "${#pids[@]}" -ge "${max_parallel}" ]]; then
      for index in "${!pids[@]}"; do
        if ! wait "${pids[index]}"; then
          echo "Edge verification worker failed for ${names[index]%%|*}." >&2
          failed=1
        fi
      done
      pids=()
      names=()
    fi
  done

  for index in "${!pids[@]}"; do
    if ! wait "${pids[index]}"; then
      echo "Edge verification worker failed for ${names[index]%%|*}." >&2
      failed=1
    fi
  done
  return "${failed}"
}

pw_wait_for_full_edge_stack() {
  local attempts="$1"
  local delay_seconds="$2"
  local max_parallel="$3"
  local attempt

  for attempt in $(seq 1 "${attempts}"); do
    if pw_verify_full_edge_stack "${max_parallel}"; then
      return 0
    fi
    if [[ "${attempt}" -lt "${attempts}" ]]; then
      echo "Full edge stack is not ready (attempt ${attempt}/${attempts}); retrying in ${delay_seconds}s."
      sleep "${delay_seconds}"
    fi
  done

  echo "Full edge stack failed verification after ${attempts} attempts." >&2
  return 1
}
