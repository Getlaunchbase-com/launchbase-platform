import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  ListTodo,
  CheckSquare,
  FileText,
  Wrench,
  Brain,
  Settings,
  ChevronDown,
  Menu,
  X,
} from "./Icons";

const navItems = [
  { href: "/admin/console", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agent/chat", label: "Agent Chat", icon: MessageSquare },
  { href: "/admin/console/marketing-agents", label: "Marketing Agents", icon: Zap },
  { href: "/admin/console/runs", label: "Runs", icon: ListTodo },
  { href: "/admin/console/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/admin/console/files", label: "Files", icon: FileText },
  { href: "/admin/console/tools", label: "Tools", icon: Wrench },
  { href: "/admin/console/models", label: "Models", icon: Brain },
  { href: "/admin/console/settings", label: "Settings", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [buildInfo, setBuildInfo] = useState<{ gitSha: string; buildTime: string } | null>(null);

  useEffect(() => {
    fetch("/api/build-info")
      .then((r) => r.json())
      .then((data) => setBuildInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isActive = (href: string) => {
    if (href === "/admin/agent/chat") {
      return location === "/admin/agent/chat" || location === "/admin/console/agent-chat";
    }
    return location === href || location.startsWith(href + "/");
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "#e0e0e0", position: "relative" }}>
      {isMobile && sidebarOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            border: "none",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            zIndex: 90,
            cursor: "pointer",
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? "260px" : "0",
          minWidth: sidebarOpen ? "260px" : "0",
          transition: "width 0.25s ease, min-width 0.25s ease",
          backgroundColor: "#1a1a1a",
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: isMobile ? "fixed" : "relative",
          height: "100vh",
          left: 0,
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Header with Logo */}
        <div
          style={{
            padding: "24px 16px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Brain size={24} style={{ color: "#ff6b35" }} />
            <span style={{ fontSize: "16px", fontWeight: "700", letterSpacing: "0.2px" }}>LaunchBase</span>
          </div>
          {isMobile && (
            <button
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              style={{
                background: "none",
                border: "1px solid #333",
                color: "#bbb",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: "12px 8px", overflow: "auto" }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <a
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 12px",
                    marginBottom: "6px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: active ? "#fff" : "#aaa",
                    backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderLeft: active ? "3px solid #fff" : "3px solid transparent",
                    paddingLeft: active ? "10px" : "12px",
                    fontWeight: active ? 600 : 500,
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "#ddd";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#aaa";
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255, 107, 53, 0.35)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <Icon size={20} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "14px" }}>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid #333",
            backgroundColor: "#141414",
            fontSize: "11px",
            color: "#555",
          }}
        >
          <div style={{ fontWeight: 700, color: "#777", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            LaunchBase Console
          </div>
          {buildInfo ? (
            <>
              <div style={{ marginTop: "4px", fontFamily: "monospace", color: "#8c8c8c" }}>
                {buildInfo.gitSha !== "unknown"
                  ? buildInfo.gitSha.slice(0, 7)
                  : "dev"}
              </div>
              <div style={{ marginTop: "2px" }}>
                {buildInfo.buildTime !== "unknown"
                  ? new Date(buildInfo.buildTime).toLocaleDateString()
                  : ""}
              </div>
            </>
          ) : (
            <div style={{ marginTop: "4px" }}>Loading...</div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Bar */}
        <header
          style={{
            height: "56px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            backgroundColor: "#1a1a1a",
            gap: "12px",
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
            style={{
              background: "none",
              border: "1px solid #333",
              cursor: "pointer",
              color: "#bbb",
              padding: "8px",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#bbb";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255, 107, 53, 0.35)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <Menu size={18} />
          </button>
          <div>
            <div style={{ fontSize: "13px", color: "#f0f0f0", fontWeight: 600 }}>Operator Console</div>
            <div style={{ fontSize: "11px", color: "#777" }}>Agent Stack Admin</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: "12px", color: "#a0a0a0", border: "1px solid #333", borderRadius: "999px", padding: "4px 10px" }}>
            System Online
          </div>
        </header>

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: isMobile ? "14px" : "20px 24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
