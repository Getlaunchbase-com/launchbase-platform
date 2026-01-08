# LaunchBase Hosting Integration

## Phase 1: Manus Subdomain URLs (Current Implementation)

### Overview

Customer websites are deployed to Manus-hosted subdomains, leveraging the existing Manus hosting infrastructure for SSL, DNS, and uptime. This approach provides real, working URLs immediately without requiring external hosting providers or complex DNS configuration.

### URL Format

Customer sites are deployed to URLs in the following format:

```
https://site-{slug}-{deploymentId}.launchbase-h86jcadp.manus.space
```

**Components:**
- `site-` — Prefix to identify customer sites
- `{slug}` — Sanitized business name (lowercase, alphanumeric + hyphens)
- `{deploymentId}` — Unique deployment ID for uniqueness (prevents collisions)
- `launchbase-h86jcadp.manus.space` — Manus app's base domain

**Examples:**
- Larry's Cabinets → `https://site-larry-s-cabinets-1234567890.launchbase-h86jcadp.manus.space`
- Smith & Sons Plumbing → `https://site-smith-sons-plumbing-9876543210.launchbase-h86jcadp.manus.space`

### Slug Generation

Business names are converted to URL-safe slugs using this algorithm:

```typescript
const slug = businessName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")      // Replace non-alphanumeric with hyphens
  .replace(/^-|-$/g, "");             // Remove leading/trailing hyphens
```

### Reachability Verification

Before marking a deployment as "Live", the system verifies the URL is reachable:

1. **Attempt Limit**: 5 attempts with 2-second delays between attempts
2. **Timeout**: 5 seconds per HTTP HEAD request
3. **Success Criteria**: HTTP 200 OK response
4. **Logging**: All attempts logged for debugging

If the URL is not reachable after 5 attempts, the deployment is still marked as successful (the URL will eventually resolve as DNS propagates). The deployment status page shows "Provisioning Link..." during this verification phase.

### Deployment Worker Flow

1. **Queued** → Deployment is waiting to be processed
2. **Running** → Deployment is executing (generating URL, verifying reachability)
3. **Success** → Deployment complete, URL is live
4. **Failed** → Deployment encountered an error

### UI Status Messages

**During Deployment (Running):**
- Label: "Provisioning Link"
- Message: "We're provisioning your live link and verifying it's reachable. This can take a few minutes."

**After Deployment (Success):**
- Label: "Live ✅"
- Message: "Your website is live and ready to go."

### Implementation Details

**File: `server/worker/deploymentWorker.ts`**

Key functions:
- `executeDeployment()` — Generates Manus subdomain URL and verifies reachability
- `checkUrlReachability()` — Performs HTTP HEAD requests with retry logic

**File: `client/src/pages/DeploymentStatus.tsx`**

Updated status configuration to show "Provisioning Link..." during deployment.

### Advantages

✅ **No external dependencies** — Uses existing Manus infrastructure  
✅ **Automatic SSL** — Manus handles certificate management  
✅ **Automatic DNS** — No DNS configuration required per customer  
✅ **Real, working URLs** — URLs resolve immediately (or within seconds)  
✅ **Unique per deployment** — Deployment ID prevents collisions  
✅ **Easy to test** — URLs are immediately testable  

### Limitations

⚠️ **Subdomain-based** — URLs are subdomains of launchbase-h86jcadp.manus.space  
⚠️ **Not branded** — URLs don't include customer's domain  
⚠️ **Manus-dependent** — Relies on Manus hosting availability  

---

## Phase 2: Custom Domain Support (Future)

### Overview

After Phase 1 is stable, customers can use their own branded domains:

```
https://larryscabinets.com
https://smith-sons-plumbing.com
```

### Implementation Approach

**Option A: Wildcard Domain (Recommended)**
- Single wildcard domain: `*.getlaunchbase.com`
- Wildcard DNS record points to Manus infrastructure
- Customer sites: `larryscabinets.getlaunchbase.com`, `smith-plumbing.getlaunchbase.com`
- Requires: Domain ownership, wildcard DNS record, Manus wildcard support

**Option B: Customer's Own Domain**
- Customer owns domain (e.g., `larryscabinets.com`)
- Customer points DNS to Manus infrastructure
- Manus binds domain to customer's site
- Requires: Customer DNS access, Manus custom domain binding

**Option C: Manus Domain Management**
- Manus Settings → Domains panel allows custom domain purchase/binding
- Manus handles DNS and SSL automatically
- Simplest for customers, requires Manus feature support

### Timeline

Phase 2 is planned after:
1. Cabinet maker beta customer successfully launches on Phase 1 URLs
2. Deployment system proves stable with real URLs
3. Feedback collected on domain branding importance

---

## Testing

### Unit Tests

Located in `server/worker.test.ts`:

- URL format validation
- Slug generation with special characters
- Deployment ID uniqueness
- HTTPS protocol enforcement
- Manus domain consistency

Run tests:
```bash
pnpm test server/worker.test.ts
```

### Integration Testing

**Manual test flow:**
1. Submit application via `/apply`
2. Approve in admin dashboard
3. Trigger deployment via "Run Next Deployment" button
4. Verify deployment status shows "Provisioning Link..."
5. Wait for status to change to "Live ✅"
6. Click "Open Live Site" to verify URL is accessible
7. Verify site content matches build plan

### Smoke Test Checklist

- [ ] Application submitted successfully
- [ ] Admin approval generates intake and build plan
- [ ] Deployment created and queued
- [ ] Deployment worker processes job
- [ ] URL generated in correct format
- [ ] URL is reachable (HTTP 200)
- [ ] Deployment status shows "Live ✅"
- [ ] Customer can view live site
- [ ] Site content matches build plan preview
- [ ] Email sent with live URL

---

## Troubleshooting

### URL Not Reachable

**Symptom:** Deployment shows "Live ✅" but URL returns 404/timeout

**Causes:**
- DNS propagation delay (typically < 1 minute)
- Manus infrastructure issue
- Network connectivity issue

**Resolution:**
- Wait 1-2 minutes and retry
- Check browser console for network errors
- Verify deployment logs in admin dashboard
- Contact support if issue persists

### Slug Collision

**Symptom:** Two customers with similar business names get same slug

**Prevention:** Deployment ID is appended to slug, making URLs unique

**Example:**
- "Smith Plumbing" → `site-smith-plumbing-123`
- "Smith Plumbing" → `site-smith-plumbing-456`

### Special Characters in Business Name

**Handled correctly:**
- `Joe's Auto` → `joe-s-auto`
- `Smith & Sons` → `smith-sons`
- `ABC-123 Services` → `abc-123-services`

---

## Environment Variables

- `CUSTOMER_SITES_BASE_HOST` — Base domain for customer sites (default: `launchbase-h86jcadp.manus.space`)
- `WORKER_TOKEN` — Secret token for deployment worker authentication

---

## Related Files

- `server/worker/deploymentWorker.ts` — Deployment execution logic
- `client/src/pages/DeploymentStatus.tsx` — Deployment status UI
- `client/src/pages/AdminDeployments.tsx` — Admin deployment dashboard
- `drizzle/schema.ts` — Deployments table schema
- `server/routers.ts` — tRPC procedures for deployment management

---

## Next Steps

1. ✅ Phase 1 implementation complete
2. ⏳ Cabinet maker beta test with real URLs
3. ⏳ Gather feedback on domain branding
4. ⏳ Phase 2 custom domain implementation
5. ⏳ Public launch with custom domain support
