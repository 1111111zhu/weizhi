#!/usr/bin/env bash

set -euo pipefail

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    printf '%s\n' "The React Native macOS app must be built on macOS." >&2
    return 1
  fi
}

validate_inputs() {
  if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    printf '%s\n' "Invalid Desktop Agent version: ${version}" >&2
    return 1
  fi
  case "${configuration}" in
    Debug | Release) ;;
    *) printf '%s\n' "Invalid build configuration: ${configuration}" >&2; return 1 ;;
  esac
  case "${runtime_identifier}" in
    osx-arm64 | osx-x64 | osx-universal) ;;
    *) printf '%s\n' "Invalid runtime identifier: ${runtime_identifier}" >&2; return 1 ;;
  esac
  validate_release_credentials
}

validate_release_credentials() {
  local -a notarization_values=(
    "${notary_apple_id}" "${notary_team_id}" "${notary_password}"
  )
  local configured=0
  local value
  for value in "${notarization_values[@]}"; do
    if [[ -n "${value}" ]]; then configured=$((configured + 1)); fi
  done
  if [[ "${configured}" -ne 0 && "${configured}" -ne 3 ]]; then
    printf '%s\n' "All macOS notarization credentials must be configured together." >&2
    return 1
  fi
  if [[ "${require_signed_release}" != "1" ]]; then return; fi
  if [[ "${codesign_identity}" == "-" || -z "${installer_sign_identity}" ]]; then
    printf '%s\n' "A signed release requires app and installer signing identities." >&2
    return 1
  fi
  if [[ "${configured}" -ne 3 ]]; then
    printf '%s\n' "A signed release requires Apple notarization credentials." >&2
    return 1
  fi
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

build_react_native_app() {
  local -a architecture_args=()
  case "${runtime_identifier}" in
    osx-arm64) architecture_args+=("ARCHS=arm64" "ONLY_ACTIVE_ARCH=NO") ;;
    osx-x64) architecture_args+=("ARCHS=x86_64" "ONLY_ACTIVE_ARCH=NO") ;;
    osx-universal) architecture_args+=("ARCHS=arm64 x86_64" "ONLY_ACTIVE_ARCH=NO") ;;
  esac
  (
    cd "${ui_root}"
    corepack pnpm --filter @project-wing/desktop-agent bundle
    pod install --project-directory=macos
    RCT_NO_LAUNCH_PACKAGER=1 xcodebuild \
      -workspace "macos/ProjectWingDesktopAgent.xcworkspace" \
      -scheme "ProjectWingDesktopAgent-macOS" \
      -configuration "${configuration}" \
      -derivedDataPath "${derived_data}" \
      MARKETING_VERSION="${version}" \
      CURRENT_PROJECT_VERSION=2 \
      CODE_SIGNING_ALLOWED=NO \
      COMPILER_INDEX_STORE_ENABLE=NO \
      "${architecture_args[@]}" \
      build
  )
}

assemble_app() {
  local source_app="${derived_data}/Build/Products/${configuration}/ProjectWingDesktopAgent.app"
  local final_app="${app_output}/Project Wing Desktop Agent.app"
  test -d "${source_app}"
  ditto "${source_app}" "${final_app}"
  mkdir -p "${final_app}/Contents/Resources/DesktopRuntime"
  cp -R "${runtime_payload}/." "${final_app}/Contents/Resources/DesktopRuntime/"
  if [[ "${runtime_identifier}" == "osx-universal" ]]; then
    chmod 755 \
      "${final_app}/Contents/Resources/DesktopRuntime/managed/ProjectWing.AgentManager" \
      "${final_app}/Contents/Resources/DesktopRuntime/managed/ProjectWing.DesktopAgent.Runtime"
  else
    chmod 755 \
      "${final_app}/Contents/Resources/DesktopRuntime/managed/manager/ProjectWing.AgentManager" \
      "${final_app}/Contents/Resources/DesktopRuntime/managed/runtime/ProjectWing.DesktopAgent.Runtime"
  fi
  sign_app "${final_app}"
  if [[ "${build_app_archive}" == "1" ]]; then
    tar -C "${app_output}" -czf "${archive_path}" "Project Wing Desktop Agent.app"
  fi
  build_installer "${final_app}"
  notarize_installer
}

sign_app() {
  local app_path="$1"
  if [[ "${codesign_identity}" == "-" ]]; then
    codesign --force --deep --sign - "${app_path}"
    return
  fi
  codesign --force --deep --options runtime --sign "${codesign_identity}" "${app_path}"
}

build_installer() {
  local app_path="$1"
  local installed_app="${package_root}/Applications/Project Wing Desktop Agent.app"
  mkdir -p -- "${package_root}/Applications"
  ditto "${app_path}" "${installed_app}"
  pkgbuild \
    --root "${package_root}" \
    --scripts "${package_scripts}" \
    --identifier "cn.superfx.projectwing.desktopagent" \
    --version "${version}" \
    --install-location "/" \
    "${component_package}"
  if [[ -n "${installer_sign_identity}" ]]; then
    productbuild \
      --package "${component_package}" \
      --sign "${installer_sign_identity}" \
      "${installer_path}"
    verify_signed_distribution "${app_path}"
    return
  fi
  productbuild --package "${component_package}" "${installer_path}"
}

verify_signed_distribution() {
  local app_path="$1"
  codesign --verify --deep --strict --verbose=2 "${app_path}"
  pkgutil --check-signature "${installer_path}"
}

notarize_installer() {
  if [[ -z "${notary_apple_id}" ]]; then return; fi
  xcrun notarytool submit "${installer_path}" \
    --apple-id "${notary_apple_id}" \
    --team-id "${notary_team_id}" \
    --password "${notary_password}" \
    --wait
  xcrun stapler staple "${installer_path}"
  xcrun stapler validate "${installer_path}"
}

stage_installer_downloads() {
  local stable_name="desktop-agent-macos-${package_architecture}.pkg"
  local web_download="${repo_root}/apps/emp/public/downloads/${stable_name}"
  local deploy_download="${repo_root}/deploy/downloads/${stable_name}"
  mkdir -p -- "$(dirname "${web_download}")" "$(dirname "${deploy_download}")"
  ditto "${installer_path}" "${web_download}"
  ditto "${installer_path}" "${deploy_download}"
}

main() {
  require_macos
  validate_inputs
  script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo_root="$(cd "${script_root}/../.." && pwd)"
  ui_root="${repo_root}/apps/desktop-agent-macos"
  output_root="${repo_root}/output/desktop-agent/macos/${runtime_identifier}"
  runtime_payload="${output_root}/payload"
  derived_data="${output_root}/derived-data"
  app_output="${output_root}/app"
  package_work="${output_root}/package"
  package_root="${package_work}/root"
  package_scripts="${script_root}/macos-package-scripts"
  case "${runtime_identifier}" in
    osx-arm64) package_architecture="arm64" ;;
    osx-x64) package_architecture="x64" ;;
    osx-universal) package_architecture="universal" ;;
  esac
  component_package="${package_work}/ProjectWingDesktopAgent-component.pkg"
  archive_path="${output_root}/desktop-agent-macos-${package_architecture}-${version}.tar.gz"
  installer_path="${output_root}/desktop-agent-macos-${package_architecture}-${version}.pkg"
  reset_directory "${derived_data}"
  reset_directory "${app_output}"
  reset_directory "${package_work}"
  "${script_root}/build-macos-runtime.sh" \
    "${version}" "${configuration}" "${runtime_identifier}"
  build_react_native_app
  assemble_app
  stage_installer_downloads
  printf 'Built macOS Desktop Agent installer:\n  %s\n' "${installer_path}"
}

version="${1:-0.2.1}"
configuration="${2:-Release}"
runtime_identifier="${3:-osx-arm64}"
codesign_identity="${PROJECT_WING_CODESIGN_IDENTITY:--}"
installer_sign_identity="${PROJECT_WING_INSTALLER_SIGN_IDENTITY:-}"
notary_apple_id="${PROJECT_WING_NOTARY_APPLE_ID:-}"
notary_team_id="${PROJECT_WING_NOTARY_TEAM_ID:-}"
notary_password="${PROJECT_WING_NOTARY_PASSWORD:-}"
require_signed_release="${PROJECT_WING_REQUIRE_SIGNED_RELEASE:-0}"
build_app_archive="${PROJECT_WING_BUILD_APP_ARCHIVE:-1}"
main "$@"
