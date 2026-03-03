#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const BASE = String(process.env.PLATFORM_URL ?? "http://35.188.184.31:3000").replace(/\/+$/, "");
const OPS_TOKEN = String(process.env.MARKETING_OPS_TOKEN ?? "");
const outDir = path.join(process.cwd(), "runs", "marketing");
fs.mkdirSync(outDir, { recursive: true });

function isInfraErrorMessage(v) {
  return /(fetch failed|ECONNREFUSED|EACCES|ENOTFOUND|ETIMEDOUT|aborted|network)/i.test(String(v || ""));
}

async function postJson(route, body = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(OPS_TOKEN ? { "x-ops-token": OPS_TOKEN } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function line(o) {
  const status = o.skipped ? "SKIP" : o.ok ? "PASS" : "FAIL";
  const suffix = o.skipped ? ` (${o.reason ?? "skipped"})` : ` (HTTP ${o.status})`;
  return `- ${o.name}: ${status}${suffix}`;
}

async function main() {
  const started = new Date().toISOString();
  const results = [];

  const steps = [
    { name: "scrub", route: "/ops/marketing/scrub", body: {} },
    { name: "score", route: "/ops/marketing/score", body: { limit: 100 } },
    { name: "eval", route: "/ops/marketing/eval", body: {} },
    { name: "dashboard-refresh", route: "/ops/marketing/dashboard-refresh", body: { windowDays: 14 } },
    { name: "benchmark-refresh", route: "/ops/marketing/benchmark-refresh", body: { maxCases: 100 } },
    { name: "monthly-review", route: "/ops/marketing/monthly-review", body: { windowDays: 30 } },
  ];

  for (const s of steps) {
    try {
      const r = await postJson(s.route, s.body);
      results.push({ name: s.name, ...r });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isInfraErrorMessage(msg)) {
        results.push({
          name: s.name,
          ok: true,
          skipped: true,
          reason: "infra-skip (runner/network unreachable)",
          status: 0,
          json: { error: msg },
        });
        continue;
      }
      results.push({
        name: s.name,
        ok: false,
        status: 0,
        json: { error: msg },
      });
    }
  }

  const reflection = [
    "# Daily Marketing Reflection",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Execution Results",
    ...results.map(line),
    "",
    "## Mandatory Questions",
    "- Are we doing enough to increase qualified pipeline this week?",
    "- Can we improve speed of learning without reducing quality?",
    "- Which experiments should be killed immediately?",
    "- Which experiments are worth scaling now?",
    "- Are we wasting spend on low-intent channels?",
    "- What did we learn today that changes tomorrow's plan?",
    "",
    "## Next Actions",
    "- Promote only evidence-backed hypotheses.",
    "- Add one new anti-pattern guardrail if any failure repeated.",
    "- Rebalance channel budget to highest incremental lift.",
  ].join("\n");
  const strictMode = /^(1|true|yes)$/i.test(String(process.env.MARKETING_OPS_STRICT ?? ""));

  const ts = Date.now();
  const jsonFile = path.join(outDir, `ops-cycle-${ts}.json`);
  const mdFile = path.join(outDir, `ops-reflection-${ts}.md`);
  fs.writeFileSync(jsonFile, JSON.stringify({ started, base: BASE, results }, null, 2), "utf8");
  fs.writeFileSync(mdFile, reflection, "utf8");

  console.log(jsonFile);
  console.log(mdFile);

  if (strictMode && results.some((r) => !r.ok)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
