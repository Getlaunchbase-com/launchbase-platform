/**
 * Agent Instances + Vertex Profiles tRPC Router
 *
 * Admin CRUD for vertex profiles (reusable agent configs) and
 * per-project agent instances. Secrets are stored encrypted and
 * never returned raw — only key names + existence are exposed.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  vertexProfiles,
  agentInstances,
  agentInstanceSecrets,
  projects,
} from "../../db/schema";
import { desc, eq, and, count } from "drizzle-orm";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// In production, AGENT_SECRET_KEY should come from a vault / KMS.
// ---------------------------------------------------------------------------

const SECRET_KEY_ENV = "AGENT_SECRET_KEY";

function getEncryptionKey(): Buffer {
  const raw = process.env[SECRET_KEY_ENV] ?? "dev-placeholder-key-32-bytes!!";
  return createHash("sha256").update(raw).digest(); // always 32 bytes
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext (all hex)
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decrypt(blob: string): string {
  const [ivHex, tagHex, dataHex] = blob.split(":");
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(dataHex, "hex")) + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Vertex Profiles Router
// ---------------------------------------------------------------------------

export const vertexProfilesRouter = router({
  /** List all vertex profiles */
  list: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { profiles: [], total: 0 };

      const rows = await db
        .select()
        .from(vertexProfiles)
        .orderBy(desc(vertexProfiles.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db.select({ total: count() }).from(vertexProfiles);

      return { profiles: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single vertex profile */
  get: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(vertexProfiles)
        .where(eq(vertexProfiles.id, input.id))
        .limit(1);

      return row ?? null;
    }),

  /** Create a vertex profile */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        configJson: z.record(z.string(), z.unknown()).optional(),
        toolsAllowlistJson: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [result] = await db.insert(vertexProfiles).values({
        name: input.name,
        description: input.description ?? null,
        configJson: input.configJson ?? null,
        toolsAllowlistJson: input.toolsAllowlistJson ?? null,
      });

      return { id: result.insertId, name: input.name };
    }),

  /** Update a vertex profile */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        configJson: z.record(z.string(), z.unknown()).optional(),
        toolsAllowlistJson: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.configJson !== undefined) updates.configJson = input.configJson;
      if (input.toolsAllowlistJson !== undefined)
        updates.toolsAllowlistJson = input.toolsAllowlistJson;

      if (Object.keys(updates).length === 0) return { success: true };

      await db
        .update(vertexProfiles)
        .set(updates)
        .where(eq(vertexProfiles.id, input.id));

      return { success: true, id: input.id };
    }),

  /** Delete a vertex profile */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.delete(vertexProfiles).where(eq(vertexProfiles.id, input.id));
      return { success: true };
    }),
});

// ---------------------------------------------------------------------------
// Agent Instances Router
// ---------------------------------------------------------------------------

export const agentInstancesRouter = router({
  /** List instances, optionally filtered by project */
  list: adminProcedure
    .input(
      z.object({
        projectId: z.number().int().optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { instances: [], total: 0 };

      const conditions: any[] = [];
      if (input.projectId) conditions.push(eq(agentInstances.projectId, input.projectId));
      if (input.status) conditions.push(eq(agentInstances.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(agentInstances)
        .where(where)
        .orderBy(desc(agentInstances.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentInstances)
        .where(where);

      return { instances: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single instance with its vertex profile */
  get: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [instance] = await db
        .select()
        .from(agentInstances)
        .where(eq(agentInstances.id, input.id))
        .limit(1);

      if (!instance) return null;

      const [vertex] = await db
        .select()
        .from(vertexProfiles)
        .where(eq(vertexProfiles.id, instance.vertexId))
        .limit(1);

      // Return secret key names only — never the values
      const secrets = await db
        .select({
          id: agentInstanceSecrets.id,
          key: agentInstanceSecrets.key,
          createdAt: agentInstanceSecrets.createdAt,
        })
        .from(agentInstanceSecrets)
        .where(eq(agentInstanceSecrets.instanceId, input.id));

      return { ...instance, vertex: vertex ?? null, secretKeys: secrets };
    }),

  /** Create an agent instance */
  create: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        vertexId: z.number().int(),
        displayName: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify project exists
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new Error("Project not found");

      // Verify vertex exists
      const [vertex] = await db
        .select({ id: vertexProfiles.id })
        .from(vertexProfiles)
        .where(eq(vertexProfiles.id, input.vertexId))
        .limit(1);
      if (!vertex) throw new Error("Vertex profile not found");

      const userId = (ctx as any).user?.id ?? 0;

      const [result] = await db.insert(agentInstances).values({
        projectId: input.projectId,
        vertexId: input.vertexId,
        displayName: input.displayName,
        status: "active",
        createdBy: userId,
      });

      return { id: result.insertId, displayName: input.displayName };
    }),

  /** Update instance status or display name */
  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        displayName: z.string().min(1).max(255).optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        vertexId: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.status !== undefined) updates.status = input.status;
      if (input.vertexId !== undefined) updates.vertexId = input.vertexId;

      if (Object.keys(updates).length === 0) return { success: true };

      await db
        .update(agentInstances)
        .set(updates)
        .where(eq(agentInstances.id, input.id));

      return { success: true, id: input.id };
    }),

  /** Delete an instance */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Delete secrets first
      await db
        .delete(agentInstanceSecrets)
        .where(eq(agentInstanceSecrets.instanceId, input.id));

      await db.delete(agentInstances).where(eq(agentInstances.id, input.id));
      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Secrets management (encrypted key/value per instance)
  // -------------------------------------------------------------------------

  /** List secret keys for an instance (keys only — never values) */
  listSecrets: adminProcedure
    .input(z.object({ instanceId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { secrets: [] };

      const rows = await db
        .select({
          id: agentInstanceSecrets.id,
          key: agentInstanceSecrets.key,
          createdAt: agentInstanceSecrets.createdAt,
        })
        .from(agentInstanceSecrets)
        .where(eq(agentInstanceSecrets.instanceId, input.instanceId))
        .orderBy(agentInstanceSecrets.key);

      return { secrets: rows };
    }),

  /** Set (upsert) a secret for an instance */
  setSecret: adminProcedure
    .input(
      z.object({
        instanceId: z.number().int(),
        key: z.string().min(1).max(255),
        value: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const encryptedValue = encrypt(input.value);

      // Check if key already exists for this instance
      const [existing] = await db
        .select({ id: agentInstanceSecrets.id })
        .from(agentInstanceSecrets)
        .where(
          and(
            eq(agentInstanceSecrets.instanceId, input.instanceId),
            eq(agentInstanceSecrets.key, input.key)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(agentInstanceSecrets)
          .set({ encryptedValue })
          .where(eq(agentInstanceSecrets.id, existing.id));
      } else {
        await db.insert(agentInstanceSecrets).values({
          instanceId: input.instanceId,
          key: input.key,
          encryptedValue,
        });
      }

      return { success: true, key: input.key };
    }),

  /** Delete a secret */
  deleteSecret: adminProcedure
    .input(
      z.object({
        instanceId: z.number().int(),
        key: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .delete(agentInstanceSecrets)
        .where(
          and(
            eq(agentInstanceSecrets.instanceId, input.instanceId),
            eq(agentInstanceSecrets.key, input.key)
          )
        );

      return { success: true };
    }),
});
