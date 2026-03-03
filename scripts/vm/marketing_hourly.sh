#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/info/launchbase-platform-publish}"
LOG_DIR="${LOG_DIR:-/home/info/agent-runs}"
LOCK_FILE="${LOCK_FILE:-/tmp/launchbase-marketing-hourly.lock}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/vm-marketing-hourly.log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] hourly skip (lock busy)" >>"$LOG_FILE"
  exit 0
fi

{
  echo "[$(date -Is)] hourly start"
  cd "$REPO_DIR"

  # Keep repo fresh when network is available; do not hard-fail hourly loop.
  git fetch origin main || true
  git checkout main || true
  git pull --ff-only origin main || true

  pnpm run marketing:build-learning-backlog
  pnpm run marketing:build-corpus-manifest
  SWARM_ROUNDS=5 pnpm run marketing:swarm-improve
  pnpm run marketing:build-fine-tune-pack
  pnpm run marketing:evaluate-fine-tune-pack
  pnpm run marketing:publish-artifacts
  pnpm run marketing:flush-publish-queue
  echo "[$(date -Is)] hourly done"
} >>"$LOG_FILE" 2>&1
