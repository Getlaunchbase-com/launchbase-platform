#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runs = path.join(root, "runs");
const outDir = path.join(runs, "ops");
fs.mkdirSync(outDir, { recursive: true });

function latestFile(dir, rx) {
  if (!fs.existsSync(dir)) return "";
  const files = fs
    .readdirSync(dir)
    .filter((f) => rx.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { f, p, m: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.m - a.m);
  return files[0]?.p ?? "";
}

function readJsonIf(p) {
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const failurePacketPath = latestFile(path.join(runs, "swarm-input"), /^failure-packet-\d+\.json$/);
const marketingOpsPath = latestFile(path.join(runs, "marketing"), /^ops-cycle-\d+\.json$/);
const corpusPath = latestFile(path.join(runs, "marketing"), /^corpus-manifest-\d+\.json$/);
const backlogPath = latestFile(path.join(runs, "marketing"), /^agency-learning-backlog-\d+\.json$/);
const improvePath = latestFile(path.join(runs, "marketing"), /^swarm-improve-\d+\.md$/);

const packet = readJsonIf(failurePacketPath) ?? {};
const ops = readJsonIf(marketingOpsPath) ?? {};
const corpus = readJsonIf(corpusPath) ?? {};
const backlog = readJsonIf(backlogPath) ?? {};

const failures = Array.isArray(packet.failures) ? packet.failures : [];
const hasDnsInfra = failures.some((f) => /ERR_NAME_NOT_RESOLVED|dns|resolve/i.test(JSON.stringify(f)));
const hasAuthGap = failures.some((f) => /auth|401/i.test(JSON.stringify(f)));
const opsFailCount = Array.isArray(ops.results) ? ops.results.filter((r) => !r.ok).length : 0;
const sourceCount = Array.isArray(corpus.sources) ? corpus.sources.length : 0;
const backlogCount = Array.isArray(backlog.items) ? backlog.items.length : 0;

const controlPlane = {
  mission: "One cohesive multi-lane system for admin/app quality and marketing learning loops",
  lanes: [
    {
      name: "codex",
      role: "execution lead",
      strengths: ["code synthesis", "integration", "patch sequencing"],
      weaknesses: ["provider connectivity sensitivity"],
      routing: "default owner for implementation + final merge",
    },
    {
      name: "claude",
      role: "critique/reviewer lead",
      strengths: ["multi-angle critique", "proposal ranking", "risk framing"],
      weaknesses: ["host process-policy sensitivity in some shells"],
      routing: "mandatory critique pass on major plans and failures",
    },
    {
      name: "gemini",
      role: "signal/trend lead",
      strengths: ["context sweep", "trend synthesis", "counter-plan generation"],
      weaknesses: ["auth mode ambiguity if env not pinned"],
      routing: "daily signal pass + experiment hypothesis refresh",
    },
    {
      name: "github-cli",
      role: "repo ops",
      strengths: ["auth", "secrets", "release ops"],
      weaknesses: ["installer state on locked Windows hosts"],
      routing: "source-control and secret lifecycle authority",
    },
  ],
  runOrder: [
    "preflight: secrets + cli lane health",
    "platform smoke + admin coverage",
    "mobile viewer packet + blueprint e2e",
    "marketing ops cycle",
    "marketing corpus/backlog build",
    "swarm improve and promotion decisions",
    "artifact publish + blocker classification",
  ],
  failoverRules: [
    "If a lane fails preflight, mark degraded and continue with healthy lanes.",
    "Do not remove lane capability; auto-recheck next run.",
    "Classify blockers as code|infra|auth and route to owner immediately.",
    "No release block from external DNS-only failures; track as infra ticket.",
  ],
  currentSignals: {
    failureCount: failures.length,
    opsFailCount,
    hasDnsInfra,
    hasAuthGap,
    corpusSourceCount: sourceCount,
    backlogCount,
  },
};

const md = `# Unified Swarm Orchestration Plan

Generated: ${new Date().toISOString()}

## Mission
${controlPlane.mission}

## Source Artifacts
- Failure packet: ${failurePacketPath || "missing"}
- Marketing ops: ${marketingOpsPath || "missing"}
- Corpus manifest: ${corpusPath || "missing"}
- Learning backlog: ${backlogPath || "missing"}
- Swarm improve doc: ${improvePath || "missing"}

## Lane Design (Head + Specialists)
${controlPlane.lanes
  .map(
    (l, i) => `${i + 1}. **${l.name}** (${l.role})
- strengths: ${l.strengths.join(", ")}
- weakness: ${l.weaknesses.join(", ")}
- routing: ${l.routing}`
  )
  .join("\n")}

## Mandatory Run Order
${controlPlane.runOrder.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Failover Policy
${controlPlane.failoverRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Current State Snapshot
- failureCount: ${controlPlane.currentSignals.failureCount}
- marketingOpsFailCount: ${controlPlane.currentSignals.opsFailCount}
- hasDnsInfra: ${controlPlane.currentSignals.hasDnsInfra}
- hasAuthGap: ${controlPlane.currentSignals.hasAuthGap}
- corpusSourceCount: ${controlPlane.currentSignals.corpusSourceCount}
- backlogItemCount: ${controlPlane.currentSignals.backlogCount}

## Decision
System can run as a cohesive unit now with lane-aware failover.
Primary gap is reliability consistency per host context, not missing architecture.
`;

const ts = Date.now();
const mdPath = path.join(outDir, `swarm-unified-${ts}.md`);
const jsonPath = path.join(outDir, `swarm-unified-${ts}.json`);
fs.writeFileSync(mdPath, md, "utf8");
fs.writeFileSync(jsonPath, JSON.stringify(controlPlane, null, 2), "utf8");

console.log(mdPath);
console.log(jsonPath);
