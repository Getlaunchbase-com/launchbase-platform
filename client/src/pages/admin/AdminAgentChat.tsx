import { useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { Search, Plus, Pin, Send, Zap, Pause, Square, Settings } from "../../components/Icons";

interface Thread {
  id: string;
  title: string;
  pinned: boolean;
  lastMessage: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "tool";
  content: string;
  timestamp: Date;
  toolName?: string;
}

export default function AdminAgentChat() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"agent" | "swarm" | "research">("agent");
  const [approvalsRequired, setApprovalsRequired] = useState(false);
  const [selectedBrain, setSelectedBrain] = useState("claude-3.5-sonnet");
  const [budgetLimit, setBudgetLimit] = useState(100);
  const [runningStatus, setRunningStatus] = useState<"idle" | "running" | "paused">("idle");

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: inputText,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputText("");
  };

  const handleNewThread = () => {
    const newThread: Thread = {
      id: `thread_${Date.now()}`,
      title: "New conversation",
      pinned: false,
      lastMessage: new Date().toISOString(),
    };
    setThreads([newThread, ...threads]);
    setSelectedThreadId(newThread.id);
    setMessages([]);
  };

  const togglePin = (threadId: string) => {
    setThreads(
      threads.map((t) => (t.id === threadId ? { ...t, pinned: !t.pinned } : t))
    );
  };

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const unpinnedThreads = filteredThreads.filter((t) => !t.pinned);

  return (
    <AdminLayout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", gap: "12px" }}>
        {/* Backend status */}
        <div style={{ padding: "8px 16px", backgroundColor: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", fontSize: "12px", color: "#f59e0b" }}>
          Chat is running in local mode. Messages are not persisted to the server — the swarm chat backend will be connected in a future update.
        </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 280px", gap: "12px", flex: 1 }}>
        {/* LEFT PANEL: Threads */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div style={{ padding: "12px", borderBottom: "1px solid #333" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "8px", color: "#666" }} />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  paddingLeft: "28px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#666")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#333")}
              />
            </div>
          </div>

          {/* New Thread Button */}
          <div style={{ padding: "8px" }}>
            <button
              onClick={handleNewThread}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#ff6b35",
                color: "#000",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ff7a4a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ff6b35")}
            >
              <Plus size={14} />
              New Thread
            </button>
          </div>

          {/* Threads List */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "8px",
            }}
          >
            {/* Pinned Threads */}
            {pinnedThreads.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", color: "#666", fontWeight: "600", padding: "8px 8px 4px 8px", textTransform: "uppercase" }}>
                  Pinned
                </div>
                {pinnedThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    selected={selectedThreadId === thread.id}
                    onSelect={setSelectedThreadId}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            )}

            {/* All Threads */}
            {unpinnedThreads.length > 0 && (
              <div>
                {pinnedThreads.length > 0 && (
                  <div style={{ fontSize: "10px", color: "#666", fontWeight: "600", padding: "8px 8px 4px 8px", textTransform: "uppercase" }}>
                    All
                  </div>
                )}
                {unpinnedThreads.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    selected={selectedThreadId === thread.id}
                    onSelect={setSelectedThreadId}
                    onTogglePin={togglePin}
                  />
                ))}
              </div>
            )}

            {threads.length === 0 && (
              <div style={{ padding: "16px", textAlign: "center", color: "#666", fontSize: "12px" }}>
                No threads yet. Create one to start.
              </div>
            )}
          </div>
        </div>

        {/* CENTER PANEL: Chat */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          {selectedThreadId && (
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid #333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>
                {threads.find((t) => t.id === selectedThreadId)?.title}
              </h2>
              <div style={{ fontSize: "12px", color: "#666" }}>
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {selectedThreadId ? (
              messages.length > 0 ? (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "70%",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        backgroundColor:
                          msg.role === "user"
                            ? "#ff6b35"
                            : msg.role === "agent"
                            ? "#333"
                            : "#222",
                        color: msg.role === "user" ? "#000" : "#e0e0e0",
                        fontSize: "14px",
                        lineHeight: "1.5",
                      }}
                    >
                      {msg.toolName && (
                        <div
                          style={{
                            fontSize: "11px",
                            opacity: 0.8,
                            marginBottom: "4px",
                            fontWeight: "600",
                          }}
                        >
                          {msg.toolName}
                        </div>
                      )}
                      {msg.content}
                      <div
                        style={{
                          fontSize: "11px",
                          opacity: 0.6,
                          marginTop: "6px",
                        }}
                      >
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#666",
                    fontSize: "14px",
                  }}
                >
                  Start a conversation with your agent
                </div>
              )
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Select or create a thread
              </div>
            )}
          </div>

          {/* Input */}
          {selectedThreadId && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #333",
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                placeholder="Message your agent..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: "#e0e0e0",
                  outline: "none",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#666")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#333")}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                style={{
                  padding: "10px 16px",
                  backgroundColor: inputText.trim() ? "#ff6b35" : "#333",
                  color: inputText.trim() ? "#000" : "#666",
                  border: "none",
                  borderRadius: "4px",
                  cursor: inputText.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (inputText.trim()) {
                    e.currentTarget.style.backgroundColor = "#ff7a4a";
                  }
                }}
                onMouseLeave={(e) => {
                  if (inputText.trim()) {
                    e.currentTarget.style.backgroundColor = "#ff6b35";
                  }
                }}
              >
                <Send size={14} />
                Send
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Control Panel */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
            border: "1px solid #333",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflow: "auto",
          }}
        >
          {/* Brain Selector */}
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Brain / Model
            </label>
            <select
              value={selectedBrain}
              onChange={(e) => setSelectedBrain(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                backgroundColor: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e0e0e0",
                outline: "none",
              }}
            >
              <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="o1">O1</option>
            </select>
          </div>

          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Mode
            </label>
            <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
              {(["agent", "swarm", "research"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: "8px 10px",
                    backgroundColor: mode === m ? "#ff6b35" : "#0f0f0f",
                    color: mode === m ? "#000" : "#e0e0e0",
                    border: mode === m ? "none" : "1px solid #333",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (mode !== m) {
                      e.currentTarget.style.backgroundColor = "#222";
                      e.currentTarget.style.borderColor = "#555";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (mode !== m) {
                      e.currentTarget.style.backgroundColor = "#0f0f0f";
                      e.currentTarget.style.borderColor = "#333";
                    }
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Approvals Toggle */}
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Approvals
            </label>
            <button
              onClick={() => setApprovalsRequired(!approvalsRequired)}
              style={{
                width: "100%",
                padding: "8px 10px",
                backgroundColor: approvalsRequired ? "#22c55e" : "#333",
                color: approvalsRequired ? "#000" : "#999",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {approvalsRequired ? "Required" : "Disabled"}
            </button>
          </div>

          {/* Budget Limit */}
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Budget Limit: ${budgetLimit}
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(parseInt(e.target.value))}
              style={{
                width: "100%",
              }}
            />
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Per run limit</div>
          </div>

          {/* Timeout / Safety */}
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "6px" }}>
              Timeout
            </label>
            <input
              type="number"
              defaultValue={300}
              min={60}
              max={3600}
              style={{
                width: "100%",
                padding: "8px 10px",
                backgroundColor: "#0f0f0f",
                border: "1px solid #333",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#e0e0e0",
                outline: "none",
              }}
            />
            <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Seconds</div>
          </div>

          {/* Control Buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <button
              onClick={() => setRunningStatus(runningStatus === "idle" ? "running" : "idle")}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: runningStatus === "running" ? "#ef4444" : "#ff6b35",
                color: "#000",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {runningStatus === "running" ? (
                <>
                  <Square size={14} /> Stop
                </>
              ) : (
                <>
                  <Zap size={14} /> Launch
                </>
              )}
            </button>
            <button
              onClick={() => setRunningStatus(runningStatus === "paused" ? "running" : "paused")}
              disabled={runningStatus === "idle"}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: "#333",
                color: runningStatus === "idle" ? "#666" : "#e0e0e0",
                border: "none",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: runningStatus === "idle" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
            >
              <Pause size={14} /> Pause
            </button>
          </div>
        </div>
      </div>
      </div>
    </AdminLayout>
  );
}

interface ThreadItemProps {
  thread: Thread;
  selected: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function ThreadItem({ thread, selected, onSelect, onTogglePin }: ThreadItemProps) {
  return (
    <div
      onClick={() => onSelect(thread.id)}
      style={{
        padding: "10px",
        margin: "4px 0",
        backgroundColor: selected ? "rgba(255, 107, 53, 0.1)" : "transparent",
        border: selected ? "1px solid #ff6b35" : "1px solid transparent",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {thread.title}
        </div>
        <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
          {new Date(thread.lastMessage).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(thread.id);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: thread.pinned ? "#ff6b35" : "#666",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#ff6b35")}
        onMouseLeave={(e) => (e.currentTarget.style.color = thread.pinned ? "#ff6b35" : "#666")}
      >
        <Pin size={12} fill={thread.pinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
