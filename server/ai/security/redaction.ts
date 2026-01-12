/**
 * Redaction Utilities for Prompt Secrecy
 * 
 * Ensures no prompt content leaks into logs, errors, or client responses.
 */

import crypto from "crypto";

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Safe preview with optional max length
 * When maxLen === 0, returns only hash (no preview text)
 */
export function safePreview(text: string | undefined | null, maxLen?: number): { len: number; sha: string } | string {
  const s = text ?? "";
  const hash = hashText(s);
  
  if (maxLen === 0) {
    // Hash-only mode (no preview text)
    return hash;
  }
  
  return { len: s.length, sha: hash };
}

/**
 * Safe error for logging - NO MESSAGE (fingerprint only)
 * 
 * FOREVER CONTRACT: Never log err.message or err.stack directly.
 * They can contain user prompts, canary strings, or sensitive content.
 */
export function safeError(err: unknown): {
  name: string;
  code?: string;
  status?: number;
  fingerprint: string;
  message: string; // Always "[redacted]"
} {
  const e = err as any;

  const name = typeof e?.name === "string" ? e.name : "Error";
  const code = typeof e?.code === "string" ? e.code : undefined;
  const status = typeof e?.status === "number" ? e.status : undefined;

  const stack = typeof e?.stack === "string" ? e.stack : "";
  const message = typeof e?.message === "string" ? e.message : "";

  // Fingerprint lets us correlate errors without logging message/stack
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${name}|${code ?? ""}|${status ?? ""}|${stack}|${message}`)
    .digest("hex")
    .slice(0, 16);

  return {
    name,
    code,
    status,
    fingerprint,
    // Important: never pass message through
    message: "[redacted]",
  };
}

/**
 * Helper for error logging - returns only safe fingerprint metadata
 */
export function toErrorFingerprint(err: unknown): {
  errorName: string;
  errorFingerprint: string;
  errorMessageLength: number;
} {
  const msg = err instanceof Error ? err.message : String(err);
  return {
    errorName: err instanceof Error ? err.name : typeof err,
    errorFingerprint: safePreview(msg, 0) as string,
    errorMessageLength: msg.length,
  };
}

export function toSafeClientMessage(params: { trace?: string; hint?: string }) {
  // Do NOT include provider error details in client-facing messages.
  // Trace is safe (opaque ID).
  const trace = params.trace ? ` trace=${params.trace}` : "";
  const hint = params.hint ? ` (${params.hint})` : "";
  return `AI request failed.${hint}${trace}`;
}
