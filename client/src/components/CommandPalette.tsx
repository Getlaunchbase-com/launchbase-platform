import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "wouter";
import { Search, Zap, MessageSquare, Settings, FileText, Brain } from "./Icons";

interface Command {
  id: string;
  title: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useNavigate();

  const commands: Command[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <Zap size={16} />,
      action: () => {
        navigate("/admin/console");
        setIsOpen(false);
      },
      group: "Navigation",
    },
    {
      id: "agent-chat",
      title: "Agent Chat",
      icon: <MessageSquare size={16} />,
      action: () => {
        navigate("/admin/console/agent-chat");
        setIsOpen(false);
      },
      group: "Navigation",
    },
    {
      id: "marketing-agents",
      title: "Marketing Agents",
      icon: <Zap size={16} />,
      action: () => {
        navigate("/admin/console/marketing-agents");
        setIsOpen(false);
      },
      group: "Navigation",
    },
    {
      id: "runs",
      title: "Runs",
      icon: <FileText size={16} />,
      action: () => {
        navigate("/admin/console/runs");
        setIsOpen(false);
      },
      group: "Navigation",
    },
    {
      id: "settings",
      title: "Settings",
      icon: <Settings size={16} />,
      action: () => {
        navigate("/admin/console/settings");
        setIsOpen(false);
      },
      group: "Navigation",
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen);
        setSearch("");
        setSelectedIndex(0);
      }

      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, search, selectedIndex, filteredCommands]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "100px",
        zIndex: 1000,
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "500px",
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          border: "1px solid #333",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Search size={16} style={{ color: "#666" }} />
          <input
            type="text"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            style={{
              flex: 1,
              background: "none",
              border: "none",
              fontSize: "14px",
              color: "#e0e0e0",
              outline: "none",
            }}
          />
          <div style={{ fontSize: "11px", color: "#666" }}>ESC</div>
        </div>

        {/* Commands List */}
        <div style={{ maxHeight: "400px", overflow: "auto" }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#666", fontSize: "13px" }}>
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => cmd.action()}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  backgroundColor: idx === selectedIndex ? "rgba(255, 107, 53, 0.1)" : "transparent",
                  borderLeft: idx === selectedIndex ? "3px solid #ff6b35" : "3px solid transparent",
                  paddingLeft: idx === selectedIndex ? "13px" : "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "all 0.1s",
                }}
              >
                <div style={{ color: "#666", display: "flex" }}>{cmd.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", color: "#e0e0e0", fontWeight: "500" }}>
                    {cmd.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#555" }}>{cmd.group}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#666" }}>⏎</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
