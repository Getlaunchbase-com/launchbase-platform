/**
 * Email Module
 *
 * Real email sending with logging to the emailLogs table.
 * Attempts actual delivery via Resend if RESEND_API_KEY is set,
 * otherwise falls back to console logging for development.
 */

import { getDb } from "./db";
import { emailLogs } from "./db/schema";

// ---------------------------------------------------------------------------
// Email type mapping (template string -> enum value)
// ---------------------------------------------------------------------------

const TEMPLATE_TO_EMAIL_TYPE: Record<string, string> = {
  intake_confirmation: "intake_confirmation",
  in_progress: "in_progress",
  ready_for_review: "ready_for_review",
  review_nudge: "review_nudge",
  launch_confirmation: "launch_confirmation",
  deployment_started: "deployment_started",
  site_live: "site_live",
  preview_followup: "preview_followup",
  testimonial_request: "testimonial_request",
  founding_client_lockin: "founding_client_lockin",
  founder_welcome: "founder_welcome",
  day7_checkin: "day7_checkin",
  day30_value: "day30_value",
  contact_form_confirmation: "contact_form_confirmation",
  ops_alert: "ops_alert",
};

function resolveEmailType(template: string): string {
  return TEMPLATE_TO_EMAIL_TYPE[template] ?? "ops_alert";
}

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

export async function sendEmail(
  intakeId: number,
  template: string,
  data: Record<string, unknown>,
): Promise<void> {
  const startTime = Date.now();
  const recipientEmail = (data.email as string) || (data.recipientEmail as string) || "unknown@example.com";
  const subject = (data.subject as string) || `LaunchBase: ${template.replace(/_/g, " ")}`;
  const emailType = resolveEmailType(template) as any;

  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;
  let providerMessageId: string | null = null;
  let deliveryProvider: "resend" | "notification" | null = null;

  try {
    if (process.env.RESEND_API_KEY) {
      // Attempt real email delivery via Resend
      deliveryProvider = "resend";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "LaunchBase <noreply@launchbase.com>",
          to: [recipientEmail],
          subject,
          html: buildEmailHTML(template, data),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }

      const result = (await response.json()) as { id?: string };
      providerMessageId = result.id ?? null;
    } else {
      // Dev mode: log to console
      deliveryProvider = "notification";
      console.log(
        `[email] (dev) Would send "${template}" to ${recipientEmail} for intake #${intakeId}`,
        JSON.stringify(data, null, 2),
      );
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[email] Failed to send "${template}" to ${recipientEmail}:`, errorMessage);
  }

  // Log to database (best-effort)
  try {
    const db = await getDb();
    if (db) {
      const durationMs = Date.now() - startTime;
      await db.insert(emailLogs).values({
        intakeId,
        emailType,
        recipientEmail,
        subject,
        status,
        deliveryProvider,
        errorMessage,
        providerMessageId,
        durationMs,
        source: "platform",
        templateVersion: "v1",
      });
    }
  } catch (logErr) {
    console.error("[email] Failed to log email to database:", logErr);
  }
}

// ---------------------------------------------------------------------------
// buildEmailHTML — simple HTML template builder
// ---------------------------------------------------------------------------

function buildEmailHTML(template: string, data: Record<string, unknown>): string {
  const businessName = (data.businessName as string) || "your business";
  const contactName = (data.contactName as string) || "there";
  const previewUrl = (data.previewUrl as string) || "";

  const greeting = `Hi ${contactName},`;

  const bodyMap: Record<string, string> = {
    intake_confirmation: `<p>${greeting}</p><p>Thank you for submitting your intake for <strong>${businessName}</strong>. Our team is reviewing your information and we'll be in touch soon.</p>`,
    ready_for_review: `<p>${greeting}</p><p>Great news! Your website preview for <strong>${businessName}</strong> is ready for review.</p>${previewUrl ? `<p><a href="${previewUrl}">View your preview</a></p>` : ""}`,
    site_live: `<p>${greeting}</p><p>Your website for <strong>${businessName}</strong> is now live! Congratulations on your new online presence.</p>`,
    contact_form_confirmation: `<p>${greeting}</p><p>Thank you for reaching out! We've received your message and will get back to you within 24 hours.</p>`,
    deployment_started: `<p>${greeting}</p><p>We've started building your website for <strong>${businessName}</strong>. You'll receive a notification when the preview is ready.</p>`,
    founder_welcome: `<p>${greeting}</p><p>Welcome to the LaunchBase Founders Program! You've secured your spot as one of our founding clients for <strong>${businessName}</strong>.</p>`,
  };

  const body = bodyMap[template] || `<p>${greeting}</p><p>Update regarding <strong>${businessName}</strong>: ${template.replace(/_/g, " ")}.</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; margin: 0; color: #2563eb;">LaunchBase</h1>
  </div>
  ${body}
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
    <p>LaunchBase - Professional websites for local businesses</p>
  </div>
</body>
</html>`.trim();
}

// ---------------------------------------------------------------------------
// AdminNotifications
// ---------------------------------------------------------------------------

export const AdminNotifications = {
  async newIntake(businessName: string, score: number): Promise<void> {
    console.log(
      `[admin-notification] New intake: "${businessName}" (score: ${score})`,
    );

    // Optionally send webhook notification
    if (process.env.ADMIN_WEBHOOK_URL) {
      try {
        await fetch(process.env.ADMIN_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "new_intake",
            text: `New intake: ${businessName} (score: ${score})`,
            businessName,
            score,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[admin-notification] Webhook failed:", err);
      }
    }
  },

  async paymentReceived(intakeId: number, amount: number): Promise<void> {
    console.log(
      `[admin-notification] Payment received: intake #${intakeId}, amount: $${(amount / 100).toFixed(2)}`,
    );

    if (process.env.ADMIN_WEBHOOK_URL) {
      try {
        await fetch(process.env.ADMIN_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "payment_received",
            text: `Payment received for intake #${intakeId}: $${(amount / 100).toFixed(2)}`,
            intakeId,
            amount,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[admin-notification] Webhook failed:", err);
      }
    }
  },

  async intakeCompleted(data?: Record<string, unknown>): Promise<void> {
    console.log("[admin-notification] Intake completed:", data);
  },

  async deploymentFailed(data?: Record<string, unknown>): Promise<void> {
    console.error("[admin-notification] Deployment failed:", data);

    if (process.env.ADMIN_WEBHOOK_URL) {
      try {
        await fetch(process.env.ADMIN_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "deployment_failed",
            text: `Deployment failed`,
            ...data,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("[admin-notification] Webhook failed:", err);
      }
    }
  },
};
