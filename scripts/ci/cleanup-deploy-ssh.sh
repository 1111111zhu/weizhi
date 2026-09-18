#!/usr/bin/env bash
set -Eeuo pipefail

runner_temp="${RUNNER_TEMP:-}"
configured_ssh_dir="${PROJECTWING_DEPLOY_SSH_DIR:-}"
legacy_ssh_dir="${PROJECTWING_LEGACY_DEPLOY_SSH_DIR:-${HOME}/.ssh}"

if [[ -n "${runner_temp}" ]]; then
  expected_ssh_dir="${runner_temp}/projectwing-deploy-ssh"
  if [[ -n "${configured_ssh_dir}" && "${configured_ssh_dir}" != "${expected_ssh_dir}" ]]; then
    echo "Refusing to remove an unexpected deployment SSH directory." >&2
    exit 1
  fi
  control_token="$(printf '%s' "${expected_ssh_dir}" | sha256sum | cut -d ' ' -f1 | cut -c1-16)"
  control_dir="/tmp/projectwing-ssh-${control_token}"
  [[ "${control_dir}" =~ ^/tmp/projectwing-ssh-[a-f0-9]{16}$ ]] || {
    echo "Refusing to remove an unsafe deployment SSH control directory." >&2
    exit 1
  }
  if [[ -d "${control_dir}" ]]; then
    while IFS= read -r -d '' socket; do
      ssh -S "${socket}" -O exit ignored >/dev/null 2>&1 || true
    done < <(find "${control_dir}" -mindepth 1 -maxdepth 1 -type s -print0)
    rm -rf -- "${control_dir}"
  fi
  rm -rf -- "${expected_ssh_dir}"
fi

if [[ "${legacy_ssh_dir}" != /* || "${legacy_ssh_dir}" == "/" \
  || "${legacy_ssh_dir}" =~ /\.\.?(/|$) ]]; then
  echo "Refusing to remove deployment credentials from an unsafe legacy SSH directory." >&2
  exit 1
fi
rm -f -- \
  "${legacy_ssh_dir}/projectwing_deploy" \
  "${legacy_ssh_dir}/projectwing_known_host" \
  "${legacy_ssh_dir}/projectwing_known_hosts"

echo "Deployment SSH credentials and legacy ProjectWing SSH files were removed."
