import { z } from "zod";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  marketingHypotheses,
  marketingInboxItem,
  marketingRunLog,
  marketingSignals,
} from "../../db/schema";

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

const ENGINE_COST_ESTIMATE: Record<z.infer<typeof Engine>, number> = {
  standard: 0.018,
  "pi-sandbox": 0.009,
  "obliterated-sandbox": 0.012,
};

const CHANNEL_BY_VERTICAL: Record<z.infer<typeof Vertical>, string> = {
  "small-business-websites": "outbound_email",
  "quickbooks-integration": "linkedin_outreach",
  "workflow-automation": "content_seo",
  "agents-apps-automation": "direct_outreach",
};

const DEFAULT_PI_SANDBOX_URL = "https://pi-agent-sandbox-6af67etolq-uc.a.run.app";
const DEFAULT_PI_PRIMARY_MODEL = "openai/gpt-5-2";
const DEFAULT_PI_REVIEW_MODEL = "claude-sonnet-4-6";

function getPiSandboxUrl(): string {
  return (process.env.MARKETING_PI_SANDBOX_URL || DEFAULT_PI_SANDBOX_URL).replace(/\/+$/, "");
}

function getPiPrimaryModel(): string {
  return (process.env.MARKETING_PI_PRIMARY_MODEL || DEFAULT_PI_PRIMARY_MODEL).trim();
}

function getPiReviewModel(): string {
  return (process.env.MARKETING_PI_REVIEW_MODEL || DEFAULT_PI_REVIEW_MODEL).trim();
}

type PiSandboxResult = {
  ok: boolean;
  model?: string;
  output?: string;
  duration_ms?: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: string;
};

function normalizePiLines(raw: string | undefined, limit = 3): string[] {
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length >= 12 && l.length <= 180);
  const uniq = Array.from(new Set(lines));
  return uniq.slice(0, limit);
}

async function callPiSandbox(input: {
  vertical: z.infer<typeof Vertical>;
  mode: z.infer<typeof Mode>;
  runId: string;
  signalsSummary?: string;
  model?: string;
  promptOverride?: string;
  maxTokens?: number;
}): Promise<PiSandboxResult> {
  const url = `${getPiSandboxUrl()}/run`;
  const system =
    "You are a senior B2B growth strategist for LaunchBase. Return concise, practical output for SMB demand generation.";
  const prompt = input.promptOverride || (
    input.mode === "research"
      ? [
          `Vertical: ${input.vertical}`,
          "Task: Generate exactly 3 testable marketing hypotheses for near-term pipeline growth.",
          "Output format: one hypothesis per line, no numbering, no markdown.",
          "Each line must include: channel + message angle + expected business outcome.",
          input.signalsSummary ? `Signals:\n${input.signalsSummary}` : "Signals: none",
        ].join("\n")
      : [
          `Vertical: ${input.vertical}`,
          "Task: Generate a concise execution brief for one launch campaign.",
          "Output format: 5 short lines (Goal, Audience, Offer, Channel plan, KPI).",
        ].join("\n")
  );

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model || undefined,
        prompt,
        system,
        temperature: 0.2,
        max_tokens: input.maxTokens ?? (input.mode === "research" ? 700 : 450),
        mode: input.mode,
        vertical: input.vertical,
        trace_id: input.runId,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `PI sandbox HTTP ${resp.status}: ${txt.slice(0, 300)}` };
    }
    const json = (await resp.json()) as PiSandboxResult;
    return {
      ok: Boolean(json.ok),
      model: json.model,
      output: json.output,
      duration_ms: json.duration_ms,
      usage: json.usage,
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

async function processCycleRun(db: Awaited<ReturnType<typeof getDb>>, runId: string) {
  if (!db) throw new Error("Database not available");
  const [run] = await db
    .select()
    .from(marketingRunLog)
    .where(eq(marketingRunLog.id, runId))
    .limit(1);

  if (!run) throw new Error("Cycle run not found");
  if (run.status !== "queued") return { ok: true as const, runId, skipped: true as const };

  const meta = ((run.meta as any) ?? {}) as {
    vertical?: z.infer<typeof Vertical>;
    engine?: z.infer<typeof Engine>;
    mode?: z.infer<typeof Mode>;
  };
  const vertical = meta.vertical ?? "small-business-websites";
  const engine = (meta.engine ?? "standard") as z.infer<typeof Engine>;
  const mode = (meta.mode ?? "research") as z.infer<typeof Mode>;
  const started = Date.now();

  const now = new Date();
  const costUsd = ENGINE_COST_ESTIMATE[engine] ?? 0.01;
  const guardrailPass = !(engine !== "standard" && mode === "execute");
  if (!guardrailPass) {
    await db
      .update(marketingRunLog)
      .set({
        status: "failed",
        message: "Guardrail blocked sandbox execute mode",
        meta: {
          ...meta,
          guardrailPass: false,
          costUsd,
          durationMs: Date.now() - started,
        },
        finishedAt: now,
      })
      .where(eq(marketingRunLog.id, runId));
    return { ok: true as const, runId, guardrailBlocked: true as const };
  }

  if (mode === "research") {
    const signals = await db
      .select()
      .from(marketingSignals)
      .where(inArray(marketingSignals.status, ["new", "triaged", "qualified"]))
      .orderBy(desc(marketingSignals.score), desc(marketingSignals.createdAt))
      .limit(5);
    const signalIds = signals.map((s) => s.id);
    const signalsSummary = signals
      .map((s) => {
        const reasons = Array.isArray(s.reasons) ? s.reasons.slice(0, 2).join("; ") : "";
        return `- ${s.entityName} [${s.sourceType}/${s.jurisdiction}] score=${s.score}${reasons ? ` reasons=${reasons}` : ""}`;
      })
      .join("\n");

    const primaryModel = getPiPrimaryModel();
    const reviewModel = getPiReviewModel();
    const piPrimary =
      engine === "pi-sandbox"
        ? await callPiSandbox({ vertical, mode, runId, signalsSummary, model: primaryModel, maxTokens: 900 })
        : null;
    const piReview =
      engine === "pi-sandbox" && piPrimary?.ok && (piPrimary.output ?? "").trim().length > 0
        ? await callPiSandbox({
            vertical,
            mode,
            runId,
            model: reviewModel,
            promptOverride: [
              `Vertical: ${vertical}`,
              "Task: Review and refine the primary strategist output into exactly 3 high-quality hypotheses.",
              "Return one hypothesis per line, no numbering, no markdown, no preface.",
              "Each line must include: channel + message angle + expected business outcome.",
              "Primary output:",
              piPrimary.output ?? "",
            ].join("\n"),
            maxTokens: 700,
          })
        : null;

    const hypothesisIds: string[] = [];
    const fallbackTemplates = [
      "Offer clarity lift for SMB operators",
      "Channel-message match for quick qualification",
      "CTA simplification for lower-friction conversion",
    ];
    const templates =
      engine === "pi-sandbox"
        ? normalizePiLines((piReview?.ok ? piReview.output : piPrimary?.output) ?? "", 3)
        : [];
    const finalTemplates = templates.length > 0 ? templates : fallbackTemplates;

    const piMeta = piPrimary
      ? {
          primary: {
            ok: piPrimary.ok,
            model: piPrimary.model ?? primaryModel,
            durationMs: piPrimary.duration_ms ?? null,
            usage: piPrimary.usage ?? null,
            error: piPrimary.error ?? null,
          },
          reviewer: piReview
            ? {
                ok: piReview.ok,
                model: piReview.model ?? reviewModel,
                durationMs: piReview.duration_ms ?? null,
                usage: piReview.usage ?? null,
                error: piReview.error ?? null,
              }
            : null,
        }
      : null;
    for (const t of finalTemplates) {
      const id = nanoid(16);
      hypothesisIds.push(id);
      await db.insert(marketingHypotheses).values({
        id,
        signalIds,
        title: `${vertical}: ${t.slice(0, 180)}`,
        hypothesis: `For ${vertical}, test "${t}" and compare response/booking outcomes against current baseline.`,
        segment: vertical,
        channel: CHANNEL_BY_VERTICAL[vertical],
        confidence: 66,
        impact: 61,
        effort: 38,
        reasons: [
          "signal-backed trend synthesis",
          "vertical-specific language alignment",
          `engine:${engine}`,
        ],
        risks: ["message fatigue", "channel mismatch"],
        nextSteps: ["create 3 variants", "run low-budget test", "measure booked-call lift"],
        status: "new",
        notes: `generated_by=${engine}; run_id=${runId}${piPrimary?.model ? `; model=${piPrimary.model}` : ""}`,
      });
    }

    await db
      .update(marketingRunLog)
      .set({
        status: "ok",
        message: `Research cycle completed: ${hypothesisIds.length} hypotheses generated`,
        meta: {
          ...meta,
          guardrailPass: true,
          costUsd,
          durationMs: Date.now() - started,
          generatedHypothesisIds: hypothesisIds,
          signalCount: signalIds.length,
          piBridge: piMeta,
        },
        finishedAt: now,
      })
      .where(eq(marketingRunLog.id, runId));
    return { ok: true as const, runId, hypothesisIds };
  }

  const [candidate] = await db
    .select()
    .from(marketingHypotheses)
    .where(
      and(
        eq(marketingHypotheses.segment, vertical),
        inArray(marketingHypotheses.status, ["promoted", "approved", "new"])
      )
    )
    .orderBy(desc(marketingHypotheses.updatedAt))
    .limit(1);

  const primaryModel = getPiPrimaryModel();
  const reviewModel = getPiReviewModel();
  const piExecutePrimary =
    engine === "pi-sandbox"
      ? await callPiSandbox({ vertical, mode, runId, model: primaryModel, maxTokens: 500 })
      : null;
  const piExecuteReview =
    engine === "pi-sandbox" && piExecutePrimary?.ok && (piExecutePrimary.output ?? "").trim().length > 0
      ? await callPiSandbox({
          vertical,
          mode,
          runId,
          model: reviewModel,
          promptOverride: [
            `Vertical: ${vertical}`,
            "Task: Review and tighten this campaign execution brief.",
            "Return exactly 5 short lines with labels:",
            "Goal:",
            "Audience:",
            "Offer:",
            "Channel plan:",
            "KPI:",
            "Primary brief:",
            piExecutePrimary.output ?? "",
          ].join("\n"),
          maxTokens: 420,
        })
      : null;

  const inboxId = nanoid(16);
  await db.insert(marketingInboxItem).values({
    id: inboxId,
    status: "queued",
    priority: "high",
    score: 85,
    title: `Execute vertical campaign (${vertical})`,
    source: "marketing_cycle_execute",
    sourceKey: runId,
    summary: candidate
      ? `Execute promoted hypothesis: ${candidate.title}`
      : `No promoted hypothesis found; operator review required before execution`,
    payload: {
      runId,
      vertical,
      engine,
      hypothesisId: candidate?.id ?? null,
      channel: candidate?.channel ?? CHANNEL_BY_VERTICAL[vertical],
      executionBrief: (piExecuteReview?.ok ? piExecuteReview.output : piExecutePrimary?.output) ?? null,
      executionModel: (piExecuteReview?.ok ? piExecuteReview.model : piExecutePrimary?.model) ?? null,
    },
  });

  await db
    .update(marketingRunLog)
    .set({
      status: "ok",
      message: `Execute cycle completed: inbox task ${inboxId} queued`,
      meta: {
        ...meta,
        guardrailPass: true,
        costUsd,
        durationMs: Date.now() - started,
        createdInboxId: inboxId,
        usedHypothesisId: candidate?.id ?? null,
        piBridge:
          piExecutePrimary == null
            ? null
            : {
                primary: {
                  ok: piExecutePrimary.ok,
                  model: piExecutePrimary.model ?? primaryModel,
                  durationMs: piExecutePrimary.duration_ms ?? null,
                  usage: piExecutePrimary.usage ?? null,
                  error: piExecutePrimary.error ?? null,
                },
                reviewer: piExecuteReview
                  ? {
                      ok: piExecuteReview.ok,
                      model: piExecuteReview.model ?? reviewModel,
                      durationMs: piExecuteReview.duration_ms ?? null,
                      usage: piExecuteReview.usage ?? null,
                      error: piExecuteReview.error ?? null,
                    }
                  : null,
              },
      },
      finishedAt: now,
    })
    .where(eq(marketingRunLog.id, runId));

  return { ok: true as const, runId, inboxId };
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

      const bridgeEnabled = envBool("MARKETING_ENABLE_CYCLE_BRIDGE", true);
      if (bridgeEnabled) {
        await processCycleRun(db, runId);
      }

      return {
        ok: true as const,
        runId,
        status: "queued" as const,
      };
    }),

  processQueuedCycles: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const queued = await db
        .select({ id: marketingRunLog.id })
        .from(marketingRunLog)
        .where(and(eq(marketingRunLog.job, "vertical_learning_cycle"), eq(marketingRunLog.status, "queued")))
        .orderBy(desc(marketingRunLog.startedAt))
        .limit(input.limit);
      const results: Array<{ runId: string; ok: boolean; error?: string }> = [];
      for (const row of queued) {
        try {
          await processCycleRun(db, row.id);
          results.push({ runId: row.id, ok: true });
        } catch (err: any) {
          results.push({ runId: row.id, ok: false, error: String(err?.message ?? err) });
        }
      }
      return { ok: true as const, processed: results.length, results };
    }),

  listPromotionQueue: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(25) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db
        .select()
        .from(marketingHypotheses)
        .where(inArray(marketingHypotheses.status, ["new", "ready_for_review", "approved"]))
        .orderBy(desc(marketingHypotheses.updatedAt))
        .limit(input.limit);
      return { ok: true as const, rows };
    }),

  reviewPromotion: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        decision: z.enum(["approved", "rejected", "promoted"]),
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [existing] = await db
        .select({ notes: marketingHypotheses.notes })
        .from(marketingHypotheses)
        .where(eq(marketingHypotheses.id, input.id))
        .limit(1);
      const actor = (ctx as any)?.user?.email ?? (ctx as any)?.user?.id ?? "admin";
      const add = `${new Date().toISOString()} ${actor}: ${input.decision}${input.note ? ` - ${input.note}` : ""}`;
      const notes = existing?.notes ? `${existing.notes}\n${add}` : add;
      await db
        .update(marketingHypotheses)
        .set({ status: input.decision, notes })
        .where(eq(marketingHypotheses.id, input.id));
      return { ok: true as const, id: input.id, status: input.decision };
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
