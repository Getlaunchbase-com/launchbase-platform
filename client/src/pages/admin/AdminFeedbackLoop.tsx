import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackStatus = "open" | "triaged" | "in_review" | "resolved" | "wont_fix";
type Severity = "low" | "medium" | "high" | "critical";
type Category =
  | "wrong_output"
  | "slow_response"
  | "missing_capability"
  | "config_issue"
  | "tone_style"
  | "hallucination"
  | "other";
type ProposalStatus = "proposed" | "under_review" | "approved" | "rejected" | "applied" | "rolled_back";

interface FeedbackItem {
  id: number;
  instanceId: number;
  instanceName?: string;
  runId?: number | null;
  message: string;
  category: Category;
  severity: Severity;
  status: FeedbackStatus;
  source: string;
  submitterName?: string;
  createdAt: string;
}

interface Proposal {
  id: number;
  title: string;
  description: string;
  changeType: string;
  status: ProposalStatus;
  feedbackIds: number[];
  clusterSummary?: {
    totalItems: number;
    topCategories: string[];
    severityBreakdown: Record<string, number>;
  };
  reviewNote?: string;
  createdAt: string;
}

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

// ---------------------------------------------------------------------------
// Tab components
// ---------------------------------------------------------------------------

type Tab = "feedback" | "proposals" | "swarm";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminFeedbackLoop() {
  const [activeTab, setActiveTab] = useState<Tab>("feedback");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Mock data — wired to tRPC in production
  const [feedbackItems] = useState<FeedbackItem[]>([
    {
      id: 1,
      instanceId: 1,
      instanceName: "Content Writer v2",
      runId: 42,
      message: "The agent produced a blog post with an incorrect product name. It said 'LaunchPad' instead of 'LaunchBase'.",
      category: "hallucination",
      severity: "high",
      status: "open",
      source: "operator_os",
      submitterName: "Admin",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      instanceId: 2,
      instanceName: "Support Bot",
      runId: 88,
      message: "Response time was over 30 seconds for a simple FAQ question.",
      category: "slow_response",
      severity: "medium",
      status: "triaged",
      source: "mobile",
      submitterName: "Customer",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 3,
      instanceId: 1,
      instanceName: "Content Writer v2",
      runId: null,
      message: "Agent doesn't understand the difference between our standard and premium tiers.",
      category: "wrong_output",
      severity: "high",
      status: "open",
      source: "operator_os",
      submitterName: "Admin",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ]);

  const [proposals] = useState<Proposal[]>([
    {
      id: 1,
      title: "[HIGH] hallucination — 1 report(s)",
      description: "Cluster of 1 feedback item(s) in category \"hallucination\" with severity \"high\".\n\nRecommended action: review and apply a prompt_edit to address these issues.",
      changeType: "prompt_edit",
      status: "proposed",
      feedbackIds: [1],
      clusterSummary: { totalItems: 1, topCategories: ["hallucination"], severityBreakdown: { high: 1 } },
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: "[MEDIUM] slow response — 1 report(s)",
      description: "Cluster of 1 feedback item(s) in category \"slow_response\" with severity \"medium\".\n\nRecommended action: review and apply a config_update to address these issues.",
      changeType: "config_update",
      status: "approved",
      feedbackIds: [2],
      clusterSummary: { totalItems: 1, topCategories: ["slow_response"], severityBreakdown: { medium: 1 } },
      reviewNote: "Approved — increase timeout and add caching.",
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    },
  ]);

  const filteredFeedback = feedbackItems.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    return true;
  });

  const openCount = feedbackItems.filter((i) => i.status === "open").length;
  const triagedCount = feedbackItems.filter((i) => i.status === "triaged").length;
  const proposedCount = proposals.filter((p) => p.status === "proposed").length;
  const approvedCount = proposals.filter((p) => p.status === "approved").length;

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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredFeedback.length === 0 && (
                <div style={{ color: "#888", padding: 32, textAlign: "center" }}>
                  No feedback items match the current filters.
                </div>
              )}
              {filteredFeedback.map((item) => (
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
                      <Badge label={item.severity} color={SEVERITY_COLORS[item.severity]} />
                      <Badge label={item.category} color="#6366f1" />
                      <Badge label={item.status} color={STATUS_COLORS[item.status] ?? "#888"} />
                      <span style={{ fontSize: 12, color: "#666" }}>via {item.source.replace(/_/g, " ")}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#555" }}>
                      #{item.id} &middot; {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px 0", color: "#e4e4e7", fontSize: 14, lineHeight: 1.5 }}>
                    {item.message}
                  </p>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Instance: <strong style={{ color: "#a1a1aa" }}>{item.instanceName}</strong>
                    {item.runId && <> &middot; Run #{item.runId}</>}
                    {item.submitterName && <> &middot; By {item.submitterName}</>}
                  </div>
                </div>
              ))}
            </div>
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

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proposals.length === 0 && (
                <div style={{ color: "#888", padding: 32, textAlign: "center" }}>
                  No improvement proposals yet. Run a swarm analysis to generate proposals.
                </div>
              )}
              {proposals.map((proposal) => (
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
                      <Badge label={proposal.changeType.replace(/_/g, " ")} color="#8b5cf6" />
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
                  {proposal.clusterSummary && (
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                      {proposal.clusterSummary.totalItems} feedback item(s) &middot; Categories: {proposal.clusterSummary.topCategories.join(", ")}
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
                        style={{
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {proposal.status === "approved" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        style={{
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Apply Patch
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                    style={{
                      background: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      color: "#fff",
                      padding: "6px 12px",
                      fontSize: 13,
                    }}
                    defaultValue="7"
                  >
                    <option value="7">Last 7 days</option>
                    <option value="14">Last 14 days</option>
                    <option value="30">Last 30 days</option>
                  </select>
                </div>
              </div>

              <button
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 28px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Run Improvement Swarm
              </button>

              <p style={{ fontSize: 12, color: "#555", margin: "12px 0 0 0" }}>
                Proposals require admin approval before they can be applied (promotion gate).
              </p>
            </div>

            {/* Recent swarm runs */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e4e4e7", margin: "0 0 12px 0" }}>
                Recent Swarm Runs
              </h3>
              <div style={{ color: "#666", fontSize: 13 }}>
                No improvement swarm runs yet. Click &quot;Run Improvement Swarm&quot; to start.
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
