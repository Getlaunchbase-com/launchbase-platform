import { useState, useEffect } from "react";
import { trpc } from "../../lib/trpc";

export default function AdminAgentChat() {
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [model, setModel] = useState("claude");
  const [maxSteps, setMaxSteps] = useState(10);
  const [maxErrors, setMaxErrors] = useState(3);

  // Create a new agent run
  const createRunMut = trpc.admin.agentRuns.create.useMutation({
    onSuccess: (data) => {
      setCurrentRunId(data.runId);
      setChatMessages([
        { role: "user", text: inputText },
        { role: "assistant", text: "Agent is thinking..." },
      ]);
      setInputText("");
    },
  });

  // Poll for events from the current run
  const eventsQuery = trpc.admin.agentEvents.list.useQuery(
    { runId: currentRunId || "", limit: 100 },
    {
      enabled: !!currentRunId,
      refetchInterval: 1000, // Poll every second
    }
  );

  // Update chat messages from events
  useEffect(() => {
    if (eventsQuery.data) {
      const messageEvents = eventsQuery.data.filter(
        (event: any) => event.type === "message"
      );

      if (messageEvents.length > 0) {
        const lastEvent = messageEvents[messageEvents.length - 1];
        setChatMessages((prev) => {
          // Remove "Agent is thinking..." placeholder
          const updated = prev.filter((msg) => msg.text !== "Agent is thinking...");

          // Add all message events
          messageEvents.forEach((event: any) => {
            if (!updated.find((msg) => msg.text === event.text)) {
              updated.push({
                role: event.role || "assistant",
                text: event.text || "",
              });
            }
          });

          return updated;
        });

        // If the agent is done, clear the run ID
        if (lastEvent.isComplete) {
          setCurrentRunId(null);
        }
      }
    }
  }, [eventsQuery.data]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    createRunMut.mutate({
      goal: inputText,
      model,
      maxSteps,
      maxErrors,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top Navigation */}
      <div style={{ padding: "0 20px", borderBottom: "1px solid #ddd", backgroundColor: "#f9f9f9", display: "flex", alignItems: "center", gap: "20px" }}>
        <h2 style={{ margin: "0 0 0 0", paddingRight: "20px", borderRight: "1px solid #ddd", fontSize: "18px", fontWeight: "bold" }}>
          LaunchBase Admin
        </h2>
        <a href="/admin" style={{ textDecoration: "none", color: "#666", padding: "12px 0", cursor: "pointer" }}>
          Dashboard
        </a>
        <a href="/admin/agent/chat" style={{ textDecoration: "none", color: "#007bff", padding: "12px 0", borderBottom: "2px solid #007bff", fontWeight: "bold", cursor: "pointer" }}>
          Agent Chat
        </a>
        <a href="/admin/agent-stack" style={{ textDecoration: "none", color: "#666", padding: "12px 0", cursor: "pointer" }}>
          Agent Stack
        </a>
        <a href="/admin/swarm" style={{ textDecoration: "none", color: "#666", padding: "12px 0", cursor: "pointer" }}>
          Swarm
        </a>
      </div>

      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid #ddd", backgroundColor: "#f9f9f9" }}>
        <h1 style={{ margin: "0 0 8px 0" }}>Agent Chat</h1>
        <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
          Launch real agent runs and see live responses
        </p>
      </div>

      {/* Settings Panel (collapsible) */}
      <div style={{ padding: "16px", borderBottom: "1px solid #eee", backgroundColor: "#fafafa" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: "bold" }}>
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!!currentRunId}
              style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ddd" }}
            >
              <option value="claude">Claude</option>
              <option value="gpt-4">GPT-4</option>
              <option value="o1">O1</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: "bold" }}>
              Max Steps: {maxSteps}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={maxSteps}
              onChange={(e) => setMaxSteps(parseInt(e.target.value))}
              disabled={!!currentRunId}
              style={{ width: "100%", cursor: currentRunId ? "not-allowed" : "pointer" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: "bold" }}>
              Max Errors: {maxErrors}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={maxErrors}
              onChange={(e) => setMaxErrors(parseInt(e.target.value))}
              disabled={!!currentRunId}
              style={{ width: "100%", cursor: currentRunId ? "not-allowed" : "pointer" }}
            />
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {chatMessages.length === 0 && !currentRunId && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#999" }}>
            <p>No messages yet. Start a conversation below.</p>
          </div>
        )}

        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              maxWidth: "70%",
              marginLeft: msg.role === "user" ? "auto" : 0,
              backgroundColor: msg.role === "user" ? "#007bff" : "#e9ecef",
              color: msg.role === "user" ? "white" : "#333",
              wordWrap: "break-word",
            }}
          >
            {msg.text}
          </div>
        ))}

        {eventsQuery.isLoading && currentRunId && (
          <div style={{ padding: "12px 16px", color: "#999", fontStyle: "italic" }}>
            Waiting for agent response...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #ddd",
          backgroundColor: "#fafafa",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !currentRunId && inputText.trim()) {
              handleSend();
            }
          }}
          placeholder="What do you want the agent to do?"
          disabled={!!currentRunId || createRunMut.isPending}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            fontSize: "14px",
            cursor: currentRunId ? "not-allowed" : "text",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!!currentRunId || createRunMut.isPending || !inputText.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: currentRunId || !inputText.trim() ? "#ccc" : "#007bff",
            color: "white",
            cursor: currentRunId || !inputText.trim() ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {createRunMut.isPending ? "Sending..." : "Send"}
        </button>
      </div>

      {/* Status indicator */}
      {currentRunId && (
        <div style={{ padding: "8px 16px", backgroundColor: "#fff3cd", fontSize: "12px", color: "#664d03" }}>
          Run ID: {currentRunId} (listening for updates...)
        </div>
      )}
    </div>
  );
}
