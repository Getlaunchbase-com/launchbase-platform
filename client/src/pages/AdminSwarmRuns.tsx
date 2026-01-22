import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/AdminLayout";
import { ModelSelector } from "@/components/ModelSelector";
import { formatFixtureLabel } from "@/lib/fixtureLabels";

function StopBadge({ value }: { value?: string | null }) {
  const v = value || "unknown";
  return <Badge variant={v === "ok" ? "default" : v === "running" ? "secondary" : "destructive"}>{v}</Badge>;
}

const ALL = "__all__";

export default function AdminSwarmRuns() {
  const [stopReason, setStopReason] = useState<string | undefined>(undefined);
  const [model, setModel] = useState("");
  const [fixtureName, setFixtureName] = useState<string | undefined>(undefined);
  
  const modelsQuery = trpc.admin.swarm.models.list.useQuery();
  const modelOptions = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);

  const query = trpc.admin.swarm.runs.list.useQuery({
    limit: 50,
    stopReason: stopReason || undefined,
    model: model || undefined,
    fixtureName: fixtureName || undefined,
  });

  const rows = query.data ?? [];

  return (
    <AdminLayout title="Swarm Console">
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Swarm Runs</h1>
          <p className="text-sm text-muted-foreground">Monitor, ingest, and drill into repair runs.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/swarm/new">
            <Button>New Run</Button>
          </Link>
          <Link href="/admin/swarm/profiles">
            <Button variant="secondary">Profiles</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Stop reason</div>
            <Select value={stopReason ?? ALL} onValueChange={(v) => setStopReason(v === ALL ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All stop reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="ok">ok</SelectItem>
                <SelectItem value="tests_failed">tests_failed</SelectItem>
                <SelectItem value="patch_invalid">patch_invalid</SelectItem>
                <SelectItem value="error">error</SelectItem>
                <SelectItem value="unknown">unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Model</div>
            {modelOptions.length > 0 ? (
              <ModelSelector
                models={[{ id: "__all__", label: "All models" }, ...modelOptions]}
                value={model || "__all__"}
                onValueChange={(v) => setModel(v === "__all__" ? "" : v)}
                placeholder="All models"
              />
            ) : (
              <Select value={model || ALL} onValueChange={(v) => setModel(v === ALL ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Loading models..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Scenario</div>
            <div className="text-xs text-gray-500 mb-1">Built-in test case to benchmark Swarm reliability</div>
            <Select value={fixtureName ?? ALL} onValueChange={(v) => setFixtureName(v === ALL ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All scenarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest (50)</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {query.error && <div className="text-sm text-red-600">{query.error.message}</div>}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Run</th>
                  <th className="py-2 pr-4">Stop</th>
                  <th className="py-2 pr-4">Applied</th>
                  <th className="py-2 pr-4">Tests</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2 pr-4">Latency</th>
                  <th className="py-2 pr-4">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.repairKey || r.repairId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/swarm/runs/${r.repairKey || r.repairId}`} className="text-blue-600 hover:underline">
                        {r.repairKey || r.repairId}
                      </Link>
                      {r.fixtureName ? <div className="text-xs text-muted-foreground">{r.fixtureName}</div> : null}
                    </td>
                    <td className="py-2 pr-4"><StopBadge value={r.stopReason} /></td>
                    <td className="py-2 pr-4">{r.applied ? "✅" : "—"}</td>
                    <td className="py-2 pr-4">{r.testsPassed ? "✅" : "—"}</td>
                    <td className="py-2 pr-4">{r.modelPrimary ?? "—"}</td>
                    <td className="py-2 pr-4">{typeof r.costUsd === "number" ? `$${r.costUsd.toFixed(4)}` : "—"}</td>
                    <td className="py-2 pr-4">{typeof r.latencyMs === "number" ? `${r.latencyMs}ms` : "—"}</td>
                    <td className="py-2 pr-4">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && !query.isLoading ? (
                  <tr><td className="py-4 text-muted-foreground" colSpan={8}>No runs yet. Create a run or ingest one.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
