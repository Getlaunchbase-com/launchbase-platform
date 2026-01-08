/**
 * Tenant Type Definition
 * 
 * Defines tenant types for multi-tenant health dashboard filtering.
 * LaunchBase platform vs customer instances (e.g., Vince's Snowplow).
 */

export const TENANTS = ["launchbase", "vinces"] as const;
export type Tenant = typeof TENANTS[number];

/**
 * Normalize tenant input to canonical form
 * Handles variations like "vince", "vincessnowplow", etc.
 */
export function normalizeTenant(input: string | null | undefined): Tenant | null {
  if (!input) return null;
  const v = input.toLowerCase();
  if (v === "launchbase") return "launchbase";
  if (v === "vinces" || v === "vince" || v === "vincessnowplow") return "vinces";
  return null;
}

/**
 * Derive tenant from email domain (single source of truth)
 * Used for automatic tenant assignment in intake/email creation
 */
export function deriveTenantFromEmail(email?: string | null): Tenant {
  if (!email) return "launchbase";
  if (email.toLowerCase().endsWith("@vincessnowplow.com")) return "vinces";
  return "launchbase";
}
