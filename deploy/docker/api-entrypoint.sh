#!/bin/sh
set -e

cd /app/apps/api

backup_database() {
  backup_dir="${DATABASE_BACKUP_DIR:-/app/backups}"
  backup_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_path="${backup_dir}/projectwing-pre-migration-${backup_timestamp}.dump"
  mkdir -p "${backup_dir}"
  database_url_for_pg_dump="$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
  pg_dump --format=custom --file="${backup_path}" "${database_url_for_pg_dump}"
  pg_restore --list "${backup_path}" >/dev/null
  backup_size="$(stat -c %s "${backup_path}")"
  backup_sha256="$(sha256sum "${backup_path}" | awk '{print $1}')"
  printf 'database.backup.path=%s\ndatabase.backup.size=%s\ndatabase.backup.sha256=%s\n' \
    "${backup_path}" "${backup_size}" "${backup_sha256}"
}

if [ "${1:-}" = "backup-only" ]; then
  backup_database
  exit 0
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  if [ "${RUN_DATABASE_BACKUP:-true}" = "true" ]; then
    backup_database
  fi
  corepack pnpm exec prisma migrate deploy
fi

if [ "${1:-}" = "migrate-only" ]; then
  exit 0
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  corepack pnpm run prisma:seed
fi

if [ "${1:-}" = "preview-worker" ]; then
  exec node dist/preview-worker.main.js
fi

if [ "${1:-}" = "studio" ]; then
  exec corepack pnpm exec prisma studio --port 5555 --browser none
fi

exec node dist/main.js
