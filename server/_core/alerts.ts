import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { alertEvents } from "../../drizzle/schema";
import { sendEmail } from "../email";
import type { Tenant } from "./tenant";

const ALERT_RECIPIENT = "vince@vincessnowplow.com";

/**
 * Generate admin health link (full URL if PUBLIC_BASE_URL set, otherwise path-only)
 */
function adminHealthLink(tenant: string): string {
  const path = `/admin/health?tenant=${encodeURIComponent(tenant)}`;
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    process.env.VITE_PUBLIC_BASE_URL ||
    "";

  if (!base) return path;

  // ensure no trailing slash issues
  const clean = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${clean}${path}`;
}

/**
 * Bucket staleness hours into discrete levels to reduce alert noise
 */
function getStaleBucket(hours: number): string {
  if (hours < 6) return "2h";
  if (hours < 12) return "6h";
  if (hours < 24) return "12h";
  return "24h+";
}

/**
 * Health snapshot from admin.health metrics
 */
export type HealthSnapshot = {
  tenant: Tenant | "all";
  emails: {
    failed: number;
    sent: number;
    lastError?: string | null;
  };
  stripeWebhooks: {
    isStale: boolean;
    lastEventAt: Date | string | null;
    failed: number;
    ok: number;
    retryEvents: number;
  };
  deployments: {
    failed: number;
    success: number;
    queued: number;
    running: number;
  };
  system: {
    uptime: number;
  };
};

/**
 * Alert candidate before dedupe/send
 */
type AlertCandidate = {
  alertKey: string;
  fingerprint: string;
  severity: "info" | "warn" | "crit";
  title: string;
  message: string;
  meta: Record<string, unknown>;
};

/**
 * Evaluate health snapshot and return alert candidates
 */
function evaluateHealthAlerts(snapshot: HealthSnapshot): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];
  const link = adminHealthLink(snapshot.tenant);

  // Email failures (warn if ≥3 in last 24h)
  if (snapshot.emails.failed >= 3) {
    const bucket = snapshot.emails.failed >= 10 ? "10plus" : "3plus";
    candidates.push({
      alertKey: "health:email_failures",
      fingerprint: `${snapshot.tenant}|health:email_failures|${bucket}`,
      severity: "warn",
      title: `[${snapshot.tenant}] Email failures detected`,
      message: `Email failures in last 24h: ${snapshot.emails.failed}\nSent: ${snapshot.emails.sent}\nLast error: ${snapshot.emails.lastError ?? "n/a"}\n\nOpen: ${link}`,
      meta: { ...snapshot.emails },
    });
  }

  // Stripe webhooks stale (crit if >2h)
  if (snapshot.stripeWebhooks.isStale) {
    const lastEventAt = snapshot.stripeWebhooks.lastEventAt
      ? new Date(snapshot.stripeWebhooks.lastEventAt)
      : null;
    const staleHours = lastEventAt
      ? (Date.now() - lastEventAt.getTime()) / (1000 * 60 * 60)
      : 999;
    const bucket = getStaleBucket(staleHours);

    candidates.push({
      alertKey: "health:webhooks_stale",
      fingerprint: `${snapshot.tenant}|health:webhooks_stale|${bucket}`,
      severity: "crit",
      title: `[${snapshot.tenant}] Stripe webhooks stale`,
      message: `Stripe webhook staleness detected.\nLast event: ${snapshot.stripeWebhooks.lastEventAt ?? "none"}\nFailed: ${snapshot.stripeWebhooks.failed}, OK: ${snapshot.stripeWebhooks.ok}, Retries: ${snapshot.stripeWebhooks.retryEvents}\n\nOpen: ${link}`,
      meta: { ...snapshot.stripeWebhooks, staleHours },
    });
  }

  // Deployment failures (warn if ≥2 in last 24h)
  if (snapshot.deployments.failed >= 2) {
    const bucket = snapshot.deployments.failed >= 5 ? "5plus" : "2plus";
    candidates.push({
      alertKey: "health:deploy_failures",
      fingerprint: `${snapshot.tenant}|health:deploy_failures|${bucket}`,
      severity: "warn",
      title: `[${snapshot.tenant}] Deployment failures detected`,
      message: `Deployment failures in last 24h: ${snapshot.deployments.failed}\nSuccess: ${snapshot.deployments.success}\nQueued: ${snapshot.deployments.queued}, Running: ${snapshot.deployments.running}\n\nOpen: ${link}`,
      meta: { ...snapshot.deployments },
    });
  }

  return candidates;
}

/**
 * Summary of alert processing run
 */
export type AlertsRunSummary = {
  tenantsProcessed: number;
  created: number;
  sent: number;
  deduped: number;
  resolved: number;
  skippedRateLimit: boolean;
  alerts: Array<{
    tenant: string;
    alertType: string;
    action: "created" | "sent" | "deduped" | "resolved" | "none";
    fingerprint: string;
  }>;
};

/**
 * Process alert candidates: upsert + send if new
 */
export async function processAlerts(snapshot: HealthSnapshot): Promise<AlertsRunSummary> {
  const stats: AlertsRunSummary = {
    tenantsProcessed: 1,
    created: 0,
    sent: 0,
    deduped: 0,
    resolved: 0,
    skippedRateLimit: false,
    alerts: [],
  };
  const db = await getDb();
  if (!db) {
    console.error("[Alerts] Database not available");
    return stats;
  }

  // Skip if tenant is "all" (alerts are per-tenant only)
  if (snapshot.tenant === "all") {
    console.warn("[Alerts] Cannot process alerts for tenant='all', skipping");
    return stats;
  }

  const candidates = evaluateHealthAlerts(snapshot);
  const now = new Date();

  for (const candidate of candidates) {
    try {
      // Check if alert already exists
      const [existing] = await db
        .select()
        .from(alertEvents)
        .where(
          and(
            eq(alertEvents.tenant, snapshot.tenant),
            eq(alertEvents.alertKey, candidate.alertKey),
            eq(alertEvents.fingerprint, candidate.fingerprint)
          )
        )
        .limit(1);

      if (existing) {
        // Update lastSeenAt to prove it's still happening
        await db
          .update(alertEvents)
          .set({
            lastSeenAt: now,
            status: "active",
            resolvedAt: null,
          })
          .where(eq(alertEvents.id, existing.id));

        stats.deduped++;
        stats.alerts.push({
          tenant: snapshot.tenant,
          alertType: candidate.alertKey,
          action: "deduped",
          fingerprint: candidate.fingerprint,
        });

        console.log(
          `[Alerts] Updated existing alert: ${candidate.alertKey} (${candidate.fingerprint})`
        );
      } else {
        // New alert - insert and send email
        const [result] = await db.insert(alertEvents).values({
          tenant: snapshot.tenant,
          alertKey: candidate.alertKey,
          fingerprint: candidate.fingerprint,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          status: "active",
          firstSeenAt: now,
          lastSeenAt: now,
          sentAt: null,
          resolvedAt: null,
          meta: candidate.meta,
        });

        const alertId = Number(result.insertId);
        stats.created++;
        stats.alerts.push({
          tenant: snapshot.tenant,
          alertType: candidate.alertKey,
          action: "created",
          fingerprint: candidate.fingerprint,
        });

        // Send email (hard-locked to vince@vincessnowplow.com)
        try {
          await sendEmail(0, "ops_alert" as any, {
            email: ALERT_RECIPIENT,
            firstName: "Vince",
            businessName: "LaunchBase Ops",
            subject: candidate.title,
            text: candidate.message,
          } as any);

          // Update sentAt on success
          await db
            .update(alertEvents)
            .set({
              sentAt: now,
              deliveryProvider: "resend",
            })
            .where(eq(alertEvents.id, alertId));

          stats.sent++;
          // Update last alert action to "sent"
          const lastAlert = stats.alerts[stats.alerts.length - 1];
          if (lastAlert) lastAlert.action = "sent";

          console.log(
            `[Alerts] Sent new alert: ${candidate.alertKey} (${candidate.fingerprint}) to ${ALERT_RECIPIENT}`
          );
        } catch (emailError) {
          // Log email failure but don't block
          const errorMsg =
            emailError instanceof Error
              ? emailError.message
              : String(emailError);
          await db
            .update(alertEvents)
            .set({ lastError: errorMsg })
            .where(eq(alertEvents.id, alertId));

          console.error(
            `[Alerts] Failed to send email for ${candidate.alertKey}:`,
            errorMsg
          );
        }
      }
    } catch (error) {
      console.error(
        `[Alerts] Error processing candidate ${candidate.alertKey}:`,
        error
      );
    }
  }

  // Resolve alerts that are no longer active
  const activeFingerprints = candidates.map((c) => c.fingerprint);

  if (activeFingerprints.length > 0) {
    // Find all active alerts for this tenant that are NOT in the current candidate list
    const activeAlerts = await db
      .select()
      .from(alertEvents)
      .where(
        and(
          eq(alertEvents.tenant, snapshot.tenant),
          eq(alertEvents.status, "active"),
          isNull(alertEvents.resolvedAt)
        )
      );

    for (const alert of activeAlerts) {
      if (!activeFingerprints.includes(alert.fingerprint)) {
        // This alert is no longer active - resolve it
        await db
          .update(alertEvents)
          .set({
            status: "resolved",
            resolvedAt: now,
          })
          .where(eq(alertEvents.id, alert.id));

        stats.resolved++;
        stats.alerts.push({
          tenant: snapshot.tenant,
          alertType: alert.alertKey,
          action: "resolved",
          fingerprint: alert.fingerprint,
        });

        console.log(
          `[Alerts] Resolved alert: ${alert.alertKey} (${alert.fingerprint})`
        );
      }
    }
  }

  // Limit alerts array to last 10 for readability
  stats.alerts = stats.alerts.slice(-10);
  return stats;
}
