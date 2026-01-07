/**
 * Facebook Webhook Handler
 * Receives Facebook Page messages and lead forms, sends email notifications
 * 
 * Webhook events:
 * - messages: New messages to the Facebook Page
 * - leadgen: Lead form submissions
 */

import { getDb } from "../db";
import { sendEmail } from "../email";
import crypto from "crypto";

// Facebook App Secret for webhook verification
const FB_APP_SECRET = process.env.FB_APP_SECRET || "";
const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN || "launchbase_fb_webhook_2026";

// Notification email (Vince)
const NOTIFICATION_EMAIL = "vince@vincessnowplow.com";

interface FacebookWebhookEntry {
  id: string;
  time: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{ type: string; payload: { url?: string } }>;
    };
  }>;
  changes?: Array<{
    field: string;
    value: {
      leadgen_id?: string;
      page_id?: string;
      form_id?: string;
      created_time?: number;
    };
  }>;
}

interface FacebookWebhookPayload {
  object: string;
  entry: FacebookWebhookEntry[];
}

/**
 * Verify webhook signature from Facebook
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signature.split("sha256=")[1];
  const hmac = crypto.createHmac("sha256", FB_APP_SECRET);
  hmac.update(payload);
  const calculatedSignature = hmac.digest("hex");

  // timingSafeEqual requires equal-length buffers
  if (expectedSignature.length !== calculatedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(calculatedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Handle webhook verification (GET request from Facebook)
 */
export function handleWebhookVerification(params: {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}): { success: boolean; challenge?: string; error?: string } {
  const mode = params["hub.mode"];
  const token = params["hub.verify_token"];
  const challenge = params["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Facebook Webhook] Verification successful");
    return { success: true, challenge };
  }

  console.error("[Facebook Webhook] Verification failed", { mode, token });
  return { success: false, error: "Verification failed" };
}

/**
 * Process incoming webhook events
 */
export async function processWebhookEvent(
  payload: FacebookWebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[Facebook Webhook] Processing event", {
      object: payload.object,
      entries: payload.entry.length,
    });

    for (const entry of payload.entry) {
      // Handle messages
      if (entry.messaging) {
        for (const event of entry.messaging) {
          if (event.message) {
            await handleMessage(entry.id, event);
          }
        }
      }

      // Handle lead forms
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.field === "leadgen") {
            await handleLeadForm(entry.id, change.value);
          }
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[Facebook Webhook] Processing error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(
  pageId: string,
  event: {
    sender: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      attachments?: Array<{ type: string; payload: { url?: string } }>;
    };
  }
): Promise<void> {
  const senderId = event.sender.id;
  const messageText = event.message?.text || "";
  const hasAttachments = (event.message?.attachments?.length || 0) > 0;

  console.log("[Facebook Webhook] New message", {
    pageId,
    senderId,
    text: messageText.substring(0, 50),
    hasAttachments,
  });

  // Get page name from database
  const db = await getDb();
  let pageName = "Facebook Page";
  
  if (db) {
    const [connection] = await db
      .select()
      .from(await import("../../drizzle/schema").then(m => m.moduleConnections))
      .where(
        (await import("drizzle-orm").then(m => m.eq))(
          (await import("../../drizzle/schema").then(m => m.moduleConnections)).externalId,
          pageId
        )
      )
      .limit(1);

    if (connection) {
      pageName = connection.externalName || pageName;
    }
  }

  // Send email notification via Resend directly (not using sendEmail helper)
  const attachmentInfo = hasAttachments
    ? `\n\n📎 This message includes ${event.message?.attachments?.length} attachment(s).`
    : "";

  // Use Resend directly for Facebook notifications
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY || "");
  
  try {
    await resend.emails.send({
      from: "LaunchBase <onboarding@resend.dev>",
      to: NOTIFICATION_EMAIL,
      subject: `💬 New Facebook Message - ${pageName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1877f2;">💬 New Facebook Message</h2>
          <p><strong>Page:</strong> ${pageName}</p>
          <p><strong>From:</strong> Facebook User ${senderId}</p>
          <p><strong>Time:</strong> ${new Date(event.timestamp).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${messageText || "<em>(No text - may contain only attachments)</em>"}</p>
            ${hasAttachments ? `<p style="margin-top: 12px; color: #666;">📎 This message includes ${event.message?.attachments?.length} attachment(s).</p>` : ""}
          </div>

          <p>
            <a href="https://www.facebook.com/${pageId}" 
               style="display: inline-block; background: #1877f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Reply on Facebook
            </a>
          </p>

          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            This is an automated notification from LaunchBase.
          </p>
        </div>
      `,
    });
    console.log("[Facebook Webhook] Message notification sent");
  } catch (error) {
    console.error("[Facebook Webhook] Failed to send message notification", error);
  }
}

/**
 * Handle lead form submission
 */
async function handleLeadForm(
  pageId: string,
  value: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    created_time?: number;
  }
): Promise<void> {
  const leadgenId = value.leadgen_id || "";
  const formId = value.form_id || "";
  const createdTime = value.created_time || Date.now() / 1000;

  console.log("[Facebook Webhook] New lead form", {
    pageId,
    leadgenId,
    formId,
  });

  // Get page name from database
  const db = await getDb();
  let pageName = "Facebook Page";
  
  if (db) {
    const [connection] = await db
      .select()
      .from(await import("../../drizzle/schema").then(m => m.moduleConnections))
      .where(
        (await import("drizzle-orm").then(m => m.eq))(
          (await import("../../drizzle/schema").then(m => m.moduleConnections)).externalId,
          pageId
        )
      )
      .limit(1);

    if (connection) {
      pageName = connection.externalName || pageName;
    }
  }

  // Fetch lead details from Facebook API
  let leadDetails = "";
  const accessToken = await getPageAccessToken(pageId);
  
  if (accessToken) {
    try {
      const leadUrl = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`;
      const response = await fetch(leadUrl);
      const data = await response.json();

      if (data.field_data) {
        leadDetails = data.field_data
          .map((field: { name: string; values: string[] }) => 
            `${field.name}: ${field.values.join(", ")}`
          )
          .join("\n");
      }
    } catch (error) {
      console.error("[Facebook Webhook] Failed to fetch lead details", error);
      leadDetails = "(Unable to fetch lead details - check Facebook API permissions)";
    }
  } else {
    leadDetails = "(Unable to fetch lead details - page access token not found)";
  }

  // Send email notification via Resend directly
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY || "");
  
  try {
    await resend.emails.send({
      from: "LaunchBase <onboarding@resend.dev>",
      to: NOTIFICATION_EMAIL,
      subject: `🎯 New Lead Form Submission - ${pageName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00a400;">🎯 New Lead Form Submission</h2>
          <p><strong>Page:</strong> ${pageName}</p>
          <p><strong>Lead ID:</strong> ${leadgenId}</p>
          <p><strong>Form ID:</strong> ${formId}</p>
          <p><strong>Time:</strong> ${new Date(createdTime * 1000).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          
          <div style="background: #f0f8f0; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #00a400;">
            <h3 style="margin-top: 0; color: #00a400;">Lead Details:</h3>
            <pre style="margin: 0; white-space: pre-wrap; font-family: system-ui;">${leadDetails}</pre>
          </div>

          <p>
            <a href="https://www.facebook.com/${pageId}/leads_ads" 
               style="display: inline-block; background: #00a400; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              View Lead on Facebook
            </a>
          </p>

          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            This is an automated notification from LaunchBase.
          </p>
        </div>
      `,
    });
    console.log("[Facebook Webhook] Lead form notification sent");
  } catch (error) {
    console.error("[Facebook Webhook] Failed to send lead form notification", error);
  }
}

/**
 * Get page access token from database
 */
async function getPageAccessToken(pageId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [connection] = await db
    .select()
    .from(await import("../../drizzle/schema").then(m => m.moduleConnections))
    .where(
      (await import("drizzle-orm").then(m => m.eq))(
        (await import("../../drizzle/schema").then(m => m.moduleConnections)).externalId,
        pageId
      )
    )
    .limit(1);

  return connection?.accessToken || null;
}
