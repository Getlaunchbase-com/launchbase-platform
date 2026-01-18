/**
 * FailurePacketV1 Contract
 * 
 * Standardized failure artifact that captures everything needed to diagnose and fix issues.
 * Written automatically whenever something fails (smoke tests, swarm execution, builder gates, etc.)
 * 
 * Constitutional Rules:
 * - Every failure MUST write a FailurePacket
 * - No silent failures allowed
 * - Include full context (logs, stack, environment, command)
 * - Redact secrets/PII before writing
 */

export type FailurePacketV1 = {
  version: "failurepacket.v1";
  
  meta: {
    timestamp: string; // ISO 8601 timestamp
    sha: string; // Git commit SHA at time of failure
    runId?: string; // Run ID if part of a swarm execution
    intakeId?: string; // Intake ID if part of customer workflow
    jobId?: string; // Job ID if part of background job
    environment: "dev" | "staging" | "production"; // Environment where failure occurred
  };
  
  failure: {
    type: "smoke_test" | "swarm_execution" | "builder_gate" | "oauth_flow" | "stripe_integration" | "database" | "provider" | "unknown";
    stopReason: string; // Canonical stop reason (e.g., "timeout", "provider_failed", "schema_validation_failed")
    errorMessage: string; // Human-readable error message
    errorCode?: string; // Error code if available
    stack?: string; // Stack trace (redacted)
  };
  
  context: {
    command?: string; // Command that was running (e.g., "pnpm test", "npx tsx scripts/smoke/smokeIntakeE2E.mjs")
    inputs?: Record<string, any>; // Inputs to the failing operation (redacted)
    outputs?: Record<string, any>; // Partial outputs before failure (redacted)
    logs: string[]; // Last N lines of logs (redacted)
    models?: string[]; // AI models involved (if applicable)
    requestIds?: string[]; // Provider request IDs (if applicable)
  };
  
  environment: {
    nodeVersion: string; // Node.js version
    platform: string; // OS platform (linux, darwin, win32)
    cwd: string; // Current working directory
    envVars: Record<string, string>; // Relevant env vars (redacted, only keys)
  };
  
  diagnosis?: {
    likelyCause?: string; // AI-generated likely cause
    suggestedFix?: string; // AI-generated suggested fix
    relatedFailures?: string[]; // Related failure packet IDs
  };
};

/**
 * Validate FailurePacketV1 structure
 */
export function validateFailurePacket(packet: any): packet is FailurePacketV1 {
  if (packet.version !== "failurepacket.v1") return false;
  if (!packet.meta?.timestamp || !packet.meta?.sha || !packet.meta?.environment) return false;
  if (!packet.failure?.type || !packet.failure?.stopReason || !packet.failure?.errorMessage) return false;
  if (!packet.context?.logs || !Array.isArray(packet.context.logs)) return false;
  if (!packet.environment?.nodeVersion || !packet.environment?.platform) return false;
  
  return true;
}

/**
 * Redact sensitive information from value
 */
function redact(value: any): any {
  if (typeof value === "string") {
    // Redact common secret patterns
    return value
      .replace(/sk_[a-zA-Z0-9_]+/g, "sk_REDACTED")
      .replace(/pk_[a-zA-Z0-9_]+/g, "pk_REDACTED")
      .replace(/Bearer [a-zA-Z0-9_\-\.]+/g, "Bearer REDACTED")
      .replace(/password["\s:=]+[^\s"]+/gi, "password=REDACTED")
      .replace(/api[_-]?key["\s:=]+[^\s"]+/gi, "api_key=REDACTED");
  }
  
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  
  if (typeof value === "object" && value !== null) {
    const redacted: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      // Redact entire value if key looks sensitive
      if (/secret|password|token|key|auth/i.test(key)) {
        redacted[key] = "REDACTED";
      } else {
        redacted[key] = redact(val);
      }
    }
    return redacted;
  }
  
  return value;
}

/**
 * Create a FailurePacket from an error
 */
export function createFailurePacket(opts: {
  type: FailurePacketV1["failure"]["type"];
  error: Error | string;
  stopReason: string;
  context?: Partial<FailurePacketV1["context"]>;
  meta?: Partial<FailurePacketV1["meta"]>;
}): FailurePacketV1 {
  const error = typeof opts.error === "string" ? new Error(opts.error) : opts.error;
  
  return {
    version: "failurepacket.v1",
    meta: {
      timestamp: new Date().toISOString(),
      sha: process.env.GIT_SHA || "unknown",
      environment: (process.env.NODE_ENV as any) || "dev",
      ...opts.meta,
    },
    failure: {
      type: opts.type,
      stopReason: opts.stopReason,
      errorMessage: error.message,
      errorCode: (error as any).code,
      stack: redact(error.stack),
    },
    context: {
      logs: [],
      ...opts.context,
      inputs: redact(opts.context?.inputs),
      outputs: redact(opts.context?.outputs),
      logs: (opts.context?.logs || []).map(redact),
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      envVars: Object.keys(process.env).reduce((acc, key) => {
        acc[key] = "REDACTED";
        return acc;
      }, {} as Record<string, string>),
    },
  };
}

/**
 * Example FailurePacket for reference
 */
export const EXAMPLE_FAILURE_PACKET: FailurePacketV1 = {
  version: "failurepacket.v1",
  meta: {
    timestamp: "2026-01-18T06:00:00.000Z",
    sha: "624931f3",
    runId: "smoke_creative_1768716902788",
    environment: "dev",
  },
  failure: {
    type: "smoke_test",
    stopReason: "schema_validation_failed",
    errorMessage: "Systems payload missing proposedChanges array",
    stack: "Error: Systems payload missing proposedChanges array\n    at runPilotMacro (/home/ubuntu/launchbase/scripts/pilot/runPilotMacro.ts:440:13)",
  },
  context: {
    command: "npx tsx scripts/smoke/smokeCreativeProduction.ts",
    inputs: {
      lane: "web",
      tier: "standard",
    },
    outputs: {
      systemsPayload: {
        issues: ["..."],
        verdict: "revise",
      },
    },
    logs: [
      "[smoke_creative_1768716902788] Calling designer_systems_fast...",
      "[smoke_creative_1768716902788] Systems payload keys: [ 'issues', 'verdict', 'suggestions' ]",
      "[smoke_creative_1768716902788] Systems: 0 candidates → capped to 0",
    ],
    models: ["openai/gpt-5-2", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"],
    requestIds: ["chatcmpl-CzGKyIGE8q9QF2kONcEBOiXtjWBFG"],
  },
  environment: {
    nodeVersion: "v22.13.0",
    platform: "linux",
    cwd: "/home/ubuntu/launchbase",
    envVars: {
      AIML_API_KEY: "REDACTED",
      DATABASE_URL: "REDACTED",
    },
  },
  diagnosis: {
    likelyCause: "aimlSpecialist.ts using wrong prompt (critic instead of designer_systems)",
    suggestedFix: "Load prompt from promptPacks/ directory based on role name",
    relatedFailures: [],
  },
};
