import { AdminLayout } from "../../components/AdminLayout";
import { CheckCircle, XCircle } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleApprovals() {
  const pendingQ = trpc.admin.operatorOS.pendingProposals.useQuery({}, { retry: false });
  const proposalsQ = trpc.admin.feedback.listProposals.useQuery({ limit: 50 }, { retry: false });

  const reviewMut = trpc.admin.feedback.reviewProposal.useMutation({
    onSuccess: () => { pendingQ.refetch(); proposalsQ.refetch(); },
  });
  const applyMut = trpc.admin.feedback.applyProposal.useMutation({
    onSuccess: () => { pendingQ.refetch(); proposalsQ.refetch(); },
  });

  const pending = (pendingQ.data as any)?.proposals ?? [];
  const allProposals = proposalsQ.data?.proposals ?? [];
  const history = allProposals.filter((p: any) => !["proposed", "under_review"].includes(p.status));

  const statusColor = (s: string) =>
    s === "approved" ? "#22c55e" : s === "rejected" ? "#ef4444" : s === "applied" ? "#059669" : s === "rolled_back" ? "#dc2626" : "#f59e0b";

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Approvals</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>Review and approve pending proposals</p>

        {/* Pending Queue */}
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>
            Pending Approvals {pending.length > 0 && <span style={{ color: "#ff6b35" }}>({pending.length})</span>}
          </h2>
          {pendingQ.isLoading ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>Loading...</div>
          ) : pending.length === 0 ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
              <p style={{ fontSize: "14px", margin: 0 }}>No pending approvals</p>
              <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>Approvals will appear here when agents need your input</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pending.map((p: any) => (
                <div key={p.id} style={{ padding: "16px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{p.changeType?.replace(/_/g, " ")} — {new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: "600", backgroundColor: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                      {p.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "#999", margin: "0 0 12px 0", whiteSpace: "pre-line" }}>{p.description}</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => reviewMut.mutate({ id: p.id, decision: "approved" })}
                      disabled={reviewMut.isPending}
                      style={{ padding: "8px 16px", backgroundColor: "#22c55e", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
                      onClick={() => reviewMut.mutate({ id: p.id, decision: "rejected" })}
                      disabled={reviewMut.isPending}
                      style={{ padding: "8px 16px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>Approval History</h2>
          {proposalsQ.isLoading ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
              <p style={{ fontSize: "14px", margin: 0 }}>No history yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.map((p: any) => (
                <div key={p.id} style={{ padding: "12px 16px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e0" }}>{p.title}</div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>{p.reviewNote || p.changeType?.replace(/_/g, " ")}</div>
                  </div>
                  <span style={{ padding: "2px 10px", borderRadius: "9999px", fontSize: "11px", fontWeight: "600", backgroundColor: `${statusColor(p.status)}22`, color: statusColor(p.status), border: `1px solid ${statusColor(p.status)}44` }}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
