#!/usr/bin/env bash

set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_root}/../.." && pwd)"
temporary_root="$(mktemp -d)"
manager_pid=""

cleanup() {
  if [[ -n "${manager_pid}" ]] && kill -0 "${manager_pid}" 2>/dev/null; then
    kill "${manager_pid}" 2>/dev/null || true
    wait "${manager_pid}" 2>/dev/null || true
  fi
  rm -rf -- "${temporary_root}"
}
trap cleanup EXIT

publish_trimmed() {
  local project="$1"
  local destination="$2"
  dotnet publish "${project}" \
    -c Release \
    -r linux-x64 \
    --self-contained true \
    -p:PublishSingleFile=false \
    -p:PublishTrimmed=true \
    -p:TrimMode=partial \
    -p:JsonSerializerIsReflectionEnabledByDefault=true \
    -p:SuppressTrimAnalysisWarnings=true \
    -p:DebugType=None \
    -p:DebugSymbols=false \
    -o "${destination}"
}

wait_for_health() {
  local health_url="$1"
  local attempt max_attempts=120
  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    if curl --noproxy "*" -fsS "${health_url}" \
      >"${temporary_root}/health.json" 2>/dev/null &&
      verify_response \
        "${temporary_root}/health.json" \
        "value.ok === true && value.agentState === 'READY'"; then
      return
    fi
    sleep 0.25
  done
  printf '%s\n' "Trimmed Desktop Agent did not become healthy within 30 seconds." >&2
  cat "${temporary_root}/manager.log" >&2
  return 1
}

verify_response() {
  local path="$1"
  local expression="$2"
  node -e \
    "const value=JSON.parse(require('node:fs').readFileSync(process.argv[1],'utf8'));if(!(${expression}))process.exit(1)" \
    "${path}"
}

manager_output="${temporary_root}/manager"
runtime_output="${temporary_root}/runtime"
publish_trimmed \
  "${repo_root}/apps/desktop-agent/manager/ProjectWing.AgentManager/ProjectWing.AgentManager.csproj" \
  "${manager_output}"
publish_trimmed \
  "${repo_root}/apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj" \
  "${runtime_output}"

runtime_port=$((20000 + RANDOM % 10000))
worker_port=$((runtime_port + 1))
state_root="${temporary_root}/state"
"${manager_output}/ProjectWing.AgentManager" run \
  --app-directory "${temporary_root}" \
  --agent-version "0.2.0" \
  --state-root "${state_root}" \
  --manager-path "${manager_output}/ProjectWing.AgentManager" \
  --runtime-path "${runtime_output}/ProjectWing.DesktopAgent.Runtime" \
  --runtime-port "${runtime_port}" \
  --worker-port "${worker_port}" \
  >"${temporary_root}/manager.log" 2>&1 &
manager_pid="$!"

base_url="http://127.0.0.1:${runtime_port}"
wait_for_health "${base_url}/health"
curl --noproxy "*" -fsS "${base_url}/auth/status" >"${temporary_root}/auth.json"
curl --noproxy "*" -fsS "${base_url}/sessions" >"${temporary_root}/sessions.json"
verify_response "${temporary_root}/health.json" "value.ok === true && value.agentState === 'READY'"
verify_response "${temporary_root}/auth.json" "value.ok === true && value.authenticated === false"
verify_response "${temporary_root}/sessions.json" "value.ok === true && Array.isArray(value.sessions)"

shutdown_status="$(
  curl --noproxy "*" -sS -o "${temporary_root}/shutdown.json" \
    -w "%{http_code}" -X POST -d "" "${base_url}/control/shutdown"
)"
[[ "${shutdown_status}" == "202" ]]
verify_response "${temporary_root}/shutdown.json" "value.ok === true && value.status === 'SHUTTING_DOWN'"

for _ in {1..40}; do
  if ! kill -0 "${manager_pid}" 2>/dev/null; then break; fi
  sleep 0.25
done
if kill -0 "${manager_pid}" 2>/dev/null; then
  printf '%s\n' "Trimmed Desktop Agent did not stop after shutdown." >&2
  exit 1
fi
wait "${manager_pid}"
manager_pid=""

managed_bytes="$(
  du -sb "${manager_output}" "${runtime_output}" |
    awk '{ total += $1 } END { print total }'
)"
if (( managed_bytes > 70000000 )); then
  printf 'Trimmed managed payload exceeded size budget: %s bytes.\n' "${managed_bytes}" >&2
  exit 1
fi
printf 'Trimmed Desktop Agent verification passed (%s bytes).\n' "${managed_bytes}"
