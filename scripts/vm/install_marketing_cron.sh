#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/home/info/launchbase-platform-publish}"
LOG_DIR="${2:-/home/info/agent-runs}"
CRON_FILE="/etc/cron.d/launchbase-marketing"
USER_NAME="${SUDO_USER:-$USER}"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Repo dir not found: $REPO_DIR"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required on VM"
  exit 1
fi

chmod +x "$REPO_DIR/scripts/vm/marketing_hourly.sh" "$REPO_DIR/scripts/vm/marketing_nightly.sh"

TMP_FILE="$(mktemp)"
cat >"$TMP_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# LaunchBase marketing hourly cycle (at minute 7)
7 * * * * $USER_NAME REPO_DIR="$REPO_DIR" LOG_DIR="$LOG_DIR" "$REPO_DIR/scripts/vm/marketing_hourly.sh"

# LaunchBase marketing nightly deep cycle (01:10 UTC/local VM time)
10 1 * * * $USER_NAME REPO_DIR="$REPO_DIR" LOG_DIR="$LOG_DIR" "$REPO_DIR/scripts/vm/marketing_nightly.sh"
EOF

if [[ "$EUID" -ne 0 ]]; then
  echo "Installing cron requires sudo/root. Re-run with sudo."
  cat "$TMP_FILE"
  rm -f "$TMP_FILE"
  exit 2
fi

mv "$TMP_FILE" "$CRON_FILE"
chmod 644 "$CRON_FILE"
echo "Installed cron: $CRON_FILE"
cat "$CRON_FILE"

