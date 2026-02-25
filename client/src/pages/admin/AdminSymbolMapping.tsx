import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import trpc from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TakeoffCount {
  deviceType: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANONICAL_DEVICE_TYPES = [
  "Smoke Detector",
  "Carbon Monoxide Detector",
  "Heat Detector",
  "Fire Alarm Pull Station",
  "Sprinkler Head",
  "Duplex Receptacle 120V",
  "GFCI Receptacle",
  "Dedicated Outlet 240V",
  "Single-Pole Switch",
  "Three-Way Switch",
  "Dimmer Switch",
  "Recessed Light",
  "Surface Mount Light",
  "Emergency Light",
  "Exit Sign",
  "Junction Box",
  "Electrical Panel",
  "Sub-Panel",
  "Thermostat",
  "Data Outlet (Cat6)",
  "Ceiling Fan",
  "Exhaust Fan",
  "Doorbell",
  "Security Camera",
  "Motion Sensor",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "mapping" | "packs" | "takeoff";

export default function AdminSymbolMapping() {
  const [activeTab, setActiveTab] = useState<Tab>("mapping");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [docIdInput, setDocIdInput] = useState("");

  // --- Symbol pack apply modal state ---
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);

  // --- Save-as-pack modal state ---
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [newPackDescription, setNewPackDescription] = useState("");

  // ---------------------------------------------------------------------------
  // tRPC queries (only enabled when documentId is set)
  // ---------------------------------------------------------------------------

  const detectedClassesQuery = trpc.admin.blueprintLegend.getDetectedClasses.useQuery(
    { documentId: documentId! },
    { enabled: documentId !== null }
  );

  const symbolPacksQuery = trpc.admin.blueprintLegend.listSymbolPacks.useQuery(
    {},
    { enabled: true }
  );

  const takeoffCountsQuery = trpc.admin.blueprintLegend.getTakeoffCounts.useQuery(
    { documentId: documentId! },
    { enabled: documentId !== null }
  );

  // ---------------------------------------------------------------------------
  // tRPC mutations
  // ---------------------------------------------------------------------------

  const mapClassMutation = trpc.admin.blueprintLegend.mapClass.useMutation({
    onSuccess: () => {
      detectedClassesQuery.refetch();
      takeoffCountsQuery.refetch();
    },
  });

  const applySymbolPackMutation = trpc.admin.blueprintLegend.applySymbolPack.useMutation({
    onSuccess: (data) => {
      detectedClassesQuery.refetch();
      takeoffCountsQuery.refetch();
      setShowApplyModal(false);
      setSelectedPackId(null);
      alert(`Symbol pack applied. ${(data as any).mappingsApplied} mapping(s) applied.`);
    },
  });

  const saveAsSymbolPackMutation = trpc.admin.blueprintLegend.saveAsSymbolPack.useMutation({
    onSuccess: (data) => {
      symbolPacksQuery.refetch();
      setShowSaveModal(false);
      setNewPackName("");
      setNewPackDescription("");
      alert(`Symbol pack saved with ID ${(data as any).symbolPackId}.`);
    },
  });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const detectedClasses: any[] = (detectedClassesQuery.data as any)?.classes ?? [];
  const symbolPacks: any[] = (symbolPacksQuery.data as any)?.packs ?? [];
  const takeoffCounts: TakeoffCount[] = (takeoffCountsQuery.data ?? []) as TakeoffCount[];

  const mappedCount = detectedClasses.filter((c: any) => c.canonicalType).length;
  const unmappedCount = detectedClasses.filter((c: any) => !c.canonicalType).length;
  const totalDevices = detectedClasses.reduce((sum: number, c: any) => sum + c.count, 0);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLoadDocument = () => {
    const parsed = parseInt(docIdInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDocumentId(parsed);
    }
  };

  const handleMap = (rawClass: string, canonicalType: string) => {
    if (!documentId) return;
    mapClassMutation.mutate({ documentId, rawClass, canonicalType });
  };

  const handleApplyPack = () => {
    if (!documentId || !selectedPackId) return;
    applySymbolPackMutation.mutate({ documentId, symbolPackId: selectedPackId });
  };

  const handleSaveAsPack = () => {
    if (!documentId || !newPackName.trim()) return;
    saveAsSymbolPackMutation.mutate({
      documentId,
      packName: newPackName.trim(),
      description: newPackDescription.trim() || undefined,
    });
  };

  const tabStyle = (tab: Tab) => ({
    padding: "8px 20px",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
    background: "transparent",
    color: activeTab === tab ? "#fff" : "#888",
    cursor: "pointer" as const,
    fontSize: 14,
    fontWeight: activeTab === tab ? 600 : 400,
  });

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 8px 0" }}>
          Symbol Mapping
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 20px 0" }}>
          Map detected symbol classes to canonical device types. Save mappings as reusable symbol packs.
        </p>

        {/* Document ID selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 20,
            padding: "12px 16px",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 12,
          }}
        >
          <label style={{ fontSize: 13, color: "#a1a1aa", fontWeight: 600 }}>
            Document ID:
          </label>
          <input
            type="number"
            min={1}
            value={docIdInput}
            onChange={(e) => setDocIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadDocument();
            }}
            placeholder="Enter document ID"
            style={{
              background: "#09090b",
              border: "1px solid #27272a",
              borderRadius: 8,
              color: "#e4e4e7",
              padding: "6px 12px",
              fontSize: 13,
              width: 180,
            }}
          />
          <button
            onClick={handleLoadDocument}
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
          {documentId !== null && (
            <span style={{ fontSize: 12, color: "#10b981" }}>
              Loaded document #{documentId}
            </span>
          )}
        </div>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Total Detections" value={totalDevices} color="#fff" />
          <StatCard label="Mapped Classes" value={mappedCount} color="#10b981" />
          <StatCard label="Unmapped Classes" value={unmappedCount} color="#f59e0b" />
          <StatCard label="Device Types" value={takeoffCounts.length} color="#3b82f6" />
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #27272a", marginBottom: 20, display: "flex" }}>
          <button style={tabStyle("mapping")} onClick={() => setActiveTab("mapping")}>
            Class Mapping
          </button>
          <button style={tabStyle("packs")} onClick={() => setActiveTab("packs")}>
            Symbol Packs
          </button>
          <button style={tabStyle("takeoff")} onClick={() => setActiveTab("takeoff")}>
            Takeoff Counts
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB: Class Mapping                                               */}
        {/* ================================================================ */}
        {activeTab === "mapping" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
                Select a canonical device type for each detected class. Unmapped classes are highlighted.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    if (!documentId) {
                      alert("Please load a document first.");
                      return;
                    }
                    setShowApplyModal(true);
                  }}
                  disabled={applySymbolPackMutation.isPending}
                  style={{
                    background: "#8b5cf6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: applySymbolPackMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {applySymbolPackMutation.isPending ? "Applying..." : "Apply Symbol Pack"}
                </button>
                <button
                  onClick={() => {
                    if (!documentId) {
                      alert("Please load a document first.");
                      return;
                    }
                    setShowSaveModal(true);
                  }}
                  disabled={saveAsSymbolPackMutation.isPending}
                  style={{
                    background: "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: saveAsSymbolPackMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {saveAsSymbolPackMutation.isPending ? "Saving..." : "Save as New Pack"}
                </button>
              </div>
            </div>

            {/* Loading state */}
            {documentId === null && (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                Enter a document ID above to load detected classes.
              </div>
            )}

            {documentId !== null && detectedClassesQuery.isLoading && (
              <div style={{ color: "#888", textAlign: "center", padding: 48 }}>
                Loading detected classes...
              </div>
            )}

            {documentId !== null && detectedClassesQuery.isError && (
              <div style={{ color: "#ef4444", textAlign: "center", padding: 48 }}>
                Error loading classes: {detectedClassesQuery.error?.message}
              </div>
            )}

            {documentId !== null && !detectedClassesQuery.isLoading && !detectedClassesQuery.isError && detectedClasses.length === 0 && (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                No detected classes found for this document.
              </div>
            )}

            {detectedClasses.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr 80px 100px",
                    gap: 12,
                    padding: "8px 16px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  <span>Detected Class</span>
                  <span>Canonical Device Type</span>
                  <span style={{ textAlign: "center" }}>Count</span>
                  <span style={{ textAlign: "center" }}>Action</span>
                </div>

                {/* Rows */}
                {[...detectedClasses]
                  .sort((a: any, b: any) => {
                    // Unmapped first, then by count desc
                    if (!a.canonicalType && b.canonicalType) return -1;
                    if (a.canonicalType && !b.canonicalType) return 1;
                    return b.count - a.count;
                  })
                  .map((cls: any) => (
                    <div
                      key={cls.rawClass}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "200px 1fr 80px 100px",
                        gap: 12,
                        alignItems: "center",
                        padding: "10px 16px",
                        background: "#18181b",
                        border: cls.canonicalType
                          ? "1px solid #27272a"
                          : "1px solid #f59e0b44",
                        borderRadius: 8,
                      }}
                    >
                      {/* Raw class */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge
                          label={cls.canonicalType ? "mapped" : "unmapped"}
                          color={cls.canonicalType ? "#10b981" : "#f59e0b"}
                        />
                        <span style={{ fontSize: 13, color: "#e4e4e7", fontFamily: "monospace" }}>
                          {cls.rawClass}
                        </span>
                      </div>

                      {/* Canonical type selector */}
                      <select
                        value={cls.canonicalType ?? ""}
                        onChange={(e) => {
                          if (e.target.value) handleMap(cls.rawClass, e.target.value);
                        }}
                        disabled={mapClassMutation.isPending}
                        style={{
                          background: "#09090b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          color: cls.canonicalType ? "#10b981" : "#888",
                          padding: "6px 10px",
                          fontSize: 13,
                          width: "100%",
                        }}
                      >
                        <option value="">-- Select device type --</option>
                        {CANONICAL_DEVICE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>

                      {/* Count */}
                      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                        {cls.count}
                      </div>

                      {/* Action */}
                      <div style={{ textAlign: "center" }}>
                        {cls.canonicalType && (
                          <button
                            onClick={() => handleMap(cls.rawClass, "")}
                            disabled={mapClassMutation.isPending}
                            style={{
                              background: "transparent",
                              color: "#ef4444",
                              border: "1px solid #ef444444",
                              borderRadius: 6,
                              padding: "3px 10px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Apply Symbol Pack modal */}
            {showApplyModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowApplyModal(false)}
              >
                <div
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: 24,
                    width: 420,
                    maxHeight: "80vh",
                    overflowY: "auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e4e4e7", margin: "0 0 12px 0" }}>
                    Apply Symbol Pack
                  </h3>
                  {symbolPacksQuery.isLoading && (
                    <p style={{ color: "#888", fontSize: 13 }}>Loading packs...</p>
                  )}
                  {symbolPacks.length === 0 && !symbolPacksQuery.isLoading && (
                    <p style={{ color: "#666", fontSize: 13 }}>No symbol packs available.</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {symbolPacks.map((pack: any) => (
                      <label
                        key={pack.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: selectedPackId === pack.id ? "#3b82f622" : "#09090b",
                          border: selectedPackId === pack.id ? "1px solid #3b82f6" : "1px solid #27272a",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="symbolPack"
                          value={pack.id}
                          checked={selectedPackId === pack.id}
                          onChange={() => setSelectedPackId(pack.id)}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>
                            {pack.name}
                          </div>
                          {pack.description && (
                            <div style={{ fontSize: 11, color: "#888" }}>{pack.description}</div>
                          )}
                          <div style={{ fontSize: 11, color: "#555" }}>
                            {pack.mappings?.length ?? 0} mapping(s)
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setShowApplyModal(false);
                        setSelectedPackId(null);
                      }}
                      style={{
                        background: "transparent",
                        color: "#a1a1aa",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyPack}
                      disabled={!selectedPackId || applySymbolPackMutation.isPending}
                      style={{
                        background: "#8b5cf6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity: !selectedPackId || applySymbolPackMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      {applySymbolPackMutation.isPending ? "Applying..." : "Apply"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save as Symbol Pack modal */}
            {showSaveModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setShowSaveModal(false)}
              >
                <div
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: 24,
                    width: 420,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e4e4e7", margin: "0 0 12px 0" }}>
                    Save as New Symbol Pack
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                        Pack Name *
                      </label>
                      <input
                        type="text"
                        value={newPackName}
                        onChange={(e) => setNewPackName(e.target.value)}
                        placeholder="e.g. Residential Electrical Standard"
                        style={{
                          background: "#09090b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          color: "#e4e4e7",
                          padding: "8px 12px",
                          fontSize: 13,
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                        Description (optional)
                      </label>
                      <textarea
                        value={newPackDescription}
                        onChange={(e) => setNewPackDescription(e.target.value)}
                        placeholder="Brief description of this symbol pack..."
                        rows={3}
                        style={{
                          background: "#09090b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          color: "#e4e4e7",
                          padding: "8px 12px",
                          fontSize: 13,
                          width: "100%",
                          boxSizing: "border-box",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setShowSaveModal(false);
                        setNewPackName("");
                        setNewPackDescription("");
                      }}
                      style={{
                        background: "transparent",
                        color: "#a1a1aa",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAsPack}
                      disabled={!newPackName.trim() || saveAsSymbolPackMutation.isPending}
                      style={{
                        background: "#3b82f6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity: !newPackName.trim() || saveAsSymbolPackMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      {saveAsSymbolPackMutation.isPending ? "Saving..." : "Save Pack"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Symbol Packs                                                */}
        {/* ================================================================ */}
        {activeTab === "packs" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Reusable symbol packs. Apply a pack to auto-map detected classes. Packs persist across projects.
            </p>

            {symbolPacksQuery.isLoading && (
              <div style={{ color: "#888", textAlign: "center", padding: 48 }}>
                Loading symbol packs...
              </div>
            )}

            {symbolPacksQuery.isError && (
              <div style={{ color: "#ef4444", textAlign: "center", padding: 48 }}>
                Error loading symbol packs: {symbolPacksQuery.error?.message}
              </div>
            )}

            {!symbolPacksQuery.isLoading && !symbolPacksQuery.isError && symbolPacks.length === 0 && (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                No symbol packs found. Save current mappings as a pack from the Class Mapping tab.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {symbolPacks.map((pack: any) => (
                <div
                  key={pack.id}
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", margin: 0 }}>
                          {pack.name}
                        </h3>
                      </div>
                      {pack.description && (
                        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0 0" }}>
                          {pack.description}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {pack.createdAt ? new Date(pack.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>

                  {/* Mappings table */}
                  {pack.mappings && pack.mappings.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ color: "#888", textAlign: "left" }}>
                            <th style={{ padding: "4px 8px", borderBottom: "1px solid #27272a" }}>Raw Class</th>
                            <th style={{ padding: "4px 8px", borderBottom: "1px solid #27272a" }}>Canonical Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pack.mappings.map((m: any, idx: number) => (
                            <tr key={idx}>
                              <td style={{ padding: "4px 8px", color: "#a1a1aa", fontFamily: "monospace", borderBottom: "1px solid #18181b" }}>
                                {m.rawClass}
                              </td>
                              <td style={{ padding: "4px 8px", color: "#10b981", borderBottom: "1px solid #18181b" }}>
                                {m.canonicalType}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => {
                        if (!documentId) {
                          alert("Please load a document first.");
                          return;
                        }
                        applySymbolPackMutation.mutate({
                          documentId,
                          symbolPackId: pack.id,
                        });
                      }}
                      disabled={!documentId || applySymbolPackMutation.isPending}
                      style={{
                        background: "#8b5cf6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity: !documentId || applySymbolPackMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      {applySymbolPackMutation.isPending ? "Applying..." : "Apply to Document"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Takeoff Counts                                              */}
        {/* ================================================================ */}
        {activeTab === "takeoff" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Device counts per canonical type after symbol mapping. Only mapped detections are included.
            </p>

            {documentId === null && (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                Enter a document ID above to view takeoff counts.
              </div>
            )}

            {documentId !== null && takeoffCountsQuery.isLoading && (
              <div style={{ color: "#888", textAlign: "center", padding: 48 }}>
                Loading takeoff counts...
              </div>
            )}

            {documentId !== null && takeoffCountsQuery.isError && (
              <div style={{ color: "#ef4444", textAlign: "center", padding: 48 }}>
                Error loading takeoff counts: {takeoffCountsQuery.error?.message}
              </div>
            )}

            {documentId !== null && !takeoffCountsQuery.isLoading && !takeoffCountsQuery.isError && takeoffCounts.length === 0 ? (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                No mapped detections yet. Map symbol classes to see takeoff counts.
              </div>
            ) : takeoffCounts.length > 0 ? (
              <div
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: "#888", fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>
                        Device Type
                      </th>
                      <th style={{ padding: "12px 16px", textAlign: "right", color: "#888", fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>
                        Count
                      </th>
                      <th style={{ padding: "12px 16px", textAlign: "right", color: "#888", fontWeight: 600, fontSize: 12, textTransform: "uppercase", width: 200 }}>
                        Distribution
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {takeoffCounts.map((tc) => {
                      const maxCount = Math.max(...takeoffCounts.map((t) => t.count));
                      const pct = maxCount > 0 ? (tc.count / maxCount) * 100 : 0;
                      return (
                        <tr key={tc.deviceType} style={{ borderBottom: "1px solid #27272a22" }}>
                          <td style={{ padding: "10px 16px", color: "#e4e4e7" }}>
                            {tc.deviceType}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#fff", fontSize: 16 }}>
                            {tc.count}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <div
                              style={{
                                height: 8,
                                borderRadius: 4,
                                background: "#27272a",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  borderRadius: 4,
                                  background: "#3b82f6",
                                  transition: "width 0.3s",
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #27272a" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#fff" }}>
                        Total
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#fff", fontSize: 18 }}>
                        {takeoffCounts.reduce((sum, t) => sum + t.count, 0)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}

            {unmappedCount > 0 && (
              <div
                style={{
                  marginTop: 16,
                  background: "#f59e0b11",
                  border: "1px solid #f59e0b33",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Badge label={`${unmappedCount} unmapped`} color="#f59e0b" />
                <span style={{ fontSize: 13, color: "#f59e0b" }}>
                  {unmappedCount} detected class(es) are not yet mapped to canonical device types.
                  Switch to the &ldquo;Class Mapping&rdquo; tab to complete mapping.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: 12,
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "#fff" }}>{value}</div>
    </div>
  );
}
