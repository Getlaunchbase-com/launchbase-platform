import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, Pause, Search, Square, Zap } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

export default function AdminAgentChat() {
  const [, setLocation] = useLocation();
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "failed" | "awaiting_approval">("all");
  const [runGoal, setRunGoal] = useState("");
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const runtimeQuery = trpc.admin.operatorOS.getRuntimeStatus.useQuery();
  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 50, offset: 0 });
  const artifactsQuery = trpc.admin.operatorOS.listArtifacts.useQuery({ limit: 20, offset: 0 });
  const approvalsQuery = trpc.admin.operatorOS.pendingProposals.useQuery({ limit: 20, offset: 0 });
  const launchRunMut = trpc.admin.operatorOS.launchInstanceRun.useMutation({
    onSuccess: async (data) => {
      setLaunchMessage(`Run #${data.runId} started.`);
      setRunGoal("");
      await utils.admin.operatorOS.listRuns.invalidate();
    },
    onError: (err) => {
      setLaunchMessage(err.message || "Failed to start run.");
    },
  });

  const allRuns = runsQuery.data?.runs ?? [];
  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRuns.filter((run) => {
      const statusOk = filter === "all" || run.status === filter;
      const text = `${run.id} ${run.goal ?? ""} ${run.model ?? ""}`.toLowerCase();
      const searchOk = !q || text.includes(q);
      return statusOk && searchOk;
    });
  }, [allRuns, filter, searchQuery]);

  const activeRun = useMemo(
    () =>
      filteredRuns.find((r) => r.status === "running") ??
      filteredRuns.find((r) => r.status === "awaiting_approval") ??
      filteredRuns[0],
    [filteredRuns]
  );

  const pendingApprovals = approvalsQuery.data?.proposals ?? [];
  const recentArtifacts = artifactsQuery.data?.artifacts ?? [];

  const runtimeStatus = runtimeQuery.data?.status ?? "offline";
  const runtimeHealthy = runtimeStatus === "healthy";
  const canStart = runtimeHealthy && !!activeRun && activeRun.projectId != null && activeRun.agentInstanceId != null;
  const stopReason = "Stop/pause mutation is not available in current router.";
  const startReason = !runtimeHealthy
    ? "Runtime is not healthy."
    : !activeRun
      ? "No run context selected."
      : activeRun.projectId == null || activeRun.agentInstanceId == null
        ? "Selected run has no project or instance."
        : null;

  async function onStartRun() {
    if (!activeRun || activeRun.projectId == null || activeRun.agentInstanceId == null) return;
    const goal = runGoal.trim() || activeRun.goal || `Operator run ${new Date().toISOString()}`;
    await launchRunMut.mutateAsync({
      projectId: activeRun.projectId,
      agentInstanceId: activeRun.agentInstanceId,
      goal,
      model: activeRun.model ?? undefined,
    });
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: "12px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "10px", padding: "12px 14px", color: "#d9d9d9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <AlertCircle size={14} style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Chat Transport Not Wired
          </span>
        </div>
        <div style={{ fontSize: "13px", color: "#9a9a9a" }}>
          Message send is disabled. This page shows live operator context only (runtime, runs, artifacts, approvals).
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 320px", gap: "12px", minHeight: "calc(100vh - 190px)" }}>
        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px", borderBottom: "1px solid #333" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#666" }} />
              <input
                type="text"
                placeholder="Search runs by id, goal, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  paddingLeft: "28px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#666")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#333")}
              />
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              {(["all", "running", "awaiting_approval", "failed"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  style={{
                    padding: "6px 8px",
                    border: `1px solid ${filter === value ? "#ff6b35" : "#333"}`,
                    backgroundColor: filter === value ? "rgba(255, 107, 53, 0.14)" : "#111",
                    color: filter === value ? "#ffb59a" : "#999",
                    fontSize: "11px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255, 107, 53, 0.35)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  {value.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            {runsQuery.isLoading && <StateText label="Loading runs..." />}
            {runsQuery.error && <StateText label="Failed to load runs." tone="error" />}
            {!runsQuery.isLoading && !runsQuery.error && filteredRuns.length === 0 && (
              <StateText label="No runs match current filters." />
            )}
            {filteredRuns.map((run) => (
              <div
                key={run.id}
                style={{
                  padding: "10px",
                  margin: "4px 0",
                  borderRadius: "6px",
                  border: activeRun?.id === run.id ? "1px solid #ff6b35" : "1px solid #2a2a2a",
                  backgroundColor: activeRun?.id === run.id ? "rgba(255,107,53,0.10)" : "#111",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#eee", fontWeight: 700 }}>Run #{run.id}</div>
                  <StatusPill status={run.status} />
                </div>
                <div style={{ fontSize: "12px", color: "#9a9a9a", marginTop: "4px", lineHeight: 1.4 }}>
                  {(run.goal ?? "No goal provided").slice(0, 80)}
                </div>
                <div style={{ fontSize: "11px", color: "#666", marginTop: "6px" }}>
                  Model: {run.model ?? "default"} | {formatDate(run.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #333",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Operator Workspace</h2>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
                Live runtime + run context
              </div>
            </div>
            <StatusPill status={runtimeStatus} labelPrefix="Runtime" />
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Card title="Runtime Status">
              {runtimeQuery.isLoading && <StateText label="Loading runtime status..." />}
              {runtimeQuery.error && <StateText label="Failed to load runtime status." tone="error" />}
              {runtimeQuery.data && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Kv label="Status" value={runtimeQuery.data.status} />
                  <Kv label="Handshake" value={runtimeQuery.data.handshakeOk ? "OK" : "Not connected"} />
                  <Kv label="Vertex" value={runtimeQuery.data.vertex ?? "n/a"} />
                  <Kv label="Version" value={runtimeQuery.data.version ?? "n/a"} />
                  <Kv label="Response ms" value={String(runtimeQuery.data.responseTimeMs ?? "n/a")} />
                  <Kv label="Last seen" value={runtimeQuery.data.lastSeen ? formatDate(runtimeQuery.data.lastSeen) : "n/a"} />
                </div>
              )}
              {runtimeQuery.data?.violations && runtimeQuery.data.violations.length > 0 && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#f59e0b" }}>
                  Violations: {runtimeQuery.data.violations.join(", ")}
                </div>
              )}
            </Card>

            <Card title="Current Run">
              {!activeRun ? (
                <StateText label="No run selected." />
              ) : (
                <>
                  <div style={{ fontSize: "13px", color: "#ddd", fontWeight: 700 }}>Run #{activeRun.id}</div>
                  <div style={{ fontSize: "12px", color: "#9a9a9a", marginTop: "6px", lineHeight: 1.5 }}>
                    {activeRun.goal ?? "No goal set."}
                  </div>
                  <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <Kv label="Status" value={activeRun.status} />
                    <Kv label="Model" value={activeRun.model ?? "default"} />
                    <Kv label="Project" value={String(activeRun.projectId ?? "n/a")} />
                    <Kv label="Instance" value={String(activeRun.agentInstanceId ?? "n/a")} />
                  </div>
                </>
              )}
            </Card>

            <Card title="Operator Notes">
              <label style={{ display: "block", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "#777", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                  Run Goal Override
                </span>
                <input
                  value={runGoal}
                  onChange={(e) => setRunGoal(e.target.value)}
                  placeholder="Optional: set goal for Start Run"
                  style={{
                    marginTop: "6px",
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#0f0f0f",
                    color: "#ddd",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Add internal notes (not sent to agent)."
                style={{
                  width: "100%",
                  minHeight: "120px",
                  resize: "vertical",
                  padding: "10px",
                  backgroundColor: "#0f0f0f",
                  color: "#ddd",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  fontSize: "13px",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#666";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255,107,53,0.2)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#333";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <div style={{ fontSize: "11px", color: "#777", marginTop: "6px" }}>
                {inputText.length} chars | Send disabled until chat transport router is added.
              </div>
              {launchMessage && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: launchMessage.includes("started") ? "#22c55e" : "#ef4444" }}>
                  {launchMessage}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflow: "auto",
          }}
        >
          <Card title="Pending Approvals">
            {approvalsQuery.isLoading && <StateText label="Loading approvals..." />}
            {approvalsQuery.error && <StateText label="Failed to load approvals." tone="error" />}
            {!approvalsQuery.isLoading && !approvalsQuery.error && pendingApprovals.length === 0 && (
              <StateText label="No pending approvals." />
            )}
            {pendingApprovals.slice(0, 4).map((proposal) => (
              <div key={proposal.id} style={{ padding: "8px", border: "1px solid #2a2a2a", borderRadius: "6px", marginBottom: "6px" }}>
                <div style={{ fontSize: "12px", color: "#eee", fontWeight: 600 }}>
                  Proposal #{proposal.id}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  {proposal.title ?? "Untitled proposal"}
                </div>
              </div>
            ))}
          </Card>

          <Card title="Artifacts">
            {artifactsQuery.isLoading && <StateText label="Loading artifacts..." />}
            {artifactsQuery.error && <StateText label="Failed to load artifacts." tone="error" />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && recentArtifacts.length === 0 && (
              <StateText label="No artifacts yet." />
            )}
            {recentArtifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.id} style={{ padding: "8px", border: "1px solid #2a2a2a", borderRadius: "6px", marginBottom: "6px" }}>
                <div style={{ fontSize: "12px", color: "#e8e8e8", fontWeight: 600 }}>
                  {artifact.filename}
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  {artifact.type} | {formatDate(artifact.createdAt)}
                </div>
              </div>
            ))}
          </Card>

          <Card title="Run Metrics">
            <Kv label="Runs loaded" value={String(allRuns.length)} />
            <Kv label="Artifacts loaded" value={String(recentArtifacts.length)} />
            <Kv label="Approvals pending" value={String(pendingApprovals.length)} />
            <Kv label="Runtime healthy" value={runtimeHealthy ? "Yes" : "No"} />
          </Card>
        </div>
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: "12px",
          backgroundColor: "#141414",
          border: "1px solid #333",
          borderRadius: "10px",
          padding: "10px",
          display: "flex",
          gap: "8px",
          zIndex: 20,
          flexWrap: "wrap",
        }}
      >
        <button
          disabled={!canStart || launchRunMut.isPending}
          onClick={onStartRun}
          style={actionBtn(!canStart || launchRunMut.isPending ? "#333" : "#ff6b35", !canStart || launchRunMut.isPending)}
          title={startReason ?? "Launch instance run (existing endpoint)."}
        >
          <Zap size={14} />
          {launchRunMut.isPending ? "Starting..." : "Start Run"}
        </button>
        <button disabled title={stopReason} style={actionBtn("#2a2a2a", true)}>
          <Square size={13} />
          Stop Run
        </button>
        <button disabled title={stopReason} style={actionBtn("#2a2a2a", true)}>
          <Pause size={13} />
          Pause
        </button>
        <button style={actionBtn("#222", false)} onClick={() => setLocation("/admin/console/files")}>
          Open Artifacts ({recentArtifacts.length})
        </button>
        <button style={actionBtn(pendingApprovals.length > 0 ? "#ff6b35" : "#222", false)} onClick={() => setLocation("/admin/console/approvals")}>
          Open Approvals ({pendingApprovals.length})
        </button>
      </div>
    </AdminLayout>
  );
}

function StateText({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return (
    <div style={{ fontSize: "12px", color: tone === "error" ? "#ef4444" : "#777", padding: "8px 0" }}>
      {label}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px" }}>
      <div style={{ fontSize: "10px", color: "#777", textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </div>
      <div style={{ fontSize: "12px", color: "#e8e8e8", marginTop: "4px", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #303030", borderRadius: "8px", padding: "10px", backgroundColor: "#121212" }}>
      <div style={{ fontSize: "12px", color: "#cfcfcf", marginBottom: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status, labelPrefix }: { status: string; labelPrefix?: string }) {
  const color =
    status === "running" || status === "healthy"
      ? "#22c55e"
      : status === "failed" || status === "offline"
        ? "#ef4444"
        : status === "awaiting_approval"
          ? "#f59e0b"
          : "#60a5fa";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.3px",
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}66`,
        backgroundColor: `${color}1f`,
        borderRadius: "999px",
        padding: "2px 8px",
      }}
    >
      {labelPrefix ? `${labelPrefix}: ` : ""}
      {status}
    </span>
  );
}

function actionBtn(backgroundColor: string, disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #333",
    backgroundColor,
    color: disabled ? "#666" : backgroundColor === "#ff6b35" ? "#111" : "#ddd",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    outline: "none",
    minHeight: "40px",
  };
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
