#!/usr/bin/env bash
set -Eeuo pipefail

project_root="${PROJECTWING_ROOT:-/opt/projectwing}"
release_key="${PROJECTWING_RELEASE_KEY:?PROJECTWING_RELEASE_KEY is required}"

fail() {
  echo "cleanup-blue-green-staged-inputs: $*" >&2
  exit 1
}

is_staged_input() {
  local name="$1"
  [[ "${name}" =~ ^projectwing-(oss-|images-)?[0-9]+-[1-9][0-9]*\.env$ ]] \
    || [[ "${name}" =~ ^projectwing-traefik-(access|secret)-key-[0-9]+-[1-9][0-9]*$ ]] \
    || [[ "${name}" =~ ^projectwing-oss-image-bundle-deploy(-[0-9]+-[1-9][0-9]*)?\.tar\.gz$ ]]
}

[[ "${project_root}" == /opt/projectwing && ! -L "${project_root}" ]] \
  || fail 'project root must be the physical /opt/projectwing directory'
[[ "${release_key}" =~ ^[a-f0-9]{40}-[0-9]+-[1-9][0-9]*$ ]] \
  || fail 'release key has an unexpected format'
test -d "${project_root}/releases/${release_key}" \
  || fail 'the committed release directory is absent'

count=0
bytes=0
while IFS= read -r -d '' path; do
  name="${path##*/}"
  is_staged_input "${name}" || continue
  [[ -f "${path}" && ! -L "${path}" ]] || fail "matched path is not a regular file: ${name}"
  bytes="$((bytes + $(stat -c %s "${path}")))"
  rm -f -- "${path}"
  count="$((count + 1))"
done < <(find "${project_root}" -mindepth 1 -maxdepth 1 -print0)

printf 'removed_staged_inputs=%s\nremoved_staged_input_bytes=%s\n' "${count}" "${bytes}"
