import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { Search } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

export default function AdminConsoleRuns() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "status">("recent");

  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 100, offset: 0 });
  const runs = runsQuery.data?.runs ?? [];

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = runs.filter((run) => {
      const statusMatch = filterStatus === "all" || run.status === filterStatus;
      const searchText = `${run.id} ${run.goal ?? ""} ${run.model ?? ""}`.toLowerCase();
      return statusMatch && (!q || searchText.includes(q));
    });

    if (sortBy === "status") {
      return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    }

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [runs, filterStatus, searchQuery, sortBy]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Filter, inspect, and open conversation outputs</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
          <div className="relative">
            <Search size={14} style={{ position: "absolute", left: "10px", top: "11px" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Session ID, goal, model"
              className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="awaiting_approval">Awaiting Approval</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "status")}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="recent">Recent</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="grid min-w-[760px] grid-cols-[7rem_1fr_8rem_11rem_8rem] gap-3 border-b border-border bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>ID</span>
          <span>Goal</span>
          <span>Status</span>
          <span>Created</span>
          <span className="text-right">Actions</span>
        </div>

        {runsQuery.isLoading && <RowMessage label="Loading runs..." />}
        {runsQuery.error && <RowMessage label="Failed to load runs." tone="error" />}
        {!runsQuery.isLoading && !runsQuery.error && filteredRuns.length === 0 && <RowMessage label="No runs found." />}

        {!runsQuery.isLoading && !runsQuery.error &&
          filteredRuns.map((run) => (
            <div
              key={run.id}
              className="grid min-w-[760px] grid-cols-[7rem_1fr_8rem_11rem_8rem] gap-3 border-b border-border px-4 py-3"
            >
              <span className="text-sm font-semibold text-foreground">#{run.id}</span>
              <span className="line-clamp-2 text-sm text-foreground">{run.goal ?? "No goal"}</span>
              <StatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">{formatDate(run.createdAt)}</span>
              <div className="text-right">
                <button
                  onClick={() => setLocation("/admin/console/files")}
                  className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  View Files
                </button>
              </div>
            </div>
          ))}
      </section>
    </AdminLayout>
  );
}

function RowMessage({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return (
    <div className={`px-4 py-6 text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
      {label}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "running"
      ? "bg-info/10 text-info"
      : status === "success"
      ? "bg-success/10 text-success"
      : status === "failed"
      ? "bg-destructive/10 text-destructive"
      : "bg-warning/10 text-warning";

  return <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium uppercase ${tone}`}>{status}</span>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
