import { AdminLayout } from "../../components/AdminLayout";
import { Upload, Download, Eye } from "lucide-react";

export default function AdminConsoleFiles() {
  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Files</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Uploaded files and agent artifacts
        </p>

        {/* Upload Section */}
        <div
          style={{
            padding: "40px 20px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "2px dashed #333",
            textAlign: "center",
            color: "#666",
            marginBottom: "32px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#666";
            e.currentTarget.style.backgroundColor = "#222";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.backgroundColor = "#1a1a1a";
          }}
        >
          <Upload size={24} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <p style={{ fontSize: "14px", margin: "0 0 4px 0" }}>Drop files here or click to upload</p>
          <p style={{ fontSize: "12px", color: "#555", margin: 0 }}>
            Supported formats: PDF, CSV, JSON, TXT, Images
          </p>
        </div>

        {/* Files List */}
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 16px 0" }}>
            Files & Artifacts
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
            <p style={{ fontSize: "14px", margin: 0 }}>No files yet</p>
            <p style={{ fontSize: "12px", color: "#555", margin: "4px 0 0 0" }}>
              Uploaded files and run artifacts will appear here
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
