/**
 * Email Transport Layer
 * 
 * Deterministic email sending with pluggable transports:
 * - resend: Real delivery via Resend API
 * - log: Console + event only (no actual send)
 * - memory: Store in test array for E2E verification
 * 
 * This is a "textbook SaaS maturity step" that makes tests deterministic
 * and prevents debugging email during feature work.
 */

import { Resend } from "resend";

/**
 * Extract message ID from provider response (handles different provider shapes)
 */
function extractMessageId(resp: unknown): string | undefined {
  if (!resp || typeof resp !== "object") return undefined;

  const r = resp as any;

  // common provider shapes
  if (typeof r.id === "string") return r.id;
  if (typeof r.messageId === "string") return r.messageId;
  if (r.data && typeof r.data.id === "string") return r.data.id;
  if (r.data && typeof r.data.messageId === "string") return r.data.messageId;

  return undefined;
}
import { ENV } from "./_core/env";

/**
 * Email payload (transport-agnostic)
 */
export interface EmailPayload {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  provider: "resend" | "log" | "memory";
  resendMessageId?: string;
  error?: string;
}

/**
 * Memory transport storage (for E2E tests)
 */
let memoryStore: EmailPayload[] = [];

/**
 * Get memory store (for test assertions)
 */
export function getMemoryStore(): EmailPayload[] {
  return memoryStore;
}

/**
 * Clear memory store (for test setup)
 */
export function clearMemoryStore(): void {
  memoryStore = [];
}

/**
 * Send email via configured transport
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const transport = ENV.emailTransport;
  
  console.log(`[EmailTransport] Using transport: ${transport}`);
  console.log(`[EmailTransport] To: ${payload.to}`);
  console.log(`[EmailTransport] Subject: ${payload.subject}`);
  
  switch (transport) {
    case "resend":
      return sendViaResend(payload);
    
    case "log":
      return sendViaLog(payload);
    
    case "memory":
      return sendViaMemory(payload);
    
    default:
      console.error(`[EmailTransport] Unknown transport: ${transport}, falling back to resend`);
      return sendViaResend(payload);
  }
}

/**
 * Resend transport (real delivery)
 */
async function sendViaResend(payload: EmailPayload): Promise<EmailSendResult> {
  if (!ENV.resendApiKey) {
    console.error("[EmailTransport:resend] No RESEND_API_KEY configured");
    return {
      success: false,
      provider: "resend",
      error: "no_resend_api_key",
    };
  }
  
  try {
    const resend = new Resend(ENV.resendApiKey);
    const result = await resend.emails.send({
      from: payload.from,
      to: payload.to,
      replyTo: payload.replyTo,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    
    const messageId = extractMessageId(result);
    console.log("[EmailTransport:resend] ✅ Sent successfully:", messageId);
    
    return {
      success: true,
      provider: "resend",
      resendMessageId: messageId,
    };
  } catch (err: any) {
    const errorMessage = err?.message || err?.error?.message || "Unknown error";
    console.error("[EmailTransport:resend] ❌ Failed:", errorMessage);
    
    return {
      success: false,
      provider: "resend",
      error: errorMessage,
    };
  }
}

/**
 * Log transport (console + event only, no actual send)
 */
async function sendViaLog(payload: EmailPayload): Promise<EmailSendResult> {
  console.log("[EmailTransport:log] 📧 Email logged (not sent):");
  console.log(`  From: ${payload.from}`);
  console.log(`  To: ${payload.to}`);
  console.log(`  Subject: ${payload.subject}`);
  console.log(`  ReplyTo: ${payload.replyTo || "none"}`);
  console.log(`  Text preview: ${payload.text.slice(0, 100)}...`);
  
  // Generate fake message ID for event logging
  const fakeMessageId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    success: true,
    provider: "log",
    resendMessageId: fakeMessageId,
  };
}

/**
 * Memory transport (store in array for E2E tests)
 */
async function sendViaMemory(payload: EmailPayload): Promise<EmailSendResult> {
  console.log("[EmailTransport:memory] 💾 Email stored in memory");
  console.log(`  To: ${payload.to}`);
  console.log(`  Subject: ${payload.subject}`);
  
  memoryStore.push(payload);
  
  // Generate fake message ID for event logging
  const fakeMessageId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    success: true,
    provider: "memory",
    resendMessageId: fakeMessageId,
  };
}
