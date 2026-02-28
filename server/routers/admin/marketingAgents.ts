import { z } from "zod";
import { desc, gte } from "drizzle-orm";
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

  getScorecard: adminProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(90).default(14),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await db
        .select()
        .from(marketingRunLog)
        .where(gte(marketingRunLog.startedAt, since))
        .orderBy(desc(marketingRunLog.startedAt))
        .limit(2000);

      type EngineKey = "standard" | "pi-sandbox" | "obliterated-sandbox";
      const engines: EngineKey[] = ["standard", "pi-sandbox", "obliterated-sandbox"];

      const byEngine = engines.map((engine) => {
        const set = rows.filter((r) => ((r.meta as any)?.engine ?? r.agent) === engine);
        const total = set.length;
        const queued = set.filter((r) => r.status === "queued").length;
        const success = set.filter((r) => r.status === "ok" || r.status === "success").length;
        const failed = set.filter((r) => r.status === "failed").length;
        const research = set.filter((r) => (r.meta as any)?.mode === "research").length;
        const execute = set.filter((r) => (r.meta as any)?.mode === "execute").length;
        const guardrailPass = set.filter((r) => (r.meta as any)?.guardrailPass === true).length;
        const guardrailChecked = set.filter((r) => typeof (r.meta as any)?.guardrailPass === "boolean").length;
        const costValues = set
          .map((r) => Number((r.meta as any)?.costUsd))
          .filter((n) => Number.isFinite(n) && n >= 0);
        const avgCostUsd =
          costValues.length > 0 ? costValues.reduce((a, b) => a + b, 0) / costValues.length : null;
        return {
          engine,
          total,
          queued,
          success,
          failed,
          successRate: total > 0 ? success / total : 0,
          research,
          execute,
          guardrailPass,
          guardrailChecked,
          guardrailPassRate: guardrailChecked > 0 ? guardrailPass / guardrailChecked : null,
          avgCostUsd,
        };
      });

      return {
        ok: true as const,
        windowDays: input.days,
        generatedAt: new Date().toISOString(),
        totals: {
          runs: rows.length,
          success: rows.filter((r) => r.status === "ok" || r.status === "success").length,
          failed: rows.filter((r) => r.status === "failed").length,
          queued: rows.filter((r) => r.status === "queued").length,
        },
        byEngine,
      };
    }),
});
