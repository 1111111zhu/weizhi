#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REF:?GITHUB_REF is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

if [[ "${GITHUB_REF}" != "refs/heads/main" ]]; then
  echo "Refusing deployment from ${GITHUB_REF}; deployments must run from refs/heads/main." >&2
  exit 1
fi

main_sha="$(gh api "repos/${GITHUB_REPOSITORY}/git/ref/heads/main" --jq '.object.sha')"
if [[ ! "${main_sha}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "GitHub returned an invalid main ref SHA: ${main_sha:-<empty>}." >&2
  exit 1
fi

if [[ "${GITHUB_SHA}" != "${main_sha}" ]]; then
  echo "Refusing stale deployment ${GITHUB_SHA}; current main is ${main_sha}." >&2
  exit 1
fi

echo "Deployment source is the current main commit: ${GITHUB_SHA}."
