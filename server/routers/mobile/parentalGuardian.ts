/**
 * Parental Guardian Mobile Router
 *
 * Provides endpoints for the Parental Guardian app:
 *   - Pairing: create/redeem pairing sessions
 *   - Policies: CRUD for family policies
 *   - Schedules: CRUD for time-based schedules
 *   - Approvals: ward submits requests, guardian resolves
 *   - Control: pause internet, toggle study mode
 *   - Heartbeat: ward device health checks
 *   - Activity: event logging
 */

import { z } from "zod";
import { router, publicProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import {
  pgFamilies,
  pgFamilyMembers,
  pgPolicies,
  pgSchedules,
  pgApprovalRequests,
  pgActivityLog,
  pgDeviceHeartbeats,
  mobileSessions,
} from "../../db/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

async function validateMobileToken(token: string | undefined) {
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing session token." });
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

  const [session] = await db
    .select()
    .from(mobileSessions)
    .where(eq(mobileSessions.token, token))
    .limit(1);

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session token." });
  }
  if (session.status !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired or revoked." });
  }
  return session;
}

async function requireFamilyMember(userId: number, familyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

  const [member] = await db
    .select()
    .from(pgFamilyMembers)
    .where(and(eq(pgFamilyMembers.userId, userId), eq(pgFamilyMembers.familyId, familyId)))
    .limit(1);

  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this family." });
  }
  return member;
}

// ───────────────────────────────────────────────────────────────────────
// Router
// ───────────────────────────────────────────────────────────────────────

export const mobileParentalGuardianRouter = router({
  // ─── Pairing ─────────────────────────────────────────────────────

  /** Guardian: create a new family + pairing code */
  createPairingSession: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyName: z.string().min(1).max(255).default("My Family"),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Create or find existing family for this guardian
      let familyId: number;
      const [existingMember] = await db
        .select()
        .from(pgFamilyMembers)
        .where(and(eq(pgFamilyMembers.userId, session.userId), eq(pgFamilyMembers.role, "guardian")))
        .limit(1);

      if (existingMember) {
        familyId = existingMember.familyId;
      } else {
        const [family] = await db.insert(pgFamilies).values({ name: input.familyName });
        familyId = family.insertId;

        await db.insert(pgFamilyMembers).values({
          familyId,
          userId: session.userId,
          role: "guardian",
        });
      }

      const pairingCode = randomBytes(3).toString("hex").toUpperCase(); // 6-char code
      return { familyId, pairingCode };
    }),

  /** Ward: redeem pairing code to join a family */
  redeemPairingCode: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      pairingCode: z.string().length(6),
      deviceId: z.string().min(1).max(128),
      deviceName: z.string().min(1).max(255).default("Child Device"),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Find a family with a guardian (simplified — in production, validate the pairing code against a temporary store)
      const [guardian] = await db
        .select()
        .from(pgFamilyMembers)
        .where(eq(pgFamilyMembers.role, "guardian"))
        .limit(1);

      if (!guardian) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid pairing code." });
      }

      // Add ward to the family
      await db.insert(pgFamilyMembers).values({
        familyId: guardian.familyId,
        userId: session.userId,
        role: "ward",
        deviceId: input.deviceId,
        deviceName: input.deviceName,
      });

      return { familyId: guardian.familyId, paired: true };
    }),

  // ─── Policies ────────────────────────────────────────────────────

  /** Get active policies for a family */
  getActivePolicies: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
    }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      await requireFamilyMember(session.userId, input.familyId);
      const db = await getDb();
      if (!db) return { policies: [] };

      const policies = await db
        .select()
        .from(pgPolicies)
        .where(and(eq(pgPolicies.familyId, input.familyId), eq(pgPolicies.isActive, true)))
        .orderBy(desc(pgPolicies.createdAt));

      return { policies };
    }),

  /** Create or update a policy */
  upsertPolicy: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      policyId: z.number().int().optional(),
      type: z.enum(["allowlist", "blocklist", "category", "schedule"]),
      name: z.string().min(1).max(255),
      rules: z.array(z.object({
        target: z.string(),
        action: z.enum(["allow", "block", "require_approval"]),
        ttl: z.number().int().optional(),
        expiresAt: z.string().optional(),
        reason: z.string().optional(),
      })),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can manage policies." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      if (input.policyId) {
        await db
          .update(pgPolicies)
          .set({ type: input.type, name: input.name, rules: input.rules, isActive: input.isActive })
          .where(and(eq(pgPolicies.id, input.policyId), eq(pgPolicies.familyId, input.familyId)));
        return { id: input.policyId, updated: true };
      } else {
        const [result] = await db.insert(pgPolicies).values({
          familyId: input.familyId,
          type: input.type,
          name: input.name,
          rules: input.rules,
          isActive: input.isActive,
        });
        return { id: result.insertId, created: true };
      }
    }),

  /** Delete a policy */
  deletePolicy: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      policyId: z.number().int(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can manage policies." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      await db
        .delete(pgPolicies)
        .where(and(eq(pgPolicies.id, input.policyId), eq(pgPolicies.familyId, input.familyId)));

      return { deleted: true };
    }),

  // ─── Schedules ───────────────────────────────────────────────────

  /** List schedules for a family */
  listSchedules: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
    }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      await requireFamilyMember(session.userId, input.familyId);
      const db = await getDb();
      if (!db) return { schedules: [] };

      const schedules = await db
        .select()
        .from(pgSchedules)
        .where(eq(pgSchedules.familyId, input.familyId))
        .orderBy(desc(pgSchedules.createdAt));

      return { schedules };
    }),

  /** Create or update a schedule */
  upsertSchedule: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      scheduleId: z.number().int().optional(),
      name: z.string().min(1).max(255),
      days: z.array(z.number().int().min(0).max(6)),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      policyOverrides: z.array(z.object({
        target: z.string(),
        action: z.enum(["allow", "block", "require_approval"]),
        reason: z.string().optional(),
      })),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can manage schedules." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      if (input.scheduleId) {
        await db
          .update(pgSchedules)
          .set({
            name: input.name,
            days: input.days,
            startTime: input.startTime,
            endTime: input.endTime,
            policyOverrides: input.policyOverrides,
            isActive: input.isActive,
          })
          .where(and(eq(pgSchedules.id, input.scheduleId), eq(pgSchedules.familyId, input.familyId)));
        return { id: input.scheduleId, updated: true };
      } else {
        const [result] = await db.insert(pgSchedules).values({
          familyId: input.familyId,
          name: input.name,
          days: input.days,
          startTime: input.startTime,
          endTime: input.endTime,
          policyOverrides: input.policyOverrides,
          isActive: input.isActive,
        });
        return { id: result.insertId, created: true };
      }
    }),

  /** Delete a schedule */
  deleteSchedule: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      scheduleId: z.number().int(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can manage schedules." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      await db
        .delete(pgSchedules)
        .where(and(eq(pgSchedules.id, input.scheduleId), eq(pgSchedules.familyId, input.familyId)));

      return { deleted: true };
    }),

  // ─── Approval Requests ──────────────────────────────────────────

  /** List approval requests for a family */
  listApprovals: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      status: z.enum(["pending", "approved", "denied", "expired"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      await requireFamilyMember(session.userId, input.familyId);
      const db = await getDb();
      if (!db) return { requests: [], total: 0 };

      const conditions = [eq(pgApprovalRequests.familyId, input.familyId)];
      if (input.status) {
        conditions.push(eq(pgApprovalRequests.status, input.status));
      }

      const requests = await db
        .select()
        .from(pgApprovalRequests)
        .where(and(...conditions))
        .orderBy(desc(pgApprovalRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(pgApprovalRequests)
        .where(and(...conditions));

      return { requests, total: countResult?.total ?? 0 };
    }),

  /** Ward: submit an access request */
  createApproval: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      deviceId: z.string().min(1).max(128),
      url: z.string().min(1),
      category: z.string().min(1).max(64),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      await requireFamilyMember(session.userId, input.familyId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const [result] = await db.insert(pgApprovalRequests).values({
        familyId: input.familyId,
        childDeviceId: input.deviceId,
        url: input.url,
        category: input.category,
        reason: input.reason,
      });

      return { id: result.insertId, status: "pending" };
    }),

  /** Guardian: resolve an approval request */
  resolveApproval: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      requestId: z.number().int(),
      status: z.enum(["approved", "denied"]),
      ttl: z.number().int().optional(), // minutes
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can resolve requests." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      await db
        .update(pgApprovalRequests)
        .set({
          status: input.status,
          ttl: input.ttl,
          resolvedBy: String(session.userId),
          resolvedAt: new Date(),
        })
        .where(and(
          eq(pgApprovalRequests.id, input.requestId),
          eq(pgApprovalRequests.familyId, input.familyId),
        ));

      return { resolved: true, status: input.status };
    }),

  // ─── Remote Control ──────────────────────────────────────────────

  /** Guardian: pause/resume internet for a ward */
  controlPause: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      paused: z.boolean(),
      durationMinutes: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can control devices." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Log the control action
      await db.insert(pgActivityLog).values({
        familyId: input.familyId,
        deviceId: "guardian",
        eventType: input.paused ? "internet_paused" : "internet_resumed",
        metadata: { durationMinutes: input.durationMinutes, userId: session.userId },
      });

      return { paused: input.paused, durationMinutes: input.durationMinutes };
    }),

  /** Guardian: toggle study mode */
  controlStudyMode: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      active: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const member = await requireFamilyMember(session.userId, input.familyId);
      if (member.role !== "guardian") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only guardians can control devices." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      await db.insert(pgActivityLog).values({
        familyId: input.familyId,
        deviceId: "guardian",
        eventType: input.active ? "study_mode_on" : "study_mode_off",
        metadata: { userId: session.userId },
      });

      return { studyMode: input.active };
    }),

  // ─── Heartbeat ───────────────────────────────────────────────────

  /** Ward: send heartbeat */
  heartbeatPing: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      deviceId: z.string().min(1).max(128),
      familyId: z.number().int(),
      protectionStatus: z.enum(["active", "warning", "disabled"]).default("active"),
      appState: z.string().max(32).optional(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Upsert heartbeat
      await db
        .insert(pgDeviceHeartbeats)
        .values({
          deviceId: input.deviceId,
          familyId: input.familyId,
          protectionStatus: input.protectionStatus,
          appState: input.appState,
        })
        .onDuplicateKeyUpdate({
          set: {
            lastSeen: new Date(),
            protectionStatus: input.protectionStatus,
            appState: input.appState,
          },
        });

      return { received: true };
    }),

  /** Guardian: check ward device status */
  heartbeatStatus: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
    }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      await requireFamilyMember(session.userId, input.familyId);
      const db = await getDb();
      if (!db) return { devices: [] };

      const devices = await db
        .select()
        .from(pgDeviceHeartbeats)
        .where(eq(pgDeviceHeartbeats.familyId, input.familyId));

      return {
        devices: devices.map((d) => ({
          deviceId: d.deviceId,
          lastSeen: d.lastSeen,
          protectionStatus: d.protectionStatus,
          appState: d.appState,
          isOnline: Date.now() - new Date(d.lastSeen).getTime() < 10 * 60 * 1000, // 10 min threshold
        })),
      };
    }),

  // ─── Activity ────────────────────────────────────────────────────

  /** Log an activity event */
  logActivity: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      familyId: z.number().int(),
      deviceId: z.string().min(1).max(128),
      eventType: z.string().min(1).max(64),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      await db.insert(pgActivityLog).values({
        familyId: input.familyId,
        deviceId: input.deviceId,
        eventType: input.eventType,
        metadata: input.metadata,
      });

      return { logged: true };
    }),
});
