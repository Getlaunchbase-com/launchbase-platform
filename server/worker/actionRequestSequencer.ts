/**
 * Action Request Sequencer - Day 0-3 Message Flow
 * 
 * Automatically creates and sends action requests for paid intakes
 * following the "first 10 questions" sequence from docs/bot-messages-day0-3.md
 * 
 * Cron endpoint: POST /api/cron/action-requests
 * Runs every 15 minutes
 * 
 * Sequencing rules:
 * - Only send next question when prior one is locked/expired/needs_human
 * - Never re-ask locked items
 * - Respect timing delays between messages
 */

import { getDb } from "../db";
import { actionRequests, intakes } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createActionRequest } from "../action-requests";
import { sendActionRequestEmail } from "../email";

/**
 * Day 0-3 message sequence definition
 * Based on docs/bot-messages-day0-3.md
 */
const DAY0_SEQUENCE = [
  {
    id: 1,
    checklistKey: "homepage.headline",
    messageType: "DAY0_HEADLINE",
    questionText: "Approve your homepage headline",
    delayMinutes: 120, // 2 hours after payment
    generateProposedValue: (intake: any) => {
      return `${intake.businessName} - Trusted ${intake.primaryTrade || "Service"} in ${intake.serviceArea?.[0] || "Your Area"}`;
    },
  },
  {
    id: 2,
    checklistKey: "homepage.subheadline",
    messageType: "DAY0_SUBHEADLINE",
    questionText: "Approve your homepage description",
    delayMinutes: 60, // 1 hour after previous
    generateProposedValue: (intake: any) => {
      return `Licensed, insured, and trusted for ${intake.vertical || "professional"} services across ${intake.serviceArea?.[0] || "your area"}.`;
    },
  },
  {
    id: 3,
    checklistKey: "cta.primary",
    messageType: "DAY0_CTA",
    questionText: "How should customers contact you?",
    delayMinutes: 60,
    generateProposedValue: (intake: any) => {
      return intake.bookingLink ? "Book Online" : "Call Now";
    },
  },
  {
    id: 4,
    checklistKey: "homepage.services",
    messageType: "DAY0_SERVICES",
    questionText: "Confirm your listed services",
    delayMinutes: 60,
    generateProposedValue: (intake: any) => {
      return intake.services || ["General Services", "Consultations", "Custom Projects"];
    },
  },
  {
    id: 5,
    checklistKey: "gmb.category",
    messageType: "DAY0_GMB_CATEGORY",
    questionText: "Google Business category approval",
    delayMinutes: 60,
    generateProposedValue: (intake: any) => {
      // Map vertical to Google Business category
      const categoryMap: Record<string, string> = {
        trades: "General Contractor",
        appointments: "Professional Services",
        professional: "Business Consultant",
      };
      return categoryMap[intake.vertical] || "Business Services";
    },
  },
];

/**
 * Check if an intake is ready for the next action request
 */
async function getNextActionForIntake(intakeId: number): Promise<typeof DAY0_SEQUENCE[0] | null> {
  const db = await getDb();
  if (!db) return null;

  // Get all action requests for this intake
  const requests = await db
    .select()
    .from(actionRequests)
    .where(eq(actionRequests.intakeId, intakeId))
    .orderBy(actionRequests.createdAt);

  // Build a map of checklistKey -> status
  const statusMap = new Map<string, string>();
  for (const req of requests) {
    statusMap.set(req.checklistKey, req.status);
  }

  // Find the first action in sequence that hasn't been locked
  for (const action of DAY0_SEQUENCE) {
    const status = statusMap.get(action.checklistKey);
    
    if (!status) {
      // Not started yet - check if previous action is complete
      if (action.id === 1) {
        // First action - always ready
        return action;
      } else {
        // Check if previous action is locked
        const prevAction = DAY0_SEQUENCE[action.id - 2];
        const prevStatus = statusMap.get(prevAction.checklistKey);
        if (prevStatus === "locked" || prevStatus === "expired" || prevStatus === "needs_human") {
          return action;
        }
      }
    } else if (status === "pending" || status === "sent") {
      // Already created but not yet responded - don't create another
      return null;
    }
    // If locked/expired/needs_human, continue to next action
  }

  // All actions complete
  return null;
}

/**
 * Process a single intake for action request sequencing
 */
async function processIntake(intake: any): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get next action for this intake
  const nextAction = await getNextActionForIntake(intake.id);
  if (!nextAction) {
    // No action needed
    return;
  }

  // Check timing: has enough time passed since payment or last action?
  const requests = await db
    .select()
    .from(actionRequests)
    .where(eq(actionRequests.intakeId, intake.id))
    .orderBy(actionRequests.createdAt);

  let referenceTime: Date;
  if (requests.length === 0) {
    // First action - use payment time (createdAt on intake)
    referenceTime = intake.createdAt;
  } else {
    // Use last action's createdAt
    referenceTime = requests[requests.length - 1].createdAt;
  }

  const minutesSinceReference = (Date.now() - referenceTime.getTime()) / 1000 / 60;
  if (minutesSinceReference < nextAction.delayMinutes) {
    // Not enough time has passed
    console.log(`[Sequencer] Intake ${intake.id}: waiting ${nextAction.delayMinutes - minutesSinceReference} more minutes`);
    return;
  }

  // Create the action request
  const proposedValue = nextAction.generateProposedValue(intake);
  
  const actionRequest = await createActionRequest({
    tenant: intake.tenant,
    intakeId: intake.id,
    checklistKey: nextAction.checklistKey,
    proposedValue,
    messageType: nextAction.messageType,
  });

  if (!actionRequest) {
    console.error(`[Sequencer] Failed to create action request for intake ${intake.id}`);
    return;
  }

  // Send the email
  const result = await sendActionRequestEmail({
    to: intake.email,
    businessName: intake.businessName,
    firstName: intake.contactName.split(" ")[0],
    questionText: nextAction.questionText,
    proposedValue: typeof proposedValue === "string" ? proposedValue : JSON.stringify(proposedValue),
    token: actionRequest.token,
    checklistKey: nextAction.checklistKey,
    proposedPreviewToken: actionRequest.proposedPreviewToken || undefined,
  });

  if (result.success && result.provider === "resend") {
    // Mark as sent ONLY if real email was delivered via Resend
    await db.update(actionRequests).set({
      status: "sent",
      sentAt: new Date(),
      sendCount: actionRequest.sendCount + 1,
      lastSentAt: new Date(),
    }).where(eq(actionRequests.id, actionRequest.id));
    
    // Log event with Resend message ID for traceability
    const { logActionEvent } = await import("../action-request-events");
    await logActionEvent({
      actionRequestId: actionRequest.id,
      intakeId: intake.id,
      eventType: "SENT",
      actorType: "system",
      meta: { 
        messageType: nextAction.messageType, 
        provider: "resend",
        resendMessageId: result.resendMessageId,
        to: intake.email,
        subject: `Approve: ${nextAction.questionText}`,
      },
    });
    
    console.log(`[Sequencer] ✅ Sent ${nextAction.messageType} to ${intake.email} via Resend`);
  } else {
    // Send failed - keep status as pending and log failure
    const { logActionEvent } = await import("../action-request-events");
    await logActionEvent({
      actionRequestId: actionRequest.id,
      intakeId: intake.id,
      eventType: "SEND_FAILED",
      actorType: "system",
      reason: result.error || "unknown",
      meta: { messageType: nextAction.messageType, provider: result.provider },
    });
    
    console.error(`[Sequencer] ❌ Failed to send email to ${intake.email}:`, result.error);
  }
}

/**
 * Main cron handler
 */
export async function handleActionRequestSequencer(): Promise<{
  success: boolean;
  processed: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, processed: 0, errors: 1 };
  }

  console.log("[Sequencer] Starting action request sequencer...");

  // Find all paid intakes that might need action requests
  const paidIntakes = await db
    .select()
    .from(intakes)
    .where(
      and(
        inArray(intakes.status, ["paid", "deployed"]),
        // Only process intakes created in last 7 days (Day 0-3 sequence)
        // TODO: Add createdAt filter
      )
    );

  console.log(`[Sequencer] Found ${paidIntakes.length} paid intakes`);

  let processed = 0;
  let errors = 0;

  for (const intake of paidIntakes) {
    try {
      await processIntake(intake);
      processed++;
    } catch (err) {
      console.error(`[Sequencer] Error processing intake ${intake.id}:`, err);
      errors++;
    }
  }

  console.log(`[Sequencer] Complete: ${processed} processed, ${errors} errors`);

  return { success: true, processed, errors };
}
