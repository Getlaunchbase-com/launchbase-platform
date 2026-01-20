import fs from "node:fs";
import path from "node:path";

type Json = any;

type Role = "fieldGeneral" | "coder" | "reviewer" | "arbiter";

const ROLE_FILES: Record<Role, string> = {
  fieldGeneral: "fieldGeneral.json",
  coder: "coder.json",
  reviewer: "reviewer.json",
  arbiter: "arbiter.json",
};

function readJson(filePath: string): Json {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function makeReplayProvider(opts: {
  baseDir: string; // e.g. server/ai/engine/__tests__/fixtures/swarm/replays
  replayId: string; // apply_ok | reject_ok | revise_then_apply
}) {
  const counters: Record<Role, number> = {
    fieldGeneral: 0,
    coder: 0,
    reviewer: 0,
    arbiter: 0,
  };

  function loadRolePayload(role: Role): Json {
    const file = ROLE_FILES[role];
    const filePath = path.join(opts.baseDir, opts.replayId, file);
    const data = readJson(filePath);

    // allow either single object or array of objects
    if (Array.isArray(data)) {
      const idx = counters[role];
      const picked = data[Math.min(idx, data.length - 1)];
      counters[role] = idx + 1;
      return picked;
    }

    // single object
    return data;
  }

  return {
    // shape should match what your providerFactory returns for other providers
    async completeJson(args: { role: Role }) {
      return loadRolePayload(args.role);
    },
  };
}
