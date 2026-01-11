/**
 * Diagnostic endpoint for querying production data
 * Uses WORKER_TOKEN for authentication (already exists in env)
 */

import { Router } from "express";
import { getDb } from "../db";
import { intakes, designJobs } from "../../drizzle/schema";
import { desc, sql } from "drizzle-orm";

const router = Router();

router.get("/api/diagnostic/intakes", async (req, res) => {
  try {
    // Auth check using existing WORKER_TOKEN
    const token = req.query.token || req.headers["x-worker-token"];
    const expectedToken = process.env.WORKER_TOKEN;
    
    if (!expectedToken || token !== expectedToken) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }
    
    // Query intakes with design jobs
    const results = await db
      .select({
        id: intakes.id,
        businessName: intakes.businessName,
        email: intakes.email,
        status: intakes.status,
        tenant: intakes.tenant,
        createdAt: intakes.createdAt,
        approvedAt: intakes.approvedAt,
        designJobId: designJobs.designJobId,
        tier: designJobs.tier,
        designStatus: designJobs.status,
      })
      .from(intakes)
      .leftJoin(designJobs, sql`${intakes.id} = ${designJobs.intakeId}`)
      .orderBy(desc(intakes.createdAt))
      .limit(50);
    
    res.json({
      count: results.length,
      intakes: results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
