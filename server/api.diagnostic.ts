/**
 * Diagnostic endpoint to check environment variables and query data
 */
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { intakes, designJobs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

export async function handleDiagnostic(req: Request, res: Response) {
  // Only allow in development or with worker token
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  
  if (process.env.NODE_ENV !== "development" && token !== process.env.WORKER_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }
  
  // Check if requesting intakes data
  if (req.query.intakes === "true") {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    
    const results = await db
      .select()
      .from(intakes)
      .orderBy(desc(intakes.createdAt))
      .limit(50);
    
    return res.json({
      count: results.length,
      intakes: results,
      timestamp: new Date().toISOString(),
    });
  }
  
  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      RESEND_API_KEY_exists: !!process.env.RESEND_API_KEY,
      RESEND_API_KEY_length: process.env.RESEND_API_KEY?.length || 0,
      RESEND_API_KEY_prefix: process.env.RESEND_API_KEY?.substring(0, 7) || "N/A",
      ENV_resendApiKey_exists: !!ENV.resendApiKey,
      ENV_resendApiKey_length: ENV.resendApiKey?.length || 0,
      ENV_resendApiKey_prefix: ENV.resendApiKey?.substring(0, 7) || "N/A",
    },
    timestamp: new Date().toISOString(),
  });
}
