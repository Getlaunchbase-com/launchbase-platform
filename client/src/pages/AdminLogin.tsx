import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

/**
 * Admin login page - redirects to OAuth if not authenticated,
 * or redirects to admin console if already authenticated
 */
export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      // Already authenticated - redirect to admin console
      if (user.role === "admin") {
        setLocation("/admin/swarm");
      } else {
        // Not an admin - redirect to home with error message
        setLocation("/?error=not_admin");
      }
    } else {
      // Not authenticated - redirect to OAuth
      // Store intended destination in sessionStorage so we can redirect back after login
      sessionStorage.setItem("admin_redirect_after_login", "/admin/swarm");
      window.location.href = "/api/auth/google";
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-[#1a1a1d] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6A00] mx-auto mb-4"></div>
        <p className="text-white">Redirecting to login...</p>
      </div>
    </div>
  );
}
