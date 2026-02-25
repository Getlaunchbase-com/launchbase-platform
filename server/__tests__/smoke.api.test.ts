/**
 * Smoke tests — validates the Express server boots and critical
 * endpoints respond with expected shapes. No database required.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  // Dynamic import so env is set before module loads
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = ""; // smoke tests don't need a real DB
  const { app } = await import("../_core/index");
  request = supertest(app);
});

afterAll(async () => {
  // Import server handle and close it
  const { server } = await import("../_core/index");
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request.get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      timestamp: expect.any(String),
      uptime: expect.any(Number),
    });
  });
});

describe("GET /readyz", () => {
  it("returns 200 (ready) or 503 (no DB in test)", async () => {
    const res = await request.get("/readyz");
    // 200 if DB is available, 503 if not (smoke tests don't require DB)
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("status");
  });
});

// ---------------------------------------------------------------------------
// Build info
// ---------------------------------------------------------------------------

describe("GET /api/build-info", () => {
  it("returns git SHA and build time", async () => {
    const res = await request.get("/api/build-info");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("gitSha");
    expect(res.body).toHaveProperty("buildTime");
    expect(res.body).toHaveProperty("nodeEnv");
  });
});

// ---------------------------------------------------------------------------
// Contract info (GET, no auth)
// ---------------------------------------------------------------------------

describe("GET /api/contracts/info", () => {
  it("returns contract information", async () => {
    const res = await request.get("/api/contracts/info");
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// tRPC endpoint responds (even without DB)
// ---------------------------------------------------------------------------

describe("tRPC /api/trpc", () => {
  it("rejects malformed requests with 4xx", async () => {
    const res = await request.get("/api/trpc/nonexistent.procedure");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe("Security headers", () => {
  it("sets X-Content-Type-Options", async () => {
    const res = await request.get("/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options", async () => {
    const res = await request.get("/healthz");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets Strict-Transport-Security in responses", async () => {
    const res = await request.get("/healthz");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SPA fallback
// ---------------------------------------------------------------------------

describe("SPA fallback", () => {
  it("returns 200 or 404 for unknown frontend routes", async () => {
    const res = await request.get("/admin/dashboard");
    // 200 if dist/public/index.html exists, 404 if not (CI without build)
    expect([200, 404]).toContain(res.status);
  });
});
