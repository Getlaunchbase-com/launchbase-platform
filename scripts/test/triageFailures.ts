#!/usr/bin/env tsx
/**
 * triageFailures.ts
 *
 * Usage:
 *   pnpm tsx scripts/test/triageFailures.ts --from vitest.out
 *   pnpm vitest --reporter=verbose | pnpm tsx scripts/test/triageFailures.ts
 *
 * Output:
 *   - Console summary
 *   - Writes JSON to scripts/test/triageFailures.json
 */

import fs from "node:fs";
import path from "node:path";

type Tier = "tier0" | "tier1" | "tier2";

type Failure = {
  file?: string;
  testName?: string;
  error?: string;
  raw: string;
  tier: Tier;
  reason: string;
};

function readInput(fromArg?: string): string {
  if (fromArg) return fs.readFileSync(fromArg, "utf8");
  return fs.readFileSync(0, "utf8"); // stdin
}

// Very lightweight heuristics. Expand as needed.
function classify(raw: string): { tier: Tier; reason: string } {
  const s = raw.toLowerCase();

  // Tier 0 (mechanical)
  if (s.includes("is not defined") && s.includes("http")) {
    return { tier: "tier0", reason: "missing import: http is not defined" };
  }
  if (s.includes("app.address is not a function")) {
    return { tier: "tier0", reason: "supertest/express mismatch; await createApp or server wrap" };
  }
  if (s.includes("missing copy for language=") || s.includes("[emailcopy]")) {
    return { tier: "tier0", reason: "copy assertion drift or missing params in test" };
  }
  if (s.includes("no ") && s.includes(" export is defined on the ") && s.includes("mock")) {
    return { tier: "tier0", reason: "missing mock export" };
  }
  if (s.includes("unterminated") || s.includes("syntaxerror")) {
    return { tier: "tier0", reason: "syntax error" };
  }

  // Tier 1 (coupled but local)
  if (s.includes("zod") || s.includes("validation.ok") || s.includes("schema mismatch")) {
    return { tier: "tier1", reason: "schema/fixture drift (PromptPack or JSON fixtures)" };
  }
  if (s.includes("no eligible models") || s.includes("requiredfeatures")) {
    return { tier: "tier1", reason: "mock registry missing feature/type constraints" };
  }
  if (s.includes("count") && (s.includes("expected") || s.includes("received"))) {
    return { tier: "tier1", reason: "expectation drift in count logic" };
  }
  if (s.includes("ai request failed") || s.includes("network_disabled")) {
    return { tier: "tier1", reason: "provider routing or network-gated scenario" };
  }

  // Tier 2 (integration)
  if (s.includes("cannot create deployment") || s.includes("buildplan")) {
    return { tier: "tier2", reason: "db fixture missing / integration state" };
  }
  if (s.includes("facebook") || s.includes("stopreason") || s.includes("policy")) {
    return { tier: "tier2", reason: "policy / integration behavior drift" };
  }

  return { tier: "tier2", reason: "uncategorized; likely integration or deeper coupling" };
}

function extractFailures(output: string): Failure[] {
  const lines = output.split(/\r?\n/);

  // We'll treat any line containing "FAIL" or common error markers as a candidate.
  const candidates = lines.filter(
    (l) =>
      l.includes(" FAIL ") ||
      l.includes("TypeError:") ||
      l.includes("Error:") ||
      l.includes("AssertionError") ||
      l.includes("expected ") ||
      l.includes("ZodError")
  );

  const failures: Failure[] = [];
  for (const raw of candidates) {
    const { tier, reason } = classify(raw);
    failures.push({
      raw,
      tier,
      reason,
    });
  }

  // De-dupe by raw line.
  const seen = new Set<string>();
  return failures.filter((f) => {
    const k = `${f.tier}::${f.raw}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function summarize(failures: Failure[]) {
  const byTier: Record<Tier, Failure[]> = {
    tier0: [],
    tier1: [],
    tier2: [],
  };

  for (const f of failures) byTier[f.tier].push(f);

  const summary = {
    total: failures.length,
    tier0: byTier.tier0.length,
    tier1: byTier.tier1.length,
    tier2: byTier.tier2.length,
    topReasons: Object.entries(
      failures.reduce<Record<string, number>>((acc, f) => {
        acc[f.reason] = (acc[f.reason] ?? 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  };

  return { byTier, summary };
}

function main() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  const from = fromIdx >= 0 ? args[fromIdx + 1] : undefined;

  const output = readInput(from);
  const failures = extractFailures(output);
  const { byTier, summary } = summarize(failures);

  const outPath = path.resolve("scripts/test/triageFailures.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ summary, failures: byTier }, null, 2), "utf8");

  console.log("✅ triageFailures complete");
  console.log(`Total signals: ${summary.total}`);
  console.log(`Tier0: ${summary.tier0} | Tier1: ${summary.tier1} | Tier2: ${summary.tier2}`);
  console.log("Top reasons:");
  for (const [reason, count] of summary.topReasons) {
    console.log(`  - ${count}× ${reason}`);
  }
  console.log(`\nWrote: ${outPath}`);
}

main();
