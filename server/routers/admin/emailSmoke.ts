/**
 * Email smoke test procedures — requires Resend API key for test delivery.
 * Used in CI/CD pipeline validation.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { emailLogs } from "../../db/schema";
import { desc } from "drizzle-orm";

export const adminEmailSmokeRouter = router({
  /** Send a test email using the email service */
  sendTest: adminProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if email service is configured
      if (!process.env.RESEND_API_KEY) {
        return {
          success: false,
          error: "Email service not configured",
        };
      }

      try {
        const subject = input.subject ?? "LaunchBase Test Email";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "LaunchBase <noreply@launchbase.com>",
            to: [input.to],
            subject,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; margin: 0; color: #2563eb;">LaunchBase</h1>
  </div>
  <p>This is a test email from the LaunchBase platform.</p>
  <p>If you received this message, your email service is working correctly.</p>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
    <p>LaunchBase - Professional websites for local businesses</p>
  </div>
</body>
</html>`.trim(),
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          return {
            success: false,
            error: `Resend API error ${response.status}: ${body}`,
          };
        }

        const result = (await response.json()) as { id?: string };

        // Log to database (best-effort)
        try {
          const db = await getDb();
          if (db) {
            await db.insert(emailLogs).values({
              intakeId: 0, // Test email, no intake
              emailType: "ops_alert",
              recipientEmail: input.to,
              subject,
              status: "sent",
              deliveryProvider: "resend",
              providerMessageId: result.id ?? null,
              source: "smoke_test",
              templateVersion: "v1",
            });
          }
        } catch (logErr) {
          console.error("[email-smoke] Failed to log test email to database:", logErr);
        }

        return {
          success: true,
          messageId: result.id,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),

  /** List the 20 most recent email logs */
  listRecent: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { emails: [] };

    const emails = await db
      .select()
      .from(emailLogs)
      .orderBy(desc(emailLogs.sentAt))
      .limit(20);

    return { emails };
  }),

  /** Return whether the email service is configured */
  healthCheck: adminProcedure.query(async () => {
    const configured = !!process.env.RESEND_API_KEY;
    const provider = configured ? "resend" : "none";

    return { configured, provider };
  }),
});
