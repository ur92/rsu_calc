#!/usr/bin/env bash
#
# Production deploy to Netlify via direct ZIP upload.
#
# Builds the app LOCALLY, then uploads the pre-built artifacts to Netlify's
# file-deploy API — no build runs on Netlify's servers.
#
# Cost: ~15 credits (file upload only) vs ~75 credits (server-side build).
#
# Auth: set NETLIFY_AUTH_TOKEN in .env or environment. Create one at:
#   https://app.netlify.com/user/applications#personal-access-tokens
#
# Usage:
#   scripts/deploy.sh           # build + upload + publish
#   scripts/deploy.sh --wait    # same, plus poll until live URL is ready

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a; source "$REPO_ROOT/.env"; set +a
fi

SITE_ID="8732229d-3b9a-40e4-aa71-37c7d02f83b4"
API="https://api.netlify.com/api/v1"
WAIT=false

for arg in "$@"; do
  case $arg in --wait) WAIT=true ;; esac
done

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: NETLIFY_AUTH_TOKEN not set." >&2
  echo "  Add it to .env or: export NETLIFY_AUTH_TOKEN=<token>" >&2
  exit 1
fi

# ── 1. Local build ────────────────────────────────────────────────────────────
echo "==> Building locally..."
cd "$REPO_ROOT/app"
npm run build
cd "$REPO_ROOT"

# ── 2. Assemble deploy package ────────────────────────────────────────────────
echo "==> Assembling deploy package..."
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

# Static files from the local build
cp -r app/dist/. "$STAGING/"

# Serverless function
mkdir -p "$STAGING/netlify/functions"
cp netlify/functions/stock-price.js "$STAGING/netlify/functions/"

# Minimal netlify.toml for this deploy:
#   - "command" and "publish" are ignored for ZIP deploys (the ZIP IS the publish dir)
#   - Only routing + function directory config is used
cat > "$STAGING/netlify.toml" <<'TOML'
[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/stock-price"
  to = "/.netlify/functions/stock-price"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
TOML

ZIP="$STAGING/deploy.zip"
(cd "$STAGING" && zip -qr "$ZIP" . --exclude "deploy.zip")

ZIP_SIZE=$(du -sh "$ZIP" | cut -f1)
echo "    package size: $ZIP_SIZE"

# ── 3. Upload to Netlify (direct file deploy — no server build) ───────────────
echo "==> Uploading to Netlify..."
RESP=$(curl -fsSk -X POST \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ZIP" \
  "$API/sites/$SITE_ID/deploys")

DEPLOY_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "    deploy_id: $DEPLOY_ID"
echo "    admin:     https://app.netlify.com/projects/rsucalcjfrog/deploys/$DEPLOY_ID"

# ── 4. Wait for processing, then publish to production ────────────────────────
echo ""
echo "==> Waiting for deploy to be ready..."
PUBLISHED=false
for i in $(seq 1 30); do
  sleep 5
  STATE=$(curl -fsSk \
    -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
    "$API/sites/$SITE_ID/deploys/$DEPLOY_ID" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','?'))")
  echo "    [$i] state: $STATE"
  if [[ "$STATE" == "ready" || "$STATE" == "uploaded" ]]; then
    echo "    Publishing to production..."
    curl -fsSk -X POST \
      -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
      "$API/sites/$SITE_ID/deploys/$DEPLOY_ID/restore" > /dev/null
    PUBLISHED=true
    break
  elif [[ "$STATE" == "error" ]]; then
    echo "ERROR: deploy failed." >&2
    exit 1
  fi
done

if [[ "$PUBLISHED" == "false" ]]; then
  echo "WARNING: timed out waiting for deploy. Check dashboard." >&2
  exit 1
fi

echo ""
echo "Deployed! https://rsucalcjfrog.netlify.app"

if [[ "$WAIT" == "true" ]]; then
  echo ""
  echo "==> Waiting for production URL to go live..."
  for i in $(seq 1 12); do
    sleep 5
    HTTP=$(curl -o /dev/null -w "%{http_code}" -fsSk https://rsucalcjfrog.netlify.app/ 2>/dev/null || echo "000")
    echo "    [$i] HTTP $HTTP"
    if [[ "$HTTP" == "200" ]]; then
      echo ""
      echo "Live at https://rsucalcjfrog.netlify.app"
      break
    fi
  done
fi
