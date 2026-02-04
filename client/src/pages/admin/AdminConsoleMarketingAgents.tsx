import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Play, Pause, Square, FileText, ChevronDown } from "../../components/Icons";

const MARKETING_AGENTS = [
  { id: 1, name: "Signals", description: "Market signal analysis", color: "#3b82f6" },
  { id: 2, name: "Intelligence", description: "Competitive intelligence", color: "#8b5cf6" },
  { id: 3, name: "Strategy", description: "Campaign strategy planning", color: "#ec4899" },
  { id: 4, name: "Experiments", description: "A/B testing & experimentation", color: "#f59e0b" },
  { id: 5, name: "Execution", description: "Campaign execution & deployment", color: "#10b981" },
  { id: 6, name: "Measurement", description: "Performance measurement & reporting", color: "#06b6d4" },
];

interface AgentStatus {
  [key: number]: "idle" | "running" | "blocked" | "needs_approval";
}

export default function AdminConsoleMarketingAgents() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    1: "idle",
    2: "idle",
    3: "idle",
    4: "idle",
    5: "idle",
    6: "idle",
  });

  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  const handleStart = (agentId: number) => {
    setAgentStatus((prev) => ({ ...prev, [agentId]: "running" }));
  };

  const handlePause = (agentId: number) => {
    setAgentStatus((prev) => ({ ...prev, [agentId]: "paused" }));
  };

  const handleStop = (agentId: number) => {
    setAgentStatus((prev) => ({ ...prev, [agentId]: "idle" }));
  };

  const toggleExpanded = (agentId: number) => {
    setExpandedAgent(expandedAgent === agentId ? null : agentId);
  };

  return (
    <AdminLayout>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}>
          Marketing Agents
        </h1>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 32px 0" }}>
          Monitor and control 6 specialized marketing agents
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
          {MARKETING_AGENTS.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              status={agentStatus[agent.id]}
              expanded={expandedAgent === agent.id}
              onToggleExpanded={() => toggleExpanded(agent.id)}
              onStart={() => handleStart(agent.id)}
              onPause={() => handlePause(agent.id)}
              onStop={() => handleStop(agent.id)}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

interface AgentCardProps {
  agent: { id: number; name: string; description: string; color: string };
  status: "idle" | "running" | "blocked" | "needs_approval" | "paused";
  expanded: boolean;
  onToggleExpanded: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

function AgentCard({
  agent,
  status,
  expanded,
  onToggleExpanded,
  onStart,
  onPause,
  onStop,
}: AgentCardProps) {
  const statusColor =
    status === "idle"
      ? "#666"
      : status === "running"
      ? "#22c55e"
      : status === "paused"
      ? "#f59e0b"
      : "#ef4444";

  const statusLabel = status === "paused" ? "paused" : status;

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        borderRadius: "8px",
        border: `1px solid ${expanded ? agent.color : "#333"}`,
        overflow: "hidden",
        transition: "all 0.3s",
      }}
    >
      {/* Header */}
      <div
        onClick={onToggleExpanded}
        style={{
          padding: "16px",
          backgroundColor: "#0f0f0f",
          borderBottom: expanded ? `2px solid ${agent.color}` : "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: statusColor,
              }}
            />
            <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#e0e0e0" }}>
              {agent.name}
            </h3>
          </div>
          <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>{agent.description}</p>
        </div>
        <ChevronDown
          size={16}
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            color: "#666",
          }}
        />
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "16px", borderTop: "1px solid #333" }}>
          {/* Status & Progress */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "#666", fontWeight: "600", marginBottom: "6px" }}>
              Status
            </div>
            <div
              style={{
                padding: "8px 12px",
                backgroundColor: `${agent.color}20`,
                borderRadius: "4px",
                fontSize: "13px",
                color: agent.color,
                fontWeight: "600",
                textTransform: "capitalize",
              }}
            >
              {statusLabel}
            </div>
          </div>

          {/* Current Objective */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "#666", fontWeight: "600", marginBottom: "6px" }}>
              Current Objective
            </div>
            <div style={{ fontSize: "13px", color: "#999" }}>
              {status === "idle" ? "Awaiting instruction" : "Running task..."}
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "#666", fontWeight: "600", marginBottom: "6px" }}>
              Progress
            </div>
            <div
              style={{
                width: "100%",
                height: "6px",
                backgroundColor: "#0f0f0f",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: status === "idle" ? "0%" : status === "running" ? "45%" : "100%",
                  backgroundColor: agent.color,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onStart}
              disabled={status === "running"}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: status === "running" ? "#333" : agent.color,
                color: status === "running" ? "#666" : "#000",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: status === "running" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <Play size={12} /> Start
            </button>
            <button
              onClick={onPause}
              disabled={status !== "running"}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: "#333",
                color: status !== "running" ? "#666" : "#e0e0e0",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: status !== "running" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <Pause size={12} /> Pause
            </button>
            <button
              onClick={onStop}
              disabled={status === "idle"}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: "#333",
                color: status === "idle" ? "#666" : "#e0e0e0",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: status === "idle" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
              }}
            >
              <Square size={12} /> Stop
            </button>
          </div>

          {/* Request Report */}
          <button
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "8px",
              backgroundColor: "#1a1a1a",
              color: "#999",
              border: "1px solid #333",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#555";
              e.currentTarget.style.color = "#bbb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#333";
              e.currentTarget.style.color = "#999";
            }}
          >
            <FileText size={12} /> Request Report
          </button>

          {/* Expanded Details */}
          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #333" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div style={{ padding: "8px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Timeline</div>
                <div style={{ fontSize: "12px", color: "#e0e0e0", marginTop: "2px" }}>No data</div>
              </div>
              <div style={{ padding: "8px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Learnings</div>
                <div style={{ fontSize: "12px", color: "#e0e0e0", marginTop: "2px" }}>No data</div>
              </div>
              <div style={{ padding: "8px", backgroundColor: "#0f0f0f", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Artifacts</div>
                <div style={{ fontSize: "12px", color: "#e0e0e0", marginTop: "2px" }}>No data</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
