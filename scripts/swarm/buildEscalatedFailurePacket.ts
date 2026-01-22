import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { FailurePacketV1 } from "../../server/contracts/failurePacket.js";

type BuildEscalatedArgs = {
  base: FailurePacketV1;
  patchDiffPath: string;
  repairId: string;
  maxFiles: number;
  maxTotalBytes: number;
  includeRepoIndex: boolean;
  includeTsconfig: boolean;
  includePackageJson: boolean;
};

export async function buildEscalatedFailurePacket(args: BuildEscalatedArgs): Promise<FailurePacketV1> {
  const { base, patchDiffPath, repairId, maxFiles, maxTotalBytes, includeRepoIndex, includeTsconfig, includePackageJson } = args;
  const escalated: FailurePacketV1 = JSON.parse(JSON.stringify(base));
  escalated.meta = escalated.meta || ({} as any);
  escalated.meta.contextLevel = "L2";
  escalated.meta.escalationReason = "apply_failed_dependency_context";

  const touchedFiles = parseTouchedFilesFromPatch(patchDiffPath);
  const filesToSnapshot: string[] = [];

  for (const file of touchedFiles) {
    const absPath = resolve(process.cwd(), file);
    if (existsSync(absPath) && !absPath.includes("node_modules")) {
      filesToSnapshot.push(file);
    }
  }

  if (includeTsconfig && existsSync("tsconfig.json")) filesToSnapshot.push("tsconfig.json");
  if (includePackageJson && existsSync("package.json")) filesToSnapshot.push("package.json");

  const cappedFiles = filesToSnapshot.slice(0, maxFiles);
  const fileSnapshots: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;

  for (const file of cappedFiles) {
    try {
      const content = readFileSync(file, "utf8");
      const bytes = Buffer.byteLength(content, "utf8");
      if (totalBytes + bytes > maxTotalBytes) break;
      fileSnapshots.push({ path: file, content });
      totalBytes += bytes;
    } catch (err) {
      console.warn(`[buildEscalatedFailurePacket] Failed to read ${file}: ${err}`);
    }
  }

  escalated.context = escalated.context || ({} as any);
  escalated.context.fileSnapshots = [...(escalated.context.fileSnapshots || []), ...fileSnapshots];

  if (includeRepoIndex) {
    escalated.context.repoIndex = { files: filesToSnapshot, totalFiles: filesToSnapshot.length } as any;
  }

  console.log(`[buildEscalatedFailurePacket] Added ${fileSnapshots.length} file snapshots (${totalBytes} bytes)`);
  return escalated;
}

function parseTouchedFilesFromPatch(patchPath: string): string[] {
  const patchContent = readFileSync(patchPath, "utf8");
  const files = new Set<string>();
  const diffGitRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const plusRegex = /^\+\+\+ b\/(.+?)$/gm;
  let match;
  while ((match = diffGitRegex.exec(patchContent)) !== null) files.add(match[2]);
  while ((match = plusRegex.exec(patchContent)) !== null) files.add(match[1]);
  return Array.from(files);
}
