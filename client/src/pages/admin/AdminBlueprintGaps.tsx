/**
 * AdminBlueprintGaps — Gap Detection UI
 *
 * Displays gap analysis results for a blueprint document.
 * Shows severity-coded gap flags with evidence details and recommended actions.
 */

import React, { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GapFlag {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  evidence: Record<string, unknown>;
  recommended_action: string;
}

interface GapSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface GapResult {
  documentId: number;
  symbolPackId: number;
  estimateRunId: number | null;
  analyzedAt: string;
  gap_flags: GapFlag[];
  summary: GapSummary;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_GAP_RESULT: GapResult = {
  documentId: 1,
  symbolPackId: 1,
  estimateRunId: 1,
  analyzedAt: new Date().toISOString(),
  gap_flags: [
    {
      code: "LEGEND_HAS_UNMAPPED",
      severity: "high",
      message: "Legend shows device types that are not mapped.",
      evidence: { unmapped_raw_labels: ["sym_7", "sym_12"], count: 2 },
      recommended_action: "Map remaining classes in Symbol Mapping UI.",
    },
    {
      code: "DETECTIONS_UNMAPPED",
      severity: "medium",
      message: "3 raw class(es) with 8 total detections have no symbol mapping.",
      evidence: {
        unmapped_classes: { mystery_symbol_7: 4, unknown_device_3: 3, sym_99: 1 },
        total_unmapped: 8,
      },
      recommended_action: "Open Symbol Mapping and assign canonical types to unmapped classes.",
    },
    {
      code: "HEAD_END_MISSING",
      severity: "medium",
      message: "Downstream devices detected but corresponding head-end equipment not found.",
      evidence: {
        missing: [
          { device_type: "CCTV_CAMERA", requires: "IDF_RACK", count: 12 },
          { device_type: "SMOKE_DETECTOR", requires: "FACP_PANEL", count: 24 },
        ],
      },
      recommended_action: "Verify that head-end equipment (IDF racks, FACP panels) are present on the blueprints.",
    },
    {
      code: "LOW_CONFIDENCE_CLUSTER",
      severity: "high",
      message: "1 device type(s) have high ratio of low-confidence detections.",
      evidence: {
        clusters: [
          { canonical_type: "CARD_READER", total: 8, low_count: 5, low_pct: 62.5 },
        ],
      },
      recommended_action: "Review overlay and adjust mapping or retrain model.",
    },
  ],
  summary: { total: 4, high: 2, medium: 2, low: 0 },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#e4e4e7",
    backgroundColor: "#09090b",
    minHeight: "100vh",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  } as React.CSSProperties,
  title: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#fafafa",
  } as React.CSSProperties,
  subtitle: {
    fontSize: "14px",
    color: "#a1a1aa",
    marginTop: "4px",
  } as React.CSSProperties,
  summaryBar: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
  } as React.CSSProperties,
  summaryCard: (severity: string) => ({
    flex: 1,
    padding: "16px",
    borderRadius: "8px",
    border: `1px solid ${severity === "high" ? "#7f1d1d" : severity === "medium" ? "#78350f" : "#1e3a5f"}`,
    backgroundColor: severity === "high" ? "#1c0a0a" : severity === "medium" ? "#1a1005" : "#0a1628",
    textAlign: "center" as const,
  }),
  summaryCount: (severity: string) => ({
    fontSize: "32px",
    fontWeight: 700,
    color: severity === "high" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#3b82f6",
  }),
  summaryLabel: {
    fontSize: "12px",
    color: "#a1a1aa",
    textTransform: "uppercase" as const,
    marginTop: "4px",
  } as React.CSSProperties,
  flagCard: {
    padding: "20px",
    marginBottom: "12px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#18181b",
  } as React.CSSProperties,
  flagHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  } as React.CSSProperties,
  severityBadge: (severity: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: severity === "high" ? "#fca5a5" : severity === "medium" ? "#fcd34d" : "#93c5fd",
    backgroundColor: severity === "high" ? "#7f1d1d" : severity === "medium" ? "#78350f" : "#1e3a5f",
  }),
  flagCode: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#d4d4d8",
    fontFamily: "monospace",
  } as React.CSSProperties,
  flagMessage: {
    fontSize: "14px",
    color: "#e4e4e7",
    marginBottom: "12px",
  } as React.CSSProperties,
  evidenceBlock: {
    padding: "12px",
    borderRadius: "6px",
    backgroundColor: "#09090b",
    border: "1px solid #27272a",
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#a1a1aa",
    whiteSpace: "pre-wrap" as const,
    marginBottom: "12px",
    maxHeight: "200px",
    overflowY: "auto" as const,
  } as React.CSSProperties,
  actionBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "6px",
    backgroundColor: "#1a1a2e",
    border: "1px solid #312e81",
  } as React.CSSProperties,
  actionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#818cf8",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  actionText: {
    fontSize: "13px",
    color: "#c7d2fe",
  } as React.CSSProperties,
  controlBar: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    alignItems: "center",
  } as React.CSSProperties,
  select: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #3f3f46",
    backgroundColor: "#27272a",
    color: "#e4e4e7",
    fontSize: "13px",
  } as React.CSSProperties,
  button: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #f97316",
    backgroundColor: "#f97316",
    color: "#000",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
  buttonSecondary: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #3f3f46",
    backgroundColor: "#27272a",
    color: "#e4e4e7",
    fontSize: "13px",
    cursor: "pointer",
  } as React.CSSProperties,
  noGaps: {
    textAlign: "center" as const,
    padding: "48px",
    color: "#22c55e",
    fontSize: "18px",
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminBlueprintGaps() {
  const [result, setResult] = useState<GapResult>(MOCK_GAP_RESULT);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set([0, 1, 2, 3]));

  const filtered = filterSeverity === "all"
    ? result.gap_flags
    : result.gap_flags.filter((f) => f.severity === filterSeverity);

  const toggleExpand = (idx: number) => {
    setExpandedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Gap Detection</div>
          <div style={styles.subtitle}>
            Analyze blueprint for missing mappings, head-end equipment, and confidence issues
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={styles.buttonSecondary} onClick={() => window.history.back()}>
            Back
          </button>
          <button style={styles.button}>
            Re-analyze
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryCard("high")}>
          <div style={styles.summaryCount("high")}>{result.summary.high}</div>
          <div style={styles.summaryLabel}>High Severity</div>
        </div>
        <div style={styles.summaryCard("medium")}>
          <div style={styles.summaryCount("medium")}>{result.summary.medium}</div>
          <div style={styles.summaryLabel}>Medium Severity</div>
        </div>
        <div style={styles.summaryCard("low")}>
          <div style={styles.summaryCount("low")}>{result.summary.low}</div>
          <div style={styles.summaryLabel}>Low Severity</div>
        </div>
        <div style={{ ...styles.summaryCard(""), border: "1px solid #27272a", backgroundColor: "#18181b" }}>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#e4e4e7" }}>{result.summary.total}</div>
          <div style={styles.summaryLabel}>Total Gaps</div>
        </div>
      </div>

      {/* Control bar */}
      <div style={styles.controlBar}>
        <span style={{ fontSize: "13px", color: "#a1a1aa" }}>Filter:</span>
        <select
          style={styles.select}
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
        >
          <option value="all">All severities</option>
          <option value="high">High only</option>
          <option value="medium">Medium only</option>
          <option value="low">Low only</option>
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: "12px", color: "#71717a" }}>
          Analyzed: {new Date(result.analyzedAt).toLocaleString()}
        </span>
      </div>

      {/* Gap flags */}
      {filtered.length === 0 ? (
        <div style={styles.noGaps}>
          No gaps detected. Blueprint analysis looks complete.
        </div>
      ) : (
        filtered.map((flag, idx) => {
          const globalIdx = result.gap_flags.indexOf(flag);
          const isExpanded = expandedFlags.has(globalIdx);

          return (
            <div key={globalIdx} style={styles.flagCard}>
              <div
                style={{ ...styles.flagHeader, cursor: "pointer" }}
                onClick={() => toggleExpand(globalIdx)}
              >
                <span style={styles.severityBadge(flag.severity)}>{flag.severity}</span>
                <span style={styles.flagCode}>{flag.code}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: "#71717a", fontSize: "12px" }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
              </div>

              <div style={styles.flagMessage}>{flag.message}</div>

              {isExpanded && (
                <>
                  <div style={styles.evidenceBlock}>
                    {JSON.stringify(flag.evidence, null, 2)}
                  </div>

                  <div style={styles.actionBox}>
                    <span style={styles.actionLabel}>Action</span>
                    <span style={styles.actionText}>{flag.recommended_action}</span>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
