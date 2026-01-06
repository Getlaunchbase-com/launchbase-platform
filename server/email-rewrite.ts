/**
 * FOREVER FIX: Email delivery with observable failures
 * 
 * This rewrite implements:
 * 1. Explicit provider tracking (resend | notification)
 * 2. Normalized error capture (never swallow Resend failures)
 * 3. Delta-safe logging (write before fallback)
 * 4. Observable in DB (deliveryProvider + errorMessage)
 */

import { getDb } from "./db";
import { emailLogs } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { Resend } from "resend";
import { ENV } from "./_core/env";

// Error normalization helpers
function normalizeResendError(err: unknown) {
  const e: any = err;
  return {
    name: e?.name,
    message: e?.message,
    status: e?.statusCode ?? e?.status ?? e?.response?.status,
    type: e?.type,
    code: e?.code,
    apiMessage: e?.response?.data?.message ?? e?.response?.body?.message,
    raw: typeof err === "string" ? err : undefined,
  };
}

function toOneLine(obj: any): string {
  try {
    return JSON.stringify(obj).slice(0, 1500);
  } catch {
    return String(obj).slice(0, 1500);
  }
}

// Runtime Resend client (never cache at module level)
function getResendClient(): Resend | null {
  const key = ENV.resendApiKey;
  if (!key) {
    console.log("[Email] No RESEND_API_KEY configured, will use notification fallback");
    return null;
  }
  return new Resend(key);
}

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || "LaunchBase <noreply@launchbase.app>";
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || "support@launchbase.app";

// Rewritten sendEmail with explicit provider logging
export async function sendEmail(
  intakeId: number,
  type: string, // EmailType
  data: { firstName: string; businessName: string; email: string; previewUrl?: string; liveUrl?: string },
  template: { subject: string; body: string }
): Promise<{ ok: boolean; provider: "resend" | "notification"; error?: string }> {
  const db = await getDb();
  if (!db) {
    console.error("[Email] Database not available");
    return { ok: false, provider: "notification", error: "db_unavailable" };
  }

  // Try Resend first
  const resend = getResendClient();
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.email,
        replyTo: REPLY_TO_EMAIL,
        subject: template.subject,
        text: template.body,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${template.body.split('\n').map(line => 
              line.startsWith('•') 
                ? `<p style="margin: 8px 0; padding-left: 16px;">${line}</p>`
                : line === '' 
                  ? '<br/>'
                  : `<p style="margin: 16px 0; line-height: 1.6;">${line}</p>`
            ).join('')}
          </div>
        `,
      });

      if (result.data?.id) {
        // Success: log with provider="resend"
        await db.insert(emailLogs).values({
          intakeId,
          emailType: type as any,
          recipientEmail: data.email,
          subject: template.subject,
          status: "sent",
          deliveryProvider: "resend",
          errorMessage: null,
        });

        console.log(`[Email] ✅ Sent via Resend: ${type} to ${data.email} (ID: ${result.data.id})`);
        return { ok: true, provider: "resend" };
      }
    } catch (err) {
      // Resend failed: normalize error and log BEFORE fallback
      const errorInfo = normalizeResendError(err);
      const errorString = `resend_failed: ${toOneLine(errorInfo)}`;
      
      console.error("[Email] ❌ Resend failed:", errorInfo);

      // Write failed log with provider="resend" and error details
      await db.insert(emailLogs).values({
        intakeId,
        emailType: type as any,
        recipientEmail: data.email,
        subject: template.subject,
        status: "failed",
        deliveryProvider: "resend",
        errorMessage: errorString,
      });

      // Now fallback to notification
      console.log(`[Email] ⚠️  Falling back to notification for ${type} to ${data.email}`);
    }
  }

  // Fallback: Use notification system
  try {
    const emailContent = `
**To:** ${data.email}
**Subject:** ${template.subject}

---

${template.body}
    `.trim();

    await notifyOwner({
      title: `📧 ${template.subject}`,
      content: emailContent,
    });

    // Log success with provider="notification"
    await db.insert(emailLogs).values({
      intakeId,
      emailType: type as any,
      recipientEmail: data.email,
      subject: template.subject,
      status: "sent",
      deliveryProvider: "notification",
      errorMessage: resend ? "resend_failed_fallback" : "resend_not_configured",
    });

    console.log(`[Email] ✅ Sent via notification: ${type} to ${data.email}`);
    return { ok: true, provider: "notification" };
  } catch (fallbackErr) {
    console.error("[Email] ❌ Notification fallback also failed:", fallbackErr);
    
    // Log complete failure
    await db.insert(emailLogs).values({
      intakeId,
      emailType: type as any,
      recipientEmail: data.email,
      subject: template.subject,
      status: "failed",
      deliveryProvider: "notification",
      errorMessage: `notification_failed: ${toOneLine(fallbackErr)}`,
    });

    return { ok: false, provider: "notification", error: "all_providers_failed" };
  }
}
