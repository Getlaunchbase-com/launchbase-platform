/**
 * FailurePacket Utility
 * 
 * Helpers to write FailurePackets everywhere failures occur.
 * Constitutional Rule: Every failure MUST write a FailurePacket.
 */

import * as fs from "fs";
import * as path from "path";
import { createFailurePacket, type FailurePacketV1 } from "../contracts/failurePacket";

/**
 * Write a FailurePacket to disk
 */
export async function writeFailurePacket(
  packet: FailurePacketV1,
  outputDir: string = "runs/failures"
): Promise<string> {
  // Create output directory if it doesn't exist
  const fullPath = path.join(process.cwd(), outputDir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  
  // Generate filename from timestamp and sha
  const filename = `failure_${packet.meta.timestamp.replace(/[:.]/g, "-")}_${packet.meta.sha}.json`;
  const filePath = path.join(fullPath, filename);
  
  // Write packet to disk
  fs.writeFileSync(filePath, JSON.stringify(packet, null, 2), "utf-8");
  
  console.log(`[FailurePacket] Written to ${filePath}`);
  return filePath;
}

/**
 * Capture and write a failure packet from an error
 */
export async function captureFailure(opts: {
  type: FailurePacketV1["failure"]["type"];
  error: Error | string;
  stopReason: string;
  context?: Partial<FailurePacketV1["context"]>;
  meta?: Partial<FailurePacketV1["meta"]>;
  outputDir?: string;
}): Promise<string> {
  const packet = createFailurePacket({
    type: opts.type,
    error: opts.error,
    stopReason: opts.stopReason,
    context: opts.context,
    meta: opts.meta,
  });
  
  return writeFailurePacket(packet, opts.outputDir);
}

/**
 * Wrap a function with automatic failure capture
 */
export function withFailureCapture<T>(
  fn: () => Promise<T>,
  opts: {
    type: FailurePacketV1["failure"]["type"];
    stopReason: string;
    context?: Partial<FailurePacketV1["context"]>;
    meta?: Partial<FailurePacketV1["meta"]>;
    outputDir?: string;
  }
): Promise<T> {
  return fn().catch(async (error) => {
    await captureFailure({
      type: opts.type,
      error,
      stopReason: opts.stopReason,
      context: opts.context,
      meta: opts.meta,
      outputDir: opts.outputDir,
    });
    throw error; // Re-throw after capturing
  });
}

/**
 * Read a FailurePacket from disk
 */
export function readFailurePacket(filePath: string): FailurePacketV1 {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as FailurePacketV1;
}

/**
 * List all FailurePackets in a directory
 */
export function listFailurePackets(dir: string = "runs/failures"): string[] {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  
  return fs
    .readdirSync(fullPath)
    .filter((file) => file.startsWith("failure_") && file.endsWith(".json"))
    .map((file) => path.join(fullPath, file))
    .sort()
    .reverse(); // Most recent first
}

/**
 * Find related failures by runId or intakeId
 */
export function findRelatedFailures(opts: {
  runId?: string;
  intakeId?: string;
  dir?: string;
}): FailurePacketV1[] {
  const packets = listFailurePackets(opts.dir);
  
  return packets
    .map(readFailurePacket)
    .filter((packet) => {
      if (opts.runId && packet.meta.runId === opts.runId) return true;
      if (opts.intakeId && packet.meta.intakeId === opts.intakeId) return true;
      return false;
    });
}
