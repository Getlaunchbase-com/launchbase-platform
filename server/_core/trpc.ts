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

export function createContext(opts: {
  req: Request;
  res: Response;
  user?: User | null;
}): TRPCContext {
  return {
    req: opts.req,
    res: opts.res,
    user: opts.user ?? null,
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
