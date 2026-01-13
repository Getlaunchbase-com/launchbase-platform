// scripts/_weeklyAiReportMarkdown.ts
// Build the weekly AI Tennis markdown report from SQL result payloads.
//
// Assumptions:
// - Each query result is either an array of row objects OR a driver payload that contains rows.
// - Column names are whatever your SQL selects; this file normalizes a few common ones.
// - This is formatting-only: no DB writes, no logging of prompts/errors.

type SystemMeta = {
  version?: string;
  buildSha?: string;
};

type AnyRow = Record<string, any>;

type QueryResults = Record<
  string,
  // Can be: rows[] OR { rows: rows[] } OR { 0: rows[] } or mysql2 style objects
  any
>;

type Flag = "✅" | "⚠️" | "🚨";

type RateResult = { text: string; rate: number | null };

/**
 * Convert numerator/denominator to rate percentage.
 * Returns N/A if denominator is 0 or invalid.
 */
function toRate(numerator: number, denominator: number, decimals = 1): RateResult {
  if (!Number.isFinite(denominator) || denominator <= 0) return { text: "N/A", rate: null };
  const rate = numerator / denominator;
  return { text: `${(rate * 100).toFixed(decimals)}%`, rate };
}

/**
 * Flag rate where LOW is BAD (e.g., cache hit rate, approval rate).
 * Returns empty string if rate is null (N/A).
 */
function flagLowRate(rate: number | null, warnBelow: number, criticalBelow: number): Flag | "" {
  if (rate === null) return ""; // N/A => no flags
  if (rate < criticalBelow) return "🚨";
  if (rate < warnBelow) return "⚠️";
  return "✅";
}

/**
 * Flag rate where HIGH is BAD (e.g., stale takeover rate, error rate).
 * Returns empty string if rate is null (N/A).
 */
function flagHighRate(rate: number | null, warnAbove: number, criticalAbove: number): Flag | "" {
  if (rate === null) return "";
  if (rate > criticalAbove) return "🚨";
  if (rate > warnAbove) return "⚠️";
  return "✅";
}

type Thresholds = {
  providerFailedWarnPct: number; // e.g. 5
  providerFailedCritPct: number; // e.g. 10
  ajvFailedWarnPct: number; // e.g. 2
  ajvFailedCritPct: number; // e.g. 5
  needsHumanWarnPct: number; // e.g. 15
  needsHumanCritPct: number; // e.g. 25
  costDeltaWarnPct: number; // e.g. 10
  costDeltaCritPct: number; // e.g. 20
  approvalDropWarnPp: number; // e.g. 5 (percentage points)
  approvalDropCritPp: number; // e.g. 10
  cacheHitWarnPct: number; // e.g. 85 (warn if below)
  cacheHitCritPct: number; // e.g. 75
  staleTakeoverWarnPct: number; // e.g. 3
  staleTakeoverCritPct: number; // e.g. 5
};

const DEFAULT_THRESHOLDS: Thresholds = {
  providerFailedWarnPct: 5,
  providerFailedCritPct: 10,
  ajvFailedWarnPct: 2,
  ajvFailedCritPct: 5,
  needsHumanWarnPct: 15,
  needsHumanCritPct: 25,
  costDeltaWarnPct: 10,
  costDeltaCritPct: 20,
  approvalDropWarnPp: 5,
  approvalDropCritPp: 10,
  cacheHitWarnPct: 85,
  cacheHitCritPct: 75,
  staleTakeoverWarnPct: 3,
  staleTakeoverCritPct: 5,
};

function extractRows(payload: any): AnyRow[] {
  if (!payload) return [];
  // Common cases
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;

  // mysql2 / drizzle sometimes returns [rows, fields]
  if (Array.isArray(payload[0])) return payload[0];
  // drizzle might return an object with "0" pointing to rows
  if (Array.isArray(payload["0"])) return payload["0"];

  // Some drivers return { results: [...] }
  if (Array.isArray(payload.results)) return payload.results;

  return [];
}

function safeNum(x: any, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(x: any, fallback = ""): string {
  return typeof x === "string" ? x : x == null ? fallback : String(x);
}

function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function money(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(digits)}`;
}

function ppDelta(d: number): string {
  // percentage points delta display (+/-)
  if (!Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}pp`;
}

function pctDelta(d: number): string {
  if (!Number.isFinite(d)) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

function flagFromRateBadIsHigh(ratePct: number, warn: number, crit: number): Flag {
  if (ratePct >= crit) return "🚨";
  if (ratePct >= warn) return "⚠️";
  return "✅";
}

function flagFromRateGoodIsHigh(ratePct: number, warnBelow: number, critBelow: number): Flag {
  // e.g. cache hit rate: warn if below thresholds
  if (ratePct < critBelow) return "🚨";
  if (ratePct < warnBelow) return "⚠️";
  return "✅";
}

function normalizeStopReason(x: string): string {
  return x.trim();
}

function mdTable(headers: string[], rows: (string | number)[][]): string {
  const h = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((c) => safeStr(c, "—")).join(" | ")} |`).join("\n");
  return [h, sep, body || `| ${headers.map(() => "—").join(" | ")} |`].join("\n");
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body}\n`;
}

// ---- Interpreters (adapt to your SQL column names) ----

// 1) stopReason Distribution rows: { stopReason, count, pct, wowDeltaPct? }
function renderStopReasonDistribution(rows: AnyRow[], t: Thresholds) {
  // Filter out empty/null stopReasons
  const filtered = rows.filter((r) => {
    const stopReason = safeStr(r.stopReason ?? r.stop_reason ?? r.reason).trim();
    return stopReason.length > 0;
  });

  if (filtered.length === 0) {
    return "_No AI Tennis proposals found for this period._";
  }

  const normalized = filtered.map((r) => {
    const stopReason = normalizeStopReason(safeStr(r.stopReason ?? r.stop_reason ?? r.reason));
    const count = safeNum(r.count ?? r.cnt);
    const pctVal = safeNum(r.pct ?? r.percent ?? r.ratePct);
    const wow = safeNum(r.wowDeltaPct ?? r.wow_delta_pct ?? r.wowDelta ?? r.wow);
    // flag important error reasons
    let flag: Flag = "✅";
    if (stopReason === "provider_failed") flag = flagFromRateBadIsHigh(pctVal, t.providerFailedWarnPct, t.providerFailedCritPct);
    if (stopReason === "ajv_failed") flag = flagFromRateBadIsHigh(pctVal, t.ajvFailedWarnPct, t.ajvFailedCritPct);
    if (stopReason === "router_failed") flag = flagFromRateBadIsHigh(pctVal, t.providerFailedWarnPct, t.providerFailedCritPct); // treat similarly
    if (stopReason === "json_parse_failed") flag = flagFromRateBadIsHigh(pctVal, t.providerFailedWarnPct, t.providerFailedCritPct);
    return { stopReason, count, pctVal, wow, flag };
  });

  const table = mdTable(
    ["stopReason", "count", "pct", "WoW Δ", "Flag"],
    normalized.map((r) => [r.stopReason, String(r.count), pct(r.pctVal), pctDelta(r.wow), r.flag])
  );

  const note =
    `**Interpretation:** spikes in error stopReasons (` +
    "`provider_failed`, `router_failed`, `ajv_failed`, `json_parse_failed`" +
    `) are incident-worthy.`;

  return `${table}\n\n${note}`;
}

// 2) needsHuman Rate rows: { period, ratePct, wowDeltaPct? } OR per-tenant
function renderNeedsHumanRate(rows: AnyRow[], t: Thresholds) {
  const normalized = rows.map((r) => {
    const period = safeStr(r.period ?? r.window ?? r.tenant ?? "—");
    const rate = safeNum(r.ratePct ?? r.rate_pct ?? r.needsHumanPct ?? r.pct);
    const wow = safeNum(r.wowDeltaPct ?? r.wow_delta_pct ?? r.wowDelta ?? r.wow);
    const flag = flagFromRateBadIsHigh(rate, t.needsHumanWarnPct, t.needsHumanCritPct);
    return { period, rate, wow, flag };
  });

  const table = mdTable(["period", "rate", "WoW Δ", "Flag"], normalized.map((r) => [r.period, pct(r.rate), pctDelta(r.wow), r.flag]));
  const note = `**Interpretation:** rising rate indicates prompt/protocol mismatch (not necessarily model failure).`;
  return `${table}\n\n${note}`;
}

// 3) Cost per Approval rows: { tenant, avg7Usd, avg30Usd, wowDeltaPct? }
function renderCostPerApproval(rows: AnyRow[], t: Thresholds) {
  const normalized = rows.map((r) => {
    const tenant = safeStr(r.tenant ?? "—");
    const avg7 = safeNum(r.avg7Usd ?? r.avg_7_usd ?? r.usd7 ?? r.avgUsd7 ?? r.avg7);
    const avg30 = safeNum(r.avg30Usd ?? r.avg_30_usd ?? r.usd30 ?? r.avgUsd30 ?? r.avg30);
    const wow = safeNum(r.wowDeltaPct ?? r.wow_delta_pct ?? r.wow);
    const flag = flagFromRateBadIsHigh(wow, t.costDeltaWarnPct, t.costDeltaCritPct); // here wow is a percent delta
    return { tenant, avg7, avg30, wow, flag };
  });

  const table = mdTable(
    ["tenant", "7-day avg USD", "30-day avg USD", "WoW Δ", "Flag"],
    normalized.map((r) => [r.tenant, money(r.avg7), money(r.avg30), pctDelta(r.wow), r.flag])
  );
  const note = `**Interpretation:** rising cost per approval indicates drift or inefficiency.`;
  return `${table}\n\n${note}`;
}

// 4) Approval Rate rows: { tenant, rate7Pct, rate30Pct, wowDeltaPp?, totalRequests }
function renderApprovalRate(rows: AnyRow[], t: Thresholds) {
  if (rows.length === 0) {
    return "_No AI Tennis proposals found for this period._";
  }

  const normalized = rows.map((r) => {
    const tenant = safeStr(r.tenant ?? "—");
    const totalRequests = safeNum(r.totalRequests ?? r.total_requests ?? 0);
    const r7 = totalRequests > 0 ? safeNum(r.rate7Pct ?? r.rate_7_pct ?? r.approval7Pct ?? r.pct7 ?? r.rate7) : null;
    const r30 = totalRequests > 0 ? safeNum(r.rate30Pct ?? r.rate_30_pct ?? r.approval30Pct ?? r.pct30 ?? r.rate30) : null;
    const wowPp = totalRequests > 0 ? safeNum(r.wowDeltaPp ?? r.wow_delta_pp ?? r.wowPp ?? r.wow) : null;
    // For approval rate: a negative delta (drop) is bad; compare magnitude
    let flag: Flag = "—" as any;
    if (r7 !== null) {
      const drop = -wowPp!; // if wow is -2pp, drop is +2pp
      flag = "✅";
      if (drop >= t.approvalDropCritPp) flag = "🚨";
      else if (drop >= t.approvalDropWarnPp) flag = "⚠️";
    }
    return { tenant, r7, r30, wowPp, flag };
  });

  const table = mdTable(
    ["tenant", "7-day %", "30-day %", "WoW Δ", "Flag"],
    normalized.map((r) => [
      r.tenant,
      r.r7 !== null ? pct(r.r7) : "N/A",
      r.r30 !== null ? pct(r.r30) : "N/A",
      r.wowPp !== null ? ppDelta(r.wowPp) : "N/A",
      r.flag
    ])
  );
  const note = `**Interpretation:** falling approval rate indicates UX friction or quality degradation.`;
  return `${table}\n\n${note}`;
}

// 5) Cache Hit Rate rows: { tenant, hit7Pct, hit30Pct, totalRequests }
function renderCacheHitRate(rows: AnyRow[], t: Thresholds) {
  if (rows.length === 0) {
    return "_No AI Tennis proposals found for this period._";
  }

  const normalized = rows.map((r) => {
    const tenant = safeStr(r.tenant ?? "—");
    const totalRequests = safeNum(r.totalRequests ?? r.total_requests ?? 0);
    const h7 = totalRequests > 0 ? safeNum(r.hit7Pct ?? r.hit_7_pct ?? r.cacheHit7Pct ?? r.pct7 ?? r.hit7) : null;
    const h30 = totalRequests > 0 ? safeNum(r.hit30Pct ?? r.hit_30_pct ?? r.cacheHit30Pct ?? r.pct30 ?? r.hit30) : null;
    // Don't flag if no data (N/A)
    const flag = h7 !== null ? flagFromRateGoodIsHigh(h7, t.cacheHitWarnPct, t.cacheHitCritPct) : ("—" as any);
    return { tenant, h7, h30, flag };
  });

  const table = mdTable(
    ["tenant", "7-day %", "30-day %", "Flag"],
    normalized.map((r) => [
      r.tenant,
      r.h7 !== null ? pct(r.h7) : "N/A",
      r.h30 !== null ? pct(r.h30) : "N/A",
      r.flag
    ])
  );
  const note = `**Interpretation:** low cache hit rate can indicate missing idempotency usage or too-short TTL.`;
  return `${table}\n\n${note}`;
}

// 6) Stale Takeover Rate rows: { tenant, rate7Pct, rate30Pct, totalRequests }
function renderStaleTakeoverRate(rows: AnyRow[], t: Thresholds) {
  if (rows.length === 0) {
    return "_No AI Tennis proposals found for this period._";
  }

  const normalized = rows.map((r) => {
    const tenant = safeStr(r.tenant ?? "—");
    const totalRequests = safeNum(r.totalRequests ?? r.total_requests ?? 0);
    const s7 = totalRequests > 0 ? safeNum(r.rate7Pct ?? r.rate_7_pct ?? r.stale7Pct ?? r.pct7 ?? r.rate7) : null;
    const s30 = totalRequests > 0 ? safeNum(r.rate30Pct ?? r.rate_30_pct ?? r.stale30Pct ?? r.pct30 ?? r.rate30) : null;
    const flag = s7 !== null ? flagFromRateBadIsHigh(s7, t.staleTakeoverWarnPct, t.staleTakeoverCritPct) : ("—" as any);
    return { tenant, s7, s30, flag };
  });

  const table = mdTable(
    ["tenant", "7-day %", "30-day %", "Flag"],
    normalized.map((r) => [
      r.tenant,
      r.s7 !== null ? pct(r.s7) : "N/A",
      r.s30 !== null ? pct(r.s30) : "N/A",
      r.flag
    ])
  );
  const note = `**Interpretation:** rising takeover rate suggests instability or stuck jobs.`;
  return `${table}\n\n${note}`;
}

function summarize(flags: { drift: Flag; human: Flag; efficiency: Flag; reliability: Flag; integrity: Flag }) {
  return mdTable(
    ["Metric", "Status"],
    [
      ["Drift Signals", flags.drift],
      ["Human Escalations", flags.human],
      ["Efficiency", flags.efficiency],
      ["Reliability", flags.reliability],
      ["Data Integrity", flags.integrity],
    ]
  );
}

function overallFlagFromSection(rows: AnyRow[], pick: (r: AnyRow) => Flag): Flag {
  // worst-of (🚨 > ⚠️ > ✅)
  let worst: Flag = "✅";
  for (const r of rows) {
    const f = pick(r);
    if (f === "🚨") return "🚨";
    if (f === "⚠️") worst = "⚠️";
  }
  return worst;
}

export function buildMarkdown(
  results: QueryResults,
  meta: SystemMeta,
  reportDateISO: string,
  envName: string,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): string {
  // Expect these keys (match whatever you used in canonicalQueries):
  // stopReasonDistribution, needsHumanRate, costPerApproval, approvalRate, cacheHitRate, staleTakeoverRate
  const stopReasonRows = extractRows(results.stopReasonDistribution);
  const needsHumanRows = extractRows(results.needsHumanRate);
  const costRows = extractRows(results.costPerApproval);
  const approvalRows = extractRows(results.approvalRate);
  const cacheRows = extractRows(results.cacheHitRate);
  const staleRows = extractRows(results.staleTakeoverRate);

  // Check if we have any real data
  const hasData = stopReasonRows.filter((r) => safeStr(r.stopReason ?? r.stop_reason ?? r.reason).trim().length > 0).length > 0;

  // Compute summary flags (worst-of)
  const stopReasonRendered = stopReasonRows.map((r) => {
    const stopReason = normalizeStopReason(safeStr(r.stopReason ?? r.stop_reason ?? r.reason));
    const pctVal = safeNum(r.pct ?? r.percent ?? r.ratePct);
    let flag: Flag = "✅";
    if (stopReason === "provider_failed") flag = flagFromRateBadIsHigh(pctVal, thresholds.providerFailedWarnPct, thresholds.providerFailedCritPct);
    if (stopReason === "ajv_failed") flag = flagFromRateBadIsHigh(pctVal, thresholds.ajvFailedWarnPct, thresholds.ajvFailedCritPct);
    if (stopReason === "router_failed") flag = flagFromRateBadIsHigh(pctVal, thresholds.providerFailedWarnPct, thresholds.providerFailedCritPct);
    if (stopReason === "json_parse_failed") flag = flagFromRateBadIsHigh(pctVal, thresholds.providerFailedWarnPct, thresholds.providerFailedCritPct);
    return { flag };
  });

  const driftFlag = overallFlagFromSection(stopReasonRendered, (r) => r.flag);

  const needsHumanRendered = needsHumanRows.map((r) => ({
    flag: flagFromRateBadIsHigh(safeNum(r.ratePct ?? r.rate_pct ?? r.needsHumanPct ?? r.pct), thresholds.needsHumanWarnPct, thresholds.needsHumanCritPct),
  }));
  const humanFlag = overallFlagFromSection(needsHumanRendered, (r) => r.flag);

  const efficiencyRendered = costRows.map((r) => ({
    flag: flagFromRateBadIsHigh(safeNum(r.wowDeltaPct ?? r.wow_delta_pct ?? r.wow), thresholds.costDeltaWarnPct, thresholds.costDeltaCritPct),
  }));
  const efficiencyFlag = overallFlagFromSection(efficiencyRendered, (r) => r.flag);

  const reliabilityRendered = staleRows.map((r) => ({
    flag: flagFromRateBadIsHigh(safeNum(r.rate7Pct ?? r.rate_7_pct ?? r.pct7 ?? r.rate7), thresholds.staleTakeoverWarnPct, thresholds.staleTakeoverCritPct),
  }));
  const reliabilityFlag = overallFlagFromSection(reliabilityRendered, (r) => r.flag);

  const integrityFlag: Flag = "✅"; // reserved: canary/leak checks can feed this later

  const noDataBanner = !hasData
    ? `\n> ⚠️ **No AI Tennis proposals found for this period.**  \n` +
      `> This report will populate once AI Tennis workflows create ActionRequests with \`rawInbound.source = 'ai_tennis'\`.\n\n`
    : "";

  const header =
    `# AI Tennis Weekly Metrics Report — ${reportDateISO}\n\n` +
    `**System:** LaunchBase  \n` +
    `**Version:** ${meta.version ?? "—"}  \n` +
    `**Build SHA:** ${meta.buildSha ?? "—"}  \n` +
    `**Generated:** ${new Date().toISOString()}  \n` +
    `**Environment:** ${envName}\n\n---\n` +
    noDataBanner;

  const body =
    section("1️⃣ StopReason Distribution (Drift Canary)", renderStopReasonDistribution(stopReasonRows, thresholds)) +
    section("2️⃣ needsHuman Rate (Protocol Mismatch Detector)", renderNeedsHumanRate(needsHumanRows, thresholds)) +
    section("3️⃣ Cost per Approval (Efficiency Index)", renderCostPerApproval(costRows, thresholds)) +
    section("4️⃣ Approval Rate (Business Friction Signal)", renderApprovalRate(approvalRows, thresholds)) +
    section("5️⃣ Cache Hit Rate (Idempotency Health)", renderCacheHitRate(cacheRows, thresholds)) +
    section("6️⃣ Stale Takeover Rate (Stability Detector)", renderStaleTakeoverRate(staleRows, thresholds)) +
    section(
      "📊 Summary",
      summarize({
        drift: driftFlag,
        human: humanFlag,
        efficiency: efficiencyFlag,
        reliability: reliabilityFlag,
        integrity: integrityFlag,
      })
    ) +
    `\n---\n` +
    `_Generated by \`scripts/generateWeeklyAiReport.ts\` (read-only). SQL source: \`docs/AI_METRICS_QUERIES.md\`._\n`;

  return header + "\n" + body;
}
