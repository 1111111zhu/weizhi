#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
target="${root}/scripts/ci/deploy-ssh.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
mkdir -p "${tmp}/bin" "${tmp}/ssh"

ssh-keygen -q -t ed25519 -N '' -f "${tmp}/pinned" >/dev/null
ssh-keygen -q -t ed25519 -N '' -f "${tmp}/other" >/dev/null
pinned_line="[edge.test]:2222 $(cat "${tmp}/pinned.pub")"

cat >"${tmp}/bin/ssh" <<'FAKE'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"${TEST_SSH_ARGS}"
for argument in "$@"; do
  if [[ "${argument}" == -G ]]; then
    echo 'proxycommand none'
    exit 0
  fi
done
exit 0
FAKE

cat >"${tmp}/bin/ssh-keyscan" <<'FAKE'
#!/usr/bin/env bash
set -Eeuo pipefail
count=0
[[ ! -r "${TEST_SCAN_COUNT}" ]] || count="$(cat "${TEST_SCAN_COUNT}")"
count=$(( count + 1 ))
printf '%s\n' "${count}" >"${TEST_SCAN_COUNT}"
if [[ "${TEST_SCAN_MODE}" == eventual && "${count}" -ge 2 ]]; then
  cat "${TEST_MATCH_KEY}"
else
  cat "${TEST_MISMATCH_KEY}"
fi
FAKE
chmod +x "${tmp}/bin/ssh" "${tmp}/bin/ssh-keyscan"

run_case() {
  local name="$1" mode="$2" expected_status="$3" expected_scans="$4"
  local case_dir="${tmp}/${name}" status
  mkdir -p "${case_dir}"
  set +e
  TEST_SCAN_COUNT="${case_dir}/scan-count" \
    TEST_SCAN_MODE="${mode}" \
    TEST_MATCH_KEY="${tmp}/pinned.pub" \
    TEST_MISMATCH_KEY="${tmp}/other.pub" \
    TEST_SSH_ARGS="${case_dir}/ssh-args" \
    DEPLOY_HOST=edge.test DEPLOY_USER=ops \
    PROJECTWING_DEPLOY_SSH_PORT=2222 \
    PROJECTWING_DEPLOY_SSH_DIR="${case_dir}/ssh" \
    PROJECTWING_DEPLOY_SSH_KEY_FILE="${tmp}/pinned" \
    PROJECTWING_DEPLOY_SSH_KNOWN_HOSTS="${pinned_line}" \
    PROJECTWING_DEPLOY_SSH_CONNECT_TIMEOUT_SECONDS=1 \
    PROJECTWING_DEPLOY_SSH_CONFIGURE_ATTEMPTS=2 \
    PROJECTWING_DEPLOY_SSH_CONFIGURE_DELAY_SECONDS=1 \
    PROJECTWING_DEPLOY_SSH_COMMAND="${tmp}/bin/ssh" \
    PROJECTWING_DEPLOY_SSH_KEYSCAN_COMMAND="${tmp}/bin/ssh-keyscan" \
    bash "${target}" configure >"${case_dir}/out" 2>"${case_dir}/err"
  status="$?"
  set -e
  [[ "${status}" == "${expected_status}" ]]
  [[ "$(cat "${case_dir}/scan-count")" == "${expected_scans}" ]]
}

run_case eventual-match eventual 0 2
grep -Fq 'Direct batch-mode OpenSSH authentication succeeded' "${tmp}/eventual-match/out"
grep -Fq 'ControlMaster=auto' "${tmp}/eventual-match/ssh-args"
grep -Fq 'ControlPersist=600' "${tmp}/eventual-match/ssh-args"
grep -Eq 'ControlPath=/tmp/projectwing-ssh-[a-f0-9]{16}/%C' "${tmp}/eventual-match/ssh-args"

run_case persistent-mismatch mismatch 1 2
grep -Fq 'did not match DEPLOY_SSH_KNOWN_HOSTS in any scan' "${tmp}/persistent-mismatch/err"

echo 'Deployment SSH retry tests passed.'
