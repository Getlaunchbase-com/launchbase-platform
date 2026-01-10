# Email Verification & Troubleshooting

This document explains how to verify email delivery and debug issues with the action request system.

## Quick Reference

**Resend Dashboard:** https://resend.com/emails  
**Inbound Domain:** approvals@getlaunchbase.com  
**DNS Status:** https://resend.com/domains

---

## Outbound Emails (Ask / Confirm)

### How to Verify Delivery

1. Go to **Resend → Emails**
2. Filter by recipient email address
3. Check status column

### Status Meanings

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| **Delivered** | ✅ Email successfully delivered to inbox | None - working correctly |
| **Delivery Delay** | ⏳ Temporary delay (common for test domains like @test.com) | Wait or use real email address |
| **Failed** | ❌ Permanent delivery failure | Check `meta.errorMessage` in event log |

### Common Non-Issues

- **@test.com delivery delays are expected** - These are fake test addresses, not real inboxes
- **Cron skips existing sent requests by design** - Status must be "pending" to send
- **Emails only marked "sent" on real Resend delivery** - Fallback notifications don't change status

---

## Inbound Emails (Customer Replies)

### How to Verify Inbound Setup

1. Go to **Resend → Domains → getlaunchbase.com**
2. Check **Receiving** section shows **Verified** ✅
3. Verify MX record exists:
   ```bash
   dig MX getlaunchbase.com
   ```

### Test Inbound Processing

1. Find an action request email in your inbox
2. Reply with exactly: `YES`
3. Check **Admin → Action Requests** card
4. Verify events appear in order:
   - `CUSTOMER_APPROVED`
   - `APPLIED`
   - `LOCKED`
5. Confirm confirmation email sent

### Inbound Webhook Endpoint

- **URL:** `https://www.getlaunchbase.com/api/webhooks/resend`
- **Method:** POST
- **Auth:** Resend signature verification (automatic)

---

## How to Debug Fast

### Step 1: Find the Event

```sql
SELECT * FROM action_request_events 
WHERE actionRequestId = ? 
ORDER BY createdAt DESC;
```

### Step 2: Extract Resend Message ID

Look for `meta.resendMessageId` in the event row:

```json
{
  "resendMessageId": "abc123...",
  "to": "customer@example.com",
  "subject": "Approve: homepage headline"
}
```

### Step 3: Search in Resend Dashboard

1. Copy the `resendMessageId`
2. Go to Resend → Emails
3. Paste ID in search box
4. View full delivery details

### Step 4: Check Event Sequence

Expected flow for successful approval:

```
SENT → CUSTOMER_APPROVED → APPLIED → LOCKED
```

If stuck at `SENT`:
- Customer hasn't replied yet
- Reply went to wrong address (check replyTo)
- Webhook not receiving (check Resend logs)

If `SEND_FAILED`:
- Check `meta.errorMessage` for Resend error
- Verify RESEND_API_KEY is set
- Check recipient email format

---

## Common Issues

### Issue: "Email not sending"

**Symptoms:** Action request stays in "pending" status

**Debug steps:**
1. Check `action_request_events` for `SEND_FAILED` event
2. Look at `meta.errorMessage` for Resend error
3. Verify `RESEND_API_KEY` environment variable is set
4. Check Resend dashboard for API errors

**Common causes:**
- Missing or invalid API key
- Recipient email invalid format
- Resend account suspended (check billing)

---

### Issue: "Customer replied but nothing happened"

**Symptoms:** Reply sent but no `CUSTOMER_APPROVED` event

**Debug steps:**
1. Check Resend → Domains → Receiving = Verified
2. Verify MX record exists: `dig MX getlaunchbase.com`
3. Check webhook endpoint is accessible: `curl https://www.getlaunchbase.com/api/webhooks/resend`
4. Look for webhook errors in server logs

**Common causes:**
- MX record not configured
- Webhook endpoint down
- Customer replied to wrong address
- Reply didn't include approve/edit keywords

---

### Issue: "Delivery Delay" in Resend

**Symptoms:** Email shows "Delivery Delay" status

**This is expected for:**
- Test email addresses (@test.com, @example.com)
- Temporary recipient server issues
- Greylisting by recipient mail server

**Action:**
- If using test addresses: This is normal, use real email to verify
- If using real addresses: Wait 5-10 minutes, usually resolves automatically
- If persistent (>1 hour): Check recipient's spam folder or mail server status

---

## Testing Checklist

Before deploying changes to email system:

- [ ] Send test action request via Admin UI
- [ ] Verify email appears in Resend dashboard with "Delivered" status
- [ ] Reply "YES" from real email client
- [ ] Verify `CUSTOMER_APPROVED` event logged
- [ ] Verify confirmation email sent
- [ ] Check `resendMessageId` is stored in event meta
- [ ] Verify no duplicate sends on cron re-run

---

## Emergency Procedures

### If emails stop sending entirely:

1. **Check Resend API status:** https://resend.com/status
2. **Verify API key:** `echo $RESEND_API_KEY` (should not be empty)
3. **Check account billing:** Resend dashboard → Settings → Billing
4. **Test with curl:**
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from":"support@getlaunchbase.com","to":"test@example.com","subject":"Test","html":"Test"}'
   ```

### If inbound webhook stops working:

1. **Check DNS:** `dig MX getlaunchbase.com` (should return Resend MX records)
2. **Check webhook logs:** Resend dashboard → Domains → Receiving → Logs
3. **Test webhook endpoint:**
   ```bash
   curl -X POST https://www.getlaunchbase.com/api/webhooks/resend \
     -H "Content-Type: application/json" \
     -d '{"type":"email.received","data":{"to":"approvals@getlaunchbase.com"}}'
   ```
4. **Verify signature validation:** Check server logs for "Invalid signature" errors

---

## Forever Rules

These patterns prevent re-debugging:

1. **Always log `resendMessageId`** - One-click correlation to Resend dashboard
2. **Never mark "sent" without real delivery** - Status reflects reality, not attempts
3. **Log SEND_FAILED with error message** - Failures are visible, not silent
4. **Test with real email addresses** - @test.com delays are expected and meaningless

---

## Reference: Event Types

| Event Type | Meaning | Actor | Logged When |
|------------|---------|-------|-------------|
| `SENT` | Email successfully delivered via Resend | system | After `resend.emails.send()` succeeds |
| `RESENT` | Admin manually resent email | admin | Admin clicks "Resend" button |
| `SEND_FAILED` | Email delivery failed | system | After `resend.emails.send()` throws |
| `CUSTOMER_APPROVED` | Customer replied "YES" | customer | Webhook processes approval reply |
| `CUSTOMER_EDITED` | Customer replied with edit | customer | Webhook processes edit reply |
| `CUSTOMER_UNCLEAR` | Customer reply ambiguous | customer | Webhook can't classify intent |
| `APPLIED` | Change applied to checklist | system | After approval processed |
| `LOCKED` | Request locked (no more edits) | system | After change applied |
| `ESCALATED` | Unclear reply escalated to human | system | After `CUSTOMER_UNCLEAR` |

---

## Support Contacts

- **Resend Support:** support@resend.com
- **DNS Issues:** Check with domain registrar (Namecheap, etc.)
- **LaunchBase Ops:** Check Admin → Alerts for system-level issues
