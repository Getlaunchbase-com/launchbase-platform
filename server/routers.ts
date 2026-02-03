import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { intakes, approvals, buildPlans, referrals, intelligenceLayers, socialPosts, moduleSetupSteps, moduleConnections, suiteApplications, deployments, emailLogs } from "./drizzle/schema";
import { eq, desc, and, asc, sql } from "drizzle-orm";
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
import { platformRouter } from "./platform-router";
import { createSetupCheckoutSession, getCheckoutSession, createServiceCheckoutSession } from "./stripe/checkout";
import { createSMICheckoutSession, getSMISubscriptionStatus, cancelSMISubscription } from "./stripe/intelligenceCheckout";
import { generatePlatformGuidePDF } from "./pdfGuide";
import { generatePreviewHTML, generateBuildPlan as generatePreviewBuildPlan } from "./previewTemplates";
import { createHash } from "crypto";
import { getWeatherIntelligence, formatFacebookPost } from "./services/weather-intelligence";
import { postToFacebook, testFacebookConnection } from "./services/facebook-poster";
import { getTopReferringSites, getConversionFunnel, get7DayClicks, logReferralEvent } from "./referral";
import { getLastWorkerRun } from "./worker/deploymentWorker";
import { getObservabilityData, formatTimeAgo } from "./observability";
import { notifyOwner } from "./_core/notification";
import { getHealthMetrics } from "./health";
import { checkFacebookPostingPolicy } from "./services/facebook-policy";
import { absoluteUrl } from "./utils/absoluteUrl";
import { actionRequestsRouter } from "./routers/actionRequestsRouter";
import { designJobsRouter } from "./routers/designJobsRouter";
import { aiCopyRefineRouter } from "./routers/aiCopyRefineRouter";
import { marketingInboxRouter } from "./admin/marketingInbox";
import { marketingSignalsRouter } from "./admin/marketingSignals";

// App base URL for absolute links in emails
const APP_URL = 
  process.env.PUBLIC_BASE_URL ??
  process.env.APP_URL ??
  "https://launchbase-h86jcadp.manus.space";

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
  platform: platformRouter,
  actionRequests: actionRequestsRouter,
  designJobs: designJobsRouter,
  aiCopyRefine: aiCopyRefineRouter,
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
        promoCode: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const intake = await createIntake(input);
        
        // Handle promo code if provided
        if (input.promoCode && intake?.id) {
          const { reservePromo } = await import("./services/promoService");
          const promoResult = await reservePromo({
            promoCode: input.promoCode.toUpperCase(),
            intakeId: intake.id,
          });
          
          if (!promoResult.success) {
            console.log(`[Intake] Promo code ${input.promoCode} failed: ${promoResult.error}`);
          } else {
            console.log(`[Intake] Promo code ${input.promoCode} reserved for intake ${intake.id}`);
          }
        }
        
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
          
          // Send intake_confirmation email with websiteStatus variant
          await sendEmail(intake.id, "intake_confirmation", {
            firstName,
            businessName: input.businessName,
            email: input.email,
            language: intake.language as any,
            audience: intake.audience as any,
            websiteStatus: intake.websiteStatus as any,
          });
          
          // Send auto-reply confirmation to customer
          await sendEmail(intake.id, "contact_form_confirmation", {
            firstName,
            businessName: input.businessName,
            email: input.email,
            language: intake.language as any,
            audience: intake.audience as any,
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
        // Generate siteSlug from business name for badge tracking
        const siteSlug = intake.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
        
        // Tier 1 Enhanced Presentation Pass (feature flag + tenant allowlist)
        const { ENV } = await import("./_core/env");
        const isEnhanced =
          ENV.presentationTier === "enhanced" &&
          intake.tenant === "vinces"; // Start safe: only vinces first
        
        let presentation: any | undefined;
        
        if (isEnhanced) {
          const { runPresentationPass } = await import("./services/design/runPresentationPass");
          const pass = await runPresentationPass({
            intakeId: intake.id,
            tenant: intake.tenant,
            tier: "enhanced",
            intakeData,
            buildPlan: previewBuildPlan,
            siteSlug,
          });
          
          presentation = pass?.winner ?? undefined;
        }
        
        const previewHTML = generatePreviewHTML(intakeData, previewBuildPlan, siteSlug, { design: presentation });
        
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
          // Get current intake to validate transition
          const intake = await getIntakeById(input.id);
          if (!intake) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
          }
          
          // Enforce valid status transitions
          const { isValidTransition } = await import("./statusTransitions");
          const currentStatus = intake.status as "new" | "review" | "needs_info" | "ready_for_review" | "approved" | "paid" | "deployed";
          const targetStatus = input.status;
          
          const transitionResult = isValidTransition(currentStatus, targetStatus, "admin");
          if (!transitionResult.valid) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: transitionResult.error || "Invalid status transition" 
            });
          }
          
          // If marking as ready_for_review, generate preview token and send email
          if (input.status === "ready_for_review") {
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
              previewUrl: absoluteUrl(`/preview/${previewToken}`),
              language: intake.language as any,
              audience: intake.audience as any,
            });
            
            return { success: true, previewToken };
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
      
      // Resend preview email with 60-second cooldown
      resendPreviewEmail: protectedProcedure
        .input(z.object({
          intakeId: z.number(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          // Get intake
          const [intake] = await db.select().from(intakes).where(eq(intakes.id, input.intakeId)).limit(1);
          
          if (!intake) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
          }
          
          // Verify status is ready_for_review
          if (intake.status !== "ready_for_review") {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: "Can only resend preview email when status is ready_for_review" 
            });
          }
          
          // Verify preview token exists
          if (!intake.previewToken) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: "No preview token exists for this intake" 
            });
          }
          
          // Check 60-second cooldown - find last ready_for_review email
          const [lastEmail] = await db.select()
            .from(emailLogs)
            .where(and(
              eq(emailLogs.intakeId, input.intakeId),
              eq(emailLogs.emailType, "ready_for_review")
            ))
            .orderBy(desc(emailLogs.sentAt))
            .limit(1);
          
          if (lastEmail) {
            const secondsSinceLastEmail = (Date.now() - lastEmail.sentAt.getTime()) / 1000;
            if (secondsSinceLastEmail < 60) {
              const waitSeconds = Math.ceil(60 - secondsSinceLastEmail);
              throw new TRPCError({ 
                code: "TOO_MANY_REQUESTS", 
                message: `Please wait ${waitSeconds} seconds before resending` 
              });
            }
          }
          
          // Send the email
          const firstName = intake.contactName?.split(" ")[0] || "there";
          await sendEmail(intake.id, "ready_for_review", {
            firstName,
            businessName: intake.businessName,
            email: intake.email,
            previewUrl: absoluteUrl(`/preview/${intake.previewToken}`),
            language: intake.language as any,
            audience: intake.audience as any,
          });
          
          // The email send is already logged in email_logs table via sendEmail
          // This provides the audit trail we need
          
          return { success: true, sentTo: intake.email };
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

      // Worker status for admin dashboard
      workerStatus: protectedProcedure
        .query(async () => {
          const db = await getDb();
          if (!db) return { queuedCount: 0, runningCount: 0, recentDeployments: [] };

          const allDeployments = await db
            .select()
            .from(deployments)
            .orderBy(desc(deployments.createdAt))
            .limit(20);

          const queuedCount = allDeployments.filter(d => d.status === "queued").length;
          const runningCount = allDeployments.filter(d => d.status === "running").length;

          return {
            queuedCount,
            runningCount,
            recentDeployments: allDeployments,
          };
        }),

      // One-click rollback to last successful deployment
      rollbackToLastSuccess: protectedProcedure
        .input(z.object({
          intakeId: z.number(),
          reason: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          const { rollbackToLastSuccess } = await import("./rollback");
          const result = await rollbackToLastSuccess({
            intakeId: input.intakeId,
            reason: input.reason,
          });
          return result;
        }),

      // Manual trigger for running next deployment
      runNext: protectedProcedure
        .mutation(async () => {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          // Find oldest queued deployment
          const [queued] = await db
            .select()
            .from(deployments)
            .where(eq(deployments.status, "queued"))
            .orderBy(asc(deployments.createdAt))
            .limit(1);

          if (!queued) {
            return { success: true, message: "No queued deployments", processed: 0 };
          }

          try {
            // Mark as running first
            await db
              .update(deployments)
              .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
              .where(eq(deployments.id, queued.id));

            // Get intake and build plan
            const [intake] = await db.select().from(intakes).where(eq(intakes.id, queued.intakeId));
            const [buildPlan] = await db.select().from(buildPlans).where(eq(buildPlans.id, queued.buildPlanId));

            if (!intake || !buildPlan) {
              throw new Error("Intake or build plan not found");
            }

            // Generate live URL using Manus subdomain (Phase 1)
            const slug = intake.businessName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            const manusAppDomain = "launchbase-h86jcadp.manus.space";
            const liveUrl = `https://site-${slug}-${queued.id}.${manusAppDomain}`;
            
            console.log(`[Router] Manual deployment trigger: Generated Manus URL: ${liveUrl}`);

            // Mark success
            await db
              .update(deployments)
              .set({ 
                status: "success", 
                completedAt: new Date(), 
                productionUrl: liveUrl,
                urlMode: "TEMP_MANUS", // Phase 1: Always use Manus URLs
                updatedAt: new Date() 
              })
              .where(eq(deployments.id, queued.id));

            // Update intake status
            await db
              .update(intakes)
              .set({ status: "deployed", updatedAt: new Date() })
              .where(eq(intakes.id, intake.id));

            // Send email with Manus URL
            const firstName = intake.contactName?.split(" ")[0] || "there";
            await sendEmail(intake.id, "site_live", {
              firstName,
              businessName: intake.businessName,
              email: intake.email,
              liveUrl, // Manus URL only
              language: intake.language as any,
              audience: intake.audience as any,
            });
            
            console.log(`[Router] Deployment ${queued.id} completed with Manus URL`);

            return { 
              success: true, 
              message: "Deployment completed", 
              processed: 1,
              deploymentId: queued.id,
              liveUrl,
            };
          } catch (error) {
            // Mark as failed
            await db
              .update(deployments)
              .set({ 
                status: "failed", 
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                completedAt: new Date(),
                updatedAt: new Date() 
              })
              .where(eq(deployments.id, queued.id));

            throw error;
          }
        }),
    }),

    referrals: router({
      list: protectedProcedure
        .query(async () => {
          const db = await getDb();
          if (!db) return [];
          
          const allReferrals = await db
            .select()
            .from(referrals)
            .orderBy(desc(referrals.createdAt));
          
          return allReferrals;
        }),

      stats: protectedProcedure
        .query(async () => {
          const db = await getDb();
          if (!db) return { total: 0, pending: 0, used: 0, totalEarnings: 0 };
          
          const allReferrals = await db.select().from(referrals);
          
          const total = allReferrals.length;
          const pending = allReferrals.filter(r => r.status === "pending").length;
          const used = allReferrals.filter(r => r.status === "used").length;
          const totalEarnings = used * 50; // $50 per successful referral
          
          return { total, pending, used, totalEarnings };
        }),

      markPaid: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.update(referrals)
            .set({ referrerRewardApplied: true })
            .where(eq(referrals.id, input.id));
          
          return { success: true };
        }),
    }),

    
    // Test checkout for Stripe integration verification
    createTestCheckout: protectedProcedure
      .input(z.object({
        scenario: z.enum(["canonical", "website_only", "founder"]),
      }))
      .mutation(async ({ input }) => {
        const { computePricing } = await import("../client/src/lib/computePricing");
        
        // Define service selections for each scenario
        const scenarios = {
          canonical: {
            website: true,
            emailService: true,
            socialMediaTier: "MEDIUM" as const,
            enrichmentLayer: false,
            googleBusiness: true,
            quickBooksSync: false,
            promoCode: null,
          },
          website_only: {
            website: true,
            emailService: true,
            socialMediaTier: null,
            enrichmentLayer: false,
            googleBusiness: false,
            quickBooksSync: false,
            promoCode: null,
          },
          founder: {
            website: true,
            emailService: true,
            socialMediaTier: "HIGH" as const,
            enrichmentLayer: true,
            googleBusiness: true,
            quickBooksSync: true,
            promoCode: "BETA-FOUNDERS",
          },
        };
        
        const selections = scenarios[input.scenario];
        
        // Create test intake
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(intakes).values({
          businessName: `Test ${input.scenario} - ${new Date().toISOString()}`,
          contactName: "Test User",
          email: "test@example.com",
          phone: "555-0100",
          vertical: "trades",
          status: "new",
          rawPayload: selections,
          tenant: "launchbase",
        });
        
        const insertId = result[0]?.insertId;
        if (!insertId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Insert failed: missing insertId" });
        
        const [intake] = await db.select().from(intakes).where(eq(intakes.id, insertId)).limit(1);
        if (!intake) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Insert succeeded but row not found" });
        
        // Compute pricing
        const pricing = computePricing(selections);
        
        // Create checkout session (this will store pricingSnapshot)
        const session = await createServiceCheckoutSession({
          intakeId: intake.id,
          customerEmail: intake.email,
          customerName: intake.contactName,
          origin: "http://localhost:3000",
          tenant: "launchbase",
          promoCode: selections.promoCode,
          serviceSelections: selections,
        });
        
        return {
          intakeId: intake.id,
          checkoutUrl: session.url!,
          snapshot: {
            ...pricing,
            tenant: "launchbase",
            pricingVersion: "v1_2026_01_08",
            timestamp: new Date().toISOString(),
            promoCode: selections.promoCode,
          },
        };
      }),
    
    // Health metrics endpoint
    health: protectedProcedure
      .input(z.object({
        tenant: z.enum(["all", "launchbase", "vinces"]).default("all"),
      }).optional())
      .query(async ({ input }) => {
        const tenant = input?.tenant === "all" ? undefined : input?.tenant;
        return await getHealthMetrics(tenant);
      }),

    // Get alerts with optional filters
    getAlerts: protectedProcedure
      .input(z.object({
        status: z.enum(["active", "resolved"]).optional(),
        tenant: z.enum(["launchbase", "vinces"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { alertEvents } = await import("../drizzle/schema");
        const { and, eq, gte } = await import("drizzle-orm");

        // Build where conditions
        const conditions = [];
        
        // Only show alerts from last 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        conditions.push(gte(alertEvents.firstSeenAt, cutoff));
        
        if (input?.status) {
          conditions.push(eq(alertEvents.status, input.status));
        }
        
        if (input?.tenant) {
          conditions.push(eq(alertEvents.tenant, input.tenant));
        }

        const alerts = await db
          .select()
          .from(alertEvents)
          .where(and(...conditions))
          .orderBy((await import("drizzle-orm").then(m => m.desc))(alertEvents.firstSeenAt));

        return alerts;
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
    
    // Full observability panel data
    observability: protectedProcedure.query(async () => {
      const data = await getObservabilityData();
      return {
        systemStatus: data.systemStatus,
        activityMetrics: {
          ...data.activityMetrics,
          lastIntelligenceDecisionFormatted: formatTimeAgo(data.activityMetrics.lastIntelligenceDecision),
          lastDeploymentRunFormatted: formatTimeAgo(data.activityMetrics.lastDeploymentRun),
        },
        recentDecisions: data.recentDecisions,
        intelligenceInfo: data.intelligenceInfo,
      };
    }),
    
    // Worker observability
    workerStatus: protectedProcedure.query(async () => {
      const workerData = await getLastWorkerRun();
      if (!workerData) {
        return {
          lastRun: null,
          minutesAgo: null,
          recentRuns: [],
          stats: { processed: 0, skipped: 0, errors: 0 },
        };
      }
      
      const minutesAgo = workerData.lastRun 
        ? Math.round((Date.now() - new Date(workerData.lastRun.startedAt).getTime()) / 60000)
        : null;
      
      return {
        lastRun: workerData.lastRun,
        minutesAgo,
        recentRuns: workerData.recentRuns,
        stats: workerData.stats,
      };
    }),

    // Marketing management
    marketingInbox: marketingInboxRouter,
    marketingSignals: marketingSignalsRouter,

    // Agent chat (VM/brain gateway)
    agentChat: agentChatRouter,
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

    /**
     * Create checkout from intake - server derives service selections
     * This is the single source of truth for payment creation
     */
    createServiceCheckoutFromIntake: publicProcedure
      .input(z.object({
        intakeId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        const tenant = process.env.OWNER_NAME || "launchbase";
        
        // Load intake
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const [intake] = await db.select().from(intakes).where(eq(intakes.id, input.intakeId));
        if (!intake) {
          throw new Error("Intake not found");
        }
        
        // Derive service selections from intake.rawPayload (best-effort)
        const rawPayload = (intake.rawPayload as Record<string, unknown>) || {};
        
        // Conservative inference: default to false/null if uncertain
        const serviceSelections = {
          website: rawPayload.website === true || rawPayload.websiteStatus !== "systems_only",
          emailService: rawPayload.emailService === true || rawPayload.website === true, // Email required with website
          socialMediaTier: (rawPayload.socialMediaTier as "LOW" | "MEDIUM" | "HIGH" | null) || null,
          enrichmentLayer: rawPayload.enrichmentLayer === true,
          googleBusiness: rawPayload.googleBusiness === true,
          quickBooksSync: rawPayload.quickBooksSync === true,
        };
        
        // Get promo code from rawPayload if exists
        const promoCode = typeof rawPayload.promoCode === "string" ? rawPayload.promoCode : undefined;
        
        const { url, sessionId } = await createServiceCheckoutSession({
          intakeId: input.intakeId,
          customerEmail: intake.email,
          customerName: intake.contactName,
          origin,
          tenant,
          promoCode,
          serviceSelections,
        });
        
        return { checkoutUrl: url, sessionId };
      }),

    /**
     * Legacy endpoint - kept for backward compatibility
     * New code should use createServiceCheckoutFromIntake
     */
    createServiceCheckout: publicProcedure
      .input(z.object({
        intakeId: z.number(),
        email: z.string().email(),
        name: z.string(),
        promoCode: z.string().optional(),
        serviceSelections: z.object({
          website: z.boolean(),
          emailService: z.boolean(),
          socialMediaTier: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
          enrichmentLayer: z.boolean(),
          googleBusiness: z.boolean(),
          quickBooksSync: z.boolean(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        const tenant = process.env.OWNER_NAME || "launchbase";
        
        const { url, sessionId } = await createServiceCheckoutSession({
          intakeId: input.intakeId,
          customerEmail: input.email,
          customerName: input.name,
          origin,
          tenant,
          promoCode: input.promoCode,
          serviceSelections: input.serviceSelections,
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

    /**
     * Get service summary for display in UI
     * Single source of truth for "what you're getting"
     */
    getServiceSummary: publicProcedure
      .input(z.object({ intakeId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const [intake] = await db.select().from(intakes).where(eq(intakes.id, input.intakeId));
        if (!intake) {
          throw new Error("Intake not found");
        }
        
        const rawPayload = (intake.rawPayload as any) || {};
        const pricingSnapshot = rawPayload.pricingSnapshot;
        const serviceSelections = rawPayload.serviceSelections;
        
        if (!pricingSnapshot || !serviceSelections) {
          // No services selected yet
          return {
            lines: [],
            totals: { setupCents: 0, monthlyCents: 0 },
            version: pricingSnapshot?.pricingVersion || "unknown"
          };
        }
        
        // Build service summary
        const { buildServiceSummary } = await import("./services/serviceSummary");
        const summary = buildServiceSummary(serviceSelections, pricingSnapshot);
        
        // Convert to UI-friendly format
        const lines = summary.items.map(item => {
          const parts = [item.title];
          if (item.includes.length > 0) {
            parts.push(item.includes[0]); // Show first "included" item
          }
          return parts.join(" — ");
        });
        
        return {
          lines,
          totals: {
            setupCents: summary.setupTotal,
            monthlyCents: summary.monthlyTotal
          },
          version: pricingSnapshot.pricingVersion || "unknown"
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

  // Intelligence Layers for Social Media Intelligence module
  intelligenceLayers: router({
    // Get current configuration for the logged-in user's business
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;

      // Get config for the logged-in user
      const [config] = await db
        .select()
        .from(intelligenceLayers)
        .where(eq(intelligenceLayers.userId, ctx.user.id))
        .limit(1);

      if (!config) {
        // Return default configuration
        return {
          id: 0,
          cadence: "medium" as const,
          tuningMode: "auto" as const,
          weatherEnabled: true,
          sportsEnabled: true,
          communityEnabled: false,
          trendsEnabled: false,
          approvalRequired: true,
          monthlyPriceCents: 12900,
          moduleStatus: "pending_activation" as const,
          isFounder: false,
        };
      }

      return config;
    }),

    // Save configuration
    saveConfig: protectedProcedure
      .input(z.object({
        cadence: z.enum(["low", "medium", "high"]),
        sportsEnabled: z.boolean(),
        communityEnabled: z.boolean(),
        trendsEnabled: z.boolean(),
        tuningMode: z.enum(["auto", "guided", "custom"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Calculate monthly price based on cadence and layers
        const basePrices = { low: 7900, medium: 12900, high: 19900 };
        let monthlyPrice = basePrices[input.cadence];

        // Add layer prices (all layers are add-ons in Model A)
        if (input.sportsEnabled) monthlyPrice += 2900;
        if (input.communityEnabled) monthlyPrice += 3900;
        if (input.trendsEnabled) monthlyPrice += 4900;

        // Check if config exists for this user
        const [existing] = await db
          .select()
          .from(intelligenceLayers)
          .where(eq(intelligenceLayers.userId, ctx.user.id))
          .limit(1);

        if (existing) {
          // Update existing
          await db
            .update(intelligenceLayers)
            .set({
              cadence: input.cadence,
              sportsEnabled: input.sportsEnabled,
              communityEnabled: input.communityEnabled,
              trendsEnabled: input.trendsEnabled,
              tuningMode: input.tuningMode || "auto",
              monthlyPriceCents: monthlyPrice,
              updatedAt: new Date(),
            })
            .where(eq(intelligenceLayers.id, existing.id));
        } else {
          // Create new config for this user
          await db.insert(intelligenceLayers).values({
            userId: ctx.user.id,
            cadence: input.cadence,
            sportsEnabled: input.sportsEnabled,
            communityEnabled: input.communityEnabled,
            trendsEnabled: input.trendsEnabled,
            tuningMode: input.tuningMode || "auto",
            monthlyPriceCents: monthlyPrice,
          });
        }

        // Track analytics event
        await trackEvent({
          eventName: "intelligence_config_saved",
          metadata: {
            cadence: input.cadence,
            sportsEnabled: input.sportsEnabled,
            communityEnabled: input.communityEnabled,
            trendsEnabled: input.trendsEnabled,
            monthlyPrice,
          },
        });

        return { success: true, monthlyPriceCents: monthlyPrice };
      }),

    // Get recommendations based on vertical
    getRecommendations: publicProcedure
      .input(z.object({
        vertical: z.enum(["trades", "appointments", "professional"]),
        location: z.string().optional(),
      }))
      .query(({ input }) => {
        // Deterministic recommendations based on vertical
        const recommendations: Record<string, {
          depth: "low" | "medium" | "high";
          layers: string[];
          explanation: string;
        }> = {
          trades: {
            depth: "medium",
            layers: ["weather", "sports", "community"],
            explanation: "Weather and community events drive demand for trades businesses. Sports events affect traffic and scheduling.",
          },
          appointments: {
            depth: "medium",
            layers: ["weather", "community"],
            explanation: "Weather affects appointment attendance. Community events help with local engagement.",
          },
          professional: {
            depth: "low",
            layers: ["weather"],
            explanation: "Professional services benefit from conservative posting. Weather awareness prevents irrelevant content.",
          },
        };

        return recommendations[input.vertical] || recommendations.professional;
      }),

    // Generate sample week preview
    getSampleWeek: publicProcedure
      .input(z.object({
        cadence: z.enum(["low", "medium", "high"]),
        sportsEnabled: z.boolean(),
        communityEnabled: z.boolean(),
        trendsEnabled: z.boolean(),
      }))
      .query(({ input }) => {
        const samplePosts = [];

        samplePosts.push({
          id: 1,
          type: "weather",
          content: "Weather post",
          trigger: "Storm",
          day: "Monday",
          time: "6:00 PM",
        });

        if (input.cadence !== "low") {
          samplePosts.push({
            id: 2,
            type: "community",
            content: "Community event",
            trigger: "Local event",
            day: "Wednesday",
            time: "9:00 AM",
          });
        }

        return samplePosts;
      }),
  }),
});

export type AppRouter = typeof appRouter;
