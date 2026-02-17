/**
 * Delaware LLC Test Seeder
 *
 * Seeds the marketing_signals table with realistic test data
 * for development and testing purposes.
 */

import { getDb } from "../../db";
import { marketingSignals } from "../../db/schema";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// seedTestDelawareLLCs
// ---------------------------------------------------------------------------

export async function seedTestDelawareLLCs(_count?: number): Promise<{ count: number }> {
  const db = await getDb();
  if (!db) {
    console.warn("[de-seeder] Database not available");
    return { count: 0 };
  }

  const testEntities = [
    {
      name: "VINCE'S PREMIER ROOFING LLC",
      score: 85,
      tags: ["roofing", "trades", "high-value"],
      reasons: ["Service-oriented business name", "Trades vertical match"],
    },
    {
      name: "ALL SEASONS HVAC SOLUTIONS LLC",
      score: 80,
      tags: ["hvac", "trades", "high-value"],
      reasons: ["Service-oriented business name", "HVAC vertical match"],
    },
    {
      name: "MOUNTAIN VIEW PLUMBING LLC",
      score: 78,
      tags: ["plumbing", "trades"],
      reasons: ["Service-oriented business name", "Plumbing vertical match"],
    },
    {
      name: "BRIGHT SMILE DENTAL CLINIC LLC",
      score: 65,
      tags: ["dental", "appointments"],
      reasons: ["Appointments vertical match", "Local service provider"],
    },
    {
      name: "ELITE FITNESS STUDIO LLC",
      score: 60,
      tags: ["fitness", "appointments"],
      reasons: ["Appointments vertical match"],
    },
    {
      name: "PARKSIDE LAWN CARE LLC",
      score: 72,
      tags: ["landscaping", "trades"],
      reasons: ["Service-oriented business name", "Landscaping service"],
    },
    {
      name: "RIVERSTONE PROPERTY MANAGEMENT LLC",
      score: 55,
      tags: ["property", "professional"],
      reasons: ["Property management service"],
    },
    {
      name: "APEX CAPITAL HOLDINGS LLC",
      score: 15,
      tags: ["holding-company", "low-priority"],
      reasons: ["Likely holding/investment entity"],
    },
    {
      name: "SILVERLINE ELECTRIC CONTRACTORS LLC",
      score: 82,
      tags: ["electrical", "trades", "high-value"],
      reasons: ["Service-oriented business name", "Electrical contractor"],
    },
    {
      name: "COASTAL CLEANING PROS LLC",
      score: 70,
      tags: ["cleaning", "trades"],
      reasons: ["Service-oriented business name", "Cleaning service"],
    },
    {
      name: "WESTFIELD CONSULTING GROUP LLC",
      score: 45,
      tags: ["consulting", "professional"],
      reasons: ["Professional services"],
    },
    {
      name: "SUNBELT SOLAR INSTALLATIONS LLC",
      score: 75,
      tags: ["solar", "trades", "high-value"],
      reasons: ["Service-oriented business name", "Solar installation"],
    },
    {
      name: "BLUESTONE INVESTMENT PARTNERS LLC",
      score: 10,
      tags: ["investment", "low-priority"],
      reasons: ["Likely investment entity"],
    },
    {
      name: "HARBOR AUTO REPAIR LLC",
      score: 68,
      tags: ["auto", "trades"],
      reasons: ["Service-oriented business name", "Auto repair"],
    },
    {
      name: "NORTH STAR PAINTING SERVICES LLC",
      score: 76,
      tags: ["painting", "trades"],
      reasons: ["Service-oriented business name", "Painting contractor"],
    },
  ];

  let count = 0;
  const today = new Date();

  for (const entity of testEntities) {
    try {
      const fileNumber = `TEST${(7000000 + count).toString()}`;
      const canonicalKey = crypto
        .createHash("sha256")
        .update(`de:llc:test:${entity.name}`)
        .digest("hex")
        .substring(0, 64);

      // Vary the event dates over the last 7 days
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() - Math.floor(Math.random() * 7));

      await db
        .insert(marketingSignals)
        .values({
          id: `de_test_${count}_${Date.now().toString(36)}`,
          sourceType: "llc_filing",
          jurisdiction: "DE",
          entityName: entity.name,
          eventDate,
          canonicalKey,
          rawJson: {
            entityName: entity.name,
            fileNumber,
            fileDate: eventDate.toISOString().split("T")[0],
            type: "LLC",
            source: "test_seeder",
          },
          score: entity.score,
          reasons: entity.reasons,
          status: "new",
          tags: ["delaware", "llc", "test", ...entity.tags],
        })
        .onDuplicateKeyUpdate({
          set: { updatedAt: new Date() },
        });

      count++;
    } catch (err) {
      // Skip duplicates
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Duplicate") && !msg.includes("unique")) {
        console.error(`[de-seeder] Error seeding ${entity.name}:`, msg);
      }
    }
  }

  console.log(`[de-seeder] Seeded ${count} test Delaware LLC filings`);
  return { count };
}
