#!/bin/bash

set -e

# make sure commands run in sequence
set -o pipefail

# Compose banners
npm run banners:compose

if [ -z "$R2_BUCKET_NAME" ]; then
  echo "R2_BUCKET_NAME is required (example: ummah-short-news)"
  exit 1
fi

# Upload composed banners to R2
if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI is required"
  exit 1
fi

find composedBanners -type f | while IFS= read -r file; do
  key="composedBanners/${file#composedBanners/}"
  echo "Uploading $key"
  wrangler r2 object put "${R2_BUCKET_NAME}/${key}" --file "$file"
done

echo "Banner upload complete."
