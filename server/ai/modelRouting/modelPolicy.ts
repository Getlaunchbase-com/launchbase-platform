/**
 * Model Policy Resolver
 * 
 * Filters models by constraints, ranks by preference, returns primary + fallbacks.
 */

import { ModelRegistry } from "./modelRegistry";
import { MODEL_POLICIES } from "./modelPolicy.config";
import { ModelConstraints, ModelResolution, NormalizedModel } from "./modelRouting.types";

function matchesPattern(modelId: string, pattern: string): boolean {
  // simple glob: "*" matches any chars
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const re = new RegExp(`^${escaped}$`, "i");
  return re.test(modelId);
}

function passesConstraints(m: NormalizedModel, c: ModelConstraints): { ok: boolean; why?: string } {
  if (m.type !== c.type) return { ok: false, why: "type" };

  if (c.developerAllowlist?.length) {
    if (!m.developer || !c.developerAllowlist.includes(m.developer)) return { ok: false, why: "developer_allowlist" };
  }
  if (c.developerDenylist?.length) {
    if (m.developer && c.developerDenylist.includes(m.developer)) return { ok: false, why: "developer_denylist" };
  }

  if (typeof c.minContextLength === "number") {
    if (!m.contextLength || m.contextLength < c.minContextLength) return { ok: false, why: "context" };
  }

  if (c.requiredFeatures?.length) {
    for (const f of c.requiredFeatures) {
      if (!m.features.includes(f)) return { ok: false, why: "features" };
    }
  }

  return { ok: true };
}

function scoreModel(m: NormalizedModel, preferred: string[], c: ModelConstraints): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;

  // Preference match
  const prefIndex = preferred.findIndex((p) => matchesPattern(m.id, p));
  if (prefIndex >= 0) {
    score += 1000 - prefIndex; // earlier preferred => higher
    notes.push(`preferred_match:${preferred[prefIndex]}`);
  }

  // Context (higher better if constraint relevant)
  if (typeof c.minContextLength === "number" && m.contextLength) {
    score += Math.min(200, Math.floor(m.contextLength / 1000));
    notes.push(`context:${m.contextLength}`);
  }

  // Feature richness
  if (c.requiredFeatures?.length) {
    score += c.requiredFeatures.length * 20;
    notes.push(`features_required:${c.requiredFeatures.join(",")}`);
  } else {
    score += Math.min(100, m.features.length * 5);
  }

  return { score, notes };
}

export class ModelPolicy {
  constructor(private registry: ModelRegistry) {}

  resolve(task: string, constraintsOverride?: Partial<ModelConstraints>): ModelResolution {
    const policy = MODEL_POLICIES.find((p) => p.task === task) ?? MODEL_POLICIES.find((p) => p.task === "chat");
    if (!policy) throw new Error("No MODEL_POLICIES configured");

    const appliedConstraints: ModelConstraints = { ...policy.constraints, ...(constraintsOverride ?? {}) };
    const preferred = policy.preferredModelIds ?? [];
    const fallbackLimit = policy.fallbackLimit ?? 5;

    const filteredOut: Record<string, number> = {};
    const candidates = this.registry.list();

    const eligible: NormalizedModel[] = [];
    for (const m of candidates) {
      const ok = passesConstraints(m, appliedConstraints);
      if (!ok.ok) {
        filteredOut[ok.why ?? "unknown"] = (filteredOut[ok.why ?? "unknown"] ?? 0) + 1;
        continue;
      }
      eligible.push(m);
    }

    const rankingNotes: string[] = [];
    const scored = eligible
      .map((m) => {
        const s = scoreModel(m, preferred, appliedConstraints);
        rankingNotes.push(`${m.id} => ${s.score} (${s.notes.join(";")})`);
        return { m, score: s.score };
      })
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      throw new Error(`No eligible models for task=${task} constraints=${JSON.stringify(appliedConstraints)}`);
    }

    const primary = scored[0].m;
    const fallbacks = scored.slice(1, 1 + fallbackLimit).map((x) => x.m);

    return {
      primary,
      fallbacks,
      reason: {
        task,
        appliedConstraints,
        candidatesConsidered: candidates.length,
        filteredOut,
        ranking: rankingNotes.slice(0, 50),
      },
    };
  }
}
