/**
 * Agent stack management — runtime-populated by agent-stack at connection time.
 * Tools registry and agent configuration are managed by the external agent process.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { agentRuntimeStatus, vertexProfiles } from "../../db/schema";
import { desc, isNotNull } from "drizzle-orm";

export const agentStackRouter = router({
  /**
   * Get the latest agent runtime status
   */
  getStatus: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const [status] = await db
      .select()
      .from(agentRuntimeStatus)
      .orderBy(desc(agentRuntimeStatus.lastSeen))
      .limit(1);

    return status ?? null;
  }),

  /**
   * List connected tools from vertex profiles
   */
  listConnectedTools: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { tools: [] };

    const profiles = await db
      .select()
      .from(vertexProfiles)
      .where(isNotNull(vertexProfiles.toolsAllowlistJson));

    const tools = profiles.flatMap((profile) => {
      const toolsList = profile.toolsAllowlistJson ?? [];
      return toolsList.map((toolName) => ({
        name: toolName,
        description: `Tool from ${profile.name}`,
        profileId: profile.id,
      }));
    });

    return { tools };
  }),

  /**
   * List recent runtime status history
   */
  listRuntimeHistory: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { statuses: [] };

    const statuses = await db
      .select()
      .from(agentRuntimeStatus)
      .orderBy(desc(agentRuntimeStatus.lastSeen))
      .limit(50);

    return { statuses };
  }),
});
