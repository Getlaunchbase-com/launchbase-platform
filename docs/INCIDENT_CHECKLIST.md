# 🚨 INCIDENT_CHECKLIST.md

**LaunchBase + Customer Ops Incident Checklist**

> **Purpose:**  
> When something "isn't working", this file prevents panic, guessing, and lost time.  
> Follow top → bottom. Do not skip steps.

---

## 🧭 How to Use This File

1. **Identify which entity is affected:**
   - LaunchBase (platform)
   - Customer site (ex: vincessnowplow.com)

2. **Find the matching section**

3. **Follow the checklist in order**

4. **Stop as soon as the issue is found**

---

## 🟦 ENTITY A — LAUNCHBASE (Platform)

### A1. Emails Not Sending (Resend)

**Symptoms:**
- No intake confirmation emails
- Admin notifications missing
- Resend dashboard shows "Failed" or "Unverified"

**Checklist:**

1. **Resend Dashboard**
   - Domain status = ✅ Verified
   - DKIM = ✅ Verified
   - SPF = ✅ Verified

2. **DNS (Namecheap)**
   - TXT `resend._domainkey` exists
   - SPF includes `include:_spf.resend.com`
   - No duplicate SPF records

3. **Environment Variables**
   - `RESEND_API_KEY` present
   - `FROM_EMAIL` correct
   - `RESEND_DOMAIN_VERIFIED=true` only after verification

4. **Fallback Check**
   - If domain not verified → emails should still send via `@resend.dev`

**Result:**
- ✅ If fallback works → DNS issue only
- ❌ If fallback fails → API key or code issue

---

### A2. Payments / Stripe Webhooks

**Symptoms:**
- Payment succeeds but site not created
- Admin dashboard shows webhook failures

**Checklist:**

1. **Open Admin → Stripe Webhooks**
   - Look for red (failed) events

2. **Check webhook signature errors**

3. **Confirm webhook endpoint URL**

4. **Verify idempotency key handling**

---

### A3. Deployments Stuck

**Symptoms:**
- "We're building your site" but nothing happens

**Checklist:**

1. **Admin → Deploy Queue**

2. **Check job status:**
   - `queued`
   - `running`
   - `failed`

3. **If failed:**
   - Check build logs
   - Restart job once (only once)

---

## 🟩 ENTITY B — CUSTOMER (Vince's Snowplow)

### B1. Contact Form Not Reaching Owner

**Symptoms:**
- Customer submits form
- Owner receives nothing

**Checklist:**

1. **Submit test form**

2. **Confirm:**
   - Admin notification triggered
   - Database row created

3. **Email routing:**
   - Sent to `info@vincessnowplow.com`

4. **Spam check:**
   - Check Spam / Promotions folders

---

### B2. Customer Email Inbox Broken

**Symptoms:**
- Can't receive emails at domain
- MX errors in Resend / Google Workspace

**Checklist:**

1. **Who handles inbox?**
   - Google Workspace → MX = Google
   - Resend → MX = Resend inbound
   - Forwarding → Namecheap Email Forwarding

2. **Only ONE MX strategy allowed**
   - ❌ Never mix Google + Resend inbound
   - ❌ Never use host send for receiving

3. **Correct MX host:**
   - Receiving email = `@`
   - Sending email (Resend) = `send`

---

### B3. Facebook Leads Not Arriving

**Symptoms:**
- Leads submitted on Facebook
- Nothing reaches email or system

**Checklist:**

1. **Meta App approved?**
   - ❌ If no → STOP (wait)

2. **Webhook URL reachable?**

3. **Page Access Token valid?**

4. **Test with Facebook "Send Test Lead"**

---

## 🧠 GOLDEN RULES (Read This When Tired)

- DNS changes take time — don't keep re-editing
- One email provider per domain for receiving
- "Verified" > "Looks right"
- If fallback works, the system is healthy
- Never debug two systems at once

---

## ✅ Status Tracking

When fixed, write:

```
[DATE] – Issue fixed – What was wrong – What fixed it
```

---

## 🎯 Done

This file now:
- Reduces stress
- Prevents repeat mistakes
- Makes future debugging boring (the goal)
