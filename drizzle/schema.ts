/**
 * Re-export facade — the canonical schema lives in server/db/schema.ts.
 * This file exists so that deep import paths like "../../../drizzle/schema"
 * (from server/routers/admin/ and server/routers/mobile/) resolve correctly.
 */
export * from "../server/db/schema";
