/**
 * Server Bootstrap
 * 
 * This file starts the HTTP server and applies environment-specific middleware
 * (Vite for dev, static serving for production).
 * 
 * All route registrations live in app.ts.
 */

import { createServer } from "http";
import net from "net";
import { createApp } from "./app";
import { setupVite, serveStatic } from "./vite";
import fs from "node:fs";

fs.appendFileSync(
  "/tmp/launchbase_boot.log",
  `[BOOT] index.ts loaded ${new Date().toISOString()}\n`
);

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

/**
 * Find an available port starting from the preferred port
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + 19}`);
}

/**
 * Start the HTTP server
 */
async function startServer() {
  // Initialize policy registry before starting server
  if (process.env.NODE_ENV !== "test") {
    const { registerPolicies } = await import("../ai/engine/policy/policyRegistry");
    const { ALL_POLICIES } = await import("../ai/engine/policy/policyBundle");
    try {
      registerPolicies(ALL_POLICIES);
      console.log(`[PolicyRegistry] Registered ${ALL_POLICIES.length} policies`);
    } catch (err) {
      console.error("[PolicyRegistry] Failed to register policies:", err);
      console.warn("[PolicyRegistry] Server will start but engine may not work correctly");
    }
  }

  // Initialize model registry before starting server
  if (process.env.NODE_ENV !== "test") {
    const { initializeModelRegistry, startModelRegistryRefresh } = await import("../ai");
    try {
      await initializeModelRegistry();
      startModelRegistryRefresh();
    } catch (err) {
      console.error("[AI] Failed to initialize model registry:", err);
      console.warn("[AI] Server will start but model routing may not work correctly");
    }
  }

  const app = await createApp();
  const server = createServer(app);

  // Apply environment-specific middleware
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
