# Deployment Worker Cron Setup

## Overview

The deployment worker processes queued customer site deployments. Without cron automation, deployments must be triggered manually via the admin dashboard button. With cron, deployments process automatically every 2 minutes.

## Quick Setup

### External Cron Service (EasyCron, AWS EventBridge, etc.)

**Configuration:**

```
Method:        POST
URL:           https://getlaunchbase.com/api/worker/run-next-deploy
Header Name:   x-worker-token
Header Value:  [YOUR_WORKER_TOKEN from Settings → Secrets]
Schedule:      Every 2 minutes
Timeout:       60 seconds
```

### Test Before Scheduling

Run this curl command to verify the endpoint is reachable:

```bash
curl -i -X POST "https://getlaunchbase.com/api/worker/run-next-deploy" \
  -H "x-worker-token: YOUR_WORKER_TOKEN"
```

**Expected responses:**

- **200 OK** + `"No queued deployments"` — Worker is healthy, no jobs to process
- **200 OK** + deployment details — Worker processed a deployment successfully
- **200 OK** + `"Worker busy"` — A deployment is already running (safeguard working)
- **401 Unauthorized** — Token is missing or invalid
- **5xx Server Error** — LaunchBase app is down

### Recommended Services

| Service | Cost | Setup Time | Notes |
|---------|------|-----------|-------|
| **EasyCron** | Free tier available | 2 min | Simple UI, good for simple POST requests |
| **AWS EventBridge** | Pay-per-invocation | 5 min | Scalable, integrates with AWS |
| **Manus Scheduling** | TBD | TBD | Native to your platform (check availability) |
| **cron-job.org** | Free | 2 min | Lightweight, good for testing |

## How It Works

1. **Cron triggers** → POST to `/api/worker/run-next-deploy` every 2 minutes
2. **Worker checks** → Is there a queued deployment? Is another one running?
3. **If queued** → Mark as "running", generate URL, verify reachability, mark as "success"
4. **If running** → Return "Worker busy" (safeguard prevents double-runs)
5. **If none** → Return "No queued deployments"

## Deployment Flow with Cron

```
Customer pays → Stripe webhook → Deployment created (status: queued)
                                          ↓
                                    Cron triggers (2 min)
                                          ↓
                                    Worker processes
                                          ↓
                                    URL generated
                                          ↓
                                    Reachability verified
                                          ↓
                                    Status: success
                                          ↓
                                    "Live ✅" email sent
```

## Monitoring

### Admin Dashboard

Visit `/admin/deployments` to see:
- Queued count
- Running count
- Recent deployments with status
- Manual "Run Next Deployment" button (for testing)

### Logs

Worker logs are output to server console:
```
[Worker] Processing deployment 123 for intake 456
[Worker] Generated live URL: https://site-larry-s-cabinets-123.launchbase-h86jcadp.manus.space
[Worker] URL reachable after 2 attempt(s)
[Worker] Deployment 123 completed successfully
```

## Troubleshooting

### Cron Not Triggering

**Check:**
1. Is the cron service running? (Check service dashboard)
2. Is the schedule correct? (Should be every 2 minutes)
3. Can you manually curl the endpoint? (Test with curl command above)
4. Is the token correct? (Copy from Settings → Secrets)

### Worker Returns "Busy"

**This is normal.** It means:
- A deployment is currently running
- The cron service called the endpoint while the previous job was still processing
- Next cron run (in 2 minutes) will process the next queued job

**If stuck:**
- Check `/admin/deployments` to see which deployment is running
- Wait for it to complete (usually < 5 minutes)
- If stuck > 10 minutes, restart the server

### Worker Returns "No queued deployments"

**This is normal.** It means:
- All deployments have been processed
- No new payments/deployments since last cron run
- Cron is working correctly, just nothing to do

## Security Notes

⚠️ **Token Protection:**
- The `x-worker-token` header is required for all requests
- Never expose the token in client-side code
- Rotate the token if you suspect compromise
- Token is stored in Settings → Secrets (encrypted)

⚠️ **Worker Busy Safeguard:**
- Prevents double-processing of the same deployment
- If cron calls while a job is running, the request returns "Worker busy"
- This is intentional and prevents data corruption

## Next Steps

1. Choose a cron service (EasyCron recommended for simplicity)
2. Copy the configuration above into the service
3. Test with the curl command
4. Monitor `/admin/deployments` for 24 hours to verify it's working
5. Set up alerts if the cron service supports it

## Related Files

- `server/worker/deploymentWorker.ts` — Worker implementation
- `client/src/pages/AdminDeployments.tsx` — Admin monitoring UI
- `drizzle/schema.ts` — Deployments table schema
