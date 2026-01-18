import fs from "node:fs";
import path from "node:path";

/**
 * Write a FailurePacket to disk for self-healing workflows.
 * 
 * @param {Object} params
 * @param {string} params.system - System identifier (e.g., "smoke:intake")
 * @param {string} params.summary - Brief summary of the failure
 * @param {string} params.command - Command that failed
 * @param {string} params.errorMessage - Error message or stack trace
 * @param {Object} [params.extra={}] - Additional context (env vars, versions, etc.)
 * @returns {string} Path to the written FailurePacket JSON file
 */
export function writeFailurePacket({
  system,
  summary,
  command,
  errorMessage,
  extra = {},
}) {
  const id = `failure_${Date.now()}`;
  const dir = path.join("runs", "failures", id);
  fs.mkdirSync(dir, { recursive: true });

  const payload = {
    version: "failurePacket.v1",
    id,
    createdAtIso: new Date().toISOString(),
    system,
    summary,
    signal: { command, errorMessage },
    extra,
  };

  const file = path.join(dir, "failurePacket.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}
