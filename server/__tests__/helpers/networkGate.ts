import { test, describe } from "vitest";

/**
 * Gate network-dependent tests.
 * Default: skipped (CI-safe). Enable by setting ALLOW_NETWORK_TESTS=1.
 * 
 * Option A: Gate ONLY on ALLOW_NETWORK_TESTS flag (current implementation)
 * - Simple mental model: when you enable it, tests run
 * - Tests may fail if provider is misconfigured (fail loudly = good)
 */

const allowFlag = process.env.ALLOW_NETWORK_TESTS === "1";
const provider = process.env.AI_PROVIDER ?? "";

export const networkGate = {
  allowFlag,
  provider,
  enabled: allowFlag, // Option A: only check flag
  reason: !allowFlag
    ? "ALLOW_NETWORK_TESTS is not set to 1"
    : "enabled",
};

// Export boolean for simple usage
export const allowNetwork = networkGate.enabled;

// Export wrapped test/describe functions
export const networkTest = allowNetwork ? test : test.skip;
export const networkDescribe = allowNetwork ? describe : describe.skip;
