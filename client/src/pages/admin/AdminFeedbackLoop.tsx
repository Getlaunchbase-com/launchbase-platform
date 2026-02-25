import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { trpc } from "../../lib/trpc";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackStatus = "open" | "triaged" | "in_review" | "resolved" | "wont_fix";
type Severity = "low" | "medium" | "high" | "critical";
type ProposalStatus = "proposed" | "under_review" | "approved" | "rejected" | "applied" | "rolled_back";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<Severity, string> = {
  low: "#3b82f6",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  triaged: "#8b5cf6",
  in_review: "#f59e0b",
  resolved: "#10b981",
  wont_fix: "#6b7280",
  proposed: "#3b82f6",
  under_review: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
  applied: "#059669",
  rolled_back: "#dc2626",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

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

/** Parse clusterSummary — it may arrive as a JSON string or an already-parsed object. */
function parseClusterSummary(
  raw: unknown,
): { totalItems: number; topCategories: string[]; severityBreakdown: Record<string, number> } | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      totalItems: obj.totalItems ?? 0,
      topCategories: Array.isArray(obj.topCategories) ? obj.topCategories : [],
      severityBreakdown: obj.severityBreakdown ?? {},
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = "feedback" | "proposals" | "swarm";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminFeedbackLoop() {
  const [activeTab, setActiveTab] = useState<Tab>("feedback");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [swarmDays, setSwarmDays] = useState<number>(7);
  const [swarmResult, setSwarmResult] = useState<{
    proposalsCreated: number;
    feedbackProcessed: number;
    clusters: number;
    skippedNoFeedback?: boolean;
  } | null>(null);

  // -----------------------------------------------------------------------
  // tRPC queries
  // -----------------------------------------------------------------------

  const feedbackQuery = trpc.admin.feedback.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as FeedbackStatus) : undefined,
    severity: severityFilter !== "all" ? (severityFilter as Severity) : undefined,
    limit: 50,
  });

  const summaryQuery = trpc.admin.feedback.summary.useQuery({ sinceDaysAgo: 30 });

  const proposalsQuery = trpc.admin.feedback.listProposals.useQuery({ limit: 50 });

  const proposalsSummaryQuery = trpc.admin.feedback.proposalsSummary.useQuery(undefined);

  // -----------------------------------------------------------------------
  // tRPC mutations
  // -----------------------------------------------------------------------

  const updateStatusMut = trpc.admin.feedback.updateStatus.useMutation({
    onSuccess: () => {
      feedbackQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const reviewProposalMut = trpc.admin.feedback.reviewProposal.useMutation({
    onSuccess: () => {
      proposalsQuery.refetch();
      proposalsSummaryQuery.refetch();
    },
  });

  const applyProposalMut = trpc.admin.feedback.applyProposal.useMutation({
    onSuccess: () => {
      proposalsQuery.refetch();
      proposalsSummaryQuery.refetch();
    },
  });

  const triggerSwarmMut = trpc.admin.feedback.triggerImprovementSwarm.useMutation({
    onSuccess: (data) => {
      setSwarmResult({
        proposalsCreated: (data as any).proposalCount ?? 0,
        feedbackProcessed: (data as any).feedbackProcessed ?? 0,
        clusters: (data as any).clusterCount ?? 0,
        skippedNoFeedback: (data as any).swarmRunId === null,
      });
      feedbackQuery.refetch();
      summaryQuery.refetch();
      proposalsQuery.refetch();
      proposalsSummaryQuery.refetch();
    },
  });

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const feedbackItems = feedbackQuery.data?.items ?? [];

  const proposals = proposalsQuery.data?.proposals ?? [];

  // Summary-based stat cards
  const summaryData = summaryQuery.data;
  const openCount =
    summaryData?.byStatus?.find((s: { status: string; count: number }) => s.status === "open")?.count ?? 0;
  const triagedCount =
    summaryData?.byStatus?.find((s: { status: string; count: number }) => s.status === "triaged")?.count ?? 0;

  const pSummary = proposalsSummaryQuery.data;
  const proposedCount =
    pSummary?.byStatus?.find((s: { status: string; count: number }) => s.status === "proposed")?.count ?? 0;
  const approvedCount =
    pSummary?.byStatus?.find((s: { status: string; count: number }) => s.status === "approved")?.count ?? 0;

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
          Feedback &rarr; Improvement Loop
        </h1>
        <p style={{ fontSize: 14, color: "#888", margin: "0 0 24px 0" }}>
          Capture feedback from operators and mobile users, cluster with swarm analysis, and promote approved improvements.
        </p>

        {/* Summary cards */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Open Feedback" value={openCount} color="#3b82f6" />
          <StatCard label="Triaged" value={triagedCount} color="#8b5cf6" />
          <StatCard label="Proposed Changes" value={proposedCount} color="#f59e0b" />
          <StatCard label="Approved (ready)" value={approvedCount} color="#10b981" />
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid #27272a", marginBottom: 20, display: "flex", gap: 0 }}>
          <button style={tabStyle("feedback")} onClick={() => setActiveTab("feedback")}>
            Feedback Items
          </button>
          <button style={tabStyle("proposals")} onClick={() => setActiveTab("proposals")}>
            Improvement Proposals
          </button>
          <button style={tabStyle("swarm")} onClick={() => setActiveTab("swarm")}>
            Swarm Analysis
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB: Feedback Items                                              */}
        {/* ================================================================ */}
        {activeTab === "feedback" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  color: "#fff",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="triaged">Triaged</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="wont_fix">Won&apos;t Fix</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  color: "#fff",
                  padding: "6px 12px",
                  fontSize: 13,
                }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Feedback list */}
            {feedbackQuery.isLoading ? (
              <div style={{ color: "#888", padding: 32, textAlign: "center" }}>Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feedbackItems.length === 0 && (
                  <div style={{ color: "#888", padding: 32, textAlign: "center" }}>
                    No feedback items match the current filters.
                  </div>
                )}
                {feedbackItems.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Badge label={item.severity} color={SEVERITY_COLORS[item.severity as Severity] ?? "#888"} />
                        <Badge label={item.category} color="#6366f1" />
                        <Badge label={item.status} color={STATUS_COLORS[item.status] ?? "#888"} />
                        <span style={{ fontSize: 12, color: "#666" }}>via {(item.source ?? "").replace(/_/g, " ")}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#555" }}>
                        #{item.id} &middot; {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 8px 0", color: "#e4e4e7", fontSize: 14, lineHeight: 1.5 }}>
                      {item.message}
                    </p>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Instance: <strong style={{ color: "#a1a1aa" }}>{item.submitterName ?? `#${item.instanceId}`}</strong>
                      {item.runId && <> &middot; Run #{item.runId}</>}
                      {item.submitterName && <> &middot; By {item.submitterName}</>}
                    </div>

                    {/* Status update buttons */}
                    {(item.status === "open" || item.status === "triaged") && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {item.status === "open" && (
                          <button
                            onClick={() => updateStatusMut.mutate({ id: item.id, status: "triaged" })}
                            disabled={updateStatusMut.isPending}
                            style={{
                              background: "#8b5cf6",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: updateStatusMut.isPending ? 0.6 : 1,
                            }}
                          >
                            {updateStatusMut.isPending ? "Updating..." : "Triage"}
                          </button>
                        )}
                        <button
                          onClick={() => updateStatusMut.mutate({ id: item.id, status: "in_review" })}
                          disabled={updateStatusMut.isPending}
                          style={{
                            background: "#f59e0b",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: updateStatusMut.isPending ? 0.6 : 1,
                          }}
                        >
                          {updateStatusMut.isPending ? "Updating..." : "Mark In Review"}
                        </button>
                        <button
                          onClick={() => updateStatusMut.mutate({ id: item.id, status: "resolved" })}
                          disabled={updateStatusMut.isPending}
                          style={{
                            background: "#10b981",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: updateStatusMut.isPending ? 0.6 : 1,
                          }}
                        >
                          {updateStatusMut.isPending ? "Updating..." : "Resolve"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Improvement Proposals (Promotion Gate)                      */}
        {/* ================================================================ */}
        {activeTab === "proposals" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Proposals generated by the swarm analysis. Each must be <strong style={{ color: "#10b981" }}>reviewed and approved</strong> before it can be applied (promotion gate).
            </p>

            {proposalsQuery.isLoading ? (
              <div style={{ color: "#888", padding: 32, textAlign: "center" }}>Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {proposals.length === 0 && (
                  <div style={{ color: "#888", padding: 32, textAlign: "center" }}>
                    No improvement proposals yet. Run a swarm analysis to generate proposals.
                  </div>
                )}
                {proposals.map((proposal: any) => {
                  const cluster = parseClusterSummary(proposal.clusterSummary);
                  return (
                    <div
                      key={proposal.id}
                      style={{
                        background: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge label={proposal.status} color={STATUS_COLORS[proposal.status] ?? "#888"} />
                          <Badge label={(proposal.changeType ?? "").replace(/_/g, " ")} color="#8b5cf6" />
                        </div>
                        <span style={{ fontSize: 12, color: "#555" }}>
                          #{proposal.id} &middot; {new Date(proposal.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 600, color: "#e4e4e7" }}>
                        {proposal.title}
                      </h3>
                      <p style={{ margin: "0 0 8px 0", color: "#a1a1aa", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                        {proposal.description}
                      </p>
                      {cluster && (
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                          {cluster.totalItems} feedback item(s) &middot; Categories: {cluster.topCategories.join(", ")}
                        </div>
                      )}
                      {proposal.reviewNote && (
                        <div style={{ fontSize: 12, color: "#10b981", fontStyle: "italic" }}>
                          Review: {proposal.reviewNote}
                        </div>
                      )}

                      {/* Action buttons (promotion gate) */}
                      {(proposal.status === "proposed" || proposal.status === "under_review") && (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            onClick={() => reviewProposalMut.mutate({ id: proposal.id, decision: "approved" })}
                            disabled={reviewProposalMut.isPending}
                            style={{
                              background: "#10b981",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: reviewProposalMut.isPending ? 0.6 : 1,
                            }}
                          >
                            {reviewProposalMut.isPending ? "Saving..." : "Approve"}
                          </button>
                          <button
                            onClick={() => reviewProposalMut.mutate({ id: proposal.id, decision: "rejected" })}
                            disabled={reviewProposalMut.isPending}
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: reviewProposalMut.isPending ? 0.6 : 1,
                            }}
                          >
                            {reviewProposalMut.isPending ? "Saving..." : "Reject"}
                          </button>
                        </div>
                      )}
                      {proposal.status === "approved" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            onClick={() => applyProposalMut.mutate({ id: proposal.id })}
                            disabled={applyProposalMut.isPending}
                            style={{
                              background: "#059669",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "6px 16px",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: applyProposalMut.isPending ? 0.6 : 1,
                            }}
                          >
                            {applyProposalMut.isPending ? "Applying..." : "Apply Patch"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB: Swarm Analysis                                              */}
        {/* ================================================================ */}
        {activeTab === "swarm" && (
          <div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Trigger the weekly swarm to cluster open feedback and generate improvement proposals.
            </p>

            <div
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#e4e4e7", margin: "0 0 8px 0" }}>
                Improvement Swarm
              </h3>
              <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px 0" }}>
                Clusters all open/triaged feedback from the last 7 days, groups by category and severity,
                and generates actionable improvement proposals for review.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 16 }}>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                    Time window (days)
                  </label>
                  <select
                    value={String(swarmDays)}
                    onChange={(e) => setSwarmDays(Number(e.target.value))}
                    style={{
                      background: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      color: "#fff",
                      padding: "6px 12px",
                      fontSize: 13,
                    }}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="14">Last 14 days</option>
                    <option value="30">Last 30 days</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  setSwarmResult(null);
                  triggerSwarmMut.mutate({ sinceDaysAgo: swarmDays });
                }}
                disabled={triggerSwarmMut.isPending}
                style={{
                  background: triggerSwarmMut.isPending ? "#2563eb" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 28px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: triggerSwarmMut.isPending ? "wait" : "pointer",
                  opacity: triggerSwarmMut.isPending ? 0.7 : 1,
                }}
              >
                {triggerSwarmMut.isPending ? "Running Swarm..." : "Run Improvement Swarm"}
              </button>

              <p style={{ fontSize: 12, color: "#555", margin: "12px 0 0 0" }}>
                Proposals require admin approval before they can be applied (promotion gate).
              </p>
            </div>

            {/* Swarm result */}
            {swarmResult && (
              <div
                style={{
                  marginTop: 16,
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "#10b981", margin: "0 0 12px 0" }}>
                  Swarm Completed
                </h4>
                {swarmResult.skippedNoFeedback ? (
                  <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
                    No open feedback found in the selected time window. Nothing to process.
                  </p>
                ) : (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>Feedback Processed</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{swarmResult.feedbackProcessed}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>Clusters Found</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{swarmResult.clusters}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>Proposals Created</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{swarmResult.proposalsCreated}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Swarm error */}
            {triggerSwarmMut.isError && (
              <div
                style={{
                  marginTop: 16,
                  background: "#18181b",
                  border: "1px solid #ef4444",
                  borderRadius: 12,
                  padding: 16,
                  color: "#ef4444",
                  fontSize: 13,
                }}
              >
                Error: {triggerSwarmMut.error?.message ?? "Failed to run improvement swarm."}
              </div>
            )}

            {/* Recent proposals (quick view) */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", margin: "0 0 12px 0" }}>
                Recent Swarm Runs
              </h3>
              {proposalsSummaryQuery.isLoading ? (
                <div style={{ color: "#666", fontSize: 13 }}>Loading...</div>
              ) : (pSummary?.recentProposed ?? []).length === 0 ? (
                <div style={{ color: "#666", fontSize: 13 }}>
                  No improvement swarm runs yet. Click &quot;Run Improvement Swarm&quot; to start.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(pSummary?.recentProposed ?? []).map((p: any) => (
                    <div
                      key={p.id}
                      style={{
                        background: "#09090b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge label={p.status} color={STATUS_COLORS[p.status] ?? "#888"} />
                        <span style={{ fontSize: 13, color: "#e4e4e7" }}>{p.title}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#555" }}>
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
