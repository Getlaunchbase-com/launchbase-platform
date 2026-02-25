import { AdminLayout } from "../../components/AdminLayout";
import { Shield, AlertCircle } from "../../components/Icons";

export default function AdminConsoleTools() {
  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Tools</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Agent tools and permissions
        </p>

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
          <Shield size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontSize: "14px", margin: "0 0 4px 0" }}>Agent tools registry not connected</p>
          <p style={{ fontSize: "12px", color: "#555", margin: 0 }}>
            The agent-stack tools endpoint will populate this view when connected.
            Tools are registered by the agent-stack at runtime.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
