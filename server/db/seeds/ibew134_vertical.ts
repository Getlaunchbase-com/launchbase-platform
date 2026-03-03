/**
 * IBEW 134 Vertical Pack Seed
 *
 * Seeds the vertical_packs table with the IBEW 134 Electrical vertical.
 * Run: npx tsx server/db/seeds/ibew134_vertical.ts
 */

import { getDb } from "../index";
import { verticalPacks } from "../schema";

const IBEW_134_PACK = {
  slug: "ibew-134-electrical",
  name: "IBEW 134 Electrical",
  description:
    "Personal AI assistant for IBEW Local 134 electricians. Includes NEC code lookup, material takeoff estimation, wire gauge and conduit fill calculators, and electrical trade knowledge.",
  systemPromptTemplate: `You are LaunchBase, a personal AI assistant specialized for IBEW Local 134 electricians working in the Chicago area.

Your expertise:
- National Electrical Code (NEC 2023) — always cite specific code sections when answering code questions
- IBEW Local 134 labor rates, work rules, and practices
- Low voltage systems (Cat6, WAP, cameras, access control, fire alarm)
- Electrical estimating and material takeoffs
- Blueprint reading and symbol identification
- Conduit fill calculations, voltage drop, wire sizing

Communication style:
- Talk like a fellow tradesperson — practical, direct, no unnecessary explanation
- When citing code, always give the NEC section number (e.g., "Per NEC 210.8...")
- When estimating, show your work with line items
- If asked about something outside electrical, still help but note you're strongest in electrical
- For safety-critical answers, always reference the applicable NEC section

Tools available:
- NEC code lookup: search or look up specific NEC sections
- Wire gauge calculator: recommend wire size for given amps/distance/voltage
- Voltage drop calculator: check if a specific wire gauge passes 3% guideline
- Conduit fill calculator: check fill percentage per NEC Chapter 9
- Material takeoff: estimate labor and materials from IBEW LV Task Library
- Email: send emails on user's behalf (with approval)
- Memory: remember user's contacts, preferences, projects`,

  toolsConfig: {
    enabled: [
      "nec_code_lookup",
      "wire_gauge_calc",
      "voltage_drop_calc",
      "conduit_fill_calc",
      "takeoff_estimate",
      "send_email",
      "remember",
      "recall",
    ],
    config: {
      laborRate: 85,
      region: "Chicago",
      union: "IBEW Local 134",
      necVersion: "2023",
    },
  },

  knowledgeBaseRefs: [
    "contracts/IBEW_LV_TaskLibrary_v1.json",
    "contracts/nec_code_data.json",
  ],

  uiExtensions: {
    quickActions: [
      {
        id: "nec-lookup",
        label: "NEC Code Lookup",
        intent: "Look up NEC code for ",
        icon: "book-outline",
      },
      {
        id: "estimate",
        label: "Estimate Materials",
        intent: "Estimate materials for ",
        icon: "calculator-outline",
      },
      {
        id: "wire-calc",
        label: "Wire Calculator",
        intent: "Calculate wire gauge for ",
        icon: "flash-outline",
      },
      {
        id: "conduit-fill",
        label: "Conduit Fill",
        intent: "Calculate conduit fill for ",
        icon: "git-branch-outline",
      },
    ],
  },

  status: "active" as const,
};

async function seed() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  console.log("Seeding IBEW 134 vertical pack...");

  // Check if already exists
  const { eq } = await import("drizzle-orm");
  const [existing] = await db
    .select()
    .from(verticalPacks)
    .where(eq(verticalPacks.slug, IBEW_134_PACK.slug))
    .limit(1);

  if (existing) {
    console.log("  IBEW 134 pack already exists (id:", existing.id, "). Updating...");
    await db
      .update(verticalPacks)
      .set({
        name: IBEW_134_PACK.name,
        description: IBEW_134_PACK.description,
        systemPromptTemplate: IBEW_134_PACK.systemPromptTemplate,
        toolsConfig: IBEW_134_PACK.toolsConfig,
        knowledgeBaseRefs: IBEW_134_PACK.knowledgeBaseRefs,
        uiExtensions: IBEW_134_PACK.uiExtensions,
        status: IBEW_134_PACK.status,
      })
      .where(eq(verticalPacks.id, existing.id));
    console.log("  Updated.");
  } else {
    const [result] = await db.insert(verticalPacks).values(IBEW_134_PACK);
    console.log("  Created with id:", result.insertId);
  }

  console.log("Done.");
  process.exit(0);
}

// Allow direct execution
seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
