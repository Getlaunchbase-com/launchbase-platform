/**
 * Express App Configuration
 * 
 * This file exports the Express app WITHOUT starting the server.
 * This allows tests to import the app without binding to ports.
 * 
 * The server is started in index.ts.
 * 
 * Route Order (Critical):
 * 1. Stripe webhook (raw body MUST be first)
 * 2. Global body parsers
 * 3. All /api routes (worker, cron, OAuth, tRPC)
 * 4. API guard (MUST be last - catches unmatched /api/*)
 * 
 * The API guard is a platform invariant that prevents /api/* from falling
 * through to SPA/static serving. It MUST return JSON 404, never HTML.
 */

import express from "express";
import type { Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerFacebookOAuthRoutes } from "./facebookOAuthRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleStripeWebhook } from "../stripe/webhook";
import { handleDeploymentWorker } from "../worker/deploymentWorker";
import { handleAutoAdvanceWorker } from "../worker/autoAdvanceWorker";
import { 
  handleCronRunNextDeploy, 
  handleCronAutoAdvance, 
  handleCronHealth, 
  handleCronMethodNotAllowed 
} from "../worker/cronEndpoints";
import { logReferralEvent } from "../referral";
import { getDb } from "../db";
import { deployments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * In-memory counter for deprecated endpoint hits
 * Resets on server restart (acceptable for short migration window)
 * Exposed via /api/cron/health for queryable telemetry
 */
const deprecatedHits: Record<string, number> = {};

function recordDeprecatedHit(path: string) {
  deprecatedHits[path] = (deprecatedHits[path] ?? 0) + 1;
}

/**
 * Get current deprecated hit counts (for health endpoint)
 */
export function getDeprecatedHits(): Record<string, number> {
  return { ...deprecatedHits };
}

/**
 * Helper: add deprecation headers for old worker endpoints
 * These endpoints exist only for back-compat during migration to /api/cron/*
 */
function withDeprecationHeaders(
  handler: (req: express.Request, res: express.Response) => unknown | Promise<unknown>,
  usePath: string
) {
  return async (req: express.Request, res: express.Response) => {
    recordDeprecatedHit(req.path);
    console.warn(`[Deprecated] ${new Date().toISOString()} ${req.path} called. Use ${usePath} instead.`);
    res.setHeader("X-LaunchBase-Deprecated", "true");
    res.setHeader("X-LaunchBase-Use", usePath);
    res.setHeader("X-LaunchBase-Removal", "after migration");
    return await handler(req, res);
  };
}

export function createApp(): Express {
  const app = express();

  // 1. Stripe webhook (raw body MUST be first, before body parsers)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

  // 2. Global body parsers (for all other routes)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // 3. Worker endpoints (back-compat with deprecation headers)
  // These will be removed after migration to /api/cron/*
  app.post(
    "/api/worker/run-next-deploy",
    withDeprecationHeaders(handleDeploymentWorker, "/api/cron/run-next-deploy")
  );
  app.post(
    "/api/worker/auto-advance",
    withDeprecationHeaders(handleAutoAdvanceWorker, "/api/cron/auto-advance")
  );

  // 4. Canonical cron endpoints (POST-only, except health)
  // These are the ONLY endpoints external cron jobs should use
  app.post("/api/cron/run-next-deploy", handleCronRunNextDeploy);
  app.post("/api/cron/auto-advance", handleCronAutoAdvance);
  
  // Explicit 405 for GET (prevents false success / SPA fallthrough confusion)
  app.get("/api/cron/run-next-deploy", handleCronMethodNotAllowed);
  app.get("/api/cron/auto-advance", handleCronMethodNotAllowed);
  
  // Health stays GET
  app.get("/api/cron/health", handleCronHealth);

  // 5. Referral redirect endpoint: /r/{siteSlug}
  // Logs badge click and redirects to homepage with UTM params
  app.get("/r/:siteSlug", async (req, res) => {
    try {
      const { siteSlug } = req.params;
      const userAgent = req.headers["user-agent"] || "";
      const referrer = req.headers["referer"] || "";
      const ipAddress = req.ip || req.socket.remoteAddress || "";

      // Look up site ID from deployments
      let siteId: number | undefined;
      try {
        const db = await getDb();
        if (db) {
          const [deployment] = await db
            .select()
            .from(deployments)
            .where(eq(deployments.siteId, siteSlug))
            .limit(1);
          if (deployment) {
            siteId = deployment.id;
          }
        }
      } catch (e) {
        console.error("[Referral] Failed to look up site:", e);
      }

      // Generate referral ID for tracking
      const referralId = `rb_${siteSlug}_${siteId || "unknown"}`;

      // Log the badge click event
      await logReferralEvent({
        eventType: "badge_click",
        siteSlug,
        siteId,
        referralId,
        userAgent,
        referrer,
        ipAddress,
        utmSource: "launchbase_badge",
        utmMedium: "referral",
        utmCampaign: "powered_by",
        utmContent: siteSlug,
      });

      // Redirect to homepage with UTM params
      const redirectUrl = `https://getlaunchbase.com/?utm_source=launchbase_badge&utm_medium=referral&utm_campaign=powered_by&utm_content=${encodeURIComponent(siteSlug)}&ref=${encodeURIComponent(referralId)}`;
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[Referral] Redirect error:", error);
      // Fallback redirect without tracking
      res.redirect(302, "https://getlaunchbase.com/");
    }
  });

  // 6. OAuth routes
  registerOAuthRoutes(app);
  registerFacebookOAuthRoutes(app);

  // 7. tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // 8. CRITICAL: API guard (MUST be after all /api routes)
  // This prevents /api/* from falling through to SPA/static serving
  // MUST return JSON 404, never HTML
  app.all("/api/*", (_req, res) => {
    res.status(404).json({ ok: false, error: "api_route_not_found" });
  });

  return app;
}
