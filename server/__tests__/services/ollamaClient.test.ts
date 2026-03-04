/**
 * Unit tests for Ollama Client
 *
 * Tests health check caching, API call format, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Ollama Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it("isOllamaHealthy returns true when Ollama responds", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    // Reset module to clear health cache
    vi.resetModules();
    const { isOllamaHealthy } = await import("../../services/ollamaClient");
    const result = await isOllamaHealthy();
    expect(result).toBe(true);
  });

  it("isOllamaHealthy returns false when Ollama is down", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    vi.resetModules();
    const { isOllamaHealthy } = await import("../../services/ollamaClient");
    const result = await isOllamaHealthy();
    expect(result).toBe(false);
  });

  it("callOllama sends correct request format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        message: { role: "assistant", content: "Hello from Ollama" },
        model: "llama3.1:8b",
        done: true,
      }),
    });

    vi.resetModules();
    const { callOllama } = await import("../../services/ollamaClient");
    const result = await callOllama(
      [{ role: "user", content: "Hello" }],
      "llama3.1:8b",
    );

    expect(result.ok).toBe(true);
    expect(result.content).toBe("Hello from Ollama");
    expect(result.model).toBe("llama3.1:8b");

    // Check request format
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/chat");
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("llama3.1:8b");
    expect(body.messages).toHaveLength(1);
    expect(body.stream).toBe(false);
  });

  it("callOllama handles HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    vi.resetModules();
    const { callOllama } = await import("../../services/ollamaClient");
    const result = await callOllama(
      [{ role: "user", content: "Hello" }],
      "llama3.1:8b",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("500");
  });

  it("callOllama handles empty response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: null, done: true }),
    });

    vi.resetModules();
    const { callOllama } = await import("../../services/ollamaClient");
    const result = await callOllama(
      [{ role: "user", content: "Hello" }],
      "llama3.1:8b",
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No response");
  });

  it("listOllamaModels returns model names", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        models: [
          { name: "llama3.1:8b" },
          { name: "llama3.1:70b" },
        ],
      }),
    });

    vi.resetModules();
    const { listOllamaModels } = await import("../../services/ollamaClient");
    const models = await listOllamaModels();
    expect(models).toEqual(["llama3.1:8b", "llama3.1:70b"]);
  });

  it("listOllamaModels returns empty on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    vi.resetModules();
    const { listOllamaModels } = await import("../../services/ollamaClient");
    const models = await listOllamaModels();
    expect(models).toEqual([]);
  });
});
