/**
 * Redaction Utilities for Prompt Secrecy
 * 
 * Ensures no prompt content leaks into logs, errors, or client responses.
 */

import crypto from "crypto";

export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function safePreview(text: string | undefined | null): { len: number; sha: string } {
  const s = text ?? "";
  return { len: s.length, sha: hashText(s) };
}

export function safeError(err: unknown): {
  name?: string;
  message: string;
  code?: string | number;
  status?: number;
} {
  if (err instanceof Error) {
    const anyErr = err as any;
    return {
      name: err.name,
      message: truncate(err.message, 240),
      code: anyErr?.code,
      status: anyErr?.status ?? anyErr?.response?.status,
    };
  }
  return { message: truncate(String(err), 240) };
}

export function toSafeClientMessage(params: { trace?: string; hint?: string }) {
  // Do NOT include provider error details in client-facing messages.
  // Trace is safe (opaque ID).
  const trace = params.trace ? ` trace=${params.trace}` : "";
  const hint = params.hint ? ` (${params.hint})` : "";
  return `AI request failed.${hint}${trace}`;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
