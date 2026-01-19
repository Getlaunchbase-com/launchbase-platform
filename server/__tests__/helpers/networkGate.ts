import { test, describe } from "vitest";

/**
 * Gate network-dependent tests.
 * Default: skipped (CI-safe). Enable by setting ALLOW_NETWORK_TESTS=1.
 */
export const networkTest =
  process.env.ALLOW_NETWORK_TESTS === "1" ? test : test.skip;

export const networkDescribe =
  process.env.ALLOW_NETWORK_TESTS === "1" ? describe : describe.skip;
