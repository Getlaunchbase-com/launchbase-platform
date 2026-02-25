import { useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { trpc } from "../../lib/trpc";

type UploadResult = {
  ok: boolean;
  blueprintDocumentId: number;
  uploadedBlueprintArtifactId: number;
  artifacts: {
    parseReportArtifactId: number;
    takeoffJsonArtifactId: number;
    xlsxArtifactId: number;
    docxArtifactId: number;
    bluebeamArtifactId: number;
  };
  parse: {
    pageCount: number;
    totalBlocks: number;
    legendCandidates: number;
  };
  symbolReading: {
    ok: boolean;
    detectionCount: number;
    modelVersion: string | null;
    warning: string | null;
  };
  takeoff: {
    totalDeviceTypes: number;
    totalDevices: number;
    lineItems: Array<{
      device_type: string;
      label: string;
      unit: string;
      quantity: number;
    }>;
  };
  quote: {
    currency: string;
    laborHours: number;
    laborRatePerHour: number;
    laborCost: number;
    materialCost: number;
    subtotal: number;
    markupPct: number;
    quoteTotal: number;
  };
};

function formatMoney(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

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

export default function AdminBlueprintViewer() {
  const [projectId, setProjectId] = useState(1);
  const [agentInstanceId, setAgentInstanceId] = useState<number | "">("");
  const [laborRatePerHour, setLaborRatePerHour] = useState(95);
  const [laborHoursPerDevice, setLaborHoursPerDevice] = useState(0.5);
  const [materialCostPerDevice, setMaterialCostPerDevice] = useState(125);
  const [quoteMarkupPct, setQuoteMarkupPct] = useState(0.25);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const uploadMut = trpc.blueprints.uploadAndGenerateQuotePackage.useMutation({
    onSuccess: (data) => {
      setLastResult(data as UploadResult);
      setLastError(null);
    },
    onError: (err) => {
      setLastError(err.message || "Upload pipeline failed");
    },
  });

  const busy = uploadMut.isPending;
  const canRun = !!selectedFile && !busy;

  const quoteTable = useMemo(() => {
    if (!lastResult) return null;
    return [
      ["Labor Hours", String(lastResult.quote.laborHours)],
      ["Labor Cost", formatMoney(lastResult.quote.laborCost)],
      ["Material Cost", formatMoney(lastResult.quote.materialCost)],
      ["Subtotal", formatMoney(lastResult.quote.subtotal)],
      ["Markup", `${(lastResult.quote.markupPct * 100).toFixed(1)}%`],
      ["Quote Total", formatMoney(lastResult.quote.quoteTotal)],
    ];
  }, [lastResult]);

  async function runPipeline() {
    if (!selectedFile) return;
    setLastResult(null);
    setLastError(null);
    const base64Data = await fileToBase64(selectedFile);

    await uploadMut.mutateAsync({
      projectId,
      agentInstanceId: agentInstanceId === "" ? undefined : agentInstanceId,
      filename: selectedFile.name,
      mimeType: selectedFile.type || "application/pdf",
      base64Data,
      laborRatePerHour,
      laborHoursPerDevice,
      materialCostPerDevice,
      quoteMarkupPct,
    });
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1220, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#f4f4f5" }}>
          Blueprint Quote Workbench
        </h1>
        <p style={{ marginTop: 8, color: "#a1a1aa", fontSize: 14 }}>
          One button flow for field teams: upload PDF, parse symbols/text, generate takeoff, build quote package files.
        </p>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 16,
          }}
        >
          <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#e5e7eb" }}>1. Upload + Generate</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Project ID
                <input
                  type="number"
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value || 0))}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Agent Instance ID (optional)
                <input
                  type="number"
                  value={agentInstanceId}
                  onChange={(e) => setAgentInstanceId(e.target.value === "" ? "" : Number(e.target.value))}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Labor Rate ($/hr)
                <input
                  type="number"
                  step="0.01"
                  value={laborRatePerHour}
                  onChange={(e) => setLaborRatePerHour(Number(e.target.value || 0))}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Labor Hours / Device
                <input
                  type="number"
                  step="0.01"
                  value={laborHoursPerDevice}
                  onChange={(e) => setLaborHoursPerDevice(Number(e.target.value || 0))}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Material Cost / Device
                <input
                  type="number"
                  step="0.01"
                  value={materialCostPerDevice}
                  onChange={(e) => setMaterialCostPerDevice(Number(e.target.value || 0))}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
              <label style={{ color: "#9ca3af", fontSize: 12 }}>
                Markup (%)
                <input
                  type="number"
                  step="0.01"
                  value={quoteMarkupPct * 100}
                  onChange={(e) => setQuoteMarkupPct(Number(e.target.value || 0) / 100)}
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#e5e7eb" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 12, border: "1px dashed #374151", borderRadius: 10, padding: 12, background: "#0b1220" }}>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 8 }}>
                {selectedFile ? `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : "Select a blueprint PDF"}
              </div>
            </div>

            <button
              onClick={() => void runPipeline()}
              disabled={!canRun}
              style={{
                marginTop: 14,
                width: "100%",
                background: canRun ? "#f97316" : "#374151",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 14px",
                fontWeight: 700,
                cursor: canRun ? "pointer" : "not-allowed",
                fontSize: 15,
              }}
            >
              {busy ? "Processing Blueprint Package..." : "Generate Quote Package"}
            </button>

            {lastError && (
              <div style={{ marginTop: 10, color: "#fecaca", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10 }}>
                {lastError}
              </div>
            )}
          </section>

          <section style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 18, color: "#e5e7eb" }}>2. Pipeline Status</h2>
            <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.7 }}>
              <div>Upload</div>
              <div>Parse (BlueprintParseV1)</div>
              <div>Symbol Read</div>
              <div>Takeoff Build</div>
              <div>Excel + Word + Bluebeam</div>
              <div>Quote Values</div>
            </div>
            {busy && (
              <div style={{ marginTop: 12, height: 8, borderRadius: 999, background: "#1f2937", overflow: "hidden" }}>
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#f97316,#fb923c)", animation: "pulse 1.2s ease-in-out infinite" }} />
              </div>
            )}
          </section>
        </div>

        {lastResult && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#e5e7eb" }}>Results</h2>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8 }}>
                <div>Blueprint Document ID: {lastResult.blueprintDocumentId}</div>
                <div>Uploaded Artifact ID: {lastResult.uploadedBlueprintArtifactId}</div>
                <div>Pages Parsed: {lastResult.parse.pageCount}</div>
                <div>Text Blocks: {lastResult.parse.totalBlocks}</div>
                <div>Legend Candidates: {lastResult.parse.legendCandidates}</div>
                <div>Symbol Detection Count: {lastResult.symbolReading.detectionCount}</div>
                <div>Total Device Types: {lastResult.takeoff.totalDeviceTypes}</div>
                <div>Total Devices: {lastResult.takeoff.totalDevices}</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <a href={`/api/artifacts/${lastResult.artifacts.parseReportArtifactId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>Parse JSON</button>
                </a>
                <a href={`/api/artifacts/${lastResult.artifacts.takeoffJsonArtifactId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>Takeoff JSON</button>
                </a>
                <a href={`/api/artifacts/${lastResult.artifacts.xlsxArtifactId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>Excel</button>
                </a>
                <a href={`/api/artifacts/${lastResult.artifacts.docxArtifactId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>Word</button>
                </a>
                <a href={`/api/artifacts/${lastResult.artifacts.bluebeamArtifactId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", gridColumn: "1 / span 2" }}>
                  <button style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", cursor: "pointer" }}>Bluebeam CSV</button>
                </a>
              </div>
            </section>

            <section style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#e5e7eb" }}>Quote</h2>
              {quoteTable && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <tbody>
                    {quoteTable.map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ padding: "8px 6px", color: "#94a3b8", borderBottom: "1px solid #1f2937" }}>{k}</td>
                        <td style={{ padding: "8px 6px", color: "#e2e8f0", textAlign: "right", borderBottom: "1px solid #1f2937", fontWeight: 600 }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
