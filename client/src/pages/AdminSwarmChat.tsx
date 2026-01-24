import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type AgentRun = {
  id: number;
  createdAt: Date;
  status: "running" | "success" | "failed" | "awaiting_approval";
  goal: string;
  errorMessage: string | null;
  finishedAt: Date | null;
  createdBy: number;
  model: string | null;
  routerUrl: string | null;
  workspaceName: string | null;
};

type AgentEvent = {
  id: number;
  runId: number;
  ts: string;
  type: string;
  payload: any;
};

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    awaiting_approval: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <Badge className={variants[status] || ""}>{status.replace("_", " ")}</Badge>
  );
}

function ApprovalCard({ event }: { event: AgentEvent }) {
  const utils = trpc.useUtils();
  const { payload, ts } = event;
  const runId = event.runId;
  const time = new Date(ts).toLocaleTimeString();

  const approveMutation = trpc.admin.agentRuns.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.agentRuns.get.invalidate({ runId }),
        utils.admin.agentEvents.list.invalidate({ runId }),
        utils.admin.agentArtifacts.list.invalidate({ runId }),
      ]);
    },
  });

  const onApprove = () => {
    approveMutation.mutate({
      runId,
      approved: true,
    });
  };

  const onDeny = () => {
    approveMutation.mutate({
      runId,
      approved: false,
    });
  };

  return (
    <div className="border-l-2 border-orange-500 pl-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <Badge className="bg-orange-500/10 text-orange-400">approval required</Badge>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <div className="text-sm mb-2">
        <span className="font-mono text-orange-400">{payload.name || payload.tool}</span> needs approval
      </div>
      {payload.reason && (
        <div className="text-xs text-muted-foreground mb-2">{payload.reason}</div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={approveMutation.isPending}
          onClick={onApprove}
        >
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={approveMutation.isPending}
          onClick={onDeny}
        >
          {approveMutation.isPending ? "Denying..." : "Deny"}
        </Button>
      </div>
      {approveMutation.isError && (
        <div className="text-red-500 text-sm mt-2">
          {approveMutation.error.message}
        </div>
      )}
      {approveMutation.isSuccess && (
        <div className="text-green-400 text-sm mt-2">
          {payload.approved ? "✅ Approved" : "⛔ Denied"}
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event }: { event: AgentEvent }) {
  const { type, payload, ts } = event;

  // Format timestamp
  const time = new Date(ts).toLocaleTimeString();

  // Render based on event type
  if (type === "message") {
    return (
      <div className="border-l-2 border-gray-700 pl-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={payload.role === "user" ? "secondary" : "default"}>
            {payload.role}
          </Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="text-sm whitespace-pre-wrap">{payload.content || "—"}</div>
      </div>
    );
  }

  if (type === "tool_call") {
    return (
      <div className="border-l-2 border-blue-500 pl-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-blue-500/10 text-blue-400">tool call</Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="text-sm font-mono">
          <span className="text-blue-400">{payload.name}</span>
          <span className="text-muted-foreground">(</span>
          <details className="inline">
            <summary className="cursor-pointer text-xs text-muted-foreground">args</summary>
            <pre className="text-xs mt-1 p-2 bg-black/20 rounded">
              {JSON.stringify(payload.arguments, null, 2)}
            </pre>
          </details>
          <span className="text-muted-foreground">)</span>
        </div>
      </div>
    );
  }

  if (type === "tool_result") {
    const isSuccess = payload.success;
    return (
      <div className={`border-l-2 ${isSuccess ? "border-green-500" : "border-red-500"} pl-3 py-2`}>
        <div className="flex items-center gap-2 mb-1">
          <Badge className={isSuccess ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}>
            {isSuccess ? "success" : "error"}
          </Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">result</summary>
          <pre className="text-xs mt-1 p-2 bg-black/20 rounded overflow-auto max-h-40">
            {JSON.stringify(payload.result || payload.error, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  if (type === "approval_request") {
    return (
      <ApprovalCard event={event} />
    );
  }

  if (type === "error") {
    return (
      <div className="border-l-2 border-red-500 pl-3 py-2 bg-red-500/5">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-red-500/10 text-red-400">error</Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <pre className="text-sm text-red-400 whitespace-pre-wrap">
          {payload.error || JSON.stringify(payload)}
        </pre>
      </div>
    );
  }

  if (type === "artifact") {
    return (
      <div className="border-l-2 border-purple-500 pl-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge className="bg-purple-500/10 text-purple-400">artifact</Badge>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="text-sm">
          {payload.type || "file"}: <span className="font-mono">{payload.name || payload.path}</span>
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="border-l-2 border-gray-700 pl-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline">{type}</Badge>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>
      <pre className="text-xs text-muted-foreground">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

export default function AdminSwarmChat() {
  const utils = trpc.useUtils();

  // Agent runs list
  const runsQuery = trpc.admin.agentRuns.list.useQuery({ limit: 20 });
  const runs = (runsQuery.data ?? []) as AgentRun[];

  // Selected run
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  // Auto-select first run
  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [selectedRunId, runs]);

  // Timeline events
  const eventsQuery = trpc.admin.agentEvents.list.useQuery(
    { runId: selectedRunId ?? 0 },
    { enabled: !!selectedRunId, refetchInterval: 2000 }
  );
  const events = (eventsQuery.data ?? []) as AgentEvent[];

  // Artifacts (filtered events)
  const artifactsQuery = trpc.admin.agentArtifacts.list.useQuery(
    { runId: selectedRunId ?? 0 },
    { enabled: !!selectedRunId }
  );
  const artifacts = (artifactsQuery.data ?? []) as AgentEvent[];

  // Create new run
  const createRun = trpc.admin.agentRuns.create.useMutation({
    onSuccess: async (res) => {
      await runsQuery.refetch();
      setSelectedRunId(res.runId);
    },
  });

  const [goalDraft, setGoalDraft] = useState("");

  return (
    <AdminLayout title="Agent Execution Console">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Column 1: Chat / Runs List */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Agent Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* New Run Form */}
            <div className="space-y-2 pb-3 border-b border-gray-800">
              <Textarea
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder="What should the agent do?"
                className="min-h-[80px]"
              />
              <Button
                className="w-full"
                disabled={createRun.isPending || goalDraft.trim().length === 0}
                onClick={() => {
                  const goal = goalDraft.trim();
                  setGoalDraft("");
                  createRun.mutate({ goal });
                }}
              >
                {createRun.isPending ? "Starting..." : "Start New Run"}
              </Button>
            </div>

            {/* Runs List */}
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {runsQuery.isLoading && (
                  <div className="text-sm text-muted-foreground">Loading runs...</div>
                )}
                {runs.map((run) => (
                  <button
                    key={run.id}
                    className={`w-full text-left rounded-md border p-3 transition-colors ${
                      run.id === selectedRunId
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-gray-800 hover:bg-gray-900"
                    }`}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">
                        Run #{run.id}
                      </span>
                      <StatusBadge status={run.status} />
                    </div>
                    <div className="text-sm font-medium truncate">{run.goal}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(run.createdAt).toLocaleString()}
                    </div>
                  </button>
                ))}
                {runs.length === 0 && !runsQuery.isLoading && (
                  <div className="text-sm text-muted-foreground">
                    No runs yet. Start one above.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 2: Timeline */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedRun ? `Timeline: ${selectedRun.goal.slice(0, 40)}...` : "Timeline"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {!selectedRunId ? (
                <div className="text-sm text-muted-foreground">
                  Select a run to see timeline
                </div>
              ) : eventsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events yet</div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <TimelineEvent key={event.id} event={event} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Column 3: Artifacts */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              {!selectedRunId ? (
                <div className="text-sm text-muted-foreground">
                  Select a run to see artifacts
                </div>
              ) : artifactsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : artifacts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No artifacts yet</div>
              ) : (
                <div className="space-y-2">
                  {artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="rounded-md border border-gray-800 p-2 hover:bg-gray-900 transition-colors"
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(artifact.ts).toLocaleTimeString()}
                      </div>
                      <div className="text-sm font-mono truncate">
                        {artifact.payload.name || artifact.payload.path || artifact.type}
                      </div>
                      {artifact.payload.url && (
                        <a
                          href={artifact.payload.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
