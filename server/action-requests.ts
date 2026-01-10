/**
 * Action Requests - Ask → Understand → Apply → Confirm automation
 * 
 * This module implements the core "async refinement loop" that allows
 * LaunchBase to ask customers questions, understand their replies,
 * apply changes safely, and confirm what was done.
 * 
 * Safety policy: See docs/bot-messages-day0-3.md for full specification
 */

import { getDb } from "./db";
import { actionRequests, intakes, type ActionRequest, type InsertActionRequest } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * Intent classification for customer replies
 */
export type ReplyIntent = 
  | "APPROVE"           // Accepting exactly what we proposed
  | "REJECT"            // Says "no" without replacement
  | "EDIT_EXACT"        // Concrete replacement value provided
  | "EDIT_AMBIGUOUS"    // Change requested but underspecified
  | "NEW_REQUEST";      // Scope change / out of bounds

/**
 * Checklist key categories for safety rules
 */
type ChecklistCategory = 
  | "content"           // Headlines, copy, taglines
  | "contact"           // Phone, email, booking link, CTA
  | "profile"           // Audience, category
  | "medium_risk"       // Hours, service area, GMB category, branding
  | "restricted";       // Billing, DNS, legal, integrations

/**
 * Safety policy: what can auto-apply vs must escalate
 */
const CHECKLIST_KEY_RULES: Record<string, { category: ChecklistCategory; autoApplyThreshold: number }> = {
  // Content (auto-apply at 0.85+)
  "homepage.headline": { category: "content", autoApplyThreshold: 0.85 },
  "homepage.subheadline": { category: "content", autoApplyThreshold: 0.85 },
  "homepage.tagline": { category: "content", autoApplyThreshold: 0.85 },
  "homepage.services": { category: "content", autoApplyThreshold: 0.85 },
  "homepage.about": { category: "content", autoApplyThreshold: 0.85 },
  
  // Contact (auto-apply at 0.85+)
  "contact.phone": { category: "contact", autoApplyThreshold: 0.85 },
  "contact.email": { category: "contact", autoApplyThreshold: 0.85 },
  "contact.booking_link": { category: "contact", autoApplyThreshold: 0.85 },
  "cta.primary": { category: "contact", autoApplyThreshold: 0.85 },
  
  // Profile (auto-apply at 0.85+)
  "profile.audience": { category: "profile", autoApplyThreshold: 0.85 },
  "profile.category": { category: "profile", autoApplyThreshold: 0.85 },
  
  // Medium risk (two-step confirmation at 0.70-0.84)
  "hours.schedule": { category: "medium_risk", autoApplyThreshold: 0.85 },
  "service_area.zips": { category: "medium_risk", autoApplyThreshold: 0.85 },
  "gmb.category": { category: "medium_risk", autoApplyThreshold: 0.85 },
  "branding.logo": { category: "medium_risk", autoApplyThreshold: 0.85 },
  "branding.colors": { category: "medium_risk", autoApplyThreshold: 0.85 },
  
  // Restricted (always escalate)
  "billing.*": { category: "restricted", autoApplyThreshold: 1.0 },
  "dns.*": { category: "restricted", autoApplyThreshold: 1.0 },
  "legal.*": { category: "restricted", autoApplyThreshold: 1.0 },
  "integrations.*": { category: "restricted", autoApplyThreshold: 1.0 },
};

/**
 * Generate a unique token for action request
 */
function generateToken(): string {
  return `action_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Create a new action request
 */
export async function createActionRequest(data: {
  tenant: "launchbase" | "vinces";
  intakeId: number;
  checklistKey: string;
  proposedValue: unknown;
  messageType?: string;
}): Promise<ActionRequest | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[ActionRequests] Cannot create: database not available");
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const values: InsertActionRequest = {
    tenant: data.tenant,
    intakeId: data.intakeId,
    checklistKey: data.checklistKey,
    proposedValue: data.proposedValue as any,
    status: "pending",
    token,
    messageType: data.messageType,
    expiresAt,
  };

  const result = await db.insert(actionRequests).values(values);
  const insertId = result[0].insertId;

  return { id: insertId, ...values, createdAt: new Date(), sentAt: null, respondedAt: null, appliedAt: null, replyChannel: null, confidence: null, rawInbound: null } as ActionRequest;
}

/**
 * Get action request by token
 */
export async function getActionRequestByToken(token: string): Promise<ActionRequest | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[ActionRequests] Cannot get: database not available");
    return null;
  }

  const result = await db.select().from(actionRequests).where(eq(actionRequests.token, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Check if a checklist key is already locked for an intake
 */
export async function isChecklistKeyLocked(tenant: string, intakeId: number, checklistKey: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(actionRequests)
    .where(
      and(
        eq(actionRequests.tenant, tenant as any),
        eq(actionRequests.intakeId, intakeId),
        eq(actionRequests.checklistKey, checklistKey),
        eq(actionRequests.status, "locked")
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Classify reply intent and compute confidence score
 */
export function classifyReply(replyText: string, proposedValue: unknown): {
  intent: ReplyIntent;
  confidence: number;
  extractedValue?: unknown;
} {
  const text = replyText.toLowerCase().trim();
  
  // APPROVE: explicit approval keywords
  const approvalKeywords = ["yes", "y", "approve", "approved", "looks good", "ok", "okay", "perfect", "great", "good"];
  if (approvalKeywords.some(kw => text === kw || text.startsWith(kw + " ") || text.endsWith(" " + kw))) {
    return { intent: "APPROVE", confidence: 0.95 };
  }
  
  // REJECT: explicit rejection without replacement
  const rejectKeywords = ["no", "n", "nope", "reject", "rejected", "wrong", "incorrect", "bad"];
  if (rejectKeywords.some(kw => text === kw || text.startsWith(kw + " ") || text.endsWith(" " + kw))) {
    return { intent: "REJECT", confidence: 0.90 };
  }
  
  // NEW_REQUEST: scope expansion signals
  if (text.includes("also") || text.includes("add") || text.includes("new page") || text.includes("redesign") || text.includes("change everything")) {
    return { intent: "NEW_REQUEST", confidence: 0.85 };
  }
  
  // EDIT_AMBIGUOUS: vague change requests
  const ambiguousKeywords = ["better", "more professional", "fix", "improve", "nicer", "maybe", "kinda", "sorta", "I think"];
  if (ambiguousKeywords.some(kw => text.includes(kw))) {
    return { intent: "EDIT_AMBIGUOUS", confidence: 0.60 };
  }
  
  // EDIT_EXACT: contains concrete value
  if (text.length > 5 && text.length < 500) {
    // Check for concrete signals: phone numbers, URLs, specific text
    const hasPhone = /\d{3}[-.]?\d{3}[-.]?\d{4}/.test(text);
    const hasUrl = /https?:\/\//.test(text);
    const hasEmail = /@/.test(text);
    const hasQuotes = text.includes('"') || text.includes("'");
    
    if (hasPhone || hasUrl || hasEmail || hasQuotes) {
      return { intent: "EDIT_EXACT", confidence: 0.90, extractedValue: replyText.trim() };
    }
    
    // Otherwise assume it's an exact replacement
    return { intent: "EDIT_EXACT", confidence: 0.75, extractedValue: replyText.trim() };
  }
  
  // Too short or too long - unclear
  return { intent: "EDIT_AMBIGUOUS", confidence: 0.40 };
}

/**
 * Apply an action request (core logic)
 * 
 * Safety rules:
 * 1. Never apply if confidence below threshold
 * 2. Never apply if checklistKey is already locked
 * 3. Never apply restricted categories
 * 4. Store previous value for reversibility
 */
export async function applyActionRequest(actionRequestId: number): Promise<{
  success: boolean;
  error?: string;
  needsConfirmation?: boolean;
  needsHuman?: boolean;
}> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Load action request
  const [actionRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, actionRequestId)).limit(1);
  if (!actionRequest) {
    return { success: false, error: "Action request not found" };
  }

  // Check if already applied or locked
  if (actionRequest.status === "applied" || actionRequest.status === "locked") {
    return { success: false, error: "Already applied" };
  }

  // Check if checklistKey is locked
  const isLocked = await isChecklistKeyLocked(actionRequest.tenant, actionRequest.intakeId, actionRequest.checklistKey);
  if (isLocked) {
    return { success: false, error: "Checklist key is locked", needsHuman: true };
  }

  // Get safety rules for this checklistKey
  const rules = CHECKLIST_KEY_RULES[actionRequest.checklistKey] || { category: "content", autoApplyThreshold: 0.85 };
  
  // Check confidence threshold
  const confidence = actionRequest.confidence || 0;
  if (confidence < rules.autoApplyThreshold) {
    // Medium risk: needs two-step confirmation
    if (rules.category === "medium_risk" && confidence >= 0.70) {
      return { success: false, needsConfirmation: true };
    }
    // Low confidence: escalate to human
    return { success: false, needsHuman: true };
  }

  // Restricted categories always escalate
  if (rules.category === "restricted") {
    return { success: false, needsHuman: true };
  }

  // Load intake
  const [intake] = await db.select().from(intakes).where(eq(intakes.id, actionRequest.intakeId)).limit(1);
  if (!intake) {
    return { success: false, error: "Intake not found" };
  }

  // Apply the change based on checklistKey
  const previousValue = await applyChecklistKeyChange(intake, actionRequest.checklistKey, actionRequest.proposedValue);
  
  // Mark as applied
  await db.update(actionRequests).set({
    status: "applied",
    appliedAt: new Date(),
  }).where(eq(actionRequests.id, actionRequestId));

  // Log APPLIED event
  const { logActionEvent } = await import("./action-request-events");
  await logActionEvent({
    actionRequestId: actionRequest.id,
    intakeId: actionRequest.intakeId,
    eventType: "APPLIED",
    actorType: "system",
    meta: {
      checklistKey: actionRequest.checklistKey,
      appliedValue: actionRequest.proposedValue,
      previousValue,
    },
  });

  return { success: true };
}

/**
 * Apply a specific checklist key change to an intake
 * Returns the previous value for reversibility
 */
async function applyChecklistKeyChange(intake: any, checklistKey: string, proposedValue: unknown): Promise<unknown> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let previousValue: unknown = null;
  let updateData: Partial<typeof intakes.$inferInsert> = {};

  // Switch on checklistKey to determine what to update
  switch (checklistKey) {
    case "homepage.headline":
      previousValue = intake.businessName; // Headline is derived from businessName
      updateData.businessName = proposedValue as string;
      break;
      
    case "homepage.tagline":
      previousValue = intake.tagline;
      updateData.tagline = proposedValue as string;
      break;
      
    case "homepage.services":
      previousValue = intake.services;
      updateData.services = proposedValue as any;
      break;
      
    case "contact.phone":
      previousValue = intake.phone;
      updateData.phone = proposedValue as string;
      break;
      
    case "contact.email":
      previousValue = intake.email;
      updateData.email = proposedValue as string;
      break;
      
    case "contact.booking_link":
      previousValue = intake.bookingLink;
      updateData.bookingLink = proposedValue as string;
      break;
      
    case "cta.primary":
      previousValue = intake.primaryCTA;
      updateData.primaryCTA = proposedValue as string;
      break;
      
    case "service_area.zips":
      previousValue = intake.serviceArea;
      updateData.serviceArea = proposedValue as any;
      break;
      
    default:
      console.warn(`[ActionRequests] Unknown checklistKey: ${checklistKey}`);
      return null;
  }

  // Apply the update
  if (Object.keys(updateData).length > 0) {
    await db.update(intakes).set(updateData).where(eq(intakes.id, intake.id));
  }

  return previousValue;
}

/**
 * Mark action request as confirmed and locked
 */
export async function confirmAndLockActionRequest(actionRequestId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Load action request for event logging
  const [actionRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, actionRequestId)).limit(1);
  if (!actionRequest) return;

  await db.update(actionRequests).set({
    status: "locked",
  }).where(eq(actionRequests.id, actionRequestId));
  
  // Log LOCKED event
  const { logActionEvent } = await import("./action-request-events");
  await logActionEvent({
    actionRequestId: actionRequest.id,
    intakeId: actionRequest.intakeId,
    eventType: "LOCKED",
    actorType: "system",
    reason: "Action request confirmed and locked",
  });
}
