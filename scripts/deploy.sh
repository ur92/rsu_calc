#!/usr/bin/env bash
#
# Manual production deploy to Netlify via direct API.
#
# Why direct API: corporate Zscaler proxy redirects all npm traffic through
# JFrog, where the netlify-cli's `unstorage@^1.16.1` dependency is curated
# out, so `npx netlify-cli` cannot be installed on this network.
#
# Auth: set NETLIFY_AUTH_TOKEN. Create one at:
#   https://app.netlify.com/user/applications#personal-access-tokens
#
# Site: defaults to rsucalcjfrog.netlify.app. Override with NETLIFY_SITE_ID.
#
# Usage:
#   scripts/deploy.sh             # production deploy
#   scripts/deploy.sh --draft     # draft (preview) deploy

set -euo pipefail

SITE="${NETLIFY_SITE_ID:-rsucalcjfrog.netlify.app}"
API="https://api.netlify.com/api/v1"
DRAFT="false"

if [[ "${1:-}" == "--draft" ]]; then
  DRAFT="true"
fi

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: NETLIFY_AUTH_TOKEN not set." >&2
  echo "  Create a token at https://app.netlify.com/user/applications#personal-access-tokens" >&2
  echo "  Then: export NETLIFY_AUTH_TOKEN=<token>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/app"
DIST_DIR="$APP_DIR/dist"

echo "==> [1/4] Building app..."
cd "$APP_DIR"
npm run build

echo "==> [2/4] Assembling deploy bundle..."
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Static dist content goes at the bundle root.
cp -R "$DIST_DIR"/. "$WORK"/

# Include netlify.toml and edge-functions source so Netlify bundles them.
cp "$REPO_ROOT/netlify.toml" "$WORK/netlify.toml"
if [[ -d "$REPO_ROOT/netlify/edge-functions" ]]; then
  mkdir -p "$WORK/netlify/edge-functions"
  cp -R "$REPO_ROOT/netlify/edge-functions"/. "$WORK/netlify/edge-functions"/
fi

ZIP="$WORK/site.zip"
( cd "$WORK" && zip -qr "$ZIP" . -x "site.zip" )

echo "==> [3/4] Resolving site ID..."
SITE_RESPONSE=$(curl -fsSL \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  "$API/sites/$SITE")
SITE_ID=$(echo "$SITE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['site_id'])")
echo "    site_id: $SITE_ID"

echo "==> [4/4] Uploading to Netlify (draft=$DRAFT)..."
DEPLOY_RESPONSE=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP" \
  "$API/sites/$SITE_ID/deploys?draft=$DRAFT&title=manual-cli-deploy")

DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
DEPLOY_URL=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('deploy_ssl_url') or d.get('ssl_url'))")
LOG_URL=$(echo "$DEPLOY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('admin_url',''))")

echo ""
echo "Deployed!"
echo "  deploy_id: $DEPLOY_ID"
echo "  url:       $DEPLOY_URL"
[[ -n "$LOG_URL" ]] && echo "  admin:     $LOG_URL/deploys/$DEPLOY_ID"
