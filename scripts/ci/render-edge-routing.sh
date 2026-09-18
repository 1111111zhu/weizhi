#!/usr/bin/env bash
set -euo pipefail

source_file="${1:?source is required}"
target_file="${2:?target is required}"
gateway="${3:?gateway is required}"

if [[ ! "${gateway}" =~ ^http://172\.19\.143\.(157|158):18080$ ]]; then
  echo "gateway must be an approved ProjectWing VPC backend URL" >&2
  exit 2
fi

mkdir -p "$(dirname "${target_file}")"
temporary_file="$(mktemp "$(dirname "${target_file}")/.edge-routing.XXXXXX")"
trap 'rm -f "${temporary_file}"' EXIT
sed "s|__PROJECTWING_ACTIVE_GATEWAY__|${gateway}|g" "${source_file}" > "${temporary_file}"
mv -f "${temporary_file}" "${target_file}"
trap - EXIT
