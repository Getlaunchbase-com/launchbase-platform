import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedClass {
  rawClass: string;
  canonicalType: string | null;
  count: number;
}

interface SymbolPack {
  id: number;
  name: string;
  description?: string;
  mappings: Array<{ rawClass: string; canonicalType: string; symbolDescription?: string }>;
  isDefault: boolean;
  createdAt: string;
}

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
  const [detectedClasses, setDetectedClasses] = useState<DetectedClass[]>([
    { rawClass: "smoke_detector", canonicalType: null, count: 12 },
    { rawClass: "outlet_120v", canonicalType: "Duplex Receptacle 120V", count: 34 },
    { rawClass: "outlet_240v", canonicalType: null, count: 4 },
    { rawClass: "switch", canonicalType: null, count: 22 },
    { rawClass: "light_fixture", canonicalType: null, count: 28 },
    { rawClass: "junction_box", canonicalType: "Junction Box", count: 8 },
    { rawClass: "panel", canonicalType: null, count: 2 },
    { rawClass: "thermostat", canonicalType: null, count: 3 },
    { rawClass: "sprinkler", canonicalType: null, count: 15 },
    { rawClass: "fire_alarm", canonicalType: null, count: 6 },
  ]);

  const [symbolPacks] = useState<SymbolPack[]>([
    {
      id: 1,
      name: "Residential Electrical — Standard",
      description: "Standard symbol mappings for residential electrical blueprints",
      mappings: [
        { rawClass: "smoke_detector", canonicalType: "Smoke Detector" },
        { rawClass: "outlet_120v", canonicalType: "Duplex Receptacle 120V" },
        { rawClass: "switch", canonicalType: "Single-Pole Switch" },
      ],
      isDefault: true,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: 2,
      name: "Commercial Fire Safety",
      description: "Fire safety device mappings for commercial projects",
      mappings: [
        { rawClass: "smoke_detector", canonicalType: "Smoke Detector" },
        { rawClass: "sprinkler", canonicalType: "Sprinkler Head" },
        { rawClass: "fire_alarm", canonicalType: "Fire Alarm Pull Station" },
      ],
      isDefault: false,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  ]);

  const mappedCount = detectedClasses.filter((c) => c.canonicalType).length;
  const unmappedCount = detectedClasses.filter((c) => !c.canonicalType).length;
  const totalDevices = detectedClasses.reduce((sum, c) => sum + c.count, 0);

  // Compute takeoff counts from mapped classes
  const takeoffCounts: TakeoffCount[] = [];
  const takeoffMap = new Map<string, number>();
  for (const cls of detectedClasses) {
    if (cls.canonicalType) {
      takeoffMap.set(cls.canonicalType, (takeoffMap.get(cls.canonicalType) ?? 0) + cls.count);
    }
  }
  for (const [deviceType, cnt] of takeoffMap) {
    takeoffCounts.push({ deviceType, count: cnt });
  }
  takeoffCounts.sort((a, b) => b.count - a.count);

  const handleMap = (rawClass: string, canonicalType: string) => {
    setDetectedClasses((prev) =>
      prev.map((c) => (c.rawClass === rawClass ? { ...c, canonicalType } : c))
    );
  };

  const handleUnmap = (rawClass: string) => {
    setDetectedClasses((prev) =>
      prev.map((c) => (c.rawClass === rawClass ? { ...c, canonicalType: null } : c))
    );
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
                  style={{
                    background: "#8b5cf6",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply Symbol Pack
                </button>
                <button
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
                  Save as New Pack
                </button>
              </div>
            </div>

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
              {detectedClasses
                .sort((a, b) => {
                  // Unmapped first, then by count desc
                  if (!a.canonicalType && b.canonicalType) return -1;
                  if (a.canonicalType && !b.canonicalType) return 1;
                  return b.count - a.count;
                })
                .map((cls) => (
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
                        else handleUnmap(cls.rawClass);
                      }}
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
                          onClick={() => handleUnmap(cls.rawClass)}
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

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {symbolPacks.map((pack) => (
                <div
                  key={pack.id}
                  style={{
                    background: "#18181b",
                    border: pack.isDefault ? "1px solid #10b98144" : "1px solid #27272a",
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
                        {pack.isDefault && <Badge label="default" color="#10b981" />}
                      </div>
                      {pack.description && (
                        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0 0" }}>
                          {pack.description}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      {new Date(pack.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Mappings table */}
                  <div style={{ marginTop: 8 }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#888", textAlign: "left" }}>
                          <th style={{ padding: "4px 8px", borderBottom: "1px solid #27272a" }}>Raw Class</th>
                          <th style={{ padding: "4px 8px", borderBottom: "1px solid #27272a" }}>Canonical Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pack.mappings.map((m, idx) => (
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

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      style={{
                        background: "#8b5cf6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Apply to Document
                    </button>
                    <button
                      style={{
                        background: "transparent",
                        color: "#a1a1aa",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Edit
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

            {takeoffCounts.length === 0 ? (
              <div style={{ color: "#666", textAlign: "center", padding: 48 }}>
                No mapped detections yet. Map symbol classes to see takeoff counts.
              </div>
            ) : (
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
            )}

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
