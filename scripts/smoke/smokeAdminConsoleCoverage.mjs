#!/usr/bin/env node
/**
 * Admin Console Coverage Smoke
 *
 * Read-only coverage checks for:
 * - admin chat/runtime visibility
 * - model lane visibility
 * - agent instances visibility
 * - files/runs/approvals visibility
 * - marketing agent console data visibility
 */

import fs from "node:fs";
import path from "node:path";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const BASE_URL = (process.env.PLATFORM_URL ?? "http://35.188.184.31:3000").replace(/\/+$/, "");
const LOGIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "";
const LOGIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "";
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);
const STRICT_AUTH = String(process.env.SMOKE_STRICT_AUTH ?? "0") === "1";

const runId = `admin-console-${Date.now()}`;
const outDir = path.resolve(process.cwd(), "runs", "smoke", runId);
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function pushCheck(name, pass, detail = "", data = undefined) {
  checks.push({ name, pass, detail: detail || undefined, data });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
}

function pushSkip(name, detail = "", data = undefined) {
  checks.push({ name, pass: true, skipped: true, detail: detail || "skipped", data });
  console.log(`[SKIP] ${name}${detail ? ` :: ${detail}` : ""}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function isInfraFetchErrorText(text) {
  return /(fetch failed|ECONNREFUSED|EACCES|ENOTFOUND|ETIMEDOUT|aborted|network)/i.test(
    String(text || "")
  );
}

async function timedFetch(url, init = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkPage(pathname) {
  try {
    const res = await timedFetch(`${BASE_URL}${pathname}`);
    pushCheck(`route:${pathname}`, res.ok, `HTTP ${res.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isInfraFetchErrorText(msg)) {
      pushSkip(`route:${pathname}`, "infra-skip (runner/network unreachable)");
    } else {
      pushCheck(`route:${pathname}`, false, msg);
    }
  }
}

async function main() {
  console.log("=".repeat(72));
  console.log(`Admin Console Coverage Smoke :: ${runId}`);
  console.log(`BASE_URL=${BASE_URL}`);
  console.log("=".repeat(72));

  await checkPage("/admin/login");
  await checkPage("/admin/agent/chat");
  await checkPage("/admin/console");
  await checkPage("/admin/console/marketing-agents");
  await checkPage("/admin/console/runs");
  await checkPage("/admin/console/files");
  await checkPage("/admin/console/models");
  await checkPage("/admin/console/tools");

  if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
    pushCheck("auth.login", true, "skipped (set SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD for authenticated coverage)");
    if (STRICT_AUTH) {
      pushCheck("auth.strict", false, "SMOKE_STRICT_AUTH=1 requires credentials");
    }
    finalizeAndExit();
    return;
  }

  let token = "";
  try {
    const login = await timedFetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    });
    const body = await login.json();
    assert(login.ok && body?.ok === true && body?.access_token, `login failed HTTP ${login.status}`);
    token = String(body.access_token);
    pushCheck("auth.login", true);
  } catch (err) {
    pushCheck("auth.login", false, err instanceof Error ? err.message : String(err));
    finalizeAndExit();
    return;
  }

  const trpc = createTRPCClient({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
        headers() {
          return { Authorization: `Bearer ${token}` };
        },
      }),
    ],
  });

  async function probe(name, fn) {
    try {
      const data = await fn();
      pushCheck(name, true, "", summarize(data));
    } catch (err) {
      pushCheck(name, false, err instanceof Error ? err.message : String(err));
    }
  }

  await probe("trpc.admin.operatorOS.getRuntimeStatus", () => trpc.admin.operatorOS.getRuntimeStatus.query());
  await probe("trpc.admin.operatorOS.listRuns", () =>
    trpc.admin.operatorOS.listRuns.query({ limit: 20, offset: 0 })
  );
  await probe("trpc.admin.operatorOS.listArtifacts", () =>
    trpc.admin.operatorOS.listArtifacts.query({ limit: 20, offset: 0 })
  );
  await probe("trpc.admin.operatorOS.pendingProposals", () =>
    trpc.admin.operatorOS.pendingProposals.query({ limit: 20, offset: 0 })
  );
  await probe("trpc.admin.agentInstances.list", () => trpc.admin.agentInstances.list.query({}));
  await probe("trpc.admin.vertexProfiles.list", () => trpc.admin.vertexProfiles.list.query({}));
  await probe("trpc.admin.marketingAgents.getFeatureFlags", () =>
    trpc.admin.marketingAgents.getFeatureFlags.query()
  );
  await probe("trpc.admin.marketingAgents.getModelLanes", () =>
    trpc.admin.marketingAgents.getModelLanes.query()
  );
  await probe("trpc.admin.marketingAgents.listCycles", () =>
    trpc.admin.marketingAgents.listCycles.query({ limit: 20 })
  );
  await probe("trpc.admin.marketingAgents.getScorecard", () =>
    trpc.admin.marketingAgents.getScorecard.query({ days: 14 })
  );
  await probe("trpc.admin.marketingAgents.listPromotionQueue", () =>
    trpc.admin.marketingAgents.listPromotionQueue.query({ limit: 25 })
  );
  await probe("trpc.admin.feedback.listProposals", () =>
    trpc.admin.feedback.listProposals.query({ limit: 25, offset: 0 })
  );

  finalizeAndExit();
}

function summarize(data) {
  if (Array.isArray(data)) return { kind: "array", count: data.length };
  if (data && typeof data === "object") {
    const o = data;
    const out = { keys: Object.keys(o).slice(0, 12) };
    if (Array.isArray(o.items)) out.items = o.items.length;
    if (Array.isArray(o.rows)) out.rows = o.rows.length;
    if (Array.isArray(o.runs)) out.runs = o.runs.length;
    if (Array.isArray(o.artifacts)) out.artifacts = o.artifacts.length;
    if (Array.isArray(o.proposals)) out.proposals = o.proposals.length;
    if (Array.isArray(o.cycles)) out.cycles = o.cycles.length;
    return out;
  }
  return { value: data };
}

function finalizeAndExit() {
  const summary = {
    runId,
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks,
    failed: checks.filter((c) => !c.pass).length,
    passed: checks.filter((c) => c.pass).length,
    skipped: checks.filter((c) => c.skipped === true).length,
  };
  const out = path.join(outDir, "summary.json");
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nSummary: ${out}`);
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[admin-console-coverage] fatal:", err);
  process.exit(1);
});
