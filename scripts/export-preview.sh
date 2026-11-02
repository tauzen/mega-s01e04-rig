#!/usr/bin/env bash
set -euo pipefail

# Run from the repository root. The caller supplies a temporary output directory.
output=${1:?Usage: bash scripts/export-preview.sh TEMP_OUTPUT_DIRECTORY}
mkdir -p "$output"
partial="$output/index.html.part"
ready_file="$output/.server-ready"
server_pid=
cleanup() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$partial" "$ready_file"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Do not log server output: a rendering error could include lane data.
rm -f "$ready_file"
node --import tsx scripts/preview-server.ts "$ready_file" >/dev/null 2>&1 &
server_pid=$!

ready=false
for attempt in {1..30}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo 'Preview server exited before becoming ready.' >&2
    exit 1
  fi
  # Our listener must bind first; never export a different server already on this port.
  if [ -f "$ready_file" ] && curl --fail --silent --max-time 2 --output /dev/null http://127.0.0.1:8787/health; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  echo 'Preview server did not become ready within 30 attempts.' >&2
  exit 1
fi

# Never print the HTML. An HTTP error (including a missing digest) fails the export.
curl --fail --silent --show-error --max-time 10 \
  --output "$partial" http://127.0.0.1:8787/digest/2026-10-28
test -s "$partial"
mv "$partial" "$output/index.html"
