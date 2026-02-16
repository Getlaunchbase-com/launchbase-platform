import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Detection {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rawClass: string;
  confidence: number;
  canonicalType?: string | null;
  status: "raw" | "mapped" | "verified" | "rejected";
}

interface TextBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  blockType: string;
  confidence?: number;
}

interface Page {
  id: number;
  pageNumber: number;
  label?: string;
  imageWidth?: number;
  imageHeight?: number;
  detectionCount: number;
}

interface ContractInfo {
  contractName: string;
  contractVersion: string;
  schemaHash: string;
  producer: {
    tool: string;
    tool_version: string;
    runtime: string;
    model_version: string | null;
  };
  parsedAt: string;
}

interface VertexFreezeInfo {
  vertex: string;
  version: string;
  status: "frozen" | "deprecated" | "superseded";
  frozenAt: string;
  contracts: string[];
}

type OverlayMode = "detections" | "text" | "both" | "none";

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const CLASS_COLORS: Record<string, string> = {
  smoke_detector: "#ef4444",
  outlet_120v: "#3b82f6",
  outlet_240v: "#8b5cf6",
  switch: "#f59e0b",
  light_fixture: "#10b981",
  junction_box: "#06b6d4",
  panel: "#ec4899",
  thermostat: "#f97316",
  sprinkler: "#14b8a6",
  fire_alarm: "#dc2626",
};

const STATUS_COLORS: Record<string, string> = {
  raw: "#f59e0b",
  mapped: "#3b82f6",
  verified: "#10b981",
  rejected: "#ef4444",
};

function getClassColor(rawClass: string): string {
  return CLASS_COLORS[rawClass] ?? `hsl(${Math.abs(hashCode(rawClass)) % 360}, 70%, 60%)`;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Mock data for development
// ---------------------------------------------------------------------------

const MOCK_PAGES: Page[] = [
  { id: 1, pageNumber: 1, label: "Sheet E-101 — First Floor Electrical", imageWidth: 3400, imageHeight: 2200, detectionCount: 24 },
  { id: 2, pageNumber: 2, label: "Sheet E-102 — Second Floor Electrical", imageWidth: 3400, imageHeight: 2200, detectionCount: 18 },
  { id: 3, pageNumber: 3, label: "Sheet E-103 — Legend & Schedules", imageWidth: 3400, imageHeight: 2200, detectionCount: 0 },
];

const MOCK_DETECTIONS: Detection[] = [
  { id: 1, x: 0.12, y: 0.25, w: 0.03, h: 0.04, rawClass: "smoke_detector", confidence: 0.94, status: "raw" },
  { id: 2, x: 0.35, y: 0.40, w: 0.025, h: 0.035, rawClass: "outlet_120v", confidence: 0.89, status: "mapped", canonicalType: "Duplex Receptacle 120V" },
  { id: 3, x: 0.55, y: 0.18, w: 0.02, h: 0.03, rawClass: "switch", confidence: 0.92, status: "raw" },
  { id: 4, x: 0.22, y: 0.60, w: 0.04, h: 0.05, rawClass: "light_fixture", confidence: 0.87, status: "raw" },
  { id: 5, x: 0.72, y: 0.35, w: 0.03, h: 0.04, rawClass: "junction_box", confidence: 0.78, status: "raw" },
  { id: 6, x: 0.45, y: 0.70, w: 0.025, h: 0.035, rawClass: "outlet_120v", confidence: 0.91, status: "mapped", canonicalType: "Duplex Receptacle 120V" },
  { id: 7, x: 0.85, y: 0.55, w: 0.03, h: 0.04, rawClass: "smoke_detector", confidence: 0.96, status: "raw" },
  { id: 8, x: 0.60, y: 0.45, w: 0.035, h: 0.045, rawClass: "panel", confidence: 0.82, status: "raw" },
];

const MOCK_TEXT_BLOCKS: TextBlock[] = [
  { id: 1, x: 0.02, y: 0.02, w: 0.25, h: 0.04, text: "SHEET E-101 — FIRST FLOOR ELECTRICAL PLAN", blockType: "title", confidence: 0.99 },
  { id: 2, x: 0.15, y: 0.28, w: 0.08, h: 0.02, text: "20A/120V", blockType: "label", confidence: 0.95 },
  { id: 3, x: 0.50, y: 0.15, w: 0.06, h: 0.02, text: "3-WAY", blockType: "label", confidence: 0.93 },
];

const MOCK_CONTRACT_INFO: ContractInfo = {
  contractName: "BlueprintParseV1",
  contractVersion: "1.0.0",
  schemaHash: "a3f2c8d1e9b4567890abcdef12345678abcdef9876543210fedcba0987654321",
  producer: {
    tool: "blueprint_parse_document",
    tool_version: "0.4.2",
    runtime: "agent-stack",
    model_version: null,
  },
  parsedAt: new Date(Date.now() - 3600000).toISOString(),
};

const MOCK_FREEZE_INFO: VertexFreezeInfo = {
  vertex: "IBEW_LV",
  version: "1.0.0",
  status: "frozen",
  frozenAt: "2026-02-15",
  contracts: ["BlueprintParseV1", "EstimateChainV1"],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetectionBox({
  det,
  selected,
  onClick,
}: {
  det: Detection;
  selected: boolean;
  onClick: () => void;
}) {
  const color = getClassColor(det.rawClass);
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: `${det.x * 100}%`,
        top: `${det.y * 100}%`,
        width: `${det.w * 100}%`,
        height: `${det.h * 100}%`,
        border: `2px solid ${color}`,
        background: selected ? `${color}44` : `${color}22`,
        cursor: "pointer",
        zIndex: selected ? 10 : 1,
        borderRadius: 2,
        transition: "background 0.15s",
      }}
      title={`${det.rawClass} (${(det.confidence * 100).toFixed(0)}%)`}
    >
      <span
        style={{
          position: "absolute",
          top: -18,
          left: 0,
          fontSize: 10,
          background: color,
          color: "#fff",
          padding: "1px 5px",
          borderRadius: 3,
          whiteSpace: "nowrap",
          fontWeight: 600,
        }}
      >
        {det.canonicalType ?? det.rawClass}
      </span>
    </div>
  );
}

function TextOverlay({ block }: { block: TextBlock }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${block.x * 100}%`,
        top: `${block.y * 100}%`,
        width: `${block.w * 100}%`,
        height: `${block.h * 100}%`,
        border: "1px dashed #f59e0b88",
        background: "#f59e0b11",
        fontSize: 9,
        color: "#f59e0b",
        overflow: "hidden",
        padding: 1,
        pointerEvents: "none",
      }}
      title={block.text}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminBlueprintViewer() {
  const [currentPage, setCurrentPage] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("detections");
  const [selectedDetection, setSelectedDetection] = useState<number | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [showContractInfo, setShowContractInfo] = useState(false);

  const page = MOCK_PAGES[currentPage];
  const filteredDetections = MOCK_DETECTIONS.filter((d) => d.confidence >= minConfidence);

  const detectionsByClass = new Map<string, number>();
  for (const d of MOCK_DETECTIONS) {
    detectionsByClass.set(d.rawClass, (detectionsByClass.get(d.rawClass) ?? 0) + 1);
  }

  const selectedDet = selectedDetection !== null
    ? MOCK_DETECTIONS.find((d) => d.id === selectedDetection)
    : null;

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px 0" }}>
          Blueprint Viewer
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 20px 0" }}>
          View blueprint pages with detection overlays. Click detections to inspect.
        </p>

        <div style={{ display: "flex", gap: 16 }}>
          {/* ============================================================ */}
          {/* Left: Page viewer with overlays                              */}
          {/* ============================================================ */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px 12px 0 0",
                padding: "8px 16px",
              }}
            >
              {/* Page selector */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{
                    background: currentPage === 0 ? "#27272a" : "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: 13,
                    cursor: currentPage === 0 ? "default" : "pointer",
                    opacity: currentPage === 0 ? 0.5 : 1,
                  }}
                >
                  Prev
                </button>
                <span style={{ fontSize: 13, color: "#a1a1aa" }}>
                  Page {page.pageNumber} / {MOCK_PAGES.length}
                </span>
                <button
                  disabled={currentPage === MOCK_PAGES.length - 1}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{
                    background: currentPage === MOCK_PAGES.length - 1 ? "#27272a" : "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: 13,
                    cursor: currentPage === MOCK_PAGES.length - 1 ? "default" : "pointer",
                    opacity: currentPage === MOCK_PAGES.length - 1 ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>

              {/* Overlay mode */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ fontSize: 12, color: "#888" }}>Overlay:</label>
                {(["detections", "text", "both", "none"] as OverlayMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setOverlayMode(mode)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: overlayMode === mode ? "1px solid #3b82f6" : "1px solid #27272a",
                      background: overlayMode === mode ? "#3b82f622" : "transparent",
                      color: overlayMode === mode ? "#3b82f6" : "#888",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Confidence filter */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ fontSize: 12, color: "#888" }}>Min conf:</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minConfidence * 100}
                  onChange={(e) => setMinConfidence(Number(e.target.value) / 100)}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 12, color: "#a1a1aa", width: 36 }}>
                  {(minConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Page image + overlay canvas */}
            <div
              style={{
                position: "relative",
                background: "#0a0a0a",
                border: "1px solid #27272a",
                borderTop: "none",
                borderRadius: "0 0 12px 12px",
                aspectRatio: page.imageWidth && page.imageHeight
                  ? `${page.imageWidth} / ${page.imageHeight}`
                  : "17 / 11",
                overflow: "hidden",
              }}
            >
              {/* Blueprint grid background (placeholder for real image) */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(#1a1a2e11 1px, transparent 1px), linear-gradient(90deg, #1a1a2e11 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "#333",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {page.label ?? `Page ${page.pageNumber}`}
                <br />
                <span style={{ fontSize: 11, color: "#555" }}>
                  {page.imageWidth}&times;{page.imageHeight}px &middot; {page.detectionCount} detections
                </span>
              </div>

              {/* Detection overlays */}
              {(overlayMode === "detections" || overlayMode === "both") &&
                filteredDetections.map((det) => (
                  <DetectionBox
                    key={det.id}
                    det={det}
                    selected={selectedDetection === det.id}
                    onClick={() =>
                      setSelectedDetection(selectedDetection === det.id ? null : det.id)
                    }
                  />
                ))}

              {/* Text overlays */}
              {(overlayMode === "text" || overlayMode === "both") &&
                MOCK_TEXT_BLOCKS.map((block) => <TextOverlay key={block.id} block={block} />)}
            </div>

            {/* Page label */}
            <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
              {page.label}
            </div>
          </div>

          {/* ============================================================ */}
          {/* Right: Detection sidebar                                     */}
          {/* ============================================================ */}
          <div style={{ width: 320, flexShrink: 0 }}>
            {/* Detection summary */}
            <div
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", margin: "0 0 12px 0" }}>
                Detections Summary
              </h3>
              <div style={{ fontSize: 13 }}>
                {Array.from(detectionsByClass.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([cls, cnt]) => (
                    <div
                      key={cls}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom: "1px solid #27272a",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: getClassColor(cls),
                          }}
                        />
                        <span style={{ color: "#a1a1aa" }}>{cls.replace(/_/g, " ")}</span>
                      </div>
                      <span style={{ color: "#fff", fontWeight: 600 }}>{cnt}</span>
                    </div>
                  ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0 0 0",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  <span>Total</span>
                  <span>{MOCK_DETECTIONS.length}</span>
                </div>
              </div>
            </div>

            {/* Selected detection detail */}
            {selectedDet && (
              <div
                style={{
                  background: "#18181b",
                  border: `1px solid ${getClassColor(selectedDet.rawClass)}44`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", margin: "0 0 8px 0" }}>
                  Detection #{selectedDet.id}
                </h3>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <tbody>
                    {[
                      ["Class", selectedDet.rawClass.replace(/_/g, " ")],
                      ["Canonical", selectedDet.canonicalType ?? "—"],
                      ["Confidence", `${(selectedDet.confidence * 100).toFixed(1)}%`],
                      ["Status", selectedDet.status],
                      ["Position", `(${selectedDet.x.toFixed(3)}, ${selectedDet.y.toFixed(3)})`],
                      ["Size", `${selectedDet.w.toFixed(3)} x ${selectedDet.h.toFixed(3)}`],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ color: "#888", padding: "3px 8px 3px 0" }}>{label}</td>
                        <td style={{ color: "#e4e4e7", fontWeight: 500 }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  <button
                    style={{
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Verify
                  </button>
                  <button
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Page list */}
            <div
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7", margin: "0 0 8px 0" }}>
                Pages
              </h3>
              {MOCK_PAGES.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => setCurrentPage(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: "pointer",
                    background: currentPage === idx ? "#3b82f622" : "transparent",
                    border: currentPage === idx ? "1px solid #3b82f644" : "1px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 13, color: currentPage === idx ? "#3b82f6" : "#a1a1aa", fontWeight: currentPage === idx ? 600 : 400 }}>
                    Page {p.pageNumber}
                  </div>
                  <div style={{ fontSize: 11, color: "#666" }}>
                    {p.label} &middot; {p.detectionCount} detections
                  </div>
                </div>
              ))}
            </div>

            {/* Contract info toggle + panel */}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={() => setShowContractInfo(!showContractInfo)}
                style={{
                  width: "100%",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: showContractInfo ? "12px 12px 0 0" : 12,
                  padding: "10px 16px",
                  color: "#a1a1aa",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Contract Info</span>
                <span style={{ fontSize: 11, color: "#555" }}>
                  {showContractInfo ? "\u25B2" : "\u25BC"}
                </span>
              </button>
              {showContractInfo && (
                <div
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderTop: "none",
                    borderRadius: "0 0 12px 12px",
                    padding: 16,
                  }}
                >
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      {[
                        ["Contract", `${MOCK_CONTRACT_INFO.contractName} ${MOCK_CONTRACT_INFO.contractVersion}`],
                        ["Schema Hash", MOCK_CONTRACT_INFO.schemaHash.slice(0, 16) + "..."],
                        ["Parse Tool", MOCK_CONTRACT_INFO.producer.tool],
                        ["Tool Version", MOCK_CONTRACT_INFO.producer.tool_version],
                        ["Runtime", MOCK_CONTRACT_INFO.producer.runtime],
                        ["Model Version", MOCK_CONTRACT_INFO.producer.model_version ?? "N/A (algorithmic)"],
                        ["Parsed At", new Date(MOCK_CONTRACT_INFO.parsedAt).toLocaleString()],
                      ].map(([label, value]) => (
                        <tr key={label} style={{ borderBottom: "1px solid #27272a22" }}>
                          <td style={{ color: "#888", padding: "4px 8px 4px 0", whiteSpace: "nowrap" }}>
                            {label}
                          </td>
                          <td
                            style={{
                              color: "#e4e4e7",
                              fontWeight: 500,
                              padding: "4px 0",
                              fontFamily: label === "Schema Hash" ? "monospace" : "inherit",
                              fontSize: label === "Schema Hash" ? 11 : 12,
                              wordBreak: "break-all",
                            }}
                            title={label === "Schema Hash" ? MOCK_CONTRACT_INFO.schemaHash : undefined}
                          >
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      background: "#10b98111",
                      border: "1px solid #10b98133",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "#10b981",
                      fontWeight: 600,
                    }}
                  >
                    Contract validated
                  </div>
                </div>
              )}
            </div>

            {/* Vertex Freeze Status */}
            <div
              style={{
                marginTop: 12,
                background: "#18181b",
                border: "1px solid #3b82f633",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>
                  Vertex Status
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "#93c5fd",
                    backgroundColor: "#1e3a5f",
                    letterSpacing: "0.05em",
                  }}
                >
                  {MOCK_FREEZE_INFO.status}
                </span>
              </div>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Vertex", MOCK_FREEZE_INFO.vertex],
                    ["Version", `v${MOCK_FREEZE_INFO.version}`],
                    ["Frozen", new Date(MOCK_FREEZE_INFO.frozenAt).toLocaleDateString()],
                    ["Contracts", MOCK_FREEZE_INFO.contracts.join(", ")],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: "1px solid #27272a22" }}>
                      <td style={{ color: "#888", padding: "4px 8px 4px 0", whiteSpace: "nowrap" }}>{label}</td>
                      <td style={{ color: "#e4e4e7", fontWeight: 500, padding: "4px 0", fontSize: 12 }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  marginTop: 10,
                  padding: "6px 10px",
                  background: "#1e3a5f22",
                  border: "1px solid #3b82f633",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#93c5fd",
                }}
              >
                Schema locked. Changes require new contract version or feedback proposal.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
