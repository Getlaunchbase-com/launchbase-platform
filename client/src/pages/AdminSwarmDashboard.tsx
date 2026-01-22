import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminSwarmDashboard() {
  const runsQuery = trpc.admin.swarm.runs.list.useQuery({ limit: 200 });

  const runs = runsQuery.data ?? [];
  const total = runs.length;
  const ok = runs.filter((r: any) => r.stopReason === "ok").length;
  const testsFailed = runs.filter((r: any) => r.stopReason === "tests_failed").length;
  const patchInvalid = runs.filter((r: any) => r.stopReason === "patch_invalid").length;
  const passRate = total ? Math.round((ok / total) * 100) : 0;

  const costs = runs.map((r: any) => r.costUsd).filter((x: any) => typeof x === "number") as number[];
  const avgCost = costs.length ? costs.reduce((a,b)=>a+b,0)/costs.length : null;

  const lat = runs.map((r: any) => r.latencyMs).filter((x: any) => typeof x === "number") as number[];
  const p95 = lat.length ? (() => {
    const s=[...lat].sort((a,b)=>a-b);
    return s[Math.floor(0.95*(s.length-1))];
  })() : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/swarm" className="text-sm text-blue-600 hover:underline">← Back to runs</Link>
          <h1 className="text-2xl font-semibold">Swarm Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quick health snapshot over recent runs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Pass rate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{passRate}%</div>
            <div className="text-sm text-muted-foreground">{ok} / {total} ok</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Stop reasons</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>ok: {ok}</Badge>
            <Badge variant="destructive">tests_failed: {testsFailed}</Badge>
            <Badge variant="secondary">patch_invalid: {patchInvalid}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cost & latency</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Avg cost: {avgCost === null ? "—" : `$${avgCost.toFixed(4)}`}</div>
            <div>P95 latency: {p95 === null ? "—" : `${p95}ms`}</div>
          </CardContent>
        </Card>
      </div>

      {runsQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
      {runsQuery.error ? <div className="text-sm text-red-600">{runsQuery.error.message}</div> : null}
    </div>
  );
}
