#!/usr/bin/env bash

set -euo pipefail

operation="${1:?Operation is required: relay or notes}"
release_assets="${2:-release-assets}"
windows_name="desktop-agent-win-x64-${RELEASE_VERSION}.exe"
macos_name="desktop-agent-macos-arm64-${RELEASE_VERSION}.pkg"
registry_owner="${GITHUB_REPOSITORY_OWNER,,}"
image="ghcr.io/${registry_owner}/projectwing-desktop-agent-release"
asset_image="ghcr.io/${registry_owner}/projectwing-desktop-agent-assets"
version_image="${image}:${RELEASE_VERSION}"
commit_image="${image}:${GITHUB_SHA}"
relay_context="${RUNNER_TEMP}/desktop-agent-relay-${GITHUB_RUN_ID}"
registry_login_active=0
reuse_release_relay="${REUSE_RELEASE_RELAY:-false}"

cleanup() {
  docker image rm "$version_image" "$commit_image" >/dev/null 2>&1 || true
  if [[ "$registry_login_active" == "1" ]]; then
    docker logout ghcr.io >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

require_common_inputs() {
  local name
  for name in RELEASE_VERSION GITHUB_SHA \
    GITHUB_REPOSITORY_OWNER RUNNER_TEMP; do
    if [[ -z "${!name:-}" ]]; then
      printf 'Required environment variable is missing: %s\n' "$name" >&2
      return 1
    fi
  done
}

login_registry() {
  test -n "${GH_TOKEN:-}"
  printf '%s' "$GH_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
  registry_login_active=1
}

stage_relay_context() {
  rm -rf -- "$relay_context"
  mkdir -p -- "$relay_context"
  cp scripts/desktop-agent/download-ghcr-asset.mjs "$relay_context/"
  cp scripts/desktop-agent/oss-publisher-support.mjs "$relay_context/"
  cp scripts/desktop-agent/publish-installer-to-oss.mjs "$relay_context/"
  cp scripts/desktop-agent/publish-macos-to-oss.mjs "$relay_context/"
  cp scripts/desktop-agent/publish-relay-to-oss.sh "$relay_context/"
}

version_assets_exist() {
  oras manifest fetch \
    "${asset_image}:${DESKTOP_AGENT_ASSET_TAG_PREFIX}-windows" \
    >/dev/null
  oras manifest fetch \
    "${asset_image}:${DESKTOP_AGENT_ASSET_TAG_PREFIX}-macos" \
    >/dev/null
}

prepare_reusable_assets() {
  login_registry
  if ! version_assets_exist; then
    printf '%s\n' \
      "Release assets are unavailable. Rebuild before publishing." >&2
    return 1
  fi
}

publish_relay_image() {
  docker build \
    -f deploy/docker/Dockerfile.desktop-agent-release \
    --build-arg "RELEASE_VERSION=${RELEASE_VERSION}" \
    --build-arg "SOURCE_COMMIT=${GITHUB_SHA}" \
    -t "$version_image" \
    -t "$commit_image" \
    "$relay_context"
  docker push "$version_image"
  docker push "$commit_image"
}

publish_github_release() {
  local notes_path="${RUNNER_TEMP}/desktop-agent-release-notes.md"
  local release_tag
  test -n "${GH_TOKEN:-}"
  test -n "${RELEASE_NOTE:-}"
  release_tag="desktop-agent-v${RELEASE_VERSION}"
  printf '%s\n\n%s\n\n%s\n%s\n%s\n%s\n' \
    "Project Wing Desktop Agent ${RELEASE_VERSION}." \
    "$RELEASE_NOTE" \
    "Windows package: ${windows_name}" \
    "macOS package: ${macos_name}" \
    "Update lifecycle: VeloPack" \
    "Distribution: private OSS storage; no public installer URL." \
    > "$notes_path"
  if gh release view "$release_tag" >/dev/null 2>&1; then
    gh release edit "$release_tag" --target "$GITHUB_SHA" \
      --title "Desktop Agent v${RELEASE_VERSION}" \
      --notes-file "$notes_path"
  else
    gh release create "$release_tag" --target "$GITHUB_SHA" \
      --title "Desktop Agent v${RELEASE_VERSION}" \
      --notes-file "$notes_path"
  fi
  remove_release_assets "$release_tag"
}

remove_release_assets() {
  local release_tag="$1"
  local asset_name
  while IFS= read -r asset_name; do
    if [[ -n "$asset_name" ]]; then
      gh release delete-asset "$release_tag" "$asset_name" --yes
    fi
  done < <(gh release view "$release_tag" --json assets --jq '.assets[].name')
}

write_summary() {
  printf '### Desktop Agent %s\n\n- Windows: `%s`\n- macOS: `%s`\n- Relay: `%s`\n- OSS transport: `Utopia through WARP SOCKS proxy`\n' \
    "$RELEASE_VERSION" "$WINDOWS_BUILDER" "$MACOS_BUILDER" "$version_image" \
    >> "$GITHUB_STEP_SUMMARY"
}

require_common_inputs
case "$operation" in
  relay)
    if [[ "$reuse_release_relay" == "true" ]]; then
      prepare_reusable_assets
    fi
    login_registry
    stage_relay_context
    publish_relay_image
    ;;
  notes)
    publish_github_release
    write_summary
    ;;
  *)
    printf 'Unsupported operation: %s\n' "$operation" >&2
    exit 1
    ;;
esac
