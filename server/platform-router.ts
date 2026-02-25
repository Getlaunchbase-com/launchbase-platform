/**
 * Platform-level routes — reserved for cross-cutting platform endpoints (health, version, etc.).
 * Core routes are mounted via _incoming_routers.
 */

import { router } from "./_core/trpc";

export const platformRouter = router({});
