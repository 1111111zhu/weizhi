#!/usr/bin/env bash
set -Eeuo pipefail

release_dir="${PROJECTWING_RELEASE_DIR:?PROJECTWING_RELEASE_DIR is required}"
candidate_dynamic_dir="${PROJECTWING_CANDIDATE_DYNAMIC_DIR:-${release_dir}/candidate-dynamic}"
routing_template="${release_dir}/deploy/traefik/dynamic/routing.yml"
routing_target="${candidate_dynamic_dir}/routing.yml"
edge_proxy_sentinel="192.0.2.1/32"
edge_proxy_gateway=''
temporary=''
declare -a edge_proxy_ids=()

test -r "${routing_template}"
test -d "${candidate_dynamic_dir}"
mapfile -t edge_proxy_ids < <(docker ps -q \
  --filter label=com.docker.compose.project=projectwing-edge \
  --filter label=com.docker.compose.service=reverse-proxy)
[[ "${#edge_proxy_ids[@]}" -eq 1 ]] || {
  echo 'Candidate routing requires exactly one local Edge reverse proxy.' >&2
  exit 1
}
edge_proxy_gateway="$(docker inspect --format \
  '{{with index .NetworkSettings.Networks "projectwing-proxy"}}{{.Gateway}}{{end}}' \
  "${edge_proxy_ids[0]}")"
[[ "${edge_proxy_gateway}" =~ ^172\.(1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || {
  echo 'Local Edge reverse proxy has no approved private projectwing-proxy gateway.' >&2
  exit 1
}
[[ "$(grep -Fc "\"${edge_proxy_sentinel}\"" "${routing_template}")" -eq 1 ]]
temporary="$(mktemp "${candidate_dynamic_dir}/.routing.XXXXXX")"
trap 'rm -f "${temporary}"' EXIT
sed "s|\"${edge_proxy_sentinel}\"|\"${edge_proxy_gateway}/32\"|" \
  "${routing_template}" > "${temporary}"
chmod 644 "${temporary}"
mv -f "${temporary}" "${routing_target}"
trap - EXIT
printf 'candidate_edge_gateway_cidr=%s/32\n' "${edge_proxy_gateway}"
