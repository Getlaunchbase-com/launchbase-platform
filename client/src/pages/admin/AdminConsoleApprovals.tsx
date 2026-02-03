import { AdminLayout } from "../../components/AdminLayout";
import { CheckCircle, XCircle } from "lucide-react";

export default function AdminConsoleApprovals() {
  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Approvals</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Review and approve pending agent actions
        </p>

        {/* Pending Queue */}
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>
            Pending Approvals
          </h2>
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
            <p style={{ fontSize: "14px", margin: 0 }}>No pending approvals</p>
            <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>
              Approvals will appear here when agents need your input
            </p>
          </div>
        </div>

        {/* History */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>
            Approval History
          </h2>
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
            <p style={{ fontSize: "14px", margin: 0 }}>No history yet</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
