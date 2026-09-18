#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${PROJECTWING_ENVIRONMENT:?PROJECTWING_ENVIRONMENT is required}"

if [ "${PROJECTWING_ENVIRONMENT}" != "development" ]; then
  echo "PROJECTWING_ENVIRONMENT must be development; got: ${PROJECTWING_ENVIRONMENT}" >&2
  exit 1
fi

environment_prefix="development"
domain_suffix="superfx.cn"

publish_deployment() {
  local system="$1"
  local url="$2"
  local environment="${environment_prefix}-${system}"
  local log_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
  local deployment_payload
  local status_payload
  local deployment_id

  deployment_payload="$(mktemp)"
  status_payload="$(mktemp)"
  trap 'rm -f "${deployment_payload}" "${status_payload}"' RETURN

  cat > "${deployment_payload}" <<JSON
{
  "ref": "${GITHUB_SHA}",
  "task": "deploy",
  "auto_merge": false,
  "required_contexts": [],
  "environment": "${environment}",
  "description": "Project Wing ${environment} deployment"
}
JSON

  deployment_id="$(
    gh api \
      --method POST \
      "repos/${GITHUB_REPOSITORY}/deployments" \
      --input "${deployment_payload}" \
      --jq ".id"
  )"

  cat > "${status_payload}" <<JSON
{
  "state": "success",
  "environment_url": "${url}",
  "log_url": "${log_url}",
  "auto_inactive": true,
  "description": "Deployment verified"
}
JSON

  gh api \
    --method POST \
    "repos/${GITHUB_REPOSITORY}/deployments/${deployment_id}/statuses" \
    --input "${status_payload}" \
    --jq "{environment: .environment, state: .state, environment_url: .environment_url}"
}

add_publish_system() {
  case ",${systems}," in
    *,"$1",*) ;;
    *) systems="${systems:+${systems},}$1" ;;
  esac
}

systems="${PROJECTWING_DEPLOYMENT_SYSTEMS:-}"
if [ -z "${systems}" ]; then
  deploy_systems="${PROJECTWING_DEPLOY_SYSTEMS:-emp}"
  IFS="," read -r -a deploy_system_names <<< "${deploy_systems}"
  for deploy_system_name in "${deploy_system_names[@]}"; do
    case "${deploy_system_name}" in
      api | emp)
        add_publish_system emp
        ;;
      cmp)
        add_publish_system cmp
        ;;
      showroom)
        add_publish_system showroom
        ;;
      tms)
        add_publish_system tms
        ;;
      intranet)
        add_publish_system intranet
        ;;
      ib | ib-api)
        add_publish_system ib
        ;;
    esac
  done
fi
systems="${systems:-emp}"

IFS="," read -r -a system_names <<< "${systems}"
for system_name in "${system_names[@]}"; do
  case "${system_name}" in
    emp | cmp | showroom | tms | intranet | ib)
      publish_deployment "${system_name}" "https://${system_name}.${domain_suffix}"
      ;;
    *)
      echo "Unsupported deployment system: ${system_name}" >&2
      exit 1
      ;;
  esac
done
