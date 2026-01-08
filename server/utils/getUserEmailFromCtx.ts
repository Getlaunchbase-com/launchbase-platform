import type { TrpcContext } from "../_core/context";

/**
 * Extract and normalize user email from tRPC context.
 * Single source of truth for email extraction.
 * Fails closed: returns null if email is missing, invalid, or non-string.
 */
export function getUserEmailFromCtx(ctx: TrpcContext): string | null {
  const email = ctx.user?.email;

  if (!email) return null;
  if (typeof email !== "string") return null;

  const normalized = email.trim().toLowerCase();
  return normalized.length ? normalized : null;
}
