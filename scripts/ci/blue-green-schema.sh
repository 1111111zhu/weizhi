#!/usr/bin/env bash

# Sourceable schema inspection and migration helpers. The caller provides the
# compose function and validated release/status paths.

database_migration_status() {
  local output status
  set +e
  output="$(compose run --rm --no-deps -T --entrypoint sh api -ec '
    cd /app/apps/api
    ./node_modules/.bin/prisma migrate status
  ' 2>&1)"
  status=$?
  set -e
  if (( status == 0 )); then
    printf 'current\n'
    return
  fi
  if grep -Eiq 'migration(s)? have not yet been applied|not yet been applied' <<<"${output}" \
    && ! grep -Eiq 'failed|diverg|modified after it was applied' <<<"${output}"; then
    printf 'pending\n'
    return
  fi
  printf '%s\n' "${output}" >&2
  echo 'Database migration state is not safely classifiable.' >&2
  return 1
}

write_marker() {
  local target="$1" value="$2" temporary
  temporary="$(mktemp "${target}.XXXXXX")"
  printf '%s\n' "${value}" > "${temporary}"
  chmod 600 "${temporary}"
  mv -f "${temporary}" "${target}"
}

inspect_database_schema() {
  local status
  status="$(database_migration_status)"
  write_marker "${schema_status_file}" "${status}"
  printf '%s\n' "${status}"
}

migrate_database_schema() {
  [[ "${maintenance_confirmed}" == true ]] || {
    echo 'Pending migrations require a verified dual-Edge maintenance window.' >&2
    return 1
  }
  [[ "$(cat "${schema_status_file}")" == pending ]] || {
    echo 'Migration execution requires a persisted pending schema status.' >&2
    return 1
  }
  write_marker "${migration_started_file}" "${PROJECTWING_RELEASE_KEY}"
  echo 'Applying pending database migrations without a host-local backup.'
  compose run --rm --no-deps -T -e RUN_MIGRATIONS=true \
    -e RUN_DATABASE_BACKUP=false api migrate-only
  [[ "$(database_migration_status)" == current ]]
  write_marker "${schema_status_file}" current
  write_marker "${migration_completed_file}" "${PROJECTWING_RELEASE_KEY}"
  echo 'Pending database migrations and backfill completed.'
}
