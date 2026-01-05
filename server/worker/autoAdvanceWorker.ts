/**
 * Auto-Advance Worker
 * Version: 1.0.1 - Token auth fix 2024-12-24
 * 
 * LaunchBase Rule:
 * We prepare first.
 * We automate second.
 * We always show our work.
 * 
 * Ensures no customer can ever get stuck after submitting onboarding.
 * If no admin action occurs within AUTO_ADVANCE_DELAY_MINUTES,
 * the system advances the flow safely and visibly.
 * 
 * Safety Rules (Non-Negotiable):
 * - Auto-advance never skips preview
 * - Auto-advance never deploys
 * - Auto-advance never charges
 * - Customer approval is always required
 * - Admin can still intervene at any point
 */

import { Request, Response } from "express";
import { getDb } from "../db";
import { suiteApplications, intakes, buildPlans, decisionLogs } from "../../drizzle/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// Worker secret token - MUST be set in environment for production
const WORKER_TOKEN = process.env.WORKER_TOKEN;

// Auto-advance delay in minutes (default: 5 minutes)
const AUTO_ADVANCE_DELAY_MINUTES = parseInt(process.env.AUTO_ADVANCE_DELAY_MINUTES || "5", 10);

/**
 * Verify worker request has valid secret token
 */
function verifyWorkerToken(req: Request): boolean {
  if (!WORKER_TOKEN) {
    console.error("[AutoAdvance] WORKER_TOKEN not configured - rejecting all requests");
    return false;
  }
  const token = req.headers["x-worker-token"] || req.headers["authorization"]?.replace("Bearer ", "");
  return token === WORKER_TOKEN;
}

/**
 * Generate a preview token for customer access
 */
function generatePreviewToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `preview_${timestamp}_${random}`;
}

/**
 * Handle auto-advance worker request
 * Called by: POST /api/cron/auto-advance
 */
export async function handleAutoAdvanceWorker(req: Request, res: Response) {
  const startTime = Date.now();
  
  // Verify token
  if (!verifyWorkerToken(req)) {
    console.error("[AutoAdvance] Unauthorized request - invalid token");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) {
    console.error("[AutoAdvance] Database not available");
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    // Find suite applications that need auto-advancing
    // Condition: status = "submitted" AND intake_id IS NULL AND created_at < now() - delay
    const cutoffTime = new Date(Date.now() - AUTO_ADVANCE_DELAY_MINUTES * 60 * 1000);
    
    const stuckApplications = await db
      .select()
      .from(suiteApplications)
      .where(
        and(
          eq(suiteApplications.status, "submitted"),
          isNull(suiteApplications.intakeId),
          lt(suiteApplications.createdAt, cutoffTime)
        )
      );

    if (stuckApplications.length === 0) {
      console.log("[AutoAdvance] No stuck applications found");
      return res.json({
        success: true,
        message: "No applications need auto-advancing",
        processed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`[AutoAdvance] Found ${stuckApplications.length} stuck applications to auto-advance`);

    const results: Array<{
      applicationId: number;
      intakeId: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const app of stuckApplications) {
      try {
        // 1. Create Intake
        const previewToken = generatePreviewToken();
        
        // Map vertical to intake vertical type
        const verticalMap: Record<string, "trades" | "appointments" | "professional"> = {
          trades: "trades",
          health: "appointments",
          beauty: "appointments",
          food: "professional",
          cannabis: "professional",
          professional: "professional",
          fitness: "appointments",
          automotive: "trades",
        };
        const intakeVertical = verticalMap[app.vertical] || "professional";

        const [newIntake] = await db.insert(intakes).values({
          businessName: app.industry || app.businessType || "Unnamed Business",
          contactName: app.contactName,
          email: app.contactEmail,
          phone: app.contactPhone,
          vertical: intakeVertical,
          services: null, // Will be populated from build plan
          serviceArea: app.cityZip ? [app.cityZip] : null,
          primaryCTA: "Call Now",
          status: "ready_for_review", // Ready for customer preview
          previewToken,
          rawPayload: {
            source: "suite_application",
            autoAdvanced: true,
            autoAdvancedAt: new Date().toISOString(),
            originalApplicationId: app.id,
          },
        }).$returningId();

        // 2. Update suite application with intake reference
        await db
          .update(suiteApplications)
          .set({
            status: "approved",
            intakeId: newIntake.id,
            adminNotes: `Auto-advanced by system after ${AUTO_ADVANCE_DELAY_MINUTES} minutes of no admin action`,
          })
          .where(eq(suiteApplications.id, app.id));

        // 3. Generate basic build plan
        await db.insert(buildPlans).values({
          intakeId: newIntake.id,
          templateId: app.vertical === "trades" ? "trades-v1" : "professional-v1",
          plan: {
            pages: [
              { id: "home", title: "Home", slug: "/", sections: [] },
              { id: "services", title: "Services", slug: "/services", sections: [] },
              { id: "contact", title: "Contact", slug: "/contact", sections: [] },
            ],
            brand: {
              primaryColor: "#FF6B35",
              secondaryColor: "#1A1A2E",
              fontFamily: "Inter",
            },
            copy: {
              heroHeadline: `Welcome to ${app.industry || app.businessType || "Your Business"}`,
              heroSubheadline: "Professional services you can trust",
              ctaText: "Get Started",
            },
            features: ["responsive", "seo", "contact-form"],
          },
          status: "ready",
        });

        // 4. Log the decision
        // Note: We're using a simplified log since we don't have userId for auto-advance
        console.log(`[AutoAdvance] Created intake ${newIntake.id} for application ${app.id}`);

        // 5. Notify owner
        await notifyOwner({
          title: "Auto-Advanced Application",
          content: `Application from ${app.contactName} (${app.contactEmail}) was auto-advanced after ${AUTO_ADVANCE_DELAY_MINUTES} minutes. Intake #${newIntake.id} created with preview ready.`,
        });

        results.push({
          applicationId: app.id,
          intakeId: newIntake.id,
          success: true,
        });

        // Note: Preview email would be sent here if email service is configured
        // For now, the preview is ready and admin is notified
        console.log(`[AutoAdvance] Preview URL: /preview/${previewToken}`);

      } catch (err) {
        console.error(`[AutoAdvance] Failed to process application ${app.id}:`, err);
        results.push({
          applicationId: app.id,
          intakeId: 0,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[AutoAdvance] Completed: ${successCount} succeeded, ${failCount} failed`);

    return res.json({
      success: true,
      message: `Auto-advanced ${successCount} applications`,
      processed: successCount,
      failed: failCount,
      results,
      durationMs: Date.now() - startTime,
    });

  } catch (err) {
    console.error("[AutoAdvance] Worker error:", err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
  }
}

/**
 * Get auto-advance status for observability
 */
export async function getAutoAdvanceStatus() {
  const db = await getDb();
  if (!db) return null;

  try {
    // Count stuck applications
    const cutoffTime = new Date(Date.now() - AUTO_ADVANCE_DELAY_MINUTES * 60 * 1000);
    
    const [stuckCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(suiteApplications)
      .where(
        and(
          eq(suiteApplications.status, "submitted"),
          isNull(suiteApplications.intakeId),
          lt(suiteApplications.createdAt, cutoffTime)
        )
      );

    // Count pending (not yet past delay)
    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(suiteApplications)
      .where(
        and(
          eq(suiteApplications.status, "submitted"),
          isNull(suiteApplications.intakeId)
        )
      );

    return {
      delayMinutes: AUTO_ADVANCE_DELAY_MINUTES,
      stuckApplications: stuckCount?.count || 0,
      pendingApplications: pendingCount?.count || 0,
    };
  } catch (err) {
    console.error("[AutoAdvance] Failed to get status:", err);
    return null;
  }
}
