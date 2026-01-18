import fs from "node:fs";

async function main() {
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
  const models = json?.data ?? [];

  // Basic bucketing heuristics
  const premiumText = models.filter((m: any) =>
    String(m.id || "").match(/gpt-5|o3|opus|gemini.*pro/i)
  );

  const visual = models.filter((m: any) => {
    const id = String(m.id || "");
    const feats = Array.isArray(m.features) ? m.features.join(" ") : JSON.stringify(m.features ?? {});
    return /image|vision|video|recraft|flux|imagen|sora|runway|veo/i.test(id + " " + feats);
  });

  fs.writeFileSync("aiml_models.json", JSON.stringify(json, null, 2));
  console.log(`Total models: ${models.length}`);
  console.log(`Premium text candidates: ${premiumText.length}`);
  console.log(`Visual candidates: ${visual.length}`);
  console.log("Top premium text IDs:", premiumText.slice(0, 20).map((m: any) => m.id));
  console.log("Top visual IDs:", visual.slice(0, 20).map((m: any) => m.id));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
