import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function pct(v: number) {
  const p = Math.round(v * 1000) / 10;
  return `${p}%`;
}

export default function AdminSwarmProfileDetail() {
  const [match, params] = useRoute<{ id: string }>("/admin/swarm/profiles/:id");
  const id = Number(params?.id || "0");
  const profileQuery = trpc.admin.swarm.profiles.get.useQuery({ id }, { enabled: !!id });
  const stats30 = trpc.admin.swarm.profiles.stats.useQuery({ id, window: "30d" }, { enabled: !!id });

  const runMutation = trpc.admin.swarm.runs.create.useMutation({
    onSuccess: () => {},
  });

  const p: any = profileQuery.data;

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-1">
        <Link href="/admin/swarm/profiles" className="text-sm text-blue-600 hover:underline">← Back to profiles</Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{p?.name ?? "Profile"}</h1>
            <div className="text-sm text-muted-foreground">Reusable swarm configuration + stats.</div>
          </div>
          <div className="flex items-center gap-2">
            {p?.isPromoted ? <Badge>Promoted</Badge> : null}
            <Button
              disabled={!p?.configJson || runMutation.isPending}
              onClick={() => runMutation.mutate({ featurePack: p.configJson, profileId: p.id })}
            >
              {runMutation.isPending ? "Starting…" : "Run now"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stats (7d)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Runs</div>
            <div className="text-lg font-semibold">{p?.stats7d?.runs ?? "—"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Pass rate</div>
            <div className="text-lg font-semibold">{p?.stats7d ? pct(p.stats7d.passRate) : "—"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Avg cost</div>
            <div className="text-lg font-semibold">{typeof p?.stats7d?.avgCostUsd === "number" ? `$${p.stats7d.avgCostUsd.toFixed(3)}` : "—"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">p95 latency</div>
            <div className="text-lg font-semibold">{typeof p?.stats7d?.p95LatencyMs === "number" ? `${p.stats7d.p95LatencyMs}ms` : "—"}</div>
          </div>
          <div className="border rounded-md p-3">
            <div className="text-xs text-muted-foreground">Stop reasons</div>
            <div className="text-xs">
              ok {p?.stats7d?.ok ?? 0} · tests {p?.stats7d?.tests_failed ?? 0} · invalid {p?.stats7d?.patch_invalid ?? 0} · other {p?.stats7d?.other ?? 0}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stats (30d)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {stats30.isLoading ? <div className="text-muted-foreground">Loading…</div> : null}
          {stats30.data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-md p-3"><div className="text-xs text-muted-foreground">Runs</div><div className="text-lg font-semibold">{stats30.data.runs}</div></div>
              <div className="border rounded-md p-3"><div className="text-xs text-muted-foreground">Pass rate</div><div className="text-lg font-semibold">{pct(stats30.data.passRate)}</div></div>
              <div className="border rounded-md p-3"><div className="text-xs text-muted-foreground">Avg cost</div><div className="text-lg font-semibold">{stats30.data.avgCostUsd === null ? "—" : `$${stats30.data.avgCostUsd.toFixed(3)}`}</div></div>
              <div className="border rounded-md p-3"><div className="text-xs text-muted-foreground">p95 latency</div><div className="text-lg font-semibold">{stats30.data.p95LatencyMs === null ? "—" : `${stats30.data.p95LatencyMs}ms`}</div></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent runs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(p?.recentRuns ?? []).map((r: any) => (
            <div key={r.repairId} className="flex items-center justify-between border rounded-md p-3">
              <div className="space-y-1">
                <div className="font-medium">
                  <Link href={`/admin/swarm/runs/${r.repairId}`} className="hover:underline">{r.repairId}</Link>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.stopReason} · applied={String(r.applied)} · testsPassed={String(r.testsPassed)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</div>
            </div>
          ))}
          {(p?.recentRuns ?? []).length === 0 ? <div className="text-muted-foreground">No runs for this profile yet.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Config</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-[500px]">{JSON.stringify(p?.configJson ?? {}, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
