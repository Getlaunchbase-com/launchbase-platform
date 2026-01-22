import { spawn } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { FeaturePackV1 } from "./types";


export type LaunchResult = {
  repairId: string;
  pid?: number;
  startedAtIso: string;
};

function nowId(): string {
  return `repair_${Date.now()}`;
}

export async function launchSwarmRun(featurePack: FeaturePackV1, opts?: { cwd?: string }): Promise<LaunchResult> {
  // We launch either fixture runner or swarm:fix with a temp failurePacket.json.
  const startedAtIso = new Date().toISOString();
  const repairId = nowId();

  const cwd = opts?.cwd || process.cwd();

  // Model override env for server-side provider selection (best-effort)
  const env = { ...process.env };
  if (featurePack.primaryModel) {
    // Applies to all roles unless role-specific is set
    env.SWARM_MODEL_CODER_PRIMARY = featurePack.primaryModel;
    env.SWARM_MODEL_FIELDGENERAL_PRIMARY = featurePack.primaryModel;
    env.SWARM_MODEL_REVIEWER_PRIMARY = featurePack.primaryModel;
    env.SWARM_MODEL_ARBITER_PRIMARY = featurePack.primaryModel;
  }

  // Timeouts (best-effort; runner respects its own flags)
  env.SWARM_TIMEOUT_SEC = String(featurePack.timeoutSec ?? 180);
  env.SWARM_RUN_BUDGET_SEC = String(featurePack.runBudgetSec ?? 600);

  const args: string[] = [];
  let cmd = "pnpm";
  if (featurePack.sourceType === "fixture" && featurePack.fixtureName) {
    // fixture runner handles creating repair runs and writing artifacts
    args.push("smoke:repair:fixtures", "--", "--only", featurePack.fixtureName);
  } else {
    // manual run: write packet to temp and run swarm:fix --from <path> --apply --test
    const tmpDir = join(cwd, "runs", "manualPackets");
    mkdirSync(tmpDir, { recursive: true });
    const pktPath = join(tmpDir, `${repairId}.failurePacket.json`);
    let pktText = featurePack.failurePacketJson;
    if (!pktText || pktText.trim().length < 5) {
      // Router usually injects a full packet; fall back to a minimal one.
      pktText = JSON.stringify({
        version: "v1",
        failure: { type: "manual", errorMessage: featurePack.errorMessage || "Manual swarm run" },
        context: { logs: featurePack.logs || [], fileSnapshots: {} },
        testCommands: (featurePack.testCommands || []).map(tc => `${tc.cmd} ${(tc.args || []).join(" ")}`.trim()).filter(Boolean),
      }, null, 2);
    }
    writeFileSync(pktPath, pktText ?? "{}", "utf8");
    args.push("swarm:fix", "--", "--from", pktPath, "--apply", "--test");
  }

  // Run detached; ingestion will pick up artifacts from runs/repair folder created by runner.
  const child = spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { repairId, pid: child.pid, startedAtIso };
}
