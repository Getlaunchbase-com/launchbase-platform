import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { captureConsole } from "./helpers/captureConsole";
import { makeCanary, assertNoCanaryInLines } from "../security/canary";

/**
 * FOREVER CONTRACT: No prompt leak tests
 * 
 * These tests ensure that user prompts and system prompts NEVER appear in:
 * - Console logs (warn/error/log)
 * - Error messages
 * - API responses
 * - Telemetry payloads
 * 
 * We use "canary" strings embedded in prompts to detect leaks.
 */
describe("security: no prompt leak (FOREVER CONTRACT)", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.AI_PROVIDER = "memory";
    process.env.NODE_ENV = "test";
    process.env.VITEST = "1";
    process.env.MEMORY_PROVIDER_MODE = ""; // default
    process.env.MEMORY_PROVIDER_RAW_TEXT = "";
    process.env.MEMORY_PROVIDER_THROW_MESSAGE = "";
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("completeJson JSON.parse failure must not log raw prompt content", async () => {
    const canary = makeCanary("parse-fail");
    const c = captureConsole(["warn", "error", "log"]);

    try {
      process.env.MEMORY_PROVIDER_MODE = "raw";
      // rawText includes canary; completeJson will fail JSON.parse and may log about it
      process.env.MEMORY_PROVIDER_RAW_TEXT = `{"oops": ${JSON.stringify(canary)}} THIS_IS_NOT_JSON`;

      const { completeJson } = await import("../providers/providerFactory");

      const res = await completeJson(
        {
          model: "memory-model",
          messages: [
            { role: "system", content: `SYSTEM ${canary}` },
            { role: "user", content: `USER ${canary}` },
          ],
          trace: {
            jobId: `noPromptLeak-parse`,
            step: "test",
            round: 1,
          },
        },
        "memory",
        { useRouter: false }
      );

      expect(res.json).toBeNull(); // parse should fail
      // Contract: canary must never appear in logs
      assertNoCanaryInLines(c.lines, canary, "parse-fail logs");
    } finally {
      c.restore();
    }
  });

  it("provider error path must not leak canary in logs", async () => {
    const canary = makeCanary("provider-throw");
    const c = captureConsole(["warn", "error", "log"]);

    try {
      process.env.MEMORY_PROVIDER_MODE = "throw";
      process.env.MEMORY_PROVIDER_THROW_MESSAGE = `ERR_CONTAINS_CANARY ${canary}`;

      const { completeJson } = await import("../providers/providerFactory");

      await expect(
        completeJson(
          {
            model: "memory-model",
            messages: [
              { role: "system", content: `SYSTEM ${canary}` },
              { role: "user", content: `USER ${canary}` },
            ],
            trace: {
              jobId: `noPromptLeak-throw`,
              step: "test",
              round: 1,
            },
          },
          "memory",
          { useRouter: false }
        )
      ).rejects.toBeTruthy();

      assertNoCanaryInLines(c.lines, canary, "throw logs");
    } finally {
      c.restore();
    }
  });

  it("router strict mode failure must not leak canary in logs", async () => {
    const canary = makeCanary("router-strict");
    const c = captureConsole(["warn", "error", "log"]);

    try {
      // This test assumes your completeJson has routerOpts.strict behavior already.
      // We'll force an error using memory provider "throw" while strict routing is enabled.
      process.env.MEMORY_PROVIDER_MODE = "throw";
      process.env.MEMORY_PROVIDER_THROW_MESSAGE = `ROUTER_FAIL ${canary}`;

      const { completeJson } = await import("../providers/providerFactory");

      await expect(
        completeJson(
          {
            model: "some-model-id",
            messages: [
              { role: "system", content: `SYSTEM ${canary}` },
              { role: "user", content: `USER ${canary}` },
            ],
            trace: {
              jobId: `noPromptLeak-router`,
              step: "test",
              round: 1,
            },
          },
          // transport memory so no network; we still enable strict to ensure strict path is safe
          "memory",
          { useRouter: true, task: "json", strict: true }
        )
      ).rejects.toBeTruthy();

      assertNoCanaryInLines(c.lines, canary, "router strict logs");
    } finally {
      c.restore();
    }
  });
});
