import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import trpc from "../../lib/trpc";

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
}

interface Page {
  id: number;
  pageNumber: number;
  label?: string;
  imagePath?: string;
  width?: number;
  height?: number;
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

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        color: "#888",
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: "2px solid #27272a",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: 12,
        }}
      />
      {message ?? "Loading..."}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        color: "#555",
        fontSize: 14,
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: 12,
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminBlueprintViewer() {
  // --- Selector state ---
  const [projectIdInput, setProjectIdInput] = useState("1");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  // --- Viewer state ---
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("detections");
  const [selectedDetection, setSelectedDetection] = useState<number | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [showLegend, setShowLegend] = useState(false);

  // --- tRPC queries ---

  // List documents for selected project
  const documentsQuery = trpc.admin.blueprintIngestion.listDocuments.useQuery(
    { projectId: projectId! },
    { enabled: projectId !== null },
  );

  // Get document detail when a document is selected
  const documentDetailQuery = trpc.admin.blueprintIngestion.getDocument.useQuery(
    { documentId: selectedDocumentId! },
    { enabled: selectedDocumentId !== null },
  );

  // List pages for selected document
  const pagesQuery = trpc.admin.blueprintIngestion.listPages.useQuery(
    { documentId: selectedDocumentId! },
    { enabled: selectedDocumentId !== null },
  );

  // Detection summary for the document
  const detectionSummaryQuery = trpc.admin.blueprintIngestion.detectionSummary.useQuery(
    { documentId: selectedDocumentId! },
    { enabled: selectedDocumentId !== null },
  );

  // Legend entries for the document
  const legendQuery = trpc.admin.blueprintIngestion.getLegendEntries.useQuery(
    { documentId: selectedDocumentId! },
    { enabled: selectedDocumentId !== null },
  );

  // Derive the current page from the pages list
  const pages: Page[] = ((pagesQuery.data as any)?.pages ?? []) as Page[];
  const currentPage = pages[currentPageIndex] ?? null;
  const currentPageId = currentPage?.id ?? null;

  // Get detections for the currently viewed page
  const detectionsQuery = trpc.admin.blueprintIngestion.getDetections.useQuery(
    { pageId: currentPageId! },
    { enabled: currentPageId !== null },
  );

  // Get text blocks for the currently viewed page
  const textBlocksQuery = trpc.admin.blueprintIngestion.getTextBlocks.useQuery(
    { pageId: currentPageId! },
    { enabled: currentPageId !== null },
  );

  // --- Derived data ---
  const documents: any[] = (documentsQuery.data as any)?.documents ?? [];
  const detections: Detection[] = (detectionsQuery.data ?? []) as Detection[];
  const textBlocks: TextBlock[] = (textBlocksQuery.data ?? []) as TextBlock[];
  const filteredDetections = detections.filter((d) => d.confidence >= minConfidence);

  const detectionSummary: Array<{ rawClass: string; count: number }> =
    (detectionSummaryQuery.data ?? []) as Array<{ rawClass: string; count: number }>;

  const legendEntries = legendQuery.data ?? [];

  const totalDetections = detectionSummary.reduce(
    (sum, entry) => sum + (typeof entry === "object" && "count" in entry ? (entry as any).count : 0),
    0,
  );

  const selectedDet =
    selectedDetection !== null ? detections.find((d) => d.id === selectedDetection) : null;

  // --- Handlers ---
  function handleLoadProject() {
    const parsed = parseInt(projectIdInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setProjectId(parsed);
      setSelectedDocumentId(null);
      setCurrentPageIndex(0);
      setSelectedDetection(null);
    }
  }

  function handleSelectDocument(docId: number) {
    setSelectedDocumentId(docId);
    setCurrentPageIndex(0);
    setSelectedDetection(null);
  }

  function handlePageNav(delta: number) {
    setCurrentPageIndex((prev) => {
      const next = prev + delta;
      if (next < 0 || next >= pages.length) return prev;
      return next;
    });
    setSelectedDetection(null);
  }

  // --- Determine what section to show ---
  const hasProject = projectId !== null;
  const hasDocument = selectedDocumentId !== null;
  const hasPages = pages.length > 0;

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px 0" }}>
          Blueprint Viewer
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 20px 0" }}>
          View blueprint pages with detection overlays. Click detections to inspect.
        </p>

        {/* ============================================================ */}
        {/* Project / Document Selector                                  */}
        {/* ============================================================ */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Project ID input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Project ID</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                min={1}
                value={projectIdInput}
                onChange={(e) => setProjectIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoadProject();
                }}
                style={{
                  width: 100,
                  padding: "6px 10px",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  color: "#e4e4e7",
                  fontSize: 13,
                }}
              />
              <button
                onClick={handleLoadProject}
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Load
              </button>
            </div>
          </div>

          {/* Document selector */}
          {hasProject && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Document</label>
              {documentsQuery.isLoading ? (
                <span style={{ fontSize: 13, color: "#555", padding: "6px 0" }}>
                  Loading documents...
                </span>
              ) : documents.length === 0 ? (
                <span style={{ fontSize: 13, color: "#555", padding: "6px 0" }}>
                  No documents found for project {projectId}
                </span>
              ) : (
                <select
                  value={selectedDocumentId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) handleSelectDocument(Number(val));
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 8,
                    color: "#e4e4e7",
                    fontSize: 13,
                    minWidth: 280,
                  }}
                >
                  <option value="">-- Select a document --</option>
                  {documents.map((doc: any) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename ?? `Document #${doc.id}`} ({doc.status}, {doc.totalPages ?? "?"}{" "}
                      pages)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Document status badge */}
          {hasDocument && documentDetailQuery.data && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color:
                    (documentDetailQuery.data as any).status === "complete"
                      ? "#10b981"
                      : (documentDetailQuery.data as any).status === "error"
                        ? "#ef4444"
                        : "#f59e0b",
                  background:
                    (documentDetailQuery.data as any).status === "complete"
                      ? "#10b98122"
                      : (documentDetailQuery.data as any).status === "error"
                        ? "#ef444422"
                        : "#f59e0b22",
                  border: `1px solid ${
                    (documentDetailQuery.data as any).status === "complete"
                      ? "#10b98144"
                      : (documentDetailQuery.data as any).status === "error"
                        ? "#ef444444"
                        : "#f59e0b44"
                  }`,
                }}
              >
                {(documentDetailQuery.data as any).status}
              </span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* Pre-document state                                           */}
        {/* ============================================================ */}
        {!hasProject && (
          <EmptyState message="Enter a Project ID above and click Load to browse blueprint documents." />
        )}

        {hasProject && !hasDocument && documents.length > 0 && (
          <EmptyState message="Select a document from the dropdown to view its pages." />
        )}

        {hasProject && documentsQuery.isLoading && <LoadingSpinner message="Loading documents..." />}

        {hasProject &&
          !documentsQuery.isLoading &&
          documents.length === 0 &&
          !documentsQuery.isError && (
            <EmptyState message={`No documents found for project ${projectId}.`} />
          )}

        {documentsQuery.isError && (
          <div
            style={{
              padding: 16,
              background: "#ef444422",
              border: "1px solid #ef444444",
              borderRadius: 12,
              color: "#ef4444",
              fontSize: 13,
            }}
          >
            Error loading documents: {(documentsQuery.error as any)?.message ?? "Unknown error"}
          </div>
        )}

        {/* ============================================================ */}
        {/* Main viewer (only when a document is selected)               */}
        {/* ============================================================ */}
        {hasDocument && (
          <div style={{ display: "flex", gap: 16 }}>
            {/* ============================================================ */}
            {/* Left: Page viewer with overlays                              */}
            {/* ============================================================ */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Loading state for pages */}
              {pagesQuery.isLoading && <LoadingSpinner message="Loading pages..." />}

              {/* No pages state */}
              {!pagesQuery.isLoading && !hasPages && (
                <EmptyState message="No pages found for this document." />
              )}

              {/* Page viewer */}
              {hasPages && currentPage && (
                <>
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
                        disabled={currentPageIndex === 0}
                        onClick={() => handlePageNav(-1)}
                        style={{
                          background: currentPageIndex === 0 ? "#27272a" : "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 12px",
                          fontSize: 13,
                          cursor: currentPageIndex === 0 ? "default" : "pointer",
                          opacity: currentPageIndex === 0 ? 0.5 : 1,
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 13, color: "#a1a1aa" }}>
                        Page {currentPage.pageNumber} / {pages.length}
                      </span>
                      <button
                        disabled={currentPageIndex === pages.length - 1}
                        onClick={() => handlePageNav(1)}
                        style={{
                          background:
                            currentPageIndex === pages.length - 1 ? "#27272a" : "#3b82f6",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 12px",
                          fontSize: 13,
                          cursor:
                            currentPageIndex === pages.length - 1 ? "default" : "pointer",
                          opacity: currentPageIndex === pages.length - 1 ? 0.5 : 1,
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
                            border:
                              overlayMode === mode
                                ? "1px solid #3b82f6"
                                : "1px solid #27272a",
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
                      aspectRatio:
                        currentPage.width && currentPage.height
                          ? `${currentPage.width} / ${currentPage.height}`
                          : "17 / 11",
                      overflow: "hidden",
                    }}
                  >
                    {/* Blueprint image or placeholder */}
                    {currentPage.imagePath ? (
                      <img
                        src={currentPage.imagePath}
                        alt={currentPage.label ?? `Page ${currentPage.pageNumber}`}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <>
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
                          {currentPage.label ?? `Page ${currentPage.pageNumber}`}
                          <br />
                          <span style={{ fontSize: 11, color: "#555" }}>
                            {currentPage.width}&times;{currentPage.height}px
                          </span>
                        </div>
                      </>
                    )}

                    {/* Detection loading indicator */}
                    {detectionsQuery.isLoading &&
                      (overlayMode === "detections" || overlayMode === "both") && (
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "#18181bee",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 11,
                            color: "#888",
                          }}
                        >
                          Loading detections...
                        </div>
                      )}

                    {/* Text blocks loading indicator */}
                    {textBlocksQuery.isLoading &&
                      (overlayMode === "text" || overlayMode === "both") && (
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            background: "#18181bee",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 11,
                            color: "#888",
                          }}
                        >
                          Loading text blocks...
                        </div>
                      )}

                    {/* Detection overlays */}
                    {(overlayMode === "detections" || overlayMode === "both") &&
                      filteredDetections.map((det) => (
                        <DetectionBox
                          key={det.id}
                          det={det}
                          selected={selectedDetection === det.id}
                          onClick={() =>
                            setSelectedDetection(
                              selectedDetection === det.id ? null : det.id,
                            )
                          }
                        />
                      ))}

                    {/* Text overlays */}
                    {(overlayMode === "text" || overlayMode === "both") &&
                      textBlocks.map((block) => (
                        <TextOverlay key={block.id} block={block} />
                      ))}
                  </div>

                  {/* Page label */}
                  <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
                    {currentPage.label}
                  </div>
                </>
              )}
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
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e4e4e7",
                    margin: "0 0 12px 0",
                  }}
                >
                  Detections Summary
                </h3>
                {detectionSummaryQuery.isLoading ? (
                  <LoadingSpinner message="Loading summary..." />
                ) : detectionSummary.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#555" }}>No detections found.</div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    {detectionSummary
                      .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0))
                      .map((entry: any) => (
                        <div
                          key={entry.rawClass}
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
                                background: getClassColor(entry.rawClass),
                              }}
                            />
                            <span style={{ color: "#a1a1aa" }}>
                              {entry.rawClass.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span style={{ color: "#fff", fontWeight: 600 }}>
                            {entry.count}
                          </span>
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
                      <span>{totalDetections}</span>
                    </div>
                  </div>
                )}
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
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#e4e4e7",
                      margin: "0 0 8px 0",
                    }}
                  >
                    Detection #{selectedDet.id}
                  </h3>
                  <table style={{ width: "100%", fontSize: 12 }}>
                    <tbody>
                      {[
                        ["Class", selectedDet.rawClass.replace(/_/g, " ")],
                        ["Canonical", selectedDet.canonicalType ?? "\u2014"],
                        ["Confidence", `${(selectedDet.confidence * 100).toFixed(1)}%`],
                        ["Status", selectedDet.status],
                        [
                          "Position",
                          `(${selectedDet.x.toFixed(3)}, ${selectedDet.y.toFixed(3)})`,
                        ],
                        [
                          "Size",
                          `${selectedDet.w.toFixed(3)} x ${selectedDet.h.toFixed(3)}`,
                        ],
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
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e4e4e7",
                    margin: "0 0 8px 0",
                  }}
                >
                  Pages
                </h3>
                {pagesQuery.isLoading ? (
                  <LoadingSpinner message="Loading pages..." />
                ) : pages.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#555" }}>No pages yet.</div>
                ) : (
                  pages.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setCurrentPageIndex(idx);
                        setSelectedDetection(null);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        marginBottom: 4,
                        cursor: "pointer",
                        background: currentPageIndex === idx ? "#3b82f622" : "transparent",
                        border:
                          currentPageIndex === idx
                            ? "1px solid #3b82f644"
                            : "1px solid transparent",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: currentPageIndex === idx ? "#3b82f6" : "#a1a1aa",
                          fontWeight: currentPageIndex === idx ? 600 : 400,
                        }}
                      >
                        Page {p.pageNumber}
                      </div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {p.label ?? `Page ${p.pageNumber}`}
                        {p.width && p.height ? ` \u00b7 ${p.width}\u00d7${p.height}px` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Legend entries toggle + panel */}
              <div>
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  style={{
                    width: "100%",
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: showLegend ? "12px 12px 0 0" : 12,
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
                  <span>Legend Entries</span>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {showLegend ? "\u25B2" : "\u25BC"}
                  </span>
                </button>
                {showLegend && (
                  <div
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderTop: "none",
                      borderRadius: "0 0 12px 12px",
                      padding: 16,
                    }}
                  >
                    {legendQuery.isLoading ? (
                      <LoadingSpinner message="Loading legend..." />
                    ) : (legendEntries as any[]).length === 0 ? (
                      <div style={{ fontSize: 13, color: "#555" }}>
                        No legend entries found.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12 }}>
                        {(legendEntries as any[]).map((entry: any, idx: number) => (
                          <div
                            key={entry.id ?? idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "4px 0",
                              borderBottom: "1px solid #27272a22",
                            }}
                          >
                            <span style={{ color: "#a1a1aa" }}>
                              {entry.label ?? entry.symbol ?? `Entry ${idx + 1}`}
                            </span>
                            <span style={{ color: "#e4e4e7", fontWeight: 500 }}>
                              {entry.description ?? entry.canonicalType ?? "\u2014"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
