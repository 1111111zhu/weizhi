#!/usr/bin/env bash
set -Eeuo pipefail

declare -a edge_ids=()
body="$(mktemp "${TMPDIR:-/tmp}/projectwing-edge-studio.XXXXXX")"
trap 'rm -f "${body}"' EXIT

mapfile -t edge_ids < <(docker ps -q \
  --filter label=com.docker.compose.project=projectwing-edge \
  --filter label=com.docker.compose.service=reverse-proxy)
[[ "${#edge_ids[@]}" -eq 1 && "${edge_ids[0]}" =~ ^([a-f0-9]{12}|[a-f0-9]{64})$ ]] || {
  echo 'Prisma Studio verification requires exactly one local Edge reverse proxy.' >&2
  exit 1
}
if ! docker exec "${edge_ids[0]}" wget -q -Y off -T 15 \
  --header 'Host: db.superfx.cn' -O - http://127.0.0.1:8081/ > "${body}"; then
  echo 'API verification failed for Prisma Studio through the protected Edge route.' >&2
  exit 1
fi
grep -Fq 'window.__STUDIO_CONFIG__' "${body}" || {
  echo 'API verification failed for Prisma Studio: identity marker was absent.' >&2
  exit 1
}
grep -Eq '"adapter"[[:space:]]*:[[:space:]]*"postgres"' "${body}" || {
  echo 'API verification failed for Prisma Studio: PostgreSQL adapter identity was absent.' >&2
  exit 1
}
echo 'Verified Prisma Studio through the protected Edge route: https://db.superfx.cn'
