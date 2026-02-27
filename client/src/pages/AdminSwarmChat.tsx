import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminLayout } from "../components/AdminLayout";
import { AlertCircle, Play, Search, Send, Square } from "../components/Icons";
import { trpc } from "../lib/trpc";

export default function AdminSwarmChat() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState(1);
  const [agentInstanceId, setAgentInstanceId] = useState(1);
  const [info, setInfo] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const runsQuery = trpc.admin.agentRuns.list.useQuery({ limit: 100, offset: 0 });
  const runtimeQuery = trpc.admin.operatorOS.getRuntimeStatus.useQuery();

  const allRuns = runsQuery.data?.runs ?? [];
  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRuns;
    return allRuns.filter((r) => `${r.id} ${r.goal ?? ""} ${r.model ?? ""}`.toLowerCase().includes(q));
  }, [allRuns, search]);

  const selectedRun = useMemo(() => {
    if (selectedRunId != null) {
      return filteredRuns.find((r) => r.id === selectedRunId) ?? null;
    }
    return filteredRuns.find((r) => r.status === "running") ?? filteredRuns[0] ?? null;
  }, [filteredRuns, selectedRunId]);

  const messagesQuery = trpc.admin.opsChat.listMessages.useQuery(
    { runId: selectedRun?.id, limit: 80, offset: 0 },
    { enabled: !!selectedRun?.id }
  );

  const sendMut = trpc.admin.opsChat.sendMessage.useMutation({
    onSuccess: async (res) => {
      setInfo(`Message queued on run #${res.runId}.`);
      setMessage("");
      setSelectedRunId(res.runId);
      await Promise.all([
        utils.admin.agentRuns.list.invalidate(),
        utils.admin.opsChat.listMessages.invalidate(),
      ]);
    },
    onError: (err) => setInfo(err.message || "Failed to send message."),
  });

  async function onSend() {
    const text = message.trim();
    if (!text || sendMut.isPending) return;

    if (selectedRun?.id) {
      await sendMut.mutateAsync({ message: text, runId: selectedRun.id });
      return;
    }

    await sendMut.mutateAsync({
      message: text,
      projectId,
      agentInstanceId,
    });
  }

  const timeline = [...(messagesQuery.data?.messages ?? [])].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );

  return (
    <AdminLayout>
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <aside className="rounded-lg border border-border bg-secondary p-4">
          <h1 className="text-lg font-semibold text-foreground">Swarm Sessions</h1>
          <div className="relative mt-3">
            <Search size={14} style={{ position: "absolute", left: "10px", top: "11px" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search runs"
              className="h-10 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground"
            />
          </div>

          <div className="mt-3 max-h-[60vh] space-y-2 overflow-auto lg:max-h-[calc(100vh-18rem)]">
            {runsQuery.isLoading && <Meta text="Loading runs..." />}
            {runsQuery.error && <Meta text="Failed to load runs." tone="error" />}
            {!runsQuery.isLoading && !runsQuery.error && filteredRuns.length === 0 && <Meta text="No runs found." />}
            {filteredRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full rounded-lg border p-3 text-left ${
                  selectedRun?.id === run.id ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Run #{run.id}</span>
                  <Badge status={run.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.goal ?? "No goal"}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[32rem] flex-col rounded-lg border border-border bg-background">
          <header className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Agent Chat</h2>
                <p className="text-sm text-muted-foreground">Chat to run event to agent tools</p>
              </div>
              <Badge status={runtimeQuery.data?.status ?? "offline"} prefix="Runtime" />
            </div>
          </header>

          <div className="flex-1 space-y-2 overflow-auto p-4">
            {!selectedRun && <Meta text="No active run selected. Set Project + Instance below and send message to start." />}
            {selectedRun && messagesQuery.isLoading && <Meta text="Loading messages..." />}
            {selectedRun && messagesQuery.error && <Meta text="Failed to load messages." tone="error" />}
            {selectedRun && !messagesQuery.isLoading && timeline.length === 0 && <Meta text="No messages yet for this run." />}
            {timeline.map((evt) => {
              const role = String((evt.payload as Record<string, unknown>)?.role ?? "system");
              const content = String((evt.payload as Record<string, unknown>)?.content ?? "");
              return (
                <article key={evt.id} className="rounded-lg border border-border bg-secondary p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">{role}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(evt.ts)}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{content || "(empty)"}</p>
                </article>
              );
            })}
          </div>

          <div className="border-t border-border p-4">
            {!selectedRun && (
              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  min={1}
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value || 1))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  placeholder="Project ID"
                />
                <input
                  type="number"
                  min={1}
                  value={agentInstanceId}
                  onChange={(e) => setAgentInstanceId(Number(e.target.value || 1))}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  placeholder="Agent Instance ID"
                />
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Send instruction to agent run"
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            {info && <p className="mt-2 text-sm text-info">{info}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onSend}
                disabled={!message.trim() || sendMut.isPending}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Send size={14} />
                {sendMut.isPending ? "Sending..." : selectedRun ? "Send to Run" : "Start + Send"}
              </button>

              <button
                onClick={() => setLocation("/admin/console/runs")}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-secondary px-6 text-sm font-medium text-foreground"
              >
                <Square size={14} />
                Open Runs
              </button>

              <button
                onClick={() => setLocation("/admin/console/files")}
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-secondary px-6 text-sm font-medium text-foreground"
              >
                <Play size={14} />
                Open Artifacts
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-secondary p-4">
          <h3 className="text-sm font-semibold text-foreground">Run Context</h3>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Run: {selectedRun?.id ?? "none"}</div>
            <div>Status: {selectedRun?.status ?? "n/a"}</div>
            <div>Project: {selectedRun?.projectId ?? projectId}</div>
            <div>Instance: {selectedRun?.agentInstanceId ?? agentInstanceId}</div>
            <div>Messages: {timeline.length}</div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layering</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>1. UI chat sends intent</li>
              <li>2. opsChat creates/continues run</li>
              <li>3. Event appended to timeline</li>
              <li>4. Agent runtime executes tools</li>
            </ul>
          </div>

          <button
            onClick={() => setLocation("/admin/agent/chat")}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground"
          >
            <AlertCircle size={14} />
            Open Operator Chat
          </button>
        </aside>
      </div>
    </AdminLayout>
  );
}

function Meta({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return <p className={`text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{text}</p>;
}

function Badge({ status, prefix }: { status: string; prefix?: string }) {
  const tone =
    status === "running" || status === "healthy"
      ? "bg-success/10 text-success"
      : status === "failed" || status === "offline"
      ? "bg-destructive/10 text-destructive"
      : status === "awaiting_approval"
      ? "bg-warning/10 text-warning"
      : "bg-info/10 text-info";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${tone}`}>{prefix ? `${prefix}: ` : ""}{status}</span>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "n/a";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
