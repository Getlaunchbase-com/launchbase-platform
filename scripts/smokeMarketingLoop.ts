#!/usr/bin/env npx tsx
/**
 * Marketing Loop Smoke Test (Admin)
 *
 * Verifies the end-to-end operator flow:
 * 1) Auth
 * 2) Marketing signals CRUD-ish path
 * 3) Marketing inbox CRUD-ish path
 * 4) Feedback -> proposal -> approve -> apply loop
 *
 * Exit code 0 = pass, 1 = fail.
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers/_incoming_routers";

const BASE_URL = (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const LOGIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? "vmorre@live.com";
const LOGIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? "Vmorre420";
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);

type StepResult = {
  step: number;
  name: string;
  passed: boolean;
  detail?: string;
};

const results: StepResult[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function runStep(step: number, name: string, fn: () => Promise<void>): Promise<boolean> {
  console.log(`\n[Step ${step}] ${name}`);
  try {
    await fn();
    console.log("  PASS");
    results.push({ step, name, passed: true });
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("  FAIL:", detail);
    results.push({ step, name, passed: false, detail });
    return false;
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(68));
  console.log("Marketing Loop Smoke Test");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Login:  ${LOGIN_EMAIL}`);
  console.log("=".repeat(68));

  let token = "";

  const runTag = `smoke-${Date.now()}`;
  let projectId = 0;
  let instanceId = 0;
  let signalId = "";
  let inboxId = "";
  let feedbackId = 0;
  let proposalId = 0;
  let cycleRunId = "";

  const okLogin = await runStep(1, "Authenticate admin via /auth/login", async () => {
    const res = await timedFetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
      }),
    });
    assert(res.ok, `Login HTTP ${res.status}`);
    const body = (await res.json()) as any;
    assert(body?.ok === true, `Login returned ok=${String(body?.ok)}`);
    assert(typeof body?.access_token === "string" && body.access_token.length > 20, "Missing access_token");
    token = body.access_token;
  });
  if (!okLogin) return finish(1);

  const trpc = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${BASE_URL}/api/trpc`,
        transformer: superjson,
        headers() {
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });

  const okContext = await runStep(2, "Resolve project + agent instance context", async () => {
    const projectsRes = await trpc.admin.projects.list.query({ status: "active", limit: 50, offset: 0 });
    const projects = projectsRes?.items ?? [];
    assert(projects.length > 0, "No accessible active projects for this admin user");
    projectId = Number(projects[0].projectId);
    assert(Number.isFinite(projectId) && projectId > 0, "Invalid projectId from projects.list");

    let vertexId = 0;
    const vertices = await trpc.admin.vertexProfiles.list.query({ limit: 20, offset: 0 });
    if ((vertices?.profiles ?? []).length > 0) {
      vertexId = Number(vertices.profiles[0].id);
    } else {
      const created = await trpc.admin.vertexProfiles.create.mutate({
        name: `smoke-vertex-${runTag}`,
        description: "Marketing smoke test profile",
        configJson: { model: "gpt-4o-mini", temperature: 0.2 },
        toolsAllowlistJson: ["blueprint.parse", "estimate.chain"],
      });
      vertexId = Number((created as any).id);
    }
    assert(vertexId > 0, "Could not resolve/create a vertex profile");

    const instancesRes = await trpc.admin.agentInstances.list.query({
      projectId,
      limit: 50,
      offset: 0,
    });
    const existing = (instancesRes?.instances ?? [])[0];
    if (existing) {
      instanceId = Number(existing.id);
    } else {
      const created = await trpc.admin.agentInstances.create.mutate({
        projectId,
        vertexId,
        displayName: `Smoke Instance ${runTag}`,
      });
      instanceId = Number((created as any).id);
    }
    assert(instanceId > 0, "Could not resolve/create an agent instance");
  });
  if (!okContext) return finish(1);

  const okSignals = await runStep(3, "Marketing signals: seed -> list -> note -> status", async () => {
    const seeded = await trpc.marketingSignals.seed.mutate({ count: 2 });
    assert((seeded as any)?.ok === true, "marketingSignals.seed did not return ok=true");

    const listed = await trpc.marketingSignals.list.query({ limit: 100 });
    const rows = (listed as any)?.rows ?? [];
    assert(rows.length > 0, "marketingSignals.list returned no rows");
    signalId = String(rows[0]?.id ?? "");
    assert(signalId.length > 0, "Could not resolve a signal id");

    await trpc.marketingSignals.addNote.mutate({
      id: signalId,
      note: `Smoke note ${runTag}`,
    });
    await trpc.marketingSignals.setStatus.mutate({
      id: signalId,
      status: "triaged",
    });

    const verify = await trpc.marketingSignals.list.query({ limit: 100 });
    const updated = ((verify as any)?.rows ?? []).find((r: any) => String(r.id) === signalId);
    assert(updated, `Signal ${signalId} not found on verification read`);
    assert(updated.status === "triaged", `Signal status expected triaged, got ${String(updated.status)}`);
  });
  if (!okSignals) return finish(1);

  const okInbox = await runStep(4, "Marketing inbox: create -> list -> status -> notes", async () => {
    const title = `Smoke Inbox ${runTag}`;
    const created = await trpc.marketingInbox.create.mutate({
      title,
      source: "smoke",
      summary: "smoke marketing inbox item",
      payload: { runTag },
      priority: "normal",
      score: 10,
    });
    assert((created as any)?.ok === true, "marketingInbox.create did not return ok=true");
    inboxId = String((created as any)?.id ?? "");
    assert(inboxId.length > 0, "marketingInbox.create missing id");

    const listed = await trpc.marketingInbox.list.query({ q: "Smoke Inbox", limit: 100 });
    const rows = (listed as any)?.rows ?? [];
    assert(rows.some((r: any) => String(r.id) === inboxId), `Inbox item ${inboxId} not found`);

    await trpc.marketingInbox.setStatus.mutate({ id: inboxId, status: "queued" });
    await trpc.marketingInbox.updateNotes.mutate({ id: inboxId, notes: `Smoke notes ${runTag}` });
  });
  if (!okInbox) return finish(1);

  const okLoop = await runStep(5, "Feedback loop: create -> swarm -> approve -> apply", async () => {
    const created = await trpc.admin.feedback.create.mutate({
      instanceId,
      projectId,
      message: `Smoke feedback ${runTag}`,
      category: "missing_capability",
      severity: "medium",
      source: "operator_os",
    });
    feedbackId = Number((created as any)?.feedbackId ?? 0);
    assert(feedbackId > 0, "feedback.create did not return feedbackId");

    const swarm = await trpc.admin.feedback.triggerImprovementSwarm.mutate({
      projectId,
      instanceId,
      sinceDaysAgo: 1,
      includeStatuses: ["open", "triaged"],
    });
    assert((swarm as any)?.swarmRunId !== null, "Swarm did not create a run");
    assert(Number((swarm as any)?.proposalCount ?? 0) > 0, "Swarm created 0 proposals");

    const proposals = await trpc.admin.feedback.listProposals.query({
      swarmRunId: Number((swarm as any).swarmRunId),
      limit: 50,
      offset: 0,
    });
    const row = ((proposals as any)?.proposals ?? [])[0];
    assert(row, "No proposal returned for swarmRunId");
    proposalId = Number(row.id);
    assert(proposalId > 0, "Invalid proposal id");

    await trpc.admin.feedback.reviewProposal.mutate({
      id: proposalId,
      decision: "approved",
      reviewNote: `Smoke approval ${runTag}`,
    });

    const applied = await trpc.admin.feedback.applyProposal.mutate({ id: proposalId });
    assert((applied as any)?.status === "applied", "Proposal did not reach applied status");

    const feedbackRow = await trpc.admin.feedback.getById.query({ id: feedbackId });
    assert(feedbackRow && (feedbackRow as any).status === "resolved", "Feedback did not resolve after apply");
  });
  if (!okLoop) return finish(1);

  await runStep(6, "Sanity readback: marketing agents list", async () => {
    const instancesRes = await trpc.admin.agentInstances.list.query({ projectId, limit: 50, offset: 0 });
    const count = (instancesRes?.instances ?? []).length;
    assert(count > 0, "No agent instances visible after smoke run");
  });

  const okLanes = await runStep(7, "Marketing lanes: publish/read staged model lanes", async () => {
    const lanesRes = await trpc.admin.marketingAgents.getModelLanes.query();
    const lanes = (lanesRes as any)?.lanes ?? [];
    assert(Array.isArray(lanes), "getModelLanes did not return lanes[]");
    assert(lanes.length >= 3, `Expected at least 3 lanes, got ${lanes.length}`);
    const laneIds = new Set(lanes.map((l: any) => String(l?.lane ?? "")));
    assert(laneIds.has("main-8b-governed"), "Missing lane main-8b-governed");
    assert(laneIds.has("sandbox-8b-isolated"), "Missing lane sandbox-8b-isolated");
    assert(laneIds.has("sandbox-8b-obliterated"), "Missing lane sandbox-8b-obliterated");
  });
  if (!okLanes) return finish(1);

  await runStep(8, "Marketing cycle: runCycle parallel compare metadata", async () => {
    const cycle = await trpc.admin.marketingAgents.runCycle.mutate({
      vertical: "small-business-websites",
      engine: "standard",
      mode: "research",
      notes: `Smoke parallel compare ${runTag}`,
      parallelCompare: true,
      primaryModel: "anthropic/claude-sonnet-4-6",
      reviewModel: "anthropic/claude-sonnet-4-6",
    });
    cycleRunId = String((cycle as any)?.runId ?? "");
    assert(cycleRunId.length > 0, "runCycle did not return runId");

    const cyclesRes = await trpc.admin.marketingAgents.listCycles.query({ limit: 25 });
    const rows = (cyclesRes as any)?.rows ?? [];
    const row = rows.find((r: any) => String(r?.id ?? "") === cycleRunId);
    assert(row, `runCycle row ${cycleRunId} not found in listCycles`);
    const meta = (row as any)?.meta ?? {};
    assert(meta?.parallelCompare === true || meta?.parallelComparison?.enabled === true, "parallel compare metadata missing");
  });

  return finish(0);

  function finish(code: number): void {
    console.log(`\n${"=".repeat(68)}`);
    console.log("SUMMARY");
    for (const r of results) {
      console.log(`[${r.passed ? "PASS" : "FAIL"}] Step ${r.step}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
    }
    console.log("-".repeat(68));
    const passCount = results.filter((r) => r.passed).length;
    const failCount = results.length - passCount;
    console.log(`Pass: ${passCount}  Fail: ${failCount}`);
    if (signalId) console.log(`Signal ID: ${signalId}`);
    if (inboxId) console.log(`Inbox ID: ${inboxId}`);
    if (feedbackId) console.log(`Feedback ID: ${feedbackId}`);
    if (proposalId) console.log(`Proposal ID: ${proposalId}`);
    if (cycleRunId) console.log(`Cycle Run ID: ${cycleRunId}`);
    console.log("=".repeat(68));
    process.exit(code);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
