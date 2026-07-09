#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${FIFTYTWO_DEPLOY_USER:-onelifeleft}"
REMOTE_HOST="${FIFTYTWO_DEPLOY_HOST:-iad1-shared-e1-26.dreamhost.com}"
REMOTE_PATH="${FIFTYTWO_DEPLOY_PATH:-/home/onelifeleft/onelifeleft.comejversion/52}"
SSH_KEY="${FIFTYTWO_DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"

SSH_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
SSH_COMMAND="ssh -i ${SSH_KEY}"
RSYNC_FLAGS=(-az --delete)

if [[ "${DRY_RUN:-}" == "1" ]]; then
  RSYNC_FLAGS+=(--dry-run --itemize-changes)
fi

echo "Preparing ${SSH_TARGET}:${REMOTE_PATH}..."
ssh -i "${SSH_KEY}" "${SSH_TARGET}" "mkdir -p '${REMOTE_PATH}'"

echo "Deploying 52! to ${SSH_TARGET}:${REMOTE_PATH}..."
rsync "${RSYNC_FLAGS[@]}" \
  -e "${SSH_COMMAND}" \
  --exclude ".DS_Store" \
  --exclude ".git/" \
  --exclude "package.json" \
  --exclude "scripts/" \
  --exclude "tools/" \
  --exclude "*.code-workspace" \
  --exclude "*.md" \
  --exclude "*.ps1" \
  ./ "${SSH_TARGET}:${REMOTE_PATH}/"

echo "Done: https://onelifeleft.com/52/"
