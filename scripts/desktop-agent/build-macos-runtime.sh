#!/usr/bin/env bash

set -euo pipefail

version="${1:-0.2.1}"
configuration="${2:-Release}"
runtime_identifier="${3:-osx-universal}"
health_url="http://127.0.0.1:17862/health"

validate_inputs() {
  if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    printf 'Invalid Desktop Agent version: %s\n' "${version}" >&2
    return 1
  fi
  case "${configuration}" in
    Debug | Release) ;;
    *) printf 'Invalid build configuration: %s\n' "${configuration}" >&2; return 1 ;;
  esac
  case "${runtime_identifier}" in
    osx-arm64 | osx-x64 | osx-universal) ;;
    *) printf 'Invalid runtime identifier: %s\n' "${runtime_identifier}" >&2; return 1 ;;
  esac
}

resolve_paths() {
  script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo_root="$(cd "${script_root}/../.." && pwd)"
  desktop_agent_root="${repo_root}/apps/desktop-agent"
  launcher_root="${script_root}/macos-runtime-launchers"
  local configured_output_root="${PROJECT_WING_DESKTOP_RELEASE_ROOT:-}"
  if [[ -z "${configured_output_root}" ]]; then
    output_root="${repo_root}/output/desktop-agent/macos/${runtime_identifier}"
  elif [[ "${configured_output_root}" = /* ]]; then
    output_root="${configured_output_root}"
  else
    output_root="${repo_root}/${configured_output_root}"
  fi
  payload_root="${output_root}/payload"
  manager_publish_root="${output_root}/manager-publish"
  runtime_publish_root="${output_root}/runtime-publish"
  managed_layout_report="${output_root}/managed-runtime-layout.json"
  payload_size_report="${output_root}/payload-size-report.json"
  archive_path="${output_root}/ProjectWingDesktopAgentRuntime-${runtime_identifier}.tar.gz"
}

reset_directory() {
  local target="$1"
  case "${target}" in
    "${output_root}"/*) ;;
    *) printf '%s\n' "Refusing to reset path outside output root: ${target}" >&2; return 1 ;;
  esac
  rm -rf -- "${target}"
  mkdir -p -- "${target}"
}

publish_project() {
  local project="$1"
  local destination="$2"
  local target_runtime="$3"
  dotnet publish "${project}" \
    -c "${configuration}" \
    -r "${target_runtime}" \
    --self-contained true \
    -p:PublishSingleFile=false \
    -p:PublishTrimmed=true \
    -p:TrimMode=partial \
    -p:JsonSerializerIsReflectionEnabledByDefault=true \
    -p:SuppressTrimAnalysisWarnings=true \
    -p:DebugType=None \
    -p:DebugSymbols=false \
    -o "${destination}"
}

copy_executable() {
  local source="$1"
  local destination="$2"
  test -f "${source}"
  mkdir -p -- "$(dirname "${destination}")"
  cp -- "${source}" "${destination}"
  chmod 755 "${destination}"
}

write_manifest() {
  local built_at
  built_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '%s\n' \
    '{' \
    '  "app": "project-wing-desktop-agent",' \
    "  \"version\": \"${version}\"," \
    "  \"platform\": \"${runtime_identifier}\"," \
    "  \"builtAt\": \"${built_at}\"," \
    "  \"healthUrl\": \"${health_url}\"," \
    '  "payloadKind": "background-runtime"' \
    '}' >"${payload_root}/agent-manifest.json"
}

assemble_payload() {
  if [[ "${runtime_identifier}" == "osx-universal" ]]; then
    assemble_universal_payload
  else
    assemble_runtime_payload "${runtime_identifier}" "${payload_root}/managed"
  fi
  write_manifest
  if [[ "${build_runtime_archive}" == "1" ]]; then
    tar -C "${payload_root}" -czf "${archive_path}" .
  fi
  node "${script_root}/report-package-size.mjs" \
    --root "${payload_root}" \
    --report "${payload_size_report}"
}

assemble_runtime_payload() {
  local target_runtime="$1"
  local destination="$2"
  mkdir -p "${destination}/manager" "${destination}/runtime"
  cp -R "${manager_publish_root}/${target_runtime}/." "${destination}/manager/"
  cp -R "${runtime_publish_root}/${target_runtime}/." "${destination}/runtime/"
  chmod 755 \
    "${destination}/manager/ProjectWing.AgentManager" \
    "${destination}/runtime/ProjectWing.DesktopAgent.Runtime"
  node "${script_root}/report-package-size.mjs" \
    --root "${destination}" \
    --report "${managed_layout_report%.json}-${target_runtime}.json"
}

assemble_universal_payload() {
  assemble_runtime_payload "osx-arm64" "${payload_root}/managed/osx-arm64"
  assemble_runtime_payload "osx-x64" "${payload_root}/managed/osx-x64"
  copy_executable \
    "${launcher_root}/ProjectWing.AgentManager" \
    "${payload_root}/managed/ProjectWing.AgentManager"
  copy_executable \
    "${launcher_root}/ProjectWing.DesktopAgent.Runtime" \
    "${payload_root}/managed/ProjectWing.DesktopAgent.Runtime"
}

publish_runtime_payload() {
  local target_runtime="$1"
  publish_project \
    "${desktop_agent_root}/manager/ProjectWing.AgentManager/ProjectWing.AgentManager.csproj" \
    "${manager_publish_root}/${target_runtime}" \
    "${target_runtime}"
  publish_project \
    "${desktop_agent_root}/runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj" \
    "${runtime_publish_root}/${target_runtime}" \
    "${target_runtime}"
}

main() {
  validate_inputs
  resolve_paths
  mkdir -p -- "${output_root}"
  reset_directory "${payload_root}"
  reset_directory "${manager_publish_root}"
  reset_directory "${runtime_publish_root}"
  if [[ "${runtime_identifier}" == "osx-universal" ]]; then
    publish_runtime_payload "osx-arm64"
    publish_runtime_payload "osx-x64"
  else
    publish_runtime_payload "${runtime_identifier}"
  fi
  assemble_payload
  printf 'Built macOS background runtime payload:\n  %s\n' "${payload_root}"
}

build_runtime_archive="${PROJECT_WING_BUILD_RUNTIME_ARCHIVE:-1}"
main "$@"
