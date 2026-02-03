import { useState } from "react";
import { trpc } from "../../lib/trpc";

export default function AdminAgentChat() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessageText, setNewMessageText] = useState("");

  const threadsQuery = trpc.admin.agentChat.threads.list.useQuery();
  const messagesQuery = trpc.admin.agentChat.messages.list.useQuery(
    { threadId: selectedThreadId || "" },
    { enabled: !!selectedThreadId }
  );

  const createThreadMut = trpc.admin.agentChat.threads.create.useMutation({
    onSuccess: (thread) => {
      threadsQuery.refetch();
      setSelectedThreadId(thread.id);
    },
  });

  const sendMessageMut = trpc.admin.agentChat.messages.send.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      setNewMessageText("");
    },
  });

  const threads = threadsQuery.data || [];
  const messages = messagesQuery.data || [];

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Threads list */}
      <div style={{ width: 250, borderRight: "1px solid #ddd", padding: 16 }}>
        <h3>Threads</h3>
        <button
          onClick={() => createThreadMut.mutate()}
          style={{ width: "100%", marginBottom: 12 }}
        >
          New Thread
        </button>

        <div style={{ overflowY: "auto", maxHeight: "calc(100% - 60px)" }}>
          {threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => setSelectedThreadId(thread.id)}
              style={{
                padding: 8,
                marginBottom: 4,
                backgroundColor: selectedThreadId === thread.id ? "#007bff" : "#f0f0f0",
                color: selectedThreadId === thread.id ? "white" : "black",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {thread.title || `Thread ${thread.id.substring(0, 8)}`}
            </div>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedThreadId ? (
          <>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                backgroundColor: "#fafafa",
              }}
            >
              {messagesQuery.isLoading && <div>Loading messages...</div>}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 12,
                    padding: 8,
                    backgroundColor: msg.role === "user" ? "#007bff" : "#e9ecef",
                    color: msg.role === "user" ? "white" : "black",
                    borderRadius: 4,
                    maxWidth: "80%",
                    marginLeft: msg.role === "user" ? "auto" : 0,
                  }}
                >
                  <strong>{msg.role}:</strong> {msg.text}
                </div>
              ))}
            </div>

            <div style={{ padding: 16, borderTop: "1px solid #ddd", display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newMessageText.trim()) {
                    sendMessageMut.mutate({
                      threadId: selectedThreadId,
                      text: newMessageText,
                    });
                  }
                }}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
              />
              <button
                onClick={() => {
                  if (newMessageText.trim()) {
                    sendMessageMut.mutate({
                      threadId: selectedThreadId,
                      text: newMessageText,
                    });
                  }
                }}
                disabled={sendMessageMut.isPending || !newMessageText.trim()}
                style={{ padding: "8px 16px" }}
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
            Select or create a thread to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
