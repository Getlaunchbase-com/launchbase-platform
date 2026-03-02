#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const MOBILE_REPO =
  process.env.MOBILE_REPO ?? "C:\\Users\\Monica Morreale\\Downloads\\launchbase-mobile-publish";
const BASE_URL = process.env.PLATFORM_URL ?? "http://35.188.184.31:3000";
const PROJECT_ID = process.env.MOBILE_PROJECT_ID ?? "36";
const PDF_PATH =
  process.env.MOBILE_PDF ?? "C:\\Users\\Monica Morreale\\Downloads\\YOUR_BLUEPRINT.pdf";

const outDir = path.join(ROOT, "runs", "ops");
fs.mkdirSync(outDir, { recursive: true });
const runId = `full-exec-${Date.now()}`;
const reportPath = path.join(outDir, `${runId}.json`);

function classify(text) {
  const t = String(text || "");
  if (/spawnSync .* (EPERM|EACCES|ENOENT|EINVAL)/i.test(t)) return "infra";
  if (/ERR_NAME_NOT_RESOLVED|connect EACCES|fetch failed/i.test(t)) return "infra";
  if (/Unauthorized|HTTP 401/i.test(t)) return "auth";
  return "code";
}

function runStep(name, cmd, args, cwd = ROOT) {
  const res = spawnSync(cmd, args, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: process.env,
    timeout: 10 * 60 * 1000,
  });
  const stdout = String(res.stdout ?? "");
  const stderr = String(res.stderr ?? "");
  const errMsg = res.error ? String(res.error.message || res.error) : "";
  const merged = `${stdout}\n${stderr}\n${errMsg}`;
  const ok = res.status === 0;
  return {
    name,
    ok,
    exitCode: res.status ?? -1,
    class: ok ? "pass" : classify(merged),
    sample: merged.slice(0, 1200),
  };
}

const steps = [
  { name: "typecheck", cmd: "npm.cmd", args: ["run", "typecheck"], cwd: ROOT },
  { name: "smoke-ui-pressure", cmd: "npm.cmd", args: ["run", "smoke:ui-pressure"], cwd: ROOT },
  { name: "smoke-admin-console", cmd: "npm.cmd", args: ["run", "smoke:admin-console"], cwd: ROOT },
  { name: "smoke-failure-packet", cmd: "npm.cmd", args: ["run", "smoke:failure-packet"], cwd: ROOT },
  {
    name: "marketing-build-learning-backlog",
    cmd: "npm.cmd",
    args: ["run", "marketing:build-learning-backlog"],
    cwd: ROOT,
  },
  {
    name: "marketing-build-corpus-manifest",
    cmd: "npm.cmd",
    args: ["run", "marketing:build-corpus-manifest"],
    cwd: ROOT,
  },
  { name: "marketing-ops-cycle", cmd: "npm.cmd", args: ["run", "marketing:ops-cycle"], cwd: ROOT },
  {
    name: "marketing-swarm-improve",
    cmd: "npm.cmd",
    args: ["run", "marketing:swarm-improve"],
    cwd: ROOT,
  },
  {
    name: "marketing-build-fine-tune-pack",
    cmd: "npm.cmd",
    args: ["run", "marketing:build-fine-tune-pack"],
    cwd: ROOT,
  },
  {
    name: "marketing-cli-preflight",
    cmd: "npm.cmd",
    args: ["run", "marketing:cli-preflight"],
    cwd: ROOT,
  },
  {
    name: "mobile-viewer-packet",
    cmd: "npm.cmd",
    args: ["run", "sandbox:viewer-packet"],
    cwd: MOBILE_REPO,
  },
  {
    name: "mobile-blueprint-e2e",
    cmd: "node",
    args: [
      "scripts/sandbox/blueprint-e2e-check.mjs",
      "--base",
      BASE_URL,
      "--project",
      PROJECT_ID,
      "--pdf",
      PDF_PATH,
    ],
    cwd: MOBILE_REPO,
  },
];

const startedAt = new Date().toISOString();
const results = [];
for (const s of steps) {
  const r = runStep(s.name, s.cmd, s.args, s.cwd);
  results.push(r);
  const tag = r.ok ? "PASS" : `FAIL:${r.class.toUpperCase()}`;
  console.log(`[${tag}] ${s.name}`);
}

const summary = {
  runId,
  startedAt,
  finishedAt: new Date().toISOString(),
  results,
  counts: {
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    infra: results.filter((r) => r.class === "infra").length,
    auth: results.filter((r) => r.class === "auth").length,
    code: results.filter((r) => r.class === "code").length,
  },
};

fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), "utf8");
console.log(reportPath);

if (summary.counts.code > 0) {
  process.exit(1);
}
