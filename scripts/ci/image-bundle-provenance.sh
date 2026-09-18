#!/usr/bin/env bash
set -Eeuo pipefail

project_root="${PROJECTWING_ROOT:-/opt/projectwing}"
provenance_root="${PROJECTWING_IMAGE_PROVENANCE_ROOT:-${project_root}/image-provenance}"
bundle_sha256="${PROJECTWING_OSS_IMAGE_BUNDLE_SHA256:-}"
bundle_object_key="${PROJECTWING_OSS_IMAGE_BUNDLE_OBJECT_KEY:-}"
image_source_sha="${PROJECTWING_IMAGE_SOURCE_SHA:-}"

required_image_variables() {
  printf '%s\n' \
    PROJECTWING_TRAEFIK_IMAGE PROJECTWING_GOTENBERG_IMAGE PROJECTWING_API_IMAGE \
    PROJECTWING_EMP_IMAGE PROJECTWING_CMP_IMAGE PROJECTWING_SHOWROOM_IMAGE \
    PROJECTWING_TMS_IMAGE PROJECTWING_INTRANET_IMAGE PROJECTWING_IB_IMAGE \
    PROJECTWING_IB_API_IMAGE
}

provenance_file() {
  [[ "${bundle_sha256}" =~ ^[a-f0-9]{64}$ ]] || return 1
  printf '%s/%s.json\n' "${provenance_root}" "${bundle_sha256}"
}

validate_image_ref() {
  local variable="$1" ref="$2" expected_name
  case "${variable}" in
    PROJECTWING_TRAEFIK_IMAGE)
      [[ "${ref}" =~ ^projectwing-traefik:[a-f0-9]{64}$ ]]
      ;;
    PROJECTWING_GOTENBERG_IMAGE)
      [[ "${ref}" =~ ^projectwing-gotenberg:[a-f0-9]{64}$ ]]
      ;;
    PROJECTWING_*_IMAGE)
      [[ "${image_source_sha}" =~ ^[a-f0-9]{40}$ ]] || return 1
      expected_name="${variable#PROJECTWING_}"
      expected_name="${expected_name%_IMAGE}"
      expected_name="${expected_name,,}"
      expected_name="${expected_name//_/-}"
      [[ "${ref}" == "projectwing-${expected_name}:${image_source_sha}" ]]
      ;;
    *) return 1 ;;
  esac
}

record_verified_image_bundle() {
  local manifest rows temporary variable ref image_id
  manifest="$(provenance_file)" || return 1
  [[ "${bundle_object_key}" == "ci-images/${image_source_sha}/images.tar.gz" ]] || return 1
  [[ ! -L "${provenance_root}" ]] || return 1
  install -d -m 750 "${provenance_root}"
  rows="$(mktemp "${provenance_root}/.images.XXXXXX")"
  temporary="$(mktemp "${provenance_root}/.manifest.XXXXXX")"
  trap 'rm -f "${rows}" "${temporary}"' RETURN
  while IFS= read -r variable; do
    ref="${!variable:-}"
    validate_image_ref "${variable}" "${ref}" || return 1
    image_id="$(docker image inspect --format '{{.Id}}' "${ref}")" || return 1
    [[ "${image_id}" =~ ^sha256:[a-f0-9]{64}$ ]] || return 1
    printf '%s\t%s\n' "${ref}" "${image_id}" >>"${rows}"
  done < <(required_image_variables)
  jq -Rn --arg sha256 "${bundle_sha256}" --arg objectKey "${bundle_object_key}" \
    --arg imageSourceSha "${image_source_sha}" \
    '[inputs | split("\t") | {ref:.[0],imageId:.[1]}] as $images |
      {schemaVersion:1,bundleSha256:$sha256,bundleObjectKey:$objectKey,
       imageSourceSha:$imageSourceSha,images:$images}' <"${rows}" >"${temporary}"
  chmod 640 "${temporary}"
  mv -f "${temporary}" "${manifest}"
  rm -f "${rows}"
  trap - RETURN
}

verified_required_images_present() {
  local manifest variable ref actual_id recorded_id
  manifest="$(provenance_file)" || return 1
  [[ -f "${manifest}" && -r "${manifest}" && ! -L "${manifest}" ]] || return 1
  jq -e --arg sha256 "${bundle_sha256}" --arg objectKey "${bundle_object_key}" \
    --arg imageSourceSha "${image_source_sha}" '
      .schemaVersion == 1 and .bundleSha256 == $sha256 and
      .bundleObjectKey == $objectKey and .imageSourceSha == $imageSourceSha and
      (.images | type == "array" and length == 10) and
      ([.images[].ref] | unique | length == 10) and
      all(.images[]; (.ref | type == "string") and
        (.imageId | type == "string" and test("^sha256:[a-f0-9]{64}$")))' \
    "${manifest}" >/dev/null || return 1
  while IFS= read -r variable; do
    ref="${!variable:-}"
    validate_image_ref "${variable}" "${ref}" || return 1
    actual_id="$(docker image inspect --format '{{.Id}}' "${ref}" 2>/dev/null)" || return 1
    recorded_id="$(jq -er --arg ref "${ref}" '[.images[] | select(.ref == $ref) | .imageId] |
      if length == 1 then .[0] else error("missing or duplicate image ref") end' "${manifest}")" || return 1
    [[ "${actual_id}" == "${recorded_id}" ]] || return 1
  done < <(required_image_variables)
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    record) record_verified_image_bundle ;;
    verify) verified_required_images_present ;;
    *) echo 'Usage: image-bundle-provenance.sh {record|verify}' >&2; exit 2 ;;
  esac
fi
