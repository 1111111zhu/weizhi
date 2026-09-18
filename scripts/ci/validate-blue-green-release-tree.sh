#!/usr/bin/env bash
set -Eeuo pipefail

releases_root="${PROJECTWING_RELEASES_ROOT:-/opt/projectwing/releases}"
[[ "${releases_root}" == /* && ! "${releases_root}" =~ /\.\.?(/|$) ]] \
  || { echo 'Release root must be an absolute non-traversing path.' >&2; exit 2; }
[[ -d "${releases_root}" && ! -L "${releases_root}" ]] \
  || { echo "Release root is missing or unsafe: ${releases_root}." >&2; exit 1; }

for release_dir in "${releases_root}"/*; do
  [[ -e "${release_dir}" || -L "${release_dir}" ]] || continue
  release_key="$(basename "${release_dir}")"
  [[ "${release_key}" =~ ^[a-f0-9]{40}(-[0-9]+-[1-9][0-9]*)?$ ]] \
    || { echo "Unexpected release entry: ${release_dir}." >&2; exit 1; }
  [[ -d "${release_dir}" && ! -L "${release_dir}" ]] \
    || { echo "Release entry is not a regular directory: ${release_dir}." >&2; exit 1; }
  if ! unsafe_path="$(find -P "${release_dir}" -xdev \
    \( -type l -o -type d ! -readable -o -type d ! -writable -o -type d ! -executable \) \
    -print -quit)"; then
    echo "Release tree cannot be traversed safely: ${release_dir}." >&2
    exit 1
  fi
  [[ -z "${unsafe_path}" ]] \
    || { echo "Release tree contains a symlink or inaccessible directory: ${unsafe_path}." >&2; exit 1; }
done

echo "Release tree is fully traversable and reclaimable: ${releases_root}."
