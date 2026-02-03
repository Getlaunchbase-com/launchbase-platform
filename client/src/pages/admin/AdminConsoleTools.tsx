import { AdminLayout } from "../../components/AdminLayout";
import { AdminLayout } from "../../components/AdminLayout";
import { Shield, AlertCircle } from "../../components/Icons";

const TOOLS = [
  { name: "Web Search", provider: "Internal", safety: "approved", description: "Search the web for information" },
  { name: "File Reader", provider: "Internal", safety: "approved", description: "Read and parse files" },
  { name: "Code Executor", provider: "Internal", safety: "requires_approval", description: "Execute code" },
  { name: "Email Sender", provider: "Internal", safety: "requires_approval", description: "Send emails" },
];

export default function AdminConsoleTools() {
  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Tools</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Agent tools and permissions
        </p>

        {/* Tools List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {TOOLS.map((tool, idx) => (
            <div
              key={idx}
              style={{
                padding: "16px",
                backgroundColor: "#1a1a1a",
                borderRadius: "8px",
                border: "1px solid #333",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0", marginBottom: "4px" }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>{tool.description}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Provider</div>
                <div style={{ fontSize: "13px", color: "#e0e0e0" }}>{tool.provider}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Safety</div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    backgroundColor:
                      tool.safety === "approved" ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: tool.safety === "approved" ? "#22c55e" : "#f59e0b",
                    fontWeight: "600",
                  }}
                >
                  {tool.safety === "approved" ? <Shield size={12} /> : <AlertCircle size={12} />}
                  {tool.safety === "approved" ? "Approved" : "Needs Approval"}
                </div>
              </div>
              <button
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#333",
                  color: "#e0e0e0",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#333";
                }}
              >
                Configure
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
