/**
 * System Version Marker
 * 
 * This version is included in all API responses, webhook payloads, and admin UI
 * to enable correlation of behavior with specific builds.
 * 
 * Increment this version when making significant changes to:
 * - Email automation logic
 * - Action request flow
 * - Webhook processing
 * - Admin mutations
 */

export const SYSTEM_VERSION = "1.0.0-action-requests";

/**
 * Build metadata for debugging and correlation
 */
export function getSystemMeta() {
  return {
    version: SYSTEM_VERSION,
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    nodeVersion: process.version,
  };
}
