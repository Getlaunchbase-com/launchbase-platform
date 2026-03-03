#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/info/launchbase-platform}"
LOG_DIR="${LOG_DIR:-/home/info/agent-runs}"
LOCK_FILE="${LOCK_FILE:-/tmp/launchbase-marketing-nightly.lock}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/vm-marketing-nightly.log"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] nightly skip (lock busy)" >>"$LOG_FILE"
  exit 0
fi

{
  echo "[$(date -Is)] nightly start"
  cd "$REPO_DIR"

  git fetch origin main || true
  git checkout main || true
  git pull --ff-only origin main || true

  # Deep pass: more swarm rounds and marketing ops cycle.
  npm run marketing:ops-cycle
  SWARM_ROUNDS=7 npm run marketing:swarm-improve
  npm run marketing:build-fine-tune-pack
  npm run marketing:evaluate-fine-tune-pack
  npm run marketing:publish-artifacts
  npm run marketing:flush-publish-queue
  echo "[$(date -Is)] nightly done"
} >>"$LOG_FILE" 2>&1

