#!/bin/sh
set -eu

request_line=''
IFS= read -r request_line || true
while IFS= read -r header; do
  [ "${header}" = "$(printf '\r')" ] && break
done

if printf '%s' "${request_line}" | grep -Eq '^[A-Z]+ /healthz[? ]'; then
  status='200 OK'
  body='{"ok":true,"service":"projectwing-maintenance"}'
else
  status='503 Service Unavailable'
  body='{"ok":false,"code":"DEPLOYMENT_MAINTENANCE","retryAfterSeconds":120}'
fi

length="$(printf '%s' "${body}" | wc -c | tr -d ' ')"
printf 'HTTP/1.1 %s\r\n' "${status}"
printf 'Content-Type: application/json; charset=utf-8\r\n'
printf 'Content-Length: %s\r\n' "${length}"
printf 'Cache-Control: no-store\r\nRetry-After: 120\r\nConnection: close\r\n\r\n'
printf '%s' "${body}"
