import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { intakes, approvals, buildPlans, referrals } from "../drizzle/schema";
import { eq } from "drizzle-orm";
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
import { generatePreviewHTML, generateBuildPlan as generatePreviewBuildPlan } from "./previewTemplates";
import { createHash } from "crypto";

// Generate a hash of the build plan for version locking
function generateBuildPlanHash(buildPlan: { id: number; plan: unknown }): string {
  const content = JSON.stringify({
    id: buildPlan.id,
    plan: buildPlan.plan,
  });
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Generate a referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
        referralCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const intake = await createIntake(input, "new");
        
        // Handle referral code if provided
        let referralDiscount = 0;
        if (input.referralCode && intake?.id) {
          const [referral] = await db
            .select()
            .from(referrals)
            .where(eq(referrals.code, input.referralCode.toUpperCase()));
          
          if (referral && referral.status === "pending") {
            // Mark referral as used and link to this intake
            await db.update(referrals)
              .set({
                refereeIntakeId: intake.id,
                refereeEmail: input.email,
                status: "used",
                usedAt: new Date(),
              })
              .where(eq(referrals.id, referral.id));
            
            referralDiscount = referral.refereeDiscountCents || 5000; // $50 default
          }
        }
        
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
        
        return { success: true, intakeId: intake?.id, referralDiscount };
      }),
    // Get intake by preview token (for customer preview page)
    getByPreviewToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        
        const [intake] = await db
          .select()
          .from(intakes)
          .where(eq(intakes.previewToken, input.token));
        
        if (!intake) return null;
        
        // Generate preview HTML based on intake data
        const rawPayload = intake.rawPayload as Record<string, unknown> || {};
        const intakeData = {
          businessName: intake.businessName,
          businessDescription: (rawPayload.businessDescription as string) || '',
          customerType: (rawPayload.customerType as string) || '',
          websiteGoals: (rawPayload.websiteGoals as string[]) || [],
          contactPreference: (rawPayload.contactPreference as string) || '',
          serviceArea: (rawPayload.serviceArea as string) || '',
          phone: intake.phone || '',
          email: intake.email,
          brandFeel: (rawPayload.brandFeel as string) || 'clean',
        };
        
        const previewBuildPlan = generatePreviewBuildPlan(intakeData);
        const previewHTML = generatePreviewHTML(intakeData, previewBuildPlan);
        
        return {
          ...intake,
          previewHTML,
          buildPlan: previewBuildPlan,
        };
      }),

    // Submit feedback/revision request from customer
    submitFeedback: publicProcedure
      .input(z.object({
        intakeId: z.number(),
        feedback: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Update intake with feedback and set status back to needs_info
        await db
          .update(intakes)
          .set({
            status: "needs_info",
            internalNotes: `Customer feedback: ${input.feedback}`,
            updatedAt: new Date(),
          })
          .where(eq(intakes.id, input.intakeId));
        
        // Notify admin
        await AdminNotifications.newIntake(`Revision requested for intake #${input.intakeId}`, 100);
        
        return { success: true };
      }),

    // Log approval event with legal details and build plan hash
    logApproval: publicProcedure
      .input(z.object({
        intakeId: z.number(),
        userAgent: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Get the build plan for this intake
        const buildPlan = await getBuildPlanByIntakeId(input.intakeId);
        if (!buildPlan) {
          throw new Error("No build plan found for this intake");
        }
        
        // Generate hash of the build plan for version locking
        const buildPlanHash = generateBuildPlanHash(buildPlan);
        
        // Get IP address
        const ipAddress = ctx.req?.ip || 
          (ctx.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
          'unknown';
        
        // Store approval in database
        await db.insert(approvals).values({
          intakeId: input.intakeId,
          buildPlanId: buildPlan.id,
          buildPlanHash,
          userAgent: input.userAgent,
          ipAddress,
        });
        
        // Log the approval event for analytics
        await trackEvent({
          eventName: "build_plan_approved",
          intakeId: input.intakeId,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: input.userAgent,
            ip: ipAddress,
            action: "clickwrap_acceptance",
            terms_version: "1.0",
            buildPlanId: buildPlan.id,
            buildPlanHash,
          },
        });
        
        return { success: true, timestamp: new Date().toISOString(), buildPlanHash };
      }),
  }),

  // Referral program routes
  referral: router({
    // Create a referral code for an existing customer
    create: publicProcedure
      .input(z.object({
        intakeId: z.number(),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Check if referral already exists for this intake
        const [existing] = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referrerIntakeId, input.intakeId));
        
        if (existing) {
          return { code: existing.code, alreadyExists: true };
        }
        
        // Generate unique code
        let code = generateReferralCode();
        let attempts = 0;
        while (attempts < 10) {
          const [existingCode] = await db
            .select()
            .from(referrals)
            .where(eq(referrals.code, code));
          if (!existingCode) break;
          code = generateReferralCode();
          attempts++;
        }
        
        // Create referral
        await db.insert(referrals).values({
          referrerIntakeId: input.intakeId,
          referrerEmail: input.email,
          code,
        });
        
        return { code, alreadyExists: false };
      }),
    
    // Validate a referral code
    validate: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { valid: false, discount: 0 };
        
        const [referral] = await db
          .select()
          .from(referrals)
          .where(eq(referrals.code, input.code.toUpperCase()));
        
        if (!referral || referral.status !== "pending") {
          return { valid: false, discount: 0 };
        }
        
        return { 
          valid: true, 
          discount: (referral.refereeDiscountCents || 5000) / 100 // Return in dollars
        };
      }),
    
    // Get referral stats for a user
    getStats: publicProcedure
      .input(z.object({ intakeId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        
        const [referral] = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referrerIntakeId, input.intakeId));
        
        if (!referral) return null;
        
        // Count successful referrals
        const usedReferrals = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referrerIntakeId, input.intakeId));
        
        const successfulReferrals = usedReferrals.filter(r => r.status === "used").length;
        
        return {
          code: referral.code,
          successfulReferrals,
          totalEarnings: successfulReferrals * 50, // $50 per referral
          rewardApplied: referral.referrerRewardApplied,
        };
      }),
  }),

  // Admin routes (protected)
  admin: router({
    intakes: router({
      list: protectedProcedure
        .input(z.object({
          status: z.enum(["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"]).optional(),
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
          status: z.enum(["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"]),
        }))
        .mutation(async ({ input }) => {
          // If marking as ready_for_review, generate preview token and send email
          if (input.status === "ready_for_review") {
            const intake = await getIntakeById(input.id);
            if (intake) {
              // Generate preview token
              const previewToken = `preview_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
              
              // Update status and set preview token
              const db = await getDb();
              if (!db) throw new Error("Database not available");
              await db.update(intakes)
                .set({ status: input.status, previewToken })
                .where(eq(intakes.id, input.id));
              
              // Send ready for review email with preview link
              const firstName = intake.contactName?.split(" ")[0] || "there";
              await sendEmail(intake.id, "ready_for_review", {
                firstName,
                businessName: intake.businessName,
                email: intake.email,
                previewUrl: `/preview/${previewToken}`,
              });
              
              return { success: true, previewToken };
            }
          }
          
          await updateIntakeStatus(input.id, input.status);
          return { success: true };
        }),
      
      // Bulk update status
      bulkUpdateStatus: protectedProcedure
        .input(z.object({
          ids: z.array(z.number()),
          status: z.enum(["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"]),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          let updated = 0;
          for (const id of input.ids) {
            await db.update(intakes)
              .set({ status: input.status })
              .where(eq(intakes.id, id));
            updated++;
          }
          
          return { success: true, updated };
        }),
      
      // Export intakes to CSV format
      export: protectedProcedure
        .input(z.object({
          ids: z.array(z.number()).optional(),
          status: z.enum(["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"]).optional(),
        }).optional())
        .query(async ({ input }) => {
          const allIntakes = await getIntakes(input?.status);
          const filtered = input?.ids?.length 
            ? allIntakes.filter(i => input.ids!.includes(i.id))
            : allIntakes;
          
          // Generate CSV data
          const headers = ["ID", "Business Name", "Contact Name", "Email", "Phone", "Vertical", "Status", "Created At"];
          const rows = filtered.map(i => [
            i.id,
            i.businessName,
            i.contactName,
            i.email,
            i.phone || "",
            i.vertical,
            i.status,
            new Date(i.createdAt).toISOString(),
          ]);
          
          const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
          
          return { csv, count: filtered.length };
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
        modules: z.array(z.enum(["google_ads", "quickbooks"])).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        const { url, sessionId } = await createSetupCheckoutSession({
          intakeId: input.intakeId,
          customerEmail: input.email,
          customerName: input.name,
          origin,
          modules: input.modules,
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
