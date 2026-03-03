#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUNS = path.join(ROOT, "runs");
const OUT_DIR = path.join(RUNS, "marketing");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ROUNDS = Number(process.env.SWARM_ROUNDS ?? 5);

function readIfExists(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function latestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return "";
  const files = fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => ({ f, p: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files[0]?.p ?? "";
}

function parseFailures(packetText) {
  if (!packetText) return [];
  try {
    const json = JSON.parse(packetText);
    return Array.isArray(json.failures) ? json.failures : [];
  } catch {
    return [];
  }
}

function rankActions(failures) {
  const actions = [];
  const names = failures.map((f) => String(f?.name ?? ""));
  if (names.some((n) => n.includes("public-home") || n.includes("public-apply"))) {
    actions.push("Smoke policy: treat external DNS failures as SKIP with explicit infra ticket, not release blocker.");
  }
  if (names.some((n) => n.includes("auth.login"))) {
    actions.push("Inject strict admin auth credentials in CI nightly lane and keep dev lane non-blocking.");
  }
  actions.push("Use daily marketing ops loop with kill criteria and stop-loss per experiment.");
  actions.push("Separate research dataset, action dataset, and failure dataset for fine-tune readiness.");
  actions.push("Promotion gate: quality up, compliance green, cost within ceiling, else no promotion.");
  return actions;
}

function inferSignals() {
  const opsPath = latestFile(path.join(RUNS, "marketing"), /^ops-cycle-\d+\.json$/);
  const corpusPath = latestFile(path.join(RUNS, "marketing"), /^corpus-manifest-\d+\.json$/);
  const backlogPath = latestFile(path.join(RUNS, "marketing"), /^agency-learning-backlog-\d+\.json$/);
  const gatePath = latestFile(path.join(RUNS, "marketing", "gates"), /^fine-tune-gate-\d+\.json$/);
  const uiPath = latestFile(path.join(RUNS, "smoke"), /^ui-pressure-\d+$/);
  const adminPath = latestFile(path.join(RUNS, "smoke"), /^admin-console-\d+$/);
  const queueDir = path.resolve("C:\\Users\\Monica Morreale\\agent-runs\\publish-queue");
  let opsFailCount = 0;
  let opsSkipCount = 0;
  let corpusSourceCount = 0;
  let backlogItemCount = 0;
  let gatePass = false;
  let gateCounts = { sft: 0, pref: 0, eval: 0 };
  let smokeSkipCount = 0;
  let publishQueueCount = 0;
  try {
    const ops = JSON.parse(readIfExists(opsPath) || "{}");
    opsFailCount = Array.isArray(ops.results) ? ops.results.filter((r) => !r.ok).length : 0;
    opsSkipCount = Array.isArray(ops.results) ? ops.results.filter((r) => r.skipped === true).length : 0;
  } catch {}
  try {
    const corpus = JSON.parse(readIfExists(corpusPath) || "{}");
    const totalsValid = Number(corpus?.totals?.valid ?? 0);
    corpusSourceCount = totalsValid > 0 ? totalsValid : Array.isArray(corpus.valid) ? corpus.valid.length : 0;
  } catch {}
  try {
    const backlog = JSON.parse(readIfExists(backlogPath) || "{}");
    backlogItemCount = Number(backlog?.counts?.totalTasks ?? 0) || (Array.isArray(backlog.tasks) ? backlog.tasks.length : 0);
  } catch {}
  try {
    const gate = JSON.parse(readIfExists(gatePath) || "{}");
    gatePass = gate?.pass === true;
    gateCounts = {
      sft: Number(gate?.counts?.sft ?? 0),
      pref: Number(gate?.counts?.pref ?? 0),
      eval: Number(gate?.counts?.eval ?? 0),
    };
  } catch {}
  try {
    if (uiPath) {
      const ui = JSON.parse(readIfExists(path.join(uiPath, "summary.json")) || "{}");
      smokeSkipCount += Array.isArray(ui.checks) ? ui.checks.filter((c) => /skip/i.test(String(c?.detail ?? ""))).length : 0;
    }
    if (adminPath) {
      const admin = JSON.parse(readIfExists(path.join(adminPath, "summary.json")) || "{}");
      smokeSkipCount += Number(admin?.skipped ?? 0);
    }
  } catch {}
  try {
    publishQueueCount = fs.existsSync(queueDir)
      ? fs.readdirSync(queueDir).filter((f) => /^publish-intent-.*\.json$/.test(f)).length
      : 0;
  } catch {}
  return {
    opsFailCount,
    opsSkipCount,
    corpusSourceCount,
    backlogItemCount,
    gatePass,
    gateCounts,
    smokeSkipCount,
    publishQueueCount,
  };
}

function roundSection(round, carry, actions, signals) {
  const focus = [
    "Channel economics and conversion bottlenecks",
    "Offer/message fit by vertical and segment",
    "Experiment design quality and holdout discipline",
    "Dataset quality, labeling policy, and eval reliability",
    "Promotion gates, rollback criteria, and safety checks",
    "Execution speed vs quality tradeoffs",
    "Anti-pattern detection and stop-doing list",
  ][(round - 1) % 7];

  const signalActions = [];
  if (signals.opsFailCount > 0) {
    signalActions.push(
      `Stabilize marketing ops endpoints first (current failing steps: ${signals.opsFailCount}) before adding new experiments.`
    );
  }
  if (signals.opsSkipCount > 0) {
    signalActions.push(
      `Infra-blocked ops steps detected (${signals.opsSkipCount} skipped). Route critical ops checks to VM lane with stable network access.`
    );
  }
  if (signals.corpusSourceCount === 0) {
    signalActions.push("Corpus source count is zero. Build source inventory and attribution coverage before training updates.");
  }
  if (signals.backlogItemCount === 0) {
    signalActions.push("Learning backlog is empty. Require top 20 prioritized tasks per weekly cycle.");
  }
  if (signals.publishQueueCount > 0) {
    signalActions.push(
      `Cloud publish queue has ${signals.publishQueueCount} pending intents. Add automated flush from a network-reachable runner.`
    );
  }
  if (!signals.gatePass) {
    signalActions.push("Fine-tune gate is not passing. Freeze promotion and repair dataset quality before next training cycle.");
  } else {
    signalActions.push(
      `Fine-tune gate passing with counts sft=${signals.gateCounts.sft}, pref=${signals.gateCounts.pref}, eval=${signals.gateCounts.eval}. Increase sample depth before raising training cadence.`
    );
  }
  if (signals.smokeSkipCount > 0) {
    signalActions.push(
      `Smoke coverage has ${signals.smokeSkipCount} skipped checks. Keep skips non-blocking but require at least one network-valid lane to avoid blind spots.`
    );
  }

  const next = [
    `### Round ${round}`,
    "",
    `Round focus: ${focus}`,
    "",
    "Section A: Top strategic upgrades",
    ...[...actions, ...signalActions].map((a, i) => `${i + 1}. ${a}`),
    "",
    "Section B: Tactical experiments",
    "1. Vertical split test: electricians/local contractors vs generic SMB messaging.",
    "2. Offer test: fixed-price starter automation vs consultation-led funnel.",
    "3. Channel test: local FB groups + Reddit value-posting + referral ask cadence.",
    "4. Creative test: proof-first case framing vs feature-first framing.",
    "5. Lifecycle test: 7-day follow-up sequence with intent-based branching.",
    "",
    "Section C: Risk register",
    "1. Compliance drift from unlicensed data ingestion.",
    "2. Brand risk from aggressive messaging without evidence.",
    "3. Wasted spend from weak channel intent matching.",
    "",
    "Section D: Assumptions/confidence",
    `- Carry-forward assumptions length: ${carry.length}`,
    `- Signals: corpusSources=${signals.corpusSourceCount}, backlogTasks=${signals.backlogItemCount}, publishQueue=${signals.publishQueueCount}`,
    "- Confidence baseline: 72% (requires live model/market feedback to increase).",
    "",
    "Section E: Rollback",
    "- Auto-stop experiment at pre-defined spend cap and adverse KPI threshold.",
    "- Revert to last approved playbook snapshot.",
    "",
    "How can we improve this?",
    "- Add per-vertical negative keyword and anti-pattern libraries.",
    "- Add holdout groups to measure true incremental lift.",
    "",
    "What are we doing wrong?",
    "- Over-indexing on tool setup when distribution learnings should lead.",
    "- Running tests without strict acceptance thresholds.",
    "",
  ];
  return next.join("\n");
}

function buildFinal(rounds, failures, packetPath) {
  const header = [
    "# Marketing Swarm Improvement Plan",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Rounds: ${rounds.length}`,
    `Failure Packet: ${packetPath || "none"}`,
    "",
    "## Failure Snapshot",
    ...(failures.length
      ? failures.map((f) => `- ${f.name || "unknown"} :: ${f.detail || "no-detail"}`)
      : ["- No hard failures in latest packet."]),
    "",
    "## Swarm Rounds",
    "",
  ];
  return `${header.join("\n")}${rounds.join("\n")}`;
}

function main() {
  const mastery = readIfExists(path.resolve("C:\\Users\\Monica Morreale\\MARKETING_AI_MASTERY_PLAN.md"));
  const knowledge = readIfExists(path.resolve(ROOT, "docs", "marketing", "KnowledgeIngestionPlan.md"));
  const failurePacketPath = latestFile(path.join(RUNS, "swarm-input"), /^failure-packet-\d+\.json$/);
  const failurePacket = readIfExists(failurePacketPath);
  const failures = parseFailures(failurePacket);
  const actions = rankActions(failures);
  const signals = inferSignals();

  let carry = `${mastery}\n\n${knowledge}`.slice(0, 12000);
  const rounds = [];
  for (let i = 1; i <= ROUNDS; i += 1) {
    const section = roundSection(i, carry, actions, signals);
    rounds.push(section);
    carry = `${carry}\n${section}`.slice(0, 12000);
  }

  const out = buildFinal(rounds, failures, failurePacketPath);
  const outFile = path.join(OUT_DIR, `swarm-improve-${Date.now()}.md`);
  fs.writeFileSync(outFile, out, "utf8");
  console.log(outFile);
}

main();
