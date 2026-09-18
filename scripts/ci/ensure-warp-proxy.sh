#!/usr/bin/env bash

set -euo pipefail

proxy_port="${PROJECTWING_WARP_PROXY_PORT:-40000}"
check_url="${PROJECTWING_WARP_CHECK_URL:-}"

if ! [[ "${proxy_port}" =~ ^[1-9][0-9]*$ ]] || (( proxy_port > 65535 )); then
  echo "PROJECTWING_WARP_PROXY_PORT must be a valid TCP port." >&2
  exit 2
fi

if ! command -v warp-cli >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Cloudflare WARP is required on this self-hosted runner.
Install it once with the official Cloudflare Linux package, then rerun this job.
EOF
  exit 1
fi

if ! warp-cli --accept-tos status >/dev/null 2>&1; then
  cat >&2 <<'EOF'
The Cloudflare WARP daemon is unavailable to the runner user.
Enable and register WARP once on the self-hosted runner, then rerun this job.
EOF
  exit 1
fi

connect_proxy() {
  warp-cli --accept-tos disconnect || true
  sleep 1
  warp-cli --accept-tos mode proxy
  warp-cli --accept-tos proxy port "${proxy_port}"
  warp-cli --accept-tos connect
}

connect_proxy

for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error \
    --proxy "socks5h://127.0.0.1:${proxy_port}" \
    https://www.cloudflare.com/cdn-cgi/trace \
    | grep -qx 'warp=on'; then
    if [[ -z "${check_url}" ]]; then
      echo "WARP SOCKS proxy is ready on 127.0.0.1:${proxy_port}."
      exit 0
    fi
    status_code="$(curl --silent --show-error --output /dev/null \
      --write-out '%{http_code}' --connect-timeout 10 --max-time 30 \
      --proxy "socks5h://127.0.0.1:${proxy_port}" "${check_url}" || true)"
    if [[ "${status_code}" != "000" && -n "${status_code}" ]]; then
      echo "WARP SOCKS proxy can reach the configured OSS endpoint (HTTP ${status_code})."
      exit 0
    fi
  fi

  if (( attempt % 15 == 0 )); then
    echo "WARP SOCKS proxy check failed; reconnecting (attempt ${attempt}/45)." >&2
    connect_proxy
  fi

  sleep 2
done

echo "WARP SOCKS proxy could not reach the configured endpoint." >&2
warp-cli --accept-tos status || true
exit 1
