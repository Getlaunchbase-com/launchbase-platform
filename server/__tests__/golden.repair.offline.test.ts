import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Golden Repair Offline Test (Deterministic)", () => {
  it("should apply pre-generated patch and pass tests", () => {
    const fixturePacket = join(
      __dirname,
      "../../runs/fixtures/failurePackets/v1/minimal.json"
    );
    const fixtureRepairPacket = join(
      __dirname,
      "../../runs/fixtures/repairPackets/v1/golden.json"
    );

    // Run auto-repair in offline mode with pre-generated repairPacket
    const cmd = `pnpm swarm:fix --from ${fixturePacket} --offline --repairPacket ${fixtureRepairPacket} --apply --test`;
    
    try {
      execSync(cmd, {
        cwd: join(__dirname, "../.."),
        stdio: "pipe",
        encoding: "utf8",
        timeout: 120000, // 2 minutes
      });
    } catch (err) {
      // Command may exit non-zero if patch fails, but we still check artifacts
      console.log("Swarm fix completed (may have non-zero exit)");
    }

    // Find the latest repair run
    const repairDir = join(__dirname, "../../runs/repair");
    const repairRuns = readdirSync(repairDir)
      .filter((d) => d.startsWith("repair_"))
      .sort()
      .reverse();

    expect(repairRuns.length).toBeGreaterThan(0);

    const latestRun = repairRuns[0];
    const repairPacketPath = join(repairDir, latestRun, "repairPacket.json");
    const repairPacket = JSON.parse(readFileSync(repairPacketPath, "utf8"));

    // Assert PASS criteria (offline mode should still track execution)
    expect(repairPacket.execution).toBeDefined();
    expect(repairPacket.execution.patchValid).toBe(true);
    expect(repairPacket.execution.applied).toBe(true);
    expect(repairPacket.execution.testsPassed).toBe(true);
    expect(repairPacket.execution.stopReason).toBe("ok");

    console.log(`✅ Golden offline test PASSED (${latestRun})`);
  }, 150000); // 2.5 minute timeout for entire test
});
