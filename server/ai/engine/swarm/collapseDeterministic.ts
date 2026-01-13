/**
 * Deterministic Collapse Logic (Phase 2.4)
 * 
 * Pure function that synthesizes craft + critic outputs into final customer-safe decision.
 * 
 * Key Properties:
 * - Pure + deterministic (no provider calls)
 * - Only reads minimal subset from craft/critic
 * - Returns stopReason always (ok or needs_human)
 * - If needs_human, payload is null
 * - Sanitizes forbidden keys in debug extensions
 */

import type { StopReasonV1 } from "../types";

type Severity = "low" | "medium" | "high";

type CraftSubset = {
  proposedChanges?: Array<{ targetKey: string; value: unknown; rationale: string }>;
  risks?: string[];
  assumptions?: string[];
};

type CriticSubset = {
  pass?: boolean;
  issues?: Array<{ severity?: Severity; message?: string }>;
  previewRecommended?: boolean;
  risks?: string[];
  assumptions?: string[];
};

export type CollapseInput = {
  craft: { stopReason: string; payload: unknown };
  critic: { stopReason: string; payload: unknown };
};

export type DeterministicCollapsePayload = {
  outcome: "ok" | "needs_human";
  recommendation?: string;
  title?: string;
  proposedChanges?: Array<{ targetKey: string; value: unknown; rationale: string }>;
  risks: string[];
  assumptions: string[];
  nextActions: string[];
  criticSummary?: {
    pass: boolean;
    highIssueCount: number;
    issueCount: number;
  };
};

// ============================================
// SANITIZATION HELPERS
// ============================================

const FORBIDDEN_KEYS = new Set(
  ["prompt", "system", "provider", "stack", "traceback", "error"].map((s) => s.toLowerCase())
);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function clampStr(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) : s;
}

function uniqStrings(xs: unknown, max = 25): string[] {
  if (!Array.isArray(xs)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of xs) {
    if (typeof v !== "string") continue;
    const t = clampStr(v.trim());
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeUnknown(input: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  if (input === null) return null;

  const t = typeof input;
  if (t === "string") return clampStr(input);
  if (t === "number" || t === "boolean") return input;

  if (Array.isArray(input)) {
    return input.slice(0, 50).map((x) => sanitizeUnknown(x, depth + 1));
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitizeUnknown(v, depth + 1);
    }
    return out;
  }

  return null;
}

// ============================================
// CRAFT/CRITIC SUBSET READERS
// ============================================

function readCraftSubset(payload: unknown): CraftSubset {
  if (!isPlainObject(payload)) return {};
  const proposedChangesRaw = payload.proposedChanges;
  const proposedChanges =
    Array.isArray(proposedChangesRaw)
      ? proposedChangesRaw
          .slice(0, 25)
          .map((x) => (isPlainObject(x) ? x : null))
          .filter(Boolean)
          .map((x) => ({
            targetKey: typeof x!.targetKey === "string" ? clampStr(x!.targetKey, 200) : "",
            value: x!.value,
            rationale: typeof x!.rationale === "string" ? clampStr(x!.rationale, 500) : "",
          }))
          .filter((x) => x.targetKey.length > 0)
      : undefined;

  return {
    proposedChanges,
    risks: uniqStrings(payload.risks),
    assumptions: uniqStrings(payload.assumptions),
  };
}

function readCriticSubset(payload: unknown): CriticSubset {
  if (!isPlainObject(payload)) return {};
  const issuesRaw = payload.issues;
  const issues =
    Array.isArray(issuesRaw)
      ? issuesRaw
          .slice(0, 50)
          .map((x) => (isPlainObject(x) ? x : null))
          .filter(Boolean)
          .map((x) => ({
            severity:
              x!.severity === "low" || x!.severity === "medium" || x!.severity === "high"
                ? (x!.severity as Severity)
                : undefined,
            message: typeof x!.message === "string" ? clampStr(x!.message, 500) : undefined,
          }))
      : undefined;

  return {
    pass: typeof payload.pass === "boolean" ? payload.pass : undefined,
    issues,
    previewRecommended: typeof payload.previewRecommended === "boolean" ? payload.previewRecommended : undefined,
    risks: uniqStrings(payload.risks),
    assumptions: uniqStrings(payload.assumptions),
  };
}

// ============================================
// DETERMINISTIC COLLAPSE BUILDER
// ============================================

export function buildDeterministicCollapse(input: CollapseInput): {
  stopReason: StopReasonV1;
  payload: DeterministicCollapsePayload | null;
  extensions?: Record<string, unknown>;
} {
  const craftStop = input.craft.stopReason;
  const criticStop = input.critic.stopReason;

  // Gate on stopReason FIRST - if either specialist failed, escalate immediately
  const craftOk = craftStop === "ok";
  const criticOk = criticStop === "ok";

  if (!craftOk || !criticOk) {
    return {
      stopReason: "needs_human",
      payload: null,
      extensions: {
        warnings: [
          {
            kind: "swarm.incomplete_inputs",
            message: "One or more specialists missing or failed",
            detail: { craftStop, criticStop },
          },
        ],
      },
    };
  }

  // ONLY below this line is it legal to read craft/critic schema fields
  const craft = readCraftSubset(input.craft.payload);
  const critic = readCriticSubset(input.critic.payload);

  const pass = critic.pass === true;
  const issues = critic.issues ?? [];
  const highIssues = issues.filter((i) => i?.severity === "high");
  const hasChanges = Array.isArray(craft.proposedChanges) && craft.proposedChanges.length > 0;

  // Determine if human escalation is needed (schema-based checks)
  const needsHuman =
    !pass ||
    highIssues.length > 0 ||
    !hasChanges;

  // Merge risks and assumptions from both specialists
  const risks = Array.from(new Set([...(craft.risks ?? []), ...(critic.risks ?? [])])).slice(0, 25);
  const assumptions = Array.from(new Set([...(craft.assumptions ?? []), ...(critic.assumptions ?? [])])).slice(0, 25);

  // Build next actions based on critic feedback
  const nextActions: string[] = [];
  if (!pass) nextActions.push("Provide missing context and re-run");
  if (highIssues.length > 0) nextActions.push("Resolve high-severity issues");
  if (critic.previewRecommended) nextActions.push("Preview before publish");

  // Build payload (null if needs_human)
  const payload: DeterministicCollapsePayload | null = needsHuman
    ? null
    : {
        outcome: "ok",
        title: "Swarm proposal",
        recommendation: critic.previewRecommended ? "Apply changes and preview" : "Apply changes",
        proposedChanges: craft.proposedChanges!,
        risks,
        assumptions,
        nextActions,
        criticSummary: {
          pass: true,
          highIssueCount: 0,
          issueCount: issues.length,
        },
      };

  // Build internal debug extensions (NOT customerSafe)
  const safeExtensions = {
    collapseDebug: sanitizeUnknown({
      craftStop,
      criticStop,
      pass,
      issueCount: issues.length,
      highIssueCount: highIssues.length,
      hasChanges,
    }),
  };

  return {
    stopReason: needsHuman ? "needs_human" : "ok",
    payload,
    extensions: safeExtensions,
  };
}
