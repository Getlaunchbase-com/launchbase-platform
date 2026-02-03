import { useState } from "react";
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
} from "lucide-react";

const navItems = [
  { href: "/admin/console", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/console/agent-chat", label: "Agent Chat", icon: MessageSquare },
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

  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "#e0e0e0" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? "260px" : "0",
          transition: "width 0.3s ease",
          backgroundColor: "#1a1a1a",
          borderRight: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
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
          {sidebarOpen && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Brain size={24} style={{ color: "#ff6b35" }} />
              <span style={{ fontSize: "16px", fontWeight: "600" }}>LaunchBase</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: "16px", overflow: "auto" }}>
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
                    padding: "12px 12px",
                    marginBottom: "8px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: active ? "#ff6b35" : "#999",
                    backgroundColor: active ? "rgba(255, 107, 53, 0.1)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    borderLeft: active ? "3px solid #ff6b35" : "3px solid transparent",
                    paddingLeft: active ? "9px" : "12px",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(255, 107, 53, 0.05)";
                      e.currentTarget.style.color = "#bbb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#999";
                    }
                  }}
                >
                  <Icon size={20} style={{ flexShrink: 0 }} />
                  {sidebarOpen && <span style={{ fontSize: "14px" }}>{item.label}</span>}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div
            style={{
              padding: "16px",
              borderTop: "1px solid #333",
              fontSize: "12px",
              color: "#666",
            }}
          >
            <div>LaunchBase Console</div>
            <div style={{ marginTop: "4px" }}>Ready to operate</div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Bar */}
        <header
          style={{
            height: "60px",
            borderBottom: "1px solid #333",
            display: "flex",
            alignItems: "center",
            paddingLeft: "16px",
            paddingRight: "24px",
            backgroundColor: "#1a1a1a",
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#999",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e0e0e0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
          >
            {sidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: "13px", color: "#666" }}>Operator Console</div>
        </header>

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
