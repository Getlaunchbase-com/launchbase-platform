import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../../components/AdminLayout";
import { AlertCircle, Pause, Play, Search, Send, Square } from "../../components/Icons";
import { trpc } from "../../lib/trpc";

type RunFilter = "all" | "running" | "failed" | "awaiting_approval" | "success";

export default function AdminAgentChat() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<RunFilter>("all");
  const [composerText, setComposerText] = useState("");
  const [runGoalOverride, setRunGoalOverride] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const runtimeQuery = trpc.admin.operatorOS.getRuntimeStatus.useQuery();
  const runsQuery = trpc.admin.operatorOS.listRuns.useQuery({ limit: 100, offset: 0 });
  const artifactsQuery = trpc.admin.operatorOS.listArtifacts.useQuery({ limit: 20, offset: 0 });
  const approvalsQuery = trpc.admin.operatorOS.pendingProposals.useQuery({ limit: 20, offset: 0 });

  const launchRunMut = trpc.admin.operatorOS.launchInstanceRun.useMutation({
    onSuccess: async (data) => {
      setActionMessage(`Session #${data.runId} started.`);
      setComposerText("");
      setRunGoalOverride("");
      await utils.admin.operatorOS.listRuns.invalidate();
    },
    onError: (err) => {
      setActionMessage(err.message || "Failed to start run.");
    },
  });

  const allRuns = runsQuery.data?.runs ?? [];
  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRuns.filter((run) => {
      const statusOk = filter === "all" || run.status === filter;
      const searchText = `${run.id} ${run.goal ?? ""} ${run.model ?? ""}`.toLowerCase();
      return statusOk && (!q || searchText.includes(q));
    });
  }, [allRuns, filter, searchQuery]);

  const selectedRun = useMemo(() => {
    if (selectedRunId != null) {
      const picked = filteredRuns.find((r) => r.id === selectedRunId);
      if (picked) return picked;
    }
    return (
      filteredRuns.find((r) => r.status === "running") ??
      filteredRuns.find((r) => r.status === "awaiting_approval") ??
      filteredRuns[0] ??
      null
    );
  }, [filteredRuns, selectedRunId]);

  const runtimeStatus = runtimeQuery.data?.status ?? "offline";
  const runtimeHealthy = runtimeStatus === "healthy";
  const pendingApprovals = approvalsQuery.data?.proposals ?? [];
  const recentArtifacts = artifactsQuery.data?.artifacts ?? [];

  const canStart =
    runtimeHealthy &&
    !!selectedRun &&
    selectedRun.projectId != null &&
    selectedRun.agentInstanceId != null &&
    !launchRunMut.isPending;

  async function startRunFromComposer() {
    if (!selectedRun || selectedRun.projectId == null || selectedRun.agentInstanceId == null) {
      setActionMessage("Select a conversation with workspace and profile context.");
      return;
    }

    const goal =
      runGoalOverride.trim() ||
      composerText.trim() ||
      selectedRun.goal ||
      `Operator run ${new Date().toISOString()}`;

    await launchRunMut.mutateAsync({
      projectId: selectedRun.projectId,
      agentInstanceId: selectedRun.agentInstanceId,
      goal,
      model: selectedRun.model ?? undefined,
    });
  }

  return (
    <AdminLayout>
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_21rem]">
        <aside className="rounded-lg border border-border bg-secondary">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Live conversations from assistant stack</p>
            <div className="relative mt-3">
              <Search size={14} style={{ position: "absolute", left: "10px", top: "11px" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "running", "awaiting_approval", "failed", "success"] as const).map((value) => {
                const active = filter === value;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`h-9 rounded-md border px-3 text-xs font-medium capitalize focus:outline-none focus:ring-2 focus:ring-primary ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {value.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto p-3 lg:max-h-[calc(100vh-18rem)]">
            {runsQuery.isLoading && <StateText label="Loading conversations..." />}
            {runsQuery.error && <StateText label="Could not load conversations." tone="error" />}
            {!runsQuery.isLoading && !runsQuery.error && filteredRuns.length === 0 && <StateText label="No conversations found." />}
            {filteredRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`mb-2 w-full rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
                  selectedRun?.id === run.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">Conversation #{run.id}</span>
                  <StatusBadge status={run.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{run.goal ?? "No goal provided"}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(run.createdAt)}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[32rem] flex-col rounded-lg border border-border bg-background">
          <header className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Assistant Workspace</h1>
                <p className="text-sm text-muted-foreground">Active interface with live run execution controls</p>
              </div>
              <StatusBadge status={runtimeStatus} prefix="Runtime" />
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {selectedRun ? (
              <>
                <MessageCard
                  role="operator"
                  title={`Selected Conversation #${selectedRun.id}`}
                  body={selectedRun.goal ?? "No goal provided."}
                  meta={`Model: ${selectedRun.model ?? "default"}`}
                />
                <MessageCard
                  role="system"
                  title="Runtime Context"
                  body={`Status: ${runtimeStatus}. Handshake: ${runtimeQuery.data?.handshakeOk ? "OK" : "Not connected"}.`}
                  meta={`Last seen: ${formatDate(runtimeQuery.data?.lastSeen ?? null)}`}
                />
                <MessageCard
                  role="agent"
                  title="Artifacts + Approvals"
                  body={`Artifacts loaded: ${recentArtifacts.length}. Pending approvals: ${pendingApprovals.length}.`}
                  meta="Use actions below to open full panels"
                />
              </>
            ) : (
              <StateText label="Select a run to activate workspace context." />
            )}
          </div>

          <div className="border-t border-border p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Message Intent Override</label>
            <input
              value={runGoalOverride}
              onChange={(e) => setRunGoalOverride(e.target.value)}
              placeholder="Optional explicit intent for Start Session"
              className="mb-3 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Message Composer</label>
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder="Type instruction and press Start Session"
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {actionMessage && (
              <div className={`mt-2 text-sm ${actionMessage.includes("started") ? "text-success" : "text-destructive"}`}>
                {actionMessage}
              </div>
            )}

            <div className="sticky bottom-0 mt-3 flex flex-wrap gap-2 border-t border-border bg-background pt-3">
              <button
                disabled={!canStart}
                onClick={startRunFromComposer}
                className="inline-flex h-12 min-w-[10rem] items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={14} />
                {launchRunMut.isPending ? "Starting..." : "Start Session"}
              </button>

              <button
                onClick={() => {
                  setActionMessage("Stop/Pause control is managed from run orchestration. Opening runs.");
                  setLocation("/admin/console/runs");
                }}
                className="inline-flex h-12 min-w-[10rem] items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 text-sm font-medium text-foreground"
              >
                <Square size={14} />
                Stop Session
              </button>

              <button
                onClick={() => {
                  setActionMessage("Pause control is managed from run orchestration. Opening runs.");
                  setLocation("/admin/console/runs");
                }}
                className="inline-flex h-12 min-w-[10rem] items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground"
              >
                <Pause size={14} />
                Pause
              </button>

              <button
                onClick={() => setLocation("/admin/console/files")}
                className="inline-flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground"
              >
                <Send size={14} />
                Open Files ({recentArtifacts.length})
              </button>

              <button
                onClick={() => setLocation("/admin/console/approvals")}
                className="inline-flex h-12 min-w-[11rem] items-center justify-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground"
              >
                <AlertCircle size={14} />
                Open Approvals ({pendingApprovals.length})
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-secondary p-4">
          <h2 className="text-sm font-semibold text-foreground">Conversation Context</h2>
          <p className="mt-1 text-xs text-muted-foreground">Tools, artifacts, approvals</p>

          <div className="mt-4 space-y-3">
            <Panel title="Session Status">
              {selectedRun ? (
                <div className="space-y-1 text-sm text-foreground">
                  <div>Conversation #{selectedRun.id}</div>
                  <div className="text-muted-foreground">Workspace: {selectedRun.projectId ?? "n/a"}</div>
                  <div className="text-muted-foreground">Assistant Profile: {selectedRun.agentInstanceId ?? "n/a"}</div>
                  <div className="text-muted-foreground">Created: {formatDate(selectedRun.createdAt)}</div>
                </div>
              ) : (
                <StateText label="No run selected." />
              )}
            </Panel>

            <Panel title="Tools">
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Blueprint Parse</li>
                <li>Takeoff Export</li>
                <li>Artifact Delivery</li>
              </ul>
            </Panel>

            <Panel title={`Artifacts (${recentArtifacts.length})`}>
              {artifactsQuery.isLoading && <StateText label="Loading artifacts..." />}
              {artifactsQuery.error && <StateText label="Failed to load artifacts." tone="error" />}
              {!artifactsQuery.isLoading && !artifactsQuery.error && recentArtifacts.length === 0 && (
                <StateText label="No artifacts yet." />
              )}
              {recentArtifacts.slice(0, 5).map((artifact) => (
                <div key={artifact.id} className="mb-2 rounded-md border border-border bg-background p-2">
                  <div className="text-xs font-medium text-foreground">{artifact.filename}</div>
                  <div className="text-xs text-muted-foreground">{artifact.type}</div>
                </div>
              ))}
            </Panel>

            <Panel title={`Approvals (${pendingApprovals.length})`}>
              {approvalsQuery.isLoading && <StateText label="Loading approvals..." />}
              {approvalsQuery.error && <StateText label="Failed to load approvals." tone="error" />}
              {!approvalsQuery.isLoading && !approvalsQuery.error && pendingApprovals.length === 0 && (
                <StateText label="No pending approvals." />
              )}
              {pendingApprovals.slice(0, 5).map((proposal) => (
                <div key={proposal.id} className="mb-2 rounded-md border border-border bg-background p-2">
                  <div className="text-xs font-medium text-foreground">Proposal #{proposal.id}</div>
                  <div className="text-xs text-muted-foreground">{proposal.title ?? "Untitled proposal"}</div>
                </div>
              ))}
            </Panel>
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-muted p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function MessageCard({
  role,
  title,
  body,
  meta,
}: {
  role: "operator" | "agent" | "system";
  title: string;
  body: string;
  meta: string;
}) {
  const tone =
    role === "operator"
      ? "border-primary/40 bg-primary/5"
      : role === "agent"
      ? "border-info/40 bg-info/5"
      : "border-warning/40 bg-warning/5";

  return (
    <article className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{role}</span>
      </div>
      <p className="mt-2 text-sm text-foreground">{body}</p>
      <p className="mt-2 text-xs text-muted-foreground">{meta}</p>
    </article>
  );
}

function StateText({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return <p className={`text-xs ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{label}</p>;
}

function StatusBadge({ status, prefix }: { status: string; prefix?: string }) {
  const tone =
    status === "running" || status === "healthy"
      ? "bg-success/10 text-success"
      : status === "failed" || status === "offline"
      ? "bg-destructive/10 text-destructive"
      : status === "awaiting_approval"
      ? "bg-warning/10 text-warning"
      : "bg-info/10 text-info";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium uppercase ${tone}`}>
      {prefix ? `${prefix}: ` : ""}
      {status}
    </span>
  );
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
