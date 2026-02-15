/**
 * Project-Based Access Verification
 *
 * Enforces that a user has the right to access a specific project and its
 * resources (agent runs, artifacts, etc.). Sits above the tenant-scoped
 * RBAC in server/security/verifyProjectAccess.ts — this module adds
 * **project-level** isolation.
 *
 * Rules:
 *   1. Admins can access any project.
 *   2. Project owner always has full access.
 *   3. Collaborators have access matching their role (owner/editor/viewer).
 *   4. Non-collaborators are denied.
 *   5. Staging bypass allows unauthenticated access in non-production.
 */

import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectAccessContext {
  user: { id: number; role: string } | null;
}

export interface ProjectAccessCheck {
  projectId: number;
  /** Minimum required role (default: "viewer") */
  requiredRole?: ProjectRole;
}

export interface ProjectAccessResult {
  granted: boolean;
  reason: string;
  role?: ProjectRole;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Staging escape hatch — mirrors server/security/verifyProjectAccess.ts.
 * Remove before production.
 */
const ALLOW_STAGING_BYPASS =
  process.env.ALLOW_STAGING_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

function hasMinimumRole(actual: ProjectRole, required: ProjectRole): boolean {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

/**
 * Verify that a user can access a project. Requires a DB lookup to check
 * collaborator membership. The caller passes the collaborator row (or null)
 * to avoid coupling this module to the database layer.
 *
 * @param ctx          Request context with user
 * @param check        Project ID + required role
 * @param collaborator The user's collaborator row for this project (null if none)
 * @param projectOwnerId The project's owner ID
 */
export function verifyProjectAccess(
  ctx: ProjectAccessContext,
  check: ProjectAccessCheck,
  collaborator: { role: ProjectRole } | null,
  projectOwnerId: number
): ProjectAccessResult {
  const requiredRole = check.requiredRole ?? "viewer";

  // ---- Staging bypass ----
  if (ALLOW_STAGING_BYPASS && !ctx.user) {
    return { granted: true, reason: "staging_bypass" };
  }

  // ---- Anonymous denial ----
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required to access this project.",
    });
  }

  // ---- Admin: full access ----
  if (ctx.user.role === "admin") {
    return { granted: true, reason: "admin_role", role: "owner" };
  }

  // ---- Project owner: full access ----
  if (ctx.user.id === projectOwnerId) {
    return { granted: true, reason: "project_owner", role: "owner" };
  }

  // ---- Collaborator check ----
  if (!collaborator) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this project.",
    });
  }

  if (!hasMinimumRole(collaborator.role, requiredRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Insufficient project role. Required: ${requiredRole}, yours: ${collaborator.role}.`,
    });
  }

  return { granted: true, reason: "collaborator", role: collaborator.role };
}

/**
 * Quick check: does the user own or collaborate on a run's project?
 * Convenience wrapper for use in tRPC procedures.
 *
 * @param ctx             Request context
 * @param run             The agent run record (must include projectId)
 * @param projectOwnerId  Owner of the project this run belongs to
 * @param collaborator    Collaborator row or null
 * @param requiredRole    Minimum role required (default: "viewer")
 */
export function verifyRunAccess(
  ctx: ProjectAccessContext,
  run: { projectId: number | null },
  projectOwnerId: number | null,
  collaborator: { role: ProjectRole } | null,
  requiredRole: ProjectRole = "viewer"
): ProjectAccessResult {
  // Runs without a projectId are legacy — allow for admins, deny others
  if (run.projectId == null || projectOwnerId == null) {
    if (ALLOW_STAGING_BYPASS) {
      return { granted: true, reason: "staging_bypass" };
    }
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
    }
    if (ctx.user.role === "admin") {
      return { granted: true, reason: "admin_role", role: "owner" };
    }
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This run has no project scope. Admin access required.",
    });
  }

  return verifyProjectAccess(
    ctx,
    { projectId: run.projectId, requiredRole },
    collaborator,
    projectOwnerId
  );
}
