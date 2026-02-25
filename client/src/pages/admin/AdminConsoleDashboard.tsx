import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, CheckCircle, Clock, Zap, TrendingUp, Play, MessageSquare } from "../../components/Icons";
import trpc from "../../lib/trpc";
import { Link } from "wouter";

export default function AdminConsoleDashboard() {
  const runtimeQ = trpc.admin.operatorOS.getRuntimeStatus.useQuery(undefined, { retry: false });
  const freezeQ = trpc.admin.operatorOS.freezeStatusBanner.useQuery(undefined, { retry: false });
  const securityQ = trpc.admin.operatorOS.securityOverview.useQuery(undefined, { retry: false });
  const feedbackQ = trpc.admin.operatorOS.feedbackOverview.useQuery({}, { retry: false });
  const pendingQ = trpc.admin.operatorOS.pendingProposals.useQuery({}, { retry: false });
  const instancesQ = trpc.admin.agentInstances.list.useQuery({}, { retry: false });

  const runtime = runtimeQ.data;
  const freeze = freezeQ.data;
  const security = securityQ.data;
  const feedback = feedbackQ.data;
  const pending = pendingQ.data;
  const instances = instancesQ.data;

  const healthColor =
    runtime?.status === "healthy" ? "#22c55e" :
    runtime?.status === "warning" ? "#f59e0b" :
    runtime?.status === "mismatch" ? "#ef4444" :
    runtime?.status === "offline" ? "#ef4444" : "#666";

  const healthLabel =
    runtime?.status === "healthy" ? "Healthy" :
    runtime?.status === "warning" ? "Warning" :
    runtime?.status === "mismatch" ? "Mismatch" :
    runtime?.status === "offline" ? "Offline" :
    runtimeQ.isLoading ? "Loading..." : "Unknown";

  const instanceList = (instances as any)?.instances ?? [];
  const instanceCount = Array.isArray(instanceList) ? instanceList.length : 0;
  const openFeedback = (feedback as any)?.summary?.byStatus?.find((s: any) => s.status === "open")?.count ?? 0;
  const pendingList = (pending as any)?.proposals ?? [];
  const pendingCount = Array.isArray(pendingList) ? pendingList.length : 0;

  return (
    <AdminLayout>
      <div>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Console</h1>
          <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>System overview and quick actions</p>
        </div>

        {/* Freeze Banner */}
        {(freeze as any)?.frozen && (
          <div style={{
            padding: "12px 16px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#ef4444",
            fontWeight: "600",
          }}>
            Vertex frozen: {(freeze as any).vertex} v{(freeze as any).version} — hot patches disabled
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
          <Link href="/admin/console/agent-chat">
            <a style={{
              padding: "16px 20px", backgroundColor: "#ff6b35", color: "#000", border: "none",
              borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              textDecoration: "none", transition: "all 0.2s",
            }}>
              <MessageSquare size={16} /> New Agent Chat
            </a>
          </Link>
          <Link href="/admin/console/runs">
            <a style={{
              padding: "16px 20px", backgroundColor: "#333", color: "#e0e0e0", border: "none",
              borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              textDecoration: "none", transition: "all 0.2s",
            }}>
              <Zap size={16} /> View Runs
            </a>
          </Link>
        </div>

        {/* System Health Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Agent Health</div>
              <CheckCircle size={18} style={{ color: healthColor }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: healthColor }}>{healthLabel}</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              {runtime?.vertex ? `${runtime.vertex} v${runtime.version}` : "No agent connected"}
            </div>
          </div>

          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Agent Instances</div>
              <Play size={18} style={{ color: "#ff6b35" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>
              {instancesQ.isLoading ? "..." : instanceCount}
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>Registered instances</div>
          </div>

          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Open Feedback</div>
              <TrendingUp size={18} style={{ color: "#3b82f6" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>
              {feedbackQ.isLoading ? "..." : openFeedback}
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>Needs attention</div>
          </div>

          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Security (7d)</div>
              <Clock size={18} style={{ color: "#a78bfa" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>
              {securityQ.isLoading ? "..." : ((security as any)?.totalEvents ?? 0)}
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              {(security as any)?.rateLimitViolations ?? 0} rate limit violations
            </div>
          </div>
        </div>

        {/* Approvals & Runtime */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <CheckCircle size={16} style={{ color: "#ff6b35" }} />
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>Pending Approvals</h2>
              {pendingCount > 0 && (
                <span style={{ backgroundColor: "#ff6b35", color: "#000", borderRadius: "9999px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>{pendingCount}</span>
              )}
            </div>
            {pendingQ.isLoading ? (
              <div style={{ fontSize: "13px", color: "#666" }}>Loading...</div>
            ) : pendingCount === 0 ? (
              <div style={{ fontSize: "13px", color: "#666" }}>No pending approvals</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pendingList.slice(0, 5).map((p: any) => (
                  <div key={p.id} style={{ padding: "8px", backgroundColor: "#0f0f0f", borderRadius: "4px", fontSize: "13px" }}>
                    <div style={{ color: "#e0e0e0", fontWeight: "600" }}>{p.title}</div>
                    <div style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>
                      {p.changeType?.replace(/_/g, " ")} — {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <AlertCircle size={16} style={{ color: healthColor }} />
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>Runtime Status</h2>
            </div>
            {runtimeQ.isLoading ? (
              <div style={{ fontSize: "13px", color: "#666" }}>Checking agent health...</div>
            ) : !runtime ? (
              <div style={{ fontSize: "13px", color: "#666" }}>No agent runtime data available</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "13px" }}>
                  <span style={{ color: "#666" }}>Handshake: </span>
                  <span style={{ color: runtime.handshakeOk ? "#22c55e" : "#ef4444", fontWeight: "600" }}>
                    {runtime.handshakeOk ? "OK" : "FAILED"}
                  </span>
                </div>
                <div style={{ fontSize: "13px" }}>
                  <span style={{ color: "#666" }}>Response: </span>
                  <span style={{ color: "#e0e0e0" }}>{runtime.responseTimeMs ?? "—"}ms</span>
                </div>
                {runtime.violations && (runtime.violations as any[]).length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: "600", marginBottom: "4px" }}>
                      Violations ({(runtime.violations as any[]).length})
                    </div>
                    {(runtime.violations as any[]).slice(0, 3).map((v: any, i: number) => (
                      <div key={i} style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>{v.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agent Instances */}
        <div style={{ padding: "20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 16px 0" }}>Agent Instances</h2>
          {instancesQ.isLoading ? (
            <div style={{ fontSize: "13px", color: "#666" }}>Loading instances...</div>
          ) : instanceCount === 0 ? (
            <div style={{ fontSize: "13px", color: "#666" }}>No agent instances registered</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
              {instanceList.slice(0, 6).map((inst: any) => (
                <div key={inst.id} style={{ padding: "12px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
                  <div style={{ fontSize: "12px", color: "#666" }}>#{inst.id}</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>{inst.displayName || `Instance ${inst.id}`}</div>
                  <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>{inst.status || "unknown"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
