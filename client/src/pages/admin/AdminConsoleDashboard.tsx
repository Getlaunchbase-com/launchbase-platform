import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, CheckCircle, Clock, Zap, TrendingUp, Play } from "../../components/Icons";

export default function AdminConsoleDashboard() {
  return (
    <AdminLayout>
      <div>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>
            Console
          </h1>
          <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
            System overview and quick actions
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
          <button
            style={{
              padding: "16px 20px",
              backgroundColor: "#ff6b35",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#ff7a4a";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ff6b35";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <MessageSquare size={16} />
            New Agent Chat
          </button>
          <button
            style={{
              padding: "16px 20px",
              backgroundColor: "#333",
              color: "#e0e0e0",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#444";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#333";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Zap size={16} />
            New Swarm Run
          </button>
        </div>

        {/* System Health Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          {/* Health Card */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>System Health</div>
              <CheckCircle size={18} style={{ color: "#22c55e" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>Operational</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>All systems nominal</div>
          </div>

          {/* Active Runs Card */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Active Runs</div>
              <Play size={18} style={{ color: "#ff6b35" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>—</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>No active runs</div>
          </div>

          {/* Agents Ready Card */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Agents Ready</div>
              <TrendingUp size={18} style={{ color: "#3b82f6" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>—</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>Idle and available</div>
          </div>

          {/* Cost Summary Card */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Usage (30d)</div>
              <Clock size={18} style={{ color: "#a78bfa" }} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "600", color: "#e0e0e0" }}>—</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>No data yet</div>
          </div>
        </div>

        {/* Alerts & Approvals Section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
          {/* Pending Approvals */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <CheckCircle size={16} style={{ color: "#ff6b35" }} />
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>Pending Approvals</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666" }}>No pending approvals</div>
          </div>

          {/* System Alerts */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <AlertCircle size={16} style={{ color: "#22c55e" }} />
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>System Status</h2>
            </div>
            <div style={{ fontSize: "13px", color: "#666" }}>No active alerts</div>
          </div>
        </div>

        {/* Agent Overview Section */}
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 16px 0" }}>
            Agent Overview
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            <div style={{ padding: "12px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
              <div style={{ fontSize: "12px", color: "#666" }}>Primary Agent</div>
              <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>Owner / Operator</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>Ready to operate</div>
            </div>
            <div style={{ padding: "12px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
              <div style={{ fontSize: "12px", color: "#666" }}>Marketing Agents</div>
              <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>6 agents</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>All idle</div>
            </div>
            <div style={{ padding: "12px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
              <div style={{ fontSize: "12px", color: "#666" }}>Swarm</div>
              <div style={{ fontSize: "14px", fontWeight: "600", marginTop: "4px" }}>100 agents</div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>Standby</div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Icon placeholder for demo
function MessageSquare({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
