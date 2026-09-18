#!/usr/bin/env bash
set -euo pipefail

runtime_env="${1:?runtime env file is required}"
compose_file="${2:?docker compose file is required}"
origin="${PROJECTWING_OSS_BROWSER_ORIGIN:-https://emp.superfx.cn}"

if [[ "${PROJECTWING_VERIFY_OSS_BROWSER_CORS:-1}" != "1" ]]; then
  echo "Skipping OSS browser CORS verification by configuration."
  exit 0
fi

test -f "${runtime_env}"
test -f "${compose_file}"

signed_url="$({
  docker compose --env-file "${runtime_env}" -f "${compose_file}" \
    exec -T -w /app/apps/api api node <<'NODE'
const OSS = require("ali-oss");

if (process.env.STORAGE_DRIVER !== "oss") process.exit(0);

const client = new OSS({
  region: process.env.OSS_REGION,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  secure: true,
});

process.stdout.write(
  client.signatureUrl("diagnostics/browser-cors-preflight.txt", {
    method: "PUT",
    expires: 120,
    "Content-Type": "application/octet-stream",
    "x-oss-forbid-overwrite": "true",
    "x-oss-meta-sha256": "0".repeat(64),
  })
);
NODE
} | tr -d '\r\n')"

if [[ -z "${signed_url}" ]]; then
  echo "Skipping OSS browser CORS verification because object storage is not OSS."
  exit 0
fi

headers_file="$(mktemp)"
trap 'rm -f "${headers_file}"' EXIT

status_code="$(curl -sS --connect-timeout 10 --max-time 30 \
  -o /dev/null -D "${headers_file}" -w '%{http_code}' \
  -X OPTIONS "${signed_url}" \
  -H "Origin: ${origin}" \
  -H 'Access-Control-Request-Method: PUT' \
  -H 'Access-Control-Request-Headers: content-type,x-oss-forbid-overwrite,x-oss-meta-sha256')"

allowed_origin="$(sed -n 's/^[Aa]ccess-[Cc]ontrol-[Aa]llow-[Oo]rigin:[[:space:]]*//p' "${headers_file}" | tr -d '\r' | sed -n '1p')"

if [[ ! "${status_code}" =~ ^2 ]] || [[ "${allowed_origin}" != "${origin}" && "${allowed_origin}" != "*" ]]; then
  echo "OSS browser CORS preflight failed for ${origin}: HTTP ${status_code}." >&2
  echo "Configure the OSS bucket to allow PUT from ${origin} with Content-Type, x-oss-forbid-overwrite, and x-oss-meta-sha256 request headers." >&2
  exit 1
fi

echo "OSS browser CORS preflight verified for ${origin}."
