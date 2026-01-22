import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function StopBadge({ value }: { value?: string | null }) {
  const v = value || "unknown";
  return <Badge variant={v === "ok" ? "default" : v === "running" ? "secondary" : "destructive"}>{v}</Badge>;
}

export default function AdminSwarmRuns() {
  const [stopReason, setStopReason] = useState("");
  const [model, setModel] = useState("");
  const [fixtureName, setFixtureName] = useState("");

  const query = trpc.admin.swarm.runs.list.useQuery({
    limit: 50,
    stopReason: stopReason || undefined,
    model: model || undefined,
    fixtureName: fixtureName || undefined,
  });

  const rows = query.data ?? [];

  return (
    <div className="p-6 space-y-4">
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
            <Input value={stopReason} onChange={(e) => setStopReason(e.target.value)} placeholder="ok / tests_failed / patch_invalid" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Model contains</div>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="openai/gpt-5-2" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Fixture</div>
            <Input value={fixtureName} onChange={(e) => setFixtureName(e.target.value)} placeholder="f11-new-file-dep-context" />
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
                  <tr key={r.repairId} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/swarm/runs/${r.repairId}`} className="text-blue-600 hover:underline">
                        {r.repairId}
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
  );
}
