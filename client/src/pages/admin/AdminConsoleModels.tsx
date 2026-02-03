import { AdminLayout } from "../../components/AdminLayout";
import { CheckCircle, Zap, Brain } from "../../components/Icons";

const MODELS = [
  {
    provider: "Anthropic",
    models: [
      { name: "Claude 3.5 Sonnet", cost: "$0.003/1k", capability: "Advanced reasoning, code", default: true },
      { name: "Claude 3 Opus", cost: "$0.015/1k", capability: "Complex tasks", default: false },
    ],
  },
  {
    provider: "OpenAI",
    models: [
      { name: "GPT-4o", cost: "$0.005/1k", capability: "Versatile, multimodal", default: false },
      { name: "GPT-4 Turbo", cost: "$0.01/1k", capability: "Advanced reasoning", default: false },
    ],
  },
  {
    provider: "DeepSeek",
    models: [
      { name: "O1", cost: "$0.002/1k", capability: "Cost-effective reasoning", default: false },
    ],
  },
];

export default function AdminConsoleModels() {
  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>Models & Brains</h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          450+ model profiles across multiple AI providers
        </p>

        {/* Default Profile */}
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0", color: "#999" }}>
            Default Brain Profile
          </h2>
          <div
            style={{
              padding: "16px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              border: "2px solid #ff6b35",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#e0e0e0", marginBottom: "4px" }}>
                Claude 3.5 Sonnet
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>Anthropic • $0.003/1k tokens</div>
            </div>
            <CheckCircle size={20} style={{ color: "#22c55e" }} />
          </div>
        </div>

        {/* All Models */}
        <div>
          {MODELS.map((provider) => (
            <div key={provider.provider} style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: "0 0 12px 0", color: "#999" }}>
                {provider.provider}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {provider.models.map((model, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 16px",
                      backgroundColor: "#1a1a1a",
                      borderRadius: "8px",
                      border: model.default ? "1px solid #ff6b35" : "1px solid #333",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#e0e0e0" }}>
                        {model.name}
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Cost: {model.cost}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{model.capability}</div>
                    {model.default && (
                      <div style={{ fontSize: "11px", color: "#ff6b35", fontWeight: "600" }}>Default</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
