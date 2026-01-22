import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { getDb } from "../db";
import { swarmRuns, alertEvents } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { putArtifactBytes, putArtifactText, buildArtifactKey, DEFAULT_ARTIFACT_ALLOWLIST } from "./artifactStore";
import { parseRepairPacketJson } from "./parseRepairPacket";
import { notifyOwner } from "../_core/notification";

export type IngestResult = {
  repairId: string;
  uploadedKeys: string[];
  summary: any;
};

function safeRead(path: string): Buffer | null {
  try { return readFileSync(path); } catch { return null; }
}

export async function ingestLocalRepairRun(repairId: string, runRoot = join(process.cwd(), "runs", "repair")): Promise<IngestResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const runDir = join(runRoot, repairId);
  if (!existsSync(runDir)) throw new Error(`Run dir not found: ${runDir}`);

  const uploadedKeys: string[] = [];
  const present = new Set(readdirSync(runDir));

  // Always try repairPacket.json first
  const rpPath = join(runDir, "repairPacket.json");
  const rpBuf = safeRead(rpPath);
  let parsed: any = {};
  if (rpBuf) {
    const text = rpBuf.toString("utf8");
    parsed = parseRepairPacketJson(JSON.parse(text));
    const key = buildArtifactKey(repairId, "repairPacket.json");
    await putArtifactText(repairId, "repairPacket.json", text, "application/json");
    uploadedKeys.push(key);
  }

  // Upload allowlisted artifacts if present
  for (const name of DEFAULT_ARTIFACT_ALLOWLIST) {
    if (name === "repairPacket.json") continue;
    if (!present.has(name)) continue;
    const buf = safeRead(join(runDir, name));
    if (!buf) continue;
    const key = buildArtifactKey(repairId, name);
    const ct = name.endsWith(".json") ? "application/json" : "text/plain";
    await putArtifactBytes(repairId, name, buf, ct);
    uploadedKeys.push(key);
  }

  const now = new Date();
  // Upsert-ish: if exists, update
  const existing = await db.select().from(swarmRuns).where(eq(swarmRuns.repairId, repairId)).limit(1);
  const row = {
    repairId,
    createdAt: existing[0]?.createdAt ?? now,
    finishedAt: now,
    status: "finished",
    stopReason: parsed.stopReason ?? "unknown",
    applied: !!parsed.applied,
    testsPassed: !!parsed.testsPassed,
    patchValid: parsed.patchValid === undefined ? null : !!parsed.patchValid,
    modelPrimary: parsed.modelPrimary ?? null,
    modelFallback: parsed.modelFallback ?? null,
    costUsd: parsed.costUsd ?? null,
    latencyMs: parsed.latencyMs ?? null,
    escalationTriggered: parsed.escalationTriggered ?? null,
    didRetry: parsed.didRetry ?? null,
    fixtureName: existing[0]?.fixtureName ?? null,
    intention: existing[0]?.intention ?? null,
    artifactPrefix: `swarm/runs/${repairId}/`,
    artifactKeys: JSON.stringify(uploadedKeys),
    errorSummary: null,
    updatedAt: now,
  } as any;

  if (existing.length) {
    await db.update(swarmRuns).set(row).where(eq(swarmRuns.repairId, repairId));
  } else {
    await db.insert(swarmRuns).values(row);
  }

  // Swarm failure alerts (best-effort): notify owner + create/update an alert event
  const stopReason = (row.stopReason || "unknown") as string;
  if (stopReason !== "ok") {
    try {
      await notifyOwner({
        title: `Swarm run failed: ${repairId}`,
        content: `stopReason=${stopReason}\napplied=${row.applied}\ntestsPassed=${row.testsPassed}\n\nOpen: /admin/swarm/runs/${repairId}`,
      });
    } catch {
      // ignore
    }

    try {
      const tenant = "launchbase";
      const alertKey = "swarm:run_failed";
      const fingerprint = `${tenant}|${alertKey}|${stopReason}`;
      const title = `[${tenant}] Swarm run failed`;
      const message = `RepairId: ${repairId}\nStop reason: ${stopReason}\nApplied: ${row.applied}\nTests passed: ${row.testsPassed}\n\nOpen: /admin/swarm/runs/${repairId}`;
      const now = new Date();

      const existingAlert = await db
        .select()
        .from(alertEvents)
        .where(eq(alertEvents.fingerprint, fingerprint))
        .limit(1);

      if (existingAlert.length) {
        await db
          .update(alertEvents)
          .set({
            lastSeenAt: now,
            title,
            message,
            severity: stopReason === "infra" ? "crit" : "warn",
            meta: { repairId, stopReason },
          } as any)
          .where(eq(alertEvents.fingerprint, fingerprint));
      } else {
        await db.insert(alertEvents).values({
          tenant,
          alertKey,
          fingerprint,
          severity: stopReason === "infra" ? "crit" : "warn",
          title,
          message,
          status: "active",
          firstSeenAt: now,
          lastSeenAt: now,
          meta: { repairId, stopReason },
        } as any);
      }
    } catch {
      // ignore
    }
  }

  return { repairId, uploadedKeys, summary: row };
}
