# Email Verification & Troubleshooting (Resend)

This doc covers how to verify LaunchBase outbound + inbound email flows and debug fast.

---

## 1) Outbound Email (Ask / Confirm / Resend)

### Where to check
Resend Dashboard → Emails

### What "good" looks like
- Status: **Delivered**
- Recipient matches expected customer email
- The app logs an audit event:
  - `SENT` (system) or `RESENT` (admin)
  - `meta.resendMessageId` present

### How to trace one email end-to-end (fast)
1. In LaunchBase Admin → Intake → Action Requests
2. Open "Recent activity"
3. Find the latest `SENT` / `RESENT` event
4. Copy `meta.resendMessageId`
5. In Resend → Emails, search for that ID  
   (or filter by recipient + time)

This guarantees you're looking at the exact email.

### Common statuses
- **Delivered** → Success
- **Delivery Delay** → Not necessarily a bug (common for test domains / certain providers)
- **Failed** → Check:
  - sending domain verification
  - SPF/DKIM records
  - Resend suppression/bounce
  - API key/environment

---

## 2) Inbound Email (Customer Replies)

LaunchBase uses Resend inbound to receive customer replies and classify them.

### Where to check
Resend Dashboard → Domains → (your domain) → Receiving

### What "good" looks like
- Receiving shows **Verified**
- MX record is configured at registrar
- A real reply triggers events in LaunchBase:
  - `CUSTOMER_APPROVED` (reply "YES")
  - OR `CUSTOMER_EDITED` (reply includes edit)
  - OR `CUSTOMER_UNCLEAR` + `ESCALATED` (ambiguous)

### The fastest inbound test
Reply to a real action request email with:

```
YES
```

Expected event chain:
- `CUSTOMER_APPROVED`
- `APPLIED`
- `LOCKED`

---

## 3) Common "Looks Broken But Isn't" Cases

### Cron creates requests but no new emails
- If an action request already exists with status `pending` / `sent`, the sequencer may skip creating/sending again.
- Use Admin "Resend" (rate-limited) or expire/unlock as needed.

### "Delivery Delay" in Resend
- Often normal for test addresses / some providers.
- Confirm by checking if real addresses (like vmorre@live.com) deliver.

---

## 4) Debug Checklist (5 steps)

1. Find the latest action request for the intake
2. Look at `action_request_events` for that request
3. Confirm whether you have:
   - `SENT` / `RESENT` with `resendMessageId`
   - `SEND_FAILED` with error meta (if present)
4. Use `resendMessageId` to find the exact email in Resend
5. If inbound reply doesn't apply:
   - confirm Receiving is Verified
   - confirm webhook endpoint logs / events appear:
     - `CUSTOMER_APPROVED` / `CUSTOMER_EDITED` / `CUSTOMER_UNCLEAR`
