import { z } from "zod";
import { sql } from "drizzle-orm";
import { adminProcedure, router } from "../../_core/trpc";
import { getDb } from "../../db";
import { swarmRuns, swarmProfiles, repoSources } from "../../../drizzle/schema";
import { and, desc, eq, like, gte } from "drizzle-orm";
import { 
  CreateRunInputSchema, 
  ListRunsInputSchema, 
  GetRunInputSchema,
  GetArtifactUrlInputSchema,
  CreateProfileInputSchema,
  CreateProfileFromRunInputSchema,
  GetProfileStatsInputSchema,
  ProfileStatsSchema,
  ListProfilesInputSchema,
  GetProfileInputSchema,
  PromoteProfileInputSchema,
  RepoSourceSchema,
  CreateRepoSourceLocalInputSchema,
  CreateRepoSourceGitInputSchema,
  SyncRepoSourceInputSchema,
  FileSearchInputSchema,
  FileReadInputSchema,
  PushRunToBranchInputSchema,
  ListModelsOutputSchema
} from "../../swarm/types";
import { launchSwarmRun } from "../../swarm/runLauncher";
import { ingestLocalRepairRun } from "../../swarm/ingest";
import { getArtifactUrl } from "../../swarm/artifactStore";
import { ensureRepoWorkdir, searchRepoFiles, readRepoFile, pushCurrentChangesToBranch, getRepoWorkdirNoSync } from "../../swarm/repoManager";
import { ENV } from "../../_core/env";

function expandImports(workdir: string, entryFiles: string[], hops: number): string[] {
  const out = new Set(entryFiles);
  const queue: Array<{path: string; hop: number}> = entryFiles.map(p => ({ path: p, hop: 0 }));
  const exts = [".ts", ".tsx", ".js", ".jsx", ".json"];
  const pathJoin = (a: string, b: string) => a.replace(/\/+$/,"") + "/" + b.replace(/^\/+/,"");
  const dirOf = (p: string) => p.split("/").slice(0, -1).join("/");

  while (queue.length) {
    const { path, hop } = queue.shift()!;
    if (hop >= hops) continue;
    let content = "";
    try { content = readRepoFile(workdir, path); } catch { continue; }
    const dir = dirOf(path);
    const importRe = /from\s+["'](\.\/[^"']+|\.\.\/[^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content))) {
      const raw = m[1];
      const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
      // resolve relative
      const rel = resolveRelative(dir, base);
      // try with extensions and index
      const candidates: string[] = [];
      for (const e of exts) candidates.push(rel + e);
      for (const e of exts) candidates.push(pathJoin(rel, "index" + e));
      for (const c of candidates) {
        if (!out.has(c)) {
          try { readRepoFile(workdir, c); out.add(c); queue.push({ path: c, hop: hop + 1 }); } catch {}
        }
      }
    }
  }
  return Array.from(out);
}

function resolveRelative(dir: string, rel: string): string {
  const parts = (dir ? dir.split("/") : []).concat(rel.split("/"));
  const stack: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}


export const adminSwarmConsoleRouter = router({
  models: router({
    list: adminProcedure.output(ListModelsOutputSchema).query(async () => {
      // Prefer live AIMLAPI /v1/models if key configured, else fall back to known defaults.
      const base = ENV.aimlBaseUrl || "https://api.aimlapi.com";
      const key = ENV.aimlApiKey || "";
      if (!key) {
        return [
          { id: "openai/gpt-5-2", label: "GPT-5.2" },
          { id: "openai/gpt-4o", label: "GPT-4o" },
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
        ];
      }
      try {
        const res = await fetch(`${base.replace(/\/+$/,"")}/v1/models`, {
          headers: { Authorization: `Bearer ${key}` }
        });
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        return items
          .map((m: any) => ({ id: String(m.id), label: m?.name ? String(m.name) : undefined }))
          .filter((m: any) => m.id && m.id !== "undefined");
      } catch {
        return [
          { id: "openai/gpt-5-2", label: "GPT-5.2" },
          { id: "openai/gpt-4o", label: "GPT-4o" },
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
        ];
      }
    }),
  }),


  repoSources: router({
    list: adminProcedure.output(z.array(RepoSourceSchema)).query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(repoSources).orderBy(desc(repoSources.updatedAt));
      return rows as any;
    }),
    createLocal: adminProcedure.input(CreateRepoSourceLocalInputSchema).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [row] = await db.insert(repoSources).values({
        name: input.name,
        type: "local",
        localPath: input.localPath,
      }).returning();
      return row as any;
    }),
    createGit: adminProcedure.input(CreateRepoSourceGitInputSchema).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [row] = await db.insert(repoSources).values({
        name: input.name,
        type: "git",
        repoUrl: input.repoUrl,
        branch: input.branch,
        authType: input.authToken ? "token" : null,
        encryptedSecret: input.authToken ?? null,
      }).returning();
      return row as any;
    }),
    sync: adminProcedure.input(SyncRepoSourceInputSchema).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [repo] = await db.select().from(repoSources).where(eq(repoSources.id, input.id)).limit(1);
      if (!repo) throw new Error("Repo source not found");
      const { headSha } = await ensureRepoWorkdir(repo as any);
      await db.update(repoSources).set({ lastSyncAt: new Date(), lastHeadSha: headSha ?? null }).where(eq(repoSources.id, repo.id));
      return { ok: true, headSha };
    }),
    fileSearch: adminProcedure.input(FileSearchInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [repo] = await db.select().from(repoSources).where(eq(repoSources.id, input.repoSourceId)).limit(1);
      if (!repo) throw new Error("Repo source not found");
      const { workdir } = await ensureRepoWorkdir(repo as any);
      return searchRepoFiles(workdir, input.query, input.limit);
    }),
    fileRead: adminProcedure.input(FileReadInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [repo] = await db.select().from(repoSources).where(eq(repoSources.id, input.repoSourceId)).limit(1);
      if (!repo) throw new Error("Repo source not found");
      const { workdir } = await ensureRepoWorkdir(repo as any);
      return { path: input.path, content: readRepoFile(workdir, input.path) };
    }),
  }),

  runs: router({
    list: adminProcedure.input(ListRunsInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = [];
      if (input.stopReason) where.push(eq(swarmRuns.stopReason, input.stopReason));
      if (input.model) where.push(like(swarmRuns.modelPrimary, `%${input.model}%`));
      if (input.intention) where.push(eq(swarmRuns.intention, input.intention));
      if (input.fixtureName) where.push(eq(swarmRuns.fixtureName, input.fixtureName));
      const rows = await db
        .select()
        .from(swarmRuns)
        .where(where.length ? and(...where) : undefined as any)
        .orderBy(desc(swarmRuns.createdAt))
        .limit(input.limit);
      return rows.map(r => ({
        ...r,
        artifactKeys: typeof r.artifactKeys === "string" ? JSON.parse(r.artifactKeys) : r.artifactKeys,
        featurePackJson: typeof (r as any).featurePackJson === "string" ? JSON.parse((r as any).featurePackJson) : (r as any).featurePackJson
      }));
    }),

    get: adminProcedure.input(GetRunInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(swarmRuns).where(eq(swarmRuns.repairId, input.repairId)).limit(1);
      if (!rows.length) return null;
      const r: any = rows[0];
      r.artifactKeys = typeof r.artifactKeys === "string" ? JSON.parse(r.artifactKeys) : r.artifactKeys;
      r.featurePackJson = typeof r.featurePackJson === "string" ? JSON.parse(r.featurePackJson) : r.featurePackJson;
      return r;
    }),

    create: adminProcedure.input(CreateRunInputSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { featurePack, profileId } = input as any;

      // Default: run against the LaunchBase server repo itself.
      let runCwd = process.cwd();

      // Resolve repo workdir (and sync to HEAD) if provided
      let repoHeadSha: string | undefined;
      if (featurePack.repoSourceId) {
        const [repo] = await db.select().from(repoSources).where(eq(repoSources.id, featurePack.repoSourceId)).limit(1);
        if (!repo) throw new Error("Repo source not found");
        const wrk = await ensureRepoWorkdir(repo as any, { sync: true });
        repoHeadSha = wrk.headSha;
        runCwd = wrk.workdir;

        // If manual + no explicit failurePacketJson, build snapshots and inject a minimal failure packet.
        if (featurePack.sourceType === "manual" && (!featurePack.failurePacketJson || featurePack.failurePacketJson.trim().length < 5)) {
          const entry = featurePack.selectedFiles || [];
          const hops = featurePack.scopePreset === "deep" ? 2 : featurePack.scopePreset === "minimal" ? 0 : 1;
          const expanded = hops > 0 ? expandImports(wrk.workdir, entry, hops) : entry;
          const limited: string[] = [];
          let totalBytes = 0;
          for (const p of expanded) {
            try {
              const content = readRepoFile(wrk.workdir, p);
              const bytes = Buffer.byteLength(content, "utf8");
              if (limited.length >= (featurePack.maxFiles ?? 20)) break;
              if (totalBytes + bytes > (featurePack.maxBytes ?? 200_000)) break;
              limited.push(p);
              totalBytes += bytes;
            } catch {
              // ignore missing
            }
          }
          const snapshots: Record<string, string> = {};
          for (const p of limited) {
            try { snapshots[p] = readRepoFile(wrk.workdir, p); } catch {}
          }

          const pkt = {
            version: "v1",
            failure: {
              type: "manual",
              errorMessage: featurePack.errorMessage || "Manual swarm run",
            },
            context: {
              logs: featurePack.logs || [],
              fileSnapshots: snapshots,
            },
            testCommands: (featurePack.testCommands || []).map(tc => `${tc.cmd} ${(tc.args || []).join(" ")}`.trim()).filter(Boolean),
          };
          featurePack.failurePacketJson = JSON.stringify(pkt, null, 2);
        }
      }

      const launch = await launchSwarmRun(featurePack, { cwd: runCwd });

      await db.insert(swarmRuns).values({
        repairId: launch.repairId,
        status: "running",
        intention: featurePack.intention,
        fixtureName: featurePack.fixtureName ?? null,
        stopReason: "running",
        applied: false,
        testsPassed: false,
        patchValid: null,
        modelPrimary: featurePack.primaryModel ?? null,
        modelFallback: featurePack.fallbackModel ?? null,
        costUsd: null,
        latencyMs: null,
        escalationTriggered: null,
        didRetry: null,
        profileId: profileId ?? null,
        featurePackJson: featurePack as any,
        repoSourceId: featurePack.repoSourceId ?? null,
        repoHeadSha: repoHeadSha ?? null,
        pushedBranch: null,
        pushedAt: null,
        pushedHeadSha: null,
        artifactPrefix: `swarm/runs/${launch.repairId}/`,
        artifactKeys: JSON.stringify([]),
        errorSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      return { repairId: launch.repairId, startedAtIso: launch.startedAtIso };
    }),

    ingest: adminProcedure.input(GetRunInputSchema).mutation(async ({ input }) => {
      // reads local runs/repair/<id> and uploads artifacts to storage + updates DB
      return await ingestLocalRepairRun(input.repairId);
    }),

    artifactUrl: adminProcedure.input(GetArtifactUrlInputSchema).query(async ({ input }) => {
      const url = await getArtifactUrl(input.key);
      return { url };
    }),

    pushToBranch: adminProcedure.input(PushRunToBranchInputSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [run] = await db.select().from(swarmRuns).where(eq(swarmRuns.repairId, input.repairId)).limit(1);
      if (!run) throw new Error("Run not found");
      const [repo] = await db.select().from(repoSources).where(eq(repoSources.id, input.repoSourceId)).limit(1);
      if (!repo) throw new Error("Repo source not found");

      const branch = input.branchName || `swarm/${input.repairId}`;
      const message = input.commitMessage || `Swarm repair ${input.repairId}`;

      // IMPORTANT: do NOT sync/reset here; we want the dirty workdir with applied changes.
      await getRepoWorkdirNoSync(repo as any);
      const pushed = await pushCurrentChangesToBranch(repo as any, branch, message, {
        authorName: ctx.user?.name || "LaunchBase Swarm",
        authorEmail: ctx.user?.email || "swarm@getlaunchbase.com",
      });

      await db.update(swarmRuns).set({
        pushedBranch: pushed.branch,
        pushedAt: new Date(pushed.pushedAtIso),
        pushedHeadSha: pushed.headSha,
        updatedAt: new Date(),
      } as any).where(eq(swarmRuns.repairId, input.repairId));

      return pushed;
    }),
  }),

  profiles: router({
    list: adminProcedure.input(ListProfilesInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(swarmProfiles).orderBy(desc(swarmProfiles.updatedAt)).limit(input.limit);
      const withStats = await Promise.all(rows.map(async (p: any) => {
        const stats = await computeProfileStats(db, p.id, "7d");
        return { ...p, stats7d: stats };
      }));
      return withStats;
    }),

    get: adminProcedure.input(GetProfileInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(swarmProfiles).where(eq(swarmProfiles.id, input.id)).limit(1);
      const profile = rows[0] ?? null;
      if (!profile) return null;
      const stats7d = await computeProfileStats(db, profile.id, "7d");
      const recentRuns = await db
        .select()
        .from(swarmRuns)
        .where(eq(swarmRuns.profileId as any, profile.id))
        .orderBy(desc(swarmRuns.createdAt))
        .limit(50);
      return { ...profile, stats7d, recentRuns };
    }),

    stats: adminProcedure.input(GetProfileStatsInputSchema).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const stats = await computeProfileStats(db, input.id, input.window);
      return ProfileStatsSchema.parse(stats);
    }),

    create: adminProcedure.input(CreateProfileInputSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(swarmProfiles).values({
        name: input.name,
        configJson: input.config as any,
        createdByUserId: ctx.user?.id ?? null,
        isPromoted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      return { ok: true };
    }),

    createFromRun: adminProcedure.input(CreateProfileFromRunInputSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const runs = await db.select().from(swarmRuns).where(eq(swarmRuns.repairId, input.repairId)).limit(1);
      if (!runs.length) throw new Error("Run not found");
      const fp = (runs[0] as any).featurePackJson;
      if (!fp) throw new Error("Run does not have featurePackJson");
      const name = input.name || `Profile from ${input.repairId}`;
      await db.insert(swarmProfiles).values({
        name,
        configJson: fp as any,
        createdByUserId: ctx.user?.id ?? null,
        isPromoted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      return { ok: true };
    }),

    promote: adminProcedure.input(PromoteProfileInputSchema).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(swarmProfiles).set({ isPromoted: input.isPromoted, updatedAt: new Date() } as any).where(eq(swarmProfiles.id, input.id));
      return { ok: true };
    }),
  }),
});
