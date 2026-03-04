#!/bin/bash
# Ollama Health Check & Auto-Recovery
#
# Cron: */5 * * * * /home/info/launchbase-platform-publish/scripts/vm/ollama_health_check.sh >> /tmp/ollama-health.log 2>&1
#
# Checks if Ollama is responding. If not, restarts the systemd service.

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
LOG_PREFIX="[ollama-health $(date '+%Y-%m-%d %H:%M:%S')]"

# Health check with 5s timeout
if curl -sf --max-time 5 "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
  # Ollama is healthy — log response time
  RESPONSE_TIME=$(curl -sf --max-time 5 -o /dev/null -w "%{time_total}" "${OLLAMA_URL}/api/tags" 2>/dev/null)
  echo "${LOG_PREFIX} OK (${RESPONSE_TIME}s)"
else
  echo "${LOG_PREFIX} UNHEALTHY — attempting restart..."
  sudo systemctl restart ollama 2>&1
  sleep 5

  # Verify recovery
  if curl -sf --max-time 10 "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
    echo "${LOG_PREFIX} RECOVERED after restart"
  else
    echo "${LOG_PREFIX} STILL DOWN after restart — manual intervention needed"
  fi
fi
