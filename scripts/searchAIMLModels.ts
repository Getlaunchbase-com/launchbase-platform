/**
 * AIML Model Catalog Search Tool
 * 
 * Fetches all models from AIML API and creates a searchable catalog
 * with filtering by capabilities, pricing, and quality indicators.
 */

import fs from "node:fs";

interface AIMLModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  features?: string[] | Record<string, any>;
  [key: string]: any;
}

interface CatalogEntry {
  id: string;
  provider: string;
  family: string;
  capabilities: string[];
  tier: "premium" | "standard" | "budget";
  features: string;
  score: number;
}

async function fetchModels(): Promise<AIMLModel[]> {
  const key = process.env.AIML_API_KEY;
  if (!key) throw new Error("Missing AIML_API_KEY");

  const res = await fetch("https://api.aimlapi.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AIML models failed: ${res.status} ${txt}`);
  }

  const json: any = await res.json();
  return json?.data ?? [];
}

function extractProvider(id: string): string {
  if (id.includes("/")) return id.split("/")[0];
  if (id.startsWith("gpt-")) return "openai";
  if (id.startsWith("claude-")) return "anthropic";
  if (id.startsWith("gemini-")) return "google";
  if (id.startsWith("llama-")) return "meta";
  return "unknown";
}

function extractFamily(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("gpt-5")) return "gpt-5";
  if (lower.includes("gpt-4")) return "gpt-4";
  if (lower.includes("o3")) return "o3";
  if (lower.includes("o1")) return "o1";
  if (lower.includes("claude-opus-4")) return "claude-opus-4";
  if (lower.includes("claude-opus")) return "claude-opus";
  if (lower.includes("claude-sonnet")) return "claude-sonnet";
  if (lower.includes("gemini-2")) return "gemini-2";
  if (lower.includes("gemini-1.5")) return "gemini-1.5";
  if (lower.includes("llama-3")) return "llama-3";
  if (lower.includes("flux")) return "flux";
  if (lower.includes("imagen")) return "imagen";
  if (lower.includes("sora")) return "sora";
  if (lower.includes("runway")) return "runway";
  return "other";
}

function detectCapabilities(model: AIMLModel): string[] {
  const id = model.id.toLowerCase();
  const featsStr = JSON.stringify(model.features || {}).toLowerCase();
  const combined = id + " " + featsStr;
  
  const caps: string[] = [];
  
  // Text capabilities
  if (/chat|text|completion/i.test(combined)) caps.push("text");
  if (/code|codex|programming/i.test(combined)) caps.push("code");
  if (/reason|thinking|o3|o1/i.test(combined)) caps.push("reasoning");
  
  // Multimodal capabilities
  if (/vision|image.*input|multimodal|gpt-4o|gemini/i.test(combined)) caps.push("vision");
  if (/audio|speech|whisper/i.test(combined)) caps.push("audio");
  if (/video|sora|runway|veo/i.test(combined)) caps.push("video");
  
  // Generation capabilities
  if (/image.*gen|dall-e|flux|imagen|stable.*diffusion|midjourney/i.test(combined)) caps.push("image-gen");
  if (/video.*gen|sora|runway|veo/i.test(combined)) caps.push("video-gen");
  
  // Structured output
  if (/json|structured|function.*call/i.test(combined)) caps.push("structured");
  
  // Long context
  if (/long.*context|128k|200k|1m|2m/i.test(combined)) caps.push("long-context");
  
  return [...new Set(caps)];
}

function scoreTier(model: AIMLModel): "premium" | "standard" | "budget" {
  const id = model.id.toLowerCase();
  
  // Premium tier indicators
  if (/gpt-5|o3|opus-4|gemini-2\.5-pro|pro$|ultra/i.test(id)) return "premium";
  
  // Budget tier indicators
  if (/mini|nano|lite|free|3\.5/i.test(id)) return "budget";
  
  // Standard tier (default)
  return "standard";
}

function scoreQuality(model: AIMLModel): number {
  const id = model.id.toLowerCase();
  let score = 50; // baseline
  
  // Model generation scoring
  if (id.includes("gpt-5")) score += 50;
  else if (id.includes("gpt-4")) score += 30;
  else if (id.includes("o3")) score += 45;
  else if (id.includes("o1")) score += 35;
  else if (id.includes("claude-opus-4")) score += 48;
  else if (id.includes("claude-opus")) score += 40;
  else if (id.includes("gemini-2.5")) score += 42;
  else if (id.includes("gemini-2")) score += 38;
  
  // Recency bonus (2025 models)
  if (id.includes("2025")) score += 10;
  else if (id.includes("2024")) score += 5;
  
  // Pro/Ultra bonus
  if (/pro$|ultra/i.test(id)) score += 8;
  
  // Mini/Nano penalty
  if (/mini/i.test(id)) score -= 15;
  if (/nano/i.test(id)) score -= 25;
  
  return Math.max(0, Math.min(100, score));
}

function buildCatalog(models: AIMLModel[]): CatalogEntry[] {
  return models.map((model) => ({
    id: model.id,
    provider: extractProvider(model.id),
    family: extractFamily(model.id),
    capabilities: detectCapabilities(model),
    tier: scoreTier(model),
    features: JSON.stringify(model.features || {}),
    score: scoreQuality(model),
  }));
}

function filterCatalog(
  catalog: CatalogEntry[],
  filters: {
    capability?: string;
    tier?: "premium" | "standard" | "budget";
    provider?: string;
    family?: string;
    minScore?: number;
  }
): CatalogEntry[] {
  return catalog.filter((entry) => {
    if (filters.capability && !entry.capabilities.includes(filters.capability)) return false;
    if (filters.tier && entry.tier !== filters.tier) return false;
    if (filters.provider && entry.provider !== filters.provider) return false;
    if (filters.family && entry.family !== filters.family) return false;
    if (filters.minScore && entry.score < filters.minScore) return false;
    return true;
  });
}

function formatTable(entries: CatalogEntry[], limit = 50): string {
  const rows = entries.slice(0, limit).map((e) => ({
    ID: e.id,
    Provider: e.provider,
    Family: e.family,
    Tier: e.tier,
    Score: e.score,
    Capabilities: e.capabilities.join(", "),
  }));
  
  return JSON.stringify(rows, null, 2);
}

async function main() {
  console.log("🔍 Fetching AIML model catalog...\n");
  
  const models = await fetchModels();
  console.log(`✅ Fetched ${models.length} models\n`);
  
  const catalog = buildCatalog(models);
  
  // Save full catalog
  fs.writeFileSync("aiml_catalog.json", JSON.stringify(catalog, null, 2));
  console.log("💾 Saved full catalog to aiml_catalog.json\n");
  
  // Premium text models (for Craft + Critic)
  console.log("=== PREMIUM TEXT MODELS (Craft + Critic) ===");
  const premiumText = filterCatalog(catalog, {
    capability: "text",
    tier: "premium",
    minScore: 70,
  }).sort((a, b) => b.score - a.score);
  console.log(formatTable(premiumText, 15));
  console.log(`\nTotal: ${premiumText.length}\n`);
  
  // Premium vision models (for Designer)
  console.log("\n=== PREMIUM VISION MODELS (Designer) ===");
  const premiumVision = filterCatalog(catalog, {
    capability: "vision",
    tier: "premium",
    minScore: 60,
  }).sort((a, b) => b.score - a.score);
  console.log(formatTable(premiumVision, 15));
  console.log(`\nTotal: ${premiumVision.length}\n`);
  
  // Reasoning models (for complex logic)
  console.log("\n=== REASONING MODELS (Complex Logic) ===");
  const reasoning = filterCatalog(catalog, {
    capability: "reasoning",
    minScore: 60,
  }).sort((a, b) => b.score - a.score);
  console.log(formatTable(reasoning, 10));
  console.log(`\nTotal: ${reasoning.length}\n`);
  
  // Image generation models
  console.log("\n=== IMAGE GENERATION MODELS ===");
  const imageGen = filterCatalog(catalog, {
    capability: "image-gen",
    minScore: 40,
  }).sort((a, b) => b.score - a.score);
  console.log(formatTable(imageGen, 10));
  console.log(`\nTotal: ${imageGen.length}\n`);
  
  // Budget models (for high-volume tasks)
  console.log("\n=== BUDGET MODELS (High Volume) ===");
  const budget = filterCatalog(catalog, {
    tier: "budget",
    minScore: 30,
  }).sort((a, b) => b.score - a.score);
  console.log(formatTable(budget, 10));
  console.log(`\nTotal: ${budget.length}\n`);
  
  // Summary stats
  console.log("\n=== SUMMARY ===");
  console.log(`Total models: ${catalog.length}`);
  console.log(`Premium: ${catalog.filter((e) => e.tier === "premium").length}`);
  console.log(`Standard: ${catalog.filter((e) => e.tier === "standard").length}`);
  console.log(`Budget: ${catalog.filter((e) => e.tier === "budget").length}`);
  console.log(`\nCapability breakdown:`);
  const capCounts = new Map<string, number>();
  catalog.forEach((e) => {
    e.capabilities.forEach((cap) => {
      capCounts.set(cap, (capCounts.get(cap) || 0) + 1);
    });
  });
  Array.from(capCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([cap, count]) => {
      console.log(`  ${cap}: ${count}`);
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
