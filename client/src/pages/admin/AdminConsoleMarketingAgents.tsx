import { useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Play, Pause, Square, ChevronDown } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleMarketingAgents() {
  const instancesQ = trpc.admin.agentInstances.list.useQuery({}, { retry: false });
  const flagsQ = trpc.admin.marketingAgents.getFeatureFlags.useQuery(undefined, { retry: false });
  const lanesQ = trpc.admin.marketingAgents.getModelLanes.useQuery(undefined, { retry: false });
  const cyclesQ = trpc.admin.marketingAgents.listCycles.useQuery({ limit: 20 }, { retry: false });
  const scoreQ = trpc.admin.marketingAgents.getScorecard.useQuery({ days: 14 }, { retry: false });
  const promotionQ = trpc.admin.marketingAgents.listPromotionQueue.useQuery({ limit: 25 }, { retry: false });

  const instances = (instancesQ.data as any)?.instances ?? [];
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [vertical, setVertical] = useState<
    "small-business-websites" | "quickbooks-integration" | "workflow-automation" | "agents-apps-automation"
  >("small-business-websites");
  const [engine, setEngine] = useState<"standard" | "pi-sandbox" | "pi-coder-sandbox" | "obliterated-sandbox">(
    "standard"
  );
  const [mode, setMode] = useState<"research" | "execute">("research");
  const [primaryModel, setPrimaryModel] = useState("anthropic/claude-sonnet-4-6");
  const [reviewModel, setReviewModel] = useState("anthropic/claude-sonnet-4-6");
  const [parallelCompare, setParallelCompare] = useState(true);
  const [notes, setNotes] = useState("");
  const [promotionNotes, setPromotionNotes] = useState<Record<string, string>>({});

  const updateMut = trpc.admin.agentInstances.update.useMutation({
    onSuccess: () => instancesQ.refetch(),
  });

  const runCycleMut = trpc.admin.marketingAgents.runCycle.useMutation({
    onSuccess: () => {
      cyclesQ.refetch();
      scoreQ.refetch();
      setNotes("");
    },
  });

  const processQueuedMut = trpc.admin.marketingAgents.processQueuedCycles.useMutation({
    onSuccess: () => {
      cyclesQ.refetch();
      scoreQ.refetch();
      promotionQ.refetch();
    },
  });

  const reviewPromotionMut = trpc.admin.marketingAgents.reviewPromotion.useMutation({
    onSuccess: () => {
      promotionQ.refetch();
    },
  });

  const flags = (flagsQ.data as any)?.flags ?? {
    enablePiSandbox: true,
    enablePiCoderSandbox: true,
    enableObliteratedSandbox: true,
    allowSandboxExecute: false,
  };

  const engineOptions = useMemo(
    () =>
      [
        { value: "standard", label: "Standard (Governed)" },
        { value: "pi-sandbox", label: "PI Sandbox", disabled: !flags.enablePiSandbox },
        { value: "pi-coder-sandbox", label: "PI Coder Sandbox", disabled: !flags.enablePiCoderSandbox },
        {
          value: "obliterated-sandbox",
          label: "Obliterated Sandbox",
          disabled: !flags.enableObliteratedSandbox,
        },
      ] as const,
    [flags.enableObliteratedSandbox, flags.enablePiCoderSandbox, flags.enablePiSandbox]
  );

  const cycleRows = ((cyclesQ.data as any)?.rows ?? []) as any[];
  const modelLanes = ((lanesQ.data as any)?.lanes ?? []) as any[];
  const breakthroughRows = cycleRows.filter((r) => Boolean(r?.meta?.breakthroughAlert));

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

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#e0e0e0" }}>
            Vertical Learning Cycle Runner
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px", marginBottom: "10px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Vertical
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as any)}
                style={{ backgroundColor: "#0f0f0f", color: "#ddd", border: "1px solid #333", borderRadius: "6px", padding: "8px" }}
              >
                <option value="small-business-websites">Small Business Websites</option>
                <option value="quickbooks-integration">QuickBooks Integration</option>
                <option value="workflow-automation">Workflow Automation</option>
                <option value="agents-apps-automation">Agents / Apps / Automation</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Engine
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as any)}
                style={{ backgroundColor: "#0f0f0f", color: "#ddd", border: "1px solid #333", borderRadius: "6px", padding: "8px" }}
              >
                {engineOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={Boolean((opt as any).disabled)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Primary Model
              <select
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                style={{ backgroundColor: "#0f0f0f", color: "#ddd", border: "1px solid #333", borderRadius: "6px", padding: "8px" }}
              >
                <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="openai/gpt-5-2">GPT-5.2</option>
                <option value="openai/gpt-5-2-codex">GPT-5.2 Codex</option>
                <option value="openai/gpt-5-1-codex">GPT-5.1 Codex</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Reviewer Model
              <select
                value={reviewModel}
                onChange={(e) => setReviewModel(e.target.value)}
                style={{ backgroundColor: "#0f0f0f", color: "#ddd", border: "1px solid #333", borderRadius: "6px", padding: "8px" }}
              >
                <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="openai/gpt-5-2">GPT-5.2</option>
                <option value="openai/gpt-5-2-codex">GPT-5.2 Codex</option>
                <option value="openai/gpt-5-1-codex">GPT-5.1 Codex</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                style={{ backgroundColor: "#0f0f0f", color: "#ddd", border: "1px solid #333", borderRadius: "6px", padding: "8px" }}
              >
                <option value="research">Research</option>
                <option value="execute" disabled={engine !== "standard" && !flags.allowSandboxExecute}>
                  Execute
                </option>
              </select>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#888" }}>
              Policy
              <div style={{ backgroundColor: "#0f0f0f", color: "#bbb", border: "1px solid #333", borderRadius: "6px", padding: "8px", minHeight: "36px", display: "flex", alignItems: "center" }}>
                {engine === "standard"
                  ? "Governed lane"
                  : flags.allowSandboxExecute
                    ? "Sandbox execute enabled"
                    : "Sandbox forced to research mode"}
              </div>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional run notes"
            style={{
              width: "100%",
              minHeight: "60px",
              resize: "vertical",
              backgroundColor: "#0f0f0f",
              color: "#ddd",
              border: "1px solid #333",
              borderRadius: "6px",
              padding: "8px",
              marginBottom: "10px",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() =>
                runCycleMut.mutate({
                  vertical,
                  engine: engine as any,
                  mode,
                  notes: notes.trim() || undefined,
                  primaryModel: primaryModel.trim() || undefined,
                  reviewModel: reviewModel.trim() || undefined,
                  parallelCompare,
                })
              }
              disabled={runCycleMut.isPending}
              style={{
                padding: "10px 14px",
                backgroundColor: "#22c55e",
                color: "#04150a",
                border: "none",
                borderRadius: "6px",
                fontWeight: "700",
                cursor: runCycleMut.isPending ? "not-allowed" : "pointer",
                opacity: runCycleMut.isPending ? 0.6 : 1,
              }}
            >
              {runCycleMut.isPending ? "Queueing..." : "Run Vertical Cycle"}
            </button>
            {runCycleMut.error && (
              <span style={{ color: "#ef4444", fontSize: "12px" }}>{runCycleMut.error.message}</span>
            )}
            {runCycleMut.data && (
              <span style={{ color: "#22c55e", fontSize: "12px" }}>
                queued run: {(runCycleMut.data as any).runId}
              </span>
            )}
            <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", color: "#a5a5a5", fontSize: "12px" }}>
              <input
                type="checkbox"
                checked={parallelCompare}
                onChange={(e) => setParallelCompare(e.target.checked)}
              />
              Parallel compare governed vs sandbox
            </label>
          </div>
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px", color: "#e0e0e0" }}>
            Bucket Model Lanes (Staged Weights)
          </div>
          {lanesQ.isLoading ? (
            <div style={{ color: "#777", fontSize: "12px" }}>Loading model lanes...</div>
          ) : modelLanes.length === 0 ? (
            <div style={{ color: "#777", fontSize: "12px" }}>No lanes published.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {modelLanes.map((lane: any) => (
                <div key={lane.lane} style={{ border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px", backgroundColor: "#0d0d0d" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#d5d5d5", fontSize: "12px", fontWeight: 700 }}>{lane.label}</div>
                      <div style={{ color: "#888", fontSize: "11px" }}>{lane.lane} | {lane.intendedUse}</div>
                    </div>
                    <button
                      onClick={() => {
                        setEngine(lane.defaultEngine);
                        setPrimaryModel(lane.defaultPrimaryModel);
                        setReviewModel(lane.defaultReviewModel);
                      }}
                      style={{
                        padding: "7px 10px",
                        backgroundColor: "#1d4ed8",
                        color: "#eff6ff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Use This Lane
                    </button>
                  </div>
                  <div style={{ marginTop: "6px", color: "#6b7280", fontSize: "10px", whiteSpace: "pre-wrap" }}>
                    weights: {lane.weightsObject}
                  </div>
                  <div style={{ marginTop: "2px", color: "#6b7280", fontSize: "10px", whiteSpace: "pre-wrap" }}>
                    manifest: {lane.manifestObject}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px", color: "#e0e0e0" }}>
            Breakthrough / Improvement Alerts
          </div>
          {cyclesQ.isLoading ? (
            <div style={{ color: "#777", fontSize: "12px" }}>Loading alerts...</div>
          ) : breakthroughRows.length === 0 ? (
            <div style={{ color: "#777", fontSize: "12px" }}>No breakthrough alerts yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {breakthroughRows.slice(0, 8).map((row: any) => (
                <div key={row.id} style={{ border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px", backgroundColor: "#0d0d0d" }}>
                  <div style={{ color: "#93c5fd", fontWeight: 700, fontSize: "12px" }}>
                    {row.meta?.breakthroughMessage || "Potential sandbox improvement detected"}
                  </div>
                  <div style={{ color: "#999", fontSize: "11px", marginTop: "4px" }}>
                    run {row.id} | engine {row.meta?.engine ?? row.agent} | vertical {row.meta?.vertical ?? "unknown"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px", color: "#e0e0e0" }}>
            Recent Marketing Cycles
          </div>
          {cyclesQ.isLoading ? (
            <div style={{ color: "#777", fontSize: "12px" }}>Loading cycle history...</div>
          ) : cycleRows.length === 0 ? (
            <div style={{ color: "#777", fontSize: "12px" }}>No cycles logged yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {cycleRows.map((row: any) => {
                const meta = row.meta ?? {};
                const aiThinking = meta?.aiThinking ?? null;
                const primary = aiThinking?.primary ?? null;
                const reviewer = aiThinking?.reviewer ?? null;
                return (
                  <div key={row.id} style={{ border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#0d0d0d" }}>
                    <div style={{ fontSize: "12px", color: "#cfcfcf", fontWeight: 600 }}>
                      {meta.vertical ?? "unknown-vertical"} | {meta.engine ?? row.agent} | {meta.mode ?? "research"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#888" }}>
                      {row.status} | {new Date(row.startedAt).toLocaleString()}
                    </div>
                    {(primary || reviewer) && (
                      <details style={{ marginTop: "8px" }}>
                        <summary style={{ cursor: "pointer", color: "#93c5fd", fontSize: "12px" }}>
                          What AI is thinking (prompt + output trace)
                        </summary>
                        {primary && (
                          <div style={{ marginTop: "6px", padding: "8px", border: "1px solid #243447", borderRadius: "6px", background: "#081018" }}>
                            <div style={{ color: "#a7f3d0", fontSize: "11px", fontWeight: 700 }}>
                              Primary ({primary.model ?? "unknown"})
                            </div>
                            <div style={{ color: "#9ca3af", fontSize: "11px", marginTop: "4px", whiteSpace: "pre-wrap" }}>
                              {primary.thinkingPrompt ?? "No prompt trace"}
                            </div>
                            <div style={{ color: "#d1d5db", fontSize: "11px", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                              {primary.thinkingOutput ?? "No output trace"}
                            </div>
                          </div>
                        )}
                        {reviewer && (
                          <div style={{ marginTop: "6px", padding: "8px", border: "1px solid #3f3f46", borderRadius: "6px", background: "#0a0a0a" }}>
                            <div style={{ color: "#fde68a", fontSize: "11px", fontWeight: 700 }}>
                              Reviewer ({reviewer.model ?? "unknown"})
                            </div>
                            <div style={{ color: "#9ca3af", fontSize: "11px", marginTop: "4px", whiteSpace: "pre-wrap" }}>
                              {reviewer.thinkingPrompt ?? "No prompt trace"}
                            </div>
                            <div style={{ color: "#d1d5db", fontSize: "11px", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                              {reviewer.thinkingOutput ?? "No output trace"}
                            </div>
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0" }}>
              Execution Bridge
            </div>
            <button
              onClick={() => processQueuedMut.mutate({ limit: 20 })}
              disabled={processQueuedMut.isPending}
              style={{
                padding: "8px 12px",
                backgroundColor: "#2563eb",
                color: "#eaf1ff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: processQueuedMut.isPending ? "not-allowed" : "pointer",
                opacity: processQueuedMut.isPending ? 0.6 : 1,
              }}
            >
              {processQueuedMut.isPending ? "Processing..." : "Process Queued Cycles"}
            </button>
          </div>
          <div style={{ color: "#888", fontSize: "12px" }}>
            Runs queued cycle jobs now and refreshes scorecard plus promotion queue.
          </div>
          {processQueuedMut.error && (
            <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "8px" }}>
              {processQueuedMut.error.message}
            </div>
          )}
          {processQueuedMut.data && (
            <div style={{ color: "#22c55e", fontSize: "12px", marginTop: "8px" }}>
              Processed {(processQueuedMut.data as any).processed} queued run(s).
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px", color: "#e0e0e0" }}>
            Promotion Queue
          </div>
          {promotionQ.isLoading ? (
            <div style={{ color: "#777", fontSize: "12px" }}>Loading promotion queue...</div>
          ) : ((promotionQ.data as any)?.rows ?? []).length === 0 ? (
            <div style={{ color: "#777", fontSize: "12px" }}>No hypotheses pending review.</div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {((promotionQ.data as any)?.rows ?? []).map((row: any) => (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #2a2a2a",
                    borderRadius: "6px",
                    padding: "10px",
                    backgroundColor: "#0d0d0d",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#d5d5d5", fontSize: "12px", fontWeight: 600 }}>{row.title}</div>
                      <div style={{ color: "#888", fontSize: "11px" }}>
                        {row.segment} | {row.channel} | {row.status}
                      </div>
                    </div>
                    <div style={{ color: "#888", fontSize: "11px" }}>
                      conf {row.confidence ?? "-"} / impact {row.impact ?? "-"} / effort {row.effort ?? "-"}
                    </div>
                  </div>

                  <input
                    value={promotionNotes[row.id] ?? ""}
                    onChange={(e) =>
                      setPromotionNotes((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                    placeholder="Optional review note"
                    style={{
                      backgroundColor: "#101010",
                      color: "#ddd",
                      border: "1px solid #333",
                      borderRadius: "6px",
                      padding: "8px",
                      fontSize: "12px",
                    }}
                  />

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() =>
                        reviewPromotionMut.mutate({
                          id: row.id,
                          decision: "approved",
                          note: promotionNotes[row.id]?.trim() || undefined,
                        })
                      }
                      disabled={reviewPromotionMut.isPending}
                      style={{
                        padding: "7px 10px",
                        backgroundColor: "#15803d",
                        color: "#ecfdf3",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: reviewPromotionMut.isPending ? "not-allowed" : "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        reviewPromotionMut.mutate({
                          id: row.id,
                          decision: "promoted",
                          note: promotionNotes[row.id]?.trim() || undefined,
                        })
                      }
                      disabled={reviewPromotionMut.isPending}
                      style={{
                        padding: "7px 10px",
                        backgroundColor: "#1d4ed8",
                        color: "#eff6ff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: reviewPromotionMut.isPending ? "not-allowed" : "pointer",
                      }}
                    >
                      Promote
                    </button>
                    <button
                      onClick={() =>
                        reviewPromotionMut.mutate({
                          id: row.id,
                          decision: "rejected",
                          note: promotionNotes[row.id]?.trim() || undefined,
                        })
                      }
                      disabled={reviewPromotionMut.isPending}
                      style={{
                        padding: "7px 10px",
                        backgroundColor: "#b91c1c",
                        color: "#fef2f2",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: reviewPromotionMut.isPending ? "not-allowed" : "pointer",
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {reviewPromotionMut.error && (
            <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "8px" }}>
              {reviewPromotionMut.error.message}
            </div>
          )}
          {reviewPromotionMut.data && (
            <div style={{ color: "#22c55e", fontSize: "12px", marginTop: "8px" }}>
              Updated hypothesis {(reviewPromotionMut.data as any).id} to {(reviewPromotionMut.data as any).status}.
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #333",
            borderRadius: "8px",
            backgroundColor: "#111",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "10px", color: "#e0e0e0" }}>
            Engine Scorecard (Last 14 Days)
          </div>
          {scoreQ.isLoading ? (
            <div style={{ color: "#777", fontSize: "12px" }}>Loading scorecard...</div>
          ) : !(scoreQ.data as any)?.ok ? (
            <div style={{ color: "#ef4444", fontSize: "12px" }}>Scorecard unavailable.</div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "8px" }}>
                {[
                  { label: "Total Runs", value: (scoreQ.data as any).totals.runs },
                  { label: "Success", value: (scoreQ.data as any).totals.success },
                  { label: "Failed", value: (scoreQ.data as any).totals.failed },
                  { label: "Queued", value: (scoreQ.data as any).totals.queued },
                ].map((item) => (
                  <div key={item.label} style={{ border: "1px solid #2b2b2b", borderRadius: "6px", padding: "10px", background: "#0d0d0d" }}>
                    <div style={{ fontSize: "11px", color: "#888" }}>{item.label}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#e6e6e6" }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ border: "1px solid #2b2b2b", borderRadius: "6px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "#0b0b0b", color: "#999" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Engine</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Runs</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Success %</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Research</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Execute</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Guardrail %</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Avg Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((scoreQ.data as any).byEngine ?? []).map((r: any) => {
                      const successPct = `${Math.round((r.successRate ?? 0) * 100)}%`;
                      const guardrailPct =
                        r.guardrailPassRate == null ? "n/a" : `${Math.round(r.guardrailPassRate * 100)}%`;
                      const avgCost = r.avgCostUsd == null ? "n/a" : `$${Number(r.avgCostUsd).toFixed(3)}`;
                      return (
                        <tr key={r.engine} style={{ borderTop: "1px solid #1f1f1f", color: "#d0d0d0" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.engine}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.total}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{successPct}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.research}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.execute}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{guardrailPct}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{avgCost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

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
                  <div onClick={() => toggleExpanded(inst.id)} style={{ padding: "16px", backgroundColor: "#0f0f0f", borderBottom: expanded ? `2px solid ${color}` : "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: statusColor(status) }} />
                        <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#e0e0e0" }}>{inst.displayName || `Instance ${inst.id}`}</h3>
                      </div>
                      <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>#{inst.id} - {status}</p>
                    </div>
                    <ChevronDown size={16} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#666" }} />
                  </div>

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
