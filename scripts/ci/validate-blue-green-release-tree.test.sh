#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validator="${repo_root}/scripts/ci/validate-blue-green-release-tree.sh"
fixture="$(mktemp -d)"
trap 'chmod -R u+rwx "${fixture}" 2>/dev/null || true; rm -rf "${fixture}"' EXIT
release="${fixture}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1"
mkdir -p "${release}/secrets"

PROJECTWING_RELEASES_ROOT="${fixture}" bash "${validator}" >/dev/null
chmod 500 "${release}/secrets"
if PROJECTWING_RELEASES_ROOT="${fixture}" bash "${validator}" >/dev/null 2>&1; then
  echo 'Validator accepted an inaccessible release directory.' >&2
  exit 1
fi
chmod 700 "${release}/secrets"
ln -s /tmp "${release}/unsafe-link"
if PROJECTWING_RELEASES_ROOT="${fixture}" bash "${validator}" >/dev/null 2>&1; then
  echo 'Validator accepted a release symlink.' >&2
  exit 1
fi
rm -f "${release}/unsafe-link"
mkdir "${fixture}/unexpected"
if PROJECTWING_RELEASES_ROOT="${fixture}" bash "${validator}" >/dev/null 2>&1; then
  echo 'Validator accepted an unexpected release entry.' >&2
  exit 1
fi
echo 'Blue/Green release tree validation tests passed.'
