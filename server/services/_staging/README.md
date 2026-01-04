# ⚠️ Quarantined Code - DO NOT USE

This folder contains schema-coupled code from customer sites that is being migrated to the LaunchBase platform.

## Rules

1. **No new code here** — All new intelligence logic goes in platform services
2. **No imports from this folder** — These files are excluded from the build
3. **Delete by Slice D** — Once all functionality is replaced by platform calls, delete this folder

## Migration Status

| File | Status | Replaced By |
|------|--------|-------------|
| weatherMonitor.ts | Quarantined | weather-intelligence.ts + weather-post-orchestrator.ts |

## Why This Exists

Customer sites (like vincessnowplow.com) had local implementations of weather monitoring and intelligence logic. This created:
- Duplicate code across sites
- Schema coupling (site DB ↔ intelligence logic)
- Drift risk (sites diverging from platform behavior)

The correct architecture is:
- **LaunchBase platform** owns all intelligence logic
- **Customer sites** consume via Platform Client API
- **No decision logic** runs on customer sites

## Deletion Checklist

Before deleting this folder, verify:
- [ ] All weather monitoring runs in LaunchBase
- [ ] All drafts created by platform, not site
- [ ] Site uses platformClient.ts for all intelligence
- [ ] No imports reference _staging anywhere
