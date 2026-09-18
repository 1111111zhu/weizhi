#!/usr/bin/env bash
set -Eeuo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
target="${root}/scripts/ci/image-bundle-provenance.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT
mkdir -p "${tmp}/bin" "${tmp}/project"

cat >"${tmp}/bin/docker" <<'FAKE'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$1" == image && "$2" == inspect && "$3" == --format && "$4" == '{{.Id}}' ]]
awk -F '|' -v ref="$5" '$1 == ref { print $2; found=1 } END { exit !found }' "${PW_IMAGE_MAP}"
FAKE
chmod +x "${tmp}/bin/docker"

source_sha=1111111111111111111111111111111111111111
bundle_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export PATH="${tmp}/bin:${PATH}" PW_IMAGE_MAP="${tmp}/images"
export PROJECTWING_ROOT="${tmp}/project" PROJECTWING_IMAGE_SOURCE_SHA="${source_sha}"
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

bash "${target}" record
bash "${target}" verify
jq -e '.schemaVersion == 1 and (.images | length == 10)' \
  "${tmp}/project/image-provenance/${bundle_sha}.json" >/dev/null

sed -i "s|sha256:$(printf '%064x' 3)|sha256:$(printf '%064x' 99)|" "${PW_IMAGE_MAP}"
if bash "${target}" verify; then
  echo 'Mismatched local image ID unexpectedly passed provenance verification.' >&2
  exit 1
fi

echo 'Image bundle provenance tests passed.'
