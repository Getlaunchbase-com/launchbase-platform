#!/usr/bin/env bash
# Weekly Marketing Pipeline — replaces hourly cron
# Generates new knowledge corpus examples, consolidates, and evaluates
# Runs Sunday 2am UTC
#
# Cron: 0 2 * * 0 /home/info/launchbase-platform-publish/scripts/vm/marketing_weekly.sh
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/info/launchbase-platform-publish}"
LOG_DIR="${LOG_DIR:-/home/info/agent-runs}"
LOG_FILE="$LOG_DIR/vm-marketing-weekly.log"
LOCK_FILE="/tmp/marketing-weekly.lock"

mkdir -p "$LOG_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] weekly skip (lock busy)" >>"$LOG_FILE"
  exit 0
fi

cd "$REPO_DIR"

echo "[$(date -Is)] ── weekly pipeline start ──" >>"$LOG_FILE"

# 1. Pull latest code
git fetch origin main --quiet 2>/dev/null || true
git checkout main --quiet 2>/dev/null || true
git pull origin main --quiet 2>/dev/null || true

# 2. Generate 200 new knowledge corpus examples (incremental, ~$0.72)
echo "[$(date -Is)] generating knowledge corpus (200 examples)" >>"$LOG_FILE"
node scripts/marketing/generateMarketingKnowledgeCorpus.mjs \
  --model haiku --count 200 --batch 5 --resume \
  >>"$LOG_FILE" 2>&1 || true

# 3. Consolidate all packs + knowledge corpus into master dataset
echo "[$(date -Is)] consolidating all packs" >>"$LOG_FILE"
node scripts/marketing/consolidateFineTunePacks.mjs \
  >>"$LOG_FILE" 2>&1 || true

# 4. Evaluate the master dataset against quality gates
echo "[$(date -Is)] evaluating fine-tune pack" >>"$LOG_FILE"
node scripts/marketing/evaluateFineTunePack.mjs \
  >>"$LOG_FILE" 2>&1 || true

# 5. If gate passed, publish artifacts
LATEST_GATE=$(ls -t "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | head -1)
if [ -n "$LATEST_GATE" ]; then
  PASS=$(jq -r '.pass // false' "$LATEST_GATE" 2>/dev/null)
  if [ "$PASS" = "true" ]; then
    echo "[$(date -Is)] gate PASSED — publishing artifacts" >>"$LOG_FILE"
    node scripts/gcp/publishMarketingArtifacts.mjs >>"$LOG_FILE" 2>&1 || true
    node scripts/gcp/flushMarketingPublishQueue.mjs >>"$LOG_FILE" 2>&1 || true
  else
    echo "[$(date -Is)] gate blocked — $(jq -r '.classification // "unknown"' "$LATEST_GATE" 2>/dev/null)" >>"$LOG_FILE"
  fi
fi

# 6. Prepare Ollama training data (always, so it's ready when needed)
echo "[$(date -Is)] preparing Ollama training data" >>"$LOG_FILE"
node scripts/marketing/prepareOllamaTraining.mjs >>"$LOG_FILE" 2>&1 || true

echo "[$(date -Is)] ── weekly pipeline done ──" >>"$LOG_FILE"
