#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inFile = path.join(root, "scripts", "marketing", "sources", "agency-community-intel.json");
const outDir = path.join(root, "runs", "marketing");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(inFile)) {
  console.error(`Missing: ${inFile}`);
  process.exit(1);
}

const src = JSON.parse(fs.readFileSync(inFile, "utf8"));
const agencies = Array.isArray(src.top_agencies) ? src.top_agencies : [];
const communities = Array.isArray(src.professional_communities) ? src.professional_communities : [];
const antiPatterns = Array.isArray(src.anti_patterns_to_learn) ? src.anti_patterns_to_learn : [];

const tasks = [];
for (const a of agencies) {
  tasks.push({
    kind: "agency_pattern_study",
    target: a.name,
    focus: a.focus ?? [],
    steps: [
      "Collect public case studies and service pages",
      "Extract positioning framework, offer structure, and channel mix",
      "Derive reusable hypotheses for LaunchBase SMB segments",
      "Tag evidence quality and confidence",
    ],
    output: "pattern_card"
  });
}

for (const c of communities) {
  tasks.push({
    kind: "community_signal_scan",
    target: c.name,
    url: c.url,
    collection_method: c.collection_method,
    steps: [
      "Collect high-engagement posts and threads from public pages only",
      "Extract recurring pain points, objections, and language patterns",
      "Map to funnel stage and channel intent",
      "Emit testable messaging hypotheses"
    ],
    output: "signal_card"
  });
}

for (const p of antiPatterns) {
  tasks.push({
    kind: "anti_pattern_curriculum",
    target: p,
    steps: [
      "Define failure signature",
      "Define early warning metric",
      "Define remediation playbook",
      "Define hard guardrail in campaign automation"
    ],
    output: "anti_pattern_card"
  });
}

const backlog = {
  generatedAt: new Date().toISOString(),
  counts: {
    agencies: agencies.length,
    communities: communities.length,
    antiPatterns: antiPatterns.length,
    totalTasks: tasks.length
  },
  tasks
};

const outFile = path.join(outDir, `agency-learning-backlog-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(backlog, null, 2), "utf8");
console.log(outFile);
