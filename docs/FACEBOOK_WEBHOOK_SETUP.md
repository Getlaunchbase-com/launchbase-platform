# Facebook Webhook Setup Guide

This guide explains how to set up Facebook webhooks to receive notifications for messages and lead form submissions.

---

## Overview

**What it does:**
- Sends email to `vince@vincessnowplow.com` when someone messages your Facebook Page
- Sends email to `vince@vincessnowplow.com` when someone submits a lead form
- Never miss a customer inquiry or lead

**What you need:**
- Facebook Page (already connected via LaunchBase)
- Facebook App with webhook permissions
- LaunchBase webhook endpoint (already built)

---

## Step 1: Get Your Webhook URL

Your LaunchBase webhook endpoint is:

```
https://your-launchbase-domain.com/api/facebook/webhook
```

Replace `your-launchbase-domain.com` with your actual LaunchBase deployment URL.

---

## Step 2: Configure Facebook App Webhooks

1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Select your app (or create one if needed)
3. In the left sidebar, click **Webhooks**
4. Click **Add Subscription** → **Page**
5. Enter your webhook URL:
   ```
   https://your-launchbase-domain.com/api/facebook/webhook
   ```
6. Enter verify token: `launchbase_fb_webhook_2026`
7. Click **Verify and Save**

---

## Step 3: Subscribe to Webhook Fields

After verifying your webhook, subscribe to these fields:

### For Messages:
- ✅ `messages` - New messages to your Page

### For Lead Forms:
- ✅ `leadgen` - Lead form submissions

Click **Subscribe** for each field.

---

## Step 4: Add Required Permissions

Your Facebook App needs these permissions:

1. **pages_messaging** - To receive message webhooks
2. **pages_manage_metadata** - To receive page events
3. **leads_retrieval** - To fetch lead form details

To add permissions:
1. Go to **App Review** → **Permissions and Features**
2. Request **pages_messaging**, **pages_manage_metadata**, and **leads_retrieval**
3. Complete Facebook's review process (if required)

---

## Step 5: Test the Webhook

### Test Message Notification:
1. Send a message to your Facebook Page from a personal account
2. Check `vince@vincessnowplow.com` inbox
3. You should receive an email with:
   - Subject: "💬 New Facebook Message - [Page Name]"
   - Message content
   - Link to reply on Facebook

### Test Lead Form Notification:
1. Submit a test lead form on your Facebook Page
2. Check `vince@vincessnowplow.com` inbox
3. You should receive an email with:
   - Subject: "🎯 New Lead Form Submission - [Page Name]"
   - Lead details (name, email, phone, etc.)
   - Link to view lead on Facebook

---

## Environment Variables

Make sure these are set in your LaunchBase environment:

```bash
FB_APP_ID=your_facebook_app_id
FB_APP_SECRET=your_facebook_app_secret
FB_WEBHOOK_VERIFY_TOKEN=launchbase_fb_webhook_2026
RESEND_API_KEY=your_resend_api_key
```

---

## Troubleshooting

### Webhook verification fails
- Check that `FB_WEBHOOK_VERIFY_TOKEN` matches `launchbase_fb_webhook_2026`
- Verify your webhook URL is publicly accessible
- Check server logs for errors

### Not receiving message notifications
- Verify `messages` field is subscribed in Facebook App
- Check that your Page is connected in LaunchBase
- Verify `RESEND_API_KEY` is set correctly
- Check server logs for email sending errors

### Not receiving lead form notifications
- Verify `leadgen` field is subscribed in Facebook App
- Check that your app has `leads_retrieval` permission
- Verify lead form is published and active
- Check server logs for API errors

### Emails not arriving
- Check spam folder
- Verify `RESEND_API_KEY` is valid
- Check Resend dashboard for delivery status
- Verify `vince@vincessnowplow.com` is correct

---

## Security Notes

1. **Signature Verification**: All webhook events are verified using `x-hub-signature-256` header
2. **HTTPS Required**: Facebook only sends webhooks to HTTPS endpoints
3. **App Secret**: Never commit `FB_APP_SECRET` to version control
4. **Token Rotation**: Rotate `FB_WEBHOOK_VERIFY_TOKEN` periodically

---

## Webhook Event Flow

```
Facebook Page Message
  ↓
Facebook sends webhook to /api/facebook/webhook
  ↓
LaunchBase verifies signature
  ↓
LaunchBase processes event
  ↓
LaunchBase sends email via Resend
  ↓
Email arrives at vince@vincessnowplow.com
```

---

## Rate Limits

Facebook webhook rate limits:
- **Messages**: No specific limit, but bursts may be throttled
- **Lead Forms**: No specific limit

Resend email rate limits:
- **Free tier**: 100 emails/day
- **Paid tier**: Higher limits based on plan

---

## Monitoring

Check webhook health:
1. Facebook Developer Console → Webhooks → View Recent Deliveries
2. LaunchBase server logs: `grep "Facebook Webhook" logs.txt`
3. Resend Dashboard → Emails → Delivery status

---

## Next Steps

After setup is complete:
1. Test both message and lead form notifications
2. Monitor for 24 hours to ensure reliability
3. Consider adding webhook event logging to database (future enhancement)
4. Set up alerts for webhook failures (future enhancement)

---

**Questions?** Reply to any LaunchBase email or check server logs for detailed error messages.
