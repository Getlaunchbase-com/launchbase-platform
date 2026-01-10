import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminStripeWebhooksRouter } from "./routers/admin/stripeWebhooks";
import { adminEmailSmokeRouter } from "./routers/admin/emailSmoke";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { intakes, approvals, buildPlans, referrals, intelligenceLayers, socialPosts, moduleSetupSteps, moduleConnections, suiteApplications, deployments, emailLogs } from "../drizzle/schema";
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

import { actionRequestsRouter } from "./routers/actionRequestsRouter";

export const appRouter = router({
  system: systemRouter,
  platform: platformRouter,
  actionRequests: actionRequestsRouter,
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
        const previewHTML = generatePreviewHTML(intakeData, previewBuildPlan, siteSlug);
        
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

    // Stripe webhook monitoring (admin-only, read-only observability)
    stripeWebhooks: adminStripeWebhooksRouter,
    
    // Email delivery smoke test (admin-only)
    emailSmoke: adminEmailSmokeRouter,
    
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
        // Generate sample posts based on configuration
        const samplePosts = [];

        // Weather-triggered post (always included)
        samplePosts.push({
          id: 1,
          type: "weather",
          content: "❄️ Snow expected tonight. Our crews are ready to keep your property clear and safe. Stay warm!",
          trigger: "Winter storm advisory",
          day: "Monday",
          time: "6:00 PM",
        });

        if (input.cadence !== "low") {
          samplePosts.push({
            id: 2,
            type: "weather",
            content: "☀️ Beautiful day ahead! Perfect weather for outdoor projects. How can we help?",
            trigger: "Clear skies, 65°F",
            day: "Wednesday",
            time: "9:00 AM",
          });
        }

        if (input.sportsEnabled) {
          samplePosts.push({
            id: 3,
            type: "sports",
            content: "🏈 Big game today! We'll have your property cleared before kickoff. Go Bears! 🐻",
            trigger: "Bears home game",
            day: "Sunday",
            time: "10:00 AM",
          });
        }

        if (input.communityEnabled) {
          samplePosts.push({
            id: 4,
            type: "community",
            content: "🎄 Holiday market this weekend! We'll make sure your walkways are safe for all the visitors.",
            trigger: "Local holiday event",
            day: "Friday",
            time: "3:00 PM",
          });
        }

        if (input.trendsEnabled && input.cadence === "high") {
          samplePosts.push({
            id: 5,
            type: "trends",
            content: "Lots of folks talking about ice on the roads today. We're on it! Stay safe out there.",
            trigger: "Local trending topic: road conditions",
            day: "Thursday",
            time: "7:00 AM",
          });
        }

        return samplePosts;
      }),

    // Create Stripe checkout session for SMI subscription
    createCheckout: protectedProcedure
      .input(z.object({
        cadence: z.enum(["low", "medium", "high"]),
        layers: z.array(z.enum(["sports", "community", "trends"])),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { url } = await createSMICheckoutSession({
          userId: ctx.user.id.toString(),
          cadence: input.cadence,
          layers: input.layers,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        });

        // Track analytics
        await trackEvent({
          eventName: "smi_checkout_started",
          metadata: {
            cadence: input.cadence,
            layers: input.layers.join(","),
            userId: ctx.user.id,
          },
        });

        return { url };
      }),

    // Get subscription status
    getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
      return getSMISubscriptionStatus(ctx.user.id.toString());
    }),

    // Cancel subscription
    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await cancelSMISubscription(ctx.user.id.toString());
      
      if (result.success) {
        await trackEvent({
          eventName: "smi_subscription_cancelled",
          metadata: { userId: ctx.user.id },
        });
      }

      return result;
    }),
  }),

  // Post Queue Router - Approval workflow for social posts
  postQueue: router({
    // Get posts in queue for current user
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["all", "needs_review", "approved", "published", "rejected", "expired"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const filter = input?.status && input.status !== "all" 
          ? eq(socialPosts.status, input.status)
          : undefined;

        const posts = await db
          .select()
          .from(socialPosts)
          .where(filter)
          .orderBy(desc(socialPosts.createdAt))
          .limit(input?.limit || 50);

        return posts;
      }),

    // Get single post by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const [post] = await db
          .select()
          .from(socialPosts)
          .where(eq(socialPosts.id, input.id))
          .limit(1);

        return post || null;
      }),

    // Approve a post
    approve: protectedProcedure
      .input(z.object({
        id: z.number(),
        editedContent: z.string().optional(),
        scheduleNow: z.boolean().default(false),
        autoApproveType: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updateData: Record<string, unknown> = {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: ctx.user.id,
          autoApproveType: input.autoApproveType,
        };

        if (input.editedContent) {
          updateData.content = input.editedContent;
        }

        await db
          .update(socialPosts)
          .set(updateData)
          .where(eq(socialPosts.id, input.id));

        await trackEvent({
          eventName: "post_approved",
          metadata: { postId: input.id, userId: ctx.user.id },
        });

        return { success: true };
      }),

    // Reject a post
    reject: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(socialPosts)
          .set({
            status: "rejected",
            decisionReason: input.reason,
          })
          .where(eq(socialPosts.id, input.id));

        await trackEvent({
          eventName: "post_rejected",
          metadata: { postId: input.id, userId: ctx.user.id },
        });

        return { success: true };
      }),

    // Edit post content
    edit: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string(),
        headline: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(socialPosts)
          .set({
            content: input.content,
            headline: input.headline,
          })
          .where(eq(socialPosts.id, input.id));

        return { success: true };
      }),
  }),

  // Module Setup Router - Track customer progress through module setup
  moduleSetup: router({
    // Get all setup steps for a module
    getSteps: protectedProcedure
      .input(z.object({
        moduleKey: z.enum(["social_media_intelligence", "quickbooks_sync", "google_business"]),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const steps = await db
          .select()
          .from(moduleSetupSteps)
          .where(eq(moduleSetupSteps.userId, ctx.user.id))
          .orderBy(moduleSetupSteps.stepOrder);

        return steps.filter(s => s.moduleKey === input.moduleKey);
      }),

    // Get progress for all modules
    getProgress: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return {};

      const steps = await db
        .select()
        .from(moduleSetupSteps)
        .where(eq(moduleSetupSteps.userId, ctx.user.id));

      // Group by module and calculate progress
      const progress: Record<string, { completed: number; total: number; percentage: number }> = {};
      
      for (const step of steps) {
        if (!progress[step.moduleKey]) {
          progress[step.moduleKey] = { completed: 0, total: 0, percentage: 0 };
        }
        progress[step.moduleKey].total++;
        if (step.isCompleted) {
          progress[step.moduleKey].completed++;
        }
      }

      // Calculate percentages
      for (const key of Object.keys(progress)) {
        const p = progress[key];
        p.percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
      }

      return progress;
    }),

    // Complete a setup step
    completeStep: protectedProcedure
      .input(z.object({
        moduleKey: z.enum(["social_media_intelligence", "quickbooks_sync", "google_business"]),
        stepKey: z.string(),
        stepData: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(moduleSetupSteps)
          .set({
            isCompleted: true,
            completedAt: new Date(),
            stepData: input.stepData,
          })
          .where(and(
            eq(moduleSetupSteps.userId, ctx.user.id),
            eq(moduleSetupSteps.stepKey, input.stepKey)
          ));

        await trackEvent({
          eventName: "module_step_completed",
          metadata: {
            moduleKey: input.moduleKey,
            stepKey: input.stepKey,
            userId: ctx.user.id,
          },
        });

        return { success: true };
      }),

    // Initialize setup steps for a module (called when module is purchased)
    initializeModule: protectedProcedure
      .input(z.object({
        moduleKey: z.enum(["social_media_intelligence", "quickbooks_sync", "google_business"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Import module config
        const { moduleConfigs } = await import("../shared/moduleSetupConfig");
        const config = moduleConfigs[input.moduleKey];

        if (!config) {
          throw new Error(`Unknown module: ${input.moduleKey}`);
        }

        // Create setup steps for this user
        for (const step of config.steps) {
          await db.insert(moduleSetupSteps).values({
            userId: ctx.user.id,
            moduleKey: input.moduleKey,
            stepKey: step.key,
            stepOrder: step.order,
            stepTitle: step.title,
            stepDescription: step.description,
            isCompleted: false,
          });
        }

        await trackEvent({
          eventName: "module_setup_initialized",
          metadata: {
            moduleKey: input.moduleKey,
            userId: ctx.user.id,
            totalSteps: config.steps.length,
          },
        });

        return { success: true, totalSteps: config.steps.length };
      }),
  }),

  // Module Connections Router - OAuth tokens and external service connections
  moduleConnections: router({
    // Get all connections for current user
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const connections = await db
        .select({
          id: moduleConnections.id,
          moduleKey: moduleConnections.moduleKey,
          connectionType: moduleConnections.connectionType,
          externalId: moduleConnections.externalId,
          externalName: moduleConnections.externalName,
          status: moduleConnections.status,
          lastSyncAt: moduleConnections.lastSyncAt,
          createdAt: moduleConnections.createdAt,
        })
        .from(moduleConnections)
        .where(eq(moduleConnections.userId, ctx.user.id));

      return connections;
    }),

    // Get connection for a specific module
    getByModule: protectedProcedure
      .input(z.object({
        moduleKey: z.enum(["social_media_intelligence", "quickbooks_sync", "google_business"]),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;

        const [connection] = await db
          .select({
            id: moduleConnections.id,
            moduleKey: moduleConnections.moduleKey,
            connectionType: moduleConnections.connectionType,
            externalId: moduleConnections.externalId,
            externalName: moduleConnections.externalName,
            status: moduleConnections.status,
            lastSyncAt: moduleConnections.lastSyncAt,
          })
          .from(moduleConnections)
          .where(eq(moduleConnections.moduleKey, input.moduleKey))
          .limit(1);

        return connection || null;
      }),

    // Disconnect a module
    disconnect: protectedProcedure
      .input(z.object({
        moduleKey: z.enum(["social_media_intelligence", "quickbooks_sync", "google_business"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(moduleConnections)
          .set({ status: "revoked" })
          .where(eq(moduleConnections.moduleKey, input.moduleKey));

        await trackEvent({
          eventName: "module_disconnected",
          metadata: {
            moduleKey: input.moduleKey,
            userId: ctx.user.id,
          },
        });

        return { success: true };
      }),
  }),

  // Suite Apply Router - handles new customer applications from /apply flow
  suiteApply: router({
    submit: publicProcedure
      .input(z.object({
        language: z.enum(["en", "es", "pl"]).default("en"),
        audience: z.enum(["biz", "org"]).optional(),
        websiteStatus: z.enum(["none", "existing", "systems_only"]).default("none"),
        vertical: z.enum(["trades", "health", "beauty", "food", "cannabis", "professional", "fitness", "automotive"]),
        industry: z.string().max(64).optional(),
        location: z.object({
          cityZip: z.string().min(3).max(128),
          radiusMiles: z.number().int().min(5).max(50),
        }),
        module: z.object({
          name: z.literal("SOCIAL_MEDIA_INTELLIGENCE"),
          cadence: z.enum(["LOW", "MEDIUM", "HIGH"]),
          mode: z.enum(["AUTO", "GUIDED", "CUSTOM"]),
          layers: z.object({
            weather: z.literal(true),
            sports: z.boolean(),
            community: z.boolean(),
            trends: z.boolean(),
          }),
        }),
        startTiming: z.enum(["NOW", "TWO_WEEKS", "EXPLORING"]),
        contact: z.object({
          name: z.string().min(2).max(255),
          email: z.string().email().max(320),
          phone: z.string().min(7).max(64),
        }),
        pricing: z.object({
          cadenceMonthly: z.number().int().min(0),
          layersMonthly: z.number().int().min(0),
          monthlyTotal: z.number().int().min(0),
          setupFee: z.number().int().min(0),
          enabledLayers: z.array(z.enum(["sports", "community", "trends"])),
        }),
        termsAccepted: z.literal(true),
        // New burden-focused fields (optional for backwards compatibility)
        burdens: z.array(z.enum(["website", "social_media", "visibility", "all_of_it", "not_sure"])).optional(),
        involvement: z.enum(["HANDLE_IT", "KEEP_ME_POSTED"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Generate preview token for intake
        const crypto = await import("crypto");
        const intakePreviewToken = `preview_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
        const suitePreviewToken = crypto.randomBytes(18).toString("hex");

        // Map suite vertical to intake vertical
        const verticalMap: Record<string, "trades" | "appointments" | "professional"> = {
          trades: "trades",
          health: "appointments",
          beauty: "appointments",
          food: "trades",
          cannabis: "trades",
          professional: "professional",
          fitness: "appointments",
          automotive: "trades",
        };
        const intakeVertical = verticalMap[input.vertical] || "trades";

        // AUTO-CREATE INTAKE IMMEDIATELY
        // This ensures customer gets their preview without waiting for admin
        const intake = await createIntake({
          businessName: input.contact.name, // Use contact name as business name initially
          contactName: input.contact.name,
          email: input.contact.email,
          phone: input.contact.phone,
          vertical: intakeVertical,
          language: input.language,
          audience: input.audience,
          websiteStatus: input.websiteStatus,
          services: input.industry ? [input.industry.replace(/_/g, " ")] : [],
          serviceArea: [input.location.cityZip],
          primaryCTA: "call",
          rawPayload: {
            source: "suite_application",
            language: input.language,
            cadence: input.module.cadence,
            mode: input.module.mode,
            layers: input.module.layers,
            pricing: input.pricing,
            startTiming: input.startTiming,
          },
        });

        if (!intake) throw new Error("Failed to create intake");

        // Update intake with preview token and set to ready_for_review
        await db.update(intakes)
          .set({ 
            status: "ready_for_review", 
            previewToken: intakePreviewToken 
          })
          .where(eq(intakes.id, intake.id));

        // Insert suite application with intake reference
        const [row] = await db.insert(suiteApplications).values({
          contactName: input.contact.name,
          contactEmail: input.contact.email,
          contactPhone: input.contact.phone,
          language: input.language,
          vertical: input.vertical,
          industry: input.industry,
          cityZip: input.location.cityZip,
          radiusMiles: input.location.radiusMiles,
          cadence: input.module.cadence,
          mode: input.module.mode,
          layers: input.module.layers,
          pricing: input.pricing,
          startTiming: input.startTiming,
          status: "approved", // Auto-approved since intake is created
          previewToken: suitePreviewToken,
          intakeId: intake.id,
        }).$returningId();

        // Send preview email to customer immediately
        try {
          await sendEmail(
            intake.id,
            "ready_for_review",
            {
              firstName: input.contact.name.split(" ")[0],
              businessName: input.contact.name,
              email: input.contact.email,
              previewUrl: absoluteUrl(`/preview/${intakePreviewToken}`),
              language: intake.language as any,
              audience: intake.audience as any,
            }
          );
        } catch (emailErr) {
          // Log but don't fail - customer can still access via success page
          console.error("[SuiteApply] Failed to send preview email:", emailErr);
        }

        // Notify owner of new application
        try {
          await notifyOwner({
            title: "New LaunchBase Application",
            content: `${input.contact.name} (${input.contact.email}) just submitted an application.\n\nBusiness: ${input.industry || input.vertical}\nLocation: ${input.location.cityZip}\nCadence: ${input.module.cadence}\nMonthly: $${input.pricing.monthlyTotal}/mo\nSetup: $${input.pricing.setupFee}\n\nPreview: /preview/${intakePreviewToken}`,
          });
        } catch (notifyErr) {
          console.error("[SuiteApply] Failed to notify owner:", notifyErr);
        }

        // Track analytics
        await trackEvent({
          eventName: "suite_application_submitted",
          metadata: {
            applicationId: row.id,
            intakeId: intake.id,
            vertical: input.vertical,
            industry: input.industry,
            language: input.language,
            cadence: input.module.cadence,
            mode: input.module.mode,
            enabledLayers: input.pricing.enabledLayers,
            monthlyTotal: input.pricing.monthlyTotal,
            startTiming: input.startTiming,
          },
        });

        return {
          applicationId: row.id,
          intakeId: intake.id,
          previewToken: intakePreviewToken,
        };
      }),

    // Get application by ID (for success page)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const [app] = await db
          .select()
          .from(suiteApplications)
          .where(eq(suiteApplications.id, input.id))
          .limit(1);

        return app ?? null;
      }),

    // Admin: List all applications
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["submitted", "ready_for_review", "preview_ready", "approved", "paid", "active", "rejected"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        if (input?.status) {
          const apps = await db.select().from(suiteApplications).where(eq(suiteApplications.status, input.status)).orderBy(desc(suiteApplications.createdAt));
          return apps;
        }

        const apps = await db.select().from(suiteApplications).orderBy(desc(suiteApplications.createdAt));
        return apps;
      }),

    // Admin: Update application status
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["submitted", "ready_for_review", "preview_ready", "approved", "paid", "active", "rejected"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(suiteApplications)
          .set({ 
            status: input.status,
            reviewedBy: ctx.user?.name || ctx.user?.email || "Admin",
          })
          .where(eq(suiteApplications.id, input.id));

        return { success: true };
      }),

    // Admin: Update admin notes
    setNotes: protectedProcedure
      .input(z.object({
        id: z.number(),
        adminNotes: z.string().max(5000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(suiteApplications)
          .set({ 
            adminNotes: input.adminNotes,
            reviewedBy: ctx.user?.name || ctx.user?.email || "Admin",
          })
          .where(eq(suiteApplications.id, input.id));

        return { success: true };
      }),

    // Admin: Approve application and create intake + build plan
    approveAndCreateIntake: protectedProcedure
      .input(z.object({
        id: z.number(),
        businessName: z.string().min(1).max(255),
        serviceArea: z.string().optional(),
        primaryCTA: z.enum(["call", "book", "quote", "contact"]).optional(),
        phone: z.string().optional(),
        autoBuildPlan: z.boolean().default(true),
        isBetaCustomer: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get the application
        const [app] = await db.select().from(suiteApplications).where(eq(suiteApplications.id, input.id)).limit(1);
        if (!app) throw new Error("Application not found");
        if (app.intakeId) throw new Error("Application already has an intake");

        // Map suite vertical to intake vertical
        const verticalMap: Record<string, "trades" | "appointments" | "professional"> = {
          trades: "trades",
          health: "appointments",
          beauty: "appointments",
          food: "trades",
          cannabis: "trades",
          professional: "professional",
          fitness: "appointments",
          automotive: "trades",
        };
        const intakeVertical = verticalMap[app.vertical] || "trades";

        // Use provided values or fall back to application data
        const serviceArea = input.serviceArea || app.cityZip;
        const phone = input.phone || app.contactPhone;
        const hasEmail = !!app.contactEmail;
        const hasPhone = !!phone;
        const hasLocation = !!serviceArea;

        // Check required fields for auto-build-plan
        const missingFields: string[] = [];
        if (!input.businessName?.trim()) missingFields.push("businessName");
        if (!input.primaryCTA) missingFields.push("primaryCTA");
        if (!hasEmail && !hasPhone) missingFields.push("contact"); // Need at least one contact method
        if (!hasLocation) missingFields.push("serviceArea");

        // If auto-build requested but fields missing, return structured error
        if (input.autoBuildPlan && missingFields.length > 0) {
          return {
            success: false,
            code: "MISSING_FIELDS" as const,
            missing: missingFields,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          };
        }

        // Create the intake
        const intake = await createIntake({
          businessName: input.businessName,
          contactName: app.contactName,
          email: app.contactEmail,
          phone: phone,
          vertical: intakeVertical,
          services: app.industry ? [app.industry.replace(/_/g, " ")] : [],
          serviceArea: serviceArea ? [serviceArea] : [],
          primaryCTA: input.primaryCTA || "call",
          rawPayload: {
            source: "suite_application",
            suiteApplicationId: app.id,
            language: app.language,
            cadence: app.cadence,
            mode: app.mode,
            layers: app.layers,
            pricing: app.pricing,
            startTiming: app.startTiming,
            isBetaCustomer: input.isBetaCustomer,
          },
        });

        if (!intake) throw new Error("Failed to create intake");

        let buildPlanId: number | null = null;
        let previewToken: string | null = null;

        // Auto-generate build plan if requested
        if (input.autoBuildPlan) {
          const plan = generateBuildPlan(intake);
          const buildPlan = await createBuildPlan({
            intakeId: intake.id,
            templateId: intakeVertical === "trades" ? "trades_v1" : 
                        intakeVertical === "appointments" ? "appointment_v2" : "professional_v1",
            plan,
            status: "draft",
          });
          buildPlanId = buildPlan?.id || null;

          // Generate preview token and update intake to ready_for_review
          previewToken = `preview_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          await db.update(intakes)
            .set({ status: "ready_for_review", previewToken })
            .where(eq(intakes.id, intake.id));
        }

        // Update the suite application with intake ID and status
        await db
          .update(suiteApplications)
          .set({ 
            status: "approved",
            intakeId: intake.id,
            reviewedBy: ctx.user?.name || ctx.user?.email || "Admin",
          })
          .where(eq(suiteApplications.id, input.id));

        // Send appropriate email based on whether build plan was generated
        if (input.autoBuildPlan && previewToken) {
          // Send ready for review email with preview link
          await sendEmail(
            intake.id,
            "ready_for_review",
            {
              firstName: app.contactName.split(" ")[0],
              businessName: input.businessName,
              email: app.contactEmail,
              previewUrl: absoluteUrl(`/preview/${previewToken}`),
              language: intake.language as any,
              audience: intake.audience as any,
            }
          );
        } else {
          // Send confirmation email
          await sendEmail(
            intake.id,
            "intake_confirmation",
            {
              firstName: app.contactName.split(" ")[0],
              businessName: input.businessName,
              email: app.contactEmail,
              language: intake.language as any,
              audience: intake.audience as any,
            }
          );
        }

        // Notify admin
        await AdminNotifications.newIntake(input.businessName, 100);

        return {
          success: true,
          intakeId: intake.id,
          buildPlanId,
          previewToken,
          autoBuildPlan: input.autoBuildPlan,
        };
      }),
  }),

  // Weather Intelligence Router - NWS API integration
  weather: router({
    // Get weather intelligence for a location
    getIntelligence: publicProcedure
      .input(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        businessType: z.string().optional(),
        businessName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const result = await getWeatherIntelligence(input);
        return result;
      }),

    // Generate a formatted Facebook post from weather intelligence
    generatePost: publicProcedure
      .input(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        businessType: z.string().optional(),
        businessName: z.string().optional(),
        includeEmoji: z.boolean().optional().default(true),
        includePoweredBy: z.boolean().optional().default(false),
      }))
      .query(async ({ input }) => {
        const intelligence = await getWeatherIntelligence({
          latitude: input.latitude,
          longitude: input.longitude,
          businessType: input.businessType,
          businessName: input.businessName,
        });

        const post = formatFacebookPost(intelligence, {
          includeEmoji: input.includeEmoji,
          includePoweredBy: input.includePoweredBy,
        });

        return {
          intelligence,
          formattedPost: post,
        };
      }),
  }),

  // Referral Analytics Router (badge clicks, conversion funnel)
  referralAnalytics: router({
    topSites: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(10),
        timeWindowDays: z.number().int().min(1).max(365).default(7),
        sortBy: z.enum(["clicks", "conversions"]).default("clicks"),
      }))
      .query(async ({ input }) => {
        return await getTopReferringSites(input.limit, input.timeWindowDays, input.sortBy);
      }),

    funnel: protectedProcedure
      .input(z.object({
        timeWindowDays: z.number().int().min(1).max(365).default(7),
      }))
      .query(async ({ input }) => {
        return await getConversionFunnel(input.timeWindowDays);
      }),

    clicks7d: protectedProcedure.query(async () => {
      return await get7DayClicks();
    }),

    logEvent: publicProcedure
      .input(z.object({
        eventType: z.enum(["share_opened", "share_copy_link", "share_qr_shown", "share_social_clicked"]),
        siteSlug: z.string().optional(),
        siteId: z.number().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        return await logReferralEvent({
          eventType: input.eventType,
          siteSlug: input.siteSlug,
          siteId: input.siteId,
          metadata: input.metadata,
        });
      }),
  }),

  // Facebook Router - Page posting and connection testing
  facebook: router({
    // Test Facebook connection
    testConnection: protectedProcedure.query(async () => {
      const result = await testFacebookConnection();
      return result;
    }),

    // Post to Facebook Page
    post: protectedProcedure
      .input(z.object({
        message: z.string().min(1).max(5000),
        link: z.string().url().optional(),
        imageUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            error: "Database unavailable",
          };
        }

        // Get Facebook connection for policy check
        const [connection] = await db.select().from(moduleConnections).where(
          and(
            eq(moduleConnections.userId, ctx.user.id),
            eq(moduleConnections.connectionType, "facebook_page")
          )
        ).limit(1);

        if (!connection || !connection.externalId) {
          return {
            success: false,
            error: "Facebook not connected",
          };
        }

        // Check Facebook posting policy
        const policyCheck = await checkFacebookPostingPolicy({
          customerId: ctx.user.id.toString(),
          pageId: connection.externalId,
          mode: "manual", // User explicitly posting
          postType: "OTHER", // Generic manual post
          confidence: null, // Manual posts don't have confidence
          now: new Date(),
        });

        // Handle policy decision
        if (policyCheck.action !== "PUBLISH") {
          return {
            success: false,
            error: policyCheck.reasons?.[0] || "Posting not allowed",
            action: policyCheck.action,
            reasons: policyCheck.reasons,
          };
        }

        // Policy allows - proceed with posting
        const result = await postToFacebook(input);

        if (result.success) {
          await trackEvent({
            eventName: "facebook_post_published",
            metadata: {
              userId: ctx.user.id,
              postId: result.postId,
              hasImage: !!input.imageUrl,
              hasLink: !!input.link,
            },
          });
        }

        return result;
      }),

    // Generate and post weather-aware content
    postWeatherAware: protectedProcedure
      .input(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        businessType: z.string().optional(),
        businessName: z.string().optional(),
        includeEmoji: z.boolean().optional().default(true),
        includePoweredBy: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) {
          return {
            posted: false,
            error: "Database unavailable",
            intelligence: null,
            formattedPost: "",
          };
        }

        // Get Facebook connection for policy check
        const [connection] = await db.select().from(moduleConnections).where(
          and(
            eq(moduleConnections.userId, ctx.user.id),
            eq(moduleConnections.connectionType, "facebook_page")
          )
        ).limit(1);

        if (!connection || !connection.externalId) {
          return {
            posted: false,
            error: "Facebook not connected",
            intelligence: null,
            formattedPost: "",
          };
        }

        // Get weather intelligence
        const intelligence = await getWeatherIntelligence({
          latitude: input.latitude,
          longitude: input.longitude,
          businessType: input.businessType,
          businessName: input.businessName,
        });

        // Check safety gate
        if (intelligence.safetyGate) {
          return {
            posted: false,
            error: "Safety gate active - severe weather conditions",
            intelligence,
            formattedPost: "",
          };
        }

        // Format post
        const message = formatFacebookPost(intelligence, {
          includeEmoji: input.includeEmoji,
          includePoweredBy: input.includePoweredBy,
        });

        // Check Facebook posting policy
        const policyCheck = await checkFacebookPostingPolicy({
          customerId: ctx.user.id.toString(),
          pageId: connection.externalId,
          mode: "manual", // User explicitly posting
          postType: "WEATHER_ALERT", // Weather-derived content
          confidence: null, // Manual posts don't have confidence
          now: new Date(),
        });

        // Handle policy decision
        if (policyCheck.action !== "PUBLISH") {
          // Pick top-line message based on action
          let topLineError = "Posting not allowed";
          if (policyCheck.action === "DRAFT") {
            topLineError = "Needs approval";
          } else if (policyCheck.action === "QUEUE") {
            topLineError = "Queued for next allowed window";
          } else if (policyCheck.action === "BLOCK") {
            topLineError = "Daily limit reached";
          }

          return {
            posted: false,
            postId: undefined,
            postUrl: undefined,
            error: topLineError,
            action: policyCheck.action,
            reasons: policyCheck.reasons ?? [],
            retryAt: policyCheck.retryAt,
            intelligence,
            formattedPost: message,
          };
        }

        // Policy allows - proceed with posting
        const result = await postToFacebook({ message });

        if (result.success) {
          await trackEvent({
            eventName: "weather_post_published",
            metadata: {
              userId: ctx.user.id,
              postId: result.postId,
              postType: intelligence.postType,
              urgency: intelligence.urgency,
            },
          });
        }

        return {
          posted: result.success,
          postId: result.postId,
          postUrl: result.postUrl,
          error: result.error,
          intelligence,
          formattedPost: message,
        };
      }),
  }),

  // Setup Packets Router - Integration setup packets for Google, Meta, QuickBooks
  setupPackets: router({
    // Generate packets for an intake
    generate: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { generateAllPackets } = await import("./services/setupPacketGenerator");
        const packets = await generateAllPackets(input.intakeId);
        
        if (!packets.google && !packets.meta && !packets.quickbooks) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Intake not found or no packets could be generated",
          });
        }

        return {
          success: true,
          packets,
        };
      }),

    // Get packets for an intake
    getForIntake: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
      }))
      .query(async ({ input }) => {
        const { generateAllPackets } = await import("./services/setupPacketGenerator");
        const packets = await generateAllPackets(input.intakeId);
        
        return {
          google: packets.google ? { status: "ready", packet: packets.google } : null,
          meta: packets.meta ? { status: "ready", packet: packets.meta } : null,
          quickbooks: packets.quickbooks ? { status: "ready", packet: packets.quickbooks } : null,
        };
      }),

    // Get a single packet by type
    getByType: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        integration: z.enum(["google_business", "meta", "quickbooks"]),
      }))
      .query(async ({ input }) => {
        const { generateSetupPacket } = await import("./services/setupPacketGenerator");
        const packet = await generateSetupPacket(input.intakeId, input.integration);
        
        if (!packet) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Packet not found",
          });
        }

        return {
          status: "ready",
          packet,
        };
      }),

    // Mark packet as in progress (customer started setup)
    markInProgress: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        integration: z.enum(["google_business", "meta", "quickbooks"]),
      }))
      .mutation(async ({ input, ctx }) => {
        // For now, just log the action - in future, store in DB
        console.log(`[SetupPacket] ${ctx.user?.email} marked ${input.integration} as in progress for intake ${input.intakeId}`);
        return { success: true, status: "in_progress" };
      }),

    // Mark packet as connected (integration complete)
    markConnected: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        integration: z.enum(["google_business", "meta", "quickbooks"]),
        externalAccountId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log(`[SetupPacket] ${ctx.user?.email} marked ${input.integration} as connected for intake ${input.intakeId}`);
        return { success: true, status: "connected", connectedAt: new Date() };
      }),

    // Get the current user's intake by email
    getMyIntake: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const userEmail = ctx.user.email;
        const [intake] = await db
          .select()
          .from(intakes)
          .where(eq(intakes.email, userEmail as string))
          .orderBy(desc(intakes.createdAt))
          .limit(1);
        return intake || null;
      }),

    // Get full checklist using the engine
    getChecklist: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
      }))
      .query(async ({ input }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const ctx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        const checklist = engine.computeChecklist(ctx);
        return checklist;
      }),

    // Recompute checklist with diff summary
    recompute: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        mode: z.enum(["safe", "full"]).optional().default("safe"),
      }))
      .mutation(async ({ input }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const ctx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        // For now, compute fresh (no existing checklist persistence yet)
        const before = null;
        const after = engine.computeChecklist(ctx, before || undefined);
        const diff = engine.diffChecklists(before, after);

        return {
          success: true,
          checklist: after,
          diff,
        };
      }),

    // Complete a step
    completeStep: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        stepId: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const businessCtx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        let checklist = engine.computeChecklist(businessCtx);
        checklist = engine.completeStep(checklist, input.stepId, ctx.user ? "customer" : "system");

        console.log(`[Checklist] Step ${input.stepId} completed for intake ${input.intakeId}`);
        return { success: true, checklist };
      }),

    // Reset a step
    resetStep: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        stepId: z.string(),
        cascade: z.boolean().optional().default(false),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const businessCtx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        let checklist = engine.computeChecklist(businessCtx);
        checklist = engine.resetStep(checklist, input.stepId, input.cascade);

        console.log(`[Checklist] Step ${input.stepId} reset for intake ${input.intakeId} (cascade: ${input.cascade}, reason: ${input.reason || "none"})`);
        return { success: true, checklist };
      }),

    // Lock a field
    lockField: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        fieldKey: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const businessCtx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        let checklist = engine.computeChecklist(businessCtx);
        checklist = engine.lockField(checklist, input.fieldKey, ctx.user ? "customer" : "system");

        console.log(`[Checklist] Field ${input.fieldKey} locked for intake ${input.intakeId}`);
        return { success: true, checklist };
      }),

    // Update a field value (auto-locks)
    updateField: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        fieldKey: z.string(),
        value: z.any(),
      }))
      .mutation(async ({ input, ctx }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const businessCtx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        let checklist = engine.computeChecklist(businessCtx);
        checklist = engine.updateFieldValue(checklist, input.fieldKey, input.value, ctx.user ? "customer" : "admin");

        console.log(`[Checklist] Field ${input.fieldKey} updated for intake ${input.intakeId}`);
        return { success: true, checklist };
      }),

    // Download setup packet as markdown (for PDF conversion)
    downloadPacket: protectedProcedure
      .input(z.object({
        intakeId: z.number(),
        platform: z.enum(["gbp", "meta", "qbo", "all"]),
      }))
      .mutation(async ({ input }) => {
        const engine = await import("./services/checklistEngine");
        const intake = await getIntakeById(input.intakeId);
        
        if (!intake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intake not found" });
        }

        const businessCtx = {
          intakeId: intake.id,
          businessName: intake.businessName,
          zip: undefined,
          trades: [] as string[],
          primaryTrade: intake.vertical,
          phone: intake.phone || undefined,
          email: intake.email,
          services: intake.services || [],
          serviceArea: intake.serviceArea || [],
          tagline: intake.tagline || undefined,
          tone: "balanced" as const,
        };

        const checklist = engine.computeChecklist(businessCtx);
        
        // Generate markdown content
        const generatePlatformMarkdown = (platformId: string, platformName: string) => {
          const steps = checklist.steps.filter((s: any) => s.stepId.startsWith(platformId));
          const fields = Object.entries(checklist.fields).filter(([k]) => k.startsWith(platformId));
          
          let md = `# ${platformName} Setup Packet\n\n`;
          md += `**Business:** ${intake.businessName}\n`;
          md += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
          md += `---\n\n`;
          
          md += `## Fields\n\n`;
          for (const [key, field] of fields) {
            const f = field as any;
            md += `### ${f.label}\n`;
            md += `**Value:** ${f.value || "(not set)"}\n`;
            md += `**Confidence:** ${Math.round((f.confidence || 0) * 100)}%\n`;
            md += `**Source:** ${f.source || "system"}\n\n`;
          }
          
          md += `## Setup Steps\n\n`;
          for (const step of steps) {
            const s = step as any;
            md += `### ${s.title}\n`;
            md += `${s.description}\n\n`;
            if (s.deepLink) {
              md += `**Link:** ${s.deepLink}\n\n`;
            }
          }
          
          md += `---\n\n`;
          md += `*You can regenerate this packet anytime from LaunchBase.*\n`;
          
          return md;
        };

        const platformNames: Record<string, string> = {
          gbp: "Google Business Profile",
          meta: "Facebook & Instagram",
          qbo: "QuickBooks Online",
        };

        if (input.platform === "all") {
          // Generate combined markdown
          let combined = `# Setup Packets for ${intake.businessName}\n\n`;
          combined += `Generated: ${new Date().toLocaleDateString()}\n\n`;
          combined += `---\n\n`;
          
          for (const [id, name] of Object.entries(platformNames)) {
            combined += generatePlatformMarkdown(id, name);
            combined += `\n\n`;
          }
          
          return { 
            filename: `setup-packets-${intake.businessName.toLowerCase().replace(/\s+/g, "-")}.md`,
            content: combined,
          };
        } else {
          const md = generatePlatformMarkdown(input.platform, platformNames[input.platform]);
          return {
            filename: `${input.platform}-setup-${intake.businessName.toLowerCase().replace(/\s+/g, "-")}.md`,
            content: md,
          };
        }
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
