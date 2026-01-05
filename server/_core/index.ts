import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerFacebookOAuthRoutes } from "./facebookOAuthRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe/webhook";
import { handleDeploymentWorker } from "../worker/deploymentWorker";
import { handleAutoAdvanceWorker } from "../worker/autoAdvanceWorker";
import { handleCronRunNextDeploy, handleCronAutoAdvance, handleCronHealth } from "../worker/cronEndpoints";
import { logReferralEvent } from "../referral";
import { getDb } from "../db";
import { deployments } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook needs raw body for signature verification
  // MUST be registered BEFORE express.json()
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Deployment worker endpoint (protected by token)
  app.post("/api/worker/run-next-deploy", express.json(), handleDeploymentWorker);
  
  // Auto-advance worker endpoint (protected by token)
  // Automatically advances stuck suite applications after delay
  app.post("/api/worker/auto-advance", express.json(), handleAutoAdvanceWorker);

  // Cron-safe GET endpoints (for cron-job.org)
  // These use Bearer token auth and return JSON only
  app.get("/api/cron/run-next-deploy", handleCronRunNextDeploy);
  app.get("/api/cron/auto-advance", handleCronAutoAdvance);
  app.get("/api/cron/health", handleCronHealth);

  // Referral redirect endpoint: /r/{siteSlug}
  // Logs badge click and redirects to homepage with UTM params
  app.get("/r/:siteSlug", async (req, res) => {
    try {
      const { siteSlug } = req.params;
      const userAgent = req.headers["user-agent"] || "";
      const referrer = req.headers["referer"] || "";
      const ipAddress = req.ip || req.socket.remoteAddress || "";

      // Look up site ID from deployments (siteSlug is passed in URL, maps to siteId in deployments)
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
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Facebook OAuth routes
  registerFacebookOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
