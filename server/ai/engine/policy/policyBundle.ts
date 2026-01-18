/**
 * Policy Bundle — Static Imports (No FS Reads)
 * 
 * All policies are bundled at build time via static imports.
 * This ensures deterministic loading in serverless/production environments.
 */

import launchbasePortalV1 from "./policies/launchbase_portal_v1.json";
import swarmPremiumV1 from "./policies/swarm_premium_v1.json";
import aiButlerConsumerV1 from "./policies/ai_butler_consumer_v1.json";

/**
 * All policies (static bundle)
 * 
 * Add new policies here as they are created.
 */
export const ALL_POLICIES: unknown[] = [
  launchbasePortalV1,
  swarmPremiumV1,
  aiButlerConsumerV1,
];
