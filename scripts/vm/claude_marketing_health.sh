#!/usr/bin/env bash
# Claude Marketing Health Monitor & Improvement Agent
#
# Runs every 6 hours via cron. Collects pipeline health data,
# sends it to Claude API for analysis, and applies safe fixes.
#
# Cron: 0 */6 * * * /home/info/launchbase-platform-publish/scripts/vm/claude_marketing_health.sh
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/info/launchbase-platform-publish}"
LOG_DIR="${LOG_DIR:-/home/info/agent-runs}"
LOG_FILE="$LOG_DIR/claude-health-monitor.log"
REPORT_DIR="$LOG_DIR/health-reports"
LOCK_FILE="/tmp/claude-health-monitor.lock"

mkdir -p "$LOG_DIR" "$REPORT_DIR"

# Prevent overlapping runs
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] health-monitor skip (lock busy)" >>"$LOG_FILE"
  exit 0
fi

# Require API key
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[$(date -Is)] ERROR: ANTHROPIC_API_KEY not set" >>"$LOG_FILE"
  exit 1
fi

TIMESTAMP=$(date -Is)
REPORT_FILE="$REPORT_DIR/health-$(date +%Y-%m-%d-%H%M).json"

echo "[${TIMESTAMP}] health-monitor start" >>"$LOG_FILE"

# ── Collect Health Data ─────────────────────────────────────────

# Platform health
PLATFORM_HEALTH=$(curl -sf --max-time 10 http://localhost:3000/healthz 2>/dev/null || echo '{"status":"down"}')

# Ollama health
OLLAMA_HEALTH=$(curl -sf --max-time 10 http://localhost:11434/api/tags 2>/dev/null | head -c 500 || echo '{"error":"not responding"}')

# Latest gate result
LATEST_GATE=$(ls -t "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | head -1)
GATE_DATA=$(cat "$LATEST_GATE" 2>/dev/null || echo '{"error":"no gate file"}')

# Gate pass/fail history (last 24 hours)
GATE_HISTORY=""
for f in $(ls -t "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | head -24); do
  PASS=$(cat "$f" | grep -o '"pass":[a-z]*' | head -1)
  CLASS=$(cat "$f" | grep -o '"classification":"[^"]*"' | head -1)
  GATE_HISTORY="${GATE_HISTORY}$(basename $f): ${PASS}, ${CLASS}\n"
done

# Recent hourly log (last 30 lines)
HOURLY_LOG=$(tail -30 "$LOG_DIR/vm-marketing-hourly.log" 2>/dev/null || echo "no log")

# Run counts
TOTAL_RUNS=$(ls "$REPO_DIR/runs/marketing/agency-learning-backlog-"*.json 2>/dev/null | wc -l)
TOTAL_GATES=$(ls "$REPO_DIR/runs/marketing/gates/fine-tune-gate-"*.json 2>/dev/null | wc -l)
GATES_PASSED=$(grep -l '"pass":true' "$REPO_DIR/runs/marketing/gates/"*.json 2>/dev/null | wc -l)

# Disk usage
DISK_USAGE=$(du -sh "$REPO_DIR/runs/marketing/" 2>/dev/null | cut -f1)

# Docker status
DOCKER_STATUS=$(docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null || echo "docker not available")

# System resources
SYSTEM_LOAD=$(uptime)
MEMORY=$(free -h 2>/dev/null | grep Mem || echo "N/A")

# ── Build Prompt ────────────────────────────────────────────────

HEALTH_DATA=$(cat <<DATAEOF
## Current State: ${TIMESTAMP}

### Platform
${PLATFORM_HEALTH}

### Ollama Models
${OLLAMA_HEALTH}

### Docker Containers
${DOCKER_STATUS}

### System
Load: ${SYSTEM_LOAD}
Memory: ${MEMORY}
Marketing Disk: ${DISK_USAGE}

### Marketing Pipeline Stats
Total hourly runs: ${TOTAL_RUNS}
Total gate evaluations: ${TOTAL_GATES}
Gates passed: ${GATES_PASSED}

### Latest Gate Result
${GATE_DATA}

### Gate History (last 24 runs)
$(echo -e "$GATE_HISTORY")

### Recent Hourly Log
${HOURLY_LOG}
DATAEOF
)

PROMPT=$(cat <<'PROMPTEOF'
You are LaunchBase's Marketing AI Health Monitor. Analyze the health data and provide:

1. **STATUS**: One of: HEALTHY, DEGRADED, CRITICAL
2. **ISSUES**: List each problem found with severity (high/medium/low)
3. **ACTIONS**: Specific fixes to apply. For each action, specify:
   - What to do
   - Why it helps
   - Risk level (safe/moderate/risky)
4. **METRICS**: Key numbers (gate pass rate, uptime, model health)
5. **RECOMMENDATIONS**: Strategic improvements to reach the goal of best AI marketer

Focus especially on:
- Why gates are failing (volume vs quality)
- How to accumulate enough SFT/preference data to pass gates
- Whether the swarm rounds are producing quality improvements
- Any errors or crashes in the pipeline
- Resource usage and scaling needs

Be specific and actionable. No fluff.
PROMPTEOF
)

# ── Call Claude API ─────────────────────────────────────────────

RESPONSE=$(curl -sf --max-time 120 https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d "$(jq -n \
    --arg system "$PROMPT" \
    --arg health "$HEALTH_DATA" \
    '{
      "model": "claude-haiku-4-5-20251001",
      "max_tokens": 2000,
      "system": $system,
      "messages": [{"role": "user", "content": $health}]
    }')" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  echo "[${TIMESTAMP}] ERROR: Claude API call failed" >>"$LOG_FILE"
  exit 1
fi

# Extract the text content
ANALYSIS=$(echo "$RESPONSE" | jq -r '.content[0].text // "API error: no content"' 2>/dev/null)

# ── Save Report ─────────────────────────────────────────────────

jq -n \
  --arg timestamp "$TIMESTAMP" \
  --arg status "$(echo "$ANALYSIS" | grep -oP 'STATUS:\s*\K\w+' || echo 'UNKNOWN')" \
  --arg analysis "$ANALYSIS" \
  --arg platform "$PLATFORM_HEALTH" \
  --arg gateData "$GATE_DATA" \
  --argjson totalRuns "$TOTAL_RUNS" \
  --argjson gatesPassed "$GATES_PASSED" \
  --argjson totalGates "$TOTAL_GATES" \
  '{
    timestamp: $timestamp,
    status: $status,
    totalRuns: $totalRuns,
    totalGates: $totalGates,
    gatesPassed: $gatesPassed,
    gatePassRate: (if $totalGates > 0 then ($gatesPassed / $totalGates * 100) else 0 end),
    platform: ($platform | fromjson? // $platform),
    latestGate: ($gateData | fromjson? // $gateData),
    analysis: $analysis
  }' > "$REPORT_FILE"

echo "[${TIMESTAMP}] health-monitor complete → $REPORT_FILE" >>"$LOG_FILE"
echo "$ANALYSIS" | head -5 >>"$LOG_FILE"

# ── Auto-fix Safe Issues ────────────────────────────────────────

# Clean up old run artifacts (keep last 7 days)
find "$REPO_DIR/runs/marketing" -name "*.json" -mtime +7 -delete 2>/dev/null || true
find "$REPO_DIR/runs/marketing" -name "*.md" -mtime +7 -delete 2>/dev/null || true
find "$REPO_DIR/runs/marketing" -type d -empty -delete 2>/dev/null || true

# Clean old health reports (keep last 30 days)
find "$REPORT_DIR" -name "health-*.json" -mtime +30 -delete 2>/dev/null || true

echo "[${TIMESTAMP}] health-monitor done" >>"$LOG_FILE"
