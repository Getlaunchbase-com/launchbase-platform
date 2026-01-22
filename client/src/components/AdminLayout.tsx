import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminLayout({ children, title = "Admin" }: AdminLayoutProps) {
  const [location] = useLocation();
  
  const navItems = [
    { path: "/admin", label: "Dashboard" },
    { path: "/admin/swarm", label: "Runs" },
    { path: "/admin/swarm/new", label: "New Run" },
    { path: "/admin/swarm/chat", label: "Ops Chat" },
    { path: "/admin/swarm/profiles", label: "Profiles" },
    { path: "/admin/swarm/repo", label: "Repo" },
    { path: "/admin/swarm/dashboard", label: "Dashboard" },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Desktop header */}
      <header className="hidden md:block border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <nav className="flex gap-4">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <a
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      location === item.path
                        ? "bg-orange-500 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    {item.label}
                  </a>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="flex justify-around">
          {navItems.slice(1, 5).map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={cn(
                  "flex flex-col items-center py-2 px-3 text-xs font-medium transition-colors",
                  location === item.path
                    ? "text-orange-500"
                    : "text-gray-400"
                )}
              >
                {item.label}
              </a>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
