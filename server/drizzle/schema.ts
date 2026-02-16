/**
 * Re-export facade — the canonical schema lives in server/db/schema.ts.
 * This file exists so that import paths like "../drizzle/schema" resolve
 * correctly in both local dev and deployed contexts.
 */
export * from "../db/schema";
