import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { trpc } from "../../lib/trpc";

type RunStatus = "running" | "success" | "failed" | "awaiting_approval";

function badgeColor(status: RunStatus | string): string {
  if (status === "running") return "#2563eb";
  if (status === "success") return "#16a34a";
  if (status === "failed") return "#dc2626";
  if (status === "awaiting_approval") return "#d97706";
  return "#64748b";
}

export default function AdminAgentChat() {
  const [, setLocation] = useLocation();
  const [composerText, setComposerText] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const runtimeQ = trpc.operatorOS.getRuntimeStatus.useQuery();
  const runsQ = trpc.operatorOS.listRuns.useQuery({ limit: 20, offset: 0 });
  const approvalsQ = trpc.operatorOS.pendingProposals.useQuery({ limit: 10, offset: 0 });
  const artifactsQ = trpc.operatorOS.listArtifacts.useQuery({ limit: 20, offset: 0 });

  const launchRunMut = trpc.operatorOS.launchInstanceRun.useMutation();

  const runs = runsQ.data?.runs ?? [];
  const selectedRun = useMemo(
    () => runs.find((r: any) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const runtimeStatus = runtimeQ.data?.status ?? "offline";
  const runtimeColor =
    runtimeStatus === "healthy"
      ? "#16a34a"
      : runtimeStatus === "degraded"
      ? "#d97706"
      : "#dc2626";

  async function handleStartRun() {
    const first = runs[0] as any;
    const projectId = first?.projectId ?? 1;
    const instanceId = first?.agentInstanceId ?? 1;
    await launchRunMut.mutateAsync({
      projectId,
      agentInstanceId: instanceId,
      goal: "Operator-launched run from AdminAgentChat",
    });
    await runsQ.refetch();
  }

  function handleOpenArtifacts() {
    setLocation("/admin/console/files");
  }

  function handleOpenApprovals() {
    setLocation("/admin/console/approvals");
  }

  return (
    <AdminLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "calc(100vh - 140px)" }}>
        <div
          style={{
            border: "1px solid #334155",
            background: "#0f172a",
            color: "#cbd5e1",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
          }}
        >
          Chat transport is not wired to backend yet. This page shows real runtime/runs/artifacts/approvals data and keeps chat actions explicitly disabled until endpoints are implemented.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 12, flex: 1 }}>
          <section style={{ border: "1px solid #27272a", background: "#111827", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #27272a", fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>
              Recent Runs
            </div>
            <div style={{ padding: 8, maxHeight: "62vh", overflow: "auto" }}>
              {runsQ.isLoading && <div style={{ color: "#94a3b8", fontSize: 12, padding: 8 }}>Loading runs...</div>}
              {runsQ.isError && <div style={{ color: "#fca5a5", fontSize: 12, padding: 8 }}>Failed to load runs.</div>}
              {!runsQ.isLoading && !runsQ.isError && runs.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 12, padding: 8 }}>No runs found.</div>
              )}
              {runs.map((run: any) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 8,
                    border: selectedRunId === run.id ? "1px solid #f97316" : "1px solid #334155",
                    borderRadius: 8,
                    background: selectedRunId === run.id ? "#1f2937" : "#0b1220",
                    color: "#e2e8f0",
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>Run #{run.id}</div>
                    <span
                      style={{
                        fontSize: 10,
                        borderRadius: 999,
                        padding: "2px 8px",
                        color: "#fff",
                        background: badgeColor(run.status),
                        textTransform: "uppercase",
                        fontWeight: 700,
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#93c5fd" }}>{String(run.goal ?? "").slice(0, 90) || "No goal"}</div>
                </button>
              ))}
            </div>
          </section>

          <section style={{ border: "1px solid #27272a", background: "#111827", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #27272a", fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>
              Agent Chat Workspace
            </div>

            <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
              <div style={{ border: "1px dashed #475569", borderRadius: 10, padding: 16, color: "#94a3b8", fontSize: 13, background: "#020617" }}>
                <div style={{ fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>Message Transport: Not Wired</div>
                <div>Real-time conversation endpoints are not currently available in this repo. UI is intentionally non-mock and read-only for operational safety.</div>
                <div style={{ marginTop: 8 }}>Use the right panel and bottom controls for run operations.</div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #27272a", padding: 12, display: "flex", gap: 8 }}>
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Chat input disabled until backend transport is wired."
                rows={2}
                disabled
                style={{
                  flex: 1,
                  resize: "none",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#64748b",
                  padding: 10,
                  fontSize: 13,
                }}
              />
              <button
                disabled
                style={{
                  border: "1px solid #334155",
                  background: "#1f2937",
                  color: "#64748b",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: "not-allowed",
                }}
                title="Not wired yet"
              >
                Send
              </button>
            </div>
          </section>

          <section style={{ border: "1px solid #27272a", background: "#111827", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #27272a", fontWeight: 700, color: "#e2e8f0", fontSize: 13 }}>
              Run Context
            </div>
            <div style={{ padding: 12, fontSize: 12, color: "#cbd5e1", display: "grid", gap: 12 }}>
              <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 10, background: "#0b1220" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Runtime Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: runtimeColor, display: "inline-block" }} />
                  <strong style={{ color: "#e2e8f0", textTransform: "capitalize" }}>{runtimeStatus}</strong>
                </div>
              </div>

              <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 10, background: "#0b1220" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Selected Run</div>
                {selectedRun ? (
                  <div>
                    <div style={{ fontWeight: 700 }}>#{selectedRun.id}</div>
                    <div style={{ marginTop: 4 }}>{String(selectedRun.goal ?? "").slice(0, 140)}</div>
                  </div>
                ) : (
                  <div style={{ color: "#94a3b8" }}>Select a run from left panel.</div>
                )}
              </div>

              <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 10, background: "#0b1220" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Artifacts</div>
                {artifactsQ.isLoading && <div>Loading artifacts...</div>}
                {!artifactsQ.isLoading && (
                  <div>
                    Count: <strong>{artifactsQ.data?.total ?? 0}</strong>
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 10, background: "#0b1220" }}>
                <div style={{ color: "#94a3b8", marginBottom: 6 }}>Pending Approvals</div>
                {approvalsQ.isLoading && <div>Loading approvals...</div>}
                {!approvalsQ.isLoading && (
                  <div>
                    Count: <strong>{approvalsQ.data?.total ?? 0}</strong>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 10,
            border: "1px solid #1f2937",
            background: "#020617",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => void handleStartRun()}
            disabled={launchRunMut.isPending}
            style={{
              background: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: launchRunMut.isPending ? "wait" : "pointer",
            }}
          >
            {launchRunMut.isPending ? "Starting..." : "Start Run"}
          </button>
          <button
            disabled
            title="Stop run action is not wired on this page"
            style={{
              background: "#334155",
              color: "#cbd5e1",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "not-allowed",
            }}
          >
            Stop Run
          </button>
          <button
            onClick={handleOpenArtifacts}
            style={{
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Open Artifacts
          </button>
          <button
            onClick={handleOpenApprovals}
            style={{
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Open Approvals
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
