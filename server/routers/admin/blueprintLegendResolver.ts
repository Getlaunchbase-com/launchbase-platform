/**
 * Blueprint Legend/Key Resolver — tRPC Router
 *
 * Handles the symbol mapping lifecycle:
 *   1. Symbol Pack CRUD — reusable rawClass → canonicalType mappings
 *   2. Mapping UI support — operator approves mapping from detected classes to device types
 *   3. Apply mapping — propagate approved mappings to all raw detections
 *   4. Takeoff counts — device-type level counts after mapping
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  blueprintSymbolPacks,
  blueprintLegendEntries,
  blueprintDetectionsRaw,
  blueprintDocuments,
} from "../../../drizzle/schema";
import { desc, eq, and, count, sql, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Legend Resolver Router
// ---------------------------------------------------------------------------

export const blueprintLegendResolverRouter = router({
  // =========================================================================
  // 1. Symbol Pack CRUD
  // =========================================================================

  /** Create a new symbol pack */
  createSymbolPack: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        mappings: z.array(
          z.object({
            rawClass: z.string().min(1).max(255),
            canonicalType: z.string().min(1).max(255),
            symbolDescription: z.string().max(512).optional(),
          })
        ),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      // If setting as default, unset any existing default
      if (input.isDefault) {
        await db
          .update(blueprintSymbolPacks)
          .set({ isDefault: false })
          .where(eq(blueprintSymbolPacks.isDefault, true));
      }

      const [result] = await db.insert(blueprintSymbolPacks).values({
        name: input.name,
        description: input.description ?? null,
        mappings: input.mappings,
        createdBy: userId,
        isDefault: input.isDefault,
      });

      return { symbolPackId: result.insertId };
    }),

  /** List symbol packs */
  listSymbolPacks: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { packs: [], total: 0 };

      const rows = await db
        .select()
        .from(blueprintSymbolPacks)
        .orderBy(desc(blueprintSymbolPacks.isDefault), desc(blueprintSymbolPacks.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(blueprintSymbolPacks);

      return { packs: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a symbol pack by ID */
  getSymbolPack: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(blueprintSymbolPacks)
        .where(eq(blueprintSymbolPacks.id, input.id))
        .limit(1);

      return row ?? null;
    }),

  /** Update a symbol pack's mappings */
  updateSymbolPack: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        mappings: z
          .array(
            z.object({
              rawClass: z.string().min(1).max(255),
              canonicalType: z.string().min(1).max(255),
              symbolDescription: z.string().max(512).optional(),
            })
          )
          .optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.mappings !== undefined) updates.mappings = input.mappings;

      if (input.isDefault !== undefined) {
        updates.isDefault = input.isDefault;
        if (input.isDefault) {
          // Unset other defaults
          await db
            .update(blueprintSymbolPacks)
            .set({ isDefault: false })
            .where(eq(blueprintSymbolPacks.isDefault, true));
        }
      }

      await db
        .update(blueprintSymbolPacks)
        .set(updates)
        .where(eq(blueprintSymbolPacks.id, input.id));

      return { success: true, id: input.id };
    }),

  /** Delete a symbol pack */
  deleteSymbolPack: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.delete(blueprintSymbolPacks).where(eq(blueprintSymbolPacks.id, input.id));
      return { success: true };
    }),

  // =========================================================================
  // 2. Mapping UI support — get unmapped classes + suggest mappings
  // =========================================================================

  /** Get all unique raw classes detected in a document, with current mapping status */
  getDetectedClasses: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { classes: [] };

      const classes = await db
        .select({
          rawClass: blueprintDetectionsRaw.rawClass,
          canonicalType: blueprintDetectionsRaw.canonicalType,
          count: count(),
        })
        .from(blueprintDetectionsRaw)
        .where(eq(blueprintDetectionsRaw.documentId, input.documentId))
        .groupBy(blueprintDetectionsRaw.rawClass, blueprintDetectionsRaw.canonicalType)
        .orderBy(desc(count()));

      return { classes };
    }),

  /** Set canonical mapping for a single raw class across a document */
  mapClass: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        rawClass: z.string().min(1).max(255),
        canonicalType: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Update all detections with this rawClass in the document
      const result = await db
        .update(blueprintDetectionsRaw)
        .set({
          canonicalType: input.canonicalType,
          status: "mapped",
        })
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            eq(blueprintDetectionsRaw.rawClass, input.rawClass)
          )
        );

      // Also update matching legend entries
      await db
        .update(blueprintLegendEntries)
        .set({ canonicalType: input.canonicalType })
        .where(
          and(
            eq(blueprintLegendEntries.documentId, input.documentId),
            eq(blueprintLegendEntries.rawLabel, input.rawClass)
          )
        );

      return { success: true, rawClass: input.rawClass, canonicalType: input.canonicalType };
    }),

  /** Batch-map classes using an existing symbol pack */
  applySymbolPack: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        symbolPackId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the symbol pack
      const [pack] = await db
        .select()
        .from(blueprintSymbolPacks)
        .where(eq(blueprintSymbolPacks.id, input.symbolPackId))
        .limit(1);

      if (!pack) throw new Error("Symbol pack not found");
      if (!pack.mappings || (pack.mappings as any[]).length === 0) {
        throw new Error("Symbol pack has no mappings");
      }

      const mappings = pack.mappings as Array<{ rawClass: string; canonicalType: string }>;
      let mappedCount = 0;

      // Apply each mapping
      for (const mapping of mappings) {
        const [result] = await db
          .update(blueprintDetectionsRaw)
          .set({
            canonicalType: mapping.canonicalType,
            legendEntryId: null,
            status: "mapped",
          })
          .where(
            and(
              eq(blueprintDetectionsRaw.documentId, input.documentId),
              eq(blueprintDetectionsRaw.rawClass, mapping.rawClass)
            )
          );
        mappedCount++;

        // Update legend entries too
        await db
          .update(blueprintLegendEntries)
          .set({
            canonicalType: mapping.canonicalType,
            symbolPackId: input.symbolPackId,
          })
          .where(
            and(
              eq(blueprintLegendEntries.documentId, input.documentId),
              eq(blueprintLegendEntries.rawLabel, mapping.rawClass)
            )
          );
      }

      return {
        success: true,
        symbolPackId: input.symbolPackId,
        mappingsApplied: mappedCount,
      };
    }),

  /** Save current document mappings as a new symbol pack for reuse */
  saveAsSymbolPack: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        packName: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      // Get all mapped classes from this document
      const mapped = await db
        .select({
          rawClass: blueprintDetectionsRaw.rawClass,
          canonicalType: blueprintDetectionsRaw.canonicalType,
        })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            eq(blueprintDetectionsRaw.status, "mapped")
          )
        )
        .groupBy(blueprintDetectionsRaw.rawClass, blueprintDetectionsRaw.canonicalType);

      if (mapped.length === 0) {
        throw new Error("No mapped classes found in this document");
      }

      const mappings = mapped
        .filter((m) => m.canonicalType)
        .map((m) => ({
          rawClass: m.rawClass,
          canonicalType: m.canonicalType!,
        }));

      if (input.isDefault) {
        await db
          .update(blueprintSymbolPacks)
          .set({ isDefault: false })
          .where(eq(blueprintSymbolPacks.isDefault, true));
      }

      const [result] = await db.insert(blueprintSymbolPacks).values({
        name: input.packName,
        description: input.description ?? null,
        mappings,
        createdBy: userId,
        isDefault: input.isDefault,
      });

      return { symbolPackId: result.insertId, mappingCount: mappings.length };
    }),

  // =========================================================================
  // 3. Takeoff counts — device-type level summary after mapping
  // =========================================================================

  /** Get takeoff counts per canonical device type for a document */
  getTakeoffCounts: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        includeUnmapped: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { counts: [], totalDevices: 0, unmappedCount: 0 };

      // Mapped counts by canonical type
      const mapped = await db
        .select({
          canonicalType: blueprintDetectionsRaw.canonicalType,
          count: count(),
        })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            eq(blueprintDetectionsRaw.status, "mapped")
          )
        )
        .groupBy(blueprintDetectionsRaw.canonicalType)
        .orderBy(desc(count()));

      // Unmapped count
      const [unmappedResult] = await db
        .select({ count: count() })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            eq(blueprintDetectionsRaw.status, "raw")
          )
        );

      const unmappedCount = unmappedResult?.count ?? 0;

      // Optionally include unmapped classes
      let unmappedClasses: Array<{ rawClass: string; count: number }> = [];
      if (input.includeUnmapped) {
        unmappedClasses = await db
          .select({
            rawClass: blueprintDetectionsRaw.rawClass,
            count: count(),
          })
          .from(blueprintDetectionsRaw)
          .where(
            and(
              eq(blueprintDetectionsRaw.documentId, input.documentId),
              eq(blueprintDetectionsRaw.status, "raw")
            )
          )
          .groupBy(blueprintDetectionsRaw.rawClass)
          .orderBy(desc(count()));
      }

      const counts = mapped
        .filter((m) => m.canonicalType)
        .map((m) => ({
          deviceType: m.canonicalType!,
          count: m.count as number,
        }));

      const totalDevices = counts.reduce((sum, c) => sum + c.count, 0);

      return {
        counts,
        totalDevices,
        unmappedCount: unmappedCount as number,
        unmappedClasses,
      };
    }),

  /** Get per-page breakdown of device counts */
  getTakeoffByPage: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { pages: [] };

      const rows = await db
        .select({
          pageId: blueprintDetectionsRaw.pageId,
          canonicalType: blueprintDetectionsRaw.canonicalType,
          count: count(),
        })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            eq(blueprintDetectionsRaw.status, "mapped")
          )
        )
        .groupBy(blueprintDetectionsRaw.pageId, blueprintDetectionsRaw.canonicalType)
        .orderBy(blueprintDetectionsRaw.pageId);

      // Group by page
      const pageMap = new Map<number, Array<{ deviceType: string; count: number }>>();
      for (const row of rows) {
        if (!row.canonicalType) continue;
        if (!pageMap.has(row.pageId)) pageMap.set(row.pageId, []);
        pageMap.get(row.pageId)!.push({
          deviceType: row.canonicalType,
          count: row.count as number,
        });
      }

      const pages = Array.from(pageMap.entries()).map(([pageId, devices]) => ({
        pageId,
        devices,
        total: devices.reduce((sum, d) => sum + d.count, 0),
      }));

      return { pages };
    }),
});

export type BlueprintLegendResolverRouter = typeof blueprintLegendResolverRouter;
