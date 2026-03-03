# LaunchBase Runnerless Automation (VM-First)

This removes desktop runner dependency for critical marketing training loops.

## Goal
- Hourly + nightly marketing cycles must run on a persistent VM.
- Desktop runner is observer/debug only.

## Included Components
- `scripts/vm/marketing_hourly.sh`
- `scripts/vm/marketing_nightly.sh`
- `scripts/vm/install_marketing_cron.sh`
- `scripts/gcp/publishMarketingArtifacts.mjs`
- `scripts/gcp/flushMarketingPublishQueue.mjs`

## VM Setup
1. Clone/update repo on VM:
```bash
cd /home/info
git clone https://github.com/Getlaunchbase-com/launchbase-platform.git || true
cd /home/info/launchbase-platform
git checkout main
git pull --ff-only origin main
```

2. Install dependencies:
```bash
npm ci
```

3. Install cron schedules (as root/sudo):
```bash
sudo /home/info/launchbase-platform/scripts/vm/install_marketing_cron.sh /home/info/launchbase-platform
```

## Schedule
- Hourly: minute `7` each hour (`marketing_hourly.sh`)
- Nightly deep: `01:10` (`marketing_nightly.sh`)

## Logs
- `/home/info/agent-runs/vm-marketing-hourly.log`
- `/home/info/agent-runs/vm-marketing-nightly.log`

## Queue + Publish
- Publish is attempted each run using `gcloud storage cp`.
- On failure, intent is queued in:
  - `$HOME/agent-runs/publish-queue`
- Queue is deduped and retried every run by:
  - `npm run marketing:flush-publish-queue`

## Verification
```bash
crontab -l
sudo cat /etc/cron.d/launchbase-marketing
tail -n 100 /home/info/agent-runs/vm-marketing-hourly.log
tail -n 100 /home/info/agent-runs/vm-marketing-nightly.log
```

## Important
- Do not treat desktop runner schedules as production-critical.
- Keep this VM lane as source-of-truth for continuity.

