import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Brain,
  CheckSquare,
  FileText,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageSquare,
  Settings,
  Wrench,
  X,
  Zap,
} from "./Icons";

const navItems = [
  { href: "/admin/console", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agent/chat", label: "Agent Chat", icon: MessageSquare },
  { href: "/admin/console/marketing-agents", label: "Marketing Agents", icon: Zap },
  { href: "/admin/console/runs", label: "Runs", icon: ListTodo },
  { href: "/admin/console/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/admin/console/files", label: "Files", icon: FileText },
  { href: "/admin/console/tools", label: "Tools", icon: Wrench },
  { href: "/admin/console/settings", label: "Settings", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [buildInfo, setBuildInfo] = useState<{ gitSha: string; buildTime: string } | null>(null);

  useEffect(() => {
    fetch("/api/build-info")
      .then((r) => r.json())
      .then((data) => setBuildInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const routeTitle = useMemo(() => {
    const hit = navItems.find((n) => location === n.href || location.startsWith(n.href + "/"));
    return hit?.label ?? "Operator Console";
  }, [location]);

  const sidebarVisible = !isMobile || mobileOpen;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0d", color: "#f4f4f5", display: "flex" }}>
      {isMobile && mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, border: "none", background: "rgba(0,0,0,0.6)", zIndex: 20 }}
        />
      )}

      <aside
        aria-label="Admin navigation"
        style={{
          width: "272px",
          background: "#111214",
          borderRight: "1px solid #23252a",
          display: sidebarVisible ? "flex" : "none",
          flexDirection: "column",
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 30,
        }}
      >
        <div style={{ height: 72, padding: "0 16px", borderBottom: "1px solid #23252a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ff6b35", display: "grid", placeItems: "center", color: "#141414" }}>
              <Brain size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>LaunchBase</div>
              <div style={{ fontSize: 11, color: "#8e9199" }}>OperatorOS</div>
            </div>
          </div>
          {isMobile && (
            <button
              aria-label="Close sidebar"
              onClick={() => setMobileOpen(false)}
              style={iconBtnStyle}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav style={{ padding: 12, overflow: "auto", flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <a
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 6,
                    minHeight: 44,
                    borderRadius: 10,
                    border: active ? "1px solid #ff6b35" : "1px solid transparent",
                    background: active ? "rgba(255,107,53,0.14)" : "transparent",
                    color: active ? "#ffe2d6" : "#b5b8c0",
                    padding: "0 12px",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    textDecoration: "none",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255,107,53,0.35)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: "1px solid #23252a", fontSize: 11, color: "#8e9199" }}>
          <div style={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>Build</div>
          <div style={{ marginTop: 6, fontFamily: "monospace", color: "#c7cad1" }}>
            {buildInfo?.gitSha && buildInfo.gitSha !== "unknown" ? buildInfo.gitSha.slice(0, 7) : "unknown"}
          </div>
          <div style={{ marginTop: 2 }}>
            {buildInfo?.buildTime && buildInfo.buildTime !== "unknown" ? new Date(buildInfo.buildTime).toLocaleString() : "n/a"}
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 64, borderBottom: "1px solid #23252a", background: "#0f1013", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", position: "sticky", top: 0, zIndex: 10 }}>
          {isMobile && (
            <button aria-label="Open sidebar" onClick={() => setMobileOpen(true)} style={iconBtnStyle}>
              <Menu size={18} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5" }}>{routeTitle}</div>
            <div style={{ fontSize: 12, color: "#8e9199" }}>Admin route: {location}</div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9dc6ff", border: "1px solid #1f3e5f", background: "#0d2238", borderRadius: 999, padding: "4px 10px" }}>
            Stable Baseline
          </div>
        </header>

        <main id="main-content" style={{ flex: 1, overflow: "auto", padding: isMobile ? 14 : 20 }}>{children}</main>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "1px solid #30323a",
  background: "#15171c",
  color: "#d3d6de",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  outline: "none",
};