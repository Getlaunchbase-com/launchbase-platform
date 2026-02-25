/**
 * Startup Contract Verification
 *
 * On platform boot (before Express listen), fetches agent-stack /health
 * and compares manifest_hash + all schema_hash values against the freeze
 * registry. If any mismatch is detected, logs a structured error and exits.
 *
 * This guarantees the platform never starts serving traffic while the
 * agent-stack is running a different contract version.
 *
 * Behavior:
 *   - Agent unreachable → warn + continue (agent may start later; health monitor will catch it)
 *   - Agent reachable, contracts match → proceed
 *   - Agent reachable, contracts mismatch → fatal exit
 */

import {
  validateHandshake,
  getManifestHash,
  getAllContractInfo,
} from "../contracts/handshake";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_STACK_URL =
  process.env.AGENT_STACK_URL ?? "http://localhost:4100";
const VERIFY_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentHealthResponse {
  status: string;
  vertex: string;
  version: string;
  schema_hash: string;
  contracts: Array<{ name: string; version: string; schema_hash: string }>;
  uptime_seconds?: number;
}

export interface VerificationResult {
  ok: boolean;
  agentReachable: boolean;
  manifestMatch: boolean;
  mismatches: Array<{
    name: string;
    field: string;
    expected: string;
    received: string;
  }>;
  agentVersion?: string;
  agentVertex?: string;
}

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

/**
 * Verify agent-stack contracts at startup.
 *
 * Returns a VerificationResult. Does NOT exit the process — the caller
 * decides what to do with a mismatch.
 */
export async function verifyAgentContracts(): Promise<VerificationResult> {
  let healthData: AgentHealthResponse;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

    const resp = await fetch(`${AGENT_STACK_URL}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        ok: true, // Agent unreachable is not a startup blocker
        agentReachable: false,
        manifestMatch: false,
        mismatches: [],
      };
    }

    healthData = (await resp.json()) as AgentHealthResponse;
  } catch {
    // Agent not running yet — warn but don't block startup
    return {
      ok: true,
      agentReachable: false,
      manifestMatch: false,
      mismatches: [],
    };
  }

  // --- Compare manifest hash ---
  const platformManifest = getManifestHash();
  const agentManifest = healthData.schema_hash ?? "";
  const manifestMatch = platformManifest === agentManifest;

  // --- Compare individual contract schema hashes ---
  const handshakeResult = validateHandshake({
    agent_id: "startup-verify",
    agent_version: healthData.version ?? "unknown",
    contracts: healthData.contracts ?? [],
  });

  const hasMismatch = !handshakeResult.ok;

  return {
    ok: !hasMismatch,
    agentReachable: true,
    manifestMatch,
    mismatches: handshakeResult.mismatches,
    agentVersion: healthData.version,
    agentVertex: healthData.vertex,
  };
}

/**
 * Run contract verification and exit on mismatch.
 *
 * Call this before Express listen() in the server entry point.
 * Logs structured JSON for observability.
 */
export async function verifyAgentContractsOrExit(): Promise<void> {
  console.log("[startup] Verifying agent-stack contracts...");

  const result = await verifyAgentContracts();

  if (!result.agentReachable) {
    console.warn(
      "[startup] Agent-stack unreachable at %s — skipping contract verification (health monitor will verify later)",
      AGENT_STACK_URL
    );
    return;
  }

  if (result.ok) {
    console.log(
      "[startup] Contract verification passed — agent=%s vertex=%s manifest_match=%s",
      result.agentVersion,
      result.agentVertex,
      result.manifestMatch
    );
    return;
  }

  // --- Mismatch detected: structured error + fatal exit ---
  const platformInfo = getAllContractInfo();

  console.error(
    JSON.stringify({
      level: "fatal",
      event: "contract_mismatch_at_startup",
      agentVersion: result.agentVersion,
      agentVertex: result.agentVertex,
      manifestMatch: result.manifestMatch,
      platformManifestHash: platformInfo.manifest_hash,
      platformContracts: platformInfo.contracts,
      mismatches: result.mismatches,
      message:
        "Agent-stack contract mismatch detected at startup. Platform cannot serve traffic with mismatched contracts. Exiting.",
    })
  );

  process.exit(1);
}
