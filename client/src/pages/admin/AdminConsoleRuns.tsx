import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { Search } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

export default function AdminConsoleRuns() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "status">("recent");

  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 100, offset: 0 });
  const runs = runsQuery.data?.runs ?? [];

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = runs.filter((run) => {
      const statusOk = filterStatus === "all" || run.status === filterStatus;
      const searchText = `${run.id} ${run.goal ?? ""} ${run.model ?? ""}`.toLowerCase();
      return statusOk && (!q || searchText.includes(q));
    });
    if (sortBy === "status") {
      rows = [...rows].sort((a, b) => (a.status < b.status ? -1 : a.status > b.status ? 1 : 0));
    } else {
      rows = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return rows;
  }, [runs, filterStatus, searchQuery, sortBy]);

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.2px", margin: "0 0 8px 0" }}>Runs</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 24px 0" }}>
          Monitor and inspect agent runs
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "18px" }}>
          <div>
            <label style={labelStyle}>Search</label>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#666" }} />
              <input
                type="text"
                placeholder="Run ID, goal, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "28px" }}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="success">Completed</option>
              <option value="failed">Failed</option>
              <option value="awaiting_approval">Awaiting Approval</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sort</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "recent" | "status")} style={inputStyle}>
              <option value="recent">Recent</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        <section style={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px 160px 110px", gap: "12px", padding: "12px 14px", borderBottom: "1px solid #333", fontSize: "10px", color: "#777", fontWeight: 700, textTransform: "uppercase" }}>
            <span>ID</span>
            <span>Goal</span>
            <span>Status</span>
            <span>Start Time</span>
            <span>Actions</span>
          </div>

          {runsQuery.isLoading && <Empty text="Loading runs..." />}
          {runsQuery.error && <Empty text="Failed to load runs." tone="error" />}
          {!runsQuery.isLoading && !runsQuery.error && filteredRuns.length === 0 && <Empty text="No runs match filters." />}

          {!runsQuery.isLoading && !runsQuery.error && filteredRuns.map((run) => (
            <div key={run.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px 160px 110px", gap: "12px", padding: "12px 14px", borderBottom: "1px solid #262626", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "#f0f0f0", fontWeight: 700 }}>#{run.id}</div>
              <div style={{ fontSize: "12px", color: "#cfcfcf" }}>{(run.goal ?? "No goal").slice(0, 90)}</div>
              <Badge text={run.status} />
              <div style={{ fontSize: "11px", color: "#888" }}>{formatDate(run.createdAt)}</div>
              <button
                onClick={() => setLocation("/admin/console/files")}
                style={{ border: "1px solid #3a3a3a", background: "#111", color: "#ddd", borderRadius: "7px", padding: "7px 10px", fontSize: "12px", cursor: "pointer" }}
              >
                View
              </button>
            </div>
          ))}
        </section>
      </div>
    </AdminLayout>
  );
}

function Empty({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return <div style={{ padding: "24px", color: tone === "error" ? "#ef4444" : "#777", fontSize: "13px", textAlign: "center" }}>{text}</div>;
}

function Badge({ text }: { text: string }) {
  const color = text === "running" ? "#22c55e" : text === "failed" ? "#ef4444" : text === "awaiting_approval" ? "#f59e0b" : "#60a5fa";
  return (
    <span style={{ width: "fit-content", fontSize: "10px", color, border: `1px solid ${color}66`, background: `${color}1f`, borderRadius: "999px", padding: "2px 8px", textTransform: "uppercase", fontWeight: 700 }}>
      {text}
    </span>
  );
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#777",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  display: "block",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0f0f0f",
  border: "1px solid #333",
  borderRadius: "6px",
  color: "#e0e0e0",
  fontSize: "12px",
  padding: "8px",
  outline: "none",
};
