/**
 * Base Assistant Vertical Pack Seed
 *
 * Seeds the vertical_packs table with the generic Base Assistant vertical.
 * This is the default vertical for users who haven't selected a trade specialization.
 * Run: npx tsx server/db/seeds/base_assistant_vertical.ts
 */

import { getDb } from "../index";
import { verticalPacks } from "../schema";

const BASE_ASSISTANT_PACK = {
  slug: "base-assistant",
  name: "Base Assistant",
  description:
    "General-purpose personal AI assistant. Handles everyday tasks like email, scheduling, reminders, and general knowledge. Serves as the default vertical before a trade specialization is selected.",
  systemPromptTemplate: `You are LaunchBase, a personal AI assistant designed to make your day easier.

Your capabilities:
- Send and draft emails on the user's behalf (with approval)
- Remember contacts, preferences, and important details
- Recall saved information when relevant
- Answer general knowledge questions
- Help organize tasks and priorities
- Provide morning briefings summarizing your day ahead

Communication style:
- Friendly, professional, and concise
- Proactively offer help when you notice patterns
- Confirm before taking actions that affect others (like sending emails)
- Keep responses practical and actionable

Tools available:
- Email: send emails on user's behalf (with approval)
- Memory: remember user's contacts, preferences, and important details
- Recall: look up previously saved information`,

  toolsConfig: {
    enabled: ["send_email", "remember", "recall"],
    config: {},
  },

  knowledgeBaseRefs: [] as string[],

  uiExtensions: {
    quickActions: [
      {
        id: "send-email",
        label: "Send Email",
        intent: "Send an email to ",
        icon: "mail-outline",
      },
      {
        id: "remember",
        label: "Remember This",
        intent: "Remember that ",
        icon: "bookmark-outline",
      },
      {
        id: "help",
        label: "What Can You Do?",
        intent: "What can you help me with?",
        icon: "help-circle-outline",
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

  console.log("Seeding Base Assistant vertical pack...");

  const { eq } = await import("drizzle-orm");
  const [existing] = await db
    .select()
    .from(verticalPacks)
    .where(eq(verticalPacks.slug, BASE_ASSISTANT_PACK.slug))
    .limit(1);

  if (existing) {
    console.log("  Base Assistant pack already exists (id:", existing.id, "). Updating...");
    await db
      .update(verticalPacks)
      .set({
        name: BASE_ASSISTANT_PACK.name,
        description: BASE_ASSISTANT_PACK.description,
        systemPromptTemplate: BASE_ASSISTANT_PACK.systemPromptTemplate,
        toolsConfig: BASE_ASSISTANT_PACK.toolsConfig,
        knowledgeBaseRefs: BASE_ASSISTANT_PACK.knowledgeBaseRefs,
        uiExtensions: BASE_ASSISTANT_PACK.uiExtensions,
        status: BASE_ASSISTANT_PACK.status,
      })
      .where(eq(verticalPacks.id, existing.id));
    console.log("  Updated.");
  } else {
    const [result] = await db.insert(verticalPacks).values(BASE_ASSISTANT_PACK);
    console.log("  Created with id:", result.insertId);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
