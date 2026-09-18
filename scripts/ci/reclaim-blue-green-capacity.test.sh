#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
reclaimer="${repo_root}/scripts/ci/reclaim-blue-green-capacity.sh"
fixture_root="$(mktemp -d)"
trap 'rm -rf "${fixture_root}"' EXIT
mkdir -p "${fixture_root}/bin"

cat > "${fixture_root}/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
state="${PW_FAKE_STATE:?}"
printf '%s\n' "$*" >> "${state}/calls"
case "${1:-}" in
  ps)
    if [[ "$*" == *"project=projectwing-blue"* ]]; then
      printf '%s\n' blue-stopped blue-running
    else
      printf '%s\n' blue-stopped blue-running green-running edge-running unrelated
    fi
    ;;
  inspect)
    format="$3"; id="$4"
    if [[ "${format}" == *compose.project* ]]; then
      case "${id}" in blue-stopped|blue-running) printf 'projectwing-blue\n' ;; green-running) printf 'projectwing-green\n' ;; edge-running) printf 'projectwing-edge\n' ;; unrelated) printf 'other-project\n' ;; *) exit 9 ;; esac
    elif [[ "${format}" == *compose.service* ]]; then
      case "${id}" in blue-stopped) printf '%s\n' "${PW_FAKE_SERVICE:-api}" ;; blue-running|green-running) printf 'api\n' ;; edge-running) printf 'reverse-proxy\n' ;; unrelated) printf 'other\n' ;; *) exit 9 ;; esac
    elif [[ "${format}" == *Image* ]]; then
      case "${id}" in blue-stopped) printf 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n' ;; blue-running) printf 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' ;; green-running) printf 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\n' ;; edge-running) printf 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\n' ;; unrelated) printf 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\n' ;; *) exit 9 ;; esac
    elif [[ "${format}" == *State.Running* ]]; then
      [[ "${id}" == blue-stopped ]] && printf 'false\n' || printf 'true\n'
    elif [[ "${format}" == *State.Status* ]]; then
      [[ "${id}" == blue-stopped ]] && printf 'exited\n' || printf 'running\n'
    elif [[ "${format}" == *working_dir* ]]; then
      case "${id}" in blue-stopped|green-running) printf '%s\n' "${PW_FAKE_STATE}/releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1" ;; blue-running) printf '%s\n' "${PW_FAKE_STATE}/releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1" ;; edge-running) printf '%s\n' "${PW_FAKE_STATE}/releases/cccccccccccccccccccccccccccccccccccccccc-3-1" ;; unrelated) printf '/srv/unrelated\n' ;; *) exit 9 ;; esac
    else
      exit 9
    fi
    ;;
  rm)
    [[ "$*" != *--force* && "$*" != *--volumes* && "$*" != *" -v"* ]] || exit 20
    printf 'container-rm %s\n' "$*" >> "${state}/calls"
    ;;
  image)
    case "${2:-}" in
      ls)
        printf 'projectwing-api|1111111111111111111111111111111111111111\n'
        printf 'projectwing-api|2222222222222222222222222222222222222222\n'
        printf 'projectwing-emp|3333333333333333333333333333333333333333\n'
        printf 'vendor/keep|latest\n'
        ;;
      inspect)
        ref="${5:-}"
        case "${ref}" in
          projectwing-api:1111111111111111111111111111111111111111) printf 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n' ;;
          projectwing-api:2222222222222222222222222222222222222222) printf 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\n' ;;
          projectwing-emp:3333333333333333333333333333333333333333) printf 'sha256:9999999999999999999999999999999999999999999999999999999999999999\n' ;;
          *) exit 10 ;;
        esac
        ;;
      rm)
        [[ "${3:-}" == --no-prune ]] || exit 21
        printf 'image-rm %s\n' "${4:-}" >> "${state}/calls"
        ;;
      *) exit 12 ;;
    esac
    ;;
  *) exit 13 ;;
esac
FAKE_DOCKER

cat > "${fixture_root}/bin/find" <<'FAKE_FIND'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == *"-type l"* ]]; then exec /usr/bin/find "$@"; fi
[[ -z "${PW_FAKE_FIND_FAIL:-}" ]] || exit 30
if [[ -n "${PW_FAKE_FIND_OUTPUT:-}" ]]; then
  printf '%s\n' "${PW_FAKE_FIND_OUTPUT}"
else
  printf '5|%s/releases/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-5-1\n' "${PW_FAKE_STATE}"
  printf '4|%s/releases/dddddddddddddddddddddddddddddddddddddddd-4-1\n' "${PW_FAKE_STATE}"
  printf '3|%s/releases/9999999999999999999999999999999999999999-6-1\n' "${PW_FAKE_STATE}"
fi
FAKE_FIND

cat > "${fixture_root}/bin/df" <<'FAKE_DF'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == *" -i "* || "$*" == *" -i"* ]]; then
  printf 'Filesystem Inodes IUsed IFree IUse%% Mounted on\n/dev/fake %s 1 %s 1%% /\n' "${PW_FAKE_INODES:-20000}" "${PW_FAKE_INODES:-20000}"
else
  printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/fake 100 1 %s 1%% /\n' "${PW_FAKE_BYTES:-99999999999}"
fi
FAKE_DF
chmod +x "${fixture_root}/bin/docker" "${fixture_root}/bin/find" "${fixture_root}/bin/df"
export PATH="${fixture_root}/bin:${PATH}"

run_case() {
  local name="$1"; shift
  local state="${fixture_root}/${name}"
  mkdir -p "${state}/releases"
  for key in aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1 cccccccccccccccccccccccccccccccccccccccc-3-1 dddddddddddddddddddddddddddddddddddddddd-4-1 eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-5-1 9999999999999999999999999999999999999999-6-1 1111111111111111111111111111111111111111-123-1; do
    mkdir -p "${state}/releases/${key}/secrets"
  done
  printf 'PROJECTWING_API_IMAGE=projectwing-api:2222222222222222222222222222222222222222\n' \
    > "${state}/releases/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1/secrets/projectwing-registry.env"
  : > "${state}/calls"
  exec 9>"${state}/deployment.lock"
  flock --nonblock 9
  set +e
  env PATH="${fixture_root}/bin:${PATH}" PW_FAKE_STATE="${state}" \
    PROJECTWING_ROOT="${state}" PROJECTWING_RELEASE_DIR="${state}/releases/1111111111111111111111111111111111111111-123-1" \
    PROJECTWING_DEPLOY_LOCK_FILE="${state}/deployment.lock" PROJECTWING_DEPLOY_LOCK_INHERITED=1111111111111111111111111111111111111111-123-1 \
    PROJECTWING_COLOR=blue PROJECTWING_VERSION=1111111111111111111111111111111111111111 PROJECTWING_RELEASE_KEY=1111111111111111111111111111111111111111-123-1 \
    PROJECTWING_API_IMAGE=projectwing-api:1111111111111111111111111111111111111111 \
    PROJECTWING_ACTIVE_RELEASE_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1 \
    PROJECTWING_PREVIOUS_RELEASE_KEY=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-2-1 "$@" bash "${reclaimer}"
  status=$?
  set -e
  exec 9>&-
  return "${status}"
}

run_case ok
grep -Fq 'container-rm' "${fixture_root}/ok/calls"
grep -Fq 'image-rm projectwing-emp:3333333333333333333333333333333333333333' "${fixture_root}/ok/calls"
if grep -Fq 'image-rm projectwing-api:2222222222222222222222222222222222222222' "${fixture_root}/ok/calls"; then exit 1; fi
if grep -Eq -- 'projectwing-api:1111|--force|--volumes| -v' "${fixture_root}/ok/calls"; then exit 1; fi
[[ ! -d "${fixture_root}/ok/releases/9999999999999999999999999999999999999999-6-1" ]]

run_case prisma-studio PW_FAKE_SERVICE=prisma-studio
grep -Fq 'container-rm rm blue-stopped' "${fixture_root}/prisma-studio/calls"

if run_case unknown PW_FAKE_SERVICE=unknown 2>/dev/null; then echo 'unknown service accepted' >&2; exit 1; fi
! grep -q 'container-rm\|image-rm' "${fixture_root}/unknown/calls"

if run_case out-of-bounds PROJECTWING_RELEASE_KEY=../outside 2>/dev/null; then echo 'out-of-bounds release accepted' >&2; exit 1; fi
if run_case release-dir-out-of-bounds PROJECTWING_RELEASE_DIR=/tmp/outside 2>/dev/null; then echo 'out-of-bounds release directory accepted' >&2; exit 1; fi
if run_case no-lock PROJECTWING_DEPLOY_LOCK_INHERITED=wrong 2>/dev/null; then echo 'missing lock scope accepted' >&2; exit 1; fi

if run_case low-bytes PW_FAKE_BYTES=1 2>/dev/null; then echo 'low disk accepted' >&2; exit 1; fi

if run_case low-inodes PW_FAKE_INODES=1 2>/dev/null; then echo 'low inode accepted' >&2; exit 1; fi

if run_case find-failure PW_FAKE_FIND_FAIL=1 2>/dev/null; then echo 'find failure accepted' >&2; exit 1; fi

echo 'Blue/Green capacity reclamation tests passed.'
