import { createHash } from "node:crypto";
import { getAllContractInfo } from "../contracts/handshake";

interface AgentHealthContract {
  name: string;
  version?: string;
  schema_hash?: string;
}

interface AgentHealthPayload {
  manifest_hash?: string;
  contracts?: AgentHealthContract[];
}

export interface AgentContractVerificationStatus {
  ok: boolean;
  checkedAt: string | null;
  errors: string[];
  mode?: "warn" | "enforce";
}

let _status: AgentContractVerificationStatus = {
  ok: false,
  checkedAt: null,
  errors: ["verification_not_run"],
};

function stableStringify(value: unknown): string {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((v) => canonicalize(v));
    }
    if (input && typeof input === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(input as Record<string, unknown>).sort()) {
        out[key] = canonicalize((input as Record<string, unknown>)[key]);
      }
      return out;
    }
    return input;
  };

  const json = JSON.stringify(canonicalize(value));
  return json.replace(/[^\x00-\x7F]/g, (ch) =>
    `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

function computeExpectedManifestHash(): string {
  if (process.env.AGENT_MANIFEST_HASH) {
    return process.env.AGENT_MANIFEST_HASH;
  }

  const info = getAllContractInfo();
  const normalized = stableStringify({
    vertex: info.vertex,
    vertex_version: info.vertex_version,
    contracts: [...info.contracts]
      .map((c) => ({
        name: c.name,
        version: c.version,
        schema_hash: c.schema_hash,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  return createHash("sha256").update(normalized).digest("hex");
}

function expectedSchemaHashes(): Record<string, string> {
  const info = getAllContractInfo();
  const out: Record<string, string> = {};
  for (const c of info.contracts) {
    out[c.name] = c.schema_hash;
  }
  return out;
}

async function fetchAgentHealth(agentUrl: string): Promise<AgentHealthPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(`${agentUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      throw new Error(`agent /health returned HTTP ${resp.status}`);
    }

    return (await resp.json()) as AgentHealthPayload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyAgentContracts(): Promise<void> {
  const mode =
    (process.env.AGENT_CONTRACT_VERIFICATION_MODE ?? "warn").toLowerCase() ===
    "enforce"
      ? "enforce"
      : "warn";

  if (process.env.SKIP_AGENT_CONTRACT_VERIFICATION === "true") {
    _status = {
      ok: true,
      checkedAt: new Date().toISOString(),
      errors: [],
      mode,
    };
    console.warn("[startup] Agent contract verification skipped by env flag");
    return;
  }

  const errors: string[] = [];
  const agentUrl = process.env.AGENT_STACK_URL ?? "http://localhost:4100";

  try {
    const health = await fetchAgentHealth(agentUrl);

    const expectedManifest = computeExpectedManifestHash();
    if (!health.manifest_hash) {
      errors.push("missing manifest_hash in agent /health response");
    } else if (health.manifest_hash !== expectedManifest) {
      errors.push(
        `manifest_hash mismatch: expected=${expectedManifest} received=${health.manifest_hash}`
      );
    }

    const expectedSchemas = expectedSchemaHashes();
    const remoteSchemas: Record<string, string> = {};
    for (const c of health.contracts ?? []) {
      if (c.name && c.schema_hash) {
        remoteSchemas[c.name] = c.schema_hash;
      }
    }

    for (const [name, expectedHash] of Object.entries(expectedSchemas)) {
      const receivedHash = remoteSchemas[name];
      if (!receivedHash) {
        errors.push(`missing schema_hash for contract "${name}"`);
        continue;
      }
      if (receivedHash !== expectedHash) {
        errors.push(
          `schema_hash mismatch for "${name}": expected=${expectedHash} received=${receivedHash}`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`agent contract verification error: ${msg}`);
  }

  _status = {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    errors,
    mode,
  };

  if (!_status.ok) {
    console.error("[startup] Agent contract verification failed:");
    for (const error of _status.errors) {
      console.error(`[startup] - ${error}`);
    }
    if (mode === "enforce") {
      throw new Error(
        `Agent contract verification failed (${_status.errors.length} error(s))`
      );
    }
    console.warn(
      "[startup] Continuing startup in warn mode (set AGENT_CONTRACT_VERIFICATION_MODE=enforce to fail closed)."
    );
  }
}

export function getAgentContractVerificationStatus(): AgentContractVerificationStatus {
  return _status;
}
