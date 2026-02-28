import { z } from "zod";
import { desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { marketingRunLog } from "../../db/schema";

const Engine = z.enum(["standard", "pi-sandbox", "obliterated-sandbox"]);
const Mode = z.enum(["research", "execute"]);
const Vertical = z.enum([
  "small-business-websites",
  "quickbooks-integration",
  "workflow-automation",
  "agents-apps-automation",
]);

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const marketingAgentsRouter = router({
  getFeatureFlags: adminProcedure.query(async () => {
    const enablePiSandbox = envBool("MARKETING_ENABLE_PI_SANDBOX", true);
    const enableObliteratedSandbox = envBool("MARKETING_ENABLE_OBLITERATED_SANDBOX", true);
    const allowSandboxExecute = envBool("MARKETING_ALLOW_SANDBOX_EXECUTE", false);

    return {
      ok: true as const,
      flags: {
        enablePiSandbox,
        enableObliteratedSandbox,
        allowSandboxExecute,
      },
    };
  }),

  runCycle: adminProcedure
    .input(
      z.object({
        vertical: Vertical,
        engine: Engine,
        mode: Mode,
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const enablePiSandbox = envBool("MARKETING_ENABLE_PI_SANDBOX", true);
      const enableObliteratedSandbox = envBool("MARKETING_ENABLE_OBLITERATED_SANDBOX", true);
      const allowSandboxExecute = envBool("MARKETING_ALLOW_SANDBOX_EXECUTE", false);
      const isSandbox = input.engine !== "standard";

      if (input.engine === "pi-sandbox" && !enablePiSandbox) {
        throw new Error("PI sandbox engine is disabled by feature flag.");
      }
      if (input.engine === "obliterated-sandbox" && !enableObliteratedSandbox) {
        throw new Error("Obliterated sandbox engine is disabled by feature flag.");
      }
      if (isSandbox && input.mode === "execute" && !allowSandboxExecute) {
        throw new Error("Sandbox execute mode is blocked by policy. Use research mode.");
      }

      const runId = nanoid(16);
      const now = new Date();
      const actorId = (ctx as any)?.user?.id ?? null;
      const actorEmail = (ctx as any)?.user?.email ?? null;

      await db.insert(marketingRunLog).values({
        id: runId,
        agent: input.engine,
        job: "vertical_learning_cycle",
        status: "queued",
        message: `Cycle queued (${input.mode}) for ${input.vertical}`,
        meta: {
          vertical: input.vertical,
          engine: input.engine,
          mode: input.mode,
          source: "admin_marketing_agents_window",
          notes: input.notes ?? null,
          actorId,
          actorEmail,
          lane: isSandbox ? "sandbox-8b-isolated" : "main-8b-governed",
        },
        startedAt: now,
        finishedAt: now,
      });

      return {
        ok: true as const,
        runId,
        status: "queued" as const,
      };
    }),

  listCycles: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows = await db
        .select()
        .from(marketingRunLog)
        .orderBy(desc(marketingRunLog.startedAt))
        .limit(input.limit);

      return { ok: true as const, rows };
    }),
});
