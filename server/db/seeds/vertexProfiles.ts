/**
 * Seed: Vertex Profiles
 *
 * Run via: npx tsx server/db/seeds/vertexProfiles.ts
 * Idempotent — skips insert if the profile name already exists.
 */

import { getDb } from "../index";
import { vertexProfiles } from "../schema";
import { eq } from "drizzle-orm";

const IBEW_VERTEX = {
  name: "IBEW Low Voltage Superintendent v1",
  description:
    "Pre-configured vertex for IBEW low-voltage electrical superintendent workflows. " +
    "Includes default waste percentages, labor rate assumptions, and a curated tool allowlist " +
    "for estimating, scheduling, and compliance reporting.",
  configJson: {
    model: "gpt-4o",
    temperature: 0.3,
    systemPrompt:
      "You are an AI superintendent assistant for IBEW low-voltage electrical projects. " +
      "Help with material take-offs, labor estimates, scheduling, and compliance documentation. " +
      "Always apply the configured waste percentages and labor defaults below.",
    defaults: {
      wastePercentages: {
        conduit: 10,
        wire: 12,
        fittings: 15,
        devices: 5,
        general: 10,
      },
      laborRates: {
        journeyman: 85.0,
        apprentice: 45.0,
        foreman: 95.0,
        generalForeman: 110.0,
      },
      laborUnits: "USD/hr",
      markupPercent: 15,
    },
    maxSteps: 20,
    maxErrors: 3,
  },
  toolsAllowlistJson: [
    "material_takeoff",
    "labor_estimate",
    "schedule_builder",
    "compliance_report",
    "cost_summary",
    "submittal_generator",
    "rfi_drafter",
    "daily_log",
    "safety_checklist",
    "web_search",
    "file_read",
    "file_write",
  ],
};

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Database unavailable — skipping seed.");
    process.exit(1);
  }

  // Idempotent: check if already exists
  const [existing] = await db
    .select({ id: vertexProfiles.id })
    .from(vertexProfiles)
    .where(eq(vertexProfiles.name, IBEW_VERTEX.name))
    .limit(1);

  if (existing) {
    console.log(`Vertex profile "${IBEW_VERTEX.name}" already exists (id=${existing.id}). Skipping.`);
    return;
  }

  const [result] = await db.insert(vertexProfiles).values({
    name: IBEW_VERTEX.name,
    description: IBEW_VERTEX.description,
    configJson: IBEW_VERTEX.configJson,
    toolsAllowlistJson: IBEW_VERTEX.toolsAllowlistJson,
  });

  console.log(`Seeded vertex profile "${IBEW_VERTEX.name}" with id=${result.insertId}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
