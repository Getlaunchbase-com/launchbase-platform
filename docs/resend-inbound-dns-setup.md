# Resend Inbound Email DNS Setup

## Overview

This document explains how to configure DNS records for inbound email processing via Resend. This enables customers to reply directly to action request emails (Ask → Understand → Apply → Confirm loop).

## Prerequisites

- Domain: `getlaunchbase.com` (managed via Namecheap)
- Resend account with API access
- Webhook endpoint: `POST /api/webhooks/resend/inbound`

## Step 1: Configure Inbound Address in Resend

1. Log in to [Resend Dashboard](https://resend.com/domains)
2. Navigate to **Domains** → `getlaunchbase.com`
3. Go to **Inbound** tab
4. Create inbound address pattern:
   ```
   approvals+{token}@getlaunchbase.com
   ```
5. Set webhook URL:
   ```
   https://getlaunchbase.com/api/webhooks/resend/inbound
   ```
6. Resend will display required DNS records (MX + TXT for verification)

## Step 2: Add DNS Records in Namecheap

1. Log in to [Namecheap](https://www.namecheap.com)
2. Navigate to **Domain List** → `getlaunchbase.com` → **Advanced DNS**
3. Add MX records provided by Resend:
   ```
   Type: MX Record
   Host: @ (or subdomain if using mail.getlaunchbase.com)
   Value: <provided by Resend>
   Priority: <provided by Resend>
   TTL: Automatic
   ```
4. Add TXT record for verification (if required by Resend):
   ```
   Type: TXT Record
   Host: @ (or _resend)
   Value: <verification token from Resend>
   TTL: Automatic
   ```
5. **Important:** Keep existing A/CNAME records intact (website should continue working)

## Step 3: Verify DNS Propagation

1. Wait 5-15 minutes for DNS propagation
2. Check status in Resend Dashboard → Domains → Inbound
3. Status should show: **Verified** or **Active**
4. Test with `dig` command:
   ```bash
   dig MX getlaunchbase.com
   ```

## Step 4: Test Inbound Email

### Option A: Send test email from your phone

1. Find an existing action request email in your inbox
2. Reply with "YES" or "NO"
3. Check Admin → Intake → Action Requests card:
   - Status should update to `locked` (if approved)
   - Recent Activity should show: CUSTOMER_APPROVED → APPLIED → LOCKED

### Option B: Use curl to simulate webhook

```bash
# Get a real token from an action request in the database
TOKEN="<real_token_from_action_requests_table>"

curl -X POST "https://getlaunchbase.com/api/webhooks/resend/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "approvals+'$TOKEN'@getlaunchbase.com",
    "from": "customer@example.com",
    "subject": "Re: Approve your homepage headline",
    "text": "YES"
  }'
```

## Webhook Payload Format

Resend sends the following JSON payload to your webhook:

```json
{
  "to": "approvals+<token>@getlaunchbase.com",
  "from": "customer@example.com",
  "subject": "Re: [LB:<token>] Approve your homepage headline",
  "text": "YES",
  "html": "<p>YES</p>",
  "headers": {
    "message-id": "<unique-id>",
    "in-reply-to": "<original-message-id>",
    "references": "<original-message-id>"
  }
}
```

## Token Extraction Priority

The webhook handler extracts tokens in this order:

1. **To address**: `approvals+{token}@getlaunchbase.com`
2. **Subject tag**: `[LB:{token}]`
3. **In-Reply-To header** (future enhancement)

## Troubleshooting

### DNS not propagating

- Wait up to 48 hours (usually 5-15 minutes)
- Use `dig MX getlaunchbase.com` to check
- Clear DNS cache: `sudo dscacheutil -flushcache` (macOS)

### Webhook not receiving emails

1. Check Resend Dashboard → Logs → Inbound
2. Verify webhook URL is correct
3. Check server logs: `grep "Webhook" /var/log/app.log`
4. Test webhook directly with curl (see above)

### Emails marked as spam

- Add SPF record (if not already present):
  ```
  Type: TXT
  Host: @
  Value: v=spf1 include:_spf.resend.com ~all
  ```
- Add DKIM records (provided by Resend)

### Action request not updating

1. Check webhook logs: `[Webhook] Inbound email: {...}`
2. Check classification: `[Webhook] Classification: {...}`
3. Verify action request exists in database
4. Check events table: `SELECT * FROM action_request_events WHERE actionRequestId = ?`

## Security Notes

- Webhook endpoint is **public** (no auth required)
- Token validation ensures only valid requests are processed
- Rate limiting prevents abuse (10-minute cooldown on resends)
- Idempotency guards prevent double-processing

## Next Steps

Once inbound is verified:

1. ✅ Test approve flow (reply "YES")
2. ✅ Test edit flow (reply with new value)
3. ✅ Test unclear flow (reply with ambiguous text)
4. ✅ Verify escalation emails go to `vince@vincessnowplow.com`
5. ✅ Monitor Admin → Action Requests card for real-time updates

## Related Documentation

- [Action Requests Architecture](./action-requests-architecture.md)
- [Email Automation Flow](./email-automation-flow.md)
- [Day 0-3 Message Sequence](./bot-messages-day0-3.md)
