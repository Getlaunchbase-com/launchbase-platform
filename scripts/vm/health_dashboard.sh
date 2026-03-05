#!/usr/bin/env bash
# Quick health dashboard — run anytime to see current state
# Usage: bash scripts/vm/health_dashboard.sh

REPO_DIR="${REPO_DIR:-/home/info/launchbase-platform-publish}"
LOG_DIR="${LOG_DIR:-/home/info/agent-runs}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           LaunchBase Marketing Health Dashboard          ║"
echo "║                  $(date '+%Y-%m-%d %H:%M UTC')                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Platform
echo "─── Platform ───────────────────────────────────────────"
HEALTH=$(curl -sf --max-time 5 http://localhost:3000/healthz 2>/dev/null)
if [ -n "$HEALTH" ]; then
  UPTIME=$(echo "$HEALTH" | grep -oP '"uptime":\K[0-9.]+' | cut -d. -f1)
  HOURS=$((UPTIME / 3600))
  echo "  Status:  ✅ OK (uptime: ${HOURS}h)"
else
  echo "  Status:  ❌ DOWN"
fi

# Ollama
echo ""
echo "─── Ollama Models ──────────────────────────────────────"
MODELS=$(curl -sf --max-time 5 http://localhost:11434/api/tags 2>/dev/null)
if [ -n "$MODELS" ]; then
  echo "$MODELS" | grep -oP '"name":"[^"]*"' | sed 's/"name":"//;s/"//' | while read m; do
    echo "  ✅ $m"
  done
else
  echo "  ❌ Ollama not responding"
fi

# Docker
echo ""
echo "─── Docker ─────────────────────────────────────────────"
docker ps --format '  {{.Names}}: {{.Status}}' 2>/dev/null || echo "  ⚠️  Docker not available"

# Marketing Pipeline
echo ""
echo "─── Marketing Pipeline ─────────────────────────────────"
TOTAL_RUNS=$(ls "$REPO_DIR/runs/marketing/agency-learning-backlog-"*.json 2>/dev/null | wc -l)
TOTAL_GATES=$(ls "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | wc -l)
GATES_PASSED=$(grep -l '"pass":true' "$REPO_DIR/runs/marketing/gates/"*.json 2>/dev/null | wc -l)
DISK=$(du -sh "$REPO_DIR/runs/marketing/" 2>/dev/null | cut -f1)

echo "  Total runs:     $TOTAL_RUNS"
echo "  Gate evals:     $TOTAL_GATES"
echo "  Gates passed:   $GATES_PASSED / $TOTAL_GATES"
echo "  Disk usage:     $DISK"

# Latest gate
echo ""
echo "─── Latest Gate ────────────────────────────────────────"
LATEST=$(ls -t "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  PASS=$(cat "$LATEST" | grep -oP '"pass":\K[a-z]+')
  CLASS=$(cat "$LATEST" | grep -oP '"classification":"\K[^"]+')
  TVS=$(cat "$LATEST" | grep -oP '"tvsAvg":\K[0-9]+')
  SFT=$(cat "$LATEST" | grep -oP '"sft":\K[0-9]+' | head -1)
  PREF=$(cat "$LATEST" | grep -oP '"pref":\K[0-9]+')
  if [ "$PASS" = "true" ]; then
    echo "  Result:  ✅ PASSED"
  else
    echo "  Result:  ❌ BLOCKED — $CLASS"
  fi
  echo "  Quality: TVS avg = $TVS (need ≥80)"
  echo "  Volume:  SFT=$SFT (need ≥100), Pref=$PREF (need ≥50)"
else
  echo "  No gate results found"
fi

# Latest Claude health report
echo ""
echo "─── Latest AI Health Report ──────────────────────────────"
LATEST_REPORT=$(ls -t "$LOG_DIR/health-reports/health-"*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  STATUS=$(cat "$LATEST_REPORT" | grep -oP '"status":"\K[^"]+')
  REPORT_TIME=$(cat "$LATEST_REPORT" | grep -oP '"timestamp":"\K[^"]+')
  echo "  Status:    $STATUS"
  echo "  Generated: $REPORT_TIME"
  echo "  File:      $LATEST_REPORT"
else
  echo "  No AI health reports yet (runs every 6 hours)"
fi

# System
echo ""
echo "─── System ─────────────────────────────────────────────"
echo "  $(uptime)"
echo "  $(free -h 2>/dev/null | grep Mem | awk '{print "Memory: " $3 " / " $2}')"
echo ""
