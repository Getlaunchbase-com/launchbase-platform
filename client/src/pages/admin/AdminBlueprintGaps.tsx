/**
 * AdminBlueprintGaps — Gap Detection UI
 *
 * Displays gap analysis results for a blueprint document.
 * Shows severity-coded gap flags with evidence details and recommended actions.
 * Wired to real tRPC endpoints: admin.gapDetection.analyze (mutation)
 * and admin.gapDetection.quickCheck (query).
 */

import React, { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import trpc from "../../lib/trpc";

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
  statusBadge: (status: string) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color:
      status === "pass" ? "#86efac" : status === "fail" ? "#fca5a5" : "#fcd34d",
    backgroundColor:
      status === "pass" ? "#14532d" : status === "fail" ? "#7f1d1d" : "#78350f",
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
  buttonDisabled: {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "1px solid #52525b",
    backgroundColor: "#3f3f46",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "not-allowed",
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
  input: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #3f3f46",
    backgroundColor: "#27272a",
    color: "#e4e4e7",
    fontSize: "13px",
    width: "120px",
  } as React.CSSProperties,
  inputRow: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    alignItems: "center",
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid #27272a",
    backgroundColor: "#18181b",
  } as React.CSSProperties,
  inputLabel: {
    fontSize: "13px",
    color: "#a1a1aa",
    fontWeight: 500,
  } as React.CSSProperties,
  emptyState: {
    textAlign: "center" as const,
    padding: "64px 24px",
    color: "#71717a",
  } as React.CSSProperties,
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid #52525b",
    borderTopColor: "#f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,
  errorBox: {
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid #7f1d1d",
    backgroundColor: "#1c0a0a",
    color: "#fca5a5",
    fontSize: "14px",
    marginBottom: "20px",
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminBlueprintGaps() {
  // Input state
  const [documentId, setDocumentId] = useState<string>("");
  const [symbolPackId, setSymbolPackId] = useState<string>("");
  const [estimateRunId, setEstimateRunId] = useState<string>("");

  // UI state
  const [result, setResult] = useState<GapResult | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set());

  // tRPC mutation
  const analyzeMutation = trpc.admin.gapDetection.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data as GapResult);
      // Expand all flags by default
      const allIndices = new Set(
        (data.gap_flags as GapFlag[]).map((_: GapFlag, i: number) => i)
      );
      setExpandedFlags(allIndices);
    },
  });

  const handleRunAnalysis = () => {
    const docId = parseInt(documentId, 10);
    const packId = parseInt(symbolPackId, 10);
    if (isNaN(docId) || docId <= 0) return;
    if (isNaN(packId) || packId <= 0) return;

    const input: { documentId: number; symbolPackId: number; estimateRunId?: number } = {
      documentId: docId,
      symbolPackId: packId,
    };

    const estId = parseInt(estimateRunId, 10);
    if (!isNaN(estId) && estId > 0) {
      input.estimateRunId = estId;
    }

    analyzeMutation.mutate(input);
  };

  const filtered = result
    ? filterSeverity === "all"
      ? result.gap_flags
      : result.gap_flags.filter((f) => f.severity === filterSeverity)
    : [];

  const toggleExpand = (idx: number) => {
    setExpandedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const isFormValid =
    !isNaN(parseInt(documentId, 10)) &&
    parseInt(documentId, 10) > 0 &&
    !isNaN(parseInt(symbolPackId, 10)) &&
    parseInt(symbolPackId, 10) > 0;

  return (
    <AdminLayout>
      <div style={styles.container}>
        {/* Spinner keyframe — injected once */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
            <button
              style={isFormValid && !analyzeMutation.isPending ? styles.button : styles.buttonDisabled}
              disabled={!isFormValid || analyzeMutation.isPending}
              onClick={handleRunAnalysis}
            >
              {analyzeMutation.isPending ? "Analyzing..." : result ? "Re-analyze" : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* Document ID / Symbol Pack ID input row */}
        <div style={styles.inputRow}>
          <label style={styles.inputLabel}>Document ID</label>
          <input
            style={styles.input}
            type="number"
            min={1}
            placeholder="e.g. 1"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isFormValid) handleRunAnalysis();
            }}
          />
          <label style={styles.inputLabel}>Symbol Pack ID</label>
          <input
            style={styles.input}
            type="number"
            min={1}
            placeholder="e.g. 1"
            value={symbolPackId}
            onChange={(e) => setSymbolPackId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isFormValid) handleRunAnalysis();
            }}
          />
          <label style={styles.inputLabel}>Estimate Run ID (optional)</label>
          <input
            style={{ ...styles.input, width: "140px" }}
            type="number"
            min={1}
            placeholder="optional"
            value={estimateRunId}
            onChange={(e) => setEstimateRunId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isFormValid) handleRunAnalysis();
            }}
          />
        </div>

        {/* Error state */}
        {analyzeMutation.isError && (
          <div style={styles.errorBox}>
            Analysis failed:{" "}
            {analyzeMutation.error?.message || "Unknown error occurred. Please check the document ID and try again."}
          </div>
        )}

        {/* Loading state */}
        {analyzeMutation.isPending && (
          <div style={styles.emptyState}>
            <div style={{ marginBottom: "16px" }}>
              <div style={styles.spinner} />
            </div>
            <div style={{ fontSize: "16px", color: "#a1a1aa" }}>
              Running gap analysis on document {documentId}...
            </div>
            <div style={{ fontSize: "13px", color: "#52525b", marginTop: "8px" }}>
              Checking rules G1 through G6
            </div>
          </div>
        )}

        {/* Empty state — before first analysis */}
        {!result && !analyzeMutation.isPending && !analyzeMutation.isError && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>
              ?
            </div>
            <div style={{ fontSize: "16px", color: "#a1a1aa", marginBottom: "8px" }}>
              No analysis results yet
            </div>
            <div style={{ fontSize: "13px", color: "#52525b" }}>
              Enter a Document ID and Symbol Pack ID above, then click <strong style={{ color: "#f97316" }}>Run Analysis</strong> to
              detect gaps in blueprint data.
            </div>
          </div>
        )}

        {/* Results */}
        {result && !analyzeMutation.isPending && (
          <>
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
                        {isExpanded ? "\u25BC" : "\u25B6"}
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
          </>
        )}
      </div>
    </AdminLayout>
  );
}
