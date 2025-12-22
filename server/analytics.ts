/**
 * LaunchBase Analytics Service
 * Funnel tracking and drop-off detection
 */

import { getDb } from "./db";
import { analyticsEvents } from "../drizzle/schema";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";

// Event types for tracking
export type AnalyticsEventName = 
  // Landing page
  | "page_view_home"
  | "cta_click_start_intake"
  // Onboarding funnel
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "onboarding_abandoned"
  // Build quality
  | "build_plan_generated"
  | "clarification_requested"
  | "build_approved_first_pass"
  | "build_revision_requested"
  | "build_plan_approved"
  // Deployment
  | "site_deployed"
  // Email engagement
  | "email_opened"
  | "preview_link_clicked"
  | "approval_action"
  // Intelligence Layers
  | "intelligence_config_saved"
  | "expand_viewed"
  | "social_toggled"
  | "mode_changed"
  | "depth_changed"
  | "layer_toggled"
  | "sample_week_opened"
  // SMI Stripe events
  | "smi_checkout_started"
  | "smi_checkout_completed"
  | "smi_subscription_activated"
  | "smi_subscription_cancelled"
  | "smi_subscription_reactivated";

interface TrackEventParams {
  eventName: AnalyticsEventName;
  sessionId?: string;
  intakeId?: number;
  vertical?: string;
  stepNumber?: number;
  metadata?: Record<string, unknown>;
}

// Track an analytics event
export async function trackEvent(params: TrackEventParams): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Analytics] Database not available");
      return false;
    }

    await db.insert(analyticsEvents).values({
      eventName: params.eventName,
      sessionId: params.sessionId || null,
      intakeId: params.intakeId || null,
      vertical: params.vertical || null,
      stepNumber: params.stepNumber || null,
      metadata: params.metadata || null,
    });

    console.log(`[Analytics] Tracked: ${params.eventName}`, params);
    return true;
  } catch (error) {
    console.error("[Analytics] Failed to track event:", error);
    return false;
  }
}

// Get funnel metrics for a date range
export async function getFunnelMetrics(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const end = endDate || new Date();

  // Get all events in date range
  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, start),
        lte(analyticsEvents.createdAt, end)
      )
    );

  // Calculate funnel metrics
  const homeViews = events.filter(e => e.eventName === "page_view_home").length;
  const ctaClicks = events.filter(e => e.eventName === "cta_click_start_intake").length;
  const onboardingStarted = events.filter(e => e.eventName === "onboarding_started").length;
  const onboardingCompleted = events.filter(e => e.eventName === "onboarding_completed").length;
  const sitesDeployed = events.filter(e => e.eventName === "site_deployed").length;

  // Calculate step completion rates
  const stepEvents = events.filter(e => 
    e.eventName === "onboarding_step_viewed" || 
    e.eventName === "onboarding_step_completed"
  );

  const stepMetrics: Record<number, { viewed: number; completed: number }> = {};
  for (let i = 1; i <= 8; i++) {
    stepMetrics[i] = {
      viewed: stepEvents.filter(e => e.eventName === "onboarding_step_viewed" && e.stepNumber === i).length,
      completed: stepEvents.filter(e => e.eventName === "onboarding_step_completed" && e.stepNumber === i).length,
    };
  }

  // Calculate drop-off by step
  const abandonedEvents = events.filter(e => e.eventName === "onboarding_abandoned");
  const dropOffByStep: Record<number, number> = {};
  abandonedEvents.forEach(e => {
    const step = e.stepNumber || 0;
    dropOffByStep[step] = (dropOffByStep[step] || 0) + 1;
  });

  return {
    funnel: {
      homeViews,
      ctaClicks,
      ctaClickRate: homeViews > 0 ? Math.round((ctaClicks / homeViews) * 100) : 0,
      onboardingStarted,
      onboardingCompleted,
      completionRate: onboardingStarted > 0 ? Math.round((onboardingCompleted / onboardingStarted) * 100) : 0,
      sitesDeployed,
    },
    stepMetrics,
    dropOffByStep,
    period: { start, end },
  };
}

// Get build quality metrics
export async function getBuildQualityMetrics(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, start),
        lte(analyticsEvents.createdAt, end)
      )
    );

  const buildPlansGenerated = events.filter(e => e.eventName === "build_plan_generated").length;
  const clarificationsRequested = events.filter(e => e.eventName === "clarification_requested").length;
  const firstPassApprovals = events.filter(e => e.eventName === "build_approved_first_pass").length;
  const revisionsRequested = events.filter(e => e.eventName === "build_revision_requested").length;

  return {
    buildPlansGenerated,
    clarificationsRequested,
    clarificationRate: buildPlansGenerated > 0 
      ? Math.round((clarificationsRequested / buildPlansGenerated) * 100) 
      : 0,
    firstPassApprovals,
    firstPassApprovalRate: buildPlansGenerated > 0 
      ? Math.round((firstPassApprovals / buildPlansGenerated) * 100) 
      : 0,
    revisionsRequested,
    period: { start, end },
  };
}

// Get vertical performance metrics
export async function getVerticalMetrics(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, start),
        lte(analyticsEvents.createdAt, end)
      )
    );

  const verticals = ["trades", "appointments", "professional"];
  const metrics: Record<string, {
    intakesCompleted: number;
    sitesDeployed: number;
    conversionRate: number;
  }> = {};

  verticals.forEach(vertical => {
    const completed = events.filter(
      e => e.eventName === "onboarding_completed" && e.vertical === vertical
    ).length;
    const deployed = events.filter(
      e => e.eventName === "site_deployed" && e.vertical === vertical
    ).length;

    metrics[vertical] = {
      intakesCompleted: completed,
      sitesDeployed: deployed,
      conversionRate: completed > 0 ? Math.round((deployed / completed) * 100) : 0,
    };
  });

  return { metrics, period: { start, end } };
}

// Daily health summary
export async function getDailyHealth() {
  const db = await getDb();
  if (!db) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, today),
        lte(analyticsEvents.createdAt, tomorrow)
      )
    );

  return {
    intakesToday: events.filter(e => e.eventName === "onboarding_completed").length,
    sitesDeployedToday: events.filter(e => e.eventName === "site_deployed").length,
    avgConfidenceScore: 85, // Mock for now
    date: today,
  };
}
