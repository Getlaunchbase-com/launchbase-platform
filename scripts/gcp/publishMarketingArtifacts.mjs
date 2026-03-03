#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
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

function parseEnvFile(p) {
  const out = {};
  const txt = readIfExists(p);
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    out[k] = v;
  }
  return out;
}

function latestDir(base, prefix) {
  if (!fs.existsSync(base)) return "";
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => {
      const p = path.join(base, d.name);
      return { p, m: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.m - a.m)[0]?.p ?? "";
}

function latestFile(base, pattern) {
  if (!fs.existsSync(base)) return "";
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((f) => f.isFile() && pattern.test(f.name))
    .map((f) => {
      const p = path.join(base, f.name);
      return { p, m: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.m - a.m)[0]?.p ?? "";
}

function gcloud(...argv) {
  if (dryRun) {
    console.log("[dryrun]", "gcloud", ...argv);
    return { ok: true, code: 0, out: "" };
  }
  const r = spawnSync("gcloud", argv, { encoding: "utf8" });
  return { ok: r.status === 0, code: r.status ?? 1, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadIntentFiles() {
  if (!fs.existsSync(queueDir)) return [];
  return fs
    .readdirSync(queueDir)
    .filter((n) => /^publish-intent-.*\.json$/.test(n))
    .map((n) => path.join(queueDir, n));
}

function hasDuplicateIntent(intent) {
  for (const f of loadIntentFiles()) {
    try {
      const parsed = parseJsonSafe(readIfExists(f));
      if (
        parsed.latestPack === intent.latestPack &&
        parsed.datasetDest === intent.datasetDest &&
        parsed.artifactDest === intent.artifactDest
      ) {
        return path.basename(f);
      }
    } catch {
      // ignore malformed
    }
  }
  return "";
}

function queueIntent(intent) {
  ensureDir(queueDir);
  const dup = hasDuplicateIntent(intent);
  if (dup) {
    console.log(`Publish intent already queued: ${dup}`);
    return;
  }
  const file = path.join(queueDir, `publish-intent-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(intent, null, 2), "utf8");
  console.log(`Queued publish intent: ${file}`);
}

function copyToGcs(src, dest) {
  const r = gcloud("storage", "cp", "-r", src, dest);
  if (!r.ok) throw new Error(`gcloud storage cp failed (${src} -> ${dest}) :: ${r.out.slice(0, 300)}`);
}

function main() {
  const cfg = parseEnvFile(path.join(ROOT, "scripts", "gcp", "launchbase_gcp.env"));
  const project = process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || cfg.PROJECT_ID;
  const modelsBucket = process.env.MODELS_BUCKET || cfg.MODELS_BUCKET;
  const dataBucket = process.env.DATA_BUCKET || cfg.DATA_BUCKET || modelsBucket;
  const artifactsBucket = process.env.ARTIFACTS_BUCKET || cfg.ARTIFACTS_BUCKET || modelsBucket;
  if (!project || !dataBucket || !artifactsBucket) {
    throw new Error("PROJECT_ID, DATA_BUCKET, and ARTIFACTS_BUCKET are required.");
  }

  const runs = path.join(ROOT, "runs", "marketing");
  const latestPack = latestDir(runs, "fine-tune-pack-");
  if (!latestPack) throw new Error(`No fine-tune pack found in ${runs}`);

  const latestSwarm = latestFile(runs, /^swarm-improve-\d+\.md$/);
  const latestOps = latestFile(runs, /^ops-cycle-\d+\.json$/);
  const latestReflection = latestFile(runs, /^ops-reflection-\d+\.md$/);
  const latestCorpus = latestFile(runs, /^corpus-manifest-\d+\.json$/);
  const latestBacklog = latestFile(runs, /^agency-learning-backlog-\d+\.json$/);
  const files = [latestSwarm, latestOps, latestReflection, latestCorpus, latestBacklog].filter(Boolean);

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(now.getUTCDate()).padStart(2, "0")}`;
  const packName = path.basename(latestPack);
  const datasetDest = `gs://${dataBucket}/datasets/processed/marketing/${stamp}/${packName}/`;
  const artifactDest = `gs://${artifactsBucket}/training/marketing/${stamp}/${packName}/`;

  const handoff = {
    publishedAt: new Date().toISOString(),
    projectId: project,
    datasetBucket: dataBucket,
    artifactsBucket,
    fineTunePackLocal: latestPack,
    fineTunePackDatasetGcs: datasetDest,
    fineTunePackArtifactsGcs: artifactDest,
    related: {
      swarmImprove: latestSwarm,
      opsCycle: latestOps,
      opsReflection: latestReflection,
      corpusManifest: latestCorpus,
      learningBacklog: latestBacklog,
    },
  };

  const intent = {
    createdAt: new Date().toISOString(),
    latestPack,
    datasetDest,
    artifactDest,
    files,
    handoff,
  };

  try {
    const setProject = gcloud("config", "set", "project", project);
    if (!setProject.ok) throw new Error(setProject.out.slice(0, 300));

    copyToGcs(latestPack, datasetDest);
    copyToGcs(latestPack, artifactDest);
    for (const f of files) copyToGcs(f, artifactDest);

    const tmp = path.join(os.tmpdir(), `vertex-handoff-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(handoff, null, 2), "utf8");
    copyToGcs(tmp, `${artifactDest}vertex-handoff.json`);
    try { fs.unlinkSync(tmp); } catch {}
    console.log("Publish complete.");
  } catch (err) {
    console.log(`Publish failed; deferring to queue: ${err instanceof Error ? err.message : String(err)}`);
    queueIntent(intent);
  }
}

main();
