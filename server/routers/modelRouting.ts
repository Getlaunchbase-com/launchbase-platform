/**
 * Model Routing Express Router
 * 
 * Internal endpoints for model introspection and admin refresh.
 */

import type { Router } from "express";
import { modelRegistry, modelPolicy } from "../ai";

export function mountModelRoutingRoutes(router: Router) {
  // GET /internal/models - List all models in registry
  router.get("/internal/models", async (_req, res) => {
    try {
      await modelRegistry.refresh(false);
      res.json({
        stale: modelRegistry.snapshot.stale,
        lastRefreshAt: modelRegistry.snapshot.lastRefreshAt,
        lastError: modelRegistry.snapshot.lastError,
        data: modelRegistry.list(),
      });
    } catch (err) {
      res.status(500).json({ error: "failed_to_fetch_models", message: String(err) });
    }
  });

  // GET /internal/models/:id - Get specific model details
  router.get("/internal/models/:id", async (req, res) => {
    try {
      await modelRegistry.refresh(false);
      const m = modelRegistry.get(req.params.id);
      if (!m) return res.status(404).json({ error: "not_found" });
      res.json(m);
    } catch (err) {
      res.status(500).json({ error: "failed_to_fetch_model", message: String(err) });
    }
  });

  // POST /internal/resolve-model - Resolve task to model
  router.post("/internal/resolve-model", async (req, res) => {
    try {
      const { task, constraints } = req.body ?? {};
      const resolution = modelPolicy.resolve(String(task ?? "chat"), constraints ?? {});
      res.json({
        primary: resolution.primary,
        fallbacks: resolution.fallbacks,
        reason: resolution.reason,
      });
    } catch (err) {
      res.status(500).json({ error: "failed_to_resolve_model", message: String(err) });
    }
  });

  // POST /admin/models/refresh - Force refresh model registry
  router.post("/admin/models/refresh", async (_req, res) => {
    try {
      await modelRegistry.refresh(true);
      res.json({
        ok: true,
        stale: modelRegistry.snapshot.stale,
        lastRefreshAt: modelRegistry.snapshot.lastRefreshAt,
        lastError: modelRegistry.snapshot.lastError,
        count: modelRegistry.list().length,
      });
    } catch (err) {
      res.status(500).json({ error: "failed_to_refresh", message: String(err) });
    }
  });
}
