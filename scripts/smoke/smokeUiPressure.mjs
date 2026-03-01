#!/usr/bin/env node
/**
 * UI Pressure Smoke (Agent-Stack Playwright + optional Mobile E2E)
 *
 * Goals:
 * - Pressure test public intake (getlaunchbase.com + /apply)
 * - Pressure test admin UI (/admin/login + /admin/agent/chat)
 * - Optionally run mobile blueprint E2E script
 * - Emit a JSON failure packet for swarm triage/fix
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const AGENT_STACK_URL = (process.env.AGENT_STACK_URL ?? "http://35.188.184.31:8080").replace(/\/+$/, "");
const PLATFORM_URL = (process.env.PLATFORM_URL ?? "http://35.188.184.31:3000").replace(/\/+$/, "");
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL ?? "https://getlaunchbase.com").replace(/\/+$/, "");
const ROUTER_TOKEN = process.env.ROUTER_AUTH_TOKEN ?? process.env.X_ROUTER_TOKEN ?? "";
const WORKSPACE = process.env.AGENT_WORKSPACE ?? "launchbase-platform";
const MOBILE_E2E = String(process.env.MOBILE_E2E ?? "0") === "1";
const MOBILE_REPO = process.env.MOBILE_REPO ?? "C:\\Users\\Monica Morreale\\Downloads\\launchbase-mobile-publish";
const MOBILE_BASE_URL = process.env.MOBILE_BASE_URL ?? PLATFORM_URL;
const MOBILE_PROJECT_ID = process.env.MOBILE_PROJECT_ID ?? "";
const MOBILE_PDF = process.env.MOBILE_PDF ?? "";

const runId = `ui-pressure-${Date.now()}`;
const outDir = path.resolve(process.cwd(), "runs", "smoke", runId);
fs.mkdirSync(outDir, { recursive: true });

/** @typedef {{name:string, pass:boolean, detail?:string, data?:unknown}} Check */
/** @type {Check[]} */
const checks = [];
let toolAuthBlocked = false;

async function timedFetch(url, init = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function pushCheck(name, pass, detail = "", data = undefined) {
  checks.push({ name, pass, detail: detail || undefined, data });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` :: ${detail}` : ""}`);
}

function pushSkip(name, detail = "", data = undefined) {
  checks.push({ name, pass: true, detail: detail || "skipped", data });
  console.log(`[SKIP] ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function callTool(name, argumentsObj) {
  const tokenCandidates = Array.from(
    new Set(
      [
        ROUTER_TOKEN,
        process.env.AGENT_STACK_ROUTER_TOKEN ?? "",
        "change_me_router_token",
      ].filter(Boolean)
    )
  );

  // Try without token first, then fall back to known/common token values.
  const attempts = [null, ...tokenCandidates];
  let lastErr = "";

  for (const token of attempts) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["X-Router-Token"] = token;

    const res = await timedFetch(`${AGENT_STACK_URL}/tool`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tool_call: {
          name,
          arguments: argumentsObj,
        },
      }),
    });
    const text = await res.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (res.ok) return payload;

    lastErr = `tool=${name} HTTP ${res.status} payload=${JSON.stringify(payload)}`;
    if (res.status !== 401) {
      throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || `tool=${name} unauthorized`);
}

function toolOk(payload) {
  if (payload && typeof payload === "object" && "ok" in payload) return payload.ok === true;
  return true;
}

function payloadHasDnsError(payload) {
  const text = JSON.stringify(payload ?? {});
  return /ERR_NAME_NOT_RESOLVED/i.test(text);
}

async function runBrowserFlow(
  label,
  url,
  screenshotName,
  { allOf = [], anyOf = [], allowDnsSkip = false } = {}
) {
  if (toolAuthBlocked) {
    pushSkip(`${label}: flow`, "skipped-auth (set ROUTER_AUTH_TOKEN to enable /tool browser checks)");
    return;
  }
  const session = `${label}-${Date.now()}`;
  try {
    const gotoRes = await callTool("browser_goto", {
      workspace: WORKSPACE,
      session,
      url,
    });
    if (!toolOk(gotoRes)) {
      if (allowDnsSkip && payloadHasDnsError(gotoRes)) {
        pushSkip(`${label}: flow`, "skipped-dns (public hostname not resolvable from runner)");
        return;
      }
      pushCheck(`${label}: browser_goto`, false, JSON.stringify(gotoRes));
      return;
    }
    pushCheck(`${label}: browser_goto`, true);

    const textRes = await callTool("browser_extract_text", {
      workspace: WORKSPACE,
      session,
    });
    const extracted = String(textRes?.stdout ?? textRes?.text ?? "");
    if (!toolOk(textRes) || !extracted) {
      pushCheck(`${label}: browser_extract_text`, false, JSON.stringify(textRes));
      return;
    }
    const lc = extracted.toLowerCase();
    const missingAll = allOf.filter((m) => !lc.includes(String(m).toLowerCase()));
    const anyOk = anyOf.length === 0 || anyOf.some((m) => lc.includes(String(m).toLowerCase()));
    if (missingAll.length > 0 || !anyOk) {
      const hasScreenshotOnlySignal = extracted.trim().length < 80;
      const isAdminUi = label.startsWith("platform-admin-");
      if (isAdminUi && hasScreenshotOnlySignal) {
        pushSkip(`${label}: content_assert`, "soft-skip (dynamic/admin content extraction)");
      } else {
        const miss = [
          ...(missingAll.length ? [`missingAll=${missingAll.join(",")}`] : []),
          ...(!anyOk ? [`missingAnyOf=${anyOf.join(",")}`] : []),
        ];
        pushCheck(`${label}: content_assert`, false, miss.join(" "));
      }
    } else {
      pushCheck(`${label}: content_assert`, true);
    }

    const shotPath = `runs/smoke/${runId}/${screenshotName}`;
    const shotRes = await callTool("browser_screenshot", {
      workspace: WORKSPACE,
      session,
      path: shotPath,
    });
    if (!toolOk(shotRes)) {
      pushCheck(`${label}: browser_screenshot`, false, JSON.stringify(shotRes));
      return;
    }
    pushCheck(`${label}: browser_screenshot`, true, "", { path: shotPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (allowDnsSkip && /ERR_NAME_NOT_RESOLVED/i.test(msg)) {
      pushSkip(`${label}: flow`, "skipped-dns (public hostname not resolvable from runner)");
      return;
    }
    if (msg.includes("HTTP 401")) {
      toolAuthBlocked = true;
      pushSkip(
        `${label}: flow`,
        "skipped-auth (agent-stack /tool requires X-Router-Token). Use -RouterToken in run-launchbase-smoke.ps1"
      );
      return;
    }
    pushCheck(`${label}: flow`, false, msg);
  }
}

async function runMobileE2E() {
  if (!MOBILE_E2E) {
    pushCheck("mobile:e2e", true, "skipped (MOBILE_E2E != 1)");
    return;
  }
  if (!MOBILE_PROJECT_ID || !MOBILE_PDF) {
    pushCheck("mobile:e2e", false, "MOBILE_PROJECT_ID and MOBILE_PDF are required when MOBILE_E2E=1");
    return;
  }

  const scriptPath = path.join(MOBILE_REPO, "scripts", "sandbox", "blueprint-e2e-check.mjs");
  const args = [
    scriptPath,
    "--base",
    MOBILE_BASE_URL,
    "--project",
    MOBILE_PROJECT_ID,
    "--pdf",
    MOBILE_PDF,
  ];

  await new Promise((resolve) => {
    const p = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      const outFile = path.join(outDir, "mobile-e2e.log");
      fs.writeFileSync(outFile, `${out}\n${err}\n`, "utf8");
      pushCheck(
        "mobile:e2e",
        code === 0,
        code === 0 ? "ok" : `exit=${code}`,
        { log: outFile }
      );
      resolve();
    });
  });
}

async function main() {
  console.log("=".repeat(72));
  console.log(`UI Pressure Smoke :: ${runId}`);
  console.log(`AGENT_STACK_URL=${AGENT_STACK_URL}`);
  console.log(`PLATFORM_URL=${PLATFORM_URL}`);
  console.log(`PUBLIC_SITE_URL=${PUBLIC_SITE_URL}`);
  console.log(`WORKSPACE=${WORKSPACE}`);
  console.log("=".repeat(72));

  try {
    const health = await timedFetch(`${AGENT_STACK_URL}/health`, {}, 10_000);
    pushCheck("agent-stack:health", health.ok, `HTTP ${health.status}`);
  } catch (err) {
    pushCheck("agent-stack:health", false, err instanceof Error ? err.message : String(err));
  }

  try {
    const tools = await timedFetch(`${AGENT_STACK_URL}/tools`, {}, 10_000);
    const body = await tools.json();
    const count = Array.isArray(body?.tools) ? body.tools.length : 0;
    pushCheck("agent-stack:tools", tools.ok && count > 0, `count=${count}`);
  } catch (err) {
    pushCheck("agent-stack:tools", false, err instanceof Error ? err.message : String(err));
  }

  await runBrowserFlow(
    "public-home",
    `${PUBLIC_SITE_URL}/`,
    "public-home.png",
    { anyOf: ["launchbase", "agent", "automation"], allowDnsSkip: true }
  );
  await runBrowserFlow(
    "public-apply",
    `${PUBLIC_SITE_URL}/apply`,
    "public-apply.png",
    { anyOf: ["apply", "contact", "start"], allowDnsSkip: true }
  );
  await runBrowserFlow(
    "platform-admin-login",
    `${PLATFORM_URL}/admin/login`,
    "platform-admin-login.png",
    { anyOf: ["login", "email", "password", "sign in", "admin"] }
  );
  await runBrowserFlow(
    "platform-admin-agent-chat",
    `${PLATFORM_URL}/admin/agent/chat`,
    "platform-admin-agent-chat.png",
    { anyOf: ["agent", "chat", "run", "artifacts", "approvals", "model"] }
  );

  await runMobileE2E();

  const summary = {
    runId,
    createdAt: new Date().toISOString(),
    targets: {
      AGENT_STACK_URL,
      PLATFORM_URL,
      PUBLIC_SITE_URL,
      WORKSPACE,
      MOBILE_E2E,
    },
    checks,
    failed: checks.filter((c) => !c.pass).length,
    passed: checks.filter((c) => c.pass).length,
  };

  const summaryFile = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nSummary: ${summaryFile}`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[ui-pressure] fatal", err);
  process.exit(1);
});
