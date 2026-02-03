import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Search, Filter, ChevronRight } from "../../components/Icons";

export default function AdminConsoleRuns() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Runs</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          View all agent and swarm runs
        </p>

        {/* Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Search
            </label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#666" }} />
              <input
                type="text"
                placeholder="Run ID, agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "28px",
                  padding: "8px",
                  paddingLeft: "28px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Status
            </label>
            <select
              value={filterStatus || ""}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e0e0e0",
                outline: "none",
              }}
            >
              <option value="">All statuses</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Date
            </label>
            <input
              type="date"
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e0e0e0",
                outline: "none",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Agent
            </label>
            <select
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e0e0e0",
                outline: "none",
              }}
            >
              <option>All agents</option>
              <option>Signals</option>
              <option>Intelligence</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        <div
          style={{
            padding: "40px 20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            textAlign: "center",
            color: "#666",
          }}
        >
          <p style={{ fontSize: "14px", margin: 0 }}>No runs yet</p>
          <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>
            Launch an agent or swarm to see runs here
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
