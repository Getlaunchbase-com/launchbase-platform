import crypto from "node:crypto";

/**
 * Generates a unique canary string you can embed into prompts/messages.
 * If this ever appears in logs or API responses, a test should fail.
 */
export function makeCanary(tag: string): string {
  const rand = crypto.randomBytes(8).toString("hex");
  return `CANARY::${tag}::${rand}`;
}

/**
 * Throws if canary is found anywhere in text.
 */
export function assertNoCanary(text: string, canary: string, context?: string) {
  if (!text) return;
  if (text.includes(canary)) {
    const ctx = context ? ` (${context})` : "";
    throw new Error(`Prompt leak detected${ctx}: found canary "${canary}"`);
  }
}

/**
 * Convenience for scanning multiple log lines.
 */
export function assertNoCanaryInLines(lines: string[], canary: string, context?: string) {
  for (const line of lines) assertNoCanary(line, canary, context);
}
