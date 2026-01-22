import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ModelSelector } from "@/components/ModelSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFixtureLabel } from "@/lib/fixtureLabels";

type Thread = {
  id: string;
  title: string;
  updatedAtIso: string;
  lastMessagePreview?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAtIso: string;
  meta?: any;
};

const ALL = "__all__";

function RoleBadge({ role }: { role: string }) {
  const variant = role === "user" ? "secondary" : role === "system" ? "outline" : "default";
  return <Badge variant={variant as any}>{role}</Badge>;
}

export default function AdminSwarmChat() {
  const utils = trpc.useUtils();
  const threadsQuery = trpc.admin.opsChat.threads.list.useQuery();
  const createThread = trpc.admin.opsChat.threads.create.useMutation({
    onSuccess: async (t) => {
      await threadsQuery.refetch();
      setSelectedThreadId(t.id);
    },
  });

  const threads = (threadsQuery.data ?? []) as Thread[];
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThread = useMemo(() => threads.find((t) => t.id === selectedThreadId) ?? null, [threads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [selectedThreadId, threads]);

  const messagesQuery = trpc.admin.opsChat.messages.list.useQuery(
    { threadId: selectedThreadId ?? "" },
    { enabled: !!selectedThreadId, refetchInterval: 2000 }
  );
  const messages = (messagesQuery.data ?? []) as Message[];

  const sendMsg = trpc.admin.opsChat.messages.send.useMutation({
    onSuccess: async () => {
      await messagesQuery.refetch();
      await threadsQuery.refetch();
    },
  });

  const [draft, setDraft] = useState("");

  // Run controls
  const modelsQuery = trpc.admin.swarm.models.list.useQuery();
  const modelOptions = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);

  const [primaryModel, setPrimaryModel] = useState<string>("");
  const [fallbackModel, setFallbackModel] = useState<string>("");
  const [intention, setIntention] = useState<string>("smoke_test");
  const [fixtureName, setFixtureName] = useState<string>("f11-new-file-dep-context");
  const [timeoutSec, setTimeoutSec] = useState<number>(180);
  const [role, setRole] = useState<string>("owner");

  useEffect(() => {
    if (!primaryModel && modelOptions.length > 0) {
      // pick first alphabetically as a safe default
      setPrimaryModel(modelOptions[0].id);
    }
  }, [primaryModel, modelOptions]);

  const launchRun = trpc.admin.swarm.runs.create.useMutation({
    onSuccess: async (res) => {
      if (selectedThreadId) {
        await appendSystemMessage(selectedThreadId, `Launched run ${res.repairKey}.`, {
          repairKey: res.repairKey,
          startedAtIso: res.startedAtIso,
        });
      }
    },
  });

  const appendSystemMessage = async (threadId: string, text: string, meta?: any) => {
    // We don't have a dedicated server endpoint for system messages in MVP.
    // Use a normal send + a convention marker. The server stores user messages only.
    // So we store system events as assistant messages by writing a second user message with a prefix.
    // (Kept simple; can be upgraded later.)
    await sendMsg.mutateAsync({ threadId, text: `[system] ${text}${meta ? `\n\n${JSON.stringify(meta, null, 2)}` : ""}` });
    await utils.admin.opsChat.messages.list.invalidate({ threadId });
    await utils.admin.opsChat.threads.list.invalidate();
  };

  const isRunning = launchRun.isPending;

  return (
    <AdminLayout title="Swarm Ops Chat">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Threads */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Threads</CardTitle>
            <Button
              size="sm"
              onClick={() => createThread.mutate({ title: `Ops Chat ${new Date().toLocaleString()}` })}
            >
              New
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {threadsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                  t.id === selectedThreadId ? "border-orange-500 bg-orange-500/10" : "border-gray-800 hover:bg-gray-900"
                }`}
                onClick={() => setSelectedThreadId(t.id)}
              >
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground truncate">{t.lastMessagePreview || "—"}</div>
              </button>
            ))}
            {threads.length === 0 && !threadsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">No threads yet. Create one.</div>
            ) : null}
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="text-base">{selectedThread?.title ?? "Chat"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-[420px] overflow-auto rounded-md border border-gray-800 p-3 space-y-3 bg-black/20">
              {!selectedThreadId ? (
                <div className="text-sm text-muted-foreground">Select or create a thread.</div>
              ) : null}
              {messages.map((m) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RoleBadge role={m.text.startsWith("[system]") ? "system" : m.role} />
                    <div className="text-xs text-muted-foreground">{new Date(m.createdAtIso).toLocaleString()}</div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">{m.text.replace(/^\[system\]\s*/, "")}</pre>
                </div>
              ))}
              {messages.length === 0 && selectedThreadId ? (
                <div className="text-sm text-muted-foreground">Say hi. This is your private ops console.</div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Describe what you want Swarm to do…"
                className="min-h-[90px]"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Tip: use the Run panel to launch fixtures or manual runs.
                </div>
                <Button
                  disabled={!selectedThreadId || sendMsg.isPending || draft.trim().length === 0}
                  onClick={() => {
                    if (!selectedThreadId) return;
                    const text = draft.trim();
                    setDraft("");
                    sendMsg.mutate({ threadId: selectedThreadId, text });
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Run controls */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Run Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-gray-800 p-3 space-y-2">
              <div className="text-xs text-muted-foreground">Selected bots</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Field General: {primaryModel || "—"}</Badge>
                <Badge variant="secondary">Coder: {primaryModel || "—"}</Badge>
                <Badge variant="secondary">Critic: {fallbackModel || primaryModel || "—"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm">
                {isRunning ? <span className="text-orange-400">Running…</span> : <span className="text-green-400">Idle</span>}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Primary model</div>
              {modelOptions.length > 0 ? (
                <ModelSelector
                  models={modelOptions}
                  value={primaryModel || (modelOptions[0]?.id ?? "")}
                  onValueChange={setPrimaryModel}
                  placeholder="Pick a model"
                />
              ) : (
                <Input placeholder="Loading models…" disabled />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Fallback model (optional)</div>
              {modelOptions.length > 0 ? (
                <ModelSelector
                  models={[{ id: ALL, label: "None" }, ...modelOptions]}
                  value={fallbackModel || ALL}
                  onValueChange={(v) => setFallbackModel(v === ALL ? "" : v)}
                  placeholder="None"
                />
              ) : (
                <Input placeholder="Loading…" disabled />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Intention</div>
                <Select value={intention} onValueChange={setIntention}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smoke_test">Smoke</SelectItem>
                    <SelectItem value="pressure_test">Pressure</SelectItem>
                    <SelectItem value="improve">Improve</SelectItem>
                    <SelectItem value="critic">Critic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Role</div>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="it">IT</SelectItem>
                    <SelectItem value="dev">Dev</SelectItem>
                    <SelectItem value="readonly">Read-only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Scenario</div>
              <Select value={fixtureName} onValueChange={setFixtureName}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="f1-missing-import">{formatFixtureLabel("f1-missing-import")}</SelectItem>
                  <SelectItem value="f2-wrong-path">{formatFixtureLabel("f2-wrong-path")}</SelectItem>
                  <SelectItem value="f3-type-mismatch">{formatFixtureLabel("f3-type-mismatch")}</SelectItem>
                  <SelectItem value="f4-unused-import">{formatFixtureLabel("f4-unused-import")}</SelectItem>
                  <SelectItem value="f5-type-export">{formatFixtureLabel("f5-type-export")}</SelectItem>
                  <SelectItem value="f6-json-import">{formatFixtureLabel("f6-json-import")}</SelectItem>
                  <SelectItem value="f7-esm-interop">{formatFixtureLabel("f7-esm-interop")}</SelectItem>
                  <SelectItem value="f8-zod-mismatch">{formatFixtureLabel("f8-zod-mismatch")}</SelectItem>
                  <SelectItem value="f9-drizzle-mismatch">{formatFixtureLabel("f9-drizzle-mismatch")}</SelectItem>
                  <SelectItem value="f10-patch-corrupt">{formatFixtureLabel("f10-patch-corrupt")}</SelectItem>
                  <SelectItem value="f11-new-file-dep-context">{formatFixtureLabel("f11-new-file-dep-context")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">Fixtures are built-in scenarios to benchmark Swarm reliability.</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Timeout (seconds)</div>
              <Input
                type="number"
                value={timeoutSec}
                onChange={(e) => setTimeoutSec(Number(e.target.value || 180))}
                min={30}
                step={10}
              />
            </div>

            <Button
              className="w-full"
              disabled={!selectedThreadId || !primaryModel || launchRun.isPending}
              onClick={() => {
                if (!selectedThreadId) return;
                launchRun.mutate({
                  featurePack: {
                    name: "Ops Chat Run",
                    intention: intention as any,
                    sourceType: "fixture",
                    fixtureName,
                    primaryModel,
                    fallbackModel: fallbackModel || undefined,
                    role: role as any,
                    timeoutSec,
                    runBudgetSec: Math.max(timeoutSec, 600),
                    toggles: {
                      escalationRetryEnabled: true,
                      hunkRepairEnabled: true,
                      emptyPatchRetryEnabled: true,
                      reviewerEnabled: true,
                      arbiterEnabled: true,
                    },
                    scopePreset: "standard",
                    maxFiles: 20,
                    maxBytes: 200000,
                    selectedFiles: [],
                    logs: [],
                    testCommands: [],
                  },
                });
              }}
            >
              Launch Swarm
            </Button>

            {launchRun.data?.repairKey ? (
              <div className="text-sm">
                Run: <Link href={`/admin/swarm/runs/${launchRun.data.repairKey}`} className="text-blue-500 hover:underline">{launchRun.data.repairKey}</Link>
              </div>
            ) : null}

            {launchRun.error ? (
              <div className="text-sm text-red-600">{launchRun.error.message}</div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
