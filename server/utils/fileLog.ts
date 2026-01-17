import fs from 'node:fs';
import path from 'node:path';
import type { FailurePacketV1 } from '../contracts/preflight.js';

/**
 * Append a JSON object as a single line to a log file
 */
export function appendJsonLine(filePath: string, obj: Record<string, unknown>): void {
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * Write a FailurePacket to disk for diagnosis swarm
 */
export function writeFailurePacket(packet: FailurePacketV1): void {
  // Deterministic path: runs/smoke/<runId>/failurePacket.json
  const dir = path.join(process.cwd(), 'runs', 'smoke', packet.runId);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const filepath = path.join(dir, 'failurePacket.json');
  
  fs.writeFileSync(filepath, JSON.stringify(packet, null, 2), 'utf-8');
  
  // Print path for easy access
  console.error(`\n❌ FAILURE PACKET: ${filepath}\n`);
  
  // Also append to main log
  appendJsonLine('/tmp/launchbase_smoke.log', packet);
}

/**
 * Create a FailurePacket from an error
 */
export function createFailurePacket(
  runId: string,
  step: string,
  error: Error,
  context?: Record<string, unknown>,
  intakeId?: number
): FailurePacketV1 {
  return {
    version: 'failure_packet.v1',
    runId,
    intakeId,
    step,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    timestampIso: new Date().toISOString(),
    context,
  };
}
