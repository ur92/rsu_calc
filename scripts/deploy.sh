#!/usr/bin/env bash
#
# Manual production deploy to Netlify via git-triggered build API.
#
# Why git build instead of zip upload: Netlify zip API deploys do NOT support
# serverless functions. Triggering a build from the linked git repo lets
# Netlify process and deploy functions properly.
#
# Auth: set NETLIFY_AUTH_TOKEN in .env or environment. Create one at:
#   https://app.netlify.com/user/applications#personal-access-tokens
#
# Usage:
#   scripts/deploy.sh           # trigger production build from current main
#   scripts/deploy.sh --wait    # also wait and print final URL

set -euo pipefail

# Load .env from repo root if present
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a; source "$REPO_ROOT/.env"; set +a
fi

SITE_ID="8732229d-3b9a-40e4-aa71-37c7d02f83b4"
API="https://api.netlify.com/api/v1"
WAIT=false

if [[ "${1:-}" == "--wait" ]]; then
  WAIT=true
fi

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "ERROR: NETLIFY_AUTH_TOKEN not set." >&2
  echo "  Add it to .env or: export NETLIFY_AUTH_TOKEN=<token>" >&2
  exit 1
fi

echo "==> Triggering Netlify build from git..."
RESPONSE=$(curl -fsSk -X POST \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  "$API/sites/$SITE_ID/builds")

BUILD_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
DEPLOY_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['deploy_id'])")
echo "    build_id:  $BUILD_ID"
echo "    deploy_id: $DEPLOY_ID"
echo "    admin:     https://app.netlify.com/projects/rsucalcjfrog/deploys/$DEPLOY_ID"

if [[ "$WAIT" == "true" ]]; then
  echo ""
  echo "==> Waiting for build to finish..."
  for i in $(seq 1 40); do
    sleep 15
    STATE=$(curl -fsSk \
      -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
      "$API/sites/$SITE_ID/deploys/$DEPLOY_ID" \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','?'))")
    echo "    [$i] state: $STATE"
    if [[ "$STATE" == "ready" ]]; then
      echo ""
      echo "Deployed! https://rsucalcjfrog.netlify.app"
      break
    elif [[ "$STATE" == "error" ]]; then
      echo "ERROR: build failed." >&2
      exit 1
    fi
  done
else
  echo ""
  echo "Build triggered. Run with --wait to poll for completion."
  echo "Or watch: https://app.netlify.com/projects/rsucalcjfrog/deploys/$DEPLOY_ID"
fi
