/**
 * System Router — Health, version, and status endpoints
 *
 * Public endpoints for infrastructure checks (load balancers, uptime monitors).
 */

import { router, publicProcedure } from "./trpc";
import { getFreezeStatus } from "../contracts/freeze_governance";

export const systemRouter = router({
  /** Basic health check — returns 200 if the process is alive */
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })),

  /** Version and build info */
  version: publicProcedure.query(() => ({
    version: process.env.APP_VERSION || "0.0.0-dev",
    commit: process.env.GIT_COMMIT || "unknown",
    node: process.version,
    env: process.env.NODE_ENV || "development",
  })),

  /** Freeze governance status — public for transparency */
  freezeStatus: publicProcedure.query(() => getFreezeStatus()),
});
