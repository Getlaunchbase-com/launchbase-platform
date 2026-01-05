/**
 * API Routing Guardrails (Regression Tests)
 * 
 * These tests lock in three critical invariants that prevent the cron + SPA failure mode:
 * 
 * 1. /api/* never returns HTML (prevents SPA fallthrough)
 * 2. /api/cron/* is POST-only (GET returns 405 JSON, not 200)
 * 3. /api/worker/* returns deprecation headers (migration telemetry)
 * 
 * If any of these tests fail, DO NOT bypass them—fix the routing/endpoint behavior.
 * 
 * Context: These tests prevent a production incident where cron-job.org received
 * HTML 200 responses instead of JSON, causing silent failures for weeks.
 */

import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "./_core/app";

describe("API guardrails (never repeat cron + SPA issues)", () => {
  const app = createApp();

  it("never serves SPA HTML under /api (404 returns JSON)", async () => {
    const res = await supertest(app).get("/api/__does_not_exist__");

    expect(res.status).toBe(404);

    const contentType = res.headers["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    expect(res.body).toBeTruthy();
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("api_route_not_found");

    // Ensure it's NOT HTML
    const body = (res.text ?? "").toLowerCase();
    expect(body).not.toContain("<!doctype html>");
    expect(body).not.toContain("<html");
  });

  it("cron run-next-deploy is POST-only (GET returns 405 JSON + Allow header)", async () => {
    const res = await supertest(app).get("/api/cron/run-next-deploy");

    expect(res.status).toBe(405);
    expect((res.headers["allow"] ?? "").toUpperCase()).toContain("POST");

    const contentType = res.headers["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    expect(res.body).toBeTruthy();
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("method_not_allowed");
    expect(res.body.allowed).toEqual(["POST"]);
  });

  it("cron auto-advance is POST-only (GET returns 405 JSON + Allow header)", async () => {
    const res = await supertest(app).get("/api/cron/auto-advance");

    expect(res.status).toBe(405);
    expect((res.headers["allow"] ?? "").toUpperCase()).toContain("POST");

    const contentType = res.headers["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    expect(res.body).toBeTruthy();
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe("method_not_allowed");
    expect(res.body.allowed).toEqual(["POST"]);
  });

  it("worker endpoints include deprecation headers (migration telemetry)", async () => {
    // We expect auth to fail (401), but headers should still be present
    const res = await supertest(app)
      .post("/api/worker/run-next-deploy")
      .set("Content-Type", "application/json")
      .send({});

    // Allow either 200 (if somehow auth passes) or 401/403
    expect([200, 401, 403]).toContain(res.status);

    expect(res.headers["x-launchbase-deprecated"]).toBe("true");
    expect(res.headers["x-launchbase-use"]).toBe("/api/cron/run-next-deploy");
  });

  it("cron health returns JSON and includes db status", async () => {
    const res = await supertest(app).get("/api/cron/health");

    expect(res.status).toBe(200);

    const contentType = res.headers["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    expect(res.body).toBeTruthy();
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.timestamp).toBe("string");
    expect(["connected", "disconnected"]).toContain(res.body.database);
  });

  // ⏸️ UNCOMMENT AFTER DELETING /api/worker/* ROUTES
  // This test ensures worker endpoints are properly removed and return 404 JSON
  // it.skip("worker endpoints return 404 JSON after deletion", async () => {
  //   const runNextDeployRes = await supertest(app)
  //     .post("/api/worker/run-next-deploy")
  //     .set("Content-Type", "application/json")
  //     .send({});
  //
  //   expect(runNextDeployRes.status).toBe(404);
  //   const contentType1 = runNextDeployRes.headers["content-type"] ?? "";
  //   expect(contentType1).toContain("application/json");
  //   expect(runNextDeployRes.body.ok).toBe(false);
  //   expect(runNextDeployRes.body.error).toBe("api_route_not_found");
  //
  //   const autoAdvanceRes = await supertest(app)
  //     .post("/api/worker/auto-advance")
  //     .set("Content-Type", "application/json")
  //     .send({});
  //
  //   expect(autoAdvanceRes.status).toBe(404);
  //   const contentType2 = autoAdvanceRes.headers["content-type"] ?? "";
  //   expect(contentType2).toContain("application/json");
  //   expect(autoAdvanceRes.body.ok).toBe(false);
  //   expect(autoAdvanceRes.body.error).toBe("api_route_not_found");
  // });
});
