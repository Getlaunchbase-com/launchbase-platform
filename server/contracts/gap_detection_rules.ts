/**
 * Gap Detection Rules v1 — "What am I missing?" engine
 *
 * Deterministic rules that analyze a document's detections, mappings,
 * legend entries, and estimate output to surface potential gaps.
 *
 * Rules:
 *   G1 — Legend mentions types not mapped
 *   G2 — Detected classes unmapped
 *   G3 — Floor imbalance anomaly
 *   G4 — Head-end missing (basic)
 *   G5 — Low confidence cluster
 *   G6 — Duplicate symbol pack drift
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapFlag {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  evidence: Record<string, unknown>;
  recommended_action: string;
}

export interface GapDetectionInput {
  /** Legend entries for the document */
  legendEntries: Array<{
    id: number;
    rawLabel?: string | null;
    canonicalType?: string | null;
    symbolPackId?: number | null;
  }>;

  /** Raw detections for the document */
  detections: Array<{
    id: number;
    pageId: number;
    rawClass: string;
    confidence: number;
    canonicalType?: string | null;
    status: string;
  }>;

  /** Pages with labels/floor info */
  pages: Array<{
    id: number;
    pageNumber: number;
    label?: string | null;
  }>;

  /** Symbol pack mappings (rawClass → canonicalType) */
  symbolPackMappings: Array<{
    rawClass: string;
    canonicalType: string;
  }>;

  /** If multiple symbol packs have been used across runs for this project */
  allProjectSymbolPacks?: Array<{
    id: number;
    name: string;
    mappings: Array<{ rawClass: string; canonicalType: string }>;
  }>;

  /** Estimate output confidence data (if available) */
  estimateLineItems?: Array<{
    line_id: string;
    canonical_type: string;
    confidence: {
      detection: number;
      mapping: number;
      rules: number;
      overall: number;
      reasons: string[];
    };
  }>;
}

// ---------------------------------------------------------------------------
// Threshold constants
// ---------------------------------------------------------------------------

const UNMAPPED_HIGH_THRESHOLD = 10;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_RATIO_THRESHOLD = 0.2; // >20% low-confidence triggers flag

// Head-end types that should exist if downstream devices are present
const HEAD_END_TYPES = new Set([
  "IDF_RACK",
  "FACP_PANEL",
  "PATCH_PANEL",
]);

// Which device categories require which head-end types
const HEAD_END_REQUIREMENTS: Record<string, string[]> = {
  // Security cameras need a network rack or NVR
  CCTV_CAMERA: ["IDF_RACK"],
  CARD_READER: ["IDF_RACK"],
  // Fire devices need FACP
  SMOKE_DETECTOR: ["FACP_PANEL"],
  HORN_STROBE: ["FACP_PANEL"],
  PULL_STATION: ["FACP_PANEL"],
  // Data devices need IDF/patch
  CAT6_DROP: ["IDF_RACK", "PATCH_PANEL"],
  WAP: ["IDF_RACK"],
  FIBER_DROP: ["IDF_RACK"],
};

// ---------------------------------------------------------------------------
// Individual rule implementations
// ---------------------------------------------------------------------------

/**
 * G1: Legend mentions types not mapped
 * If legend entries have null canonicalType or rawLabel not in symbol pack.
 */
function ruleG1_legendUnmapped(input: GapDetectionInput): GapFlag | null {
  const packMap = new Set(input.symbolPackMappings.map((m) => m.rawClass));

  const unmappedLabels: string[] = [];
  for (const entry of input.legendEntries) {
    if (!entry.canonicalType) {
      unmappedLabels.push(entry.rawLabel ?? `entry_${entry.id}`);
    }
  }

  if (unmappedLabels.length === 0) return null;

  return {
    code: "LEGEND_HAS_UNMAPPED",
    severity: "high",
    message: "Legend shows device types that are not mapped.",
    evidence: {
      unmapped_raw_labels: unmappedLabels,
      count: unmappedLabels.length,
    },
    recommended_action: "Map remaining classes in Symbol Mapping UI.",
  };
}

/**
 * G2: Detected classes unmapped
 * If detections have rawClass with no mapping in symbol pack.
 */
function ruleG2_detectionsUnmapped(input: GapDetectionInput): GapFlag | null {
  const packMap = new Set(input.symbolPackMappings.map((m) => m.rawClass));

  const unmappedCounts = new Map<string, number>();
  for (const det of input.detections) {
    if (!det.canonicalType && !packMap.has(det.rawClass)) {
      unmappedCounts.set(det.rawClass, (unmappedCounts.get(det.rawClass) ?? 0) + 1);
    }
  }

  if (unmappedCounts.size === 0) return null;

  const totalUnmapped = Array.from(unmappedCounts.values()).reduce((s, c) => s + c, 0);

  return {
    code: "DETECTIONS_UNMAPPED",
    severity: totalUnmapped > UNMAPPED_HIGH_THRESHOLD ? "high" : "medium",
    message: `${unmappedCounts.size} raw class(es) with ${totalUnmapped} total detections have no symbol mapping.`,
    evidence: {
      unmapped_classes: Object.fromEntries(unmappedCounts),
      total_unmapped: totalUnmapped,
    },
    recommended_action: "Open Symbol Mapping and assign canonical types to unmapped classes.",
  };
}

/**
 * G3: Floor imbalance anomaly
 * For canonical types that appear on most pages/floors — if one floor is missing entirely, flag.
 */
function ruleG3_floorImbalance(input: GapDetectionInput): GapFlag | null {
  if (input.pages.length < 3) return null; // Not meaningful for < 3 pages

  // Build pageId → page map
  const pageMap = new Map(input.pages.map((p) => [p.id, p]));
  const allPageIds = new Set(input.pages.map((p) => p.id));

  // Group mapped detections by canonical type → set of pageIds
  const typePages = new Map<string, Set<number>>();
  for (const det of input.detections) {
    const ct = det.canonicalType;
    if (!ct) continue;
    const set = typePages.get(ct) ?? new Set();
    set.add(det.pageId);
    typePages.set(ct, set);
  }

  const anomalies: Array<{ canonical_type: string; present_on: number[]; missing_on: number[]; total_pages: number }> = [];

  for (const [ct, presentPages] of typePages) {
    // Only flag if type is present on majority of pages (> 50%)
    if (presentPages.size < input.pages.length * 0.5) continue;

    const missingPageIds = [...allPageIds].filter((pid) => !presentPages.has(pid));
    if (missingPageIds.length > 0 && missingPageIds.length <= 2) {
      // Only flag if 1-2 pages are missing (not a systematic absence)
      anomalies.push({
        canonical_type: ct,
        present_on: [...presentPages].map((pid) => pageMap.get(pid)?.pageNumber ?? pid),
        missing_on: missingPageIds.map((pid) => pageMap.get(pid)?.pageNumber ?? pid),
        total_pages: input.pages.length,
      });
    }
  }

  if (anomalies.length === 0) return null;

  return {
    code: "FLOOR_IMBALANCE",
    severity: "medium",
    message: `${anomalies.length} device type(s) appear on most pages but are missing from some. Possible omission.`,
    evidence: { anomalies },
    recommended_action: "Review the missing pages to verify if devices should be present.",
  };
}

/**
 * G4: Head-end missing (basic)
 * If downstream devices exist but corresponding head-end equipment is not mapped.
 */
function ruleG4_headEndMissing(input: GapDetectionInput): GapFlag | null {
  // Collect all canonical types present in detections
  const presentTypes = new Set<string>();
  for (const det of input.detections) {
    if (det.canonicalType) presentTypes.add(det.canonicalType);
  }

  const missingHeadEnds: Array<{ device_type: string; requires: string; count: number }> = [];

  for (const [deviceType, requiredHeadEnds] of Object.entries(HEAD_END_REQUIREMENTS)) {
    if (!presentTypes.has(deviceType)) continue;

    const deviceCount = input.detections.filter((d) => d.canonicalType === deviceType).length;

    for (const headEnd of requiredHeadEnds) {
      if (!presentTypes.has(headEnd)) {
        missingHeadEnds.push({
          device_type: deviceType,
          requires: headEnd,
          count: deviceCount,
        });
      }
    }
  }

  if (missingHeadEnds.length === 0) return null;

  return {
    code: "HEAD_END_MISSING",
    severity: "medium",
    message: `Downstream devices detected but corresponding head-end equipment not found.`,
    evidence: { missing: missingHeadEnds },
    recommended_action: "Verify that head-end equipment (IDF racks, FACP panels) are present on the blueprints.",
  };
}

/**
 * G5: Low confidence cluster
 * If >X% of a canonical type has overall confidence < threshold.
 */
function ruleG5_lowConfidenceCluster(input: GapDetectionInput): GapFlag | null {
  if (!input.estimateLineItems || input.estimateLineItems.length === 0) return null;

  // Group by canonical type
  const byType = new Map<string, { total: number; low: number }>();
  for (const li of input.estimateLineItems) {
    const entry = byType.get(li.canonical_type) ?? { total: 0, low: 0 };
    entry.total++;
    if (li.confidence.overall < LOW_CONFIDENCE_THRESHOLD) entry.low++;
    byType.set(li.canonical_type, entry);
  }

  const clusters: Array<{ canonical_type: string; total: number; low_count: number; low_pct: number }> = [];
  for (const [ct, data] of byType) {
    const ratio = data.low / data.total;
    if (ratio > LOW_CONFIDENCE_RATIO_THRESHOLD && data.low >= 3) {
      clusters.push({
        canonical_type: ct,
        total: data.total,
        low_count: data.low,
        low_pct: parseFloat((ratio * 100).toFixed(1)),
      });
    }
  }

  if (clusters.length === 0) return null;

  return {
    code: "LOW_CONFIDENCE_CLUSTER",
    severity: "high",
    message: `${clusters.length} device type(s) have high ratio of low-confidence detections.`,
    evidence: { clusters },
    recommended_action: "Review overlay and adjust mapping or retrain model.",
  };
}

/**
 * G6: Duplicate symbol pack drift
 * If a project has multiple symbol packs used across runs, and mappings differ for same rawClass.
 */
function ruleG6_symbolPackDrift(input: GapDetectionInput): GapFlag | null {
  if (!input.allProjectSymbolPacks || input.allProjectSymbolPacks.length < 2) return null;

  // Build rawClass → set of canonical types across all packs
  const classMappings = new Map<string, Map<string, string[]>>();
  for (const pack of input.allProjectSymbolPacks) {
    for (const m of pack.mappings) {
      const entry = classMappings.get(m.rawClass) ?? new Map();
      const packs = entry.get(m.canonicalType) ?? [];
      packs.push(pack.name);
      entry.set(m.canonicalType, packs);
      classMappings.set(m.rawClass, entry);
    }
  }

  const drifts: Array<{ raw_class: string; conflicting_mappings: Record<string, string[]> }> = [];
  for (const [rawClass, mappingMap] of classMappings) {
    if (mappingMap.size > 1) {
      drifts.push({
        raw_class: rawClass,
        conflicting_mappings: Object.fromEntries(mappingMap),
      });
    }
  }

  if (drifts.length === 0) return null;

  return {
    code: "SYMBOL_PACK_DRIFT",
    severity: "high",
    message: `${drifts.length} raw class(es) have conflicting mappings across symbol packs.`,
    evidence: { drifts, pack_count: input.allProjectSymbolPacks.length },
    recommended_action: "Apply a single default symbol pack; migrate conflicting mappings.",
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run all gap detection rules and return flags.
 */
export function runGapDetection(input: GapDetectionInput): GapFlag[] {
  const flags: GapFlag[] = [];

  const rules = [
    ruleG1_legendUnmapped,
    ruleG2_detectionsUnmapped,
    ruleG3_floorImbalance,
    ruleG4_headEndMissing,
    ruleG5_lowConfidenceCluster,
    ruleG6_symbolPackDrift,
  ];

  for (const rule of rules) {
    try {
      const flag = rule(input);
      if (flag) flags.push(flag);
    } catch (err) {
      // Never let a single rule crash the whole engine
      flags.push({
        code: "RULE_ERROR",
        severity: "low",
        message: `Gap detection rule failed: ${(err as Error).message}`,
        evidence: { rule: rule.name },
        recommended_action: "Report this error to the platform team.",
      });
    }
  }

  return flags;
}
