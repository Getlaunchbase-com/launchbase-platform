import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  createIntake, 
  getIntakes, 
  getIntakeById,
  updateIntakeStatus,
  createBuildPlan,
  getBuildPlanById,
  getBuildPlanByIntakeId,
  updateBuildPlanStatus,
  createClarification,
  getClarificationByToken,
  submitClarificationAnswer,
  createDeployment,
  getDeploymentById,
  getDeployments,
  updateDeploymentStatus,
  runDeployment,
} from "./db";
import { sendEmail, AdminNotifications } from "./email";
import { trackEvent, getFunnelMetrics, getBuildQualityMetrics, getVerticalMetrics, getDailyHealth } from "./analytics";
import { createSetupCheckoutSession, getCheckoutSession } from "./stripe/checkout";
import { generatePlatformGuidePDF } from "./pdfGuide";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Customer intake submission
  intake: router({
    submit: publicProcedure
      .input(z.object({
        businessName: z.string().min(1),
        contactName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        vertical: z.enum(["trades", "appointments", "professional"]),
        services: z.array(z.string()).optional(),
        serviceArea: z.array(z.string()).optional(),
        primaryCTA: z.string().optional(),
        bookingLink: z.string().optional(),
        tagline: z.string().optional(),
        brandColors: z.object({
          primary: z.string().optional(),
          secondary: z.string().optional(),
        }).optional(),
        rawPayload: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const intake = await createIntake(input, "new");
        
        // Send confirmation email
        if (intake?.id) {
          const firstName = input.contactName.split(" ")[0];
          await sendEmail(intake.id, "intake_confirmation", {
            firstName,
            businessName: input.businessName,
            email: input.email,
          });
          
          // Notify admin of new intake
          await AdminNotifications.newIntake(input.businessName, 85);
        }
        
        return { success: true, intakeId: intake?.id };
      }),
  }),

  // Admin routes (protected)
  admin: router({
    intakes: router({
      list: protectedProcedure
        .input(z.object({
          status: z.enum(["new", "review", "needs_info", "ready", "approved"]).optional(),
          search: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
          return getIntakes(input?.status, input?.search);
        }),
      
      detail: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          return getIntakeById(input.id);
        }),

      updateStatus: protectedProcedure
        .input(z.object({
          id: z.number(),
          status: z.enum(["new", "review", "needs_info", "ready", "approved"]),
        }))
        .mutation(async ({ input }) => {
          await updateIntakeStatus(input.id, input.status);
          return { success: true };
        }),
    }),

    buildPlan: router({
      generate: protectedProcedure
        .input(z.object({ intakeId: z.number() }))
        .mutation(async ({ input }) => {
          const intake = await getIntakeById(input.intakeId);
          if (!intake) throw new Error("Intake not found");

          // Generate build plan based on intake
          const plan = generateBuildPlan(intake);
          const buildPlan = await createBuildPlan({
            intakeId: input.intakeId,
            templateId: intake.vertical === "trades" ? "trades_v1" : 
                        intake.vertical === "appointments" ? "appointment_v2" : "professional_v1",
            plan,
            status: "draft",
          });

          return { success: true, buildPlanId: buildPlan?.id };
        }),

      get: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          return getBuildPlanById(input.id);
        }),

      getByIntake: protectedProcedure
        .input(z.object({ intakeId: z.number() }))
        .query(async ({ input }) => {
          return getBuildPlanByIntakeId(input.intakeId);
        }),

      approve: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await updateBuildPlanStatus(input.id, "approved");
          return { success: true };
        }),
    }),

    clarify: router({
      create: protectedProcedure
        .input(z.object({
          intakeId: z.number(),
          questionKey: z.string(),
          questionText: z.string(),
          inputType: z.enum(["text", "select", "multitag"]).default("text"),
          options: z.array(z.string()).optional(),
        }))
        .mutation(async ({ input }) => {
          const clarification = await createClarification(input);
          return { 
            success: true, 
            token: clarification?.token,
            link: `/clarify/${clarification?.token}`,
          };
        }),
    }),

    deploy: router({
      start: protectedProcedure
        .input(z.object({ buildPlanId: z.number() }))
        .mutation(async ({ input }) => {
          const buildPlan = await getBuildPlanById(input.buildPlanId);
          if (!buildPlan) throw new Error("Build plan not found");

          const deployment = await createDeployment({
            buildPlanId: input.buildPlanId,
            intakeId: buildPlan.intakeId,
            status: "queued",
          });

          return { success: true, deploymentId: deployment?.id };
        }),

      run: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const result = await runDeployment(input.id);
          return result;
        }),

      status: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ input }) => {
          return getDeploymentById(input.id);
        }),

      list: protectedProcedure
        .input(z.object({
          status: z.enum(["queued", "running", "success", "failed"]).optional(),
        }).optional())
        .query(async ({ input }) => {
          return getDeployments(input?.status);
        }),
    }),
  }),

  // Analytics tracking (public for frontend events)
  analytics: router({
    track: publicProcedure
      .input(z.object({
        eventName: z.string(),
        sessionId: z.string().optional(),
        intakeId: z.number().optional(),
        vertical: z.string().optional(),
        stepNumber: z.number().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        await trackEvent(input as any);
        return { success: true };
      }),

    // Admin-only analytics queries
    funnel: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return getFunnelMetrics(start, end);
      }),

    buildQuality: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return getBuildQualityMetrics(start, end);
      }),

    verticals: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const start = input?.startDate ? new Date(input.startDate) : undefined;
        const end = input?.endDate ? new Date(input.endDate) : undefined;
        return getVerticalMetrics(start, end);
      }),

    dailyHealth: protectedProcedure.query(async () => {
      return getDailyHealth();
    }),
  }),

  // Stripe payment routes
  payment: router({
    createCheckout: publicProcedure
      .input(z.object({
        intakeId: z.number(),
        email: z.string().email(),
        name: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        const { url, sessionId } = await createSetupCheckoutSession({
          intakeId: input.intakeId,
          customerEmail: input.email,
          customerName: input.name,
          origin,
        });
        return { checkoutUrl: url, sessionId };
      }),

    getSession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const session = await getCheckoutSession(input.sessionId);
        return {
          status: session.payment_status,
          customerEmail: session.customer_email,
          amountTotal: session.amount_total,
          intakeId: session.metadata?.intake_id,
        };
      }),
  }),

  // PDF Guide generation
  guide: router({
    generate: publicProcedure
      .input(z.object({
        businessName: z.string(),
        contactName: z.string(),
        vertical: z.enum(["trades", "appointments", "professional"]),
      }))
      .mutation(async ({ input }) => {
        const { content, filename } = await generatePlatformGuidePDF(input);
        return { content, filename };
      }),
  }),

  // Public clarification routes
  clarify: router({
    get: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return getClarificationByToken(input.token);
      }),

    submit: publicProcedure
      .input(z.object({
        token: z.string(),
        answer: z.string(),
      }))
      .mutation(async ({ input }) => {
        const result = await submitClarificationAnswer(input.token, input.answer);
        return result;
      }),
  }),
});

// Helper function to generate build plan from intake
function generateBuildPlan(intake: {
  businessName: string;
  vertical: string;
  services?: string[] | null;
  serviceArea?: string[] | null;
  tagline?: string | null;
  primaryCTA?: string | null;
  brandColors?: { primary?: string; secondary?: string } | null;
}) {
  const basePages = [
    { id: "home", title: "Home", slug: "/", sections: ["hero", "services", "about", "cta"] },
    { id: "services", title: "Services", slug: "/services", sections: ["service-list", "cta"] },
    { id: "about", title: "About", slug: "/about", sections: ["story", "team", "cta"] },
    { id: "contact", title: "Contact", slug: "/contact", sections: ["form", "map", "info"] },
  ];

  // Add vertical-specific pages
  if (intake.vertical === "trades") {
    basePages.push({ id: "emergency", title: "Emergency Service", slug: "/emergency", sections: ["hero", "phone", "areas"] });
  } else if (intake.vertical === "appointments") {
    basePages.push({ id: "book", title: "Book Online", slug: "/book", sections: ["booking-widget", "services"] });
  } else if (intake.vertical === "professional") {
    basePages.push({ id: "consult", title: "Request Consultation", slug: "/consultation", sections: ["form", "credentials"] });
  }

  const ctaText = intake.vertical === "trades" ? "Call Now" :
                  intake.vertical === "appointments" ? "Book Online" : "Request Consultation";

  return {
    pages: basePages,
    brand: {
      primaryColor: intake.brandColors?.primary || "#FF6A00",
      secondaryColor: intake.brandColors?.secondary || "#0B0B0C",
      fontFamily: "Inter",
    },
    copy: {
      heroHeadline: intake.tagline || `Welcome to ${intake.businessName}`,
      heroSubheadline: `Serving ${intake.serviceArea?.slice(0, 3).join(", ") || "your area"} with quality service`,
      ctaText,
    },
    features: intake.services || [],
  };
}

export type AppRouter = typeof appRouter;
