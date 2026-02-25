import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Upload, Download, Eye } from "../../components/Icons";
import trpc from "../../lib/trpc";

export default function AdminConsoleFiles() {
  const [projectId, setProjectId] = useState<string>("");

  const artifactsQ = trpc.admin.operatorOS.listArtifacts.useQuery(
    { projectId: projectId ? Number(projectId) : undefined },
    { retry: false }
  );
  const artifacts = Array.isArray(artifactsQ.data) ? artifactsQ.data : [];

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Files</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>Uploaded files and agent artifacts</p>

        {/* Project filter */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
            Filter by Project ID
          </label>
          <input
            type="number"
            placeholder="All projects"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ padding: "8px", backgroundColor: "#0f0f0f", border: "1px solid #333", borderRadius: "4px", fontSize: "12px", color: "#e0e0e0", width: "200px" }}
          />
        </div>

        {/* Files List */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>Files & Artifacts</h2>
          {artifactsQ.isLoading ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
              Loading artifacts...
            </div>
          ) : artifacts.length === 0 ? (
            <div style={{ padding: "40px 20px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", textAlign: "center", color: "#666" }}>
              <p style={{ fontSize: "14px", margin: 0 }}>No files yet</p>
              <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>Uploaded files and run artifacts will appear here</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {artifacts.map((a: any) => (
                <div key={a.id} style={{ padding: "16px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", alignItems: "center", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0", marginBottom: "4px" }}>{a.filename || a.name || `Artifact ${a.id}`}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{a.mimeType || a.type || "unknown"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Project</div>
                    <div style={{ fontSize: "13px", color: "#e0e0e0" }}>#{a.projectId || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Created</div>
                    <div style={{ fontSize: "13px", color: "#e0e0e0" }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", backgroundColor: "#333", color: "#e0e0e0", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Eye size={12} /> View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
