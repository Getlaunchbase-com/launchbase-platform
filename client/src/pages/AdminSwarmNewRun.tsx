import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ModelSelector } from "@/components/ModelSelector";
import { formatFixtureLabel } from "@/lib/fixtureLabels";

const FIXTURES = [
  "f1-missing-import",
  "f2-wrong-path",
  "f3-type-mismatch",
  "f4-unused-import",
  "f5-type-export",
  "f6-json-import",
  "f7-esm-interop",
  "f8-zod-mismatch",
  "f9-drizzle-mismatch",
  "f10-patch-corrupt",
  "f11-new-file-dep-context",
] as const;

type Intention = "smoke_test" | "pressure_test" | "improve" | "critic";
type Role = "owner" | "it" | "dev" | "readonly";
type SourceType = "fixture" | "manual";
type ScopePreset = "auto" | "minimal" | "standard" | "deep";

export default function AdminSwarmNewRun() {
  const [, setLocation] = useLocation();

  const modelsQuery = trpc.admin.swarm.models.list.useQuery();
  const repoSourcesQuery = trpc.admin.swarm.repoSources.list.useQuery();

  const [name, setName] = useState("Owner run");
  const [intention, setIntention] = useState<Intention>("smoke_test");
  const [role, setRole] = useState<Role>("owner");
  const [timeoutSec, setTimeoutSec] = useState(180);
  const [runBudgetSec, setRunBudgetSec] = useState(600);

  const [primaryModel, setPrimaryModel] = useState("openai/gpt-5-2");
  const [fallbackModel, setFallbackModel] = useState("openai/gpt-4o");

  const [sourceType, setSourceType] = useState<SourceType>("fixture");
  const [fixtureName, setFixtureName] = useState<(typeof FIXTURES)[number]>("f11-new-file-dep-context");
  const [failurePacketJson, setFailurePacketJson] = useState("{\n  \"version\": \"v1\"\n}\n");

  // Repo / scope controls
  const [repoSourceId, setRepoSourceId] = useState<number | null>(null);
  const [scopePreset, setScopePreset] = useState<ScopePreset>("standard");
  const [maxFiles, setMaxFiles] = useState(20);
  const [maxBytes, setMaxBytes] = useState(200000);
  const [fileQuery, setFileQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Toggles
  const [escalationRetryEnabled, setEscalationRetryEnabled] = useState(true);
  const [hunkRepairEnabled, setHunkRepairEnabled] = useState(true);
  const [emptyPatchRetryEnabled, setEmptyPatchRetryEnabled] = useState(true);
  const [reviewerEnabled, setReviewerEnabled] = useState(true);
  const [arbiterEnabled, setArbiterEnabled] = useState(true);

  // Debounce file search input
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(fileQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [fileQuery]);

  const fileSearch = trpc.admin.swarm.repoSources.fileSearch.useQuery(
    {
      repoSourceId: repoSourceId ?? 0,
      query: debouncedQuery,
      limit: 50,
    },
    {
      enabled: !!repoSourceId && debouncedQuery.length > 0,
    }
  );

  const createRun = trpc.admin.swarm.runs.create.useMutation({
    onSuccess: (data) => setLocation(`/admin/swarm/runs/${data.repairKey}`),
  });

  const modelOptions = useMemo(() => {
    const fallback = [
      { id: "openai/gpt-5-2", label: "GPT-5.2" },
      { id: "openai/gpt-4o", label: "GPT-4o" },
    ];
    return modelsQuery.data?.length ? modelsQuery.data : fallback;
  }, [modelsQuery.data]);

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <Link href="/admin/swarm" className="text-sm text-blue-600 hover:underline">
          ← Back to runs
        </Link>
        <h1 className="text-2xl font-semibold">New Swarm Run</h1>
        <p className="text-sm text-muted-foreground">
          Choose intention, model, role, duration, and source.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Intention</div>
            <select
              className="w-full border rounded-md h-10 px-3"
              value={intention}
              onChange={(e) => setIntention(e.target.value as Intention)}
            >
              <option value="smoke_test">Smoke Test</option>
              <option value="pressure_test">Pressure Test</option>
              <option value="improve">Improve</option>
              <option value="critic">Critic</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Role</div>
            <select
              className="w-full border rounded-md h-10 px-3"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="owner">Owner</option>
              <option value="it">IT</option>
              <option value="dev">Dev</option>
              <option value="readonly">Read-only</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Primary model (AIMLAPI bot)</div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrimaryModel("openai/gpt-4o-mini")}
                className="text-xs"
              >
                ⚡ Fast/Cheap
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrimaryModel("openai/gpt-5-2")}
                className="text-xs"
              >
                🎯 Best Repair
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrimaryModel("anthropic/claude-3.5-sonnet")}
                className="text-xs"
              >
                🔍 Critic/Deep
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrimaryModel("openai/gpt-4o")}
                className="text-xs"
              >
                🔄 Fallback
              </Button>
            </div>
            <ModelSelector
              models={modelOptions}
              value={primaryModel}
              onValueChange={setPrimaryModel}
              placeholder="Select primary model..."
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Fallback model</div>
            <ModelSelector
              models={modelOptions}
              value={fallbackModel}
              onValueChange={setFallbackModel}
              placeholder="(none)"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Timeout (sec)</div>
            <Input
              type="number"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Number(e.target.value || 0))}
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Run budget (sec)</div>
            <Input
              type="number"
              value={runBudgetSec}
              onChange={(e) => setRunBudgetSec(Number(e.target.value || 0))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repo / Scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Repo source</div>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={repoSourceId ?? ""}
                onChange={(e) => setRepoSourceId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">(select)</option>
                {(repoSourcesQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type})
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground">
                Manage sources in{" "}
                <Link href="/admin/swarm/repo" className="text-blue-600 hover:underline">
                  Repo Sources
                </Link>
                .
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Scope preset</div>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={scopePreset}
                onChange={(e) => setScopePreset(e.target.value as ScopePreset)}
              >
                <option value="auto">Auto</option>
                <option value="minimal">Minimal</option>
                <option value="standard">Standard</option>
                <option value="deep">Deep</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Limits</div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={maxFiles}
                  onChange={(e) => setMaxFiles(Number(e.target.value || 0))}
                  placeholder="max files"
                />
                <Input
                  type="number"
                  value={maxBytes}
                  onChange={(e) => setMaxBytes(Number(e.target.value || 0))}
                  placeholder="max bytes"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Add files (search)</div>
              <Input
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder="type to search paths…"
                disabled={!repoSourceId}
              />
              {fileSearch.isFetching ? (
                <div className="text-xs text-muted-foreground">Searching…</div>
              ) : null}
              {fileSearch.data?.length ? (
                <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                  {fileSearch.data.map((f) => (
                    <button
                      key={f.path}
                      className="w-full text-left text-sm hover:bg-muted px-2 py-1 rounded"
                      onClick={() =>
                        setSelectedFiles((prev) => (prev.includes(f.path) ? prev : [...prev, f.path]))
                      }
                      type="button"
                    >
                      {f.path}{" "}
                      <span className="text-xs text-muted-foreground">({f.size}b)</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Selected files</div>
              <div className="border rounded p-2 min-h-[120px] space-y-1">
                {selectedFiles.length === 0 ? (
                  <div className="text-xs text-muted-foreground">None selected.</div>
                ) : (
                  selectedFiles.map((p) => (
                    <div key={p} className="flex items-center justify-between text-sm">
                      <span className="truncate">{p}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFiles((prev) => prev.filter((x) => x !== p))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceType === "fixture" ? "default" : "secondary"}
              onClick={() => setSourceType("fixture")}
            >
              Scenario Test
            </Button>
            <Button
              type="button"
              variant={sourceType === "manual" ? "default" : "secondary"}
              onClick={() => setSourceType("manual")}
            >
              Manual packet
            </Button>
          </div>

          {sourceType === "fixture" ? (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Scenario</div>
              <div className="text-xs text-gray-500 mb-1">Built-in test case to benchmark Swarm reliability</div>
              <select
                className="w-full border rounded-md h-10 px-3"
                value={fixtureName}
                onChange={(e) => setFixtureName(e.target.value as (typeof FIXTURES)[number])}
              >
                {FIXTURES.map((f) => (
                  <option key={f} value={f}>
                    {formatFixtureLabel(f)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">FailurePacket JSON</div>
              <Textarea value={failurePacketJson} onChange={(e) => setFailurePacketJson(e.target.value)} rows={10} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toggles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between border rounded-md p-3">
            <Label>Escalation retry</Label>
            <Switch checked={escalationRetryEnabled} onCheckedChange={setEscalationRetryEnabled} />
          </div>
          <div className="flex items-center justify-between border rounded-md p-3">
            <Label>Hunk repair</Label>
            <Switch checked={hunkRepairEnabled} onCheckedChange={setHunkRepairEnabled} />
          </div>
          <div className="flex items-center justify-between border rounded-md p-3">
            <Label>Empty patch retry</Label>
            <Switch checked={emptyPatchRetryEnabled} onCheckedChange={setEmptyPatchRetryEnabled} />
          </div>
          <div className="flex items-center justify-between border rounded-md p-3">
            <Label>Reviewer enabled</Label>
            <Switch checked={reviewerEnabled} onCheckedChange={setReviewerEnabled} />
          </div>
          <div className="flex items-center justify-between border rounded-md p-3">
            <Label>Arbiter enabled</Label>
            <Switch checked={arbiterEnabled} onCheckedChange={setArbiterEnabled} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 items-center">
        <Button
          onClick={() =>
            createRun.mutate({
              featurePack: {
                name,
                intention,
                sourceType,
                fixtureName: sourceType === "fixture" ? fixtureName : undefined,
                failurePacketJson: sourceType === "manual" ? failurePacketJson : undefined,
                primaryModel,
                fallbackModel: fallbackModel || undefined,
                role,
                timeoutSec,
                runBudgetSec,
                toggles: {
                  escalationRetryEnabled,
                  hunkRepairEnabled,
                  emptyPatchRetryEnabled,
                  reviewerEnabled,
                  arbiterEnabled,
                },
                repoSourceId: repoSourceId ?? undefined,
                scopePreset,
                maxFiles,
                maxBytes,
                selectedFiles,
                testCommands: [],
              },
            })
          }
          disabled={createRun.isPending}
        >
          {createRun.isPending ? "Starting…" : "Run Swarm"}
        </Button>
        <Link href="/admin/swarm">
          <Button variant="secondary">Cancel</Button>
        </Link>
        {createRun.error ? <div className="text-sm text-red-600">{createRun.error.message}</div> : null}
      </div>
    </div>
  );
}
