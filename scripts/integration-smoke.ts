#!/usr/bin/env npx tsx
// ---------------------------------------------------------------------------
// Integration Smoke Test — LaunchBase Platform
// ---------------------------------------------------------------------------
// Runs a sequential pipeline of lightweight HTTP checks against a running
// (or freshly-booted) platform instance.  Uses only built-in Node.js fetch
// (Node 18+).  Exit code 0 = all passed, 1 = at least one failure.
// ---------------------------------------------------------------------------

const PLATFORM_URL = (process.env.PLATFORM_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 5_000;

// ── Helpers ----------------------------------------------------------------

interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  detail?: string;
}

const results: StepResult[] = [];

/** Fetch with a per-request AbortController timeout. */
async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Run a single numbered step.  Catches and records any error. */
async function runStep(
  step: number,
  name: string,
  fn: () => Promise<void>,
): Promise<boolean> {
  const label = `[Step ${step}] ${name}`;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`${label} ...`);
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    results.push({ step, name, passed: true });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL  ${name}`);
    console.error(`        Reason: ${message}`);
    results.push({ step, name, passed: false, detail: message });
    return false;
  }
}

/** Assert a condition or throw with the provided message. */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── Steps ------------------------------------------------------------------

async function stepHealthz(): Promise<void> {
  const url = `${PLATFORM_URL}/healthz`;
  console.log(`  GET ${url}`);
  const res = await timedFetch(url);
  assert(res.ok, `HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log(`  Response: ${JSON.stringify(body)}`);
  assert(
    body.status === "ok",
    `Expected status === "ok", got "${body.status}"`,
  );
}

async function stepContractsInfo(): Promise<void> {
  const url = `${PLATFORM_URL}/api/contracts/info`;
  console.log(`  GET ${url}`);
  const res = await timedFetch(url);
  assert(res.ok, `HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log(`  Response (keys): ${JSON.stringify(Object.keys(body))}`);
  assert(
    body.vertex !== undefined,
    `Missing "vertex" in response body`,
  );
  assert(
    body.contracts !== undefined,
    `Missing "contracts" in response body`,
  );
}

async function stepContractsHandshake(): Promise<void> {
  const url = `${PLATFORM_URL}/api/contracts/handshake`;
  const payload = {
    agent_id: "integration-test",
    agent_version: "1.0.0",
    contracts: [],
  };
  console.log(`  POST ${url}`);
  console.log(`  Payload: ${JSON.stringify(payload)}`);
  const res = await timedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert(res.ok, `HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log(`  Response: ${JSON.stringify(body)}`);
  assert(body.ok === true, `Expected ok === true, got ${JSON.stringify(body.ok)}`);
}

async function stepBuildInfo(): Promise<void> {
  const url = `${PLATFORM_URL}/api/build-info`;
  console.log(`  GET ${url}`);
  const res = await timedFetch(url);
  assert(res.ok, `HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log(`  Response (keys): ${JSON.stringify(Object.keys(body))}`);
  assert(
    body.gitSha !== undefined,
    `Missing "gitSha" in response body`,
  );
}

async function stepTrpcSystemStatus(): Promise<void> {
  const url = `${PLATFORM_URL}/api/trpc/system.status`;
  console.log(`  GET ${url}`);
  const res = await timedFetch(url);
  assert(res.ok, `HTTP ${res.status} ${res.statusText}`);
  const body = await res.json();
  console.log(`  Response (keys): ${JSON.stringify(Object.keys(body))}`);
  // tRPC wraps results in { result: { data: ... } }
  assert(
    body.result !== undefined,
    `Missing "result" envelope — tRPC may not be responding correctly`,
  );
}

// ── Main -------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  LaunchBase Platform — Integration Smoke Test");
  console.log(`  Target: ${PLATFORM_URL}`);
  console.log(`  Timeout per request: ${REQUEST_TIMEOUT_MS}ms`);
  console.log("=".repeat(60));

  const steps: Array<[string, () => Promise<void>]> = [
    ["GET /healthz — status ok", stepHealthz],
    ["GET /api/contracts/info — vertex + contracts", stepContractsInfo],
    ["POST /api/contracts/handshake — ok true", stepContractsHandshake],
    ["GET /api/build-info — gitSha present", stepBuildInfo],
    ["GET /api/trpc/system.status — tRPC responds", stepTrpcSystemStatus],
  ];

  let failFast = false;

  for (let i = 0; i < steps.length; i++) {
    const [name, fn] = steps[i];
    const passed = await runStep(i + 1, name, fn);
    if (!passed) {
      failFast = true;
      console.error(`\n  Stopping early — step ${i + 1} failed.`);
      break;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log("  SUMMARY");
  console.log("=".repeat(60));

  const totalRun = results.length;
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const totalSkipped = steps.length - totalRun;

  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    const detail = r.detail ? ` (${r.detail})` : "";
    console.log(`  [${icon}] Step ${r.step}: ${r.name}${detail}`);
  }
  if (totalSkipped > 0) {
    console.log(`  [SKIP] ${totalSkipped} step(s) skipped due to fail-fast`);
  }

  console.log("─".repeat(60));
  console.log(
    `  Total: ${steps.length} | Passed: ${totalPassed} | Failed: ${totalFailed} | Skipped: ${totalSkipped}`,
  );
  console.log("=".repeat(60));

  if (failFast || totalFailed > 0) {
    process.exit(1);
  }

  console.log("\n  All smoke tests passed.\n");
}

main().catch((err) => {
  console.error("Unexpected top-level error:", err);
  process.exit(1);
});
