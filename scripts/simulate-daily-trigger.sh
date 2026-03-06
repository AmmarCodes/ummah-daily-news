#!/bin/bash

set -e

set -o pipefail

if [ -z "$WORKER_URL" ]; then
  echo "WORKER_URL is required (example: https://sy-daily.example.workers.dev)"
  exit 1
fi

if [ -z "$PIPELINE_TRIGGER_TOKEN" ]; then
  echo "PIPELINE_TRIGGER_TOKEN is required"
  exit 1
fi

echo "Triggering Cloudflare pipeline..."
RESPONSE=$(curl -sS -X POST \
  -H "X-Pipeline-Token: ${PIPELINE_TRIGGER_TOKEN}" \
  "${WORKER_URL}/internal/run-pipeline")
if command -v jq >/dev/null 2>&1; then
  echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi
echo "Pipeline trigger request sent."
