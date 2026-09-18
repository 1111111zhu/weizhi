#!/usr/bin/env bash
set -euo pipefail

environment="${PROJECTWING_ENVIRONMENT:-development}"

if [ "${environment}" != "development" ]; then
  echo "PROJECTWING_ENVIRONMENT must be development; got: ${environment}" >&2
  exit 1
fi

domain_suffix="superfx.cn"

emp_url="https://emp.${domain_suffix}"
cmp_url="https://cmp.${domain_suffix}"
showroom_url="https://showroom.${domain_suffix}"
tms_url="https://tms.${domain_suffix}"
intranet_url="https://intranet.${domain_suffix}"
ib_url="https://ib.${domain_suffix}"
legacy_url="https://wing.superfx.cn"
auth_url="https://auth.${domain_suffix}"
better_auth_cookie_domain=".${domain_suffix}"
better_auth_trusted_origins="${emp_url},${cmp_url},${showroom_url},${tms_url},${intranet_url}"
desktop_agent_windows_download_url="${NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL:-${emp_url}/api/downloads/desktop-agent/windows/latest}"
desktop_agent_macos_download_url="${NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL:-${emp_url}/api/downloads/desktop-agent/macos/latest}"

{
  printf 'PROJECTWING_ENVIRONMENT=%s\n' "${environment}"
  printf 'PROJECTWING_EMP_URL=%s\n' "${emp_url}"
  printf 'PROJECTWING_CMP_URL=%s\n' "${cmp_url}"
  printf 'PROJECTWING_SHOWROOM_URL=%s\n' "${showroom_url}"
  printf 'PROJECTWING_TMS_URL=%s\n' "${tms_url}"
  printf 'PROJECTWING_INTRANET_URL=%s\n' "${intranet_url}"
  printf 'PROJECTWING_IB_URL=%s\n' "${ib_url}"
  printf 'PROJECTWING_LEGACY_URL=%s\n' "${legacy_url}"
  printf 'PROJECTWING_AUTH_URL=%s\n' "${auth_url}"
  printf 'PROJECTWING_DOMAIN_SUFFIX=%s\n' "${domain_suffix}"
  printf 'NEXT_PUBLIC_API_BASE_URL=%s/api\n' "${emp_url}"
  printf 'NEXT_PUBLIC_EMP_API_BASE_URL=%s/api\n' "${emp_url}"
  printf 'NEXT_PUBLIC_CMP_API_BASE_URL=%s/api\n' "${cmp_url}"
  printf 'NEXT_PUBLIC_TMS_API_BASE_URL=%s/api\n' "${tms_url}"
  printf 'NEXT_PUBLIC_IB_API_BASE_URL=%s/api\n' "${ib_url}"
  printf 'NEXT_PUBLIC_AUTH_BASE_URL=%s\n' "${auth_url}"
  printf 'NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX=%s\n' "${domain_suffix}"
  printf 'NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL=%s\n' "${desktop_agent_windows_download_url}"
  printf 'NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL=%s\n' "${desktop_agent_macos_download_url}"
  printf 'BETTER_AUTH_URL=%s\n' "${auth_url}"
  printf 'BETTER_AUTH_COOKIE_DOMAIN=%s\n' "${better_auth_cookie_domain}"
  printf 'BETTER_AUTH_TRUSTED_ORIGINS=%s\n' "${better_auth_trusted_origins}"
  printf 'FRONTEND_URLS=%s,%s,%s,%s,%s,%s\n' "${emp_url}" "${cmp_url}" "${showroom_url}" "${tms_url}" "${intranet_url}" "${legacy_url}"
} >> "${GITHUB_ENV:?GITHUB_ENV is required}"
