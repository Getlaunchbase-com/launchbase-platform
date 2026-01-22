import { execSync } from "child_process";
import { writeFileSync } from "fs";

type ApplyPatchOpts = {
  result: any;
  shouldApply: boolean;
  outDir: string;
  patchFile: string;
  applyLogs: string[];
};

type ApplyPatchResult = {
  patchApplied: boolean;
  patchValid: boolean;
  escalationHint: string | null;
};

export function applyPatchFromResult(opts: ApplyPatchOpts): ApplyPatchResult {
  const { result, shouldApply, outDir, patchFile, applyLogs } = opts;
  let patchApplied = false;
  let patchValid = true;
  let escalationHint: string | null = null;

  if (!shouldApply) return { patchApplied, patchValid, escalationHint };

  console.log(`\n🔧 Applying patch...`);
  const changes = result.repairPacket.patchPlan?.changes ?? [];
  const missingDiffs = changes.filter((c: any) => !c.diff);
  
  if (missingDiffs.length > 0) {
    console.error(`❌ Cannot apply: ${missingDiffs.length} changes missing diffs`);
    for (const change of missingDiffs) {
      console.error(`   - ${change.file}: ${change.description}`);
      applyLogs.push(`Missing diff for ${change.file}`);
    }
    patchValid = false;
    result.repairPacket.execution.stopReason = "human_review_required";
    result.repairPacket.execution.applied = false;
    return { patchApplied, patchValid, escalationHint };
  }

  let patchContent = changes.map((c: any) => c.diff).join("\n");
  patchContent = patchContent.replace(/^```diff\n/gm, "").replace(/^```\n/gm, "");
  patchContent = patchContent.trim();
  if (!patchContent.endsWith("\n")) patchContent += "\n";

  const isUnifiedDiff = patchContent.includes("diff --git") && patchContent.includes("---") && patchContent.includes("+++");
  const isCustomFormat = patchContent.includes("*** Begin Patch") || patchContent.includes("*** Update File:");

  if (isCustomFormat || !isUnifiedDiff) {
    console.error(`❌ Invalid patch format`);
    applyLogs.push(`Invalid patch format: must be unified diff`);
    patchValid = false;
    result.repairPacket.execution.stopReason = "patch_invalid_format";
    result.repairPacket.execution.applied = false;
    return { patchApplied, patchValid, escalationHint };
  }

  writeFileSync(patchFile, patchContent, "utf8");
  applyLogs.push(`Created patch file: ${patchFile}`);

  let checkPassed = false;
  try {
    execSync(`git apply --check --whitespace=nowarn ${patchFile}`, { cwd: process.cwd(), stdio: "pipe" });
    applyLogs.push(`git apply --check passed`);
    checkPassed = true;
  } catch (checkErr: any) {
    const errorMsg = checkErr?.message || "";
    const stderr = checkErr?.stderr?.toString?.() || "";
    const isNewFileDep = stderr.includes("depends on old contents") || stderr.includes("patch failed") || stderr.includes("patch does not apply");

    if (isNewFileDep) {
      console.log(`⚠️ New file dependency context issue detected`);
      applyLogs.push(`git apply --check failed: ${errorMsg}`);
      if (stderr) applyLogs.push(`stderr: ${stderr}`);
      escalationHint = "apply_failed_dependency_context";
      patchValid = true;
      result.repairPacket.execution.stopReason = "apply_failed_dependency_context";
      result.repairPacket.execution.applied = false;
      writeFileSync(`${outDir}/apply.stderr.txt`, stderr, "utf8");
      writeFileSync(`${outDir}/apply.stdout.txt`, errorMsg, "utf8");
      return { patchApplied, patchValid, escalationHint };
    }

    if (errorMsg.includes("corrupt patch") || stderr.includes("corrupt patch")) {
      console.log(`⚠️ Corrupt patch detected, retrying with --recount...`);
      try {
        execSync(`git apply --check --recount --whitespace=nowarn ${patchFile}`, { cwd: process.cwd(), stdio: "pipe" });
        applyLogs.push(`git apply --check --recount passed`);
        checkPassed = true;
      } catch (recountErr: any) {
        console.error(`❌ git apply --check --recount failed`);
        patchValid = false;
        result.repairPacket.execution.stopReason = "patch_failed";
        result.repairPacket.execution.applied = false;
        return { patchApplied, patchValid, escalationHint };
      }
    } else {
      console.error(`❌ git apply --check failed: ${errorMsg}`);
      patchValid = false;
      result.repairPacket.execution.stopReason = "patch_failed";
      result.repairPacket.execution.applied = false;
      writeFileSync(`${outDir}/apply.stderr.txt`, stderr, "utf8");
      writeFileSync(`${outDir}/apply.stdout.txt`, errorMsg, "utf8");
      return { patchApplied, patchValid, escalationHint };
    }
  }

  if (checkPassed) {
    try {
      const needsRecount = applyLogs.some((log) => log.includes("--recount passed"));
      const applyCmd = needsRecount ? `git apply --recount --whitespace=nowarn ${patchFile}` : `git apply --whitespace=nowarn ${patchFile}`;
      execSync(applyCmd, { cwd: process.cwd(), stdio: "pipe" });
      const diffStat = execSync(`git diff --stat`, { cwd: process.cwd(), encoding: "utf8" });
      console.log(`✅ Patch applied successfully`);
      console.log(diffStat);
      applyLogs.push(`git apply succeeded`);
      patchApplied = true;
      result.repairPacket.execution.applied = true;
    } catch (err: any) {
      console.error(`❌ git apply failed: ${err?.message || ""}`);
      patchValid = true;
      result.repairPacket.execution.stopReason = "patch_failed";
      result.repairPacket.execution.applied = false;
    }
  }

  return { patchApplied, patchValid, escalationHint };
}
