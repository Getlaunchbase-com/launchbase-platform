import { useMemo } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, CheckCircle, Clock, MessageSquare, Play, Zap } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

export default function AdminConsoleDashboard() {
  const [, setLocation] = useLocation();
  const runtimeQuery = trpc.admin.operatorOS.getRuntimeStatus.useQuery();
  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 20, offset: 0 });
  const artifactsQuery = trpc.admin.operatorOS.listArtifacts.useQuery({ limit: 20, offset: 0 });
  const approvalsQuery = trpc.admin.operatorOS.pendingProposals.useQuery({ limit: 20, offset: 0 });

  const runtime = runtimeQuery.data;
  const runs = runsQuery.data?.runs ?? [];
  const artifacts = artifactsQuery.data?.artifacts ?? [];
  const approvals = approvalsQuery.data?.proposals ?? [];

  const activeRuns = runs.filter((run) => run.status === "running").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  const responseLabel = useMemo(() => {
    if (!runtime?.responseTimeMs) return "n/a";
    return `${runtime.responseTimeMs} ms`;
  }, [runtime]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold leading-tight text-foreground">Operator Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live health, runs, approvals, and artifacts</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="System Health"
          value={(runtime?.status ?? "offline").toUpperCase()}
          description={runtime?.handshakeOk ? "Handshake OK" : "Handshake not connected"}
          icon={<CheckCircle size={16} />}
          tone={runtime?.status === "healthy" ? "success" : "danger"}
        />
        <MetricCard
          label="Active Runs"
          value={String(activeRuns)}
          description={`${runs.length} total loaded`}
          icon={<Play size={16} />}
          tone="info"
        />
        <MetricCard
          label="Pending Approvals"
          value={String(approvals.length)}
          description={approvals.length > 0 ? "Needs operator review" : "No approvals waiting"}
          icon={<AlertCircle size={16} />}
          tone={approvals.length > 0 ? "warn" : "success"}
        />
        <MetricCard
          label="Runtime Response"
          value={responseLabel}
          description={`Failed runs: ${failedRuns}`}
          icon={<Clock size={16} />}
          tone="info"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ActionButton label="Open Agent Chat" icon={<MessageSquare size={14} />} onClick={() => setLocation("/admin/agent/chat")} primary />
        <ActionButton label="Open Runs" icon={<Zap size={14} />} onClick={() => setLocation("/admin/console/runs")} />
        <ActionButton label="Open Files" icon={<Clock size={14} />} onClick={() => setLocation("/admin/console/files")} />
        <ActionButton label="Open Approvals" icon={<AlertCircle size={14} />} onClick={() => setLocation("/admin/console/approvals")} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Runs</h2>
          {runsQuery.isLoading && <StateText label="Loading runs..." />}
          {runsQuery.error && <StateText label="Failed to load runs." tone="error" />}
          {!runsQuery.isLoading && !runsQuery.error && runs.length === 0 && <StateText label="No runs available." />}
          {runs.slice(0, 8).map((run) => (
            <button
              key={run.id}
              onClick={() => setLocation("/admin/console/runs")}
              className="mb-2 w-full rounded-lg border border-border bg-secondary p-3 text-left hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">Run #{run.id}</span>
                <StatusBadge status={run.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.goal ?? "No goal provided"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(run.createdAt)}</p>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Approvals + Artifacts</h2>

          <h3 className="mb-2 text-sm font-medium text-foreground">Pending Approvals</h3>
          {approvalsQuery.isLoading && <StateText label="Loading approvals..." />}
          {approvalsQuery.error && <StateText label="Failed to load approvals." tone="error" />}
          {!approvalsQuery.isLoading && !approvalsQuery.error && approvals.length === 0 && <StateText label="No pending approvals." />}
          {approvals.slice(0, 4).map((proposal) => (
            <div key={proposal.id} className="mb-2 rounded-md border border-border bg-secondary p-3">
              <div className="text-sm font-medium text-foreground">Proposal #{proposal.id}</div>
              <div className="text-xs text-muted-foreground">{proposal.title ?? "Untitled proposal"}</div>
            </div>
          ))}

          <h3 className="mb-2 mt-4 text-sm font-medium text-foreground">Recent Artifacts</h3>
          {artifactsQuery.isLoading && <StateText label="Loading artifacts..." />}
          {artifactsQuery.error && <StateText label="Failed to load artifacts." tone="error" />}
          {!artifactsQuery.isLoading && !artifactsQuery.error && artifacts.length === 0 && <StateText label="No artifacts available." />}
          {artifacts.slice(0, 5).map((artifact) => (
            <div key={artifact.id} className="mb-2 rounded-md border border-border bg-secondary p-3">
              <div className="text-sm font-medium text-foreground">{artifact.filename}</div>
              <div className="text-xs text-muted-foreground">{artifact.type} • {formatDate(artifact.createdAt)}</div>
            </div>
          ))}
        </section>
      </div>
    </AdminLayout>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone: "success" | "warn" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warn"
      ? "text-warning"
      : tone === "danger"
      ? "text-destructive"
      : "text-info";

  return (
    <div className="rounded-lg border border-border bg-background p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  primary = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary ${
        primary
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-secondary text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
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

  return <span className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${tone}`}>{status}</span>;
}

function StateText({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return <p className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{label}</p>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
