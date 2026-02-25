import { AdminLayout } from "../../components/AdminLayout";
import { CheckCircle, Brain } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleModels() {
  const profilesQ = trpc.admin.vertexProfiles.list.useQuery({}, { retry: false });
  const profiles = (profilesQ.data as any)?.profiles ?? [];

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Models & Brains</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Vertex profiles and model configurations
        </p>

        {profilesQ.isLoading ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            Loading vertex profiles...
          </div>
        ) : profiles.length === 0 ? (
          <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
            <p style={{ fontSize: "14px", margin: 0 }}>No vertex profiles configured</p>
            <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>Create a vertex profile to define agent behavior and model selection</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {profiles.map((profile: any, idx: number) => (
              <div key={profile.id} style={{ marginBottom: "8px" }}>
                <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0", color: "#999" }}>
                  {profile.name || `Profile ${profile.id}`}
                </h2>
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "8px",
                    border: idx === 0 ? "2px solid #ff6b35" : "1px solid #333",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr auto",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0" }}>
                      <Brain size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
                      {profile.name || `Profile ${profile.id}`}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{profile.description || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>Model</div>
                    <div style={{ fontSize: "13px", color: "#e0e0e0" }}>{profile.modelId || profile.model || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "2px" }}>Status</div>
                    <div style={{ fontSize: "13px", color: profile.status === "active" ? "#22c55e" : "#666" }}>
                      {profile.status || "active"}
                    </div>
                  </div>
                  {idx === 0 && (
                    <div style={{ fontSize: "11px", color: "#ff6b35", fontWeight: "600" }}>Default</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
