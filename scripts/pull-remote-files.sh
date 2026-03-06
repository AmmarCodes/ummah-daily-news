#!/bin/bash

set -e

set -o pipefail

if [ -z "$R2_BUCKET_NAME" ]; then
  echo "R2_BUCKET_NAME is required (example: ummah-short-news)"
  exit 1
fi

OUTPUT_DIR="./cache/remote-files/${R2_BUCKET_NAME}"
mkdir -p "$OUTPUT_DIR"

echo "Listing objects in R2 bucket: $R2_BUCKET_NAME"
wrangler r2 object list "$R2_BUCKET_NAME" --json > /tmp/r2-objects.json

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to parse object list output"
  exit 1
fi

jq -r '.[].key' /tmp/r2-objects.json | while IFS= read -r key; do
  [ -z "$key" ] && continue
  target="${OUTPUT_DIR}/${key}"
  mkdir -p "$(dirname "$target")"
  echo "Downloading $key"
  wrangler r2 object get "${R2_BUCKET_NAME}/${key}" --file "$target"
done

echo "R2 files downloaded to $OUTPUT_DIR"
