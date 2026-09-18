#!/usr/bin/env bash

set -euo pipefail

windows_setup_name="com.superfx.projectwing.desktop-agent-win-Setup.exe"
windows_release_index="releases.win.json"
macos_setup_name="com.superfx.projectwing.desktop-agent-osx-Setup.pkg"
macos_release_index="releases.osx.json"
asset_root="/release/assets"
windows_root="${asset_root}/windows"
macos_root="${asset_root}/macos"

require_inputs() {
  local name
  for name in RELEASE_VERSION OSS_ACCESS_KEY_ID \
    OSS_ACCESS_KEY_SECRET OSS_BUCKET OSS_ENDPOINT GHCR_REPOSITORY_OWNER \
    GHCR_USERNAME GHCR_TOKEN GHCR_ASSET_TAG_PREFIX; do
    if [[ -z "${!name:-}" ]]; then
      printf 'Required environment variable is missing: %s\n' "$name" >&2
      return 1
    fi
  done
}

verify_installers() {
  test -s "${windows_root}/${windows_setup_name}"
  test -s "${windows_root}/${windows_release_index}"
  test -s "${macos_root}/${macos_setup_name}"
  test -s "${macos_root}/${macos_release_index}"
  find "$windows_root" -maxdepth 1 -type f -name \
    'com.superfx.projectwing.desktop-agent-*-full.nupkg' -size +0c | grep -q .
  find "$macos_root" -maxdepth 1 -type f -name \
    'com.superfx.projectwing.desktop-agent-*-full.nupkg' -size +0c | grep -q .
}

pull_installers() {
  mkdir -p "$windows_root" "$macos_root"
  node /release/download-ghcr-asset.mjs \
    --repository "${GHCR_REPOSITORY_OWNER}/projectwing-desktop-agent-assets" \
    --tag "${GHCR_ASSET_TAG_PREFIX}-windows" --all --output "$windows_root"
  node /release/download-ghcr-asset.mjs \
    --repository "${GHCR_REPOSITORY_OWNER}/projectwing-desktop-agent-assets" \
    --tag "${GHCR_ASSET_TAG_PREFIX}-macos" --all --output "$macos_root"
}

require_inputs
pull_installers
verify_installers
export DESKTOP_AGENT_RELEASE_VERSION="$RELEASE_VERSION"
OSS_PREFIX="desktop-agent/windows" node /release/publish-installer-to-oss.mjs \
  --velopack-bundle "$windows_root"
OSS_PREFIX="desktop-agent/macos" node /release/publish-macos-to-oss.mjs \
  --velopack-bundle "$macos_root"
