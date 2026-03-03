#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dryRun = process.argv.includes("--dry-run");
const queueDir = process.env.PUBLISH_QUEUE_DIR || path.join(os.homedir(), "agent-runs", "publish-queue");

function readIfExists(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function parseJsonSafe(txt) {
  return JSON.parse(String(txt || "").replace(/^\uFEFF/, ""));
}

function gcloud(...argv) {
  if (dryRun) {
    console.log("[dryrun]", "gcloud", ...argv);
    return { ok: true, out: "" };
  }
  const r = spawnSync("gcloud", argv, { encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function listItems() {
  if (!fs.existsSync(queueDir)) return [];
  return fs
    .readdirSync(queueDir)
    .filter((n) => /^publish-intent-.*\.json$/.test(n))
    .map((n) => path.join(queueDir, n))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function dedupe() {
  const seen = new Set();
  for (const f of listItems()) {
    try {
      const j = parseJsonSafe(readIfExists(f));
      const key = `${j.latestPack}|${j.datasetDest}|${j.artifactDest}`;
      if (seen.has(key)) {
        fs.unlinkSync(f);
        console.log(`Removed duplicate queued intent: ${path.basename(f)}`);
        continue;
      }
      seen.add(key);
    } catch {
      // Keep malformed files for manual inspection.
    }
  }
}

function copyToGcs(src, dest) {
  const r = gcloud("storage", "cp", "-r", src, dest);
  if (!r.ok) throw new Error(`copy failed ${src} -> ${dest}: ${r.out.slice(0, 300)}`);
}

function main() {
  dedupe();
  const items = listItems();
  if (items.length === 0) {
    console.log("No queued publish intents.");
    return;
  }

  for (const f of items) {
    try {
      const intent = parseJsonSafe(readIfExists(f));
      console.log(`Flushing intent: ${path.basename(f)}`);
      copyToGcs(intent.latestPack, intent.datasetDest);
      copyToGcs(intent.latestPack, intent.artifactDest);
      for (const x of intent.files || []) copyToGcs(x, intent.artifactDest);
      const tmp = path.join(os.tmpdir(), `vertex-handoff-${Date.now()}.json`);
      fs.writeFileSync(tmp, JSON.stringify(intent.handoff || {}, null, 2), "utf8");
      copyToGcs(tmp, `${intent.artifactDest}vertex-handoff.json`);
      try { fs.unlinkSync(tmp); } catch {}
      if (!dryRun) fs.unlinkSync(f);
      console.log(`Flushed and removed: ${path.basename(f)}`);
    } catch (err) {
      console.log(`Flush failed (kept queued): ${path.basename(f)} :: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main();
