#!/usr/bin/env bash

set -euo pipefail

release_assets_root="${1:-release-assets}"
release_tag="desktop-agent-v${RELEASE_VERSION:?}-preview"
notes_path="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/desktop-agent-preview-release-notes.md"

for name in GITHUB_SHA GH_TOKEN RELEASE_NOTE; do
  if [[ -z "${!name:-}" ]]; then
    printf 'Required environment variable is missing: %s\n' "$name" >&2
    exit 1
  fi
done

mapfile -t release_assets < <(find "$release_assets_root" -type f -print | sort)
if (( ${#release_assets[@]} == 0 )); then
  printf 'No preview release assets found under %s.\n' "$release_assets_root" >&2
  exit 1
fi

{
  printf 'Project Wing Desktop Agent %s preview.\n\n' "$RELEASE_VERSION"
  printf '%s\n\n' "$RELEASE_NOTE"
  printf '%s\n' \
    'This is a GitHub pre-release for installer testing. It is not published to the OSS download or update feed.' \
    'The preview package does not use the stable update channel.'
} >"$notes_path"

if gh release view "$release_tag" >/dev/null 2>&1; then
  gh release edit "$release_tag" \
    --target "$GITHUB_SHA" \
    --title "Desktop Agent v${RELEASE_VERSION} Preview" \
    --notes-file "$notes_path" \
    --prerelease
else
  gh release create "$release_tag" \
    --target "$GITHUB_SHA" \
    --title "Desktop Agent v${RELEASE_VERSION} Preview" \
    --notes-file "$notes_path" \
    --prerelease
fi

gh release upload "$release_tag" "${release_assets[@]}" --clobber
printf 'GitHub preview release published: %s\n' "$release_tag"
