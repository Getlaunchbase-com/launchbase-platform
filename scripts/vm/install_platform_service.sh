#!/bin/bash
# Install LaunchBase Platform as a systemd service
#
# Usage: sudo bash scripts/vm/install_platform_service.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="${SCRIPT_DIR}/launchbase-platform.service"

echo "[install] Copying service file..."
sudo cp "${SERVICE_FILE}" /etc/systemd/system/launchbase-platform.service

echo "[install] Reloading systemd..."
sudo systemctl daemon-reload

echo "[install] Enabling service (auto-start on boot)..."
sudo systemctl enable launchbase-platform

echo "[install] Starting service..."
sudo systemctl start launchbase-platform

echo "[install] Status:"
sudo systemctl status launchbase-platform --no-pager

echo ""
echo "[install] Installing cron jobs..."

# Ollama health check every 5 minutes
HEALTH_CRON="*/5 * * * * ${SCRIPT_DIR}/ollama_health_check.sh >> /tmp/ollama-health.log 2>&1"

# Training data export nightly at 2:10 AM UTC
EXPORT_CRON="10 2 * * * cd /home/info/launchbase-platform-publish && npx tsx scripts/export-training-data.ts --output /tmp/training-export-\$(date +\\%Y-\\%m-\\%d).jsonl >> /tmp/training-export.log 2>&1"

# Add crons if not already present
(crontab -l 2>/dev/null || true) | grep -v "ollama_health_check" | grep -v "export-training-data" > /tmp/crontab_new
echo "${HEALTH_CRON}" >> /tmp/crontab_new
echo "${EXPORT_CRON}" >> /tmp/crontab_new
crontab /tmp/crontab_new
rm /tmp/crontab_new

echo "[install] Cron jobs installed:"
crontab -l | grep -E "ollama_health|export-training"

echo ""
echo "[install] Done! Platform will auto-start on reboot."
echo "[install] Ollama health check runs every 5 minutes."
echo "[install] Training export runs nightly at 2:10 AM UTC."
