/**
 * Schema Out of Date Alert
 * 
 * Sends ops email when schema guard detects missing columns
 * Deduped by schemaKey + endpoint + missing columns (60-min window)
 */

import { createHash } from "crypto";
import { Resend } from "resend";
import { getDb } from "./db";
import { alertEvents } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";

const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Send alert email when schema is out of date
 * Returns true if email was sent, false if deduped
 */
export async function alertSchemaOutOfDate(params: {
  endpoint: string;
  schemaKey: string;
  missingColumns: string[];
  buildId: string;
  serverTime: string;
}): Promise<boolean> {
  const { endpoint, schemaKey, missingColumns, buildId, serverTime } = params;

  // Create dedupe fingerprint: schema_out_of_date:<schemaKey>:<endpoint>:<hash(missingColumns)>
  const columnsHash = createHash("md5")
    .update(missingColumns.sort().join(","))
    .digest("hex")
    .slice(0, 8);
  const fingerprint = `schema_out_of_date:${schemaKey}:${endpoint}:${columnsHash}`;

  // Check if we already alerted recently (dedupe)
  const db = await getDb();
  if (!db) {
    console.warn("[SchemaAlert] DB not available, skipping alert");
    return false;
  }

  try {
    // Check for recent alert with same fingerprint
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await db
      .select()
      .from(alertEvents)
      .where(
        and(
          eq(alertEvents.fingerprint, fingerprint),
          gt(alertEvents.firstSeenAt, cutoff)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[SchemaAlert] Deduped (fingerprint: ${fingerprint})`);
      return false;
    }

    // Send email
    const adminEmails = process.env.ADMIN_EMAILS;
    if (!adminEmails) {
      console.warn("[SchemaAlert] ADMIN_EMAILS not set, skipping email");
      return false;
    }

    const recipients = adminEmails.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      console.warn("[SchemaAlert] No valid ADMIN_EMAILS found");
      return false;
    }

    const subject = `[LaunchBase] Schema out of date — ${endpoint}`;
    const body = `
Schema guard detected missing columns in the database.

**Endpoint:** ${endpoint}
**Schema Key:** ${schemaKey}
**Missing Columns:** ${missingColumns.join(", ")}
**Build ID:** ${buildId}
**Server Time:** ${serverTime}

**What this means:**
Code deployed before migrations ran. Worker endpoints are skipping execution until schema catches up.

**Action required:**
1. Check if migrations are running/stuck
2. Verify DATABASE_URL is correct
3. Run migrations manually if needed: \`pnpm db:push\`

**Status:**
Worker endpoints are returning 200 OK with \`skipped: true\` (no 500 errors).
This alert will not repeat for 60 minutes unless the missing columns change.
    `.trim();

    const now = new Date();

    // Send email via Resend directly
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn("[SchemaAlert] RESEND_API_KEY not set, skipping email");
      return false;
    }

    const resend = new Resend(resendApiKey);
    const FROM_EMAIL = "LaunchBase <support@getlaunchbase.com>";

    for (const recipient of recipients) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: recipient,
          subject,
          text: body,
        });
      } catch (emailErr) {
        console.error(`[SchemaAlert] Failed to send email to ${recipient}:`, emailErr);
      }
    }

    // Log alert event for dedupe
    await db.insert(alertEvents).values({
      tenant: "launchbase",
      alertKey: "ops:schema_out_of_date",
      fingerprint,
      severity: "warn",
      title: `Schema out of date — ${endpoint}`,
      message: body,
      status: "active",
      firstSeenAt: now,
      lastSeenAt: now,
      sentAt: now,
      meta: { endpoint, schemaKey, missingColumns, buildId, serverTime },
    });

    console.log(`[SchemaAlert] Sent alert for ${endpoint} (missing: ${missingColumns.join(", ")})`);
    return true;
  } catch (err) {
    console.error("[SchemaAlert] Failed to send alert:", err);
    return false;
  }
}
