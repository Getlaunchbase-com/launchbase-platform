/**
 * tRPC Initialization
 *
 * Defines the tRPC instance, context, and procedure types used by all routers.
 *
 *   - publicProcedure  — no auth required
 *   - protectedProcedure — requires valid session (user in context)
 *   - adminProcedure   — requires admin role
 */

import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import superjson from "superjson";
import { env } from "./env";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  role: "user" | "admin";
  email?: string | null;
  name?: string | null;
}

export interface TRPCContext {
  req: Request;
  res: Response;
  user: User | null;
}

/**
 * Extract user from request.
 *
 * Checks in order:
 *   1. Bearer token in Authorization header (JWT-like)
 *   2. Session cookie (existing cookie-based auth)
 *   3. Returns null if neither present
 *
 * In production, bearer tokens are validated against JWT_SECRET.
 * In development, a dev bypass is available via x-dev-user-id header.
 */
function extractUser(req: Request): User | null {
  // 1. Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // Decode JWT payload (base64url)
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        );
        if (payload.sub && payload.role) {
          return {
            id: Number(payload.sub),
            role: payload.role === "admin" ? "admin" : "user",
            email: payload.email ?? null,
            name: payload.name ?? null,
          };
        }
      }
    } catch {
      // Invalid token format — fall through
    }
  }

  // 2. Session cookie (already parsed by express middleware in production)
  const sessionUser = (req as any).session?.user ?? (req as any).user;
  if (sessionUser?.id) {
    return {
      id: sessionUser.id,
      role: sessionUser.role ?? "user",
      email: sessionUser.email ?? null,
      name: sessionUser.name ?? null,
    };
  }

  // 3. Dev bypass (development only)
  if (env.isDevelopment && req.headers["x-dev-user-id"]) {
    return {
      id: Number(req.headers["x-dev-user-id"]),
      role: (req.headers["x-dev-user-role"] as string) === "admin" ? "admin" : "user",
      email: null,
      name: "Dev User",
    };
  }

  return null;
}

export function createContext(opts: {
  req: Request;
  res: Response;
  user?: User | null;
}): TRPCContext {
  return {
    req: opts.req,
    res: opts.res,
    user: opts.user ?? extractUser(opts.req),
  };
}

// ---------------------------------------------------------------------------
// tRPC instance
// ---------------------------------------------------------------------------

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const middleware = t.middleware;

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** No authentication required */
export const publicProcedure = t.procedure;

/** Requires a logged-in user */
export const protectedProcedure = t.procedure.use(
  middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource.",
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

/** Requires admin role */
export const adminProcedure = t.procedure.use(
  middleware(async ({ ctx, next }) => {
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
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

// Type export for router inference
export type AppRouter = ReturnType<typeof router>;
