/**
 * Platform-level routes — reserved for cross-cutting platform endpoints (health, version, etc.).
 * Core routes are mounted via _incoming_routers.
 */

import { router, publicProcedure } from "./_core/trpc";

export const platformRouter = router({
  /**
   * Health check endpoint — returns system health metrics
   */
  health: publicProcedure.query(async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }),

  /**
   * Version endpoint — returns application version and environment info
   */
  version: publicProcedure.query(async () => {
    return {
      version: process.env.APP_VERSION ?? "0.0.0-dev",
      environment: process.env.NODE_ENV ?? "development",
      buildDate: process.env.BUILD_DATE ?? null,
    };
  }),
});
