import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TrpcContext } from "./context";

// Centralized error formatter for user-friendly validation errors
function formatValidationError(error: unknown) {
  if (error instanceof ZodError) {
    const flat = error.flatten();
    const fieldErrors: Record<string, string> = {};
    
    for (const [key, messages] of Object.entries(flat.fieldErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        fieldErrors[key] = messages[0];
      }
    }
    
    return {
      code: "VALIDATION_ERROR",
      fieldErrors,
      formError: flat.formErrors?.[0] ?? "Please check the highlighted fields.",
    };
  }
  return null;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Handle Zod validation errors
    const validationError = formatValidationError(error.cause);
    if (validationError) {
      return {
        ...shape,
        data: {
          ...shape.data,
          ...validationError,
        },
      };
    }
    
    // Return original shape for non-validation errors
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // In development, bypass admin check for convenience
    // CRITICAL: This bypass MUST NOT work in production
    if (process.env.NODE_ENV !== 'production') {
      // Create a mock admin user if none exists
      const mockUser = ctx.user || {
        id: 1,
        openId: 'dev-owner',
        name: 'Dev Owner',
        email: 'owner@launchbase.local',
        role: 'admin' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: 'dev',
      };

      return next({
        ctx: {
          ...ctx,
          user: mockUser,
        },
      });
    }

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Export error formatter for testing
export { formatValidationError };
