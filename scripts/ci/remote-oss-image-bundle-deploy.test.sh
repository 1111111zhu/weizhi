#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
version=1111111111111111111111111111111111111111
release_key="${version}-123-1"
project="${tmp}/project"; release="${project}/releases/${release_key}"
mkdir -p "${release}/scripts/ci" "${release}/secrets" "${tmp}/bin"
cp "${root}/scripts/ci/remote-oss-image-bundle-deploy.sh" "${release}/scripts/ci/"
cp "${root}/scripts/ci/image-bundle-provenance.sh" "${release}/scripts/ci/"
cat >"${release}/scripts/ci/deployment-health.sh" <<'HEALTH'
pw_require_full_deploy_scope() { [[ "$1" == api,emp,cmp,showroom,tms,intranet,ib,ib-api,reverse-proxy ]]; }
HEALTH
: >"${release}/docker-compose.development.yml"
: >"${release}/secrets/projectwing-oss.env"

cat >"${release}/scripts/ci/reclaim-blue-green-capacity.sh" <<'RECLAIM'
#!/usr/bin/env bash
printf 'reclaim:%s\n' "${PROJECTWING_MIN_AVAILABLE_BYTES}" >>"${PW_CALLS}"
RECLAIM
cat >"${release}/scripts/ci/blue-green-controller.sh" <<'CONTROLLER'
#!/usr/bin/env bash
printf 'controller\n' >>"${PW_CALLS}"
CONTROLLER
chmod +x "${release}/scripts/ci/reclaim-blue-green-capacity.sh"

cat >"${tmp}/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$1" == image && "$2" == inspect && "$3" == --format && "$4" == '{{.Id}}' ]]; then
  awk -F '|' -v ref="$5" '$1 == ref { print $2; found=1 } END { exit !found }' "${PW_IMAGE_MAP}"
  exit
fi
echo "unexpected-docker:$*" >>"${PW_CALLS}"
exit 91
DOCKER
cat >"${tmp}/bin/systemctl" <<'SYSTEMCTL'
#!/usr/bin/env bash
exit 0
SYSTEMCTL
cat >"${tmp}/bin/netbird" <<'NETBIRD'
#!/usr/bin/env bash
printf 'Management: Connected\n'
NETBIRD
cat >"${tmp}/bin/curl" <<'CURL'
#!/usr/bin/env bash
echo download >>"${PW_CALLS}"
exit 92
CURL
chmod +x "${tmp}/bin/"*

source_sha="${version}"; bundle_sha="$(printf 'a%.0s' {1..64})"
export PATH="${tmp}/bin:${PATH}" PW_CALLS="${tmp}/calls" PW_IMAGE_MAP="${tmp}/images"
export PROJECTWING_ROOT="${project}" PROJECTWING_IMAGE_SOURCE_SHA="${source_sha}"
export PROJECTWING_OSS_IMAGE_BUNDLE_SHA256="${bundle_sha}"
export PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY="ci-images/${source_sha}/images.tar.gz"
export PROJECTWING_TRAEFIK_IMAGE="projectwing-traefik:$(printf '2%.0s' {1..64})"
export PROJECTWING_GOTENBERG_IMAGE="projectwing-gotenberg:$(printf '3%.0s' {1..64})"
export PROJECTWING_API_IMAGE="projectwing-api:${source_sha}" PROJECTWING_EMP_IMAGE="projectwing-emp:${source_sha}"
export PROJECTWING_CMP_IMAGE="projectwing-cmp:${source_sha}" PROJECTWING_SHOWROOM_IMAGE="projectwing-showroom:${source_sha}"
export PROJECTWING_TMS_IMAGE="projectwing-tms:${source_sha}" PROJECTWING_INTRANET_IMAGE="projectwing-intranet:${source_sha}"
export PROJECTWING_IB_IMAGE="projectwing-ib:${source_sha}" PROJECTWING_IB_API_IMAGE="projectwing-ib-api:${source_sha}"

index=1
for variable in PROJECTWING_TRAEFIK_IMAGE PROJECTWING_GOTENBERG_IMAGE PROJECTWING_API_IMAGE \
  PROJECTWING_EMP_IMAGE PROJECTWING_CMP_IMAGE PROJECTWING_SHOWROOM_IMAGE PROJECTWING_TMS_IMAGE \
  PROJECTWING_INTRANET_IMAGE PROJECTWING_IB_IMAGE PROJECTWING_IB_API_IMAGE; do
  printf '%s|sha256:%064x\n' "${!variable}" "${index}" >>"${PW_IMAGE_MAP}"
  index=$((index + 1))
done
bash "${release}/scripts/ci/image-bundle-provenance.sh" record

cat >"${release}/secrets/projectwing-registry.env" <<EOF
PROJECTWING_TRAEFIK_IMAGE=${PROJECTWING_TRAEFIK_IMAGE}
PROJECTWING_GOTENBERG_IMAGE=${PROJECTWING_GOTENBERG_IMAGE}
PROJECTWING_API_IMAGE=${PROJECTWING_API_IMAGE}
PROJECTWING_EMP_IMAGE=${PROJECTWING_EMP_IMAGE}
PROJECTWING_CMP_IMAGE=${PROJECTWING_CMP_IMAGE}
PROJECTWING_SHOWROOM_IMAGE=${PROJECTWING_SHOWROOM_IMAGE}
PROJECTWING_TMS_IMAGE=${PROJECTWING_TMS_IMAGE}
PROJECTWING_INTRANET_IMAGE=${PROJECTWING_INTRANET_IMAGE}
PROJECTWING_IB_IMAGE=${PROJECTWING_IB_IMAGE}
PROJECTWING_IB_API_IMAGE=${PROJECTWING_IB_API_IMAGE}
EOF

PROJECTWING_VERSION="${version}" PROJECTWING_RELEASE_KEY="${release_key}" PROJECTWING_COLOR=blue \
  PROJECTWING_DEPLOY_SYSTEMS=api,emp,cmp,showroom,tms,intranet,ib,ib-api,reverse-proxy \
  PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION=deploy PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES=1000 \
  PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES=2000 PROJECTWING_DISK_SAFETY_RESERVE_BYTES=3000 \
  PROJECTWING_OSS_ENV_FILE="${release}/secrets/projectwing-oss.env" \
  PROJECTWING_REGISTRY_ENV_FILE="${release}/secrets/projectwing-registry.env" \
  PROJECTWING_DEPLOY_ARCHIVE_FILE="${release}/docker-compose.development.yml" \
  bash "${release}/scripts/ci/remote-oss-image-bundle-deploy.sh"

grep -Fxq reclaim:3000 "${PW_CALLS}"
grep -Fxq controller "${PW_CALLS}"
if grep -Fxq download "${PW_CALLS}"; then
  echo 'Verified preloaded path unexpectedly downloaded the bundle.' >&2
  exit 1
fi

: >"${PW_CALLS}"
sed -i "s|sha256:$(printf '%064x' 3)|sha256:$(printf '%064x' 99)|" "${PW_IMAGE_MAP}"
set +e
PROJECTWING_VERSION="${version}" PROJECTWING_RELEASE_KEY="${release_key}" PROJECTWING_COLOR=blue \
  PROJECTWING_DEPLOY_SYSTEMS=api,emp,cmp,showroom,tms,intranet,ib,ib-api,reverse-proxy \
  PROJECTWING_OSS_IMAGE_BUNDLE_OPERATION=activate-preloaded PROJECTWING_OSS_IMAGE_BUNDLE_SIZE_BYTES=1000 \
  PROJECTWING_OSS_IMAGE_BUNDLE_UNCOMPRESSED_SIZE_BYTES=2000 \
  PROJECTWING_OSS_ENV_FILE="${release}/secrets/projectwing-oss.env" \
  PROJECTWING_REGISTRY_ENV_FILE="${release}/secrets/projectwing-registry.env" \
  PROJECTWING_DEPLOY_ARCHIVE_FILE="${release}/docker-compose.development.yml" \
  bash "${release}/scripts/ci/remote-oss-image-bundle-deploy.sh" >/dev/null 2>&1
status="$?"
set -e
[[ "${status}" -ne 0 ]]
if grep -Fxq controller "${PW_CALLS}"; then
  echo 'Mismatched preloaded image reached candidate activation.' >&2
  exit 1
fi
echo 'Remote OSS preloaded deployment tests passed.'
