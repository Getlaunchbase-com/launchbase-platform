import { useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Download, Eye, Upload } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      const i = data.indexOf(",");
      resolve(i >= 0 ? data.slice(i + 1) : data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminConsoleFiles() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "uploads" | "artifacts">("all");
  const [projectId, setProjectId] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const artifactsQuery = trpc.admin.operatorOS.listArtifacts.useQuery({ limit: 100, offset: 0 });
  const uploadMut = trpc.admin.blueprints.upload.useMutation({
    onSuccess: async (data) => {
      setUploadMessage(`Upload complete (artifact #${data.artifactId}).`);
      setUploadFile(null);
      await utils.admin.operatorOS.listArtifacts.invalidate();
    },
    onError: (err) => {
      setUploadMessage(err.message || "Upload failed.");
    },
  });
  const artifacts = artifactsQuery.data?.artifacts ?? [];
  const canUpload = !!uploadFile && !uploadMut.isPending;

  async function onUploadNow() {
    if (!uploadFile) return;
    const base64Data = await fileToBase64(uploadFile);
    await uploadMut.mutateAsync({
      projectId,
      filename: uploadFile.name,
      mimeType: uploadFile.type || "application/pdf",
      base64Data,
    });
  }

  const { uploads, generated } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = artifacts.filter((file) => {
      if (!q) return true;
      return `${file.filename} ${file.type}`.toLowerCase().includes(q);
    });
    return {
      uploads: list.filter((file) => file.type === "blueprint_input"),
      generated: list.filter((file) => file.type !== "blueprint_input"),
    };
  }, [artifacts, searchQuery]);

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.2px", margin: "0 0 8px 0" }}>Files</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 20px 0" }}>
          Uploaded files and agent-generated artifacts
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={labelStyle}>Search</label>
            <input
              type="text"
              placeholder="Search by filename or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "uploads" | "artifacts")} style={inputStyle}>
              <option value="all">All</option>
              <option value="uploads">Uploads</option>
              <option value="artifacts">Artifacts</option>
            </select>
          </div>
        </div>

        <section style={{ ...panelStyle, marginBottom: "12px", borderStyle: "dashed", borderWidth: "2px" }}>
          <Upload size={22} style={{ margin: "0 auto 8px", color: "#888" }} />
          <div style={{ fontSize: "14px", color: "#d5d5d5", marginBottom: "8px", textAlign: "center" }}>Quick Upload</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px", alignItems: "center" }}>
            <input
              type="number"
              value={projectId}
              min={1}
              onChange={(e) => setProjectId(Number(e.target.value || 1))}
              style={inputStyle}
              aria-label="Project ID"
            />
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              style={{ ...inputStyle, padding: "6px" }}
              aria-label="Blueprint file"
            />
            <button
              onClick={onUploadNow}
              disabled={!canUpload}
              style={{
                ...actionStyle,
                justifyContent: "center",
                cursor: canUpload ? "pointer" : "not-allowed",
                opacity: canUpload ? 1 : 0.5,
                minWidth: "110px",
              }}
              title={!canUpload ? "Select a file first." : "Upload blueprint"}
            >
              {uploadMut.isPending ? "Uploading..." : "Upload"}
            </button>
          </div>
          {uploadFile && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#93c5fd" }}>
              Selected: {uploadFile.name} ({Math.max(1, Math.round(uploadFile.size / 1024))} KB)
            </div>
          )}
          {uploadMessage && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: uploadMessage.includes("complete") ? "#22c55e" : "#ef4444" }}>
              {uploadMessage}
            </div>
          )}
        </section>

        {(typeFilter === "all" || typeFilter === "uploads") && (
          <section style={{ ...panelStyle, marginBottom: "12px" }}>
            <h2 style={sectionTitle}>Uploads</h2>
            {artifactsQuery.isLoading && <Meta text="Loading uploads..." />}
            {artifactsQuery.error && <Meta text="Failed to load uploads." tone="error" />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && uploads.length === 0 && <Meta text="No uploads found." />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && uploads.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </section>
        )}

        {(typeFilter === "all" || typeFilter === "artifacts") && (
          <section style={panelStyle}>
            <h2 style={sectionTitle}>Generated Artifacts</h2>
            {artifactsQuery.isLoading && <Meta text="Loading artifacts..." />}
            {artifactsQuery.error && <Meta text="Failed to load artifacts." tone="error" />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && generated.length === 0 && <Meta text="No generated artifacts found." />}
            {!artifactsQuery.isLoading && !artifactsQuery.error && generated.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  );
}

function FileRow({ file }: { file: { id: number; filename: string; type: string; sizeBytes: number | null; createdAt: Date | string | null } }) {
  const hasUrl = file.id != null;
  const viewHref = `/api/artifacts/${file.id}`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "center", border: "1px solid #2d2d2d", borderRadius: "8px", padding: "10px", marginBottom: "8px", backgroundColor: "#111", overflowX: "auto" }}>
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#e9e9e9" }}>{file.filename}</div>
        <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
          {file.type} | {formatBytes(file.sizeBytes ?? 0)} | {formatDate(file.createdAt)}
        </div>
      </div>
      <a
        href={hasUrl ? viewHref : undefined}
        target="_blank"
        rel="noreferrer"
        style={{ ...actionStyle, opacity: hasUrl ? 1 : 0.45, pointerEvents: hasUrl ? "auto" : "none" }}
        title={hasUrl ? "View artifact" : "View unavailable"}
      >
        <Eye size={13} />
        View
      </a>
      <a
        href={hasUrl ? viewHref : undefined}
        download
        style={{ ...actionStyle, opacity: hasUrl ? 1 : 0.45, pointerEvents: hasUrl ? "auto" : "none" }}
        title={hasUrl ? "Download artifact" : "Download unavailable"}
      >
        <Download size={13} />
        Download
      </a>
    </div>
  );
}

function Meta({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return <div style={{ fontSize: "12px", color: tone === "error" ? "#ef4444" : "#777", marginBottom: "8px" }}>{text}</div>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatBytes(size: number) {
  if (!size || size < 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#777",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  display: "block",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0f0f0f",
  border: "1px solid #333",
  borderRadius: "6px",
  color: "#e0e0e0",
  fontSize: "12px",
  padding: "8px",
  outline: "none",
};

const panelStyle: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: "10px",
  padding: "14px",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: "14px",
  fontWeight: 700,
};

const actionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  border: "1px solid #333",
  borderRadius: "7px",
  padding: "7px 10px",
  color: "#ddd",
  textDecoration: "none",
  fontSize: "12px",
  backgroundColor: "#171717",
};
