/**
 * Resend Inbound Email Webhook
 * 
 * Receives inbound emails from customers replying to action requests.
 * Extracts token, classifies intent, and triggers apply logic.
 * 
 * Webhook URL: POST /api/webhooks/resend/inbound
 * 
 * Token extraction priority:
 * 1. To address: approvals+{token}@getlaunchbase.com
 * 2. Subject tag: [LB:{token}]
 * 3. In-Reply-To header (future)
 */

import type { Request, Response } from "express";
import { getActionRequestByToken, classifyReply, applyActionRequest, confirmAndLockActionRequest } from "./action-requests";
import { sendActionConfirmationEmail } from "./email";
import { notifyOwner } from "./_core/notification";
import { sendAdminNotification } from "./email";
import { getDb } from "./db";
import { actionRequests, intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Extract token from email address or subject
 */
function extractToken(to: string, subject: string): string | null {
  // Priority 1: Extract from to address (approvals+TOKEN@...)
  const toMatch = to.match(/approvals\+([a-z0-9_]+)@/i);
  if (toMatch) {
    return toMatch[1];
  }
  
  // Priority 2: Extract from subject tag ([LB:TOKEN])
  const subjectMatch = subject.match(/\[LB:([a-z0-9_]+)\]/i);
  if (subjectMatch) {
    return subjectMatch[1];
  }
  
  return null;
}

/**
 * Strip quoted replies and email signatures from body
 */
function stripQuotedReplies(body: string): string {
  // Remove everything after common reply markers
  const markers = [
    /^On .+ wrote:$/m,
    /^From: .+$/m,
    /^Sent: .+$/m,
    /^-{3,}/m,
    /^_{3,}/m,
    /^>{1,}/m,
  ];
  
  let cleaned = body;
  for (const marker of markers) {
    const match = cleaned.match(marker);
    if (match && match.index !== undefined) {
      cleaned = cleaned.slice(0, match.index);
    }
  }
  
  // Remove common signatures
  const signatureMarkers = [
    /^--\s*$/m,
    /^Sent from my /m,
    /^Get Outlook for /m,
  ];
  
  for (const marker of signatureMarkers) {
    const match = cleaned.match(marker);
    if (match && match.index !== undefined) {
      cleaned = cleaned.slice(0, match.index);
    }
  }
  
  return cleaned.trim();
}

/**
 * Handle inbound email webhook from Resend
 */
export async function handleResendInbound(req: Request, res: Response) {
  try {
    // Resend webhook payload structure
    const { to, from, subject, text, html } = req.body;
    
    if (!to || !from || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    console.log("[Webhook] Inbound email:", { to, from, subject });
    
    // Extract token
    const token = extractToken(to, subject);
    if (!token) {
      console.warn("[Webhook] No token found in email");
      return res.status(200).json({ message: "No token found, ignoring" });
    }
    
    // Load action request
    const actionRequest = await getActionRequestByToken(token);
    if (!actionRequest) {
      console.warn("[Webhook] Action request not found:", token);
      return res.status(200).json({ message: "Action request not found" });
    }
    
    // Check if already processed
    if (actionRequest.status === "locked") {
      console.log("[Webhook] Action request already locked:", token);
      return res.status(200).json({ message: "Already processed" });
    }
    
    // Strip quoted replies and signatures
    const bodyText = text || html || "";
    const cleanedBody = stripQuotedReplies(bodyText);
    
    if (!cleanedBody || cleanedBody.length < 1) {
      console.warn("[Webhook] Empty body after cleaning");
      return res.status(200).json({ message: "Empty body" });
    }
    
    // Classify the reply
    const classification = classifyReply(cleanedBody, actionRequest.proposedValue);
    
    console.log("[Webhook] Classification:", {
      intent: classification.intent,
      confidence: classification.confidence,
    });
    
    // Update action request with response
    const db = await getDb();
    if (db) {
      await db.update(actionRequests).set({
        status: "responded",
        respondedAt: new Date(),
        replyChannel: "email",
        confidence: classification.confidence,
        rawInbound: {
          from,
          to,
          subject,
          body: cleanedBody,
          classification,
        } as any,
        // Update proposedValue if EDIT_EXACT
        ...(classification.intent === "EDIT_EXACT" && classification.extractedValue
          ? { proposedValue: classification.extractedValue as any }
          : {}),
      }).where(eq(actionRequests.id, actionRequest.id));
    }
    
    // Handle based on intent
    if (classification.intent === "APPROVE") {
      // High confidence approval - apply immediately
      const result = await applyActionRequest(actionRequest.id);
      
      if (result.success) {
        // Load intake for confirmation email
        const [intake] = await db!.select().from(intakes).where(eq(intakes.id, actionRequest.intakeId)).limit(1);
        
        if (intake) {
          await sendActionConfirmationEmail({
            to: intake.email,
            businessName: intake.businessName,
            firstName: intake.contactName.split(" ")[0],
            checklistKey: actionRequest.checklistKey,
            appliedValue: JSON.stringify(actionRequest.proposedValue),
            previewUrl: (intake as any).previewUrl,
          });
        }
        
        await confirmAndLockActionRequest(actionRequest.id);
        
        return res.status(200).json({ message: "Approved and applied" });
      } else if (result.needsHuman) {
        await escalateToHuman(actionRequest, classification, "Needs human review");
        return res.status(200).json({ message: "Escalated to human" });
      } else {
        return res.status(200).json({ message: "Failed to apply", error: result.error });
      }
    } else if (classification.intent === "EDIT_EXACT") {
      // Concrete edit provided - apply if confidence is high enough
      const result = await applyActionRequest(actionRequest.id);
      
      if (result.success) {
        const [intake] = await db!.select().from(intakes).where(eq(intakes.id, actionRequest.intakeId)).limit(1);
        
        if (intake) {
          await sendActionConfirmationEmail({
            to: intake.email,
            businessName: intake.businessName,
            firstName: intake.contactName.split(" ")[0],
            checklistKey: actionRequest.checklistKey,
            appliedValue: JSON.stringify(classification.extractedValue),
            previewUrl: (intake as any).previewUrl,
          });
        }
        
        await confirmAndLockActionRequest(actionRequest.id);
        
        return res.status(200).json({ message: "Edit applied" });
      } else if (result.needsConfirmation) {
        // Medium confidence - send two-step confirmation
        // TODO: Implement sendTwoStepConfirmationEmail()
        await escalateToHuman(actionRequest, classification, "Needs two-step confirmation");
        return res.status(200).json({ message: "Needs confirmation" });
      } else if (result.needsHuman) {
        await escalateToHuman(actionRequest, classification, "Needs human review");
        return res.status(200).json({ message: "Escalated to human" });
      } else {
        return res.status(200).json({ message: "Failed to apply", error: result.error });
      }
    } else if (classification.intent === "REJECT") {
      // Customer rejected without providing alternative
      await escalateToHuman(actionRequest, classification, "Customer rejected without alternative");
      return res.status(200).json({ message: "Escalated to human" });
    } else if (classification.intent === "EDIT_AMBIGUOUS") {
      // Unclear edit request
      await escalateToHuman(actionRequest, classification, "Ambiguous edit request");
      return res.status(200).json({ message: "Escalated to human" });
    } else if (classification.intent === "NEW_REQUEST") {
      // Scope change
      await escalateToHuman(actionRequest, classification, "Scope change / new request");
      return res.status(200).json({ message: "Escalated to human" });
    }
    
    return res.status(200).json({ message: "Processed" });
  } catch (err) {
    console.error("[Webhook] Error processing inbound email:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Escalate action request to human review
 */
async function escalateToHuman(
  actionRequest: any,
  classification: { intent: string; confidence: number; extractedValue?: unknown },
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Mark as needs_human
  await db.update(actionRequests).set({
    status: "needs_human",
  }).where(eq(actionRequests.id, actionRequest.id));
  
  // Load intake for context
  const [intake] = await db.select().from(intakes).where(eq(intakes.id, actionRequest.intakeId)).limit(1);
  
  // Send admin notification
  await notifyOwner({
    title: `Action Request Needs Review: ${actionRequest.checklistKey}`,
    content: `Reason: ${reason}\n\nCustomer: ${intake?.businessName} (${intake?.email})\nChecklist Key: ${actionRequest.checklistKey}\nProposed Value: ${JSON.stringify(actionRequest.proposedValue)}\n\nReply Classification:\n- Intent: ${classification.intent}\n- Confidence: ${classification.confidence}\n- Extracted Value: ${JSON.stringify(classification.extractedValue)}\n\nRaw Inbound: ${JSON.stringify(actionRequest.rawInbound, null, 2)}\n\nAction: Review in admin panel and manually apply or reject.`
  });
}
