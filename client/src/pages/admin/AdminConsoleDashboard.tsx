import { useMemo } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, CheckCircle, Clock, MessageSquare, Play, TrendingUp, Zap } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

export default function AdminConsoleDashboard() {
  const [, setLocation] = useLocation();
  const runtimeQuery = trpc.admin.operatorOS.getRuntimeStatus.useQuery();
  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 20, offset: 0 });
  const artifactsQuery = trpc.admin.operatorOS.listArtifacts.useQuery({ limit: 20, offset: 0 });
  const approvalsQuery = trpc.admin.operatorOS.pendingProposals.useQuery({ limit: 20, offset: 0 });

  const runs = runsQuery.data?.runs ?? [];
  const runtime = runtimeQuery.data;
  const pendingApprovals = approvalsQuery.data?.proposals ?? [];
  const activeRuns = runs.filter((run) => run.status === "running").length;

  const avgRuntime = useMemo(() => {
    if (!runtime?.responseTimeMs) return "n/a";
    return `${runtime.responseTimeMs} ms`;
  }, [runtime]);

  return (
    <AdminLayout>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.2px", margin: "0 0 8px 0" }}>
          Operator Console
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
          {new Date().toLocaleString()} | Live agent stack overview
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <StatusCard
          label="System Health"
          value={runtime?.status ?? "offline"}
          sub={runtime?.handshakeOk ? "Handshake OK" : "Handshake not connected"}
          icon={<CheckCircle size={16} style={{ color: runtime?.status === "healthy" ? "#22c55e" : "#ef4444" }} />}
        />
        <StatusCard
          label="Active Runs"
          value={String(activeRuns)}
          sub={`${runs.length} total loaded`}
          icon={<Play size={16} style={{ color: "#ff6b35" }} />}
        />
        <StatusCard
          label="Pending Approvals"
          value={String(pendingApprovals.length)}
          sub={pendingApprovals.length > 0 ? "Review required" : "No approvals waiting"}
          icon={<AlertCircle size={16} style={{ color: pendingApprovals.length > 0 ? "#f59e0b" : "#22c55e" }} />}
        />
        <StatusCard
          label="Response Time"
          value={avgRuntime}
          sub="Runtime monitor"
          icon={<Clock size={16} style={{ color: "#60a5fa" }} />}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        <ActionButton label="New Chat Session" icon={<MessageSquare size={14} />} onClick={() => setLocation("/admin/agent/chat")} primary />
        <ActionButton label="View All Runs" icon={<Zap size={14} />} onClick={() => setLocation("/admin/console/runs")} />
        <ActionButton label="Manage Tools" icon={<TrendingUp size={14} />} onClick={() => setLocation("/admin/console/tools")} />
        <ActionButton label="Settings" icon={<Clock size={14} />} onClick={() => setLocation("/admin/console/settings")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
        <section style={panelStyle}>
          <h2 style={sectionTitle}>Recent Runs</h2>
          {runsQuery.isLoading && <MetaText text="Loading runs..." />}
          {runsQuery.error && <MetaText text="Failed to load runs." tone="error" />}
          {!runsQuery.isLoading && !runsQuery.error && runs.length === 0 && <MetaText text="No runs available." />}
          {runs.slice(0, 8).map((run) => (
            <button
              key={run.id}
              onClick={() => setLocation("/admin/console/runs")}
              style={{
                width: "100%",
                marginBottom: "8px",
                border: "1px solid #2f2f2f",
                borderRadius: "8px",
                backgroundColor: "#101010",
                color: "#ddd",
                padding: "10px",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700 }}>Run #{run.id}</span>
                <Badge text={run.status} />
              </div>
              <div style={{ fontSize: "11px", color: "#8b8b8b", marginTop: "4px" }}>
                {formatDate(run.createdAt)} | {run.model ?? "default"}
              </div>
            </button>
          ))}
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitle}>Approvals + Artifacts</h2>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", color: "#777", textTransform: "uppercase", marginBottom: "6px" }}>Pending approvals</div>
            {approvalsQuery.isLoading && <MetaText text="Loading approvals..." />}
            {approvalsQuery.error && <MetaText text="Failed to load approvals." tone="error" />}
            {!approvalsQuery.isLoading && !approvalsQuery.error && pendingApprovals.length === 0 && <MetaText text="No pending approvals." />}
            {pendingApprovals.slice(0, 4).map((proposal) => (
              <div key={proposal.id} style={{ fontSize: "12px", color: "#d7d7d7", marginBottom: "6px", border: "1px solid #2f2f2f", borderRadius: "6px", padding: "8px" }}>
                #{proposal.id} {proposal.title ?? "Untitled"}
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#777", textTransform: "uppercase", marginBottom: "6px" }}>Recent artifacts</div>
            {artifactsQuery.isLoading && <MetaText text="Loading artifacts..." />}
            {artifactsQuery.error && <MetaText text="Failed to load artifacts." tone="error" />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && (artifactsQuery.data?.artifacts ?? []).slice(0, 5).map((artifact) => (
              <div key={artifact.id} style={{ fontSize: "12px", color: "#ccc", marginBottom: "6px" }}>
                {artifact.filename} <span style={{ color: "#777" }}>({artifact.type})</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

function StatusCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div style={{ padding: "16px", backgroundColor: "#1a1a1a", borderRadius: "10px", border: "1px solid #333" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ fontSize: "10px", color: "#777", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
        {icon}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: "#efefef" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#777", marginTop: "6px" }}>{sub}</div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, primary = false }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: "40px",
        padding: "12px 18px",
        borderRadius: "8px",
        border: primary ? "none" : "1px solid #333",
        backgroundColor: primary ? "#ff6b35" : "#1a1a1a",
        color: primary ? "#111" : "#ddd",
        fontSize: "13px",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function MetaText({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return <div style={{ fontSize: "12px", color: tone === "error" ? "#ef4444" : "#777", marginBottom: "8px" }}>{text}</div>;
}

function Badge({ text }: { text: string }) {
  const color = text === "running" ? "#22c55e" : text === "failed" ? "#ef4444" : text === "awaiting_approval" ? "#f59e0b" : "#60a5fa";
  return (
    <span style={{ fontSize: "10px", color, border: `1px solid ${color}66`, background: `${color}1f`, borderRadius: "999px", padding: "2px 8px", textTransform: "uppercase", fontWeight: 700 }}>
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

const panelStyle: React.CSSProperties = {
  padding: "16px",
  backgroundColor: "#1a1a1a",
  borderRadius: "10px",
  border: "1px solid #333",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  margin: "0 0 12px 0",
};
