#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const runsRoot = path.resolve(process.cwd(), "runs", "smoke");
const outRoot = path.resolve(process.cwd(), "runs", "swarm-input");
fs.mkdirSync(outRoot, { recursive: true });

function latestSummary(prefix) {
  if (!fs.existsSync(runsRoot)) return null;
  const dirs = fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const d of dirs) {
    const p = path.join(runsRoot, d, "summary.json");
    if (fs.existsSync(p)) {
      return { dir: d, path: p, data: JSON.parse(fs.readFileSync(p, "utf8")) };
    }
  }
  return null;
}

const ui = latestSummary("ui-pressure-");
const admin = latestSummary("admin-console-");

const packet = {
  generatedAt: new Date().toISOString(),
  sources: {
    ui: ui ? { dir: ui.dir, path: ui.path } : null,
    admin: admin ? { dir: admin.dir, path: admin.path } : null,
  },
  failures: [
    ...((ui?.data?.checks ?? []).filter((c) => c.pass === false)),
    ...((admin?.data?.checks ?? []).filter((c) => c.pass === false)),
  ],
  skips: [
    ...((ui?.data?.checks ?? []).filter((c) => String(c.detail || "").includes("skipped"))),
    ...((admin?.data?.checks ?? []).filter((c) => String(c.detail || "").includes("skipped"))),
  ],
  recommendations: [],
};

if (packet.failures.length === 0) {
  packet.recommendations.push("No hard failures found. Continue feature hardening and strict-auth checks.");
}

if (packet.skips.some((s) => String(s.detail || "").includes("ROUTER_AUTH_TOKEN"))) {
  packet.recommendations.push("Inject ROUTER_AUTH_TOKEN to enable Playwright /tool flows.");
}

if (packet.skips.some((s) => String(s.detail || "").includes("SMOKE_ADMIN_EMAIL"))) {
  packet.recommendations.push("Add SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD for authenticated admin API coverage.");
}

const outFile = path.join(outRoot, `failure-packet-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(packet, null, 2), "utf8");
console.log(outFile);
