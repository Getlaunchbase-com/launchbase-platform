/**
 * Shared Constants
 *
 * Values used by both client and server. Keep this file dependency-free.
 */

/** Name of the session cookie */
export const COOKIE_NAME = "lb_session";

/** Available tenant identifiers */
export type Tenant = "launchbase" | "vinces";

/** Verticals supported by the platform */
export const VERTICALS = ["trades", "appointments", "professional"] as const;
export type Vertical = (typeof VERTICALS)[number];

/** Module setup step statuses */
export const SETUP_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
] as const;
export type SetupStatus = (typeof SETUP_STATUSES)[number];
