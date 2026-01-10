/**
 * Webhook Failure Alert
 * 
 * Sends ops alert when inbound webhook fails
 * Catches DNS/Resend outages instantly
 */

import { notifyOwner } from "./notification";

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

export async function alertWebhookFailure(data: {
  endpoint: string;
  statusCode: number;
  requestId?: string;
  resendMessageId?: string;
  error?: string;
  timestamp: string;
}) {
  // Rate limit: Don't spam alerts
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    console.log("[WebhookAlert] Skipping alert (cooldown)");
    return;
  }
  lastAlertTime = now;

  const content = `
**Inbound Email Webhook Failing**

Endpoint: ${data.endpoint}
Status Code: ${data.statusCode}
Timestamp: ${data.timestamp}
${data.requestId ? `Request ID: ${data.requestId}` : ''}
${data.resendMessageId ? `Resend Message ID: ${data.resendMessageId}` : ''}
${data.error ? `Error: ${data.error}` : ''}

This may indicate:
- DNS configuration issue
- Resend service outage
- Webhook endpoint error

Check:
1. Resend Dashboard → Logs → Inbound
2. Server logs: grep "Webhook" /var/log/app.log
3. DNS records: dig MX getlaunchbase.com
  `.trim();

  await notifyOwner({
    title: "🚨 Inbound Email Webhook Failing",
    content,
  });

  console.error("[WebhookAlert] Alert sent:", data);
}
