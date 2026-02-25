import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Search } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleRuns() {
  const [filterStatus, setFilterStatus] = useState<string>("");

  const runsQ = trpc.admin.operatorOS.listRuns.useQuery(
    { status: (filterStatus || undefined) as any, limit: 50 },
    { retry: false }
  );
  const runs = Array.isArray(runsQ.data) ? runsQ.data : [];

  const statusColor = (s: string) =>
    s === "completed" ? "#22c55e" : s === "running" ? "#3b82f6" : s === "failed" ? "#ef4444" : "#666";

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Runs</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>View all agent and swarm runs</p>

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "8px", backgroundColor: "#0f0f0f", border: "1px solid #333", borderRadius: "4px", fontSize: "12px", color: "#e0e0e0" }}
          >
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {runsQ.isLoading ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            Loading runs...
          </div>
        ) : runs.length === 0 ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            <p style={{ fontSize: "14px", margin: 0 }}>No runs yet</p>
            <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>Launch an agent or swarm to see runs here</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {runs.map((run: any) => (
              <div key={run.id} style={{ padding: "16px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", alignItems: "center", gap: "16px" }}>
                <div style={{ fontSize: "13px", color: "#666", fontFamily: "monospace" }}>#{run.id}</div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0" }}>{run.instanceName || run.type || `Run ${run.id}`}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>Project #{run.projectId}</div>
                </div>
                <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: "600", backgroundColor: `${statusColor(run.status)}22`, color: statusColor(run.status), border: `1px solid ${statusColor(run.status)}44` }}>
                  {run.status}
                </span>
                <div style={{ fontSize: "12px", color: "#666" }}>{run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
