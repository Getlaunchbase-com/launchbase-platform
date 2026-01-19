/**
 * AIML Provider Validation Test
 * 
 * Validates that the AIML API key works with a lightweight API call.
 */

import { describe, it, expect, test } from "vitest";
import { allowNetwork } from "../../__tests__/helpers/networkGate";
import { aimlProvider, isAimlConfigured } from "./aimlProvider";

const t = allowNetwork ? test : test.skip;
const describeN = allowNetwork ? describe : describe.skip;

describeN("aimlProvider", () => {
  t("should have AIML_API_KEY configured", () => {
    expect(isAimlConfigured()).toBe(true);
  });

  t("should make a successful API call to AIML", async () => {
    // Skip if no API key (shouldn't happen in this test, but safety check)
    if (!isAimlConfigured()) {
      console.warn("AIML_API_KEY not configured, skipping API test");
      return;
    }

    // Make a lightweight test request
    const response = await aimlProvider.chat({
      model: "gpt-4o-mini", // Cheap model for testing
      messages: [
        {
          role: "system",
          content: "You are a test assistant. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: 'Return this exact JSON: {"test": true, "message": "API works"}',
        },
      ],
      temperature: 0,
      maxTokens: 100,
      jsonOnly: true,
      trace: {
        jobId: "test-validation",
        step: "api_test",
        round: 1,
      },
    });

    // Validate response structure
    expect(response).toBeDefined();
    expect(response.rawText).toBeDefined();
    expect(typeof response.rawText).toBe("string");

    // Validate it's valid JSON
    const parsed = JSON.parse(response.rawText);
    expect(parsed).toBeDefined();

    // Validate usage metadata
    expect(response.usage).toBeDefined();
    expect(response.usage?.inputTokens).toBeGreaterThan(0);
    expect(response.usage?.outputTokens).toBeGreaterThan(0);

    // Validate provider metadata
    expect(response.providerMeta).toBeDefined();
    expect(response.providerMeta?.requestId).toBeDefined();

    console.log("[AIML Test] API validation successful", {
      requestId: response.providerMeta?.requestId,
      inputTokens: response.usage?.inputTokens,
      outputTokens: response.usage?.outputTokens,
      responsePreview: response.rawText.slice(0, 100),
    });
  }, 30000); // 30 second timeout for API call
});
