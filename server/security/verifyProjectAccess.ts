/**
 * Project Access Verification
 *
 * Enforces tenant-scoped, role-based access control for project resources.
 * Each resource (intake, deployment, build plan, etc.) belongs to a tenant.
 * Users can only access resources within their authorized tenant scope.
 *
 * ⚠️  IMPORTANT — Production Reminder:
 *     The staging escape hatch (ALLOW_STAGING_BYPASS) MUST be removed
 *     before production deployment. It is the only remaining soft spot
 *     in the access enforcement layer.
 */

import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tenant = "launchbase" | "vinces";
export type Role = "user" | "admin";

export interface AccessContext {
  /** Authenticated user (null = anonymous) */
  user: { id: number; role: Role; openId: string } | null;
  /** Resolved tenant (from session, request, or resource) */
  tenant?: Tenant;
}

export interface ResourceDescriptor {
  /** Resource type, e.g. "intake", "deployment", "buildPlan" */
  type: string;
  /** Resource ID */
  id: number | string;
  /** Owning tenant of the resource */
  tenant: Tenant;
  /** Owner user ID (if applicable) */
  ownerId?: number;
}

export interface AccessResult {
  granted: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * ⚠️  STAGING ESCAPE HATCH — Remove before production.
 *
 * When true, unauthenticated users are allowed through access checks.
 * This exists solely for staging/dev environments where auth may not
 * be fully configured.
 *
 * Set via environment variable: ALLOW_STAGING_BYPASS=true
 */
const ALLOW_STAGING_BYPASS =
  process.env.ALLOW_STAGING_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

/**
 * Verify that the current actor has access to the given resource.
 *
 * Rules:
 *   1. Admins can access any resource within any tenant.
 *   2. Authenticated users can access resources within their own tenant
 *      where they are the owner (ownerId matches).
 *   3. Anonymous users are denied unless staging bypass is active.
 *   4. Tenant mismatch is always denied (no cross-tenant access).
 *
 * Throws TRPCError on denial.
 */
export function verifyProjectAccess(
  ctx: AccessContext,
  resource: ResourceDescriptor
): AccessResult {
  // ---- Staging bypass (remove before production) ----
  if (ALLOW_STAGING_BYPASS && !ctx.user) {
    return {
      granted: true,
      reason: "staging_bypass",
    };
  }

  // ---- Anonymous denial ----
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required to access this resource.",
    });
  }

  // ---- Admin: full access ----
  if (ctx.user.role === "admin") {
    return {
      granted: true,
      reason: "admin_role",
    };
  }

  // ---- Tenant isolation ----
  if (ctx.tenant && ctx.tenant !== resource.tenant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: tenant mismatch.",
    });
  }

  // ---- Owner check ----
  if (resource.ownerId !== undefined && resource.ownerId !== ctx.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied: you do not own this resource.",
    });
  }

  return {
    granted: true,
    reason: "owner_match",
  };
}

/**
 * Require that the user has admin role. Throws if not.
 */
export function requireAdmin(ctx: AccessContext): void {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    });
  }
}

/**
 * Require that the user is authenticated. Throws if not.
 */
export function requireAuth(ctx: AccessContext): asserts ctx is AccessContext & { user: NonNullable<AccessContext["user"]> } {
  // Staging bypass
  if (ALLOW_STAGING_BYPASS && !ctx.user) {
    return;
  }
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }
}
