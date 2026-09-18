#!/bin/sh
set -eu

test -x /usr/bin/nc
test -x /maintenance/maintenance-response.sh

exec /usr/bin/nc -lk -p 8080 -e /maintenance/maintenance-response.sh
