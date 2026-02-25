import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Play, Pause, Square, FileText, ChevronDown } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleMarketingAgents() {
  const instancesQ = trpc.admin.agentInstances.list.useQuery({}, { retry: false });
  const instances = (instancesQ.data as any)?.instances ?? [];
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  const updateMut = trpc.admin.agentInstances.update.useMutation({
    onSuccess: () => instancesQ.refetch(),
  });

  const toggleExpanded = (id: number) => {
    setExpandedAgent(expandedAgent === id ? null : id);
  };

  const statusColor = (s: string) =>
    s === "active" || s === "running" ? "#22c55e" : s === "paused" ? "#f59e0b" : s === "error" ? "#ef4444" : "#666";

  const agentColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Marketing Agents</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Monitor and control agent instances
        </p>

        {instancesQ.isLoading ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            Loading agent instances...
          </div>
        ) : instances.length === 0 ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            <p style={{ fontSize: "14px", margin: 0 }}>No agent instances registered</p>
            <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>Create agent instances to see them here</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {instances.map((inst: any, idx: number) => {
              const color = agentColors[idx % agentColors.length];
              const expanded = expandedAgent === inst.id;
              const status = inst.status || "active";
              return (
                <div key={inst.id} style={{ backgroundColor: "#1a1a1a", borderRadius: "8px", border: `1px solid ${expanded ? color : "#333"}`, overflow: "hidden", transition: "all 0.3s" }}>
                  {/* Header */}
                  <div onClick={() => toggleExpanded(inst.id)} style={{ padding: "16px", backgroundColor: "#0f0f0f", borderBottom: expanded ? `2px solid ${color}` : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor(status) }} />
                        <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#e0e0e0" }}>{inst.displayName || `Instance ${inst.id}`}</h3>
                      </div>
                      <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>#{inst.id} — {status}</p>
                    </div>
                    <ChevronDown size={16} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#666" }} />
                  </div>

                  {/* Content */}
                  {expanded && (
                    <div style={{ padding: "16px", borderTop: "1px solid #333" }}>
                      <div style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "12px", color: "#666", fontWeight: "600", marginBottom: "6px" }}>Status</div>
                        <div style={{ padding: "8px 12px", backgroundColor: `${color}20`, borderRadius: "4px", fontSize: "13px", color, fontWeight: "600", textTransform: "capitalize" }}>
                          {status}
                        </div>
                      </div>

                      {inst.vertexProfileId && (
                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ fontSize: "12px", color: "#666", fontWeight: "600", marginBottom: "6px" }}>Vertex Profile</div>
                          <div style={{ fontSize: "13px", color: "#999" }}>#{inst.vertexProfileId}</div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => updateMut.mutate({ id: inst.id, status: "active" })}
                          disabled={status === "active" || updateMut.isPending}
                          style={{ flex: 1, padding: "8px", backgroundColor: status === "active" ? "#333" : color, color: status === "active" ? "#666" : "#000", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: status === "active" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Play size={12} /> Start
                        </button>
                        <button
                          onClick={() => updateMut.mutate({ id: inst.id, status: "paused" })}
                          disabled={status !== "active" || updateMut.isPending}
                          style={{ flex: 1, padding: "8px", backgroundColor: "#333", color: status !== "active" ? "#666" : "#e0e0e0", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: status !== "active" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Pause size={12} /> Pause
                        </button>
                        <button
                          onClick={() => updateMut.mutate({ id: inst.id, status: "archived" })}
                          disabled={status === "archived" || updateMut.isPending}
                          style={{ flex: 1, padding: "8px", backgroundColor: "#333", color: status === "archived" ? "#666" : "#e0e0e0", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: status === "archived" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Square size={12} /> Stop
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
