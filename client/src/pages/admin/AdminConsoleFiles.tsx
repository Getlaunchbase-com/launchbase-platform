import { useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Download, Eye, Upload } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      const idx = data.indexOf(",");
      resolve(idx >= 0 ? data.slice(idx + 1) : data);
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

  const { uploads, generated } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = artifacts.filter((item) => {
      if (!q) return true;
      return `${item.filename} ${item.type}`.toLowerCase().includes(q);
    });

    return {
      uploads: filtered.filter((item) => item.type === "blueprint_input"),
      generated: filtered.filter((item) => item.type !== "blueprint_input"),
    };
  }, [artifacts, searchQuery]);

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

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Files</h1>
        <p className="mt-1 text-sm text-muted-foreground">Uploads and generated artifacts with direct actions</p>
      </div>

      <section className="mb-4 rounded-lg border border-border border-dashed bg-secondary p-6">
        <div className="mb-4 flex items-center gap-2 text-foreground">
          <Upload size={18} />
          <h2 className="text-lg font-semibold">Quick Upload</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="number"
            min={1}
            value={projectId}
            onChange={(e) => setProjectId(Number(e.target.value || 1))}
            aria-label="Project ID"
            className="h-12 rounded-lg border border-input bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            aria-label="Blueprint PDF"
            className="h-12 rounded-lg border border-input bg-background px-3 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
          />

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filename or type"
            className="h-12 rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "uploads" | "artifacts")}
              className="h-12 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="uploads">Uploads</option>
              <option value="artifacts">Artifacts</option>
            </select>
            <button
              onClick={onUploadNow}
              disabled={!canUpload}
              className="h-12 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadMut.isPending ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        {uploadFile && (
          <p className="mt-2 text-sm text-info">
            Selected: {uploadFile.name} ({Math.max(1, Math.round(uploadFile.size / 1024))} KB)
          </p>
        )}
        {uploadMessage && (
          <p className={`mt-2 text-sm ${uploadMessage.includes("complete") ? "text-success" : "text-destructive"}`}>
            {uploadMessage}
          </p>
        )}
      </section>

      {(typeFilter === "all" || typeFilter === "uploads") && (
        <section className="mb-4 rounded-lg border border-border bg-background p-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Uploads</h2>
          {artifactsQuery.isLoading && <StateText label="Loading uploads..." />}
          {artifactsQuery.error && <StateText label="Failed to load uploads." tone="error" />}
          {!artifactsQuery.isLoading && !artifactsQuery.error && uploads.length === 0 && <StateText label="No uploads found." />}
          {uploads.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </section>
      )}

      {(typeFilter === "all" || typeFilter === "artifacts") && (
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Generated Artifacts</h2>
          {artifactsQuery.isLoading && <StateText label="Loading artifacts..." />}
          {artifactsQuery.error && <StateText label="Failed to load artifacts." tone="error" />}
          {!artifactsQuery.isLoading && !artifactsQuery.error && generated.length === 0 && <StateText label="No generated artifacts found." />}
          {generated.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </section>
      )}
    </AdminLayout>
  );
}

function FileRow({
  file,
}: {
  file: {
    id: number;
    filename: string;
    type: string;
    sizeBytes: number | null;
    createdAt: Date | string | null;
  };
}) {
  const href = `/api/artifacts/${file.id}`;

  return (
    <div className="mb-2 grid grid-cols-1 gap-3 rounded-lg border border-border bg-secondary p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div>
        <p className="text-sm font-medium text-foreground">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.type} • {formatBytes(file.sizeBytes ?? 0)} • {formatDate(file.createdAt)}
        </p>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Eye size={13} />
        View
      </a>

      <a
        href={href}
        download
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <Download size={13} />
        Download
      </a>
    </div>
  );
}

function StateText({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return <p className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{label}</p>;
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
