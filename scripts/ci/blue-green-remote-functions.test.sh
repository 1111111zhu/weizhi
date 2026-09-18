#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${root}/scripts/ci/blue-green-remote-functions.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
deploy_archive="${tmp}/deploy.tar.gz"
app_env="${tmp}/app.env"
oss_env="${tmp}/oss.env"
registry_env="${tmp}/registry.env"
acme_access_key="${tmp}/access-key"
acme_secret_key="${tmp}/secret-key"
touch "${deploy_archive}" "${app_env}" "${oss_env}" "${registry_env}" "${acme_access_key}" "${acme_secret_key}"

ssh_calls=0
scp_calls=0
remote_ssh() {
  ssh_calls=$(( ssh_calls + 1 ))
  (( ssh_calls == 1 )) && return 255
  return 0
}
remote_scp() {
  scp_calls=$(( scp_calls + 1 ))
  (( scp_calls == 1 )) && return 124
  return 0
}

PROJECTWING_STAGING_TRANSPORT_ATTEMPTS=2 PROJECTWING_STAGING_TRANSPORT_DELAY_SECONDS=1 \
  stage_target green pinned 42-1
[[ "${ssh_calls}" == 3 ]]
[[ "${scp_calls}" == 7 ]]

non_transport_calls=0
permanent_failure() { non_transport_calls=$(( non_transport_calls + 1 )); return 42; }
set +e
PROJECTWING_STAGING_TRANSPORT_ATTEMPTS=4 PROJECTWING_STAGING_TRANSPORT_DELAY_SECONDS=1 \
  retry_remote_transport 'Permanent failure' permanent_failure
status="$?"
set -e
[[ "${status}" == 42 ]]
[[ "${non_transport_calls}" == 1 ]]

pre_migration_calls=0
transient_pre_migration_operation() {
  pre_migration_calls=$(( pre_migration_calls + 1 ))
  (( pre_migration_calls == 1 )) && return 255
  return 0
}
PROJECTWING_STAGING_TRANSPORT_ATTEMPTS=2 PROJECTWING_STAGING_TRANSPORT_DELAY_SECONDS=1 \
  retry_remote_transport 'Prepare immutable release directory' transient_pre_migration_operation
[[ "${pre_migration_calls}" == 2 ]]

for transport_output in \
  'ssh: connect to host 100.113.169.107 port 2222: Connection timed out' \
  'client_loop: send disconnect: Connection reset by peer' \
  'lost connection'; do
  set +e
  normalize_scp_transport_status 1 "${transport_output}"
  status="$?"
  set -e
  [[ "${status}" == 255 ]]
done

set +e
normalize_scp_transport_status 1 'scp: dest open "/opt/projectwing/file": Permission denied'
status="$?"
set -e
[[ "${status}" == 1 ]]

writer_timeout=''
writer_command=''
remote_ssh() {
  writer_timeout="${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-}"
  writer_command="$3"
  cat >/dev/null || true
}
edge_active_state='{"activeColor":"blue","releaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1"}'
blue_host=blue.test
green_host=green.test
blue_known_hosts=blue
green_known_hosts=green
PROJECTWING_STOP_PREVIOUS_WRITERS_TIMEOUT_SECONDS=420 stop_previous_writers
[[ "${writer_timeout}" == 420 ]]
[[ "${writer_command}" == "color='blue' bash -s" ]]

retire_timeout=''
retire_command=''
remote_ssh() {
  retire_timeout="${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-}"
  retire_command="$3"
}
edge_ha_read_node() {
  printf '%s\n' '{"previousColor":"blue","previousReleaseKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1"}'
}
candidate_host=green.test
candidate_known_hosts=green
candidate_cleanup_name=cleanup-blue-green-candidate.sh
release_key=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1
PROJECTWING_RETIRE_PREVIOUS_STACK_TIMEOUT_SECONDS=480 retire_previous_active_stack
[[ "${retire_timeout}" == 480 ]]
[[ "${retire_command}" == *"PROJECTWING_CLEANUP_REASON='retired-previous'"* ]]

cleanup_timeout=''
cleanup_command=''
remote_ssh() {
  cleanup_timeout="${PROJECTWING_REMOTE_SSH_TIMEOUT_SECONDS:-}"
  cleanup_command="$3"
}
candidate_color=green
PROJECTWING_FAILED_CANDIDATE_CLEANUP_TIMEOUT_SECONDS=540 cleanup_failed_promotion_candidate
[[ "${cleanup_timeout}" == 540 ]]
[[ "${cleanup_command}" == *"cleanup-blue-green-candidate.sh"* ]]

echo 'Blue/Green staging transport retry tests passed.'
