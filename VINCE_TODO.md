# VINCE TODO: Email Domain Verification

## ⚡ CRITICAL: Verify getlaunchbase.com in Resend

**Why this matters:** Until this is done, Resend will silently fail or restrict recipients. Once verified, emails automatically switch to `support@getlaunchbase.com` (no code changes needed).

---

## Step 1: Add Domain in Resend Dashboard

1. Go to [Resend Dashboard → Domains](https://resend.com/domains)
2. Click **"Add Domain"**
3. Enter: `getlaunchbase.com`
4. Click **"Add"**

Resend will show you DNS records to add (DKIM, SPF, DMARC).

---

## Step 2: Add DNS Records in Namecheap

1. Go to [Namecheap Dashboard](https://www.namecheap.com/myaccount/login/)
2. Find `getlaunchbase.com` → Click **"Manage"**
3. Go to **"Advanced DNS"** tab
4. Add the records Resend gave you:

### Example Records (yours will be similar):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | @ | `v=spf1 include:_spf.resend.com ~all` | Automatic |
| TXT | resend._domainkey | `p=MIGfMA0GCS...` (long DKIM key) | Automatic |
| TXT | _dmarc | `v=DMARC1; p=none;` | Automatic |

**Important:**
- For `@` records, Namecheap might show it as blank or `@` - both work
- For subdomain records like `resend._domainkey`, enter exactly as shown
- TTL can be "Automatic" or 300 seconds

---

## Step 3: Wait for Verification (5-60 minutes)

1. Go back to Resend Dashboard → Domains
2. Click **"Verify"** next to `getlaunchbase.com`
3. If it shows ❌ "Pending", wait 5-10 minutes and try again
4. Once it shows ✅ "Verified", you're done!

---

## Step 4: Flip the Switch (One-Time)

Once Resend shows **"Verified"**, add this environment variable in Manus:

```
RESEND_DOMAIN_VERIFIED=true
```

**How to add:**
1. Go to Manus Management UI → Settings → Secrets
2. Add new secret:
   - Key: `RESEND_DOMAIN_VERIFIED`
   - Value: `true`
3. Save

**Result:** All emails will now send from `support@getlaunchbase.com` instead of `onboarding@resend.dev`. No code changes, no redeploy needed.

---

## Step 5: Test Real Inbox Delivery

1. Go to `/admin/email-monitoring` in LaunchBase
2. Enter your email: `vmorre@live.com`
3. Click **"Send Test"**
4. Check your inbox (and spam folder)
5. Repeat for `vince@vincessnowplow.com`

**What to verify:**
- ✅ Email arrives (not in spam)
- ✅ FROM shows: `LaunchBase <support@getlaunchbase.com>`
- ✅ Reply-to works: `support@getlaunchbase.com`

---

## Troubleshooting

### Email not arriving?
- Check Resend Dashboard → Logs for errors
- Check `/admin/email-monitoring` for failed status
- Verify DNS records are correct (use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx?action=spf%3agetlaunchbase.com))

### Still showing `onboarding@resend.dev`?
- Verify `RESEND_DOMAIN_VERIFIED=true` is set in Manus secrets
- Restart dev server (or wait for auto-reload)

### Emails going to spam?
- DMARC policy is set to `p=none` (monitoring only)
- After a few days, consider upgrading to `p=quarantine` or `p=reject`
- Add SPF and DKIM records exactly as Resend provides

---

## Next: Create Email Inboxes (Optional but Recommended)

Once domain is verified, you can create these inboxes:

1. **info@getlaunchbase.com** - General contact (footer)
2. **support@getlaunchbase.com** - Customer support (reply-to)
3. **billing@getlaunchbase.com** - Stripe receipts

**How to create:**
- Use your email provider (Google Workspace, Fastmail, etc.)
- Or forward all to your personal email initially

These don't need to be created in Resend - Resend only sends, doesn't receive.

---

## Status Checklist

- [ ] Domain added in Resend
- [ ] DNS records added in Namecheap
- [ ] Domain verified in Resend (✅ green)
- [ ] `RESEND_DOMAIN_VERIFIED=true` added to Manus secrets
- [ ] Test email sent to vmorre@live.com (received)
- [ ] Test email sent to vince@vincessnowplow.com (received)
- [ ] Email shows FROM: `support@getlaunchbase.com`
- [ ] Reply-to works correctly

---

**Estimated time:** 15-30 minutes (most of it waiting for DNS propagation)

**Questions?** Check `/admin/email-monitoring` for real-time delivery status.
